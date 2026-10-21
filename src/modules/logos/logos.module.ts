import { Module } from '@nestjs/common';
import { LogosService } from './logos.service';
import { LogosController } from './logos.controller';
import { StorageModule } from '../storage/storage.module.js';
import { ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [StorageModule, ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 20 }])],
  controllers: [LogosController],
  providers: [LogosService],
  exports: [LogosService],
})
export class LogosModule {}
