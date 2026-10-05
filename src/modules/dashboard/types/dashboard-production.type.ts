export interface DashboardProductionSummary {
  pendingJobs: number;
  inProgressJobs: number;
  pausedJobs: number;
  completedJobs: number;
  cancelledJobs: number;

  pendingUnits: number;
  inProgressUnits: number;
  pausedUnits: number;
  completedUnits: number;
}

export interface DashboardProductionPerformance {
  completedJobs: number;
  completedUnits: number;
  averageCompletionHours: number | null;
}

export interface DashboardProductionMachine {
  machineId: string;
  machineName: string;
  machineCode: string | null;
  activeJobs: number;
  activeUnits: number;
}

export interface DashboardProductionEmployee {
  employeeId: string;
  employeeName: string;
  activeJobs: number;
  activeUnits: number;
}

export interface DashboardProductionResponse {
  period: {
    from: string;
    to: string;
    previousFrom: string;
    previousTo: string;
  };

  summary: DashboardProductionSummary;

  performance: DashboardProductionPerformance;

  machines: DashboardProductionMachine[];

  employees: DashboardProductionEmployee[];
}
