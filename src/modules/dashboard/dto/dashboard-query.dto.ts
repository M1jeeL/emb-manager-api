import { IsDateString, IsOptional } from 'class-validator';

export class DashboardQueryDto {
  /**
   * Fecha inicial inclusiva.
   *
   * Formato esperado:
   * YYYY-MM-DD
   */
  @IsOptional()
  @IsDateString()
  from?: string;

  /**
   * Fecha final exclusiva.
   *
   * Formato esperado:
   * YYYY-MM-DD
   */
  @IsOptional()
  @IsDateString()
  to?: string;
}
