import {
  IsDateString,
  IsDecimal,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Matches,
} from 'class-validator';

import { PaymentMethod } from '../../../generated/prisma/enums.js';

import { IsEnum } from 'class-validator';

export class CreatePaymentDto {
  @IsUUID()
  orderId!: string;

  /**
   * Se recibe como string para preservar precisión monetaria.
   * Prisma.Decimal será utilizado en el backend.
   */
  @IsDecimal(
    {
      decimal_digits: '0,2',
      force_decimal: false,
    },
    {
      message: 'El monto debe ser un número válido con máximo 2 decimales',
    },
  )
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: 'El monto debe ser positivo y tener como máximo 2 decimales',
  })
  amount!: string;

  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @IsOptional()
  @IsDateString()
  paidAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  reference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
