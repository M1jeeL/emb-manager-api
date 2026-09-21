import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import { Transform } from 'class-transformer';

import { LogoFileType } from '../../../generated/prisma/enums.js';

export class CreateLogoFileDto {
  @IsEnum(LogoFileType)
  type!: LogoFileType;

  @IsString()
  @MaxLength(20)
  format!: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined) {
      return undefined;
    }

    if (value === true || value === 'true') {
      return true;
    }

    if (value === false || value === 'false') {
      return false;
    }

    return value as unknown;
  })
  @IsBoolean()
  isPrimary?: boolean;
}
