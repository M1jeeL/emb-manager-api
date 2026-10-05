import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { DashboardOverviewQuery } from './queries/dashboard-overview.query';
import { DashboardSalesQuery } from './queries/dashboard-sales.query.js';
import { DashboardOperationsQuery } from './queries/dashboard-operations.query.js';
import { DashboardProductionQuery } from './queries/dashboard-production.query';
import { DashboardCustomersQuery } from './queries/dashboard-customers.query';
import { DashboardAlertsQuery } from './queries/dashboard-alerts.query';

@Module({
  controllers: [DashboardController],
  providers: [
    DashboardService,
    DashboardOverviewQuery,
    DashboardSalesQuery,
    DashboardOperationsQuery,
    DashboardProductionQuery,
    DashboardCustomersQuery,
    DashboardAlertsQuery,
  ],
})
export class DashboardModule {}
