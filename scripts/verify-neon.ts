/**
 * Neon connectivity verification script (run via `pnpm run verify:neon`).
 * Proves real connectivity to Neon PostgreSQL and Neon Object Storage.
 */
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { StorageService } from '../src/infrastructure/storage/storage.service';
import { StorageFolder, buildObjectKey } from '../src/infrastructure/storage/storage.types';

async function verifyDatabase(): Promise<void> {
  const prisma = new PrismaClient();
  const rows = await prisma.$queryRaw<
    Array<{ database: string; server_version: string; now: Date }>
  >`SELECT current_database() AS database, current_setting('server_version') AS server_version, now() AS now`;
  console.log('[database] query result:', rows[0]);
  await prisma.$disconnect();
}

async function verifyStorage(): Promise<void> {
  const storage = new StorageService(new ConfigService());
  const key = buildObjectKey(StorageFolder.HEALTH_CHECKS, `verify-${Date.now()}.txt`);
  const content = 'SERV HUB Phase 2 Neon Object Storage verification';

  const uploaded = await storage.upload(key, content, { contentType: 'text/plain' });
  console.log('[storage] uploaded:', uploaded);

  const existsAfterUpload = await storage.exists(key);
  console.log('[storage] exists after upload:', existsAfterUpload);
  if (!existsAfterUpload) throw new Error('Uploaded object not found');

  const downloaded = await storage.download(key);
  console.log('[storage] downloaded:', {
    contentType: downloaded.contentType,
    body: downloaded.body.toString('utf8'),
  });
  if (downloaded.body.toString('utf8') !== content) throw new Error('Downloaded content mismatch');

  await storage.delete(key);
  const existsAfterDelete = await storage.exists(key);
  console.log('[storage] exists after delete:', existsAfterDelete);
  if (existsAfterDelete) throw new Error('Object still exists after deletion');
}

verifyDatabase()
  .then(verifyStorage)
  .then(() => {
    console.log('Neon verification succeeded');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Neon verification failed:', error);
    process.exit(1);
  });
