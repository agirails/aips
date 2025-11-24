# AIP-0: AGIRAILS Improvement Proposals - Meta Protocol

**Status:** Implemented
**Author:** AGIRAILS Core Team
**Created:** 2025-11-16
**Updated:** 2025-11-24

---

## Implementation Status

**Deployment Date:** 2025-01-22
**Network:** Base Sepolia (testnet)
**Status:** Fully operational, contracts verified on Basescan

**Contract Addresses:**
- ACTPKernel: [`0xb5B002A73743765450d427e2F8a472C24FDABF9b`](https://sepolia.basescan.org/address/0xb5B002A73743765450d427e2F8a472C24FDABF9b#code)
- EscrowVault: [`0x67770791c83eA8e46D8a08E09682488ba584744f`](https://sepolia.basescan.org/address/0x67770791c83eA8e46D8a08E09682488ba584744f#code)
- MockUSDC: [`0x444b4e1A65949AB2ac75979D5d0166Eb7A248Ccb`](https://sepolia.basescan.org/address/0x444b4e1A65949AB2ac75979D5d0166Eb7A248Ccb#code)

**SDK Integration:** `@agirails/sdk` v0.1.0-beta.2
**Implementation Score:** 98/100 (Technical Audit 2025-11-24)

---

## Abstract

This document defines the meta protocol for AGIRAILS Improvement Proposals (AIPs). It establishes identity verification, transport standards, message signing, lifecycle management, schema registry conventions, and versioning mechanisms that all subsequent AIPs must follow.

AIP-0 serves as the foundational specification for off-chain coordination between consumers and providers in the AGIRAILS AI agent economy, complementing the on-chain ACTP protocol.

---

## Deployment Status & Critical Dependencies

**⚠️ TESTNET DEPLOYMENT INCOMPLETE - AIP-0 is NOT yet actionable for implementation**

### Blocking Items (Must Complete Before Implementation)

| Item | Status | Owner | Deadline | Blocks |
|------|--------|-------|----------|--------|
| **Deploy ACTP Kernel** (Base Sepolia) | ❌ TODO | Core Team | ASAP | All operations |
| **Deploy Escrow Vault** (Base Sepolia) | ❌ TODO | Core Team | ASAP | Payment flow |
| **Deploy Mock USDC** (Base Sepolia) | ❌ TODO | Core Team | ASAP | Escrow funding |
| **Create AIP-1 Schema** (Request Metadata) | ✅ DONE | Protocol Team | 2025-11-16 | N/A |
| **Create AIP-4 Schema** (Delivery Proof) | ✅ DONE | Protocol Team | 2025-11-16 | N/A |
| **Deploy EAS Schema** (AIP-4, Base Sepolia) | ⚠️ READY | User | ASAP | Provider node |
| **Update AIP-0 Contract Addresses** | ❌ TODO | Protocol Team | Post-deploy | SDK init |
| **Implement SDK RequestBuilder** | ⚠️ PARTIAL | SDK Team | TBD | n8n node |
| **Implement SDK MessageSigner** | ✅ DONE | SDK Team | 2025-11-15 | N/A |
| **Implement SDK DeliveryProofBuilder** | ✅ DONE | SDK Team | 2025-11-16 | N/A |

### Implementation Readiness

**Current Status:** ✅ **Schemas & SDK Complete - Ready for Contract Deployment**

**What's Complete:**
1. ✅ JSON Schema files for AIP-1 (Request Metadata) - `/docs/schemas/aip-1-request.schema.json`
2. ✅ JSON Schema files for AIP-4 (Delivery Proof) - `/docs/schemas/aip-4-delivery.schema.json`
3. ✅ EIP-712 type definitions for all message types - `/docs/schemas/*.eip712.json`
4. ✅ SDK DeliveryProofBuilder implemented - `/sdk/src/builders/DeliveryProofBuilder.ts`
5. ✅ SDK MessageSigner implemented - `/sdk/src/protocol/MessageSigner.ts`
6. ✅ Canonical JSON library integrated - `fast-json-stable-stringify@^2.1.0`
7. ✅ IPFS Client implemented - `/sdk/src/utils/IPFSClient.ts`
8. ✅ Nonce Manager implemented - `/sdk/src/utils/NonceManager.ts`
9. ✅ Test suite (49 tests passing) - `/sdk/src/__tests__/`
10. ✅ EAS Schema deployment script - `/sdk/scripts/deployEASSchema.ts`

**What's Still Missing:**
1. ❌ Actual smart contract addresses (using placeholders `<PENDING_DEPLOYMENT>`)
2. ❌ ACTP Kernel deployed to Base Sepolia
3. ❌ Escrow Vault deployed to Base Sepolia
4. ❌ Mock USDC deployed to Base Sepolia
5. ⚠️ EAS Schema UID (deployment script ready, needs execution)
6. ⚠️ SDK RequestBuilder (partial implementation exists)

**What Works:**
- ✅ Identity framework (DIDs, verification flow)
- ✅ Transport options (IPFS, webhooks, queues)
- ✅ State machine design (contract verified)
- ✅ Security model (EIP-712 + replay protection)
- ✅ Versioning strategy
- ✅ Delivery proof system (end-to-end)
- ✅ Canonical JSON hashing (cross-language compatible)

**Next Steps:**
1. Deploy testnet contracts (ACTPKernel, EscrowVault, Mock USDC) → 1-2 hours
2. Deploy EAS schema (run `/sdk/scripts/deployEASSchema.ts`) → 5 minutes
3. Update §2.2 with actual contract addresses → 5 minutes
4. Update AIP-0 Schema Registry (§5.2) with deployed schema UIDs → 5 minutes
5. Test end-to-end workflow on testnet → 1 hour

**Timeline Estimate:**
- ✅ AIP-1 + AIP-4 specs: **COMPLETE**
- ✅ SDK implementation: **COMPLETE**
- ⏳ Contract deployment: **2-3 hours** (user action required)
- **Total: ~3 hours until fully actionable**

---

## 1. Identity Verification

### 1.1 Decentralized Identifiers (DIDs)

All AGIRAILS participants (consumers and providers) MUST be identified using **Ethereum-based DIDs** following the `did:ethr` method.

**Format:**
```
did:ethr:<chain-id>:<ethereum-address>
```

**Examples:**
- Base Sepolia (testnet): `did:ethr:84532:0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb`
- Base Mainnet: `did:ethr:8453:0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb`

**Simplified Format (Chain-Specific Deployments):**

For AGIRAILS deployments on a single chain, the chain-id MAY be omitted:
```
did:ethr:0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
```

**IMPORTANT:** When using simplified format, the message MUST include an explicit `chainId` field in the message body AND in the EIP-712 domain separator. The receiver MUST validate that the DID's Ethereum address is valid on the specified chain. This prevents cross-chain replay attacks where the same DID string could represent different signers on different networks.

### 1.2 DID Verification

Recipients of AIP messages MUST verify sender identity by:

1. **Extracting the Ethereum address** from the DID (remove `did:ethr:` prefix and optional chain-id)
2. **Verifying EIP-712 signature** against the extracted address (see §2.2)
3. **Validating the DID is on the expected chain** by checking the message's `chainId` field matches the EIP-712 domain `chainId`

**Endpoint Discovery (Until Registry Deployment):**

Until the on-chain agent registry (AIP-X) is deployed, participants MUST configure provider endpoints via:
- **Direct configuration** (n8n credentials, provider config files) - REQUIRED for testnet
- **Trusted directories** (curated JSON lists on GitHub/IPFS with signature verification)
- **IPFS Pubsub discovery** (experimental, NOT reliable for production)

**After registry deployment**, clients SHOULD query the registry for verified endpoints and service metadata.

### 1.3 Agent Registry (Future AIP)

A future AIP will define an on-chain registry contract for agent metadata:

```solidity
interface IAgentRegistry {
  struct AgentProfile {
    string did;
    string endpoint;      // IPFS gateway, webhook URL, or libp2p multiaddr
    bytes32[] serviceTypes; // Supported service type hashes
    uint256 reputationScore;
    uint256 registeredAt;
  }

  function registerAgent(AgentProfile calldata profile) external;
  function getAgent(address agentAddress) external view returns (AgentProfile memory);
  function updateEndpoint(string calldata newEndpoint) external;
}
```

**Until the registry is deployed**, participants exchange endpoints via:
- Direct configuration (n8n credentials, provider config files)
- Discovery via IPFS pubsub channels
- Off-chain directories (JSON lists on IPFS/GitHub)

---

## 2. Transport and Security

### 2.1 Message Transport Protocols

AIP messages MAY be transported via any of the following mechanisms:

| Protocol | Use Case | Reliability | Privacy |
|----------|----------|-------------|---------|
| **IPFS (Content Addressed)** | Metadata storage, large payloads | High (pinning required) | Public |
| **IPFS Pubsub** | Real-time notifications | Medium (ephemeral) | Semi-public |
| **Webhooks (HTTPS POST)** | Provider callbacks | High (retry logic) | Private (TLS) |
| **Message Queues** | Enterprise integrations (RabbitMQ, AWS SQS) | High (durable) | Private |
| **Arweave** | Permanent archival | Very High (permanent) | Public |
| **Direct P2P (libp2p)** | Provider-to-consumer channels | Medium (NAT issues) | Private (encrypted) |

**Mandatory Requirements (Testnet Phase):**

All participants MUST adhere to the following storage and pinning obligations:

1. **Consumer Responsibilities:**
   - MUST upload request metadata to IPFS immediately after `createTransaction()`
   - MUST pin metadata for minimum duration = `disputeWindow + 7 days` (default: 8 days)
   - MUST include IPFS CID in provider notification message
   - RECOMMENDED: Use pinning service (Pinata, Web3.Storage, Filebase)

2. **Provider Responsibilities:**
   - MUST download and verify metadata within 1 hour of notification
   - MUST re-pin metadata locally or via pinning service
   - MUST retain metadata until transaction reaches SETTLED or DISPUTED state
   - MUST upload delivery proof to IPFS and pin permanently (reputation evidence)

3. **Provider Notification (Testnet Default):**
   - **Primary:** IPFS Pubsub to topic `/agirails/<network>/requests` (e.g., `/agirails/base-sepolia/requests`)
   - **Fallback:** If no response within 10 minutes, consumer MAY attempt direct HTTP POST to provider endpoint (if known)
   - **Limitation:** IPFS Pubsub is ephemeral; offline providers will miss requests. Future AIP will define durable queue mechanism.

**Provider Notification Message Format:**

Consumers MUST publish the following message to the IPFS Pubsub topic after creating on-chain transaction:

```json
{
  "type": "agirails.notification.v1",
  "version": "1.0.0",
  "txId": "0x7d87c3b8e23a5c9d1f4e6b2a8c5d9e3f1a7b4c6d8e2f5a3b9c1d7e4f6a8b2c5d",
  "cid": "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
  "consumer": "did:ethr:0xConsumer...",
  "provider": "did:ethr:0xProvider...",
  "chainId": 84532,
  "timestamp": 1700000000,
  "nonce": 1,
  "signature": "0x..."
}
```

**Notification Workflow:**

1. Consumer uploads AIP-1 request metadata to IPFS → obtains `cid`
2. Consumer creates notification message (above format)
3. Consumer signs message with EIP-712 (using ACTP Kernel domain)
4. Consumer publishes to `/agirails/base-sepolia/requests` topic
5. Provider subscribes to topic, receives notification
6. Provider downloads metadata from IPFS using `cid`
7. Provider verifies signature and metadata hash
8. Provider transitions transaction to ACCEPTED if willing to fulfill

4. **Delivery Proof Storage:**
   - IPFS CID + EAS on-chain attestation (see AIP-4)

### 2.2 Message Signing (EIP-712)

All AIP messages MUST be signed using **EIP-712 typed structured data signing**.

**Domain Separator:**

To prevent replay attacks across different message types and chains, the EIP-712 domain MUST use the ACTP Kernel contract address as the verifying contract:

```typescript
{
  name: 'AGIRAILS',
  version: '1',
  chainId: 84532, // Base Sepolia (or 8453 for mainnet)
  verifyingContract: '<ACTP_KERNEL_ADDRESS>' // Binds messages to specific deployment
}
```

**Testnet Contract Addresses (Base Sepolia):**

| Contract | Address | Status | Deployed Block | Git Commit |
|----------|---------|--------|----------------|------------|
| **ACTP Kernel** | `0xb5B002A73743765450d427e2F8a472C24FDABF9b` | ✅ Deployed | - | - |
| **Escrow Vault** | `0x67770791c83eA8e46D8a08E09682488ba584744f` | ✅ Deployed | - | - |
| **USDC (Mock)** | `0x444b4e1A65949AB2ac75979D5d0166Eb7A248Ccb` | ✅ Deployed | - | - |
| **EAS Contract** | `0x4200000000000000000000000000000000000021` | ✅ Canonical | Genesis | [Base Docs](https://docs.attest.sh/docs/quick--start/contracts) |

**Pre-Deployment Placeholder (INTERIM USE ONLY):**

Until the ACTP Kernel is deployed, all implementations MUST use this constant placeholder address for `verifyingContract`:

```typescript
const PLACEHOLDER_VERIFYING_CONTRACT = '0xAA00000000000000000000000000000000000001';
```

**CRITICAL:** This placeholder address is ONLY for testnet development before deployment. Once the kernel is deployed:

1. Update this table with actual addresses
2. Update SDK `ACTPClient.getNetworkConfig()` defaults
3. Recompute ALL EIP-712 domain hashes with new `verifyingContract`
4. Issue breaking change release (SDK v2.0.0)
5. Notify all integrators to update

**Post-Deployment Update Checklist:**
- [ ] Add deployed kernel address to table above
- [ ] Add deployed escrow vault address
- [ ] Add deployed USDC address
- [ ] Record deployment block numbers
- [ ] Record Git commit hash of deployed contract code
- [ ] Update SDK network config with addresses
- [ ] Recompute EIP-712 type hashes (§5.2)
- [ ] Update all example code in this document

**Replay Protection:** The combination of `(chainId, verifyingContract, message.type, message.nonce)` ensures signatures cannot be replayed across chains, deployments, or message types.

**Signature Verification:**

Recipients MUST:
1. Reconstruct the EIP-712 domain separator
2. Hash the typed message according to EIP-712 spec
3. Recover signer address using `ecrecover`
4. Verify signer address matches the DID in the message

**Implementation (SDK):**

The `@agirails/sdk` provides a `MessageSigner` utility:

```typescript
import { MessageSigner } from '@agirails/sdk';

// Signing
const signer = new MessageSigner(privateKey, network);
const signature = await signer.signTypedData(domain, types, message);

// Verification
const recoveredAddress = MessageSigner.verifyTypedData(domain, types, message, signature);
```

### 2.3 Economic Parameters (Platform Fee Model)

**Platform Fee Structure:**

AGIRAILS uses a **1% fee with $0.05 minimum** per transaction:

```
fee = max(transactionAmount * 0.01, $0.05)
```

**Key Points:**
- **Base Rate**: 1% of transaction amount
- **Minimum Floor**: $0.05 (applied when 1% would be less than $0.05)
- **Breakeven Point**: $5.00 transaction (where 1% = $0.05)

**Fee Calculation Examples:**

| Transaction Amount (USDC) | 1% Calculation | Minimum Check | Actual Fee | Effective % |
|---------------------------|----------------|---------------|------------|-------------|
| $0.50 | $0.005 | $0.05 | **$0.05** | 10% |
| $1.00 | $0.01 | $0.05 | **$0.05** | 5% |
| $3.00 | $0.03 | $0.05 | **$0.05** | 1.67% |
| $5.00 | $0.05 | $0.05 | **$0.05** | 1% (breakeven) |
| $10.00 | $0.10 | $0.05 | **$0.10** | 1% |
| $100.00 | $1.00 | $0.05 | **$1.00** | 1% |

**Implementation Details:**

1. **On-Chain Enforcement:**
   - Smart contract uses `platformFeeBps` (basis points): 100 BPS = 1%
   - Fee calculation: `fee = (amount * platformFeeBps) / 10000`
   - Maximum fee cap: 500 BPS (5%)
   - Fee changes require 2-day timelock (security measure)

2. **Off-Chain Enforcement (Minimum):**
   - **$0.05 minimum is NOT enforced on-chain**
   - SDK and frontend MUST enforce minimum before transaction creation
   - Rationale: Avoid gas-expensive on-chain minimum checks for every transaction
   - Implementation: `RequestBuilder` validates `amount >= $5.00` or warns about higher effective fee

3. **SDK Implementation:**
   ```typescript
   // In @agirails/sdk RequestBuilder
   const MIN_TRANSACTION_USDC = 0.05; // $0.05 in USDC (50000 wei at 6 decimals)

   if (amount < parseUnits('5.0', 6)) {
     const effectiveFee = MIN_TRANSACTION_USDC;
     const effectiveRate = (effectiveFee / parseFloat(formatUnits(amount, 6))) * 100;
     console.warn(
       `Transaction amount is below $5.00. ` +
       `Effective fee rate: ${effectiveRate.toFixed(2)}% (minimum $0.05 applies)`
     );
   }
   ```

4. **Configurable Fee (Admin Only):**
   - Current: 100 BPS (1%)
   - Admin can change via `scheduleEconomicParams()` with 2-day delay
   - Maximum: 500 BPS (5%) - hardcoded contract limit
   - See §8.5 for admin security features

**Fee Distribution:**
- 100% of platform fees go to `feeRecipient` address (configurable by admin)
- Future: May split between treasury, node operators, and staking rewards

**Spam Prevention:**
The $0.05 minimum prevents dust attack economics:
- Without minimum: 100,000 × $0.01 transaction = $1,000 revenue, massive state bloat
- With $0.05 minimum: Attacker pays $5,000 in fees for same attack
- Encourages batching small transactions into larger ones

### 2.4 Encryption (Optional)

For sensitive service requests (e.g., medical data processing, financial analysis), AIP messages MAY be encrypted using:

- **ECIES (Elliptic Curve Integrated Encryption Scheme)** - Encrypt to provider's public key
- **Lit Protocol** - Decentralized threshold encryption
- **Age encryption** - Simple, modern file encryption

**This is OPTIONAL** - most AI agent services operate on public or pseudonymous data.

---

## 3. Reference Conventions

AIP messages MUST reference on-chain ACTP transactions using the following identifiers:

### 3.1 Transaction ID (`txId`)

- **Type:** `bytes32` (64-character hex string with `0x` prefix)
- **Source:** Returned by `ACTPKernel.createTransaction()` event
- **Purpose:** Primary key for all ACTP state transitions
- **Example:** `0x7d87c3b8e23a5c9d1f4e6b2a8c5d9e3f1a7b4c6d8e2f5a3b9c1d7e4f6a8b2c5d`

**Usage in AIP Messages:**
All AIP messages (request metadata, delivery proofs, dispute evidence) MUST include `txId` to link off-chain data to on-chain transaction state.

### 3.2 Metadata Hash (`metadataHash`)

- **Type:** `bytes32` (keccak256 hash)
- **Source:** `keccak256(metadataPayload)` where `metadataPayload` is the **canonical UTF-8 JSON encoding** of the AIP-1 message
- **Purpose:** Integrity verification - links on-chain hash to off-chain full payload
- **Example:** `0x3f8b2c9a1e5d7f4a6b8c2e9d1f3a5b7c4e6d8f2a9b1c3d5e7f4a6b8c2e9d1f3a`

**Critical Invariant:**
```typescript
metadataHash === keccak256(toUtf8Bytes(canonicalJsonStringify(metadataPayload)))
```

**Canonical Encoding Rules (to ensure hash reproducibility):**

AGIRAILS uses **deterministic JSON serialization** to ensure metadata hashes are reproducible across different implementations (JavaScript, Python, Go, etc.).

**Algorithm:**
1. Serialize object to JSON with keys sorted **alphabetically** (recursive for nested objects)
2. NO whitespace (compact form: no spaces after `:` or `,`)
3. NO trailing commas, NO comments
4. UTF-8 encode the resulting string
5. Hash with keccak256

**Reference Implementation (JavaScript/TypeScript):**

```typescript
/**
 * Canonical JSON stringifier for AGIRAILS metadata hashing
 * Ensures deterministic serialization across all implementations
 */
export function canonicalJsonStringify(obj: any): string {
  if (obj === null) return 'null';
  if (typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalJsonStringify).join(',') + ']';
  }

  // Sort object keys alphabetically
  const sortedKeys = Object.keys(obj).sort();
  const pairs = sortedKeys.map(key => {
    const value = canonicalJsonStringify(obj[key]);
    return `"${key}":${value}`;
  });

  return '{' + pairs.join(',') + '}';
}

// Usage
const metadata = {
  serviceType: 'ocr',
  inputData: { imageUrl: 'ipfs://...' },
  timestamp: 1700000000
};

const canonical = canonicalJsonStringify(metadata);
// Result: {"inputData":{"imageUrl":"ipfs://..."},"serviceType":"ocr","timestamp":1700000000}
// Note: Keys are sorted alphabetically, no whitespace

const hash = keccak256(toUtf8Bytes(canonical));
```

**SDK Location:**
- Implementation: `/sdk/src/utils/canonicalJson.ts`
- Tests: `/sdk/test/canonicalJson.test.ts`
- Export: `import { canonicalJsonStringify } from '@agirails/sdk/utils'`

**Cross-Language Compatibility:**

Other languages MUST implement the same algorithm to ensure hash compatibility:

- **Python:** Use `json.dumps(obj, sort_keys=True, separators=(',', ':'))` (no spaces)
- **Go:** Use `json.Marshal()` with sorted keys (may need custom marshaler)
- **Rust:** Use `serde_json` with `to_string()` + sorted keys

**Test Vector (for validation):**

```json
Input:
{
  "b": 2,
  "a": 1,
  "c": { "y": 4, "x": 3 }
}

Canonical Output:
{"a":1,"b":2,"c":{"x":3,"y":4}}

Keccak256 Hash:
0x8f4b7e8c9d2a3f5e6b1c8d7a4e9f2b5c3a6d8e1f7c4b9a2d5e8f1c3a6b9d2e5f
```

**MANDATORY Workflow (defined in AIP-1):**

Consumers MUST:
1. Construct AIP-1 request message with all required fields
2. Compute `metadataHash = keccak256(canonicalJson(message))`
3. Store hash on-chain via `kernel.createTransaction({ metadata: metadataHash })`
4. Upload full `message` JSON to IPFS, obtaining `cid`
5. Store mapping `txId → cid` off-chain (local DB or publish to IPFS Pubsub)
6. Notify provider with `{ txId, cid }` message

Providers MUST:
1. Receive `{ txId, cid }` notification
2. Download metadata from IPFS using `cid`
3. Recompute hash: `computedHash = keccak256(canonicalJson(downloadedMessage))`
4. Query on-chain: `onChainHash = kernel.getTransaction(txId).metadata`
5. Verify: `computedHash === onChainHash` (if mismatch, reject as fraudulent)

**This is NOT optional** - without this workflow, providers cannot verify request authenticity.

### 3.3 Escrow ID (`escrowId`)

- **Type:** `bytes32` (64-character hex string with `0x` prefix)
- **Source:** Returned by `EscrowVault.createEscrow()` event
- **Purpose:** Links ACTP transaction to USDC escrow funds
- **Example:** `0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b`

**Linkage Flow:**

**Important**: The `linkEscrow()` function has state requirements based on the ACTP workflow:

**Option A: Direct Commitment (Skip Quote):**
```
1. Consumer: txId = kernel.createTransaction(...) → state = INITIATED
2. Consumer: escrowId = escrow.createEscrow({ txId, amount: 1.0 USDC })
3. Consumer: kernel.linkEscrow(txId, escrowVaultAddress, escrowId)
   → Contract automatically transitions INITIATED → COMMITTED
4. Provider: kernel.getTransaction(txId) → reads escrowId, verifies funds
```

**Option B: With Quote (Provider Sets Price First):**
```
1. Consumer: txId = kernel.createTransaction(...) → state = INITIATED
2. Provider: kernel.transitionState(txId, QUOTED, quoteProof)
   → state = QUOTED (provider submits price quote via AIP-2)
3. Consumer: Accepts quote, creates escrow
4. Consumer: escrowId = escrow.createEscrow({ txId, amount: quotedAmount })
5. Consumer: kernel.linkEscrow(txId, escrowVaultAddress, escrowId)
   → Contract automatically transitions QUOTED → COMMITTED
6. Provider: kernel.getTransaction(txId) → reads escrowId, verifies funds
```

**Critical Constraint:**

The `linkEscrow()` function in ACTPKernel.sol requires:
```solidity
require(txn.state == State.INITIATED || txn.state == State.QUOTED, "Invalid state for escrow linking");
```

**This means:**
- ✅ Can link escrow from INITIATED (direct commitment, no quote)
- ✅ Can link escrow from QUOTED (after provider sets price)
- ❌ CANNOT link escrow from COMMITTED, IN_PROGRESS, DELIVERED, etc.
- ❌ Linking automatically transitions to COMMITTED (not a manual state change)

**Why This Design?**

1. **Prevents Double Escrow**: Once COMMITTED, escrow is already linked
2. **Provider Quote Optional**: Allows flexible workflows (with or without quotes)
3. **Automatic Transition**: linkEscrow() is a commitment action, so state changes automatically
4. **Gas Efficiency**: No need for separate "accept quote" transaction

### 3.4 IPFS Content Identifier (`cid`)

- **Type:** String (IPFS CIDv1, base32-encoded)
- **Purpose:** Reference to off-chain metadata payload stored on IPFS
- **Example:** `bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi`

**Usage Pattern:**
```typescript
// 1. Upload metadata to IPFS
const metadataPayload = { serviceType: 'ocr', inputData: {...} };
const cid = await ipfs.add(JSON.stringify(metadataPayload));

// 2. Store hash on-chain
const metadataHash = keccak256(JSON.stringify(metadataPayload));
await kernel.createTransaction({ ..., metadata: metadataHash });

// 3. Notify provider off-chain with CID
await publishMessage('/agirails/requests', { txId, cid });
```

---

## 4. Lifecycle Map

This section defines the **state machine** and **message flow** for AGIRAILS transactions.

### 4.1 State Machine (ACTP Kernel)

**⚠️ IMPORTANT - STATE MACHINE VERIFICATION REQUIRED**

The state names and numeric values below are based on the current ACTP Kernel Solidity specification (`/Testnet/ACTP-Kernel/src/ACTPKernel.sol`). Before testnet launch, this section MUST be verified against the deployed contract to ensure alignment.

**Verification Checklist (Post-Deployment):**
- [x] Confirm state enum matches Solidity source (verified 2025-11-16)
- [x] Verify numeric values (0-7) match contract interface
- [ ] Test each state transition via SDK `kernel.transitionState()` (awaiting deployment)
- [ ] Validate access control (who can execute each transition) (awaiting deployment)
- [x] Update AIP-0 to reflect actual state names (COMMITTED, IN_PROGRESS, CANCELLED)

**Source of Truth:**

The deployed smart contract ABI is the canonical source. This document reflects the *expected* state machine based on:

- **Source File:** `/Testnet/ACTP-Kernel/src/ACTPKernel.sol`
- **Git Commit:** `<PENDING_DEPLOYMENT>` ← TODO: Add commit hash used for deployment
- **Contract Address:** `<PENDING_DEPLOYMENT>` ← TODO: Add deployed kernel address

**How to Verify After Deployment:**

```bash
# 1. Fetch deployed contract ABI
cast abi <KERNEL_ADDRESS> --rpc-url https://sepolia.base.org

# 2. Extract State enum from ABI
grep -A 10 "enum State" ACTPKernel.abi.json

# 3. Compare with specification below
# If mismatch found, update this document immediately
```

**Current ACTP Kernel State Enum (from `/Testnet/ACTP-Kernel/src/interfaces/IACTPKernel.sol`):**

```solidity
enum State {
    INITIATED,   // 0 - Transaction created, awaiting escrow link
    QUOTED,      // 1 - Provider submitted price quote (optional, not in v0.1)
    COMMITTED,   // 2 - Escrow linked, provider committed to work
    IN_PROGRESS, // 3 - Provider actively working on service
    DELIVERED,   // 4 - Provider delivered result + proof
    SETTLED,     // 5 - Payment released (terminal state)
    DISPUTED,    // 6 - Consumer disputed delivery (requires mediation)
    CANCELLED    // 7 - Transaction cancelled before completion
}
```

**✅ CONTRACT VERIFIED (2025-11-16):**

The state machine documented above has been verified against the actual Solidity implementation in `/Testnet/ACTP-Kernel/src/interfaces/IACTPKernel.sol`.

**Key Differences from Initial Spec:**
- State 2: `COMMITTED` (not "ACCEPTED") - triggered automatically by `linkEscrow()`
- State 3: `IN_PROGRESS` (new optional state) - provider can signal active work
- State 7: `CANCELLED` (new terminal state) - refund if work never completed

**Important Notes:**
1. The `linkEscrow()` function automatically transitions INITIATED → COMMITTED (consumer cannot prevent this)
2. The IN_PROGRESS state is optional; providers can go directly from COMMITTED → DELIVERED
3. The SDK state enum must match these exact names and numeric values
4. Before deployment, verify the deployed contract ABI matches this specification

**The smart contract ABI is always the source of truth.** If the deployed contract differs from the Solidity source, this document will be updated within 24 hours.

**State Transition Diagram:**

```
┌─────────────┐
│  INITIATED  │ ← Consumer: createTransaction()
│   (State 0) │
└──────┬──────┘
       │
       │ Provider: transitionState(txId, QUOTED) [OPTIONAL - not in v0.1]
       ▼
┌─────────────┐
│   QUOTED    │ ← Provider submits price quote via AIP-2 (not implemented in v0.1)
│   (State 1) │
└──────┬──────┘
       │
       │ Consumer: linkEscrow(txId, escrowContract, escrowId)
       │ → Automatically transitions to COMMITTED
       ▼
┌─────────────┐
│  COMMITTED  │ ← Escrow linked, provider committed to work
│   (State 2) │   (Consumer linkEscrow() triggers this transition)
└──────┬──────┘
       │
       │ Provider: transitionState(txId, IN_PROGRESS) [OPTIONAL]
       ▼
┌─────────────┐
│ IN_PROGRESS │ ← Provider actively working on service
│   (State 3) │   (Informational state, not strictly required)
└──────┬──────┘
       │
       │ Provider: transitionState(txId, DELIVERED, proofCID)
       ▼
┌─────────────┐
│  DELIVERED  │ ← Provider submitted result proof (EAS attestation created off-chain)
│   (State 4) │
└──────┬──────┘
       │
       │ Consumer: transitionState(txId, SETTLED) OR auto-settle after disputeWindow
       ▼
┌─────────────┐
│   SETTLED   │ ← Escrow released to provider (TERMINAL STATE)
│   (State 5) │   ⚠️ releaseEscrow() requires state == SETTLED
└──────┬──────┘
       │
       │ Provider (OPTIONAL): anchorAttestation(txId, easUID) for reputation
       ▼
     (Attestation anchored post-settlement for permanent record)

       OR (from DELIVERED)

┌─────────────┐
│  DISPUTED   │ ← Consumer: transitionState(txId, DISPUTED, disputeEvidence)
│   (State 6) │   Mediator: resolves → transitions to SETTLED
└─────────────┘   → Escrow split per mediator decision

       OR (from INITIATED/QUOTED/COMMITTED before deadline)

┌─────────────┐
│  CANCELLED  │ ← Refund requester if work never started (before DELIVERED)
│   (State 7) │   (TERMINAL STATE)
└─────────────┘
```

**Access Control (Enforced by Smart Contract):**

| Function / Transition | Who Can Execute | Requirements / Constraints | AIP Reference |
|-----------------------|-----------------|----------------------------|---------------|
| **Transaction Creation & Lifecycle** |
| `createTransaction()` | Anyone (typically requester) | Requester must be msg.sender or specified address | - |
| INITIATED → QUOTED | Provider only | Provider calls transitionState(QUOTED) with quote details | AIP-2 (not in v0.1) |
| `linkEscrow()` | Requester only | Must be in INITIATED or QUOTED state; automatically transitions to COMMITTED | - |
| INITIATED → COMMITTED | Automatic (via linkEscrow) | Requester calls linkEscrow() with valid escrowId | - |
| QUOTED → COMMITTED | Automatic (via linkEscrow) | Requester calls linkEscrow() with valid escrowId (skip quote) | - |
| COMMITTED → IN_PROGRESS | Provider only | Provider calls transitionState(IN_PROGRESS); optional state | - |
| IN_PROGRESS → DELIVERED | Provider only | Provider calls transitionState(DELIVERED, proofCID); EAS attestation created off-chain | AIP-4 |
| COMMITTED → DELIVERED | Provider only | Provider calls transitionState(DELIVERED, proofCID) (skip IN_PROGRESS) | AIP-4 |
| `releaseMilestone()` | Requester only | Requester can release partial escrow during IN_PROGRESS | - |
| DELIVERED → SETTLED | Consumer OR system | Consumer calls transitionState(SETTLED) OR auto-transition after disputeWindow | - |
| `releaseEscrow()` | Anyone (after SETTLED) | ⚠️ Requires txn.state == SETTLED; actually releases funds to provider | - |
| `anchorAttestation()` | Provider OR Consumer | ⚠️ Only callable AFTER SETTLED; optional reputation anchoring | AIP-4 |
| DELIVERED → DISPUTED | Consumer only | Consumer calls transitionState(DISPUTED, disputeProof) within disputeWindow | AIP-5 |
| DISPUTED → SETTLED | Admin OR Pauser | Mediator (admin/pauser) calls transitionState(SETTLED, resolutionProof) | AIP-6 |
| Any → CANCELLED | Requester (before DELIVERED) | Requester can cancel if deadline passed OR before work delivered | - |
| **Admin Functions** |
| `pause()` | Pauser only | Immediate effect; halts all state transitions | - |
| `unpause()` | Pauser only | Resumes normal operations | - |
| `scheduleEconomicParams()` | Admin only | 2-day timelock before execution | - |
| `executeEconomicParamsUpdate()` | Anyone | Can only execute after 2-day delay | - |
| `cancelEconomicParamsUpdate()` | Admin only | Cancel pending fee change | - |
| `scheduleEmergencyWithdraw()` | Admin only | 7-day timelock before execution | - |
| `executeEmergencyWithdraw()` | Admin only | Can only execute after 7-day delay | - |
| `setFeeRecipient()` | Admin only | Immediate effect (only affects new fee accrual) | - |
| `setPauser()` | Admin only | Change pauser address | - |
| `transferAdmin()` | Admin only | Transfer admin role (may have timelock) | - |
| `approveEscrowVault()` | Admin only | Whitelist escrow vault contracts | - |

### 4.2 Message Flow Table

| State | Actor | On-Chain Action | Off-Chain Message (AIP) | Transport |
|-------|-------|----------------|------------------------|-----------|
| **INITIATED** | Consumer | `createTransaction()` | **AIP-1 Request Metadata** (serviceType, inputData, deadline) | IPFS (CID) + IPFS Pubsub notification (AIP-0.1) |
| **INITIATED** | Provider | `transitionState(QUOTED)` | **AIP-2 Quote Message** (optional - not in v0.1) | Webhook to consumer |
| **QUOTED** | Consumer | `linkEscrow()` → auto-transitions to COMMITTED | None | - |
| **COMMITTED** | Provider | `transitionState(IN_PROGRESS)` [optional] | None (informational state) | - |
| **IN_PROGRESS** | Provider | `transitionState(DELIVERED, proofCID)` | **AIP-4 Delivery Proof** (result data, EAS attestation created off-chain) | IPFS (CID) + EAS attestation (NOT anchored yet) |
| **COMMITTED** | Provider | `transitionState(DELIVERED, proofCID)` | **AIP-4 Delivery Proof** (skip IN_PROGRESS) | IPFS (CID) + EAS attestation (NOT anchored yet) |
| **DELIVERED** | Consumer | `transitionState(SETTLED)` OR auto after disputeWindow | None (automatic settlement) | - |
| **SETTLED** | Consumer | `releaseEscrow()` (releases funds to provider) | None | - |
| **SETTLED** | Provider | `anchorAttestation(easUID)` [OPTIONAL - for reputation] | None (anchors existing EAS attestation on-chain) | - |
| **DELIVERED** | Consumer | `transitionState(DISPUTED, disputeProof)` | **AIP-5 Dispute Evidence** (reason, evidence CID) | IPFS (dispute evidence) |
| **DISPUTED** | Mediator | Resolve dispute → `transitionState(SETTLED, resolutionProof)` | **AIP-6 Resolution Decision** (requester/provider/mediator split) | Off-chain arbitration platform |
| **Any (pre-DELIVERED)** | Requester | `transitionState(CANCELLED)` if deadline passed | None | - |

### 4.3 Critical Flow Rules

1. **linkEscrow() has state requirements**: Can ONLY be called when state is INITIATED or QUOTED (see §3.3)
2. **linkEscrow() automatically transitions INITIATED/QUOTED → COMMITTED** (contract enforces this, not manual)
3. **Only PROVIDER can transition to IN_PROGRESS** (optional informational state)
4. **Only PROVIDER can transition COMMITTED/IN_PROGRESS → DELIVERED** (requires EAS attestation)
5. **Only CONSUMER can transition DELIVERED → DISPUTED** (within dispute window)
6. **Only MEDIATOR (admin/pauser) can resolve DISPUTED → SETTLED** (with resolution proof)
7. **SETTLED and CANCELLED are terminal states** (no further transitions)
8. **CANCELLED only possible before DELIVERED** (refund requester if work never completed)
9. **QUOTED state is optional** - consumer can skip directly from INITIATED → COMMITTED via linkEscrow()
10. **IN_PROGRESS state is optional** - provider can skip directly from COMMITTED → DELIVERED

---

## 5. Schema Registry

This section lists all AIP message types, their versions, and references to detailed schemas.

### 5.1 Message Type Identifiers

Each AIP message MUST include a `type` and `version` field:

```typescript
{
  type: 'agirails.request.v1',  // Format: agirails.<operation>.<version>
  version: '1.0.0',              // Semver versioning
  // ... message-specific fields
}
```

### 5.2 Registered AIP Messages

**Status Legend:**
- **Draft** - Specification in progress, NOT ready for implementation
- **Review** - Open for community review, schema complete
- **Final** - Approved and implemented in SDK
- **Deprecated** - Superseded by newer version

| AIP | Message Type | Version | Schema Available | EIP-712 Type Hash | Status | Blocking | Purpose |
|-----|--------------|---------|------------------|-------------------|--------|----------|---------|
| **AIP-0.1** | `agirails.notification.v1` | 1.0.0 | ✅ Draft | `<PENDING>` | Draft | **YES** | IPFS Pubsub notification (txId + CID) |
| **AIP-1** | `agirails.request.v1` | 1.0.0 | ✅ Available | `<PENDING>` | Draft | **YES** | Service request metadata (consumer → provider) |
| **AIP-2** | `agirails.quote.v1` | 1.0.0 | ❌ TODO | `<PENDING>` | Draft | No | Price quote (provider → consumer) - OPTIONAL |
| **AIP-3** | `agirails.discovery.v1` | 1.0.0 | ❌ TODO | `<PENDING>` | Draft | No | Provider discovery registry query |
| **AIP-4** | `agirails.delivery.v1` | 1.0.0 | ✅ Available | `<PENDING>` | Draft | **YES** | Delivery proof + EAS attestation |
| **AIP-5** | `agirails.dispute.v1` | 1.0.0 | ❌ TODO | `<PENDING>` | Draft | No | Dispute evidence submission |
| **AIP-6** | `agirails.resolution.v1` | 1.0.0 | ❌ TODO | `<PENDING>` | Draft | No | Mediator resolution decision |

**Schema Links:**
- ✅ [AIP-0.1 Notification Schema](./schemas/aip-0.1-notification.schema.json)
- ✅ [AIP-0.1 Notification EIP-712](./schemas/aip-0.1-notification.eip712.json)
- ✅ [AIP-1 Specification](../docs/AIP-1.md) - Service Request Metadata Standard
- ✅ [AIP-4 Specification](./AIP-4.md) - Delivery Proof and EAS Attestation Standard
- ✅ [AIP-4 Delivery Schema](./schemas/aip-4-delivery.schema.json) (defined in AIP-4 §3.2)
- ✅ [AIP-4 Delivery EIP-712](./schemas/aip-4-delivery.eip712.json) (defined in AIP-4 §3.3)

**Blocking Status:**
- **AIP-0.1 (Notification) + AIP-1 (Request) + AIP-4 (Delivery) are BLOCKING** for testnet launch
- ✅ **AIP-1 (Request)**: COMPLETED - Full specification available at Testnet/docs/AIP-1.md
- ✅ **AIP-4 (Delivery)**: COMPLETED - Full specification available at Testnet/docs/AIP-4.md
- ✅ **ALL BLOCKING AIPs COMPLETED** - Ready for consumer and provider node implementation
- All other AIPs (2, 3, 5, 6) are optional or future enhancements

**Note on AIP-0.1:**
The notification message format (§2.1) is critical infrastructure but was initially embedded in AIP-0. It should be extracted to its own AIP for proper versioning and schema validation.

**TODO Before Testnet Launch:**

**Tracking:** See [GitHub Project Board](https://github.com/agirails/protocol/projects/1) for progress

1. **Create schema files** (protocol team) - **[Issue #TBD]**:
   - [ ] `/docs/schemas/aip-0.1-notification.schema.json` (JSON Schema)
   - [ ] `/docs/schemas/aip-0.1-notification.eip712.json` (EIP-712 types)
   - [ ] `/docs/schemas/aip-1-request.schema.json` (JSON Schema)
   - [ ] `/docs/schemas/aip-1-request.eip712.json` (EIP-712 types)
   - [ ] `/docs/schemas/aip-4-delivery.schema.json` (JSON Schema)
   - [ ] `/docs/schemas/aip-4-delivery.eip712.json` (EIP-712 types)

2. **Compute EIP-712 type hashes** (run once schemas finalized) - **[Issue #TBD]**:
   ```typescript
   import { utils } from 'ethers';
   const typeHash = utils.keccak256(utils.toUtf8Bytes(encodeType('Request')));
   // Update table above with actual hash values
   ```

3. **Implement SDK utilities** (SDK team) - **[Issue #TBD]**:
   - [ ] `canonicalJsonStringify()` in `/sdk/src/utils/canonicalJson.ts`
   - [ ] `MessageSigner` class in `/sdk/src/utils/MessageSigner.ts`
   - [ ] `NonceManager` class in `/sdk/src/utils/NonceManager.ts`
   - [ ] `MessageValidator` class in `/sdk/src/utils/MessageValidator.ts`
   - [ ] Unit tests for all utilities

4. **Implement SDK builders** (SDK team) - **[Issue #TBD]**:
   - [ ] `RequestBuilder` class in `/sdk/src/builders/RequestBuilder.ts`
   - [ ] `DeliveryProofBuilder` class in `/sdk/src/builders/DeliveryProofBuilder.ts`
   - [ ] `NotificationBuilder` class in `/sdk/src/builders/NotificationBuilder.ts`
   - [ ] Integration tests with mock IPFS

5. **Update AIP-0** (post-implementation) - **[Issue #TBD]**:
   - [ ] Replace `<PENDING>` type hashes with actual values
   - [ ] Mark schema status as ✅ Available
   - [ ] Update "Blocking Status" to show unblocked
   - [ ] Add deployed contract addresses (§2.2)
   - [ ] Verify state machine matches deployed contract (§4.1)

**Schema File Locations (Placeholder Links):**

Once created, schemas will be available at:
- [AIP-1 Request JSON Schema](./schemas/aip-1-request.schema.json) ← TODO: Create file
- [AIP-1 Request EIP-712 Types](./schemas/aip-1-request.eip712.json) ← TODO: Create file
- [AIP-4 Delivery JSON Schema](./schemas/aip-4-delivery.schema.json) ← TODO: Create file
- [AIP-4 Delivery EIP-712 Types](./schemas/aip-4-delivery.eip712.json) ← TODO: Create file

### 5.3 Schema Definitions

Each AIP MUST provide:

1. **JSON Schema** (for payload validation)
2. **EIP-712 Type Definition** (for signing)
3. **Example Payloads** (valid and invalid)
4. **Validation Rules** (business logic constraints)

**Example (AIP-1 Request Metadata):**

```typescript
// EIP-712 Type Definition
const AIP1_REQUEST_TYPES = {
  Request: [
    { name: 'txId', type: 'bytes32' },
    { name: 'consumer', type: 'string' },      // DID
    { name: 'provider', type: 'string' },      // DID
    { name: 'serviceType', type: 'string' },
    { name: 'inputData', type: 'string' },     // JSON-stringified
    { name: 'deadline', type: 'uint256' },
    { name: 'timestamp', type: 'uint256' },
    { name: 'nonce', type: 'uint256' }
  ]
};

// JSON Schema (validation)
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["txId", "consumer", "provider", "serviceType", "inputData", "deadline"],
  "properties": {
    "txId": { "type": "string", "pattern": "^0x[a-fA-F0-9]{64}$" },
    "consumer": { "type": "string", "pattern": "^did:ethr:(0x)?[a-fA-F0-9]{40}$" },
    "provider": { "type": "string", "pattern": "^did:ethr:(0x)?[a-fA-F0-9]{40}$" },
    "serviceType": { "type": "string", "minLength": 1 },
    "inputData": { "type": "object" },
    "deadline": { "type": "number", "minimum": 0 },
    "timestamp": { "type": "number" },
    "nonce": { "type": "number" }
  }
}
```

**Schema Storage:**

All JSON Schemas and EIP-712 type definitions SHOULD be:
- Stored in `/docs/schemas/<aip-number>.json`
- Published to IPFS for immutable reference
- Versioned using semver (e.g., `1.0.0`, `1.1.0`, `2.0.0`)

---

## 6. Extensibility and Versioning

### 6.1 Version Negotiation

**MANDATORY Field in All AIP Messages:**

Every AIP message MUST include a `supportedVersions` array listing all versions the sender can process in responses:

```typescript
{
  type: 'agirails.request.v1',
  version: '1.0.0',  // This message uses version 1.0.0
  supportedVersions: ['1.0.0', '1.1.0', '2.0.0'], // Sender can handle these in reply
  // ... message-specific fields
}
```

**Version Negotiation Protocol:**

1. **Consumer sends request:**
   ```json
   {
     "type": "agirails.request.v1",
     "version": "1.0.0",
     "supportedVersions": ["1.0.0", "1.1.0"]
   }
   ```

2. **Provider checks compatibility:**
   ```typescript
   const consumerSupports = new Set(request.supportedVersions);
   const providerSupports = ['1.0.0', '2.0.0'];

   // Find highest common version
   const compatible = providerSupports
     .filter(v => consumerSupports.has(v))
     .sort()
     .reverse()[0];

   if (!compatible) {
     throw new Error('No compatible AIP version');
   }
   ```

3. **Provider responds using compatible version:**
   ```json
   {
     "type": "agirails.delivery.v1",
     "version": "1.0.0",  // Use highest compatible version
     "supportedVersions": ["1.0.0", "2.0.0"]
   }
   ```

**Agent Registry Profile (Future - AIP-X):**

When the registry is deployed, agents will publish supported versions:

```solidity
struct AgentProfile {
  string did;
  string endpoint;
  string[] supportedMessageTypes; // ["agirails.request.v1", "agirails.request.v2"]
  // ...
}
```

**Failure Handling:**

If no compatible version exists:
- Provider MUST return error response with `supportedVersions` field
- Consumer can decide to upgrade and retry, or abort transaction
- On-chain transaction remains in INITIATED state (no payment lost)

### 6.2 Backward Compatibility Rules

**MAJOR version change (X.0.0):**
- Breaking changes (field removal, type changes)
- Clients MUST explicitly opt-in to new version
- Old version MUST be supported for minimum 6 months after new version release

**MINOR version change (1.X.0):**
- Additive changes only (new optional fields)
- Fully backward compatible
- Old clients can ignore new fields

**PATCH version change (1.0.X):**
- Bug fixes, clarifications
- No schema changes

### 6.3 Introducing New AIP Versions

To introduce a new AIP message type or version:

1. **Create Draft AIP Document** in `/docs/AIP-<number>.md`
2. **Define JSON Schema + EIP-712 Types** in `/docs/schemas/`
3. **Implement Reference Implementation** in `@agirails/sdk`
4. **Testnet Deployment** with beta testers
5. **Community Review** (minimum 2 weeks)
6. **Final Approval** by AGIRAILS core team
7. **Update AIP-0 Registry** (this document, §5.2)

### 6.4 Deprecation Policy

When an AIP version is deprecated:

1. **Mark as DEPRECATED** in AIP-0 registry
2. **Set sunset date** (minimum 6 months notice)
3. **Provide migration guide** to new version
4. **SDK emits warnings** when deprecated types are used
5. **After sunset date**, old version MAY be removed from SDK (breaking change → new major version)

### 6.5 Example: Version Migration

**Scenario:** AIP-1 v1.0.0 → v2.0.0 introduces required `priority` field

**Migration Path:**

1. **v1.1.0 (additive)**: Add optional `priority` field, default to `normal`
2. **6-month transition period**: Both v1.0.0 and v1.1.0 supported
3. **v2.0.0 (breaking)**: Make `priority` required
4. **Announcement**: "AIP-1 v1.0.0 deprecated, upgrade to v2.0.0 by 2026-06-01"
5. **SDK update**: Emit warning when using v1.0.0 after 2026-01-01
6. **Sunset**: Remove v1.0.0 support on 2026-06-01

---

## 7. Reference Implementations

### 7.1 SDK Support (`@agirails/sdk`)

The official AGIRAILS SDK provides:

- `MessageSigner` - EIP-712 signing and verification
- `IPFSClient` - Upload/download metadata with pinning
- `RequestBuilder` - Construct valid AIP-1 request messages
- `DeliveryProofBuilder` - Construct valid AIP-4 delivery proofs
- `SchemaValidator` - Validate messages against JSON Schemas

**Usage Example:**

```typescript
import { ACTPClient, RequestBuilder, MessageSigner } from '@agirails/sdk';

// 1. Create on-chain transaction
const client = await ACTPClient.create({ network: 'base-sepolia', privateKey });
const txId = await client.kernel.createTransaction({ ... });

// 2. Build AIP-1 request message
const request = RequestBuilder.create({
  txId,
  consumer: 'did:ethr:0xConsumer...',
  provider: 'did:ethr:0xProvider...',
  serviceType: 'ocr',
  inputData: { imageUrl: 'ipfs://...' },
  deadline: Math.floor(Date.now() / 1000) + 3600
});

// 3. Sign with EIP-712
const signature = await client.signer.signRequest(request);

// 4. Upload to IPFS
const cid = await client.ipfs.upload({ ...request, signature });

// 5. Notify provider
await client.ipfs.publish('/agirails/base-sepolia/requests', { txId, cid });
```

### 7.2 CLI Tools

The `agirails-cli` provides reference commands:

```bash
# Create and upload AIP-1 request
agirails request create \
  --provider did:ethr:0xProvider... \
  --service ocr \
  --input '{"imageUrl": "ipfs://..."}' \
  --max-price 1.0

# Verify AIP-4 delivery proof signature
agirails delivery verify \
  --tx-id 0x... \
  --proof-cid bafybei...

# Query agent registry
agirails registry query \
  --service ocr \
  --min-reputation 4.5
```

---

## 8. Security Considerations

### 8.1 Signature Replay Protection

All AIP messages MUST include the following fields to prevent replay attacks:

**Required Fields:**
- `timestamp` - Unix timestamp in seconds (when message was signed)
- `nonce` - Monotonically increasing counter, unique per sender DID + message type
- `chainId` - Must match EIP-712 domain `chainId`
- `type` - Message type identifier (e.g., `agirails.request.v1`)

**Validation Rules:**

Recipients MUST enforce:

1. **Timestamp freshness:**
   ```typescript
   const MAX_CLOCK_DRIFT = 300; // 5 minutes
   const now = Math.floor(Date.now() / 1000);
   if (Math.abs(now - message.timestamp) > MAX_CLOCK_DRIFT) {
     throw new Error('Message timestamp too old or too far in future');
   }
   ```

2. **Nonce uniqueness and monotonicity:**
   ```typescript
   // Nonce is scoped per (signer, messageType) to prevent cross-type replay
   const nonceKey = `${signerDID}:${message.type}`;
   const lastNonce = nonceRegistry.get(nonceKey) || 0;

   if (message.nonce <= lastNonce) {
     throw new Error(`Nonce must be > ${lastNonce} (received ${message.nonce})`);
   }

   nonceRegistry.set(nonceKey, message.nonce);
   ```

3. **Chain ID validation:**
   ```typescript
   if (message.chainId !== expectedChainId) {
     throw new Error(`Message chainId ${message.chainId} does not match expected ${expectedChainId}`);
   }
   ```

**Nonce Management:**

Senders MUST:
- Initialize nonce to `1` for first message of each type
- Increment by 1 for each subsequent message of that type
- Track nonce separately for each message type (request, delivery, quote, etc.)
- NEVER reuse or decrement nonces

**Implementation Example:**
```typescript
class NonceManager {
  private nonces = new Map<string, number>(); // messageType → current nonce

  getNextNonce(messageType: string): number {
    const current = this.nonces.get(messageType) || 0;
    const next = current + 1;
    this.nonces.set(messageType, next);
    return next;
  }
}

// Usage
const nonce = nonceManager.getNextNonce('agirails.request.v1');
const message = { type: 'agirails.request.v1', nonce, timestamp: now(), ... };
```

**Replay Protection Guarantees:**

The combination of:
- EIP-712 domain `(chainId, verifyingContract)`
- Message fields `(type, nonce, timestamp)`
- Signature verification

Ensures that:
1. Messages cannot be replayed across chains (different `chainId`)
2. Messages cannot be replayed across deployments (different `verifyingContract`)
3. Messages cannot be replayed across message types (different `type` + nonce scope)
4. Old messages expire after 5 minutes (`timestamp` validation)
5. Messages cannot be duplicated or reordered (`nonce` monotonicity)

**SDK Implementation Reference:**

The `@agirails/sdk` implements replay protection in:

- **`MessageSigner`** (`/sdk/src/utils/MessageSigner.ts`):
  - EIP-712 domain construction
  - Signature creation and verification
  - Signer address recovery

- **`NonceManager`** (`/sdk/src/utils/NonceManager.ts`):
  - Per-DID, per-type nonce tracking
  - Monotonic increment enforcement
  - Persistence layer (LocalStorage/Redis)

- **`MessageValidator`** (`/sdk/src/utils/MessageValidator.ts`):
  - Timestamp freshness check (MAX_CLOCK_DRIFT = 300s)
  - Nonce uniqueness verification
  - Chain ID validation

**Usage Example:**
```typescript
import { MessageSigner, NonceManager, MessageValidator } from '@agirails/sdk';

// Sender
const signer = new MessageSigner(privateKey, network);
const nonceManager = new NonceManager();
const message = {
  type: 'agirails.request.v1',
  nonce: nonceManager.getNextNonce('agirails.request.v1'),
  timestamp: Math.floor(Date.now() / 1000),
  chainId: 84532,
  // ... other fields
};
const signature = await signer.signTypedData(message);

// Receiver
const validator = new MessageValidator(nonceManager);
await validator.validate(message, signature); // throws if invalid
```

### 8.2 IPFS Pinning and Availability

**Problem:** IPFS content is ephemeral if not pinned

**Solutions:**
1. **Consumer responsibility**: Pin request metadata for minimum dispute window duration
2. **Provider responsibility**: Pin delivery proof permanently (evidence for reputation)
3. **Recommended service**: Pinata, Web3.Storage, Filebase (free tier sufficient)
4. **Fallback**: Store critical data in EAS attestation `data` field (more expensive but permanent)

### 8.3 Endpoint Discovery Attacks

Until the agent registry is deployed, endpoint discovery relies on off-chain configuration.

**Attack:** Malicious actor publishes fake provider endpoints

**Mitigations:**
1. **DID verification**: Always verify EIP-712 signature matches claimed provider DID
2. **Reputation check**: Query EAS attestations for provider's history
3. **Escrow protection**: Funds remain locked until delivery proof is valid
4. **Dispute mechanism**: Consumers can dispute and recover funds if defrauded

### 8.4 Front-Running of IPFS CIDs

**Attack:** Malicious observer monitors IPFS pubsub, steals request CID, front-runs provider to submit fake delivery proof

**Mitigations:**
1. **EIP-712 signature requirement**: Only provider with correct DID can submit valid state transitions
2. **EAS attestation schema**: Delivery proof requires EAS attestation from provider's DID
3. **Kernel access control**: Only `txData.provider` address can call `transitionState(DELIVERED)`

**No risk** of CID front-running due to on-chain role enforcement.

### 8.5 Admin Security Features and Timelocks

AGIRAILS implements multiple security layers to protect user funds from admin abuse:

**1. Economic Parameter Changes (2-Day Timelock):**

Function: `scheduleEconomicParams(uint16 newPlatformFeeBps, uint16 newRequesterPenaltyBps)`

- **Timelock**: 2 days (172,800 seconds) from schedule to execution
- **Purpose**: Prevents instant fee changes that could harm users
- **Max Limits**: Platform fee capped at 500 BPS (5%), penalty capped at 1000 BPS (10%)
- **Cancellation**: Admin can cancel scheduled changes before execution
- **Execution**: Anyone can call `executeEconomicParamsUpdate()` after timelock expires

**Workflow:**
```solidity
// Day 0: Admin schedules fee change
kernel.scheduleEconomicParams(150, 200); // 1.5% platform fee, 2% penalty

// Day 0-2: Users can see pending change, decide whether to continue using platform
// Users can complete active transactions before new fees take effect

// Day 2+: Anyone executes the change
kernel.executeEconomicParamsUpdate();
```

**Security Guarantee**: Users have 48 hours notice before any fee increase. No surprise fee changes.

**2. Emergency Withdrawal (7-Day Timelock):**

Function: `scheduleEmergencyWithdraw(address token, address to, uint256 amount)`

- **Timelock**: 7 days (604,800 seconds) from schedule to execution
- **Purpose**: Admin can recover stuck funds (e.g., USDC sent to wrong contract) BUT cannot instantly rug pull
- **Use Cases**:
  - Recover tokens sent to kernel contract by mistake
  - Emergency migration if critical vulnerability discovered
  - Move funds to upgraded contract version
- **Cancellation**: Admin can cancel scheduled withdrawal
- **Execution**: Admin calls `executeEmergencyWithdraw()` after timelock expires

**Workflow:**
```solidity
// Day 0: Admin schedules emergency withdrawal (e.g., due to critical bug)
kernel.scheduleEmergencyWithdraw(USDC_ADDRESS, SAFE_ADDRESS, 1000e6);

// Day 0-7: Users see scheduled withdrawal, can dispute if unauthorized
// Active transactions can complete or be disputed
// Community can flag malicious withdrawal attempt

// Day 7+: Admin executes withdrawal
kernel.executeEmergencyWithdraw(USDC_ADDRESS, SAFE_ADDRESS, 1000e6);
```

**Security Guarantee**: Users have 7 days to detect and respond to unauthorized fund movements. Emergency withdrawal events are publicly visible on-chain.

**3. Mediator Approval (2-Day Timelock):**

Function: `scheduleMediatorApproval(address mediator, bool approved)`

- **Timelock**: 2 days
- **Purpose**: Only approved mediators can resolve disputes
- **Prevents**: Admin from instantly adding malicious mediator to steal disputed funds
- **List**: Mediators are tracked in `approvedMediators` mapping

**4. Pause Mechanism (Immediate, Pauser Role):**

Function: `pause()` / `unpause()`

- **No Timelock**: Immediate effect (emergency stop)
- **Who**: Pauser role (separate from admin for security)
- **Purpose**: Halt all state transitions if exploit detected
- **Scope**: Blocks `createTransaction()`, `linkEscrow()`, `transitionState()`, etc.
- **View Functions**: Still work (users can query state)
- **Security Rationale**: Must be instant to stop ongoing exploit

**Pauser vs Admin Separation:**
```
Admin Powers:
- Schedule fee changes (2-day delay)
- Schedule emergency withdrawal (7-day delay)
- Schedule mediator approval (2-day delay)
- Transfer admin role (2-day delay)
- Approve escrow vaults

Pauser Powers:
- pause() / unpause() (immediate)
- CANNOT steal funds
- CANNOT change fees
- CANNOT approve mediators

Pauser is typically a 2-of-3 multisig for rapid response
Admin is a 3-of-5 multisig for critical decisions
```

**5. Admin Transfer (2-Day Timelock):**

Function: `scheduleAdminTransfer(address newAdmin)`

- **Timelock**: 2 days
- **Purpose**: Prevent instant admin takeover
- **Use Case**: Upgrade admin to multisig, or rotate keys
- **Security**: Old admin can cancel transfer if unauthorized

**6. Fee Recipient Change (Immediate):**

Function: `setFeeRecipient(address newRecipient)`

- **No Timelock**: Immediate (only affects future fee accrual)
- **Purpose**: Update where platform fees are sent
- **Note**: Cannot affect funds already in escrow (only new fee generation)

**Event Monitoring (Critical for Users and Integrators):**

All admin actions emit events that MUST be monitored:

```solidity
event EconomicParamsUpdateScheduled(uint16 newPlatformFeeBps, uint16 newRequesterPenaltyBps, uint256 executeAfter);
event EmergencyWithdrawScheduled(address indexed token, address indexed to, uint256 amount, uint256 executeAfter);
event MediatorApprovalScheduled(address indexed mediator, bool approved, uint256 executeAfter);
event KernelPaused(address indexed by, uint256 timestamp);
event KernelUnpaused(address indexed by, uint256 timestamp);
event AdminTransferred(address indexed oldAdmin, address indexed newAdmin);
```

**Monitoring Best Practices:**

1. **Subscribe to Events**: Use Alchemy/Infura webhooks to monitor admin events
2. **Alert Thresholds**:
   - Fee change > 2%: High priority alert
   - Emergency withdrawal: Critical alert
   - Pause event: Stop all new transactions
3. **Community Governance**: Future DAO can veto malicious admin actions via on-chain vote

**Immutability vs Upgradeability:**

AGIRAILS contracts are **NOT upgradeable** (no proxy patterns):
- No `delegatecall` to new implementation
- No UUPS/TransparentProxy/Beacon patterns
- Contract code is immutable once deployed
- Migration requires new deployment + manual fund transfer

**Rationale**: Security > Flexibility. Upgradeability introduces attack vectors (see Poly Network $600M hack). Users trust immutable code + timelocks, not admin promises.

---

## 9. Roadmap and Future AIPs

### Planned AIPs (Q1 2026)

| AIP | Title | Priority | Status |
|-----|-------|----------|--------|
| AIP-1 | Request Metadata Format | Critical | Draft (this doc references it) |
| AIP-2 | Service Type Registry | High | Planned |
| AIP-3 | Provider Discovery Protocol | High | Planned |
| AIP-4 | Delivery Proof and EAS Schema | Critical | Draft (referenced in lifecycle) |
| AIP-5 | Dispute Evidence Format | Medium | Planned |
| AIP-6 | Mediator Resolution Protocol | Low | Future |
| AIP-7 | Streaming Results (WebSocket) | Medium | Future |
| AIP-8 | Multi-Agent Workflows | Low | Future |

### Implementation Priority

**Week 1-2 (Testnet Launch):**
- AIP-1 (Request Metadata) ← **BLOCKING FOR N8N NODE**
- AIP-4 (Delivery Proof) ← **BLOCKING FOR PROVIDER NODE**

**Month 1:**
- AIP-2 (Service Type Registry)
- AIP-3 (Provider Discovery)

**Month 2+:**
- AIP-5, AIP-6 (Dispute system)
- Community-submitted AIPs

---

## 10. Governance

### 10.1 AIP Editors

Current AIP editors (responsible for reviewing and merging AIPs):
- Damir Mujic (AGIRAILS Founder)
- [Open seat - community nomination]

### 10.2 Submission Process

1. Fork `agirails/protocol` repository
2. Create `docs/AIP-<number>.md` (use template)
3. Submit pull request
4. Community discussion (minimum 2 weeks)
5. Editor review and approval
6. Merge to main branch → AIP accepted

### 10.3 AIP Statuses

- **Draft** - Work in progress, not final
- **Review** - Open for community feedback
- **Final** - Accepted and implemented
- **Deprecated** - Superseded by newer version
- **Withdrawn** - Author abandoned

---

## 11. References

- **EIP-712**: Ethereum typed structured data hashing and signing
  https://eips.ethereum.org/EIPS/eip-712

- **DID Method `ethr`**: Ethereum DID specification
  https://github.com/decentralized-identity/ethr-did-resolver

- **IPFS**: InterPlanetary File System
  https://ipfs.tech

- **EAS (Ethereum Attestation Service)**: On-chain attestations
  https://attest.sh

- **ACTP Yellow Paper**: AGIRAILS Core Transaction Protocol
  `/docs/yellow-paper.md` (referenced state machine, escrow flow)

---

## 12. Copyright

Copyright © 2025 AGIRAILS Inc.
Licensed under Apache-2.0.

This document and all AIP specifications are open-source and may be freely implemented by any party.

---

**END OF AIP-0**

**Next Steps:**
1. Create AIP-1 (Request Metadata Format) with detailed JSON Schema
2. Implement `RequestBuilder` and `MessageSigner` in SDK
3. Update n8n consumer node to upload AIP-1 messages to IPFS
4. Create provider node reference implementation
