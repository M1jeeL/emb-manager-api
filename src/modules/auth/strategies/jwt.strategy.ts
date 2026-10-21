import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { UserRole } from '../../../generated/prisma/enums.js';
import { UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../../prisma.service.js';

export interface JwtPayload {
  sub: string;
  organizationId: string;
  role: UserRole;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: payload.sub,
        organizationId: payload.organizationId,
        active: true,
        organization: { active: true },
      },
      select: { id: true, organizationId: true, role: true },
    });
    if (!user) throw new UnauthorizedException('La sesión ya no es válida');

    return {
      userId: user.id,
      organizationId: user.organizationId,
      role: user.role,
    };
  }
}
