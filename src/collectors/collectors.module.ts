import { Module } from '@nestjs/common';
import { CollectorsService } from './collectors.service';
import { CollectorsController } from './collectors.controller';

@Module({
  providers: [CollectorsService],
  controllers: [CollectorsController],
  exports: [CollectorsService],
})
export class CollectorsModule {}

