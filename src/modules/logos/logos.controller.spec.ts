import { Test, TestingModule } from '@nestjs/testing';
import { LogosController } from './logos.controller';
import { LogosService } from './logos.service';

describe('LogosController', () => {
  let controller: LogosController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LogosController],
      providers: [LogosService],
    }).compile();

    controller = module.get<LogosController>(LogosController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
