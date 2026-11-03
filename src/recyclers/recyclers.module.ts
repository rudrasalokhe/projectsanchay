import { Module } from '@nestjs/common';
import { RecyclersService } from './recyclers.service';
import { RecyclersController } from './recyclers.controller';

@Module({
  providers: [RecyclersService],
  controllers: [RecyclersController],
  exports: [RecyclersService],
})
export class RecyclersModule {}

