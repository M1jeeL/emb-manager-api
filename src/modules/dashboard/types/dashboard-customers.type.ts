import { DashboardPeriodBounds } from './dashboard-period.type';

export interface DashboardCustomersSummary {
  total: number;
  newCustomers: number;
  activeCustomers: number;
  inactiveCustomers: number;
}

export interface DashboardTopCustomer {
  customerId: string;
  name: string;
  companyName: string | null;
  orders: number;
  revenue: string;
  pendingAmount: string;
}

export interface DashboardCustomersResponse {
  period: DashboardPeriodBounds;

  summary: DashboardCustomersSummary;

  topCustomers: DashboardTopCustomer[];
}
