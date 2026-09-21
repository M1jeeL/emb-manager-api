import {
  IsDecimal,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateLogoDto {
  @IsString()
  @MaxLength(150)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsDecimal({ decimal_digits: '0,2' })
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message:
      'currentPrice debe ser un valor monetario válido mayor o igual a 0',
  })
  currentPrice?: string;
}
