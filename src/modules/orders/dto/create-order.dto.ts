import {
  IsArray,
  IsDateString,
  IsDecimal,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

import { Type } from 'class-transformer';

import { OrderStatus } from '../../../generated/prisma/enums.js';

import { CreateCustomerDto } from '../../customers/dto/create-customer.dto.js';
import { CreateOrderItemDto } from './create-order-item.dto.js';

export class CreateOrderDto {
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateCustomerDto)
  customer?: CreateCustomerDto;

  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @IsOptional()
  @IsDateString()
  promisedAt?: string;

  @IsOptional()
  @IsDecimal(
    { decimal_digits: '0,2' },
    {
      message: 'El descuento debe ser un número decimal válido',
    },
  )
  discount?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];
}
