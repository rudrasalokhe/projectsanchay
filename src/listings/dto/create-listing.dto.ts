import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WasteCategory } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';

export class CreateListingDto {
  @ApiProperty({
    enum: WasteCategory,
    example: WasteCategory.CIRCUIT_BOARDS_PCBS,
    description: 'Category of electronic waste',
  })
  @IsEnum(WasteCategory)
  category: WasteCategory;

  @ApiPropertyOptional({ example: 'Mixed telecom and computer PCBs with gold plating' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 8.5, description: 'Estimated weight in kilograms' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  estimatedWeightKg: number;

  @ApiProperty({ example: 120.0, description: 'Expected asking price per kilogram in INR' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  expectedPricePerKg: number;

  @ApiProperty({ example: 'Mumbai' })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiProperty({ example: 'Maharashtra' })
  @IsString()
  @IsNotEmpty()
  state: string;

  @ApiProperty({ example: 'Gala 12, Dharavi Scrap Compound, 90ft Road' })
  @IsString()
  @IsNotEmpty()
  pickupAddress: string;

  @ApiPropertyOptional({ example: 19.0433 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional({ example: 72.8576 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  longitude?: number;

  @ApiPropertyOptional({
    type: [String],
    example: ['/uploads/photos/pcb-sample-1.jpg'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photoUrls?: string[];
}

