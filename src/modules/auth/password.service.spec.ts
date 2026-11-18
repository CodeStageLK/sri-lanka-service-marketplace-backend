import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('stores passwords as Argon2id hashes and verifies them safely', async () => {
    const password = 'correct horse battery staple 42';
    const passwordHash = await service.hash(password);

    expect(passwordHash).toMatch(/^\$argon2id\$/);
    expect(passwordHash).not.toContain(password);
    await expect(service.verify(passwordHash, password)).resolves.toBe(true);
    await expect(service.verify(passwordHash, 'wrong password')).resolves.toBe(
      false,
    );
  });
});
