# AIP-14: Fair Dispute Resolution

**Status:** Draft
**Author:** AGIRAILS Core Team
**Created:** 2026-02-15
**Updated:** 2026-02-15
**Version:** 0.1.0
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
| Requester | Existing escrow | Bond reserved from locked funds (no additional transfer needed) |
| Provider | Separate transfer | Provider must approve + transfer bond to escrow vault |

**Bond resolution:**

| Outcome | Fault Party | Bond Destination |
|---------|------------|-----------------|
| Provider at fault | Provider | Bond returned to disputer (requester) |
| Requester at fault | Requester | Bond awarded to provider |
| Split / no clear fault | Neither | Bond returned to disputer |

#### 2.1.1 Storage Changes

```solidity
struct Transaction {
    // ... existing fields ...
    bool wasDisputed;          // AIP-7: Track if transaction went through dispute
    uint256 agentId;           // ERC-8004 agent ID
    // NEW fields (AIP-14):
    address disputeInitiator;  // Who opened the dispute (for bond return)
    uint256 disputeBond;       // Bond amount locked at dispute time
}
```

#### 2.1.2 Dispute Opening Logic

```solidity
// In transition(), when newState == State.DISPUTED:

txn.wasDisputed = true;
txn.disputeInitiator = msg.sender;

uint256 bond = (txn.amount * disputeBondBps) / MAX_BPS;
if (bond < MIN_DISPUTE_BOND) bond = MIN_DISPUTE_BOND;

if (msg.sender == txn.requester) {
    // Requester bond: reserved from existing escrow
    // No transfer needed — bond is carved from locked funds at resolution
    txn.disputeBond = bond;
} else if (msg.sender == txn.provider) {
    // Provider bond: must transfer into escrow
    USDC.safeTransferFrom(msg.sender, txn.escrowContract, bond);
    txn.disputeBond = bond;
}
```

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

```solidity
// After decoding resolution proof and distributing escrow:

if (txn.disputeBond > 0) {
    if (providerAtFault) {
        // Provider at fault → bond returned to disputer (requester)
        // Bond is already in escrow, refund to requester
        _refundRequester(txn, vault, txn.disputeBond);
    } else {
        // Requester at fault → bond goes to provider as compensation
        _payoutProviderAmount(txn, vault, txn.disputeBond);
    }
}
```

**Split / no clear fault:** When the resolution is a proportional split (neither party clearly at fault), the resolver sets `providerAtFault = false` and the bond returns to the disputer. This is the generous default — disputes should only damage reputation when there's clear provider fault.

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

---

## 3. Invariants

| ID | Invariant | Verification |
|----|-----------|--------------|
| INV-14.1 | Bond amount is deterministic | `bond = max(amount * disputeBondBps / MAX_BPS, MIN_DISPUTE_BOND)` |
| INV-14.2 | Bond cannot exceed MAX_DISPUTE_BOND_BPS | Admin setter enforces `<= 2000` |
| INV-14.3 | Bond is fully distributed at resolution | Goes to winner or returned to disputer; never stuck |
| INV-14.4 | Provider reputation unaffected when not at fault | `providerAtFault = false` → `wasDisputed = false` to registry |
| INV-14.5 | Legacy proofs default to `providerAtFault = true` | 64/128-byte proofs preserve current behavior |
| INV-14.6 | Escrow solvency maintained | Bond carved from existing escrow (requester) or added to it (provider) |
| INV-14.7 | `disputeInitiator` is immutable after dispute opens | Set once in DISPUTED transition, never modified |

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
| Open dispute (requester) | ~45K | ~55K | +10K (store disputeInitiator + disputeBond) |
| Open dispute (provider) | ~45K | ~95K | +50K (safeTransferFrom for bond) |
| Resolve dispute | ~120K | ~135K | +15K (bond distribution) |
| Normal settlement | ~80K | ~80K | No change |

Bond mechanism adds ~10-50K gas to disputes. Normal (non-disputed) transactions are unaffected.

---

## 6. Implementation Checklist

### Phase 1: Contract Changes

- [ ] Add `disputeInitiator`, `disputeBond` to Transaction struct
- [ ] Add `disputeBondBps`, `MIN_DISPUTE_BOND`, `MAX_DISPUTE_BOND_BPS` constants
- [ ] Update DISPUTED transition: compute and lock bond
- [ ] Extend `_decodeResolutionProof` with `providerAtFault` return value
- [ ] Update `_handleDisputeSettlement`: pass `providerAtFault` to registry, distribute bond
- [ ] Update `_handleCancellation` (DISPUTED → CANCELLED): return bond to disputer
- [ ] Add admin setter for `disputeBondBps` with delay and cap enforcement
- [ ] Provider bond: handle EscrowVault deposit for provider-initiated disputes

### Phase 2: Tests

- [ ] Requester dispute with bond → provider wins → provider reputation clean, bond to provider
- [ ] Requester dispute with bond → requester wins → provider reputation hit, bond returned
- [ ] Provider dispute with bond → provider wins → bond returned
- [ ] Split resolution → `providerAtFault = false` → no reputation impact, bond returned
- [ ] Legacy 64-byte proof → defaults to `providerAtFault = true`
- [ ] Legacy 128-byte proof → defaults to `providerAtFault = true`
- [ ] Bond below minimum → clamped to MIN_DISPUTE_BOND
- [ ] Provider insufficient USDC → dispute reverts
- [ ] Bond distribution with mediator present
- [ ] Gas benchmarks for all dispute paths

### Phase 3: SDK + Frontend

- [ ] SDK: update `openDispute()` to handle bond approval for provider
- [ ] SDK: update `resolveDispute()` to include `providerAtFault` in proof
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

1. New contract deployed with new logic.
2. In-flight disputes (opened before upgrade) are resolved by old kernel — they use legacy proof format.
3. New kernel accepts both legacy (64/128-byte) and new (96/160-byte) proof formats.
4. `disputeBond` defaults to `0` for pre-upgrade transactions (no bond retroactively required).
5. Admin switches kernel address when ready.

No data migration needed. Old AgentRegistry contract works unchanged — only the _meaning_ of `wasDisputed` changes (from "was disputed" to "provider was at fault").

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

---

## Copyright

Copyright 2026 AGIRAILS Inc. Licensed under Apache-2.0.
