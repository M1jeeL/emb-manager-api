import {
  IsDecimal,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateLogoVersionDto {
  @IsOptional()
  @IsDecimal({ decimal_digits: '0,2' })
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: 'widthMm debe ser un valor válido mayor o igual a 0',
  })
  widthMm?: string;

  @IsOptional()
  @IsDecimal({ decimal_digits: '0,2' })
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: 'heightMm debe ser un valor válido mayor o igual a 0',
  })
  heightMm?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  stitchCount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
