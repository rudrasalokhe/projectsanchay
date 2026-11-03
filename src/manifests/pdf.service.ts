import { Injectable, Logger } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';
import { QrService } from './qr.service';

export interface ManifestPdfData {
  manifestNumber: string;
  handoverDate: Date;
  verificationStatus: string;
  wasteCategory: string;
  actualWeightKg: number | string;
  agreedPricePerKg: number | string;
  totalAmount: number | string;
  platformFee: number | string;
  pickupLocation: string;
  city: string;
  state: string;
  collectorName: string;
  collectorOrg?: string;
  recyclerName: string;
  recyclerOrg?: string;
  verificationUrl: string;
  disclaimer: string;
}

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);

  constructor(private readonly qrService: QrService) {}

  async generateManifestPdf(data: ManifestPdfData): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 40,
        });

        const buffers: Buffer[] = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
          const pdfBuffer = Buffer.concat(buffers);
          resolve(pdfBuffer);
        });

        // 1. Header Banner
        doc
          .rect(40, 40, 515, 65)
          .fillAndStroke('#0f766e', '#0f766e'); // Teal-700

        doc
          .fillColor('#ffffff')
          .fontSize(22)
          .font('Helvetica-Bold')
          .text('PROJECT SANCHAY', 55, 50);

        doc
          .fontSize(9)
          .font('Helvetica')
          .fillColor('#ccfbf1') // Teal-100
          .text('DIGITAL E-WASTE HANDOVER MANIFEST (CHAIN OF CUSTODY)', 55, 76);

        // 2. Manifest Number & Status Bar
        doc
          .rect(40, 115, 515, 30)
          .fillAndStroke('#f1f5f9', '#cbd5e1'); // Slate-100 / Slate-300

        doc
          .fillColor('#0f172a')
          .fontSize(10)
          .font('Helvetica-Bold')
          .text(`MANIFEST ID: ${data.manifestNumber}`, 55, 124);

        doc
          .font('Helvetica')
          .fontSize(9)
          .fillColor('#334155')
          .text(
            `DATE: ${new Date(data.handoverDate).toLocaleDateString('en-IN', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}`,
            350,
            124,
          );

        // 3. Parties Involved (Two Columns)
        const colWidth = 245;
        const boxTop = 155;
        const boxHeight = 110;

        // Collector Box
        doc.rect(40, boxTop, colWidth, boxHeight).fillAndStroke('#ffffff', '#e2e8f0');
        doc.rect(40, boxTop, colWidth, 22).fillAndStroke('#e0f2fe', '#bae6fd');
        doc.fillColor('#0369a1').font('Helvetica-Bold').fontSize(10).text('INFORMAL COLLECTOR (SOURCE)', 50, boxTop + 6);

        doc.fillColor('#1e293b').font('Helvetica').fontSize(9);
        doc.text(`Name: ${data.collectorName}`, 50, boxTop + 30);
        doc.text(`Organization: ${data.collectorOrg || 'Independent Aggregator'}`, 50, boxTop + 45);
        doc.text(`Pickup City: ${data.city}, ${data.state}`, 50, boxTop + 60);
        doc.text(`Pickup Address: ${data.pickupLocation}`, 50, boxTop + 75, { width: 225 });

        // Recycler Box
        const recLeft = 310;
        doc.rect(recLeft, boxTop, colWidth, boxHeight).fillAndStroke('#ffffff', '#e2e8f0');
        doc.rect(recLeft, boxTop, colWidth, 22).fillAndStroke('#f0fdf4', '#bbf7d0');
        doc.fillColor('#15803d').font('Helvetica-Bold').fontSize(10).text('AUTHORIZED RECYCLER (DESTINATION)', recLeft + 10, boxTop + 6);

        doc.fillColor('#1e293b').font('Helvetica').fontSize(9);
        doc.text(`Facility: ${data.recyclerOrg || data.recyclerName}`, recLeft + 10, boxTop + 30);
        doc.text(`Representative: ${data.recyclerName}`, recLeft + 10, boxTop + 45);
        doc.text(`Location: ${data.city}, ${data.state}`, recLeft + 10, boxTop + 60);
        doc.text(`Verification: Verified on Sanchay Platform`, recLeft + 10, boxTop + 75);

        // 4. Waste & Commercial Details
        const detailsTop = 280;
        doc.rect(40, detailsTop, 515, 120).fillAndStroke('#ffffff', '#e2e8f0');
        doc.rect(40, detailsTop, 515, 22).fillAndStroke('#f8fafc', '#e2e8f0');
        doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(10).text('VERIFIED HANDOVER SPECIFICATIONS', 55, detailsTop + 6);

        const leftX = 55;
        const rightX = 310;
        const row1 = detailsTop + 35;
        const row2 = detailsTop + 55;
        const row3 = detailsTop + 75;
        const row4 = detailsTop + 95;

        doc.font('Helvetica-Bold').fontSize(9).fillColor('#475569');
        doc.text('Waste Category:', leftX, row1);
        doc.font('Helvetica').fillColor('#0f172a').text(data.wasteCategory, leftX + 110, row1);

        doc.font('Helvetica-Bold').fillColor('#475569').text('Actual Verified Weight:', leftX, row2);
        doc.font('Helvetica-Bold').fillColor('#0f766e').text(`${data.actualWeightKg} kg`, leftX + 110, row2);

        doc.font('Helvetica-Bold').fillColor('#475569').text('Agreed Price / kg:', leftX, row3);
        doc.font('Helvetica').fillColor('#0f172a').text(`INR ${data.agreedPricePerKg}`, leftX + 110, row3);

        doc.font('Helvetica-Bold').fillColor('#475569').text('Handover Status:', leftX, row4);
        doc.font('Helvetica-Bold').fillColor('#16a34a').text('HANDOVER VERIFIED', leftX + 110, row4);

        doc.font('Helvetica-Bold').fillColor('#475569').text('Total Agreed Value:', rightX, row1);
        doc.font('Helvetica-Bold').fillColor('#0f172a').text(`INR ${data.totalAmount}`, rightX + 120, row1);

        doc.font('Helvetica-Bold').fillColor('#475569').text('Platform Facilitation Fee:', rightX, row2);
        doc.font('Helvetica').fillColor('#0f172a').text(`INR ${data.platformFee}`, rightX + 120, row2);

        doc.font('Helvetica-Bold').fillColor('#475569').text('Payment Settlement:', rightX, row3);
        doc.font('Helvetica').fillColor('#64748b').text('Bilateral Direct (Off-chain)', rightX + 120, row3);

        // 5. Verification QR Code & Instructions
        const qrTop = 415;
        const qrBuffer = await this.qrService.generateQrBuffer(data.verificationUrl);

        doc.rect(40, qrTop, 515, 125).fillAndStroke('#fafafa', '#e2e8f0');

        doc.image(qrBuffer, 55, qrTop + 12, { width: 100, height: 100 });

        doc
          .font('Helvetica-Bold')
          .fontSize(11)
          .fillColor('#0f172a')
          .text('DIGITAL CHAIN OF CUSTODY VERIFICATION', 170, qrTop + 18);

        doc
          .font('Helvetica')
          .fontSize(9)
          .fillColor('#334155')
          .text(
            'Scan this QR code with any smartphone or device to verify this manifest against the Project Sanchay registry. The public verification record confirms immutable digital timestamps, actor confirmations, and verified weight.',
            170,
            qrTop + 35,
            { width: 370 },
          );

        doc
          .font('Helvetica-Bold')
          .fontSize(8)
          .fillColor('#2563eb')
          .text(`Verification Link: ${data.verificationUrl}`, 170, qrTop + 85, {
            width: 370,
          });

        // 6. Mandatory Compliance Disclaimer Box
        const discTop = 555;
        doc.rect(40, discTop, 515, 70).fillAndStroke('#fef2f2', '#fecaca'); // Red-50 / Red-200

        doc
          .font('Helvetica-Bold')
          .fontSize(9)
          .fillColor('#b91c1c') // Red-700
          .text('CRITICAL REGULATORY AND COMPLIANCE NOTICE', 55, discTop + 10);

        doc
          .font('Helvetica')
          .fontSize(8.5)
          .fillColor('#7f1d1d') // Red-900
          .text(
            data.disclaimer,
            55,
            discTop + 24,
            { width: 485, lineGap: 3 },
          );

        // 7. Footer
        doc
          .fontSize(8)
          .font('Helvetica')
          .fillColor('#94a3b8')
          .text(
            'Project Sanchay — Digital E-Waste Bridge Connecting Informal Collectors to Authorized Recyclers. All rights reserved.',
            40,
            760,
            { align: 'center', width: 515 },
          );

        doc.end();
      } catch (err) {
        this.logger.error(`Failed to generate PDF: ${err.message}`, err.stack);
        reject(err);
      }
    });
  }
}

