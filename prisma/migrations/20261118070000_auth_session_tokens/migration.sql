CREATE TYPE "auth_token_purpose" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET');

ALTER TABLE "refresh_tokens"
ADD COLUMN "session_id" UUID;

ALTER TABLE "user_sessions"
ADD COLUMN "device_name" VARCHAR(120);

UPDATE "refresh_tokens" AS refresh_token
SET "session_id" = user_session."id"
FROM "user_sessions" AS user_session
WHERE user_session."user_id" = refresh_token."user_id"
  AND user_session."token_hash" = refresh_token."token_hash";

UPDATE "refresh_tokens"
SET "revoked_at" = COALESCE("revoked_at", CURRENT_TIMESTAMP)
WHERE "session_id" IS NULL;

ALTER TABLE "refresh_tokens"
ADD CONSTRAINT "refresh_tokens_session_id_fkey"
FOREIGN KEY ("session_id") REFERENCES "user_sessions"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "refresh_tokens_session_id_revoked_at_idx"
ON "refresh_tokens"("session_id", "revoked_at");

CREATE TABLE "auth_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "purpose" "auth_token_purpose" NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "consumed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "auth_tokens_token_hash_key" ON "auth_tokens"("token_hash");
CREATE INDEX "auth_tokens_user_id_purpose_expires_at_idx"
ON "auth_tokens"("user_id", "purpose", "expires_at");

ALTER TABLE "auth_tokens"
ADD CONSTRAINT "auth_tokens_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
