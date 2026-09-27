import { IsEnum } from 'class-validator';
import { MachineStatus } from '../../../generated/prisma/enums.js';

export class ChangeMachineStatusDto {
  @IsEnum(MachineStatus)
  status!: MachineStatus;
}
