import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';

import { Category } from './categories/category.entity';
import { Product } from './products/product.entity';
import { CategoriesModule } from './categories/categories.module';
import { ProductsModule } from './products/products.module';

import { CreateTables1700000001000 } from './migrations/1700000001000-CreateTables';
import { AddIsActiveToProducts1781718845122 } from './migrations/1781718845122-AddIsActiveToProducts';

import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.POSTGRES_HOST,
      port: parseInt(process.env.POSTGRES_PORT!, 10),
      username: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      database: process.env.POSTGRES_DB,
      entities: [Category, Product],
      synchronize: false,
      migrationsRun: true,
      migrations: [
        CreateTables1700000001000,
        AddIsActiveToProducts1781718845122,
      ],
    }),

    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: async () => ({
        store: await redisStore({
          socket: {
            host: process.env.REDIS_HOST,
            port: parseInt(process.env.REDIS_PORT!, 10),
          },
        }),
        ttl: 60 * 1000,
      }),
    }),

    CategoriesModule,
    ProductsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}