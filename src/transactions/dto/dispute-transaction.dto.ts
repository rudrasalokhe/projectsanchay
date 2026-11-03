import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class DisputeTransactionDto {
  @ApiProperty({ example: 'Discrepancy in recorded scale reading vs verbal agreement' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}

