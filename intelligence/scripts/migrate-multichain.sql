-- Run once on an existing intelligence database, after backup and before restart.
BEGIN;
ALTER TABLE intel_tokens ADD COLUMN IF NOT EXISTS chain text NOT NULL DEFAULT 'solana';
ALTER TABLE intel_developers ADD COLUMN IF NOT EXISTS chain text NOT NULL DEFAULT 'solana';
ALTER TABLE intel_scan_requests ADD COLUMN IF NOT EXISTS chain text NOT NULL DEFAULT 'solana';
ALTER TABLE intel_tokens DROP CONSTRAINT IF EXISTS intel_tokens_mint_address_unique;
ALTER TABLE intel_developers DROP CONSTRAINT IF EXISTS intel_developers_wallet_address_unique;
CREATE UNIQUE INDEX IF NOT EXISTS intel_token_chain_identity ON intel_tokens (chain, mint_address);
CREATE UNIQUE INDEX IF NOT EXISTS intel_developer_chain_identity ON intel_developers (chain, wallet_address);
COMMIT;
