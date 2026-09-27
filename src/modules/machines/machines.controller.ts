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

import { MachinesService } from './machines.service.js';

import { CreateMachineDto } from './dto/create-machine.dto.js';
import { UpdateMachineDto } from './dto/update-machine.dto.js';
import { MachineQueryDto } from './dto/machine-query.dto.js';
import { ChangeMachineStatusDto } from './dto/change-machine-status.dto.js';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { SubscriptionGuard } from '../../common/guards/subscription.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';

import { Roles } from '../../common/decorators/roles.decorators.js';
import { CurrentUser } from '../../common/decorators/current-user.decorators.js';

import type { JwtUser } from '../../common/interfaces/jwt-user.interface.js';
import { UserRole } from '../../generated/prisma/enums.js';

@Controller('machines')
@UseGuards(JwtAuthGuard, SubscriptionGuard, RolesGuard)
export class MachinesController {
  constructor(private readonly machinesService: MachinesService) {}

  @Post()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateMachineDto) {
    return this.machinesService.create(user.organizationId, dto);
  }

  @Get()
  findAll(@CurrentUser() user: JwtUser, @Query() query: MachineQueryDto) {
    return this.machinesService.findAll(user.organizationId, query);
  }

  @Get(':id')
  findOne(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.machinesService.findOne(user.organizationId, id);
  }

  @Patch(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  update(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateMachineDto,
  ) {
    return this.machinesService.update(user.organizationId, id, dto);
  }

  @Patch(':id/status')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  changeStatus(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: ChangeMachineStatusDto,
  ) {
    return this.machinesService.changeStatus(user.organizationId, id, dto);
  }
}
