/**
 * Logical folders (object key prefixes) within the Neon Object Storage
 * bucket. Business modules compose object keys from these prefixes and store
 * only the resulting keys and metadata in PostgreSQL — never file bytes.
 */
export enum StorageFolder {
  CUSTOMER_PROFILE_PICTURES = 'customer-profile-pictures',
  PROVIDER_PROFILE_PICTURES = 'provider-profile-pictures',
  PROVIDER_PORTFOLIO_IMAGES = 'provider-portfolio-images',
  BUSINESS_DOCUMENTS = 'business-documents',
  VERIFICATION_DOCUMENTS = 'verification-documents',
  SERVICE_IMAGES = 'service-images',
  HEALTH_CHECKS = 'health-checks',
}

/** Builds a bucket object key from a folder prefix and path segments. */
export function buildObjectKey(
  folder: StorageFolder,
  ...segments: string[]
): string {
  const parts = segments.map((segment) => segment.replace(/^\/+|\/+$/g, ''));
  if (parts.some((part) => part.length === 0 || part.includes('..'))) {
    throw new Error('Object key segments must be non-empty and must not contain ".."');
  }
  return [folder, ...parts].join('/');
}

export interface UploadObjectOptions {
  contentType?: string;
  cacheControl?: string;
  metadata?: Record<string, string>;
  /** Overrides the default bucket for this operation. */
  bucket?: string;
}

export interface UploadObjectResult {
  bucket: string;
  key: string;
  etag?: string;
}

export interface StorageObject {
  bucket: string;
  key: string;
  body: Buffer;
  contentType?: string;
  contentLength?: number;
  etag?: string;
  lastModified?: Date;
  metadata?: Record<string, string>;
}

export interface StorageObjectSummary {
  key: string;
  size?: number;
  etag?: string;
  lastModified?: Date;
}

export interface ListObjectsResult {
  objects: StorageObjectSummary[];
  cursor?: string;
}
