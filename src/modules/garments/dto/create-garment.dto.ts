import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateGarmentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}
