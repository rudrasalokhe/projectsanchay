export default () => ({
  port: parseInt(process.env.PORT, 10) || 3000,
  database: {
    url: process.env.DATABASE_URL || 'postgresql://postgres@localhost:5433/sanchay_dev?schema=public',
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'sanchay_dev_jwt_access_super_secret_key_2026_production_grade',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'sanchay_dev_jwt_refresh_super_secret_key_2026_production_grade',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  backendPublicUrl: process.env.BACKEND_PUBLIC_URL || 'http://localhost:3000',
  uploadDir: process.env.UPLOAD_DIR || './uploads',
  platformFeePerKg: parseFloat(process.env.PLATFORM_FEE_PER_KG) || 2,
});

