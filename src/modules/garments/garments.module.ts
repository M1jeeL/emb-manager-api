import { Module } from '@nestjs/common';
import { GarmentsService } from './garments.service';
import { GarmentsController } from './garments.controller';

@Module({
  controllers: [GarmentsController],
  providers: [GarmentsService],
})
export class GarmentsModule {}
