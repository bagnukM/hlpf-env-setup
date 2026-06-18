import { IsOptional, IsInt, Min, Max, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus } from '../../common/enums/order-status.enum';

export class OrderQueryDto {
  @ApiPropertyOptional({ example: 1, description: 'Номер сторінки', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    example: 10,
    description: 'Елементів на сторінку (max 100)',
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 10;

  @ApiPropertyOptional({
    enum: OrderStatus,
    description: 'Фільтр за статусом',
  })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;
}
