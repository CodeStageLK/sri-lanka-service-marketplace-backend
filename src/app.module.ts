import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { environmentSchema } from './config/env.schema';
import { PrismaModule } from './database/prisma.module';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { ProviderVerificationGuard } from './guards/provider-verification.guard';
import { RolesGuard } from './guards/roles.guard';
import { StorageModule } from './infrastructure/storage/storage.module';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { LocationsModule } from './modules/locations/locations.module';
import { ProvidersModule } from './modules/providers/providers.module';
import { ProviderMatchingModule } from './modules/provider-matching/provider-matching.module';
import { ServiceRequestsModule } from './modules/service-requests/service-requests.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // `neon env pull` / `neon deploy` write Neon variables into .env.local.
      envFilePath: ['.env.local', '.env'],
      validationSchema: environmentSchema,
      validationOptions: { abortEarly: false },
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: config.getOrThrow<number>('THROTTLE_TTL_SECONDS') * 1000,
            limit: config.getOrThrow<number>('THROTTLE_LIMIT'),
          },
        ],
      }),
    }),
    PrismaModule,
    StorageModule,
    AuthModule,
    HealthModule,
    CatalogModule,
    LocationsModule,
    ProvidersModule,
    ProviderMatchingModule,
    ServiceRequestsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_GUARD, useClass: ProviderVerificationGuard },
  ],
})
export class AppModule {}
