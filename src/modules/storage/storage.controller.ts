import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  UseGuards,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';

import { StorageService } from './storage.service';
import { FileInterceptor } from '@nestjs/platform-express';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { SubscriptionGuard } from '../../common/guards/subscription.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { ThrottlerGuard } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorators.js';
import type { JwtUser } from '../../common/interfaces/jwt-user.interface.js';
import { Roles } from '../../common/decorators/roles.decorators.js';
import { UserRole } from '../../generated/prisma/enums.js';
import { randomUUID } from 'node:crypto';

@Controller('storage')
@UseGuards(ThrottlerGuard, JwtAuthGuard, SubscriptionGuard, RolesGuard)
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  @UseInterceptors(FileInterceptor('file'))
  uploadFile(
    @CurrentUser() user: JwtUser,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 25 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: 'image/*' }),
        ],
      }),
    )
    file: {
      originalname: string;
      mimetype: string;
      buffer: Buffer<ArrayBufferLike>;
    },
  ) {
    const safeName = file.originalname.split(/[\\/]/).pop()?.replace(/[^a-zA-Z0-9._-]/g, '_') || 'upload';
    const key = `organizations/${user.organizationId}/uploads/${randomUUID()}-${safeName}`;
    return this.storageService.upload(key, file.buffer, file.mimetype).then((uploaded) => ({ key: uploaded.key }));
  }
}
