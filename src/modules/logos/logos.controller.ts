import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  MaxFileSizeValidator,
  ParseFilePipe,
  Delete,
} from '@nestjs/common';

import { LogosService } from './logos.service.js';

import { CreateLogoDto } from './dto/create-logo.dto.js';
import { UpdateLogoDto } from './dto/update-logo.dto.js';
import { ChangeLogoStatusDto } from './dto/change-logo-status.dto.js';
import { LogoQueryDto } from './dto/logo-query.dto.js';
import { CreateLogoVersionDto } from './dto/create-logo-version.dto.js';
import { CreateLogoFileDto } from './dto/create-logo-file.dto.js';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { SubscriptionGuard } from '../../common/guards/subscription.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';

import { Roles } from '../../common/decorators/roles.decorators.js';
import { CurrentUser } from '../../common/decorators/current-user.decorators.js';

import type { JwtUser } from '../../common/interfaces/jwt-user.interface.js';
import { UserRole } from '../../generated/prisma/enums.js';
import { FileInterceptor } from '@nestjs/platform-express';
import { ThrottlerGuard } from '@nestjs/throttler';
import { UpdateLogoVersionDto } from './dto/update-logo-version.dto.js';

@Controller('logos')
@UseGuards(JwtAuthGuard, SubscriptionGuard, RolesGuard)
export class LogosController {
  constructor(private readonly logosService: LogosService) {}

  @Post()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateLogoDto) {
    return this.logosService.create(user.organizationId, dto);
  }

  @Get()
  findAll(@CurrentUser() user: JwtUser, @Query() query: LogoQueryDto) {
    return this.logosService.findAll(user.organizationId, query);
  }

  @Get(':id')
  findOne(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.logosService.findOne(user.organizationId, id);
  }

  @Patch(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  update(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateLogoDto,
  ) {
    return this.logosService.update(user.organizationId, id, dto);
  }

  @Patch(':id/status')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  changeStatus(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: ChangeLogoStatusDto,
  ) {
    return this.logosService.changeStatus(user.organizationId, id, dto);
  }

  @Post(':id/versions')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  createVersion(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: CreateLogoVersionDto,
  ) {
    return this.logosService.createVersion(user.organizationId, id, dto);
  }

  @UseGuards(ThrottlerGuard)
  @Post(':id/versions/:versionId/files')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  @UseInterceptors(FileInterceptor('file'))
  createFile(
    @CurrentUser() user: JwtUser,

    @Param('id')
    id: string,

    @Param('versionId')
    versionId: string,

    @Body()
    dto: CreateLogoFileDto,

    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({
            maxSize: 25 * 1024 * 1024,
          }),
        ],
      }),
    )
    file: {
      originalname: string;
      mimetype: string;
      size: number;
      buffer: Buffer;
    },
  ) {
    return this.logosService.createFile(
      user.organizationId,
      id,
      versionId,
      dto,
      file,
    );
  }

  @UseGuards(ThrottlerGuard)
  @Delete(':id/versions/:versionId/files/:fileId')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  deleteFile(
    @CurrentUser() user: JwtUser,
    @Param('id') logoId: string,
    @Param('versionId') versionId: string,
    @Param('fileId') fileId: string,
  ) {
    return this.logosService.deleteFile(
      user.organizationId,
      logoId,
      versionId,
      fileId,
    );
  }

  @Get(':id/versions/:versionId/files/:fileId/download')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER, UserRole.EMPLOYEE)
  async downloadFile(
    @CurrentUser() user: JwtUser,
    @Param('id') logoId: string,
    @Param('versionId') versionId: string,
    @Param('fileId') fileId: string,
  ) {
    return this.logosService.getDownloadUrl(
      user.organizationId,
      logoId,
      versionId,
      fileId,
    );
  }

  @Patch(':id/versions/:versionId')
  updateVersion(
    @CurrentUser() user: JwtUser,
    @Param('id') logoId: string,
    @Param('versionId') versionId: string,
    @Body() dto: UpdateLogoVersionDto,
  ) {
    return this.logosService.updateVersion(
      user.organizationId,
      logoId,
      versionId,
      dto,
    );
  }
}
