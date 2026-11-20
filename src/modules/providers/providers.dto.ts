import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

export class UpdateProviderProfileDto {
  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(180) displayName?: string;
  @ApiPropertyOptional()
  @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional()
  @IsOptional() @Transform(({ value }) => Number(value)) @IsInt() @Min(0) @Max(100) experienceYears?: number;
  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(320) contactEmail?: string;
  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(16) contactPhone?: string;
  @ApiPropertyOptional()
  @IsOptional() @IsString() profileImageMediaId?: string;
  @ApiPropertyOptional()
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateBusinessDetailsDto {
  @ApiProperty() @IsString() @MaxLength(180) businessName!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) registrationNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() businessAddress?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(180) contactPersonName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(320) contactEmail?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(16) contactPhone?: string;
}

export class ProviderCategoryDto {
  @ApiProperty({ format: 'uuid' }) @IsString() categoryId!: string;
}

export class ProviderServiceDto {
  @ApiProperty({ format: 'uuid' }) @IsString() serviceId!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() priceFrom?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() priceTo?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(3) currency?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class ProviderCoverageDto {
  @ApiProperty({ format: 'uuid' }) @IsString() locationId!: string;
}

export class ProviderAvailabilityDto {
  @ApiProperty({ minimum: 0, maximum: 6 }) @Transform(({ value }) => Number(value)) @IsInt() @Min(0) @Max(6) dayOfWeek!: number;
  @ApiProperty({ example: '08:00' }) @Matches(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/) @IsString() startTime!: string;
  @ApiProperty({ example: '17:00' }) @Matches(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/) @IsString() endTime!: string;
  @ApiPropertyOptional({ default: 'Asia/Colombo' }) @IsOptional() @IsString() @MaxLength(64) timeZone?: string;
  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() isAvailable?: boolean;
}

export class ProviderSearchDto {
  @ApiPropertyOptional() @IsOptional() @IsString() categoryId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() serviceId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() provinceId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() districtId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() locationId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() keyword?: string;
  @ApiPropertyOptional({ enum: ['INDIVIDUAL', 'BUSINESS'] }) @IsOptional() @IsString() providerType?: string;
  @ApiPropertyOptional() @IsOptional() @Transform(({ value }) => Number(value)) @IsInt() @Min(0) @Max(5) minRating?: number;
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Transform(({ value }) => Number(value)) @IsInt() @Min(1) page?: number = 1;
  @ApiPropertyOptional({ default: 20 }) @IsOptional() @Transform(({ value }) => Number(value)) @IsInt() @Min(1) @Max(100) limit?: number = 20;
  @ApiPropertyOptional() @IsOptional() @IsString() sort?: 'rating' | 'newest';
}
