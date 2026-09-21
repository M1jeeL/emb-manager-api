import { IsBoolean } from 'class-validator';

export class UpdateGarmentStatusDto {
  @IsBoolean()
  active!: boolean;
}
