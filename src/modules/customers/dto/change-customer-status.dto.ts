import { IsEnum } from 'class-validator';

import { CustomerStatus } from '../../../generated/prisma/enums.js';

export class ChangeCustomerStatusDto {
  @IsEnum(CustomerStatus)
  status: CustomerStatus;
}
