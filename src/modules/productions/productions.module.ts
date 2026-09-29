import { Module } from '@nestjs/common';
import { ProductionsService } from './productions.service';
import { ProductionsController } from './productions.controller';

@Module({
  controllers: [ProductionsController],
  providers: [ProductionsService],
})
export class ProductionsModule {}
