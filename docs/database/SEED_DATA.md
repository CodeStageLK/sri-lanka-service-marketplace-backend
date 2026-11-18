# Database Seed Data

Run the idempotent seed script with:

```powershell
pnpm prisma:seed
```

The seed upserts initial system roles and permissions, maps role permissions,
adds all nine Sri Lankan provinces and 25 districts, creates the initial
service-category hierarchy and quote-based service catalog, inserts the five
illustrative subscription plans, and sets the default currency/time zone.
Cities and towns can be added as `Location` rows by an administrator or a
future verified reference-data import; no unverified locality list is
invented here.

Plan prices are initial, configurable examples: FREE LKR 0, STANDARD LKR
1,500, PROFESSIONAL LKR 3,000, PREMIUM LKR 5,000, and BUSINESS LKR 10,000 per
month. Lead limits are left unconfigured (`NULL`). Featured eligibility is
initial illustrative configuration and can be changed in the database.
Commission and lead-charge defaults are intentionally not seeded.

The script does not create an administrator unless both
`INITIAL_ADMIN_EMAIL` and `INITIAL_ADMIN_PASSWORD_HASH` are supplied in the
environment. The hash must be a precomputed Argon2id or bcrypt hash. Plaintext
passwords are rejected and never written to the database. Keep both values
outside source control and clear them after the one-time bootstrap if they
should not be reused.

Seed operations use unique-key upserts and composite-key upserts so rerunning
the command does not create duplicate reference rows. It does not create fake
customers, providers, bookings, or other demonstration records.

