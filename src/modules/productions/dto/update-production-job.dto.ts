import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class UpdateProductionJobDto {
  @IsOptional()
  @IsUUID()
  orderItemLogoId?: string | null;

  @IsOptional()
  @IsUUID()
  machineId?: string | null;

  @IsOptional()
  @IsUUID()
  employeeId?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  quantity?: number;

  @IsOptional()
  @IsString()
  @Max(2000)
  notes?: string | null;
}
