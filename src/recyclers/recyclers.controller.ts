import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { RecyclersService } from './recyclers.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@ApiTags('Recyclers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('recyclers')
export class RecyclersController {
  constructor(private readonly recyclersService: RecyclersService) {}

  @Get('dashboard')
  @Roles(Role.RECYCLER, Role.ADMIN)
  @ApiOperation({ summary: 'Get recycler dashboard KPIs and recent handovers' })
  @ApiResponse({ status: 200, description: 'Recycler dashboard metrics' })
  async getDashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.recyclersService.getDashboard(user.id);
  }

  @Get('profile')
  @Roles(Role.RECYCLER, Role.ADMIN)
  @ApiOperation({ summary: 'Get recycler verification profile and registration status' })
  @ApiResponse({ status: 200, description: 'Recycler profile' })
  async getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.recyclersService.getProfile(user.id);
  }

  @Get('transactions')
  @Roles(Role.RECYCLER, Role.ADMIN)
  @ApiOperation({ summary: 'Get recycler accepted transactions and handovers' })
  @ApiResponse({ status: 200, description: 'List of recycler transactions' })
  async getTransactions(@CurrentUser() user: AuthenticatedUser) {
    return this.recyclersService.getTransactions(user.id);
  }
}

