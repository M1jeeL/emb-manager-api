import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsPositive,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

import { OrderStatus, PaymentStatus } from '../../../generated/prisma/enums.js';

export class OrderQueryDto {
  @IsOptional()
  @IsInt()
  @IsPositive()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  orderNumber?: number;

  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;

  @IsOptional()
  @IsDateString()
  orderedFrom?: string;

  @IsOptional()
  @IsDateString()
  orderedTo?: string;

  @IsOptional()
  @IsDateString()
  promisedFrom?: string;

  @IsOptional()
  @IsDateString()
  promisedTo?: string;
}
