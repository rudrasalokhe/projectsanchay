import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsPositive } from 'class-validator';

export class AcceptListingDto {
  @ApiPropertyOptional({
    example: 105.0,
    description: 'Agreed price per kg in INR. Defaults to listing expected price if omitted.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  agreedPricePerKg?: number;
}

