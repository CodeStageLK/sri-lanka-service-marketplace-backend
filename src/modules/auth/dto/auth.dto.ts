import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterCustomerDto {
  @ApiProperty({ example: 'Nimal' })
  @IsString()
  @Length(1, 120)
  firstName!: string;

  @ApiProperty({ example: 'Perera' })
  @IsString()
  @Length(1, 120)
  lastName!: string;

  @ApiProperty({ example: 'nimal@example.com' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @ApiProperty({ minLength: 12, maxLength: 128 })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password!: string;
}

export class RegisterIndividualProviderDto {
  @ApiProperty({ example: 'Nimal Perera' })
  @IsString()
  @Length(1, 180)
  displayName!: string;

  @ApiProperty({ example: 'nimal@example.com' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @ApiProperty({ minLength: 12, maxLength: 128 })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password!: string;

  @ApiPropertyOptional({ example: '+94771234567' })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  contactPhone?: string;
}

export class RegisterBusinessProviderDto {
  @ApiProperty({ example: 'Colombo Home Services (Pvt) Ltd' })
  @IsString()
  @Length(1, 180)
  businessName!: string;

  @ApiProperty({ example: 'nimal@example.com' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @ApiProperty({ minLength: 12, maxLength: 128 })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password!: string;

  @ApiPropertyOptional({ example: 'Nimal Perera' })
  @IsOptional()
  @IsString()
  @MaxLength(180)
  contactPersonName?: string;

  @ApiPropertyOptional({ example: 'PV 12345' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  registrationNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  businessAddress?: string;

  @ApiPropertyOptional({ example: '+94112345678' })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  contactPhone?: string;
}

export class LoginDto {
  @ApiProperty({ example: 'nimal@example.com' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password!: string;

  @ApiPropertyOptional({ enum: ['WEB', 'MOBILE'], default: 'WEB' })
  @IsOptional()
  @IsIn(['WEB', 'MOBILE'])
  clientType?: 'WEB' | 'MOBILE';

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  deviceName?: string;
}

export class RefreshDto {
  @ApiPropertyOptional({
    description: 'Required for mobile clients. Web clients use the HttpOnly cookie.',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  refreshToken?: string;
}

export class VerifyEmailDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  token!: string;
}

export class EmailDto {
  @ApiProperty({ example: 'nimal@example.com' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(320)
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  token!: string;

  @ApiProperty({ minLength: 12, maxLength: 128 })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  newPassword!: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  currentPassword!: string;

  @ApiProperty({ minLength: 12, maxLength: 128 })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  newPassword!: string;
}
