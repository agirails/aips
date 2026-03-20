# AIP-X: Multi-Identity Upgrade Path (DRAFT)

**Status:** DRAFT - Not Committed
**Created:** 2026-02-06
**Authors:** Arha, Damir Mujic

> **NOTE:** This AIP documents a potential upgrade path if multi-identity support becomes necessary. It is NOT a commitment to implement. See ADR-001 for why we currently use ERC-8004 specific `uint256 agentId`.

---

## Abstract

This AIP describes a potential upgrade path for adding multi-identity support to ACTP if the agent identity landscape evolves beyond ERC-8004 dominance. It preserves backwards compatibility while enabling future flexibility.

## Motivation

Currently, ACTP uses `uint256 agentId` specifically for ERC-8004 agent token IDs. This is the correct decision for 2026 based on:
- ERC-8004's strong backing (MetaMask, Coinbase, EF)
- AGIRAILS strategic positioning as ERC-8004 settlement layer
- Protocol simplicity principles

However, if the identity landscape fragments significantly (estimated 30% probability over 5 years), on-chain multi-identity support might become necessary.

**Triggers for reconsidering this AIP:**
- ERC-8004 adoption stalls below 40% market share
- A competing standard achieves >30% adoption
- Major partners explicitly require on-chain multi-identity
- Off-chain correlation proves insufficient for key use cases

## Specification (DRAFT)

### Option A: Additive Field (Recommended if needed)

Add a new optional field alongside existing `agentId`:

```solidity
struct Transaction {
    // ... existing fields ...
    uint256 agentId;              // ERC-8004 (preserved for compatibility)
    bytes32 identityContext;      // NEW: Optional multi-identity context
}
```

**Encoding convention for `identityContext`:**
```
Byte 0:     Identity type (0=unused, 1=ENS, 2=Lens, 3=Farcaster, etc.)
Bytes 1-31: Type-specific identifier
```

**Examples:**
```solidity
// ENS (namehash is bytes32, fits in 31 bytes)
identityContext = bytes32(uint256(1) << 248) | ensNamehash;

// Lens (profile ID is uint256, take lower 31 bytes)
identityContext = bytes32(uint256(2) << 248) | bytes32(lensProfileId);

// No additional identity
identityContext = bytes32(0);
```

### Option B: Versioned Interface

Create IACTPKernelV2 with enhanced identity support:

```solidity
interface IACTPKernelV2 is IACTPKernel {
    struct IdentityInfo {
        uint8 identityType;      // 0=none, 1=ERC-8004, 2=ENS, 3=Lens, etc.
        bytes32 identityHash;    // Type-specific identifier
    }

    function createTransactionV2(
        address provider,
        address requester,
        uint256 amount,
        uint256 deadline,
        uint256 disputeWindow,
        bytes32 serviceHash,
        IdentityInfo calldata identity
    ) external returns (bytes32 transactionId);
}
```

### Option C: Registry-Based Resolution

Instead of storing identity on-chain, delegate to an identity resolver:

```solidity
interface IIdentityResolver {
    function resolveIdentity(address account)
        external view returns (
            uint8 identityType,
            bytes32 identityHash,
            string memory humanReadable
        );
}

// ACTP queries resolver at settlement time
function _releaseEscrow(Transaction storage txn) internal {
    (uint8 idType, bytes32 idHash,) = identityResolver.resolveIdentity(txn.provider);
    // Use for reputation reporting
}
```

## Backwards Compatibility

All options preserve:
- Existing `uint256 agentId` field
- Current `createTransaction()` signature (via overloading or default params)
- Event structure (additive changes only)
- Subgraph compatibility

## Migration Path

1. **Phase 1 (Current):** Use `uint256 agentId` for ERC-8004
2. **Phase 2 (If triggered):** Add `identityContext` field via contract upgrade
3. **Phase 3 (If needed):** Deprecate `agentId` in favor of unified `identityContext`

## Security Considerations

- Identity fields remain unvalidated on-chain (off-chain responsibility)
- No identity field affects protocol invariants
- Adding fields increases gas slightly (~2100 gas per storage slot)

## Gas Impact

| Change | Gas Impact |
|--------|------------|
| Add `bytes32 identityContext` | +20,000 gas (new slot) |
| Query external resolver | +2,600 gas (cold STATICCALL) |

## Decision Criteria

**Do NOT implement this AIP if:**
- ERC-8004 maintains >50% market share
- Off-chain correlation via subgraph remains sufficient
- No major partners explicitly require on-chain multi-identity

**Consider implementing if:**
- ERC-8004 drops below 40% share AND
- Alternative standard exceeds 30% share AND
- Multiple partners request on-chain identity

## Timeline (Hypothetical)

| Milestone | Date | Condition |
|-----------|------|-----------|
| AIP drafted | 2026-02-06 | Done |
| Decision review | 2027-Q1 | If triggers met |
| Implementation | 2027-Q2 | If approved |
| Deprecation of `agentId` | 2028+ | If migration complete |

---

## Appendix: Identity Type Registry (If Option A/B Implemented)

```solidity
// NOT on-chain - maintained as off-chain documentation
enum IdentityType {
    NONE,           // 0 - No identity
    ERC8004,        // 1 - ERC-8004 Trustless Agents
    ENS,            // 2 - Ethereum Name Service
    LENS,           // 3 - Lens Protocol
    FARCASTER,      // 4 - Farcaster
    DID,            // 5 - DID (ERC-1056)
    // 6-255 reserved for future use
}
```

---

## Conclusion

This AIP exists as a documented upgrade path, not a commitment. The current `uint256 agentId` implementation is correct for AGIRAILS' strategic positioning and protocol simplicity goals.

**Current recommendation:** Monitor identity landscape, do not implement unless triggers are met.

---

*See ADR-001 for the architectural decision to use ERC-8004 specific `uint256 agentId`.*
