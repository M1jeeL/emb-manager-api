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

import { ProductionsService } from './productions.service.js';

import { CreateProductionJobDto } from './dto/create-production-job.dto.js';
import { UpdateProductionJobDto } from './dto/update-production-job.dto.js';
import { ChangeProductionStatusDto } from './dto/change-production-status.dto.js';
import { ProductionQueryDto } from './dto/production-query.dto.js';
import { CreateOrderProductionDto } from './dto/create-order-production.dto.js';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { SubscriptionGuard } from '../../common/guards/subscription.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';

import { Roles } from '../../common/decorators/roles.decorators.js';
import { CurrentUser } from '../../common/decorators/current-user.decorators.js';

import type { JwtUser } from '../../common/interfaces/jwt-user.interface.js';
import { UserRole } from '../../generated/prisma/enums.js';

@Controller('production')
@UseGuards(JwtAuthGuard, SubscriptionGuard, RolesGuard)
export class ProductionsController {
  constructor(private readonly productionService: ProductionsService) {}

  // ============================================================
  // CREATE INDIVIDUAL
  // ============================================================

  @Post()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateProductionJobDto) {
    return this.productionService.create(user.organizationId, dto);
  }

  // ============================================================
  // CREATE FULL ORDER PRODUCTION
  // ============================================================

  @Post('orders/:orderId')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  createOrderProduction(
    @CurrentUser() user: JwtUser,
    @Param('orderId') orderId: string,
    @Body() dto: CreateOrderProductionDto,
  ) {
    return this.productionService.createOrderProduction(
      user.organizationId,
      orderId,
      user.userId,
      dto,
    );
  }

  // ============================================================
  // FIND ALL
  // ============================================================

  @Get()
  findAll(@CurrentUser() user: JwtUser, @Query() query: ProductionQueryDto) {
    return this.productionService.findAll(user.organizationId, query);
  }

  // ============================================================
  // AVAILABLE ORDERS
  // ============================================================

  @Get('available-orders')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  findAvailableOrders(@CurrentUser() user: JwtUser) {
    return this.productionService.findAvailableOrders(user.organizationId);
  }

  // ============================================================
  // FIND ONE
  // ============================================================

  @Get(':id')
  findOne(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.productionService.findOne(user.organizationId, id);
  }

  // ============================================================
  // UPDATE
  // ============================================================

  @Patch(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  update(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateProductionJobDto,
  ) {
    return this.productionService.update(user.organizationId, id, dto);
  }

  // ============================================================
  // STATUS
  // ============================================================

  @Patch(':id/status')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  changeStatus(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: ChangeProductionStatusDto,
  ) {
    return this.productionService.changeStatus(user.organizationId, id, dto);
  }
}
