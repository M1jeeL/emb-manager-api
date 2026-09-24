import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

import { Type } from 'class-transformer';

import { CreateOrderLogoDto } from './create-order-logo.dto.js';

export class CreateOrderItemLogoDto {
  @IsOptional()
  @IsUUID()
  @ValidateIf((object) => !object.logo)
  logoId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateOrderLogoDto)
  @ValidateIf((object) => !object.logoId)
  logo?: CreateOrderLogoDto;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
