import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { BrandsService } from './brands.service';
import { BrandFilterDto } from './dto/brand-filter.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@ApiTags('Brands')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('brands')
export class BrandsController {
  constructor(private readonly brandsService: BrandsService) {}

  @Get('dashboard')
  @Roles(Role.BRAND, Role.ADMIN)
  @ApiOperation({ summary: 'Get brand sustainability KPIs and breakdown from actual database records' })
  @ApiResponse({ status: 200, description: 'Brand analytics dashboard metrics' })
  async getDashboard(
    @CurrentUser() user: AuthenticatedUser,
    @Query() filter: BrandFilterDto,
  ) {
    return this.brandsService.getDashboard(user.id, filter);
  }

  @Get('analytics/categories')
  @Roles(Role.BRAND, Role.ADMIN)
  @ApiOperation({ summary: 'Get waste volume distribution grouped by category' })
  async getCategories(
    @CurrentUser() user: AuthenticatedUser,
    @Query() filter: BrandFilterDto,
  ) {
    return this.brandsService.getCategoryAnalytics(user.id, filter);
  }

  @Get('analytics/monthly')
  @Roles(Role.BRAND, Role.ADMIN)
  @ApiOperation({ summary: 'Get monthly documented waste volume trends' })
  async getMonthly(
    @CurrentUser() user: AuthenticatedUser,
    @Query() filter: BrandFilterDto,
  ) {
    return this.brandsService.getMonthlyAnalytics(user.id, filter);
  }

  @Get('analytics/locations')
  @Roles(Role.BRAND, Role.ADMIN)
  @ApiOperation({ summary: 'Get waste volume distribution grouped by city and state' })
  async getLocations(
    @CurrentUser() user: AuthenticatedUser,
    @Query() filter: BrandFilterDto,
  ) {
    return this.brandsService.getLocationAnalytics(user.id, filter);
  }

  @Get('manifests')
  @Roles(Role.BRAND, Role.ADMIN)
  @ApiOperation({ summary: 'List verified digital manifests explicitly associated with this brand' })
  async getManifests(
    @CurrentUser() user: AuthenticatedUser,
    @Query() filter: BrandFilterDto,
  ) {
    return this.brandsService.getManifests(user.id, filter);
  }

  @Get('transactions')
  @Roles(Role.BRAND, Role.ADMIN)
  @ApiOperation({ summary: 'List transactions associated with the brand manifests' })
  async getTransactions(
    @CurrentUser() user: AuthenticatedUser,
    @Query() filter: BrandFilterDto,
  ) {
    return this.brandsService.getTransactions(user.id, filter);
  }

  @Get('export/csv')
  @Roles(Role.BRAND, Role.ADMIN)
  @ApiOperation({ summary: 'Export brand verified chain-of-custody handover data as CSV' })
  async exportCsv(
    @CurrentUser() user: AuthenticatedUser,
    @Query() filter: BrandFilterDto,
    @Res() res: Response,
  ) {
    const csvData = await this.brandsService.exportCsv(user.id, filter);
    const filename = `sanchay-brand-report-${Date.now()}.csv`;

    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    res.send(csvData);
  }
}

