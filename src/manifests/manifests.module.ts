import { Module } from '@nestjs/common';
import { ManifestsService } from './manifests.service';
import { ManifestsController } from './manifests.controller';
import { QrService } from './qr.service';
import { PdfService } from './pdf.service';

@Module({
  providers: [ManifestsService, QrService, PdfService],
  controllers: [ManifestsController],
  exports: [ManifestsService, QrService, PdfService],
})
export class ManifestsModule {}

