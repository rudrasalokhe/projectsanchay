import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { MarketplaceService } from './marketplace.service';
import { ListingQueryDto } from '../listings/dto/listing-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('Marketplace')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('marketplace')
export class MarketplaceController {
  constructor(private readonly marketplaceService: MarketplaceService) {}

  @Get('listings')
  @ApiOperation({ summary: 'Browse available waste listings in marketplace with filters' })
  @ApiResponse({ status: 200, description: 'Paginated available listings' })
  async getAvailableListings(@Query() query: ListingQueryDto) {
    return this.marketplaceService.findAvailableListings(query);
  }

  @Get('listings/:id')
  @ApiOperation({ summary: 'View full details of an available waste listing' })
  @ApiResponse({ status: 200, description: 'Marketplace listing details' })
  @ApiResponse({ status: 404, description: 'Listing not found' })
  async getListingDetails(@Param('id') id: string) {
    return this.marketplaceService.findListingDetails(id);
  }
}

