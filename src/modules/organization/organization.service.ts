import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service.js';
import { UpdateOrganizationDto } from './dto/update-organization.dto.js';

@Injectable()
export class OrganizationService {
  constructor(private readonly prisma: PrismaService) {}

  async getCurrent(organizationId: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, name: true, slug: true, taxId: true, email: true, phone: true, address: true, city: true, country: true },
    });
    if (!organization) throw new NotFoundException('Taller no encontrado');
    return organization;
  }

  async updateCurrent(organizationId: string, dto: UpdateOrganizationDto) {
    const exists = await this.prisma.organization.findUnique({
      where: { id: organizationId }, select: { id: true },
    });
    if (!exists) throw new NotFoundException('Taller no encontrado');
    if (dto.name !== undefined && !dto.name.trim()) {
      throw new BadRequestException('El nombre del taller no puede quedar vacío');
    }
    const data = Object.fromEntries(Object.entries(dto).map(([key, value]) => {
      if (typeof value !== 'string') return [key, value];
      const trimmed = value.trim();
      if (key === 'name') return [key, trimmed];
      if (key === 'country') return [key, trimmed.toUpperCase() || 'CL'];
      return [key, trimmed || null];
    }));
    return this.prisma.organization.update({
      where: { id: organizationId },
      data,
      select: { id: true, name: true, slug: true, taxId: true, email: true, phone: true, address: true, city: true, country: true },
    });
  }
}
