import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ServiceUrgency } from '@prisma/client';

export class CreateServiceRequestDto {
  @ApiProperty() @IsString() @MaxLength(200) title!: string;
  @ApiProperty() @IsString() description!: string;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() addressId?: string;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() locationId?: string;
  @ApiPropertyOptional({ isArray: true, type: String }) @IsOptional() @IsArray() @IsUUID('4', { each: true }) categoryIds?: string[];
  @ApiPropertyOptional({ isArray: true, type: String }) @IsOptional() @IsArray() @IsUUID('4', { each: true }) serviceIds?: string[];
  @ApiPropertyOptional({ isArray: true, type: String }) @IsOptional() @IsArray() @IsUUID('4', { each: true }) attachmentMediaIds?: string[];
  @ApiPropertyOptional() @IsOptional() @IsString() preferredDate?: string;
  @ApiPropertyOptional({ enum: ServiceUrgency }) @IsOptional() @IsEnum(ServiceUrgency) urgency?: ServiceUrgency;
  @ApiPropertyOptional() @IsOptional() @IsString() budgetMin?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() budgetMax?: string;
  @ApiPropertyOptional({ default: 'LKR' }) @IsOptional() @IsString() @MaxLength(3) currency?: string;
}

export class UpdateServiceRequestDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() addressId?: string;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() locationId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() preferredDate?: string;
  @ApiPropertyOptional({ enum: ServiceUrgency }) @IsOptional() @IsEnum(ServiceUrgency) urgency?: ServiceUrgency;
  @ApiPropertyOptional() @IsOptional() @IsString() budgetMin?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() budgetMax?: string;
  @ApiPropertyOptional({ default: 'LKR' }) @IsOptional() @IsString() @MaxLength(3) currency?: string;
}

export class CreateEnquiryDto {
  @ApiProperty() @IsString() @MaxLength(200) subject!: string;
  @ApiProperty() @IsString() message!: string;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() serviceRequestId?: string;
}
