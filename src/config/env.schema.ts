import Joi from 'joi';

const origins = Joi.string()
  .required()
  .custom((value: string, helpers) => {
    const entries = value.split(',').map((entry) => entry.trim());
    if (
      entries.some((entry) => {
        try {
          const url = new URL(entry);
          return (
            !['http:', 'https:'].includes(url.protocol) || url.origin !== entry
          );
        } catch {
          return true;
        }
      })
    ) {
      return helpers.error('any.invalid');
    }
    return value;
  })
  .messages({ 'any.invalid': 'CORS_ORIGINS must contain comma-separated HTTP(S) origins' });

export const environmentSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').required(),
  PORT: Joi.number().port().required(),
  // Neon PostgreSQL: pooled URL for application traffic, direct URL for migrations.
  DATABASE_URL: Joi.string().uri({ scheme: ['postgres', 'postgresql'] }).required(),
  DATABASE_URL_UNPOOLED: Joi.string().uri({ scheme: ['postgres', 'postgresql'] }).required(),
  // Neon Object Storage: AWS-standard variables injected by `neon env pull` / `neon deploy`.
  AWS_ACCESS_KEY_ID: Joi.string().required(),
  AWS_SECRET_ACCESS_KEY: Joi.string().required(),
  AWS_ENDPOINT_URL_S3: Joi.string().uri({ scheme: ['https', 'http'] }).required(),
  AWS_REGION: Joi.string().required(),
  STORAGE_BUCKET: Joi.string().default('assets'),
  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_SECRET: Joi.string().min(32).invalid(Joi.ref('JWT_ACCESS_SECRET')).required(),
  JWT_ACCESS_TTL_SECONDS: Joi.number().integer().min(60).max(900).default(900),
  JWT_REFRESH_TTL_DAYS: Joi.number().integer().min(1).max(90).default(30),
  JWT_ISSUER: Joi.string().min(1),
  JWT_AUDIENCE: Joi.string().min(1),
  AUTH_APP_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.required(),
      otherwise: Joi.optional(),
    })
    .when('SMTP_HOST', {
      is: Joi.exist(),
      then: Joi.required(),
    }),
  SMTP_HOST: Joi.string()
    .min(1)
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),
  SMTP_PORT: Joi.number()
    .integer()
    .port()
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),
  SMTP_SECURE: Joi.boolean().truthy('true').falsy('false').default(false),
  SMTP_USER: Joi.string()
    .min(1)
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),
  SMTP_PASSWORD: Joi.string()
    .min(1)
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),
  SMTP_FROM: Joi.string()
    .email()
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),
  CORS_ORIGINS: origins,
  THROTTLE_TTL_SECONDS: Joi.number().integer().positive().default(60),
  THROTTLE_LIMIT: Joi.number().integer().positive().default(100),
})
  .and('JWT_ISSUER', 'JWT_AUDIENCE')
  .and('SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM')
  .unknown();
