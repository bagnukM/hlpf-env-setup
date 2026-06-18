import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { Product } from '../products/product.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrderQueryDto } from './dto/order-query.dto';
import { OrderStatus } from '../common/enums/order-status.enum';
import { Role } from '../common/enums/role.enum';

// Дозволені переходи статусів
const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.CANCELLED]: [],
};

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    private readonly dataSource: DataSource,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  // Інвалідація кешу продуктів (stock змінився) через версіонування
  private async clearProductsCache(): Promise<void> {
    const v = (await this.cacheManager.get<number>('products:version')) ?? 1;
    await this.cacheManager.set('products:version', v + 1, 24 * 60 * 60 * 1000);
  }

  async create(dto: CreateOrderDto, userId: number): Promise<Order> {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      let totalPrice = 0;
      const orderItems: OrderItem[] = [];

      for (const item of dto.items) {
        const product = await qr.manager.findOne(Product, {
          where: { id: item.productId },
        });

        if (!product) {
          throw new NotFoundException(`Product #${item.productId} not found`);
        }

        if (product.stock < item.quantity) {
          throw new BadRequestException(
            `Insufficient stock for "${product.name}": ` +
              `available ${product.stock}, requested ${item.quantity}`,
          );
        }

        // Зменшити stock
        product.stock -= item.quantity;
        await qr.manager.save(product);

        // OrderItem зі snapshot ціни
        const orderItem = qr.manager.create(OrderItem, {
          product,
          quantity: item.quantity,
          price: product.price,
        });
        orderItems.push(orderItem);

        totalPrice += Number(product.price) * item.quantity;
      }

      const order = qr.manager.create(Order, {
        user: { id: userId } as any,
        items: orderItems,
        totalPrice,
        status: OrderStatus.PENDING,
      });

      const saved = await qr.manager.save(order);

      await qr.commitTransaction();

      // stock змінився — інвалідувати кеш продуктів
      await this.clearProductsCache();

      return saved;
    } catch (error) {
      await qr.rollbackTransaction();
      throw error;
    } finally {
      await qr.release();
    }
  }

  async findAll(query: OrderQueryDto, userId: number, userRole: Role) {
    const { page = 1, pageSize = 10, status } = query;

    const qb = this.orderRepo
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'item')
      .leftJoinAndSelect('item.product', 'product')
      .leftJoinAndSelect('order.user', 'user');

    // Ownership: не-admin бачить тільки свої замовлення
    if (userRole !== Role.ADMIN) {
      qb.andWhere('order.userId = :userId', { userId });
    }

    if (status) {
      qb.andWhere('order.status = :status', { status });
    }

    qb.orderBy('order.createdAt', 'DESC');

    const skip = (page - 1) * pageSize;
    qb.skip(skip).take(pageSize);

    const [items, total] = await qb.getManyAndCount();

    return {
      items,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async findOne(id: number, userId: number, userRole: Role): Promise<Order> {
    const order = await this.orderRepo.findOne({
      where: { id },
      relations: { items: { product: true }, user: true },
    });

    if (!order) {
      throw new NotFoundException(`Order #${id} not found`);
    }

    if (userRole !== Role.ADMIN && order.user.id !== userId) {
      throw new ForbiddenException('You can only view your own orders');
    }

    return order;
  }

  async updateStatus(id: number, dto: UpdateOrderStatusDto): Promise<Order> {
    const order = await this.orderRepo.findOne({
      where: { id },
      relations: { items: { product: true }, user: true },
    });

    if (!order) {
      throw new NotFoundException(`Order #${id} not found`);
    }

    const allowed = ALLOWED_TRANSITIONS[order.status];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(
        `Cannot change status from "${order.status}" to "${dto.status}"`,
      );
    }

    // Бонус: при скасуванні повертаємо stock назад (у транзакції)
    if (dto.status === OrderStatus.CANCELLED) {
      const qr = this.dataSource.createQueryRunner();
      await qr.connect();
      await qr.startTransaction();
      try {
        for (const item of order.items) {
          const product = await qr.manager.findOne(Product, {
            where: { id: item.product.id },
          });
          if (product) {
            product.stock += item.quantity;
            await qr.manager.save(product);
          }
        }
        order.status = dto.status;
        const saved = await qr.manager.save(order);
        await qr.commitTransaction();
        await this.clearProductsCache();
        return saved;
      } catch (error) {
        await qr.rollbackTransaction();
        throw error;
      } finally {
        await qr.release();
      }
    }

    order.status = dto.status;
    return this.orderRepo.save(order);
  }

  async remove(id: number): Promise<void> {
    const order = await this.orderRepo.findOne({ where: { id } });
    if (!order) {
      throw new NotFoundException(`Order #${id} not found`);
    }
    await this.orderRepo.remove(order);
  }
}
