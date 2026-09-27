import { IsEnum } from 'class-validator';

import { EmployeeStatus } from '../../../generated/prisma/enums.js';

export class ChangeEmployeeStatusDto {
  @IsEnum(EmployeeStatus)
  status!: EmployeeStatus;
}
