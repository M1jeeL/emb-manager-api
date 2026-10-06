import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  console.log('1. Iniciando bootstrap...');
  const app = await NestFactory.create(AppModule);
  console.log('2. NestFactory creado con éxito');

  app.enableCors({ origin: process.env.FRONTEND_URL, cretedentials: true });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  console.log(
    `3. Intentando escuchar en puerto ${process.env.PORT ?? 4000}...`,
  );
  await app.listen(process.env.PORT ?? 4000, '0.0.0.0');
  console.log(
    `4. Servidor escuchando exitosamente en http://0.0.0.0:${process.env.PORT ?? 4000}`,
  );
}
bootstrap();
