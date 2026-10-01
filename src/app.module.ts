import { Global, Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { OrdersModule } from './modules/orders/orders.module';
import { PrismaService } from './prisma.service.js';
import { ConfigModule } from '@nestjs/config';
import { CustomersModule } from './modules/customers/customers.module';
import { AuthModule } from './modules/auth/auth.module.js';
import { GarmentsModule } from './modules/garments/garments.module';
import { LogosModule } from './modules/logos/logos.module';
import { StorageModule } from './modules/storage/storage.module';
import { EmployeesModule } from './modules/employees/employees.module';
import { MachinesModule } from './modules/machines/machines.module';
import { ProductionsModule } from './modules/productions/productions.module';
import { PaymentsModule } from './modules/payments/payments.module';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    OrdersModule,
    CustomersModule,
    AuthModule,
    GarmentsModule,
    LogosModule,
    StorageModule,
    EmployeesModule,
    MachinesModule,
    ProductionsModule,
    PaymentsModule,
  ],
  controllers: [AppController],
  providers: [AppService, PrismaService],
  exports: [PrismaService, AppService],
})
export class AppModule {}
