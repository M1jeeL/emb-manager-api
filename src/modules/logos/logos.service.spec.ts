import { Test, TestingModule } from '@nestjs/testing';
import { LogosService } from './logos.service';

describe('LogosService', () => {
  let service: LogosService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LogosService],
    }).compile();

    service = module.get<LogosService>(LogosService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
