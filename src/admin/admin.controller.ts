import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';
import { PaginationDto } from '../common/dto/pagination.dto';

@ApiTags('Admin')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get complete platform-level administrative analytics and breakdown' })
  @ApiResponse({ status: 200, description: 'Administrative platform KPIs' })
  async getDashboard() {
    return this.adminService.getDashboard();
  }

  @Get('users')
  @ApiOperation({ summary: 'List all registered users across all roles' })
  async getUsers(@Query() query: PaginationDto) {
    return this.adminService.getUsers(query);
  }

  @Get('recyclers/pending')
  @ApiOperation({ summary: 'List recycler verification applications awaiting internal review' })
  async getPendingRecyclers() {
    return this.adminService.getPendingRecyclers();
  }

  @Patch('recyclers/:id/approve')
  @ApiOperation({ summary: 'Approve a recycler verification application' })
  async approveRecycler(
    @Param('id') id: string,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.adminService.approveRecycler(id, admin.id);
  }

  @Patch('recyclers/:id/reject')
  @ApiOperation({ summary: 'Reject a recycler verification application' })
  async rejectRecycler(
    @Param('id') id: string,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.adminService.rejectRecycler(id, admin.id);
  }

  @Get('listings')
  @ApiOperation({ summary: 'List all platform electronic waste listings' })
  async getListings(@Query() query: PaginationDto) {
    return this.adminService.getListings(query);
  }

  @Get('transactions')
  @ApiOperation({ summary: 'List all platform transactions across all statuses' })
  async getTransactions(@Query() query: PaginationDto) {
    return this.adminService.getTransactions(query);
  }

  @Get('manifests')
  @ApiOperation({ summary: 'List all generated digital chain-of-custody manifests' })
  async getManifests(@Query() query: PaginationDto) {
    return this.adminService.getManifests(query);
  }

  @Post('brands/:brandId/manifests/:manifestId')
  @ApiOperation({ summary: 'Associate an authorized digital manifest with a specific brand account' })
  @ApiResponse({ status: 201, description: 'Access granted' })
  async associateBrandWithManifest(
    @Param('brandId') brandId: string,
    @Param('manifestId') manifestId: string,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.adminService.associateBrandWithManifest(brandId, manifestId, admin.id);
  }

  @Get('audit-logs')
  @ApiOperation({ summary: 'Review append-only audit trail logs' })
  async getAuditLogs(@Query() query: PaginationDto) {
    return this.adminService.getAuditLogs(query);
  }
}

