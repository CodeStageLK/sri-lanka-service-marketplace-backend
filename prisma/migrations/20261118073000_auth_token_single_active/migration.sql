CREATE UNIQUE INDEX "auth_tokens_one_active_per_user_purpose_idx"
ON "auth_tokens"("user_id", "purpose")
WHERE "consumed_at" IS NULL;
