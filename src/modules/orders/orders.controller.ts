import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { OrdersService } from './orders.service.js';

import { CreateOrderDto } from './dto/create-order.dto.js';
import { OrderQueryDto } from './dto/order-query.dto.js';
import { UpdateOrderDto } from './dto/update-order.dto.js';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto.js';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';

import { SubscriptionGuard } from '../../common/guards/subscription.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';

import { Roles } from '../../common/decorators/roles.decorators.js';
import { CurrentUser } from '../../common/decorators/current-user.decorators.js';

import type { JwtUser } from '../../common/interfaces/jwt-user.interface.js';

import { UserRole } from '../../generated/prisma/enums.js';

@Controller('orders')
@UseGuards(JwtAuthGuard, SubscriptionGuard, RolesGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateOrderDto) {
    return this.ordersService.create(user.organizationId, user.userId, dto);
  }

  @Get()
  findAll(@CurrentUser() user: JwtUser, @Query() query: OrderQueryDto) {
    return this.ordersService.findAll(user.organizationId, query);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.ordersService.findOne(user.organizationId, id);
  }

  @Patch(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  update(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrderDto,
  ) {
    return this.ordersService.update(user.organizationId, id, dto);
  }

  @Patch(':id/status')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  changeStatus(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.changeStatus(
      user.organizationId,
      user.userId,
      id,
      dto,
    );
  }
}
