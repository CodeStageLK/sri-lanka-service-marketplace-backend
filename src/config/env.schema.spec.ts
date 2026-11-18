import { environmentSchema } from './env.schema';

const validEnvironment = {
  NODE_ENV: 'test',
  PORT: '3000',
  DATABASE_URL: 'postgresql://localhost:5432/test',
  DATABASE_URL_UNPOOLED: 'postgresql://localhost:5432/test',
  AWS_ACCESS_KEY_ID: 'test-access-key-id',
  AWS_SECRET_ACCESS_KEY: 'test-secret-access-key',
  AWS_ENDPOINT_URL_S3: 'https://storage.example.neon.tech',
  AWS_REGION: 'us-east-2',
  JWT_ACCESS_SECRET: 'test-access-secret-at-least-thirty-two-characters',
  JWT_REFRESH_SECRET: 'test-refresh-secret-at-least-thirty-two-characters',
  CORS_ORIGINS: 'http://localhost:5173,http://localhost:5174',
};

describe('environment validation', () => {
  it('accepts distinct secrets and explicit origins', () => {
    expect(environmentSchema.validate(validEnvironment).error).toBeUndefined();
  });

  it('rejects matching JWT secrets', () => {
    const result = environmentSchema.validate({
      ...validEnvironment,
      JWT_REFRESH_SECRET: validEnvironment.JWT_ACCESS_SECRET,
    });
    expect(result.error).toBeDefined();
  });

  it('rejects wildcard and malformed CORS origins', () => {
    for (const CORS_ORIGINS of ['*', 'http://localhost:5173/path']) {
      expect(environmentSchema.validate({ ...validEnvironment, CORS_ORIGINS }).error).toBeDefined();
    }
  });

  it('requires the Neon storage variables and defaults the bucket', () => {
    const withoutEndpoint: Partial<typeof validEnvironment> = { ...validEnvironment };
    delete withoutEndpoint.AWS_ENDPOINT_URL_S3;
    expect(environmentSchema.validate(withoutEndpoint).error).toBeDefined();
    const result = environmentSchema.validate(validEnvironment);
    expect(result.value.STORAGE_BUCKET).toBe('assets');
  });

  it('requires real SMTP configuration in production', () => {
    const production = {
      ...validEnvironment,
      NODE_ENV: 'production',
      AUTH_APP_URL: 'https://app.example.com',
      SMTP_HOST: 'smtp.example.com',
      SMTP_PORT: '587',
      SMTP_USER: 'smtp-user',
      SMTP_PASSWORD: 'smtp-password',
      SMTP_FROM: 'no-reply@example.com',
    };
    expect(environmentSchema.validate(production).error).toBeUndefined();
    expect(
      environmentSchema.validate({
        ...production,
        SMTP_PASSWORD: undefined,
      }).error,
    ).toBeDefined();
  });

  it('keeps JWT issuer and audience configuration paired', () => {
    expect(
      environmentSchema.validate({
        ...validEnvironment,
        JWT_ISSUER: 'https://api.example.com',
      }).error,
    ).toBeDefined();
  });
});
