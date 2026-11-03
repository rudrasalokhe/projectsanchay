import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ListingsService } from './listings.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { ListingQueryDto } from './dto/listing-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@ApiTags('Listings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('listings')
export class ListingsController {
  constructor(private readonly listingsService: ListingsService) {}

  @Post()
  @Roles(Role.COLLECTOR, Role.ADMIN)
  @ApiOperation({ summary: 'Create a new waste listing (Collector or Admin)' })
  @ApiResponse({ status: 201, description: 'Listing created successfully' })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateListingDto,
  ) {
    return this.listingsService.create(user.id, dto);
  }

  @Get('my')
  @Roles(Role.COLLECTOR, Role.ADMIN)
  @ApiOperation({ summary: 'View all listings created by the authenticated collector' })
  @ApiResponse({ status: 200, description: 'List of user listings' })
  async findMy(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListingQueryDto,
  ) {
    return this.listingsService.findMyListings(user.id, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get details of a specific waste listing' })
  @ApiResponse({ status: 200, description: 'Listing details' })
  @ApiResponse({ status: 404, description: 'Listing not found' })
  async findOne(@Param('id') id: string) {
    return this.listingsService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.COLLECTOR, Role.ADMIN)
  @ApiOperation({ summary: 'Update an available waste listing' })
  @ApiResponse({ status: 200, description: 'Listing updated successfully' })
  @ApiResponse({ status: 400, description: 'Cannot update non-available listing' })
  async update(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateListingDto,
  ) {
    return this.listingsService.update(id, user.id, dto);
  }

  @Delete(':id')
  @Roles(Role.COLLECTOR, Role.ADMIN)
  @ApiOperation({ summary: 'Cancel/soft-delete an available waste listing' })
  @ApiResponse({ status: 200, description: 'Listing cancelled' })
  async cancel(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.listingsService.cancel(id, user.id);
  }
}

