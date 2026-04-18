# AIP-2.1 — Multi-Round Price Negotiation

> **Status**: Implemented (SDK 3.5.0 — autonomous multi-round via NegotiationChannel)
> **Depends on**: AIP-2 (Price Quotes) — implemented and shipped
> **Tracks**: AIP-2.md §10.1 "Multi-Round Negotiation" + AIP-2.md §1766 TODO (closed)
> **Implementation references**:
> - `@agirails/sdk` exports `BuyerOrchestrator`, `ProviderOrchestrator`, `NegotiationChannel`, `RelayChannel`, `MockChannel`, `CounterOfferBuilder`, `CounterAcceptBuilder`, `QuoteChannelHandler` (legacy)
> - `@agirails/sdk/negotiation`, `@agirails/sdk/builders`, `@agirails/sdk/transport` subpath exports
> - `actp agent --policy provider-policy.json` daemon CLI (3.5.0, channel-driven, no inbound port)
> - `actp serve` legacy CLI (3.4.x HTTP listener, deprecated for 3.6.0 removal)
> - agirails.app endpoints: `POST/GET /api/v1/negotiations/{txId}/messages`, `GET /api/v1/agents/{did}/negotiations/inbox`

---

## TL;DR

The AGIRAILS protocol shipped AIP-2 with the on-chain pieces for price quoting:
- `transitionState(txId, QUOTED, proof)` (kernel) — the actual on-chain entry point.
  There is **no** `submitQuote` function on the kernel; the SDK exposes a
  `submitQuote()` wrapper around `transitionState(QUOTED, ...)` for ergonomics.
- `acceptQuote(txId, newAmount)` (kernel) — updates `tx.amount` while staying in QUOTED.
- SDK `QuoteBuilder` builds canonical signed AIP-2 quote messages (EIP-712) and
  computes the hash that goes into `proof`.

**The kernel-level pieces work. The orchestration is partial and inconsistent.**
- `BuyerOrchestrator.negotiate()` doesn't use `acceptQuote` at all — it fixes the
  price at `createTransaction` and treats QUOTED as a soft acknowledgment.
- `Agent.ts` (provider auto-handler) DOES reach QUOTED today via a *counter-offer
  pricing path* (`Agent.ts:1031-1052`), but the hash format is ad-hoc
  (`keccak256(JSON.stringify({txId, providerIdealPrice, actualEscrow, provider}))`)
  and does **not** conform to AIP-2's EIP-712 canonical quote message.
- The off-chain transport for the actual quote payload is not specified or
  implemented anywhere.

AIP-2.1 closes those loops: a formal `ProviderOrchestrator`, real counter-offer
dynamics in `BuyerOrchestrator`, a documented quote-channel transport with
explicit anti-replay semantics, and a migration path that keeps existing legacy
QUOTED transactions parseable.

---

## 1. Problem Statement

### 1.1 What works today

| Layer | Status | Reference |
|---|---|---|
| Kernel `transitionState(txId, QUOTED, proof)` — proof is the canonical quote hash | ✅ Live | `ACTPKernel.sol:226`, `:245-249` |
| Kernel `acceptQuote(txId, newAmount)` — updates `tx.amount` without changing state | ✅ Live | `ACTPKernel.sol:360` |
| SDK `submitQuote()` wrapper (calls `transitionState(QUOTED, encode(hash))` under the hood — there is **no** dedicated `submitQuote` function on the kernel) | ✅ Live | `protocol/ACTPKernel.ts:313` |
| State machine `INITIATED → QUOTED → COMMITTED` | ✅ Live | `types/state.ts:29-30` |
| EIP-712 signed quote message (`agirails.quote.v1`) | ✅ Live | `builders/QuoteBuilder.ts` |
| Canonical JSON hashing for on-chain integrity proof | ✅ Live | `utils/canonicalJson.ts` |
| Provider counter-offer pricing path that actually transitions to QUOTED | ⚠️ Live but ad-hoc | `Agent.ts:1031-1052` (see §1.2 for the gap) |

### 1.2 What's missing

| Gap | Impact |
|---|---|
| **`BuyerOrchestrator` ignores `acceptQuote`** | Buyer fixes price at `createTransaction` (`BuyerOrchestrator.ts:237`). If provider quotes a different number, buyer just polls for QUOTED state as a soft acknowledgement and proceeds with the original price via `linkEscrow`. There is no on-chain price update. |
| **Provider auto-handler reaches QUOTED with non-canonical hash** | `Agent.ts:1031-1052` ("counter-offer pricing path") IS triggered today and DOES call `transitionState(tx.id, 'QUOTED', proof)`. But the hash is `keccak256(JSON.stringify({txId, providerIdealPrice, actualEscrow, provider}))` (`Agent.ts:1035-1036`) — not the AIP-2 EIP-712 canonical quote message. So the on-chain proof doesn't bind to a verifiable signed quote object that anyone else can re-derive. (Separately: the fast-path `linkEscrow` at `Agent.ts:826` skips QUOTED entirely for the no-counter-offer case — both paths exist depending on policy.) |
| **No quote transport mechanism** | AIP-2 §4.1 step 8 says "publish to IPFS pubsub". IPFS pubsub is not wired anywhere in the SDK. No HTTP webhook either. The signed quote message has nowhere to go off-chain even if the provider did build one. |
| **Buyer has no decision surface for QUOTED state** | If a provider DID submit a canonical quote, `BuyerOrchestrator` has no path to read the off-chain quote message, validate signature, decide accept/counter/reject. |
| **No counter-offer message type** | AIP-2 §10.1 sketches `agirails.counteroffer.v1` but it's not specified, signed, schema'd, or implemented anywhere. |
| **No multi-round bookkeeping** | One round = one createTransaction → one txId. A real negotiation loop would need either multiple txIds or a way to stay in INITIATED/QUOTED across multiple proposals before committing. |
| **`IACTPRuntime` lacks a `submitQuote` method** | `IACTPRuntime.ts:103,131,141` exposes only `linkEscrow`, `transitionState`, `acceptQuote`. Provider code today reaches QUOTED via `transitionState(QUOTED, proof)`. AIP-2.1 must decide whether to add a dedicated runtime method or document the canonical hash construction as a builder responsibility called BEFORE `transitionState`. See §3.5. |

### 1.3 Why now

Three forces:
- The "fixed price + listed in registry" MVP was correct shipping order — discovery and trust mattered more than negotiation in the cold-start phase.
- Once we have agents transacting at scale, the lack of negotiation forces all variance into off-protocol channels (Telegram, manual pricing) — degrades the "agent commerce protocol" promise.
- The pieces exist. AIP-2.1 is integration work, not new cryptography or new contracts.

---

## 2. Target Flow

### 2.1 Happy path (one counter-offer, accepted)

```
BUYER                                              PROVIDER

policy.json (max=$10, target=$5, rounds_max=3)
discoverAgents → ranked list
  │
  ▼
createTransaction(provider, amount=$5, deadline)
  on-chain: INITIATED ──────────────────────►   StateTransitioned(INITIATED)
                                                   │
                                                   ▼
                                                 evaluate request
                                                 my actual cost = $7
                                                   │
                                                   ▼
                                                 build QuoteMessage(
                                                   quotedAmount=$7,
                                                   originalAmount=$5,
                                                   maxPrice=$10,
                                                   justification={...},
                                                   signature=EIP-712
                                                 )
                                                   │
                                                   ├─► publish to quote channel
                                                   │   (IPFS pubsub or HTTPS webhook)
                                                   │
                                                   └─► runtime.submitQuote(txId, quote)
                                                       (under the hood:
                                                        transitionState(QUOTED, proof)
                                                        with proof = canonical hash)
                                                       on-chain: INITIATED → QUOTED
StateTransitioned(QUOTED) ◄──────────────────────────
  │
  ▼
fetch quote message from channel
verify signature (recovered = tx.provider)
verify quoteHash matches tx.metadata
  │
  ▼
DecisionEngine.evaluateQuote({
  proposedPrice: $7,
  originalPrice: $5,
  maxPrice: $10,
  alternatives: [other ranked candidates]
})
  → action: 'counter_at:6.50' | 'accept' | 'reject_try_next'
  │
  ▼ (counter)
build CounterOfferMessage(
  counterAmount=$6.50,
  signature=EIP-712
)
  │
  ├─► publish to quote channel
  │
  └─► (no on-chain call yet — counter is off-chain proposal)
                                                   │
                                                   ◄──── fetch counter
                                                   evaluate counter
                                                   action: 'accept_counter'
                                                   │
                                                   ▼
                                                 (provider has nothing to do on-chain
                                                  for the counter; the agreed price
                                                  is whatever buyer eventually
                                                  accepts via acceptQuote)
                                                   │
                                                   ▼
                                                 send "accepted" notification
fetch acceptance ◄───────────────────────────────────
  │
  ▼
acceptQuote(txId, $6.50)
  on-chain: tx.amount = $6.50, state stays QUOTED
  │
  ▼
linkEscrow(txId, $6.50)
  on-chain: QUOTED → COMMITTED, USDC locked
  │
  ▼
... existing IN_PROGRESS / DELIVERED / SETTLED flow
```

### 2.2 Walk-away path

If buyer's evaluated `action: 'reject_try_next'` after one or more counter-offer rounds:
- Buyer calls `transitionState(txId, CANCELLED)`
- Moves to next ranked candidate, new `createTransaction`
- Session tracks all attempted rounds across providers

### 2.3 Deadlock detection (already partially in place)

`BuyerOrchestrator.ts:294` already detects "same price quoted twice" deadlocks across **rounds** (different providers). AIP-2.1 extends this to detect deadlock **within one provider**: 3+ counter-offer exchanges with no convergence → walk away.

---

## 3. Architecture Options

Three options ordered from minimal to maximalist.

### Option A — Minimal: wire `acceptQuote` into existing orchestrator (no real negotiation)

**Scope**: Just call `acceptQuote(txId, providerQuotedAmount)` between QUOTED detection and linkEscrow. No counter-offer, no off-chain message. Provider can quote any price up to `maxPrice`; buyer auto-accepts.

**Pros**:
- 1-2 day implementation. Touches 1 file (`BuyerOrchestrator.ts`).
- Unblocks "provider quotes cost+margin per request" use case immediately.
- No new cryptography, no new transport.

**Cons**:
- Still not real negotiation — buyer is take-it-or-leave-it within `[originalAmount, maxPrice]`.
- Doesn't deliver the AIP-2 §4.2 spec (signature verification of off-chain quote message).
- Doesn't address the missing transport problem (provider has no protocol-defined way to even *send* a `QuoteMessage`).

**When to choose**: ship-now pressure, MVP unblocking only.

---

### Option B — Recommended: full AIP-2.1 with HTTPS webhook transport

**Scope**:
1. Standardize quote transport via **HTTPS POST to `agent.endpoint`** (the field that's already in identity files and on-chain registry). Provider listens on `${endpoint}/quote-channel`, buyer POSTs to it. No new infrastructure required.
2. Implement counter-offer message type (`agirails.counteroffer.v1`) with EIP-712 signature.
3. Wire `BuyerOrchestrator` to: fetch quote → verify → decide via `DecisionEngine.evaluateQuote()` → send counter or accept.
4. Build `ProviderOrchestrator` symmetric to `BuyerOrchestrator` with `ProviderPolicy` (min_margin, max_concurrent_negotiations, etc).
5. Wire `Agent.ts` auto-handler to call `ProviderOrchestrator.evaluateRequest` instead of skipping straight to `linkEscrow`.
6. Implement the existing `acceptQuote → linkEscrow` chain on the buyer side.

**Pros**:
- Real negotiation. Buyer and provider can converge on a price across rounds.
- Reuses existing primitives (EIP-712, canonical JSON, on-chain hash storage). No new contracts.
- Endpoint-as-channel reuses infrastructure agents already have. No mandatory IPFS pubsub dependency (though it can be a future addition).
- Pay-only agents (per recent fix) can still negotiate as buyers — they have endpoints for this very purpose.

**Cons**:
- Requires both sides upgraded to interop. Mixed-version networks fall back to fixed-price MVP (acceptable degradation).
- Endpoint must be HTTPS with valid TLS — agents that haven't set a real endpoint default to their `agirails.app/a/{slug}` profile URL which doesn't accept POST. Mitigation: either (a) negotiation is opt-in via policy field, or (b) buyer auto-falls-back to fixed-price when endpoint POST fails.

**When to choose**: this is the right answer for production. Estimated 5-8 days end-to-end.

---

### Option C — Maximalist: IPFS pubsub + multi-provider auctions

**Scope**: Option B plus AIP-2 §4.1 step 8 IPFS pubsub channel for quote broadcasts, plus AIP-2.2 multi-provider auction (buyer creates txn, multiple providers all submit quotes, buyer picks the best).

**Pros**:
- Decoupled transport (no provider endpoint required for receiving requests).
- Auction dynamics can drive prices down faster than 1-on-1 counter-offers.

**Cons**:
- IPFS pubsub is operationally complex, has reliability issues, and adds a runtime dependency (Helia or kubo node).
- AIP-2.2 requires a contract change (`mapping(bytes32 => Quote[])` instead of single quote slot). Breaking, requires kernel redeploy.
- Speculative — doesn't have proven product-market fit yet.

**When to choose**: only if real-world usage of Option B reveals price discovery is too slow with 1-on-1.

---

### 3.5 Runtime API decision (was missing in v1 of this draft)

The implementation needs an explicit answer to: *"How does provider code on top
of `IACTPRuntime` reach the QUOTED state with a canonical AIP-2 hash?"* Today
`IACTPRuntime.ts:103,131,141` exposes only `linkEscrow`, `transitionState`,
`acceptQuote` — there is no `submitQuote`. Two viable answers:

#### Option D1 — Add `submitQuote` to IACTPRuntime (recommended)

```ts
// IACTPRuntime addition
submitQuote(txId: string, quote: QuoteMessage): Promise<void>;
```

- Implementation builds the EIP-712 hash from `quote` via `QuoteBuilder`,
  encodes it into proof bytes, calls `transitionState(txId, 'QUOTED', proof)`.
- MockRuntime + BlockchainRuntime get matching impls.
- Provider orchestrators have one obvious entry point and cannot accidentally
  build a non-canonical hash by hand.
- Cost: small surface increase on every IACTPRuntime implementation; mirrors
  existing `acceptQuote` shape.

#### Option D2 — Keep using `transitionState(QUOTED, proof)` everywhere

- Provider code constructs the proof itself by calling
  `QuoteBuilder.toProofBytes(quote)` then `transitionState`.
- Pros: zero runtime API change.
- Cons: every caller must remember to use the builder; the door for ad-hoc
  hashes (the current `Agent.ts:1035` regression) stays open. Easy to drift.

**Recommendation: D1.** The runtime should make canonical-hash quoting the only
ergonomic path; ad-hoc `transitionState(QUOTED, garbage)` calls become an
explicit decision (still possible but obviously off the supported path).

### 3.6 Backward compat with the existing ad-hoc QUOTED hash

Today's `Agent.ts:1031-1052` counter-offer pricing path emits
`keccak256(JSON.stringify({txId, providerIdealPrice, actualEscrow, provider}))`
into `tx.metadata`. There may already be in-flight QUOTED transactions on
testnet (and eventually mainnet) carrying this format. Strict AIP-2.1
verification of `QuoteMessage` would fail on those.

**Migration approach:**

1. **Don't break in-flight transactions.** Buyer-side quote verification is
   layered: try AIP-2 canonical match first, fall back to legacy ad-hoc match
   second. Both fail → reject the quote.
2. **Tag the path.** The buyer-side decision result carries
   `{ source: 'aip2' | 'legacy' }` so observability can see how many
   transactions still come through the legacy hash.
3. **Sunset window.** Two SDK minor releases of grace, then drop the legacy
   matcher. New providers (3.4.x+) emit only canonical AIP-2 hashes via the
   new `submitQuote` runtime method.
4. **Provider-side guard.** Once `Agent.ts` is wired to `ProviderOrchestrator`,
   the ad-hoc hash builder at `Agent.ts:1033-1038` is removed. Existing
   long-running provider processes that haven't upgraded keep emitting the
   legacy hash; buyers handle it via step 1.
5. **No retroactive on-chain rewrite.** `tx.metadata` is immutable once
   QUOTED. Old transactions carry the legacy hash forever; verifiers must
   treat them as "legacy QUOTED, no AIP-2 verification possible".

The legacy path is **observability-tagged technical debt**, not a permanent
API. Step 3 deletes it.

---

## 4. Recommendation

**Implement Option B** as AIP-2.1 v1. Defer Option C to AIP-2.2. Skip Option A (it's a worse subset of B).

**Sequence**:
1. Spec the off-chain message types (counter-offer, accept-notification) — extends AIP-2 §10.1 sketch into formal schema with EIP-712 types.
2. Spec the quote-channel HTTPS transport contract (POST endpoints, response codes, retry semantics, anti-replay model — see §8 below).
3. Add `submitQuote(txId, quote)` to `IACTPRuntime` (Option D1, §3.5). MockRuntime + BlockchainRuntime impls call `transitionState(QUOTED, proof)` under the hood with the canonical hash from `QuoteBuilder`.
4. Implement `ProviderOrchestrator` with `ProviderPolicy`. Uses `runtime.submitQuote()` (never raw `transitionState(QUOTED, ...)`).
5. Wire `Agent.ts` auto-handler to call `ProviderOrchestrator.evaluateRequest` for negotiable requests; remove the ad-hoc hash construction at `Agent.ts:1033-1038`. Fast-path `linkEscrow` stays for non-negotiable requests.
6. Extend `BuyerOrchestrator` with `_negotiateRound(txId, providerQuote)` sub-flow. Implements the legacy-hash fallback per §3.6.
7. Extend `DecisionEngine` with `evaluateQuote()` returning `accept | counter(amount) | reject`.
8. Tests: unit (each component), integration (mock buyer + provider in same process, including a legacy-hash transaction to confirm fallback works), E2E on testnet (real two-process negotiation).

---

## 5. File-by-File Change List (Option B)

### 5.1 Protocol & spec

| File | Change |
|---|---|
| `Protocol/aips/AIP-2.1.md` (new) | Promote this draft to formal spec. Schema definitions, EIP-712 types, transport contract, examples. |
| `Protocol/aips/AIP-2.md` | Update §10.1 to point to AIP-2.1 as implemented. Mark §1766 TODO done. |
| `Platform/agirails.app/web/public/protocol/AGIRAILS.md` | One paragraph in canonical noting that negotiation is supported and how to opt in via policy. |

### 5.2 SDK — new files

| File | Purpose |
|---|---|
| `src/builders/CounterOfferBuilder.ts` | EIP-712 signer + canonical JSON hasher for `agirails.counteroffer.v1` messages. Mirror `QuoteBuilder.ts` shape. |
| `src/transport/QuoteChannel.ts` | HTTPS transport: `sendQuote(toEndpoint, message)`, `sendCounter(toEndpoint, message)`, `receiveQuote(fromEndpoint, txId, timeoutMs)`. Both sides need this. |
| `src/negotiation/ProviderOrchestrator.ts` | Symmetric to `BuyerOrchestrator`. Loads `ProviderPolicy`, on incoming request calls `evaluateRequest()`, decides quote-or-skip, signs `QuoteMessage` via `QuoteBuilder`, calls `runtime.submitQuote(txId, quote)` (the new IACTPRuntime method from §3.5 — internally executes `transitionState(QUOTED, encodedHash)`), sends the signed `QuoteMessage` off-chain via `QuoteChannel`, listens for counter-offers, decides accept-counter / counter-counter / reject. |
| `src/negotiation/ProviderPolicy.ts` | Mirror of `BuyerPolicy`: `min_unit_price`, `max_concurrent_negotiations`, `counter_strategy`, `quote_ttl`, etc. |

### 5.3 SDK — modified files

| File | Change |
|---|---|
| `src/negotiation/BuyerOrchestrator.ts` | Replace lines 261–397 (the QUOTED-detection block) with a new `_negotiateRound` helper that: fetches QuoteMessage from channel, verifies signature + on-chain hash match, calls `DecisionEngine.evaluateQuote`, branches into accept (`acceptQuote` + `linkEscrow`) / counter (build + send) / reject (`transitionState(CANCELLED)` + next candidate). Loop within one provider up to `policy.negotiation.rounds_per_provider`. |
| `src/negotiation/DecisionEngine.ts` | Add `evaluateQuote(quote, alternatives, policy): { action, amount? }` — returns accept/counter/reject decision based on quoted price vs ranked alternatives, deadlock state, remaining round budget. |
| `src/negotiation/PolicyEngine.ts` | Extend `BuyerPolicy.negotiation` with `rounds_per_provider: number`, `counter_strategy: 'midpoint' \| 'undercut' \| 'walk' \| custom`, `min_acceptable_price`. Add validation. |
| `src/level1/Agent.ts` | At lines 822–826, before `linkEscrow`, check if owner registered a `ProviderOrchestrator` and route to it. Existing fast-path stays for agents that don't opt in. |
| `src/cli/commands/negotiate.ts` | Surface new policy fields in the example policy JSON. Show counter-offer history in the human output. |
| `src/cli/index.ts` | New `actp serve --policy provider-policy.json` command for running a `ProviderOrchestrator` daemon. |
| `src/api/agirailsApp.ts` | No change to discover endpoint (negotiation is provider-to-buyer, doesn't need agirails.app). |

### 5.4 Web (agirails.app)

| File | Change |
|---|---|
| `lib/services/agents.ts` | Optionally surface `negotiable: true/false` in agent listings (read from `published_config`). Hint to buyers which providers will negotiate. |
| `app/a/[name]/agent-terms.tsx` | Show "Negotiable" badge if provider policy advertises it. |

No SQL migration required.

### 5.5 Contracts

**No changes.** AgentRegistry stays. ACTPKernel `transitionState(QUOTED, proof)` and `acceptQuote(txId, newAmount)` stay (note: the kernel has no separate `submitQuote` function — quoting is `transitionState` with `State.QUOTED` and a non-empty proof per `ACTPKernel.sol:226,245`). State machine stays. The whole AIP-2.1 implementation is off-chain orchestration + a new SDK runtime method on top of existing on-chain primitives. This is the ideal — no kernel redeploy.

---

## 6. Test Plan

### 6.1 Unit tests

- `CounterOfferBuilder.test.ts` — message construction, signature verification, hash determinism.
- `QuoteChannel.test.ts` — POST/GET semantics, retries, timeout, malformed response handling.
- `ProviderOrchestrator.test.ts` — policy validation, evaluateRequest decision matrix, signed quote output.
- `BuyerOrchestrator.test.ts` — extend existing tests with negotiation rounds: mock `QuoteChannel`, assert correct sequence of `acceptQuote` / counter-send / `linkEscrow` calls.
- `DecisionEngine.evaluateQuote.test.ts` — decision matrix table tests for accept/counter/reject across price ranges, deadlock states, alternative-cheaper-than-counter scenarios.

### 6.2 Integration tests

- `negotiation-roundtrip.integration.test.ts` — buyer + provider in same process, MockRuntime, full happy path with one counter exchange. Assert final settled amount matches negotiated counter, not initial offer.
- `negotiation-walkaway.integration.test.ts` — provider holds firm at price > buyer's max → buyer cancels, advances to next candidate.
- `negotiation-fallback.integration.test.ts` — non-negotiable provider returns 404 on quote channel → buyer falls back to fixed-price flow without erroring.

### 6.3 E2E (testnet)

- Two long-running processes on Base Sepolia: `actp serve --policy provider-policy.json` and `actp negotiate --policy buyer-policy.json`.
- Assert on-chain `tx.amount` after settlement equals the negotiated counter, not the initial buyer offer.
- Read on-chain `tx.metadata` (quote hash) and verify it matches the off-chain `QuoteMessage` we have in logs.

---

## 7. Migration / Rollout

**Phase 1 (week 1–2)** — Spec + Builder
- Write AIP-2.1 spec (formalize what's in this doc).
- Implement `CounterOfferBuilder` + `QuoteChannel`. Pure off-chain, no orchestrator wiring yet. Ship as `@agirails/sdk@3.4.0` (minor bump, additive only).

**Phase 2 (week 3–4)** — Provider side
- Implement `ProviderOrchestrator` + `ProviderPolicy`. Add `actp serve` CLI.
- `Agent.ts` opt-in: providers who pass an orchestrator get the negotiation path; default behavior unchanged.

**Phase 3 (week 5–6)** — Buyer side
- Extend `BuyerOrchestrator` with `_negotiateRound`. Existing single-round behavior stays as default; opt-in via `policy.negotiation.rounds_per_provider > 1`.
- Extend `DecisionEngine` with `evaluateQuote`.

**Phase 4 (week 7)** — Polish + docs
- Web UI "Negotiable" badge.
- AGIRAILS.md canonical update.
- Migration guide for existing earn agents who want to enable negotiation.

**Backward compatibility**: every change is additive. Pre-AIP-2.1 buyers and providers continue to work unchanged. Mixed-version networks gracefully fall back to fixed-price flow.

**No breaking changes**, no kernel redeploy, no DB migration.

---

## 8. Quote-channel security (concrete model — was a stub in v1)

The off-chain quote transport (`POST {agent.endpoint}/quote-channel`) is the
attack surface that didn't exist before AIP-2.1. v1 of this draft hand-waved
"open POST + signed payload" — that's not enough on its own. Here's the
required model.

### 8.1 Threats

| # | Threat | Without mitigation |
|---|---|---|
| T1 | **Replay** — same signed `QuoteMessage` POSTed twice (or 1000×) | Receiver acts on a stale quote; provider can be locked into a price they intended for one transaction |
| T2 | **Cross-tx reuse** — quote signed for txA POSTed against txB by a third party | Receiver accepts a quote whose signed `txId` doesn't match the routing target |
| T3 | **Stale quote acceptance** — quote past `expiresAt` still POSTed and acted on | Provider thinks they expired the offer but buyer still settles at it |
| T4 | **Channel flooding** — endpoint hammered with junk POSTs | DoS, real quotes drowned out |
| T5 | **Cross-network replay** — quote signed for testnet POSTed against mainnet endpoint | Mainnet party acts on a non-mainnet-bound signed message |

### 8.2 Mitigations (all required, not optional)

1. **Channel binding via URL path.** Endpoint must be of the form
   `POST {endpoint}/quote-channel/{chainId}/{txId}`. The receiver rejects any
   payload whose `quote.txId !== {txId}` from the URL or whose
   `quote.chainId !== {chainId}`. Closes T2 and T5.
2. **Signature verification.** EIP-712 recover on the payload must equal the
   message's claimed `provider` (or `consumer` for counter-offers). Closes
   "anyone can POST" trivially.
3. **TTL enforcement.** Receiver rejects when `now > quote.expiresAt + grace`
   where `grace = 30s` (clock skew). The 24h max from AIP-2 §2.2.1 still
   applies. Closes T3.
4. **Nonce + idempotency store.** Receiver maintains a bounded LRU of
   `(provider_did, nonce)` tuples seen. First POST wins; subsequent POSTs
   with the same key return `200 OK` with a cached body (idempotent) but do
   NOT re-trigger any side effects. Store TTL = 25h (covers max quote TTL +
   grace). Closes T1.
5. **Per-IP rate limit at the channel.** 60 req/min default. Returns 429 on
   excess. Closes T4. Owners can tune per their policy.
6. **No persistent state on first POST.** The quote-channel handler validates
   1–4 then enqueues / hands off. The receiving orchestrator is what calls
   the on-chain `acceptQuote` / `linkEscrow`. The channel itself is stateless
   except for the dedup LRU.
7. **Reply via a deterministic URL on the requester's endpoint.** If a counter
   needs to reach the provider back, the buyer's own `endpoint` plus
   `/quote-channel/{chainId}/{txId}` is where the provider POSTs. Mutual.
   Both sides must have an endpoint configured (default = profile URL is NOT
   acceptable for negotiation — the profile URL doesn't accept POST). Agents
   that opt into negotiation must set a real HTTPS endpoint.

### 8.3 Out of scope for v1

- **TLS pinning / mTLS.** Public CA TLS is sufficient for v1; pinning is
  premature optimization.
- **End-to-end encryption beyond TLS.** Quote payloads are signed and
  intended to be auditable / disputable; encrypting them would defeat the
  on-chain hash binding model.
- **On-chain replay protection.** The signed message itself binds `txId` and
  `chainId`; on-chain `acceptQuote` is naturally one-shot per txId because
  it can only be called from QUOTED state.

### 8.4 Test surface

- `QuoteChannel.replay.test.ts` — same signed POST 100× yields exactly one
  effect, 99 cached idempotent responses.
- `QuoteChannel.cross-tx.test.ts` — quote with `txId=A` POSTed to
  `/quote-channel/{chainId}/B` returns 400.
- `QuoteChannel.expired.test.ts` — `expiresAt = now - 60` returns 410.
- `QuoteChannel.cross-network.test.ts` — quote with `chainId=8453` POSTed to
  `/quote-channel/84532/...` returns 400.

---

## 6. NegotiationChannel — Multi-Round Transport (3.5.0)

> **Status:** Implemented in `@agirails/sdk@3.5.0`. Supersedes the
> 3.4.x direct-HTTP `QuoteChannel` for buyer↔provider message
> exchange. The 3.4.x QuoteChannel HTTP handler remains as legacy
> back-compat (deprecated for removal in 3.6.0).

### 6.1 Why a relay

3.4.x assumed both parties run an HTTP listener (provider via
`actp serve`, buyer via custom integration). In practice **buyers
are autonomous agents that don't have inbound endpoints** — they're
serverless functions, scripts, edge runtimes. Forcing every buyer
to host an HTTP server kills the autonomy story.

The relay solves this without changing the protocol's trust model:
both parties POST signed messages to a common endpoint and poll for
replies. The relay is **content-addressable + permissionless** —
every message is EIP-712 signed and the recipient verifies
independently, so a malicious or compromised relay can at worst
spam (rate-limited) or drop (recipient detects via timeout). The
relay never sees a private key, never alters a signed message body,
and never makes a trust decision.

### 6.2 NegotiationChannel interface

Single transport abstraction in
`SDK and Runtime/sdk-js/src/negotiation/NegotiationChannel.ts`:

```ts
interface NegotiationChannel {
  post(txId, envelope: NegotiationMessage): Promise<void>;
  subscribeTxId(txId, onMessage): Subscription;       // buyer's view
  subscribeAgent(agentDid, onMessage): Subscription;  // provider firehose
}

type NegotiationMessage =
  | { type: 'agirails.quote.v1';         message: QuoteMessage }
  | { type: 'agirails.counteroffer.v1';  message: CounterOfferMessage }
  | { type: 'agirails.counteraccept.v1'; message: CounterAcceptMessage };
```

Implementations MUST:
- verify EIP-712 signatures BEFORE invoking subscriber callbacks
- dedup by inner-message signature (same message delivered exactly once
  per subscription)
- isolate subscriber errors (one bad handler can't kill siblings)

The SDK ships **two implementations**:
- `RelayChannel` — HTTP polling against agirails.app. Default.
- `MockChannel` — in-memory, for tests.

Future: `IpfsChannel`, `OnChainEventChannel` — drop-in for advanced
use cases without touching orchestrators.

### 6.3 Wire protocol — agirails.app endpoints

Three HTTP endpoints, all permissionless:

```
POST /api/v1/negotiations/{txId}/messages
  Body: { type, message }
  → 201 { ok: true }
  → 200 { ok: true, duplicate: true }   (idempotent re-POST)
  → 400 { error: "<shape problem>" }
  → 429 { error: "per-tx message cap reached" }   (50 messages/tx)
  → 500 { error }

GET /api/v1/negotiations/{txId}/messages?after={cursor}
  → 200 { messages: [{ cursor, envelope, receivedAt }] }    (max 50/page)

GET /api/v1/agents/{did}/negotiations/inbox?after={cursor}
  → 200 { messages: [{ cursor, txId, envelope, receivedAt }] }
       (firehose: messages where DID = provider OR consumer; max 100/page)
```

Cursors are opaque numeric strings — clients pass back the last item's
`cursor` to get the next page. `after` is server-side `id > cursor`.

Storage TTL: **24h**. Operator schedules a Postgres cleanup job:
```sql
DELETE FROM negotiation_messages WHERE expires_at < NOW();
```

Schema lives in `Platform/agirails.app/web/supabase/migrations/00028_negotiation_messages.sql`.

### 6.4 Multi-round on-chain semantics

ACTPKernel `_isValidTransition` blocks `QUOTED → QUOTED` (verified in
`Protocol/actp-kernel/src/ACTPKernel.sol:629`). All re-quotes are
**off-chain only** — the kernel anchors only the FIRST `submitQuote`
call. Subsequent provider re-quotes ride the EIP-712 signature chain
on the relay. The FINAL agreed amount hits chain via the buyer's
`acceptQuote(txId, finalAmount) + linkEscrow(txId, finalAmount)` —
which is what the buyer commits funds to and what disputes reference.

Non-repudiation chain: buyer keeps the provider's signed
`CounterAcceptMessage` (or final `QuoteMessage` if buyer accepted
directly) bound to txId + acceptedAmount + inReplyTo of the matching
counter. In a dispute the buyer can show the off-chain trail leading
to the on-chain commit.

### 6.5 Multi-round inner loop (BuyerOrchestrator)

```
await first quote on channel
for round in 0..policy.rounds_per_provider:
  on round 0: cross-check on-chain quoteHash (anchored proof)
  on round N>0: trust channel sig (EIP-712 + provider DID guard)
  evaluate(currentQuote, roundsUsedSoFar = round)
    accept  → on-chain acceptQuote+linkEscrow, return success
    reject  → on-chain CANCELLED, return failure
    counter → channel.post(counter), await next message:
              counteraccept → bind to last counter, on-chain accept+link, success
              new quote     → currentQuote = new, loop
              timeout       → on-chain CANCELLED, failure
budget exhausted → CANCELLED
```

DecisionEngine's existing budget guard
(`roundsUsedSoFar + 1 >= rounds_per_provider`) triggers
accept-if-affordable on the last permitted round.

### 6.6 Provider auto-respond (ProviderOrchestrator)

```
await orch.start()  // subscribes via channel.subscribeAgent(providerDID)
// per incoming counter:
decision = evaluateCounter(counter, lastQuoteAmount, requotesUsed)
  accept   → build CounterAcceptMessage, post on channel
  requote  → build new QuoteMessage at concession amount, post on channel
             (re-quote = lastQuote - (lastQuote - floor) * concede_pct / 100)
  reject   → log + drop; buyer's TTL expires → CANCELLED
```

ProviderPolicy gains: `counter_strategy` ('walk' | 'concede'),
`concede_pct` (default 30), `max_requotes` (default 2).

### 6.7 Operationally: `actp agent`

`actp agent --policy policy.json --network base-sepolia` (3.5.0)
boots a long-running daemon that:
- polls relay for incoming counter-offers across all txIds where
  the provider is listed
- watches on-chain for new INITIATED txs addressed to the provider
  and auto-quotes per ProviderPolicy
- auto-respond multi-round per `counter_strategy`
- requires no inbound port — pure outbound HTTPS

Replaces `actp serve` (kept as legacy 3.4.x alias, removed in 3.6.0).

---

## 9. Open Questions

1. **Counter-offer hash on chain?** AIP-2.1 currently lives entirely off-chain. Should counter-offers also be hashed on-chain for non-repudiation? Recommendation: NO for v1 — adds tx cost, off-chain signed messages are enough for dispute. Revisit if disputes show abuse.
2. **`acceptQuote` access control.** Contract today: only requester can call. Confirm this matches intended semantics for AIP-2.1 (it does — buyer is the requester).
3. **Quote TTL vs negotiation deadline.** If `quote_ttl=15min` and 3 rounds happen serially, we could blow the deadline. Recommendation: extend `quote_ttl` automatically per round, OR scope it to per-message expiry (each counter has its own expiry).
4. **Default-endpoint negotiation block.** Per §8.2 #7, agents using the default profile URL endpoint can't negotiate (profile URL doesn't accept POST). Should the wizard force agents that set `intent: both` AND want to be negotiable to provide a real HTTPS endpoint at onboarding time? Recommendation: warn at publish time, don't block.

---

## 10. References

- **AIP-2** (parent spec): `Protocol/aips/AIP-2.md` (workflow, message format, EIP-712 types)
- **State machine**: `SDK and Runtime/sdk-js/src/types/state.ts:29-30`
- **On-chain primitives**: `Protocol/actp-kernel/src/ACTPKernel.sol:226` (transitionState — entry point for QUOTED transition), `:245-249` (proof handling for QUOTED branch), `:360` (acceptQuote)
- **SDK QUOTED wrapper** (named `submitQuote()` for ergonomics, but it's a wrapper around `transitionState`): `protocol/ACTPKernel.ts:313`
- **Today's ad-hoc QUOTED hash** (legacy, to be migrated per §3.6): `level1/Agent.ts:1031-1052`
- **`IACTPRuntime` interface** (will gain `submitQuote` per §3.5 D1): `runtime/IACTPRuntime.ts:103,131,141`
- **SDK QuoteBuilder**: `SDK and Runtime/sdk-js/src/builders/QuoteBuilder.ts`
- **SDK BuyerOrchestrator**: `SDK and Runtime/sdk-js/src/negotiation/BuyerOrchestrator.ts`
- **SDK Agent.ts auto-handler**: `SDK and Runtime/sdk-js/src/level1/Agent.ts:738-826`
