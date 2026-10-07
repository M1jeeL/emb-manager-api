import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma.service.js';

import {
  EmployeeStatus,
  MachineStatus,
  OrderItemStatus,
  OrderStatus,
  Prisma,
  ProductionJobStatus,
} from '../../generated/prisma/client.js';

import { CreateProductionJobDto } from './dto/create-production-job.dto.js';
import { UpdateProductionJobDto } from './dto/update-production-job.dto.js';
import { ChangeProductionStatusDto } from './dto/change-production-status.dto.js';
import { ProductionQueryDto } from './dto/production-query.dto.js';
import { CreateOrderProductionDto } from './dto/create-order-production.dto.js';

@Injectable()
export class ProductionsService {
  constructor(private readonly prisma: PrismaService) {}

  // ============================================================
  // SELECTS
  // ============================================================

  private readonly productionListSelect = {
    id: true,

    orderId: true,
    orderItemId: true,
    orderItemLogoId: true,

    machineId: true,
    employeeId: true,

    status: true,
    quantity: true,

    startedAt: true,
    completedAt: true,

    notes: true,

    createdAt: true,
    updatedAt: true,

    order: {
      select: {
        id: true,
        orderNumber: true,
        status: true,

        customer: {
          select: {
            id: true,
            name: true,
            companyName: true,
          },
        },
      },
    },

    orderItem: {
      select: {
        id: true,
        quantity: true,
        status: true,
        description: true,

        garment: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    },

    orderItemLogo: {
      select: {
        id: true,
        logoName: true,
        unitPrice: true,
        quantity: true,
      },
    },

    machine: {
      select: {
        id: true,
        name: true,
        code: true,
        type: true,
        status: true,
      },
    },

    employee: {
      select: {
        id: true,
        firstName: true,
        lastName: true,
        position: true,
        status: true,
      },
    },
  } satisfies Prisma.ProductionJobSelect;

  private readonly productionDetailInclude = {
    order: {
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,

        customer: {
          select: {
            id: true,
            name: true,
            companyName: true,
            phone: true,
            email: true,
          },
        },
      },
    },

    orderItem: {
      include: {
        garment: {
          select: {
            id: true,
            name: true,
            description: true,
            active: true,
          },
        },
      },
    },

    orderItemLogo: {
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

    machine: true,

    employee: {
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        position: true,
        status: true,
      },
    },
  } satisfies Prisma.ProductionJobInclude;

  // ============================================================
  // CREATE INDIVIDUAL
  // ============================================================

  async create(organizationId: string, dto: CreateProductionJobDto) {
    return this.prisma.$transaction(
      async (tx) => {
        const order = await tx.order.findFirst({
          where: {
            id: dto.orderId,
            organizationId,
          },

          select: {
            id: true,
            status: true,
          },
        });

        if (!order) {
          throw new NotFoundException('Pedido no encontrado');
        }

        this.validateOrderForProduction(order.status);

        const orderItem = await tx.orderItem.findFirst({
          where: {
            id: dto.orderItemId,
            orderId: dto.orderId,
          },

          select: {
            id: true,
            quantity: true,
            status: true,

            logos: {
              select: {
                id: true,
                quantity: true,
              },
            },
          },
        });

        if (!orderItem) {
          throw new NotFoundException('El item del pedido no fue encontrado');
        }

        this.validateOrderItemForProduction(orderItem.status);

        this.validateLogoSelection(orderItem.logos, dto.orderItemLogoId);

        if (dto.orderItemLogoId) {
          await this.ensureOrderItemLogo(
            tx,
            dto.orderItemLogoId,
            dto.orderItemId,
          );
        }

        if (dto.machineId) {
          await this.ensureAvailableMachine(tx, organizationId, dto.machineId);
        }

        if (dto.employeeId) {
          await this.ensureAvailableEmployee(
            tx,
            organizationId,
            dto.employeeId,
          );
        }

        const availableQuantity = await this.getAvailableQuantity(
          tx,
          dto.orderItemId,
          dto.orderItemLogoId,
          dto.orderItemLogoId
            ? (orderItem.logos.find((logo) => logo.id === dto.orderItemLogoId)
                ?.quantity ?? 0)
            : orderItem.quantity,
        );

        if (dto.quantity > availableQuantity) {
          throw new BadRequestException(
            `La cantidad solicitada excede la cantidad disponible para producción. Disponible: ${availableQuantity}`,
          );
        }

        const productionJob = await tx.productionJob.create({
          data: {
            orderId: dto.orderId,
            orderItemId: dto.orderItemId,
            orderItemLogoId: dto.orderItemLogoId ?? null,

            machineId: dto.machineId ?? null,
            employeeId: dto.employeeId ?? null,

            quantity: dto.quantity,

            status: ProductionJobStatus.PENDING,

            notes: this.cleanOptionalString(dto.notes),
          },

          select: this.productionListSelect,
        });

        await this.recalculateOrderState(tx, dto.orderId, dto.orderItemId);

        return productionJob;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  }

  // ============================================================
  // CREATE FULL ORDER PRODUCTION
  // ============================================================

  async createOrderProduction(
    organizationId: string,
    orderId: string,
    userId: string,
    dto: CreateOrderProductionDto,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const order = await tx.order.findFirst({
          where: {
            id: orderId,
            organizationId,
          },

          select: {
            id: true,
            status: true,

            items: {
              select: {
                id: true,
                quantity: true,
                status: true,

                logos: {
                  select: {
                    id: true,
                    quantity: true,
                  },
                },
              },
            },
          },
        });

        if (!order) {
          throw new NotFoundException('Pedido no encontrado');
        }

        this.validateOrderForProduction(order.status);

        if (order.items.length === 0) {
          throw new BadRequestException(
            'El pedido no tiene items para producir',
          );
        }

        // --------------------------------------------------------
        // VALIDATE RESOURCES
        // --------------------------------------------------------

        if (dto.machineId) {
          await this.ensureAvailableMachine(tx, organizationId, dto.machineId);
        }

        if (dto.employeeId) {
          await this.ensureAvailableEmployee(
            tx,
            organizationId,
            dto.employeeId,
          );
        }

        // --------------------------------------------------------
        // GET EXISTING PRODUCTION IN ONE QUERY
        // --------------------------------------------------------

        const existingProduction = await tx.productionJob.findMany({
          where: {
            orderId,

            status: {
              not: ProductionJobStatus.CANCELLED,
            },
          },

          select: {
            orderItemId: true,
            orderItemLogoId: true,
            quantity: true,
          },
        });

        // --------------------------------------------------------
        // CALCULATE ALLOCATED QUANTITIES IN MEMORY
        // --------------------------------------------------------

        const allocated = new Map<string, number>();

        for (const job of existingProduction) {
          const key = this.getProductionScopeKey(
            job.orderItemId,
            job.orderItemLogoId,
          );

          allocated.set(key, (allocated.get(key) ?? 0) + job.quantity);
        }

        // --------------------------------------------------------
        // PREPARE ALL PENDING JOBS
        // --------------------------------------------------------

        const jobsToCreate: Array<{
          orderId: string;
          orderItemId: string;
          orderItemLogoId: string | null;
          machineId: string | null;
          employeeId: string | null;
          quantity: number;
          status: ProductionJobStatus;
          notes: string | null | undefined;
        }> = [];

        for (const item of order.items) {
          // ------------------------------------------------------
          // ITEM WITH LOGOS
          // ------------------------------------------------------

          if (item.logos.length > 0) {
            for (const logo of item.logos) {
              const key = this.getProductionScopeKey(item.id, logo.id);

              const alreadyAllocated = allocated.get(key) ?? 0;

              const availableQuantity = Math.max(
                logo.quantity - alreadyAllocated,
                0,
              );

              // No queda nada por producir para este logo.
              if (availableQuantity <= 0) {
                continue;
              }

              // Solo validamos el estado cuando realmente
              // existe producción pendiente.
              this.validateOrderItemForProduction(item.status);

              jobsToCreate.push({
                orderId,
                orderItemId: item.id,
                orderItemLogoId: logo.id,

                machineId: dto.machineId ?? null,
                employeeId: dto.employeeId ?? null,

                quantity: availableQuantity,

                status: ProductionJobStatus.PENDING,

                notes: this.cleanOptionalString(dto.notes),
              });
            }

            continue;
          }

          // ------------------------------------------------------
          // ITEM WITHOUT LOGOS
          // ------------------------------------------------------

          const key = this.getProductionScopeKey(item.id, null);

          const alreadyAllocated = allocated.get(key) ?? 0;

          const availableQuantity = Math.max(
            item.quantity - alreadyAllocated,
            0,
          );

          // Item completamente producido.
          if (availableQuantity <= 0) {
            continue;
          }

          // Solo validamos el estado si queda producción pendiente.
          this.validateOrderItemForProduction(item.status);

          jobsToCreate.push({
            orderId,
            orderItemId: item.id,
            orderItemLogoId: null,

            machineId: dto.machineId ?? null,
            employeeId: dto.employeeId ?? null,

            quantity: availableQuantity,

            status: ProductionJobStatus.PENDING,

            notes: this.cleanOptionalString(dto.notes),
          });
        }

        // --------------------------------------------------------
        // NOTHING TO PRODUCE
        // --------------------------------------------------------

        if (jobsToCreate.length === 0) {
          throw new BadRequestException(
            'No hay producción pendiente para este pedido',
          );
        }

        // --------------------------------------------------------
        // CREATE ALL JOBS IN ONE QUERY
        // --------------------------------------------------------

        const createdJobs = await tx.productionJob.createManyAndReturn({
          data: jobsToCreate,

          select: {
            id: true,
          },
        });

        // --------------------------------------------------------
        // UPDATE ITEM STATES
        // --------------------------------------------------------

        const affectedItemIds = [
          ...new Set(jobsToCreate.map((job) => job.orderItemId)),
        ];

        await tx.orderItem.updateMany({
          where: {
            id: {
              in: affectedItemIds,
            },
          },

          data: {
            status: OrderItemStatus.IN_PROGRESS,
          },
        });

        // --------------------------------------------------------
        // UPDATE ORDER STATE
        // --------------------------------------------------------

        const previousOrderStatus = order.status;

        await tx.order.update({
          where: {
            id: orderId,
          },

          data: {
            status: OrderStatus.IN_PROGRESS,
          },
        });

        if (previousOrderStatus !== OrderStatus.IN_PROGRESS) {
          await tx.orderStatusHistory.create({
            data: {
              orderId,

              fromStatus: previousOrderStatus,
              toStatus: OrderStatus.IN_PROGRESS,

              changedByUserId: userId,

              notes: 'Producción completa creada para el pedido',
            },
          });
        }

        // --------------------------------------------------------
        // GET CREATED JOBS
        // --------------------------------------------------------

        const createdJobIds = createdJobs.map((job) => job.id);

        const productionJobs = await tx.productionJob.findMany({
          where: {
            id: {
              in: createdJobIds,
            },
          },

          select: this.productionListSelect,

          orderBy: {
            createdAt: 'asc',
          },
        });

        return {
          orderId,
          createdCount: productionJobs.length,
          productionJobs,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  }

  async findPendingProduction(organizationId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        organizationId,
      },

      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            taxId: true,
            companyName: true,
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
      },
    });

    if (!order) {
      throw new NotFoundException('Pedido no encontrado');
    }

    // --------------------------------------------------------
    // GET EXISTING PRODUCTION
    // --------------------------------------------------------

    const existingProduction = await this.prisma.productionJob.findMany({
      where: {
        orderId,

        status: {
          not: ProductionJobStatus.CANCELLED,
        },
      },

      select: {
        orderItemId: true,
        orderItemLogoId: true,
        quantity: true,
      },
    });

    // --------------------------------------------------------
    // CALCULATE ALLOCATED QUANTITIES
    // --------------------------------------------------------

    const allocated = new Map<string, number>();

    for (const job of existingProduction) {
      const key = this.getProductionScopeKey(
        job.orderItemId,
        job.orderItemLogoId,
      );

      allocated.set(key, (allocated.get(key) ?? 0) + job.quantity);
    }

    // --------------------------------------------------------
    // BUILD PENDING ITEMS
    // --------------------------------------------------------

    const pendingItems: any[] = [];

    for (const item of order.items) {
      // ------------------------------------------------------
      // ITEM WITH LOGOS
      // ------------------------------------------------------

      if (item.logos.length > 0) {
        const pendingLogos: any[] = [];

        for (const logo of item.logos) {
          const key = this.getProductionScopeKey(item.id, logo.id);

          const alreadyAllocated = allocated.get(key) ?? 0;

          const pendingQuantity = Math.max(logo.quantity - alreadyAllocated, 0);

          if (pendingQuantity <= 0) {
            continue;
          }

          pendingLogos.push({
            ...logo,
            pendingQuantity,
          });
        }

        // Si ninguno de sus logos tiene producción
        // pendiente, omitimos completamente el item.
        if (pendingLogos.length === 0) {
          continue;
        }

        pendingItems.push({
          ...item,
          logos: pendingLogos,
        });

        continue;
      }

      // ------------------------------------------------------
      // ITEM WITHOUT LOGOS
      // ------------------------------------------------------

      const key = this.getProductionScopeKey(item.id, null);

      const alreadyAllocated = allocated.get(key) ?? 0;

      const pendingQuantity = Math.max(item.quantity - alreadyAllocated, 0);

      if (pendingQuantity <= 0) {
        continue;
      }

      pendingItems.push({
        ...item,
        pendingQuantity,
      });
    }

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      orderedAt: order.orderedAt,
      promisedAt: order.promisedAt,
      customer: order.customer,
      items: pendingItems,
    };
  }

  // ============================================================
  // FIND ALL
  // ============================================================

  async findAll(organizationId: string, query: ProductionQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const skip = (page - 1) * limit;

    const where: Prisma.ProductionJobWhereInput = {
      order: {
        organizationId,
        ...(query.orderNumber !== undefined && {
          orderNumber: query.orderNumber,
        }),
      },

      ...(query.status && {
        status: query.status,
      }),

      ...(query.orderId && {
        orderId: query.orderId,
      }),

      ...(query.orderItemId && {
        orderItemId: query.orderItemId,
      }),

      ...(query.orderItemLogoId && {
        orderItemLogoId: query.orderItemLogoId,
      }),

      ...(query.machineId && {
        machineId: query.machineId,
      }),

      ...(query.employeeId && {
        employeeId: query.employeeId,
      }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.productionJob.findMany({
        where,
        skip,
        take: limit,

        orderBy: {
          createdAt: 'desc',
        },

        select: this.productionListSelect,
      }),

      this.prisma.productionJob.count({
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
    const productionJob = await this.prisma.productionJob.findFirst({
      where: {
        id,

        order: {
          organizationId,
        },
      },

      include: this.productionDetailInclude,
    });

    if (!productionJob) {
      throw new NotFoundException('Trabajo de producción no encontrado');
    }

    return productionJob;
  }

  // ============================================================
  // UPDATE
  // ============================================================

  async update(
    organizationId: string,
    id: string,
    dto: UpdateProductionJobDto,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const productionJob = await tx.productionJob.findFirst({
          where: {
            id,

            order: {
              organizationId,
            },
          },

          select: {
            id: true,
            orderId: true,
            orderItemId: true,
            orderItemLogoId: true,
            quantity: true,
            status: true,
          },
        });

        if (!productionJob) {
          throw new NotFoundException('Trabajo de producción no encontrado');
        }

        this.validateEditableStatus(productionJob.status);

        const orderItem = await tx.orderItem.findUnique({
          where: {
            id: productionJob.orderItemId,
          },

          select: {
            id: true,
            quantity: true,

            logos: {
              select: {
                id: true,
                quantity: true,
              },
            },
          },
        });

        if (!orderItem) {
          throw new NotFoundException('El item del pedido no fue encontrado');
        }

        const nextLogoId =
          dto.orderItemLogoId !== undefined
            ? dto.orderItemLogoId
            : productionJob.orderItemLogoId;

        this.validateLogoSelection(orderItem.logos, nextLogoId);

        if (dto.orderItemLogoId !== undefined && dto.orderItemLogoId !== null) {
          await this.ensureOrderItemLogo(
            tx,
            dto.orderItemLogoId,
            productionJob.orderItemId,
          );
        }

        if (dto.machineId) {
          await this.ensureAvailableMachine(tx, organizationId, dto.machineId);
        }

        if (dto.employeeId) {
          await this.ensureAvailableEmployee(
            tx,
            organizationId,
            dto.employeeId,
          );
        }

        /*
         * Si cambia quantity o logo, debemos comprobar
         * nuevamente la capacidad.
         */
        const nextQuantity = dto.quantity ?? productionJob.quantity;

        const scopeQuantity = nextLogoId
          ? (orderItem.logos.find((logo) => logo.id === nextLogoId)?.quantity ??
            0)
          : orderItem.quantity;

        const availableQuantity = await this.getAvailableQuantity(
          tx,
          productionJob.orderItemId,
          nextLogoId,
          scopeQuantity,
          productionJob.id,
        );

        if (nextQuantity > availableQuantity) {
          throw new BadRequestException(
            `La cantidad solicitada excede la cantidad disponible. Disponible: ${availableQuantity}`,
          );
        }

        const updated = await tx.productionJob.update({
          where: {
            id: productionJob.id,
          },

          data: {
            ...(dto.orderItemLogoId !== undefined && {
              orderItemLogoId: dto.orderItemLogoId,
            }),

            ...(dto.machineId !== undefined && {
              machineId: dto.machineId,
            }),

            ...(dto.employeeId !== undefined && {
              employeeId: dto.employeeId,
            }),

            ...(dto.quantity !== undefined && {
              quantity: dto.quantity,
            }),

            ...(dto.notes !== undefined && {
              notes: this.cleanOptionalString(dto.notes),
            }),
          },

          select: this.productionListSelect,
        });

        await this.recalculateOrderState(
          tx,
          productionJob.orderId,
          productionJob.orderItemId,
        );

        return updated;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  }

  // ============================================================
  // CHANGE STATUS
  // ============================================================

  async changeStatus(
    organizationId: string,
    id: string,
    dto: ChangeProductionStatusDto,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const productionJob = await tx.productionJob.findFirst({
          where: {
            id,

            order: {
              organizationId,
            },
          },

          select: {
            id: true,
            orderId: true,
            orderItemId: true,
            status: true,
            startedAt: true,
            completedAt: true,
          },
        });

        if (!productionJob) {
          throw new NotFoundException('Trabajo de producción no encontrado');
        }

        this.validateStatusTransition(productionJob.status, dto.status);

        const now = new Date();

        const data: Prisma.ProductionJobUpdateInput = {
          status: dto.status,
        };

        if (
          dto.status === ProductionJobStatus.IN_PROGRESS &&
          !productionJob.startedAt
        ) {
          data.startedAt = now;
        }

        if (dto.status === ProductionJobStatus.COMPLETED) {
          data.completedAt = now;

          if (!productionJob.startedAt) {
            data.startedAt = now;
          }
        }

        if (dto.status === ProductionJobStatus.CANCELLED) {
          data.completedAt = null;
        }

        const updated = await tx.productionJob.update({
          where: {
            id: productionJob.id,
          },

          data,

          select: this.productionListSelect,
        });

        /*
         * El estado del item y del pedido depende
         * de todos sus trabajos.
         */
        await this.recalculateOrderState(
          tx,
          productionJob.orderId,
          productionJob.orderItemId,
        );

        return updated;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  }

  // ============================================================
  // PRODUCTION QUANTITY
  // ============================================================

  private async getAvailableQuantity(
    tx: Prisma.TransactionClient,
    orderItemId: string,
    orderItemLogoId: string | null | undefined,
    requestedQuantity: number,
    excludeProductionJobId?: string,
  ) {
    const jobs = await tx.productionJob.findMany({
      where: {
        orderItemId,

        ...(orderItemLogoId
          ? {
              orderItemLogoId,
            }
          : {
              orderItemLogoId: null,
            }),

        ...(excludeProductionJobId && {
          id: {
            not: excludeProductionJobId,
          },
        }),

        status: {
          not: ProductionJobStatus.CANCELLED,
        },
      },

      select: {
        quantity: true,
      },
    });

    const allocatedQuantity = jobs.reduce(
      (total, job) => total + job.quantity,
      0,
    );

    return Math.max(requestedQuantity - allocatedQuantity, 0);
  }

  // ============================================================
  // STATE RECALCULATION
  // ============================================================

  private async recalculateOrderState(
    tx: Prisma.TransactionClient,
    orderId: string,
    orderItemId: string,
  ) {
    await this.recalculateOrderItemState(tx, orderItemId);

    await this.recalculateOrderStateOnly(tx, orderId);
  }

  private async recalculateOrderItemState(
    tx: Prisma.TransactionClient,
    orderItemId: string,
  ) {
    const item = await tx.orderItem.findUnique({
      where: {
        id: orderItemId,
      },

      select: {
        id: true,
        quantity: true,

        status: true,

        logos: {
          select: {
            id: true,
            quantity: true,
          },
        },

        productionJobs: {
          select: {
            id: true,
            orderItemLogoId: true,
            quantity: true,
            status: true,
          },
        },
      },
    });

    if (!item) {
      return;
    }

    /*
     * CANCELLED no se considera producción.
     */
    const activeJobs = item.productionJobs.filter(
      (job) => job.status !== ProductionJobStatus.CANCELLED,
    );

    if (activeJobs.length === 0) {
      await tx.orderItem.update({
        where: {
          id: item.id,
        },

        data: {
          status: OrderItemStatus.PENDING,
        },
      });

      return;
    }

    let completed = false;
    let inProgress = false;

    /*
     * Items con logos:
     * cada logo debe estar completamente producido.
     */
    if (item.logos.length > 0) {
      completed = item.logos.every((logo) => {
        const logoJobs = activeJobs.filter(
          (job) => job.orderItemLogoId === logo.id,
        );

        const completedQuantity = logoJobs
          .filter((job) => job.status === ProductionJobStatus.COMPLETED)
          .reduce((total, job) => total + job.quantity, 0);

        const hasInProgress = logoJobs.some(
          (job) =>
            job.status === ProductionJobStatus.IN_PROGRESS ||
            job.status === ProductionJobStatus.PAUSED ||
            job.status === ProductionJobStatus.PENDING,
        );

        if (hasInProgress) {
          inProgress = true;
        }

        return completedQuantity >= logo.quantity;
      });
    } else {
      /*
       * Item sin logos:
       * toda la cantidad solicitada debe
       * quedar completada.
       */
      const completedQuantity = activeJobs
        .filter((job) => job.status === ProductionJobStatus.COMPLETED)
        .reduce((total, job) => total + job.quantity, 0);

      completed = completedQuantity >= item.quantity;

      inProgress = activeJobs.some(
        (job) =>
          job.status === ProductionJobStatus.IN_PROGRESS ||
          job.status === ProductionJobStatus.PAUSED ||
          job.status === ProductionJobStatus.PENDING,
      );
    }

    let nextStatus: OrderItemStatus;

    if (completed) {
      nextStatus = OrderItemStatus.READY;
    } else if (inProgress) {
      nextStatus = OrderItemStatus.IN_PROGRESS;
    } else {
      nextStatus = OrderItemStatus.PENDING;
    }

    await tx.orderItem.update({
      where: {
        id: item.id,
      },

      data: {
        status: nextStatus,
      },
    });
  }

  private async recalculateOrderStateOnly(
    tx: Prisma.TransactionClient,
    orderId: string,
  ) {
    const order = await tx.order.findUnique({
      where: {
        id: orderId,
      },

      select: {
        id: true,
        status: true,

        items: {
          select: {
            status: true,
          },
        },
      },
    });

    if (!order) {
      return;
    }

    /*
     * No sobrescribimos estados que representan
     * etapas posteriores a producción.
     */
    if (
      order.status === OrderStatus.DELIVERED ||
      order.status === OrderStatus.CANCELLED
    ) {
      return;
    }

    const hasProduction = await tx.productionJob.count({
      where: {
        orderId,
        status: {
          not: ProductionJobStatus.CANCELLED,
        },
      },
    });

    if (hasProduction === 0) {
      return;
    }

    const allReady =
      order.items.length > 0 &&
      order.items.every((item) => item.status === OrderItemStatus.READY);

    const hasInProgress = order.items.some(
      (item) =>
        item.status === OrderItemStatus.IN_PROGRESS ||
        item.status === OrderItemStatus.READY,
    );

    let nextStatus: OrderStatus;

    if (allReady) {
      nextStatus = OrderStatus.READY;
    } else if (hasInProgress) {
      nextStatus = OrderStatus.IN_PROGRESS;
    } else {
      nextStatus = OrderStatus.PENDING;
    }

    if (order.status !== nextStatus) {
      await tx.order.update({
        where: {
          id: order.id,
        },

        data: {
          status: nextStatus,
        },
      });
    }
  }

  // ============================================================
  // VALIDATIONS
  // ============================================================

  private validateOrderForProduction(status: OrderStatus) {
    const allowed: OrderStatus[] = [
      OrderStatus.PENDING,
      OrderStatus.IN_PROGRESS,
    ];

    if (!allowed.includes(status)) {
      throw new BadRequestException(
        'El pedido no se encuentra en un estado que permita producción',
      );
    }
  }

  private validateOrderItemForProduction(status: OrderItemStatus) {
    const allowed: OrderItemStatus[] = [
      OrderItemStatus.PENDING,
      OrderItemStatus.IN_PROGRESS,
    ];

    if (!allowed.includes(status)) {
      throw new BadRequestException(
        'El item del pedido no se encuentra en un estado que permita producción',
      );
    }
  }

  private validateLogoSelection(
    logos: Array<{
      id: string;
      quantity: number;
    }>,
    orderItemLogoId: string | null | undefined,
  ) {
    if (logos.length > 0 && !orderItemLogoId) {
      throw new BadRequestException(
        'Debes seleccionar un logo para producir este item',
      );
    }

    if (logos.length === 0 && orderItemLogoId) {
      throw new BadRequestException('El item seleccionado no tiene logos');
    }
  }

  private validateEditableStatus(status: ProductionJobStatus) {
    if (
      status === ProductionJobStatus.COMPLETED ||
      status === ProductionJobStatus.CANCELLED
    ) {
      throw new BadRequestException(
        'Un trabajo de producción completado o cancelado no puede ser editado',
      );
    }
  }

  private validateStatusTransition(
    current: ProductionJobStatus,
    next: ProductionJobStatus,
  ) {
    if (current === next) {
      throw new BadRequestException('El trabajo ya se encuentra en ese estado');
    }

    const transitions: Record<ProductionJobStatus, ProductionJobStatus[]> = {
      [ProductionJobStatus.PENDING]: [
        ProductionJobStatus.IN_PROGRESS,
        ProductionJobStatus.CANCELLED,
      ],

      [ProductionJobStatus.IN_PROGRESS]: [
        ProductionJobStatus.PAUSED,
        ProductionJobStatus.COMPLETED,
        ProductionJobStatus.CANCELLED,
      ],

      [ProductionJobStatus.PAUSED]: [
        ProductionJobStatus.IN_PROGRESS,
        ProductionJobStatus.CANCELLED,
      ],

      [ProductionJobStatus.COMPLETED]: [],

      [ProductionJobStatus.CANCELLED]: [],
    };

    if (!transitions[current].includes(next)) {
      throw new BadRequestException(
        `No se puede cambiar el estado de ${current} a ${next}`,
      );
    }
  }

  // ============================================================
  // RELATED ENTITY VALIDATIONS
  // ============================================================

  private async ensureOrderItemLogo(
    tx: Prisma.TransactionClient,
    orderItemLogoId: string,
    orderItemId: string,
  ) {
    const logo = await tx.orderItemLogo.findFirst({
      where: {
        id: orderItemLogoId,
        orderItemId,
      },

      select: {
        id: true,
      },
    });

    if (!logo) {
      throw new NotFoundException('El logo del item no fue encontrado');
    }
  }

  private async ensureAvailableMachine(
    tx: Prisma.TransactionClient,
    organizationId: string,
    machineId: string,
  ) {
    const machine = await tx.machine.findFirst({
      where: {
        id: machineId,
        organizationId,
      },

      select: {
        id: true,
        status: true,
      },
    });

    if (!machine) {
      throw new NotFoundException('Máquina no encontrada');
    }

    if (machine.status !== MachineStatus.ACTIVE) {
      throw new BadRequestException('La máquina seleccionada no está activa');
    }
  }

  private async ensureAvailableEmployee(
    tx: Prisma.TransactionClient,
    organizationId: string,
    employeeId: string,
  ) {
    const employee = await tx.employee.findFirst({
      where: {
        id: employeeId,
        organizationId,
      },

      select: {
        id: true,
        status: true,
      },
    });

    if (!employee) {
      throw new NotFoundException('Empleado no encontrado');
    }

    if (employee.status !== EmployeeStatus.ACTIVE) {
      throw new BadRequestException('El empleado seleccionado no está activo');
    }
  }

  // ============================================================
  // UTILS
  // ============================================================

  private cleanOptionalString(value?: string | null) {
    if (value === undefined || value === null) {
      return value;
    }

    const trimmed = value.trim();

    return trimmed || null;
  }

  // ============================================================
  // AVAILABLE ORDERS FOR PRODUCTION
  // ============================================================

  async findAvailableOrders(organizationId: string) {
    type AvailableOrderRow = {
      id: string;
      orderNumber: number;
      promisedAt: Date | null;
      customerId: string;
      customerName: string;
      companyName: string | null;
    };

    const rows = await this.prisma.$queryRaw<AvailableOrderRow[]>`
    SELECT DISTINCT
      o.id,
      o."orderNumber",
      o."promisedAt",
      c.id AS "customerId",
      c.name AS "customerName",
      c."companyName"
    FROM "orders" o
    INNER JOIN "customers" c
      ON c.id = o."customerId"
    INNER JOIN "order_items" oi
      ON oi."orderId" = o.id

    WHERE
      o."organizationId" = ${organizationId}

      AND o.status NOT IN ('QUOTE', 'DELIVERED', 'CANCELLED')

      AND (
        /*
         * ------------------------------------------------------
         * ITEM CON LOGOS
         * ------------------------------------------------------
         *
         * Si al menos uno de sus logos todavía tiene
         * cantidad pendiente de producción.
         */
        (
          EXISTS (
            SELECT 1
            FROM "order_item_logos" oil
            WHERE oil."orderItemId" = oi.id

              AND oil.quantity > (
                SELECT COALESCE(SUM(pj.quantity), 0)
                FROM "production_jobs" pj
                WHERE pj."orderItemLogoId" = oil.id
                  AND pj.status <> 'CANCELLED'
              )
          )
        )

        OR

        /*
         * ------------------------------------------------------
         * ITEM SIN LOGOS
         * ------------------------------------------------------
         *
         * La cantidad total del item menos lo ya asignado
         * a producción.
         */
        (
          NOT EXISTS (
            SELECT 1
            FROM "order_item_logos" oil
            WHERE oil."orderItemId" = oi.id
          )

          AND oi.quantity > (
            SELECT COALESCE(SUM(pj.quantity), 0)
            FROM "production_jobs" pj
            WHERE pj."orderItemId" = oi.id
              AND pj."orderItemLogoId" IS NULL
              AND pj.status <> 'CANCELLED'
          )
        )
      )

    ORDER BY
      o."promisedAt" ASC NULLS LAST,
      o."orderNumber" ASC
  `;

    return rows.map((row) => ({
      id: row.id,
      orderNumber: row.orderNumber,
      promisedAt: row.promisedAt,
      customer: {
        id: row.customerId,
        name: row.customerName,
        companyName: row.companyName,
      },
    }));
  }

  private getProductionScopeKey(
    orderItemId: string,
    orderItemLogoId: string | null,
  ) {
    return `${orderItemId}:${orderItemLogoId ?? 'NO_LOGO'}`;
  }
}
