import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { configureApp } from '../src/common/configure-app';
import { PrismaService } from '../src/database/prisma.service';
import { StorageService } from '../src/infrastructure/storage/storage.service';

describe('API foundation', () => {
  let app: INestApplication;
  const prismaMock = {
    ping: jest.fn(),
    refreshToken: { findUnique: jest.fn() },
  };
  const storageMock = { ping: jest.fn() };

  beforeAll(async () => {
    Object.assign(process.env, {
      NODE_ENV: 'test',
      PORT: '3000',
      DATABASE_URL: 'postgresql://localhost:5432/test',
      DATABASE_URL_UNPOOLED: 'postgresql://localhost:5432/test',
      AWS_ACCESS_KEY_ID: 'test-access-key-id',
      AWS_SECRET_ACCESS_KEY: 'test-secret-access-key',
      AWS_ENDPOINT_URL_S3: 'https://storage.example.neon.tech',
      AWS_REGION: 'us-east-2',
      STORAGE_BUCKET: 'assets',
      JWT_ACCESS_SECRET: 'test-access-secret-at-least-thirty-two-characters',
      JWT_REFRESH_SECRET: 'test-refresh-secret-at-least-thirty-two-characters',
      CORS_ORIGINS: 'http://localhost:5173',
    });
    const { AppModule } = await import('../src/app.module');
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideProvider(StorageService)
      .useValue(storageMock)
      .compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
  });

  beforeEach(() => {
    prismaMock.ping.mockResolvedValue(undefined);
    prismaMock.refreshToken.findUnique.mockResolvedValue(null);
    storageMock.ping.mockResolvedValue(undefined);
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('serves the versioned health endpoint', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200)
      .expect('x-request-id', /.+/);
    expect(response.body).toMatchObject({ status: 'ok' });
  });

  it('reports database health through a real ping call', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/health/database')
      .expect(200);
    expect(response.body).toMatchObject({ status: 'ok', dependency: 'database' });
    expect(prismaMock.ping).toHaveBeenCalled();
  });

  it('returns 503 when the database is unreachable', async () => {
    prismaMock.ping.mockRejectedValue(new Error('down'));
    await request(app.getHttpServer()).get('/api/v1/health/database').expect(503);
  });

  it('reports storage health through a real ping call', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/health/storage')
      .expect(200);
    expect(response.body).toMatchObject({ status: 'ok', dependency: 'storage' });
    expect(storageMock.ping).toHaveBeenCalled();
  });

  it('returns 503 when object storage is unreachable', async () => {
    storageMock.ping.mockRejectedValue(new Error('down'));
    await request(app.getHttpServer()).get('/api/v1/health/storage').expect(503);
  });

  it('returns a consistent error response for missing routes', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/missing').expect(404);
    expect(response.body).toMatchObject({ statusCode: 404, traceId: expect.any(String) });
  });

  it('requires authentication for protected endpoints', async () => {
    await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
  });

  it('keeps customer registration public but validates its DTO', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register/customer')
      .send({})
      .expect(400);
  });

  it('does not expose public administrator registration', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register/admin')
      .send({})
      .expect(404);
  });

  it('issues a CSRF token for web refresh-token cookies', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/auth/csrf')
      .expect(200);
    expect(response.body.csrfToken).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(response.headers['set-cookie']).toEqual(
      expect.arrayContaining([expect.stringContaining('servhub_csrf=')]),
    );
  });

  it('requires a matching CSRF header before using refresh cookies', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', 'servhub_refresh=opaque; servhub_csrf=csrf-value')
      .expect(403);

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', 'servhub_refresh=opaque; servhub_csrf=csrf-value')
      .set('x-csrf-token', 'csrf-value')
      .send({})
      .expect(401);
  });
});
