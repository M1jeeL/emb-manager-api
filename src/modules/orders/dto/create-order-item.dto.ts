import {
  IsArray,
  IsInt,
  MaxLength,
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
  @MaxLength(255)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  size?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  color?: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemLogoDto)
  logos?: CreateOrderItemLogoDto[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
