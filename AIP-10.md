# AIP-10: Reputation Badges

**Status:** Draft
**Author:** AGIRAILS Core Team
**Created:** 2026-01-11
**Updated:** 2026-01-11
**Version:** 0.1.5
**Depends On:** AIP-4 (EAS Delivery Proof), AIP-8 (Builders & Partners), AIP-9 (Agent Passport), AIP-11 (Token Bound Accounts)

---

## Abstract

This AIP specifies the **Reputation Badge System** - ERC-1155 tokens representing verifiable achievements earned by AGIRAILS agents. Badges are:

1. **Hybrid-Verified** - Eligibility uses two sources:
   - **On-chain stats (primary)**: AGENT_LIVE_60, AGENT_PRODUCTION, BUILDER_VERIFIED, PARTNER_NETWORK, QUALITY_VERIFIED
   - **EAS attestations**: SECURITY_REVIEWED (external audit verification)
2. **AIP-8 Aligned** - Thresholds derived from Builder verification criteria
3. **Container-Appropriate** - Agent badges → TBA, Entity badges → entity wallets
4. **Non-Transferable** - Soulbound to recipient (no secondary market)
5. **Visual Trophies** - Display on OpenSea/marketplaces, no protocol impact

**Key Invariant**: Badges do NOT affect fee distribution (AIP-8 §4.2 fees are immutable).

> **Note**: On-chain stats are preferred for protocol-derived badges because they are
> tied to fee-paid transactions (cost-to-fake), cannot be self-attested, and have no
> external dependencies in the critical path.

---

## 1. Motivation

### 1.1 The Trust Problem

AI agents lack standardized, verifiable reputation:
- Transaction history is fragmented across chains
- Self-reported metrics are untrustworthy
- No visual representation for marketplace display

### 1.2 Solution: Verifiable Badges

Badges provide:
- **Visual Trust Signals** - Immediately visible on OpenSea/Blur
- **Verified Achievements** - Backed by on-chain stats and EAS attestations
- **Anti-Gaming** - Multi-signal, fee-paid criteria with expiry-based renewal
- **Portability** - Travel with agent passport (via TBA)

> **Time-Windowed Design Note**: Rather than implementing complex on-chain time-windowed
> stats (which would be gas-prohibitive), badges use **lifetime stats + expiry** as a proxy:
> - Stats-backed badges expire after 90 days
> - To re-claim, agents must meet thresholds again
> - Inactive agents will fail to grow lifetime stats → cannot re-claim
> - This achieves similar anti-gaming properties with simpler on-chain logic
>
> **Known Limitation**: Once lifetime thresholds are reached, a builder can re-claim
> indefinitely even with zero recent activity. The badge expiry creates periodic
> "checkpoints" where inactive builders lose their visual trust signal, but does not
> prevent eventual re-claim.
>
> **Future (V2)**: True time-windowed eligibility via:
> - On-chain `lastTransactionAt` timestamp with 90-day recency check, OR
> - Off-chain indexer verification with EAS attestation for rolling window stats

### 1.3 Design Philosophy

```
On-chain Stats = PRIMARY TRUTH (for protocol-derived badges: 1,2,3,4,6)
EAS Attestation = SECONDARY TRUTH (for external verification: badge 5)
Badge NFT = VISUAL TROPHY (for display, no protocol impact)
```

Badges are **derived** from on-chain stats or attestations, not the other way around.
On-chain stats are preferred because they are tied to fee-paid transactions (cost-to-fake)
and have no external dependencies in the critical path.

---

## 2. Badge Types

### 2.1 Core Badges (Aligned with AIP-8)

| ID | Badge | Eligibility Criteria | AIP-8 Source |
|----|-------|---------------------|--------------|
| 1 | AGENT_LIVE_60 | Active 60+ days AND 3+ transactions | Whitepaper §2.3 |
| 2 | AGENT_PRODUCTION | GMV >= $1,000 AND 5+ counterparties AND 95%+ success | AIP-8 §2.4 |
| 3 | BUILDER_VERIFIED | Builder status = VERIFIED | AIP-8 §2.5 |
| 4 | PARTNER_NETWORK | Partner with 10+ active builders | AIP-8 §3.3 |
| 5 | SECURITY_REVIEWED | Trusted issuer attestation | Whitepaper §2.5 |
| 6 | QUALITY_VERIFIED | 94%+ satisfaction rating | Whitepaper §2.6 |

### 2.2 Badge Metadata

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "AGIRAILS Badge Metadata",
  "type": "object",
  "required": ["name", "description", "image", "properties"],
  "properties": {
    "name": { "type": "string" },
    "description": { "type": "string" },
    "image": { "type": "string", "format": "uri" },
    "properties": {
      "type": "object",
      "properties": {
        "badgeId": { "type": "integer" },
        "badgeType": { "type": "string" },
        "criteria": { "type": "string" },
        "issuedAt": { "type": "integer" },
        "expiresAt": { "type": "integer" },
        "easUID": { "type": "string" }
      }
    }
  }
}
```

**Storage Requirements**: Badge metadata and images MUST follow the storage layer specification in AIP-9 §2.4:
- Images: IPFS primary (`ipfs://Qm...`) + Arweave backup
- Metadata JSON: Content-addressed storage
- Badge images are static/immutable (mint once, never update)

### 2.3 Badge Visual Specifications

| Badge | Color Scheme | Icon | Rarity |
|-------|-------------|------|--------|
| AGENT_LIVE_60 | Blue (#3B82F6) | Clock | Common |
| AGENT_PRODUCTION | Purple (#8B5CF6) | Star | Uncommon |
| BUILDER_VERIFIED | Green (#10B981) | Shield | Rare |
| PARTNER_NETWORK | Gold (#F59E0B) | Network | Epic |
| SECURITY_REVIEWED | Red (#EF4444) | Lock | Legendary |
| QUALITY_VERIFIED | Cyan (#06B6D4) | Diamond | Rare |

### 2.4 Badge Container Model (Hybrid)

Badges are minted to different containers based on their semantic ownership:

| Badge Type | Container | Rationale |
|------------|-----------|-----------|
| AGENT_LIVE_60 | Agent TBA | Achievement of the agent itself |
| AGENT_PRODUCTION | Agent TBA | Production status of the agent |
| QUALITY_VERIFIED | Agent TBA | Quality metrics of the agent |
| SECURITY_REVIEWED | Agent TBA | Security status of the agent |
| **BUILDER_VERIFIED** | **Builder Wallet** | Builder organization achievement |
| **PARTNER_NETWORK** | **Partner Wallet** | Partner organization achievement |

**Rationale**:
- **Agent badges** (1, 2, 5, 6) represent achievements of the agent's operational performance
- **Entity badges** (3, 4) represent achievements of the organization (builder/partner) that operates agents
- When an agent passport is sold, agent badges travel with it (via TBA)
- Entity badges stay with the builder/partner who earned them

```
Agent Passport (ERC-721)
    └── Token Bound Account (ERC-6551)
            ├── AGENT_LIVE_60 badge
            ├── AGENT_PRODUCTION badge
            ├── QUALITY_VERIFIED badge
            └── SECURITY_REVIEWED badge

Builder Wallet (EOA)
    └── BUILDER_VERIFIED badge (soulbound to builder)

Partner Wallet (EOA)
    └── PARTNER_NETWORK badge (soulbound to partner)
```

### 2.5 Badge Validity & Expiration (Hybrid Model)

Badges have different validity rules based on their nature:

| Badge | Validity | Rationale |
|-------|----------|-----------|
| AGENT_LIVE_60 | **Permanent** | Historical fact - once 60 days active, always was |
| AGENT_PRODUCTION | **90 days** | Performance metrics can degrade over time |
| BUILDER_VERIFIED | **Permanent** | Status-based achievement, not performance |
| PARTNER_NETWORK | **90 days** | Network size can shrink if builders leave |
| SECURITY_REVIEWED | **365 days** | Security audits need periodic renewal |
| QUALITY_VERIFIED | **90 days** | Quality ratings can degrade over time |

**Expiration Mechanics**:
1. Badge minted with `expiresAt` timestamp (0 = permanent)
2. `isExpired(holder, badgeId)` view function checks validity
3. Expired badges remain as **historical trophies** (not burned)
4. UI/indexers should show "EXPIRED" status
5. Re-claim allowed after expiry if holder still meets eligibility

**Re-claim Rules**:
- Holder can call `claimX()` again after badge expires
- If still eligible → new badge minted with fresh `expiresAt`
- If no longer eligible → claim reverts
- Old expired badge remains (historical record)

```solidity
// Validity periods
uint256 constant PRODUCTION_VALIDITY = 90 days;
uint256 constant PARTNER_VALIDITY = 90 days;
uint256 constant SECURITY_VALIDITY = 365 days;
uint256 constant QUALITY_VALIDITY = 90 days;
// AGENT_LIVE_60 and BUILDER_VERIFIED have no expiry (permanent)
```

---

## 3. Smart Contracts

### 3.1 AgentBadges (ERC-1155)

```solidity
// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/// @title AgentBadges
/// @notice ERC-1155 badge tokens for AGIRAILS agent reputation
/// @dev Badges are soulbound (non-transferable after minting)
contract AgentBadges is ERC1155, ERC1155Supply, AccessControl {
    // ========== CONSTANTS ==========

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    // Badge IDs
    uint256 public constant AGENT_LIVE_60 = 1;
    uint256 public constant AGENT_PRODUCTION = 2;
    uint256 public constant BUILDER_VERIFIED = 3;
    uint256 public constant PARTNER_NETWORK = 4;
    uint256 public constant SECURITY_REVIEWED = 5;
    uint256 public constant QUALITY_VERIFIED = 6;

    // Validity periods (0 = permanent)
    uint256 public constant PRODUCTION_VALIDITY = 90 days;
    uint256 public constant PARTNER_VALIDITY = 90 days;
    uint256 public constant SECURITY_VALIDITY = 365 days;
    uint256 public constant QUALITY_VALIDITY = 90 days;

    // Revocation cooldowns (time before re-claim allowed)
    uint256 public constant COOLDOWN_STATS = 30 days;      // Badges 2,4,6
    uint256 public constant COOLDOWN_PERMANENT = 90 days;  // Badges 1,3

    // ========== STATE ==========

    /// @notice Badge metadata URIs
    mapping(uint256 => string) private _uris;

    /// @notice Tracks if address has ever received badge (historical)
    mapping(address => mapping(uint256 => bool)) public hasBadge;

    /// @notice Tracks badge expiration timestamps (0 = permanent/never expires)
    mapping(address => mapping(uint256 => uint256)) public badgeExpiresAt;

    /// @notice Tracks revocation timestamps for cooldown enforcement (0 = never revoked)
    mapping(address => mapping(uint256 => uint256)) public revokedAt;

    /// @notice Tracks if badge is revoked/inactive (for soft revoke - token remains but inactive)
    mapping(address => mapping(uint256 => bool)) public isRevoked;

    // ========== EVENTS ==========

    event BadgeMinted(
        address indexed recipient,
        uint256 indexed badgeId,
        bytes32 easUID,
        uint256 expiresAt,
        uint256 timestamp
    );

    event BadgeRevoked(
        address indexed holder,
        uint256 indexed badgeId,
        string reason,
        uint256 timestamp
    );

    // ========== ERRORS ==========

    error BadgeAlreadyOwned(address recipient, uint256 badgeId);
    error BadgeNotOwned(address holder, uint256 badgeId);
    error TransferDisabled();
    error InvalidBadgeId(uint256 badgeId);
    error CooldownActive(address holder, uint256 badgeId, uint256 remainingTime);

    // ========== CONSTRUCTOR ==========

    constructor(string memory baseUri) ERC1155(baseUri) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
    }

    // ========== MINTING ==========

    /// @notice Mint a badge to recipient (TBA or entity wallet)
    /// @param to Recipient address
    /// @param badgeId Badge type ID (1-6)
    /// @param easUID EAS attestation UID that verified eligibility
    function mint(
        address to,
        uint256 badgeId,
        bytes32 easUID
    ) external onlyRole(MINTER_ROLE) {
        // Validate badge ID
        if (badgeId < 1 || badgeId > 6) {
            revert InvalidBadgeId(badgeId);
        }

        // Handle soft-revoked badges (SECURITY_REVIEWED)
        // Token exists but is inactive - just reactivate, don't mint new
        if (hasBadge[to][badgeId] && isRevoked[to][badgeId] && badgeId == SECURITY_REVIEWED) {
            // Reactivate soft-revoked badge (no new token mint needed)
            isRevoked[to][badgeId] = false;
            revokedAt[to][badgeId] = 0;

            // Update expiration
            uint256 expiresAt = _getExpirationTime(badgeId);
            badgeExpiresAt[to][badgeId] = expiresAt;

            emit BadgeMinted(to, badgeId, easUID, expiresAt, block.timestamp);
            return; // Early return - no actual mint needed
        }

        // Check cooldown after hard revocation (§6.2.3)
        uint256 revoked = revokedAt[to][badgeId];
        if (revoked != 0) {
            uint256 cooldown = getCooldownForBadge(badgeId);
            if (block.timestamp < revoked + cooldown) {
                revert CooldownActive(to, badgeId, (revoked + cooldown) - block.timestamp);
            }
            // Clear revocation record after cooldown passed
            revokedAt[to][badgeId] = 0;
            isRevoked[to][badgeId] = false;
        }

        // Check if badge is expired (allows re-claim) or never owned
        if (hasBadge[to][badgeId] && !isExpired(to, badgeId)) {
            revert BadgeAlreadyOwned(to, badgeId);
        }

        // Mark as owned
        hasBadge[to][badgeId] = true;

        // Set expiration based on badge type
        uint256 expiresAt = _getExpirationTime(badgeId);
        badgeExpiresAt[to][badgeId] = expiresAt;

        // Mint badge
        _mint(to, badgeId, 1, "");

        emit BadgeMinted(to, badgeId, easUID, expiresAt, block.timestamp);
    }

    /// @notice Calculate expiration time for badge type
    /// @param badgeId Badge type ID
    /// @return expiresAt Timestamp when badge expires (0 = permanent)
    function _getExpirationTime(uint256 badgeId) internal view returns (uint256) {
        if (badgeId == AGENT_LIVE_60 || badgeId == BUILDER_VERIFIED) {
            return 0; // Permanent badges
        } else if (badgeId == AGENT_PRODUCTION) {
            return block.timestamp + PRODUCTION_VALIDITY;
        } else if (badgeId == PARTNER_NETWORK) {
            return block.timestamp + PARTNER_VALIDITY;
        } else if (badgeId == SECURITY_REVIEWED) {
            return block.timestamp + SECURITY_VALIDITY;
        } else if (badgeId == QUALITY_VERIFIED) {
            return block.timestamp + QUALITY_VALIDITY;
        }
        return 0;
    }

    /// @notice Batch mint multiple badges
    /// @dev Matches mint() logic: validates badge ID, checks cooldown, sets expiration
    function mintBatch(
        address to,
        uint256[] calldata badgeIds,
        bytes32[] calldata easUIDs
    ) external onlyRole(MINTER_ROLE) {
        require(badgeIds.length == easUIDs.length, "Length mismatch");

        uint256[] memory amounts = new uint256[](badgeIds.length);

        for (uint256 i = 0; i < badgeIds.length; i++) {
            uint256 badgeId = badgeIds[i];

            // Validate badge ID
            if (badgeId < 1 || badgeId > 6) {
                revert InvalidBadgeId(badgeId);
            }

            // Handle soft-revoked badges (SECURITY_REVIEWED)
            // Token exists but is inactive - just reactivate, don't mint new
            if (hasBadge[to][badgeId] && isRevoked[to][badgeId] && badgeId == SECURITY_REVIEWED) {
                // Reactivate soft-revoked badge (no new token mint needed)
                isRevoked[to][badgeId] = false;
                revokedAt[to][badgeId] = 0;
                uint256 expiresAt = _getExpirationTime(badgeId);
                badgeExpiresAt[to][badgeId] = expiresAt;
                amounts[i] = 0; // Don't mint new token
                emit BadgeMinted(to, badgeId, easUIDs[i], expiresAt, block.timestamp);
                continue; // Skip to next badge
            }

            // Check cooldown after hard revocation (§6.2.3)
            uint256 revoked = revokedAt[to][badgeId];
            if (revoked != 0) {
                uint256 cooldown = getCooldownForBadge(badgeId);
                if (block.timestamp < revoked + cooldown) {
                    revert CooldownActive(to, badgeId, (revoked + cooldown) - block.timestamp);
                }
                revokedAt[to][badgeId] = 0;
                isRevoked[to][badgeId] = false;
            }

            // Check if already owned and not expired
            if (hasBadge[to][badgeId] && !isExpired(to, badgeId)) {
                revert BadgeAlreadyOwned(to, badgeId);
            }

            // Mark as owned
            hasBadge[to][badgeId] = true;

            // Set expiration based on badge type
            uint256 expiresAt = _getExpirationTime(badgeId);
            badgeExpiresAt[to][badgeId] = expiresAt;

            amounts[i] = 1;

            emit BadgeMinted(to, badgeId, easUIDs[i], expiresAt, block.timestamp);
        }

        _mintBatch(to, badgeIds, amounts, "");
    }

    // ========== REVOCATION ==========

    /// @notice Revoke a badge (for fraud/abuse)
    /// @param from Badge holder address
    /// @param badgeId Badge to revoke
    /// @param reason Reason for revocation
    /// @dev EAS-backed badges (SECURITY_REVIEWED) use soft revoke (inactive, no burn)
    ///      Other badges use hard revoke (burn + cooldown before re-claim)
    function revoke(
        address from,
        uint256 badgeId,
        string calldata reason
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (!hasBadge[from][badgeId]) {
            revert BadgeNotOwned(from, badgeId);
        }

        // Record revocation timestamp and mark as revoked
        revokedAt[from][badgeId] = block.timestamp;
        isRevoked[from][badgeId] = true;

        // EAS-backed badge (SECURITY_REVIEWED): soft revoke
        // - Token remains (visible as "revoked trophy" on OpenSea)
        // - hasBadge stays true (prevents duplicate mint)
        // - isRevoked = true (badge is inactive)
        // - Re-claim requires new valid EAS attestation (no cooldown)
        if (badgeId == SECURITY_REVIEWED) {
            // Soft revoke: no burn, no hasBadge change
        } else {
            // Hard revoke: burn token, clear hasBadge, cooldown applies
            hasBadge[from][badgeId] = false;
            _burn(from, badgeId, 1);
        }

        emit BadgeRevoked(from, badgeId, reason, block.timestamp);
    }

    /// @notice Get cooldown period for a badge type
    /// @param badgeId Badge type ID
    /// @return cooldown Cooldown in seconds (0 for EAS-backed badges)
    function getCooldownForBadge(uint256 badgeId) public pure returns (uint256) {
        if (badgeId == SECURITY_REVIEWED) {
            return 0; // EAS-backed: no cooldown, requires new attestation
        } else if (badgeId == AGENT_LIVE_60 || badgeId == BUILDER_VERIFIED) {
            return COOLDOWN_PERMANENT; // 90 days
        } else {
            return COOLDOWN_STATS; // 30 days for stats-backed badges
        }
    }

    /// @notice Check if address is in cooldown period for a badge
    /// @param holder Address to check
    /// @param badgeId Badge type ID
    /// @return inCooldown True if still in cooldown
    function isInCooldown(address holder, uint256 badgeId) public view returns (bool) {
        uint256 revoked = revokedAt[holder][badgeId];
        if (revoked == 0) return false;

        uint256 cooldown = getCooldownForBadge(badgeId);
        return block.timestamp < revoked + cooldown;
    }

    /// @notice Check if a badge is currently active (owned, not revoked, not expired)
    /// @param holder Address to check
    /// @param badgeId Badge type ID
    /// @return active True if badge is active
    function isActive(address holder, uint256 badgeId) public view returns (bool) {
        return hasBadge[holder][badgeId]
            && !isRevoked[holder][badgeId]
            && !isExpired(holder, badgeId);
    }

    // ========== SOULBOUND (Transfer Disabled) ==========

    /// @notice Override to disable transfers (soulbound)
    function safeTransferFrom(
        address,
        address,
        uint256,
        uint256,
        bytes memory
    ) public pure override {
        revert TransferDisabled();
    }

    /// @notice Override to disable batch transfers (soulbound)
    function safeBatchTransferFrom(
        address,
        address,
        uint256[] memory,
        uint256[] memory,
        bytes memory
    ) public pure override {
        revert TransferDisabled();
    }

    // ========== METADATA ==========

    /// @notice Set URI for specific badge type
    function setURI(uint256 badgeId, string memory newuri)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        _uris[badgeId] = newuri;
    }

    /// @notice Get URI for badge type
    function uri(uint256 badgeId) public view override returns (string memory) {
        string memory badgeUri = _uris[badgeId];
        if (bytes(badgeUri).length > 0) {
            return badgeUri;
        }
        return super.uri(badgeId);
    }

    // ========== VIEW FUNCTIONS ==========

    /// @notice Check if badge is expired
    /// @param holder Badge holder address
    /// @param badgeId Badge type ID
    /// @return True if badge has expired (or never owned)
    function isExpired(address holder, uint256 badgeId) public view returns (bool) {
        if (!hasBadge[holder][badgeId]) return true; // Never owned
        uint256 expiresAt = badgeExpiresAt[holder][badgeId];
        if (expiresAt == 0) return false; // Permanent badge
        return block.timestamp > expiresAt;
    }

    /// @notice Check if holder has a valid (active, non-revoked, non-expired) badge
    /// @param holder Badge holder address
    /// @param badgeId Badge type ID
    /// @return True if holder has badge AND it's not revoked AND it's not expired
    function hasValidBadge(address holder, uint256 badgeId) external view returns (bool) {
        return hasBadge[holder][badgeId]
            && !isRevoked[holder][badgeId]
            && !isExpired(holder, badgeId);
    }

    /// @notice Get all badges owned by address (includes expired)
    function getBadges(address holder) external view returns (uint256[] memory) {
        uint256 count = 0;
        for (uint256 i = 1; i <= 6; i++) {
            if (hasBadge[holder][i]) count++;
        }

        uint256[] memory badges = new uint256[](count);
        uint256 index = 0;
        for (uint256 i = 1; i <= 6; i++) {
            if (hasBadge[holder][i]) {
                badges[index] = i;
                index++;
            }
        }
        return badges;
    }

    /// @notice Get all VALID (non-expired) badges owned by address
    function getValidBadges(address holder) external view returns (uint256[] memory) {
        uint256 count = 0;
        for (uint256 i = 1; i <= 6; i++) {
            if (hasBadge[holder][i] && !isExpired(holder, i)) count++;
        }

        uint256[] memory badges = new uint256[](count);
        uint256 index = 0;
        for (uint256 i = 1; i <= 6; i++) {
            if (hasBadge[holder][i] && !isExpired(holder, i)) {
                badges[index] = i;
                index++;
            }
        }
        return badges;
    }

    // ========== OVERRIDES ==========

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC1155, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function _update(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory values
    ) internal override(ERC1155, ERC1155Supply) {
        super._update(from, to, ids, values);
    }
}
```

### 3.2 BadgeClaimer (Eligibility Verification)

```solidity
// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@ethereum-attestation-service/eas-contracts/contracts/IEAS.sol";

interface IBuilderRegistry {
    struct BuilderStats {
        uint256 totalGMV;
        uint256 uniqueCounterparties;
        uint256 successRate;
        uint256 registeredAt;
        uint8 status; // 0=TRIAL, 1=ACTIVE, 2=VERIFIED
        address partner; // Linked partner (if any)
    }

    struct PartnerStats {
        uint256 activeBuilderCount;
        uint256 totalBuilderCount;
        uint256 totalGMVReferred;
        uint8 status; // 0=PENDING, 1=ACTIVE, 2=SUSPENDED
    }

    function getBuilderStats(address builder) external view returns (BuilderStats memory);
    function getBuilderOf(address agent) external view returns (address);
    function getPartnerStats(address partner) external view returns (PartnerStats memory);
}

/// @notice Minimal interface for AgentRegistry (AIP-7)
/// @dev Uses AgentBadgeInfo subset to avoid ABI mismatch with full AgentProfile
interface IAgentRegistry {
    struct AgentBadgeInfo {
        uint256 registeredAt;       // For AGENT_LIVE_60 age check
        uint256 reputationScore;    // For future reputation-gated badges
        uint256 totalTransactions;  // For activity verification
        bool isActive;              // Must be active to claim badges
    }

    function getAgentForBadges(address agent) external view returns (AgentBadgeInfo memory);
}

interface IAgentPassport {
    function tokenIdFor(address agent) external pure returns (uint256);
    function passportExists(address agent) external view returns (bool);
}

interface IAgentBadges {
    function mint(address to, uint256 badgeId, bytes32 easUID) external;
    function hasBadge(address holder, uint256 badgeId) external view returns (bool);
    function hasValidBadge(address holder, uint256 badgeId) external view returns (bool);
    function isExpired(address holder, uint256 badgeId) external view returns (bool);
}

interface IERC6551Registry {
    function account(
        address implementation,
        bytes32 salt,
        uint256 chainId,
        address tokenContract,
        uint256 tokenId
    ) external view returns (address);

    function createAccount(
        address implementation,
        bytes32 salt,
        uint256 chainId,
        address tokenContract,
        uint256 tokenId
    ) external returns (address);
}

/// @title BadgeClaimer
/// @notice Verifies eligibility and mints badges to agent TBAs
/// @dev Uses AIP-8 thresholds for eligibility criteria
contract BadgeClaimer is AccessControl {
    // ========== ROLES ==========

    /// @notice Role required to manage trusted security issuers
    bytes32 public constant ISSUER_ADMIN_ROLE = keccak256("ISSUER_ADMIN_ROLE");

    // ========== CONSTANTS (from AIP-8 §2.4) ==========

    /// @notice Minimum GMV for AGENT_PRODUCTION badge ($1000 USDC)
    uint256 public constant MIN_GMV_FOR_PRODUCTION = 1000 * 1e6;

    /// @notice Minimum counterparties for AGENT_PRODUCTION
    uint256 public constant MIN_COUNTERPARTIES = 5;

    /// @notice Minimum success rate for AGENT_PRODUCTION (95%)
    uint256 public constant MIN_SUCCESS_RATE = 9500; // 95.00% in basis points

    /// @notice Minimum active days for AGENT_LIVE_60
    uint256 public constant MIN_ACTIVE_DAYS = 60;

    /// @notice Minimum transactions for AGENT_LIVE_60 (anti-gaming)
    /// @dev Prevents claiming badge without actual protocol usage
    uint256 public constant MIN_TRANSACTIONS_FOR_LIVE = 3;

    /// @notice Minimum satisfaction rate for QUALITY_VERIFIED (94%)
    uint256 public constant MIN_SATISFACTION_RATE = 9400;

    /// @notice Minimum builders for PARTNER_NETWORK
    uint256 public constant MIN_BUILDERS_FOR_PARTNER = 10;

    // ========== STATE ==========

    /// @notice EAS schema UID for security review attestations
    /// @dev Set in constructor, must match registered schema on EAS
    bytes32 public immutable SECURITY_REVIEW_SCHEMA;

    IBuilderRegistry public immutable builderRegistry;
    IAgentRegistry public immutable agentRegistry;
    IAgentPassport public immutable passportContract;
    IAgentBadges public immutable badgeContract;
    IERC6551Registry public immutable tbaRegistry;
    IEAS public immutable eas;

    address public immutable tbaImplementation;

    /// @notice Trusted security auditor addresses
    mapping(address => bool) public trustedSecurityIssuers;

    // ========== EVENTS ==========

    event BadgeClaimed(
        address indexed agent,
        uint256 indexed badgeId,
        address tba,
        bytes32 easUID
    );

    // ========== ERRORS ==========

    error NotEligible(uint256 badgeId, string reason);
    error PassportRequired(address agent);
    error AlreadyHasBadge(address agent, uint256 badgeId);

    // ========== CONSTRUCTOR ==========

    constructor(
        address _builderRegistry,
        address _agentRegistry,
        address _passportContract,
        address _badgeContract,
        address _tbaRegistry,
        address _tbaImplementation,
        address _eas,
        bytes32 _securityReviewSchema
    ) {
        builderRegistry = IBuilderRegistry(_builderRegistry);
        agentRegistry = IAgentRegistry(_agentRegistry);
        passportContract = IAgentPassport(_passportContract);
        badgeContract = IAgentBadges(_badgeContract);
        tbaRegistry = IERC6551Registry(_tbaRegistry);
        tbaImplementation = _tbaImplementation;
        eas = IEAS(_eas);
        SECURITY_REVIEW_SCHEMA = _securityReviewSchema;

        // Grant roles to deployer
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ISSUER_ADMIN_ROLE, msg.sender);
    }

    // ========== CLAIM FUNCTIONS ==========

    /// @notice Claim AGENT_LIVE_60 badge
    /// @param agent Agent address to claim badge for
    /// @dev Requires 60+ days active AND minimum 3 transactions (anti-gaming)
    function claimAgentLive60(address agent) external {
        _verifyPassportExists(agent);

        // Check eligibility: active 60+ days + minimum transactions
        IAgentRegistry.AgentProfile memory profile = agentRegistry.getAgent(agent);
        uint256 activeDays = (block.timestamp - profile.registeredAt) / 1 days;

        if (activeDays < MIN_ACTIVE_DAYS) {
            revert NotEligible(1, "Less than 60 days active");
        }

        if (!profile.isActive) {
            revert NotEligible(1, "Agent not active");
        }

        // Anti-gaming: require minimum transactions to prove actual usage
        // Prevents: register agent → wait 60 days → claim badge → never transact
        if (profile.totalTransactions < MIN_TRANSACTIONS_FOR_LIVE) {
            revert NotEligible(1, "Less than 3 transactions");
        }

        _mintBadgeToTBA(agent, 1, bytes32(0));
    }

    /// @notice Claim AGENT_PRODUCTION badge
    /// @param agent Agent address to claim badge for
    function claimAgentProduction(address agent) external {
        _verifyPassportExists(agent);

        // Get builder stats (AIP-8 §2.4 thresholds)
        address builder = builderRegistry.getBuilderOf(agent);

        // Use try/catch to respect AIP-8 §4.3 invariant (recordGMV NEVER reverts)
        try builderRegistry.getBuilderStats(builder) returns (
            IBuilderRegistry.BuilderStats memory stats
        ) {
            // Check GMV threshold ($1000)
            if (stats.totalGMV < MIN_GMV_FOR_PRODUCTION) {
                revert NotEligible(2, "GMV below $1000");
            }

            // Check counterparty threshold (5)
            if (stats.uniqueCounterparties < MIN_COUNTERPARTIES) {
                revert NotEligible(2, "Less than 5 counterparties");
            }

            // Check success rate (95%)
            if (stats.successRate < MIN_SUCCESS_RATE) {
                revert NotEligible(2, "Success rate below 95%");
            }
        } catch {
            revert NotEligible(2, "Cannot read builder stats");
        }

        _mintBadgeToTBA(agent, 2, bytes32(0));
    }

    /// @notice Claim BUILDER_VERIFIED badge
    /// @param agent Agent address to claim badge for
    /// @dev Badge is minted to BUILDER WALLET (not agent TBA) - see §2.4
    function claimBuilderVerified(address agent) external {
        _verifyPassportExists(agent);

        address builder = builderRegistry.getBuilderOf(agent);

        try builderRegistry.getBuilderStats(builder) returns (
            IBuilderRegistry.BuilderStats memory stats
        ) {
            // Check VERIFIED status (AIP-8 §2.5)
            if (stats.status != 2) { // 2 = VERIFIED
                revert NotEligible(3, "Builder not verified");
            }
        } catch {
            revert NotEligible(3, "Cannot read builder status");
        }

        // BUILDER_VERIFIED is an entity badge - minted to builder wallet, not TBA
        _mintBadgeToEntity(builder, 3, bytes32(0));
        emit BadgeClaimed(agent, 3, builder, bytes32(0));
    }

    /// @notice Claim SECURITY_REVIEWED badge
    /// @param agent Agent address to claim badge for
    /// @param easUID EAS attestation UID from trusted security issuer
    function claimSecurityReviewed(address agent, bytes32 easUID) external {
        _verifyPassportExists(agent);

        // Verify EAS attestation exists and is from trusted issuer
        Attestation memory attestation = eas.getAttestation(easUID);

        // Check 1: Schema must be SECURITY_REVIEW_SCHEMA
        if (attestation.schema != SECURITY_REVIEW_SCHEMA) {
            revert NotEligible(5, "Wrong attestation schema");
        }

        // Check 2: Attester must be trusted
        if (!trustedSecurityIssuers[attestation.attester]) {
            revert NotEligible(5, "Attestation not from trusted issuer");
        }

        // Check 3: Attestation must not be revoked
        if (attestation.revocationTime != 0) {
            revert NotEligible(5, "Attestation revoked");
        }

        // Check 4: Recipient must be this agent
        // EAS `recipient` field identifies the subject of the attestation
        if (attestation.recipient != agent) {
            revert NotEligible(5, "Attestation not for this agent");
        }

        _mintBadgeToTBA(agent, 5, easUID);
    }

    /// @notice Claim QUALITY_VERIFIED badge
    /// @param agent Agent address to claim badge for
    function claimQualityVerified(address agent) external {
        _verifyPassportExists(agent);

        // Check reputation score (94%+ satisfaction = 9400+ score)
        IAgentRegistry.AgentProfile memory profile = agentRegistry.getAgent(agent);

        if (profile.reputationScore < MIN_SATISFACTION_RATE) {
            revert NotEligible(6, "Satisfaction below 94%");
        }

        // Minimum transactions for statistical significance
        if (profile.totalTransactions < 10) {
            revert NotEligible(6, "Less than 10 transactions");
        }

        _mintBadgeToTBA(agent, 6, bytes32(0));
    }

    /// @notice Claim PARTNER_NETWORK badge
    /// @param agent Agent address to claim badge for
    /// @dev Badge is minted to PARTNER WALLET (not agent TBA) - see §2.4
    /// @dev Requires agent's partner to have referred 10+ active builders (AIP-8 §3.3)
    function claimPartnerNetwork(address agent) external {
        _verifyPassportExists(agent);

        // Get the builder who owns this agent
        address builder = builderRegistry.getBuilderOf(agent);

        address partner;

        // Get the partner linked to this builder (if any)
        try builderRegistry.getBuilderStats(builder) returns (
            IBuilderRegistry.BuilderStats memory stats
        ) {
            partner = stats.partner;

            // Must have a linked partner
            if (partner == address(0)) {
                revert NotEligible(4, "Agent has no linked partner");
            }

            // Check partner's network size (10+ active builders)
            // This requires checking the partner's referred builder count
            IBuilderRegistry.PartnerStats memory partnerStats =
                builderRegistry.getPartnerStats(partner);

            if (partnerStats.activeBuilderCount < MIN_BUILDERS_FOR_PARTNER) {
                revert NotEligible(4, "Partner has less than 10 builders");
            }
        } catch {
            revert NotEligible(4, "Cannot read builder stats");
        }

        // PARTNER_NETWORK is an entity badge - minted to partner wallet, not TBA
        _mintBadgeToEntity(partner, 4, bytes32(0));
        emit BadgeClaimed(agent, 4, partner, bytes32(0));
    }

    // ========== INTERNAL FUNCTIONS ==========

    function _verifyPassportExists(address agent) internal view {
        if (!passportContract.passportExists(agent)) {
            revert PassportRequired(agent);
        }
    }

    function _mintBadgeToTBA(address agent, uint256 badgeId, bytes32 easUID) internal {
        // Get or create TBA for agent
        uint256 tokenId = passportContract.tokenIdFor(agent);
        address tba = tbaRegistry.account(
            tbaImplementation,
            bytes32(0),
            block.chainid,
            address(passportContract),
            tokenId
        );

        // Deploy TBA if not exists
        if (tba.code.length == 0) {
            tbaRegistry.createAccount(
                tbaImplementation,
                bytes32(0),
                block.chainid,
                address(passportContract),
                tokenId
            );
        }

        // Check if already has valid (non-expired) badge
        // Allows re-claim if badge has expired
        if (badgeContract.hasValidBadge(tba, badgeId)) {
            revert AlreadyHasBadge(agent, badgeId);
        }

        // Mint badge to TBA
        badgeContract.mint(tba, badgeId, easUID);

        emit BadgeClaimed(agent, badgeId, tba, easUID);
    }

    /// @notice Mint entity badge directly to builder/partner wallet
    /// @param entity Builder or partner address to receive badge
    /// @param badgeId Badge type ID (3 = BUILDER_VERIFIED, 4 = PARTNER_NETWORK)
    /// @param easUID EAS attestation UID (bytes32(0) for non-EAS badges)
    /// @dev Used for BUILDER_VERIFIED and PARTNER_NETWORK badges (see §2.4)
    function _mintBadgeToEntity(address entity, uint256 badgeId, bytes32 easUID) internal {
        // Check if already has valid (non-expired) badge
        // Allows re-claim if badge has expired
        if (badgeContract.hasValidBadge(entity, badgeId)) {
            revert AlreadyHasBadge(entity, badgeId);
        }

        // Mint badge directly to entity wallet
        badgeContract.mint(entity, badgeId, easUID);
    }

    // ========== ADMIN FUNCTIONS ==========

    /// @notice Add a trusted security auditor
    /// @param issuer Address of the security auditor
    /// @dev Only ISSUER_ADMIN_ROLE can call
    function addTrustedSecurityIssuer(address issuer) external onlyRole(ISSUER_ADMIN_ROLE) {
        trustedSecurityIssuers[issuer] = true;
        emit TrustedIssuerAdded(issuer, msg.sender);
    }

    /// @notice Remove a trusted security auditor
    /// @param issuer Address of the security auditor to remove
    /// @dev Only ISSUER_ADMIN_ROLE can call
    function removeTrustedSecurityIssuer(address issuer) external onlyRole(ISSUER_ADMIN_ROLE) {
        trustedSecurityIssuers[issuer] = false;
        emit TrustedIssuerRemoved(issuer, msg.sender);
    }

    // ========== EVENTS (Admin) ==========

    event TrustedIssuerAdded(address indexed issuer, address indexed addedBy);
    event TrustedIssuerRemoved(address indexed issuer, address indexed removedBy);
}
```

---

## 4. EAS Attestation Schemas

### 4.1 Agent Performance Schema

```json
{
  "name": "AGIRAILS Agent Performance",
  "description": "Verifiable performance metrics for AGIRAILS agents",
  "schema": "address agent, uint256 totalGMV, uint256 successRate, uint256 avgResponseTime, uint256 periodStart, uint256 periodEnd",
  "resolver": "0x0000000000000000000000000000000000000000",
  "revocable": true
}
```

### 4.2 Security Review Schema

```json
{
  "name": "AGIRAILS Security Review",
  "description": "Security audit attestation for agent smart contracts",
  "schema": "address agent, string reportCID, uint8 riskLevel, bool passed",
  "resolver": "0x0000000000000000000000000000000000000000",
  "revocable": true
}
```

---

## 5. Invariants

### 5.1 Protocol Invariants

| ID | Invariant | Verification |
|----|-----------|--------------|
| INV-10.1 | Agent badges (1,2,5,6) minted to TBA | _mintBadgeToTBA() enforces |
| INV-10.1b | Entity badges (3,4) minted to entity wallet | _mintBadgeToEntity() enforces |
| INV-10.2 | Badges are soulbound | Transfer functions revert |
| INV-10.3 | One VALID badge per type per recipient | hasValidBadge() check |
| INV-10.4 | Badges DO NOT affect fees | Fee logic in AIP-8, not here |
| INV-10.5 | Hybrid truth model | On-chain stats (primary) + EAS (secondary, badge 5 only) |
| INV-10.6 | AGENT_LIVE_60 requires transactions | MIN_TRANSACTIONS_FOR_LIVE (3) |
| INV-10.7 | AGENT_LIVE_60, BUILDER_VERIFIED permanent | expiresAt = 0 |
| INV-10.8 | Performance badges expire (90d/365d) | expiresAt = timestamp + validity |
| INV-10.9 | Expired badges allow re-claim | isExpired() enables new mint |

### 5.2 AIP-8 Alignment

| AIP-8 Threshold | Badge | Value |
|-----------------|-------|-------|
| §2.4 minTotalGMV | AGENT_PRODUCTION | $1,000 USDC |
| §2.4 minCounterparties | AGENT_PRODUCTION | 5 |
| §2.5 VERIFIED status | BUILDER_VERIFIED | status == 2 |
| §3.3 active builders | PARTNER_NETWORK | 10+ builders |

---

## 6. Security Considerations

### 6.1 Anti-Gaming Measures

| Attack | Mitigation |
|--------|------------|
| Sybil (fake transactions) | 5+ unique counterparties required |
| Volume inflation | Fee-paid transactions only (1% cost) |
| Time manipulation | 60-day window (blockchain time) |
| Self-attestation | Only trusted issuers for security badge |
| Idle farming (AGENT_LIVE_60) | 3+ transactions required (not just time) |

### 6.2 Revocation Policy

#### 6.2.1 Revocation Triggers

| Trigger | Badge Types Affected | Authority |
|---------|---------------------|-----------|
| Fraud detection (sybil, wash trading) | All performance badges (2,4,6) | Admin multisig |
| Security breach (compromised agent) | All badges | Admin multisig |
| EAS attestation revoked | SECURITY_REVIEWED (5) | Automatic |
| Builder status downgraded | BUILDER_VERIFIED (3) | Automatic |
| Community governance decision | Any badge | Governance vote |

#### 6.2.2 Revocation Authority

| Role | Revocation Power |
|------|------------------|
| **Admin Multisig (3-of-5)** | Can revoke any badge for fraud/abuse |
| **Protocol Governance** | Can revoke any badge via governance proposal |
| **Automatic** | EAS-backed badges auto-revoke if attestation revoked |
| **Badge Holder** | Cannot self-revoke (prevents gaming) |

#### 6.2.3 Post-Revocation Behavior

| Badge Type | After Revocation | Re-claim Eligible? |
|------------|------------------|-------------------|
| EAS-backed (5) | Token remains, marked inactive | Yes, with new valid attestation |
| Stats-backed (2,4,6) | Token burned | After 30-day cooldown, if eligible |
| Permanent (1,3) | Token burned | After 90-day cooldown, if eligible |

#### 6.2.4 Revocation Process

1. **Detection**: Fraud identified via indexer anomaly detection or community report
2. **Investigation**: Admin team reviews evidence (24-48h)
3. **Decision**: Multisig vote (3-of-5 required)
4. **Execution**: `revoke()` called with reason string
5. **Appeal**: Holder can appeal via governance (7-day window)

#### 6.2.5 Events Emitted

```solidity
event BadgeRevoked(
    address indexed holder,
    uint256 indexed badgeId,
    string reason,
    uint256 timestamp
);

event RevocationAppealed(
    address indexed holder,
    uint256 indexed badgeId,
    bytes32 appealId,
    uint256 timestamp
);
```

---

## 7. Gas Costs

| Operation | Estimated Gas | USD |
|-----------|---------------|-----|
| claimAgentLive60 | ~150,000 | $0.15 |
| claimAgentProduction | ~180,000 | $0.18 |
| claimPartnerNetwork | ~170,000 | $0.17 |
| Batch claim (3 badges) | ~350,000 | $0.35 |
| TBA deployment (first claim) | +100,000 | +$0.10 |

---

## 8. Implementation Checklist

| Phase | Task | Status |
|-------|------|--------|
| **Phase 1** | Deploy AgentBadges to Base Sepolia | Pending |
| **Phase 2** | Deploy BadgeClaimer | Pending |
| **Phase 3** | Register EAS schemas | Pending |
| **Phase 4** | Add trusted security issuers | Pending |
| **Phase 5** | SDK integration | Pending |
| **Phase 6** | OpenSea metadata service | Pending |
| **Phase 7** | Security audit | Pending |
| **Phase 8** | Mainnet deployment | Pending |

---

## 9. References

### AGIRAILS AIPs

- **AIP-4**: EAS Delivery Proof (attestation source)
- **AIP-8**: Builders & Partners (threshold values)
- **AIP-9**: Agent Passport (TBA binding)
- **AIP-11**: Token Bound Accounts (badge storage)

### External Standards

- **ERC-1155**: Multi Token Standard
- **EAS**: Ethereum Attestation Service
- **SBT**: Soulbound Token concept (non-transferable)

---

## 10. Changelog

- **2026-01-11**: Storage + revocation (v0.1.5)
  - Added storage layer reference to AIP-9 §2.4
  - Expanded §6.2 Revocation Policy with triggers, authority, process

- **2026-01-11**: Badge expiration (v0.1.4)
  - Added hybrid expiration model (§2.5)
  - AGENT_LIVE_60, BUILDER_VERIFIED: permanent
  - AGENT_PRODUCTION, PARTNER_NETWORK, QUALITY_VERIFIED: 90 days
  - SECURITY_REVIEWED: 365 days
  - Added `badgeExpiresAt` mapping and validity constants
  - Added `isExpired()`, `hasValidBadge()`, `getValidBadges()` view functions
  - Re-claim enabled after badge expiry (if still eligible)
  - Added INV-10.7, INV-10.8, INV-10.9 invariants

- **2026-01-11**: Hybrid container separation (v0.1.3)
  - Agent badges (1,2,5,6) → minted to agent TBA
  - Entity badges (3,4) → minted to builder/partner wallet
  - Added `_mintBadgeToEntity()` internal function
  - Updated `claimBuilderVerified()` to mint to builder wallet
  - Updated `claimPartnerNetwork()` to mint to partner wallet
  - Added §2.4 Badge Container Model documentation
  - Updated INV-10.1 to INV-10.1 + INV-10.1b

- **2026-01-11**: Feature complete (v0.1.2)
  - Implemented missing `claimPartnerNetwork()` function
  - Added `PartnerStats` struct to IBuilderRegistry interface
  - Added `partner` field to BuilderStats struct
  - Added `getPartnerStats()` function to interface

- **2026-01-11**: Security fix (v0.1.1)
  - Fixed AGENT_LIVE_60 gaming vulnerability (idle farming)
  - Added MIN_TRANSACTIONS_FOR_LIVE = 3 requirement
  - Updated eligibility to require time AND transactions
  - Added INV-10.6 invariant

- **2026-01-11**: Initial draft (v0.1.0)
  - 6 badge types with eligibility criteria
  - AgentBadges ERC-1155 contract (soulbound)
  - BadgeClaimer with AIP-8 threshold integration
  - EAS schema definitions

---

## 11. Copyright

Copyright 2026 AGIRAILS Inc.
Licensed under Apache-2.0.

This document and all AIP specifications are open-source and may be freely implemented by any party.

---

**END OF AIP-10**
