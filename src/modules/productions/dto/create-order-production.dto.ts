import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateOrderProductionDto {
  @IsOptional()
  @IsUUID()
  machineId?: string;

  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
