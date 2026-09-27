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

import { EmployeesService } from './employees.service.js';

import { CreateEmployeeDto } from './dto/create-employee.dto.js';
import { UpdateEmployeeDto } from './dto/update-employee.dto.js';
import { EmployeeQueryDto } from './dto/employee-query.dto.js';
import { ChangeEmployeeStatusDto } from './dto/change-employee-status.dto.js';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { SubscriptionGuard } from '../../common/guards/subscription.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';

import { Roles } from '../../common/decorators/roles.decorators.js';
import { CurrentUser } from '../../common/decorators/current-user.decorators.js';

import type { JwtUser } from '../../common/interfaces/jwt-user.interface.js';
import { UserRole } from '../../generated/prisma/enums.js';

@Controller('employees')
@UseGuards(JwtAuthGuard, SubscriptionGuard, RolesGuard)
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Post()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateEmployeeDto) {
    return this.employeesService.create(user.organizationId, dto);
  }

  @Get()
  findAll(@CurrentUser() user: JwtUser, @Query() query: EmployeeQueryDto) {
    return this.employeesService.findAll(user.organizationId, query);
  }

  @Get(':id')
  findOne(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.employeesService.findOne(user.organizationId, id);
  }

  @Patch(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  update(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    return this.employeesService.update(user.organizationId, id, dto);
  }

  @Patch(':id/status')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  changeStatus(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: ChangeEmployeeStatusDto,
  ) {
    return this.employeesService.changeStatus(user.organizationId, id, dto);
  }
}
