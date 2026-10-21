import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes, randomUUID } from 'node:crypto';

import { PrismaService } from '../../prisma.service.js';
import { UserRole } from '../../generated/prisma/enums.js';

import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { JwtPayload } from './strategies/jwt.strategy.js';

@Injectable()
export class AuthService {
  private readonly refreshLifetimeMs = 30 * 24 * 60 * 60 * 1000;
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();

    const existingUser = await this.prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (existingUser) {
      throw new ConflictException(
        'Ya existe un usuario registrado con este email',
      );
    }

    const plan = await this.prisma.plan.findUnique({
      where: {
        code: 'STANDARD',
      },
    });

    if (!plan || !plan.active) {
      throw new Error('El plan STANDARD no está disponible');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const slug = await this.generateUniqueOrganizationSlug(
      dto.organizationName,
    );

    const now = new Date();

    const trialEndsAt = new Date(now);

    trialEndsAt.setDate(trialEndsAt.getDate() + plan.trialDays);

    const result = await this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: dto.organizationName.trim(),
          slug,
          email,
        },
      });

      const user = await tx.user.create({
        data: {
          organizationId: organization.id,
          email,
          passwordHash,
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          role: UserRole.OWNER,
        },
      });

      const subscription = await tx.subscription.create({
        data: {
          organizationId: organization.id,
          planId: plan.id,
          status: 'TRIALING',
          trialStartsAt: now,
          trialEndsAt,
          currentPeriodStartsAt: now,
          currentPeriodEndsAt: trialEndsAt,
        },
      });

      return {
        organization,
        user,
        subscription,
      };
    });

    return {
      message: 'Registro creado correctamente',
      user: this.sanitizeUser(result.user),
      organization: {
        id: result.organization.id,
        name: result.organization.name,
        slug: result.organization.slug,
      },
      subscription: {
        status: result.subscription.status,
        trialEndsAt: result.subscription.trialEndsAt,
      },
    };
  }

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();

    const user = await this.prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (!user || !user.active) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const passwordMatches = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const payload: JwtPayload = {
      sub: user.id,
      organizationId: user.organizationId,
      role: user.role,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: '15m',
    });
    const refreshToken = await this.createRefreshToken(user.id);

    await this.prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        lastLoginAt: new Date(),
      },
    });

    return {
      accessToken,
      refreshToken,
      user: this.sanitizeUser(user),
    };
  }

  async refresh(rawToken?: string) {
    if (!rawToken) throw new UnauthorizedException('Sesión vencida');
    const [id] = rawToken.split('.');
    if (!id) throw new UnauthorizedException('Sesión inválida');

    const existing = await this.prisma.refreshToken.findUnique({
      where: { id },
      include: { user: { include: { organization: { select: { active: true } } } } },
    });

    if (!existing || existing.tokenHash !== this.hashToken(rawToken)) {
      throw new UnauthorizedException('Sesión inválida');
    }

    if (existing.revokedAt) {
      // Reutilizar una credencial rotada invalida todas las sesiones del usuario.
      await this.prisma.refreshToken.updateMany({
        where: { userId: existing.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Sesión revocada por seguridad');
    }

    if (existing.expiresAt <= new Date() || !existing.user.active || !existing.user.organization.active) {
      await this.prisma.refreshToken.update({
        where: { id: existing.id },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Sesión vencida');
    }

    const replacement = this.buildRefreshToken(existing.userId);
    const rotated = await this.prisma.$transaction(async (tx) => {
      const revoke = await tx.refreshToken.updateMany({
        where: { id: existing.id, tokenHash: this.hashToken(rawToken), revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (revoke.count !== 1) throw new UnauthorizedException('Sesión ya renovada');
      await tx.refreshToken.create({
        data: {
          id: replacement.id,
          userId: existing.userId,
          tokenHash: this.hashToken(replacement.value),
          expiresAt: replacement.expiresAt,
        },
      });
      return true;
    });

    if (!rotated) throw new UnauthorizedException('Sesión inválida');
    const accessToken = await this.jwtService.signAsync({
      sub: existing.user.id,
      organizationId: existing.user.organizationId,
      role: existing.user.role,
    } satisfies JwtPayload, { expiresIn: '15m' });

    return {
      accessToken,
      refreshToken: replacement.value,
      user: this.sanitizeUser(existing.user),
    };
  }

  async logout(rawToken?: string) {
    if (rawToken) {
      const [id] = rawToken.split('.');
      if (id) {
        await this.prisma.refreshToken.updateMany({
          where: { id, tokenHash: this.hashToken(rawToken), revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
    }
    return { message: 'Sesión cerrada' };
  }

  async revokeOtherSessions(userId: string, currentToken?: string) {
    const [currentId] = currentToken?.split('.') ?? [];
    const current = currentId ? await this.prisma.refreshToken.findFirst({
      where: { id: currentId, userId, tokenHash: this.hashToken(currentToken!) },
      select: { id: true },
    }) : null;
    const result = await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null, ...(current ? { id: { not: current.id } } : {}) },
      data: { revokedAt: new Date() },
    });
    return { revoked: result.count };
  }

  private buildRefreshToken(userId: string) {
    const id = randomUUID();
    return {
      id,
      userId,
      value: `${id}.${randomBytes(32).toString('base64url')}`,
      expiresAt: new Date(Date.now() + this.refreshLifetimeMs),
    };
  }

  private async createRefreshToken(userId: string) {
    const token = this.buildRefreshToken(userId);
    await this.prisma.refreshToken.create({
      data: {
        id: token.id,
        userId,
        tokenHash: this.hashToken(token.value),
        expiresAt: token.expiresAt,
      },
    });
    return token.value;
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private sanitizeUser(user: {
    id: string;
    organizationId: string;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    active: boolean;
  }) {
    return {
      id: user.id,
      organizationId: user.organizationId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      active: user.active,
    };
  }

  private async generateUniqueOrganizationSlug(
    organizationName: string,
  ): Promise<string> {
    const baseSlug = this.slugify(organizationName);

    let slug = baseSlug;
    let counter = 2;

    while (
      await this.prisma.organization.findUnique({
        where: {
          slug,
        },
      })
    ) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }

  private slugify(value: string): string {
    const slug = value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    return slug || `organization-${Date.now()}`;
  }

  async getCurrentUser(userId: string, organizationId: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        organizationId,
        active: true,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        active: true,
        organizationId: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado o inactivo');
    }

    return {
      user,
    };
  }
}
