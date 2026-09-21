import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import { PrismaService } from '../../prisma.service.js';
import { JwtUser } from '../interfaces/jwt-user.interface.js';

@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ user: JwtUser }>();

    const user = request.user;

    if (!user?.organizationId) {
      throw new ForbiddenException('No se pudo determinar la organización');
    }

    const organization = await this.prisma.organization.findUnique({
      where: {
        id: user.organizationId,
      },
      select: {
        active: true,
        subscription: {
          select: {
            status: true,
            trialEndsAt: true,
            currentPeriodEndsAt: true,
          },
        },
      },
    });

    if (!organization) {
      throw new ForbiddenException('La organización no existe');
    }

    if (!organization.active) {
      throw new ForbiddenException('La organización está inactiva');
    }

    if (!organization.subscription) {
      throw new ForbiddenException(
        'La organización no tiene una suscripción activa',
      );
    }

    const { status } = organization.subscription;

    if (status !== 'TRIALING' && status !== 'ACTIVE') {
      throw new ForbiddenException(
        'La suscripción no permite utilizar el sistema',
      );
    }

    return true;
  }
}
