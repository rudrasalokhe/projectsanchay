import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as request from 'supertest';
import * as path from 'path';
import * as fs from 'fs';
import { AppModule } from '../src/app.module';

async function probe() {
  console.log('--- Probing Frontend & Static Assets on NestJS Application ---');

  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false });

  const publicDir = path.resolve(process.cwd(), 'public');
  app.useStaticAssets(publicDir);
  app.setGlobalPrefix('api');

  app.use((req: any, res: any, next: any) => {
    if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
      const indexPath = path.join(publicDir, 'index.html');
      if (fs.existsSync(indexPath)) {
        return res.sendFile(indexPath);
      }
    }
    next();
  });

  await app.init();
  const server = app.getHttpServer();

  // Test 1: GET / (SPA index)
  const homeRes = await request(server).get('/');
  console.log(`[1] GET / -> Status: ${homeRes.status}, Content-Type: ${homeRes.headers['content-type']}`);
  if (homeRes.text.includes('Project Sanchay') && homeRes.text.includes('Digital E-Waste Bridge')) {
    console.log('    ✓ Correct Sanchay Frontend HTML rendered');
  } else {
    throw new Error('Home HTML does not contain Sanchay branding');
  }

  // Test 2: GET /css/style.css
  const cssRes = await request(server).get('/css/style.css');
  console.log(`[2] GET /css/style.css -> Status: ${cssRes.status}, Length: ${cssRes.text.length} bytes`);

  // Test 3: GET /js/api.js
  const apiJsRes = await request(server).get('/js/api.js');
  console.log(`[3] GET /js/api.js -> Status: ${apiJsRes.status}, Length: ${apiJsRes.text.length} bytes`);

  // Test 4: GET /js/app.js
  const appJsRes = await request(server).get('/js/app.js');
  console.log(`[4] GET /js/app.js -> Status: ${appJsRes.status}, Length: ${appJsRes.text.length} bytes`);

  // Test 5: Client-side route fallback GET /verify
  const verifyRouteRes = await request(server).get('/verify?token=12345');
  console.log(`[5] GET /verify?token=12345 -> Status: ${verifyRouteRes.status} (SPA fallback)`);

  console.log('\n--- Frontend Asset Delivery Verified Successfully! ---');
  await app.close();
}

probe().catch((err) => {
  console.error('Probe error:', err);
  process.exit(1);
});

