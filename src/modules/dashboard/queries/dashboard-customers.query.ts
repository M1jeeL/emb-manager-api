import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma.service.js';
import type { DashboardPeriodBounds } from '../types/dashboard-period.type.js';
import type {
  DashboardCustomersSummary,
  DashboardTopCustomer,
} from '../types/dashboard-customers.type.js';

@Injectable()
export class DashboardCustomersQuery {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(
    organizationId: string,
    bounds: DashboardPeriodBounds,
  ): Promise<DashboardCustomersSummary> {
    const rows = await this.prisma.$queryRaw<
      {
        total: bigint;
        newCustomers: bigint;
        activeCustomers: bigint;
        inactiveCustomers: bigint;
      }[]
    >`
      SELECT
        COUNT(*) AS total,

        COUNT(*) FILTER (
          WHERE c."createdAt" >= (
            ${bounds.from}::date
            AT TIME ZONE 'America/Santiago'
          )
          AND c."createdAt" < (
            ${bounds.to}::date
            AT TIME ZONE 'America/Santiago'
          )
        ) AS "newCustomers",

        COUNT(*) FILTER (
          WHERE c."status" = 'ACTIVE'
        ) AS "activeCustomers",

        COUNT(*) FILTER (
          WHERE c."status" = 'INACTIVE'
        ) AS "inactiveCustomers"

      FROM "customers" c

      WHERE c."organizationId" = ${organizationId};
    `;

    const row = rows[0];

    return {
      total: Number(row?.total ?? 0n),
      newCustomers: Number(row?.newCustomers ?? 0n),
      activeCustomers: Number(row?.activeCustomers ?? 0n),
      inactiveCustomers: Number(row?.inactiveCustomers ?? 0n),
    };
  }

  async getTopCustomers(
    organizationId: string,
    bounds: DashboardPeriodBounds,
  ): Promise<DashboardTopCustomer[]> {
    const rows = await this.prisma.$queryRaw<
      {
        customerId: string;
        name: string;
        companyName: string | null;
        orders: bigint;
        revenue: string;
        pendingAmount: string;
      }[]
    >`
      SELECT
        c."id" AS "customerId",
        c."name",
        c."companyName",

        COUNT(DISTINCT o."id") AS "orders",

        COALESCE(
          SUM(o."total") FILTER (
            WHERE o."status" NOT IN ('QUOTE', 'CANCELLED')
          ),
          0
        ) AS "revenue",

        COALESCE(
          SUM(
            GREATEST(
              o."total" - o."paidAmount",
              0
            )
          ) FILTER (
            WHERE o."status" NOT IN ('QUOTE', 'CANCELLED')
          ),
          0
        ) AS "pendingAmount"

      FROM "customers" c

      INNER JOIN "orders" o
        ON o."customerId" = c."id"
        AND o."orderedAt" >= (
          ${bounds.from}::date
          AT TIME ZONE 'America/Santiago'
        )
        AND o."orderedAt" < (
          ${bounds.to}::date
          AT TIME ZONE 'America/Santiago'
        )

      WHERE c."organizationId" = ${organizationId}

      GROUP BY
        c."id",
        c."name",
        c."companyName"

      ORDER BY
        "revenue" DESC,
        "orders" DESC,
        c."name" ASC

      LIMIT 10;
    `;

    return rows.map((row) => ({
      customerId: row.customerId,
      name: row.name,
      companyName: row.companyName,
      orders: Number(row.orders ?? 0n),
      revenue: String(row.revenue),
      pendingAmount: String(row.pendingAmount),
    }));
  }
}
