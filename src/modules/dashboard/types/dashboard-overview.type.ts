export interface DashboardPeriod {
  from: string;
  to: string;
  previousFrom: string;
  previousTo: string;
}

export interface DashboardSalesOverview {
  revenue: string;
  paid: string;
  averageOrderValue: string;

  revenueVariationPercent: number | null;
  paidVariationPercent: number | null;
  ordersVariationPercent: number | null;
}

export interface DashboardOrdersPeriod {
  created: number;
  delivered: number;
  cancelled: number;
}

export interface DashboardCustomersPeriod {
  newCustomers: number;
}

export interface DashboardCurrentOrders {
  quotes: number;
  pending: number;
  inProgress: number;
  ready: number;
  overdue: number;
}

export interface DashboardReceivables {
  amount: string;
  orders: number;
}

export interface DashboardCurrentProduction {
  pendingJobs: number;
  inProgressJobs: number;
  pausedJobs: number;

  pendingUnits: number;
  inProgressUnits: number;
}

export interface DashboardCurrentMachines {
  active: number;
  maintenance: number;
  inactive: number;
}

export interface DashboardOverviewResponse {
  period: DashboardPeriod;

  periodMetrics: {
    sales: DashboardSalesOverview;
    orders: DashboardOrdersPeriod;
    customers: DashboardCustomersPeriod;
  };

  current: {
    orders: DashboardCurrentOrders;
    receivables: DashboardReceivables;
    production: DashboardCurrentProduction;
    machines: DashboardCurrentMachines;
  };
}
