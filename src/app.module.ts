import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { createKeyv } from '@keyv/redis';

import { Category } from './categories/category.entity';
import { Product } from './products/product.entity';
import { User } from './users/user.entity';

import { CategoriesModule } from './categories/categories.module';
import { ProductsModule } from './products/products.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';

import { CreateTables1700000001000 } from './migrations/1700000001000-CreateTables';
import { AddIsActiveToProducts1781718845122 } from './migrations/1781718845122-AddIsActiveToProducts';
import { CreateUsers1781794202026 } from './migrations/1781794202026-CreateUsers';

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
      entities: [Category, Product, User],
      synchronize: false,
      migrationsRun: true,
      migrations: [
        CreateTables1700000001000,
        AddIsActiveToProducts1781718845122,
        CreateUsers1781794202026,
      ],
    }),

    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: () => {
        const host = process.env.REDIS_HOST;
        const port = process.env.REDIS_PORT;
        return {
          stores: [createKeyv(`redis://${host}:${port}`)],
          ttl: 60 * 1000,
        };
      },
    }),

    CategoriesModule,
    ProductsModule,
    UsersModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}