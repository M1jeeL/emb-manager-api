import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma.service.js';

import { CreateEmployeeDto } from './dto/create-employee.dto.js';
import { UpdateEmployeeDto } from './dto/update-employee.dto.js';
import { EmployeeQueryDto } from './dto/employee-query.dto.js';
import { ChangeEmployeeStatusDto } from './dto/change-employee-status.dto.js';

import { Prisma } from '../../generated/prisma/client.js';

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  // ============================================================
  // SELECTS
  // ============================================================

  private readonly employeeUserSelect = {
    id: true,
    email: true,
    firstName: true,
    lastName: true,
    role: true,
    active: true,
  } satisfies Prisma.UserSelect;

  // ============================================================
  // CREATE
  // ============================================================

  async create(organizationId: string, dto: CreateEmployeeDto) {
    const firstName = dto.firstName.trim();
    const lastName = dto.lastName.trim();

    const email = dto.email?.trim().toLowerCase();
    const phone = dto.phone?.trim();
    const position = dto.position?.trim();
    const notes = dto.notes?.trim();

    if (dto.userId) {
      await this.validateUserAssignment(organizationId, dto.userId);
    }

    return this.prisma.employee.create({
      data: {
        organizationId,

        firstName,
        lastName,

        userId: dto.userId,

        email,
        phone,
        position,
        notes,
      },

      include: {
        user: {
          select: this.employeeUserSelect,
        },

        _count: {
          select: {
            productionJobs: true,
          },
        },
      },
    });
  }

  // ============================================================
  // FIND ALL
  // ============================================================

  async findAll(organizationId: string, query: EmployeeQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const skip = (page - 1) * limit;

    const where: Prisma.EmployeeWhereInput = {
      organizationId,

      ...(query.status && {
        status: query.status,
      }),

      ...(query.name && {
        OR: [
          {
            firstName: {
              contains: query.name.trim(),
              mode: 'insensitive',
            },
          },
          {
            lastName: {
              contains: query.name.trim(),
              mode: 'insensitive',
            },
          },
        ],
      }),

      ...(query.email && {
        email: {
          contains: query.email.trim().toLowerCase(),
          mode: 'insensitive',
        },
      }),

      ...(query.phone && {
        phone: {
          contains: query.phone.trim(),
          mode: 'insensitive',
        },
      }),

      ...(query.position && {
        position: {
          contains: query.position.trim(),
          mode: 'insensitive',
        },
      }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.employee.findMany({
        where,

        include: {
          user: {
            select: this.employeeUserSelect,
          },

          _count: {
            select: {
              productionJobs: true,
            },
          },
        },

        orderBy: [
          {
            firstName: 'asc',
          },
          {
            lastName: 'asc',
          },
        ],

        skip,
        take: limit,
      }),

      this.prisma.employee.count({
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
    const employee = await this.prisma.employee.findFirst({
      where: {
        id,
        organizationId,
      },

      include: {
        user: {
          select: this.employeeUserSelect,
        },

        _count: {
          select: {
            productionJobs: true,
          },
        },
      },
    });

    if (!employee) {
      throw new NotFoundException('Empleado no encontrado');
    }

    return employee;
  }

  // ============================================================
  // UPDATE
  // ============================================================

  async update(organizationId: string, id: string, dto: UpdateEmployeeDto) {
    await this.ensureExists(organizationId, id);

    if (dto.userId !== undefined && dto.userId !== null) {
      await this.validateUserAssignment(organizationId, dto.userId, id);
    }

    return this.prisma.employee.update({
      where: {
        id,
      },

      data: {
        ...(dto.firstName !== undefined && {
          firstName: dto.firstName.trim(),
        }),

        ...(dto.lastName !== undefined && {
          lastName: dto.lastName.trim(),
        }),

        ...(dto.userId !== undefined && {
          userId: dto.userId,
        }),

        ...(dto.email !== undefined && {
          email: dto.email?.trim().toLowerCase(),
        }),

        ...(dto.phone !== undefined && {
          phone: dto.phone?.trim(),
        }),

        ...(dto.position !== undefined && {
          position: dto.position?.trim(),
        }),

        ...(dto.notes !== undefined && {
          notes: dto.notes?.trim(),
        }),
      },

      include: {
        user: {
          select: this.employeeUserSelect,
        },

        _count: {
          select: {
            productionJobs: true,
          },
        },
      },
    });
  }

  // ============================================================
  // CHANGE STATUS
  // ============================================================

  async changeStatus(
    organizationId: string,
    id: string,
    dto: ChangeEmployeeStatusDto,
  ) {
    await this.ensureExists(organizationId, id);

    return this.prisma.employee.update({
      where: {
        id,
      },

      data: {
        status: dto.status,
      },

      include: {
        user: {
          select: this.employeeUserSelect,
        },

        _count: {
          select: {
            productionJobs: true,
          },
        },
      },
    });
  }

  // ============================================================
  // VALIDATIONS
  // ============================================================

  private async validateUserAssignment(
    organizationId: string,
    userId: string,
    employeeId?: string,
  ) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        organizationId,
      },

      select: {
        id: true,
        employee: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (user.employee && user.employee.id !== employeeId) {
      throw new ConflictException(
        'El usuario ya está vinculado a otro empleado',
      );
    }
  }

  private async ensureExists(organizationId: string, id: string) {
    const employee = await this.prisma.employee.findFirst({
      where: {
        id,
        organizationId,
      },

      select: {
        id: true,
      },
    });

    if (!employee) {
      throw new NotFoundException('Empleado no encontrado');
    }
  }
}
