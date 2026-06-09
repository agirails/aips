# AIP-16: First-Class Delivery Surface

**Status:** Strong Draft (Damir reviews 1–4 incorporated 2026-06-05 — cleared for Codex cross-review)
**Author:** AGIRAILS Core (Arha — synthesizing input from Damir Mujic, Codex first-principles review 2026-06-04/05, Claude ultra-think 2026-06-04, and ground-truth code audit of sdk-js 4.1.1 + agirails.app + seed-sentinel)
**Created:** 2026-06-05
**Last Revised:** 2026-06-05 (revision 5 — see Changelog at end)
**Successor planned:** AIP-17 (reference delivery contract) for >128 KB JSON / binary file delivery via signed pointer to third-party storage. AIP-17 is out of scope for AIP-16 but is a known v1+1 work item.
**Depends On:** AIP-0 (Protocol Overview), AIP-2.1 (Channel-driven Multi-round Negotiation), AIP-4 (Delivery Proofs & EAS)
**Related:** AIP-1 (Transaction Creation), AIP-3 (State Transitions), AIP-5 (Dispute Resolution)
**Supersedes:** Partially supersedes the "EAS+IPFS as primary delivery path" framing in AIP-4. AIP-4's EAS/IPFS surface is retained as the audit/dispute layer, restricted to plaintext-only services (see DEC-3 revised).

---

## ⚠ Context

This AIP exists because of a category error in the protocol's architecture, surfaced
by a Sentinel test run on 2026-06-04 that produced this output:

```
SETTLED   0xf7f3b448bb71f1a695ee0adf63385f90a3f8aaa38dfed8301420f33baa860ec2
elapsedMs: 25494
settled: true
receiptUrl: https://agirails.app/r/r_7qd8te2f
reflection: undefined        ← buyer never received what they paid for
payload: undefined
```

Settlement succeeded. Receipt minted. Wallet debited $9.90 to provider. And the
buyer's CLI printed `reflection: undefined` — the actual thing the buyer paid for
never arrived at the buyer's process.

This document specifies how to fix that.

---

## §0 TL;DR

The current protocol architecture treats **content delivery** as orthogonal to
**settlement** — a remnant of modeling ACTP after Stripe. For AI-agent-to-AI-agent
commerce there is no FedEx; the protocol *is* the delivery channel. Treating
delivery as someone else's problem makes ACTP an escrow contract with extra steps,
not a marketplace primitive.

We propose a **three-layer architecture** with explicit separation of concerns:

| Layer | Concern | Substrate | Latency |
|---|---|---|---|
| **Settlement** | "Who owes whom how much" | On-chain state machine + escrow | 2–30s |
| **Delivery** | "Buyer has the bytes" | Channel (relay HTTP / SSE / p2p) | 50ms–1s |
| **Audit** | "What was said and when" | EAS + IPFS | minutes–days |

The delivery surface becomes first-class. Privacy is default-on via per-tx
ephemeral ECDH keys. EAS/IPFS becomes the audit/dispute fallback it was always
meant to be — not the critical read path.

This is **not** a hot fix. It is a vertical-slice protocol upgrade across three
repos (sdk-js, agirails.app, seed-sentinel) with no on-chain kernel change in v1.
Estimated scope: ~600–900 LOC, ~2 weeks of focused work, ~3 PRs per repo.

---

## §1 Problem Statement (Ground Truth)

### 1.1 The Smoking Gun

The buyer SDK fetches transaction state via `BlockchainRuntime.getTransaction()`,
which maps the on-chain `ACTPKernel.getTransaction()` return into the SDK's
`MockTransaction` shape. Line 664 of `SDK and Runtime/sdk-js/src/runtime/BlockchainRuntime.ts`:

```ts
return {
  ...
  deliveryProof: '',  // V2: Fetch from EAS attestation
  events: [],         // V2: Populate via EventMonitor.getTransactionEvents()
  ...
};
```

Two V2 TODOs in the hot path. The buyer-side runtime returns an empty
`deliveryProof` for every blockchain transaction, regardless of whether the
provider delivered any payload.

Then `runRequest.ts:300` does:

```ts
const tx = await client.runtime.getTransaction(txId);
const payload = tx?.deliveryProof ? safeParse(tx.deliveryProof) : undefined;
```

`tx.deliveryProof` is always empty string → `payload` is always `undefined` →
the CLI's `extractReflection(undefined)` returns `undefined` → user sees nothing.

### 1.2 What Provider Actually Does

The provider Agent SDK does receive the handler's return value. In
`Agent.ts:1537` (MockRuntime path):

```ts
if ('stateManager' in runtime) {
  runtime.stateManager.setDeliveryProof(txId, deliveryProofJson);
}
```

The payload is stuffed into MockRuntime state. **On real chain there is no
equivalent.** The real-chain path at `Agent.ts:1594` sends only an
ABI-encoded dispute window number to `kernel.deliver()`:

```ts
await runtime.transitionState(txId, 'DELIVERED', encodeDisputeWindowProof(disputeWindow));
```

The reflection text — the actual product the buyer paid for — never leaves
the provider's process memory. It is computed, wrapped, signed, and dropped
on the floor (or, more precisely, attempted to be lifted to EAS via
`DeliveryProofBuilder` but with no completion of the round-trip read on the
buyer side).

### 1.3 Codex Verification 2026-06-04

Independent code audit by Codex confirmed:

- **Sentinel handler returns reflection correctly** (`seed-sentinel/src/agent.ts:87`)
- **Provider SDK builds `deliveryProofJson` from result** (`Agent.ts:1521`)
- **MockRuntime path attaches it to state** (`Agent.ts:1537`)
- **Real-chain path discards it** (`Agent.ts:1594`)
- **Buyer reads empty deliveryProof** (`BlockchainRuntime.ts:664` → `runRequest.ts:300`)

Settlement succeeded. Receipt succeeded. **Content delivery failed.**

### 1.4 Why This Survived for Months

- All early integration tests ran against MockRuntime, which had the in-memory
  state-manager path. The reflection appeared in tests.
- Real-chain tests focused on state transitions and settlement, not payload
  retrieval — and there was no automated assertion on `RunRequestResult.payload`.
- The `actp test` command's `extractReflection` falls back to `undefined`
  silently and the success message ("Settled in 27277 ms") fires regardless.
- The receipt URL was implemented later (AIP-pre-16, sdk-js 4.1.0). It became
  a *separate* wow signal that masked the absence of the original wow signal.

A protocol that ships SETTLED state without delivered content is reporting a
half-truth to users. We caught it because Damir asked, on a $10 transaction,
"why didn't Sentinel send me anything back?"

---

## §2 First-Principles Analysis

### 2.1 What is a transaction for AI agents?

A buyer pays $X for service Y from provider P. The system must guarantee:

1. **Money safety** — buyer's funds locked until delivery, refundable on failure.
2. **Payment** — provider receives funds when delivered.
3. **Content** — buyer receives the actual output they paid for.
4. **Auditability** — disputes can be resolved with verifiable evidence.

These are four distinct properties. They require different substrates with
different latency/cost/availability trade-offs.

Current protocol nails (1), (2), (4). (3) is a TODO with a comment.

### 2.2 Why this isn't a bug — it's a category error

The protocol's mental model is "settlement layer for AI agents" — explicit
analogy to Stripe. Stripe works because **there is a separate delivery channel**:
FedEx ships the physical product, or the merchant's web app serves the digital
one. Stripe observes the relationship but does not carry the goods.

For ACTP/AGIRAILS:
- Agents are headless, programmatic, autonomous.
- There is no FedEx. There is no separate merchant web app.
- The protocol *is* the relationship between buyer and provider. There is
  nothing else.

This collapses to a sharp claim:

> **Delivery is not orthogonal to settlement. Delivery is the whole thing.**

A settlement protocol for AI agents that does not deliver output is not a
protocol — it is an escrow contract with extra steps. The buyer paid for the
*output*, not for the right to query EAS later and reassemble it from IPFS
fragments.

### 2.3 Why this got deferred (the three biases)

**Bias 1 — Optionality fetish.** "What if buyer is offline? What if payload is
huge? What if the channel is unreliable?" Real edge cases — but **edge** cases.
Designing the 99% UX around the 1% rim buries the wow signal.

**Bias 2 — Conflating proof with content.** A "delivery proof" wins disputes.
"Content" is what the buyer wanted. Modeling them as one data structure
forces the architecture into proof-shape (immutable, signed, archived) when
the buyer mostly just wants the bytes now.

**Bias 3 — Web3 default-to-decentralized.** "Delivery must use IPFS because
decentralization." But buyer↔provider is fundamentally 1-to-1, not many-to-many.
Peer-to-peer or via thin relay is *more* decentralized than a fixed IPFS
gateway; it just doesn't look like decentralization to a 2022 mindset that
inherited this code.

### 2.4 The implication for positioning

AGIRAILS markets itself as "settlement layer for AI agents." If "settlement"
does not include "the agent receives what it bought," then AGIRAILS settles
*what?* A claim. A promise. That is strictly weaker than a marketplace
primitive — it is a smart contract framework.

The right positioning requires delivery be first-class:

> **AGIRAILS is the protocol where AI-agent commerce actually completes.**

Settlement is the last stage. Delivery is the second-to-last and equally
load-bearing.

---

## §3 Three-Layer Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  SETTLEMENT SURFACE                                             │
│                                                                 │
│  Concern:    Who owes whom how much                             │
│  Substrate:  On-chain (ACTPKernel + EscrowVault)                │
│  Latency:    2–30s (depends on chain finality)                  │
│  Cost:       gas (ERC-4337 sponsored via Paymaster)             │
│  Trust:      L1/L2 consensus                                    │
│  Failure:    State machine enforced; dispute window for griefing│
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  DELIVERY SURFACE                                               │
│                                                                 │
│  Concern:    Buyer has the bytes                                │
│  Substrate:  Channel (HTTP relay / SSE / p2p — interchangeable) │
│  Latency:    50ms–1s                                            │
│  Cost:       relay bandwidth + buyer SDK runtime                │
│  Trust:      Provider signature (EIP-712) + ECDH confidentiality│
│  Failure:    Missing envelope → buyer does not settle, may       │
│              dispute via on-chain path; provider voluntary       │
│              cancel returns escrow. ACK (v1.1) is audit-only.    │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  AUDIT SURFACE                                                  │
│                                                                 │
│  Concern:    What was said, by whom, when                       │
│  Substrate:  EAS attestations + IPFS payload archive            │
│  Latency:    minutes–days (write at deliver; read on demand)    │
│  Cost:       EAS attestation gas + IPFS pinning                 │
│  Trust:      Cryptographic attestation; archival permanence     │
│  Failure:    Soft (audit replay still possible from chain logs) │
└─────────────────────────────────────────────────────────────────┘
```

Each layer is independent:

- Settlement can complete without audit. (Disputes use settlement state.)
- Settlement can complete without delivery. (Today's broken state — but
  recoverable: buyer can dispute the missing content.)
- Audit can complete without delivery. (Audit is point-in-time evidence;
  evidence of *attempt* is enough.)
- **Delivery cannot complete without settlement.** Money must move for content
  to be considered "earned." Otherwise it's a giveaway.

The current architecture conflates Delivery with Audit (both via EAS+IPFS) and
treats Delivery as derivable from Settlement (it isn't). This AIP separates
them.

---

## §4 Current State Diagnosis

### 4.1 Settlement surface — working

| Component | Status |
|---|---|
| `ACTPKernel` state machine (INITIATED → ... → SETTLED) | ✅ Working, audited |
| `EscrowVault` fund flow | ✅ Working |
| 1% / $0.05min fee enforcement | ✅ Working |
| Smart-wallet routing (Tier 1 AutoWallet) | ✅ Working post-PR #34 |
| Receipt minting (Platform indexer + SDK push) | ✅ Working post-PR #36 + sdk 4.1.0 |
| Dispute window enforcement | ✅ Working |

### 4.2 Delivery surface — non-existent

| Component | Status |
|---|---|
| Channel for delivery payloads | ❌ Not implemented (relay supports `quote`, `counteroffer`, `counteraccept` only) |
| Provider publish path | ❌ Provider SDK builds envelope but drops it on real chain |
| Buyer subscribe path | ❌ Buyer SDK polls on-chain state, never listens for payload |
| Privacy primitive | ❌ N/A (no delivery channel exists yet) |
| Payload integrity verification | ❌ N/A |
| ACK / receipt-of-content | ❌ N/A |

### 4.3 Audit surface — partially built, unused

| Component | Status |
|---|---|
| `DeliveryProofBuilder` (sign + IPFS upload + EAS write) | ⚠ Built but not in current ProviderOrchestrator flow |
| EAS DeliverySchema deployed | ✅ Schema UID known per AIP-4 |
| Buyer-side EAS read | ❌ `BlockchainRuntime.getTransaction()` returns empty deliveryProof |
| Buyer-side IPFS fetch | ❌ No retrieval logic |
| Dispute-time replay | ❌ Theoretically possible from chain logs but no tooling |

### 4.4 The naming problem

The on-chain event `Delivered(txId, ...)` *suggests* content has reached the
buyer. It has not. The event means: "provider has committed to having
delivered, and the dispute window has started." Buyers reading the protocol
docs reasonably assume `Delivered` ≈ "I have it."

This is a docs/protocol naming bug that compounds the architectural one.
We recommend renaming in docs to `WorkSubmitted` or `DeliveryClaimed`. On-chain
event name change is a v2 concern (backward compat).

---

## §5 Architectural Decisions

Each decision is numbered, has explicit rationale, and binds the rest of the
design.

### DEC-1: Delivery is first-class

**Decision:** Delivery becomes a named protocol surface with its own messages,
endpoint, and lifecycle. Not a footnote of the negotiation channel; not an
optimization over EAS read; not a side-effect of state transitions.

**Rationale:** §2 — for AI-agent commerce there is no external delivery
channel, so the protocol must carry the content. Anything else is a half-built
escrow.

**Counter-argument considered:** "Could we just fix EAS read?" Yes, and it
would work for some cases. But EAS+IPFS in the hot path costs gas per delivery
($0.05–$0.50 worth) plus two extra RPC roundtrips per buyer read. For
sub-$10 transactions the audit infrastructure costs more than the value being
transacted. For sub-$1 transactions it's actively absurd. Even on chain-cost-
free networks the latency budget (minutes for IPFS pinning + EAS finality vs.
50ms for channel) is wrong for sync UX.

### DEC-2: Channel is the default read path

**Decision:** Buyer SDK's `runRequest` returns payload from the channel cache.
The on-chain `BlockchainRuntime.getTransaction().deliveryProof` field remains
empty unless explicitly populated by audit-replay tooling. The TODO marker is
not "implement EAS read"; the TODO is "delete this field from the hot path."

**Rationale:** Channel delivery is instant, cheap, off-chain, privacy-friendly,
and matches the synchronous request/response shape of the dominant agent
use case. EAS+IPFS is the right substrate for the 1% of cases (disputes,
async catchup, audit replay), not 99%.

**Counter-argument considered:** "What about async/queued work where buyer
is offline?" Handled by relay retention (24h default) + buyer SDK persistent
inbox. EAS+IPFS as further fallback for >24h offline scenarios. v1 ships
24h retention; persistent inbox is v2.

### DEC-3: EAS/IPFS is fallback only — and privacy-aware

**Decision:** Continue to build a signed audit record (proof + EAS attestation)
**in parallel** with channel publish. But:

- For services with `delivery.privacy: public`: the existing
  `DeliveryProofBuilder` flow (plaintext IPFS upload + EAS attestation)
  applies unchanged.
- For services with `delivery.privacy: encrypted` (the default): the audit
  path stores **only the ciphertext envelope** (or just the envelope hash +
  EIP-712 signature) on IPFS / EAS. **Plaintext MUST NOT touch IPFS.**

The read path defaults to channel. EAS / IPFS read is invoked only:

- On explicit `actp tx replay <txId>` audit command (v2 tool).
- During dispute resolution (Mediator queries EAS for evidence).
- When channel retention has expired and buyer attempts late retrieval.

For encrypted services, audit-path recovery still works for the buyer (they
hold their ephemeral private key only until the tx completes, but they can
re-derive shared secret from a persisted key during the tx window). For
disputes after that, the Mediator can verify provider signed *some* payload
with *some* hash matching the envelope — sufficient for "provider delivered
something" attestation — without needing to read the plaintext.

**Rationale:** Preserve audit-trail completeness without leaking private
payloads to the public IPFS gateway. The existing `DeliveryProofBuilder`
assumes plaintext result and violates DEC-4 unless gated. Provider gains:
still have full dispute defense (signature over content hash). Buyer gains:
instant payload in 99% of cases + plaintext is never published. Mediator
gains: same evidence-of-attempt; plaintext only available when both parties
voluntarily reveal during dispute.

**Implication for `DeliveryProofBuilder` (sdk-js):** the existing
implementation (`src/builders/DeliveryProofBuilder.ts:70` uploads
`resultData` plaintext to IPFS) must be split into two code paths:
`buildPublicProof(payload)` (current behavior) and `buildEncryptedProof(envelope)`
(stores the ciphertext envelope only — no plaintext at any layer below the
buyer SDK). The provider Agent picks the right one based on the service
descriptor's `delivery.privacy` field.

### DEC-4: Privacy is default-on, public is opt-in

**Decision:** Payloads are encrypted to the buyer's per-tx ephemeral public key
by default. Relays see ciphertext only. Service providers can flag specific
services as `public: true` in their AGIRAILS.md service descriptor, in which
case payload is published plaintext (use case: Sentinel daily reflection,
public feed APIs).

**Rationale:** Today's `GET /relay/{txId}` (if it existed for delivery) would
be world-readable because `txId` is observable on-chain. For Sentinel's daily
quote that's fine. For lead-gen contact data, code generation output, SQL
result sets, private agent outputs — leaking these to anyone watching the
chain is a category failure. Privacy must be default, not opt-in.

**Counter-argument considered:** "ECDH adds key management." Yes — but the
key management is minimal:
- Buyer generates X25519 keypair per transaction (ephemeral).
- Buyer includes pubkey in the request payload (negotiation or covenant
  hand-off).
- Provider derives shared secret via X25519, encrypts with AES-256-GCM.
- No publication, no key registry, no rotation problem. Per-tx forward
  secrecy is the default.

### DEC-5: ACK is an audit signal, never a blocking gate

**Decision:** Buyer SDK MAY post a signed acknowledgment (ACK) to the relay
after successfully decrypting + verifying the payload. The ACK is metadata
only. Provider settlement does NOT wait for ACK. `kernel.deliver()` is called
by provider as soon as channel publish completes.

**Rationale:** A blocking ACK between provider-publish and provider-settles
opens a buyer-griefing attack: buyer downloads ciphertext, decrypts, sees
content, then refuses to ACK — provider can't proceed, dispute window doesn't
start, escrow stays locked. From IN_PROGRESS there is no dispute path; the
requester can't even cancel. **This trade is strictly worse than the current
state.**

ACK as audit:
- If buyer later claims "never received," relay logs show whether ACK was
  posted.
- ACK signatures bind to (txId, payloadHash, buyer wallet) so they're
  non-repudiable.
- Mediator uses ACK absence + EAS attestation as evidence in disputes.

**Counter-argument considered:** "But then provider can claim delivery
without buyer actually receiving anything." True. Mitigated by:
1. Provider must POST envelope to relay before calling `kernel.deliver()`.
   Relay timestamps the envelope.
2. Buyer SDK polls relay during state polling. If POST didn't happen, buyer
   doesn't settle and tx hits deadline → refund.
3. For disputes, EAS attestation + relay logs together prove what was
   available when.

### DEC-6: kernel.deliver semantic stays unchanged in v1

**Decision:** `ACTPKernel.deliver(txId, disputeWindow)` is not modified. The
on-chain state machine is untouched.

**Rationale:** Channel-based delivery is purely off-chain. The on-chain
`Delivered` event remains a settlement-layer signal ("provider claims work
submitted, dispute window starts"). Naming clarification in docs only (v1
docs say: `Delivered` ≠ "buyer has content"; use `WorkSubmitted` mentally).

A v2 may introduce a new event `ContentReceived(txId, payloadHash, ackSig)`
or extend `Delivered` to carry payload hash. Both are out of scope here.

### DEC-7: Service descriptor declares delivery mode

**Decision:** `AGIRAILS.md` service descriptor gets a `delivery` block:

```yaml
services:
  - type: onboarding
    price: "10"
    delivery:
      mode: channel              # channel | direct | both
      privacy: encrypted          # encrypted | public | hybrid
      channel: agirails-relay-v1  # which channel(s) accepted
      schema_uri: ...             # optional payload schema reference
      retention_hours: 24         # relay retention SLA the provider promises
```

**Rationale:** Buyer SDK reads this at request time, knows whether to expect
plaintext or ciphertext, knows which channel to subscribe to. No surprises.
Discoverability via `agirails.app/a/{slug}` shows delivery mode in the UI.

### DEC-8: One channel implementation in v1

**Decision:** v1 ships exactly one channel: the existing AGIRAILS relay at
`agirails.app/api/v1/relay`, extended with new message types. Not p2p, not
WebSocket-first, not custom. HTTP polling + optional SSE.

**Rationale:** Smallest possible implementation surface. The relay already
exists for negotiation. Adding delivery message types is a known operation.
p2p / WebRTC / libp2p are correct *later* but introduce NAT traversal, STUN,
peer discovery complexity that the current scope can't absorb.

The `delivery.channel` field in DEC-7 leaves room for v2 channels (p2p,
matrix, custom) to coexist.

### DEC-9: Delivery setup is a dedicated relay message, not piggyback

**Decision (added in revision 2):** v1 introduces a new signed relay message
type `DeliverySetupV1`, posted by the **requester** to the relay immediately
after `createTransaction` and before/around `linkEscrow`. Setup carries the
buyer ephemeral X25519 public key + delivery preferences. The provider
fetches setup by `txId` when it picks up the job (after seeing INITIATED on
chain).

Setup is NOT piggybacked on:
- The existing `NegotiationChannel` quote/counteroffer messages (Sentinel
  doesn't go through that flow at all — confirmed at `sdk-js/src/cli/lib/runRequest.ts:19`,
  which never imports NegotiationChannel).
- The on-chain `createTransaction` calldata (too expensive; pollutes the
  protocol's hot path).
- An HTTP header on the agent endpoint (works only for endpoint-flow
  services; doesn't help channel-only providers like Sentinel).

**Rationale:** A dedicated setup message is the only path that works
uniformly across:
- Negotiation-flow services (Sentinel today does NOT use NegotiationChannel
  but is the very flow we're trying to wow).
- Endpoint-flow services (HTTP webhook providers).
- Future flows we haven't designed yet.

For `delivery.privacy: public` services (Sentinel), the setup message MAY
omit `buyerEphemeralPubkey`. Provider sees the omission and skips encryption.
For `delivery.privacy: encrypted` (the default), setup MUST include the
ephemeral pubkey; provider refuses to deliver without it.

Setup format and endpoint are specified in §6.4 (new section).

**Implication for endpoint-flow services (future):** HTTP-header adapter
(`X-Buyer-Pubkey: 0x...` on the agent's POST endpoint) becomes a v2 shortcut
for low-latency endpoint integrations that don't want a relay round-trip.
v1 ships setup-via-relay only.

### DEC-10: Relay verifies on-chain participants before accepting

**Decision (added in revision 3):** Every relay POST endpoint
(`/api/v1/delivery/setup`, `/api/v1/delivery`) MUST resolve the on-chain
transaction at POST time and verify the signed participant address matches
the on-chain participant. Specifically:

- For setup POST: relay reads `tx = kernel.getTransaction(signed.txId)` and
  requires `signed.requesterAddress.toLowerCase() === tx.requester.toLowerCase()`.
- For envelope POST: relay reads `tx = kernel.getTransaction(signed.txId)`
  and requires `signed.providerAddress.toLowerCase() === tx.provider.toLowerCase()`.

If the tx does not exist on chain (e.g. createTransaction not yet mined),
relay returns 425 (Too Early) with a hint to retry. If the participant does
not match, relay returns 403 with a structured forensic log entry.

**Rationale:** Without this check, the schema's `UNIQUE(tx_id,
{requester,provider}_sig_hash)` allows multiple signed records per txId
from arbitrary signers. An attacker can race-post a forged setup or
envelope for someone else's txId before the legit message arrives. Two
failure modes follow:

- If relay keeps only one record per txId, attacker permanently blocks the
  legit message (DoS).
- If relay keeps multiple records, every GET must return candidates and
  every consumer must filter — pushes the participant check to N consumers
  instead of one relay.

Centralizing the participant check at the relay is strictly better: one
RPC call per POST, eliminates the DoS surface, eliminates per-consumer
filter logic.

**Implementation note for `agirails.app/web`:** the relay already has chain
read access via the receipts indexer (`/api/cron/index-stats`). A new
helper `verifyOnChainParticipant(txId, role, claimedAddress)` lives in
`lib/chain/verify-participant.ts`. Cached: `tx` lookups TTL 60 seconds in
Redis (matching existing chain-verify cache TTLs).

**Kernel address must be server-resolved, not caller-supplied.** The relay
MUST NOT trust `signed.kernelAddress` as authoritative. Concretely:

1. Relay maintains a server-side allowlist mapping `chainId → kernelAddress`
   (one entry per supported network — Base Sepolia 84532, Base Mainnet 8453
   in v1). The allowlist lives in `web/lib/chain/kernels.ts` alongside the
   existing RPC config and is loaded from build-time environment, never
   user input.
2. On POST, relay reads `chainId = signed.chainId` and looks up
   `configuredKernel = KERNEL_ALLOWLIST[chainId]`. If `chainId` is not in
   the allowlist → 400 ("unsupported chain").
3. Relay then requires `signed.kernelAddress.toLowerCase() ===
   configuredKernel.toLowerCase()`. Mismatch → 403 + forensic log.
4. All subsequent on-chain RPC calls (`kernel.getTransaction(txId)`) target
   `configuredKernel`, not `signed.kernelAddress`.

Without this, an attacker could submit a forged envelope whose
`kernelAddress` points at a contract they control, and a naive relay would
either query the attacker's contract OR sign-verify against an EIP-712
domain the attacker chose — defeating the domain-separation guarantee.
The signed-projection field is retained because the **buyer** independently
verifies it against the buyer's own configured kernel (§6.1.4 step 4), so
removing it from the projection would weaken end-to-end binding; the relay
just doesn't take it as authority.

**Implication for schema:** the existing UNIQUE constraints stay
(`UNIQUE(tx_id, requester_sig_hash)` for setups and similar for envelopes)
— they're now idempotency guards for legitimate retries from the same
participant, NOT defense against impersonation. Impersonation is blocked
upstream at the participant check.

---

## §6 Detailed Design

### 6.1 DeliveryEnvelope message format

The envelope has two parts: a **signed projection** (the fields covered by
`providerSig` — every field is required and uses canonical empty values when
not applicable), and an **unsigned wrapper** (server-only metadata not
covered by the signature). This separation prevents the EIP-712 "omitted
fields" ambiguity that the original draft contained.

#### 6.1.1 Signed projection (EIP-712 payload)

```typescript
interface DeliveryEnvelopeSignedV1 {
  // Protocol version. v1 of this AIP.
  version: 1;

  // Binds the envelope to a specific transaction. Replay across txIds
  // fails signature check.
  txId: `0x${string}`;        // bytes32 ACTPKernel transaction ID

  // Binds the envelope to the chain + kernel. Prevents cross-deployment
  // replay (e.g., reposting a Sepolia envelope on Mainnet).
  chainId: number;
  kernelAddress: `0x${string}`;  // verifyingContract, see §6.1.3

  // Identifies provider so buyer can verify origin against
  // tx.provider from on-chain state. With AutoWallet (Tier 1, the
  // default), this is the smart-wallet address — the one the kernel
  // sees.
  providerAddress: `0x${string}`;

  // The actual EOA that signed this envelope. With AutoWallet,
  // signerAddress is the owner EOA and differs from providerAddress
  // (the smart wallet). With direct EOA mode (Tier 2/3) they are equal.
  // Required so verifiers can do the two-step recovery check
  // unambiguously — see §6.1.4.
  signerAddress: `0x${string}`;

  // Encryption scheme. v1 uses X25519 + AES-256-GCM with HKDF-derived
  // session key. "public-v1" indicates plaintext payload (DEC-4 opt-out).
  scheme: "x25519-aes256gcm-v1" | "public-v1";

  // Provider's per-tx ephemeral X25519 public key, hex-encoded (32 bytes).
  // Used by buyer to derive shared secret via ECDH.
  // For scheme === "public-v1": MUST be the canonical empty value
  //   `0x` + "00".repeat(32) (a 32-byte zero string). The signature still
  //   covers it; canonical empty value preserves EIP-712 unambiguity.
  providerEphemeralPubkey: `0x${string}`;

  // AES-GCM nonce (96-bit, 12 bytes).
  // For scheme === "public-v1": canonical empty `0x` + "00".repeat(12).
  nonce: `0x${string}`;

  // Hash of the body, always computed over the RAW DECODED BYTES — never
  // over the wire transport encoding string. The body itself is NOT in
  // the signed projection (only its hash). This avoids signing
  // arbitrary-length data and keeps the typed-data hash bounded.
  //
  // - scheme === "public-v1":
  //     payloadHash = keccak256(utf8Bytes(body))
  //     where body is the UTF-8 plaintext JSON string of the payload.
  // - scheme === "x25519-aes256gcm-v1":
  //     payloadHash = keccak256(decodeHex(body))
  //     where body is the 0x-prefixed lowercase hex encoding of the
  //     AES-256-GCM ciphertext bytes.
  //
  // Both schemes hash over the raw plaintext or raw ciphertext bytes —
  // NEVER over a string representation of those bytes. The wire body
  // is the transport encoding; the hash is computed over the decoded
  // bytes. See §6.1.2.1 "Wire body encoding (Phase 3.7 canonicalization)."
  payloadHash: `0x${string}`;  // bytes32

  // AES-GCM authentication tag (16 bytes).
  // For scheme === "public-v1": canonical empty `0x` + "00".repeat(16).
  tag: `0x${string}`;

  // Unix-seconds timestamp; bounds replay even within same txId by
  // letting relay reject envelopes >N minutes old at POST time.
  createdAt: number;
}
```

**Canonical empty values rule:** every field in `EnvelopeSignedV1` is
present at every signing. For scheme `public-v1`, the four encryption-only
fields (`providerEphemeralPubkey`, `nonce`, `tag`) take fixed-length
zero-byte canonical values. There is no "omitted" — EIP-712 has no such
concept. The encryption scheme is unambiguous from the `scheme` discriminant.

#### 6.1.2 Wire envelope (relay payload)

```typescript
interface DeliveryEnvelopeWireV1 {
  // The fields above, exactly.
  signed: DeliveryEnvelopeSignedV1;

  // The actual body content. NOT in the signed projection — `payloadHash`
  // is the cryptographic binding.
  // - scheme === "public-v1": UTF-8 plaintext JSON string of the payload
  //   object. MUST be JSON-parseable. payloadHash = keccak256(utf8Bytes(body)).
  // - scheme === "x25519-aes256gcm-v1": 0x-prefixed lowercase hex encoding
  //   of the AES-256-GCM ciphertext bytes, where
  //   ciphertext = AES-256-GCM(sessionKey, nonce, utf8Bytes(plaintextJSON)).
  //   payloadHash = keccak256(decodeHex(body)).
  // See §6.1.2.1 for canonical encoding rules and §6.1.4 verification order.
  body: string;

  // Provider's EIP-712 signature over `signed` (under the domain in
  // §6.1.3). Binds the projection to a wallet controlled by
  // signed.providerAddress.
  providerSig: `0x${string}`;

  // Server-set wrapper metadata. NOT covered by signature.
  // The relay populates these on POST; they are advisory.
  serverMeta?: {
    receivedAt: string;     // ISO 8601, relay clock
    relayId: string;        // unique id for this stored envelope
  };
}
```

The relay GET returns the full `DeliveryEnvelopeWireV1` object. Buyer
recomputes `payloadHash` from `body` and verifies it matches
`signed.payloadHash` BEFORE invoking EIP-712 recovery — ensures the body
wasn't swapped after signing.

#### 6.1.2.1 Wire body encoding (Phase 3.7 canonicalization)

The canonical encoding of `DeliveryEnvelopeWireV1.body` is scheme-dependent
and was finalized during Phase 3.7 canonicalization to eliminate ambiguity
between transport encoding and hash domain. Earlier drafts of this AIP
described the encrypted body as `base64(ciphertext)`; the final encoding
is **hex, NOT base64**.

**Rules:**

| `signed.scheme` | `wire.body` content | `signed.payloadHash` |
|---|---|---|
| `public-v1` | UTF-8 plaintext JSON string of the payload object. MUST be JSON-parseable. | `keccak256(utf8Bytes(body))` |
| `x25519-aes256gcm-v1` | `0x`-prefixed lowercase hex encoding of the AES-256-GCM ciphertext bytes. MUST match `/^0x[0-9a-f]*$/`. | `keccak256(decodeHex(body))` |

**Invariant — hash is always over decoded bytes, never over the transport
string:**

> Both schemes hash over the raw plaintext or raw ciphertext bytes — NEVER
> over a string representation of those bytes. The wire body is the
> transport encoding; the hash is computed over the decoded bytes.

For the public scheme this happens to look like "hash the string" because
UTF-8 encoding of a JSON string IS its byte representation. For the
encrypted scheme the distinction is load-bearing: the hex string is
~2× the length of the underlying ciphertext bytes, and hashing the string
would produce a different digest than hashing the decoded ciphertext.

**Why hex, not base64:**

1. **Symmetry with everything else on the wire.** `payloadHash`,
   `providerEphemeralPubkey`, `nonce`, `tag`, `providerSig`, `txId`,
   `kernelAddress`, `providerAddress`, and `signerAddress` are all
   `0x`-prefixed lowercase hex. A single encoding rule reduces parser
   surface area and removes the "is this field base64 or hex?" branch
   from every implementation.
2. **No padding ambiguity.** Base64 has trailing-`=` rules, URL-safe vs.
   standard alphabets, and line-wrapping conventions that have caused
   interop bugs in adjacent protocols. Hex has exactly one canonical form
   once the case is fixed.
3. **Easier audit trace.** `payloadHash = keccak256(decodeHex(body))`
   is one line in every language without pulling a base64 library.
4. **Trivial conformance test.** A verifier can check `/^0x[0-9a-f]*$/`
   for the encrypted body without needing a base64 decoder at all.

**Wire size cost:** hex is ~2× the byte size of the underlying ciphertext
(vs. base64's ~4/3). The 256 KB envelope body limit accounts for this —
see §6.6.3 size-limit analysis (revised in Phase 3.7) and §13 Q3
resolution. The wire-size hit is real but worth the encoding-uniformity
win for a v1 protocol.

**Conformance:**

- Producers (SDK `EnvelopeBuilder`): for encrypted scheme, MUST emit
  body as `'0x' + ciphertext.toString('hex')` (or language equivalent
  producing lowercase, unpadded, prefix-included).
- Verifiers (buyer SDK, relay): for encrypted scheme, MUST decode
  `body` as hex (rejecting non-`/^0x[0-9a-f]*$/` strings) BEFORE
  computing `keccak256(decodedBytes)` and comparing to
  `signed.payloadHash`. MUST NOT decode then re-encode; the comparison
  is over the keccak256 output, not over the string.
- Test vectors live in the SDK conformance suite; the reference
  vector covers (a) public-v1 round trip, (b) encrypted-v1 round
  trip, and (c) the specific "string-vs-bytes hash" negative case
  that motivated this canonicalization.

#### 6.1.3 EIP-712 domain

```typescript
const DELIVERY_ENVELOPE_DOMAIN = {
  name: "AGIRAILS Delivery",
  version: "1",
  chainId: <network chainId>,
  verifyingContract: <ACTPKernel address on that chain>,
};

const DELIVERY_ENVELOPE_TYPES = {
  DeliveryEnvelopeSignedV1: [
    { name: "version", type: "uint8" },
    { name: "txId", type: "bytes32" },
    { name: "chainId", type: "uint256" },
    { name: "kernelAddress", type: "address" },
    { name: "providerAddress", type: "address" },
    { name: "signerAddress", type: "address" },
    { name: "scheme", type: "string" },
    { name: "providerEphemeralPubkey", type: "bytes32" },
    { name: "nonce", type: "bytes12" },
    { name: "payloadHash", type: "bytes32" },
    { name: "tag", type: "bytes16" },
    { name: "createdAt", type: "uint64" },
  ],
};
```

The `verifyingContract: kernelAddress` field is the canonical domain
separator used by every other signed protocol message in the system
(matches AIP-2.1 quote signing, AIP-4 delivery proofs, the V2 receipt
write in `Platform/agirails.app/web/lib/receipts/eip712.ts`). Its absence
from the original draft was an oversight.

Fixed-width byte types (`bytes32`, `bytes12`, `bytes16`) replace `bytes`
where the field length is fixed by cryptographic primitive — improves
gas/payload size + makes canonical-empty values trivially representable.

#### 6.1.4 Buyer verification order

Buyer SDK MUST verify in this order; any failure aborts with
`payload: undefined` + structured error.

1. Schema validation: every field present with correct type/length.
2. Fetch `tx = await runtime.getTransaction(signed.txId)`.
3. Verify `signed.chainId === <current network chainId>`.
4. Verify `signed.kernelAddress === <expected kernel for this chain>`.
5. Verify `signed.providerAddress.toLowerCase() === tx.provider.toLowerCase()`
   (on-chain participant match — same check the relay enforces in
   DEC-10, repeated here as defense-in-depth).
6. Verify `signed.createdAt` is within ±15 minutes of buyer clock (anti-
   replay window).
7. Recompute body hash, **always over the decoded bytes — never over
   the transport string** (see §6.1.2.1):
   - If `signed.scheme === "public-v1"`:
     `recomputed = keccak256(utf8Bytes(wire.body))`
     (UTF-8 plaintext JSON: the string bytes ARE the byte representation).
   - If `signed.scheme === "x25519-aes256gcm-v1"`:
     `recomputed = keccak256(decodeHex(wire.body))`
     (reject if `wire.body` does not match `/^0x[0-9a-f]*$/`).

   Verify `recomputed === signed.payloadHash`.
8. Recover EOA signer from `providerSig` over `signed` with the EIP-712
   domain in §6.1.3. Call the result `recoveredEOA`. Then perform the
   two-step smart-wallet check (mirrors V2 receipts auth):

   ```
   require recoveredEOA.toLowerCase() === signed.signerAddress.toLowerCase()
   require (
     signed.signerAddress.toLowerCase() === signed.providerAddress.toLowerCase()
     OR
     (await computeSmartWalletFromSigner(signed.signerAddress, network))
       .toLowerCase() === signed.providerAddress.toLowerCase()
   )
   ```

   The direction matters: derive smart wallet from the recovered EOA
   (forward), then compare to `providerAddress`. NOT the reverse
   (`providerAddress` → "extract owner EOA"), which has no general
   inverse — a smart wallet address does not unambiguously recover its
   owner key.

9. Per-scheme (see §6.1.2.1 for the canonical wire-body encoding):
   - `scheme === "public-v1"`: `JSON.parse(wire.body)` directly — the
     body is the UTF-8 plaintext JSON string.
   - `scheme === "x25519-aes256gcm-v1"`: decode `wire.body` as
     `0x`-prefixed lowercase hex (reject if not matching
     `/^0x[0-9a-f]*$/`), then AES-256-GCM-decrypt the decoded
     ciphertext bytes using the session key and `signed.nonce` +
     `signed.tag`. JSON.parse the resulting plaintext.

   In both schemes, the payloadHash check in step 5 already covered the
   raw decoded bytes — NEVER the transport string. If an implementation
   re-encodes `wire.body` to compute payloadHash, it will produce a
   different digest and reject a perfectly valid envelope. See the
   §6.1.2.1 invariant.

If any check fails: envelope discarded, buyer treats as missing delivery
and emits a structured `RunRequestResult.deliveryError` field for the
caller.

### 6.2 Privacy primitive — per-tx ephemeral X25519

**Why X25519, not secp256k1 ECDH?**

The buyer's wallet is secp256k1. We could perform ECDH on secp256k1, but
reusing the signing key for encryption violates cryptographic key separation
and creates side-channel risks. X25519 is the standard for ECDH; tiny
implementation (~30 LOC including Curve25519); well-vetted; not tied to wallet
key material.

**Per-tx keypair lifecycle:**

```
Buyer-side (in runRequest):
  1. const buyerEphemeralPriv = randomBytes(32)
  2. const buyerEphemeralPub = x25519.scalarMult(BASE, buyerEphemeralPriv)
  3. Include buyerEphemeralPub in request to provider (channel message
     or initial covenant request)
  4. Discard buyerEphemeralPriv after receiving + decrypting delivery
     (or after timeout)

Provider-side (in `Agent.processJob` after handler returns, see §6.3):
  1. const providerEphemeralPriv = randomBytes(32)
  2. const providerEphemeralPub = x25519.scalarMult(BASE, providerEphemeralPriv)
  3. const shared = x25519.scalarMult(buyerEphemeralPub, providerEphemeralPriv)
  4. const sessionKey = hkdfSha256(shared, salt=txId, info="agirails-delivery-v1", 32)
  5. const nonce = randomBytes(12)
  6. const ciphertext = aesGcm.encrypt(sessionKey, nonce, payload)
  7. Sign envelope with provider wallet, POST to relay
  8. Discard providerEphemeralPriv

Buyer-side decrypt:
  1. const shared = x25519.scalarMult(providerEphemeralPub, buyerEphemeralPriv)
  2. const sessionKey = hkdfSha256(shared, salt=txId, info="agirails-delivery-v1", 32)
  3. const plaintext = aesGcm.decrypt(sessionKey, nonce, ciphertext, tag)
  4. Verify plaintext hash matches expected (envelope already verified signature)
```

**Properties achieved:**

- **Confidentiality**: Relay sees ciphertext + ephemeral pubkey only. Cannot
  decrypt without one of the two private keys.
- **Forward secrecy**: Ephemeral keys discarded post-delivery. Future
  compromise of long-term wallet keys does NOT decrypt past payloads.
- **Origin authentication**: `providerSig` over the envelope (including
  ephemeral pubkey + payload hash) binds the encryption to the provider's
  long-term signing identity.
- **Replay resistance**: `txId` in signed envelope; signature fails if envelope
  is reposted under a different `txId`. Buyer also checks `txId` matches
  expected.
- **Per-tx independence**: Different transactions use different ephemeral
  keys and different sessionKey derivations (HKDF salt = txId).

**Implementation:**

- `@noble/curves/ed25519` for X25519 (~6 KB minified).
- Native Node.js `crypto.createCipheriv('aes-256-gcm', ...)` for AES-GCM.
- `@noble/hashes/hkdf` for HKDF.

Total new crypto dependency surface: one package (`@noble/curves`).

### 6.3 Provider flow

**Hook point (revised):** The provider-side hook is inside `Agent.processJob`
in `SDK and Runtime/sdk-js/src/level1/Agent.ts`, between line 1538 (where
the handler returns `result` and `deliveryProofJson` is built) and line 1607
(where `transitionState(job.id, 'DELIVERED', disputeWindowProof)` is called).

`ProviderOrchestrator` (in `src/negotiation/`) is **not** the v1 hook — Sentinel
does not go through it. Channel-publish responsibility lives in
`Agent.processJob` for v1. A v2 may push it down a layer for negotiation
flows, but that change is out of scope here.

```
┌─────────────────────────────────────────────────────────────────┐
│  Agent.processJob (after handler returns, before DELIVERED)     │
│  SDK location: src/level1/Agent.ts:~1538                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
              ┌──────────────────────────────────┐
              │  result = await handler(job, ctx)│
              │  (existing line 1521)             │
              └──────────────────────────────────┘
                              │
                              ▼
              ┌──────────────────────────────────┐
              │  Read service descriptor:         │
              │  - delivery.mode (default channel)│
              │  - delivery.privacy (default      │
              │    encrypted, see DEC-4)          │
              │  If mode = none → skip channel    │
              │    (legacy back-compat path).     │
              └──────────────────────────────────┘
                              │
                              ▼
              ┌──────────────────────────────────┐
              │  GET /api/v1/delivery/setup/     │
              │    {txId}                         │
              │  Relay returns DeliverySetupV1    │
              │  (buyer ephemeral pubkey + prefs).│
              │  See §6.4 for setup format.       │
              └──────────────────────────────────┘
                              │
                              ▼
              ┌──────────────────────────────────┐
              │  If privacy = encrypted:          │
              │   - Require setup.buyerEphPubkey  │
              │     present and well-formed       │
              │   - Generate providerEphemeral    │
              │     keypair (X25519)              │
              │   - ECDH + HKDF → sessionKey      │
              │   - AES-256-GCM(payloadJSON)      │
              │     → ciphertext, tag             │
              │   - body = '0x' + hex(ciphertext) │
              │     (see §6.1.2.1; NOT base64)    │
              │  If privacy = public:             │
              │   - body = JSON.stringify(result) │
              │   - canonical-empty crypto fields │
              └──────────────────────────────────┘
                              │
                              ▼
              ┌──────────────────────────────────┐
              │  Build EnvelopeSignedV1 +         │
              │  EnvelopeWireV1 (§6.1)            │
              │  Sign signed projection with      │
              │  provider wallet (EIP-712,        │
              │  smart-wallet path same as        │
              │  receipts V2 auth)                │
              └──────────────────────────────────┘
                              │
                              ▼
              ┌──────────────────────────────────┐
              │  POST envelope to                 │
              │  /api/v1/delivery (§6.5)          │
              │  Relay returns 201 + relay id     │
              │  Retry: 3 attempts, exp backoff.  │
              └──────────────────────────────────┘
                              │
                ┌─────────────┴─────────────┐
                │                            │
                ▼ (success)                  ▼ (all retries failed)
   ┌──────────────────────────┐   ┌────────────────────────────────┐
   │ Continue with audit +     │   │ Provider voluntary cancel path │
   │ DELIVERED transition       │   │ (see "Error handling" below)   │
   └──────────────────────────┘   └────────────────────────────────┘
                              │
                              ▼
              ┌──────────────────────────────────┐
              │  IN PARALLEL (audit path):        │
              │  - For privacy=public:            │
              │    DeliveryProofBuilder.buildPub  │
              │    (plaintext IPFS + EAS) — same  │
              │    as today                       │
              │  - For privacy=encrypted:         │
              │    DeliveryProofBuilder.buildEnc  │
              │    (ciphertext envelope hash +    │
              │    EAS only, no plaintext IPFS)   │
              │  - Failure here is non-fatal       │
              └──────────────────────────────────┘
                              │
                              ▼
              ┌──────────────────────────────────┐
              │  transitionState(txId,            │
              │    'DELIVERED', disputeWindowProof│
              │  )  (existing line ~1607)         │
              │  → on-chain DELIVERED             │
              └──────────────────────────────────┘
```

**Error handling — revised:**

The original draft claimed that if channel POST fails, provider holds back
`kernel.deliver()` and buyer's deadline refund eventually resolves it. **This
is incorrect** — `ACTPKernel.sol:691` (`_enforceTiming`) blocks the requester
from cancelling from IN_PROGRESS:

```solidity
// [H-4 FIX] Prevent requester from canceling after work started
if (fromState == State.IN_PROGRESS && toState == State.CANCELLED) {
    require(msg.sender != txn.requester, "Cannot cancel after work started");
}
```

So if the tx already advanced to IN_PROGRESS and the provider can't deliver
the payload, the buyer has no on-chain self-help. The provider must take the
initiative.

**Revised recovery paths (by failure stage):**

| Failure stage | Tx state | Provider obligation | Outcome |
|---|---|---|---|
| Setup fetch fails (encrypted required, no setup found) | COMMITTED | Provider voluntary cancel via SDK cancel wrapper → `transitionState(txId, 'CANCELLED', proof)` (allowed for provider from COMMITTED per `ACTPKernel.sol:696-702`). | Escrow returned to buyer instantly. |
| Handler runs, channel POST fails after N retries | IN_PROGRESS | Provider voluntary cancel via SDK cancel wrapper → `transitionState(txId, 'CANCELLED', proof)`. Provider IS allowed from IN_PROGRESS — line 691 only blocks requester. | Escrow returned to buyer; provider absorbs the wasted compute. |
| Channel POST succeeds, `kernel.deliver` fails transiently (gas/RPC/paymaster) | IN_PROGRESS | Provider retries `transitionState(txId, 'DELIVERED', proof)` up to N times with exponential backoff; relay envelope idempotent for same `(txId, providerSig)`. On exhaustion within retry budget → ops alert. Provider should NOT auto-cancel here — payload is already at relay; another deliver attempt eventually wins. | Settles normally once one deliver attempt succeeds. |
| Channel POST succeeds, `kernel.deliver` permanently fails (paymaster funds dry, smart-wallet bricked, kernel paused for ops, OR retry wall-clock exceeded) | IN_PROGRESS | Without escape hatch, escrow strands until deadline + buyer cannot self-help (kernel:691 blocks requester cancel from IN_PROGRESS). Provider / operator MAY voluntarily call `transitionState(txId, 'CANCELLED', proof)` from IN_PROGRESS to return escrow to buyer. Classified "permanent" = (a) ≥ N=10 retries fail with same root cause, OR (b) wall-clock since first attempt > min(deadline - 5min, 1 hour). Choose whichever happens first. Provider absorbs the wasted compute. | Escrow refunded to buyer; provider loses work + must rebuild whatever broke before next job. |
| Audit-path write fails (EAS or IPFS) | any | Log warning, continue. Non-blocking. | Audit replay loses this tx; channel path still completed normally. |

**Voluntary cancel rationale:** the kernel already supports
"provider can cancel anytime" semantics from COMMITTED and IN_PROGRESS. v1
delivery uses this primitive directly. Provider loses the wasted compute,
but cannot strand the buyer's escrow — a strictly better property than
"buyer waits for deadline and disputes."

**Provider griefing concern:** could a provider intentionally fail channel
POST to extract value? No — provider has nothing to gain. Voluntary cancel
returns the escrow to buyer and provider receives zero. The only attack
would be denial-of-service on a specific buyer, mitigated by reputation
penalties and buyer choice of provider (v2 reputation badges per AIP-10).

### 6.4 DeliverySetupV1 — handshake message

A new signed relay message posted by the **requester** (buyer) immediately
after `createTransaction` and before/around `linkEscrow`. Carries the buyer
ephemeral public key + delivery preferences. Provider fetches by txId when
picking up the job. See DEC-9 for rationale.

#### 6.4.1 Signed projection

```typescript
interface DeliverySetupSignedV1 {
  version: 1;

  // The transaction this setup is for. Provider GETs by this id.
  txId: `0x${string}`;          // bytes32

  // Domain separators.
  chainId: number;
  kernelAddress: `0x${string}`;

  // Requester (buyer) wallet — the on-chain participant. With AutoWallet
  // (Tier 1, the default), this is the smart-wallet address. With direct
  // EOA mode (Tier 2/3) it equals signerAddress.
  requesterAddress: `0x${string}`;

  // The actual EOA that signed this setup. With AutoWallet, signerAddress
  // is the owner EOA and differs from requesterAddress (the smart wallet).
  // Required for the two-step recovery check identical to §6.1.4 step 8.
  signerAddress: `0x${string}`;

  // Buyer's per-tx ephemeral X25519 public key (32 bytes).
  // For services where `delivery.privacy: public` (Sentinel default):
  //   canonical empty `0x` + "00".repeat(32). Provider sees this and
  //   skips ECDH, encodes payload plaintext.
  // For `delivery.privacy: encrypted` (default for general agents):
  //   real ephemeral pubkey. Provider uses it for ECDH.
  buyerEphemeralPubkey: `0x${string}`;     // bytes32

  // Tells provider which channel(s) buyer is willing to subscribe to.
  // v1: exactly one entry, "agirails-relay-v1". Future-proofing.
  acceptedChannels: string[];

  // Tells provider what privacy mode buyer expects. Provider can refuse
  // if its descriptor doesn't match (e.g., buyer says "encrypted" but
  // service is public-only — provider declines with an explicit reason).
  expectedPrivacy: "encrypted" | "public";

  // Anti-replay window for the setup itself. Setup is rejected by relay
  // if createdAt is older than 15 min from server clock.
  createdAt: number;            // Unix seconds

  // Setup expires after this many seconds. Default 3600 (1h). Provider
  // SHOULD NOT use a setup whose expiresAt has passed; relay garbage-
  // collects after expiresAt + grace.
  expiresAt: number;            // Unix seconds
}
```

#### 6.4.2 Wire setup

```typescript
interface DeliverySetupWireV1 {
  signed: DeliverySetupSignedV1;
  requesterSig: `0x${string}`;  // EIP-712 over `signed` by buyer wallet

  serverMeta?: {
    receivedAt: string;
    relayId: string;
  };
}
```

#### 6.4.3 EIP-712 domain (setup)

Same domain as envelope (§6.1.3): `name: "AGIRAILS Delivery"`, `version: "1"`,
`chainId`, `verifyingContract: <kernel>`. Single domain across both message
types simplifies key management — same buyer key signs setup as signs
on-chain transitions and receipts V2.

#### 6.4.4 Provider verification of setup

Before using a setup, provider MUST:
1. Verify schema + canonical-empty rules.
2. Verify `signed.chainId` and `signed.kernelAddress` match its environment.
3. Verify `signed.txId` matches a job it's currently working.
4. Fetch `tx = await runtime.getTransaction(signed.txId)`; verify
   `signed.requesterAddress.toLowerCase() === tx.requester.toLowerCase()`
   (matches DEC-10 participant check enforced by relay; repeated by
   provider as defense-in-depth).
5. Verify `signed.createdAt` is within ±15 min of provider clock.
6. Verify `signed.expiresAt > now`.
7. Recover EOA from `requesterSig` over `signed` with the EIP-712 domain
   in §6.4.3. Apply the same two-step smart-wallet check as §6.1.4 step 8,
   using `signed.signerAddress` and `signed.requesterAddress`:

   ```
   require recoveredEOA.toLowerCase() === signed.signerAddress.toLowerCase()
   require (
     signed.signerAddress.toLowerCase() === signed.requesterAddress.toLowerCase()
     OR
     (await computeSmartWalletFromSigner(signed.signerAddress, network))
       .toLowerCase() === signed.requesterAddress.toLowerCase()
   )
   ```

8. Verify `signed.expectedPrivacy` matches provider's own descriptor for
   this service. Mismatch → refuse delivery via voluntary cancel
   (`transitionState(txId, 'CANCELLED', ...)` from the COMMITTED side).

#### 6.4.5 Public-mode shortcut

For agents like Sentinel whose entire service catalog is `privacy: public`,
the buyer SDK may still post a setup message (with canonical-empty
pubkey + `expectedPrivacy: "public"`) for protocol uniformity. Optionally,
in v1.1, a `mode: none` descriptor allows skipping setup entirely for
legacy or testbed providers — but the v1 ProviderHook treats setup as
mandatory for any service that opts into channel delivery.

### 6.5 Buyer flow

```
┌─────────────────────────────────────────────────────────────────┐
│  runRequest after createTransaction (before linkEscrow)         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
              ┌──────────────────────────────────┐
              │  Read service descriptor:         │
              │  - delivery.mode = channel        │
              │  - delivery.privacy = encrypted/  │
              │    public                         │
              └──────────────────────────────────┘
                              │
                              ▼
              ┌──────────────────────────────────┐
              │  Generate ephemeral X25519        │
              │  keypair (encrypted only).         │
              │  Save buyerEphemeralPriv in       │
              │  in-process state keyed by txId.  │
              └──────────────────────────────────┘
                              │
                              ▼
              ┌──────────────────────────────────┐
              │  Build DeliverySetupSignedV1      │
              │  + sign with buyer wallet          │
              │  → DeliverySetupWireV1            │
              │  POST /api/v1/delivery/setup       │
              └──────────────────────────────────┘
                              │
                              ▼
              ┌──────────────────────────────────┐
              │  linkEscrow → COMMITTED           │
              │  (existing flow, unchanged)        │
              └──────────────────────────────────┘
                              │
                              ▼
              ┌──────────────────────────────────┐
              │  Poll on-chain state for tx       │
              │  AND in parallel:                 │
              │  GET /api/v1/delivery/{txId}      │
              │  Long-poll (?wait=30s) for        │
              │  envelope OR 204                  │
              └──────────────────────────────────┘
                              │
                              ▼
              ┌──────────────────────────────────┐
              │  Receive envelope:                 │
              │  1-8: schema + signature           │
              │     verification per §6.1.4        │
              │  9: decrypt (encrypted) OR         │
              │     JSON.parse (public)            │
              │  10: store decrypted payload in    │
              │     runtime state for runRequest   │
              │     to return                      │
              └──────────────────────────────────┘
                              │
                              ▼
              ┌──────────────────────────────────┐
              │  Wait for on-chain DELIVERED       │
              │  (state polling continues          │
              │   independently)                   │
              └──────────────────────────────────┘
                              │
                              ▼
              ┌──────────────────────────────────┐
              │  Buyer settles                     │
              │  → SETTLED, receipt minted,        │
              │     CLI prints payload + URL       │
              └──────────────────────────────────┘
                              │
                              ▼
              ┌──────────────────────────────────┐
              │  (v1.1) POST ACK to relay          │
              │  for audit. Non-blocking.          │
              └──────────────────────────────────┘
```

**Error handling:**

- **Setup POST fails**: buyer SDK retries (3x exp backoff). If still fails,
  abort the whole `runRequest` BEFORE `linkEscrow` — escrow never funded, no
  cleanup needed. Surface explicit error to caller.
- **Envelope arrives but signature fails**: discard, log forensic event. Wait
  for re-publish (provider retry) or timeout. `runRequest` returns with
  `payload: undefined` + `deliveryError: "envelope_signature_invalid"`.
- **Envelope never arrives, but DELIVERED on chain**: protocol anomaly.
  Buyer SDK warns; in v2 will attempt audit-path retrieval (EAS read).
  Buyer can dispute (DELIVERED → DISPUTED within dispute window) or settle
  anyway. v1: `payload: undefined` + `deliveryError: "no_envelope_at_relay"`.
- **Decryption fails**: integrity violation. Discard, log forensic event,
  treat as missing delivery. `payload: undefined` +
  `deliveryError: "decrypt_failed"`.
- **Buyer's process dies between setup POST and delivery**: buyerEphemeralPriv
  lost. Subsequent retrieval impossible via channel (forward secrecy is
  working as intended). v2 will allow EAS path or persistent buyer keys. For
  v1 this is documented as: buyer must stay online for the tx window
  (typically <60s for sync flows).

### 6.6 Relay endpoint semantics

#### 6.6.1 POST /api/v1/delivery/setup

Request body: `DeliverySetupWireV1` (§6.4.2).

Response (201):
```json
{
  "id": "setup_xxxxxxxx",
  "txId": "0x...",
  "expiresAt": "2026-06-05T..."
}
```

Auth: no auth header required — the EIP-712 signature in the body is the
auth. Relay verifies in this order; first failure short-circuits with the
status shown:

1. Schema validation, including canonical-empty rules → 400.
2. **Chain allowlist (DEC-10):** look up `configuredKernel =
   KERNEL_ALLOWLIST[signed.chainId]`. If `signed.chainId` unsupported → 400.
   If `signed.kernelAddress !== configuredKernel` → 403.
3. Recovered EOA signer matches `signed.signerAddress` (the actual EOA
   that signed) → 401 otherwise.
4. `signed.signerAddress` directly equals `signed.requesterAddress` OR
   `computeSmartWalletFromSigner(signed.signerAddress)` equals
   `signed.requesterAddress` → 401 otherwise.
5. **On-chain participant check (DEC-10):** read
   `tx = configuredKernel.getTransaction(signed.txId)` (always using the
   server-resolved kernel, never `signed.kernelAddress`). Verify
   `signed.requesterAddress.toLowerCase() === tx.requester.toLowerCase()`
   → 403 otherwise. If tx not found (createTransaction not yet mined) →
   425 (Too Early) + retry hint.
6. `signed.createdAt` within ±15 min of server clock → 400 otherwise.
7. `signed.expiresAt > now` → 400 otherwise.

#### 6.6.1.1 Setup idempotency and supersession

Setup is **mutable until envelope exists, frozen afterwards.** The model is
"buyer ephemeral keypair may be regenerated in retries until the provider
has actually used it (= envelope has been posted)."

| Condition | Outcome |
|---|---|
| First POST for this `txId`, all checks pass | 201, new record stored. |
| Re-POST with byte-identical body and same `requesterSig` | 200, existing record returned. Pure idempotent retry path (e.g., buyer SDK retried over a flaky network). |
| Re-POST with different `requesterSig` (or different fields) from the same on-chain requester, AND no envelope exists yet for this txId | 200, **the new record supersedes the old**. Use case: buyer SDK restarted, lost ephemeral key, generated a fresh one. Relay updates `delivery_setups` row with the newer signed projection and bumps `posted_at`. Schema `UNIQUE(tx_id, requester_sig_hash)` does not block this because the hash changed; deletion of the prior row is part of the supersession write. |
| Re-POST after envelope exists for this txId | 409 (setup frozen). Provider has already committed to the active ephemeral pubkey; superseding it now would invalidate the in-flight envelope's encryption target. |
| POST from different on-chain requester for an existing txId's setup | 403 (participant check fails upstream). |

Buyer SDK MUST NOT regenerate ephemeral keys after observing that the
provider has consumed the setup. The signal is: GET `/api/v1/delivery/{txId}`
returning 200 with a fresh envelope → setup is now frozen, do not POST a
new setup.

Rate limit: 60 setup POSTs per hour per requester wallet (generous; setup
is one-per-tx with a small retry budget).

Size limit: 4 KB.

#### 6.6.2 GET /api/v1/delivery/setup/{txId}

Response (200): the `DeliverySetupWireV1` object.

Response (404): no setup found OR setup expired.

Auth: open. Setup is not sensitive — `buyerEphemeralPubkey` is public by
design, other fields are derivable from chain.

Used by: provider Agent.processJob, immediately before encrypting payload.

#### 6.6.3 POST /api/v1/delivery

Request body: `DeliveryEnvelopeWireV1` (§6.1.2).

Response (201):
```json
{
  "id": "del_xxxxxxxx",
  "txId": "0x...",
  "receivedAt": "2026-06-05T..."
}
```

Auth + verification (same shape as §6.6.1 but provider-side):

1. Schema validation, canonical-empty rules → 400.
2. **Chain allowlist (DEC-10):** look up
   `configuredKernel = KERNEL_ALLOWLIST[signed.chainId]`. Unsupported →
   400; mismatch with `signed.kernelAddress` → 403.
3. Recovered EOA signer matches `signed.signerAddress` → 401 otherwise.
4. `signed.signerAddress` directly equals `signed.providerAddress` OR
   `computeSmartWalletFromSigner(signed.signerAddress)` equals
   `signed.providerAddress` → 401 otherwise.
5. **On-chain participant check (DEC-10):** read
   `tx = configuredKernel.getTransaction(signed.txId)`. Verify
   `signed.providerAddress.toLowerCase() === tx.provider.toLowerCase()`
   → 403 otherwise. If tx not found → 425 (Too Early).
6. `signed.txId` matches an on-chain tx in state COMMITTED / IN_PROGRESS /
   DELIVERED (envelope received before `transitionState(DELIVERED)` is OK
   if state ≥ COMMITTED; received after is also OK within retention) →
   409 otherwise.
7. `signed.createdAt` within ±15 min of server clock → 400 otherwise.

#### 6.6.3.1 Envelope idempotency and first-valid-wins

Envelope is **immutable once stored.** First valid envelope per txId from
the legit provider wins. Provider retries MUST reuse the same signed
envelope.

| Condition | Outcome |
|---|---|
| First POST for this `txId`, all checks pass | 201, new record stored. |
| Re-POST with byte-identical body and same `providerSig` | 200, existing record returned. Pure idempotent retry path. Provider retries (e.g., the previous POST's HTTP response didn't return cleanly) MUST land here — keep the same signed envelope bytes on the client. |
| Re-POST with different `providerSig` for same `txId` from the same on-chain provider | **409 (Conflict).** The first envelope is canonical; this is treated as either a client bug (provider regenerated the envelope when it shouldn't have) or an attempt to swap content after publication. Exception: if the existing record has passed `expires_at` (per §6.6.6 retention), the new record replaces it; the relay treats post-expiry replacement as a fresh first-POST. |
| Re-POST from a different on-chain provider | 403 (participant check fails upstream). |
| Re-POST with byte-identical body but `payloadHash` differs from the recomputed hash of `body` | 400 (signed projection doesn't match the wire body — defends against attackers who swap `body` while keeping the original `signed` block). |

**Provider implementation requirement:** when retrying a POST after a
network failure, the provider SDK MUST persist the originally-signed
envelope (signed bytes + signature) and replay the same bytes, not
re-sign. The `EnvelopeBuilder` in the SDK enforces this via a
per-txId cache: once an envelope is built for a txId, subsequent
`buildEnvelope(txId, ...)` calls within the same process return the
cached envelope.

Race-replay attempt detection: if step 3 succeeds but step 4 fails
(recovered EOA's smart-wallet derivation doesn't match `providerAddress`),
the relay logs a forensic event with the recovered EOA so we can
investigate stolen-key vs. mis-configured-SDK cases. 401 returned to caller.

Rate limit: 30 envelope POSTs per minute per provider wallet (generous;
envelopes are one-per-tx, retries within the budget reuse the same bytes).

Size limit: 256 KB envelope **wire body** (per §13 Q3 resolution). The
realistic plaintext bound is meaningfully smaller — and depends sharply on
whether the payload is pure JSON/text or carries binary as
base64-in-JSON. Note that under the Phase 3.7 canonical encoding (§6.1.2.1)
the encrypted wire body is **hex** (~2× expansion vs. ciphertext bytes),
NOT base64 (~4/3 expansion), so the wire→ciphertext math below uses the
hex factor:

```
256 KB wire body
  − ~200 B JSON wrapper + per-field overhead
  ÷ 2  (hex inflation in wire body: 2 hex chars per byte)
  ≈ 128 KB raw ciphertext bytes
  − 16 B AES-GCM auth tag
  → ~128 KB raw plaintext for pure JSON / text content
  → ÷ 1.33 again if the JSON itself wraps binary as inline base64
  → ~95–100 KB raw binary effectively addressable in v1 inline mode
```

**Pure JSON/text payloads** (Sentinel reflection, lead-gen contact lists,
summaries, classification labels, code generation output, structured
research results): ~128 KB realistic bound. Comfortable for the great
majority of agent commerce we expect in the next 12 months; if a JSON
output approaches this bound the service descriptor SHOULD declare
`max_plaintext_kb` so the buyer SDK can warn early.

**Binary-in-JSON convenience** (`{ contentType, filename, dataBase64 }`):
plan for ~95–100 KB raw binary. Suitable for small icons, thumbnails,
short audio clips. NOT suitable for typical PDFs (1–5 MB), generated
images (500 KB+), screenshots, document attachments.

Payloads exceeding these bounds require `delivery.mode: reference` (AIP-17,
not in v1 scope) — see §6.7.1 for the explicit framing.

#### 6.6.4 GET /api/v1/delivery/{txId}

Response (200): the `DeliveryEnvelopeWireV1` object. Includes optional
`Cache-Control: private, max-age=60` for buyer to safely cache between polls.

Response (404): no envelope yet.

Authorization (per §13 Q4 resolution):
- For `scheme: public-v1`: open (no auth). Consistent with `delivery.privacy:
  public` opt-in semantics.
- For `scheme: x25519-aes256gcm-v1`: open ciphertext access. Anyone can
  download; only buyer can decrypt. Rate-limited to mitigate scraping
  (per-IP + per-txId limits at relay).
- v1.1 may add buyer-EIP-712 auth as an opt-in hardening; v1 keeps it open
  to avoid the V2-receipt-auth complexity for the ciphertext-only case.

Long-poll: `GET /api/v1/delivery/{txId}?wait=30s` blocks up to 30s waiting for
the envelope. Returns 204 if timeout. Buyer SDK uses this to avoid hammering
the relay.

SSE: `GET /api/v1/delivery/{txId}/events` for clients that prefer push.
Out of scope for v1 minimum; nice-to-have for v1.1.

#### 6.6.5 POST /api/v1/delivery/{txId}/ack (v1.1, deferred per §13 Q2)

Per Damir's §13 decision, ACK ships in v1.1, not v1. Sketch retained for
forward reference:

Request body:
```json
{
  "txId": "0x...",
  "payloadHash": "0x...",
  "buyerAddress": "0x...",
  "signature": "0x..."
}
```

Storage: append-only log indexed by txId. Mediator-readable. Never gates
provider settlement.

#### 6.6.6 Retention policy

- Setup messages: until `expiresAt` + 1 hour grace.
- Envelopes (encrypted): 24 hours from POST.
- Envelopes (public): 24 hours (same default). Configurable in v2 per
  service descriptor's `retention_hours`.
- ACK records (v1.1): 30 days (audit window).

After channel expiry, EAS+IPFS is the recovery path — subject to the DEC-3
privacy split (encrypted services' IPFS contains ciphertext envelope, not
plaintext).

### 6.7 Service descriptor changes

`AGIRAILS.md` gains a `delivery` block per service. Defaults:

```yaml
services:
  - type: <service-name>
    price: <amount>
    delivery:
      mode: channel         # default
      privacy: encrypted    # default — see DEC-4
      channel: agirails-relay-v1   # the only v1 channel
      retention_hours: 24   # default
      schema_uri: <optional, JSON schema or string description>
```

For Sentinel:

```yaml
services:
  - type: onboarding
    price: "10"
    delivery:
      mode: channel
      privacy: public      # daily reflection is public-by-design
      channel: agirails-relay-v1
      retention_hours: 24
      schema_uri: |
        Returns { reflection: string, service: string, timestamp: string }
```

For a hypothetical lead-gen agent:

```yaml
services:
  - type: lead-search
    price: "5"
    delivery:
      mode: channel
      privacy: encrypted   # contact data is sensitive
      channel: agirails-relay-v1
      retention_hours: 24
      schema_uri: ./schemas/leads-v1.json
```

Discoverability: `agirails.app/a/{slug}` shows a "Delivery: encrypted via
relay, 24h retention" badge per service. Builds buyer trust.

#### 6.7.1 What v1 inline delivery actually carries (honest framing)

AIP-16 v1 inline delivery (`delivery.mode: channel`) is **JSON-first by
design**. The recommended payload shape for every v1 service is a single
JSON object that fits comfortably under the realistic plaintext bound
(~128 KB pure JSON under the Phase 3.7 hex wire encoding — see §6.6.3
size-limit honesty budget and §6.1.2.1 for why hex). Examples that
are good fits:

- `{ reflection, service, timestamp }` (Sentinel)
- `{ leads: [...], confidence, methodology }` (lead-gen)
- `{ summary, citations, model }` (research/summarization)
- `{ classification, scores }` (classification agents)
- `{ patch, files_changed, tests_run }` (code-gen)
- `{ extracted, schema_version }` (data extraction)
- `{ url, expires_at }` (an opaque link string when the link itself IS the
  product, like an S3 presigned URL valid for 1h)

**Binary content is supported only as a small base64-in-JSON convenience.**
(Note: the `dataBase64` field here is base64 of the binary content
*inside* the JSON payload — distinct from the encrypted wire body
encoding, which is hex per §6.1.2.1.) A service MAY return
`{ contentType, filename, dataBase64 }` for outputs ≤95–100 KB raw —
small icons, thumbnails, short audio clips. This is NOT the recommended
path for typical binary outputs:

| Content type | Typical size | v1 fit? | Recommended path |
|---|---|---|---|
| PDF report | 1–10 MB | ❌ | AIP-17 reference mode |
| Generated image (PNG/JPG, 1024×1024) | 500 KB – 3 MB | ❌ | AIP-17 reference mode |
| Screenshot | 100 KB – 1 MB | ❌ | AIP-17 reference mode |
| Icon, thumbnail, sticker (≤100 KB) | <100 KB raw | ✅ | v1 base64-in-JSON convenience |
| Short audio clip (≤100 KB raw) | <100 KB raw | ✅ | v1 base64-in-JSON convenience |
| CSV / spreadsheet | varies | ✅ if <128 KB text | Inline JSON when small; AIP-17 reference for larger datasets |
| Code bundle / patch | varies | ✅ if <128 KB text | Inline as text; tarballs go AIP-17 |
| Video / multi-MB media | >5 MB | ❌ | AIP-17 reference + streaming (AIP-18+) |

**Promise to buyers:** v1 delivery guarantees byte-faithful, signed,
optionally-encrypted JSON delivery to the buyer process. v1 does NOT
attempt to be a general blob-delivery substrate. Providers whose service
output is fundamentally a binary file SHOULD wait for AIP-17 reference
mode before claiming a full v1 onboarding — otherwise their first-buyer
UX is "you paid $10 and got a `dataBase64` field you have to decode
yourself," which is a strictly weaker wow signal than the inline JSON
path delivers.

This honesty section exists because the original draft framed AIP-16 as
"the delivery surface" without bounding what it covers. Damir's
clarification 2026-06-05 made explicit that **inline is JSON-first**;
binary file delivery is a separate protocol concern that AIP-17 will
specify (reference contract over arbitrary third-party storage —
S3/R2/IPFS/Arweave/provider-hosted), with the same EIP-712 signing
discipline and same ECDH encryption as v1 inline.

### 6.8 ACK semantics (audit-only, v1.1)

Per DEC-5, the ACK is post-settlement and non-blocking. Its purpose:

- **Dispute defense for provider**: if buyer later claims "never received
  the content," provider points to ACK in relay logs.
- **Dispute defense for buyer**: if buyer never ACK'd, this is evidence
  payload integrity failed or never arrived. Mediator weighs accordingly.
- **Reputation signal**: providers with high ACK rates get reputation
  boost (badges per AIP-10). Providers with low ACK rates flagged for review.

Buyer SDK posts ACK opportunistically after successful decrypt + payload
return to caller. Failure to post ACK does NOT block any user-facing action.

---

## §7 Failure Modes & Resilience

| Failure | Detection | Recovery |
|---|---|---|
| Provider relay POST fails (during work, before deliver) | HTTP non-2xx after 3x retries | Provider voluntarily transitions tx to CANCELLED via SDK cancel wrapper → `transitionState(txId, 'CANCELLED', proof)`. Kernel allows this from IN_PROGRESS for provider (only blocks requester per `ACTPKernel.sol:691`). Escrow returns to buyer instantly; provider absorbs wasted compute. (Buyer cannot self-help here — the original draft's "buyer deadline refund" was incorrect because IN_PROGRESS lockouts the requester.) |
| Provider relay POST OK, `transitionState(DELIVERED)` fails transiently | RPC error / gas / paymaster | Provider retries up to N=10. Relay envelope is idempotent. Eventual success. |
| Provider relay POST OK, `transitionState(DELIVERED)` fails permanently (paymaster dry, smart-wallet bricked, kernel paused, retry budget exceeded) | Classified "permanent" per §6.3 table | Operator/provider voluntarily transitions IN_PROGRESS → CANCELLED to unstrand escrow. Buyer refunded; provider absorbs cost. |
| Provider posts wrong envelope (bug or attack) | Buyer signature verify fails | Buyer discards. If repeated, forensic logging at relay. Buyer treats as missing delivery → dispute or refund. |
| Provider encrypts to wrong ephemeral pubkey | Buyer decrypt fails | Same as above: missing delivery, refund or dispute. |
| Relay garbage-collects envelope before buyer pulls | Buyer GET returns 404 + envelope timestamp > 24h | Fall back to audit path (EAS read in v2). v1: buyer sees "delivery expired" and gets explicit error. |
| Buyer process dies mid-tx | Buyer SDK restart can't decrypt (ephemeralPriv gone) | EAS path (v2) or accept loss. Trade-off of forward secrecy. v1 documents this. |
| Replay attack — same envelope reposted under different txId | Signature verifies but txId mismatch | Buyer + relay reject (txId in signature payload). |
| Replay attack — same envelope reposted for same txId by attacker | Relay rejects: signature provider does not match tx.provider OR duplicate detection | Forensic log. |
| Provider POSTs after buyer settled (race) | Settled tx, late delivery | Envelope still stored for 24h. Buyer can fetch retroactively. Not a failure per se. |
| Relay outage during delivery | Provider POST fails, no envelope to retrieve | Behaves like "Provider relay POST fails." Tx stalls until deadline. Relay outage is observable; ops mitigation outside this AIP. |
| Buyer never sends ephemeralPub | Provider has no key to encrypt to | Provider responds with error; buyer's request was malformed. Treat as never-submitted. v1 validates ephemeralPub format at request creation. |
| Schema mismatch (provider sends wrong shape) | Buyer SDK has expected schema from service descriptor; can validate | Buyer SDK warns; passes payload to caller anyway with `schemaMatch: false` field. Caller decides. |

---

## §8 Security Analysis

### 8.1 Threat model

| Adversary | Capability | Mitigation |
|---|---|---|
| Passive observer of chain | Sees txId, addresses, amounts | Ciphertext payload not on chain; no leak. |
| Passive observer of relay | Sees ciphertext + envelope metadata | Cannot decrypt without one of two ephemeral private keys. |
| Active relay operator | Can read, drop, delay, replay | Cannot decrypt. Drop/delay → buyer sees missing delivery → refund. Replay attacks defeated by signature binding to txId. |
| Malicious provider | Wants to claim payment without delivering | Must POST signed envelope before kernel.deliver(); buyer verifies. False envelope (e.g., wrong content) → buyer disputes with payload hash as evidence. |
| Malicious buyer | Wants to receive content without paying | Settlement state machine is unchanged. Buyer settles after decrypt; cannot retroactively unsettle. Pre-settlement: provider already has signed envelope evidence; in dispute, provider wins. |
| Network attacker (MITM on buyer's wire) | Modifies envelope in transit | EIP-712 signature breaks; buyer rejects. |
| Quantum adversary (future) | Breaks X25519 | Out of scope for v1. v2 may add post-quantum alongside (hybrid scheme). |

### 8.2 Specific concerns

**Q: What if relay colludes with provider to backdate envelopes?**

Relay timestamps are advisory. Provider signature is the binding evidence.
Disputes refer to on-chain `Delivered` event timestamp as the canonical
"delivery claimed at" moment. Relay can lie about its receive time but cannot
change what was signed.

**Q: What if buyer's ephemeral pubkey is intercepted in the request?**

The buyer ephemeral pubkey is public information by design. Knowing it does
not enable decryption (attacker would need provider's ephemeral private key
too). Worst case: an attacker who knows buyer's ephemeralPub AND impersonates
the provider could POST a malicious envelope. But provider impersonation
fails the signature check (provider address must match on-chain
`tx.provider`). No exploit.

**Q: What about buyer privacy from provider?**

Provider learns the buyer's wallet address (it's on-chain). Provider learns
the buyer's ephemeral pubkey (sent in request). Provider does NOT learn the
buyer's other wallets, agents, or browsing history. This is the baseline
privacy property of any agent commerce protocol.

**Q: Can a provider serve different content to different observers (sybil
delivery)?**

Yes, in v1. Provider POSTs one envelope; only buyer can decrypt. Future:
provider could include payload hash in EAS attestation, allowing later proof
of "this exact content was delivered." v1 ships with audit path optional;
sybil delivery is a low-risk concern for the synchronous-CLI use case
(buyer compares against advertised schema).

**Q: Buyer process compromise → all past payloads readable?**

No — ephemeral keys are discarded after use. Compromise of the long-term
wallet key (the one signing tx) does NOT decrypt past delivery payloads.
This is the forward-secrecy property we get for free from per-tx ephemeral
keys.

---

## §9 Compatibility & Migration

### 9.1 Backward compatibility with existing transactions

- Existing in-flight transactions (any `state < SETTLED`): continue to work
  via the current path. `BlockchainRuntime.getTransaction().deliveryProof`
  remains empty; buyer-side `payload: undefined` is the existing behavior.
  No regression.
- Existing settled transactions: receipt URLs continue to render. No payload
  retroactively appears. Future audit-replay tooling (v2) can backfill from
  EAS.
- Existing service descriptors without `delivery` block: SDK assumes
  `{ mode: "none", privacy: "n/a" }` for any service that doesn't declare,
  matching today's behavior (no payload returned).

### 9.2 Provider opt-in

Providers must update their AGIRAILS.md to declare delivery mode AND update
their SDK to v4.2.0+ to pick up the new `Agent.processJob` delivery hook
(see §6.3 — `src/level1/Agent.ts:~1538`). Until both happen for a given
provider, delivery behaves as today (silent empty payload).

Sentinel will be migrated as the reference implementation. Once Sentinel is
on the new path, the `actp test` user experience demonstrates the wow signal,
which drives broader adoption.

### 9.3 Buyer opt-in

Buyer SDK at v4.2.0+ automatically uses delivery channel when:
- Buyer has X25519 keypair generation available (always, in Node.js).
- Service descriptor declares `delivery.mode = channel`.

Buyer SDK at older versions: ignores the new channel entirely; sees empty
`payload`. No errors, no breakage.

### 9.4 Platform deployment

Relay at agirails.app gains the `/api/v1/delivery/*` endpoints. The existing
negotiation relay routes are untouched. Database gains a `delivery_envelopes`
table for storage + retention. No on-chain changes.

### 9.5 Network / chain compatibility

Channel-based delivery is chain-agnostic. Works identically on Base Sepolia,
Base Mainnet, and any future EVM chain ACTPKernel deploys to. EIP-712 domain
chainId binds the envelope signature to the chain.

---

## §10 Surfaces Touched (per-repo)

### 10.1 sdk-js

New modules:
- `src/delivery/types.ts` — `DeliveryEnvelopeSignedV1`, `DeliveryEnvelopeWireV1`,
  `DeliverySetupSignedV1`, `DeliverySetupWireV1`, related types.
- `src/delivery/keys.ts` — X25519 keypair helpers (via `@noble/curves`).
- `src/delivery/envelope.ts` — provider-side: build + sign envelope. Includes
  canonical-empty encoding rules.
- `src/delivery/setup.ts` — buyer-side: build + sign setup; provider-side:
  fetch + verify setup.
- `src/delivery/crypto.ts` — ECDH + HKDF + AES-GCM primitives, with both
  encrypt() and decrypt() in one module for round-trip clarity.
- `src/delivery/reader.ts` — buyer-side: fetch envelope, run §6.1.4
  verification chain, return decrypted payload OR structured deliveryError.
- `src/delivery/client.ts` — relay client (POST / GET / long-poll wrappers).
- `src/delivery/mockChannel.ts` — in-process loopback channel implementation
  for MockRuntime path (per §13 Q6 — canonical mock behavior).

Modified modules:
- **`src/level1/Agent.ts`** — **the v1 provider hook is here**, NOT in
  ProviderOrchestrator. Inject channel-publish + setup-fetch between the
  handler return (line ~1521) and the DELIVERED transition (line ~1607).
  The legacy `runtime.stateManager.setDeliveryProof` shortcut becomes a
  test-only helper, retained for backward compat in unit tests but no
  longer the canonical path. Branch on service descriptor `delivery.mode`:
  - `channel` (new default): publish to relay.
  - `none` (legacy back-compat): skip channel; behavior matches today.
- **`src/cli/lib/runRequest.ts`** — generate ephemeral buyer key, POST setup
  before `linkEscrow`, subscribe to delivery channel during state polling,
  return decrypted payload in `RunRequestResult.payload` + structured
  `RunRequestResult.deliveryError` when something fails.
- **`src/builders/DeliveryProofBuilder.ts`** — split into
  `buildPublicProof(payload)` (current path: plaintext IPFS + EAS) and
  `buildEncryptedProof(envelope)` (NEW: envelope-hash-only EAS, no plaintext
  to IPFS). Per DEC-3 privacy split.
- **`src/runtime/BlockchainRuntime.ts`** — the `deliveryProof: ''` line 664
  TODO is repurposed: the field is intentionally empty on this read path;
  delivery payload now flows via the channel reader, not via runtime state.
  Add an inline comment pointing to AIP-16 + the new reader module.
- **`src/runtime/MockRuntime.ts`** — wire to the new mockChannel for
  loopback delivery; preserve `stateManager.setDeliveryProof` as test-only
  helper.

Untouched (explicitly):
- `src/negotiation/ProviderOrchestrator.ts` — Sentinel doesn't pass through
  this. v2 may move channel publish here for negotiation flows; out of scope.
- All settlement-path code (StandardAdapter, kernel calls, receipts V2).

Tests:
- Unit: encryption roundtrip; signature verify; canonical-empty handling;
  schema rejection; envelope vs setup distinction.
- Integration: full setup→envelope→buyer flow against MockRuntime with
  loopback channel.
- E2E: testnet flow against Sentinel post-migration.

LOC estimate (revised): ~700 net (~900 new across delivery/ + Agent.ts
hook + runRequest changes, ~200 removed/refactored in DeliveryProofBuilder
split + cleanup). Original ~400 estimate did not account for the setup
message subsystem (added in DEC-9) or the audit-path split (DEC-3 revision).

### 10.2 agirails.app

New routes:
- `POST /api/v1/delivery/setup` — receive setup (buyer-signed).
- `GET /api/v1/delivery/setup/{txId}` — provider fetches setup.
- `POST /api/v1/delivery` — receive envelope (provider-signed).
- `GET /api/v1/delivery/{txId}` — fetch envelope.
- `GET /api/v1/delivery/{txId}?wait=30s` — long-poll envelope.
- `GET /api/v1/delivery/{txId}/events` (v1.1) — SSE.
- `POST /api/v1/delivery/{txId}/ack` (v1.1) — buyer ACK.

New schema:
- `delivery_setups` table:
  `(id, tx_id, requester_address, expected_privacy, setup_json, posted_at,
    expires_at, requester_sig_hash)`.
  Unique on `(tx_id, requester_sig_hash)` for idempotency.
  Index on `tx_id`.
- `delivery_envelopes` table:
  `(id, tx_id, provider_address, scheme, envelope_json, posted_at,
    expires_at, provider_sig_hash)`.
  Unique on `(tx_id, provider_sig_hash)` for idempotency.
  Index on `tx_id`.

New cron:
- Garbage-collect expired setups + envelopes (every 5 min).

UI:
- Receipt page (`/r/{id}`) gains optional "Content" section when service
  was public AND envelope still in retention window. Encrypted services
  show "Content: encrypted, visible to buyer only" badge.
- Agent profile (`/a/{slug}`) shows delivery-mode badges per service.

LOC estimate (revised): ~350 net (~250 routes + storage + 100 UI / cron).
Original ~250 missed the setup subsystem.

### 10.3 seed-sentinel

- Update `sentinel.md` to declare `delivery.mode = channel`, `delivery.privacy = public`.
- Bump SDK dependency to ≥4.2.0.
- No app code changes; `Agent.processJob` delivery hook (§6.3) lives inside
  the SDK and is invoked transparently once the `delivery` block is declared.

LOC estimate: ~10 (config + dep bump).

### 10.4 actp-kernel

**No on-chain changes in v1.** State machine, events, escrow logic untouched.
The `Delivered` event semantic is unchanged; docs add a clarifying note that
on-chain `Delivered` means "provider claims work submitted, dispute window
opens" — not "buyer has content."

A v2 may add `ContentReceived(txId, payloadHash, ackSig)` or similar; that's
explicit future work, not part of this AIP.

### 10.5 Docs

- AIP-0 (Protocol Overview): updated state machine diagram to clarify
  Delivered semantic + add Delivery layer.
- AIP-4 (Delivery Proofs & EAS): marked "audit/dispute path only" with
  pointer to AIP-16.
- AGIRAILS.md spec: documents `delivery` block.
- README.md (top-level): updated quick-start to show payload retrieval in
  `actp test` output.

---

## §11 Test Plan

### 11.1 Unit tests (sdk-js)

| Test | Asserts |
|---|---|
| `EnvelopeBuilder.build()` produces valid v1 envelope | Schema validates; payloadHash matches keccak256(payload). |
| `EnvelopeBuilder.sign()` produces recoverable EIP-712 signature | `verifyTypedData` returns provider's address (EOA path). |
| `EnvelopeBuilder.sign()` smart-wallet path | Signature recovers to EOA; smart-wallet derivation matches PR #34 logic. |
| `EnvelopeReader.verify()` rejects tampered envelope | Modifying any signed field invalidates signature. |
| `EnvelopeReader.verify()` rejects wrong provider | EIP-712 recover gives address ≠ `tx.provider`. |
| `EnvelopeReader.decrypt()` round-trips correctly | encrypt(plaintext) → ciphertext → decrypt(ciphertext) === plaintext. |
| `EnvelopeReader.decrypt()` rejects wrong ephemeral pubkey | AES-GCM auth tag fails. |
| `EnvelopeReader.decrypt()` rejects tampered ciphertext | AES-GCM auth tag fails. |
| Public-scheme envelope skips encryption | Payload field is plaintext JSON; no ephemeral keys. |
| X25519 key generation produces 32-byte keys | Length + entropy check. |
| HKDF key derivation deterministic | Same shared+salt+info → same key. |

### 11.2 Integration tests (sdk-js + MockRuntime)

| Test | Asserts |
|---|---|
| Full provider→relay→buyer flow encrypted | Buyer's `runRequest` returns decrypted payload object. |
| Full provider→relay→buyer flow public | Buyer's `runRequest` returns plaintext payload. |
| Provider POST fails → buyer sees missing | Buyer's `payload` is `undefined`; `deliveryError` field set. |
| Buyer subscribes before provider POSTs (race A) | Long-poll waits, eventually returns envelope. |
| Buyer subscribes after provider POSTs (race B) | Immediate GET returns envelope. |
| Buyer receives envelope with wrong txId | Rejected; `payload: undefined`. |
| Provider posts twice with same signature (idempotent) | Second POST returns 200, same envelope id. |
| Provider posts twice with different signatures (conflict) | Second POST returns 409. |
| Channel disabled (mode: none in descriptor) | Buyer SDK skips channel; `payload: undefined` silently. |

### 11.3 E2E tests (Base Sepolia)

| Test | Asserts |
|---|---|
| Sentinel public delivery: `actp test` prints reflection | Real on-chain flow; payload visible in CLI. |
| Hypothetical encrypted-service flow against test agent | Encrypted envelope round-trip on testnet. |
| Receipt page renders content for public service | `/r/{id}` shows reflection text. |
| Receipt page hides content for encrypted service | `/r/{id}` shows "encrypted, visible to buyer only" badge. |

### 11.4 Adversarial tests

| Test | Asserts |
|---|---|
| Replay envelope under different txId | Signature recovery fails OR txId mismatch → rejected. |
| Forge envelope as different provider | Recovered address ≠ tx.provider → rejected. |
| Oversize payload attack (provider sends 100 MB) | Relay enforces size limit; provider sees 413. |
| Slowloris on long-poll | Relay enforces connection limits; standard load shedding. |
| Buyer pubkey corruption (random bytes) | Provider decryption produces garbage; provider signs garbage envelope; buyer rejects on schema/integrity check. |
| Relay impersonation (DNS hijack) | Provider signature still verifies if buyer has authentic envelope (TLS + envelope-internal signature). Buyer doesn't rely solely on relay identity. |

### 11.5 Property-based tests

- Roundtrip for any payload up to N bytes succeeds.
- Roundtrip with random ephemeral keys preserves plaintext.
- Signature verification is robust against payload mutation in any byte.

---

## §12 Phased Roadmap

### Phase 0 — Spec freeze + review (1 week)

- This AIP gets reviewed by: Damir, Codex, any human reviewers.
- Open questions in §13 get resolved.
- Final spec frozen as AIP-16 Final (or revised to v2 draft).

### Phase 1 — SDK foundation (1 week)

- `src/delivery/*` modules built + unit-tested.
- `Agent.processJob` delivery hook added (§6.3, `src/level1/Agent.ts:~1538`),
  gated behind `ACTP_DELIVERY_CHANNEL=v1` env flag (default off for
  backward compat during rollout).
- runRequest modified, also flag-gated.
- All unit + integration tests passing in MockRuntime.

### Phase 2 — Platform relay (1 week, parallel with Phase 1)

- `agirails.app` gains `/api/v1/delivery/*` endpoints.
- Database migration: `delivery_envelopes` table.
- Retention cron.
- Integration tests against staging.
- Deploy to production with feature flag (relay accepts POSTs but no client
  uses them until Sentinel migrates).

### Phase 3 — Sentinel migration (3 days)

- Update `seed-sentinel/sentinel.md` to declare delivery.
- Bump SDK to v4.2.0.
- Deploy. Test `actp test` against Sentinel on testnet — confirm reflection
  appears in CLI.

### Phase 4 — General release (1 week)

- Feature flag turns on by default for SDK v4.2.0 buyers and providers.
- Update docs + AIP-4 cross-references.
- Announce in changelog + Moltbook.

### Phase 5 — v1.1 enhancements (later, ~1 week)

- SSE endpoint for push delivery.
- ACK endpoint and Mediator integration.
- Receipt page renders content for public scheme.
- Agent profile delivery-mode badges.

### Phase 6 — v2 considerations (future, separate AIP)

- Persistent buyer keys for very-async use cases.
- EAS read implementation (audit replay tooling, `actp tx replay`).
- p2p / WebRTC channel alternative.
- Post-quantum hybrid encryption.

**Total v1 timeline: ~3 weeks engineering + 1 week review.**

---

## §13 Resolved Decisions (Damir review round 1, 2026-06-05)

The original draft listed these as Open Questions. Damir's review resolved
all six. Recorded here as binding decisions for the frozen draft.

### Q1 → DECIDED: option (d) `DeliverySetupV1` relay message

A new signed relay message posted by the buyer right after `createTransaction`
and before/around `linkEscrow`. Provider fetches by `txId` when picking up
the job. Format in §6.4; endpoint in §6.6.1–6.6.2. See DEC-9 for full rationale.

Rejected alternatives:
- (a) On-chain calldata: too expensive.
- (b) NegotiationChannel piggyback: incompatible with Sentinel (Sentinel
  does not use NegotiationChannel at all — confirmed at
  `sdk-js/src/cli/lib/runRequest.ts:19`, which never imports it).
- (c) HTTP header on endpoint: works only for endpoint-flow services;
  retained as v2 adapter shortcut for low-latency direct integrations.

Public-mode services (Sentinel default) post a setup with canonical-empty
buyer pubkey + `expectedPrivacy: "public"` — protocol-uniform shape,
provider skips ECDH on receipt.

### Q2 → DECIDED: v1.1 for ACK

ACK shipped in v1.1, not v1. Mediator integration is not v1-ready and v1
surface is already large enough.

### Q3 → DECIDED: 256 KB envelope body limit

256 KB hard limit at relay, applied to `DeliveryEnvelopeWireV1.body` size.

Per Damir's clarification, and under the Phase 3.7 canonical wire
encoding (§6.1.2.1: encrypted body = hex, NOT base64), for
`scheme: x25519-aes256gcm-v1` the real plaintext max is smaller because:
- hex encoding overhead: +100% (2 hex chars per byte).
- AES-GCM auth tag: +16 bytes.
- Per-field JSON overhead: ~200 bytes for the wire envelope wrapper.

Effective bound depends on payload shape:
- **Pure JSON/text**: ~128 KB realistic plaintext.
- **Binary wrapped in JSON** (`{ contentType, dataBase64 }`): ~95–100 KB
  raw binary, because the inner base64 still inflates the binary +33%
  inside the JSON payload before AES-GCM encryption and hex-encoding for
  the wire body.

Service descriptor SHOULD declare `max_plaintext_kb` if it routinely
returns large outputs, so buyer SDK can warn early. Payloads exceeding
these bounds require `delivery.mode: reference` (AIP-17, separate spec —
not in AIP-16 v1 scope). See §6.7.1 below for the honest framing of
"v1 inline is JSON-first."

### Q4 → DECIDED: open GET for ciphertext in v1, rate-limited

No buyer auth on `GET /api/v1/delivery/{txId}` in v1 for ciphertext access.
Anyone can download the ciphertext; only buyer can decrypt. Rate limits
mitigate scraping. v1.1 may add buyer-EIP-712 auth as opt-in hardening.

Public plaintext access (`scheme: public-v1`) follows the same open GET
semantics — consistent with the `delivery.privacy: public` opt-in.

### Q5 → DECIDED: don't block AIP-16 on descriptor versioning

For v1, buyer SDK resolves the service descriptor at request time (most
recent published `configHash` from AgentRegistry). Historical / per-tx
descriptor versioning is a separate concern that applies to all
`AGIRAILS.md` fields, not just delivery. Tracked as future AIP, does not
gate AIP-16.

Race condition acknowledged: if a provider updates its descriptor between
buyer reading it and provider receiving the job, the two sides may
disagree on `delivery.privacy`. Mitigation: provider verifies setup
`expectedPrivacy` against its own descriptor; mismatch → voluntary cancel
(per §6.4.4 step 8). Buyer's escrow returns instantly.

### Q6 → DECIDED: MockRuntime gets loopback delivery channel

MockRuntime's loopback channel becomes the canonical mock behavior — it
exercises the full envelope + setup pipeline in-process. The legacy
`runtime.stateManager.setDeliveryProof` shortcut survives only as a test
helper for tests that need to inject a raw payload (e.g., testing
deserialization edge cases). It is no longer the canonical mock-runtime
delivery path.

---

## §14 Non-goals

To prevent scope creep, the following are explicitly NOT in this AIP:

- **On-chain payload storage**: payloads remain off-chain. The `Delivered`
  event remains the on-chain settlement-layer signal.
- **Streaming delivery** (continuous content over a transaction lifetime):
  one envelope per tx in v1. Streaming is a v2+ concern.
- **Multi-party delivery** (one provider, many buyers paying together):
  one buyer per tx, baseline ACTP. Multi-buyer requires AIP-X
  multi-identity work.
- **Buyer-to-provider request encryption**: this AIP covers provider→buyer
  delivery only. Buyer's request payload to provider remains plaintext.
  Bidirectional encryption is a separate concern (likely AIP-17).
- **Payload schema enforcement at protocol level**: schemas are advisory
  (`schema_uri` in service descriptor). Buyer SDK may validate but does
  not enforce.
- **Mediator workflow changes**: dispute resolution mechanics unchanged.
  Mediator gains EAS+ACK as additional evidence sources, but state machine
  is the same.
- **Receipt page content rendering for encrypted payloads**: out of scope.
  The receipt page shows "encrypted, visible to buyer" badge; the buyer
  reads decrypted content via SDK/CLI.
- **Post-quantum cryptography**: v1 ships X25519. PQ migration is a v2+
  concern under a separate AIP.

---

## §15 Why This AIP is the Right Shape

A reader will reasonably ask: "Is this just over-engineering? Can't we
ship a smaller fix?"

The smaller fix exists. It's "implement EAS read in BlockchainRuntime."
~300 LOC, three days. We considered it explicitly in DEC-1.

We rejected it for three reasons:

1. **Economics**: EAS+IPFS in the hot path costs more than sub-$10
   transactions are worth. The "default delivery path" should match the
   median transaction's economics. The median ACTP transaction is, and
   will remain, small.

2. **Latency**: EAS finality + IPFS pinning take seconds-to-minutes.
   `actp test` settles in ~25s today. Adding 30-60s for content retrieval
   doubles the perceived latency.

3. **Architectural debt**: keeping EAS as the primary delivery substrate
   forces every future delivery feature to bend around proof-shape data
   structures. Decoupling now means future features (streaming, bidirectional
   encryption, p2p) don't inherit this confusion.

The "right shape" of this AIP is **not** "smallest fix that surfaces the
reflection in `actp test`." That fix has a name: it's the audit-replay tool
in v2. The right shape is **the architectural change that makes delivery
first-class for the next 100 services**, with Sentinel being the first
beneficiary.

This is the difference between a patch and a protocol upgrade. Damir asked
for "pravo rješenje, ne ništa hitno." Pravo rješenje is this.

---

## §16 References

### 16.1 Conversation thread (source material)

- **Sentinel test 2026-06-04 21:00**: `actp test` against Sentinel returned
  `reflection: undefined` despite successful settlement. Surfaced the gap.
- **Claude ultra-think 2026-06-04**: first proposed three-layer architecture
  with channel delivery as default.
- **Codex first-principles review 2026-06-04 22:07**: confirmed ground
  truth; corrected LOC estimate (80–120 → 300+); corrected ACK-as-gate
  scenario (would enable buyer griefing); flagged payload privacy as
  first-class concern; recommended renaming "negotiation channel" → "delivery
  channel."
- **Claude sharpening 2026-06-04 23:15**: integrated Codex corrections;
  proposed ECDH-to-buyer-pubkey privacy primitive; sized phase 1 + 2 as
  vertical slice with privacy.
- **Damir directive 2026-06-05 00:30**: "ne želim ništa danas i hitno…
  pravo rješenje… detaljno i pažljivo." Triggered AIP-16 draft.

### 16.2 Existing protocol references

- **AIP-0**: Protocol overview, state machine.
- **AIP-2.1**: Channel-driven multi-round negotiation. Established the relay
  channel infrastructure that AIP-16 extends.
- **AIP-4**: Delivery proofs and EAS attestations. Retained as audit/dispute
  surface in AIP-16's three-layer model.
- **AIP-5**: Dispute resolution. Will reference ACK + EAS as evidence sources
  in v1.1.
- **AIP-15 (DRAFT)**: Session key authority. Independent; AIP-16 uses per-tx
  ephemeral keys that don't touch session-key infrastructure.

### 16.3 Code references (point-in-time, 2026-06-05)

- `SDK and Runtime/sdk-js/src/runtime/BlockchainRuntime.ts:664` — empty
  deliveryProof TODO.
- `SDK and Runtime/sdk-js/src/cli/lib/runRequest.ts:300` — buyer-side
  deliveryProof read.
- `SDK and Runtime/sdk-js/src/Agent.ts:1521` — provider handler result.
- `SDK and Runtime/sdk-js/src/Agent.ts:1537` — MockRuntime state-manager
  attach.
- `SDK and Runtime/sdk-js/src/Agent.ts:1594` — real-chain deliver path
  (discards payload).
- `Public Agents/seed-sentinel/src/agent.ts:87` — reflection handler return.
- `Public Agents/seed-sentinel/src/agent.ts:103-107` — return shape.
- `SDK and Runtime/sdk-js/src/builders/DeliveryProofBuilder.ts` — EAS/IPFS
  audit pipeline.
- `SDK and Runtime/sdk-js/src/negotiation/NegotiationChannel.ts:41` —
  negotiation message union (currently no delivery variant).
- `Platform/agirails.app/web/app/api/v1/relay/route.ts:21` — relay route
  message types (quote/counteroffer/counteraccept only).

### 16.4 External standards

- **EIP-712**: typed structured data signing (envelope signature).
- **X25519**: RFC 7748 elliptic-curve Diffie-Hellman.
- **AES-256-GCM**: NIST SP 800-38D authenticated encryption.
- **HKDF-SHA256**: RFC 5869 key derivation.
- **`@noble/curves`**: audited TypeScript implementation of X25519.

---

## §17 Acknowledgments

Damir Mujic — for asking the question "zašto mi sentinel nije vratio
nikakvu poruku za moju uplatu?" that revealed this gap. The protocol
existed in a state where this question could be asked and have no good
answer for months; surfacing it is the actual hard work.

Codex (anonymous reviewer) — for ground-truth code audit and the
buyer-griefing correction that prevented this AIP from shipping a worse
state than current.

Claude ultra-think — for the three-layer mental model and first-principles
reframing.

---

## Changelog

| Date | Version | Author | Change |
|---|---|---|---|
| 2026-06-05 | draft-1 | Arha | Initial draft synthesizing conversation thread, Codex review, and code audit. |
| 2026-06-05 | draft-2 | Arha (incorporating Damir review round 1) | Six material fixes + §13 decisions. See "Revision 2 — what changed" below. |
| 2026-06-05 | draft-3 | Arha (incorporating Damir review round 2) | Four blocker fixes + two strong-suggestion fixes. See "Revision 3 — what changed" below. |
| 2026-06-05 | draft-4 | Arha (incorporating Damir review round 3) | Two final spec cleanups before Codex hand-off: kernel-address allowlist + tightened idempotency/supersession rules. See "Revision 4 — what changed" below. |
| 2026-06-05 | draft-5 | Arha (incorporating Damir review round 4) | Honesty pass: corrected optimistic 190 KB plaintext bound for binary-in-JSON (real raw-binary limit is ~120–150 KB after double base64 expansion). Added §6.7.1 framing AIP-16 v1 as JSON-first delivery, binary as base64-in-JSON convenience only. Forward-references AIP-17 (reference delivery contract over arbitrary third-party storage) as the binary/file-delivery path. |
| 2026-06-06 | draft-5 (Rev6 fixup) | Arha (Phase 3.7 canonicalization) | Canonical wire body encoding — public=UTF-8 plaintext JSON, encrypted=0x-prefixed lowercase hex. Replaces earlier base64 references and clarifies that payloadHash is always computed over decoded bytes (NOT the string transport encoding). New §6.1.2.1 "Wire body encoding (Phase 3.7 canonicalization)" makes the rule explicit; envelope payloadHash comment, wire body field doc, §6.3 ASCII diagram, §6.6.3 size math, §6.7.1 size table and §13 Q3 math all updated for hex (2× wire inflation, not base64 4/3 ratio). Pure-JSON bound revised 190 KB → 128 KB; binary-in-JSON realistic bound 120–150 KB → 95–100 KB. No protocol semantics changed; this is a transport-encoding canonicalization in support of SDK conformance work. |

### Revision 2 — what changed

Damir's review found six hard issues that required structural fixes, not
just textual tweaks. Each is now resolved in-place; the corresponding §
notes the fix.

| # | Issue | Where it was | Where it is now |
|---|---|---|---|
| 1 | Relay POST fail recovery was incorrect: claimed buyer's deadline refund would resolve a stuck IN_PROGRESS tx, but `ACTPKernel.sol:691` blocks requester cancel from IN_PROGRESS. | §6.3 "Error handling" first bullet | §6.3 "Error handling — revised" + §7 first row. Provider voluntarily cancels via `kernel.cancel()` (allowed for provider from IN_PROGRESS — line 691 blocks only the requester). |
| 2 | Q1 recommended (b) NegotiationChannel + (c) HTTP header, but Sentinel does not import NegotiationChannel (`runRequest.ts:19`), so (b) doesn't apply to the very service we want to wow. | §13 Q1 (originally open) | DEC-9 (new) + §6.4 (new) + §6.6.1–6.6.2 (new endpoints) + §13 Q1 resolved to (d). Dedicated `DeliverySetupV1` relay message posted by buyer right after `createTransaction`. |
| 3 | Audit path would have leaked private payloads to plaintext IPFS via the existing `DeliveryProofBuilder` flow (`DeliveryProofBuilder.ts:70`). | DEC-3 (original) | DEC-3 (revised) + §10.1 (DeliveryProofBuilder split). Audit path stores plaintext IPFS ONLY when `delivery.privacy: public`. Encrypted services store ciphertext envelope hash + EAS attestation, no plaintext at any layer. |
| 4 | Hook location was wrong: draft said modify `ProviderOrchestrator`, but Sentinel doesn't pass through it — handler result lives in `Agent.processJob` (`level1/Agent.ts:~1521`). | §6.3 + §10.1 sdk-js modified modules | §6.3 (revised, new hook diagram + line refs) + §10.1 (revised). v1 hook is `src/level1/Agent.ts:~1538`, between handler return and DELIVERED transition. ProviderOrchestrator is explicitly NOT touched in v1. |
| 5 | EIP-712 domain missing `verifyingContract: kernelAddress`. Other signed protocol messages (V2 receipts, AIP-2.1 quotes, AIP-4 delivery proofs) use kernel as domain separator. | §6.1 original domain block | §6.1.3 (revised). Domain now includes `verifyingContract: <kernelAddress>`. Same domain reused by `DeliverySetupV1` (§6.4.3) for key-management uniformity. |
| 6 | Envelope schema mismatch: TypeScript interface omitted `payloadHash` field but EIP-712 type signed it; optional fields were described as "omitted" which EIP-712 does not support; non-canonical empty values would cause ambiguous signatures. | §6.1 original `DeliveryEnvelopeV1` interface + types block | §6.1.1–6.1.4 (revised). Split into `DeliveryEnvelopeSignedV1` (signed projection, every field always present, canonical-empty for scheme-irrelevant fields) and `DeliveryEnvelopeWireV1` (signed projection + body + signature + server metadata). Fixed-width byte types (`bytes32`, `bytes12`, `bytes16`) replace `bytes` for cryptographic primitives. Explicit verification order in §6.1.4. |

§13 decisions: all 6 open questions resolved (Q1 → setup message, Q2 → v1.1
for ACK, Q3 → 256 KB envelope body limit, Q4 → open GET ciphertext with
rate limits, Q5 → don't block on descriptor versioning, Q6 → MockRuntime
loopback canonical).

---

### Revision 3 — what changed

Damir's round-2 review found four blockers + two strong suggestions. All
six are now closed in-place.

| # | Issue | Where it was | Where it is now |
|---|---|---|---|
| 1 | txId DoS via relay: `UNIQUE(tx_id, sig_hash)` lets attackers race-post forged setup/envelope for arbitrary txIds. Either blocks legit message (one record) or pushes filter to N consumers (many records). | §6.6 endpoints accepting any signed body with valid sig | DEC-10 (new) + §6.6.1 / §6.6.3 (revised). Relay reads `kernel.getTransaction(signed.txId)` at POST time and rejects mismatch with 403 (or 425 if tx not yet mined). Idempotency UNIQUE constraints remain as defense-in-depth for legitimate retries. |
| 2 | Smart-wallet signature semantics imprecise — original §6.1.4 step 8 reversed direction ("recovered matches derivation of providerAddress" instead of "smart wallet derived from recovered matches providerAddress"); receipts V2 had to fix the same direction last week. | §6.1 envelope + §6.4 setup interface + §6.1.4 verification | Added `signerAddress` field to both `DeliveryEnvelopeSignedV1` and `DeliverySetupSignedV1`. Verification now: `recoveredEOA === signerAddress AND (signerAddress === participantAddress OR computeSmartWalletFromSigner(signerAddress) === participantAddress)`. Direction explicitly noted: derive forward from EOA, then compare to smart-wallet target. Same pattern applied to relay-side participant check. |
| 3 | §3 architecture diagram still said "Provider can't settle without buyer ACK" — direct contradiction with DEC-5 which establishes ACK as audit-only. | §3 Delivery surface Failure row | Rewritten to "Missing envelope → buyer does not settle, may dispute via on-chain path; provider voluntary cancel returns escrow. ACK (v1.1) is audit-only." |
| 4 | Stale `ProviderOrchestrator` references survived in §9.2 (opt-in), §10.3 (Sentinel), Phase 1 roadmap, and §6.2 (privacy primitive snippet). | Five locations | All replaced with `Agent.processJob` delivery hook (`src/level1/Agent.ts:~1538`) per §6.3 revised. Only the historical Revision 2 changelog entry retains `ProviderOrchestrator` as a factual reference to the original draft's mistake. |
| 5 | No escape hatch for permanent `kernel.deliver` failure (paymaster dry, smart-wallet bricked, kernel paused for ops, retry budget exhausted). Tx would strand in IN_PROGRESS until deadline. | §6.3 error handling row 3 + §7 failure table | §6.3 table now has a second deliver-failure row distinguishing transient (retry) from permanent (operator voluntary cancel). Permanent classified as: ≥10 retries with same root cause OR wall-clock > min(deadline − 5min, 1 hour). §7 row split same way. |
| 6 | Terminology: `kernel.cancel(txId)` is shorthand; actual API is `transitionState(txId, 'CANCELLED', proof)` — implementers would grep for nonexistent method. | §6.3 + §7 tables | All actionable references switched to `transitionState(...)` form (with "SDK cancel wrapper" prose framing). Conceptual references to "kernel cancel semantics" retained where context makes the meaning unambiguous. |

§13 decisions: unchanged from Revision 2. All six remain resolved.

---

### Revision 4 — what changed

Damir's round-3 review found two spec-cleanup items that needed to land
before the draft was strong enough for external cross-review.

| # | Issue | Where it was | Where it is now |
|---|---|---|---|
| 1 | Relay verification of `signed.kernelAddress` was implicit — the spec said "verify domain" but didn't make clear the relay must never trust caller-supplied `kernelAddress`. Left open the "caller-selected verifying contract" attack where a forged envelope points at an attacker-controlled contract and a naive relay either queries the attacker or sign-verifies against an attacker-chosen EIP-712 domain. | DEC-10 + §6.6.1 + §6.6.3 verification steps | DEC-10 expanded with a Kernel-address-must-be-server-resolved subsection. §6.6.1 + §6.6.3 verification step lists now explicitly: lookup `configuredKernel = KERNEL_ALLOWLIST[signed.chainId]` first (400 if chain unsupported), then require `signed.kernelAddress === configuredKernel` (403 on mismatch), then use `configuredKernel` (not caller-supplied) for all chain-RPC operations. Field stays in signed projection because buyer verifies it end-to-end against buyer's own configured kernel. |
| 2 | Idempotency rules conflated three distinct cases: legitimate retry (same signature) vs. legitimate supersession (buyer regenerated ephemeral key after restart) vs. attempted overwrite. Setup vs. envelope had different correct semantics (setup mutable until envelope exists; envelope immutable from first-valid-wins) but the spec treated them identically. | §6.6.1 + §6.6.3 idempotency paragraphs | Two new subsections: §6.6.1.1 "Setup idempotency and supersession" with a five-row decision table (first POST, byte-identical retry, signature-change supersession before envelope, frozen-after-envelope, cross-requester impersonation). §6.6.3.1 "Envelope idempotency and first-valid-wins" with a five-row decision table that establishes first-valid-wins, requires provider SDK to persist the originally-signed envelope and replay byte-for-byte on retry, and treats post-expiry as a fresh first-POST. SDK requirement: per-txId envelope cache in `EnvelopeBuilder` enforces the byte-identical-retry rule at the source. |

§13 decisions: unchanged from Revision 2. All six remain resolved.

Rev4 changes are scoped to spec wording + DEC-10 elaboration. No new
architectural decisions, no new endpoints, no new schema columns. The
existing UNIQUE constraints and tables are sufficient to express the
tightened rules.

---

### Revision 5 — what changed

Damir's round-4 review surfaced one honesty issue that had survived
through prior revisions: the spec's optimistic plaintext-bound math (~190 KB)
ignored the *double* base64 expansion that happens when binary content is
wrapped as `{ contentType, dataBase64 }` inside a JSON payload that then
gets AES-GCM-encrypted and base64-encoded for wire transit. The realistic
raw-binary inline bound is ~120–150 KB, not ~190 KB.

| # | Issue | Where it was | Where it is now |
|---|---|---|---|
| 1 | Plaintext bound math was optimistic — gave ~190 KB without accounting for the second base64 expansion when binary travels as `dataBase64` inside JSON. | §6.6.3 size-limit paragraph + §13 Q3 resolution | Both rewritten with explicit two-layer expansion math. Pure JSON/text bound stays ~190 KB; binary-in-JSON realistic raw bound is ~120–150 KB. Service descriptor field `max_plaintext_kb` recommended where bound matters. |
| 2 | The spec framed AIP-16 as "the delivery surface" without explicitly bounding what content shapes it handles well. Binary delivery for PDFs/images/files was not addressed directly, leaving readers (and Codex reviewers) to infer the gap. | Implicit through §13 Q3 | New §6.7.1 "What v1 inline delivery actually carries (honest framing)." Lists good-fit JSON shapes per service category; lists content types unsuitable for v1 inline (PDF reports, generated images, video, multi-MB media); forward-references AIP-17 as the binary/file-delivery path. Sets honest expectation: providers whose output is fundamentally a binary file SHOULD wait for AIP-17 before claiming a full v1 onboarding. |

§13 decisions: unchanged from Revision 2. All six remain resolved.

Rev5 changes are scoped to spec wording and honest bounding. No new
endpoints, no new schema columns, no new decisions. The "AIP-17 successor
planned" note in the header makes the v1/v2 split explicit for Codex and
future readers.

---

### Revision 6 fixup — Phase 3.7 wire-body canonicalization

Damir's Phase 3.5 implementation review (2026-06-06) surfaced that the
spec was still describing the encrypted `DeliveryEnvelopeWireV1.body`
as `base64(ciphertext)` even though the SDK's `EnvelopeBuilder`,
`EnvelopeVerifier`, and conformance vectors had standardized on
`0x`-prefixed lowercase hex during Phase 3.7 canonicalization. The
two needed to match exactly, because the hash domain is load-bearing:
hashing the transport string instead of the decoded bytes produces a
different digest and breaks signature verification on the receiver side.

| # | Issue | Where it was | Where it is now |
|---|---|---|---|
| 1 | Encrypted wire body described as `base64(ciphertext)`; payloadHash comment said "ciphertext bytes base64-encoded". | §6.1.1 payloadHash comment + §6.1.2 wire body field + §6.3 producer ASCII diagram | All three rewritten. Encrypted body = `'0x' + hex(ciphertext)` (lowercase, unpadded). Public body = UTF-8 plaintext JSON string of the payload. payloadHash explicitly defined per-scheme: `keccak256(utf8Bytes(body))` for public; `keccak256(decodeHex(body))` for encrypted. |
| 2 | No single section that named the encoding rule. Implementers reading just §6.1 could miss that the public scheme hashes the UTF-8 bytes while the encrypted scheme hashes the decoded ciphertext bytes (NOT the hex string). | Implicit | New §6.1.2.1 "Wire body encoding (Phase 3.7 canonicalization)" — table of (scheme, body content, payloadHash), the load-bearing invariant ("hash is always over decoded bytes, never over the transport string"), rationale for hex vs. base64 (encoding uniformity with every other field, no padding ambiguity, easier audit trace, trivial `/^0x[0-9a-f]*$/` conformance test), wire-size cost note, and producer/verifier conformance rules. |
| 3 | Size-budget math in §6.6.3 used base64's 4/3 inflation factor. Under hex (2×) the realistic plaintext bound is smaller. | §6.6.3 "Size limit" block + §13 Q3 mirror block + §6.7.1 size table + header line-7 ">190 KB" | All updated for hex math. Pure JSON/text plaintext bound: ~190 KB → **~128 KB**. Binary-in-JSON realistic raw bound: ~120–150 KB → **~95–100 KB**. §6.7.1 size table icon/audio thresholds adjusted to ≤100 KB; CSV/code-bundle threshold adjusted to <128 KB; "screenshot" reclassified ❌ (was ⚠) since the new bound makes it consistently AIP-17 territory. Header successor-planned threshold updated to >128 KB. |

§13 decisions: unchanged from Revision 2. All six remain resolved; only
the Q3 numbers move (256 KB wire-body cap is identical, the plaintext
implications shrink because hex wastes more wire than base64 did).

Rev6 fixup changes are scoped to transport-encoding canonicalization
and the size math that depends on it. No protocol semantics change.
No state-machine, no endpoints, no schema columns, no signature
schemes, no decisions move. References elsewhere in the spec to
base64 (the `dataBase64` field name inside JSON payloads, the
forensic notes describing why we considered base64 originally) are
intentionally retained — those refer to payload-level binary-in-JSON
encoding, which is independent of the wire body's transport encoding.

This fixup keeps the spec aligned with the canonical SDK
implementation that Phase 3.7 finalized; any reviewer cross-checking
against `EnvelopeBuilder.encode()` / `EnvelopeVerifier.decode()` will
now see the same encoding rule on both sides.

---

**End of AIP-16-DRAFT (revision 5, Rev6 fixup applied).**

Status note: this is the **freeze-candidate draft.** Five rounds of Damir
review integrated, plus Phase 3.7 wire-encoding canonicalization fixup.
Next action: send to Codex for cross-review. If Codex finds material
issues, revision 6 lands. If Codex concurs, this draft
promotes to AIP-16 final and Phase 1 implementation begins.

Parallel work item: AIP-17 (reference delivery contract) — drafting can
proceed in parallel with AIP-16 Phase 1 implementation, because the two
specs touch disjoint surfaces (AIP-16 = inline channel; AIP-17 = signed
pointer to external storage). Damir's round-4 sketch is the seed.
