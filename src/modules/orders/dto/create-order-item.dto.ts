import {
  IsArray,
  IsDecimal,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

import { Type } from 'class-transformer';

import { CreateOrderItemLogoDto } from './create-order-item-logo.dto.js';

export class CreateOrderItemDto {
  @IsUUID()
  garmentId!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsDecimal(
    { decimal_digits: '0,2' },
    {
      message: 'El precio unitario debe ser un número decimal válido',
    },
  )
  unitPrice!: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemLogoDto)
  logos?: CreateOrderItemLogoDto[];

  @IsOptional()
  @IsString()
  notes?: string;
}
