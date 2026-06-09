# AGIRAILS Wow-Experience Audit — Synthesis of 8 Parallel Audits

**Audit date:** 2026-06-09
**Scope:** End-to-end new-user "Wow + Purple Cow" journey (Damir's 12-step vision)
**Inputs:** 8 parallel audits covering repo state, SDK CLI, Sentinel runtime, AGIRAILS.md doc, Platform receipt surface, share utilities, and reflection delivery
**Total findings (raw):** 161 across 8 audits → **74 deduped findings** in this report

---

## Executive Summary

**The wow flow does not work today for a brand-new user following AGIRAILS.md verbatim.** Eight independent audits converge on the same conclusion: the protocol settles transactions correctly, but the user-facing magic — the cinematic banner, the lifecycle animation, the framed receipt card, the curated reflection, the tweet offer, the 1K USDC airdrop for buyers, the claim code in the wow path — is either unimplemented, wired to dead code, or contradicted by the canonical doc. The single most damaging finding is that on testnet **the Sentinel reflection never reaches the buyer's terminal**: `BlockchainRuntime.getTransaction` hard-codes `deliveryProof: ''`, `actp test` does not construct a `deliveryChannel`, Sentinel's envelope publish is feature-flagged off, and the three independent gates close simultaneously. Even when Damir flips `ACTP_DELIVERY_CHANNEL=v1` on Railway, envelopes will still not publish because Sentinel's `Agent` constructor never receives `deliveryChannel`/`deliverySigner`/`kernelAddress`/`chainId`.

**The protocol is structurally sound; the surfaces are structurally hollow.** All the building blocks exist — `share.ts` has full tweet + clipboard + browser-open utilities; `banner.ts` renders a wireframe tetrahedron; `renderReceiptV2()` produces a double-line framed receipt card; `claim-code.ts` mints claim codes; `ErrorRecoveryGuide.ts` has 600+ lines of helpful recovery patterns; `reflections.ts` ships 76 curated A Course in Miracles entries. Every one of these is **orphaned dead code** in the wow path. `actp test` ends with three plain lines and `payload: [object Object]` (a literal bug from `output.result()` stringifying objects), no banner, no spinner, no framed card, no tweet prompt. The 4 BLOCKER-class failures are even more basic: `npx agirails` writes mock-mode config then calls testnet runTest with no keystore (crash), pay-only buyers receive 0 USDC because publish.ts short-circuits the mint for `intent: pay` agents (contradicts AGIRAILS.md line 216), `ACTP_KEY_PASSWORD` is never auto-generated despite the manual promising it would be invisible, and `actp test` is hardcoded to testnet so AGIRAILS.md Step 8's "Mock mode (default)" branch is unreachable.

**The repo is also in a fragile state that compounds audit risk.** Local SDK `main` is 19 commits behind `origin/main` — the entire AIP-18 buyer-onboarding + AA-failover work landed in parallel and is unmerged locally, including the `c6cd84b` "auto-mint 1,000 test USDC for pay-only buyers on publish" commit that addresses one of the BLOCKERs above. Platform repo has 14 untracked AIP-16 files (4 SQL migrations + new `/api/v1/delivery/` surface + 11 integration tests) at risk of being lost. Protocol/aips has an uncommitted deletion of AIP-14.md (3 commits of dispute-resolution history) plus 5 untracked drafts. Sentinel has an uncommitted tsconfig module-resolution change (commonjs → node16) unrelated to AIP-16 that could break the Railway build silently. **All audit findings below MUST be verified against `origin/main` of the SDK, not local HEAD**, before any merge plan is executed.

---

## Repo Conflict Snapshot (overlap with AIP-16)

| Repo | State | Risk | Action |
|---|---|---|---|
| `SDK and Runtime/sdk-js` | Local HEAD `35f640e` (4.4.2 era), origin/main `ca7d012` (4.4.9). 19 commits unmerged. AIP-16 work in local working tree, AIP-18 work in origin/main. | `package.json` version guaranteed merge conflict (local 4.5.0 vs remote 4.4.9). AIP-18 includes 1K USDC auto-mint for pay-only buyers (THE behavior in finding #4 below). | Branch local AIP-16 work, rebase onto `origin/main`, keep version 4.5.0 + `./delivery` export, verify auto-mint behavior survives merge. |
| `Platform/agirails.app/web` | Synced with origin but 14 untracked AIP-16 files (4 SQL migrations 00036-00039, new `app/api/v1/delivery/`, 6 modified files inc. H4 nonce-passthrough fix). | If working tree destroyed, all AIP-16 platform work disappears. New user's Wow flow depends on `/api/v1/delivery/{txId}`. | Immediately branch + commit + push as `aip16/platform-phase-2e` (do not wait for review). |
| `Public Agents/seed-sentinel` | 3 uncommitted files: README.md + sentinel.md (AIP-16 aligned), tsconfig.json (commonjs → node16, UNRELATED, build-affecting). | tsconfig change could break Railway build silently if any bare relative imports exist. Sentinel.md `delivery: {mode: channel}` block is forward-looking dead config until SDK 4.5.0 publishes. | Split into 2 commits: docs branch + tsconfig branch. Verify Railway build before deploy. |
| `Protocol/aips` | Uncommitted deletion of AIP-14.md (3 commits of history). 5 untracked drafts (AIP-15/16/17 + Phase 3/4 reviews). | AIP-14 referenced from AIP-2 and AIP-5; silent deletion breaks 100-year hyperstructure promise. Drafts only exist on Damir's laptop. | Decide AIP-14 fate explicitly (archive vs restore). Commit all drafts on `aip16/draft-and-reviews` branch. |
| `Protocol/actp-kernel` | Clean. | None. | None. |

---

## CRITICAL DECISION: Does the wow flow work TODAY?

**No.** Without intervention, a brand-new user following AGIRAILS.md verbatim encounters AT LEAST 4 BLOCKER-class failures before any wow moment occurs. Even on a perfect-conditions run, the central wow payoff (the Sentinel reflection arriving in the terminal) is silently dropped because three independent delivery-path gates all close.

**Minimal change to make it work TODAY (no Railway flag flip needed):**

1. **Vendor the deterministic-per-day reflection table into the SDK** as `src/cli/lib/sentinelReflections.ts` (76 entries, ~5 KB). In `test.ts` after SETTLED, when `provider === SENTINEL_ADDRESS` AND `reflection === undefined`, compute `todaysReflection()` locally and display it with a small caveat ("rendered from local cache — channel delivery activates when ACTP_DELIVERY_CHANNEL flips"). This single fix delivers the wow moment robust to any transport failure and takes ~60 minutes.

2. **Fix `npx agirails` crash** by either (a) running a real `runInit({mode: 'testnet'})` before `runTest()` so a keystore exists, or (b) running `runTest()` in mock mode against a mocked Sentinel. Without this, the very first onboarding command crashes.

3. **Auto-generate `ACTP_KEY_PASSWORD`** to `.env` in `init.ts` when missing. Without this, non-TTY init crashes.

4. **Either fix pay-only USDC mint** (port `c6cd84b` from `origin/main` — it's already written, just unmerged) OR update AGIRAILS.md line 216 to drop the buyer-mint promise. Without one of these, every buyer-mode user hits "insufficient USDC" on first test.

5. **Wire `share.ts` into `test.ts`** — the tweet offer is 4 lines of glue.

6. **Render the framed receipt card** by calling the already-built `renderReceiptV2()` from `test.ts`.

After these 6 changes (~200 LOC), the wow flow runs end-to-end on testnet with no operational dependency on Damir.

**Missing wow steps today (Damir's 12-step vision):**

1. Wallet creation with 1K testnet USDC — broken for buyers (`isPayOnly` skips mint)
2. Gentle onboarding without errors — crashes at password prompt or testnet/mock mismatch
3. Sentinel test transaction offered — works mechanically but in mock-mode crash path
4. Wallet shows 1K — never shown (no balance panel)
5. Claim code communicated nicely — only printed during publish, never during wow path
6. State machine executes without errors — works
7. Sentinel reflection shown beautifully — REFLECTION NEVER ARRIVES on testnet
8. Random quote display with wow effect — printed as single dim line, no frame
9. Confirmation all settled — buried in `[+] Settled in Xms`
10. Link to web receipt — printed as bare text, silently null on push failure
11. Offer to tweet first transaction — totally absent (share.ts unused)
12. Brand polish + Purple Cow moment — flat ASCII output, no banner, no animation

---

## Findings by Severity

### BLOCKER (user cannot complete the flow)

#### B1. `npx agirails` writes mock-mode config then calls testnet `runTest()` with no keystore → guaranteed crash on first run
**Confirmed by:** Audits 2, 3, 4, 7, 8
**Surface:** `SDK and Runtime/sdk-js/src/cli/agirails.ts:162-184` → `cli/commands/test.ts:127,146` → `cli/lib/runRequest.ts:298-300`
**Description:** The unified wizard saves `{mode: 'mock', address: Wallet.createRandom().address}` (no keystore), then immediately calls `runTest()` which hardcodes `network: 'testnet'`. `resolvePrivateKey(stateDirectory, {network: 'testnet'})` returns undefined → `ACTPClient.create({mode: 'testnet', privateKey: undefined})` either crashes or signs against a fake EOA which the kernel rejects.
**Fix:** Restructure `agirails.ts` to invoke `runInit({mode: 'testnet', wallet: 'auto'})` before `runTest()`, OR run `runTest()` in mock mode against `MockRuntime` with a stubbed Sentinel that returns a vendored daily reflection.

#### B2. Pay-only buyers receive 0 USDC on `actp publish` — contradicts AGIRAILS.md line 216
**Confirmed by:** Audits 2, 3, 7
**Surface:** `cli/commands/publish.ts:549-565` (`isPayOnly` short-circuit) vs `AGIRAILS.md:216`
**Description:** AGIRAILS.md promises "Buyers (intent: pay) receive 1,000 test USDC automatically on actp publish (AIP-18 DEC-8)." Publish.ts comment says the opposite: "Pay-only short-circuit ... no test USDC minted." Buyers (the exact persona of Damir's wow demo) get 0 USDC, then `actp test` reverts at `linkEscrow` on insufficient USDC.
**Fix:** Port `origin/main` commit `c6cd84b` (already written in unmerged AIP-18 work) OR add a `mintBuyerTestUsdc()` sibling to `activateOnTestnet()` that only runs `buildTestnetMintBatch`. Update paymaster allowlist for MockUSDC on pay-only smart wallets if not already set.

#### B3. `ACTP_KEY_PASSWORD` is never auto-generated → init crashes in non-TTY contexts
**Confirmed by:** Audits 3, 5, 8
**Surface:** `cli/utils/wallet.ts:30-41,93-109` + `AGIRAILS.md:304-310`
**Description:** AGIRAILS.md says "Password is auto-generated and saved to .env — user does not need to see or enter it." `generateWallet()` reads `process.env.ACTP_KEY_PASSWORD`; if absent, `promptPassword()` echoes plaintext to terminal (security issue) or returns "" in non-TTY (crash). The SDK never loads `.env` (no `dotenv` import in `src/cli/index.ts`), so even if the user/LLM writes the password to `.env`, the SDK doesn't read it.
**Fix:** (a) In `init.ts` before `generateWallet`: if `ACTP_KEY_PASSWORD` unset, generate `crypto.randomBytes(32).toString('base64')`, append to `.env`, ensure `.env` in `.gitignore`, set `process.env.ACTP_KEY_PASSWORD`. (b) Add `import 'dotenv/config'` to `src/cli/index.ts`. (c) Add round-trip verification (decrypt the just-written keystore to catch typos/disk-fail).

#### B4. `actp test` is hardcoded to testnet → AGIRAILS.md "Mock mode (default): execute npx actp test" is unreachable
**Confirmed by:** Audits 2, 3, 4, 8
**Surface:** `cli/commands/test.ts:127,146` vs `AGIRAILS.md:644-646`
**Description:** AGIRAILS.md Step 8 distinguishes three modes (mock/testnet/mainnet). `test.ts` hardcodes `resolveAgent('sentinel', 'base-sepolia')` and `runRequest({network: 'testnet'})`. A mock-mode user (the documented default) running `actp test` crashes with "no wallet for testnet."
**Fix:** Read `CLIConfig.mode` from `.actp/config.json`. For mock: run a mock simulation against `MockRuntime` returning `todaysReflection()`. For mainnet: refuse with "actp test is testnet-only by design." For testnet: current behavior.

#### B5. `actp test` requires testnet ETH for `linkEscrow` UserOp but no paymaster validation at init time → silent fallback to EOA which has 0 ETH → cryptic revert
**Confirmed by:** Audits 3
**Surface:** `cli/lib/runRequest.ts:550-553` + `ACTPClient.ts:976` ("Falling back to EOA wallet")
**Description:** If `CDP_API_KEY` / `PIMLICO_API_KEY` are not set, AA stack falls back to EOA. Fresh EOA has 0 ETH → `linkEscrow` reverts with "insufficient funds for gas * price + value."
**Fix:** Validate paymaster URL reachability in init.ts entry. If unreachable, fail closed with explanatory message OR ship a small init-time micro-faucet that drips 0.0005 ETH to fresh EOAs. Surface paymaster fallback as visible warning.

#### B6. Sentinel `/diag` shows 4633 declined transactions, 0 completed in 13 hours — production traffic is broken
**Confirmed by:** Audit 5
**Surface:** Live `https://seed-sentinel-production.up.railway.app/diag`
**Description:** Every payment in past 13 hours filtered out as `$1 below min $10`. ZERO successful settlements since boot. The wow flow has literally never run end-to-end against current Sentinel. Some example/SDK/n8n default is sending $1, not $10.
**Fix:** Investigate `$1` source (grep sdk-examples, OpenClaw default, public agents). Fix `sentinel.md` doc/code 200x drift (prose says $0.05-$10, code enforces $10-$100). Add CI healthcheck POSTing `actp test` every 6h; alert on <95% success.

#### B7. Receipt push 404s for fresh buyer Smart Wallet — receiptUrl silently null
**Confirmed by:** Audit 7
**Surface:** `Platform/agirails.app/web/lib/receipts/auth.ts:256-265` + `cli/lib/runRequest.ts:752-767`
**Description:** Buyer-side V2 receipt push requires buyer's wallet to exist in `agents` table. A new user who ran `actp init -m testnet` but NOT `actp publish` has zero rows → 404 → receiptUrl: null → test.ts silently skips "Receipt:" line.
**Fix:** Platform: auto-mint `claimable_receipt` agent stub keyed on controlled wallet instead of 404. SDK: log warning when receiptUrl is null; print fallback message "Receipt will appear at ... within 5 min."

---

### WOW-BLOCKER (completes but loses the magic)

#### W1. Sentinel reflection NEVER reaches buyer's terminal on testnet (THE central wow moment is dead)
**Confirmed by:** Audits 2, 4, 5, 7
**Surface:** `BlockchainRuntime.ts:664` (`deliveryProof: ''` hardcoded) + `cli/lib/runRequest.ts:386,694-696` + `Agent.ts:1886` (`ACTP_DELIVERY_CHANNEL` flag) + `seed-sentinel/agent.ts:93-100` (Agent constructor missing delivery deps)
**Description:** Three independent gates close: (1) `actp test` doesn't pass `deliveryChannel`/`expectedKernelAddress`/`expectedChainId` to `runRequest`, so envelope subscription is disabled buyer-side; (2) Sentinel only publishes envelopes when `ACTP_DELIVERY_CHANNEL === 'v1'` AND its `Agent` constructor receives `deliveryChannel`+`deliverySigner`+`kernelAddress`+`chainId` (it doesn't); (3) legacy fallback reads `tx.deliveryProof` which is hardcoded empty string. Result: SETTLED succeeds, `[+] Settled in Xms` prints, reflection never displays.
**Fix:** Three-layer defense:
- **Layer 1 (deterministic-local fallback, ships TODAY):** Vendor `reflections.ts` table into SDK; when provider === Sentinel AND payload undefined, compute `todaysReflection()` locally and display.
- **Layer 2 (HTTP side-channel, ~1 day):** After SETTLED, GET `https://seed-sentinel-production.up.railway.app/reflection/today` as backstop.
- **Layer 3 (AIP-16 channel, ~3 days):** Wire `deliveryChannel: new RelayDeliveryChannel(...)` into Sentinel's Agent constructor; pass delivery params from `test.ts` to `runRequest`; flip Railway flag.

#### W2. Tweet/share offer entirely missing — `share.ts` is dead code (~135 LOC of orphaned utilities)
**Confirmed by:** Audits 2, 3, 4, 5, 6, 7, 8
**Surface:** `cli/utils/share.ts` (buildMockTweet, buildTestnetTweet, buildTwitterIntentUrl, copyToClipboardOSC52, openUrl — zero callers) vs Damir's vision step 12 + `AGIRAILS.md:687-728`
**Description:** Strongest viral signal AGIRAILS has — first-tx tweet — has zero wiring. AGIRAILS.md Step 9 documents `Copy tweet / Open Twitter / Skip` interactive menu that does not exist.
**Fix:** Append interactive share prompt at end of `runTest()` (TTY + human-mode only): readline asks `[c]opy / [o]pen Twitter / [s]kip`; call `copyToClipboardOSC52` + `openUrl(buildTwitterIntentUrl(buildTestnetTweet(netAmount, ethTxHash)))`. Thread `ethTxHash` through `RunRequestResult` (currently dropped).

#### W3. Promised cyan banner, lifecycle animation, double-line framed receipt card — NONE rendered by `actp test`
**Confirmed by:** Audits 2, 3, 5, 6, 7, 8
**Surface:** `cli/commands/test.ts:130-200` vs `AGIRAILS.md:648` ("cyan-framed wireframe tetrahedron banner, state-by-state lifecycle animation with rotating spinner and timing, double-line framed receipt card with fee breakdown")
**Description:** `renderReceiptV2()` exists in `cli/commands/receipt.ts:77` with full FIRST TRANSACTION RECEIPT layout — has ZERO callers. `renderBanner()` exists in `banner.ts` — called by `init.ts` and `agirails.ts`, never by `test.ts`. `output.spinner()` exists — not used in `test.ts`. The wow climax prints as flat key:value lines.
**Fix:** Call `inlineBanner('Onboarding via Sentinel')` at top of `runTest()`; replace per-state console.log with rolling `output.spinner()`; call `renderReceiptV2(...)` after SETTLED; render reflection in dedicated cyan-framed quote block above receipt.

#### W4. Reflection printed as bare `[+] Reflection: ...` one-line success message — no frame, no ceremony
**Confirmed by:** Audits 2, 5, 6, 8
**Surface:** `cli/commands/test.ts:186-192`
**Description:** Same `[+]` prefix used by every other CLI success line — wow climax indistinguishable from log noise.
**Fix:** Add `output.quote(text, {title})` helper to Output class (box-drawing ╔═╗ with cyan border). Use it in test.ts post-SETTLED for the reflection. Damir's "lijepo prikazan" requires deliberate visual hierarchy.

#### W5. `payload: [object Object]` printed verbatim in human mode
**Confirmed by:** Audits 2, 4, 6
**Surface:** `cli/commands/test.ts:160-171` + `cli/utils/output.ts:245-249`
**Description:** `output.result({...payload, ...})` iterates keys in human mode; `keyValue()` does `String(value)` which on an object produces `[object Object]`. Visible eyesore at the wow moment.
**Fix:** Drop `payload` from `output.result()` human-mode call (keep only for JSON mode). Add object-guard to `keyValue()`: `typeof value === 'object' ? JSON.stringify(value) : String(value)`.

#### W6. Reflection printed TWICE (once via `output.result()`, once via `output.success()`)
**Confirmed by:** Audits 2, 6
**Surface:** `cli/commands/test.ts:160-188`
**Description:** Same reflection text appears two times back-to-back with different formatting, separated by `payload: [object Object]` and receiptUrl. Looks broken.
**Fix:** Remove `reflection` key from `output.result()` call; reflection rendered only in dedicated framed block.

#### W7. Receipt URL printed as bare uncolored text — no underline, no click affordance, no "open in browser?" offer
**Confirmed by:** Audits 3, 6, 8
**Surface:** `cli/commands/test.ts:197-200`
**Description:** `output.print(\`Receipt: ${url}\`)` — looks like debug log. Also duplicated above by `output.result()`. `openUrl()` helper exists in `share.ts` (unused).
**Fix:** Frame in cyan box with `fmt.underline`, add interactive "Open receipt in browser? [Y/n]" prompt calling `openUrl()`.

#### W8. Claim code missing from wow flow entirely
**Confirmed by:** Audits 3, 4, 6, 7, 8
**Surface:** Damir's vision item #5 + `AGIRAILS.md:200` + only emission point `publish.ts:763-768`
**Description:** Damir's spec: "sve je iskomunicirano lijepo uključujući claim code." Wow path (init → test) never surfaces claim code. Even when shown (publish.ts), it's bare three lines with no celebration, no copy-to-clipboard, no CTA.
**Fix:** Reorder agirails.ts flow: publish FIRST (which mints USDC + emits claim code in framed box), THEN test. Render claim code in framed panel with OSC 8 hyperlink + `copyToClipboardOSC52(claimUrl)`.

#### W9. No fallback to deterministic-local reflection — channel failure = silent wow death
**Confirmed by:** Audits 4, 5, 7
**Surface:** `cli/commands/test.ts:186-192`
**Description:** Sentinel's reflection IS deterministic per UTC day (public table, public algorithm). When envelope channel fails (transport, schema, race), SDK could recompute locally — doesn't.
**Fix:** Import deterministic table into SDK as `cli/lib/sentinelReflections.ts`. When `provider === SENTINEL_ADDRESS` AND `reflection === undefined` AND `settled === true`, compute `todaysReflection()` locally and display with caveat.

#### W10. Receipt page on agirails.app doesn't surface the reflection — viral artifact has no soul
**Confirmed by:** Audit 5
**Surface:** `Platform/agirails.app/web/app/r/[id]/page.tsx` + `receipt-card.tsx` (no reflection branch)
**Description:** Receipt URL shared on Twitter/Slack lands on a generic settled-payment card. Reflection exists only in terminal scrollback. OG image also lacks reflection text.
**Fix:** When `receipt.agent_slug_snapshot === 'sentinel'`: fetch matching day's reflection (or include in `pushReceiptOnSettled` metadata), render serif/italic callout above receipt card. Update `opengraph-image.tsx` to include reflection — that's what propagates to Twitter cards.

#### W11. Per-state ISO timestamps + 66-char txIds = log-file aesthetic, not animated lifecycle
**Confirmed by:** Audits 2, 4, 5, 6
**Surface:** `cli/commands/test.ts:148-151`
**Description:** Output: `[2026-06-09T14:23:45.123Z] INITIATED 0xa...d64` — ~110 chars wide, wraps, looks like tail -f.
**Fix:** Rolling spinner: `let s = output.spinner('INITIATED → quoting…'); onTransition = (state) => { s.stop(true); s = output.spinner(\`${state} (\${elapsedSec}s)\`); }`. Use `formatState()` colors. Drop ISO+txId from human mode.

#### W12. No "first transaction!" celebration framing — settled message identical to any subsequent run
**Confirmed by:** Audits 2, 4, 5, 6
**Surface:** `cli/commands/test.ts:186-200`
**Description:** Damir explicitly: "PRVA transakcija." No "first-time" detection, no extra-bold celebration line, no economic explanation ("you just paid Sentinel $10 USDC autonomously, trustlessly, in <Xs>").
**Fix:** Persist counter at `.actp/onboarding-state.json`. On FIRST settled: print "★ Your first autonomous agent payment is on-chain" + economic summary + auto-trigger tweet offer. Subsequent runs: suppress tweet offer.

---

### HIGH (significant friction)

#### H1. No retry/resume on transient errors; QuoteTimeoutError points to non-existent `actp tx cancel`
**Confirmed by:** Audits 4, 7
**Surface:** `cli/lib/runRequest.ts:202-210` (error message references `actp tx cancel <txId>`); `grep` shows no `tx-cancel.ts`, no `actp tx` namespace
**Fix:** Either implement `actp tx cancel` as thin wrapper around `client.standard.cancelTransaction()`, OR rewrite error to point at actual recovery path. Add retry-with-backoff (3 attempts) to createTransaction/linkEscrow. Resume open INITIATED tx on rerun.

#### H2. QuoteTimeoutError fires after `linkEscrow` already locked $10 — user funds stuck for 1h deadline, error says "cancel" without explaining lock
**Confirmed by:** Audits 4, 8
**Surface:** `cli/lib/runRequest.ts:550-553,202-210`
**Fix:** Check `tx.state` first: if COMMITTED, message: "Your $10 is in escrow. Auto-refunds at deadline <ts>. To force-cancel, ..."; if INITIATED, current behavior. Better: don't `linkEscrow` until provider confirms via AIP-2.1 negotiation channel.

#### H3. No Sentinel `/health` preflight — user pays gas+USDC on cold-started Sentinel before learning it's offline
**Confirmed by:** Audits 4, 7, 8
**Surface:** `cli/commands/test.ts:127-152` + `seed-sentinel/agent.ts:352-368`
**Fix:** Before `runRequest`, GET `/health` with 10s timeout; if 503 or timeout, poll for up to 45s with "Sentinel warming up..." spinner. Only then proceed.

#### H4. Default 30s envelope grace blocks wow when envelope arrives late/never — dead-air at the climax
**Confirmed by:** Audits 4, 7
**Surface:** `cli/lib/runRequest.ts:616`
**Fix:** Lower default to 5_000ms (5 rounds of 1s relay poll). Add live status: "Waiting for reflection envelope… (Xs/5s)." Fall through to deterministic-local reflection on timeout. Pass `wait: 4` long-poll to RelayChannel.

#### H5. `ethTxHash` not exposed on `RunRequestResult` — tweet template can't render real BaseScan link
**Confirmed by:** Audits 2, 4, 5, 6
**Surface:** `cli/lib/runRequest.ts:230-265`
**Fix:** Capture from `releaseEscrow` receipt at line 709, return `settlementTxHash: string | null` in result. Use in `buildTestnetTweet()` for full URL (not truncated).

#### H6. Receipt push silently swallows all errors — user has no clue why URL is missing
**Confirmed by:** Audits 4, 8
**Surface:** `receipts/push.ts:108-209`
**Fix:** Distinguish failure modes (`pushFailure?: 'prepare_failed' | 'post_failed' | 'network'`). Log with sdkLogger.warn. Surface in CLI as "Receipt minting now (check ~5min)." Add preflight ping to `/api/health`.

#### H7. Default RPC `sepolia.base.org` is heavily rate-limited — first impression is 503 errors
**Confirmed by:** Audit 8
**Surface:** `config/networks.ts:15`
**Fix:** Default fallback chain: `BASE_SEPOLIA_RPC` env → CDP RPC → Alchemy free-tier → sepolia.base.org. Add backoff to `POLL_INTERVAL_MS` (1s → 2s → 4s → 8s).

#### H8. Paymaster errors surface as opaque AA hex codes (AA34, AA22, etc.)
**Confirmed by:** Audit 8
**Surface:** `wallet/aa/PaymasterClient.ts` + `cli/commands/test.ts` catch path
**Fix:** Add AA-error pattern to `ErrorRecoveryGuide.ts`. Probe paymaster `/sponsorshipPolicy` before on-chain call; fallback to EOA on unavailable.

#### H9. AGIRAILS.md Step 9 testnet tweet template uses `sepolia.basescan.org/tx/<ethTxHash>` — LLM has no ethTxHash to substitute (broken URL)
**Confirmed by:** Audit 2
**Surface:** `AGIRAILS.md:709-718`
**Fix:** Combine with H5 (expose `settlementTxHash`); switch template to receipt URL.

#### H10. `offerPostInitTest` requires identity file but init never creates one — test offer dead-ends
**Confirmed by:** Audits 3, 8
**Surface:** `cli/commands/init.ts:413-451`
**Fix:** Either auto-create minimal `{slug}.md` from flags, OR have `offerPostInitTest` use synthetic Sentinel onboarding service (no local identity needed).

#### H11. Init's post-init test prompt races publish-gated paymaster — Smart Wallet has 0 ETH, sponsorship denied
**Confirmed by:** Audit 8
**Surface:** `cli/commands/init.ts:413-451`
**Fix:** Before "Run a test transaction now?", check AgentRegistry publish state; if not published, change prompt to "Publish on-chain + run a test transaction now?" calling `runPublish()` first.

#### H12. Sentinel/code/doc 200x price drift — sentinel.md prose says $0.05-$10, code enforces $10-$100
**Confirmed by:** Audit 5
**Surface:** `seed-sentinel/sentinel.md:38-40, L83` + `agent.ts:7-8`
**Fix:** Align to $10-$100 (matches code + published config_hash). Have agent.ts read constants from parsed sentinel.md frontmatter.

#### H13. Sentinel envelopes won't publish even when flag ON — Agent constructor lacks delivery deps
**Confirmed by:** Audit 5
**Surface:** `seed-sentinel/agent.ts:93-100` + `Agent.ts:1895-1902` (early-return guard)
**Fix:** Wire `deliveryChannel: new RelayDeliveryChannel(...)`, `deliverySigner`, `kernelAddress`, `chainId` in agent.ts constructor. Add `/health` exposure of `aip16: {flag, ready}`.

#### H14. Sentinel dual-publish race — envelope publish may fire AFTER state transition to IN_PROGRESS, dropped silently
**Confirmed by:** Audit 7
**Surface:** `level1/Agent.ts:1700-1762, 1916-1947`
**Fix:** Remove early-return on state mismatch (buyer subscriber dedups). Wrap publish in 2s timeout, queue background retry. Add `POST /republish/{txId}` endpoint gated by signed buyer challenge.

#### H15. Slow RPC has no progress indicator — `Computing Smart Wallet address...` is static info() line; scrypt KDF can take 8+s
**Confirmed by:** Audit 3
**Surface:** `cli/utils/wallet.ts:81-84, :44`
**Fix:** Wrap both with `output.spinner()` (helper exists, unused here).

#### H16. `--force` overwrites keystore without warning user about permanent fund loss
**Confirmed by:** Audit 3
**Surface:** `cli/commands/init.ts:98-103`
**Fix:** Detect existing keystore, throw with explicit consequences message + extra confirmation prompt when `--force` + keystore.json exists.

#### H17. Init prints both EOA + Smart Wallet address with no labeling — user doesn't know which to share
**Confirmed by:** Audit 3
**Surface:** `cli/utils/wallet.ts:52, :84` + `init.ts:247-250`
**Fix:** Label EOA as "Signer key (internal)"; label Smart Wallet as "Your agent's public address ← share this."

#### H18. AGIRAILS.md doc/CLI mismatch on init mint amount (10K mock-only at init vs 1K testnet at publish)
**Confirmed by:** Audit 3
**Surface:** `AGIRAILS.md:212,1191` vs `init.ts:299-311, publish.ts:975-981`
**Fix:** Rewrite doc table row 212 + troubleshooting row 1191 with actual amounts/timing/commands.

#### H19. `runRequest` legacy fallback yields silent undefined — no observability into why reflection missing
**Confirmed by:** Audit 5
**Surface:** `cli/lib/runRequest.ts:694-696` + `BlockchainRuntime.ts:664`
**Fix:** When `payload === undefined && network !== 'mock'`, `logger.warn('No delivery payload could be decoded. AIP-16 envelope disabled (no deliveryChannel passed) and BlockchainRuntime returns empty deliveryProof.')`.

#### H20. BlockchainRuntime.getTransaction hardcodes `deliveryProof: ''` — architectural root cause; legacy fallback is dead code on real networks
**Confirmed by:** Audits 1, 2, 4, 5, 7
**Surface:** `BlockchainRuntime.ts:664`
**Fix:** Implement EAS attestation read (DeliverySchema 0x166501e7...). Until then, return `undefined` (not `''`) to make the empty state explicit and update comment to issue link.

#### H21. JSON/quiet modes silently drop receipt URL — power users lose share artifact
**Confirmed by:** Audits 6, 8
**Surface:** `cli/commands/test.ts:170` + `utils/output.ts:345-352`
**Fix:** Extend quiet mode to print `<reflection>\n<receiptUrl>`. Extend `RunRequestResult` with `tweet: {text, intentUrl}`, `basescan: {txHash, url}`, `fee: {amount, fee, net}`, `agent: {slug, address, name}` for `--json` consumers.

#### H22. Inscrutable error messages — Sentinel offline, RPC blip, gas insufficient all look the same
**Confirmed by:** Audit 4, 8
**Surface:** `cli/commands/test.ts:50-110` + `cli/lib/runRequest.ts:202-225`
**Fix:** Reassuring framed error blocks: "Sentinel didn't respond in time — it's the public test agent and gets restarted occasionally. Try again in 30s. No funds at risk." Wire `ErrorRecoveryGuide.formatGuidance()` into mapError.

#### H23. Init's interactive prompt only asks 3 of 11 documented `onboarding.questions` schema fields
**Confirmed by:** Audit 2
**Surface:** `cli/agirails.ts:78-99` vs `AGIRAILS.md:45-145`
**Fix:** Add `intent` (earn/pay/both) + conditional capability/budget questions. Or drop wizard, let LLM drive per AGIRAILS.md Step 2.

#### H24. Receipt page returns 404 within ~5min indexer window — clicking link 30s after settle fails
**Confirmed by:** Audit 8
**Surface:** `Platform/agirails.app/web/app/r/[id]/page.tsx:53-55`
**Fix:** When `getPublicReceipt` returns null and receipt < 60s old, render "Receipt being verified — refresh in a moment" with auto-refresh, then notFound. Fix replication consistency for fresh receipts.

#### H25. AGIRAILS.md says `actp test | Run ACTP integration tests` (wrong) — actual purpose is real onboarding tx
**Confirmed by:** Audit 2
**Surface:** `AGIRAILS.md:1175` vs `test.ts:41`
**Fix:** Update doc row to: `actp test | Run a real $10 onboarding payment to Sentinel on Base Sepolia (the "wow" first-tx flow)`.

---

### MED (rough edges)

#### M1. Reflection is deterministic-per-UTC-day — contradicts "random" promise; back-to-back demos show same quote
**Confirmed by:** Audits 2, 5, 7, 8
**Surface:** `reflections.ts:97-121`
**Fix:** Either (a) change to `keccak256(txId) % 76` (per-tx random, still deterministic for testability) — recommended; (b) keep daily but reframe doc as "today's synchronicity"; (c) full `Math.random()`.

#### M2. ANSI color codes written to non-TTY pipelines — AGIRAILS.md tells LLM to redirect to `/tmp/file`, ANSI becomes garbage
**Confirmed by:** Audits 5, 7, 8
**Surface:** `cli/utils/output.ts:108-115` + `AGIRAILS.md:650-680`
**Fix:** Detect `!process.stdout.isTTY || NO_COLOR` in Output constructor; no-op color functions. Add `--no-color` flag. Update AGIRAILS.md to use `FORCE_COLOR=1` if colors desired.

#### M3. Sentinel handler artificial 1-2s sleep — wasted time in "under 60s" flow
**Confirmed by:** Audit 5
**Surface:** `seed-sentinel/agent.ts:116-117`
**Fix:** Drop to 100ms or remove.

#### M4. No spinner during long pauses (15s+ between transitions) — looks like hang
**Confirmed by:** Audits 4, 8
**Surface:** `test.ts:148-151` + `runRequest.ts:851-892`
**Fix:** Wrap each phase in `output.spinner()`; inject hint every 5s without state change.

#### M5. No initial "this will spend $10 USDC" consent banner — surprise spending
**Confirmed by:** Audit 4
**Surface:** `test.ts:131-151`
**Fix:** Print "→ About to send $10 USDC test transaction. Settled funds returned ($9.90 net after 1% fee). Press Enter to continue or Ctrl+C." Add pre-flight balance check.

#### M6. No balance celebration after 1K USDC mint — buried in `[+] Minted 1,000 test USDC`
**Confirmed by:** Audit 2
**Surface:** `cli/commands/publish.ts` post-mint
**Fix:** Render balance panel: "◬ Your testnet wallet is funded: <addr> | 1,000.00 USDC | Base Sepolia | Gas sponsored."

#### M7. AGIRAILS.md Step 9 mock tweet text claims "earned $9.90" — mock mode has no on-chain settlement (misleading)
**Confirmed by:** Audit 8
**Surface:** `share.ts:108-117` + `AGIRAILS.md:699-706`
**Fix:** `buildMockTweet` reframes: "My AI agent ran its first ACTP transaction in 60 seconds. Mock mode — try testnet next: curl ..."

#### M8. ErrorRecoveryGuide.ts rich but never wired to CLI
**Confirmed by:** Audit 8
**Surface:** `utils/ErrorRecoveryGuide.ts` (excellent, unused)
**Fix:** Append `ErrorRecoveryGuide.analyze(error).recoverySteps` to mapError output. Add patterns: keystore, sentinel-cold, paymaster-reject, rate-limit, quote-timeout, delivery-timeout, chain-mismatch.

#### M9. No "open receipt in browser?" interactive prompt
**Confirmed by:** Audits 6, 8
**Surface:** `test.ts:197-200`
**Fix:** Combine with tweet prompt as single "What next?" menu: `[r]open receipt / [t]weet / [c]opy tweet / [s]kip`.

#### M10. `actp init` doesn't write `.env` — password lives only in shell history
**Confirmed by:** Audit 3
**Surface:** `cli/commands/init.ts:335-340`
**Fix:** When init resolves password, write to `.env` with `chmod 600` if `.env` absent.

#### M11. `--address` bypass produces no-key config — every subsequent command fails
**Confirmed by:** Audit 3
**Surface:** `cli/commands/init.ts:230-263`
**Fix:** Require `--key-source env` or `--watch-only` with `--address`. Throw at init if neither.

#### M12. AGIRAILS.md Step 8 contradicts itself on mainnet handling (line 646 says skip, line 678 allows entering Step 9)
**Confirmed by:** Audit 2
**Fix:** Explicit `if (mode === 'mainnet') return early` at top of Step 8 and Step 9.

#### M13. Confirmation template doesn't show wallet preview/estimated cost — user confirms blind
**Confirmed by:** Audit 2
**Surface:** `AGIRAILS.md:131-141`
**Fix:** Add "Wallet (will be created): Smart Wallet on Base Sepolia | Starting balance: 1,000 test USDC (auto-minted) | Gas: sponsored by AGIRAILS paymaster."

#### M14. Init scans cwd for `*.md` synchronously — fails or slow in large project roots
**Confirmed by:** Audit 3
**Fix:** Cap top-level scan with `fs.statSync(file).size < 64KB` guard.

#### M15. Banner renders even when piped — corrupts logs with ANSI
**Confirmed by:** Audit 3
**Fix:** Suppress when `!process.stdout.isTTY` (same gate `output.spinner` uses).

#### M16. Sentinel `extractReflection` handles only 2 payload shapes — real provider emits at least 4
**Confirmed by:** Audit 4
**Surface:** `test.ts:203-214`
**Fix:** Walk shapes: `payload.reflection`, `payload.result.reflection`, `payload.body.reflection`, `payload.signed.body` → JSON.parse. Add regex fallback. Unit test per shape.

#### M17. Delivery payload decoder silently falls back on envelope_decrypt_failed
**Confirmed by:** Audit 7
**Surface:** `cli/lib/runRequest.ts:641-696`
**Fix:** On decode fail, surface user message + render partial receipt + footer "Reflection unavailable — see receipt."

#### M18. No claim-code surface in receipt URL OG image
**Confirmed by:** Audit 5 + W10
**Fix:** Same as W10 — propagate reflection text into OG image.

#### M19. Settled confirmation suppressed when reflection exists — `Settled in Xms` lost in happy path
**Confirmed by:** Audit 6
**Surface:** `test.ts:186-192` (if/else)
**Fix:** Always print settled-confirmation; separately print reflection box.

#### M20. Output.result format leaks debug fields (`finalState`, `settled`, `elapsedMs`) — 7 lines where 1 matters
**Confirmed by:** Audit 2
**Surface:** `test.ts:160-170`
**Fix:** Hand-roll human-mode output; full structured object only in `--json`.

#### M21. Init "Gas-free transactions enabled" with no context (who pays, how long)
**Confirmed by:** Audit 3
**Fix:** Append: "(sponsored by AGIRAILS Paymaster on Base — covers ACTP escrow + x402 relay calls; you never need to hold ETH)."

#### M22. No verify round-trip after keystore write — silent disk-fail surfaces as "invalid password" later
**Confirmed by:** Audit 3
**Fix:** After `fs.writeFileSync(keystorePath, ...)`, decrypt round-trip and assert address matches.

#### M23. ISO timestamps in state-transition lines ugly + noisy
**Confirmed by:** Audit 4
**Fix:** Replace with elapsed-from-start: `✓ INITIATED (+0s)`, `✓ COMMITTED (+2s)`, etc.

#### M24. Init prints "Next steps" robot cheatsheet — feels impersonal
**Confirmed by:** Audit 3
**Fix:** Reframe as single intent-aware recommendation under collapsible "Other commands."

#### M25. AGIRAILS.md Step 8 redirect to `/tmp/agirails-actp-test-output.txt` fails on Windows
**Confirmed by:** Audit 4
**Fix:** Use cross-platform pattern (`os.tmpdir()` or `2>&1 | tee actp-output.txt`).

#### M26. AGIRAILS.md Step 6 instructs LLM to show "Balance" — fails before publish or with sponsored gas
**Confirmed by:** Audit 2
**Surface:** `AGIRAILS.md:614-619`
**Fix:** "Run `actp balance --json`. If it errors, fall back to `actp config show --json` and report 'Smart Wallet provisioned (balance fetch deferred until first publish).'"

#### M27. Sentinel `/health` doesn't expose AIP-16 readiness — operator blindness
**Confirmed by:** Audit 5
**Fix:** Add `aip16: {flag, ready, kernelAddress, chainId, channelUrl}` to `/health` and `/diag` bodies.

#### M28. Sentinel rate-limit declines silently — buyer gets generic 30s timeout, no `rate_limit` signal
**Confirmed by:** Audit 7
**Fix:** Sentinel posts `{reason: 'rate_limit', retryAfterMs}` envelope. SDK GETs delivery once more on quote-timeout before throwing.

#### M29. No 'we're done' explicit summary line — terminal just stops
**Confirmed by:** Audit 7
**Fix:** Final cyan-bold block: "✓ Settled — your agent earned $9.90 USDC. Receipt: ... Profile: ... Next: edit ..."

#### M30. No mainnet guard on `actp test` — future regression risk
**Confirmed by:** Audit 8
**Fix:** Defensive assertion `sentinel.network !== 'base-mainnet'`. Unit test now.

#### M31. No "gas insufficient" friendly error path before linkEscrow precheck
**Confirmed by:** Audit 3
**Surface:** `test.ts` + `runRequest.ts:550-553`
**Fix:** Precheck USDC balance < 10 → friendly help + faucet hint.

#### M32. Phase 1J memory claims publish-time write-back implemented — actual onboarding doc + claim-code is in 4 unmerged origin/main commits
**Confirmed by:** Audit 1
**Fix:** Verify all audit findings against `origin/main`, not local HEAD.

---

### LOW (cosmetic)

#### L1. Local HEAD intentionally at `35f640e` (AIP-18 freeze baseline) — no SCRATCHPAD.md tracks the deliberate state
**Confirmed by:** Audit 1
**Fix:** Drop `SCRATCHPAD.md` at `/Users/damir/Arha/AGIRAILS/` summarizing cross-repo AIP-16 Phase 2e state.

#### L2. Sentinel reflection text uses ASCII only (verified) — but no CI guard against future curly quotes corrupting Windows cmd.exe
**Confirmed by:** Audit 8
**Fix:** CI test `assert(/^[\x20-\x7e]+$/.test(REFLECTIONS[i].text))`.

#### L3. Sentinel.md update would activate AIP-16 config against currently-published SDKs that ignore it (forward-looking dead config)
**Confirmed by:** Audit 1
**Fix:** Don't commit sentinel.md `delivery` block until SDK 4.5.0 publishes.

#### L4. Banner loaded via dynamic import in agirails.ts — 50-200ms delay before first character
**Confirmed by:** Audit 4
**Fix:** Top-level `import { renderBanner }`.

#### L5. Address display gives no human context — bare 0x hex with no "this is Sentinel"
**Confirmed by:** Audit 4
**Fix:** Soften: "Sentinel, the AGIRAILS onboarding agent / is at 0x3813...d64 on Base Sepolia."

#### L6. AGIRAILS.md "intent: pay" buyers in Step 9 mock template lie about earnings
**Confirmed by:** Audit 8 (overlap with M7)

#### L7. Mock 10K vs testnet 1K inconsistent — mock-to-testnet migrators expect 10K
**Confirmed by:** Audit 3
**Fix:** Document both amounts explicitly or align to 1K both.

#### L8. Buyer-side ehrlich error message references non-existent command
**Confirmed by:** Audit 4 (overlap with H1)

#### L9. Sentinel address single-EOA — no failover
**Confirmed by:** Audit 7
**Fix:** Deploy secondary Sentinel on Fly.io/Render; primary+fallback in `resolveAgent.ts`.

#### L10. No offline detection — 90s hang before generic error
**Confirmed by:** Audit 8
**Fix:** Pre-flight 5s DNS+TCP check.

#### L11. AGIRAILS.md missing `delivery` `claim_code` for `intent: pay` agents — doc gap
**Confirmed by:** Audit 1

#### L12. share.ts has zero unit tests — orphaned code at risk of rotting
**Confirmed by:** Audit 6
**Fix:** Add `share.test.ts`: URL encoding, OSC 52 round-trip, platform-branching mocks.

#### L13. Reflection encoded body wire format ambiguity (hex vs string)
**Confirmed by:** Audit 7
**Fix:** Standardize `public-v1` body as plain UTF-8 JSON. Update envelopeBuilder + snapshot test.

#### L14. Receipt indexer 5-min backstop too slow for 60s wow moment
**Confirmed by:** Audit 7
**Fix:** Lower cron to 30s during work hours; OR Vercel realtime listener pushing receipt URL back to CLI via long-poll.

#### L15. Tweet handle `@agirails` unverified — squatter risk
**Confirmed by:** Audit 6
**Fix:** Verify ownership; document in CLAUDE.md.

#### L16. Sentinel handler decode brittle to schema drift
**Confirmed by:** Audit 4 (overlap with M16)

---

### NICE-TO-HAVE (post-launch delights)

#### N1. `--dry-run` flag on `actp test` for preview without commitment
**Surface:** `cli/commands/test.ts`

#### N2. Sentinel rotation/disaster recovery (secondary Sentinel + health-cached resolution)
**Surface:** `cli/lib/resolveAgent.ts:73-80`

#### N3. Confirmation template includes Smart Wallet preview before consent
**Surface:** `AGIRAILS.md:131-141`

#### N4. SCRATCHPAD.md cross-repo tracking
**Surface:** repo root

#### N5. Auto-detect first-time vs returning user (suppress tweet offer on Nth run)
**Surface:** `test.ts` + `.actp/onboarding-state.json`

#### N6. Receipt page Twitter intent button (separate from CLI prompt)
**Surface:** `Platform/agirails.app/web/app/r/[id]/share-bar.tsx`

#### N7. Sentinel `/republish/{txId}` endpoint gated by buyer signed challenge
**Surface:** `seed-sentinel/agent.ts`

#### N8. Per-state spinner with elapsed timer
**Surface:** `test.ts:148-151`

#### N9. Vercel realtime listener pushing receipt URL back to CLI via long-poll
**Surface:** `Platform/agirails.app/web/app/api/v1/receipts/route.ts`

---

## Findings by User-Journey Step (Damir's 12)

| Step | Damir's Vision | Status | Blocking Findings |
|---|---|---|---|
| 1 | Wallet created on testnet with 1K USDC | BROKEN for buyers | B2, B5, H18 |
| 2 | Gentle onboarding, no errors | BROKEN | B1, B3, B4, H22 |
| 3 | All options offered nicely | PARTIAL | H10, H23 |
| 4 | Sentinel test transaction offered | BROKEN in mock path | B1, B4, H11 |
| 5 | Communicated nicely including claim code | MISSING | W8, M6 |
| 6 | All necessary options offered | PARTIAL | M13, M26 |
| 7 | State machine executes without errors | WORKS | (modulo H1, H2, H3, H7) |
| 8 | Sentinel reflection shown beautifully | BROKEN | W1, W3, W4, W6, W11 |
| 9 | Random quote display with wow effect | LOSES MAGIC | W1, W4, W9, M1 |
| 10 | Confirmation all settled | BURIED | M19, W12, M29 |
| 11 | Link to web receipt | DROPS SILENTLY | B7, W7, H6, H24, W10 |
| 12 | Offer to tweet first transaction | TOTALLY ABSENT | W2, H5, H9 |

---

## Recommended Remediation Plan

### Phase A — BLOCKERs (must fix before user can land here at all)

**Goal:** zero crashes on the documented happy path. ~2-3 days.

1. **Repo hygiene FIRST** (30 min): Branch + push all uncommitted AIP-16 work in Platform + Sentinel + Protocol/aips. Decide AIP-14 fate. Do not pull SDK origin/main yet.
2. **Rebase SDK onto `origin/main`** (1-2h): Branch local AIP-16 work, rebase onto `ca7d012`, resolve `package.json` to 4.5.0 + `./delivery` export. Re-run full test matrix. This brings in `c6cd84b` (B2 fix), `81e63ae` (B5-adjacent), `b3dad98` (revert AIP-16 imports stays reverted until SDK publishes).
3. **B3 — Auto-generate ACTP_KEY_PASSWORD** (30 min): `import 'dotenv/config'` in `cli/index.ts`; in `init.ts` write `crypto.randomBytes(32).toString('base64')` to `.env` if absent.
4. **B1 — Fix `npx agirails` crash** (1-2h): Either invoke `runInit({mode: 'testnet'})` before runTest, OR run test in mock against MockRuntime.
5. **B4 — Make `actp test` read config.mode** (1h): Mock branch runs MockRuntime + vendored reflections; testnet keeps current behavior; mainnet refuses.
6. **B2 — Verify buyer 1K USDC mint** (30 min): Confirm AIP-18 commit `c6cd84b` survives rebase; if pay-only path still skips, add `mintBuyerTestUsdc()` sibling.
7. **B7 — Receipt push fallback** (1h): Auto-mint claimable stub on Platform; surface backfill message in CLI when receiptUrl null.
8. **B5 — Paymaster preflight** (1h): Probe paymaster URL at init; fail closed with explanatory message if unreachable.
9. **B6 — Investigate Sentinel 4633/0** (2-4h): Find $1 source. Update sentinel.md prose to $10-$100. Add CI healthcheck.

**Exit criteria:** A brand-new user running `npx agirails` in a fresh cwd in a non-TTY shell completes init → publish → test → SETTLED without errors.

### Phase B — WOW-BLOCKERs (must fix to deliver the magic)

**Goal:** the climax actually feels magic. ~3-5 days.

1. **W1 — Vendor deterministic reflections + fallback path** (2h): Copy reflections table into `src/cli/lib/sentinelReflections.ts`. In `test.ts` post-SETTLED when payload undefined AND provider===Sentinel, compute locally. THIS IS THE SINGLE HIGHEST-LEVERAGE FIX.
2. **W3 — Render banner + spinner + framed receipt** (4-6h): Call `inlineBanner()` at runTest top. Replace per-state console.log with rolling `output.spinner()`. Call `renderReceiptV2()` after SETTLED. Add `output.quote()` helper for framed reflection block.
3. **W5/W6 — Stop printing `[object Object]` + dedupe reflection** (30 min): Remove `payload` + `reflection` from `output.result()`; add object-guard to `keyValue()`.
4. **W4 — Frame reflection in cyan-bordered quote panel** (1h): use new `output.quote()` helper.
5. **W2 — Wire share.ts into test.ts** (2-3h): Interactive `[c]opy / [o]pen Twitter / [s]kip` prompt. Thread `ethTxHash` through `RunRequestResult`. Combine with W7 into single "What next?" menu.
6. **W7 — Frame + open-in-browser receipt** (1h): Cyan box, underline URL, "Open receipt? [Y/n]" prompt.
7. **W8 — Surface claim code in wow path** (2h): Reorder agirails.ts to publish FIRST. Framed claim code panel with `copyToClipboardOSC52(claimUrl)`.
8. **W9 — Deterministic-local backstop** (already in W1).
9. **W10 — Reflection on receipt page + OG image** (3-4h): Include reflection in `pushReceiptOnSettled` metadata; render serif callout above receipt-card; update opengraph-image.tsx.
10. **W11 — Per-state spinner with elapsed timer** (1h): Replace ISO timestamps.
11. **W12 — First-transaction celebration** (1h): `.actp/onboarding-state.json` counter, special bold celebration line on first SETTLED.

**Exit criteria:** A brand-new user completes the flow and (a) sees the reflection rendered in a cyan-framed box, (b) sees a double-line receipt card with fee breakdown + BaseScan link, (c) is offered to tweet their first transaction, (d) sees their claim code in a framed panel they understand, (e) clicks the receipt URL and sees the reflection on the web page.

### Phase C — HIGH/MED (polish for launch quality)

**Goal:** robust against transient failures, helpful errors, consistent docs. ~5-7 days.

Highest leverage in this tier:
- H1+H2 (implement `actp tx cancel` + fix QuoteTimeout messaging + COMMITTED-state lock warning)
- H3 (Sentinel /health preflight)
- H4 (lower envelope grace to 5s + status indicator)
- H6 (receipt push observability)
- H7 (default RPC fallback chain)
- H8 (paymaster AA error patterns)
- H13 (Sentinel Agent constructor wiring for AIP-16 readiness — needed for full W1 layer 3)
- M2 (NO_COLOR/FORCE_COLOR handling for AGIRAILS.md temp-file pipeline)
- M1 (per-tx random reflection)
- H22 + M8 (wire ErrorRecoveryGuide into mapError)

Address remaining MED items in batches per-surface (CLI output, doc alignment, error messages).

### Phase D — NICE-TO-HAVE (post-launch delights)

Hold for after launch:
- N1 `--dry-run` mode
- N2 Sentinel disaster recovery (2nd EOA)
- N5 First-time vs returning-user detection
- N6 Receipt page Twitter intent button
- N7 `/republish/{txId}` endpoint
- N9 Vercel realtime listener for sub-5min receipt URL

---

## Closing

The protocol is sound; the surface is hollow. Every piece of code needed for the wow flow exists; the wiring is missing. ~200-400 LOC of glue + 4 BLOCKER fixes + the deterministic-local reflection fallback delivers a working wow flow today, with no operational dependency on Damir flipping the Railway flag. The AIP-16 channel path is the correct long-term architecture, but it should not be a precondition for the next user. Ship the fallback; ship the channel; both can run side-by-side.
