import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma.service.js';

import { OrderStatus, PaymentStatus } from '../../generated/prisma/enums.js';

import { Prisma } from '../../generated/prisma/client.js';

import { CreatePaymentDto } from './dto/create-payment.dto.js';
import { PaymentQueryDto } from './dto/payment-query.dto.js';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  // ============================================================
  // SELECTS
  // ============================================================

  private readonly paymentListSelect = {
    id: true,
    orderId: true,
    amount: true,
    method: true,
    paidAt: true,
    reference: true,
    notes: true,
    createdAt: true,

    order: {
      select: {
        id: true,
        orderNumber: true,
        total: true,
        paidAmount: true,
        paymentStatus: true,

        customer: {
          select: {
            id: true,
            name: true,
            companyName: true,
          },
        },
      },
    },
  } satisfies Prisma.PaymentSelect;

  private readonly paymentDetailSelect = {
    id: true,
    orderId: true,
    amount: true,
    method: true,
    paidAt: true,
    reference: true,
    notes: true,
    createdAt: true,

    order: {
      select: {
        id: true,
        orderNumber: true,

        status: true,

        subtotal: true,
        discount: true,
        total: true,
        paidAmount: true,
        paymentStatus: true,

        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            companyName: true,
          },
        },
      },
    },
  } satisfies Prisma.PaymentSelect;

  // ============================================================
  // CREATE
  // ============================================================

  async create(organizationId: string, dto: CreatePaymentDto) {
    const amount = this.toDecimal(dto.amount);

    this.validateAmount(amount);

    const paidAt = dto.paidAt ? new Date(dto.paidAt) : new Date();

    this.validatePaidAt(paidAt);

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          // ----------------------------------------------------
          // 1. LOCK / VALIDATE ORDER
          // ----------------------------------------------------

          const order = await tx.order.findFirst({
            where: {
              id: dto.orderId,
              organizationId,
            },

            select: {
              id: true,
              orderNumber: true,
              status: true,
              total: true,
              paidAmount: true,
              paymentStatus: true,
            },
          });

          if (!order) {
            throw new NotFoundException('Pedido no encontrado');
          }

          // ----------------------------------------------------
          // 2. VALIDATE ORDER STATUS
          // ----------------------------------------------------

          this.validateOrderForPayment(order.status);

          // ----------------------------------------------------
          // 3. CALCULATE BALANCE
          // ----------------------------------------------------

          const balance = order.total.minus(order.paidAmount);

          if (balance.lessThanOrEqualTo(0)) {
            throw new ConflictException(
              'El pedido ya está completamente pagado',
            );
          }

          if (amount.greaterThan(balance)) {
            throw new BadRequestException(
              `El monto excede el saldo pendiente de $${balance.toFixed(2)}`,
            );
          }

          // ----------------------------------------------------
          // 4. CALCULATE NEW PAYMENT STATE
          // ----------------------------------------------------

          const newPaidAmount = order.paidAmount.plus(amount);

          const newPaymentStatus = newPaidAmount.equals(order.total)
            ? PaymentStatus.PAID
            : PaymentStatus.PARTIAL;

          // ----------------------------------------------------
          // 5. CREATE PAYMENT
          // ----------------------------------------------------

          const payment = await tx.payment.create({
            data: {
              orderId: order.id,

              amount,

              method: dto.method,

              paidAt,

              reference: this.cleanOptionalString(dto.reference),

              notes: this.cleanOptionalString(dto.notes),
            },
          });

          // ----------------------------------------------------
          // 6. UPDATE ORDER FINANCIAL SUMMARY
          // ----------------------------------------------------

          await tx.order.update({
            where: {
              id: order.id,
            },

            data: {
              paidAmount: newPaidAmount,

              paymentStatus: newPaymentStatus,
            },
          });

          // ----------------------------------------------------
          // 7. RETURN PAYMENT WITH ORDER CONTEXT
          // ----------------------------------------------------

          return tx.payment.findUniqueOrThrow({
            where: {
              id: payment.id,
            },

            select: this.paymentDetailSelect,
          });
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );
    } catch (error) {
      /**
       * PostgreSQL puede abortar una transacción SERIALIZABLE
       * cuando dos pagos concurrentes intentan modificar
       * el mismo pedido.
       *
       * P2034 = Transaction failed due to a write conflict
       * o deadlock.
       */
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      ) {
        throw new ConflictException(
          'El pedido fue modificado por otra operación. Intenta registrar el pago nuevamente.',
        );
      }

      throw error;
    }
  }

  // ============================================================
  // FIND ALL
  // ============================================================

  async findAll(organizationId: string, query: PaymentQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const skip = (page - 1) * limit;

    const where: Prisma.PaymentWhereInput = {
      order: {
        organizationId,

        ...(query.orderNumber !== undefined && {
          orderNumber: query.orderNumber,
        }),
      },

      ...(query.orderId && {
        orderId: query.orderId,
      }),

      ...(query.method && {
        method: query.method,
      }),

      ...(query.from || query.to
        ? {
            paidAt: {
              ...(query.from && {
                gte: new Date(query.from),
              }),

              ...(query.to && {
                lte: new Date(query.to),
              }),
            },
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where,

        select: this.paymentListSelect,

        orderBy: [
          {
            paidAt: 'desc',
          },
          {
            createdAt: 'desc',
          },
        ],

        skip,
        take: limit,
      }),

      this.prisma.payment.count({
        where,
      }),
    ]);

    return {
      data,

      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ============================================================
  // FIND ONE
  // ============================================================

  async findOne(organizationId: string, id: string) {
    const payment = await this.prisma.payment.findFirst({
      where: {
        id,

        order: {
          organizationId,
        },
      },

      select: this.paymentDetailSelect,
    });

    if (!payment) {
      throw new NotFoundException('Pago no encontrado');
    }

    return payment;
  }

  // ============================================================
  // VALIDATIONS
  // ============================================================

  private validateAmount(amount: Prisma.Decimal) {
    if (amount.lessThanOrEqualTo(0)) {
      throw new BadRequestException('El monto del pago debe ser mayor a cero');
    }

    /**
     * Decimal(12,2)
     *
     * Máximo:
     * 9,999,999,999.99
     */
    if (amount.greaterThan('9999999999.99')) {
      throw new BadRequestException(
        'El monto del pago excede el máximo permitido',
      );
    }
  }

  private validateOrderForPayment(status: OrderStatus) {
    if (status === OrderStatus.QUOTE) {
      throw new ConflictException(
        'No se pueden registrar pagos para una cotización',
      );
    }

    if (status === OrderStatus.CANCELLED) {
      throw new ConflictException(
        'No se pueden registrar pagos para un pedido cancelado',
      );
    }
  }

  private validatePaidAt(paidAt: Date) {
    if (Number.isNaN(paidAt.getTime())) {
      throw new BadRequestException('La fecha del pago no es válida');
    }

    if (paidAt.getTime() > Date.now()) {
      throw new BadRequestException(
        'La fecha del pago no puede estar en el futuro',
      );
    }
  }

  // ============================================================
  // UTILS
  // ============================================================

  private toDecimal(value: string) {
    try {
      return new Prisma.Decimal(value);
    } catch {
      throw new BadRequestException('El monto del pago no es válido');
    }
  }

  private cleanOptionalString(value?: string | null) {
    if (value === undefined || value === null) {
      return value;
    }

    const trimmed = value.trim();

    return trimmed || null;
  }
}
