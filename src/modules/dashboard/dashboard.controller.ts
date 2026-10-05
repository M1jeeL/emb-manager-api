import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import { DashboardService } from './dashboard.service.js';
import { DashboardQueryDto } from './dto/dashboard-query.dto.js';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { SubscriptionGuard } from '../../common/guards/subscription.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';

import { CurrentUser } from '../../common/decorators/current-user.decorators.js';

import type { JwtUser } from '../../common/interfaces/jwt-user.interface.js';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, SubscriptionGuard, RolesGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  getOverview(@CurrentUser() user: JwtUser, @Query() query: DashboardQueryDto) {
    return this.dashboardService.getOverview(user.organizationId, query);
  }

  @Get('sales')
  getSales(@CurrentUser() user: JwtUser, @Query() query: DashboardQueryDto) {
    return this.dashboardService.getSales(user.organizationId, query);
  }

  @Get('operations')
  getOperations(
    @CurrentUser() user: JwtUser,
    @Query() query: DashboardQueryDto,
  ) {
    return this.dashboardService.getOperations(user.organizationId, query);
  }

  @Get('production')
  getProduction(
    @CurrentUser() user: JwtUser,
    @Query() query: DashboardQueryDto,
  ) {
    return this.dashboardService.getProduction(user.organizationId, query);
  }

  @Get('customers')
  getCustomers(
    @CurrentUser() user: JwtUser,
    @Query() query: DashboardQueryDto,
  ) {
    return this.dashboardService.getCustomers(user.organizationId, query);
  }

  @Get('alerts')
  getAlerts(@CurrentUser() user: JwtUser) {
    return this.dashboardService.getAlerts(user.organizationId);
  }
}
