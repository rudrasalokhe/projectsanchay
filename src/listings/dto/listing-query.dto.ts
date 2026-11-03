import { ApiPropertyOptional } from '@nestjs/swagger';
import { ListingStatus, WasteCategory } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class ListingQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: WasteCategory })
  @IsOptional()
  @IsEnum(WasteCategory)
  category?: WasteCategory;

  @ApiPropertyOptional({ enum: ListingStatus })
  @IsOptional()
  @IsEnum(ListingStatus)
  status?: ListingStatus;

  @ApiPropertyOptional({ example: 'Mumbai' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ example: 'Maharashtra' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({ example: 5.0, description: 'Minimum estimated weight in kg' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  minWeight?: number;

  @ApiPropertyOptional({ example: 100.0, description: 'Maximum estimated weight in kg' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  maxWeight?: number;
}

