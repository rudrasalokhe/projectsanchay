import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as path from 'path';
import * as fs from 'fs';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('port') || 3000;
  const frontendUrl = configService.get<string>('frontendUrl') || 'http://localhost:5173';

  // Serve static assets from public directory (Frontend SPA)
  const publicDir = path.resolve(process.cwd(), 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }
  app.useStaticAssets(publicDir);

  // Global HTTP security headers with helmet
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: false, // Allows swagger UI & frontend inline assets to load
    }),
  );

  // Global prefix for all REST routes
  app.setGlobalPrefix('api');

  // CORS configuration
  app.enableCors({
    origin: [frontendUrl, 'http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5173'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  // Global validation pipe with class-validator and class-transformer
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Swagger OpenAPI 3.0 Documentation setup
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Project Sanchay REST API')
    .setDescription(
      'Digital E-Waste Bridge — Connecting India\'s Informal Waste Economy to Formal EPR Markets. ' +
        'This API facilitates traceability, digital handover manifests, verified chains of custody, and brand reporting analytics.',
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Enter your JWT access token',
        in: 'header',
      },
      'bearer',
    )
    .addTag('Auth', 'Authentication, user registration, tokens, and current user profile')
    .addTag('Users', 'User profile updates and password security')
    .addTag('Listings', 'Collector e-waste listing creation and lifecycle')
    .addTag('Marketplace', 'Recycler discovery marketplace with filters')
    .addTag('Transactions', 'Handovers, physical verification, dual confirmations')
    .addTag('Manifests', 'Digital manifest generation, QR verification, and PDF downloads')
    .addTag('Collectors', 'Informal collector metrics and transaction history')
    .addTag('Recyclers', 'Recycler dashboard, profile verification, and records')
    .addTag('Brands', 'Brand sustainability reporting, analytics, and CSV exports')
    .addTag('Admin', 'Platform administration, recycler approvals, audit logs, and associations')
    .addTag('Uploads', 'Photographs, registration documents, and handover evidence storage')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'Sanchay API Documentation',
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  // Client-side SPA routing fallback for direct URLs
  app.use((req: any, res: any, next: any) => {
    if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
      const indexPath = path.join(publicDir, 'index.html');
      if (fs.existsSync(indexPath)) {
        return res.sendFile(indexPath);
      }
    }
    next();
  });

  await app.listen(port);
  logger.log(`Project Sanchay backend successfully running at http://localhost:${port}/api`);
  logger.log(`Swagger documentation available at http://localhost:${port}/api/docs`);
}

bootstrap();

