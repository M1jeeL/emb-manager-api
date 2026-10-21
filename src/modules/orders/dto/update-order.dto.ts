import { IsDateString, IsDecimal, IsOptional, IsString, MaxLength, Matches } from 'class-validator';

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
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: 'El descuento debe ser no negativo y tener como máximo 2 decimales',
  })
  discount?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}
