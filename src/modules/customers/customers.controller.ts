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

import { CustomersService } from './customers.service.js';

import { CreateCustomerDto } from './dto/create-customer.dto.js';
import { UpdateCustomerDto } from './dto/update-customer.dto.js';
import { CustomerQueryDto } from './dto/customer-query.dto.js';
import { ChangeCustomerStatusDto } from './dto/change-customer-status.dto.js';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';

import { SubscriptionGuard } from '../../common/guards/subscription.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorators.js';
import { CurrentUser } from '../../common/decorators/current-user.decorators.js';

import type { JwtUser } from '../../common/interfaces/jwt-user.interface.js';
import { UserRole } from '../../generated/prisma/enums.js';

@Controller('customers')
@UseGuards(JwtAuthGuard, SubscriptionGuard, RolesGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateCustomerDto) {
    return this.customersService.create(user.organizationId, dto);
  }

  @Get()
  findAll(@CurrentUser() user: JwtUser, @Query() query: CustomerQueryDto) {
    return this.customersService.findAll(user.organizationId, query);
  }

  @Get(':id')
  findOne(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.customersService.findOne(user.organizationId, id);
  }

  @Patch(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  update(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customersService.update(user.organizationId, id, dto);
  }

  @Patch(':id/status')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  changeStatus(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: ChangeCustomerStatusDto,
  ) {
    return this.customersService.changeStatus(user.organizationId, id, dto);
  }
}
