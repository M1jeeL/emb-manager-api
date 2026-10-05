import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma.service.js';

import type { DashboardPeriodBounds } from '../types/dashboard-period.type.js';

@Injectable()
export class DashboardSalesQuery {
  constructor(private readonly prisma: PrismaService) {}

  // ============================================================
  // SUMMARY
  // ============================================================

  async getSummary(organizationId: string, bounds: DashboardPeriodBounds) {
    const [currentRows, previousRows] = await Promise.all([
      this.getSummaryForPeriod(organizationId, bounds.from, bounds.to),

      this.getSummaryForPeriod(
        organizationId,
        bounds.previousFrom,
        bounds.previousTo,
      ),
    ]);

    const current = currentRows[0];
    const previous = previousRows[0];

    const revenue = current?.revenue ?? '0';
    const paid = current?.paid ?? '0';
    const orders = Number(current?.orders ?? 0n);

    const previousRevenue = previous?.revenue ?? '0';
    const previousPaid = previous?.paid ?? '0';
    const previousOrders = Number(previous?.orders ?? 0n);

    return {
      revenue,
      paid,
      orders,

      revenueVariationPercent: this.calculateVariation(
        revenue,
        previousRevenue,
      ),

      paidVariationPercent: this.calculateVariation(paid, previousPaid),

      ordersVariationPercent: this.calculateVariation(orders, previousOrders),
    };
  }

  private async getSummaryForPeriod(
    organizationId: string,
    from: string,
    to: string,
  ) {
    const [salesRows, paymentRows] = await Promise.all([
      this.prisma.$queryRaw<
        {
          revenue: string | null;
          orders: bigint;
        }[]
      >`
        SELECT
          COALESCE(
            SUM(o."total"),
            0
          )::text AS revenue,

          COUNT(*) AS orders

        FROM "orders" o

        WHERE o."organizationId" = ${organizationId}

          AND o."orderedAt" >= (
            ${from}::date
            AT TIME ZONE 'America/Santiago'
          )

          AND o."orderedAt" < (
            ${to}::date
            AT TIME ZONE 'America/Santiago'
          )

          AND o."status" NOT IN (
            'QUOTE',
            'CANCELLED'
          );
      `,

      this.prisma.$queryRaw<
        {
          paid: string | null;
        }[]
      >`
        SELECT
          COALESCE(
            SUM(p."amount"),
            0
          )::text AS paid

        FROM "payments" p

        INNER JOIN "orders" o
          ON o."id" = p."orderId"

        WHERE o."organizationId" = ${organizationId}

          AND p."paidAt" >= (
            ${from}::date
            AT TIME ZONE 'America/Santiago'
          )

          AND p."paidAt" < (
            ${to}::date
            AT TIME ZONE 'America/Santiago'
          );
      `,
    ]);

    return [
      {
        revenue: salesRows[0]?.revenue ?? '0',
        orders: salesRows[0]?.orders ?? 0n,
        paid: paymentRows[0]?.paid ?? '0',
      },
    ];
  }

  // ============================================================
  // DAILY SALES
  // ============================================================

  async getDailySales(organizationId: string, bounds: DashboardPeriodBounds) {
    const rows = await this.prisma.$queryRaw<
      {
        date: string;
        revenue: string | null;
        paid: string | null;
        orders: bigint;
      }[]
    >`
      WITH days AS (
        SELECT generate_series(
          ${bounds.from}::date,
          (${bounds.to}::date - INTERVAL '1 day'),
          INTERVAL '1 day'
        )::date AS day
      ),

      daily_sales AS (
        SELECT
          (
            o."orderedAt"
            AT TIME ZONE 'America/Santiago'
          )::date AS day,

          COALESCE(
            SUM(o."total"),
            0
          )::text AS revenue,

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

          AND o."status" NOT IN (
            'QUOTE',
            'CANCELLED'
          )

        GROUP BY day
      ),

      daily_payments AS (
        SELECT
          (
            p."paidAt"
            AT TIME ZONE 'America/Santiago'
          )::date AS day,

          COALESCE(
            SUM(p."amount"),
            0
          )::text AS paid

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
          )

        GROUP BY day
      )

      SELECT
        TO_CHAR(days.day, 'YYYY-MM-DD') AS date,

        COALESCE(
          daily_sales.revenue,
          '0'
        ) AS revenue,

        COALESCE(
          daily_payments.paid,
          '0'
        ) AS paid,

        COALESCE(
          daily_sales.orders,
          0
        ) AS orders

      FROM days

      LEFT JOIN daily_sales
        ON daily_sales.day = days.day

      LEFT JOIN daily_payments
        ON daily_payments.day = days.day

      ORDER BY days.day ASC;
    `;

    return rows.map((row) => ({
      date: row.date,
      revenue: row.revenue ?? '0',
      paid: row.paid ?? '0',
      orders: Number(row.orders ?? 0n),
    }));
  }

  // ============================================================
  // PAYMENT METHODS
  // ============================================================

  async getPaymentMethods(
    organizationId: string,
    bounds: DashboardPeriodBounds,
  ) {
    const rows = await this.prisma.$queryRaw<
      {
        method: string;
        amount: string | null;
        payments: bigint;
      }[]
    >`
      SELECT
        p."method"::text AS method,

        COALESCE(
          SUM(p."amount"),
          0
        )::text AS amount,

        COUNT(*) AS payments

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
        )

      GROUP BY p."method"

      ORDER BY SUM(p."amount") DESC;
    `;

    const total = rows.reduce((sum, row) => sum + Number(row.amount ?? '0'), 0);

    return rows.map((row) => {
      const amount = row.amount ?? '0';

      return {
        method: row.method,
        amount,
        payments: Number(row.payments ?? 0n),
        percentage:
          total > 0 ? Number(((Number(amount) / total) * 100).toFixed(2)) : 0,
      };
    });
  }

  // ============================================================
  // UTILS
  // ============================================================

  private calculateVariation(
    current: string | number,
    previous: string | number,
  ): number | null {
    const currentNumber = Number(current);
    const previousNumber = Number(previous);

    if (previousNumber === 0) {
      if (currentNumber === 0) {
        return 0;
      }

      return null;
    }

    return Number(
      (((currentNumber - previousNumber) / previousNumber) * 100).toFixed(2),
    );
  }
}
