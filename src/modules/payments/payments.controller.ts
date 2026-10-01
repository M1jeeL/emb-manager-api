import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { PaymentsService } from './payments.service.js';

import { CreatePaymentDto } from './dto/create-payment.dto.js';
import { PaymentQueryDto } from './dto/payment-query.dto.js';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';

import { SubscriptionGuard } from '../../common/guards/subscription.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';

import { Roles } from '../../common/decorators/roles.decorators.js';
import { CurrentUser } from '../../common/decorators/current-user.decorators.js';

import type { JwtUser } from '../../common/interfaces/jwt-user.interface.js';

import { UserRole } from '../../generated/prisma/enums.js';

@Controller('payments')
@UseGuards(JwtAuthGuard, SubscriptionGuard, RolesGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  // ============================================================
  // CREATE
  // ============================================================

  @Post()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  create(@CurrentUser() user: JwtUser, @Body() dto: CreatePaymentDto) {
    return this.paymentsService.create(user.organizationId, dto);
  }

  // ============================================================
  // FIND ALL
  // ============================================================

  @Get()
  findAll(@CurrentUser() user: JwtUser, @Query() query: PaymentQueryDto) {
    return this.paymentsService.findAll(user.organizationId, query);
  }

  // ============================================================
  // FIND ONE
  // ============================================================

  @Get(':id')
  findOne(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.paymentsService.findOne(user.organizationId, id);
  }
}
