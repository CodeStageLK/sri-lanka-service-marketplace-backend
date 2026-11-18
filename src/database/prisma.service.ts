import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

/**
 * Prisma client wired to Neon PostgreSQL.
 *
 * Uses the pooled Neon connection string (DATABASE_URL, PgBouncer in
 * transaction mode) for application traffic. Schema migrations run over the
 * direct connection (DATABASE_URL_UNPOOLED) via the `directUrl` entry in
 * `prisma/schema.prisma`, never through this client.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(config: ConfigService) {
    super({ datasourceUrl: config.getOrThrow<string>('DATABASE_URL') });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.logger.log('Connected to Neon PostgreSQL');
    } catch (error) {
      this.logger.error({
        message: 'Failed to connect to Neon PostgreSQL',
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('Disconnected from Neon PostgreSQL');
  }

  /** Runs a real round-trip query against Neon; throws when unreachable. */
  async ping(): Promise<void> {
    await this.$queryRaw`SELECT 1`;
  }
}
