import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PermissionsGuard } from '../../guards/permissions.guard';
import { ProviderVerificationGuard } from '../../guards/provider-verification.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { PrismaModule } from '../../database/prisma.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { EmailService } from './email.service';
import { PasswordService } from './password.service';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';

@Module({
  imports: [PrismaModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    EmailService,
    PasswordService,
    JwtAuthGuard,
    RolesGuard,
    PermissionsGuard,
    ProviderVerificationGuard,
  ],
  exports: [
    AuthService,
    JwtModule,
    JwtAuthGuard,
    RolesGuard,
    PermissionsGuard,
    ProviderVerificationGuard,
  ],
})
export class AuthModule {}
