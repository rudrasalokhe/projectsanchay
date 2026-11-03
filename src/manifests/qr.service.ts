import { Injectable, Logger } from '@nestjs/common';
import * as QRCode from 'qrcode';

@Injectable()
export class QrService {
  private readonly logger = new Logger(QrService.name);

  /**
   * Generates a Data URL (base64 PNG) of the QR code
   */
  async generateQrDataUrl(text: string): Promise<string> {
    try {
      return await QRCode.toDataURL(text, {
        errorCorrectionLevel: 'M',
        margin: 2,
        scale: 6,
        color: {
          dark: '#0f172a', // Slate 900
          light: '#ffffff',
        },
      });
    } catch (error) {
      this.logger.error(`Error generating QR data URL: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generates a PNG Buffer of the QR code
   */
  async generateQrBuffer(text: string): Promise<Buffer> {
    try {
      return await QRCode.toBuffer(text, {
        errorCorrectionLevel: 'M',
        margin: 2,
        scale: 6,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      });
    } catch (error) {
      this.logger.error(`Error generating QR buffer: ${error.message}`);
      throw error;
    }
  }
}

