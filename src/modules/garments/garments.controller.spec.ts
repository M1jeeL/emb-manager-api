import { Test, TestingModule } from '@nestjs/testing';
import { GarmentsController } from './garments.controller';
import { GarmentsService } from './garments.service';

describe('GarmentsController', () => {
  let controller: GarmentsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GarmentsController],
      providers: [GarmentsService],
    }).compile();

    controller = module.get<GarmentsController>(GarmentsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
