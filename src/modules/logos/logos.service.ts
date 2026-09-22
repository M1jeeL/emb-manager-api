import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma.service.js';

import { CreateLogoDto } from './dto/create-logo.dto.js';
import { UpdateLogoDto } from './dto/update-logo.dto.js';
import { ChangeLogoStatusDto } from './dto/change-logo-status.dto.js';
import { LogoQueryDto } from './dto/logo-query.dto.js';
import { CreateLogoVersionDto } from './dto/create-logo-version.dto.js';
import { CreateLogoFileDto } from './dto/create-logo-file.dto.js';
import { Prisma } from '../../generated/prisma/client.js';
import { StorageService } from '../storage/storage.service.js';
import { LogoFileType } from '../../generated/prisma/enums.js';
import { randomUUID } from 'node:crypto';

@Injectable()
export class LogosService {
  private readonly imageExtensions = new Set(['png', 'jpg', 'jpeg', 'webp']);

  private readonly embroideryExtensions = new Set(['dst', 'pes', 'jef', 'exp']);

  private readonly maxImageSize = 10 * 1024 * 1024;
  private readonly maxEmbroiderySize = 25 * 1024 * 1024;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  async create(organizationId: string, dto: CreateLogoDto) {
    const name = dto.name.trim();

    const customerId = dto.customerId ?? null;

    if (customerId) {
      await this.ensureCustomerBelongsToOrganization(
        organizationId,
        customerId,
      );
    }

    await this.ensureNoDuplicateLogo(organizationId, name, customerId);

    const currentPrice = new Prisma.Decimal(dto.currentPrice ?? '0');

    return this.prisma.$transaction(async (tx) => {
      const logo = await tx.logo.create({
        data: {
          organizationId,
          customerId,
          name,
          description: dto.description?.trim(),
          currentPrice,
        },
      });

      await tx.logoVersion.create({
        data: {
          logoId: logo.id,
          version: 1,
        },
      });

      await tx.logoPriceHistory.create({
        data: {
          logoId: logo.id,
          price: currentPrice,
        },
      });

      return logo;
    });
  }

  async findAll(organizationId: string, query: LogoQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const skip = (page - 1) * limit;

    const where: Prisma.LogoWhereInput = {
      organizationId,

      ...(query.status && {
        status: query.status,
      }),

      ...(query.customerId && {
        customerId: query.customerId,
      }),

      ...(query.name && {
        name: {
          contains: query.name.trim(),
          mode: 'insensitive',
        },
      }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.logo.findMany({
        where,
        orderBy: {
          name: 'asc',
        },
        skip,
        take: limit,
        include: {
          customer: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: {
            select: {
              versions: true,
              orderItemLogos: true,
            },
          },
        },
      }),

      this.prisma.logo.count({
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
    const logo = await this.prisma.logo.findFirst({
      where: {
        id,
        organizationId,
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
          },
        },

        versions: {
          orderBy: {
            version: 'asc',
          },
          include: {
            files: {
              orderBy: {
                createdAt: 'asc',
              },
            },
          },
        },

        priceHistory: {
          orderBy: {
            createdAt: 'desc',
          },
        },

        _count: {
          select: {
            versions: true,
            orderItemLogos: true,
          },
        },
      },
    });

    if (!logo) {
      throw new NotFoundException('Logo no encontrado');
    }

    return {
      ...logo,
      versions: logo.versions.map((version) => ({
        ...version,
        files: version.files.map((file) => this.serializeFile(file)),
      })),
    };
  }

  async update(organizationId: string, id: string, dto: UpdateLogoDto) {
    const existing = await this.getLogoOrThrow(organizationId, id);

    const name = dto.name !== undefined ? dto.name.trim() : existing.name;

    const customerId =
      dto.customerId !== undefined ? dto.customerId : existing.customerId;

    if (customerId) {
      await this.ensureCustomerBelongsToOrganization(
        organizationId,
        customerId,
      );
    }

    if (name !== existing.name || customerId !== existing.customerId) {
      await this.ensureNoDuplicateLogo(organizationId, name, customerId, id);
    }

    const priceChanged =
      dto.currentPrice !== undefined &&
      !new Prisma.Decimal(dto.currentPrice).eq(existing.currentPrice);

    if (!priceChanged) {
      return this.prisma.logo.update({
        where: {
          id,
        },
        data: {
          ...(dto.name !== undefined ? { name: name } : {}),

          ...(dto.description !== undefined
            ? {
                description: dto.description.trim(),
              }
            : {}),

          ...(dto.customerId !== undefined
            ? {
                customerId: dto.customerId,
              }
            : {}),
        },
      });
    }

    const nextPrice = new Prisma.Decimal(dto.currentPrice!);

    return this.prisma.$transaction(async (tx) => {
      const logo = await tx.logo.update({
        where: {
          id,
        },
        data: {
          ...(dto.name !== undefined ? { name: name } : {}),

          ...(dto.description !== undefined
            ? {
                description: dto.description.trim(),
              }
            : {}),

          ...(dto.customerId !== undefined
            ? {
                customerId: dto.customerId,
              }
            : {}),

          currentPrice: nextPrice,
        },
      });

      await tx.logoPriceHistory.create({
        data: {
          logoId: id,
          price: nextPrice,
        },
      });

      return logo;
    });
  }

  async changeStatus(
    organizationId: string,
    id: string,
    dto: ChangeLogoStatusDto,
  ) {
    await this.getLogoOrThrow(organizationId, id);

    return this.prisma.logo.update({
      where: {
        id,
      },
      data: {
        status: dto.status,
      },
    });
  }

  async createVersion(
    organizationId: string,
    logoId: string,
    dto: CreateLogoVersionDto,
  ) {
    await this.getLogoOrThrow(organizationId, logoId);

    return this.prisma.$transaction(async (tx) => {
      const lastVersion = await tx.logoVersion.findFirst({
        where: {
          logoId,
        },
        orderBy: {
          version: 'desc',
        },
        select: {
          version: true,
        },
      });

      const nextVersion = (lastVersion?.version ?? 0) + 1;

      return tx.logoVersion.create({
        data: {
          logoId,
          version: nextVersion,

          widthMm:
            dto.widthMm !== undefined
              ? new Prisma.Decimal(dto.widthMm)
              : undefined,

          heightMm:
            dto.heightMm !== undefined
              ? new Prisma.Decimal(dto.heightMm)
              : undefined,

          stitchCount: dto.stitchCount,

          notes: dto.notes?.trim(),
        },
      });
    });
  }

  async createFile(
    organizationId: string,
    logoId: string,
    versionId: string,
    dto: CreateLogoFileDto,
    file: {
      originalname: string;
      mimetype: string;
      size: number;
      buffer: Buffer;
    },
  ) {
    const logo = await this.prisma.logo.findFirst({
      where: {
        id: logoId,
        organizationId,
      },
      select: {
        id: true,
      },
    });

    if (!logo) {
      throw new NotFoundException('Logo no encontrado');
    }

    const version = await this.prisma.logoVersion.findFirst({
      where: {
        id: versionId,
        logoId,
      },
      select: {
        id: true,
      },
    });

    if (!version) {
      throw new NotFoundException('Versión del logo no encontrada');
    }

    const extension = this.validateFile(dto.type, file);

    const safeFileName = this.sanitizeFileName(file.originalname);

    const storageKey = [
      'organizations',
      organizationId,
      'logos',
      logoId,
      'versions',
      versionId,
      `${randomUUID()}-${safeFileName}`,
    ].join('/');

    await this.storageService.upload(storageKey, file.buffer, file.mimetype);

    try {
      const createdFile = await this.prisma.$transaction(async (tx) => {
        if (dto.isPrimary) {
          await tx.logoFile.updateMany({
            where: {
              logoVersionId: versionId,
              type: dto.type,
              isPrimary: true,
            },
            data: {
              isPrimary: false,
            },
          });
        }

        return tx.logoFile.create({
          data: {
            logoVersionId: versionId,
            type: dto.type,
            format: extension.toUpperCase(),
            fileName: file.originalname,
            storageKey,
            mimeType: file.mimetype,
            fileSize: BigInt(file.size),
            isPrimary: dto.isPrimary ?? false,
          },
        });
      });

      return this.serializeFile(createdFile);
    } catch (error) {
      await this.storageService.delete(storageKey);
      throw error;
    }
  }

  async findOrCreateForOrder(
    organizationId: string,
    customerId: string | null,
    name: string,
    currentPrice = '0',
  ) {
    const normalizedName = name.trim();

    if (!normalizedName) {
      throw new ConflictException('El nombre del logo es obligatorio');
    }

    if (customerId) {
      await this.ensureCustomerBelongsToOrganization(
        organizationId,
        customerId,
      );
    }

    const existing = await this.prisma.logo.findFirst({
      where: {
        organizationId,
        customerId,
        name: {
          equals: normalizedName,
          mode: 'insensitive',
        },
      },
    });

    if (existing) {
      return existing;
    }

    const price = new Prisma.Decimal(currentPrice);

    return this.prisma.$transaction(async (tx) => {
      const raceCheck = await tx.logo.findFirst({
        where: {
          organizationId,
          customerId,
          name: {
            equals: normalizedName,
            mode: 'insensitive',
          },
        },
      });

      if (raceCheck) {
        return raceCheck;
      }

      const logo = await tx.logo.create({
        data: {
          organizationId,
          customerId,
          name: normalizedName,
          currentPrice: price,
        },
      });

      await tx.logoVersion.create({
        data: {
          logoId: logo.id,
          version: 1,
        },
      });

      await tx.logoPriceHistory.create({
        data: {
          logoId: logo.id,
          price,
        },
      });

      return logo;
    });
  }

  private async getLogoOrThrow(organizationId: string, id: string) {
    const logo = await this.prisma.logo.findFirst({
      where: {
        id,
        organizationId,
      },
      select: {
        id: true,
        name: true,
        customerId: true,
        currentPrice: true,
      },
    });

    if (!logo) {
      throw new NotFoundException('Logo no encontrado');
    }

    return logo;
  }

  private async ensureCustomerBelongsToOrganization(
    organizationId: string,
    customerId: string,
  ) {
    const customer = await this.prisma.customer.findFirst({
      where: {
        id: customerId,
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

  private async ensureNoDuplicateLogo(
    organizationId: string,
    name: string,
    customerId: string | null,
    excludeId?: string,
  ) {
    const duplicate = await this.prisma.logo.findFirst({
      where: {
        organizationId,
        customerId,
        name: {
          equals: name,
          mode: 'insensitive',
        },

        ...(excludeId
          ? {
              NOT: {
                id: excludeId,
              },
            }
          : {}),
      },

      select: {
        id: true,
      },
    });

    if (duplicate) {
      throw new ConflictException(
        'Ya existe un logo con ese nombre para este cliente',
      );
    }
  }

  private serializeFile(file: {
    id: string;
    logoVersionId: string;
    type: LogoFileType;
    format: string;
    fileName: string;
    storageKey: string;
    mimeType: string | null;
    fileSize: bigint | null;
    isPrimary: boolean;
    createdAt: Date;
  }) {
    return {
      ...file,
      fileSize: file.fileSize?.toString() ?? null,
    };
  }

  private sanitizeFileName(fileName: string) {
    return fileName
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^\.+/, '')
      .slice(0, 180);
  }

  private validateFile(
    type: LogoFileType,
    file: {
      originalname: string;
      mimetype: string;
      size: number;
    },
  ) {
    const extension = file.originalname.split('.').pop()?.toLowerCase() ?? '';

    if (!extension) {
      throw new BadRequestException(
        'El archivo debe tener una extensión válida',
      );
    }

    if (type === LogoFileType.IMAGE) {
      if (!this.imageExtensions.has(extension)) {
        throw new BadRequestException('El formato de imagen no está permitido');
      }

      if (file.size > this.maxImageSize) {
        throw new BadRequestException(
          'Las imágenes no pueden superar los 10 MB',
        );
      }

      const allowedMimeTypes = new Set([
        'image/png',
        'image/jpeg',
        'image/webp',
      ]);

      if (!allowedMimeTypes.has(file.mimetype)) {
        throw new BadRequestException('El tipo MIME de la imagen no es válido');
      }

      return extension;
    }

    if (type === LogoFileType.EMBROIDERY) {
      if (!this.embroideryExtensions.has(extension)) {
        throw new BadRequestException(
          'El formato de bordado no está permitido',
        );
      }

      if (file.size > this.maxEmbroiderySize) {
        throw new BadRequestException(
          'Los archivos de bordado no pueden superar los 25 MB',
        );
      }

      return extension;
    }

    throw new BadRequestException('Tipo de archivo no soportado');
  }

  async deleteFile(
    organizationId: string,
    logoId: string,
    versionId: string,
    fileId: string,
  ) {
    const logo = await this.prisma.logo.findFirst({
      where: {
        id: logoId,
        organizationId,
      },
      select: {
        id: true,
      },
    });

    if (!logo) {
      throw new NotFoundException('Logo no encontrado');
    }

    const version = await this.prisma.logoVersion.findFirst({
      where: {
        id: versionId,
        logoId,
      },
      select: {
        id: true,
      },
    });

    if (!version) {
      throw new NotFoundException('Versión del logo no encontrada');
    }

    const file = await this.prisma.logoFile.findFirst({
      where: {
        id: fileId,
        logoVersionId: versionId,
      },
    });

    if (!file) {
      throw new NotFoundException('Archivo no encontrado');
    }

    await this.prisma.logoFile.delete({
      where: {
        id: file.id,
      },
    });

    try {
      await this.storageService.delete(file.storageKey);
    } catch (error) {
      // El archivo queda como huérfano en S3.
      // El proceso de reconciliación podrá eliminarlo.
      console.error(
        `No se pudo eliminar archivo S3: ${file.storageKey}`,
        error,
      );
    }

    return {
      message: 'Archivo eliminado correctamente',
    };
  }

  async getDownloadUrl(
    organizationId: string,
    logoId: string,
    versionId: string,
    fileId: string,
  ) {
    const file = await this.prisma.logoFile.findFirst({
      where: {
        id: fileId,
        logoVersionId: versionId,
        logoVersion: {
          logoId,
          logo: {
            organizationId,
          },
        },
      },
      select: {
        id: true,
        fileName: true,
        mimeType: true,
        storageKey: true,
      },
    });

    if (!file) {
      throw new NotFoundException('Archivo no encontrado');
    }

    const url = await this.storageService.getDownloadUrl(file.storageKey, 300);

    return {
      url,
      fileName: file.fileName,
      mimeType: file.mimeType,
      expiresIn: 300,
    };
  }
}
