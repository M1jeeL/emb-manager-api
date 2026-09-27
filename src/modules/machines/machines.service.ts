import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma.service.js';

import { CreateMachineDto } from './dto/create-machine.dto.js';
import { UpdateMachineDto } from './dto/update-machine.dto.js';
import { MachineQueryDto } from './dto/machine-query.dto.js';
import { ChangeMachineStatusDto } from './dto/change-machine-status.dto.js';

import { Prisma } from '../../generated/prisma/client.js';

@Injectable()
export class MachinesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(organizationId: string, dto: CreateMachineDto) {
    const name = dto.name.trim();

    const duplicate = await this.prisma.machine.findFirst({
      where: {
        organizationId,
        name,
      },
      select: {
        id: true,
      },
    });

    if (duplicate) {
      throw new ConflictException('Ya existe una máquina con ese nombre');
    }

    return this.prisma.machine.create({
      data: {
        organizationId,
        name,
        code: dto.code?.trim() || null,
        type: dto.type,
        brand: dto.brand?.trim() || null,
        model: dto.model?.trim() || null,
        serialNumber: dto.serialNumber?.trim() || null,
        needleCount: dto.needleCount,
        headCount: dto.headCount,
        notes: dto.notes?.trim() || null,
      },

      include: {
        _count: {
          select: {
            productionJobs: true,
          },
        },
      },
    });
  }

  async findAll(organizationId: string, query: MachineQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const skip = (page - 1) * limit;

    const where: Prisma.MachineWhereInput = {
      organizationId,

      ...(query.type && {
        type: query.type,
      }),

      ...(query.status && {
        status: query.status,
      }),

      ...(query.name && {
        name: {
          contains: query.name.trim(),
          mode: 'insensitive',
        },
      }),

      ...(query.code && {
        code: {
          contains: query.code.trim(),
          mode: 'insensitive',
        },
      }),

      ...(query.brand && {
        brand: {
          contains: query.brand.trim(),
          mode: 'insensitive',
        },
      }),

      ...(query.model && {
        model: {
          contains: query.model.trim(),
          mode: 'insensitive',
        },
      }),

      ...(query.serialNumber && {
        serialNumber: {
          contains: query.serialNumber.trim(),
          mode: 'insensitive',
        },
      }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.machine.findMany({
        where,
        skip,
        take: limit,

        orderBy: [
          {
            status: 'asc',
          },
          {
            name: 'asc',
          },
        ],

        include: {
          _count: {
            select: {
              productionJobs: true,
            },
          },
        },
      }),

      this.prisma.machine.count({
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
    const machine = await this.prisma.machine.findFirst({
      where: {
        id,
        organizationId,
      },

      include: {
        _count: {
          select: {
            productionJobs: true,
          },
        },
      },
    });

    if (!machine) {
      throw new NotFoundException('Máquina no encontrada');
    }

    return machine;
  }

  async update(organizationId: string, id: string, dto: UpdateMachineDto) {
    const machine = await this.prisma.machine.findFirst({
      where: {
        id,
        organizationId,
      },
    });

    if (!machine) {
      throw new NotFoundException('Máquina no encontrada');
    }

    const name = dto.name !== undefined ? dto.name.trim() : undefined;

    if (name && name !== machine.name) {
      const duplicate = await this.prisma.machine.findFirst({
        where: {
          organizationId,
          name,
          id: {
            not: id,
          },
        },

        select: {
          id: true,
        },
      });

      if (duplicate) {
        throw new ConflictException('Ya existe una máquina con ese nombre');
      }
    }

    return this.prisma.machine.update({
      where: {
        id,
      },

      data: {
        ...(name !== undefined && {
          name,
        }),

        ...(dto.code !== undefined && {
          code: dto.code.trim() || null,
        }),

        ...(dto.type !== undefined && {
          type: dto.type,
        }),

        ...(dto.brand !== undefined && {
          brand: dto.brand.trim() || null,
        }),

        ...(dto.model !== undefined && {
          model: dto.model.trim() || null,
        }),

        ...(dto.serialNumber !== undefined && {
          serialNumber: dto.serialNumber.trim() || null,
        }),

        ...(dto.needleCount !== undefined && {
          needleCount: dto.needleCount,
        }),

        ...(dto.headCount !== undefined && {
          headCount: dto.headCount,
        }),

        ...(dto.notes !== undefined && {
          notes: dto.notes.trim() || null,
        }),
      },

      include: {
        _count: {
          select: {
            productionJobs: true,
          },
        },
      },
    });
  }

  async changeStatus(
    organizationId: string,
    id: string,
    dto: ChangeMachineStatusDto,
  ) {
    const machine = await this.prisma.machine.findFirst({
      where: {
        id,
        organizationId,
      },
    });

    if (!machine) {
      throw new NotFoundException('Máquina no encontrada');
    }

    return this.prisma.machine.update({
      where: {
        id,
      },

      data: {
        status: dto.status,
      },

      include: {
        _count: {
          select: {
            productionJobs: true,
          },
        },
      },
    });
  }
}
