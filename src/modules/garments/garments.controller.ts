import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { GarmentsService } from './garments.service.js';

import { CreateGarmentDto } from './dto/create-garment.dto.js';
import { UpdateGarmentDto } from './dto/update-garment.dto.js';
import { UpdateGarmentStatusDto } from './dto/update-garment-status.dto.js';
import { GarmentQueryDto } from './dto/garment-query.dto.js';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { SubscriptionGuard } from '../../common/guards/subscription.guard.js';

import { Roles } from '../../common/decorators/roles.decorators.js';
import { CurrentUser } from '../../common/decorators/current-user.decorators.js';

import { UserRole } from '../../generated/prisma/enums.js';
import type { JwtUser } from '../../common/interfaces/jwt-user.interface.js';

@Controller('garments')
@UseGuards(JwtAuthGuard, SubscriptionGuard, RolesGuard)
export class GarmentsController {
  constructor(private readonly garmentsService: GarmentsService) {}

  @Post()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateGarmentDto) {
    return this.garmentsService.create(user.organizationId, dto);
  }

  @Get()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER, UserRole.EMPLOYEE)
  findAll(@CurrentUser() user: JwtUser, @Query() query: GarmentQueryDto) {
    return this.garmentsService.findAll(user.organizationId, query);
  }

  @Get(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER, UserRole.EMPLOYEE)
  findOne(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.garmentsService.findOne(user.organizationId, id);
  }

  @Patch(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  update(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateGarmentDto,
  ) {
    return this.garmentsService.update(user.organizationId, id, dto);
  }

  @Patch(':id/status')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  updateStatus(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateGarmentStatusDto,
  ) {
    return this.garmentsService.updateStatus(user.organizationId, id, dto);
  }
}
