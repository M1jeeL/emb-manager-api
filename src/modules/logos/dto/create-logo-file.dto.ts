import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { LogoFileType } from '../../../generated/prisma/enums.js';

export class CreateLogoFileDto {
  @IsEnum(LogoFileType)
  type!: LogoFileType;

  @IsString()
  @MaxLength(20)
  format!: string;

  @IsString()
  @MaxLength(255)
  fileName!: string;

  @IsString()
  @MaxLength(1000)
  storageKey!: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  mimeType?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  fileSize?: number;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
