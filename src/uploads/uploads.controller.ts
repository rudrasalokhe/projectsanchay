import {
  Controller,
  Post,
  Get,
  Param,
  Res,
  UploadedFile,
  UseInterceptors,
  ParseFilePipe,
  MaxFileSizeValidator,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { Response } from 'express';
import { UploadsService } from './uploads.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Uploads')
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('photos')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Upload waste photograph' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async uploadPhoto(@UploadedFile() file: Express.Multer.File) {
    const result = await this.uploadsService.saveFile(
      file,
      'photos',
      ['image/jpeg', 'image/png', 'image/webp'],
      5 * 1024 * 1024,
    );
    return {
      message: 'Photo uploaded successfully',
      file: result,
    };
  }

  @Post('documents')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Upload recycler registration document (PDF/Image)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocument(@UploadedFile() file: Express.Multer.File) {
    const result = await this.uploadsService.saveFile(
      file,
      'documents',
      ['application/pdf', 'image/jpeg', 'image/png'],
      10 * 1024 * 1024,
    );
    return {
      message: 'Document uploaded successfully',
      file: result,
    };
  }

  @Post('evidence')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Upload physical handover evidence (Photos / Weighing slips)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async uploadEvidence(@UploadedFile() file: Express.Multer.File) {
    const result = await this.uploadsService.saveFile(
      file,
      'evidence',
      ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
      10 * 1024 * 1024,
    );
    return {
      message: 'Evidence uploaded successfully',
      file: result,
    };
  }

  @Get(':folder/:filename')
  @Public()
  @ApiOperation({ summary: 'Retrieve an uploaded file securely' })
  @ApiParam({ name: 'folder', enum: ['photos', 'documents', 'evidence', 'manifests'] })
  @ApiParam({ name: 'filename', type: String })
  getFile(
    @Param('folder') folder: string,
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    const filePath = this.uploadsService.getFilePath(folder, filename);
    return res.sendFile(filePath);
  }
}

