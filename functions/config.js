// Shared configuration for Cloudflare Functions
// Update model IDs here when Anthropic deprecates old versions

export const LLM_MODEL = "claude-haiku-4-5-20251001";

// Named aliases for the opportunity-scan two-model pipeline:
//   - HAIKU does the cheap relevance first-pass over noisy news volume
//   - SONNET synthesizes survivors, clusters events, cross-references CRG orgs
// Pin SONNET to a dated snapshot here if you want run-to-run stability.
export const HAIKU_MODEL = LLM_MODEL;
export const SONNET_MODEL = "claude-sonnet-5";

// The CRG administrator's registered_organizations.account_id. The session JWT's
// `sub` IS the account_id, so gated endpoints compare against this. Mirrored
// client-side in src/data/constants.js (separate bundles).
export const ADMIN_ACCOUNT_ID = 10000;
