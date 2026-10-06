import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CreateCustomerDto {
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name!: string;

  @ValidateIf(
    (object, value) => value !== null && value !== undefined && value !== '',
  )
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  taxId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  companyName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
