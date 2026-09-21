import { Type } from 'class-transformer';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  ValidateNested,
  IsDateString,
  Min,
  IsNotEmpty,
} from 'class-validator';

export class CreateOrderItemLogoDto {
  @IsString()
  @IsNotEmpty()
  logoId: string;

  @IsString()
  @IsNotEmpty()
  logoName: string;

  @IsNumber()
  @Min(0)
  unitPrice: number;

  @IsOptional()
  @IsString()
  placement?: string;
}

export class CreateOrderItemDto {
  @IsString()
  @IsNotEmpty()
  garmentId: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsNumber()
  @Min(0)
  unitPrice: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemLogoDto)
  logos: CreateOrderItemLogoDto[];
}

export class CreateOrderDto {
  @IsString()
  @IsNotEmpty()
  organizationId: string;

  @IsString()
  @IsNotEmpty()
  customerId: string;

  @IsOptional()
  @IsDateString()
  promisedAt?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];
}
