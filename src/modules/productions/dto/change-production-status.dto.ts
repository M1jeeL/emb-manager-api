import { IsEnum } from 'class-validator';
import { ProductionJobStatus } from '../../../generated/prisma/enums.js';

export class ChangeProductionStatusDto {
  @IsEnum(ProductionJobStatus)
  status!: ProductionJobStatus;
}
