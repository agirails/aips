# AIP-9: Agent Passport NFT

**Status:** Draft
**Author:** AGIRAILS Core Team
**Created:** 2026-01-11
**Updated:** 2026-01-11
**Version:** 0.2.1
**Depends On:** AIP-7 (Agent Identity), AIP-8 (Builders & Partners)
**Extends:** AIP-8 Section 7 (Agent Ownership NFT)

---

## Abstract

This AIP specifies the **Agent Passport NFT** - an ERC-721 token representing transferable ownership of AI agents in the AGIRAILS ecosystem. It extends AIP-8 Section 7 (Agent Ownership NFT) with a complete specification for:

1. **Token-to-Agent Binding** - Deterministic tokenId derivation from agent address
2. **Transfer Mechanics** - Automatic BuilderRegistry synchronization on transfer
3. **Ownership Semantics** - Clear separation between Owner (Passport holder) and Builder roles
4. **NFT Marketplace Integration** - OpenSea/Blur compatible metadata and royalties

**Key Innovation**: Agent Passport is an **ownership token only** - it does NOT confer revenue rights or builder permissions. The Owner can replace builders, but the Builder earns the 15% fee split (AIP-8 §4.2).

---

## 1. Motivation

### 1.1 Current State (Pre-AIP-9)

AIP-8 Section 7 defines the conceptual design for AgentOwnershipNFT:
- tokenId derivation formula
- BuilderRegistry transfer sync
- Owner role semantics

However, AIP-8 lacks:
- Complete ERC-721 implementation specification
- NFT marketplace integration (metadata, royalties)
- Mint/burn lifecycle hooks
- Integration with AIP-7 AgentProfile

### 1.2 Problem Statement

Without a complete NFT specification:
1. **No Secondary Market** - Agents cannot be traded on OpenSea/Blur
2. **No Visual Identity** - No standardized metadata for agent NFTs
3. **No Portability** - Agents locked to original owner
4. **Fragmented Ownership** - Owner tracking split between multiple contracts

### 1.3 Solution Overview

AIP-9 provides:
- **Complete ERC-721 Implementation** - Full AgentPassport.sol specification
- **Marketplace Compatibility** - ERC-721Metadata, royalties, OpenSea integration
- **Lifecycle Hooks** - Mint on registration, burn on deregistration
- **Cross-AIP Integration** - Links AIP-7 (identity) and AIP-8 (marketplace)

---

## 2. Specification

### 2.1 Token ID Derivation

**Invariant (from AIP-8 §7.1):**

```
tokenId = uint256(uint160(agentAddress))
```

This creates a **deterministic, collision-free** mapping:
- Every Ethereum address maps to exactly one tokenId
- No two agents can have the same tokenId
- tokenId is predictable from agent address (no registry lookup needed)

**Example:**
```
Agent: 0x742d35cc6634c0532925a3b844bc9e7595f0beb
tokenId: 666122601909394972456219628283629401117640753131
```

### 2.2 Contract Interface

```solidity
// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Minimal interface for AgentRegistry (AIP-7)
/// @dev Only fields needed by AgentPassport are included.
///      Full AgentProfile struct defined in AIP-7 §3.1 has additional fields:
///      agentAddress, did, endpoint, serviceTypes, stakedAmount, reputationScore,
///      totalTransactions, disputedTransactions, totalVolumeUSDC, updatedAt
///      NOTE: Owner is NOT in AgentProfile - use BuilderRegistry.getAgent().owner
interface IAgentRegistry {
    struct AgentProfile {
        uint256 registeredAt;    // Used for AGENT_LIVE_60 eligibility
        bool isActive;           // Used for active agent check
    }
    function getAgent(address agent) external view returns (AgentProfile memory);
}

interface IBuilderRegistry {
    struct Agent {
        address owner;
        address builder;
        address partner;
        uint256 registeredAt;
    }
    function transferOwnership(address agent, address newOwner) external;
    function getAgent(address agent) external view returns (Agent memory);
}

/// @title AgentPassport
/// @notice ERC-721 NFT representing ownership of AGIRAILS AI agents
/// @dev Extends AIP-8 Section 7 with full ERC-721 implementation
contract AgentPassport is
    ERC721,
    ERC721Enumerable,
    ERC721URIStorage,
    ERC2981,
    Ownable
{
    // ========== STATE VARIABLES ==========

    /// @notice AIP-7 Agent Registry contract
    IAgentRegistry public immutable agentRegistry;

    /// @notice AIP-8 Builder Registry contract
    IBuilderRegistry public immutable builderRegistry;

    /// @notice Base URI for token metadata
    string public baseTokenURI;

    /// @notice Mapping from tokenId to agent address
    mapping(uint256 => address) public agentOf;

    /// @notice Mapping from agent address to tokenId
    mapping(address => uint256) public tokenOfAgent;

    /// @notice Mapping to track minted tokens
    mapping(uint256 => bool) public tokenMinted;

    // ========== EVENTS ==========

    /// @notice Emitted when a passport is minted for an agent
    event PassportMinted(
        address indexed agent,
        address indexed owner,
        uint256 indexed tokenId,
        uint256 timestamp
    );

    /// @notice Emitted when a passport is burned
    event PassportBurned(
        address indexed agent,
        uint256 indexed tokenId,
        uint256 timestamp
    );

    /// @notice Emitted when ownership transfers
    event OwnershipTransferred(
        address indexed agent,
        address indexed fromOwner,
        address indexed toOwner,
        uint256 tokenId
    );

    // ========== ERRORS ==========

    error PassportAlreadyMinted(address agent);
    error PassportNotMinted(address agent);
    error AgentNotRegistered(address agent);
    error UnauthorizedMinter(address caller);
    error InvalidAgent(address agent);

    // ========== CONSTRUCTOR ==========

    constructor(
        address _agentRegistry,
        address _builderRegistry,
        string memory _name,
        string memory _symbol,
        string memory _baseTokenURI,
        address _royaltyReceiver,
        uint96 _royaltyBps
    )
        ERC721(_name, _symbol)
        Ownable(msg.sender)
    {
        agentRegistry = IAgentRegistry(_agentRegistry);
        builderRegistry = IBuilderRegistry(_builderRegistry);
        baseTokenURI = _baseTokenURI;

        // Set default royalty (2.5% to protocol treasury)
        _setDefaultRoyalty(_royaltyReceiver, _royaltyBps);
    }

    // ========== CORE FUNCTIONS ==========

    /// @notice Compute tokenId from agent address (AIP-8 invariant)
    /// @param agent The agent's Ethereum address
    /// @return tokenId The deterministic token ID
    function tokenIdFor(address agent) public pure returns (uint256) {
        return uint256(uint160(agent));
    }

    /// @notice Mint a passport for a registered agent
    /// @param agent The agent address to mint passport for
    /// @param owner The owner who will receive the passport
    /// @dev Only callable by AgentRegistry (AIP-7) or BuilderRegistry (AIP-8)
    function mintPassport(address agent, address owner) external {
        // Verify caller is AgentRegistry OR BuilderRegistry
        if (msg.sender != address(agentRegistry) && msg.sender != address(builderRegistry)) {
            revert UnauthorizedMinter(msg.sender);
        }

        // Verify agent address is valid
        if (agent == address(0)) {
            revert InvalidAgent(agent);
        }

        uint256 tokenId = tokenIdFor(agent);

        // Verify passport not already minted
        if (tokenMinted[tokenId]) {
            revert PassportAlreadyMinted(agent);
        }

        // Mint the passport
        _safeMint(owner, tokenId);

        // Update mappings
        agentOf[tokenId] = agent;
        tokenOfAgent[agent] = tokenId;
        tokenMinted[tokenId] = true;

        // Note: tokenId is deterministic (uint256(uint160(agent))), no need to store in registry
        // Anyone can derive it from agent address using tokenIdFor()

        emit PassportMinted(agent, owner, tokenId, block.timestamp);
    }

    /// @notice Burn a passport when agent is deregistered
    /// @param agent The agent address whose passport to burn
    /// @dev Only callable by AgentRegistry during deregistration
    function burnPassport(address agent) external {
        // Verify caller is AgentRegistry
        if (msg.sender != address(agentRegistry)) {
            revert UnauthorizedMinter(msg.sender);
        }

        uint256 tokenId = tokenIdFor(agent);

        // Verify passport exists
        if (!tokenMinted[tokenId]) {
            revert PassportNotMinted(agent);
        }

        // Burn the token
        _burn(tokenId);

        // Clear mappings
        delete agentOf[tokenId];
        delete tokenOfAgent[agent];
        delete tokenMinted[tokenId];

        emit PassportBurned(agent, tokenId, block.timestamp);
    }

    // ========== TRANSFER OVERRIDE ==========

    /// @notice Override _update to sync ownership with BuilderRegistry
    /// @dev AIP-8 Invariant: Transfer → builderRegistry.transferOwnership()
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override(ERC721, ERC721Enumerable) returns (address from) {
        from = super._update(to, tokenId, auth);

        // Sync ownership change with BuilderRegistry (AIP-8 §7.2)
        address agent = agentOf[tokenId];
        if (agent != address(0) && to != address(0) && from != address(0)) {
            // Transfer ownership in BuilderRegistry
            builderRegistry.transferOwnership(agent, to);

            // Note: Partner attribution REMAINS UNCHANGED (AIP-8 §3.2)
            // Partner is linked to BUILDER, not OWNER

            emit OwnershipTransferred(agent, from, to, tokenId);
        }

        return from;
    }

    // ========== METADATA ==========

    /// @notice Set base URI for all tokens
    /// @param _baseTokenURI New base URI
    function setBaseURI(string memory _baseTokenURI) external onlyOwner {
        baseTokenURI = _baseTokenURI;
    }

    /// @notice Get base URI
    function _baseURI() internal view override returns (string memory) {
        return baseTokenURI;
    }

    /// @notice Get full token URI
    /// @param tokenId The token ID
    /// @return URI to token metadata JSON
    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    // ========== ROYALTIES ==========

    /// @notice Update default royalty
    /// @param receiver Address to receive royalties
    /// @param feeNumerator Royalty percentage in basis points (250 = 2.5%)
    function setDefaultRoyalty(address receiver, uint96 feeNumerator) external onlyOwner {
        _setDefaultRoyalty(receiver, feeNumerator);
    }

    // ========== VIEW FUNCTIONS ==========

    /// @notice Check if passport exists for agent
    /// @param agent The agent address
    /// @return exists True if passport is minted
    function passportExists(address agent) external view returns (bool exists) {
        return tokenMinted[tokenIdFor(agent)];
    }

    /// @notice Get owner of agent's passport
    /// @param agent The agent address
    /// @return owner The passport owner address
    function ownerOfAgent(address agent) external view returns (address owner) {
        uint256 tokenId = tokenIdFor(agent);
        if (!tokenMinted[tokenId]) {
            return address(0);
        }
        return ownerOf(tokenId);
    }

    // ========== REQUIRED OVERRIDES ==========

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable, ERC721URIStorage, ERC2981)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function _increaseBalance(address account, uint128 value)
        internal
        override(ERC721, ERC721Enumerable)
    {
        super._increaseBalance(account, value);
    }
}
```

### 2.3 Metadata Schema

Agent Passport metadata follows OpenSea metadata standards:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "AGIRAILS Agent Passport Metadata",
  "type": "object",
  "required": ["name", "description", "image", "attributes"],
  "properties": {
    "name": {
      "type": "string",
      "description": "Agent display name",
      "example": "GPT-4 Translation Agent"
    },
    "description": {
      "type": "string",
      "description": "Agent description"
    },
    "image": {
      "type": "string",
      "format": "uri",
      "description": "IPFS or HTTPS URL to agent visual"
    },
    "external_url": {
      "type": "string",
      "format": "uri",
      "description": "URL to agent on agirails.market"
    },
    "attributes": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "trait_type": { "type": "string" },
          "value": { "type": ["string", "number"] },
          "display_type": { "type": "string" }
        }
      },
      "description": "OpenSea-compatible attributes"
    },
    "agirails": {
      "type": "object",
      "description": "AGIRAILS-specific metadata",
      "properties": {
        "agentAddress": { "type": "string", "pattern": "^0x[a-fA-F0-9]{40}$" },
        "did": { "type": "string" },
        "serviceTypes": { "type": "array", "items": { "type": "string" } },
        "registeredAt": { "type": "integer" },
        "totalTransactions": { "type": "integer" },
        "reputationScore": { "type": "integer" },
        "builderAddress": { "type": "string" },
        "partnerAddress": { "type": "string" }
      }
    }
  }
}
```

**Example Metadata:**

```json
{
  "name": "GPT-4 Translation Agent",
  "description": "Professional AI translation agent supporting 50+ languages with 99.7% accuracy",
  "image": "ipfs://QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG",
  "external_url": "https://agirails.market/agent/0x742d35cc6634c0532925a3b844bc9e7595f0beb",
  "attributes": [
    { "trait_type": "Service Type", "value": "translation" },
    { "trait_type": "Total Transactions", "value": 1247, "display_type": "number" },
    { "trait_type": "Reputation Score", "value": 9850, "display_type": "number" },
    { "trait_type": "Registration Date", "value": 1704067200, "display_type": "date" },
    { "trait_type": "Builder Verified", "value": "Yes" },
    { "trait_type": "Production Badge", "value": "Yes" }
  ],
  "agirails": {
    "agentAddress": "0x742d35cc6634c0532925a3b844bc9e7595f0beb",
    "did": "did:ethr:8453:0x742d35cc6634c0532925a3b844bc9e7595f0beb",
    "serviceTypes": ["translation", "localization"],
    "registeredAt": 1704067200,
    "totalTransactions": 1247,
    "reputationScore": 9850,
    "builderAddress": "0xabc123...",
    "partnerAddress": "0xdef456..."
  }
}
```

### 2.4 Metadata Storage Layer

**Requirement (Whitepaper §2.5)**: IPFS/Arweave fallback is mandatory to avoid "empty NFT" credibility failures.

#### 2.4.1 Storage Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     METADATA RESOLUTION                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. tokenURI(tokenId) → baseURI + tokenId + ".json"             │
│                                                                 │
│  2. Resolution Priority:                                        │
│     ┌─────────────┐   ┌─────────────┐   ┌─────────────┐        │
│     │ IPFS (CID)  │ → │  Arweave    │ → │  AGIRAILS   │        │
│     │  Primary    │   │   Backup    │   │   API       │        │
│     └─────────────┘   └─────────────┘   └─────────────┘        │
│                                                                 │
│  3. All URIs use content-addressing (CID/TxID):                 │
│     - ipfs://Qm...                                              │
│     - ar://tx_id                                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 2.4.2 URI Format

| Layer | URI Format | Example |
|-------|-----------|---------|
| IPFS | `ipfs://{CID}` | `ipfs://QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG` |
| Arweave | `ar://{TxID}` | `ar://8F3cK7hH8g...` |
| Fallback | `https://api.agirails.io/metadata/{tokenId}` | Dynamic API |

#### 2.4.3 Pinning Requirements

| Content Type | IPFS Pinning | Arweave Archive | Refresh Interval |
|--------------|--------------|-----------------|------------------|
| Agent metadata JSON | Required | Required | On attribute change |
| Agent avatar image | Required | Required | On image change |
| Badge metadata JSON | Required | Required | On mint |
| Badge images | Required | Required | Static (immutable) |

#### 2.4.4 Content Addressing

All metadata and images MUST use content-addressed storage:

```typescript
// GOOD: Content-addressed (immutable)
"image": "ipfs://QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG"

// BAD: Mutable URL (can be changed/removed)
"image": "https://api.agirails.io/images/avatar.png"
```

**Exception**: `external_url` may use HTTPS for linking to marketplace pages.

#### 2.4.5 Metadata Update Process

1. **Generate new metadata JSON**
2. **Upload to IPFS** → receive CID
3. **Pin to Filebase/Pinata** (redundant pinning)
4. **Archive to Arweave** → receive TxID
5. **Update tokenURI** (if baseURI changed) or indexer

---

## 3. Integration with AIP-7

### 3.1 Deterministic TokenId (No Registry Storage)

**Design Decision**: TokenId is deterministically derived from agent address, eliminating need for storage:

```solidity
// Anyone can compute tokenId from agent address
function tokenIdFor(address agent) public pure returns (uint256) {
    return uint256(uint160(agent));
}
```

**Why no passportTokenId in AgentProfile?**
- **Gas savings**: No storage write on mint/burn
- **Simplicity**: Single source of truth (derivation function)
- **Composability**: External contracts can compute tokenId without registry calls

**Querying passport status**:
```solidity
// Check if agent has passport
bool hasPassport = passportContract.tokenMinted(passportContract.tokenIdFor(agent));

// Get passport owner
address owner = passportContract.ownerOf(passportContract.tokenIdFor(agent));
```

### 3.2 Registration Hook

**AIP-7 Flow** (self-registration): Agent registers itself, passport minted to self:

```solidity
// AgentRegistry.sol
function registerAgent(...) external {
    // ... registration logic ...

    // agent = msg.sender, owner = msg.sender (same)
    if (address(passportContract) != address(0)) {
        passportContract.mintPassport(msg.sender, msg.sender);
    }
}
```

**AIP-8 Flow** (builder-registers-agent): Builder registers agent for an owner:

```solidity
// BuilderRegistry.sol (extends AgentRegistry)
function registerAgentForOwner(address agent, address owner) external {
    require(isBuilder[msg.sender], "Not a builder");
    // ... registration logic ...

    // agent = agent param, owner = owner param (different from msg.sender!)
    if (address(passportContract) != address(0)) {
        passportContract.mintPassport(agent, owner);
    }
}
```

**Key Design**: `mintPassport(agent, owner)` accepts explicit owner parameter, enabling both flows.

### 3.3 Deregistration Hook

When agent deregisters:

```solidity
function deregisterAgent(address agent) external {
    // ... validation ...

    // Burn passport if exists
    if (address(passportContract) != address(0) &&
        passportContract.passportExists(agent)) {
        passportContract.burnPassport(agent);
    }

    // ... cleanup ...
}
```

---

## 4. Integration with AIP-8

### 4.1 Ownership Semantics

From AIP-8 §5.1, the **Owner** role:
- Owns the Agent Passport NFT
- Can replace the builder (30-day notice)
- Receives residual earnings after builder/partner fees

**AIP-9 Invariant**: `ownerOf(tokenIdFor(agent)) == builderRegistry.getAgent(agent).owner`

### 4.2 Transfer → BuilderRegistry Sync

When passport transfers, the new owner is synced to BuilderRegistry:

```solidity
// In AgentPassport._update()
builderRegistry.transferOwnership(agent, newOwner);
```

**Critical**: Partner attribution remains UNCHANGED on transfer (AIP-8 §3.2).

### 4.3 Builder Replacement

The passport owner can initiate builder replacement:

```solidity
// In BuilderRegistry
function initiateBuilderReplacement(address agent, address newBuilder) external {
    require(passportContract.ownerOfAgent(agent) == msg.sender, "Not owner");
    // ... 30-day notice period logic ...
}
```

---

## 5. Invariants

### 5.1 Protocol Invariants

| ID | Invariant | Verification |
|----|-----------|--------------|
| INV-9.1 | `tokenId = uint256(uint160(agentAddress))` | Pure function, deterministic |
| INV-9.2 | Passport = ownership ONLY (not revenue rights) | Owner role separated from Builder role |
| INV-9.3 | Transfer → BuilderRegistry.transferOwnership() | Enforced in _update() |
| INV-9.4 | Partner attribution PERMANENT | Not modified on transfer (AIP-8 §3.2) |
| INV-9.5 | One passport per agent | tokenMinted[] prevents double mint |

### 5.2 Security Invariants

| ID | Invariant | Threat Mitigated |
|----|-----------|------------------|
| SEC-9.1a | Only AgentRegistry OR BuilderRegistry can mint | Unauthorized minting |
| SEC-9.1b | Only AgentRegistry can burn | Unauthorized burning (destructive action) |
| SEC-9.2 | Cannot mint for unregistered agent | Ghost passports |
| SEC-9.3 | Cannot burn non-existent passport | State corruption |
| SEC-9.4 | Royalties cannot exceed 10% | Marketplace lockout |

> **Note**: BuilderRegistry can mint passports (for agent registration flow) but cannot burn.
> Burning is a destructive action restricted to AgentRegistry as the identity authority.

---

## 6. Security Considerations

### 6.1 Attack Vectors

| Attack | Mitigation |
|--------|------------|
| Unauthorized mint | `msg.sender == agentRegistry \|\| msg.sender == builderRegistry` check |
| Unauthorized burn | `msg.sender == agentRegistry` only (BuilderRegistry cannot burn) |
| Double mint | `tokenMinted[]` mapping |
| Rug pull via transfer | Owner can only change owner, not builder fees |
| Metadata spoofing | On-chain agentOf[] is source of truth |
| Royalty drain | Cap at 10%, protocol treasury receiver |

### 6.2 Audit Requirements

Before mainnet deployment:
- [ ] Slither static analysis
- [ ] OpenZeppelin Defender integration
- [ ] Manual audit of transfer hooks
- [ ] Fuzzing of tokenId derivation
- [ ] Integration testing with AIP-7/8 contracts

---

## 7. Gas Optimization

### 7.1 Expected Gas Costs

| Operation | Estimated Gas | USD (at $0.001/gas) |
|-----------|---------------|---------------------|
| mintPassport | ~150,000 | $0.15 |
| burnPassport | ~50,000 | $0.05 |
| transfer | ~80,000 | $0.08 |
| tokenURI | ~25,000 | $0.025 |

### 7.2 Optimization Notes

- ERC721Enumerable adds ~50k gas per transfer (needed for marketplace)
- Consider lazy metadata for gas savings
- Batch minting not supported (one passport per agent)

---

## 8. Implementation Checklist

| Phase | Task | Status |
|-------|------|--------|
| **Phase 1** | Deploy AgentPassport.sol to Base Sepolia | Pending |
| **Phase 2** | Update AgentRegistry with passport hooks | Pending |
| **Phase 3** | Update BuilderRegistry to accept passport calls | Pending |
| **Phase 4** | Deploy metadata service | Pending |
| **Phase 5** | Register on OpenSea | Pending |
| **Phase 6** | Security audit | Pending |
| **Phase 7** | Mainnet deployment | Pending |

---

## 9. References

### AGIRAILS AIPs

- **AIP-7**: Agent Identity, Registry & Storage (AgentProfile struct)
- **AIP-8**: Builders & Partners (Section 7: NFT Design, Owner role, BuilderRegistry)
- **AIP-10**: Reputation Badges (badges held in TBA, linked to passport)
- **AIP-11**: Token Bound Accounts (TBA for passport-owned badges)

### External Standards

- **ERC-721**: Non-Fungible Token Standard
- **ERC-721Enumerable**: Enumerable extension
- **ERC-721URIStorage**: URI storage extension
- **ERC-2981**: NFT Royalty Standard
- **OpenSea Metadata Standards**: https://docs.opensea.io/docs/metadata-standards

---

## 10. Changelog

- **2026-01-11**: Metadata storage layer (v0.2.1)
  - Added §2.4 Metadata Storage Layer specification
  - IPFS primary + Arweave backup (whitepaper §2.5 requirement)
  - Content-addressing requirements for all images
  - URI format and pinning requirements

- **2026-01-11**: Interface alignment (v0.2.0)
  - BREAKING: Removed setPassportTokenId() - tokenId is deterministic
  - BREAKING: Changed IBuilderRegistry to use getAgent().owner pattern
  - Updated IAgentRegistry and IBuilderRegistry interfaces with structs
  - Updated Section 3.1 to explain deterministic tokenId design
  - Removed INV-9.6 (no longer syncing with registry)

- **2026-01-11**: Initial draft (v0.1.0)
  - Complete AgentPassport.sol specification
  - Metadata schema definition
  - AIP-7 and AIP-8 integration
  - Invariants and security considerations

---

## 11. Copyright

Copyright 2026 AGIRAILS Inc.
Licensed under Apache-2.0.

This document and all AIP specifications are open-source and may be freely implemented by any party.

---

**END OF AIP-9**
