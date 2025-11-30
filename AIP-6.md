# AIP-6: Attestation & Reputation

**Status:** Draft
**Author:** AGIRAILS Core Team
**Created:** 2025-11-18
**Updated:** 2025-11-18
**Version:** 1.0.3
**Depends On:** AIP-0 (Meta Protocol), AIP-4 (Delivery Proof), AIP-5 (Settlement), AIP-7 (Agent Registry)

---

## Abstract

This document defines the **Attestation & Reputation** framework for the AGIRAILS AI agent economy. AIP-6 specifies how agents build verifiable, portable, and cryptographically secure reputation through on-chain attestations anchored via the Ethereum Attestation Service (EAS).

AIP-6 establishes:

1. **On-chain attestation anchoring** - Permanent reputation records via EAS
2. **Reputation scoring model** - Algorithmic trust calculation based on transaction history
3. **Sybil resistance mechanisms** - Economic and cryptographic defenses against fake identities
4. **Privacy-preserving architecture** - Public reputation with optional private transaction details
5. **Cross-platform portability** - DID-based reputation that transcends individual platforms

The reputation system enables autonomous AI agents to establish trust without centralized intermediaries, creating a permissionless marketplace where quality providers can signal credibility and consumers can discover reliable services.

**Core Principles:**
- **Cryptographically verifiable** - All reputation claims backed by on-chain attestations
- **Sybil-resistant** - Economic barriers prevent reputation washing
- **Privacy-aware** - Public metrics, private transaction details
- **Platform-agnostic** - Portable across any ACTP-compliant implementation
- **Tamper-proof** - Immutable attestations prevent retroactive manipulation

---

## Deployment Status & Critical Dependencies

> **⚠️ CRITICAL: Reputation System NOT Functional in Current Deployment**
>
> The reputation scoring system described in this AIP **requires off-chain infrastructure** that is currently **0% implemented**:
>
> - ❌ **EAS Schema Deployment** - Attestation schema not deployed to Base Sepolia
> - ❌ **Reputation Indexer** - Off-chain service to compute scores does not exist
> - ❌ **SDK Integration** - `client.reputation.*` methods not implemented
>
> **Impact**: Without these components:
> - Reputation scores **cannot be calculated**
> - Provider discovery UI **non-functional**
> - SDK methods will **throw errors** (no backend to query)
>
> **Timeline to Production**: 4-6 weeks estimated
>
> **Current Status**: This AIP is a **specification document** for future implementation, not a working system.

---

### What's Complete
- ✅ ACTPKernel attestation anchoring (ACTPKernel.sol:270-278)
- ✅ Reputation scoring algorithm design (§3)
- ✅ EAS integration architecture (§2.1)

### What's Missing
- ❌ EAS schema deployment (Base Sepolia)
- ❌ Reputation indexer implementation
- ❌ SDK reputation query API
- ❌ Provider discovery UI

### Dependency Table

| Component | Status | Dependencies | Notes |
|-----------|--------|--------------|-------|
| **EAS Delivery Schema** | ❌ TODO | EAS on Base Sepolia | Schema UID pending (see §5.1) |
| **Reputation Indexer** | ❌ TODO | ACTPKernel events, EAS | Off-chain service |
| **SDK Reputation Module** | ❌ TODO | Indexer API | client.reputation.* methods |
| **On-Chain Validation** | ❌ TODO | ACTPKernel V2 upgrade | See §6.4 security gap |

**Blockers**: EAS schema deployment requires testnet validation before production.

---

## 1. Overview

### 1.1 Purpose

AIP-6 serves multiple critical functions in the AGIRAILS protocol:

1. **Trust Establishment** - New agents can bootstrap credibility through verifiable transaction history
2. **Provider Discovery** - Consumers can filter and rank providers by reputation metrics
3. **Risk Assessment** - Algorithmic scoring enables automated credit and pricing decisions
4. **Dispute Deterrence** - Reputation at stake incentivizes honest behavior
5. **Network Effects** - Portable reputation creates ecosystem-wide value accumulation

### 1.2 Lifecycle Position

Attestation anchoring occurs **AFTER** transaction settlement (SETTLED state):

```text
Transaction Lifecycle:
INITIATED → QUOTED → COMMITTED → IN_PROGRESS → DELIVERED → SETTLED
                                                               ↓
                                                    [AIP-6: ATTESTATION ANCHORING]
                                                               ↓
                                                    Reputation Updated
```

**Critical Timing Note** (per ACTPKernel.sol:270-278):
- `anchorAttestation()` can ONLY be called when `txn.state == State.SETTLED`
- Attestation UID is stored in AIP-4 delivery proof message (off-chain) during DELIVERED state
- On-chain anchoring happens post-settlement for **reputation purposes**, not payment validation
- This is intentional: attestation is for trust building, not transaction validation

**Workflow:**
```text
1. Provider delivers work → DELIVERED state
2. Consumer accepts delivery → SETTLED state
3. Escrow funds released to provider → releaseEscrow()
4. [OPTIONAL] Provider or Consumer calls anchorAttestation(txId, easUID)
5. Attestation UID anchored on-chain → AttestationAnchored event emitted
6. Indexer updates reputation score for provider's DID
7. Provider's reputation visible to all consumers
```

### 1.3 Relationship to Other AIPs

| AIP | Dependency | Interface |
|-----|------------|-----------|
| **AIP-0** | Identity (DIDs) | Reputation tied to DID addresses |
| **AIP-4** | Delivery Proof | EAS attestation created during delivery |
| **AIP-5** | Settlement | Attestation anchored only after SETTLED |
| **AIP-7** | Agent Registry | On-chain reputation storage via `AgentRegistry.updateReputationOnSettlement()` |

**Note on AIP-7 Integration:**

AIP-7 defines the **AgentRegistry** contract which stores reputation scores on-chain. The reputation scoring algorithm defined in this AIP (AIP-6 §3) is **implemented in AgentRegistry.sol** (see AIP-7 §3.4):

```solidity
// AgentRegistry._calculateReputationScore() implements AIP-6 formula:
// score = 0.7 × successRate + 0.3 × logVolume
```

ACTPKernel calls `registry.updateReputationOnSettlement()` atomically upon settlement, updating the provider's on-chain reputation profile.

---

## 2. Attestation Architecture

### 2.1 EAS Integration

**Ethereum Attestation Service (EAS)** provides the cryptographic foundation for AGIRAILS reputation:

- **Canonical EAS Contract**: `0x4200000000000000000000000000000000000021` (Base L2)
- **Immutable Attestations**: Created with `revocable: false`, `expirationTime: 0`
- **Schema-Based**: All AGIRAILS attestations use registered EAS schemas
- **DID-Linked**: Attester = provider DID, recipient = consumer DID

**EAS Attestation Lifecycle:**

```text
1. Provider delivers work (IN_PROGRESS → DELIVERED)
2. Provider creates EAS attestation:
   - Schema: AGIRAILS_DELIVERY_SCHEMA_UID
   - Data: {txId, resultCID, resultHash, deliveredAt}
   - Attester: provider's Ethereum address
   - Recipient: consumer's Ethereum address
   - Revocable: false (permanent)
   - Expiration: 0 (never expires)
3. EAS returns attestation UID (bytes32)
4. Provider includes attestation UID in AIP-4 delivery proof (off-chain)
5. Consumer verifies attestation via EAS.getAttestation()
6. Consumer accepts delivery → SETTLED
7. Provider/Consumer calls ACTPKernel.anchorAttestation(txId, easUID)
8. Attestation UID stored on-chain in transaction struct
9. AttestationAnchored event emitted → indexers update reputation
```

### 2.2 Attestation Types

AGIRAILS uses three EAS schemas for different attestation contexts:

#### 2.2.1 Delivery Attestation (Primary Reputation Signal)

**Schema UID**: `<PENDING - defined in AIP-4>`

**Schema Definition** (from AIP-4 §4.1):
```solidity
bytes32 txId,
string resultCID,
bytes32 resultHash,
uint256 deliveredAt
```

**Purpose**: Proves provider completed work and delivered result

**Created When**: Provider transitions to DELIVERED state (before SETTLED)

**Anchored When**: After SETTLED state (optional, for reputation)

**Example**:
```typescript
const attestation = await eas.getAttestation(easUID);
// attestation.schema === AGIRAILS_DELIVERY_SCHEMA_UID
// attestation.attester === providerAddress
// attestation.recipient === consumerAddress
// attestation.revoked === false
// Decoded data:
//   txId: "0x7d87..."
//   resultCID: "bafybei..."
//   resultHash: "0x3f8b..."
//   deliveredAt: 1700000000
```

#### 2.2.2 Settlement Attestation (Future Enhancement)

**Schema UID**: `<PENDING - to be deployed>`

**Schema Definition**:
```solidity
bytes32 txId,
State finalState,        // SETTLED, DISPUTED, CANCELLED
uint256 settledAt,
uint256 amountPaid,      // Actual amount released to provider
bytes32 resolutionProof  // If dispute occurred
```

**Purpose**: Records final transaction outcome and payment details

**Created When**: Transaction reaches terminal state (SETTLED/CANCELLED)

**Use Case**: Distinguish successful settlements from disputed/cancelled transactions in reputation scoring

#### 2.2.3 Dispute Resolution Attestation (Future Enhancement)

**Schema UID**: `<PENDING - to be deployed>`

**Schema Definition**:
```solidity
bytes32 txId,
address winner,           // Address who won the dispute
uint256 disputeReason,    // Enum: quality, deadline, terms, fraud
bytes32 evidenceHash,     // Hash of dispute evidence
address mediator,         // Who resolved the dispute
uint256 resolvedAt
```

**Purpose**: Tracks dispute history and resolution outcomes

**Impact on Reputation**:
- **Provider wins dispute**: No reputation penalty
- **Consumer wins dispute**: Provider reputation penalty (weighted by dispute reason)
- **Mediator involved**: Mediator earns reputation for fair resolutions

### 2.3 Attestation Anchoring (On-Chain)

**Smart Contract Interface** (ACTPKernel.sol:270-278):

```solidity
function anchorAttestation(bytes32 transactionId, bytes32 attestationUID) external override whenNotPaused {
    require(attestationUID != bytes32(0), "Attestation missing");
    Transaction storage txn = _getTransaction(transactionId);
    require(txn.state == State.SETTLED, "Only settled");
    require(msg.sender == txn.requester || msg.sender == txn.provider, "Not participant");

    txn.attestationUID = attestationUID;
    emit AttestationAnchored(transactionId, attestationUID, msg.sender, block.timestamp);
}
```

**Access Control**:
- **Who Can Call**: Transaction requester OR provider (either party)
- **When**: Only after transaction reaches SETTLED state
- **Validation**: Currently NO on-chain verification of attestation validity (⚠️ Security Gap - see §7.1)

**Event Emission**:
```solidity
event AttestationAnchored(
    bytes32 indexed transactionId,
    bytes32 indexed attestationUID,
    address indexed anchor,      // Who called anchorAttestation()
    uint256 timestamp
);
```

**Indexer Responsibilities**:
1. Listen for `AttestationAnchored` events
2. Fetch full attestation from EAS using `attestationUID`
3. Verify attestation is valid (correct schema, not revoked, matches transaction parties)
4. Update provider's reputation score in database
5. Update consumer's transaction history (for counterparty risk assessment)

---

## 3. Reputation Scoring Model

### 3.1 Core Metrics

AGIRAILS reputation is calculated from five weighted components:

#### 3.1.1 Success Rate (40% weight)

**Definition**: Percentage of transactions that reached SETTLED state without dispute

**Formula**:
```text
SuccessRate = (SettledCount / TotalCount) × 100
where:
  SettledCount = transactions in SETTLED state (no dispute)
  TotalCount = all transactions (SETTLED + DISPUTED + CANCELLED)
```

**Example**:
```text
Provider A:
  Settled: 95 transactions
  Disputed (lost): 3 transactions
  Cancelled: 2 transactions
  Total: 100 transactions
  Success Rate = (95 / 100) × 100 = 95%
```

**Impact**:
- 100% success = Full 40 points
- 95% success = 38 points
- 90% success = 36 points
- <80% success = Red flag (possible unreliable provider)

#### 3.1.2 Dispute Rate (30% weight)

**Definition**: Percentage of transactions that resulted in consumer-initiated disputes

**Formula**:
```text
DisputeRate = (DisputeCount / CompletedCount) × 100
where:
  DisputeCount = transactions that entered DISPUTED state
  CompletedCount = transactions that reached DELIVERED state
```

**Dispute Outcome Weighting**:
- **Provider wins dispute**: No penalty (consumer error)
- **Consumer wins dispute**: Full penalty (provider error)
- **Split resolution**: 50% penalty (shared responsibility)

**Adjusted Formula**:
```text
WeightedDisputeRate = Σ (disputeOutcome × weight)
where disputeOutcome ∈ {0, 0.5, 1.0}
```

**Example**:
```text
Provider B:
  Total delivered: 50 transactions
  Disputes raised: 5
  - Provider won: 2 disputes (0 penalty each = 0)
  - Split resolution: 1 dispute (0.5 penalty = 0.5)
  - Consumer won: 2 disputes (1.0 penalty each = 2.0)

  Weighted Dispute Count = 0 + 0.5 + 2.0 = 2.5
  Adjusted Dispute Rate = (2.5 / 50) × 100 = 5%

  Reputation Impact = 30 × (1 - 0.05) = 28.5 points (out of 30)
```

#### 3.1.3 Volume Score (15% weight)

**Definition**: Total transaction value processed (GMV) with logarithmic scaling

**Formula**:
```text
VolumeScore = min(15, log₁₀(totalGMV / 1000) × 3)
where:
  totalGMV = Σ(transaction.amount) for all SETTLED transactions
  Amounts in USDC (6 decimals)
```

**Logarithmic Scaling Rationale**:
- Prevents whales from dominating reputation
- Rewards volume growth at diminishing rate
- Encourages ecosystem participation at all scales

**Examples**:
```text
Provider C (Small):
  Total GMV: $1,000 USDC
  VolumeScore = log₁₀(1000 / 1000) × 3 = log₁₀(1) × 3 = 0 points

Provider D (Medium):
  Total GMV: $100,000 USDC
  VolumeScore = log₁₀(100,000 / 1000) × 3 = log₁₀(100) × 3 = 6 points

Provider E (Large):
  Total GMV: $10,000,000 USDC
  VolumeScore = log₁₀(10,000,000 / 1000) × 3 = log₁₀(10,000) × 3 = 12 points

Provider F (Whale):
  Total GMV: $1,000,000,000 USDC
  VolumeScore = log₁₀(1,000,000,000 / 1000) × 3 = log₁₀(1,000,000) × 3 = 18 points
  Capped at 15 points (prevents volume manipulation)
```

#### 3.1.4 Velocity Score (10% weight)

**Definition**: Average time from COMMITTED to DELIVERED, compared to deadline

**Formula**:
```text
VelocityScore = (1 - Σ ((deliveredAt - committedAt) / (deadline - committedAt)) / Count) × 10

where:
  deliveredAt - committedAt = Actual time taken to deliver
  deadline - committedAt = Maximum allowed time
  Ratio = 0.0 (instant) to 1.0 (at deadline) to >1.0 (late)
```

**Interpretation**:
- **Ratio = 0.0**: Instant delivery → Score = (1 - 0.0) × 10 = 10.0 points (maximum)
- **Ratio = 0.25**: Delivered at 25% of deadline → Score = (1 - 0.25) × 10 = 7.5 points (fast)
- **Ratio = 0.5**: Delivered at 50% of deadline → Score = (1 - 0.5) × 10 = 5.0 points (good)
- **Ratio = 1.0**: Delivered exactly at deadline → Score = (1 - 1.0) × 10 = 0.0 points (slow)
- **Ratio > 1.0**: Late delivery → Score = negative (penalized)

**Example**:
```text
Transaction 1:
  committedAt: 1700000000
  deadline: 1700003600 (1 hour = 3600s allowed)
  deliveredAt: 1700001800 (1800s elapsed = 30 minutes)
  Ratio = 1800 / 3600 = 0.5
  Score = (1 - 0.5) × 10 = 5.0 points

Transaction 2:
  committedAt: 1700000000
  deadline: 1700003600 (3600s allowed)
  deliveredAt: 1700000900 (900s elapsed = 15 minutes)
  Ratio = 900 / 3600 = 0.25
  Score = (1 - 0.25) × 10 = 7.5 points

Average Velocity Score = (5.0 + 7.5) / 2 = 6.25 points (out of 10)
```

#### 3.1.5 Recency Bias (5% weight)

**Definition**: Time decay factor favoring recent transactions

**Formula**:
```text
RecencyScore = 5 × (RecentCount / TotalCount)
where:
  RecentCount = transactions in last 30 days
  TotalCount = all transactions
```

**Rationale**:
- Agents improve over time (recent performance more predictive)
- Prevents stale reputation from inactive agents
- Encourages continuous participation

**Example**:
```text
Provider G:
  Total transactions: 200
  Transactions in last 30 days: 50
  RecencyScore = 5 × (50 / 200) = 5 × 0.25 = 1.25 points

Provider H (Active):
  Total transactions: 100
  Transactions in last 30 days: 60
  RecencyScore = 5 × (60 / 100) = 5 × 0.6 = 3.0 points
```

### 3.2 Composite Reputation Score

**Final Score Calculation**:
```text
ReputationScore = (SuccessRate × 0.40) +
                  (DisputeRate × 0.30) +
                  (VolumeScore × 0.15) +
                  (VelocityScore × 0.10) +
                  (RecencyScore × 0.05)

Scale: 0-100 points
```

**Score Interpretation**:

| Score Range | Rating | Meaning |
|-------------|--------|---------|
| 90-100 | Excellent | Proven track record, highly reliable |
| 75-89 | Good | Solid performance, minor issues |
| 60-74 | Fair | Average performance, some concerns |
| 40-59 | Poor | Multiple issues, high risk |
| 0-39 | Critical | Unreliable, avoid |

**Bootstrap Challenge**:
New agents have no transaction history → ReputationScore = 0 by default

**Solution** (see §3.3):
- Stake-based trust
- Identity verification
- Referral systems

### 3.3 Bootstrapping Reputation (New Agents)

**Challenge**: New agents cannot compete without transaction history

**AGIRAILS Bootstrap Mechanisms**:

#### 3.3.1 Economic Stake (Immediate Trust)

**Concept**: Agents post collateral to signal commitment

**Implementation**:
```solidity
// Future contract extension
function stakeForReputation(uint256 amount) external {
    require(amount >= MIN_STAKE, "Stake too low");
    stablecoin.transferFrom(msg.sender, address(this), amount);

    stakes[msg.sender] = StakeInfo({
        amount: amount,
        stakedAt: block.timestamp,
        slashedAmount: 0
    });

    emit ReputationStaked(msg.sender, amount);
}
```

**Reputation Boost**:
```text
StakeBoost = min(20, log₁₀(stakeAmount / 100) × 5)

Examples:
  $100 stake → 0 points
  $1,000 stake → 5 points
  $10,000 stake → 10 points
  $100,000 stake → 15 points
  $1,000,000 stake → 20 points (cap)
```

**Slashing Conditions**:
- Lost dispute → Slash 10% of stake
- Cancelled transaction (provider fault) → Slash 5% of stake
- Fraud detected → Slash 100% of stake + ban

#### 3.3.2 Identity Verification (Trust Signal)

**Concept**: Link on-chain DID to real-world identity

**Verification Levels**:

| Level | Verification | Reputation Boost | Requirements |
|-------|-------------|------------------|--------------|
| **0: Anonymous** | None | 0 points | DID only |
| **1: Email** | Verified email | +2 points | Email confirmation |
| **2: Phone** | Verified phone | +3 points | SMS verification |
| **3: KYC** | Government ID | +5 points | Passport/driver's license |
| **4: Business** | Entity verification | +10 points | Business registration docs |

**Privacy-Preserving KYC**:
- Zero-knowledge proofs (e.g., zk-SNARKs) to verify identity without revealing details
- Hash of identity documents stored on-chain (not plaintext)
- Verifier attestations via EAS (e.g., Coinbase Verification)

**Implementation**:
```typescript
// Provider completes KYC via Coinbase Verification
const kycAttestation = await eas.attest({
    schema: KYC_VERIFICATION_SCHEMA,
    data: {
        did: providerDID,
        verificationLevel: 3, // KYC
        verifiedAt: Date.now(),
        verifier: "did:ethr:coinbase"
    },
    recipient: providerAddress
});

// Reputation indexer grants +5 point boost
```

#### 3.3.3 Referral & Endorsements (Social Trust)

**Concept**: Established agents vouch for new agents

**Mechanism**:
```solidity
// Existing provider endorses new agent
function endorseAgent(address newAgent, string calldata endorsementText) external {
    require(reputation[msg.sender] >= MIN_ENDORSER_REPUTATION, "Insufficient reputation");
    require(endorsements[newAgent][msg.sender].createdAt == 0, "Already endorsed");

    endorsements[newAgent][msg.sender] = Endorsement({
        endorser: msg.sender,
        text: endorsementText,
        createdAt: block.timestamp,
        revoked: false
    });

    emit AgentEndorsed(newAgent, msg.sender, endorsementText);
}
```

**Reputation Boost**:
```text
EndorsementScore = Σ (endorserReputation / 20)
Cap: 15 points total

Example:
  Endorser A (reputation: 90) → +4.5 points
  Endorser B (reputation: 80) → +4.0 points
  Endorser C (reputation: 70) → +3.5 points
  Total: 12 points (capped at 15)
```

**Revocation**:
- Endorser can revoke if endorsed agent misbehaves
- Revocation triggers reputation recalculation
- Malicious endorsements detected → Endorser reputation penalty

---

## 4. SDK Integration

### 4.1 Reputation Query API

**Client Initialization**:
```typescript
import { ACTPClient } from '@agirails/sdk';

const client = await ACTPClient.create({
    network: 'base-sepolia',
    privateKey: process.env.PRIVATE_KEY
});
```

#### 4.1.1 Get Agent Reputation Score

```typescript
const reputation = await client.reputation.getScore(agentAddress);

console.log(reputation);
// {
//   address: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
//   did: "did:ethr:84532:0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
//   score: 87.5,
//   rating: "Good",
//   components: {
//     successRate: 38.0,    // 95% success × 40% weight
//     disputeRate: 28.5,    // 5% dispute × 30% weight
//     volumeScore: 12.0,
//     velocityScore: 7.5,
//     recencyScore: 1.5
//   },
//   metrics: {
//     totalTransactions: 100,
//     settledTransactions: 95,
//     disputedTransactions: 3,
//     cancelledTransactions: 2,
//     totalGMV: "10000000000000",  // $10M USDC (6 decimals)
//     averageDeliveryTime: 1800,   // 30 minutes
//     firstTransactionAt: 1690000000,
//     lastTransactionAt: 1732000000
//   },
//   badges: ["Verified KYC", "10K+ GMV", "Fast Delivery"],
//   lastUpdated: 1732000500
// }
```

#### 4.1.2 Get Transaction History

```typescript
const history = await client.reputation.getTransactionHistory(agentAddress, {
    limit: 20,
    offset: 0,
    state: 'SETTLED',  // Filter by state
    minAmount: parseUnits('100', 6),  // Minimum $100 USDC
    startDate: 1700000000,
    endDate: 1732000000
});

console.log(history);
// {
//   transactions: [
//     {
//       txId: "0x7d87...",
//       requester: "did:ethr:0x1234...",
//       provider: "did:ethr:0x742d...",
//       amount: "5000000",  // $5 USDC
//       state: "SETTLED",
//       serviceType: "text-generation",
//       createdAt: 1731700000,
//       settledAt: 1731702000,
//       attestationUID: "0xa1b2..."
//     },
//     // ... more transactions
//   ],
//   pagination: {
//     total: 100,
//     limit: 20,
//     offset: 0,
//     hasMore: true
//   }
// }
```

#### 4.1.3 Verify Attestation Authenticity

```typescript
const isValid = await client.reputation.verifyAttestation(attestationUID);

console.log(isValid);
// {
//   valid: true,
//   attestation: {
//     uid: "0xa1b2c3...",
//     schema: "0x425ced...",  // AGIRAILS_DELIVERY_SCHEMA_UID
//     attester: "0x742d35...",
//     recipient: "0x1234567...",
//     revoked: false,
//     expirationTime: 0,
//     data: {
//       txId: "0x7d87...",
//       resultCID: "bafybei...",
//       resultHash: "0x3f8b...",
//       deliveredAt: 1700000000
//     }
//   },
//   matchesOnChainRecord: true,
//   transactionDetails: {
//     state: "SETTLED",
//     amount: "5000000"
//   }
// }
```

#### 4.1.4 Anchor Attestation (Post-Settlement)

```typescript
// After transaction reaches SETTLED state
const txId = "0x7d87...";
const attestationUID = "0xa1b2c3...";

// Either requester or provider can anchor
await client.kernel.anchorAttestation(txId, attestationUID);

console.log(`Attestation anchored for transaction ${txId}`);
// Event emitted: AttestationAnchored(txId, attestationUID, msg.sender, timestamp)
```

### 4.2 Provider Discovery with Reputation Filtering

```typescript
// Find top-rated providers for a service type
const providers = await client.reputation.findProviders({
    serviceType: 'text-generation',
    minReputation: 75,
    minTransactions: 10,
    maxDisputeRate: 5,  // Max 5% dispute rate
    sortBy: 'reputation',  // or 'volume', 'velocity'
    limit: 10
});

console.log(providers);
// [
//   {
//     address: "0x742d35...",
//     did: "did:ethr:0x742d35...",
//     reputation: 87.5,
//     rating: "Good",
//     totalTransactions: 100,
//     successRate: 95,
//     disputeRate: 3,
//     averagePrice: "5000000",  // $5 USDC
//     averageDeliveryTime: 1800
//   },
//   // ... more providers
// ]
```

### 4.3 Reputation Badge System (Future)

**Concept**: Visual trust signals for milestone achievements

**Badge Types**:

| Badge | Criteria | Icon |
|-------|----------|------|
| **Verified** | KYC Level 3+ | ✓ |
| **Trusted** | Reputation ≥ 90 | ⭐ |
| **Volume Pro** | GMV ≥ $100K | 💎 |
| **Speed Demon** | Avg delivery ≤ 10% of deadline | ⚡ |
| **Dispute-Free** | 0% dispute rate, 50+ transactions | 🛡️ |
| **OG Provider** | First 100 agents on platform | 🏆 |

**SDK Implementation**:
```typescript
const badges = await client.reputation.getBadges(agentAddress);
// ['Verified', 'Volume Pro', 'Speed Demon']
```

---

## 5. EAS Schema Definition

### 5.1 Delivery Attestation Schema (Primary)

**Schema UID**: `<PENDING - deploy to Base Sepolia EAS>`

**Schema String** (from AIP-4 §4.1):
```solidity
bytes32 txId,
string resultCID,
bytes32 resultHash,
uint256 deliveredAt
```

**Deployment Script**:
```typescript
import { EAS, SchemaRegistry } from '@ethereum-attestation-service/eas-sdk';

const schemaRegistry = new SchemaRegistry(SCHEMA_REGISTRY_ADDRESS);
schemaRegistry.connect(deployerSigner);

const schema = "bytes32 txId,string resultCID,bytes32 resultHash,uint256 deliveredAt";
const resolverAddress = ethers.constants.AddressZero;  // No custom resolver
const revocable = false;  // Attestations are permanent

const tx = await schemaRegistry.register({
    schema,
    resolverAddress,
    revocable
});

const schemaUID = await tx.wait();
console.log('Delivery Schema UID:', schemaUID);
// Store this UID in SDK config: AGIRAILS_DELIVERY_SCHEMA_UID
```

### 5.2 Settlement Attestation Schema (Future)

**Schema String**:
```solidity
bytes32 txId,
uint8 finalState,
uint256 settledAt,
uint256 amountPaid,
bytes32 resolutionProof
```

**Field Mapping**:
- `finalState`: Enum {5: SETTLED, 6: DISPUTED, 7: CANCELLED}
- `amountPaid`: Actual USDC amount released to provider (after fees)
- `resolutionProof`: IPFS hash of dispute resolution details (if applicable)

### 5.3 Dispute Resolution Attestation Schema (Future)

**Schema String**:
```solidity
bytes32 txId,
address winner,
uint8 disputeReason,
bytes32 evidenceHash,
address mediator,
uint256 resolvedAt
```

**Dispute Reason Enum**:
```text
0: QUALITY_ISSUE      // Delivered work didn't meet requirements
1: DEADLINE_MISSED    // Provider missed deadline
2: TERMS_VIOLATION    // Provider violated agreed terms
3: FRAUD_DETECTED     // Malicious behavior (fake delivery, etc.)
4: CONSUMER_ERROR     // Consumer raised invalid dispute
```

---

## 5.4 Reputation Indexer Architecture

The reputation system requires an **off-chain indexer service** that listens to blockchain events, validates attestations, computes reputation scores, and exposes a queryable API.

### 5.4.1 Database Schema

**PostgreSQL Schema** (recommended for ACID guarantees):

```sql
-- Agents table: stores reputation scores
CREATE TABLE agents (
    address VARCHAR(42) PRIMARY KEY,
    did VARCHAR(100) UNIQUE NOT NULL,
    reputation_score DECIMAL(5,2) NOT NULL DEFAULT 0,
    success_rate_score DECIMAL(5,2),
    dispute_rate_score DECIMAL(5,2),
    volume_score DECIMAL(5,2),
    velocity_score DECIMAL(5,2),
    recency_score DECIMAL(5,2),
    total_transactions INT DEFAULT 0,
    settled_transactions INT DEFAULT 0,
    disputed_transactions INT DEFAULT 0,
    cancelled_transactions INT DEFAULT 0,
    total_gmv BIGINT DEFAULT 0,
    first_transaction_at TIMESTAMP,
    last_transaction_at TIMESTAMP,
    last_updated TIMESTAMP DEFAULT NOW()
);

-- Transactions table: stores transaction history
CREATE TABLE transactions (
    tx_id VARCHAR(66) PRIMARY KEY,
    provider_address VARCHAR(42) NOT NULL,
    requester_address VARCHAR(42) NOT NULL,
    state VARCHAR(20) NOT NULL,
    amount BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL,
    committed_at TIMESTAMP,
    delivered_at TIMESTAMP,
    settled_at TIMESTAMP,
    deadline BIGINT,
    attestation_uid VARCHAR(66),
    dispute_outcome VARCHAR(20),
    FOREIGN KEY (provider_address) REFERENCES agents(address)
);

-- Attestations table: stores validated EAS attestations
CREATE TABLE attestations (
    uid VARCHAR(66) PRIMARY KEY,
    tx_id VARCHAR(66) NOT NULL,
    schema_uid VARCHAR(66) NOT NULL,
    attester VARCHAR(42) NOT NULL,
    recipient VARCHAR(42) NOT NULL,
    created_at TIMESTAMP NOT NULL,
    result_cid TEXT,
    result_hash VARCHAR(66),
    validated BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (tx_id) REFERENCES transactions(tx_id)
);

-- Indexes for performance
CREATE INDEX idx_agent_reputation ON agents(reputation_score DESC);
CREATE INDEX idx_provider_txs ON transactions(provider_address, settled_at DESC);
CREATE INDEX idx_tx_state ON transactions(state, created_at);
CREATE INDEX idx_attestation_validation ON attestations(validated, created_at);
```

### 5.4.2 Event Processing Pipeline

**Event Listener Architecture**:

```typescript
interface EventProcessor {
  // Listen to ACTPKernel events
  onAttestationAnchored(event: AttestationAnchoredEvent): Promise<void>;
  onStateTransitioned(event: StateTransitionedEvent): Promise<void>;
  onTransactionCreated(event: TransactionCreatedEvent): Promise<void>;

  // Blockchain reorg handling
  onReorg(fromBlock: number, toBlock: number): Promise<void>;
}

class ReputationIndexer implements EventProcessor {
  async onAttestationAnchored(event: AttestationAnchoredEvent) {
    const { transactionId, attestationUID, anchor } = event;

    // Step 1: Fetch attestation from EAS
    const attestation = await easContract.getAttestation(attestationUID);

    // Step 2: Validate attestation (7 checks from §6.4)
    const isValid = await this.validateAttestation(attestation, transactionId);
    if (!isValid) {
      logger.warn(`Invalid attestation ${attestationUID} for tx ${transactionId}`);
      return;
    }

    // Step 3: Store in database
    await db.attestations.insert({
      uid: attestationUID,
      tx_id: transactionId,
      schema_uid: attestation.schema,
      attester: attestation.attester,
      recipient: attestation.recipient,
      created_at: new Date(attestation.time * 1000),
      validated: true
    });

    // Step 4: Update transaction record
    await db.transactions.update(transactionId, { attestation_uid: attestationUID });

    // Step 5: Trigger reputation recalculation
    const tx = await db.transactions.findById(transactionId);
    await this.recalculateReputation(tx.provider_address);
  }

  async validateAttestation(attestation: Attestation, txId: string): Promise<boolean> {
    // Implement 7 validation checks from §6.4:
    // 1. Attestation exists
    // 2. Correct schema
    // 3. Attester is transaction provider
    // 4. Recipient is transaction requester
    // 5. Not revoked
    // 6. Data contains matching txId
    // 7. Created within reasonable timeframe
    return true; // Simplified
  }

  async recalculateReputation(providerAddress: string) {
    const txs = await db.transactions.findByProvider(providerAddress);

    // Calculate components per §3.1
    const successRate = this.calculateSuccessRate(txs);
    const disputeRate = this.calculateDisputeRate(txs);
    const volumeScore = this.calculateVolumeScore(txs);
    const velocityScore = this.calculateVelocityScore(txs);
    const recencyScore = this.calculateRecencyScore(txs);

    // Composite score
    const reputationScore =
      successRate * 0.40 +
      disputeRate * 0.30 +
      volumeScore * 0.15 +
      velocityScore * 0.10 +
      recencyScore * 0.05;

    // Update database
    await db.agents.update(providerAddress, {
      reputation_score: reputationScore,
      success_rate_score: successRate,
      dispute_rate_score: disputeRate,
      volume_score: volumeScore,
      velocity_score: velocityScore,
      recency_score: recencyScore,
      last_updated: new Date()
    });
  }
}
```

**Reorg Handling**:
```typescript
async onReorg(fromBlock: number, toBlock: number) {
  // Delete events from orphaned blocks
  await db.transactions.deleteWhere({ block_number: { $gte: fromBlock } });
  await db.attestations.deleteWhere({ block_number: { $gte: fromBlock } });

  // Re-fetch canonical chain events
  const events = await kernelContract.queryFilter('*', fromBlock, toBlock);
  for (const event of events) {
    await this.processEvent(event);
  }
}
```

**Block Confirmation Strategy**: Wait for 12 block confirmations before marking data as "final" to minimize reorg impact.

### 5.4.3 REST API Specification

**Endpoints**:

```typescript
// Get reputation score for agent
GET /api/v1/reputation/:address
Response: ReputationScore

// Find providers by criteria
GET /api/v1/providers?serviceType=text-generation&minReputation=75&limit=10
Response: Provider[]

// Get transaction history for agent
GET /api/v1/transactions/:address?limit=20&offset=0
Response: Transaction[]

// Get attestation details
GET /api/v1/attestation/:uid
Response: Attestation

// Health check
GET /api/v1/health
Response: { status: "ok", lastBlock: 12345678 }
```

**Rate Limiting**: 100 requests/minute per IP

**Caching Strategy**:
- Reputation scores: TTL 1 hour (Redis cache)
- Transaction history: TTL 5 minutes
- Attestation details: TTL 24 hours (immutable)

### 5.4.4 Performance Requirements

**Target Metrics**:
- Event processing latency: < 5 seconds (from block mined to DB updated)
- API response time: < 200ms (p95)
- Throughput: 1000+ events/minute
- Concurrent users: 10,000+

**Scalability Plan**:
- Horizontal scaling: Run multiple indexer instances with leader election
- Database read replicas: Separate read/write databases
- Cache layer: Redis for hot reputation data

---

## 6. Security Considerations

### 6.1 Sybil Resistance

**Attack Vector**: Malicious actor creates multiple fake identities to inflate reputation

**Mitigations**:

#### 6.1.1 Economic Barriers

**Minimum Transaction Amount**: $0.05 USDC per transaction (MIN_TRANSACTION_AMOUNT)
- Cost to create fake reputation: 100 transactions × $0.05 = $5.00
- Plus gas costs: 100 × $0.15 = $15.00
- Total: $20.00 for 100-transaction fake reputation
- Makes large-scale Sybil attacks economically unfeasible

**Platform Fee**: 1% of transaction amount
- Additional cost: 100 transactions × $0.05 × 1% = $0.05 (negligible)
- Real cost is opportunity cost (locked escrow funds during transaction lifecycle)

#### 6.1.2 Stake-Based Trust

**Reputation Staking** (see §3.3.1):
- Agents post collateral to signal commitment
- Slashed upon misbehavior (dispute loss, fraud)
- Sybil attacker must stake for each fake identity → Prohibitively expensive

**Example**:
```text
Create 10 fake identities:
  10 × $1,000 stake = $10,000 locked capital

Risk:
  Single fraud detection → 100% stake slashed = $10,000 loss

Reward:
  Fraudulent transaction: $100 stolen

Economics: $10,000 risk for $100 reward = Irrational
```

#### 6.1.3 Social Graph Analysis

**Network Topology Detection**:
- Analyze transaction patterns between agents
- Flag suspicious clusters (e.g., circular transactions between new accounts)
- Weight reputation by counterparty diversity

**Implementation** (off-chain indexer):
```typescript
// Detect Sybil cluster
function detectSybilCluster(agentAddress: string): boolean {
    const counterparties = getTransactionCounterparties(agentAddress);
    const uniqueCounterparties = new Set(counterparties);

    // Red flag: 80%+ transactions with same counterparties
    if (uniqueCounterparties.size / counterparties.length < 0.2) {
        return true;  // Likely Sybil cluster
    }

    // Check for circular transaction patterns
    const circularPatterns = detectCircularTransactions(agentAddress);
    if (circularPatterns.length > 3) {
        return true;  // Reputation washing detected
    }

    return false;
}
```

#### 6.1.4 Time-Based Trust Decay

**Reputation Decay for Inactive Agents**:
```text
DecayFactor = 1 - (daysSinceLastTransaction / 365)
AdjustedReputation = BaseReputation × DecayFactor

Examples:
  30 days inactive: 100 × (1 - 30/365) = 91.8
  90 days inactive: 100 × (1 - 90/365) = 75.3
  180 days inactive: 100 × (1 - 180/365) = 50.7
  365 days inactive: 100 × (1 - 365/365) = 0
```

**Rationale**: Prevents stale reputation from inactive Sybil accounts

### 6.2 Privacy & Data Minimization

**Public Reputation Metrics** (visible to all):
- Total transaction count
- Success rate
- Dispute rate
- Volume score (aggregated GMV, not individual amounts)
- Velocity score (average, not per-transaction)
- Reputation score (0-100)
- Badges earned

**Private Transaction Details** (hidden by default):
- Consumer/provider identities (only DID addresses visible)
- Specific transaction amounts (unless consumer opts in)
- Service type and input data (stored off-chain, only hash on-chain)
- Dispute evidence (IPFS hash, content requires access key)

**Optional Transparency**:
```typescript
// Consumer can opt-in to public transaction details
await client.reputation.setPrivacySettings({
    publicTransactionHistory: true,  // Default: false
    publicAmounts: true,             // Default: false
    publicServiceTypes: true         // Default: false
});
```

**Zero-Knowledge Proofs (Future)**:
- Prove reputation range without revealing exact score
- Example: "Reputation ≥ 75" without disclosing it's 87.5
- Use zk-SNARKs to verify attestations without revealing transaction details

### 6.3 Reputation Washing Prevention

**Attack Vector**: Agent with poor reputation creates new identity to reset score

**Mitigations**:

#### 6.3.1 DID Continuity Tracking

**Ethereum Address Linkage**:
- DIDs are tied to Ethereum addresses (did:ethr:0x...)
- Changing DID requires new Ethereum address
- New address = New reputation (starts at 0)

**Economic Disincentive**:
- Building reputation to 75+ requires 50+ successful transactions
- Estimated time: 30-60 days of consistent work
- Cost to rebuild: ~$500-1000 in transaction fees + opportunity cost
- Easier to improve existing reputation than start over

#### 6.3.2 Behavioral Fingerprinting (Future)

**Pattern Analysis**:
- Service type specialization (e.g., always provides OCR services)
- Transaction timing patterns (e.g., always delivers at 50% of deadline)
- Pricing patterns (e.g., always quotes $5.00 for text-generation)
- IP address / device fingerprinting (optional, privacy trade-off)

**Machine Learning Detection**:
```python
# Pseudo-code for reputation washing detection
def detect_reputation_washing(new_agent_id, historical_agents):
    new_agent_patterns = extract_behavioral_patterns(new_agent_id)

    for old_agent in historical_agents:
        if old_agent.reputation < 60 and old_agent.last_active < 30_days_ago:
            old_agent_patterns = extract_behavioral_patterns(old_agent)
            similarity = cosine_similarity(new_agent_patterns, old_agent_patterns)

            if similarity > 0.85:  # High behavioral similarity
                flag_as_potential_wash(new_agent_id, old_agent)
                apply_reputation_penalty(new_agent_id, -20)  # Start at -20 instead of 0
```

### 6.4 Attestation Manipulation

> **⚠️ CRITICAL SECURITY GAP (Contract V1)**
>
> The current ACTPKernel.sol V1 implementation **DOES NOT validate EAS attestations on-chain**. The `anchorAttestation()` function accepts any bytes32 UID without verifying:
> - Attestation exists on EAS
> - Attestation has correct schema
> - Attestation was created by transaction provider
> - Attestation recipient matches transaction requester
>
> **Mitigation (V1)**: Consumers MUST verify attestations OFF-CHAIN via SDK before trusting reputation scores.
>
> **Fix (V2)**: Full on-chain validation will be implemented in ACTPKernel V2 (see recommended implementation below).

**Current Security Gap** (⚠️ Critical - from AIP-4 §7.4):

ACTPKernel.sol does NOT validate attestations on-chain:
```solidity
function anchorAttestation(bytes32 transactionId, bytes32 attestationUID) external override whenNotPaused {
    require(attestationUID != bytes32(0), "Attestation missing");
    Transaction storage txn = _getTransaction(transactionId);
    require(txn.state == State.SETTLED, "Only settled");
    require(msg.sender == txn.requester || msg.sender == txn.provider, "Not participant");

    txn.attestationUID = attestationUID;  // ⚠️ NO VALIDATION!
    emit AttestationAnchored(transactionId, attestationUID, msg.sender, block.timestamp);
}
```

**Attack Scenario**:
1. Malicious provider completes transaction → SETTLED
2. Provider calls `anchorAttestation(txId, FAKE_BYTES32)`
3. Contract accepts any bytes32 value without checking EAS
4. Fake attestation UID anchored on-chain

**Current Mitigation** (V1):
- **Off-chain validation required**: Consumers/indexers MUST verify attestations via EAS before trusting reputation
- **Reputation indexer verifies** before updating score:
  ```typescript
  // Indexer verification (off-chain)
  async function handleAttestationAnchored(event: AttestationAnchoredEvent) {
      const { transactionId, attestationUID } = event.args;

      // Verify attestation exists on EAS
      const attestation = await eas.getAttestation(attestationUID);
      if (attestation.uid === ZERO_BYTES32) {
          console.error(`Fake attestation detected: ${attestationUID}`);
          return;  // Do not update reputation
      }

      // Verify schema, attester, recipient
      const txDetails = await kernel.getTransaction(transactionId);
      if (attestation.schema !== AGIRAILS_DELIVERY_SCHEMA_UID ||
          attestation.attester !== txDetails.provider ||
          attestation.recipient !== txDetails.requester) {
          console.error(`Invalid attestation: ${attestationUID}`);
          return;
      }

      // Valid attestation → Update reputation
      await updateProviderReputation(txDetails.provider, attestationUID);
  }
  ```

**Future Mitigation** (V2 - Recommended Fix):
```solidity
interface IEAS {
    struct Attestation {
        bytes32 uid;
        bytes32 schema;
        uint64 time;
        uint64 expirationTime;
        uint64 revocationTime;
        address attester;
        address recipient;
        bool revocable;
        bytes data;
    }

    function getAttestation(bytes32 uid) external view returns (Attestation memory);
}

// Add EAS contract reference
IEAS public easContract;

function anchorAttestation(bytes32 transactionId, bytes32 attestationUID) external override whenNotPaused {
    require(attestationUID != bytes32(0), "Attestation missing");
    Transaction storage txn = _getTransaction(transactionId);
    require(txn.state == State.SETTLED, "Only settled");
    require(msg.sender == txn.requester || msg.sender == txn.provider, "Not participant");

    // ✅ ADD: Verify attestation on-chain
    IEAS.Attestation memory attestation = easContract.getAttestation(attestationUID);
    require(attestation.uid != bytes32(0), "Attestation does not exist");
    require(attestation.schema == AGIRAILS_DELIVERY_SCHEMA_UID, "Wrong schema");
    require(attestation.attester == txn.provider, "Wrong attester");
    require(attestation.recipient == txn.requester, "Wrong recipient");
    require(attestation.revocationTime == 0, "Attestation revoked");

    // Decode and verify txId matches
    (bytes32 attestedTxId,,,) = abi.decode(attestation.data, (bytes32, string, bytes32, uint256));
    require(attestedTxId == transactionId, "TxId mismatch");

    txn.attestationUID = attestationUID;
    emit AttestationAnchored(transactionId, attestationUID, msg.sender, block.timestamp);
}
```

**Status**:
- ❌ V1 (Current): NO on-chain validation → Consumers/indexers MUST verify off-chain
- 📋 V2 (Planned): Full on-chain validation → Trust minimized

---

## 7. Edge Cases & Failure Modes

### 7.1 Attestation Anchoring Failure

**Scenario**: Transaction settles, but attestation anchoring fails (gas, network issues)

**Impact**: Provider reputation not updated on-chain

**Mitigation**:
1. **Retry Mechanism** (SDK):
   ```typescript
   async function anchorAttestationWithRetry(txId, attestationUID, maxRetries = 3) {
       for (let i = 0; i < maxRetries; i++) {
           try {
               await client.kernel.anchorAttestation(txId, attestationUID);
               return;  // Success
           } catch (error) {
               console.error(`Attestation anchoring failed (attempt ${i+1}):`, error);
               await sleep(5000);  // Wait 5 seconds before retry
           }
       }
       throw new Error(`Failed to anchor attestation after ${maxRetries} attempts`);
   }
   ```

2. **Off-chain Fallback** (Indexer):
   - If `AttestationAnchored` event not detected within 24 hours of settlement
   - Indexer queries EAS directly for attestation UID from AIP-4 delivery proof
   - Updates reputation score based on EAS attestation (even without on-chain anchor)
   - Marks as "unanchored" (minor reputation penalty: -2 points)

### 7.2 Transaction Settled Without Attestation

**Scenario**: Consumer immediately settles transaction without verifying delivery proof

**Impact**: No EAS attestation created, cannot calculate reputation

**Detection**:
```typescript
// Indexer checks for missing attestations
async function detectMissingAttestations() {
    const settledTransactions = await getSettledTransactions({ last: '7 days' });

    for (const tx of settledTransactions) {
        if (tx.attestationUID === ZERO_BYTES32) {
            // No attestation anchored
            const deliveryProof = await ipfs.get(tx.deliveryProofCID);

            if (deliveryProof.easAttestationUID) {
                // Attestation exists but not anchored → Prompt provider to anchor
                notifyProvider(tx.provider, `Anchor attestation for ${tx.txId}`);
            } else {
                // No attestation created → Transaction does not count toward reputation
                console.warn(`Transaction ${tx.txId} settled without attestation`);
            }
        }
    }
}
```

**Reputation Impact**: Transaction excluded from reputation calculation (not counted in total)

### 7.3 Dispute Resolution Changes Attestation

**Scenario**: Delivery attestation created, then consumer disputes and wins

**Current Behavior**: Delivery attestation remains immutable (EAS attestations cannot be modified)

**Resolution**:
1. **Dispute Resolution Attestation** created (separate schema, see §5.3)
2. **Reputation Calculation** considers both attestations:
   - Delivery attestation proves work was submitted
   - Dispute attestation proves work was rejected
   - Net impact: Negative reputation (dispute loss)

**Example**:
```text
Transaction 1234:
  Delivery Attestation:
    - UID: 0xabc...
    - Delivered: 2025-11-18 10:00 AM
    - Result: bafybei...

  Dispute Resolution Attestation:
    - UID: 0xdef...
    - Winner: Consumer
    - Reason: QUALITY_ISSUE
    - Resolved: 2025-11-18 2:00 PM

Reputation Impact:
  - Transaction counted in total (denominator)
  - NOT counted in successful transactions (numerator)
  - Weighted dispute penalty applied
  - Final: Success Rate decreased, Dispute Rate increased
```

### 7.4 Agent Address Changes (Key Rotation)

**Scenario**: Agent rotates private keys, creates new DID

**Problem**: Old reputation tied to old DID address

**Solutions**:

#### Option 1: Migration Attestation (Manual)
```solidity
// Future schema: Agent Migration
schema = "address oldAddress,address newAddress,uint256 migratedAt,bytes signature"

// Old agent creates attestation proving ownership of new address
const migrationAttestation = await eas.attest({
    schema: AGENT_MIGRATION_SCHEMA,
    data: {
        oldAddress: oldAgentAddress,
        newAddress: newAgentAddress,
        migratedAt: Date.now(),
        signature: signedProofOfOwnership  // Signed by old key
    },
    attester: oldAgentAddress,
    recipient: newAgentAddress
});
```

**Reputation Indexer**:
- Detects migration attestation
- Merges reputation from old → new address
- Marks old address as "migrated" (no longer active)

#### Option 2: Smart Account Abstraction (Preferred)
```text
Use ERC-4337 Account Abstraction:
  - Agent identity tied to smart contract wallet, not EOA
  - Private keys can be rotated without changing DID
  - Reputation remains tied to smart account address

Example:
  DID: did:ethr:0x1234... (smart account)
  Signing Keys: key1, key2, key3 (rotatable)

  Key rotation:
    1. Remove compromised key
    2. Add new key
    3. DID address unchanged → Reputation preserved
```

---

## 8. Backwards Compatibility

### 8.1 Schema Versioning

**Challenge**: EAS schemas are immutable once deployed

**Solution**: Version suffix in schema UIDs

**Example**:
```text
AGIRAILS_DELIVERY_SCHEMA_UID_V1 = 0x425ced...  (current)
AGIRAILS_DELIVERY_SCHEMA_UID_V2 = 0x5f3a9d...  (future upgrade)

// Reputation indexer supports both versions
const SUPPORTED_SCHEMAS = [
    AGIRAILS_DELIVERY_SCHEMA_UID_V1,
    AGIRAILS_DELIVERY_SCHEMA_UID_V2
];

function isValidDeliveryAttestation(attestation) {
    return SUPPORTED_SCHEMAS.includes(attestation.schema);
}
```

**Migration Path**:
1. Deploy new schema (V2) to EAS
2. Update SDK to support both V1 and V2 schemas
3. Indexer recognizes both versions for reputation calculation
4. New transactions use V2, old transactions remain V1
5. After 6 months, deprecate V1 (stop indexing new V1 attestations)

### 8.2 Reputation Score Formula Changes

**Challenge**: Changing reputation weights retroactively affects all agents

**Solution**: Versioned reputation algorithms

**Implementation**:
```typescript
interface ReputationAlgorithm {
    version: string;
    calculateScore(metrics: AgentMetrics): number;
}

const ALGORITHM_V1: ReputationAlgorithm = {
    version: '1.0.0',
    calculateScore(metrics) {
        return (
            metrics.successRate * 0.40 +
            (1 - metrics.disputeRate) * 0.30 +
            metrics.volumeScore * 0.15 +
            metrics.velocityScore * 0.10 +
            metrics.recencyScore * 0.05
        );
    }
};

const ALGORITHM_V2: ReputationAlgorithm = {
    version: '2.0.0',
    calculateScore(metrics) {
        // Updated weights (example)
        return (
            metrics.successRate * 0.35 +
            (1 - metrics.disputeRate) * 0.35 +
            metrics.volumeScore * 0.10 +
            metrics.velocityScore * 0.15 +
            metrics.recencyScore * 0.05
        );
    }
};

// Indexer allows querying by algorithm version
const reputationV1 = await client.reputation.getScore(agentAddress, { algorithm: '1.0.0' });
const reputationV2 = await client.reputation.getScore(agentAddress, { algorithm: '2.0.0' });
```

**Rollout Strategy**:
1. Announce algorithm change with 30-day notice
2. Run both V1 and V2 in parallel during transition
3. Display both scores to users: "Score: 87.5 (V1) / 85.2 (V2)"
4. After 30 days, make V2 the default (V1 still queryable)
5. After 90 days, deprecate V1 API

---

## 9. Test Cases

### 9.1 Reputation Calculation Tests

**Test Vector 1: New Agent (No History)**
```typescript
Input:
  totalTransactions: 0
  settledTransactions: 0
  disputedTransactions: 0
  totalGMV: 0

Expected Output:
  ReputationScore: 0
  Rating: "No History"
  Bootstrap Options: [Stake, KYC, Referral]
```

**Test Vector 2: Perfect Agent**
```typescript
Input:
  totalTransactions: 100
  settledTransactions: 100
  disputedTransactions: 0
  cancelledTransactions: 0
  totalGMV: 10,000,000,000,000 (10M USDC)
  averageDeliveryTime: 900 (15 min avg, deadline 3600)
  recentTransactions: 60 (last 30 days)

Expected Output:
  successRate: 40.0  (100%)
  disputeRate: 30.0  (0%)
  volumeScore: 12.0  (log₁₀(10,000) × 3)
  velocityScore: 7.5  ((1 - 900/3600) × 10 = (1 - 0.25) × 10 = 7.5)
  recencyScore: 3.0  (60/100 × 5)

  ReputationScore: 92.5
  Rating: "Excellent"
```

**Test Vector 3: Mixed Performance**
```typescript
Input:
  totalTransactions: 50
  settledTransactions: 45
  disputedTransactions: 3 (consumer won 2, provider won 1)
  cancelledTransactions: 2
  totalGMV: 1,000,000,000 (1M USDC)
  averageDeliveryTime: 1800 (50% of deadline)
  recentTransactions: 10 (last 30 days)

Calculation:
  successRate: (45 / 50) × 40 = 36.0

  Weighted Dispute Count:
    - Provider won: 1 × 0 = 0
    - Consumer won: 2 × 1.0 = 2.0
    - Total weighted disputes: 2.0
  Completed Transactions: 45 + 3 = 48
  Adjusted Dispute Rate: (2.0 / 48) × 100 = 4.17%
  Reputation Impact: 30 × (1 - 0.0417) = 28.75

  volumeScore: log₁₀(1000) × 3 = 9.0
  velocityScore: (1 - 1800/3600) × 10 = (1 - 0.5) × 10 = 5.0
  recencyScore: (10/50) × 5 = 1.0

Expected Output:
  ReputationScore: 36.0 + 28.75 + 9.0 + 5.0 + 1.0 = 79.75
  Rating: "Good"
```

### 9.2 Sybil Attack Detection Tests

**Test Scenario 1: Circular Transactions**
```typescript
// Agent A and B repeatedly transact with each other
const agentA = "0x1111...";
const agentB = "0x2222...";

Transactions:
  A → B: $5 (SETTLED)
  B → A: $5 (SETTLED)
  A → B: $5 (SETTLED)
  B → A: $5 (SETTLED)
  ... (20 cycles)

Expected Detection:
  detectSybilCluster(agentA) === true
  Reason: "80% transactions with single counterparty"
  Action: Flag both accounts, apply reputation penalty (-50%)
```

**Test Scenario 2: Mass Account Creation**
```typescript
// 10 new accounts created in 1 hour, all transacting with each other
const newAccounts = [
    "0xaaaa...", "0xbbbb...", "0xcccc...", "0xdddd...", "0xeeee...",
    "0xffff...", "0x1111...", "0x2222...", "0x3333...", "0x4444..."
];

All accounts:
  - Created: 2025-11-18 10:00-11:00 AM
  - Transactions: Only with other accounts in this list
  - No KYC verification
  - No stake

Expected Detection:
  detectSybilNetwork(newAccounts) === true
  Reason: "Cluster of new accounts with internal-only transactions"
  Action: Require KYC or stake before reputation counts
```

### 9.3 Attestation Verification Tests

**Test Case 1: Valid Attestation**
```typescript
const attestationUID = "0xa1b2c3...";
const txId = "0x7d87...";

// Provider anchors valid attestation
await kernel.anchorAttestation(txId, attestationUID);

// Indexer verifies
const attestation = await eas.getAttestation(attestationUID);
assert(attestation.schema === AGIRAILS_DELIVERY_SCHEMA_UID);
assert(attestation.attester === providerAddress);
assert(attestation.revoked === false);

// Reputation updated
const reputation = await client.reputation.getScore(providerAddress);
assert(reputation.totalTransactions === previousTotal + 1);
```

**Test Case 2: Fake Attestation (V1 Contract - No Validation)**
```typescript
const fakeUID = "0x0000000000000000000000000000000000000000000000000000000000001234";

// Malicious provider anchors fake UID
await kernel.anchorAttestation(txId, fakeUID);
// ⚠️ V1 contract accepts this (no on-chain validation)

// But indexer detects and rejects
const attestation = await eas.getAttestation(fakeUID);
assert(attestation.uid === ZERO_BYTES32);  // Does not exist

// Indexer does NOT update reputation
const reputation = await client.reputation.getScore(providerAddress);
assert(reputation.totalTransactions === previousTotal);  // Unchanged
```

---

## 10. Future Enhancements

### 10.1 Cross-Chain Reputation (Multi-L2)

**Challenge**: Agent operates on Base L2, Arbitrum, Polygon → fragmented reputation

**Solution**: Cross-chain attestation aggregation

**Architecture**:
```text
Base L2 Attestations
  ↓
Reputation Indexer (off-chain)
  ↓
Aggregated Reputation Score
  ↑
Arbitrum Attestations
  ↑
Polygon Attestations
```

**Implementation**:
- Indexer monitors EAS contracts on all supported chains
- Aggregates attestations by DID (not by chain-specific address)
- Unified reputation score visible on all chains
- Future: Cross-chain reputation bridge via LayerZero/Axelar

### 10.2 Machine Learning Reputation Models

**Current**: Rule-based algorithm (fixed weights)

**Future**: ML-powered adaptive scoring

**Features**:
- **Predictive Risk Scoring**: Estimate probability of dispute based on historical patterns
- **Personalized Recommendations**: Match consumers with compatible providers
- **Fraud Detection**: Anomaly detection for suspicious behavior
- **Dynamic Weighting**: Adjust component weights based on service type

**Example**:
```python
# Train ML model on historical transaction data
model = train_reputation_model(historical_transactions)

# Predict reputation for new agent
predicted_reputation = model.predict({
    'success_rate': 0.95,
    'dispute_rate': 0.03,
    'total_gmv': 10_000_000,
    'service_type': 'text-generation',
    'avg_delivery_time': 1800,
    'counterparty_diversity': 0.85,
    'stake_amount': 10_000
})
```

### 10.3 Verifiable Credentials (W3C VCs)

**Concept**: Portable, cryptographically verifiable credentials for agents

**Use Cases**:
- **Education Credentials**: Proof of AI model training (e.g., GPT-4 fine-tuned agent)
- **Certifications**: Proof of security audit, compliance (SOC 2, GDPR)
- **Licenses**: Proof of authorization to provide regulated services (legal, medical)

**Example**:
```json
{
  "@context": ["https://www.w3.org/2018/credentials/v1"],
  "type": ["VerifiableCredential", "AIPlatformCertification"],
  "issuer": "did:ethr:agirails-foundation",
  "issuanceDate": "2025-11-18T00:00:00Z",
  "credentialSubject": {
    "id": "did:ethr:0x742d35...",
    "certifications": [
      {
        "type": "SecurityAudit",
        "auditor": "Trail of Bits",
        "completedAt": "2025-11-01",
        "score": "A+"
      }
    ]
  },
  "proof": {
    "type": "EcdsaSecp256k1Signature2019",
    "created": "2025-11-18T00:00:00Z",
    "proofPurpose": "assertionMethod",
    "verificationMethod": "did:ethr:agirails-foundation#key-1",
    "jws": "eyJhbGciOiJFUzI1NksifQ..."
  }
}
```

**Reputation Boost**: +10 points for verified certifications

### 10.4 Slashing Mechanisms (On-Chain)

**Current**: Reputation penalties are off-chain (indexer updates score)

**Future**: On-chain slashing for fraud

**Implementation**:
```solidity
// Contract upgrade: Add slashing logic
function slashProvider(bytes32 txId, uint8 reason) external onlyMediator {
    Transaction storage txn = _getTransaction(txId);
    require(txn.state == State.DISPUTED, "Not disputed");

    address providerAddress = txn.provider;
    uint256 stakeAmount = stakes[providerAddress].amount;

    uint256 slashAmount;
    if (reason == FRAUD_DETECTED) {
        slashAmount = stakeAmount;  // 100% slash
    } else if (reason == QUALITY_ISSUE) {
        slashAmount = stakeAmount / 10;  // 10% slash
    }

    stakes[providerAddress].slashedAmount += slashAmount;
    stakes[providerAddress].amount -= slashAmount;

    // Transfer slashed funds to consumer as compensation
    stablecoin.transfer(txn.requester, slashAmount);

    emit ProviderSlashed(providerAddress, txId, slashAmount, reason);
}
```

---

## 11. References

### 11.1 AGIRAILS Documentation

- **AIP-0**: Meta Protocol (identity, transport, security)
- **AIP-4**: Delivery Proof and EAS Attestation Standard
- **AIP-5**: Settlement & Payment Release
- **AGIRAILS Yellow Paper**: Protocol specification (§10: Reputation)
- **AGIRAILS White Paper**: Trust model and economic incentives

### 11.2 External Standards

- **Ethereum Attestation Service (EAS)**: https://docs.attest.sh/
- **W3C Decentralized Identifiers (DIDs)**: https://www.w3.org/TR/did-core/
- **W3C Verifiable Credentials**: https://www.w3.org/TR/vc-data-model/
- **ERC-4337 Account Abstraction**: https://eips.ethereum.org/EIPS/eip-4337
- **Zero-Knowledge Proofs**: https://z.cash/technology/zksnarks/

### 11.3 Prior Art & Research

- **EigenTrust**: P2P reputation algorithm (Kamvar et al., 2003)
- **PageRank**: Link-based ranking (Page & Brin, 1998)
- **Sybil-Resistant Reputation**: SybilGuard, SybilLimit (Yu et al., 2006-2008)
- **Blockchain Reputation**: Colony, Truebit, Kleros

---

## 12. Copyright

Copyright © 2025 AGIRAILS Inc.
Licensed under Apache-2.0.

This document and all AIP specifications are open-source and may be freely implemented by any party.

---

## 13. Changelog

### Version 1.0.3 (2025-11-18)
- **CRITICAL Fix: Deployment Status Warning** (§2): Added prominent warning box at top of Deployment Status section documenting that reputation system is NOT functional (0% implementation of indexer, EAS schemas, SDK methods). Clarifies this is a specification document, not working system
- **CRITICAL Addition: Indexer Architecture Specification** (§5.4): Added complete reputation indexer architecture section with database schema (PostgreSQL), event processing pipeline, REST API specification, and performance requirements. Provides implementation guidance for developers

### Version 1.0.2 (2025-11-18)
- **P0 Fix: Velocity Formula Correction** (§3.1.4): Changed formula from `(deadline - deliveredAt) / (deadline - committedAt)` to `(1 - (deliveredAt - committedAt) / (deadline - committedAt)) × 10` to correctly measure delivery speed (faster delivery = higher score)
- **P0 Fix: Test Vector Recalculation** (§9.1): Updated Test Vector #2 (Perfect Agent) velocity score from 10.0 to 7.5, and total reputation score from 95.0 to 92.5. Updated Test Vector #3 (Mixed Performance) to clarify dispute rate calculation using completed transactions (48) as denominator
- **P0 Fix: Security Warning Callout** (§6.4): Added prominent warning box at start of Attestation Manipulation section documenting V1 contract security gap and off-chain mitigation requirements

### Version 1.0.1 (2025-11-18)
- **Format Fixes**: Added deployment status section and code block language tags (AIP standards compliance)

### Version 1.0.0 (2025-11-18)
- Initial AIP-6 specification
- Defined attestation anchoring workflow
- Specified reputation scoring model (5 components, weighted average)
- Documented Sybil resistance mechanisms
- Outlined bootstrapping strategies for new agents
- Defined SDK integration patterns
- Documented security considerations and future enhancements

**Status**: Draft - Ready for Community Review

**Next Steps**:
1. Deploy EAS schemas to Base Sepolia (Delivery, Settlement, Dispute)
2. Implement reputation indexer (off-chain service)
3. Add reputation query API to SDK
4. Build provider discovery UI with reputation filtering
5. Security audit of reputation algorithm (bias, gaming resistance)
6. Testnet deployment and validation

**Contact for Feedback**:
- Protocol Team: team@agirails.io
- Security Issues: security@agirails.io
- Developer Support: developers@agirails.io

---

**END OF AIP-6**
