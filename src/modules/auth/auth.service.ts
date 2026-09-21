import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../../prisma.service.js';
import { UserRole } from '../../generated/prisma/enums.js';

import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { JwtPayload } from './strategies/jwt.strategy.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
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

    const accessToken = await this.jwtService.signAsync(payload);

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
      user: this.sanitizeUser(user),
    };
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
