import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma.service.js';
import type { DashboardAlert } from '../types/dashboard-alerts.type.js';

@Injectable()
export class DashboardAlertsQuery {
  constructor(private readonly prisma: PrismaService) {}

  async getOverdueOrders(
    organizationId: string,
  ): Promise<DashboardAlert | null> {
    const rows = await this.prisma.$queryRaw<
      {
        count: bigint;
        amount: string;
      }[]
    >`
      SELECT
        COUNT(*) AS count,

        COALESCE(
          SUM(
            GREATEST(
              o."total" - o."paidAmount",
              0
            )
          ),
          0
        ) AS amount

      FROM "orders" o

      WHERE o."organizationId" = ${organizationId}
        AND o."promisedAt" IS NOT NULL
        AND o."promisedAt" < NOW()
        AND o."status" NOT IN ('QUOTE', 'DELIVERED', 'CANCELLED');
    `;

    const row = rows[0];
    const count = Number(row?.count ?? 0n);

    if (count === 0) {
      return null;
    }

    return {
      type: 'OVERDUE_ORDER',
      severity: 'CRITICAL',
      title: 'Pedidos atrasados',
      description: 'Hay pedidos que superaron su fecha comprometida.',
      count,
      amount: String(row?.amount ?? '0'),
    };
  }

  async getUpcomingDeliveries(
    organizationId: string,
  ): Promise<DashboardAlert | null> {
    const rows = await this.prisma.$queryRaw<
      {
        count: bigint;
      }[]
    >`
      SELECT
        COUNT(*) AS count

      FROM "orders" o

      WHERE o."organizationId" = ${organizationId}
        AND o."promisedAt" IS NOT NULL
        AND o."promisedAt" >= NOW()
        AND o."promisedAt" < (
          CURRENT_DATE + INTERVAL '3 days'
        )
        AND o."status" NOT IN ('QUOTE', 'DELIVERED', 'CANCELLED');
    `;

    const count = Number(rows[0]?.count ?? 0n);

    if (count === 0) {
      return null;
    }

    return {
      type: 'UPCOMING_DELIVERY',
      severity: 'WARNING',
      title: 'Entregas próximas',
      description:
        'Hay pedidos con entrega comprometida dentro de los próximos 3 días.',
      count,
    };
  }

  async getProductionBacklog(
    organizationId: string,
  ): Promise<DashboardAlert | null> {
    const rows = await this.prisma.$queryRaw<
      {
        jobs: bigint;
        units: bigint;
      }[]
    >`
      SELECT
        COUNT(pj."id") AS jobs,

        COALESCE(
          SUM(pj."quantity"),
          0
        ) AS units

      FROM "production_jobs" pj

      INNER JOIN "orders" o
        ON o."id" = pj."orderId"

      WHERE o."organizationId" = ${organizationId}
        AND o."status" <> 'CANCELLED'
        AND pj."status" IN (
          'PENDING',
          'IN_PROGRESS',
          'PAUSED'
        );
    `;

    const jobs = Number(rows[0]?.jobs ?? 0n);
    const units = Number(rows[0]?.units ?? 0n);

    if (jobs === 0) {
      return null;
    }

    return {
      type: 'PRODUCTION_BACKLOG',
      severity: units >= 50 ? 'WARNING' : 'INFO',
      title: 'Producción acumulada',
      description: `${jobs} trabajos tienen producción pendiente o en curso.`,
      count: jobs,
    };
  }

  async getMachinesMaintenance(
    organizationId: string,
  ): Promise<DashboardAlert | null> {
    const rows = await this.prisma.$queryRaw<
      {
        count: bigint;
      }[]
    >`
      SELECT
        COUNT(*) AS count

      FROM "machines" m

      WHERE m."organizationId" = ${organizationId}
        AND m."status" = 'MAINTENANCE';
    `;

    const count = Number(rows[0]?.count ?? 0n);

    if (count === 0) {
      return null;
    }

    return {
      type: 'MACHINE_MAINTENANCE',
      severity: 'WARNING',
      title: 'Máquinas en mantenimiento',
      description:
        'Hay máquinas que actualmente no están disponibles para producción.',
      count,
    };
  }

  async getReceivables(organizationId: string): Promise<DashboardAlert | null> {
    const rows = await this.prisma.$queryRaw<
      {
        count: bigint;
        amount: string;
      }[]
    >`
      SELECT
        COUNT(*) AS count,

        COALESCE(
          SUM(
            GREATEST(
              o."total" - o."paidAmount",
              0
            )
          ),
          0
        ) AS amount

      FROM "orders" o

      WHERE o."organizationId" = ${organizationId}
        AND o."status" NOT IN ('QUOTE', 'CANCELLED')
        AND o."paymentStatus" IN ('UNPAID', 'PARTIAL')
        AND o."total" > o."paidAmount";
    `;

    const count = Number(rows[0]?.count ?? 0n);
    const amount = String(rows[0]?.amount ?? '0');

    if (count === 0) {
      return null;
    }

    return {
      type: 'RECEIVABLE',
      severity: 'INFO',
      title: 'Cobranza pendiente',
      description: 'Hay pedidos con saldo pendiente de pago.',
      count,
      amount,
    };
  }

  async getAlerts(organizationId: string): Promise<DashboardAlert[]> {
    const results = await Promise.all([
      this.getOverdueOrders(organizationId),
      this.getUpcomingDeliveries(organizationId),
      this.getProductionBacklog(organizationId),
      this.getMachinesMaintenance(organizationId),
      this.getReceivables(organizationId),
    ]);

    return results.filter((alert): alert is DashboardAlert => alert !== null);
  }
}
