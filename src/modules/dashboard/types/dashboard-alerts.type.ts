export type DashboardAlertSeverity = 'CRITICAL' | 'WARNING' | 'INFO';

export type DashboardAlertType =
  | 'OVERDUE_ORDER'
  | 'UPCOMING_DELIVERY'
  | 'PRODUCTION_BACKLOG'
  | 'MACHINE_MAINTENANCE'
  | 'RECEIVABLE';

export interface DashboardAlert {
  type: DashboardAlertType;
  severity: DashboardAlertSeverity;
  title: string;
  description: string;
  count: number;
  amount?: string;
}

export interface DashboardAlertsResponse {
  alerts: DashboardAlert[];
}
