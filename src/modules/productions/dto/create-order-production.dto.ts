import { IsOptional, IsString, IsUUID, Max } from 'class-validator';

export class CreateOrderProductionDto {
  @IsOptional()
  @IsUUID()
  machineId?: string;

  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsString()
  @Max(2000)
  notes?: string;
}
