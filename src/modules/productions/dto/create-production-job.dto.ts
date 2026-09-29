import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class CreateProductionJobDto {
  @IsUUID()
  orderId!: string;

  @IsUUID()
  orderItemId!: string;

  @IsOptional()
  @IsUUID()
  orderItemLogoId?: string;

  @IsOptional()
  @IsUUID()
  machineId?: string;

  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsInt()
  @Min(1)
  @Max(1_000_000)
  quantity!: number;

  @IsOptional()
  @IsString()
  @Max(2000)
  notes?: string;
}
