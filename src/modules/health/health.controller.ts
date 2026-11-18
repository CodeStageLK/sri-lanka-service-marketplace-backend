import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PrismaService } from '../../database/prisma.service';
import { Public } from '../../decorators/public.decorator';
import { StorageService } from '../../infrastructure/storage/storage.service';

class HealthResponse {
  @ApiProperty({ example: 'ok' })
  status!: string;

  @ApiProperty({ example: '2026-11-17T00:00:00.000Z' })
  timestamp!: string;

  @ApiProperty({ example: 123.45, description: 'Process uptime in seconds' })
  uptime!: number;
}

class DependencyHealthResponse {
  @ApiProperty({ example: 'ok' })
  status!: string;

  @ApiProperty({ example: 'database', enum: ['database', 'storage'] })
  dependency!: string;

  @ApiProperty({ example: 42, description: 'Round-trip latency in milliseconds' })
  latencyMs!: number;

  @ApiProperty({ example: '2026-11-17T00:00:00.000Z' })
  timestamp!: string;
}

@ApiTags('health')
@Public()
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Check whether the API process is running' })
  @ApiOkResponse({ type: HealthResponse })
  check(): HealthResponse {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  @Get('database')
  @ApiOperation({ summary: 'Run a real query against Neon PostgreSQL' })
  @ApiOkResponse({ type: DependencyHealthResponse })
  @ApiServiceUnavailableResponse({ description: 'Database is unreachable' })
  async checkDatabase(): Promise<DependencyHealthResponse> {
    return this.probe('database', () => this.prisma.ping());
  }

  @Get('storage')
  @ApiOperation({ summary: 'Run a real request against Neon Object Storage' })
  @ApiOkResponse({ type: DependencyHealthResponse })
  @ApiServiceUnavailableResponse({ description: 'Object storage is unreachable' })
  async checkStorage(): Promise<DependencyHealthResponse> {
    return this.probe('storage', () => this.storage.ping());
  }

  private async probe(
    dependency: 'database' | 'storage',
    operation: () => Promise<void>,
  ): Promise<DependencyHealthResponse> {
    const startedAt = Date.now();
    try {
      await operation();
    } catch {
      throw new ServiceUnavailableException(`The ${dependency} is unreachable`);
    }
    return {
      status: 'ok',
      dependency,
      latencyMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    };
  }
}
