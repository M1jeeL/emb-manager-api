import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma.service.js';

import { OrderStatus, PaymentStatus } from '../../generated/prisma/enums.js';

import { Prisma } from '../../generated/prisma/client.js';

import { CreateOrderDto } from './dto/create-order.dto.js';
import { UpdateOrderDto } from './dto/update-order.dto.js';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto.js';
import { OrderQueryDto } from './dto/order-query.dto.js';

type PreparedOrderItemLogo = {
  logoId: string;
  logoName: string;
  unitPrice: Prisma.Decimal;
  quantity: number;
  notes: string | undefined;
};
@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  // ============================================================
  // CONSTANTES
  // ============================================================

  private readonly orderListSelect = {
    id: true,
    organizationId: true,
    customerId: true,
    orderNumber: true,
    status: true,
    paymentStatus: true,
    orderedAt: true,
    promisedAt: true,
    deliveredAt: true,
    subtotal: true,
    discount: true,
    total: true,
    paidAmount: true,
    notes: true,
    createdAt: true,
    updatedAt: true,

    customer: {
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        companyName: true,
      },
    },

    _count: {
      select: {
        items: true,
        payments: true,
        productionJobs: true,
      },
    },
  } satisfies Prisma.OrderSelect;

  private readonly orderDetailInclude = {
    customer: {
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        taxId: true,
        companyName: true,
        address: true,
        city: true,
        status: true,
      },
    },

    items: {
      orderBy: {
        createdAt: 'asc',
      },

      include: {
        garment: {
          select: {
            id: true,
            name: true,
            description: true,
            active: true,
          },
        },

        logos: {
          orderBy: {
            createdAt: 'asc',
          },

          include: {
            logo: {
              select: {
                id: true,
                name: true,
                status: true,
                currentPrice: true,
                customerId: true,
              },
            },
          },
        },
      },
    },

    payments: {
      orderBy: {
        paidAt: 'desc',
      },
    },

    statusHistory: {
      orderBy: {
        createdAt: 'asc',
      },

      include: {
        changedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    },

    _count: {
      select: {
        items: true,
        payments: true,
        productionJobs: true,
      },
    },
  } satisfies Prisma.OrderInclude;

  // ============================================================
  // CREATE
  // ============================================================

  async create(organizationId: string, userId: string, dto: CreateOrderDto) {
    this.validateCreateStatus(dto.status);

    this.validateCustomerInput(dto);

    const discount = this.toDecimal(dto.discount ?? '0');

    if (discount.lessThan(0)) {
      throw new BadRequestException('El descuento no puede ser negativo');
    }

    return this.prisma.$transaction(async (tx) => {
      // --------------------------------------------------------
      // 1. CUSTOMER
      // --------------------------------------------------------

      const customerId = await this.resolveCustomer(tx, organizationId, dto);

      // --------------------------------------------------------
      // 2. ORDER NUMBER
      // --------------------------------------------------------

      const organization = await tx.organization.update({
        where: {
          id: organizationId,
        },

        data: {
          orderSequence: {
            increment: 1,
          },
        },

        select: {
          orderSequence: true,
        },
      });

      /*
       * orderSequence representa el próximo número disponible.
       *
       * Si comienza en 1000:
       *
       * update -> 1001
       * orderNumber -> 1000
       *
       * De esta forma conservamos el significado del campo
       * definido en nuestro schema.
       */
      const orderNumber = organization.orderSequence - 1;

      // --------------------------------------------------------
      // 3. VALIDATE / PREPARE ITEMS
      // --------------------------------------------------------

      const preparedItems = await this.prepareOrderItems(
        tx,
        organizationId,
        customerId,
        dto.items,
      );

      // --------------------------------------------------------
      // 4. CALCULATE TOTALS
      // --------------------------------------------------------

      const subtotal = preparedItems.reduce(
        (acc, item) => acc.plus(item.subtotal),
        new Prisma.Decimal(0),
      );

      if (discount.greaterThan(subtotal)) {
        throw new BadRequestException(
          'El descuento no puede ser mayor al subtotal',
        );
      }

      const total = subtotal.minus(discount);

      // --------------------------------------------------------
      // 5. CREATE ORDER
      // --------------------------------------------------------

      const order = await tx.order.create({
        data: {
          organizationId,
          customerId,
          orderNumber,

          status: dto.status ?? OrderStatus.PENDING,

          paymentStatus: PaymentStatus.UNPAID,

          promisedAt: dto.promisedAt ? new Date(dto.promisedAt) : null,

          subtotal,
          discount,
          total,

          paidAmount: new Prisma.Decimal(0),

          notes: this.cleanOptionalString(dto.notes),

          items: {
            create: preparedItems.map((item) => ({
              garmentId: item.garmentId,
              description: item.description,
              quantity: item.quantity,
              subtotal: item.subtotal,
              notes: item.notes,

              logos: {
                create: item.logos,
              },
            })),
          },

          statusHistory: {
            create: {
              fromStatus: null,
              toStatus: dto.status ?? OrderStatus.PENDING,
              changedByUserId: userId,
              notes:
                dto.status === OrderStatus.QUOTE
                  ? 'Cotización creada'
                  : 'Pedido creado',
            },
          },
        },

        include: this.orderDetailInclude,
      });

      return order;
    });
  }

  // ============================================================
  // FIND ALL
  // ============================================================

  async findAll(organizationId: string, query: OrderQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const skip = (page - 1) * limit;

    const where: Prisma.OrderWhereInput = {
      organizationId,

      ...(query.orderNumber !== undefined && {
        orderNumber: query.orderNumber,
      }),

      ...(query.customerId && {
        customerId: query.customerId,
      }),

      ...(query.status && {
        status: query.status,
      }),

      ...(query.paymentStatus && {
        paymentStatus: query.paymentStatus,
      }),

      ...(query.orderedFrom || query.orderedTo
        ? {
            orderedAt: {
              ...(query.orderedFrom && {
                gte: this.startOfDay(query.orderedFrom),
              }),

              ...(query.orderedTo && {
                lte: this.endOfDay(query.orderedTo),
              }),
            },
          }
        : {}),

      ...(query.promisedFrom || query.promisedTo
        ? {
            promisedAt: {
              ...(query.promisedFrom && {
                gte: this.startOfDay(query.promisedFrom),
              }),

              ...(query.promisedTo && {
                lte: this.endOfDay(query.promisedTo),
              }),
            },
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,

        select: this.orderListSelect,

        orderBy: [
          {
            orderedAt: 'desc',
          },
          {
            orderNumber: 'desc',
          },
        ],

        skip,
        take: limit,
      }),

      this.prisma.order.count({
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
    const order = await this.prisma.order.findFirst({
      where: {
        id,
        organizationId,
      },

      include: this.orderDetailInclude,
    });

    if (!order) {
      throw new NotFoundException('Pedido no encontrado');
    }

    return order;
  }

  // ============================================================
  // UPDATE
  // ============================================================

  async update(organizationId: string, id: string, dto: UpdateOrderDto) {
    const existing = await this.prisma.order.findFirst({
      where: {
        id,
        organizationId,
      },

      select: {
        id: true,
        subtotal: true,
        discount: true,
        total: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('Pedido no encontrado');
    }

    const discount =
      dto.discount !== undefined
        ? this.toDecimal(dto.discount)
        : existing.discount;

    if (discount.lessThan(0)) {
      throw new BadRequestException('El descuento no puede ser negativo');
    }

    if (discount.greaterThan(existing.subtotal)) {
      throw new BadRequestException(
        'El descuento no puede ser mayor al subtotal',
      );
    }

    const total = existing.subtotal.minus(discount);

    return this.prisma.order.update({
      where: {
        id: existing.id,
      },

      data: {
        ...(dto.promisedAt !== undefined && {
          promisedAt: dto.promisedAt ? new Date(dto.promisedAt) : null,
        }),

        ...(dto.discount !== undefined && {
          discount,
          total,
        }),

        ...(dto.notes !== undefined && {
          notes: this.cleanOptionalString(dto.notes),
        }),
      },

      include: this.orderDetailInclude,
    });
  }

  // ============================================================
  // CHANGE STATUS
  // ============================================================

  async changeStatus(
    organizationId: string,
    userId: string,
    id: string,
    dto: UpdateOrderStatusDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: {
          id,
          organizationId,
        },

        select: {
          id: true,
          status: true,
          deliveredAt: true,
        },
      });

      if (!order) {
        throw new NotFoundException('Pedido no encontrado');
      }

      this.validateStatusTransition(order.status, dto.status);

      const deliveredAt =
        dto.status === OrderStatus.DELIVERED ? new Date() : order.deliveredAt;

      await tx.order.update({
        where: {
          id: order.id,
        },

        data: {
          status: dto.status,
          deliveredAt,
        },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,

          fromStatus: order.status,
          toStatus: dto.status,

          changedByUserId: userId,

          notes: this.cleanOptionalString(dto.notes),
        },
      });

      return tx.order.findUniqueOrThrow({
        where: {
          id: order.id,
        },

        include: this.orderDetailInclude,
      });
    });
  }

  // ============================================================
  // CUSTOMER RESOLUTION
  // ============================================================

  private async resolveCustomer(
    tx: Prisma.TransactionClient,
    organizationId: string,
    dto: CreateOrderDto,
  ): Promise<string> {
    if (dto.customerId) {
      const customer = await tx.customer.findFirst({
        where: {
          id: dto.customerId,
          organizationId,
        },

        select: {
          id: true,
          status: true,
        },
      });

      if (!customer) {
        throw new NotFoundException('El cliente indicado no existe');
      }

      if (customer.status !== 'ACTIVE') {
        throw new ConflictException(
          'No se puede crear un pedido para un cliente inactivo',
        );
      }

      return customer.id;
    }

    if (!dto.customer) {
      throw new BadRequestException(
        'Debes indicar un cliente existente o proporcionar los datos para crear uno',
      );
    }

    const name = dto.customer.name.trim();

    if (!name) {
      throw new BadRequestException('El nombre del cliente es obligatorio');
    }

    const email = dto.customer.email?.trim().toLowerCase();

    const phone = dto.customer.phone?.trim();

    const taxId = dto.customer.taxId?.trim();

    const duplicate = await tx.customer.findFirst({
      where: {
        organizationId,

        OR: [
          ...(email ? [{ email }] : []),

          ...(phone ? [{ phone }] : []),

          ...(taxId ? [{ taxId }] : []),
        ],
      },

      select: {
        id: true,
        email: true,
        phone: true,
        taxId: true,
      },
    });

    if (duplicate) {
      throw new ConflictException(
        'Ya existe un cliente con uno de los datos identificadores proporcionados. Puedes seleccionar el cliente existente.',
      );
    }

    const customer = await tx.customer.create({
      data: {
        organizationId,

        name,

        email,
        phone,
        taxId,

        companyName: this.cleanOptionalString(dto.customer.companyName),

        address: this.cleanOptionalString(dto.customer.address),

        city: this.cleanOptionalString(dto.customer.city),

        notes: this.cleanOptionalString(dto.customer.notes),
      },

      select: {
        id: true,
      },
    });

    return customer.id;
  }

  // ============================================================
  // PREPARE ORDER ITEMS
  // ============================================================

  private async prepareOrderItems(
    tx: Prisma.TransactionClient,
    organizationId: string,
    customerId: string,
    items: CreateOrderDto['items'],
  ) {
    if (!items || items.length === 0) {
      throw new BadRequestException('El pedido debe contener al menos un item');
    }

    const preparedItems: Array<{
      garmentId: string;
      description: string | undefined;
      quantity: number;
      subtotal: Prisma.Decimal;
      notes: string | undefined;
      logos: Array<{
        logoId: string;
        logoName: string;
        unitPrice: Prisma.Decimal;
        quantity: number;
        notes: string | undefined;
      }>;
    }> = [];

    for (const item of items) {
      if (item.quantity <= 0) {
        throw new BadRequestException(
          'La cantidad de una prenda debe ser mayor a cero',
        );
      }

      // ------------------------------------------------------
      // GARMENT
      // ------------------------------------------------------

      const garment = await tx.garment.findFirst({
        where: {
          id: item.garmentId,
          organizationId,
        },

        select: {
          id: true,
          active: true,
        },
      });

      if (!garment) {
        throw new NotFoundException(`La prenda ${item.garmentId} no existe`);
      }

      if (!garment.active) {
        throw new ConflictException(
          'No se puede agregar una prenda inactiva a un pedido',
        );
      }

      if (!item.logos || item.logos.length === 0) {
        throw new BadRequestException(
          'Cada item debe contener al menos un logo',
        );
      }

      // ------------------------------------------------------
      // LOGOS
      // ------------------------------------------------------

      const preparedLogos: PreparedOrderItemLogo[] = [];

      for (const logoDto of item.logos ?? []) {
        const hasLogoId = !!logoDto.logoId;

        const hasNewLogo = !!logoDto.logo;

        if (hasLogoId === hasNewLogo) {
          throw new BadRequestException(
            'Cada logo debe indicar logoId o los datos de un nuevo logo, pero no ambos',
          );
        }

        const quantity = logoDto.quantity ?? 1;

        if (quantity <= 0) {
          throw new BadRequestException(
            'La cantidad del logo debe ser mayor a cero',
          );
        }

        if (hasLogoId) {
          const logo = await tx.logo.findFirst({
            where: {
              id: logoDto.logoId,
              organizationId,
            },

            select: {
              id: true,
              name: true,
              currentPrice: true,
              status: true,
              customerId: true,
            },
          });

          if (!logo) {
            throw new NotFoundException(`El logo ${logoDto.logoId} no existe`);
          }

          if (logo.status !== 'ACTIVE') {
            throw new ConflictException(
              `El logo "${logo.name}" está archivado y no puede utilizarse en nuevos pedidos`,
            );
          }

          if (logo.customerId && logo.customerId !== customerId) {
            throw new ConflictException(
              `El logo "${logo.name}" pertenece a otro cliente y no puede utilizarse en este pedido`,
            );
          }

          /*
           * Por defecto utilizamos el precio actual
           * del logo como snapshot del pedido.
           *
           * Si posteriormente queremos permitir que el
           * vendedor modifique el precio de un logo
           * específicamente para este pedido, podremos
           * incorporarlo explícitamente al DTO.
           */
          preparedLogos.push({
            logoId: logo.id,
            logoName: logo.name,
            unitPrice: logo.currentPrice,
            quantity,
            notes: this.cleanOptionalString(logoDto.notes),
          });

          continue;
        }

        // ----------------------------------------------------
        // CREATE NEW LOGO
        // ----------------------------------------------------

        const logoData = logoDto.logo!;

        const logoName = logoData.name.trim();

        if (!logoName) {
          throw new BadRequestException(
            'El nombre del nuevo logo es obligatorio',
          );
        }

        const logoPrice = this.toDecimal(logoData.currentPrice);

        if (logoPrice.lessThan(0)) {
          throw new BadRequestException(
            'El precio del logo no puede ser negativo',
          );
        }

        const existingLogo = await tx.logo.findFirst({
          where: {
            organizationId,
            name: logoName,
          },

          select: {
            id: true,
            name: true,
            status: true,
          },
        });

        if (existingLogo) {
          throw new ConflictException(
            `Ya existe un logo llamado "${logoName}". Selecciona el logo existente en lugar de crear uno nuevo.`,
          );
        }

        const logo = await tx.logo.create({
          data: {
            organizationId,

            /*
             * Si el logo fue creado desde un pedido
             * de un cliente concreto, lo asociamos
             * automáticamente a ese cliente.
             */
            customerId,

            name: logoName,

            description: this.cleanOptionalString(logoData.description),

            currentPrice: logoPrice,

            versions: {
              create: {
                version: 1,
              },
            },

            priceHistory: {
              create: {
                price: logoPrice,
              },
            },
          },

          select: {
            id: true,
            name: true,
            currentPrice: true,
          },
        });

        preparedLogos.push({
          logoId: logo.id,

          logoName: logo.name,

          unitPrice: logo.currentPrice,

          quantity,

          notes: this.cleanOptionalString(logoDto.notes),
        });
      }

      /*
       * Los logos representan un cargo adicional.
       * Su subtotal es:
       *
       * precio logo × cantidad logo
       *
       * y se suma al valor de las prendas.
       */
      const itemSubtotal = preparedLogos.reduce(
        (acc, logo) => acc.plus(logo.unitPrice.mul(logo.quantity)),
        new Prisma.Decimal(0),
      );

      preparedItems.push({
        garmentId: garment.id,
        description: this.cleanOptionalString(item.description),
        quantity: item.quantity,
        subtotal: itemSubtotal,
        notes: this.cleanOptionalString(item.notes),
        logos: preparedLogos,
      });
    }

    return preparedItems;
  }

  // ============================================================
  // VALIDATION
  // ============================================================

  private validateCreateStatus(status?: OrderStatus) {
    const initialStatus = status ?? OrderStatus.PENDING;

    if (
      initialStatus !== OrderStatus.QUOTE &&
      initialStatus !== OrderStatus.PENDING
    ) {
      throw new BadRequestException(
        'Un pedido nuevo solo puede comenzar como cotización o pendiente',
      );
    }
  }

  private validateCustomerInput(dto: CreateOrderDto) {
    if (dto.customerId && dto.customer) {
      throw new BadRequestException(
        'Debes indicar customerId o customer, no ambos',
      );
    }

    if (!dto.customerId && !dto.customer) {
      throw new BadRequestException(
        'Debes indicar un cliente existente o proporcionar los datos de un nuevo cliente',
      );
    }
  }

  private validateStatusTransition(
    currentStatus: OrderStatus,
    newStatus: OrderStatus,
  ) {
    if (currentStatus === newStatus) {
      throw new ConflictException(
        `El pedido ya se encuentra en estado ${currentStatus}`,
      );
    }

    const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.QUOTE]: [OrderStatus.PENDING, OrderStatus.CANCELLED],

      [OrderStatus.PENDING]: [OrderStatus.IN_PROGRESS, OrderStatus.CANCELLED],

      [OrderStatus.IN_PROGRESS]: [OrderStatus.READY, OrderStatus.CANCELLED],

      [OrderStatus.READY]: [OrderStatus.DELIVERED],

      [OrderStatus.DELIVERED]: [],

      [OrderStatus.CANCELLED]: [],
    };

    const allowed = allowedTransitions[currentStatus];

    if (!allowed.includes(newStatus)) {
      throw new ConflictException(
        `No se puede cambiar el pedido de ${currentStatus} a ${newStatus}`,
      );
    }
  }

  // ============================================================
  // DECIMAL
  // ============================================================

  private toDecimal(value: string): Prisma.Decimal {
    try {
      const decimal = new Prisma.Decimal(value);

      if (!decimal.isFinite()) {
        throw new Error();
      }

      return decimal;
    } catch {
      throw new BadRequestException(
        `El valor "${value}" no es un número válido`,
      );
    }
  }

  // ============================================================
  // STRING HELPERS
  // ============================================================

  private cleanOptionalString(value?: string | null): string | undefined {
    const cleaned = value?.trim();

    return cleaned || undefined;
  }

  // ============================================================
  // DATE HELPERS
  // ============================================================

  private startOfDay(value: string): Date {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`Fecha inválida: ${value}`);
    }

    date.setHours(0, 0, 0, 0);

    return date;
  }

  private endOfDay(value: string): Date {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`Fecha inválida: ${value}`);
    }

    date.setHours(23, 59, 59, 999);

    return date;
  }
}
