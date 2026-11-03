import {
  Controller,
  Get,
  Param,
  Query,
  Res,
  UseGuards,
  StreamableFile,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { Response } from 'express';
import { ManifestsService } from './manifests.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';

@ApiTags('Manifests')
@Controller()
export class ManifestsController {
  constructor(private readonly manifestsService: ManifestsService) {}

  @Get('manifests')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List digital manifests accessible to the current user' })
  @ApiResponse({ status: 200, description: 'Paginated manifests' })
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationDto,
  ) {
    return this.manifestsService.findAll(user, query);
  }

  @Get('manifests/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get full manifest details by ID' })
  @ApiResponse({ status: 200, description: 'Manifest details' })
  @ApiResponse({ status: 403, description: 'Not authorized to view manifest' })
  @ApiResponse({ status: 404, description: 'Manifest not found' })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.manifestsService.findOne(id, user);
  }

  @Get('manifests/:id/pdf')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Download professionally generated PDF manifest' })
  async downloadPdf(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.manifestsService.getPdfBuffer(id, user);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get('manifests/:id/qr')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Retrieve QR code PNG image for verification' })
  async getQrImage(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const buffer = await this.manifestsService.getQrImage(id, user);
    res.set({
      'Content-Type': 'image/png',
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get('verify/:publicToken')
  @Public()
  @ApiOperation({ summary: 'Public QR verification endpoint with sanitized handover details' })
  @ApiParam({ name: 'publicToken', description: 'Cryptographic public token from QR code' })
  @ApiResponse({ status: 200, description: 'Public verification details' })
  @ApiResponse({ status: 404, description: 'Invalid verification token' })
  async verifyPublic(@Param('publicToken') publicToken: string) {
    return this.manifestsService.verifyPublicToken(publicToken);
  }
}

