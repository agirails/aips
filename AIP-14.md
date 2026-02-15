# AIP-14: Fair Dispute Resolution

**Status:** Draft
**Author:** AGIRAILS Core Team
**Created:** 2026-02-15
**Updated:** 2026-02-15
**Version:** 0.3.0
**Depends On:** AIP-7 (Reputation System), AIP-5 (Fee Structure)
**Related:** AIP-0 (Meta Protocol), AIP-12 (Payment Abstraction)

---

## Abstract

The current dispute system allows any party to open a dispute with zero economic consequence. A malicious requester can repeatedly dispute legitimate deliveries, permanently damaging a provider's on-chain reputation — even when the resolver rules entirely in the provider's favor. This AIP introduces two mechanisms to fix this asymmetry: **dispute bonds** (economic skin-in-the-game) and **outcome-based reputation** (only at-fault disputes count against provider reputation).

---

## 1. Motivation

### 1.1 The Griefing Problem

Under the current design:

1. Requester commits funds, provider delivers correctly.
2. Requester opens dispute (frivolous or malicious).
3. Resolver rules 100% in provider's favor.
4. Provider gets paid — **but** `wasDisputed = true` is already set.
5. Provider's `disputedTransactions` increments, reputation drops.
6. Requester suffers **zero** consequences.

This creates an attack vector where a competitor or bad actor can systematically destroy a provider's reputation by opening and losing disputes at no cost.

### 1.2 Current State

| Aspect | Current Behavior | Problem |
|--------|-----------------|---------|
| Dispute cost | Free for both parties | No disincentive for frivolous disputes |
| Reputation impact | Any dispute marks provider permanently | Provider punished even when innocent |
| Fault determination | Not tracked on-chain | No way to distinguish legitimate from frivolous |
| Requester accountability | Zero reputation tracking | Asymmetric — only providers face consequences |

### 1.3 Design Goals

1. **Frivolous disputes must cost money** — economic disincentive
2. **Innocent providers must not suffer reputation damage** — outcome-based scoring
3. **Legitimate disputes must remain accessible** — bond must be proportional, not prohibitive
4. **Minimal contract complexity** — extend existing proof encoding, don't redesign

---

## 2. Specification

### 2.1 Dispute Bond

When opening a dispute (transitioning to `DISPUTED`), the initiator must post a bond:

```
bondAmount = (txn.amount * disputeBondBps) / MAX_BPS
```

**Default:** `disputeBondBps = 500` (5% of transaction amount)

**Bond source by initiator:**

| Initiator | Bond Source | Mechanism |
|-----------|-----------|-----------|
| Requester | Separate transfer | Requester must approve + transfer bond to escrow vault (on top of existing escrow) |
| Provider | Separate transfer | Provider must approve + transfer bond to escrow vault |

**Why the requester bond is NOT carved from escrow:** The existing escrow holds exactly `txn.amount` (the transaction value). Resolution proofs distribute `requesterAmount + providerAmount + mediatorAmount == remaining`, where `remaining = txn.amount - platformFee`. If the bond were carved from escrow, the resolution amounts and the bond would compete for the same pool, breaking the `totalDistributed == remaining` invariant. Instead, the bond is a **separate deposit** on top of the escrow. This keeps escrow accounting clean: the original escrow covers the transaction split, and the bond is distributed independently after resolution.

**Bond resolution:**

| Outcome | Fault Party | Bond Destination |
|---------|------------|-----------------|
| Provider at fault | Provider | Bond returned to disputer |
| Not at fault (frivolous) | Disputer | Bond awarded to counterparty |
| Cancellation | N/A | Bond returned to disputer |

#### 2.1.1 Storage Changes

```solidity
struct Transaction {
    // ... existing fields ...
    bool wasDisputed;          // AIP-7: Track if transaction went through dispute
    uint256 agentId;           // Provider's ERC-8004 agent ID
    // NEW fields (AIP-14):
    uint256 requesterAgentId;  // Requester's ERC-8004 agent ID (0 if not an agent)
    address disputeInitiator;  // Who opened the dispute (for bond return)
    uint256 disputeBond;       // Bond amount locked at dispute time
}
```

The `requesterAgentId` is set in `createTransaction()` by looking up the requester's address in the ERC-8004 Identity Registry. If the requester has no registered identity, it defaults to `0` and requester-side ERC-8004 reputation reporting is skipped.

#### 2.1.2 Dispute Opening Logic

```solidity
// In transition(), when newState == State.DISPUTED:

txn.wasDisputed = true;
txn.disputeInitiator = msg.sender;

uint256 bond = (txn.amount * disputeBondBps) / MAX_BPS;
if (bond < MIN_DISPUTE_BOND) bond = MIN_DISPUTE_BOND;

// Both parties post bond via separate transfer into escrow vault.
// Bond is ON TOP of existing escrow — does not affect transaction split accounting.
IEscrowValidator vault = IEscrowValidator(txn.escrowContract);
USDC.safeTransferFrom(msg.sender, address(vault), bond);
vault.depositBond(txn.escrowId, bond);  // Track bond separately from escrow balance
txn.disputeBond = bond;

emit DisputeOpened(txn.transactionId, msg.sender, bond, block.timestamp);
```

**Note:** `vault.depositBond(escrowId, amount)` is a new EscrowVault method that tracks bond deposits separately from the main escrow balance. This ensures `vault.remaining(escrowId)` still returns only the transaction amount, while `vault.bondBalance(escrowId)` tracks the dispute bond. See Section 2.5 for EscrowVault changes.

#### 2.1.3 Constants

```solidity
uint16 public disputeBondBps = 500;                    // 5% default
uint256 public constant MIN_DISPUTE_BOND = 1_000_000;  // $1 USDC minimum
uint256 public constant MAX_DISPUTE_BOND_BPS = 2_000;  // 20% cap
```

The minimum bond of $1 ensures micro-transaction disputes still have economic weight. The 20% cap ensures large-value disputes remain accessible.

### 2.2 Outcome-Based Reputation

The resolver (admin/pauser) now explicitly declares fault when resolving a dispute.

#### 2.2.1 Resolution Proof Extension

Current proof encoding (unchanged for non-disputed settlements):

| Length | Format | Usage |
|--------|--------|-------|
| 0 bytes | (none) | No resolution — full payout to provider |
| 64 bytes | `(requesterAmount, providerAmount)` | Split without mediator |
| 128 bytes | `(requesterAmount, providerAmount, mediator, mediatorAmount)` | Split with mediator |

**New proof encoding for dispute resolution:**

| Length | Format | Usage |
|--------|--------|-------|
| 96 bytes | `(requesterAmount, providerAmount, providerAtFault)` | Dispute split without mediator |
| 160 bytes | `(requesterAmount, providerAmount, mediator, mediatorAmount, providerAtFault)` | Dispute split with mediator |

The `providerAtFault` field is a `bool`:
- `true` — provider violated Covenant, dispute was legitimate. Provider reputation affected.
- `false` — requester dispute was frivolous or unfounded. Provider reputation unaffected.

**Backwards compatibility:** Proof length determines format. Legacy 64-byte and 128-byte proofs default to `providerAtFault = true` (conservative — preserves current behavior for any in-flight disputes during upgrade).

#### 2.2.2 Updated Decode Function

```solidity
function _decodeResolutionProof(bytes calldata proof)
    internal pure
    returns (
        uint256 requesterAmount,
        uint256 providerAmount,
        address mediator,
        uint256 mediatorAmount,
        bool hasResolution,
        bool providerAtFault
    )
{
    if (proof.length == 0) {
        return (0, 0, address(0), 0, false, false);
    }
    if (proof.length == 64) {
        // Legacy: no mediator, assume provider at fault
        (requesterAmount, providerAmount) = abi.decode(proof, (uint256, uint256));
        return (requesterAmount, providerAmount, address(0), 0, true, true);
    }
    if (proof.length == 96) {
        // AIP-14: no mediator, explicit fault
        (requesterAmount, providerAmount, providerAtFault) =
            abi.decode(proof, (uint256, uint256, bool));
        return (requesterAmount, providerAmount, address(0), 0, true, providerAtFault);
    }
    if (proof.length == 128) {
        // Legacy: with mediator, assume provider at fault
        (requesterAmount, providerAmount, mediator, mediatorAmount) =
            abi.decode(proof, (uint256, uint256, address, uint256));
        return (requesterAmount, providerAmount, mediator, mediatorAmount, true, true);
    }
    // AIP-14: with mediator, explicit fault
    require(proof.length == 160, "Invalid resolution proof");
    (requesterAmount, providerAmount, mediator, mediatorAmount, providerAtFault) =
        abi.decode(proof, (uint256, uint256, address, uint256, bool));
    return (requesterAmount, providerAmount, mediator, mediatorAmount, true, providerAtFault);
}
```

#### 2.2.3 Updated Reputation Call

```solidity
// In _handleDisputeSettlement:
try agentRegistry.updateReputationOnSettlement{gas: 150000}(
    txn.provider,
    txn.transactionId,
    txn.amount,
    providerAtFault  // was: txn.wasDisputed
) {} catch {}
```

#### 2.2.4 Bond Distribution in Resolution

Bond distribution happens **after** the normal escrow split (requesterAmount/providerAmount/mediatorAmount) is complete. The bond is tracked separately by the EscrowVault and does not affect the `totalDistributed == remaining` check.

```solidity
// After decoding resolution proof and distributing the main escrow split:

if (txn.disputeBond > 0) {
    if (providerAtFault) {
        // Provider at fault → bond returned to disputer
        vault.releaseBond(txn.escrowId, txn.disputeInitiator, txn.disputeBond);
    } else {
        // Requester at fault (frivolous dispute) → bond awarded to counterparty
        address counterparty = (txn.disputeInitiator == txn.requester)
            ? txn.provider
            : txn.requester;
        vault.releaseBond(txn.escrowId, counterparty, txn.disputeBond);
    }

    emit DisputeResolved(
        txn.transactionId,
        bytes32(0),           // disputeId (reserved for future use)
        txn.disputeInitiator,
        providerAtFault,
        txn.disputeBond,
        block.timestamp
    );
}
```

**Accounting invariant:** `vault.remaining(escrowId)` tracks only the transaction amount. `vault.bondBalance(escrowId)` tracks the dispute bond. After resolution, both must be zero — the escrow is fully distributed via the resolution proof, and the bond is fully distributed via `releaseBond`. This maintains INV-14.6 (escrow solvency) without complicating the existing split logic.

**Split / no clear fault:** When the resolution is a proportional split (neither party clearly at fault), the resolver sets `providerAtFault = false` and the bond returns to the disputer. This is the generous default — disputes should only damage reputation when there's clear provider fault.

#### 2.2.5 Bond Return on Cancellation (DISPUTED → CANCELLED)

When a dispute is cancelled (resolver transitions DISPUTED → CANCELLED), the bond is **always returned to the disputer**. Cancellation means no fault was determined — the dispute was withdrawn or dismissed without prejudice.

```solidity
// In _handleCancellation(), after existing refund logic:

if (txn.disputeBond > 0) {
    IEscrowValidator vault = IEscrowValidator(txn.escrowContract);
    vault.releaseBond(txn.escrowId, txn.disputeInitiator, txn.disputeBond);

    emit DisputeResolved(
        txn.transactionId,
        bytes32(0),
        txn.disputeInitiator,
        false,              // providerAtFault = false (no fault on cancellation)
        txn.disputeBond,
        block.timestamp
    );
}
```

**Rationale:** Cancellation is not a ruling. The resolver may cancel because parties reached off-chain agreement, or the dispute was premature. Penalizing the disputer (forfeiting bond) would discourage legitimate disputes from being opened. The bond exists to punish frivolous disputes that go through resolution — not disputes that are withdrawn.

**Reputation:** No reputation impact on cancellation. The `updateReputationOnSettlement` call is NOT made for DISPUTED → CANCELLED transitions (same as current behavior — reputation updates only happen on SETTLED).

### 2.3 AgentRegistry Changes

The `updateReputationOnSettlement` interface remains identical:

```solidity
function updateReputationOnSettlement(
    address agentAddress,
    bytes32 txId,
    uint256 txAmount,
    bool wasDisputed       // Semantics change: now means "provider was at fault"
) external onlyKernel;
```

The parameter name `wasDisputed` is preserved for ABI compatibility. Its **semantic meaning** changes from "transaction was disputed" to "provider was found at fault in dispute". The internal logic (`if (wasDisputed) { profile.disputedTransactions += 1; }`) requires no change — only the value passed by ACTPKernel changes.

### 2.4 ERC-8004 Reputation Bridge Alignment

AGIRAILS maintains two parallel reputation systems:

| System | Location | Scope | Write Trigger |
|--------|----------|-------|---------------|
| **AgentRegistry** | AGIRAILS contract (Base) | Internal — listing, filtering, paymaster gating | Automatic: ACTPKernel calls `updateReputationOnSettlement()` after every settlement |
| **ERC-8004 Reputation Registry** | Canonical contract (all EVM chains) | Cross-platform — portable, any protocol can read | Optional: SDK `ReputationReporter` writes after settlement (requester pays gas) |

**Pre-AIP-14 gap:** The ERC-8004 `ReputationReporter` already distinguishes dispute outcomes — `reportDispute({ agentWon: true })` writes `value: 1` with tag `actp_dispute_won`, while `agentWon: false` writes `value: -1` with tag `actp_dispute_lost`. But AgentRegistry did NOT distinguish — any dispute incremented `disputedTransactions` regardless of outcome. This created an inconsistency: an agent cleared of wrongdoing would have a clean ERC-8004 record but a damaged AgentRegistry score.

**Post-AIP-14:** Both systems are now aligned. AgentRegistry only increments `disputedTransactions` when `providerAtFault == true`, matching the ERC-8004 reporter's existing `agentWon` logic.

#### 2.4.1 Updated ReputationReporter Integration

The `ReputationReporter.reportDispute()` method maps naturally to AIP-14's fault model:

```typescript
// After dispute resolution with AIP-14:
// providerAtFault = true  → agentWon = false → ERC-8004 value: -1, tag: actp_dispute_lost
// providerAtFault = false → agentWon = true  → ERC-8004 value: +1, tag: actp_dispute_won

await reporter.reportDispute({
  agentId: agent.agentId,
  txId: result.txId,
  agentWon: !providerAtFault,  // Direct inversion
  capability: 'code_generation',
});
```

No changes needed to the existing `reportDispute()` method — only the value of `agentWon` changes based on the resolver's `providerAtFault` determination.

#### 2.4.2 Requester-Side ERC-8004 Reputation (NEW)

**Problem:** Under AIP-14, a frivolous disputer loses their bond — but their ERC-8004 profile stays clean. In agent-to-agent transactions (AGIRAILS's core use case), both parties are agents with ERC-8004 identities. Providers choosing which requesters to serve have no cross-platform signal of bad-faith dispute behavior.

**Solution:** When `providerAtFault = false`, report negative feedback against the **requester's** ERC-8004 agentId (if available).

##### Storage Change

The Transaction struct needs a requester agentId:

```solidity
struct Transaction {
    // ... existing fields ...
    uint256 agentId;              // Provider's ERC-8004 agent ID
    // NEW (AIP-14):
    uint256 requesterAgentId;     // Requester's ERC-8004 agent ID (0 if not an agent)
    address disputeInitiator;
    uint256 disputeBond;
}
```

The `requesterAgentId` is set during `createTransaction()` if the requester has a registered ERC-8004 identity. If `requesterAgentId == 0`, requester-side ERC-8004 reporting is skipped (the requester is not an agent).

##### SDK: New `reportDisputeRequester()` Method

```typescript
export interface ReportDisputeRequesterParams {
  /** Requester's ERC-8004 agent ID */
  requesterAgentId: string;

  /** ACTP transaction ID */
  txId: string;

  /** Agent capability (optional) */
  capability?: string;
}

/**
 * Report frivolous dispute against requester's ERC-8004 reputation.
 *
 * Called ONLY when providerAtFault = false AND requester has an agentId.
 *
 * Reports:
 * - value: -1 (negative feedback)
 * - tag1: 'actp_frivolous_dispute'
 * - feedbackHash: keccak256(txId + ":requester")
 */
async reportDisputeRequester(
  params: ReportDisputeRequesterParams
): Promise<ReportResult | null>;
```

##### Full Dispute Resolution Flow (SDK)

```typescript
// After dispute resolution:
if (providerAtFault) {
  // Provider at fault → negative rep for provider
  await reporter.reportDispute({
    agentId: provider.agentId,
    txId: result.txId,
    agentWon: false,
    capability: 'code_generation',
  });
} else {
  // Requester at fault → positive rep for provider + negative rep for requester
  await reporter.reportDispute({
    agentId: provider.agentId,
    txId: result.txId,
    agentWon: true,
    capability: 'code_generation',
  });

  // Report frivolous dispute against requester (if they have an agentId)
  if (requesterAgentId) {
    await reporter.reportDisputeRequester({
      requesterAgentId,
      txId: result.txId,
      capability: 'code_generation',
    });
  }
}
```

##### ERC-8004 Tags

New feedback tag added to `ACTP_FEEDBACK_TAGS`:

```typescript
export const ACTP_FEEDBACK_TAGS = {
  SETTLED: 'actp_settled',           // existing
  DISPUTE_WON: 'actp_dispute_won',   // existing (provider won)
  DISPUTE_LOST: 'actp_dispute_lost', // existing (provider lost)
  FRIVOLOUS_DISPUTE: 'actp_frivolous_dispute', // NEW (requester lost)
};
```

##### Dedup Safety

The feedbackHash for requester-side reports uses a different salt:
```
feedbackHash = keccak256(txId + ":requester")
```
This ensures the same txId can have both a provider-side report AND a requester-side report without on-chain collision.

#### 2.4.3 Cross-Platform Reputation Portability

Because ERC-8004 Reputation Registry is a canonical standard deployed on all EVM chains:

1. **An agent's ACTP reputation is portable** — any platform reading ERC-8004 can see the agent's settlement history, dispute record, and outcome tags.
2. **Reputation is not locked into AGIRAILS** — if a provider leaves AGIRAILS, their earned reputation (positive settlements, dispute wins) persists in ERC-8004 forever.
3. **Multi-protocol reputation** — an agent using both ACTP and other protocols accumulates reputation from all sources in the same ERC-8004 registry, filtered by tag.
4. **Bilateral reputation** — with AIP-14, both providers AND requesters build ERC-8004 track records. A provider can query `tag1 = actp_frivolous_dispute` on a requester's agentId to assess risk before accepting a job.

### 2.5 EscrowVault Changes

The EscrowVault needs two new methods to track bond deposits separately from escrow balances:

```solidity
// New storage: mapping(bytes32 escrowId => uint256 bondAmount)
mapping(bytes32 => uint256) public bondBalances;

/// @notice Deposit a dispute bond for an escrow. Called by ACTPKernel during dispute opening.
/// @param escrowId The escrow to associate the bond with
/// @param amount The bond amount (already transferred to vault)
function depositBond(bytes32 escrowId, uint256 amount) external onlyKernel {
    require(amount > 0, "Zero bond");
    bondBalances[escrowId] += amount;
}

/// @notice Release a dispute bond to the designated recipient. Called by ACTPKernel during resolution.
/// @param escrowId The escrow whose bond to release
/// @param recipient The address receiving the bond
/// @param amount The bond amount to release
function releaseBond(bytes32 escrowId, address recipient, uint256 amount) external onlyKernel {
    require(bondBalances[escrowId] >= amount, "Insufficient bond");
    bondBalances[escrowId] -= amount;
    USDC.safeTransfer(recipient, amount);
}

/// @notice View the bond balance for an escrow
function bondBalance(bytes32 escrowId) external view returns (uint256) {
    return bondBalances[escrowId];
}
```

**Key property:** `remaining(escrowId)` is unaffected by bond deposits. The existing `totalDistributed == remaining` check in ACTPKernel works unchanged. Bond funds flow through a separate accounting path (`depositBond` → `releaseBond`).

### 2.6 Updated Event Signatures

The existing `DisputeOpened` and `DisputeResolved` events (declared in `IACTPKernel.sol` but never emitted) are updated and now emitted by AIP-14:

```solidity
// Updated signatures:
event DisputeOpened(
    bytes32 indexed transactionId,
    address indexed initiator,
    uint256 bondAmount,         // was: bytes32 disputeId (unused)
    uint256 timestamp
);

event DisputeResolved(
    bytes32 indexed transactionId,
    bytes32 indexed disputeId,  // reserved for future use (always bytes32(0) for now)
    address indexed initiator,  // who opened the dispute
    bool providerAtFault,       // NEW: fault determination
    uint256 bondAmount,         // NEW: bond amount distributed
    uint256 timestamp
);
```

**Breaking change:** The `DisputeOpened` event signature changes (third parameter from `bytes32` to `uint256`). Since these events were **never emitted** in the current contract, no indexer or frontend relies on them. This is safe to change.

**Emit points:**
- `DisputeOpened`: emitted in `transition()` when `newState == State.DISPUTED` (Section 2.1.2)
- `DisputeResolved`: emitted in `_handleDisputeSettlement` (Section 2.2.4) and `_handleCancellation` (Section 2.2.5)

---

## 3. Invariants

| ID | Invariant | Verification |
|----|-----------|--------------|
| INV-14.1 | Bond amount is deterministic | `bond = max(amount * disputeBondBps / MAX_BPS, MIN_DISPUTE_BOND)` |
| INV-14.2 | Bond cannot exceed MAX_DISPUTE_BOND_BPS | Admin setter enforces `<= 2000` |
| INV-14.3 | Bond is fully distributed at resolution | Goes to winner or returned to disputer; never stuck |
| INV-14.4 | Provider reputation unaffected when not at fault | `providerAtFault = false` → `wasDisputed = false` to registry |
| INV-14.5 | Legacy proofs default to `providerAtFault = true` | 64/128-byte proofs preserve current behavior |
| INV-14.6 | Escrow solvency maintained | Bond tracked via separate `bondBalances` mapping; `remaining(escrowId)` unaffected; `bondBalance(escrowId) == 0` after resolution |
| INV-14.7 | `disputeInitiator` is immutable after dispute opens | Set once in DISPUTED transition, never modified |
| INV-14.8 | AgentRegistry and ERC-8004 reputation are consistent | `providerAtFault` maps to `!agentWon` in ReputationReporter |
| INV-14.9 | Every dispute emits `DisputeOpened` | Emitted in DISPUTED transition, once per dispute |
| INV-14.10 | Every dispute resolution emits `DisputeResolved` | Emitted in both SETTLED and CANCELLED paths when `disputeBond > 0` |
| INV-14.11 | Requester ERC-8004 report uses distinct feedbackHash | `keccak256(txId + ":requester")` prevents collision with provider report |
| INV-14.12 | Requester-side report only when `requesterAgentId != 0` | Non-agent requesters are skipped (no ERC-8004 identity to report against) |

---

## 4. Security Considerations

### 4.1 Bond Manipulation

**Threat:** Admin changes `disputeBondBps` between dispute opening and resolution.

**Mitigation:** Bond amount is stored in `txn.disputeBond` at dispute time. Resolution uses stored value, not current parameter.

### 4.2 Provider Bond Transfer

**Threat:** Provider opens dispute but has insufficient USDC for bond.

**Mitigation:** `safeTransferFrom` reverts if provider hasn't approved or lacks balance. Dispute transition fails atomically.

### 4.3 Resolver Collusion

**Threat:** Resolver always sets `providerAtFault = false` to protect providers.

**Mitigation:** Resolution proof is public on-chain. Anyone can audit fault determinations. Future improvement: decentralized resolver selection (out of scope for AIP-14).

### 4.4 Backwards Compatibility

**Threat:** In-flight disputes during contract upgrade use old proof format.

**Mitigation:** Legacy 64-byte and 128-byte proofs default to `providerAtFault = true`, preserving conservative behavior. No in-flight disputes are silently forgiven.

### 4.5 Bond as Dispute Barrier

**Threat:** Bond makes disputes inaccessible for small transactions.

**Mitigation:** `MIN_DISPUTE_BOND = $1` is low enough for any legitimate dispute. The $0.05 minimum transaction amount means even the smallest ACTP transaction can be disputed. The bond is returned in full if the dispute is legitimate.

---

## 5. Gas Costs

| Operation | Current Gas | New Gas (est.) | Delta |
|-----------|-----------|---------------|-------|
| Open dispute (requester) | ~45K | ~95K | +50K (safeTransferFrom + depositBond + event) |
| Open dispute (provider) | ~45K | ~95K | +50K (safeTransferFrom + depositBond + event) |
| Resolve dispute (SETTLED) | ~120K | ~145K | +25K (releaseBond + DisputeResolved event) |
| Resolve dispute (CANCELLED) | ~80K | ~105K | +25K (releaseBond + DisputeResolved event) |
| Normal settlement | ~80K | ~80K | No change |

Bond mechanism adds ~10-50K gas to disputes. Normal (non-disputed) transactions are unaffected.

---

## 6. Implementation Checklist

### Phase 1: Contract Changes

- [ ] Add `requesterAgentId`, `disputeInitiator`, `disputeBond` to Transaction struct
- [ ] Add `disputeBondBps`, `MIN_DISPUTE_BOND`, `MAX_DISPUTE_BOND_BPS` constants
- [ ] Update DISPUTED transition: compute bond, `safeTransferFrom` from initiator, `vault.depositBond()`
- [ ] Emit `DisputeOpened` event on DISPUTED transition
- [ ] Extend `_decodeResolutionProof` with `providerAtFault` return value
- [ ] Update `_handleDisputeSettlement`: pass `providerAtFault` to registry, `vault.releaseBond()`, emit `DisputeResolved`
- [ ] Update `_handleCancellation` (DISPUTED → CANCELLED): `vault.releaseBond()` to disputer, emit `DisputeResolved`
- [ ] Add admin setter for `disputeBondBps` with delay and cap enforcement
- [ ] EscrowVault: add `bondBalances` mapping, `depositBond()`, `releaseBond()`, `bondBalance()` methods
- [ ] Update `DisputeOpened` and `DisputeResolved` event signatures in `IACTPKernel.sol`

### Phase 2: Tests

- [ ] Requester dispute with bond → provider wins → provider reputation clean, bond to provider
- [ ] Requester dispute with bond → requester wins → provider reputation hit, bond returned
- [ ] Provider dispute with bond → provider wins → bond returned
- [ ] Split resolution → `providerAtFault = false` → no reputation impact, bond returned to disputer
- [ ] DISPUTED → CANCELLED: bond returned to disputer, no reputation update, `DisputeResolved` emitted
- [ ] Legacy 64-byte proof → defaults to `providerAtFault = true`
- [ ] Legacy 128-byte proof → defaults to `providerAtFault = true`
- [ ] Bond below minimum → clamped to MIN_DISPUTE_BOND
- [ ] Requester insufficient USDC for bond → dispute reverts
- [ ] Provider insufficient USDC for bond → dispute reverts
- [ ] Bond distribution with mediator present
- [ ] `DisputeOpened` event emitted with correct bond amount on DISPUTED transition
- [ ] `DisputeResolved` event emitted with correct fault + bond on SETTLED and CANCELLED paths
- [ ] `vault.remaining()` unchanged after bond deposit (separate accounting)
- [ ] `vault.bondBalance()` == 0 after resolution (fully distributed)
- [ ] Requester-side ERC-8004: `actp_frivolous_dispute` written when `providerAtFault = false` and `requesterAgentId != 0`
- [ ] Requester-side ERC-8004: skipped when `requesterAgentId == 0` (non-agent requester)
- [ ] Requester-side feedbackHash `keccak256(txId + ":requester")` does not collide with provider feedbackHash
- [ ] Gas benchmarks for all dispute paths

### Phase 3: SDK + Frontend

- [ ] SDK: update `openDispute()` to handle bond approval for both parties
- [ ] SDK: update `resolveDispute()` to include `providerAtFault` in proof
- [ ] SDK: add `reportDisputeRequester()` to `ReputationReporter`
- [ ] SDK: add `actp_frivolous_dispute` to `ACTP_FEEDBACK_TAGS`
- [ ] SDK: pass `requesterAgentId` in `createTransaction()` when available
- [ ] Dashboard: show dispute bond amount and fault determination
- [ ] FAQ: update to reflect new mechanics

### Phase 4: Deploy

- [ ] Deploy updated ACTPKernel to Base Sepolia
- [ ] E2E test all dispute paths on testnet
- [ ] Deploy to Base Mainnet
- [ ] Update paymaster allowlists if needed

---

## 7. Migration

The upgrade is **non-breaking**:

1. New ACTPKernel deployed with new logic.
2. New EscrowVault deployed with `bondBalances` mapping and bond methods.
3. In-flight disputes (opened before upgrade) are resolved by old kernel — they use legacy proof format.
4. New kernel accepts both legacy (64/128-byte) and new (96/160-byte) proof formats.
5. `disputeBond` defaults to `0` for pre-upgrade transactions (no bond retroactively required).
6. Admin switches kernel address and escrow vault when ready.

No data migration needed. Old AgentRegistry contract works unchanged — only the _meaning_ of `wasDisputed` changes (from "was disputed" to "provider was at fault").

**Note:** EscrowVault upgrade requires migrating active escrows to the new vault, or deploying the new vault alongside the old one (new transactions use new vault, old transactions complete on old vault). The second approach is simpler and recommended.

---

## 8. Economic Analysis

### 8.1 Griefing Cost Before AIP-14

| Attack | Cost to Attacker | Damage to Provider |
|--------|-----------------|-------------------|
| 10 frivolous disputes on $100 txns | $0 | 10 permanent reputation marks |
| 100 frivolous disputes | $0 | Reputation destroyed |

### 8.2 Griefing Cost After AIP-14

| Attack | Cost to Attacker | Damage to Provider |
|--------|-----------------|-------------------|
| 10 frivolous disputes on $100 txns | $50 lost in bonds (10 x $5) | 0 reputation marks |
| 100 frivolous disputes | $500 lost | 0 reputation marks |

**Key insight:** After AIP-14, frivolous disputes are both expensive (bond forfeiture) and ineffective (no reputation damage). The attacker pays money to accomplish nothing.

### 8.3 Legitimate Dispute Economics

A requester with a genuine grievance:
1. Opens dispute, bond of 5% reserved from escrow.
2. Resolver finds provider at fault.
3. Requester gets refund + bond returned in full.
4. Provider's reputation correctly reflects the legitimate dispute.

**Net cost to legitimate disputer: $0** — bond is returned when the dispute is justified.

---

## 9. References

- [AIP-7: Reputation System](./AIP-7.md)
- [AIP-5: Fee Structure](./AIP-5.md)
- [ACTPKernel.sol](../src/ACTPKernel.sol) — `_handleDisputeSettlement`, `_handleCancellation`
- [AgentRegistry.sol](../src/registry/AgentRegistry.sol) — `updateReputationOnSettlement`, `_calculateReputationScore`

---

## 10. Changelog

| Version | Date | Changes |
|---------|------|---------|
| 0.1.0 | 2026-02-15 | Initial draft |
| 0.2.0 | 2026-02-15 | Fix: requester bond as separate transfer (not carved from escrow); Add: `_handleCancellation` bond return spec; Add: `DisputeOpened`/`DisputeResolved` event emission; Add: EscrowVault `depositBond`/`releaseBond` methods; Updated gas estimates |
| 0.3.0 | 2026-02-15 | Add: requester-side ERC-8004 reputation reporting (`actp_frivolous_dispute` tag); Add: `requesterAgentId` to Transaction struct; Add: `reportDisputeRequester()` SDK method; Bilateral reputation for agent-to-agent economy |

---

## Copyright

Copyright 2026 AGIRAILS Inc. Licensed under Apache-2.0.
