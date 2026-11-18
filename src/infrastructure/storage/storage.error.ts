export type StorageErrorCode =
  | 'NOT_FOUND'
  | 'ACCESS_DENIED'
  | 'BUCKET_NOT_FOUND'
  | 'UNAVAILABLE'
  | 'UNKNOWN';

/** Normalized error raised by {@link StorageService} operations. */
export class StorageError extends Error {
  constructor(
    readonly code: StorageErrorCode,
    message: string,
    readonly operation: string,
    readonly key?: string,
    cause?: unknown,
  ) {
    super(message, { cause });
    this.name = 'StorageError';
  }
}

interface S3LikeError {
  name?: string;
  message?: string;
  $metadata?: { httpStatusCode?: number };
}

export function toStorageError(
  error: unknown,
  operation: string,
  key?: string,
): StorageError {
  if (error instanceof StorageError) {
    return error;
  }
  const s3Error = (error ?? {}) as S3LikeError;
  const status = s3Error.$metadata?.httpStatusCode;
  const name = s3Error.name ?? '';

  let code: StorageErrorCode = 'UNKNOWN';
  if (name === 'NoSuchBucket') {
    code = 'BUCKET_NOT_FOUND';
  } else if (name === 'NoSuchKey' || name === 'NotFound' || status === 404) {
    code = 'NOT_FOUND';
  } else if (
    name === 'AccessDenied' ||
    name === 'InvalidAccessKeyId' ||
    name === 'SignatureDoesNotMatch' ||
    status === 401 ||
    status === 403
  ) {
    code = 'ACCESS_DENIED';
  } else if ((status !== undefined && status >= 500) || name === 'TimeoutError') {
    code = 'UNAVAILABLE';
  }

  const detail = s3Error.message ?? String(error);
  return new StorageError(
    code,
    `Storage ${operation} failed${key ? ` for "${key}"` : ''}: ${detail}`,
    operation,
    key,
    error,
  );
}
