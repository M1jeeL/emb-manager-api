import { Module } from '@nestjs/common';

import { CustomersController } from './customers.controller.js';
import { CustomersService } from './customers.service.js';

import { SubscriptionGuard } from '../../common/guards/subscription.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';

@Module({
  controllers: [CustomersController],

  providers: [CustomersService, SubscriptionGuard, RolesGuard],
})
export class CustomersModule {}
