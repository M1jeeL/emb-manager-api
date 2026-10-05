import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../prisma.service.js';

import type { DashboardPeriodBounds } from '../types/dashboard-period.type.js';

@Injectable()
export class DashboardOperationsQuery {
  constructor(private readonly prisma: PrismaService) {}

  // ============================================================
  // CURRENT OPERATIONAL SUMMARY
  // ============================================================

  async getSummary(organizationId: string) {
    const rows = await this.prisma.$queryRaw<
      {
        activeOrders: bigint;
        pending: bigint;
        inProgress: bigint;
        ready: bigint;
        overdue: bigint;
        dueToday: bigint;
        dueNext7Days: bigint;
      }[]
    >`
      SELECT
        COUNT(*) FILTER (
          WHERE o."status" NOT IN (
            'QUOTE',
            'DELIVERED',
            'CANCELLED'
          )
        ) AS "activeOrders",

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
            AND o."status" NOT IN (
              'DELIVERED',
              'CANCELLED'
            )
        ) AS overdue,

        COUNT(*) FILTER (
          WHERE o."promisedAt" IS NOT NULL
            AND o."promisedAt" >= (
              CURRENT_DATE::date
              AT TIME ZONE 'America/Santiago'
            )
            AND o."promisedAt" < (
              (CURRENT_DATE::date + INTERVAL '1 day')
              AT TIME ZONE 'America/Santiago'
            )
            AND o."status" NOT IN (
              'DELIVERED',
              'CANCELLED'
            )
        ) AS "dueToday",

        COUNT(*) FILTER (
          WHERE o."promisedAt" IS NOT NULL
            AND o."promisedAt" >= NOW()
            AND o."promisedAt" < (
              (
                CURRENT_DATE::date + INTERVAL '8 days'
              )
              AT TIME ZONE 'America/Santiago'
            )
            AND o."status" NOT IN (
              'DELIVERED',
              'CANCELLED'
            )
        ) AS "dueNext7Days"

      FROM "orders" o

      WHERE o."organizationId" = ${organizationId};
    `;

    const row = rows[0];

    return {
      activeOrders: Number(row?.activeOrders ?? 0n),
      pending: Number(row?.pending ?? 0n),
      inProgress: Number(row?.inProgress ?? 0n),
      ready: Number(row?.ready ?? 0n),
      overdue: Number(row?.overdue ?? 0n),
      dueToday: Number(row?.dueToday ?? 0n),
      dueNext7Days: Number(row?.dueNext7Days ?? 0n),
    };
  }

  // ============================================================
  // FULFILLMENT
  // ============================================================

  async getFulfillment(organizationId: string, bounds: DashboardPeriodBounds) {
    const rows = await this.prisma.$queryRaw<
      {
        delivered: bigint;
        deliveredOnTime: bigint;
        deliveredLate: bigint;
        onTimeRatePercent: number | null;
        averageTurnaroundHours: number | null;
      }[]
    >`
      SELECT
        COUNT(*) AS delivered,

        COUNT(*) FILTER (
          WHERE o."promisedAt" IS NOT NULL
            AND o."deliveredAt" <= o."promisedAt"
        ) AS "deliveredOnTime",

        COUNT(*) FILTER (
          WHERE o."promisedAt" IS NOT NULL
            AND o."deliveredAt" > o."promisedAt"
        ) AS "deliveredLate",

        CASE
          WHEN COUNT(*) FILTER (
            WHERE o."promisedAt" IS NOT NULL
          ) = 0
          THEN NULL

          ELSE ROUND(
            (
              COUNT(*) FILTER (
                WHERE o."promisedAt" IS NOT NULL
                  AND o."deliveredAt" <= o."promisedAt"
              )::numeric
              /
              COUNT(*) FILTER (
                WHERE o."promisedAt" IS NOT NULL
              )::numeric
            ) * 100,
            2
          )
        END AS "onTimeRatePercent",

        CASE
          WHEN COUNT(*) = 0
          THEN NULL

          ELSE ROUND(
            AVG(
              EXTRACT(
                EPOCH FROM (
                  o."deliveredAt" - o."orderedAt"
                )
              ) / 3600
            )::numeric,
            2
          )::float
        END AS "averageTurnaroundHours"

      FROM "orders" o

      WHERE o."organizationId" = ${organizationId}

        AND o."deliveredAt" IS NOT NULL

        AND o."deliveredAt" >= (
          ${bounds.from}::date
          AT TIME ZONE 'America/Santiago'
        )

        AND o."deliveredAt" < (
          ${bounds.to}::date
          AT TIME ZONE 'America/Santiago'
        );
    `;

    const row = rows[0];

    return {
      delivered: Number(row?.delivered ?? 0n),
      deliveredOnTime: Number(row?.deliveredOnTime ?? 0n),
      deliveredLate: Number(row?.deliveredLate ?? 0n),
      onTimeRatePercent: row?.onTimeRatePercent ?? null,
      averageTurnaroundHours: row?.averageTurnaroundHours ?? null,
    };
  }

  // ============================================================
  // UPCOMING ORDERS
  // ============================================================

  async getUpcoming(organizationId: string) {
    const rows = await this.prisma.$queryRaw<
      {
        id: string;
        orderNumber: number;
        customerId: string;
        customerName: string;
        companyName: string | null;
        status: string;
        paymentStatus: string;
        promisedAt: Date;
        total: string;
        paidAmount: string;
      }[]
    >`
      SELECT
        o."id" AS id,
        o."orderNumber" AS "orderNumber",

        c."id" AS "customerId",
        c."name" AS "customerName",
        c."companyName" AS "companyName",

        o."status"::text AS status,
        o."paymentStatus"::text AS "paymentStatus",

        o."promisedAt" AS "promisedAt",

        o."total"::text AS total,
        o."paidAmount"::text AS "paidAmount"

      FROM "orders" o

      INNER JOIN "customers" c
        ON c."id" = o."customerId"

      WHERE o."organizationId" = ${organizationId}

        AND o."promisedAt" IS NOT NULL

        AND o."promisedAt" >= NOW()

        AND o."promisedAt" < (
          (
            CURRENT_DATE::date + INTERVAL '8 days'
          )
          AT TIME ZONE 'America/Santiago'
        )

        AND o."status" NOT IN (
          'DELIVERED',
          'CANCELLED'
        )

      ORDER BY
        o."promisedAt" ASC,
        o."orderNumber" ASC

      LIMIT 10;
    `;

    return rows.map((row) => ({
      id: row.id,

      orderNumber: row.orderNumber,

      customer: {
        id: row.customerId,
        name: row.customerName,
        companyName: row.companyName,
      },

      status: row.status,
      paymentStatus: row.paymentStatus,

      promisedAt: row.promisedAt.toISOString(),

      total: row.total,
      paidAmount: row.paidAmount,
    }));
  }
}
