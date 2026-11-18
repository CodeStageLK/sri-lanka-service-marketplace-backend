import type { Readable } from 'node:stream';
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StorageError, toStorageError } from './storage.error';
import {
  ListObjectsResult,
  StorageObject,
  UploadObjectOptions,
  UploadObjectResult,
} from './storage.types';

/**
 * Reusable Neon Object Storage service.
 *
 * Neon Object Storage is S3-compatible and branch-scoped. Credentials,
 * endpoint, and region come from the AWS-standard environment variables Neon
 * injects (`neon env pull` / `neon deploy`): AWS_ACCESS_KEY_ID,
 * AWS_SECRET_ACCESS_KEY, AWS_ENDPOINT_URL_S3, AWS_REGION. Neon requires
 * path-style addressing, so the client sets `forcePathStyle: true`.
 */
@Injectable()
export class StorageService implements OnModuleDestroy {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;
  readonly defaultBucket: string;

  constructor(config: ConfigService) {
    this.defaultBucket = config.getOrThrow<string>('STORAGE_BUCKET');
    this.client = new S3Client({
      // Required: Neon Object Storage uses path-style addressing.
      forcePathStyle: true,
      endpoint: config.getOrThrow<string>('AWS_ENDPOINT_URL_S3'),
      region: config.getOrThrow<string>('AWS_REGION'),
      credentials: {
        accessKeyId: config.getOrThrow<string>('AWS_ACCESS_KEY_ID'),
        secretAccessKey: config.getOrThrow<string>('AWS_SECRET_ACCESS_KEY'),
      },
    });
  }

  onModuleDestroy(): void {
    this.client.destroy();
  }

  async upload(
    key: string,
    body: Buffer | Uint8Array | Readable | string,
    options: UploadObjectOptions = {},
  ): Promise<UploadObjectResult> {
    const bucket = options.bucket ?? this.defaultBucket;
    try {
      const result = await this.client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: options.contentType,
          CacheControl: options.cacheControl,
          Metadata: options.metadata,
        }),
      );
      return { bucket, key, etag: result.ETag };
    } catch (error) {
      throw this.handle(error, 'upload', key);
    }
  }

  async download(key: string, bucket?: string): Promise<StorageObject> {
    const targetBucket = bucket ?? this.defaultBucket;
    try {
      const result = await this.client.send(
        new GetObjectCommand({ Bucket: targetBucket, Key: key }),
      );
      const bytes = await result.Body?.transformToByteArray();
      return {
        bucket: targetBucket,
        key,
        body: Buffer.from(bytes ?? new Uint8Array()),
        contentType: result.ContentType,
        contentLength: result.ContentLength,
        etag: result.ETag,
        lastModified: result.LastModified,
        metadata: result.Metadata,
      };
    } catch (error) {
      throw this.handle(error, 'download', key);
    }
  }

  /** Presigned GET URL for sharing an object without exposing credentials. */
  async getSignedDownloadUrl(
    key: string,
    expiresInSeconds = 3600,
    bucket?: string,
  ): Promise<string> {
    try {
      return await getSignedUrl(
        this.client,
        new GetObjectCommand({ Bucket: bucket ?? this.defaultBucket, Key: key }),
        { expiresIn: expiresInSeconds },
      );
    } catch (error) {
      throw this.handle(error, 'presign', key);
    }
  }

  async exists(key: string, bucket?: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: bucket ?? this.defaultBucket, Key: key }),
      );
      return true;
    } catch (error) {
      const storageError = toStorageError(error, 'exists', key);
      if (storageError.code === 'NOT_FOUND') {
        return false;
      }
      throw this.handle(storageError, 'exists', key);
    }
  }

  async delete(key: string, bucket?: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: bucket ?? this.defaultBucket, Key: key }),
      );
    } catch (error) {
      throw this.handle(error, 'delete', key);
    }
  }

  async list(
    prefix?: string,
    options: { cursor?: string; limit?: number; bucket?: string } = {},
  ): Promise<ListObjectsResult> {
    try {
      const result = await this.client.send(
        new ListObjectsV2Command({
          Bucket: options.bucket ?? this.defaultBucket,
          Prefix: prefix,
          ContinuationToken: options.cursor,
          MaxKeys: options.limit,
        }),
      );
      return {
        objects: (result.Contents ?? []).map((item) => ({
          key: item.Key ?? '',
          size: item.Size,
          etag: item.ETag,
          lastModified: item.LastModified,
        })),
        cursor: result.NextContinuationToken,
      };
    } catch (error) {
      throw this.handle(error, 'list', prefix);
    }
  }

  /**
   * Performs a real round-trip against the bucket (not a config check);
   * throws a {@link StorageError} when the service is unreachable.
   */
  async ping(): Promise<void> {
    try {
      await this.client.send(
        new ListObjectsV2Command({ Bucket: this.defaultBucket, MaxKeys: 1 }),
      );
    } catch (error) {
      throw this.handle(error, 'ping');
    }
  }

  private handle(error: unknown, operation: string, key?: string): StorageError {
    const storageError = toStorageError(error, operation, key);
    this.logger.error({
      message: 'Object storage operation failed',
      operation,
      key,
      code: storageError.code,
      error: storageError.message,
    });
    return storageError;
  }
}
