import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

import { ProductionJobStatus } from '../../../generated/prisma/enums.js';

export class ProductionQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsEnum(ProductionJobStatus)
  status?: ProductionJobStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  orderNumber?: number;

  @IsOptional()
  @IsUUID()
  orderId?: string;

  @IsOptional()
  @IsUUID()
  orderItemId?: string;

  @IsOptional()
  @IsUUID()
  orderItemLogoId?: string;

  @IsOptional()
  @IsUUID()
  machineId?: string;

  @IsOptional()
  @IsUUID()
  employeeId?: string;
}
