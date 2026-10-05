import { DashboardPeriodBounds } from './dashboard-period.type';

export interface DashboardOperationsSummary {
  activeOrders: number;
  pending: number;
  inProgress: number;
  ready: number;

  overdue: number;
  dueToday: number;
  dueNext7Days: number;
}

export interface DashboardOperationsFulfillment {
  delivered: number;
  deliveredOnTime: number;
  deliveredLate: number;
  onTimeRatePercent: number | null;
  averageTurnaroundHours: number | null;
}

export interface DashboardUpcomingOrder {
  id: string;
  orderNumber: number;
  customer: {
    id: string;
    name: string;
    companyName: string | null;
  };
  status: string;
  paymentStatus: string;
  promisedAt: string;
  total: string;
  paidAmount: string;
}

export interface DashboardOperationsResponse {
  period: DashboardPeriodBounds;

  summary: DashboardOperationsSummary;

  fulfillment: DashboardOperationsFulfillment;

  upcoming: DashboardUpcomingOrder[];
}
