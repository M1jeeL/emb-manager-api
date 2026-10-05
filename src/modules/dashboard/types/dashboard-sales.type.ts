import { DashboardPeriodBounds } from './dashboard-period.type';

export interface DashboardSalesSummary {
  revenue: string;
  paid: string;
  averageOrderValue: string;
  orders: number;

  revenueVariationPercent: number | null;
  paidVariationPercent: number | null;
  ordersVariationPercent: number | null;
}

export interface DashboardSalesDaily {
  date: string;
  revenue: string;
  paid: string;
  orders: number;
}

export interface DashboardSalesPaymentMethod {
  method: string;
  amount: string;
  payments: number;
  percentage: number;
}

export interface DashboardSalesResponse {
  period: DashboardPeriodBounds;

  summary: DashboardSalesSummary;

  daily: DashboardSalesDaily[];

  paymentMethods: DashboardSalesPaymentMethod[];
}
