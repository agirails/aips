# AIP-8: Builders & Partners Marketplace

**Status:** Draft
**Author:** AGIRAILS Core Team
**Created:** 2025-01-09
**Updated:** 2026-01-11
**Version:** 0.13.0
**Depends On:** AIP-0 (Meta Protocol), AIP-6 (Fee Structure), AIP-7 (Agent Identity Registry)
**Extended By:** AIP-9 (Agent Passport NFT), AIP-10 (Reputation Badges), AIP-11 (Token Bound Accounts)

---

## Abstract

This AIP defines the **Builders & Partners Marketplace** — a protocol extension that enables:

1. **Builder Registration** - Developers who create AI agents earn a share of protocol fees
2. **Partner Program** - Referrers who bring builders to the ecosystem earn perpetual commission
3. **Agent Ownership Model** - Separation of agent ownership (business) from development (builder)
4. **Fee Distribution** - Automated on-chain revenue sharing with claimable balances
5. **Agent Marketplace** (V1.1) - Discovery, trading, and composability via NFT ownership

AIP-8 creates economic incentives for ecosystem growth while ensuring fair attribution and revenue distribution.

---

## 1. Motivation

### 1.1 The Growth Problem

Current state (pre-AIP-8):
- Protocol has no built-in growth incentives
- Developers building on AGIRAILS receive no direct protocol revenue
- No referral mechanism to encourage ecosystem expansion
- Agent ownership is simple address mapping with no marketplace functionality

This creates friction:
- **Developers**: No incentive to choose AGIRAILS over alternatives
- **Partners**: Cannot earn from bringing developers to the ecosystem
- **Protocol**: Growth depends entirely on organic discovery

### 1.2 The Ownership Problem

In enterprise scenarios:
- Business (Owner) contracts a developer (Builder) to create an agent
- Developer may leave or become unavailable
- Business needs to maintain control and ability to change developers
- Original referrer (Partner) should continue earning regardless of developer changes

### 1.3 Solution Overview

AIP-8 introduces a **four-role model**:

```
Partner → refers → Builder → registers → Agent → owned by → Owner
         (permanent)         (replaceable)       (transferable)
```

**Key Innovation**: Partner attribution is per-BUILDER, locked at builder registration
- Partner is linked to BUILDER (not individual agents)
- All agents created by a builder benefit the same partner
- Builder can be replaced by Owner (with 30-day notice)
- **Partner attribution on agent is PERMANENT** - even if builder is replaced, original partner continues earning
- Creates stable, long-term incentives for ecosystem growth

**Attribution Flow**:
```
1. Partner JACK refers Builder BOB
   → builderToPartner[BOB] = JACK (permanent)

2. BOB registers Agent1, Agent2, Agent3
   → All agents: referredBy = JACK

3. Owner replaces BOB with ALICE (30-day notice)
   → agents[Agent1].builder = ALICE
   → agents[Agent1].referredBy = JACK (UNCHANGED!)
   → JACK continues earning from Agent1, Agent2, Agent3
```

---

## 2. Roles & Relationships

### 2.1 Role Definitions

| Role | Definition | On-Chain Representation |
|------|------------|------------------------|
| **Agent** | AI agent that transacts via ACTP | Contract address or EOA |
| **Owner** | Business/entity that owns the agent | Wallet address (NFT holder in V1.1) |
| **Builder** | Developer who created/maintains the agent | Wallet address (registered builder) |
| **Partner** | Referrer who brought builder to ecosystem | Wallet address (registered partner) |

### 2.2 Relationship Rules

**Agent ↔ Owner**:
- Owner receives 99% of transaction revenue (provider side)
- Owner can transfer ownership (sell agent)
- Owner can deactivate agent
- Owner can replace builder

**Agent ↔ Builder**:
- Builder receives fee share (10% base, +5% partner bonus after verification)
- Builder is the wallet that registered the agent
- Builder can resign (voluntarily stop earning)
- Builder can be replaced by Owner (with 30-day notice period)

**Agent ↔ Partner**:
- Partner attribution is PERMANENT (locked at agent registration)
- Partner receives 5% of protocol fees from all transactions
- Partner attribution NEVER changes, even if:
  - Builder is replaced
  - Owner transfers agent
  - Agent is deactivated and reactivated

### 2.3 Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        AGENT LIFECYCLE                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  REGISTRATION:                                                   │
│  ─────────────                                                   │
│  Partner → refers → Builder                                      │
│                       │                                          │
│                       │ registerAgent(agent, owner, ownerSig)    │
│                       ▼                                          │
│                     Agent ─── owned by ──→ Owner                 │
│                       │                                          │
│                       │ (partner locked FOREVER)                 │
│                       ▼                                          │
│              Partner Attribution: PERMANENT                      │
│                                                                  │
│  RUNTIME:                                                        │
│  ────────                                                        │
│  Agent transacts → Fee collected → Distribution:                 │
│    • Owner:   99% of transaction value                           │
│    • Builder: 10-15% of protocol fee                             │
│    • Partner: 5% of protocol fee                                 │
│    • Treasury: 80-90% of protocol fee                            │
│                                                                  │
│  CHANGES:                                                        │
│  ────────                                                        │
│  Owner calls initiateBuilderReplacement() → 30-day notice starts │
│  Owner calls executeBuilderReplacement()  → New builder assigned │
│                                             Old builder keeps    │
│                                             past earnings        │
│                                             Partner UNCHANGED    │
│                                                                  │
│  Owner calls transferOwnership() → New owner                     │
│                                    Builder UNCHANGED*            │
│                                    Partner UNCHANGED             │
│                                    (*new owner may replace)      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Fee Distribution Model

### 3.1 Fee Structure

**Base Protocol Fee**: 1% of GMV (defined in AIP-6)

**Fee Distribution** (bonus requires verification):

| Scenario | Builder Share | Partner Share | Treasury |
|----------|---------------|---------------|----------|
| **Verified + Partner** | 15% (10% base + 5% bonus) | 5% | 80% |
| **Verified, No Partner** | 10% (base only) | 0% | 90% |
| **Unverified + Partner** | 10% (base only, no bonus yet) | 5% | 85% |
| **Unverified, No Partner** | 10% (base only) | 0% | 90% |

**Note**: Partner bonus (extra 5% to builder) is only activated AFTER builder is verified (5 counterparties + $1,000 GMV). This prevents gaming where fake builder+partner pairs immediately earn maximum rates.

### 3.2 Transaction Example

```
Transaction: $100 USDC settled

Owner (Provider) receives: $99.00 (99%)
Protocol Fee:              $1.00 (1%)

VERIFIED builder WITH partner (e.g., "JACK"):
├── Builder:  $0.15 (15% of $1.00) = 10% base + 5% bonus
├── Partner:  $0.05 (5% of $1.00)
└── Treasury: $0.80 (80% of $1.00)

UNVERIFIED builder WITH partner (bonus not yet unlocked):
├── Builder:  $0.10 (10% of $1.00) = base only
├── Partner:  $0.05 (5% of $1.00)
└── Treasury: $0.85 (85% of $1.00)

Builder WITHOUT partner (verified or not):
├── Builder:  $0.10 (10% of $1.00) = base only
├── Partner:  $0.00
└── Treasury: $0.90 (90% of $1.00)
```

### 3.3 Partner Bonus Rationale

**Why builders get a bonus for using partner codes**:
- Solves "why would builder register partner code?" problem
- Builder WITHOUT partner: 10% (base rate)
- **Verified** builder WITH partner: 15% (+50% more revenue)
- Unverified builder WITH partner: 10% (bonus not yet unlocked)
- Creates direct incentive for builders to participate in partner program
- Partners become valuable to builders (they unlock bonus revenue after verification)
- Verification requires: 5 unique counterparties + $1,000 GMV (see Section 8.3.1)

### 3.4 Treasury Runway Protection

**Circuit Breaker Mechanism**:

The protocol includes protection mechanism for treasury sustainability with configurable parameters.

**Parameters**:
```solidity
uint256 public MIN_RUNWAY_USD = 15_000e6;  // $15,000 USDC (3 months × $5,000)
// Configurable by admin (governance parameter)
```

**Activation**:
```
IF realTreasuryBalance < MIN_RUNWAY_USD:
    THEN activate circuit breaker
    - Builder share: REDUCED to 50% (7.5% instead of 15%, or 5% instead of 10%)
    - Partner share: REDUCED to 50% (2.5% instead of 5%)
    - Treasury receives the difference
```

**Fee Distribution During Circuit Breaker**:

| Scenario | Normal | Circuit Breaker Active |
|----------|--------|------------------------|
| Builder (with partner) | 15% | 7.5% |
| Builder (no partner) | 10% | 5% |
| Partner | 5% | 2.5% |
| Treasury | 80-90% | 85-92.5% |

**Activation/Deactivation**:
- **Activation**: AUTOMATIC on every `recordGMV()` call (real-time protection)
- **Deactivation**: MANUAL (admin confirms treasury is healthy)

**Key Design Decision: Check on recordGMV, not claim()**

Previous design (flawed):
- Circuit breaker checked only on `claim()` calls
- In low-claim periods, protection never activates
- Treasury could drain without triggering protection

**New design (secure)**:
- Circuit breaker checked on EVERY `recordGMV()` call
- Uses REAL USDC balance (not internal variable)
- Cannot be manipulated by admin
- Real-time protection

```solidity
bool public circuitBreakerActive;

/// @notice Calculate real treasury balance from actual USDC, not internal variable
/// @dev Returns 0 if underflow would occur (safe math) - this triggers circuit breaker
function _calculateRealTreasuryBalance() internal view returns (uint256) {
    uint256 vaultBalance = usdc.balanceOf(address(revenueVault));
    uint256 totalPending = totalPendingBuilderClaims + totalPendingPartnerClaims;

    // SAFE: Return 0 if underflow would occur (don't revert!)
    // This ensures recordGMV NEVER reverts, even in edge cases
    if (vaultBalance <= totalPending) {
        return 0; // Triggers circuit breaker (0 < MIN_RUNWAY_USD)
    }
    return vaultBalance - totalPending;
}

/// @notice Called by ACTPKernel on every settlement - NEVER pausable
function recordGMV(...) external onlyKernel {
    // Real-time circuit breaker check using actual USDC balance
    uint256 realTreasury = _calculateRealTreasuryBalance();

    if (realTreasury < MIN_RUNWAY_USD) {
        if (!circuitBreakerActive) {
            circuitBreakerActive = true;
            emit CircuitBreakerActivated(realTreasury, MIN_RUNWAY_USD);
        }
    }

    // Distribute with appropriate rates (reduced if CB active)
    _distributeRevenue(builder, partner, feeAmount, circuitBreakerActive);
}

function deactivateCircuitBreaker() external onlyAdmin {
    require(circuitBreakerActive, "Not active");
    uint256 realTreasury = _calculateRealTreasuryBalance();
    require(realTreasury >= MIN_RUNWAY_USD * 2, "Treasury not healthy enough");
    circuitBreakerActive = false;
    emit CircuitBreakerDeactivated(realTreasury);
}
```

**Why Real Balance?**
- Internal `treasuryBalance` variable could be manipulated
- `usdc.balanceOf()` is on-chain truth, tamper-proof
- Calculation accounts for pending claims (not yet withdrawn)

**This is the ONLY dynamic adjustment in V1**. All other fee percentages are fixed.

### 3.5 Claimable Balance Model

**Pull vs Push**:
- Fees accumulate in claimable balances (not sent per-transaction)
- Builder/Partner must call `claim()` to withdraw
- Gas-efficient: One claim for many transactions
- Minimum claim: 1 USDC

**Balance Tracking**:
```solidity
mapping(address => uint256) public builderBalances;
mapping(address => uint256) public partnerBalances;
uint256 public treasuryBalance;
```

### 3.6 Partner Guarantees (What's Permanent vs Variable)

**CRITICAL DISTINCTION**: Partner ATTRIBUTION is permanent. Partner RATE is variable.

#### What is PERMANENT (immutable, on-chain):

| Guarantee | Description |
|-----------|-------------|
| **Attribution** | Partner linked to builder NEVER changes |
| **Right to receive** | Partner's right to receive share cannot be revoked (only suspended for fraud) |
| **Historical earnings** | Accumulated balance is always claimable |

#### What is VARIABLE (governance-controlled):

| Parameter | Current | Limits | Change Process |
|-----------|---------|--------|----------------|
| Partner share % | 5% | Min 2.5%, Max 10% | 30-day notice + 7-day timelock |
| Circuit breaker reduction | 50% | Fixed | Automatic (treasury < $15k) |

#### Limits on Variability:

- **Minimum partner share**: 2.5% (cannot go below)
- **Maximum reduction**: 50% (circuit breaker only, temporary)
- **Change notice**: 30 days public announcement
- **Timelock**: 7 days after notice period

```solidity
uint16 public constant MIN_PARTNER_SHARE_BPS = 250;  // 2.5% minimum guaranteed
uint16 public constant MAX_PARTNER_SHARE_BPS = 1000; // 10% maximum

function setPartnerShare(uint16 newBps) external onlyAdmin {
    require(newBps >= MIN_PARTNER_SHARE_BPS, "Below minimum");
    require(newBps <= MAX_PARTNER_SHARE_BPS, "Above maximum");
    require(block.timestamp >= lastChangeScheduled + 30 days, "Notice period");
    // ... timelock logic
}
```

### 3.7 Fee Impact Clarification

**Partner share comes from PROTOCOL FEE, not owner revenue.**

Owner always receives 99% regardless of partner attribution.
Partner share (5% of 1% = 0.05% of GMV) is internal protocol distribution.

| Scenario | Owner Gets | Protocol Gets | Partner Impact on Owner |
|----------|------------|---------------|------------------------|
| With Partner | 99% | 1% | **NONE** |
| Without Partner | 99% | 1% | **NONE** |

**This means:**
- Enterprise buyers are NOT affected by partner attribution
- Partner share is a protocol treasury allocation decision
- No "perpetual tax" on agent ownership transfers

---

## 4. Smart Contract Architecture

### 4.1 Contract Overview

```
┌─────────────────────────────────────────────────────────┐
│                      RevenueVault.sol                   │
│  - Holds ALL USDC for builder/partner/treasury          │
│  - Single source of truth for balances                  │
│  - Pull-based claims                                    │
└─────────────────────────────────────────────────────────┘
                           │
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ BuilderRegistry │ │ PartnerRegistry │ │  AgentFactory   │
│  - Builder data │ │  - Partner data │ │  - Deploy agents│
│  - GMV tracking │ │  - Code hashes  │ │  - Ownership    │
│  - Agent mapping│ │  - Referrals    │ │  - CREATE2      │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

**AgentFactory CREATE2 Security**:

The AgentFactory uses CREATE2 with **sender-bound salt** to prevent front-running attacks:

```solidity
function deployAgent(bytes calldata bytecode, bytes32 userSalt) external returns (address agent) {
    // Bind salt to msg.sender - prevents front-running
    bytes32 effectiveSalt = keccak256(abi.encodePacked(msg.sender, userSalt));

    assembly {
        agent := create2(0, add(bytecode, 0x20), mload(bytecode), effectiveSalt)
    }
    // ...
}
```

**Why this matters**:
- If attacker copies tx from mempool and submits from different address
- The `effectiveSalt` will be different (includes msg.sender)
- Resulting agent address will be different
- Attacker cannot steal deployer attribution

### 4.2 Contract Interfaces

#### 4.2.1 IBuilderRegistry

```solidity
interface IBuilderRegistry {
    struct Builder {
        address wallet;
        uint256 lifetimeGMV;
        uint256 lifetimeEarnings;
        uint256 registeredAt;
        bool isActive;
        bool quarantined;
    }

    struct AgentRegistration {
        address agent;
        address owner;
        address builder;
        address referredBy;    // Partner - PERMANENT
        uint256 registeredAt;
        bool active;
    }

    /// @notice Computed stats for badge eligibility (AIP-10)
    /// @dev successRate calculation defined in §4.2.1.1
    struct BuilderStats {
        uint256 totalGMV;           // Lifetime GMV in USDC (6 decimals)
        uint256 uniqueCounterparties; // Count of unique addresses transacted with
        uint256 successRate;        // Success rate in basis points (9500 = 95%)
        uint256 registeredAt;       // Unix timestamp of registration
        uint8 status;               // 0=TRIAL, 1=ACTIVE, 2=VERIFIED
        address partner;            // Linked partner (from AgentRegistration.referredBy)
    }

    /// @dev §4.2.1.1 Success Rate Calculation
    ///
    /// Formula: successRate = (settled / total) * 10000
    ///
    /// Transaction outcomes:
    /// - SETTLED: Counted as successful
    /// - DISPUTED (any resolution): Counted as failed
    /// - CANCELLED_REQUESTER: Counted as failed (provider accepted but requester cancelled)
    /// - DEADLINE_EXPIRED: Counted as failed (provider didn't deliver)
    /// - CANCELLED_PROVIDER: NOT counted (provider's choice, not a failure)
    ///
    /// Edge case: 0 total transactions = 10000 (100%) to allow new builders to claim badges
    ///
    /// Implementation:
    /// ```solidity
    /// function _calculateSuccessRate(address builder) internal view returns (uint256) {
    ///     uint256 settled = settledCount[builder];
    ///     uint256 failed = disputedCount[builder] + cancelledByRequesterCount[builder] + expiredCount[builder];
    ///     uint256 total = settled + failed;
    ///
    ///     if (total == 0) return 10000; // New builder = 100%
    ///     return (settled * 10000) / total;
    /// }
    /// ```

    /// @notice Computed stats for partner badge eligibility (AIP-10)
    struct PartnerStats {
        uint256 activeBuilderCount;   // Number of active builders referred
        uint256 totalBuilderCount;    // Total builders referred (including inactive)
        uint256 totalGMVReferred;     // Sum of GMV from all referred builders
        uint8 status;                 // 0=PENDING, 1=ACTIVE, 2=SUSPENDED
    }

    // Builder functions
    function registerBuilder(bytes32 partnerCode) external;
    function getBuilder(address wallet) external view returns (Builder memory);
    function rotateBuilderWallet(address newWallet) external;
    function updateAgentBuilder(address agent) external;
    function getRotationInfo(address wallet) external view returns (
        uint256 chainDepth,
        address chainEndWallet,
        address revenueWallet,
        bool revenueAtRisk,
        bool chainTruncated
    );

    // Agent functions (requires owner EIP-712 signature)
    function registerAgent(
        address agent,
        address owner,
        bytes calldata ownerSignature
    ) external;
    function getAgent(address agent) external view returns (AgentRegistration memory);

    // Owner functions
    function transferOwnership(address agent, address newOwner) external;
    function initiateBuilderReplacement(address agent, address newBuilder) external;
    function executeBuilderReplacement(address agent) external;
    function cancelBuilderReplacement(address agent) external;
    function deactivateAgent(address agent) external;

    // Builder self-service
    function resign(address agent) external;
    function claimBuilderEarnings() external;

    // Protocol integration (called by ACTPKernel)
    function recordGMV(
        bytes32 txId,
        address agent,
        address counterparty,
        uint256 amount,
        uint256 feeAmount
    ) external;

    // Stats view functions (for AIP-10 badge eligibility)
    function getBuilderStats(address builder) external view returns (BuilderStats memory);
    function getPartnerStats(address partner) external view returns (PartnerStats memory);
    function getBuilderOf(address agent) external view returns (address);

    // Events
    event BuilderRegistered(address indexed builder);
    event AgentRegistered(address indexed agent, address indexed owner, address indexed builder, address referredBy);
    event BuilderReplaced(address indexed agent, address indexed oldBuilder, address indexed newBuilder);
    event OwnershipTransferred(address indexed agent, address indexed oldOwner, address indexed newOwner);
    event GMVRecorded(address indexed builder, bytes32 indexed txId, uint256 amount);
}
```

#### 4.2.2 IPartnerRegistry

```solidity
interface IPartnerRegistry {
    struct Partner {
        address wallet;
        bytes32 codeHash;
        uint256 referredBuilders;
        uint256 lifetimeCommission;
        uint256 registeredAt;
        PartnerStatus status;
    }

    enum PartnerStatus { PENDING, ACTIVE, SUSPENDED }

    // Admin-only registration (no self-registration)
    function approvePartner(address partner, string calldata code) external;
    function suspendPartner(address partner) external;
    function unsuspendPartner(address partner) external;

    // View functions
    function getPartner(address wallet) external view returns (Partner memory);
    function getPartnerByCode(string calldata code) external view returns (address);
    function getPartnerByCodeHash(bytes32 codeHash) external view returns (address);
    function isPartnerActive(address partner) external view returns (bool);

    // Partner self-service
    function claimPartnerEarnings() external;
    function rotatePartnerWallet(address newWallet) external;

    // Events
    event PartnerApproved(address indexed partner, string code, bytes32 indexed codeHash, address approvedBy);
    event PartnerSuspended(address indexed partner, address suspendedBy);
    event PartnerUnsuspended(address indexed partner, address unsuspendedBy);
    event BuilderReferred(address indexed partner, address indexed builder);
}
```

#### 4.2.3 IRevenueVault

```solidity
interface IRevenueVault {
    function distributeRevenue(
        bytes32 txId,
        address builder,
        address partner,
        uint256 feeAmount
    ) external;

    function transferToBuilder(address builder) external;
    function transferToPartner(address partner) external;
    function sendToTreasury(uint256 amount) external;

    function getBuilderBalance(address builder) external view returns (uint256);
    function getPartnerBalance(address partner) external view returns (uint256);
    function getTreasuryBalance() external view returns (uint256);

    // Events
    event RevenueDistributed(
        bytes32 indexed txId,
        address indexed builder,
        address indexed partner,
        uint256 builderAmount,
        uint256 partnerAmount,
        uint256 treasuryAmount
    );
    event Claimed(address indexed account, uint256 amount, string accountType);
}
```

### 4.3 Integration with ACTPKernel

**Settlement Hook**:

When a transaction reaches SETTLED state, ACTPKernel calls:

```solidity
// In ACTPKernel.releaseEscrow()
builderRegistry.recordGMV(
    txId,
    transaction.provider,    // agent that provided service
    transaction.requester,   // counterparty for fraud detection
    transaction.amount,      // GMV for tracking
    platformFee              // fee to distribute
);
```

**Fail-Safe Design**:
- `recordGMV()` NEVER reverts
- If agent not registered → fee goes to treasury
- Core protocol settlement is not blocked by B&P extension

---

## 5. Registration Flows

### 5.0 Registration Overview

| Role | Registration Method | Approval Required? | Identity System |
|------|---------------------|-------------------|-----------------|
| **Agent** | `registerAgent()` by builder + owner signature | **YES (owner sig)** | AIP-7 DID (required) |
| **Owner** | Signs EIP-712 approval for agent registration | No registry | Just address |
| **Builder** | `registerBuilder()` with optional partner code | No | BuilderRegistry |
| **Partner** | `applyForPartner()` + admin approval | **YES** | PartnerRegistry |

**Key Principles**:
1. Partners require approval because they earn perpetually from others' work
2. Builders don't require approval (self-correcting via market)
3. **Agent registration requires owner EIP-712 signature** to prevent front-running/squatting
4. **Partner attribution is per-BUILDER, not per-agent** - once a builder registers with a partner, ALL their agents benefit that partner

### 5.1 Partner Registration (Approval Required)

**Why Approval?**
- Partners earn 5% PERPETUALLY from all referred builders
- Without approval, builders could create fake partner accounts to self-refer
- Approval ensures partners have real distribution channels (audience, community, clients)

**Application Process**:
```
1. Partner submits application (off-chain form)
   ├── Proof of distribution channel:
   │   ├── YouTube/Twitter with X followers
   │   ├── Skool/Discord community
   │   ├── Existing client portfolio
   │   └── OR: Referral from existing partner
   │
2. Admin reviews application
   ├── APPROVE → Partner code activated
   ├── REJECT → Application denied
   └── REQUEST_INFO → Need more details

3. On approval: on-chain registration
```

```typescript
// SDK Example (after approval)
const registry = new PartnerRegistry(signer, networkConfig);

// Admin approves partner with their chosen code
const tx = await registry.approvePartner(partnerWallet, "JACK");
await tx.wait();

// Partner code is now active
```

**On-Chain** (with case-insensitive normalization):
```solidity
// Only admin can approve partners
function approvePartner(address partner, string calldata code) external onlyAdmin {
    require(partners[partner].wallet == address(0), "Already registered");
    require(bytes(code).length >= 3 && bytes(code).length <= 20, "Code 3-20 chars");

    // ON-CHAIN NORMALIZATION: Convert to uppercase before hashing
    bytes32 codeHash = _normalizeAndHash(code);
    require(codeToPartner[codeHash] == address(0), "Code taken");

    partners[partner] = Partner({
        wallet: partner,
        codeHash: codeHash,
        referredBuilders: 0,
        lifetimeCommission: 0,
        registeredAt: block.timestamp,
        status: PartnerStatus.ACTIVE
    });

    codeToPartner[codeHash] = partner;

    // Emit original code for UX (subgraph indexes this)
    emit PartnerApproved(partner, code, codeHash, msg.sender);
}

/// @notice Normalize partner code to uppercase and hash
/// @dev Ensures "jack", "JACK", "Jack" all produce same hash
function _normalizeAndHash(string calldata code) internal pure returns (bytes32) {
    bytes memory b = bytes(code);
    for (uint i = 0; i < b.length; i++) {
        // Convert lowercase a-z (0x61-0x7A) to uppercase A-Z (0x41-0x5A)
        if (b[i] >= 0x61 && b[i] <= 0x7A) {
            b[i] = bytes1(uint8(b[i]) - 32);
        }
    }
    return keccak256(b);
}

/// @notice Lookup partner by code (case-insensitive)
function getPartnerByCode(string calldata code) external view returns (address) {
    bytes32 codeHash = _normalizeAndHash(code);
    return codeToPartner[codeHash];
}
```

**Partner Code Storage Design**:

| Component | Storage | Purpose |
|-----------|---------|---------|
| `codeHash` (bytes32) | On-chain | Gas-efficient lookup and validation |
| `code` (string) | Event only | UX recovery, subgraph indexing |

### 5.2 Builder Registration (Per-Builder Partner Attribution)

**Key Decision**: Partner attribution is per-BUILDER, locked at builder registration.

**Why Per-Builder?**
- Matches narrative: "Partner refers Builder" (not individual agents)
- Prevents partner hopping (builder using different codes per agent)
- Stronger partner value proposition
- Simplicity: one builder → one partner relationship

**Registration Options**:
1. **With Partner**: `registerBuilder(partnerCode)` - partner locked FOREVER
2. **Without Partner**: `registerBuilder(bytes32(0))` - no partner, base rate only

```solidity
mapping(address => address) public builderToPartner; // PERMANENT

function registerBuilder(bytes32 partnerCode) external {
    require(!isBuilder[msg.sender], "Already registered");

    address partner = address(0);
    if (partnerCode != bytes32(0)) {
        partner = codeToPartner[partnerCode];
        require(partner != address(0), "Invalid partner code");
        require(partner != msg.sender, "Cannot self-refer");
    }

    builderToPartner[msg.sender] = partner; // LOCKED FOREVER
    isBuilder[msg.sender] = true;

    builders[msg.sender] = Builder({
        wallet: msg.sender,
        registeredAt: block.timestamp,
        lifetimeGMV: 0,
        lifetimeEarnings: 0,
        isActive: true,
        quarantined: false
    });

    emit BuilderRegistered(msg.sender, partner);
    if (partner != address(0)) {
        emit BuilderReferred(partner, msg.sender);
    }
}
```

**Note**: Builder can register implicitly (without partner) at first `registerAgent()` call, but CANNOT add partner later.

### 5.3 Agent Registration (Requires Owner Signature)

**Security**: Agent registration requires EIP-712 signature from owner to prevent:
- Front-running attacks (attacker registers agent before legitimate builder)
- Agent squatting (claiming ownership of agents you don't own)
- Permanent wrong partner attribution

```typescript
// SDK Example
const factory = new AgentFactory(signer, networkConfig);
const registry = new BuilderRegistry(signer, networkConfig);

// Step 1: Deploy agent via factory
const agentAddress = await factory.deployAgent(agentBytecode, salt);

// Step 2: Owner signs EIP-712 approval
const domain = { name: "AGIRAILS", version: "1", chainId: 84532, verifyingContract: registry.address };
const types = {
    RegisterAgent: [
        { name: "agent", type: "address" },
        { name: "owner", type: "address" },
        { name: "builder", type: "address" },
        { name: "nonce", type: "uint256" }
    ]
};
const ownerSignature = await ownerSigner._signTypedData(domain, types, {
    agent: agentAddress,
    owner: businessWallet,
    builder: builderWallet,
    nonce: await registry.nonces(businessWallet)
});

// Step 3: Builder registers agent with owner signature
const tx = await registry.registerAgent(agentAddress, businessWallet, ownerSignature);
await tx.wait();

// Agent is now registered:
// - Owner: businessWallet (verified via signature)
// - Builder: msg.sender (auto-registered if new)
// - Partner: From builder's registration (per-BUILDER, not per-agent)
```

**On-Chain Implementation**:

```solidity
bytes32 constant REGISTER_AGENT_TYPEHASH = keccak256(
    "RegisterAgent(address agent,address owner,address builder,uint256 nonce)"
);

function registerAgent(
    address agent,
    address owner,
    bytes calldata ownerSignature
) external {
    require(owner != address(0), "Invalid owner");
    require(agents[agent].agent == address(0), "Already registered");

    // Verify owner signature (prevents front-running/squatting)
    bytes32 structHash = keccak256(abi.encode(
        REGISTER_AGENT_TYPEHASH,
        agent,
        owner,
        msg.sender, // builder
        nonces[owner]++
    ));
    require(_verifySignature(owner, structHash, ownerSignature), "Invalid owner signature");

    // Auto-register builder if needed (without partner - too late to add)
    if (!isBuilder[msg.sender]) {
        _registerBuilder(msg.sender, bytes32(0));
    }

    // Partner comes from BUILDER registration, not this call
    address partner = builderToPartner[msg.sender];

    agents[agent] = AgentRegistration({
        agent: agent,
        owner: owner,
        builder: msg.sender,
        referredBy: partner,
        registeredAt: block.timestamp,
        active: true
    });

    emit AgentRegistered(agent, owner, msg.sender, partner);
}
```

### 5.4 Owner (No Registration)

**Key Decision**: Owner is NOT registered separately. Owner signs EIP-712 approval at agent registration.

**Why No Registration?**
- Owner can be any valid address: EOA, multisig, DAO, contract
- Maximum flexibility
- EIP-712 signature proves ownership intent
- No reason to gatekeep

**Why Require Signature?**
- Prevents front-running (attacker can't register agent they don't own)
- Prevents squatting (can't claim random addresses as "your" agents)
- Owner explicitly approves builder assignment

---

## 6. Ownership & Attribution

### 6.1 Owner Functions

| Function | Description | Effect |
|----------|-------------|--------|
| `transferOwnership(agent, newOwner)` | Transfer agent to new owner | New owner controls agent |
| `initiateBuilderReplacement(agent, newBuilder)` | Start 30-day notice period | Old builder notified, continues earning |
| `executeBuilderReplacement(agent)` | Complete replacement after notice | Old builder stops earning, new starts |
| `cancelBuilderReplacement(agent)` | Cancel pending replacement | Old builder continues |
| `deactivateAgent(agent)` | Pause agent | No transactions allowed |

**Note**: To stop paying a builder without replacement, owner can either:
1. Replace builder with a treasury-controlled address (fees accumulate for protocol)
2. Deactivate agent entirely (no more transactions)

### 6.1.1 Builder Replacement (30-Day Notice Period)

**Why Notice Period?**
- Builder invested effort in agent development
- Immediate replacement is unfair ("rug pull")
- 30 days allows builder to:
  - Complete ongoing work
  - Find new clients
  - Transition gracefully

**Process**:
```
Day 0:  Owner calls initiateBuilderReplacement(agent, newBuilder)
        → Event emitted, old builder notified
        → Old builder CONTINUES earning for 30 days

Day 30: Owner calls executeBuilderReplacement(agent)
        → Old builder stops earning
        → New builder starts earning
        → Old builder KEEPS all accumulated balance
```

**Implementation**:
```solidity
struct PendingReplacement {
    address newBuilder;
    uint256 effectiveAt;
}

mapping(address => PendingReplacement) public pendingReplacements;
uint256 public constant BUILDER_NOTICE_PERIOD = 30 days;

function initiateBuilderReplacement(address agent, address newBuilder) external {
    require(msg.sender == agents[agent].owner, "Not owner");
    require(newBuilder != address(0), "Invalid builder");
    require(isBuilder[newBuilder], "New builder not registered");

    pendingReplacements[agent] = PendingReplacement({
        newBuilder: newBuilder,
        effectiveAt: block.timestamp + BUILDER_NOTICE_PERIOD
    });

    emit BuilderReplacementInitiated(
        agent,
        agents[agent].builder,
        newBuilder,
        block.timestamp + BUILDER_NOTICE_PERIOD
    );
}

function executeBuilderReplacement(address agent) external {
    require(msg.sender == agents[agent].owner, "Not owner");
    PendingReplacement memory pending = pendingReplacements[agent];
    require(pending.effectiveAt != 0, "No pending replacement");
    require(block.timestamp >= pending.effectiveAt, "Notice period not over");

    address oldBuilder = agents[agent].builder;
    agents[agent].builder = pending.newBuilder;
    delete pendingReplacements[agent];

    // Note: Partner attribution does NOT change (per-builder, locked to original)
    // New builder inherits the agent but NOT the partner relationship

    emit BuilderReplaced(agent, oldBuilder, pending.newBuilder);
}

function cancelBuilderReplacement(address agent) external {
    require(msg.sender == agents[agent].owner, "Not owner");
    require(pendingReplacements[agent].effectiveAt != 0, "No pending replacement");

    delete pendingReplacements[agent];
    emit BuilderReplacementCancelled(agent);
}
```

**Edge Cases**:
- Owner can cancel pending replacement anytime before execution
- If agent is deactivated during notice, replacement still valid
- Old builder can still claim earnings after replacement

### 6.2 Builder Functions

| Function | Description | Effect |
|----------|-------------|--------|
| `resign(agent)` | Voluntarily stop earning | Builder share → Treasury |
| `claimBuilderEarnings()` | Withdraw accumulated balance | USDC sent to wallet |

### 6.3 Partner Functions

| Function | Description | Effect |
|----------|-------------|--------|
| `claimPartnerEarnings()` | Withdraw accumulated balance | USDC sent to wallet |

**Note**: Partners have NO power over agent or builder. They simply earn from transactions.

### 6.4 Wallet Rotation vs Role Replacement

**Critical Distinction**:
- **Rotation** = Same person, new wallet → Balance TRANSFERS to new address
- **Replacement** = Different person → Balance STAYS with old address

#### 6.4.1 Wallet Rotation Functions

| Role | Function | Who Calls | Balance |
|------|----------|-----------|---------|
| Owner | `transferOwnership(agent, newAddr)` | Current owner | N/A (direct payments) |
| Builder | `rotateBuilderWallet(newWallet)` | Current builder | TRANSFERS |
| Partner | `rotatePartnerWallet(newAddr)` | Current partner | TRANSFERS |

```solidity
// Tracks wallet rotation chain for revenue forwarding
mapping(address => address) public walletRotatedTo;

// Builder rotates their OWN wallet (same person, new address)
// IMPORTANT: This migrates ALL builder state, not just balance
function rotateBuilderWallet(address newWallet) external {
    require(isBuilder[msg.sender], "Not builder");
    require(newWallet != address(0), "Invalid wallet");
    require(!isBuilder[newWallet], "New wallet already a builder");

    // CRITICAL: Prevent rotation cycles (A→B→A)
    // newWallet must be "fresh" - never rotated away from
    // This prevents:
    // 1. Cycles: A→B, then B→A would create A→B→A loop
    // 2. Inheriting someone else's broken chain
    require(walletRotatedTo[newWallet] == address(0), "Target has rotation history");

    address oldWallet = msg.sender;

    // 1. Transfer accumulated balance
    uint256 balance = builderBalances[oldWallet];
    builderBalances[oldWallet] = 0;
    builderBalances[newWallet] = balance;

    // 2. Migrate partner attribution (CRITICAL!)
    builderToPartner[newWallet] = builderToPartner[oldWallet];
    delete builderToPartner[oldWallet];

    // 3. Migrate builder record (stats, verification)
    builders[newWallet] = builders[oldWallet];
    builders[newWallet].wallet = newWallet;
    delete builders[oldWallet];

    // 4. Migrate counterparty count (for verification)
    builderCounterpartyCount[newWallet] = builderCounterpartyCount[oldWallet];
    builderCounterpartyCount[oldWallet] = 0;
    // NOTE: builderCounterparties mapping is NOT migrated (gas prohibitive)
    //
    // COUNTERPARTY TRACKING AFTER ROTATION:
    // - Count is preserved (e.g., 10 → 10)
    // - Same counterparties may be counted again with new wallet (double-counting)
    // - This is ACCEPTABLE because:
    //   1. Verification is boolean threshold (≥5 + $1000) - already passed
    //   2. Health Score is calculated OFF-CHAIN with full transaction history
    //   3. Gas cost of migrating all counterparty mappings is prohibitive
    // - No economic impact: builder doesn't earn more from inflated count

    // 5. Update builder status
    isBuilder[newWallet] = true;
    isBuilder[oldWallet] = false;

    // 6. Set claim cooldown (security)
    lastWalletChange[newWallet] = block.timestamp;

    // 7. CRITICAL: Set rotation forward pointer (for revenue forwarding)
    // This allows recordGMV to credit the NEW wallet even if agent
    // references still point to oldWallet
    walletRotatedTo[oldWallet] = newWallet;

    emit BuilderWalletRotated(oldWallet, newWallet);

    // 8. SOFT BLOCK: Check if any agents referencing old wallets are now at risk
    // This doesn't prevent rotation, but emits a warning for SDK/UI to catch
    // Note: We check the OLD wallet's chain depth BEFORE this rotation was added
    //       So if oldWallet was already at depth 2, this rotation makes it 3 (at risk)
    (uint256 priorDepth, , , bool wasAtRisk, ) = getRotationInfo(oldWallet);

    // After this rotation, depth increased by 1
    bool nowAtRisk = (priorDepth + 1) > 3;
    bool nowUnrecoverable = (priorDepth + 1) > 10;

    if (nowUnrecoverable) {
        emit RotationChainUnrecoverable(oldWallet, newWallet, priorDepth + 1);
    } else if (nowAtRisk && !wasAtRisk) {
        // Just crossed into "at risk" territory
        emit RotationChainAtRisk(oldWallet, newWallet, priorDepth + 1);
    }
}

// Events for rotation chain warnings
event RotationChainAtRisk(
    address indexed oldWallet,
    address indexed newWallet,
    uint256 chainDepth
);
event RotationChainUnrecoverable(
    address indexed oldWallet,
    address indexed newWallet,
    uint256 chainDepth
);

// ⚠️ ROTATION & REVENUE RESOLUTION:
// Revenue distribution uses 3-hop resolution (_resolveCurrentBuilder)
// Agent updates use 10-hop resolution (getRotationInfo.chainEndWallet)
//
// RECOVERY TIERS:
// ┌─────────────────┬────────────────────────────────────────────────┐
// │ Chain Length    │ Status                                         │
// ├─────────────────┼────────────────────────────────────────────────┤
// │ 1-3 rotations   │ ✅ SAFE: Revenue goes to current wallet        │
// │ 4-10 rotations  │ ⚠️ RECOVERABLE: Revenue lost until update      │
// │ >10 rotations   │ ❌ UNRECOVERABLE: updateAgentBuilder reverts   │
// └─────────────────┴────────────────────────────────────────────────┘
//
// SCENARIO: A→B→C→D→E (4 rotations, agent still points to A)
// - Revenue: Goes to D (3 hops from A) - E doesn't receive!
// - Update:  E CAN call updateAgentBuilder (within 10-hop limit)
// - After update: Agent points to E, future revenue goes to E
//
// BEST PRACTICE: Update agents BEFORE exceeding 3 rotations
// HARD LIMIT: Never exceed 10 rotations without updating agents!

// Update agent's builder reference after wallet rotation
// SECURITY: Only the CURRENT wallet (end of FULL rotation chain) can call this
// NOTE: This uses 10-hop traversal, NOT 3-hop revenue resolution
//       Recovery is possible when revenueAtRisk == true (4-10 hops)
//       Recovery is IMPOSSIBLE when chainTruncated == true (>10 hops)
function updateAgentBuilder(address agent) external {
    address oldBuilder = agents[agent].builder;

    // Get full chain info (all 5 return values)
    (
        ,                       // chainDepth - not needed
        address chainEndWallet, // wallet at end of 10-hop chain
        ,                       // revenueWallet - not needed
        ,                       // revenueAtRisk - not needed
        bool chainTruncated     // TRUE if chain > 10 hops
    ) = getRotationInfo(oldBuilder);

    // CRITICAL: If chain is truncated, chainEndWallet is NOT the true end
    // Recovery is impossible - the true current wallet cannot be determined
    require(!chainTruncated, "Chain >10 hops: recovery impossible");

    // Caller must be at the end of the rotation chain
    require(chainEndWallet == msg.sender, "Not current wallet in rotation chain");

    // Verify rotation actually happened (not same address)
    require(oldBuilder != msg.sender, "No rotation occurred");

    // Caller must be a registered builder (should be true after rotation)
    require(isBuilder[msg.sender], "Not a builder");

    agents[agent].builder = msg.sender;
    emit AgentBuilderUpdated(agent, oldBuilder, msg.sender);

    // After update, agent now points directly to current wallet
    // Revenue will go to msg.sender (no more chain resolution needed for this agent)
}

// Partner rotates their wallet (same person, new address)
function rotatePartnerWallet(address newWallet) external {
    require(partners[msg.sender].wallet != address(0), "Not partner");
    require(newWallet != address(0), "Invalid wallet");

    address oldWallet = msg.sender;

    // Transfer accumulated balance
    uint256 balance = partnerBalances[oldWallet];
    partnerBalances[oldWallet] = 0;
    partnerBalances[newWallet] += balance;

    // Update partner wallet
    partners[newWallet] = partners[oldWallet];
    partners[newWallet].wallet = newWallet;
    delete partners[oldWallet];

    // Update code mapping
    codeToPartner[partners[newWallet].codeHash] = newWallet;

    emit PartnerWalletRotated(oldWallet, newWallet);
}
```

#### 6.4.2 Role Replacement (Different Person)

| Action | Function | Who Calls | Old Person's Balance |
|--------|----------|-----------|---------------------|
| Replace builder | `initiateBuilderReplacement()` + `executeBuilderReplacement()` | Owner | KEEPS (can still claim) |
| Suspend partner | `suspendPartner(partner)` | Admin | KEEPS (frozen) |

**Note**: Builder replacement requires 30-day notice period (see Section 6.1.1).

```solidity
// Builder replacement flow (30-day notice required)
// Step 1: Owner initiates (starts 30-day countdown)
function initiateBuilderReplacement(address agent, address newBuilder) external {
    require(msg.sender == agents[agent].owner, "Not owner");
    // ... see Section 6.1.1 for full implementation
}

// Step 2: After 30 days, owner executes
function executeBuilderReplacement(address agent) external {
    require(msg.sender == agents[agent].owner, "Not owner");
    PendingReplacement memory pending = pendingReplacements[agent];
    require(pending.effectiveAt != 0, "No pending replacement");
    require(block.timestamp >= pending.effectiveAt, "Too early");

    address oldBuilder = agents[agent].builder;
    address newBuilder = pending.newBuilder; // Cache BEFORE delete

    agents[agent].builder = newBuilder;

    // CRITICAL: Partner attribution does NOT change!
    // agents[agent].referredBy stays the same (original partner)

    // Old builder KEEPS their accumulated balance
    // New builder starts earning from 0

    delete pendingReplacements[agent];
    emit BuilderReplaced(agent, oldBuilder, newBuilder); // Use cached value
}
```

#### 6.4.3 Lost Wallet = Lost Access

**"Not your keys, not your coins"**

| Role | Lost Wallet | Consequence |
|------|-------------|-------------|
| Owner | Cannot call any owner functions | Agent is permanently "locked" |
| Builder | Cannot rotate or claim | Owner can initiate builder replacement (30-day notice) |
| Partner | Cannot rotate or claim | Balance is lost, attribution continues |

**NO RECOVERY MECHANISM** by design:
- Recovery = admin backdoor = attack vector
- Industry standard (all crypto protocols)
- Users must backup keys and use multisig for high-value roles

**Recommended Practices**:
1. Use hardware wallet (Ledger, Trezor) for registration
2. Use multisig (Gnosis Safe) for Owner role
3. Rotate wallets periodically while you have access
4. Never use "hot" daily wallet for permanent roles

### 6.5 Attribution Permanence

**Builder Replacement Flow** (30-day notice required - see Section 6.1.1):

```solidity
// NO direct replaceBuilder function exists
// Builder replacement MUST go through notice flow:
//   1. Owner calls initiateBuilderReplacement(agent, newBuilder)
//   2. Wait 30 days
//   3. Owner calls executeBuilderReplacement(agent)

// In executeBuilderReplacement():
function executeBuilderReplacement(address agent) external {
    // ... validation ...
    PendingReplacement memory pending = pendingReplacements[agent];
    address oldBuilder = agents[agent].builder;
    address newBuilder = pending.newBuilder; // Cache before any state changes

    agents[agent].builder = newBuilder;
    delete pendingReplacements[agent];

    // CRITICAL: referredBy (partner) NEVER changes
    // Partner attribution is permanent by design

    emit BuilderReplaced(agent, oldBuilder, newBuilder);
}
```

---

## 7. Agent Ownership NFT (V1.1)

> **NOTE:** This section provides the conceptual design. For complete implementation specification including ERC-721Enumerable, ERC-2981 royalties, OpenSea metadata, and integration details, see **AIP-9: Agent Passport NFT**.
>
> Related AIPs:
> - **AIP-9**: Agent Passport NFT (full ERC-721 implementation)
> - **AIP-10**: Reputation Badges (minted to agent's TBA)
> - **AIP-11**: Token Bound Accounts (badge portability)

### 7.1 Motivation

In V1.1, agent ownership is represented as an ERC-721 NFT, enabling:
- Trading on OpenSea, Blur, and other marketplaces
- Visual representation of agent portfolio
- Transferability with marketplace protections
- Badge portability via Token Bound Accounts (AIP-11)

> **Important**: Agent NFTs represent **ownership and lifecycle management**.
> They are NOT designed as financial instruments or DeFi collateral.
> See AGIRAILS_NFT_WHITEPAPER.md §2.2 for design guardrails.

### 7.2 NFT Contract Design

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract AgentOwnershipNFT is ERC721 {
    IBuilderRegistry public immutable builderRegistry;

    mapping(uint256 => address) public agentOf;     // tokenId → agent address
    mapping(address => uint256) public tokenOfAgent; // agent → tokenId
    mapping(uint256 => bool) public tokenMinted;    // prevent double-mint

    constructor(address _builderRegistry) ERC721("AGIRAILS Agent", "AGENT") {
        builderRegistry = IBuilderRegistry(_builderRegistry);
    }

    /// @notice Deterministic tokenId derivation (matches AIP-9)
    /// @dev tokenId = uint256(uint160(agentAddress)) - collision-free, predictable
    function tokenIdFor(address agent) public pure returns (uint256) {
        return uint256(uint160(agent));
    }

    /// @notice Mint NFT when agent is registered
    function mint(address agent, address owner) external {
        require(msg.sender == address(builderRegistry), "Only registry");

        uint256 tokenId = tokenIdFor(agent);
        require(!tokenMinted[tokenId], "Already minted");

        tokenMinted[tokenId] = true;
        _mint(owner, tokenId);
        agentOf[tokenId] = agent;
        tokenOfAgent[agent] = tokenId;
    }

    /// @notice Override transfer to update BuilderRegistry ownership
    function _update(address to, uint256 tokenId, address auth)
        internal override returns (address from)
    {
        from = super._update(to, tokenId, auth);

        // Sync ownership to BuilderRegistry
        address agent = agentOf[tokenId];
        if (agent != address(0) && to != address(0)) {
            builderRegistry.transferOwnership(agent, to);
        }

        return from;
    }
}
```

### 7.3 NFT as Source of Truth (V1.1)

**Key Design Decision**: When NFT is active, it is the ONLY source of truth for ownership.

**Problem**: Without this, ownership can diverge:
- NFT says Alice owns agent
- Registry says Bob owns agent
- Which is correct?

**Solution**: When V1.1 NFT is deployed:
1. `transferOwnership()` in registry is DISABLED for external callers (except NFT contract)
2. All user-initiated ownership transfers go through NFT
3. NFT `_update()` hook syncs to registry via `transferOwnership()`

```solidity
function transferOwnership(address agent, address newOwner) external {
    if (nftContract != address(0)) {
        // NFT contract can sync ownership changes
        if (msg.sender != nftContract) {
            revert("Use NFT transfer");
        }
    } else {
        // V1 legacy: only current owner can transfer
        require(msg.sender == agents[agent].owner, "Not owner");
    }

    // Update ownership (both V1 legacy and V1.1 NFT sync use this)
    address previousOwner = agents[agent].owner;
    agents[agent].owner = newOwner;

    emit OwnershipTransferred(agent, previousOwner, newOwner);
}
```

> **Note**: This design allows NFT `_update()` to call `transferOwnership()` for sync,
> while preventing direct calls from users when NFT is deployed.

**Migration Path**:
- V1: Registry-based ownership (no NFT)
- V1.1: NFT deployed, existing agents minted
- Post-V1.1: NFT is sole ownership mechanism

### 7.4 NFT Metadata (V1.1)

```json
{
    "name": "AGIRAILS Agent #42",
    "description": "Revenue-generating AI agent on AGIRAILS protocol",
    "image": "ipfs://bafybei.../agent-42.png",
    "attributes": [
        { "trait_type": "Agent Address", "value": "0x..." },
        { "trait_type": "Lifetime GMV", "value": "$125,000" },
        { "trait_type": "Monthly Revenue", "value": "$1,250" },
        { "trait_type": "Builder", "value": "0x..." },
        { "trait_type": "Partner", "value": "JACK" },
        { "trait_type": "Registration Date", "value": "2025-01-09" }
    ]
}
```

---

## 8. Security Considerations

### 8.1 Access Control Matrix

| Function | Caller | Validation |
|----------|--------|------------|
| `approvePartner(partner, code)` | Admin only | `onlyAdmin` |
| `suspendPartner(partner)` | Admin only | `onlyAdmin` |
| `unsuspendPartner(partner)` | Admin only | `onlyAdmin` |
| `registerAgent(agent, owner, sig)` | Anyone (becomes builder) | `owner != address(0)`, owner signature valid |
| `initiateBuilderReplacement(agent, newBuilder)` | Owner only | `msg.sender == reg.owner` |
| `executeBuilderReplacement(agent)` | Owner only | `msg.sender == reg.owner`, 30 days passed |
| `cancelBuilderReplacement(agent)` | Owner only | `msg.sender == reg.owner` |
| `transferOwnership(agent, newOwner)` | Owner only | `msg.sender == reg.owner` |
| `deactivateAgent(agent)` | Owner OR Admin | `owner OR hasRole(ADMIN)` |
| `reactivateAgent(agent)` | Owner only | `msg.sender == reg.owner` |
| `rotateBuilderWallet(newWallet)` | Builder only | `isBuilder[msg.sender]` |
| `updateAgentBuilder(agent)` | Rotated builder only | `!chainTruncated` + `chainEndWallet == msg.sender` + `oldBuilder != msg.sender` + `isBuilder[msg.sender]` |
| `rotatePartnerWallet(new)` | Partner only | `msg.sender == partner.wallet` |
| `resign(agent)` | Builder only | `msg.sender == reg.builder` |
| `recordGMV(...)` | ACTPKernel only | `msg.sender == kernel` |
| `claimBuilderEarnings()` | Builder | Not quarantined |
| `claimPartnerEarnings()` | Partner | Not suspended |
| `pause()` | Pauser role | `hasRole(PAUSER_ROLE)` |
| `unpause()` | Admin role | `hasRole(ADMIN_ROLE)` |

### 8.2 Role Combination Rules

| Combination | Allowed? | Notes |
|-------------|----------|-------|
| Owner = Builder | ✅ YES | Solo developer scenario |
| Owner = Partner | ✅ YES | Different roles, OK |
| Builder = Partner (self-referral) | ❌ NO | `require(partner != msg.sender)` |
| Owner = Builder = Partner | ❌ NO | Self-referral blocked |

```solidity
function registerAgent(address agent, address owner, bytes calldata ownerSignature) external {
    // Partner comes from builder's registration (per-BUILDER attribution)
    address partner = builderToPartner[msg.sender];

    // Self-referral is blocked at builder registration time
    // (registerBuilder requires partner != msg.sender)

    // Owner and builder CAN be the same
    // Partner and owner CAN be the same (different roles)
}
```

### 8.3 Anti-Fraud Measures

#### 8.3.1 Builder Verification Requirements

**Dual Threshold for Verified Status**:

| Requirement | Value | Purpose |
|-------------|-------|---------|
| MIN_COUNTERPARTIES | 5 unique addresses | Diversity check |
| MIN_VERIFIED_GMV | $1,000 USDC | Monetary threshold |

**Both requirements must be met** for "verified" status.

**Specification**:
- Rule applies **per-BUILDER** (not per-agent)
- Builder must transact with **at least 5 unique counterparties** across all their agents
- Builder must have **at least $1,000 settled GMV**
- Until thresholds are met: **Builder earns fees, but GMV doesn't count for tier/leaderboard**
- After thresholds are met: **all past GMV retroactively counts for tier**

**Why Dual Threshold?**
- 5 counterparties alone costs only $0.50 to fake (5 × $10 × 1%)
- $1,000 GMV alone could be 1 counterparty
- Combined: 5 counterparties + $1,000 GMV = $10 minimum to fake
- Makes gaming 20x more expensive

**Unique Counterparty Definition**:
- Unique blockchain address
- Not the builder's own address
- Minimum transaction amount: $1 USDC

**What "Verified" Unlocks**:
- GMV counts for tier/leaderboard
- Eligible for featured listing
- Partner bonus activated (15% instead of 10%)
- Visible in public builder directory

**What Unverified Builders Still Get**:
- Normal fee earnings (no penalty)
- Functional agents
- Just no "premium" visibility

**Implementation**:
```solidity
uint256 public constant MIN_COUNTERPARTIES = 5;
uint256 public constant MIN_VERIFIED_GMV = 1000e6; // $1,000 USDC

function isBuilderVerified(address builder) public view returns (bool) {
    return builderCounterpartyCount[builder] >= MIN_COUNTERPARTIES
        && builders[builder].settledGMV >= MIN_VERIFIED_GMV;
}

function recordGMV(bytes32 txId, address agent, address counterparty, uint256 amount, uint256 fee) external onlyKernel {
    address builder = agents[agent].builder;

    // CRITICAL: Follow rotation chain to find CURRENT builder wallet
    // This ensures revenue goes to new wallet even if agent reference isn't updated yet
    builder = _resolveCurrentBuilder(builder);

    // Track unique counterparties (for verification)
    if (!builderCounterparties[builder][counterparty]) {
        builderCounterparties[builder][counterparty] = true;
        builderCounterpartyCount[builder]++;
    }

    // Track settled GMV
    builders[builder].settledGMV += amount;

    // Get partner from agent (original partner, even if builder changed)
    address partner = agents[agent].referredBy;

    // Calculate builder share (bonus only if verified)
    uint16 builderBps = _getBuilderShare(builder, partner);

    // Distribute with calculated rates
    _distributeRevenue(builder, partner, fee, builderBps);

    // Track verified GMV for tier/leaderboard
    if (isBuilderVerified(builder)) {
        builders[builder].verifiedGMV += amount;
    }
}

/// @notice Resolves wallet rotation chain to find current active wallet
/// @dev Max 3 hops to prevent gas attacks from long chains
/// @dev WARNING: If builder rotates 4+ times without updating agents,
///      revenue will go to the wallet at hop 3, NOT the current wallet!
///      Builders MUST call updateAgentBuilder() for ALL agents after rotating.
function _resolveCurrentBuilder(address builder) internal view returns (address) {
    for (uint i = 0; i < 3; i++) {
        address rotatedTo = walletRotatedTo[builder];
        if (rotatedTo == address(0)) {
            break; // No further rotation
        }
        builder = rotatedTo;
    }
    return builder;
}

/// @notice Get complete rotation chain information for a wallet
/// @dev PUBLIC view function for SDK/UI - returns BOTH chain info AND revenue info
/// @param wallet The starting wallet address (e.g., agent's current builder reference)
/// @return chainDepth Total rotations in chain (up to 10)
/// @return chainEndWallet The wallet at the END of the full rotation chain
/// @return revenueWallet The wallet that will ACTUALLY receive revenue (max 3 hops!)
/// @return revenueAtRisk TRUE if chainDepth > 3 (revenue goes to stale wallet)
/// @return chainTruncated TRUE if chain exceeds 10 hops (chainEndWallet may be inaccurate!)
///
/// CRITICAL: revenueWallet may differ from chainEndWallet if chain > 3 hops!
/// SDK MUST warn users when revenueAtRisk == true or chainTruncated == true
///
/// SDK Usage Example:
/// ```typescript
/// const info = await registry.getRotationInfo(agent.builder);
///
/// if (info.chainTruncated) {
///     // CRITICAL: >10 rotations - completely unrecoverable!
///     showError("UNRECOVERABLE: Chain exceeds 10 rotations.");
///     showError("updateAgentBuilder() will FAIL. Agent revenue permanently stranded.");
///     showAction("Create new agent with current wallet as builder.");
/// } else if (info.revenueAtRisk) {
///     // 4-10 rotations - recoverable but revenue currently lost
///     showWarning(`Revenue goes to ${info.revenueWallet}, not ${info.chainEndWallet}`);
///     showAction("Call updateAgentBuilder() NOW to recover future revenue!");
///     // Note: Past revenue is lost, but future revenue will be fixed after update
/// } else if (info.chainDepth >= 2) {
///     // Approaching limit - warn user
///     showWarning(`${3 - info.chainDepth} rotation(s) left before revenue goes to wrong wallet.`);
///     showAction("Consider calling updateAgentBuilder() soon.");
/// }
/// ```
function getRotationInfo(address wallet) public view returns (
    uint256 chainDepth,
    address chainEndWallet,
    address revenueWallet,
    bool revenueAtRisk,
    bool chainTruncated
) {
    // Calculate full chain (up to 10 hops)
    chainEndWallet = wallet;
    for (uint i = 0; i < 10; i++) {
        address rotatedTo = walletRotatedTo[chainEndWallet];
        if (rotatedTo == address(0)) break;
        chainEndWallet = rotatedTo;
        chainDepth++;
    }

    // Check if chain was truncated (more than 10 hops exist)
    chainTruncated = (walletRotatedTo[chainEndWallet] != address(0));

    // Calculate revenue wallet (max 3 hops - matches _resolveCurrentBuilder)
    revenueWallet = wallet;
    for (uint i = 0; i < 3; i++) {
        address rotatedTo = walletRotatedTo[revenueWallet];
        if (rotatedTo == address(0)) break;
        revenueWallet = rotatedTo;
    }

    // Revenue is at risk if chain is longer than 3 hops
    revenueAtRisk = (chainDepth > 3) || (chainEndWallet != revenueWallet);

    return (chainDepth, chainEndWallet, revenueWallet, revenueAtRisk, chainTruncated);
}

/// @notice Get builder share based on verification status
function _getBuilderShare(address builder, address partner) internal view returns (uint16) {
    bool hasPartner = partner != address(0);
    bool isVerified = isBuilderVerified(builder);

    if (hasPartner && isVerified) {
        // Verified + Partner = base + bonus
        return BUILDER_BASE_BPS + BUILDER_PARTNER_BONUS_BPS; // 10% + 5% = 15%
    } else {
        // Either unverified OR no partner = base only
        return BUILDER_BASE_BPS; // 10%
    }
}
```

#### 8.3.2 Builder Quarantine

- Admin can quarantine suspicious builders
- Quarantined builders can still EARN but cannot CLAIM
- Preserves balance for review
- Does not affect protocol settlement

#### 8.3.3 Partner Suspension

**When Partner is Suspended**:
- Partner **cannot** earn new fees (fees go to Treasury instead)
- Partner **cannot** claim accumulated balance (frozen)
- Partner attribution **remains permanent** (still recorded as partner)
- Builders using suspended partner code get **base rate only** (10%, no bonus)

```solidity
enum PartnerStatus { PENDING, ACTIVE, SUSPENDED }

function suspendPartner(address partner) external onlyAdmin {
    require(partners[partner].status == PartnerStatus.ACTIVE, "Not active");
    partners[partner].status = PartnerStatus.SUSPENDED;
    emit PartnerSuspended(partner, msg.sender);
}

function unsuspendPartner(address partner) external onlyAdmin {
    require(partners[partner].status == PartnerStatus.SUSPENDED, "Not suspended");
    partners[partner].status = PartnerStatus.ACTIVE;
    emit PartnerUnsuspended(partner, msg.sender);
}

// In revenue distribution:
if (partner != address(0) && partners[partner].status == PartnerStatus.ACTIVE) {
    partnerBalances[partner] += partnerShare;
    builderBalances[builder] += builderShareWithBonus; // 15%
} else {
    // Suspended or no partner: fees to treasury, builder gets base only
    treasuryBalance += partnerShare;
    builderBalances[builder] += builderShareBase; // 10%
}
```

#### 8.3.4 Builder Health Score (Multi-Factor, Off-Chain)

**Problem**: Raw GMV is gameable. Wash trading $1M costs only $10k in fees but looks impressive.

**Solution**: Multi-factor Health Score for tier/leaderboard (not raw GMV).

**Health Score Formula**:
```
HealthScore = (GMV × 0.3) + (Diversity × 0.3) + (Retention × 0.2) + (Quality × 0.2)

Where:
- GMV:       Normalized settled volume (log scale, 0-100)
- Diversity: Unique counterparties / Total transactions (0-100)
- Retention: % counterparties who return for 2+ transactions (0-100)
- Quality:   100 - (Dispute rate × 100) (0-100)
```

**Why Multi-Factor?**
- Single metric = gameable
- Combination is exponentially harder to fake
- Wash trading hurts Diversity and Retention scores
- Disputes hurt Quality score

**Tier Thresholds (Based on Health Score)**:

| Tier | Health Score | Benefits |
|------|--------------|----------|
| Bronze | 0-25 | Basic listing |
| Silver | 26-50 | Featured in category |
| Gold | 51-75 | Homepage featured |
| Platinum | 76-90 | Co-marketing eligible |
| Diamond | 91-100 | Advisory/partnership track |

**Implementation (V1: Off-Chain)**:
```typescript
interface BuilderMetrics {
    rawGMV: bigint;
    uniqueCounterparties: number;
    totalTransactions: number;
    returningCounterparties: number;  // 2+ transactions
    disputeCount: number;
    healthScore: number;  // 0-100, calculated
}

function calculateHealthScore(metrics: BuilderMetrics): number {
    const gmvScore = Math.min(100, Math.log10(Number(metrics.rawGMV) / 1e6 + 1) * 33);
    const diversityScore = (metrics.uniqueCounterparties / metrics.totalTransactions) * 100;
    const retentionScore = (metrics.returningCounterparties / metrics.uniqueCounterparties) * 100;
    const qualityScore = 100 - (metrics.disputeCount / metrics.totalTransactions) * 100;

    return (gmvScore * 0.3) + (diversityScore * 0.3) + (retentionScore * 0.2) + (qualityScore * 0.2);
}
```

**Dashboard Display**:
- Shows Health Score prominently (not raw GMV)
- Breakdown of each factor visible
- Tips for improving score

#### 8.3.5 Partner Eligibility Policy

**Self-Referral Prevention**:

Partners must demonstrate EXTERNAL distribution capacity. Self-referral is NOT permitted.

| Scenario | Allowed? | Reason |
|----------|----------|--------|
| Partner refers external builder | ✅ Yes | Legitimate referral |
| Owner is also partner for own agents | ⚠️ Discouraged | Admin discretion |
| Builder uses own partner code | ❌ No | `require(partner != msg.sender)` |

**Partner Application Requirements**:

Applicants must demonstrate at least ONE of:
- Existing audience (YouTube 1k+, Twitter 5k+, Discord 500+)
- Client portfolio (agency, consultancy with 5+ clients)
- Ecosystem presence (contributor to other protocols)
- Referral from existing partner (vouching system V1.1)

**Admin Review Criteria**:
```markdown
□ Does applicant have verifiable distribution channel?
□ Is this a self-dealing attempt (same entity as builder/owner)?
□ Any red flags in on-chain history?
□ Legitimate business reason for partnership?
```

**Policy Statement** (include in Terms of Service):
> "The Partner Program rewards ecosystem growth through genuine referrals.
> Applications where the partner is the same entity as the referred builders
> or agent owners may be rejected at admin discretion."

#### 8.3.6 Counterparty Monitoring (Off-Chain V1.1)

| Trigger | Action |
|---------|--------|
| >50% GMV from single counterparty | Flag for review |
| GMV spike >500% in 7 days | Flag for review |
| All counterparties funded from same source | Flag for review |
| Dispute rate >10% | Flag for review |
| Health Score drop >20 points in 30 days | Flag for review |

### 8.4 Agent Deactivation

**Deactivation = Hard Block** (agent cannot transact)

| Aspect | Behavior |
|--------|----------|
| New transactions | ❌ BLOCKED (ACTPKernel rejects) |
| Existing transactions | ✅ Can complete (DELIVERED → SETTLED) |
| Accumulated balances | ✅ Remain claimable |
| GMV recording | ❌ Stops |

**Who Can Deactivate**:
- **Owner**: Full control over their agent
- **Admin**: Emergency security measure

**Who Can Reactivate**:
- **Owner ONLY**: Admin cannot reactivate (prevents hijacking)

```solidity
function deactivateAgent(address agent) external {
    require(
        msg.sender == agents[agent].owner || hasRole(ADMIN_ROLE, msg.sender),
        "Not authorized"
    );
    agents[agent].active = false;
    emit AgentDeactivated(agent, msg.sender);
}

function reactivateAgent(address agent) external {
    require(msg.sender == agents[agent].owner, "Only owner");
    agents[agent].active = true;
    emit AgentReactivated(agent);
}
```

### 8.5 Emergency Pause Mechanism (Granular)

**Key Design Decision: Granular Pause, not Global**

Core principle: **B&P MUST NEVER block core ACTP settlement.**

If user funds are in escrow and B&P is paused, settlement MUST still work.

**Granular Pause Categories**:

| Category | Functions | Can be Paused? |
|----------|-----------|----------------|
| **Settlement** | `recordGMV()` | ❌ **NEVER** |
| **Claims** | `claim()`, `claimBuilderEarnings()` | ✅ Yes |
| **Registration** | `registerAgent()`, `registerBuilder()` | ✅ Yes |
| **Admin** | `approvePartner()`, `initiateBuilderReplacement()` | ✅ Yes |
| **Views** | `getAgent()`, `claimableBalance()` | ❌ Never |

**Why recordGMV is NEVER pausable**:
- `recordGMV()` is called by ACTPKernel during settlement
- If it reverts, settlement fails, user funds are stuck
- B&P is an EXTENSION, not core protocol
- Unregistered agents → fees go to treasury (fail-safe)

**Implementation**:

```solidity
contract BuilderRegistry {
    bool public claimsPaused;
    bool public registrationsPaused;
    // NOTE: recordGMV has NO pause check

    modifier whenClaimsNotPaused() {
        require(!claimsPaused, "Claims paused");
        _;
    }

    modifier whenRegistrationsNotPaused() {
        require(!registrationsPaused, "Registrations paused");
        _;
    }

    /// @notice NEVER pausable - core settlement must always work
    function recordGMV(
        bytes32 txId,
        address agent,
        address counterparty,
        uint256 amount,
        uint256 feeAmount
    ) external onlyKernel {
        // NO pause check here - by design
        // ...distribution logic
    }

    function claim() external whenClaimsNotPaused {
        // ...
    }

    function registerAgent(...) external whenRegistrationsNotPaused {
        // ...
    }
}
```

**Pause Functions**:

```solidity
function pauseClaims() external onlyRole(PAUSER_ROLE) {
    claimsPaused = true;
    emit ClaimsPaused(msg.sender);
}

function unpauseClaims() external onlyRole(ADMIN_ROLE) {
    claimsPaused = false;
    emit ClaimsUnpaused(msg.sender);
}

function pauseRegistrations() external onlyRole(PAUSER_ROLE) {
    registrationsPaused = true;
    emit RegistrationsPaused(msg.sender);
}

function unpauseRegistrations() external onlyRole(ADMIN_ROLE) {
    registrationsPaused = false;
    emit RegistrationsUnpaused(msg.sender);
}
```

**Role Separation**:
- **PAUSER_ROLE**: Can pause (fast response, single signer OK)
- **ADMIN_ROLE**: Can unpause (requires multisig confirmation)

**Rationale**: Pausing is emergency action (needs speed). Unpausing confirms "all clear" (needs consensus).

### 8.6 Agent Limits

**V1: No Hard Limit** on agents per builder.

**Rationale**:
- Gas cost is natural limiter (~85k gas per registration)
- No economic benefit from spam registrations
- MIN_COUNTERPARTIES prevents fake GMV abuse
- Admin can deactivate malicious agents if needed

**V1.1 (if needed)**:
- Soft limit: 100 agents (dashboard warning)
- Hard limit: 1000 agents (on-chain, configurable)

### 8.7 Fail-Safe Design

`recordGMV()` NEVER reverts:

```solidity
function recordGMV(...) external {
    // FAIL-SAFE: If agent not registered, send all to treasury
    if (agents[agent].agent == address(0)) {
        vault.sendToTreasury(feeAmount);
        emit UnregisteredAgentGMV(agent, txId, amount, feeAmount);
        return;  // Don't revert - core settlement continues
    }

    // ... normal distribution
}
```

**Rationale**: Core ACTP protocol must never be blocked by B&P extension.

### 8.8 Wallet Security

#### 8.8.1 Wallet Rotation Timelock (7 Days)

- Builder/Partner wallet changes require 7-day timelock
- Prevents immediate theft if wallet compromised
- Allows legitimate user to cancel pending change

#### 8.8.2 Claim Cooldown After Rotation (24 Hours)

**Problem**: Timelock doesn't protect accumulated balance. Attacker with compromised key can:
1. Call `claim()` immediately (steal current balance)
2. THEN initiate wallet rotation (for future earnings)

**Solution**: 24-hour claim cooldown after ANY wallet rotation.

```solidity
mapping(address => uint256) public lastWalletChange;
uint256 public constant CLAIM_COOLDOWN = 24 hours;

function rotateBuilderWallet(address newWallet) external {
    require(isBuilder[msg.sender], "Not builder");
    // ... rotation logic (see Section 6.4.1)
    lastWalletChange[newWallet] = block.timestamp;
}

function claim() external whenClaimsNotPaused {
    require(
        block.timestamp >= lastWalletChange[msg.sender] + CLAIM_COOLDOWN,
        "Claim cooldown active"
    );
    // ... claim logic
}
```

**Why This Helps**:
- If attacker rotates to their wallet → 24h before they can claim
- Legitimate owner has 24h to notice and respond
- Can pause claims or quarantine builder during window

#### 8.8.3 Partner Code Normalization (On-Chain)

**Problem**: Partner codes must be case-insensitive for good UX.
- "JACK", "jack", "Jack" should all resolve to same partner
- Without normalization: "jack" ≠ "JACK" = duplicate codes or lookup failures

**Solution**: ON-CHAIN normalization in smart contract (not SDK-only).

**Why On-Chain?**
- SDK-only normalization is bypassable via direct contract calls
- On-chain ensures consistency regardless of client
- Small gas overhead (~200 gas for typical code)

**Implementation** (see Section 5.1):
```solidity
function _normalizeAndHash(string calldata code) internal pure returns (bytes32) {
    bytes memory b = bytes(code);
    for (uint i = 0; i < b.length; i++) {
        if (b[i] >= 0x61 && b[i] <= 0x7A) { // a-z
            b[i] = bytes1(uint8(b[i]) - 32);  // to A-Z
        }
    }
    return keccak256(b);
}
```

**Result**: All partner code operations (approve, lookup) use normalized hash.

**Events**: Emit original string for UX recovery via subgraph.
**Documentation**: "Partner codes are case-insensitive (normalized to uppercase)."

---

## 9. Dashboard Requirements

### 9.1 Owner Dashboard

| Feature | V1 | V1.1 |
|---------|-----|------|
| List owned agents | Yes | Yes |
| Agent GMV & revenue | Yes | Yes |
| View current builder | Yes | Yes |
| Replace builder | Yes | Yes |
| View partner attribution | Yes | Yes |
| Claim revenue | Yes | Yes |
| Transfer ownership | No | Yes (via NFT) |

### 9.2 Builder Dashboard

| Feature | V1 | V1.1 |
|---------|-----|------|
| Claimable balance | Yes | Yes |
| Lifetime earnings | Yes | Yes |
| Agents registered | Yes | Yes |
| Per-agent GMV | Yes | Yes |
| Partner bonus status | Yes | Yes |
| Resign from agent | Yes | Yes |

### 9.3 Partner Dashboard

| Feature | V1 | V1.1 |
|---------|-----|------|
| Referral code | Yes | Yes |
| Referred builders count | Yes | Yes |
| Commission earned | Yes | Yes |
| Claimable balance | Yes | Yes |
| Builder breakdown | No | Yes |
| Partner tier/status | No | Yes |

### 9.4 Marketplace (V1.1)

| Feature | Description |
|---------|-------------|
| Agent Discovery | Browse active agents by service type |
| Revenue History | View agent's historical performance |
| NFT Trading | Buy/sell agents on OpenSea |
| Portfolio View | All owned agents in one place |

---

## 10. Implementation Timeline

### Phase 1: Core Contracts (Week 1-2)
- Deploy BuilderRegistry, PartnerRegistry, RevenueVault, AgentFactory
- Integrate with ACTPKernel (`recordGMV` hook)
- Testnet deployment and testing

### Phase 2: Dashboard MVP (Week 3-4)
- Builder dashboard (claim, view agents)
- Partner dashboard (claim, view referrals)
- Admin dashboard (quarantine, metrics)

### Phase 3: Soft Launch (Week 5-6)
- 10 beta builders onboarded
- 5 beta partners registered
- Bug fixes and iteration

### Phase 4: V1.1 NFT (Month 2-3)
- AgentOwnershipNFT contract
- Marketplace integration
- NFT metadata service

---

## 11. Open Parameters

| Parameter | Current Value | Configurable By | Notes |
|-----------|---------------|-----------------|-------|
| BUILDER_BASE_BPS | 1000 (10%) | Admin (30d notice + 7d timelock) | Base builder share |
| BUILDER_PARTNER_BONUS_BPS | 500 (5%) | Admin (30d notice + 7d timelock) | Bonus if builder has partner |
| PARTNER_SHARE_BPS | 500 (5%) | Admin (30d notice + 7d timelock) | Partner commission |
| MIN_PARTNER_SHARE_BPS | 250 (2.5%) | **IMMUTABLE** | Minimum guaranteed partner share |
| MAX_PARTNER_SHARE_BPS | 1000 (10%) | **IMMUTABLE** | Maximum partner share |
| MIN_CLAIM | 1e6 (1 USDC) | Admin | Minimum claim amount |
| MIN_COUNTERPARTIES | 5 | Admin | Anti-fraud threshold |
| MIN_VERIFIED_GMV | 1000e6 ($1,000) | Admin | Builder verification threshold |
| MIN_RUNWAY_USD | 15,000 USDC | Admin | Circuit breaker threshold |
| CIRCUIT_BREAKER_REDUCTION | 50% | **IMMUTABLE** | Reduction during circuit breaker |
| BUILDER_NOTICE_PERIOD | 30 days | **IMMUTABLE** | Notice before builder replacement |
| WALLET_CHANGE_TIMELOCK | 7 days | Admin | Wallet rotation security |
| CLAIM_COOLDOWN | 24 hours | Admin | Cooldown after wallet rotation |

### 11.1 Design Decisions (Not Parameters)

| Decision | Value | Rationale |
|----------|-------|-----------|
| Partner approval | Required | Prevents self-referral exploit |
| Builder approval | Not required | Self-correcting via market |
| Owner registration | None | Just an address, max flexibility |
| Agent cleanup | None | Permanent history, no gas benefit |
| Agent limits | None (V1) | Gas is natural limiter |
| Wallet recovery | None | "Not your keys, not your coins" |
| Circular referrals | Allowed | No economic effect |
| Self-referral | Blocked | `require(partner != msg.sender)` |

---

## 12. Future Considerations

### 12.1 Dynamic Fee Tiers (V2)
Based on builder performance, fee share could increase:
- Bronze: 10% base
- Silver: 12% base
- Gold: 15% base
- Platinum: 18% base
- Diamond: 20% base

### 12.2 Partner Quality Layer (V1.1)

**Core Principle**: Partner **revenue** is permanent and sacred. Partner **status/influence** is dynamic.

| Concept | Nature | What It Affects |
|---------|--------|-----------------|
| **Partner Revenue** | Permanent, on-chain, automatic | USDC earnings (never changes) |
| **Partner Influence** | Dynamic, reputation-based | Tier, visibility, governance, perks |

**Three Quality Signals**:

| Signal | Metric | Display | Affects |
|--------|--------|---------|---------|
| **Builder Retention** | % of referred builders with GMV in last 30/60 days | Strong / Medium / Weak | Partner tier, featured status |
| **Net Settled GMV Quality** | Dispute rate of partner's referred builders | Low disputes / Normal / Elevated | Partner tier, co-marketing eligibility |
| **Ongoing Activity** | New builders in last X months, community engagement | Active / Dormant | "Living partner" badge, governance weight |

**What Quality Affects (NOT Revenue)**:

| Benefit | Requires |
|---------|----------|
| Partner Tier upgrade | Good retention + low disputes |
| Featured Partner listing | Active status + Champion+ tier |
| Co-marketing opportunities | Low disputes + Active |
| Governance voting weight | Active status |
| Future equity/advisory access | Legend tier + ongoing contribution |
| Fee subsidy pool access | Active + good retention |

**What Quality Does NOT Affect**:
- Revenue percentage (always 5% of protocol fee)
- Accumulated balance
- Claim rights
- Historical attribution

**Partner Dashboard Health Section (V1.1)**:
```
┌─────────────────────────────────────────────────────────┐
│  Partner Health                                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Builder Retention    [████████░░]  Strong              │
│  Ecosystem Quality    [██████████]  Low Disputes        │
│  Activity Status      [████████░░]  Active              │
│                                                         │
│  Your Tier: Champion                                    │
│  Next Tier: Legend (need 5 more active builders)        │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 12.3 Partner Tiers (V1.1/V2)
Based on referred builder quality:
- Explorer → Advocate → Champion → Legend
- Higher tiers unlock co-marketing, governance weight, advisory access

### 12.4 Multi-Chain Support (V3)
- Deploy on multiple L2s
- Cross-chain attribution tracking
- Unified dashboard across chains

---

## References

- [AIP-0: Protocol Overview](./AIP-0.md)
- [AIP-6: Fee Structure](./AIP-6.md)
- [AIP-7: Agent Identity Registry](./AIP-7.md)
- [BUILDER_OWNER_MODEL.md](../../POST%20Launch%20GTM%20***/strategy/go-to-market/BUILDER_OWNER_MODEL.md)
- [BUILDERS_PARTNERS_V1_SPEC.md](../../POST%20Launch%20GTM%20***/strategy/go-to-market/BUILDERS_PARTNERS_V1_SPEC.md)

---

## Document History

| Date | Version | Change |
|------|---------|--------|
| 2025-01-09 | 0.1.0 | Initial draft |
| 2026-01-09 | 0.2.0 | Added: MIN_COUNTERPARTIES anti-fraud rule, Treasury Runway Protection, CREATE2 salt binding security, Partner code storage design, Partner Quality Layer V1.1 details |
| 2026-01-10 | 0.3.0 | Major update with comprehensive specification: (1) Registration flows - Partner approval required, Builder implicit, Owner no registration; (2) MIN_COUNTERPARTIES detailed - per-builder, retroactive, $1 minimum; (3) Treasury Runway - governance parameter $15k, 50% reduction, hybrid activation; (4) Wallet management - rotation vs replacement, balance transfer rules, no recovery; (5) Partner suspension - fees to treasury, status enum; (6) Agent deactivation - hard block, owner/admin can deactivate, only owner can reactivate; (7) Access control matrix - full permissions table, self-referral prevention; (8) Emergency pause - central PauseController, PAUSER/ADMIN role separation; (9) Agent limits - no hard limit V1, gas is limiter; (10) Design decisions table |
| 2026-01-10 | 0.4.0 | **Security & Game Theory Hardening** based on Codex review: **Critical Fixes**: (CR1) Agent registration now requires owner EIP-712 signature to prevent front-running/squatting; (CR2) Granular pause - recordGMV NEVER pausable, claims/registrations separately pausable; (CR3) Partner Guarantees section - clear separation of permanent attribution vs variable rate with min 2.5% guarantee; (CR4) Circuit breaker checks on every recordGMV using real USDC balance, not internal variable; (CR5) Per-BUILDER partner attribution (not per-agent) to prevent partner hopping. **High Risk Mitigations**: (HR1) 30-day notice period for builder replacement; (HR2) Partner eligibility policy - admin discretion for self-referral prevention; (HR3) Dual verification threshold - 5 counterparties + $1000 GMV; (HR4) Multi-factor Health Score for tier/leaderboard instead of raw GMV. **Operational Improvements**: (MO2) Partner code uppercase normalization in SDK; (MO3) 24-hour claim cooldown after wallet rotation; (MO4) NFT as sole source of truth for ownership in V1.1. |
| 2026-01-10 | 0.5.0 | **Consistency & Completeness Pass** based on second Codex review: **Critical**: Fixed attribution model contradiction - intro now says per-BUILDER (not per-AGENT), clarified partner stays with agent even after builder replacement. **High Fixes**: (1) Removed direct `replaceBuilder()` from interface - only notice flow (`initiateBuilderReplacement` + `executeBuilderReplacement`) allowed; (2) Wallet rotation now migrates ALL builder state (balance, partner attribution, stats, verification); (3) `_calculateRealTreasuryBalance` now returns 0 on underflow instead of reverting (safe math). **Medium Fixes**: (1) Removed `registerPartner()` from interface - only admin `approvePartner()` allowed; (2) Added on-chain partner code normalization (not SDK-only); (3) Clarified bonus rules - partner bonus (15%) only after verification, unverified builders get base 10% only. |
| 2026-01-10 | 0.6.0 | **Bug Fixes & Cleanup** based on third Codex review: **Critical**: Added access control to `updateAgentBuilder()` - requires caller to be registered builder, old builder deactivated, and partner match. **High Fixes**: (1) Removed ALL direct `replaceBuilder` references - only 30-day notice flow exists; (2) Fixed interface signatures - `registerBuilder(bytes32 partnerCode)`, `registerAgent(..., bytes ownerSignature)`; (3) Added `walletRotatedTo` mapping + `_resolveCurrentBuilder()` to ensure revenue goes to new wallet after rotation. **Medium Fixes**: (1) Fixed `executeBuilderReplacement` event - cache values BEFORE delete; (2) Documented counterparty double-counting as acceptable post-rotation behavior; (3) Fixed `rotateBuilderWallet` signature in access control matrix. **Low**: Clarified bonus rationale - 15% requires verification. |
| 2026-01-10 | 0.7.0 | **Security Hardening** based on fourth Codex review: **Critical**: Fixed `updateAgentBuilder()` hijack vulnerability - now requires `walletRotatedTo[oldBuilder] == msg.sender` instead of partner match (partner match allowed any builder with same partner to steal agent fees). **Medium Fixes**: (1) Removed `replaceBuilder` from granular pause table - replaced with `initiateBuilderReplacement`; (2) Removed phantom `removeBuilder` function from Owner Functions and Access Control Matrix - owners can replace builder with treasury address or deactivate agent instead; (3) Added rotation limit documentation and `_getRotationDepth()` helper - builders MUST call `updateAgentBuilder()` for ALL agents after rotation or revenue lost after 3 hops. **Low**: Fixed `rotateBuilderWallet` signature in wallet security section. |
| 2026-01-10 | 0.8.0 | **Multi-Rotation Support** based on fifth Codex review: **Medium**: Fixed `updateAgentBuilder()` multi-rotation lock-out - now uses `_resolveCurrentBuilder(oldBuilder) == msg.sender` instead of direct successor check. This allows builder who rotated A→B→C to update agents pointing to A (C can update, not just B). Updated rotation warning to clarify safe workflow (can rotate up to 3 times before updating). **Low Fixes**: (1) Added `updateAgentBuilder` to Access Control Matrix with proper authorization model; (2) Made `getRotationDepth()` a public view function (was internal) with SDK usage example - returns both depth and currentWallet for UI warnings; (3) Added `getRotationDepth` to IBuilderRegistry interface. |
| 2026-01-10 | 0.9.0 | **Rotation Safety** based on sixth Codex review: **Medium Fixes**: (1) Added `rotateBuilderWallet()` and `updateAgentBuilder()` to IBuilderRegistry interface; (2) Replaced `getRotationDepth()` with `getRotationInfo()` that returns BOTH chainEndWallet (full chain) AND revenueWallet (3-hop cap) plus `revenueAtRisk` flag - SDK can now accurately warn when revenue won't reach current wallet; (3) Added cycle prevention in `rotateBuilderWallet()` - `require(walletRotatedTo[newWallet] == address(0))` prevents A→B→A cycles and inheriting broken chains. |
| 2026-01-10 | 0.10.0 | **Revenue Recovery** based on seventh Codex review: **Medium**: `updateAgentBuilder()` now uses `chainEndWallet` from `getRotationInfo()` (10-hop) instead of `_resolveCurrentBuilder()` (3-hop) - this enables recovery even when `revenueAtRisk == true` after 4+ rotations. Past revenue is lost but future revenue fixed after update. Updated documentation to clarify recovery IS possible. **Low Fixes**: (1) Access Control Matrix now shows all runtime guards for `updateAgentBuilder`: `chainEndWallet == msg.sender` + `oldBuilder != msg.sender` + `isBuilder[msg.sender]`; (2) Added `chainTruncated` flag to `getRotationInfo()` - returns true when chain exceeds 10 hops so SDK can warn that chainEndWallet may be inaccurate. |
| 2026-01-10 | 0.11.0 | **Truncation Safety** based on eighth Codex review: **Medium Fixes**: (1) `updateAgentBuilder()` now unpacks all 5 return values from `getRotationInfo()` (was unpacking 4, causing mismatch); (2) Added `require(!chainTruncated)` check - when chain >10 hops, recovery is IMPOSSIBLE and function reverts with clear error. **Low**: Updated SDK example with 3-tier handling: chainTruncated (unrecoverable - suggest new agent), revenueAtRisk (recoverable - call update NOW), approaching limit (warning). Added RECOVERY TIERS table in documentation: 1-3 hops SAFE, 4-10 hops RECOVERABLE, >10 hops UNRECOVERABLE. |
| 2026-01-10 | 0.11.1 | **Matrix Completeness** based on ninth Codex review: **Low**: Added `!chainTruncated` to Access Control Matrix for `updateAgentBuilder()` - now shows all 4 runtime guards in order: `!chainTruncated` + `chainEndWallet == msg.sender` + `oldBuilder != msg.sender` + `isBuilder[msg.sender]`. |
| 2026-01-10 | 0.12.0 | **Soft Block Warnings** based on external auditor feedback: Added proactive warning events in `rotateBuilderWallet()`: (1) `RotationChainAtRisk(oldWallet, newWallet, chainDepth)` - emitted when rotation causes chain to exceed 3 hops (revenue at risk); (2) `RotationChainUnrecoverable(oldWallet, newWallet, chainDepth)` - emitted when rotation causes chain to exceed 10 hops (recovery impossible). SDK can listen to these events to warn builders BEFORE it's too late. Rotation is NOT blocked - this is a soft warning only. |
| 2026-01-11 | 0.13.0 | **NFT Layer Forward References**: Added "Extended By" header field pointing to AIP-9 (Agent Passport NFT), AIP-10 (Reputation Badges), and AIP-11 (Token Bound Accounts). Added note to Section 7 (Agent Ownership NFT) clarifying that AIP-9 contains the full implementation specification while this section provides conceptual design. |
| 2026-01-11 | 0.14.0 | **TokenId Formula Alignment (CRITICAL)**: Updated Section 7.2 `AgentOwnershipNFT` to use deterministic tokenId derivation `uint256(uint160(agent))` matching AIP-9 specification. Replaced incremental `++_nextTokenId` with `tokenIdFor(agent)` helper function. Added `tokenMinted` mapping to prevent double-mint. This ensures AIP-8 and AIP-9 are fully aligned on tokenId derivation. |
| 2026-01-11 | 0.15.0 | **AIP-10 Stats Interface (CRITICAL)**: Added `BuilderStats` and `PartnerStats` structs to IBuilderRegistry for badge eligibility verification. Added `getBuilderStats()`, `getPartnerStats()`, `getBuilderOf()` view functions. BuilderStats includes: totalGMV, uniqueCounterparties, successRate (basis points), status (TRIAL/ACTIVE/VERIFIED), partner address. PartnerStats includes: activeBuilderCount, totalBuilderCount, totalGMVReferred, status. |
