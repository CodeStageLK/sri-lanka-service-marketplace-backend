import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';
import type { PrismaService } from '../../database/prisma.service';
import type { StorageService } from '../../infrastructure/storage/storage.service';

function createController(overrides: {
  databaseUp?: boolean;
  storageUp?: boolean;
}): HealthController {
  const prisma = {
    ping: overrides.databaseUp === false
      ? jest.fn().mockRejectedValue(new Error('down'))
      : jest.fn().mockResolvedValue(undefined),
  } as unknown as PrismaService;
  const storage = {
    ping: overrides.storageUp === false
      ? jest.fn().mockRejectedValue(new Error('down'))
      : jest.fn().mockResolvedValue(undefined),
  } as unknown as StorageService;
  return new HealthController(prisma, storage);
}

describe('HealthController', () => {
  it('reports the process as healthy', () => {
    const response = createController({}).check();
    expect(response.status).toBe('ok');
    expect(response.uptime).toBeGreaterThan(0);
  });

  it('reports database health from a real ping', async () => {
    const response = await createController({}).checkDatabase();
    expect(response).toMatchObject({ status: 'ok', dependency: 'database' });
  });

  it('returns 503 when the database ping fails', async () => {
    await expect(
      createController({ databaseUp: false }).checkDatabase(),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('reports storage health from a real ping', async () => {
    const response = await createController({}).checkStorage();
    expect(response).toMatchObject({ status: 'ok', dependency: 'storage' });
  });

  it('returns 503 when the storage ping fails', async () => {
    await expect(
      createController({ storageUp: false }).checkStorage(),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
