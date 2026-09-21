import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service.js'; // Ajusta la ruta a tu PrismaService
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderStatus, PaymentStatus } from '../../generated/prisma/client.js';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createOrderDto: CreateOrderDto) {
    const { organizationId, customerId, promisedAt, notes, items } =
      createOrderDto;

    // 1. Obtener correlativo secuencial dentro de la organización
    const lastOrder = await this.prisma.order.findFirst({
      where: { organizationId },
      orderBy: { orderNumber: 'desc' },
      select: { orderNumber: true },
    });

    const nextOrderNumber = (lastOrder?.orderNumber ?? 1000) + 1;

    // 2. Procesar items y calcular subtotales
    let orderSubtotal = 0;

    const itemsToCreate = items.map((item) => {
      const garmentSubtotal = item.quantity * item.unitPrice;
      const logosSubtotal = item.logos.reduce(
        (acc, logo) => acc + item.quantity * logo.unitPrice,
        0,
      );

      const itemSubtotal = garmentSubtotal + logosSubtotal;
      orderSubtotal += itemSubtotal;

      return {
        garmentId: item.garmentId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: itemSubtotal,
        description: item.description,
        logos: {
          create: item.logos.map((logo) => ({
            logoId: logo.logoId,
            logoName: logo.logoName,
            unitPrice: logo.unitPrice,
            quantity: item.quantity,
            placement: logo.placement,
          })),
        },
      };
    });

    // 3. Crear Pedido en DB
    return this.prisma.order.create({
      data: {
        organizationId,
        customerId,
        orderNumber: nextOrderNumber,
        status: OrderStatus.PENDING,
        paymentStatus: PaymentStatus.UNPAID,
        subtotal: orderSubtotal,
        total: orderSubtotal,
        paidAmount: 0,
        promisedAt: promisedAt ? new Date(promisedAt) : null,
        notes,
        items: {
          create: itemsToCreate,
        },
      },
      include: {
        customer: true,
        items: {
          include: { logos: true, garment: true },
        },
      },
    });
  }

  findAll(organizationId: string) {
    if (!organizationId) {
      throw new NotFoundException(
        'Debe proporcionar un organizationId para listar los pedidos.',
      );
    }

    return this.prisma.order.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      include: {
        customer: { select: { id: true, name: true, companyName: true } },
        items: true,
      },
    });
  }

  async findOne(id: string, organizationId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, organizationId },
      include: {
        customer: true,
        items: {
          include: {
            garment: true,
            logos: true,
          },
        },
        payments: true,
        productionJobs: {
          include: {
            machine: true,
            employee: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Pedido con ID ${id} no encontrado.`);
    }

    return order;
  }
}
