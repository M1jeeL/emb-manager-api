import { BadRequestException, Injectable } from '@nestjs/common';

import { DashboardQueryDto } from './dto/dashboard-query.dto.js';
import { DashboardOverviewQuery } from './queries/dashboard-overview.query.js';
import type { DashboardOverviewResponse } from './types/dashboard-overview.type.js';

@Injectable()
export class DashboardService {
  private static readonly MAX_PERIOD_DAYS = 366;

  constructor(private readonly overviewQuery: DashboardOverviewQuery) {}

  async getOverview(
    organizationId: string,
    query: DashboardQueryDto,
  ): Promise<DashboardOverviewResponse> {
    const bounds = this.resolvePeriod(query);

    const [
      sales,
      previousSales,
      orderMetrics,
      newCustomers,
      currentOrders,
      receivables,
      production,
      machines,
    ] = await Promise.all([
      this.overviewQuery.getSalesMetrics(organizationId, bounds),

      this.overviewQuery.getPreviousSalesMetrics(organizationId, bounds),

      this.overviewQuery.getOrderPeriodMetrics(organizationId, bounds),

      this.overviewQuery.getNewCustomers(organizationId, bounds),

      this.overviewQuery.getCurrentOrderMetrics(organizationId),

      this.overviewQuery.getCurrentReceivables(organizationId),

      this.overviewQuery.getCurrentProductionMetrics(organizationId),

      this.overviewQuery.getCurrentMachineMetrics(organizationId),
    ]);

    const averageOrderValue =
      sales.orders > 0 ? this.divideMoney(sales.revenue, sales.orders) : '0';

    return {
      period: {
        from: bounds.from,
        to: bounds.to,
        previousFrom: bounds.previousFrom,
        previousTo: bounds.previousTo,
      },

      periodMetrics: {
        sales: {
          revenue: sales.revenue,
          paid: sales.paid,
          averageOrderValue,

          revenueVariationPercent: this.calculateVariation(
            sales.revenue,
            previousSales.revenue,
          ),

          paidVariationPercent: this.calculateVariation(
            sales.paid,
            previousSales.paid,
          ),

          ordersVariationPercent: this.calculateVariation(
            sales.orders,
            previousSales.orders,
          ),
        },

        orders: {
          created: orderMetrics.created,
          delivered: orderMetrics.delivered,
          cancelled: orderMetrics.cancelled,
        },

        customers: {
          newCustomers,
        },
      },

      current: {
        orders: currentOrders,

        receivables,

        production,

        machines,
      },
    };
  }

  private resolvePeriod(query: DashboardQueryDto) {
    const today = this.getChileToday();

    const from = query.from ?? this.getMonthStart(today);
    const to = query.to ?? this.addDays(today, 1);

    if (from >= to) {
      throw new BadRequestException(
        'La fecha inicial debe ser anterior a la fecha final',
      );
    }

    const fromDate = this.parseDateOnly(from);
    const toDate = this.parseDateOnly(to);

    const durationMs = toDate.getTime() - fromDate.getTime();

    const durationDays = Math.round(durationMs / (1000 * 60 * 60 * 24));

    if (durationDays > DashboardService.MAX_PERIOD_DAYS) {
      throw new BadRequestException(
        `El período máximo permitido es de ${DashboardService.MAX_PERIOD_DAYS} días`,
      );
    }

    const previousTo = from;
    const previousFrom = this.addDays(from, -durationDays);

    return {
      from,
      to,
      previousFrom,
      previousTo,
    };
  }

  private getChileToday(): string {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Santiago',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    return formatter.format(new Date());
  }

  private getMonthStart(date: string): string {
    return `${date.slice(0, 8)}01`;
  }

  private addDays(date: string, days: number): string {
    const parsed = this.parseDateOnly(date);

    parsed.setUTCDate(parsed.getUTCDate() + days);

    return parsed.toISOString().slice(0, 10);
  }

  private parseDateOnly(date: string): Date {
    return new Date(`${date}T00:00:00.000Z`);
  }

  private divideMoney(amount: string, divisor: number): string {
    if (divisor === 0) {
      return '0';
    }

    return (Number(amount) / divisor).toFixed(2);
  }

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
