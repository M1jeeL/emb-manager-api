import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma.service.js';

import { CreateCustomerDto } from './dto/create-customer.dto.js';
import { UpdateCustomerDto } from './dto/update-customer.dto.js';
import { CustomerQueryDto } from './dto/customer-query.dto.js';
import { ChangeCustomerStatusDto } from './dto/change-customer-status.dto.js';
import { Prisma } from 'src/generated/prisma/client.js';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(organizationId: string, dto: CreateCustomerDto) {
    const name = dto.name.trim();

    const email = dto.email?.trim().toLowerCase();

    const phone = dto.phone?.trim();
    const taxId = dto.taxId?.trim();

    const duplicate = await this.prisma.customer.findFirst({
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
        'Ya existe un cliente con uno de los datos identificadores proporcionados',
      );
    }

    return this.prisma.customer.create({
      data: {
        organizationId,
        name,
        email,
        phone,
        taxId,
        companyName: dto.companyName?.trim(),
        address: dto.address?.trim(),
        city: dto.city?.trim(),
        notes: dto.notes?.trim(),
      },
    });
  }

  async findAll(organizationId: string, query: CustomerQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const skip = (page - 1) * limit;

    const where: Prisma.CustomerWhereInput = {
      organizationId,
      ...(query.status && {
        status: query.status,
      }),
      ...(query.name && {
        name: {
          contains: query.name.trim(),
          mode: 'insensitive',
        },
      }),
      ...(query.companyName && {
        companyName: {
          contains: query.companyName.trim(),
          mode: 'insensitive',
        },
      }),
      ...(query.phone && {
        phone: {
          contains: query.phone.trim(),
          mode: 'insensitive',
        },
      }),
      ...(query.email && {
        email: {
          contains: query.email.trim().toLowerCase(),
          mode: 'insensitive',
        },
      }),
      ...(query.taxId && {
        taxId: {
          contains: query.taxId.trim(),
          mode: 'insensitive',
        },
      }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where,
        orderBy: {
          name: 'asc',
        },
        skip,
        take: limit,
      }),

      this.prisma.customer.count({
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

  async findOne(organizationId: string, id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: {
        id,
        organizationId,
      },
      include: {
        _count: {
          select: {
            orders: true,
            logos: true,
          },
        },
      },
    });

    if (!customer) {
      throw new NotFoundException('Cliente no encontrado');
    }

    return customer;
  }

  async update(organizationId: string, id: string, dto: UpdateCustomerDto) {
    await this.ensureExists(organizationId, id);

    const email = dto.email?.trim().toLowerCase();

    const phone = dto.phone?.trim();
    const taxId = dto.taxId?.trim();

    if (email || phone || taxId) {
      const duplicate = await this.prisma.customer.findFirst({
        where: {
          organizationId,

          NOT: {
            id,
          },

          OR: [
            ...(email ? [{ email }] : []),

            ...(phone ? [{ phone }] : []),

            ...(taxId ? [{ taxId }] : []),
          ],
        },
      });

      if (duplicate) {
        throw new ConflictException(
          'Ya existe otro cliente con uno de los datos identificadores proporcionados',
        );
      }
    }

    return this.prisma.customer.update({
      where: {
        id,
      },

      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),

        ...(dto.email !== undefined ? { email } : {}),

        ...(dto.phone !== undefined ? { phone } : {}),

        ...(dto.taxId !== undefined ? { taxId } : {}),

        ...(dto.companyName !== undefined
          ? {
              companyName: dto.companyName.trim(),
            }
          : {}),

        ...(dto.address !== undefined
          ? {
              address: dto.address.trim(),
            }
          : {}),

        ...(dto.city !== undefined
          ? {
              city: dto.city.trim(),
            }
          : {}),

        ...(dto.notes !== undefined
          ? {
              notes: dto.notes.trim(),
            }
          : {}),
      },
    });
  }

  async changeStatus(
    organizationId: string,
    id: string,
    dto: ChangeCustomerStatusDto,
  ) {
    await this.ensureExists(organizationId, id);

    return this.prisma.customer.update({
      where: {
        id,
      },
      data: {
        status: dto.status,
      },
    });
  }

  private async ensureExists(organizationId: string, id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: {
        id,
        organizationId,
      },
      select: {
        id: true,
      },
    });

    if (!customer) {
      throw new NotFoundException('Cliente no encontrado');
    }
  }
}
