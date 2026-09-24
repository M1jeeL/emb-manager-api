import {
  IsDecimal,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateOrderLogoDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsDecimal(
    { decimal_digits: '0,2' },
    {
      message: 'El precio del logo debe ser un número decimal válido',
    },
  )
  currentPrice!: string;
}
