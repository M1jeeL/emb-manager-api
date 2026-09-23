import { IsDateString, IsDecimal, IsOptional, IsString } from 'class-validator';

export class UpdateOrderDto {
  @IsOptional()
  @IsDateString()
  promisedAt?: string | null;

  @IsOptional()
  @IsDecimal(
    { decimal_digits: '0,2' },
    {
      message: 'El descuento debe ser un número decimal válido',
    },
  )
  discount?: string;

  @IsOptional()
  @IsString()
  notes?: string | null;
}
