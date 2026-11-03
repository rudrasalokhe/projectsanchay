import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AddEvidenceDto {
  @ApiProperty({
    type: [String],
    example: ['/uploads/evidence/weighing-scale-1.jpg'],
    description: 'URLs of uploaded evidence files',
  })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  evidenceUrls: string[];

  @ApiPropertyOptional({
    example: 'Weighed on calibrated digital platform scale at Mahim facility.',
  })
  @IsOptional()
  @IsString()
  evidenceNotes?: string;
}

