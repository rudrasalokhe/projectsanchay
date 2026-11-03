import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);
  private readonly uploadDir: string;

  constructor(private readonly configService: ConfigService) {
    this.uploadDir = path.resolve(
      this.configService.get<string>('uploadDir') || './uploads',
    );
    this.ensureDirectoryExists(this.uploadDir);
    this.ensureDirectoryExists(path.join(this.uploadDir, 'photos'));
    this.ensureDirectoryExists(path.join(this.uploadDir, 'documents'));
    this.ensureDirectoryExists(path.join(this.uploadDir, 'evidence'));
    this.ensureDirectoryExists(path.join(this.uploadDir, 'manifests'));
  }

  private ensureDirectoryExists(dir: string) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Validate file buffer signatures (magic numbers) to prevent file extension spoofing
   */
  validateFileSignature(buffer: Buffer, mimeType: string): boolean {
    if (!buffer || buffer.length < 4) return false;

    // JPEG: FF D8 FF
    if (
      (mimeType === 'image/jpeg' || mimeType === 'image/jpg') &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff
    ) {
      return true;
    }

    // PNG: 89 50 4E 47
    if (
      mimeType === 'image/png' &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    ) {
      return true;
    }

    // PDF: 25 50 44 46 (%PDF)
    if (
      mimeType === 'application/pdf' &&
      buffer[0] === 0x25 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x44 &&
      buffer[3] === 0x46
    ) {
      return true;
    }

    // WEBP: RIFF...WEBP
    if (
      mimeType === 'image/webp' &&
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP'
    ) {
      return true;
    }

    return false;
  }

  async saveFile(
    file: Express.Multer.File,
    subFolder: 'photos' | 'documents' | 'evidence' | 'manifests',
    allowedMimes: string[] = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    maxSizeBytes: number = 10 * 1024 * 1024, // 10MB
  ): Promise<{ filename: string; relativePath: string; mimeType: string; size: number }> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    if (!allowedMimes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type: ${file.mimetype}. Allowed types: ${allowedMimes.join(', ')}`,
      );
    }

    if (file.size > maxSizeBytes) {
      throw new BadRequestException(
        `File too large: ${file.size} bytes. Maximum allowed: ${maxSizeBytes} bytes`,
      );
    }

    if (!this.validateFileSignature(file.buffer, file.mimetype)) {
      throw new BadRequestException('File contents do not match specified MIME type signature');
    }

    // Generate cryptographically random safe filename
    const ext = path.extname(file.originalname).toLowerCase() || this.getExtensionFromMime(file.mimetype);
    const randomHex = crypto.randomBytes(16).toString('hex');
    const safeFilename = `${Date.now()}-${randomHex}${ext}`;

    const targetDir = path.join(this.uploadDir, subFolder);
    this.ensureDirectoryExists(targetDir);

    const targetPath = path.join(targetDir, safeFilename);

    // Prevent path traversal
    if (!targetPath.startsWith(this.uploadDir)) {
      throw new BadRequestException('Path traversal detected');
    }

    await fs.promises.writeFile(targetPath, file.buffer);

    const relativePath = `/uploads/${subFolder}/${safeFilename}`;

    return {
      filename: safeFilename,
      relativePath,
      mimeType: file.mimetype,
      size: file.size,
    };
  }

  getFilePath(subFolder: string, filename: string): string {
    // Sanitize filename against directory traversal
    const safeFilename = path.basename(filename);
    const safeSubFolder = path.basename(subFolder);
    const fullPath = path.join(this.uploadDir, safeSubFolder, safeFilename);

    if (!fullPath.startsWith(this.uploadDir)) {
      throw new BadRequestException('Invalid file path traversal');
    }

    if (!fs.existsSync(fullPath)) {
      throw new NotFoundException('Requested file not found');
    }

    return fullPath;
  }

  private getExtensionFromMime(mime: string): string {
    switch (mime) {
      case 'image/jpeg':
      case 'image/jpg':
        return '.jpg';
      case 'image/png':
        return '.png';
      case 'image/webp':
        return '.webp';
      case 'application/pdf':
        return '.pdf';
      default:
        return '.bin';
    }
  }
}

