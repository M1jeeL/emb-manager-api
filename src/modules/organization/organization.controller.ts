import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { OrganizationService } from './organization.service.js';
import { UpdateOrganizationDto } from './dto/update-organization.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { SubscriptionGuard } from '../../common/guards/subscription.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorators.js';
import { CurrentUser } from '../../common/decorators/current-user.decorators.js';
import type { JwtUser } from '../../common/interfaces/jwt-user.interface.js';
import { UserRole } from '../../generated/prisma/enums.js';

@Controller('organization')
@UseGuards(JwtAuthGuard, SubscriptionGuard, RolesGuard)
@Roles(UserRole.OWNER, UserRole.ADMIN)
export class OrganizationController {
  constructor(private readonly service: OrganizationService) {}

  @Get('current')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  getCurrent(@CurrentUser() user: JwtUser) {
    return this.service.getCurrent(user.organizationId);
  }

  @Patch('current')
  updateCurrent(@CurrentUser() user: JwtUser, @Body() dto: UpdateOrganizationDto) {
    return this.service.updateCurrent(user.organizationId, dto);
  }
}
