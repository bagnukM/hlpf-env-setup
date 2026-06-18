import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrderQueryDto } from './dto/order-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/enums/role.enum';

@ApiTags('Orders')
@ApiBearerAuth()
@Controller('api/orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Створити замовлення' })
  @ApiResponse({ status: 201, description: 'Замовлення створено' })
  @ApiResponse({ status: 400, description: 'Недостатній stock / помилка валідації' })
  @ApiResponse({ status: 401, description: 'Не авторизовано' })
  create(@Body() dto: CreateOrderDto, @CurrentUser('sub') userId: number) {
    return this.ordersService.create(dto, userId);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Мої замовлення (user) / Всі (admin)' })
  @ApiResponse({ status: 200, description: 'Список замовлень з meta' })
  findAll(
    @Query() query: OrderQueryDto,
    @CurrentUser('sub') userId: number,
    @CurrentUser('role') role: Role,
  ) {
    return this.ordersService.findAll(query, userId, role);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Одне замовлення (ownership check)' })
  @ApiResponse({ status: 200, description: 'Замовлення знайдено' })
  @ApiResponse({ status: 403, description: 'Чуже замовлення' })
  @ApiResponse({ status: 404, description: 'Замовлення не знайдено' })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('sub') userId: number,
    @CurrentUser('role') role: Role,
  ) {
    return this.ordersService.findOne(id, userId, role);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Змінити статус замовлення (admin)' })
  @ApiResponse({ status: 200, description: 'Статус оновлено' })
  @ApiResponse({ status: 400, description: 'Недозволений перехід статусу' })
  @ApiResponse({ status: 403, description: 'Недостатньо прав' })
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateStatus(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Видалити замовлення (admin)' })
  @ApiResponse({ status: 200, description: 'Замовлення видалено' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.ordersService.remove(id);
  }
}
