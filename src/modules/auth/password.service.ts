import { Injectable, Logger } from '@nestjs/common';
import * as argon2 from 'argon2';
import { randomBytes } from 'node:crypto';

const ARGON2_OPTIONS: argon2.HashOptions = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
};

@Injectable()
export class PasswordService {
  private readonly logger = new Logger(PasswordService.name);
  private dummyHash: Promise<string> | undefined;

  hash(password: string): Promise<string> {
    return argon2.hash(password, { ...ARGON2_OPTIONS, raw: false });
  }

  async verify(passwordHash: string, password: string): Promise<boolean> {
    if (!passwordHash.startsWith('$argon2id$')) return false;
    try {
      return await argon2.verify(passwordHash, password);
    } catch {
      this.logger.warn('A stored password hash could not be verified.');
      return false;
    }
  }

  async burnForUnknownAccount(password: string): Promise<void> {
    this.dummyHash ??= argon2.hash(randomBytes(32).toString('hex'), {
      ...ARGON2_OPTIONS,
      raw: false,
    });
    await argon2.verify(await this.dummyHash, password);
  }
}
