import { StorageError, toStorageError } from './storage.error';
import { StorageFolder, buildObjectKey } from './storage.types';

describe('toStorageError', () => {
  it('maps S3 error shapes to normalized codes', () => {
    const cases: Array<[unknown, string]> = [
      [{ name: 'NoSuchKey', $metadata: { httpStatusCode: 404 } }, 'NOT_FOUND'],
      [{ name: 'NoSuchBucket', $metadata: { httpStatusCode: 404 } }, 'BUCKET_NOT_FOUND'],
      [{ name: 'AccessDenied', $metadata: { httpStatusCode: 403 } }, 'ACCESS_DENIED'],
      [{ name: 'InternalError', $metadata: { httpStatusCode: 500 } }, 'UNAVAILABLE'],
      [new Error('ECONNREFUSED'), 'UNKNOWN'],
    ];
    for (const [input, code] of cases) {
      const error = toStorageError(input, 'download', 'some/key');
      expect(error).toBeInstanceOf(StorageError);
      expect(error.code).toBe(code);
      expect(error.operation).toBe('download');
    }
  });

  it('passes through existing StorageError instances', () => {
    const original = new StorageError('NOT_FOUND', 'missing', 'download', 'key');
    expect(toStorageError(original, 'download', 'key')).toBe(original);
  });
});

describe('buildObjectKey', () => {
  it('joins folder and segments', () => {
    expect(
      buildObjectKey(StorageFolder.CUSTOMER_PROFILE_PICTURES, 'user-1', 'avatar.jpg'),
    ).toBe('customer-profile-pictures/user-1/avatar.jpg');
  });

  it('rejects empty and traversal segments', () => {
    expect(() => buildObjectKey(StorageFolder.SERVICE_IMAGES, '')).toThrow();
    expect(() => buildObjectKey(StorageFolder.SERVICE_IMAGES, '..', 'x')).toThrow();
  });
});
