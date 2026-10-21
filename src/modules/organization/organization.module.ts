import { Module } from '@nestjs/common';
import { OrganizationController } from './organization.controller.js';
import { OrganizationService } from './organization.service.js';
import { SubscriptionGuard } from '../../common/guards/subscription.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';

@Module({
  controllers: [OrganizationController],
  providers: [OrganizationService, SubscriptionGuard, RolesGuard],
})
export class OrganizationModule {}
