import { IsEnum, IsOptional, IsString } from 'class-validator';

import { OrderStatus } from '../../../generated/prisma/enums.js';

export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus)
  status!: OrderStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}
