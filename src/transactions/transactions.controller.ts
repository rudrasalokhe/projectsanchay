import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { TransactionsService } from './transactions.service';
import { AcceptListingDto } from './dto/accept-listing.dto';
import { RecordWeightDto } from './dto/record-weight.dto';
import { AddEvidenceDto } from './dto/add-evidence.dto';
import { CancelTransactionDto } from './dto/cancel-transaction.dto';
import { DisputeTransactionDto } from './dto/dispute-transaction.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';
import { PaginationDto } from '../common/dto/pagination.dto';

@ApiTags('Transactions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  @ApiOperation({ summary: 'List transactions for the authenticated user' })
  @ApiResponse({ status: 200, description: 'Paginated transactions list' })
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationDto,
  ) {
    return this.transactionsService.findAll(user, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get full details of a specific transaction' })
  @ApiResponse({ status: 200, description: 'Transaction details' })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.transactionsService.findOne(id, user);
  }

  @Post('accept/:listingId')
  @Roles(Role.RECYCLER, Role.ADMIN)
  @ApiOperation({ summary: 'Accept an available waste listing (Verified Recycler only)' })
  @ApiResponse({ status: 201, description: 'Listing accepted, transaction created in PENDING_HANDOVER' })
  @ApiResponse({ status: 400, description: 'Listing is not available or collector self-acceptance attempt' })
  @ApiResponse({ status: 403, description: 'Recycler not approved' })
  async acceptListing(
    @Param('listingId') listingId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AcceptListingDto,
  ) {
    return this.transactionsService.acceptListing(listingId, user.id, dto);
  }

  @Patch(':id/received-weight')
  @Roles(Role.RECYCLER, Role.ADMIN)
  @ApiOperation({ summary: 'Record actual physical received weight upon weighing' })
  @ApiResponse({ status: 200, description: 'Weight updated, total amount recalculated' })
  async recordReceivedWeight(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RecordWeightDto,
  ) {
    return this.transactionsService.recordReceivedWeight(id, user.id, dto);
  }

  @Post(':id/evidence')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Attach handover proof files (photos, weighing scale slips)' })
  @ApiResponse({ status: 200, description: 'Evidence attached' })
  async addEvidence(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AddEvidenceDto,
  ) {
    return this.transactionsService.addEvidence(id, user.id, dto);
  }

  @Post(':id/collector-confirm')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.COLLECTOR, Role.ADMIN)
  @ApiOperation({ summary: 'Collector confirms that waste was physically handed over' })
  @ApiResponse({ status: 200, description: 'Collector confirmed; generates manifest if recycler also confirmed' })
  async confirmCollector(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.transactionsService.confirmCollector(id, user.id);
  }

  @Post(':id/recycler-confirm')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.RECYCLER, Role.ADMIN)
  @ApiOperation({ summary: 'Recycler confirms that waste was physically received at facility' })
  @ApiResponse({ status: 200, description: 'Recycler confirmed; generates manifest if collector also confirmed' })
  async confirmRecycler(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.transactionsService.confirmRecycler(id, user.id);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel an unverified handover transaction' })
  @ApiResponse({ status: 200, description: 'Transaction cancelled, listing released' })
  async cancel(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CancelTransactionDto,
  ) {
    return this.transactionsService.cancel(id, user.id, dto);
  }

  @Post(':id/dispute')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Flag transaction for administrative dispute resolution' })
  @ApiResponse({ status: 200, description: 'Transaction marked DISPUTED' })
  async dispute(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: DisputeTransactionDto,
  ) {
    return this.transactionsService.dispute(id, user.id, dto);
  }
}
