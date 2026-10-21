import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

import { OrderStatus } from '../../../generated/prisma/enums.js';

export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus)
  status!: OrderStatus;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
