import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma.service.js';
import type { DashboardPeriodBounds } from '../types/dashboard-period.type.js';
import type {
  DashboardProductionEmployee,
  DashboardProductionMachine,
  DashboardProductionPerformance,
  DashboardProductionSummary,
} from '../types/dashboard-production.type.js';

@Injectable()
export class DashboardProductionQuery {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(
    organizationId: string,
  ): Promise<DashboardProductionSummary> {
    const rows = await this.prisma.$queryRaw<
      {
        pendingJobs: bigint;
        inProgressJobs: bigint;
        pausedJobs: bigint;
        completedJobs: bigint;
        cancelledJobs: bigint;

        pendingUnits: bigint;
        inProgressUnits: bigint;
        pausedUnits: bigint;
        completedUnits: bigint;
      }[]
    >`
      SELECT
        COUNT(*) FILTER (
          WHERE pj."status" = 'PENDING'
        ) AS "pendingJobs",

        COUNT(*) FILTER (
          WHERE pj."status" = 'IN_PROGRESS'
        ) AS "inProgressJobs",

        COUNT(*) FILTER (
          WHERE pj."status" = 'PAUSED'
        ) AS "pausedJobs",

        COUNT(*) FILTER (
          WHERE pj."status" = 'COMPLETED'
        ) AS "completedJobs",

        COUNT(*) FILTER (
          WHERE pj."status" = 'CANCELLED'
        ) AS "cancelledJobs",

        COALESCE(
          SUM(pj."quantity") FILTER (
            WHERE pj."status" = 'PENDING'
          ),
          0
        ) AS "pendingUnits",

        COALESCE(
          SUM(pj."quantity") FILTER (
            WHERE pj."status" = 'IN_PROGRESS'
          ),
          0
        ) AS "inProgressUnits",

        COALESCE(
          SUM(pj."quantity") FILTER (
            WHERE pj."status" = 'PAUSED'
          ),
          0
        ) AS "pausedUnits",

        COALESCE(
          SUM(pj."quantity") FILTER (
            WHERE pj."status" = 'COMPLETED'
          ),
          0
        ) AS "completedUnits"

      FROM "production_jobs" pj
      INNER JOIN "orders" o
        ON o."id" = pj."orderId"

      WHERE o."organizationId" = ${organizationId}
        AND o."status" <> 'CANCELLED';
    `;

    const row = rows[0];

    return {
      pendingJobs: Number(row?.pendingJobs ?? 0n),
      inProgressJobs: Number(row?.inProgressJobs ?? 0n),
      pausedJobs: Number(row?.pausedJobs ?? 0n),
      completedJobs: Number(row?.completedJobs ?? 0n),
      cancelledJobs: Number(row?.cancelledJobs ?? 0n),

      pendingUnits: Number(row?.pendingUnits ?? 0n),
      inProgressUnits: Number(row?.inProgressUnits ?? 0n),
      pausedUnits: Number(row?.pausedUnits ?? 0n),
      completedUnits: Number(row?.completedUnits ?? 0n),
    };
  }

  async getPerformance(
    organizationId: string,
    bounds: DashboardPeriodBounds,
  ): Promise<DashboardProductionPerformance> {
    const rows = await this.prisma.$queryRaw<
      {
        completedJobs: bigint;
        completedUnits: bigint;
        averageCompletionHours: number | null;
      }[]
    >`
      SELECT
        COUNT(*) AS "completedJobs",

        COALESCE(
          SUM(pj."quantity"),
          0
        ) AS "completedUnits",

        AVG(
          EXTRACT(
            EPOCH FROM (
              pj."completedAt" - pj."startedAt"
            )
          ) / 3600.0
        ) AS "averageCompletionHours"

      FROM "production_jobs" pj
      INNER JOIN "orders" o
        ON o."id" = pj."orderId"

      WHERE o."organizationId" = ${organizationId}
        AND pj."status" = 'COMPLETED'

        AND pj."completedAt" >= (
          ${bounds.from}::date
          AT TIME ZONE 'America/Santiago'
        )

        AND pj."completedAt" < (
          ${bounds.to}::date
          AT TIME ZONE 'America/Santiago'
        )

        AND pj."startedAt" IS NOT NULL
        AND pj."completedAt" IS NOT NULL;
    `;

    const row = rows[0];

    return {
      completedJobs: Number(row?.completedJobs ?? 0n),
      completedUnits: Number(row?.completedUnits ?? 0n),
      averageCompletionHours:
        row?.averageCompletionHours === null ||
        row?.averageCompletionHours === undefined
          ? null
          : Number(row.averageCompletionHours.toFixed(2)),
    };
  }

  async getMachines(
    organizationId: string,
  ): Promise<DashboardProductionMachine[]> {
    const rows = await this.prisma.$queryRaw<
      {
        machineId: string;
        machineName: string;
        machineCode: string | null;
        activeJobs: bigint;
        activeUnits: bigint;
      }[]
    >`
      SELECT
        m."id" AS "machineId",
        m."name" AS "machineName",
        m."code" AS "machineCode",

        COUNT(pj."id") FILTER (
          WHERE pj."status" IN ('PENDING', 'IN_PROGRESS', 'PAUSED')
        ) AS "activeJobs",

        COALESCE(
          SUM(pj."quantity") FILTER (
            WHERE pj."status" IN ('PENDING', 'IN_PROGRESS', 'PAUSED')
          ),
          0
        ) AS "activeUnits"

      FROM "machines" m

      LEFT JOIN "production_jobs" pj
        ON pj."machineId" = m."id"

      LEFT JOIN "orders" o
        ON o."id" = pj."orderId"
        AND o."organizationId" = ${organizationId}

      WHERE m."organizationId" = ${organizationId}
        AND m."status" <> 'INACTIVE'

      GROUP BY
        m."id",
        m."name",
        m."code"

      ORDER BY
        "activeUnits" DESC,
        "machineName" ASC;
    `;

    return rows.map((row) => ({
      machineId: row.machineId,
      machineName: row.machineName,
      machineCode: row.machineCode,
      activeJobs: Number(row.activeJobs ?? 0n),
      activeUnits: Number(row.activeUnits ?? 0n),
    }));
  }

  async getEmployees(
    organizationId: string,
  ): Promise<DashboardProductionEmployee[]> {
    const rows = await this.prisma.$queryRaw<
      {
        employeeId: string;
        employeeName: string;
        activeJobs: bigint;
        activeUnits: bigint;
      }[]
    >`
      SELECT
        e."id" AS "employeeId",

        CONCAT(
          e."firstName",
          ' ',
          e."lastName"
        ) AS "employeeName",

        COUNT(pj."id") FILTER (
          WHERE pj."status" IN ('PENDING', 'IN_PROGRESS', 'PAUSED')
        ) AS "activeJobs",

        COALESCE(
          SUM(pj."quantity") FILTER (
            WHERE pj."status" IN ('PENDING', 'IN_PROGRESS', 'PAUSED')
          ),
          0
        ) AS "activeUnits"

      FROM "employees" e

      LEFT JOIN "production_jobs" pj
        ON pj."employeeId" = e."id"

      LEFT JOIN "orders" o
        ON o."id" = pj."orderId"
        AND o."organizationId" = ${organizationId}

      WHERE e."organizationId" = ${organizationId}
        AND e."status" = 'ACTIVE'

      GROUP BY
        e."id",
        e."firstName",
        e."lastName"

      ORDER BY
        "activeUnits" DESC,
        "employeeName" ASC;
    `;

    return rows.map((row) => ({
      employeeId: row.employeeId,
      employeeName: row.employeeName,
      activeJobs: Number(row.activeJobs ?? 0n),
      activeUnits: Number(row.activeUnits ?? 0n),
    }));
  }
}
