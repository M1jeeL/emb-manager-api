import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  create(@Body() createOrderDto: CreateOrderDto) {
    return this.ordersService.create(createOrderDto);
  }

  @Get()
  findAll(@Query('organizationId') organizationId: string) {
    return this.ordersService.findAll(organizationId);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @Query('organizationId') organizationId: string,
  ) {
    return this.ordersService.findOne(id, organizationId);
  }
}
