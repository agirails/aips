# AIP-17: Reference Delivery Contract

**Status:** Draft (paired with AIP-16 freeze-candidate; ready for Codex cross-review)
**Author:** AGIRAILS Core (Arha — synthesizing input from Damir Mujic 2026-06-05 sketch + first-principles framing, Claude design questions A/B/C 2026-06-05, and AIP-16 inline-delivery boundary analysis)
**Created:** 2026-06-05
**Last Revised:** 2026-06-05 (revision 2)
**Depends On:** AIP-0 (Protocol Overview), AIP-16 (First-Class Delivery Surface)
**Related:** AIP-2.1 (Channel-driven Multi-round Negotiation), AIP-4 (EAS audit fallback), AIP-5 (Dispute Resolution)
**Extends:** AIP-16 — adds a second delivery mode (`reference`) alongside `channel` (inline). No changes to AIP-16's relay endpoints, signing primitives, or state-machine semantics; only a new content shape carried in the existing `DeliveryEnvelopeWireV1.body`.

---

## ⚠ Context

AIP-16 v1 solves inline payload delivery for sub-~190 KB JSON/text outputs.
~90% of agent commerce we expect in 2026 fits there: Sentinel reflections,
lead-gen contact lists, summarization, classification, code generation,
structured research results.

The other ~10% is binary or oversized: PDFs (1–10 MB), generated images
(500 KB – 3 MB), screenshots, CSV exports, audio transcripts, code
bundles, model artifacts. AIP-16's `dataBase64` convenience tops out at
~120–150 KB raw binary — useful for icons and thumbnails, not for real
file delivery.

This AIP specifies the contract by which providers deliver oversized or
binary content to buyers using **third-party storage** (S3, R2, IPFS,
Arweave, provider-hosted endpoints — anywhere), while keeping the same
signing discipline, the same ECDH encryption scheme, the same relay
endpoints, and the same dispute-evidence properties as AIP-16.

The protocol does not become a file-hosting platform. It standardizes
the **reference**.

---

## §0 TL;DR

| Concern | AIP-16 (inline) | AIP-17 (reference) |
|---|---|---|
| Content size | ≤190 KB JSON / ≤150 KB binary | Large outputs (storage-bound; SDK v1 default cap 100 MB per blob) |
| Transport | Channel envelope body carries the payload | Channel envelope body carries a signed **reference**; actual bytes live at the URI |
| Storage | Relay (24h retention) | Anywhere with HTTP `GET` (S3/R2/IPFS/Arweave/provider) |
| Privacy | ECDH-encrypted body by default; public opt-in | ECDH-encrypted **reference** + ECDH-encrypted **blob** by default; public opt-in uses plaintext stored bytes |
| Integrity | One hash binds body to signature | **Dual hash**: ciphertext hash (verify download) + content hash (commit to plaintext) |
| Dispute | Mediator reads EAS attestation | Mediator reads EAS attestation + verifies dual-hash chain against any blob the parties produce |
| Storage SLA | Relay retention 24h | Provider declares `retention_hours` in service descriptor; sync buyer settles only after required references are fetched + verified |

ACTP standardizes the reference contract; storage backend is the
provider's choice. Same EIP-712 domain as AIP-16. Same envelope endpoints.
Same buyer setup flow. No new on-chain state.

---

## §1 Problem Statement

### 1.1 What AIP-16 v1 cannot deliver

| Content type | Typical size | AIP-16 v1 fit? |
|---|---|---|
| PDF report | 1–10 MB | ❌ |
| Generated image (PNG/JPG 1024×1024) | 500 KB – 3 MB | ❌ |
| Screenshot | 100 KB – 1 MB | ⚠ borderline |
| CSV/dataset export | 100 KB – 100 MB | ❌ above ~190 KB |
| Audio transcript / clip | 100 KB – 10 MB | ❌ |
| Code bundle / tarball | 100 KB – 5 MB | ❌ |
| Video / multi-MB media | 5 MB+ | ❌ |
| Model output (weights, embeddings) | MB–GB | ❌ |

Any provider whose service output is fundamentally a binary file needs
this AIP before their first-buyer UX is good. Otherwise buyers get
"settled successfully, your `dataBase64` field is 8 MB of base64 in
the CLI output" — strictly worse than a clean URL.

### 1.2 What we are NOT solving

The protocol does not provide:
- Storage hosting (providers bring their own).
- File schema validation (advisory `schema_uri` only).
- Search / discovery over delivered blobs.
- Streaming (separate AIP — likely AIP-18).
- Multi-buyer simultaneous delivery (AIP-X multi-identity).
- Sub-blob random access at the protocol level (range requests are
  buyer-SDK convenience, not protocol semantics).

### 1.3 Why "just return a URL" isn't enough

Buyer doesn't pay for a URL. Buyer pays for verifiable access to content.
A bare `{ "url": "https://provider.com/report.pdf" }` does NOT standardize:

- Whether content at the URL is the content that was promised
  (no commitment).
- Whether URL still resolves when buyer fetches (link rot).
- Who is authorized to access the URL (URL leak risk).
- What the buyer expected hash/size/content-type is (no schema).
- How the buyer's privacy is protected when fetching (provider's
  hosting infra sees buyer IP, possibly identity).
- How a mediator verifies delivery in a dispute (no evidence chain).
- How a second agent automatically knows "this is a file reference,
  fetch + decrypt + verify like so."

AIP-17 closes all seven gaps by standardizing the reference envelope.

---

## §2 First Principles

### 2.1 Separating *what* from *where*

ACTP has been making this separation since AIP-16:

- **What we transport**: the bytes the buyer paid for. AIP-16 calls this
  the delivery surface. The contract is "buyer's process has these bytes,
  signed by provider, decryptable by buyer."
- **Where it lives**: the storage substrate. AIP-16 used the relay (24h
  hosted ciphertext). AIP-17 generalizes: storage can be anywhere with an
  HTTP `GET` endpoint.

Inline (AIP-16) is the degenerate case where "where" = "relay" and "what"
= "small JSON payload." Reference (AIP-17) is the general case where
"where" is provider's choice and "what" is the cryptographic commitment
to content stored there.

### 2.2 Why protocol-side reference (not just app-side URL)

A bare URL is application-layer. App-layer URLs are unstandardized:
every provider invents their own envelope, every buyer reinvents fetch
logic, dispute tooling is bespoke per service. The whole point of a
settlement protocol is that buyer/seller/mediator/auditor share one
language for what was delivered.

Protocol-side reference means:
- One buyer SDK function (`fetchReference(ref)`) works against any
  AIP-17-conforming provider.
- One dispute primitive (verify content hash against signed envelope).
- One agent-to-agent shape (next agent in the pipeline knows the
  reference format without parsing free-form provider blobs).
- One discoverability story (`agirails.app` shows "delivers
  application/pdf via reference, retention 7 days, encrypted").

### 2.3 What stays the same as AIP-16

- EIP-712 signing domain (`AGIRAILS Delivery v1`) with `verifyingContract:
  kernelAddress` — UNCHANGED.
- Relay endpoints (`POST /delivery`, `GET /delivery/{txId}`) — UNCHANGED.
- DEC-10 relay-side participant + kernel allowlist check — UNCHANGED.
- Setup message (`DeliverySetupWireV1`) — UNCHANGED.
- ECDH key exchange — UNCHANGED.
- Provider hook point (`Agent.processJob`) — UNCHANGED.
- Voluntary-cancel recovery semantics — UNCHANGED.

What changes is the **content shape inside `envelope.body`** and the
**buyer SDK behavior** when that shape is detected. AIP-17 is a buyer/
provider SDK contract layered on AIP-16's transport; the relay learns
nothing new.

---

## §3 Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│  AIP-16 (transport, unchanged)                                     │
│                                                                    │
│  Relay envelope endpoint: same POST/GET, same auth, same           │
│  DEC-10 allowlist check.                                           │
│                                                                    │
│  envelope.body now carries either:                                 │
│    - inline JSON payload (AIP-16 scope), OR                        │
│    - ciphertext of a DeliveryReferenceInner (AIP-17 scope)         │
│  Relay does not distinguish — it carries opaque ciphertext.        │
└────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌────────────────────────────────────────────────────────────────────┐
│  AIP-17 (reference contract — buyer/provider SDK)                  │
│                                                                    │
│  DeliveryReferenceInner JSON contains:                             │
│    - URI (any scheme: https://, ipfs://, ar://, s3://)             │
│    - dual hash (ciphertext + plaintext)                            │
│    - content metadata (type, size, expiresAt)                      │
│    - blob encryption parameters (own key, own nonce — §5.3)        │
│                                                                    │
│  Buyer SDK: fetch URI → verify ciphertextHash → decrypt blob →     │
│  verify contentHash → return to caller.                            │
└────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌────────────────────────────────────────────────────────────────────┐
│  Storage substrate (provider's choice — protocol-neutral)          │
│                                                                    │
│  Any URI scheme with HTTP-style GET semantics:                     │
│    - https:// (S3, R2, GCS presigned, any HTTPS endpoint)          │
│    - ipfs:// (content-addressed)                                   │
│    - ar:// (Arweave, permanent)                                    │
│    - s3:// (S3 native — buyer SDK has adapter)                     │
│    - https://provider-controlled-endpoint (provider-hosted)        │
│                                                                    │
│  Storage stores ENCRYPTED ciphertext, never plaintext.             │
│  Storage cannot read content, only serves bytes.                   │
└────────────────────────────────────────────────────────────────────┘
```

The three-layer model from AIP-16 (§3) holds and extends:

| Layer | AIP-16 | AIP-17 addition |
|---|---|---|
| Settlement | On-chain unchanged | Unchanged |
| Delivery | Channel envelope inline | Channel envelope carries signed reference; blob fetched separately |
| Audit | EAS attestation on envelope hash | Same — EAS attestation covers the signed reference, which transitively commits to content hash |

---

## §4 Architectural Decisions

### DEC-1: Reference is a body shape, not a new endpoint

The reference envelope reuses AIP-16's `POST /api/v1/delivery` and
`GET /api/v1/delivery/{txId}`. The relay sees ciphertext and stores it
exactly as in AIP-16. The buyer SDK detects the inner shape after
decryption: if it parses as `DeliveryReferenceInner`, switch to
reference-fetch mode; otherwise treat as inline payload.

**Rationale:** smallest protocol surface; smallest implementation
surface; relay-side compatibility is automatic; buyer SDKs at AIP-16
level continue to work for inline services without modification.

### DEC-2: Storage substrate is provider's choice

ACTP defines no storage backend. Providers MAY use:
- S3 / R2 / GCS with presigned URLs
- IPFS with CID
- Arweave for permanent archival
- Provider-hosted HTTPS endpoints
- Anything else with HTTP GET semantics

The reference envelope carries enough metadata (URI, dual hash, encryption
params, retention SLA) for buyer SDK to fetch and verify regardless of
backend.

**Rationale:** ACTP is a settlement + delivery protocol, not a storage
platform. Forcing one backend creates centralization, vendor lock-in,
and economic mismatch (IPFS pinning costs vs. agent margins).

### DEC-3: Encrypted blob at storage, never plaintext

Blobs at the storage URI are AES-256-GCM ciphertext under a key derived
from the same ECDH shared secret as the envelope. Storage operators
(S3, IPFS pinning service, CDN) NEVER see plaintext. Two reasons:

1. **Privacy**: storage operators are uncontrolled third parties; their
   logs / leaks / subpoenas should not expose buyer-paid content.
2. **Forward secrecy**: ephemeral X25519 keys discarded post-tx mean
   later compromise of provider's wallet does NOT decrypt past blobs
   at archived storage.

The trade: storage cannot serve the exact same ciphertext to a different
requester (they get different sessions, different keys, different
ciphertexts). This prevents storage-layer ciphertext reuse/correlation;
it does NOT prove economic uniqueness of the underlying plaintext. A
provider can still sell the same report/image to multiple buyers by
re-encrypting it per buyer. Originality / DRM / "unique work product" is
an application-layer promise, not an AIP-17 guarantee.

For public-by-design services (Sentinel-style daily reflections), the
provider declares `delivery.privacy: public` in the descriptor; for
reference mode this means the blob is published plaintext at the URI
and the inner envelope's encryption fields are canonical-empty. In
`public-v1`, the fetched stored bytes ARE the plaintext bytes; no AES-GCM
step runs.

### DEC-4: Dual hash (ciphertext + plaintext) is mandatory

Every reference carries two SHA-256 hashes. AIP-16's envelope-level
`payloadHash` remains keccak256 per AIP-16 EIP-712 rules; AIP-17's
blob-level `ciphertextHash` / `contentHash` are SHA-256 because storage
systems, file tooling, and content-addressed backends commonly speak
SHA-256-style multihashes.

- `ciphertextHash`: hash of the blob bytes as served by storage. For
  encrypted references these are ciphertext bytes. For `public-v1`,
  these are plaintext stored bytes and `ciphertextHash === contentHash`.
  Buyer verifies this BEFORE decrypt (or before accepting public bytes)
  to catch download corruption, MITM tampering, or storage
  misconfiguration cheaply.
- `contentHash`: hash of the DECRYPTED plaintext bytes. This is the
  provider's commitment to "what I delivered." Mediator uses this in
  disputes.

Both hashes are inside the signed reference, so both are tamper-evident
under provider's EIP-712 signature.

**Rationale:** single hash is insufficient. Plaintext-only hash forces
decrypt-before-verify (DoS surface + wasted CPU). Ciphertext-only hash
doesn't establish content commitment for disputes. Both together give
fail-fast download integrity AND non-repudiable content commitment.

### DEC-5: URI inside the encrypted reference

For `scheme: x25519-aes256gcm-v1` (default), the URI itself is INSIDE the
encrypted body, not in plaintext metadata. Relay sees only the encrypted
envelope; it cannot see which storage backend or path is being used.

**Rationale:** URIs leak relationships. `https://provider.com/private/
client-12345/report.pdf` reveals provider's client structure and the
specific buyer's identity to anyone scraping the relay. Wrapping URIs in
ciphertext closes this side channel for free.

### DEC-6: Key separation via HKDF sub-keys

Same X25519 ECDH shared secret as AIP-16 envelope. Different AES-256-GCM
keys derived via HKDF with distinct `info` strings:

- `K_inline = HKDF(ss, salt=txId, info="agirails-delivery-inline-v1", L=32)`
  — used by AIP-16 inline envelopes (unchanged).
- `K_reference = HKDF(ss, salt=txId, info="agirails-delivery-reference-v1", L=32)`
  — encrypts the `DeliveryReferenceInner` JSON inside the envelope body.
- `K_blob_i = HKDF(ss, salt=(txId || uint32_be(i)), info="agirails-delivery-blob-v1", L=32)`
  — encrypts blob `i` of the references array (per-blob unique key).

**Rationale:** the original Damir sketch said `keyId:
"same-as-delivery-session"`. Reusing one AES-256-GCM key across multiple
encryption operations is safe IF AND ONLY IF nonces are uniformly random
and the protocol guarantees no nonce repetition. With independent
encryption operations (envelope + reference body + 1..N blobs), a nonce
collision becomes a real risk over service lifetime — and nonce reuse
under same key in GCM is a catastrophic break (forgery + key recovery).

HKDF sub-keys completely eliminate the reuse risk at negligible cost
(~30 µs HKDF derivation per key). Each cryptographic surface gets a
domain-separated key; nonces can be uniformly random without coordination.

### DEC-7: Multi-reference per envelope is supported

A single AIP-17 envelope MAY carry an array of references:

```json
{
  "kind": "reference",
  "references": [
    { "uri": "...", "ciphertextHash": "...", ... },
    { "uri": "...", "ciphertextHash": "...", ... }
  ]
}
```

Use case: research agent returns a summary report (1 reference) + a
data appendix (2nd reference) + extracted figures (3rd reference) in
one transaction. Settlement is atomic; buyer pays once, gets all three.

Per-reference blob keys (DEC-6) ensure independent encryption even when
multiple references share the envelope.

**Rationale:** the alternative — one reference per transaction, multiple
transactions per logical delivery — fragments the trust unit. Multi-
reference per envelope keeps "I paid for this batch" as one settlement
event.

### DEC-8: Storage SLA is provider-declared, fetch-verified before sync settlement

Provider declares retention in service descriptor:

```yaml
delivery:
  mode: reference
  reference_retention_hours: 168  # 7 days
```

Buyer SDK refuses settlement if any required reference's `expiresAt` is
less than `reference_retention_hours` from `tx.createdAt` — provider is
breaking their own SLA.

For v1 synchronous `runRequest`, buyer SDK MUST fetch and verify every
required reference before settlement. "You got the reference, fetch
later" is NOT the default sync behavior; it is reserved for future
async inbox / persistent-buyer-key flows. Optional references MAY fail
without blocking settlement, but must be surfaced in `referenceErrors`.

After settlement, provider MUST keep blob fetchable until `expiresAt`.
After that, provider is free to delete. Long-term archival is buyer's
responsibility after successful fetch/verify; if buyer needs permanence,
they re-upload verified bytes to their own storage.

**Rationale:** ACTP settlement should mean the buyer process received the
paid output, not just a pointer. The retention SLA still matters for
re-fetch, receipts, and async/future flows, but v1 sync settlement gates
on actual byte availability and hash verification.

### DEC-9: No on-chain change

AIP-17 introduces no new on-chain events, no new state, no new
contract method, no kernel modification. Like AIP-16, it's an off-chain
contract layered on the existing state machine.

A future AIP MAY add an on-chain `ContentReceived(txId, contentHash,
buyerAck)` event for stronger dispute defense; out of scope here.

---

## §5 Detailed Design

### 5.1 DeliveryReferenceInner — message format

After the buyer SDK decrypts the envelope body with `K_reference`, it
parses the plaintext as JSON. If the parsed object has `"kind":
"reference"`, it's an AIP-17 reference message:

```typescript
interface DeliveryReferenceInnerV1 {
  // Discriminator. Buyer SDK MUST check this before treating the message
  // as AIP-17. If absent or different, fall back to AIP-16 inline payload
  // semantics.
  kind: "reference";

  // Protocol version. v1 of this AIP.
  version: 1;

  // Array of one or more references. Index in this array is used by
  // DEC-6 key derivation (K_blob_i where i is the array index). The
  // encrypted DeliveryReferenceInner still lives inside AIP-16's
  // envelope body, so it MUST fit the AIP-16 body limit (256 KB). v1
  // SDKs SHOULD cap this at 64 references unless explicitly overridden.
  references: ReferenceItem[];

  // Optional human-readable summary of what the references contain.
  // Plaintext; safe to display in receipt UI for public services or to
  // buyer post-decrypt.
  summary?: string;

  // Optional structured metadata describing the overall delivery.
  // NOT individual reference metadata (that's in ReferenceItem).
  meta?: {
    service?: string;
    schemaUri?: string;
    extractedAt?: number;  // Unix seconds
  };
}

interface ReferenceItem {
  // The pointer to the stored blob. Any URI scheme supported by the
  // buyer SDK's storage adapter registry. v1 buyer SDK ships adapters
  // for: https, ipfs, ar (Arweave), s3.
  uri: string;

  // Content-Type as the provider intends the decrypted bytes to be
  // interpreted. Standard MIME types: application/pdf, image/png,
  // text/csv, audio/ogg, etc. Buyer SDK does not enforce; advisory only.
  contentType: string;

  // Provider-supplied filename. Optional, advisory. Used by buyer SDK
  // file-save helpers and receipt UI.
  filename?: string;

  // Required by default. Buyer SDK MUST fetch + verify every required
  // reference before sync settlement. Optional references may fail
  // without blocking settlement, but failures are surfaced.
  required?: boolean;

  // Size of the BLOB AS STORED (ciphertext bytes for encrypted schemes,
  // plaintext bytes for public-v1). Buyer SDK enforces this as a hard
  // download cap and refuses oversized blobs before decrypt/accept
  // (DoS prevention).
  ciphertextByteSize: number;

  // Size of the plaintext bytes. Advisory; buyer SDK can surface to
  // caller for UI purposes but does not enforce.
  plaintextByteSize: number;

  // SHA-256 hash of the stored bytes. For encrypted schemes these are
  // ciphertext bytes; for public-v1 these are plaintext bytes and this
  // value MUST equal contentHash. Buyer SDK MUST verify before decrypt
  // or before accepting public bytes.
  ciphertextHash: `0x${string}`;  // bytes32

  // SHA-256 hash of the decrypted plaintext bytes. Buyer SDK MUST
  // verify this after decrypt. Fail = forensic event, content
  // rejected, structured deliveryError returned.
  contentHash: `0x${string}`;  // bytes32

  // Provider's promise of when the blob is fetchable until. Buyer SDK
  // checks this against DEC-8 retention rule before settling.
  expiresAt: number;  // Unix seconds

  // Crypto parameters for this specific blob. Key is derived from
  // shared secret + index per DEC-6; nonce + tag are random per-blob.
  blobEncryption: {
    scheme: "x25519-aes256gcm-v1" | "public-v1";
    // For x25519-aes256gcm-v1: 12-byte random nonce used to AES-GCM
    // encrypt the blob. Different for every blob, even within the same
    // references array.
    nonce: `0x${string}`;  // bytes12, or canonical "0x" for public
    // For x25519-aes256gcm-v1: 16-byte AES-GCM authentication tag.
    tag: `0x${string}`;    // bytes16, or canonical "0x" for public
    // The HKDF info string used to derive K_blob from shared secret.
    // Fixed in v1; included in envelope so buyer SDK can validate it
    // matches the expected value (defensive — protocol-level pin).
    keyDerivationInfo: "agirails-delivery-blob-v1";
  };

  // Optional fetch hints. Advisory; buyer SDK uses them to optimize.
  fetchHints?: {
    supportsRange?: boolean;
    cdnEdges?: string[];        // optional alternate URLs (e.g., CDN copies)
    auth?: {
      // Provider-supplied read-only fetch auth. SDK MUST NOT log or
      // display headerValue. Token validity SHOULD cover expiresAt.
      headerName: string;       // e.g., "Authorization"
      headerValue: string;      // e.g., "Bearer eyJ..."
      expiresAt?: number;       // Unix seconds, advisory
      scope?: "read-only";
    };
  };
}
```

### 5.2 Encryption key derivation (DEC-6 expanded)

```
shared_secret = X25519(buyer_eph_priv, provider_eph_pub)

K_reference = HKDF-SHA256(
  ikm   = shared_secret,
  salt  = txId,           // bytes32
  info  = "agirails-delivery-reference-v1",
  L     = 32
)

For each ReferenceItem at index i in references[]:
  K_blob_i = HKDF-SHA256(
    ikm   = shared_secret,
    salt  = txId || uint32_be(i),  // 32 + 4 bytes
    info  = "agirails-delivery-blob-v1",
    L     = 32
  )
```

`K_reference` encrypts the entire `DeliveryReferenceInner` JSON.
The nonce + tag for this encryption live in the AIP-16 envelope's
`signed` projection — same fields used by AIP-16 inline mode.

`K_blob_i` encrypts the blob at `references[i].uri`. The nonce + tag for
this encryption live in `references[i].blobEncryption`.

Independence: K_reference and every K_blob_i are derived with distinct
`info` strings AND distinct salts (index suffix). Two independent
encryption operations cannot accidentally share a key, even by
implementation bug.

### 5.3 Dual hash design (DEC-4 expanded)

```
For each reference at index i:

Provider side:
  plaintext_bytes = handler_output[i]  // raw binary or text bytes
  contentHash_i   = SHA256(plaintext_bytes)

  if scheme == "x25519-aes256gcm-v1":
    stored_bytes = AES-256-GCM-encrypt(K_blob_i, nonce_i, plaintext_bytes) || tag_i
  else if scheme == "public-v1":
    stored_bytes = plaintext_bytes
    nonce_i = "0x"
    tag_i = "0x"

  ciphertextHash_i = SHA256(stored_bytes)

  ReferenceItem.contentHash    = contentHash_i
  ReferenceItem.ciphertextHash = ciphertextHash_i

  Upload stored_bytes to storage at uri.

Buyer side:
  fetched = HTTP_GET(uri)
  assert SHA256(fetched) === ReferenceItem.ciphertextHash  // stored-byte integrity
  (otherwise: abort, do not decrypt/accept, structured error)

  if scheme == "x25519-aes256gcm-v1":
    plaintext = AES-256-GCM-decrypt(K_blob_i, nonce_i, fetched, tag_i)
  else if scheme == "public-v1":
    assert ReferenceItem.ciphertextHash === ReferenceItem.contentHash
    plaintext = fetched

  assert SHA256(plaintext) === ReferenceItem.contentHash  // content commitment
  (otherwise: forensic event, integrity violation)

  return plaintext to caller.

Dispute scenario (mediator):
  Mediator has the signed envelope from EAS attestation.
  Envelope contains signed ReferenceItem with contentHash bound by signature.
  
  - Buyer claims "got wrong content": buyer presents claimed plaintext.
    Mediator computes SHA256(claimedPlaintext); compares to signed contentHash.
    Mismatch = buyer is presenting different bytes than what was committed.
  
  - Buyer claims "couldn't fetch": mediator checks ciphertextHash against
    any reproducible fetch (provider's storage logs, IPFS, archive). If
    blob still present and ciphertextHash matches, buyer's claim weakens.
    If blob missing/corrupted, provider's storage SLA was violated.
  
  - Provider claims "delivered what was promised": signed contentHash IS
    the promise. Mediator examines whatever plaintext provider produces;
    if SHA256 matches contentHash, provider's claim is verified.
```

This is the dispute primitive AIP-17 enables: **the content hash is a
provider commitment.** No matter what storage backend, what URI, what
fetched bytes — the signed `contentHash` is the binding promise.
Mediator can verify against any plaintext anyone produces; one of the
two parties is lying, and the math identifies which.

### 5.4 Storage backend contract

Storage backends MUST support the following minimal HTTP semantics
(or expose a buyer-SDK adapter that translates to them):

1. `GET <uri>` returns the stored bytes with HTTP 200.
2. `Content-Length` response header is accurate when present.
3. (Recommended) `Range: bytes=0-N` request supported for chunked download.
4. (Recommended) HTTPS or equivalent transport security.

Buyer SDK MUST enforce `ciphertextByteSize` while reading, not only by
trusting `Content-Length`. If `Content-Length` is missing, the adapter
may stream up to `ciphertextByteSize` plus a tiny framing tolerance and
then abort. If an adapter cannot enforce a read cap, it MUST reject the
backend as unsupported in v1.

Storage backends MAY:
- Require provider-supplied auth tokens (encoded in URI or
  `fetchHints.auth` field). Buyer SDK passes through without logging;
  tokens SHOULD be read-only, scoped to the object, and valid at least
  until `expiresAt`.
- Use content-addressed schemes (IPFS/Arweave) where the URI provides an
  additional storage-layer integrity check. The signed `ciphertextHash`
  remains the protocol-level check for all backends.
- Charge buyer for fetch (e.g., gated CDN). v1 assumes provider-paid;
  buyer-paid fetch is a v2 concern.

Storage backends MUST NOT:
- Re-encrypt or transcode the blob (would break ciphertextHash).
- Modify the blob bytes (same).
- Log or expose plaintext (they don't have the key — but the
  contract makes this explicit).

### 5.5 Service descriptor extension

`AGIRAILS.md` `delivery` block gains:

```yaml
services:
  - type: research-report
    price: "20"
    delivery:
      mode: reference         # or "channel" (AIP-16) or "hybrid"
      privacy: encrypted      # default
      channel: agirails-relay-v1   # envelope still goes via AIP-16 relay
      reference_retention_hours: 168   # 7 days
      reference_max_blob_mb: 50        # advisory cap per blob
      reference_storage_backends:
        - https              # any HTTPS endpoint
        - ipfs               # IPFS (CID-addressed)
      schema_uri: ./schemas/research-report-v1.json
```

`delivery.mode: hybrid` means provider picks per-tx: small outputs go
inline (AIP-16 path), large outputs go reference (AIP-17 path). Buyer
SDK handles either shape regardless of mode declaration.

### 5.6 Provider flow

```
┌─────────────────────────────────────────────────────────────────┐
│  Agent.processJob (between handler return and DELIVERED)        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
              ┌──────────────────────────────────┐
              │  result = await handler(job, ctx)│
              │  (one or more output bytes objects│
              │   — provider decides structure)   │
              └──────────────────────────────────┘
                              │
                              ▼
              ┌──────────────────────────────────┐
              │  Read service descriptor:         │
              │  delivery.mode (channel/reference/│
              │   hybrid) + privacy + retention   │
              └──────────────────────────────────┘
                              │
                              ▼
              ┌──────────────────────────────────┐
              │  If mode == channel OR (mode ==   │
              │   hybrid AND result fits inline): │
              │    → AIP-16 path                  │
              │  Else:                            │
              │    → AIP-17 path (below)          │
              └──────────────────────────────────┘
                              │
                              ▼
              ┌──────────────────────────────────┐
              │  Fetch buyer setup from relay     │
              │  (same as AIP-16, §6.4)           │
              │  Extract buyerEphemeralPubkey.    │
              └──────────────────────────────────┘
                              │
                              ▼
              ┌──────────────────────────────────┐
              │  Generate providerEphemeral X25519│
              │  ECDH → shared_secret             │
              │  Derive K_reference + K_blob_i    │
              │  via HKDF (DEC-6)                 │
              └──────────────────────────────────┘
                              │
                              ▼
              ┌──────────────────────────────────┐
              │  For each output blob i:          │
              │    1. SHA256(plaintext) →         │
              │       contentHash_i               │
              │    2. AES-256-GCM-encrypt with    │
              │       K_blob_i, random nonce_i    │
              │    3. SHA256(ciphertext) →        │
              │       ciphertextHash_i            │
              │    4. Upload ciphertext to        │
              │       storage backend → uri_i     │
              │    5. Build ReferenceItem with    │
              │       all metadata                │
              └──────────────────────────────────┘
                              │
                              ▼
              ┌──────────────────────────────────┐
              │  Build DeliveryReferenceInnerV1   │
              │  with references array.           │
              │  AES-256-GCM-encrypt the JSON     │
              │  with K_reference (envelope-      │
              │  level nonce + tag).              │
              └──────────────────────────────────┘
                              │
                              ▼
              ┌──────────────────────────────────┐
              │  Build DeliveryEnvelopeWireV1     │
              │  (AIP-16 §6.1) wrapping the       │
              │  encrypted reference inner as     │
              │  body. Sign with provider wallet. │
              │  POST to relay (AIP-16 §6.6.3).   │
              └──────────────────────────────────┘
                              │
                              ▼
              ┌──────────────────────────────────┐
              │  IN PARALLEL (audit path):        │
              │  EAS attestation over envelope    │
              │  signed projection. No plaintext  │
              │  to IPFS for encrypted services   │
              │  (per AIP-16 DEC-3 split).        │
              └──────────────────────────────────┘
                              │
                              ▼
              ┌──────────────────────────────────┐
              │  transitionState(DELIVERED) on    │
              │  chain (same as AIP-16).          │
              └──────────────────────────────────┘
```

**Failure modes (provider side):**

- Storage upload fails → do NOT POST envelope, do NOT call deliver.
  Provider voluntary cancel (AIP-16 DEC-5 semantics).
- Envelope POST fails → orphaned blobs at storage. Provider runs a
  cleanup pass to delete orphans; harmless if left (just storage cost).
- transitionState fails → AIP-16 retry semantics (transient: retry;
  permanent: voluntary cancel).

### 5.7 Buyer flow

```
┌─────────────────────────────────────────────────────────────────┐
│  runRequest after createTransaction (AIP-16 §6.5)               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
              ┌──────────────────────────────────┐
              │  POST setup, linkEscrow, poll     │
              │  (same as AIP-16)                 │
              └──────────────────────────────────┘
                              │
                              ▼
              ┌──────────────────────────────────┐
              │  Receive envelope, verify         │
              │  (AIP-16 §6.1.4 — unchanged)      │
              │  Derive K_reference from shared   │
              │  secret + envelope-level params.  │
              │  Decrypt body to plaintext JSON.  │
              └──────────────────────────────────┘
                              │
                              ▼
              ┌──────────────────────────────────┐
              │  Parse plaintext JSON.            │
              │  Inspect `kind` discriminant:     │
              │  - "reference" → AIP-17 path      │
              │  - missing/other → AIP-16 inline  │
              └──────────────────────────────────┘
                              │
                              ▼
              ┌──────────────────────────────────┐
              │  For each ReferenceItem i:        │
              │    1. Check expiresAt vs service  │
              │       descriptor retention SLA    │
              │       (DEC-8). Mismatch → reject. │
              │    2. Derive K_blob_i (HKDF DEC-6)│
              │    3. Resolve URI via storage     │
              │       adapter (https/ipfs/ar/s3)  │
              │    4. GET blob, check             │
              │       stored bytes do not exceed  │
              │       ciphertextByteSize          │
              │    5. SHA256(downloaded) ===      │
              │       ciphertextHash → else abort │
              │    6. AES-256-GCM-decrypt, or     │
              │       accept public-v1 bytes      │
              │    7. SHA256(plaintext) ===       │
              │       contentHash → else abort    │
              │    8. Add to result.references[]  │
              └──────────────────────────────────┘
                              │
                              ▼
              ┌──────────────────────────────────┐
              │  Settlement: same as AIP-16, but  │
              │  only after every required ref is │
              │  fetched + verified. Optional ref │
              │  failures are surfaced.           │
              │  CLI prints reference list +      │
              │  fetch URLs OR auto-saved paths.  │
              └──────────────────────────────────┘
```

**RunRequestResult addition:**

```typescript
interface RunRequestResult {
  // ...existing AIP-16 fields...

  // Present when the envelope body parsed as AIP-17 reference shape.
  // Each item is the decrypted, hash-verified, ready-to-use content.
  references?: Array<{
    contentType: string;
    filename?: string;
    required: boolean;
    storageMode: "memory" | "file";
    // Small references MAY be returned in memory. Large references
    // SHOULD be saved to disk by default to avoid 100 MB Uint8Array
    // surprises in CLI/agent processes.
    plaintextBytes?: Uint8Array;
    localPath?: string;
    plaintextByteSize: number;
    plaintextHash: `0x${string}`; // already-verified, same as contentHash
    summary?: string;            // copied from envelope-level summary
  }>;

  // Structured error when reference fetch/decrypt failed for any item.
  // Includes per-item failure reasons.
  referenceErrors?: Array<{
    index: number;
    code: "fetch_failed" | "ciphertext_hash_mismatch" |
          "decrypt_failed" | "content_hash_mismatch" |
          "expires_before_retention_sla" | "oversize" | "scheme_unsupported";
    message: string;
  }>;
}
```

**Failure modes (buyer side):**

- `fetch_failed` (HTTP error, timeout, DNS): per-item error; other
  references in same envelope still fetched. If any required reference
  fails, buyer treats delivery as incomplete and does not settle in sync
  v1. Optional reference failures do not block settlement.
- `ciphertext_hash_mismatch`: storage served corrupted/tampered blob.
  Forensic log + per-item error. Mediator-readable.
- `decrypt_failed`: GCM authentication failure. Same forensic semantics.
- `content_hash_mismatch`: decryption succeeded but plaintext hash is
  wrong. Means provider committed to one content and uploaded a
  different one. Strong dispute evidence for buyer.
- `expires_before_retention_sla`: provider declared retention 7 days
  but reference expiresAt is 1 day from creation. Provider-side SLA
  violation. Buyer SDK rejects pre-settlement.
- `oversize`: Content-Length exceeded `ciphertextByteSize`. Buyer SDK
  aborts download before consuming the full response. If Content-Length
  is absent, the adapter enforces the same cap while streaming.
- `scheme_unsupported`: URI uses a scheme buyer SDK has no adapter for
  (e.g., custom `agirails-quantum-storage://`). Surface to caller;
  caller can plug in custom adapter.

---

## §6 Storage Adapters

Buyer SDK ships with adapters for the four primary backends. Each
adapter implements:

```typescript
interface StorageAdapter {
  scheme: string;  // e.g., "https", "ipfs"
  fetch(uri: string, opts?: FetchOptions): Promise<Uint8Array>;
  canSupport(uri: string): boolean;
}
```

### 6.1 HTTPS adapter (`https://`)

Plain HTTPS GET. Supports:
- S3 presigned URLs
- R2 / GCS / Azure Blob presigned URLs
- Any HTTPS endpoint with `Content-Length` accuracy

Honors `fetchHints.auth` from ReferenceItem. Auth values are treated as
secrets: the SDK MUST NOT log them, render them in receipts, or include
them in non-encrypted diagnostics.

### 6.2 IPFS adapter (`ipfs://`)

Resolves IPFS CIDs via configurable gateway list. Default gateways:
- ipfs.io
- cloudflare-ipfs.com
- buyer's own node if `IPFS_GATEWAY` env set

IPFS provides an additional content-addressed integrity layer, but the
exact relationship between CID and `ciphertextHash` depends on how the
provider publishes the bytes:

- If provider publishes a raw CIDv1 block whose multihash is SHA2-256 of
  the exact stored bytes, the adapter MAY verify the CID multihash
  against `ciphertextHash` before gateway fetch.
- If provider publishes via UnixFS/DAG chunking, the root CID is a DAG
  commitment, not simply SHA-256(stored_bytes). In that case the adapter
  MUST still fetch the resolved bytes and verify AIP-17's signed
  `ciphertextHash` after fetch.

The protocol-level integrity check is always `ciphertextHash`; CID
verification is an adapter-level defense in depth.

### 6.3 Arweave adapter (`ar://`)

Resolves Arweave transaction IDs via configurable gateway list (default:
arweave.net). Permanent storage; `expiresAt` is informational only
(Arweave doesn't delete). Good fit for providers offering permanent
archival.

### 6.4 S3 adapter (`s3://`)

Direct S3 access when buyer SDK has AWS credentials in environment.
Alternative path to HTTPS adapter for buyers who prefer native S3 SDK
semantics (range requests, retries, etc.). This is mainly for buyer-owned
or mutually authorized buckets. For provider-owned buckets, v1
implementations SHOULD prefer `https://` presigned URLs. If no suitable
AWS credentials are detected, native `s3://` fetch fails with
`scheme_unsupported`; SDK does not infer provider credentials.

### 6.5 Custom adapter registration

Buyer SDK exposes:

```typescript
sdkClient.registerStorageAdapter(new CustomAdapter());
```

For agents that ship their own storage backends (e.g., a research
agent that hosts on its own IPFS pinning service with custom CDN
routing), this is the extension point.

---

## §7 Failure Modes & Resilience

| Failure | Detection | Recovery |
|---|---|---|
| Storage upload fails (provider side) | Storage SDK error | Provider does NOT POST envelope. Voluntary cancel via AIP-16 DEC-5 path. |
| Storage GET fails (buyer side, optional ref) | HTTP error / timeout | Per-item `referenceErrors`; sync settlement MAY continue if every required reference succeeded. |
| Storage GET fails (buyer side, required ref) | HTTP error / timeout | Treat delivery as incomplete. Buyer SDK does not settle in sync v1; recovery is AIP-16 missing-delivery path: wait/retry, dispute within window, or provider voluntary cancel. No automatic refund happens merely because fetch failed. |
| ciphertextHash mismatch (download corruption) | SHA256 check | Discard, log forensic event, retry once. If second attempt also mismatches, treat as missing delivery. |
| contentHash mismatch (provider lied about content) | SHA256 check post-decrypt/public accept | Strong dispute evidence. Buyer keeps rejected plaintext/public bytes + signed envelope; both required for mediator. For required refs, buyer SDK does not settle. For optional refs, caller may settle with `referenceErrors[i].code = "content_hash_mismatch"` preserved. |
| Provider's expiresAt < buyer's SLA expectation | Pre-fetch check | Pre-settlement rejection. Buyer SDK does not settle; recovery is retry with corrected envelope, dispute within window, or provider voluntary cancel. |
| Storage backend unavailable post-settlement (link rot before expiresAt) | Buyer fetches in retention window, gets 404/410 | Provider SLA violation. Buyer disputes. Mediator examines provider's storage logs; if provider can prove blob WAS there during retention, buyer's claim weakens. |
| Provider re-uploads different content to same URI | ciphertextHash mismatch | Same as download corruption case. Signature commits to one hash; alternate content is rejected by buyer SDK regardless of URI. |
| Buyer process dies mid-fetch | buyerEphemeralPriv lost | Cannot decrypt fetched ciphertext. Same forward-secrecy trade as AIP-16. v2: persistent buyer keys for very-async use cases. |
| Multi-reference partial failure | Some references fetched, some not | Required references gate settlement. Optional references populate `referenceErrors[]` but do not block settlement. |

---

## §8 Security Analysis

### 8.1 Threat model (additions to AIP-16's threat model)

| Adversary | Capability | Mitigation |
|---|---|---|
| Storage operator | Can read all stored bytes | Sees ciphertext only (DEC-3). Cannot derive key without one of two ephemeral private keys. |
| Active storage operator | Drop/modify/substitute blobs | ciphertextHash check fails buyer-side. Forensic event. Provider SLA violation if blob legitimately served previously and storage tampered later. |
| Network observer on buyer fetch | Sees GET URL + ciphertext bytes | URL itself is private (DEC-5, inside encrypted envelope). Ciphertext is opaque without key. |
| Malicious provider | Promise content X, deliver content Y | contentHash in signed envelope is non-repudiable commitment. Mediator verifies; provider loses dispute. |
| Malicious provider | Promise content X, deliver content X, then change it later at the URI | Doesn't matter — buyer fetched and verified at delivery time. Later change is undetectable to a fresh observer but doesn't affect already-settled transaction. |
| Malicious provider | Upload SAME ciphertext blob, get paid by N buyers | Each buyer derives a different K_blob (different ephemeral keys → different shared secret → different HKDF output), so storage-layer ciphertext reuse fails. This does not prevent selling the same plaintext to N buyers after re-encrypting; originality is application-layer. |
| Buyer attempting replay | Reuse old envelope for fresh payment | Envelope signed with txId in domain; new tx has new txId; signature fails. |
| Buyer claims "got wrong content" | Falsely | Mediator computes SHA256 over presented plaintext, compares to signed contentHash. Buyer lying is detected. |
| Buyer claims "blob never available" | Falsely | Mediator can examine provider's storage logs, CDN logs, or content-addressed substrate (IPFS) for evidence of availability during retention window. |

### 8.2 Specific concerns

**Q: What if provider's storage is compromised AND they leak the key?**

AIP-16's forward-secrecy property holds: per-tx ephemeral X25519 keys are
discarded post-tx. Compromise of provider's long-term wallet key does
NOT decrypt past blobs. The K_blob_i for an old tx is unrecoverable
unless both ephemeral private keys are preserved (which they aren't, by
SDK design).

**Q: Does multi-reference enable any new attacks?**

Each reference has independent K_blob_i derivation. A leaked K_blob for
reference 0 does not decrypt reference 1. Damage is contained.

**Q: What about IPFS reproducibility — same stored bytes means same CID?**

Only for a precisely specified IPFS representation. A raw CIDv1 block
with SHA2-256 multihash can map directly to the exact stored bytes. A
UnixFS/DAG upload may produce a root CID that commits to a DAG, not to
SHA256(stored_bytes) directly. Therefore AIP-17 does not rely on CID
derivation for protocol correctness. Buyer SDK always verifies fetched
bytes against signed `ciphertextHash`; CID checks are defense in depth.

**Q: Can a malicious gateway return different ciphertext claiming to be
the IPFS CID?**

Yes — gateways are untrusted intermediaries. Buyer SDK verifies fetched
bytes against signed `ciphertextHash` for every IPFS gateway response.
Where the CID representation permits an additional CID/multihash check,
the IPFS adapter performs it too.

**Q: Storage adapter privilege escalation — can a custom adapter
exfiltrate decryption keys?**

Custom adapters run in buyer's process and have full SDK access. Defense
in depth: SDK should expose storage adapters via a restricted interface
that cannot reach key material. v1 buyer SDK does this by passing only
the URI and fetch params to adapters; keys never leave the
EnvelopeReader module.

---

## §9 Dispute Resolution Scenarios

For AIP-5 (Dispute Resolution) Mediator workflow:

### 9.1 Buyer disputes "wrong content delivered"

1. Buyer raises dispute within window (existing AIP-3 path).
2. Mediator obtains the EAS attestation for the tx (already in AIP-4).
3. EAS attestation references the envelope hash; envelope contains the
   signed `references[]` with each `contentHash`.
4. Buyer is required to present:
   - The plaintext bytes they received.
   - The decryption parameters they used.
5. Mediator computes SHA256(presented plaintext); compares to signed
   `contentHash`.
6. Match → buyer is claiming wrong content was promised (not delivered);
   that's a schema/SLA dispute, not delivery dispute. Out of scope for
   AIP-17, goes to AIP-5 evaluation.
7. Mismatch → either buyer is lying about what they received, OR the
   content was actually wrong. Mediator requires provider to also
   present what they uploaded; provider's claimed plaintext hashes to
   contentHash → provider wins. Provider's plaintext doesn't hash to
   contentHash → provider committed signed lie; buyer wins.

### 9.2 Buyer disputes "blob never available"

1. Buyer raises dispute showing `referenceErrors[i].code = "fetch_failed"`.
2. Mediator examines:
   - Storage backend logs (provider produces these).
   - For IPFS/Arweave: independent gateway check.
   - Time-correlated traffic to the URI from buyer's IP (provider's
     access logs).
3. If provider can prove blob was served successfully during retention,
   buyer's claim weakens (likely buyer infrastructure issue).
4. If blob is unrecoverable AND retention window not elapsed → provider
   SLA violation; buyer wins.

### 9.3 Provider disputes "buyer never picked up reference"

For v1 synchronous `runRequest`, buyer should not settle until every
required reference was fetched and verified. If buyer settled and later
disputes "I didn't get it," settlement is strong evidence that their SDK
completed required fetch/verify; AIP-5 mediator weighs accordingly.

For future async/inbox modes where buyer may settle on reference receipt
and fetch later, provider must prove blob availability during the
declared retention window (storage logs, independent gateway checks,
or other AIP-5 evidence).

---

## §10 Surfaces Touched

### 10.1 sdk-js

New modules:
- `src/delivery/reference/types.ts` — `DeliveryReferenceInnerV1`,
  `ReferenceItem`.
- `src/delivery/reference/keys.ts` — HKDF sub-key derivation for
  K_reference and K_blob_i.
- `src/delivery/reference/builder.ts` — provider-side: encrypt blobs,
  upload to storage, build reference envelope.
- `src/delivery/reference/reader.ts` — buyer-side: detect reference
  shape, fetch blobs, verify dual hashes, decrypt, return.
- `src/delivery/storage/adapters/` — built-in adapters for https,
  ipfs, ar, s3.
- `src/delivery/storage/registry.ts` — adapter registry +
  registration hook.

Modified modules:
- `src/cli/lib/runRequest.ts` — add `references[]` field to
  `RunRequestResult`; fetch + verify required references before
  settlement, then surface memory/file handles to caller.
- `src/level1/Agent.ts` — extend delivery hook (the AIP-16 `Agent.processJob`
  hook) to branch on `delivery.mode`: channel vs reference vs hybrid.
- AGIRAILS.md parser — recognize new `delivery.reference_*` fields.

Tests:
- Unit: key derivation independence (K_reference, K_blob_i, K_blob_j
  all differ; nonce reuse impossible); dual hash flow; multi-reference
  encryption round-trip; storage adapter mocks.
- Integration: full provider→storage→buyer flow per backend (https,
  ipfs, ar, s3 mocked).
- E2E: testnet flow with a reference-mode agent (TBD which one).
- Adversarial: ciphertext substitution, key reuse attempts, CID
  spoofing, oversize attacks.

LOC estimate: ~700 net (~900 new across reference/, storage/, builder/,
reader/ + minor changes to Agent.processJob branching + runRequest;
~200 refactor in DeliveryProofBuilder for the encrypted-audit path that
AIP-16 introduced).

### 10.2 agirails.app

**No new endpoints.** AIP-17 uses AIP-16's `/api/v1/delivery` and
`/api/v1/delivery/setup` unchanged. Schema unchanged.

UI additions:
- Receipt page (`/r/{id}`) shows reference list when public scheme,
  download buttons for ciphertext, status badges per reference fetched
  vs not.
- Agent profile (`/a/{slug}`) shows reference-mode badges + max blob
  size + supported backends.

LOC estimate: ~200 net (UI only).

### 10.3 Provider agents

Each provider that wants reference-mode delivery:
- Updates AGIRAILS.md with `delivery.mode: reference` (or `hybrid`).
- Bumps SDK to v4.3.0+ (the AIP-17 release).
- Configures a storage backend (env vars for S3/R2/IPFS pinning service/
  Arweave wallet).
- No application code changes for typical "I return bytes" handlers —
  the SDK delivery hook handles upload, encryption, envelope construction.

### 10.4 Docs

- AIP-16: cross-reference AIP-17 in §6.7.1 (honesty section) as the
  successor for binary/oversized content. Already in place per AIP-16
  Rev5.
- AIP-4 (EAS audit): clarify that EAS attestation continues to cover
  envelope signature; reference dual-hash chain is layered on top for
  dispute evidence.
- AIP-5 (Dispute): add the three dispute scenarios from §9.
- README + how-to: example provider that returns a PDF report and
  example buyer that downloads + verifies.

---

## §11 Test Plan

### 11.1 Unit tests

| Test | Asserts |
|---|---|
| HKDF sub-key independence | K_reference, K_blob_0, K_blob_1 are all different given same shared_secret; no two derive to same bytes. |
| HKDF salt expansion for multi-ref | K_blob_5 ≠ K_blob_6 even when ss + txId identical. |
| Reference encryption round-trip | provider builds → buyer decrypts → plaintext bytes identical. |
| Dual hash verification | ciphertextHash on download + contentHash on decrypt both verified before return. |
| Tampered ciphertext detection | flip a bit anywhere in stored blob → ciphertextHash mismatch → abort. |
| Tampered plaintext detection (provider lie) | provider commits contentHash X but encrypts Y → buyer's post-decrypt SHA256 ≠ X → reject. |
| Oversize protection | Content-Length > ciphertextByteSize → abort fetch before consuming bytes. |
| Expires-before-SLA rejection | Reference expiresAt < createdAt + retention_hours → pre-settle reject. |
| Storage adapter dispatch | URI scheme matches adapter; unsupported scheme → scheme_unsupported error. |

### 11.2 Integration tests

| Test | Asserts |
|---|---|
| End-to-end with mock HTTPS storage | Provider uploads, buyer fetches + decrypts; result.references contains plaintext. |
| Multi-reference (3 blobs in one envelope) | All three fetched in parallel; result.references has 3 entries. |
| Optional partial failure (1 optional of 3 fails) | 2 successes in result.references, 1 entry in result.referenceErrors; settlement continues. |
| Required partial failure (1 required of 3 fails) | Buyer SDK does not settle; delivery is incomplete. |
| Hybrid mode (small payload → inline, large → reference) | Same service produces both modes correctly based on output size. |
| Public scheme | No blob encryption; plaintext at URI; `ciphertextHash === contentHash`; buyer skips ECDH decrypt steps. |
| Storage adapter failover | https adapter fails, ipfs CDN fallback succeeds. |

### 11.3 E2E tests (testnet)

| Test | Asserts |
|---|---|
| Real testnet tx with reference-mode agent | actp pay against agent that returns PDF; buyer SDK fetches from S3, decrypts, surfaces. CLI saves PDF to disk. |
| Provider voluntary cancel after storage upload fails | actp pay against agent with broken storage env; storage upload fails; provider cancels; buyer's escrow refunded. |
| Dispute path (mock) | Reproduce a provider serving wrong content; verify mediator-side evidence chain works. |

### 11.4 Adversarial tests

| Test | Asserts |
|---|---|
| Replay attack: reuse signed envelope from old tx | New tx's signature check fails (txId in domain). |
| URL substitution: storage operator serves wrong blob | ciphertextHash mismatch → reject. |
| CID spoofing: malicious IPFS gateway | IPFS adapter verifies fetched bytes against signed `ciphertextHash`; raw-CID cases also compare multihash when possible. |
| Oversize: storage returns 1 GB when ciphertextByteSize is 1 MB | Adapter aborts via Content-Length when present or streaming byte cap when absent. |
| Custom adapter exfiltration: register a malicious adapter | Adapter interface does not expose key material; cannot read K_blob. |
| Nonce reuse attempt: provider SDK forced to reuse nonce | K_blob is per-blob; same key + reused nonce would be a bug — test catches by enforcing nonce uniqueness in EnvelopeBuilder. |

---

## §12 Phased Roadmap

### Phase 0 — Spec review (1 week)

Codex cross-review on AIP-17 in parallel with Codex cross-review on
AIP-16 Rev5. Damir reviews any Codex findings; revision lands.

### Phase 1 — SDK foundation (1 week, after AIP-16 Phase 1 ships)

- `src/delivery/reference/*` modules built.
- `src/delivery/storage/adapters/*` for https + ipfs (covers 80% of
  expected use).
- Unit tests + integration tests against MockRuntime + mock storage.
- Feature-flag gated: `ACTP_DELIVERY_REFERENCE=v1`.

### Phase 2 — Storage adapter expansion (1 week, can overlap Phase 1)

- ar + s3 adapters.
- Custom adapter registration API documented.
- Tests against real testnet storage backends (small charges).

### Phase 3 — Provider migration (3 days)

- First reference-mode agent (TBD — research-agent? PDF-summarizer?
  candidate to be picked).
- Provider's AGIRAILS.md updated with reference mode.
- Provider's deploy includes storage backend config.

### Phase 4 — UI + general release (1 week)

- Receipt page reference rendering.
- Agent profile reference badges.
- Feature flag default-on for SDK v4.3.0.
- Docs + announcement.

### Phase 5 — v1.1 enhancements (later)

- Range request support for large blob streaming.
- Persistent buyer keys for very-async fetch (>retention window).
- Storage adapter for additional backends (R2 native, Azure Blob,
  Google Cloud Storage).
- Buyer-side auth on relay GET for ciphertext (AIP-16 §13 Q4
  hardening, also benefits AIP-17).

**Total v1 timeline: ~2.5 weeks engineering + 1 week review.** Parallel
with AIP-16 Phase 1 implementation; total wall-clock from Codex review
to deployed AIP-17 is ~5 weeks if AIP-16 is the critical path.

---

## §13 Open Questions

### Q1: Storage cost — who pays for the blob upload?

In v1, provider pays. Their margin must cover storage + retention.
For a service charging $20 with a 7-day retention PDF (say 5 MB), the
cost is sub-cent on most backends; no economic issue.

For higher-volume / long-retention services, provider may want to
charge a separate "storage fee" on top of service price. This is an
application-layer concern; v1 doesn't formalize it.

**Recommendation:** v1 leaves storage cost to provider's margin
calculation. Service descriptor MAY include `storage_cost_usdc` as
advisory field; protocol doesn't enforce.

### Q2: Cross-tx blob reuse — can a provider sell the same blob to two buyers?

At the storage-ciphertext layer: NO. Each buyer has a unique ephemeral
key, so K_blob is unique per (tx, buyer). Provider must encrypt +
upload separately for each buyer if they want protocol-compliant private
delivery.

At the business/content layer: YES. The protocol cannot stop a provider
from selling the same underlying plaintext report/image to multiple
buyers and re-encrypting it per buyer. AIP-17 is confidentiality +
integrity + delivery evidence; it is not originality enforcement.

Optimization possible: provider could detect "this is the exact same
underlying plaintext as a previous tx" and skip the encrypt step
internally (cache plaintext), but still must perform the per-buyer
encryption + upload separately. The protocol doesn't preclude this.

For deduplication at storage layer (one ciphertext, many CIDs/URIs
pointing to it) — incompatible with private per-buyer AIP-17 delivery
because different buyer keys produce different ciphertexts.

**Recommendation:** v1 does not optimize for blob reuse. Provider's
cost model assumes per-buyer upload. v2 may explore "shared K_blob
between buyers willing to coordinate" as a separate AIP.

### Q3: What about buyer-side range requests for streaming preview?

For large media (audio, video), buyer might want to start playing
before full download. Range request support is in `fetchHints` (advisory).
Buyer SDK v1 ships with whole-blob fetch only; streaming is v1.1+.

GCM authentication is whole-blob — buyer cannot start "playing" before
fetch completes (no per-chunk tag). For streaming with per-chunk
integrity, encryption mode must change (CTR + HMAC per chunk, or
streaming AEAD like SecretStream). That's an AIP-18 concern.

**Recommendation:** v1 = whole-blob fetch. Streaming = AIP-18.

### Q4: How do we handle very large blobs (>100 MB)?

v1 has no protocol cap; the cap is implicit in buyer SDK memory +
network patience. For 100 MB+, buyer SDK SHOULD use Range requests
(chunked download to disk, decrypt in chunks if GCM streaming is
supported in target language, otherwise decrypt-after-fully-downloaded
with disk-backed buffer).

Beyond 1 GB: pragmatically out of scope for v1 agent commerce;
specialized data-pipeline agents would use AIP-18 (streaming) or
direct-share patterns outside ACTP.

**Recommendation:** v1 documents "soft upper bound 100 MB per blob"
in service descriptor; providers SHOULD set
`reference_max_blob_mb` to their actual limit.

### Q5: Should AIP-17 support content-addressable URIs only (IPFS/Arweave) for permanent provenance?

Tempting from a decentralization standpoint. But excludes the most
common backends (S3 etc.) and forces providers to pay IPFS pinning
costs even for short-lived blobs.

Decision: keep all URI schemes supported. Providers wanting permanent
provenance use ar:// or ipfs://. Providers wanting cheap ephemeral
delivery use https://. The dual hash + signature guarantees integrity
regardless of substrate.

**Recommendation:** all URI schemes supported. Provider's choice;
discoverability surfaces the choice in agent profile UI.

---

## §14 Non-goals

- Streaming delivery (per-chunk decrypt, live audio/video) — separate
  AIP-18.
- Storage hosting by AGIRAILS — explicitly NOT building a hosting
  product.
- Storage cost subsidies, provider-pays-buyer-fetch — application-layer
  concern; v1 doesn't formalize.
- Sub-blob random access (provider-controlled "fetch this byte range
  of the file") — out of scope; provider may offer separate sub-resource
  endpoints if needed, but they're not protocol-level.
- Cross-tx deduplication via shared keys — possibly v2 AIP.
- Discovery / indexing of reference URIs by third parties — privacy
  surface, intentionally avoided.
- Schema validation of decoded plaintext (other than contentType MIME
  check) — application-layer.
- DRM / restricted access after delivery — incompatible with the
  protocol's "buyer fully receives what they pay for" principle.

---

## §15 Acknowledgments

Damir Mujic — for the AIP-17 sketch on 2026-06-05 (during the AIP-16
review thread) that crystallized "ACTP standardizes the reference
contract, NOT the storage." The first-principles separation between
*what* (protocol) and *where* (provider's choice) is from that
conversation.

Codex (anonymous reviewer) — for the AIP-16 reviews that exposed where
the inline-only boundary actually lay, which made AIP-17's scope easy
to delimit.

Claude ultra-think — for the three technical issues (Issue A:
key separation via HKDF sub-keys, Issue B: dual hash, Issue C: URI
privacy) that hardened the original sketch.

---

## Changelog

| Date | Version | Author | Change |
|---|---|---|---|
| 2026-06-05 | draft-1 | Arha | Initial draft — extends Damir's 2026-06-05 sketch with HKDF sub-key derivation (DEC-6), dual hash (DEC-4), URI-inside-ciphertext (DEC-5), and storage adapter pattern. Layered on AIP-16 Rev5 envelope transport without modifying its endpoints. |

---

**End of AIP-17-DRAFT (revision 1).**

Status note: this is the **first draft** of AIP-17, paired with the
AIP-16 Rev5 freeze-candidate. Both are ready for Codex cross-review in
parallel. Phase 0 review window: 1 week from publication. Phase 1
implementation begins after AIP-16 Phase 1 ships; nothing in AIP-17
requires AIP-16 to be finished, but landing AIP-16 first eliminates a
class of integration confusion.
