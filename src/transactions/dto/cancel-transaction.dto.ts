import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CancelTransactionDto {
  @ApiProperty({ example: 'Material contaminated with hazardous non-electronic chemicals' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}

