import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { DashboardOverviewQuery } from './queries/dashboard-overview.query';

@Module({
  controllers: [DashboardController],
  providers: [DashboardService, DashboardOverviewQuery],
})
export class DashboardModule {}
