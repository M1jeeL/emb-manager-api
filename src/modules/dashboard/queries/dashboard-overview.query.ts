import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../prisma.service.js';
import { DashboardPeriodBounds } from '../types/dashboard-period.type.js';

@Injectable()
export class DashboardOverviewQuery {
  constructor(private readonly prisma: PrismaService) {}

  // ============================================================
  // SALES
  // ============================================================

  async getSalesMetrics(organizationId: string, bounds: DashboardPeriodBounds) {
    const [salesRows, paymentRows] = await Promise.all([
      this.prisma.$queryRaw<
        {
          revenue: string | null;
          orders: bigint;
        }[]
      >`
        SELECT
          COALESCE(SUM(o."total"), 0)::text AS revenue,
          COUNT(*) AS orders
        FROM "orders" o
        WHERE o."organizationId" = ${organizationId}
          AND o."orderedAt" >= (
            ${bounds.from}::date
            AT TIME ZONE 'America/Santiago'
          )
          AND o."orderedAt" < (
            ${bounds.to}::date
            AT TIME ZONE 'America/Santiago'
          )
          AND o."status" NOT IN ('QUOTE', 'CANCELLED');
      `,

      this.prisma.$queryRaw<
        {
          paid: string | null;
        }[]
      >`
        SELECT
          COALESCE(SUM(p."amount"), 0)::text AS paid
        FROM "payments" p
        INNER JOIN "orders" o
          ON o."id" = p."orderId"
        WHERE o."organizationId" = ${organizationId}
          AND p."paidAt" >= (
            ${bounds.from}::date
            AT TIME ZONE 'America/Santiago'
          )
          AND p."paidAt" < (
            ${bounds.to}::date
            AT TIME ZONE 'America/Santiago'
          );
      `,
    ]);

    const sales = salesRows[0];
    const payments = paymentRows[0];

    return {
      revenue: sales?.revenue ?? '0',
      orders: Number(sales?.orders ?? 0n),
      paid: payments?.paid ?? '0',
    };
  }

  // ============================================================
  // PREVIOUS SALES
  // ============================================================

  async getPreviousSalesMetrics(
    organizationId: string,
    bounds: DashboardPeriodBounds,
  ) {
    const [salesRows, paymentRows] = await Promise.all([
      this.prisma.$queryRaw<
        {
          revenue: string | null;
          orders: bigint;
        }[]
      >`
        SELECT
          COALESCE(SUM(o."total"), 0)::text AS revenue,
          COUNT(*) AS orders
        FROM "orders" o
        WHERE o."organizationId" = ${organizationId}
          AND o."orderedAt" >= (
            ${bounds.previousFrom}::date
            AT TIME ZONE 'America/Santiago'
          )
          AND o."orderedAt" < (
            ${bounds.previousTo}::date
            AT TIME ZONE 'America/Santiago'
          )
          AND o."status" NOT IN ('QUOTE', 'CANCELLED');
      `,

      this.prisma.$queryRaw<
        {
          paid: string | null;
        }[]
      >`
        SELECT
          COALESCE(SUM(p."amount"), 0)::text AS paid
        FROM "payments" p
        INNER JOIN "orders" o
          ON o."id" = p."orderId"
        WHERE o."organizationId" = ${organizationId}
          AND p."paidAt" >= (
            ${bounds.previousFrom}::date
            AT TIME ZONE 'America/Santiago'
          )
          AND p."paidAt" < (
            ${bounds.previousTo}::date
            AT TIME ZONE 'America/Santiago'
          );
      `,
    ]);

    const sales = salesRows[0];
    const payments = paymentRows[0];

    return {
      revenue: sales?.revenue ?? '0',
      orders: Number(sales?.orders ?? 0n),
      paid: payments?.paid ?? '0',
    };
  }

  // ============================================================
  // ORDERS - PERIOD
  // ============================================================

  async getOrderPeriodMetrics(
    organizationId: string,
    bounds: DashboardPeriodBounds,
  ) {
    const rows = await this.prisma.$queryRaw<
      {
        created: bigint;
        delivered: bigint;
        cancelled: bigint;
      }[]
    >`
    SELECT
      -- Pedidos creados durante el período.
      COUNT(*) FILTER (
        WHERE o."status" <> 'QUOTE'
      ) AS created,

      -- Pedidos entregados durante el período.
      COUNT(*) FILTER (
        WHERE o."deliveredAt" >= (
          ${bounds.from}::date
          AT TIME ZONE 'America/Santiago'
        )
        AND o."deliveredAt" < (
          ${bounds.to}::date
          AT TIME ZONE 'America/Santiago'
        )
      ) AS delivered,

      -- Pedidos que cambiaron a CANCELLED durante el período.
      (
        SELECT COUNT(DISTINCT h."orderId")
        FROM "order_status_history" h
        INNER JOIN "orders" cancelled_order
          ON cancelled_order."id" = h."orderId"
        WHERE cancelled_order."organizationId" = ${organizationId}
          AND h."toStatus" = 'CANCELLED'
          AND h."createdAt" >= (
            ${bounds.from}::date
            AT TIME ZONE 'America/Santiago'
          )
          AND h."createdAt" < (
            ${bounds.to}::date
            AT TIME ZONE 'America/Santiago'
          )
      ) AS cancelled

    FROM "orders" o

    WHERE o."organizationId" = ${organizationId}
      AND o."orderedAt" >= (
        ${bounds.from}::date
        AT TIME ZONE 'America/Santiago'
      )
      AND o."orderedAt" < (
        ${bounds.to}::date
        AT TIME ZONE 'America/Santiago'
      );
  `;

    const row = rows[0];

    return {
      created: Number(row?.created ?? 0n),
      delivered: Number(row?.delivered ?? 0n),
      cancelled: Number(row?.cancelled ?? 0n),
    };
  }

  // ============================================================
  // CUSTOMERS - PERIOD
  // ============================================================

  async getNewCustomers(organizationId: string, bounds: DashboardPeriodBounds) {
    const rows = await this.prisma.$queryRaw<
      {
        count: bigint;
      }[]
    >`
      SELECT COUNT(*) AS count

      FROM "customers" c

      WHERE c."organizationId" = ${organizationId}

        AND c."createdAt" >= (
          ${bounds.from}::date
          AT TIME ZONE 'America/Santiago'
        )

        AND c."createdAt" < (
          ${bounds.to}::date
          AT TIME ZONE 'America/Santiago'
        );
    `;

    return Number(rows[0]?.count ?? 0n);
  }

  // ============================================================
  // CURRENT ORDERS
  // ============================================================

  async getCurrentOrderMetrics(organizationId: string) {
    const rows = await this.prisma.$queryRaw<
      {
        quotes: bigint;
        pending: bigint;
        inProgress: bigint;
        ready: bigint;
        overdue: bigint;
      }[]
    >`
      SELECT

        COUNT(*) FILTER (
          WHERE o."status" = 'QUOTE'
        ) AS quotes,

        COUNT(*) FILTER (
          WHERE o."status" = 'PENDING'
        ) AS pending,

        COUNT(*) FILTER (
          WHERE o."status" = 'IN_PROGRESS'
        ) AS "inProgress",

        COUNT(*) FILTER (
          WHERE o."status" = 'READY'
        ) AS ready,

        COUNT(*) FILTER (
          WHERE o."promisedAt" IS NOT NULL
            AND o."promisedAt" < NOW()
            AND o."status" NOT IN ('DELIVERED', 'CANCELLED')
        ) AS overdue

      FROM "orders" o

      WHERE o."organizationId" = ${organizationId};
    `;

    const row = rows[0];

    return {
      quotes: Number(row?.quotes ?? 0n),
      pending: Number(row?.pending ?? 0n),
      inProgress: Number(row?.inProgress ?? 0n),
      ready: Number(row?.ready ?? 0n),
      overdue: Number(row?.overdue ?? 0n),
    };
  }

  // ============================================================
  // RECEIVABLES
  // ============================================================

  async getCurrentReceivables(organizationId: string) {
    const rows = await this.prisma.$queryRaw<
      {
        amount: string | null;
        orders: bigint;
      }[]
    >`
      SELECT

        COALESCE(
          SUM(
            GREATEST(
              o."total" - o."paidAmount",
              0
            )
          ),
          0
        )::text AS amount,

        COUNT(*) AS orders

      FROM "orders" o

      WHERE o."organizationId" = ${organizationId}

        AND o."status" NOT IN ('QUOTE', 'CANCELLED')

        AND o."total" > o."paidAmount";
    `;

    const row = rows[0];

    return {
      amount: row?.amount ?? '0',
      orders: Number(row?.orders ?? 0n),
    };
  }

  // ============================================================
  // CURRENT PRODUCTION
  // ============================================================

  async getCurrentProductionMetrics(organizationId: string) {
    const rows = await this.prisma.$queryRaw<
      {
        pendingJobs: bigint;
        inProgressJobs: bigint;
        pausedJobs: bigint;
        pendingUnits: bigint;
        inProgressUnits: bigint;
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

      COALESCE(
        SUM(
          CASE
            WHEN pj."status" = 'PENDING'
            THEN pj."quantity"
            ELSE 0
          END
        ),
        0
      ) AS "pendingUnits",

      COALESCE(
        SUM(
          CASE
            WHEN pj."status" = 'IN_PROGRESS'
            THEN pj."quantity"
            ELSE 0
          END
        ),
        0
      ) AS "inProgressUnits"

    FROM "production_jobs" pj

    INNER JOIN "orders" o
      ON o."id" = pj."orderId"

    WHERE o."organizationId" = ${organizationId}
      AND o."status" <> 'CANCELLED'
      AND pj."status" NOT IN ('COMPLETED', 'CANCELLED');
  `;

    const row = rows[0];

    return {
      pendingJobs: Number(row?.pendingJobs ?? 0n),
      inProgressJobs: Number(row?.inProgressJobs ?? 0n),
      pausedJobs: Number(row?.pausedJobs ?? 0n),
      pendingUnits: Number(row?.pendingUnits ?? 0n),
      inProgressUnits: Number(row?.inProgressUnits ?? 0n),
    };
  }

  // ============================================================
  // CURRENT MACHINES
  // ============================================================

  async getCurrentMachineMetrics(organizationId: string) {
    const rows = await this.prisma.$queryRaw<
      {
        active: bigint;
        maintenance: bigint;
        inactive: bigint;
      }[]
    >`
      SELECT

        COUNT(*) FILTER (
          WHERE m."status" = 'ACTIVE'
        ) AS active,

        COUNT(*) FILTER (
          WHERE m."status" = 'MAINTENANCE'
        ) AS maintenance,

        COUNT(*) FILTER (
          WHERE m."status" = 'INACTIVE'
        ) AS inactive

      FROM "machines" m

      WHERE m."organizationId" = ${organizationId};
    `;

    const row = rows[0];

    return {
      active: Number(row?.active ?? 0n),
      maintenance: Number(row?.maintenance ?? 0n),
      inactive: Number(row?.inactive ?? 0n),
    };
  }
}
