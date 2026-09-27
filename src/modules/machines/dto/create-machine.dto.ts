import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { MachineType } from '../../../generated/prisma/enums.js';

export class CreateMachineDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsEnum(MachineType)
  type?: MachineType;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  serialNumber?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  needleCount?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  headCount?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
