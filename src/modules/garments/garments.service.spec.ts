import { Test, TestingModule } from '@nestjs/testing';
import { GarmentsService } from './garments.service';

describe('GarmentsService', () => {
  let service: GarmentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GarmentsService],
    }).compile();

    service = module.get<GarmentsService>(GarmentsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
