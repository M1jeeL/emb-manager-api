import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma.service.js';

import { CreateGarmentDto } from './dto/create-garment.dto.js';
import { UpdateGarmentDto } from './dto/update-garment.dto.js';
import { UpdateGarmentStatusDto } from './dto/update-garment-status.dto.js';
import { GarmentQueryDto } from './dto/garment-query.dto.js';
import { Prisma } from 'src/generated/prisma/client.js';

@Injectable()
export class GarmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(organizationId: string, dto: CreateGarmentDto) {
    const name = dto.name.trim();

    const existing = await this.prisma.garment.findFirst({
      where: {
        organizationId,
        name,
      },
      select: {
        id: true,
      },
    });

    if (existing) {
      throw new ConflictException('Ya existe una prenda con ese nombre.');
    }

    try {
      return await this.prisma.garment.create({
        data: {
          organizationId,
          name,
          description: dto.description?.trim() || null,
        },
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException('Ya existe una prenda con ese nombre.');
      }

      throw error;
    }
  }

  async findAll(organizationId: string, query: GarmentQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    // Normalización del booleano
    const activeFilter =
      typeof query.active === 'string' ? query.active === 'true' : query.active;

    const where: Prisma.GarmentWhereInput = {
      organizationId,

      ...(query.name
        ? {
            name: {
              contains: query.name.trim(),
              mode: 'insensitive' as const,
            },
          }
        : {}),

      ...(query.description
        ? {
            description: {
              contains: query.description.trim(),
              mode: 'insensitive' as const,
            },
          }
        : {}),

      ...(activeFilter !== undefined
        ? {
            active: activeFilter,
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.garment.findMany({
        where,
        orderBy: {
          name: 'asc',
        },
        skip,
        take: limit,
      }),

      this.prisma.garment.count({
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
    const garment = await this.prisma.garment.findFirst({
      where: {
        id,
        organizationId,
      },
    });

    if (!garment) {
      throw new NotFoundException('Prenda no encontrada.');
    }

    return garment;
  }

  async update(organizationId: string, id: string, dto: UpdateGarmentDto) {
    const garment = await this.findOne(organizationId, id);

    const data: {
      name?: string;
      description?: string | null;
    } = {};

    if (dto.name !== undefined) {
      const name = dto.name.trim();

      if (!name) {
        throw new ConflictException(
          'El nombre de la prenda no puede estar vacío.',
        );
      }

      if (name !== garment.name) {
        const existing = await this.prisma.garment.findFirst({
          where: {
            organizationId,
            name,
            NOT: {
              id,
            },
          },
          select: {
            id: true,
          },
        });

        if (existing) {
          throw new ConflictException('Ya existe una prenda con ese nombre.');
        }
      }

      data.name = name;
    }

    if (dto.description !== undefined) {
      data.description = dto.description.trim() || null;
    }

    try {
      return await this.prisma.garment.update({
        where: {
          id,
        },
        data,
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException('Ya existe una prenda con ese nombre.');
      }

      throw error;
    }
  }

  async updateStatus(
    organizationId: string,
    id: string,
    dto: UpdateGarmentStatusDto,
  ) {
    await this.findOne(organizationId, id);

    return this.prisma.garment.update({
      where: {
        id,
      },
      data: {
        active: dto.active,
      },
    });
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    );
  }
}
