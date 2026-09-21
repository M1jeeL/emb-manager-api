import { IsEnum } from 'class-validator';
import { LogoStatus } from '../../../generated/prisma/enums.js';

export class ChangeLogoStatusDto {
  @IsEnum(LogoStatus)
  status!: LogoStatus;
}
