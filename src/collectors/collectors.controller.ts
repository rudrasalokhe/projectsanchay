import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CollectorsService } from './collectors.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@ApiTags('Collectors')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('collectors')
export class CollectorsController {
  constructor(private readonly collectorsService: CollectorsService) {}

  @Get('dashboard')
  @Roles(Role.COLLECTOR, Role.ADMIN)
  @ApiOperation({ summary: 'Get collector dashboard KPI metrics and recent transactions' })
  @ApiResponse({ status: 200, description: 'Collector dashboard metrics' })
  async getDashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.collectorsService.getDashboard(user.id);
  }

  @Get('transactions')
  @Roles(Role.COLLECTOR, Role.ADMIN)
  @ApiOperation({ summary: 'Get collector completed transactions and earnings' })
  @ApiResponse({ status: 200, description: 'List of collector transactions' })
  async getTransactions(@CurrentUser() user: AuthenticatedUser) {
    return this.collectorsService.getTransactions(user.id);
  }
}

