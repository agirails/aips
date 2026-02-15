# AIP-13: Deployment Security

**Status**: Implemented
**Author**: AGIRAILS Engineering
**Created**: 2026-02-13

## Problem Statement

A real incident exposed a systemic risk: a deployment tool extracted the raw private key from `.actp/keystore.json` and passed it as a CLI argument. The key appeared in shell history, terminal output, and process logs.

This is not an edge case. Thousands of future users will deploy to Railway, Vercel, Hetzner, Fly.io, etc. Without a platform-agnostic solution, raw key exposure will be the default failure mode.

## Solution: Three-Layer Defense

### Layer 1: Prevention

**`ACTP_KEYSTORE_BASE64`** — Pass the *encrypted* keystore blob (base64-encoded) as an env var. The runtime decrypts it using `ACTP_KEY_PASSWORD`. Two-factor security: an attacker needs both the blob AND the password.

**`ACTP_PRIVATE_KEY` policy** — Fail-closed on mainnet/unknown networks. Deprecated warning on testnet. Silent on mock.

**`actp deploy:env`** — CLI command that outputs env vars ready for any platform.

**Enhanced `actp init`** — Generates `.dockerignore` and `.railwayignore` in addition to `.gitignore`.

### Layer 2: Detection

**`actp deploy:check`** — Pre-deploy security audit that scans for raw keys in env files, Dockerfiles, CI workflows, and more.

### Layer 3: Recovery

If a key is compromised:

1. **Generate new key**: `actp init --force` (creates new keystore)
2. **Transfer funds**: Move USDC from old Smart Wallet to new one
3. **Update registry**: `actp publish` (updates on-chain config with new signer)
4. **Update env vars**: `actp deploy:env` → copy to deployment platform
5. **Revoke old key**: Remove old `ACTP_KEYSTORE_BASE64` from all platforms

## Specification

### Environment Variable: `ACTP_KEYSTORE_BASE64`

The base64-encoded content of an encrypted keystore JSON file. Combined with `ACTP_KEY_PASSWORD` for decryption.

**Resolution order** (updated):

```
1. ACTP_PRIVATE_KEY env var (policy-gated)
2. ACTP_KEYSTORE_BASE64 + ACTP_KEY_PASSWORD (deployment-safe, preferred)
3. .actp/keystore.json + ACTP_KEY_PASSWORD (local dev)
4. undefined
```

### `ACTP_PRIVATE_KEY` Policy (Fail-Closed)

Network is determined as: `options?.network ?? process.env.ACTP_NETWORK ?? null`

| Effective network | Behavior |
|---|---|
| `'mainnet'` | **HARD FAIL** — throw error |
| `null` (unknown) | **HARD FAIL** — fail-closed |
| `'testnet'` | **WARN ONCE** — deprecated, continues |
| `'mock'` | **SILENT** — no warning |

### `actp deploy:env` Command

Reads `.actp/keystore.json`, base64-encodes it, outputs env vars:

```bash
$ actp deploy:env
# Set these environment variables on your deployment platform:
ACTP_KEYSTORE_BASE64=eyJhZGRyZXNzIjoiMGY5...
ACTP_KEY_PASSWORD=<your keystore password>
```

Options: `--format shell|docker|json`, `--quiet` (just the base64 string).

### `actp deploy:check` Command

Pre-deploy security audit with FAIL/WARN severity levels.

**FAIL checks** (exit code 1):
- `.actp/` in `.gitignore`
- `.actp/` in `.dockerignore`
- No `ACTP_PRIVATE_KEY` in `.env*` files
- No raw private keys in Dockerfiles, docker-compose files
- No raw private keys in CI/workflow files (`.github/workflows/*.yml`, `railway.json`, `fly.toml`, `vercel.json`, `pm2.config.*`)
- `.actp/keystore.json` is not a symlink

**WARN checks** (exit code 0):
- `ACTP_KEYSTORE_BASE64` is set or keystore.json exists locally
- `.actp/keystore.json` file permissions are 0o600 (POSIX only)

### Separate Secret Scopes

For maximum security, store `ACTP_KEYSTORE_BASE64` and `ACTP_KEY_PASSWORD` in **different secret stores** where the platform supports it (e.g., Railway encrypted variables vs. a separate vault, different secret groups or teams). This preserves the two-factor security model: compromising one store does not compromise the key.

## Out of Scope

- `actp rotate` — key rotation command (future AIP)
- Python SDK `ACTP_KEYSTORE_BASE64` support (tracked separately)
- Runtime `process.argv` raw key detection
