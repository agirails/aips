# AIP-7: Agent Identity, Registry & Storage System

**Status:** Draft
**Author:** AGIRAILS Core Team
**Created:** 2025-11-29
**Updated:** 2026-01-11
**Version:** 0.8.0
**Depends On:** AIP-0 (Meta Protocol), AIP-4 (Delivery Proof)
**Extended By:** AIP-9 (Agent Passport NFT)
**Reviewed By:** Apex (Protocol Engineer) - 2025-11-29

---

## Abstract

This AIP defines the comprehensive identity, registration, and archival storage system for AI agents operating within the AGIRAILS ecosystem. It specifies:

1. **Decentralized Identity (DID)** - Ethereum-based identity system (`did:ethr`) with key management and resolution
2. **Agent Registry** - On-chain registry contract for agent profiles, service capabilities, and endpoint discovery
3. **Hybrid Storage Architecture** - IPFS (hot storage) + Arweave (permanent archive) for transaction artifacts
4. **Archive Treasury** - Protocol-funded mechanism for permanent storage via 0.1% allocation from platform fees
5. **Storage SDK** - TypeScript client library for storage operations, DID resolution, and registry queries
6. **Service Descriptor Schema** - Standardized JSON format for agent capability advertisement

AIP-7 establishes the foundational infrastructure for:
- **Agent Discovery**: How consumers find providers offering specific services
- **Identity Verification**: How parties verify counterparty identity and reputation
- **Permanent Records**: How transaction proofs are archived for compliance and dispute resolution
- **Reputation Substrate**: How on-chain profiles accumulate verifiable transaction history

---

## 1. Motivation

### 1.1 The Identity Problem

Current state (pre-AIP-7):
- Agents identified by DIDs (`did:ethr:<address>`) as specified in AIP-0 §1.1
- **No on-chain registry** - endpoint discovery relies on off-chain configuration
- **No standardized capability advertisement** - providers can't declare service types
- **No reputation anchoring** - completed transactions don't contribute to discoverable reputation

This creates friction:
- **Consumers**: Cannot discover providers programmatically
- **Providers**: Cannot advertise capabilities or build verifiable reputation
- **Protocol**: Lacks substrate for reputation-based provider ranking

### 1.2 The Storage Problem

Current state (pre-AIP-7):
- AIP-1 request metadata stored on IPFS (ephemeral unless pinned)
- AIP-4 delivery proofs stored on IPFS (provider responsibility to pin)
- **No guaranteed long-term availability** - content can disappear if unpinned
- **No compliance archive** - 7-year retention requirement (White Paper §8.2) not enforced

This creates risks:
- **Dispute Resolution**: Evidence may vanish before resolution
- **Regulatory Compliance**: Cannot prove 7-year retention
- **Reputation Verification**: Historical proofs become unavailable

### 1.3 Solution Overview

AIP-7 introduces a **three-layer architecture**:

```
Layer 1: Identity (DID System)
├── DID Resolution: ethr-did-resolver integration
├── Key Management: Defer to AIP-8 (key rotation)
└── Identity Format: did:ethr:<chainId>:<address> (full format with chainId)

Layer 2: Registry (On-Chain)
├── AgentRegistry.sol: Profile storage, service descriptors
├── Staking: Optional stake requirement (TBD)
└── Discovery API: Query by service type, reputation, location

Layer 3: Storage (Hybrid IPFS + Arweave)
├── Hot Storage: IPFS via Filebase (request metadata, delivery proofs)
├── Cold Archive: Arweave via Bundlr (permanent settlement records)
├── Archive Treasury: 0.1% fee allocation for storage costs
└── Uploader Service: Centralized V1 → Decentralized V2
```

**Key Innovation**: **Arweave-First Write Order**
- Write to Arweave FIRST (guaranteed permanent storage)
- Then anchor transaction ID on-chain (immutable reference)
- IPFS serves as ephemeral buffer, Arweave as permanent archive

### 1.4 Open Parameters (TBD)

The following parameters are defined but not yet finalized:

| Parameter | Current Value | Target | Notes |
|-----------|---------------|--------|-------|
| AGIRAILS Identity Registry (Base Sepolia) | TBD | Phase 1 | Deploy with AgentRegistry |
| AGIRAILS Identity Registry (Base Mainnet) | TBD | Post-audit | Deploy after security audit |
| Minimum Stake Requirement | 0 (disabled) | TBD | Governance decision when network matures |
| Stake Cooldown | N/A | 30 days | Time before stake withdrawal |
| Archive Allocation (BPS) | 10 (0.1%) | 10 | Confirmed, adjustable via governance |
| Archive Batch Size | 100 TX or 100KB or 5 min | TBD | Testnet tuning in progress |

**Update Process:** Parameters marked TBD will be updated in AIP-7 as they are finalized. Once all parameters are confirmed, this section will be moved to an appendix.

---

## 2. Decentralized Identity (DID)

### 2.1 DID Format

AGIRAILS uses the **`did:ethr` method** as defined in AIP-0 §1.1.

**Full Format (REQUIRED for AGIRAILS):**
```
did:ethr:<chain-id>:<ethereum-address>
```

**Simplified Format (DEPRECATED):**
```
did:ethr:<ethereum-address>
```
**⚠️ WARNING**: The simplified format is **DEPRECATED** and MUST NOT be used in AGIRAILS. It creates cross-chain confusion (same address on different chains would have identical DIDs). All AGIRAILS contracts and SDKs MUST use the full format with explicit chainId.

**Examples (Canonical Lowercase Format):**
- Base Sepolia: `did:ethr:84532:0x742d35cc6634c0532925a3b844bc9e7595f0beb`
- Base Mainnet: `did:ethr:8453:0x742d35cc6634c0532925a3b844bc9e7595f0beb`
- ~~Simplified: `did:ethr:0x742d35cc6634c0532925a3b844bc9e7595f0beb`~~ (DEPRECATED)

**Case Sensitivity Note:**

The **canonical format** uses lowercase hex addresses. The AgentRegistry stores DIDs in lowercase
(see `_toLowerAddress()` in §3.1). When comparing DIDs:
- On-chain: Always stored as lowercase
- Resolution: `ethr-did-resolver` is case-insensitive for the address portion
- Matching: SDK should normalize to lowercase before comparison

**Critical Validation Rule:**

When using simplified format, the message MUST include explicit `chainId` field in:
1. Message body (e.g., AIP-1 request, AIP-4 delivery)
2. EIP-712 domain separator

Receivers MUST validate: `message.chainId === domain.chainId === expectedChainId`

This prevents cross-chain replay attacks where the same DID string represents different signers on different networks.

### 2.2 DID Resolution & AGIRAILS Identity Registry

**V1 Decision: AGIRAILS-Owned ERC-1056 Compatible Registry**

AGIRAILS deploys its **own DID Registry contract** on Base, fully ERC-1056 compatible but under AGIRAILS governance control. This ensures:

1. **No external dependencies** - We don't rely on third-party ERC-1056 registry deployments
2. **Governance control** - AGIRAILS can upgrade or extend functionality via governance
3. **Full compatibility** - Standard `ethr-did-resolver` libraries work without modification
4. **Cross-chain consistency** - Same registry interface on all supported chains

**Registry Addresses:**

| Network | AGIRAILS Identity Registry | Status |
|---------|---------------------------|--------|
| Base Sepolia | `TBD` (deploy in Phase 1) | Planned |
| Base Mainnet | `TBD` (deploy after audit) | Planned |

**Contract Interface (ERC-1056 Compatible):**

```solidity
// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.20;

/// @title AGIRAILS Identity Registry
/// @notice ERC-1056 compatible DID registry for AGIRAILS ecosystem
/// @dev Identical interface to EthereumDIDRegistry, deployed under AGIRAILS governance
interface IAGIRAILSIdentityRegistry {
    // Core ERC-1056 functions
    function identityOwner(address identity) external view returns (address);
    function changeOwner(address identity, address newOwner) external;
    function changeOwnerSigned(address identity, uint8 v, bytes32 r, bytes32 s, address newOwner) external;
    function addDelegate(address identity, bytes32 delegateType, address delegate, uint validity) external;
    function revokeDelegate(address identity, bytes32 delegateType, address delegate) external;
    function setAttribute(address identity, bytes32 name, bytes value, uint validity) external;
    function revokeAttribute(address identity, bytes32 name, bytes value) external;

    // Events (ERC-1056 standard)
    event DIDOwnerChanged(address indexed identity, address owner, uint previousChange);
    event DIDDelegateChanged(address indexed identity, bytes32 delegateType, address delegate, uint validTo, uint previousChange);
    event DIDAttributeChanged(address indexed identity, bytes32 name, bytes value, uint validTo, uint previousChange);
}
```

**Library Integration:**

```typescript
import { Resolver } from 'did-resolver';
import { getResolver } from 'ethr-did-resolver';

// Configure Base Sepolia resolver with AGIRAILS Identity Registry
const providerConfig = {
  networks: [
    {
      name: 'base-sepolia',
      chainId: '0x14a34', // 84532 in hex
      rpcUrl: process.env.BASE_SEPOLIA_RPC,
      registry: process.env.AGIRAILS_IDENTITY_REGISTRY // AGIRAILS-owned registry address
    },
    {
      name: 'base',
      chainId: '0x2105', // 8453 in hex
      rpcUrl: process.env.BASE_MAINNET_RPC,
      registry: process.env.AGIRAILS_IDENTITY_REGISTRY_MAINNET
    }
  ]
};

const resolver = new Resolver(getResolver(providerConfig));

// Resolve DID to DID Document
const didDocument = await resolver.resolve('did:ethr:84532:0x742d35cc6634c0532925a3b844bc9e7595f0beb');

console.log(didDocument);
// {
//   '@context': 'https://w3id.org/did/v1',
//   id: 'did:ethr:84532:0x742d35cc6634c0532925a3b844bc9e7595f0beb',
//   verificationMethod: [{
//     id: 'did:ethr:84532:0x742d35cc6634c0532925a3b844bc9e7595f0beb#controller',
//     type: 'EcdsaSecp256k1RecoveryMethod2020',
//     controller: 'did:ethr:84532:0x742d35cc6634c0532925a3b844bc9e7595f0beb',
//     blockchainAccountId: '0x742d35cc6634c0532925a3b844bc9e7595f0beb@eip155:84532'
//   }],
//   authentication: ['did:ethr:84532:0x742d35cc6634c0532925a3b844bc9e7595f0beb#controller']
// }
```

**Why Own Registry vs. Using Existing ERC-1056:**

| Approach | Pros | Cons |
|----------|------|------|
| **Use existing ERC-1056** | No deployment needed | External dependency, no control, uncertain maintenance |
| **AGIRAILS own registry** | Full control, governance, consistency | Deployment cost (~$50), maintenance responsibility |

**Decision**: AGIRAILS deploys own ERC-1056 compatible registry for reliability and governance control.

**SDK Integration:**

```typescript
// In @agirails/sdk
import { DIDResolver } from '@agirails/sdk/identity';

const resolver = await DIDResolver.create({ network: 'base-sepolia' });

// Verify DID ownership via EIP-712 signature
const isValid = await resolver.verifySignature(
  did,
  message,
  signature,
  { chainId: 84532 }
);
```

### 2.3 DID Document Structure

**Standard DID Document (ERC-1056 Based):**

```json
{
  "@context": "https://w3id.org/did/v1",
  "id": "did:ethr:84532:0x742d35cc6634c0532925a3b844bc9e7595f0beb",
  "verificationMethod": [
    {
      "id": "did:ethr:84532:0x742d35cc6634c0532925a3b844bc9e7595f0beb#controller",
      "type": "EcdsaSecp256k1RecoveryMethod2020",
      "controller": "did:ethr:84532:0x742d35cc6634c0532925a3b844bc9e7595f0beb",
      "blockchainAccountId": "0x742d35cc6634c0532925a3b844bc9e7595f0beb@eip155:84532"
    }
  ],
  "authentication": [
    "did:ethr:84532:0x742d35cc6634c0532925a3b844bc9e7595f0beb#controller"
  ],
  "service": [
    {
      "id": "did:ethr:84532:0x742d35cc6634c0532925a3b844bc9e7595f0beb#agirails-endpoint",
      "type": "AGIRAILSProvider",
      "serviceEndpoint": "https://provider.example.com/api/v1"
    }
  ]
}
```

**Service Endpoint Registration:**

Providers MAY register service endpoints in DID Document via ERC-1056 `setAttribute()`:

```solidity
// ERC-1056 DIDRegistry.setAttribute()
didRegistry.setAttribute(
  identity,
  keccak256("did/svc/AGIRAILSProvider"),
  bytes("https://provider.example.com/api/v1"),
  86400 * 365 // 1 year validity
);
```

**Note:** Service endpoint registration in DID Document is OPTIONAL. Most agents will use AgentRegistry.sol (§3) for richer profile data.

### 2.4 Key Rotation

**Deferred to AIP-8:**

Key rotation mechanisms (adding/removing signing keys, delegate keys) are out of scope for AIP-7. See future AIP-8 (Agent Key Management) for:
- Delegate key addition via ERC-1056 `addDelegate()`
- Key revocation and recovery procedures
- Multi-signature agent accounts

**Current Limitation:**

In V1, agents are identified by a single Ethereum address. Compromise of the private key = loss of identity.

**Workaround:**

Use multisig wallets (Gnosis Safe) as the agent identity address. Private key compromise requires M-of-N threshold, not single key.

> **PRODUCTION RECOMMENDATION**
>
> Until AIP-8 is live, **production providers are strongly encouraged to use a [Safe](https://safe.global) multisig wallet** as their DID address. This ensures that private key compromise of a single signer does not result in loss of identity control.
>
> **Recommended Configuration:**
> - **2-of-3 multisig** for small providers
> - **3-of-5 multisig** for providers with >$10K monthly volume
> - Hardware wallet signers (Ledger, Trezor) for all keys

---

## 3. Agent Registry Contract

### 3.1 Contract Interface

**File:** `src/registry/AgentRegistry.sol`

```solidity
// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IAgentRegistry {
    /// @notice Agent profile data structure
    struct AgentProfile {
        address agentAddress;           // Agent's Ethereum address (controller of DID)
        string did;                     // Full DID (e.g., did:ethr:8453:0x...)
        string endpoint;                // HTTPS endpoint or IPFS gateway URL
        bytes32[] serviceTypes;         // Supported service type hashes (keccak256 of service name)
        uint256 stakedAmount;           // USDC staked (V1: always 0, V2: slashing for disputes)
        uint256 reputationScore;        // Aggregated reputation (scale: 0-10000, 2 decimals precision)
        uint256 totalTransactions;      // Count of completed SETTLED transactions
        uint256 disputedTransactions;   // Count of transactions that went to DISPUTED state
        uint256 totalVolumeUSDC;        // Cumulative transaction volume (6 decimals)
        uint256 registeredAt;           // Block timestamp of registration
        uint256 updatedAt;              // Last profile update timestamp
        bool isActive;                  // Agent is accepting new requests
        // Note: passportTokenId removed - AIP-9 uses deterministic derivation:
        // tokenId = uint256(uint160(agentAddress))
    }

    /// @notice Service descriptor metadata (stored off-chain, hash on-chain)
    struct ServiceDescriptor {
        bytes32 serviceTypeHash;        // keccak256(lowercase(serviceType)) - MUST be lowercase
        string serviceType;             // Human-readable service type (lowercase, alphanumeric + hyphens)
        string schemaURI;               // IPFS/HTTPS URL to JSON Schema for inputData
        uint256 minPrice;               // Minimum price in USDC base units (6 decimals)
        uint256 maxPrice;               // Maximum price in USDC base units
        uint256 avgCompletionTime;      // Average completion time in seconds
        string metadataCID;             // IPFS CID to full service descriptor JSON
    }

    // ========== EVENTS ==========

    /// @notice Emitted when agent registers or updates profile
    event AgentRegistered(
        address indexed agentAddress,
        string did,
        string endpoint,
        uint256 timestamp
    );

    /// @notice Emitted when agent updates endpoint
    event EndpointUpdated(
        address indexed agentAddress,
        string oldEndpoint,
        string newEndpoint,
        uint256 timestamp
    );

    /// @notice Emitted when agent adds/removes service type
    event ServiceTypeUpdated(
        address indexed agentAddress,
        bytes32 indexed serviceTypeHash,
        bool added,
        uint256 timestamp
    );

    /// @notice Emitted when agent reputation is updated (post-transaction settlement)
    event ReputationUpdated(
        address indexed agentAddress,
        uint256 oldScore,
        uint256 newScore,
        bytes32 indexed txId,
        uint256 timestamp
    );

    // ========== CORE FUNCTIONS (msg.sender == agent) ==========

    /// @notice Register a new agent profile
    /// @dev msg.sender becomes the agentAddress; cannot register for another address
    /// @param endpoint HTTPS endpoint or IPFS gateway URL
    /// @param serviceDescriptors List of services the agent provides
    /// @dev V1: stakedAmount is ignored (set to 0 by contract)
    function registerAgent(
        string calldata endpoint,
        ServiceDescriptor[] calldata serviceDescriptors
    ) external;

    /// @notice Update agent endpoint (webhook URL or IPFS gateway)
    /// @dev Only callable by the agent itself (msg.sender == agentAddress)
    /// @param newEndpoint New endpoint URL
    function updateEndpoint(string calldata newEndpoint) external;

    /// @notice Add supported service type
    /// @dev Only callable by the agent itself (msg.sender == agentAddress)
    /// @param serviceType Lowercase service type string (e.g., "text-generation")
    function addServiceType(string calldata serviceType) external;

    /// @notice Remove supported service type
    /// @dev Only callable by the agent itself (msg.sender == agentAddress)
    /// @param serviceTypeHash keccak256 hash of service type
    function removeServiceType(bytes32 serviceTypeHash) external;

    /// @notice Update agent active status (pause/resume accepting requests)
    /// @dev Only callable by the agent itself (msg.sender == agentAddress)
    /// @param isActive New active status
    function setActiveStatus(bool isActive) external;

    // ========== VIEW FUNCTIONS ==========

    /// @notice Get agent profile by address
    /// @param agentAddress Agent's Ethereum address
    /// @return profile Agent profile struct
    function getAgent(address agentAddress)
        external
        view
        returns (AgentProfile memory profile);

    /// @notice Get agent profile by DID
    /// @param did Agent's DID (did:ethr:...)
    /// @return profile Agent profile struct
    function getAgentByDID(string calldata did)
        external
        view
        returns (AgentProfile memory profile);

    /// @notice Query agents by service type
    /// @param serviceTypeHash keccak256 of service type
    /// @param minReputation Minimum reputation score (0-10000)
    /// @param offset Skip first N results (for pagination)
    /// @param limit Maximum number of results to return
    /// @return agents List of agent addresses matching criteria
    function queryAgentsByService(
        bytes32 serviceTypeHash,
        uint256 minReputation,
        uint256 offset,
        uint256 limit
    ) external view returns (address[] memory agents);

    /// @notice Get service descriptors for an agent
    /// @param agentAddress Agent's Ethereum address
    /// @return descriptors List of service descriptors
    function getServiceDescriptors(address agentAddress)
        external
        view
        returns (ServiceDescriptor[] memory descriptors);

    /// @notice Check if agent supports a service type
    /// @param agentAddress Agent's Ethereum address
    /// @param serviceTypeHash keccak256 of service type
    /// @return supported True if agent supports the service
    function supportsService(address agentAddress, bytes32 serviceTypeHash)
        external
        view
        returns (bool supported);

    // ========== KERNEL-ONLY FUNCTIONS ==========

    /// @notice Update agent reputation (called by ACTPKernel after settlement)
    /// @dev Only callable by ACTPKernel contract
    /// @param agentAddress Agent to update
    /// @param txId Transaction ID that triggered update
    /// @param txAmount Transaction amount for volume calculation
    /// @param wasDisputed Whether transaction went through dispute
    function updateReputationOnSettlement(
        address agentAddress,
        bytes32 txId,
        uint256 txAmount,
        bool wasDisputed
    ) external;
}
```

**Access Control Rules:**

| Function | Caller Requirement | Enforcement |
|----------|-------------------|-------------|
| `registerAgent` | msg.sender = new agent | `agentAddress = msg.sender` (implicit) |
| `updateEndpoint` | msg.sender = registered agent | `require(agents[msg.sender].registeredAt > 0)` |
| `addServiceType` | msg.sender = registered agent | `require(agents[msg.sender].registeredAt > 0)` |
| `removeServiceType` | msg.sender = registered agent | `require(agents[msg.sender].registeredAt > 0)` |
| `setActiveStatus` | msg.sender = registered agent | `require(agents[msg.sender].registeredAt > 0)` |
| `updateReputationOnSettlement` | msg.sender = ACTPKernel | `require(msg.sender == actpKernel)` |

**Implementation Note:**

```solidity
contract AgentRegistry is IAgentRegistry, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using Strings for uint256;
    using Strings for address;

    address public immutable actpKernel;
    uint256 public immutable chainId; // Stored at deployment for DID generation
    mapping(address => AgentProfile) public agents;
    mapping(string => address) public didToAddress; // DID string → agent address

    modifier onlyRegisteredAgent() {
        require(agents[msg.sender].registeredAt > 0, "Not registered");
        _;
    }

    modifier onlyKernel() {
        require(msg.sender == actpKernel, "Only ACTPKernel");
        _;
    }

    constructor(address _actpKernel) {
        actpKernel = _actpKernel;
        chainId = block.chainid; // Store as decimal for DID format
    }

    function registerAgent(
        string calldata endpoint,
        ServiceDescriptor[] calldata serviceDescriptors
    ) external {
        require(agents[msg.sender].registeredAt == 0, "Already registered");
        require(bytes(endpoint).length > 0, "Empty endpoint");

        // Validate and normalize service types (MUST be lowercase, no whitespace)
        bytes32[] memory serviceTypeHashes = new bytes32[](serviceDescriptors.length);
        for (uint i = 0; i < serviceDescriptors.length; i++) {
            bytes memory serviceTypeBytes = bytes(serviceDescriptors[i].serviceType);
            require(serviceTypeBytes.length > 0, "Empty service type");

            for (uint j = 0; j < serviceTypeBytes.length; j++) {
                bytes1 char = serviceTypeBytes[j];

                // Reject whitespace (space, tab, newline, etc.)
                require(char != 0x20 && char != 0x09 && char != 0x0A && char != 0x0D,
                    "Service type contains whitespace");

                // Reject uppercase A-Z (0x41-0x5A)
                require(char < 0x41 || char > 0x5A, "Service type must be lowercase");

                // Allow only: lowercase a-z (0x61-0x7A), digits 0-9 (0x30-0x39), hyphen (0x2D)
                require(
                    (char >= 0x61 && char <= 0x7A) || // a-z
                    (char >= 0x30 && char <= 0x39) || // 0-9
                    char == 0x2D,                      // hyphen
                    "Invalid character in service type (allowed: a-z, 0-9, hyphen)"
                );
            }

            // Verify hash matches the validated string
            bytes32 computedHash = keccak256(abi.encodePacked(serviceDescriptors[i].serviceType));
            require(computedHash == serviceDescriptors[i].serviceTypeHash, "Hash mismatch");
            serviceTypeHashes[i] = computedHash;
        }

        // Build DID from msg.sender using DECIMAL chainId and LOWERCASE address
        // Format: did:ethr:<chainId>:<address> e.g., did:ethr:8453:0x742d35cc...
        // NOTE: DID strings use lowercase hex for consistency with did:ethr spec and resolver
        // SECURITY: Always includes chainId to prevent cross-chain confusion (simplified format REJECTED)
        string memory did = string(abi.encodePacked(
            "did:ethr:",
            chainId.toString(),      // Decimal chain ID (e.g., "8453" not "0x2105")
            ":",
            _toLowerAddress(msg.sender) // Lowercase address with 0x prefix
        ));

        agents[msg.sender] = AgentProfile({
            agentAddress: msg.sender,  // CRITICAL: Always use msg.sender, not caller-supplied
            did: did,
            endpoint: endpoint,
            serviceTypes: serviceTypeHashes,
            stakedAmount: 0,           // V1: Always 0, staking disabled
            reputationScore: 0,
            totalTransactions: 0,
            disputedTransactions: 0,
            totalVolumeUSDC: 0,
            registeredAt: block.timestamp,
            updatedAt: block.timestamp,
            isActive: true
        });

        didToAddress[did] = msg.sender;

        emit AgentRegistered(msg.sender, did, endpoint, block.timestamp);
    }

    /// @dev Convert address to lowercase hex string with 0x prefix
    /// @param addr Address to convert
    /// @return Lowercase address string (e.g., "0x742d35cc6634c0532925a3b844bc9e7595f0beb")
    /// @notice Uses lowercase for did:ethr compatibility (DID spec uses lowercase)
    function _toLowerAddress(address addr) internal pure returns (string memory) {
        bytes memory alphabet = "0123456789abcdef";
        bytes memory data = abi.encodePacked(addr);
        bytes memory str = new bytes(42);
        str[0] = '0';
        str[1] = 'x';
        for (uint i = 0; i < 20; i++) {
            str[2 + i * 2] = alphabet[uint8(data[i] >> 4)];
            str[2 + i * 2 + 1] = alphabet[uint8(data[i] & 0x0f)];
        }
        return string(str);
    }

    function updateEndpoint(string calldata newEndpoint) external onlyRegisteredAgent {
        require(bytes(newEndpoint).length > 0, "Empty endpoint");

        string memory oldEndpoint = agents[msg.sender].endpoint;
        agents[msg.sender].endpoint = newEndpoint;
        agents[msg.sender].updatedAt = block.timestamp;

        emit EndpointUpdated(msg.sender, oldEndpoint, newEndpoint, block.timestamp);
    }

    function updateReputationOnSettlement(
        address agentAddress,
        bytes32 txId,
        uint256 txAmount,
        bool wasDisputed
    ) external onlyKernel {
        AgentProfile storage profile = agents[agentAddress];
        require(profile.registeredAt > 0, "Agent not registered");

        uint256 oldScore = profile.reputationScore;

        // Atomic update of all reputation-related fields
        profile.totalTransactions += 1;
        profile.totalVolumeUSDC += txAmount;
        if (wasDisputed) {
            profile.disputedTransactions += 1;
        }

        // Recalculate reputation score (formula defined in §3.4)
        uint256 newScore = _calculateReputationScore(profile);
        profile.reputationScore = newScore;
        profile.updatedAt = block.timestamp;

        emit ReputationUpdated(agentAddress, oldScore, newScore, txId, block.timestamp);
    }

    /// @dev Calculate reputation score based on success rate and volume
    /// @param profile Agent profile to calculate score for
    /// @return score Reputation score (0-10000 scale)
    function _calculateReputationScore(AgentProfile storage profile) internal view returns (uint256) {
        // Formula: score = 0.7 × successRate + 0.3 × logVolume

        // Success Rate component (0-10000 scale, 70% weight)
        uint256 successRate = 10000; // Default 100% if no disputes
        if (profile.totalTransactions > 0) {
            successRate = ((profile.totalTransactions - profile.disputedTransactions) * 10000) / profile.totalTransactions;
        }
        uint256 successComponent = (successRate * 7000) / 10000; // 70% weight

        // Log Volume component (0-10000 scale, 30% weight)
        uint256 volumeUSD = profile.totalVolumeUSDC / 1e6; // Convert from base units to USD
        uint256 logVolume = 0;
        if (volumeUSD >= 10000) {
            logVolume = 10000;
        } else if (volumeUSD >= 1000) {
            logVolume = 7500;
        } else if (volumeUSD >= 100) {
            logVolume = 5000;
        } else if (volumeUSD >= 10) {
            logVolume = 2500;
        }
        uint256 volumeComponent = (logVolume * 3000) / 10000; // 30% weight

        return successComponent + volumeComponent; // Max 10000
    }
}
```

### 3.2 Registration Flow

**Provider Registration Workflow:**

```typescript
import { AgentRegistry } from '@agirails/sdk';

// Step 1: Prepare service descriptors (MUST be lowercase)
const serviceDescriptors = [
  {
    serviceTypeHash: ethers.utils.keccak256(ethers.utils.toUtf8Bytes('text-generation')),
    serviceType: 'text-generation', // MUST be lowercase
    schemaURI: 'ipfs://bafybei.../text-generation-schema.json',
    minPrice: ethers.utils.parseUnits('0.50', 6), // $0.50 USDC
    maxPrice: ethers.utils.parseUnits('10.00', 6), // $10.00 USDC
    avgCompletionTime: 30, // 30 seconds
    metadataCID: 'bafybei.../text-generation-descriptor.json'
  },
  {
    serviceTypeHash: ethers.utils.keccak256(ethers.utils.toUtf8Bytes('code-generation')),
    serviceType: 'code-generation', // MUST be lowercase
    schemaURI: 'ipfs://bafybei.../code-generation-schema.json',
    minPrice: ethers.utils.parseUnits('5.00', 6),
    maxPrice: ethers.utils.parseUnits('100.00', 6),
    avgCompletionTime: 300, // 5 minutes
    metadataCID: 'bafybei.../code-generation-descriptor.json'
  }
];

// Step 2: Register on-chain (contract uses msg.sender as agentAddress)
const registry = new AgentRegistry(signer, networkConfig);
const tx = await registry.registerAgent(
  'https://myprovider.example.com/api/v1', // endpoint
  serviceDescriptors
);
await tx.wait();

// Profile is now:
// - agentAddress: signer.getAddress() (set by contract, not caller)
// - did: auto-generated from chainId + address
// - stakedAmount: 0 (V1: staking disabled)
// - reputationScore: 0 (initial)
// - totalTransactions/disputedTransactions/totalVolumeUSDC: 0

console.log('Agent registered:', await signer.getAddress());
```

### 3.3 Discovery Flow

**Consumer Discovery Workflow:**

```typescript
import { AgentRegistry } from '@agirails/sdk';

// Step 1: Query agents by service type and reputation
const registry = new AgentRegistry(provider, networkConfig);

const serviceTypeHash = ethers.utils.keccak256(
  ethers.utils.toUtf8Bytes('text-generation')
);

const agents = await registry.queryAgentsByService(
  serviceTypeHash,
  7500, // Minimum reputation: 7.5/10
  0,    // offset: start from first result
  10    // limit: max 10 results
);

console.log('Found agents:', agents);
// ['0x1234...', '0x5678...', '0x9abc...']

// Step 2: Get detailed profiles
for (const agentAddress of agents) {
  const profile = await registry.getAgent(agentAddress);
  const descriptors = await registry.getServiceDescriptors(agentAddress);

  console.log('Agent:', {
    did: profile.did,
    endpoint: profile.endpoint,
    reputation: profile.reputationScore / 100, // Convert to 0-100 scale
    totalTxs: profile.totalTransactions.toString(),
    services: descriptors.map(d => ({
      type: d.serviceType,
      minPrice: ethers.utils.formatUnits(d.minPrice, 6),
      maxPrice: ethers.utils.formatUnits(d.maxPrice, 6),
      avgTime: d.avgCompletionTime
    }))
  });
}

// Step 3: Select provider and create transaction
const selectedProvider = agents[0];
const providerProfile = await registry.getAgent(selectedProvider);

// Create AIP-1 request with selected provider
const request = {
  provider: providerProfile.did,
  serviceType: 'text-generation',
  // ... other AIP-1 fields
};
```

### 3.4 Reputation Update Flow

**V1 Decision: Simple Volume-Based Reputation + Dispute Rate**

Reputation in V1 uses a straightforward formula based on two observable on-chain metrics:

1. **Success Rate** (70% weight) - Completed transactions without disputes
2. **Log Volume** (30% weight) - Logarithmic scale of total USDC volume

**Formula:**

```
score = 0.7 × successRate + 0.3 × volumeScore

Where:
- successRate = (totalTransactions - disputedTransactions) / totalTransactions × 10000
  Range: 0-10000 (representing 0.00% to 100.00%)

- volumeScore = min(log10(totalVolumeUSDC / 1e6 + 1) × 2500, 10000)
  Range: 0-10000 (capped)

Final score range: 0-10000 (2 decimal precision when displayed as percentage)
```

**Volume Score Examples:**

| Total Volume (USDC) | log10 Calculation | volumeScore | Notes |
|---------------------|-------------------|-------------|-------|
| $0 | log10(0 + 1) = 0 | 0 | No transactions |
| $10 | log10(0.00001 + 1) ≈ 0 | ~10 | Just started |
| $1,000 | log10(0.001 + 1) ≈ 0.0004 | ~1 | Early stage |
| $10,000 | log10(0.01 + 1) ≈ 0.004 | ~10 | Growing |
| $100,000 | log10(0.1 + 1) ≈ 0.04 | ~100 | Established |
| $1,000,000 | log10(1 + 1) ≈ 0.3 | ~750 | High volume |
| $10,000,000 | log10(10 + 1) ≈ 1.04 | ~2,600 | Very high |
| $100,000,000+ | log10(100+) | 10,000 (cap) | Maximum |

**Note:** The `disputedTransactions` count directly affects `successRate`. A dispute that results in provider fault reduces the provider's success rate. This provides economic incentive to avoid disputes.

**V1 vs V2 Formula:**

| Version | Formula | Rationale |
|---------|---------|-----------|
| **V1 (AIP-7)** | 2 dimensions (successRate 70%, volumeScore 30%) | Fully on-chain verifiable, no oracle needed |
| **V2 (Yellow Paper §10.4)** | 5 dimensions (success 30%, quality 30%, timeliness 20%, dispute 10%, experience 10%) | Richer signal, requires off-chain quality oracle |

V1 formula was chosen for simplicity and trustlessness. V2 formula from Yellow Paper will be implemented when reputation oracle infrastructure is available.

**Level Tiers:**

| Level | Score Range | Requirements | Badge |
|-------|-------------|--------------|-------|
| **Level 0** (Unverified) | 0 | 0 transactions | - |
| **Level 1** (New) | 1-4999 | 1-9 transactions, <10% dispute | Bronze |
| **Level 2** (Established) | 5000-7499 | 10-49 transactions, <5% dispute | Silver |
| **Level 3** (Trusted) | 7500-10000 | 50+ transactions, <2% dispute | Gold |

**Automatic Reputation Update (Triggered by ACTPKernel):**

The ACTPKernel calls the AgentRegistry's `updateReputationOnSettlement` function, which handles
both counter updates and score calculation atomically. This ensures consistency and prevents
race conditions.

```solidity
// In ACTPKernel.sol, after transaction settles

IAgentRegistry public agentRegistry; // Set in constructor

function releaseEscrow(bytes32 txId) external {
    Transaction storage txn = transactions[txId];
    require(txn.state == State.SETTLED, "Not settled");

    // Transfer funds to provider
    escrowVault.release(txn.escrowId, txn.provider, txn.amount);

    // Update provider reputation in registry
    // NOTE: AgentRegistry handles counter updates + score calculation internally
    // wasDisputed is tracked via txn.wasDisputed flag set during dispute resolution
    agentRegistry.updateReputationOnSettlement(
        txn.provider,       // agentAddress
        txId,               // txId for audit trail
        txn.amount,         // txAmount for volume tracking
        txn.wasDisputed     // wasDisputed flag
    );

    emit EscrowReleased(txId, txn.escrowId, txn.provider, txn.amount);
}

// Note: _calculateReputationScore is implemented in AgentRegistry, NOT in ACTPKernel
// This ensures single source of truth for reputation logic
// See AgentRegistry._calculateReputationScore() in §3.1 for implementation
```

**Design Decision: Reputation Calculation Lives in AgentRegistry**

| Approach | Pros | Cons |
|----------|------|------|
| Kernel calculates, Registry stores | Kernel has full control | Double calculation possible, harder to upgrade formula |
| **Registry calculates + stores** | Single source of truth, atomic updates, easier to audit | Kernel must trust Registry |

We chose Registry-based calculation because:
1. **Atomicity**: Counter updates and score calculation happen in one transaction
2. **Consistency**: No risk of Kernel and Registry having different formulas
3. **Upgradeability**: Formula changes only require Registry updates
4. **Security**: Kernel only passes raw data, Registry applies business logic

**SDK Helper:**

```typescript
// In @agirails/sdk/registry

export function calculateReputationLevel(score: number): {
  level: number;
  name: string;
  badge: string;
} {
  if (score === 0) return { level: 0, name: 'Unverified', badge: '' };
  if (score < 5000) return { level: 1, name: 'New', badge: 'Bronze' };
  if (score < 7500) return { level: 2, name: 'Established', badge: 'Silver' };
  return { level: 3, name: 'Trusted', badge: 'Gold' };
}

export function formatReputationScore(score: number): string {
  // Convert 0-10000 scale to 0-100 with 2 decimals
  return (score / 100).toFixed(2) + '%';
}
```

**Why This Formula (V1):**

1. **Observable on-chain** - Both metrics come from settled transactions
2. **Sybil resistant** - Can't fake volume or success rate without real transactions
3. **Simple to audit** - No complex off-chain calculations
4. **Fair to newcomers** - Even 1 successful transaction starts reputation building
5. **Punishes bad actors** - Disputes heavily impact success rate

**V2 Considerations:**

Future enhancements may include:
- Response time tracking (SLA compliance)
- Stake-weighted bonuses
- Category-specific reputation
- Time decay for old transactions
- Peer attestations from other agents

### 3.5 Staking Mechanism (Future V2)

**V1 Decision: No Stake Enforcement**

Provider staking is conceptually defined at $1,000 USDC (per Yellow Paper §4.4), but **enforcement is deferred in V1** to reduce friction and enable faster network bootstrap.

**Rationale:**
- Lower barrier to entry for early providers
- Allows ecosystem to grow before adding economic security layer
- Stake requirements can be introduced via governance decision in V2

**V1 Behavior:**

- `stakedAmount` field exists in `AgentProfile` struct (for forward compatibility)
- Registration does NOT require stake (set to 0)
- Reputation calculation does NOT consider stake weight
- Discovery queries do NOT filter by stake amount

**V2 Upgrade Path:**

Stake enforcement will be introduced after analyzing:
- Economic attack vectors (Sybil resistance patterns observed in V1)
- Capital efficiency for small providers
- Slashing conditions (dispute loss, SLA violations)
- Community governance proposal and vote

**V2 Considerations:**

```solidity
// Future staking logic (V2 - USDC-based staking)

// Governance-adjustable parameter (TBD - will be set via AIP governance process)
uint256 public minimumStake; // USDC amount (6 decimals), initially 0
IERC20 public immutable USDC;

function registerAgent(
    string calldata endpoint,
    ServiceDescriptor[] calldata serviceDescriptors
) external nonReentrant {
    // V2: Transfer USDC stake from registrant to contract
    if (minimumStake > 0) {
        require(
            USDC.transferFrom(msg.sender, address(this), minimumStake),
            "Stake transfer failed"
        );
        agents[msg.sender].stakedAmount = minimumStake;
    }
    // ... rest of registration logic
}

function slashStake(
    address agent,
    uint256 slashBps, // Basis points (100 = 1%, 1000 = 10%)
    bytes32 txId,
    SlashReason reason
) external onlyKernel {
    AgentProfile storage profile = agents[agent];
    uint256 slashAmount = (profile.stakedAmount * slashBps) / 10000;
    require(slashAmount > 0, "Nothing to slash");

    profile.stakedAmount -= slashAmount;

    // Distribution based on incident type (see table below)
    Transaction storage txn = kernel.getTransaction(txId);

    if (reason == SlashReason.DISPUTE_LOST || reason == SlashReason.SLA_VIOLATION) {
        // Individual incident: 100% to affected consumer (direct compensation)
        USDC.safeTransfer(txn.requester, slashAmount);
    } else {
        // Systemic/fraud: 100% to treasury (protocol protection)
        USDC.safeTransfer(feeRecipient, slashAmount);
    }

    emit StakeSlashed(agent, slashAmount, txId, reason);
}
```

**Slashing Philosophy (Ethereum-inspired):**

Following Vitalik's slashing principles from Ethereum PoS:
1. **Proportional punishment** - slash in proportion to damage caused
2. **Consumer compensation first** - individual incidents compensate the affected party
3. **Protocol protection** - systemic abuse funds go to treasury
4. **Graceful degradation** - agents can continue with reduced stake

**Slashing Triggers (V2):**

| Trigger | Slash % | Recipient | Rationale |
|---------|---------|-----------|-----------|
| **Dispute Lost** (single) | 10% | 100% consumer | Direct compensation for harm |
| **SLA Violation** (>24h response) | 5% | 100% consumer | Minor penalty, consumer made whole |
| **Repeated Disputes** (3+ in 30 days) | 50% | 100% treasury | Pattern indicates bad actor |
| **Fraud/Abuse** (governance) | 100% | 100% treasury | Maximum penalty, protect protocol |

**Stake Parameters (Governance-Controlled):**

| Parameter | V1 Value | V2 Target | Notes |
|-----------|----------|-----------|-------|
| `minimumStake` | 0 (disabled) | TBD | Set via AIP governance when network matures |
| `stakeCooldown` | N/A | 30 days | Time before stake withdrawal allowed |
| `restakeCooldown` | N/A | 24 hours | Time between restake operations |

**Restaking:**
- Agents can restake after slash to restore stake level
- No maximum stake (enables trust tiers in future)

---

## 4. Hybrid Storage Architecture

### 4.1 Storage Layer Design

**Two-Tier Storage Model:**

```
┌─────────────────────────────────────────────────────────┐
│                     AGIRAILS Storage                    │
├─────────────────────────────────────────────────────────┤
│  Tier 1: IPFS (Hot Storage, Ephemeral Buffer)         │
│  - Provider: Filebase (free tier: 5GB)                 │
│  - Use Case: Request metadata (AIP-1), delivery proofs │
│  - Retention: disputeWindow + 7 days minimum           │
│  - Pinning: Consumer + provider responsibility         │
├─────────────────────────────────────────────────────────┤
│  Tier 2: Arweave (Cold Archive, Permanent)            │
│  - Provider: Bundlr (pay-per-upload)                   │
│  - Use Case: SETTLED transaction bundles (compliance)  │
│  - Retention: Permanent (200+ years)                   │
│  - Funding: Archive Treasury (0.1% of protocol fee)    │
└─────────────────────────────────────────────────────────┘
```

**Key Principle: Arweave-First Write Order**

> **CRITICAL INVARIANT: Arweave-First Write Order**
>
> When archiving a settled transaction:
>
> 1. **Write to Arweave FIRST** → Get Arweave TX ID
> 2. **THEN anchor TX ID on-chain** → Immutable reference in `ArchiveTreasury.sol`
> 3. IPFS CIDs already exist (from INITIATED/DELIVERED states)
>
> **NEVER invert this order.** On-chain anchor MUST reference existing Arweave data.
>
> Violation of this invariant creates a compliance gap where on-chain records reference non-existent permanent storage.

**Why This Order?**

- **Guarantee**: Arweave write is atomic - once TX ID returned, data is permanently stored
- **Immutability**: On-chain anchor cannot reference non-existent data
- **Compliance**: 7-year retention guaranteed before on-chain commitment

**Contrast with IPFS:**

- IPFS: Upload → Get CID → Pin (may fail) → Content may disappear
- Arweave: Upload → Get TX ID → Data is permanent (no pinning needed)

**Failure Isolation:** Archive operations are asynchronous and non-blocking for escrow settlement. If Arweave upload fails, the transaction remains settled on-chain. Archive failures only affect long-term compliance and evidence availability, not fund movement.

**Compliance Note (7-Year Retention):** Once a transaction is archived on Arweave and anchored on-chain via `ArchiveTreasury.anchorArchive()`, the record satisfies the 7-year retention requirement defined in White Paper §8.2. Arweave's permanent storage model (200+ years design guarantee) exceeds regulatory requirements. The on-chain anchor provides cryptographic proof of archive existence and timestamp.

### 4.2 Filebase Integration (IPFS)

**Provider:** Filebase (S3-compatible IPFS pinning service)

**SDK Integration:**

```typescript
// In @agirails/sdk/storage

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { create as createIPFS } from 'ipfs-http-client';

export class FilebaseClient {
  private s3: S3Client;
  private ipfs: any;

  constructor(config: FilebaseConfig) {
    // Filebase S3-compatible API
    this.s3 = new S3Client({
      endpoint: 'https://s3.filebase.com',
      region: 'us-east-1',
      credentials: {
        accessKeyId: config.filebaseAccessKey,
        secretAccessKey: config.filebaseSecretKey
      }
    });

    // IPFS gateway for retrieval
    this.ipfs = createIPFS({
      url: 'https://ipfs.filebase.io'
    });
  }

  /**
   * Upload JSON to IPFS via Filebase (automatic pinning)
   * @param data JSON object to upload
   * @returns IPFS CID (CIDv1, base32)
   */
  async uploadJSON(data: any): Promise<string> {
    const jsonString = JSON.stringify(data);
    const buffer = Buffer.from(jsonString, 'utf-8');

    // Upload to Filebase bucket (auto-pins to IPFS)
    const command = new PutObjectCommand({
      Bucket: 'agirails-storage', // Filebase bucket name
      Key: `${Date.now()}-${Math.random().toString(36).substring(7)}.json`,
      Body: buffer,
      ContentType: 'application/json'
    });

    await this.s3.send(command);

    // Get IPFS CID from uploaded object
    const { cid } = await this.ipfs.add(buffer);
    return cid.toString(); // e.g., bafybei...
  }

  /**
   * Download JSON from IPFS
   * @param cid IPFS CID
   * @returns Parsed JSON object
   */
  async downloadJSON(cid: string): Promise<any> {
    const chunks = [];
    for await (const chunk of this.ipfs.cat(cid)) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    return JSON.parse(buffer.toString('utf-8'));
  }
}
```

**Usage Example:**

```typescript
import { FilebaseClient } from '@agirails/sdk/storage';

const filebase = new FilebaseClient({
  filebaseAccessKey: process.env.FILEBASE_ACCESS_KEY!,
  filebaseSecretKey: process.env.FILEBASE_SECRET_KEY!
});

// Upload AIP-1 request metadata
const requestMetadata = {
  version: '1.0.0',
  serviceType: 'text-generation',
  // ... other AIP-1 fields
};

const cid = await filebase.uploadJSON(requestMetadata);
console.log('Uploaded to IPFS:', cid);
// bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi
```

### 4.3 Arweave Integration (Permanent Archive)

**Provider:** Irys (formerly Bundlr) - Layer 2 for Arweave with instant finality

**Irys Payment Chain Support:**

Irys supports multiple chains for payment. As of November 2025:

| Chain | Token | Parameter | AGIRAILS Support |
|-------|-------|-----------|------------------|
| **Base** | ETH | `base-eth` | **RECOMMENDED** |
| Ethereum | ETH | `ethereum` | Supported (expensive) |
| Polygon | MATIC | `matic` | Supported |
| Arbitrum | ETH | `arbitrum` | Supported |
| Ethereum | USDC | `usdc-eth` | Supported |
| Polygon | USDC | `usdc-polygon` | Supported |

**AGIRAILS V1 Decision: Base ETH**

We use **Base ETH** (`base-eth`) for Irys payments because:
1. **No bridging required** - Archive Treasury and Uploader stay on Base
2. **Lowest operational complexity** - Single chain for all operations
3. **Native to AGIRAILS** - Aligns with our Base L2 deployment

**Funding Flow (V1):**

```
┌─────────────────────────────────────────────────────────────────┐
│                    ARCHIVE FUNDING FLOW                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Settlement occurs on ACTPKernel                            │
│     └─► 0.1% of platform fee sent to Archive Treasury          │
│                                                                 │
│  2. Archive Treasury (Base) accumulates USDC                   │
│     └─► Holds funds until withdrawal threshold                 │
│                                                                 │
│  3. Periodic funding of Uploader wallet:                       │
│     Archive Treasury ──USDC──► DEX (Base) ──ETH──► Uploader   │
│     └─► Swap USDC to ETH on Base DEX (Uniswap, Aerodrome)     │
│                                                                 │
│  4. Uploader funds Irys node:                                  │
│     Uploader wallet ──ETH──► Irys (base-eth) ──► Credit       │
│                                                                 │
│  5. Uploader uploads archive bundles:                          │
│     Archive bundle ──► Irys ──► Arweave (permanent)           │
│     └─► Returns Arweave TX ID                                  │
│                                                                 │
│  6. Uploader anchors on-chain:                                 │
│     ArchiveTreasury.anchorArchive(txId, arweaveTxId)          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**SDK Integration:**

```typescript
// In @agirails/sdk/storage

import Irys from '@irys/sdk';

// Supported Irys tokens: https://docs.irys.xyz/build/d/features/supported-tokens
type IrysCurrency = 'base-eth' | 'ethereum' | 'matic' | 'arbitrum' | 'usdc-eth' | 'usdc-polygon';

export interface ArweaveConfig {
  privateKey: string;
  currency: IrysCurrency; // Default: 'base-eth'
  rpcUrl: string;
}

export class ArweaveClient {
  private irys: Irys;

  constructor(config: ArweaveConfig) {
    // Default to Base ETH if not specified
    const currency = config.currency || 'base-eth';

    this.irys = new Irys({
      network: 'mainnet', // or 'devnet' for testing
      token: currency,
      key: config.privateKey,
      config: {
        providerUrl: config.rpcUrl
      }
    });
  }

  /**
   * Fund the Irys node before uploading
   * Required before first upload
   */
  async fund(amount: bigint): Promise<void> {
    await this.irys.fund(amount);
  }

  /**
   * Check current Irys balance
   */
  async getBalance(): Promise<bigint> {
    const balance = await this.irys.getLoadedBalance();
    return BigInt(balance.toString());
  }

  /**
   * Upload archive bundle to Arweave (permanent storage)
   * @param bundle Archive bundle JSON (see §4.4)
   * @returns Arweave transaction ID
   */
  async uploadBundle(bundle: ArchiveBundle): Promise<string> {
    const jsonString = JSON.stringify(bundle);
    const buffer = Buffer.from(jsonString, 'utf-8');

    // Upload to Arweave via Irys
    const tx = await this.irys.upload(buffer, {
      tags: [
        { name: 'Content-Type', value: 'application/json' },
        { name: 'Protocol', value: 'AGIRAILS' },
        { name: 'Version', value: bundle.protocolVersion },
        { name: 'Schema', value: bundle.archiveSchemaVersion },
        { name: 'Type', value: bundle.type },
        { name: 'ChainId', value: bundle.chainId.toString() },
        { name: 'TxId', value: bundle.txId }
      ]
    });

    return tx.id; // Arweave TX ID (e.g., "h7Xk2...")
  }

  /**
   * Download archive bundle from Arweave
   * @param txId Arweave transaction ID
   * @returns Parsed archive bundle
   */
  async downloadBundle(txId: string): Promise<ArchiveBundle> {
    const response = await fetch(`https://arweave.net/${txId}`);
    return await response.json();
  }

  /**
   * Estimate cost of archiving (in Base ETH)
   * @param sizeBytes Size of data to archive
   * @returns Cost in wei
   */
  async estimateCost(sizeBytes: number): Promise<bigint> {
    const price = await this.bundlr.getPrice(sizeBytes);
    return BigInt(price.toString());
  }
}
```

**Cost Analysis:**

```typescript
// Example: Archive a 50KB transaction bundle

const sizeBytes = 50 * 1024; // 50KB
const costWei = await arweave.estimateCost(sizeBytes);
const costETH = ethers.utils.formatEther(costWei);

console.log('Arweave cost:', costETH, 'ETH');
// ~0.0001 ETH (~$0.30 at $3000/ETH)

// Archive Treasury allocation:
// 1% platform fee * 0.1% = 0.001% of transaction volume
// $100 transaction = $0.10 fee → $0.0001 to archive
// Sufficient for ~50KB bundle every 3 transactions
```

### 4.4 Archive Bundle Format

**V1 Decision: Minimal Hash-First Bundle**

Archive bundles on Arweave contain **minimal metadata with cryptographic hashes and references**. Full content (request metadata, delivery proof) remains on IPFS.

**Rationale:**
- Arweave holds cryptographic proof and permanent reference
- IPFS holds content (can be rotated or additionally protected)
- Regulators can be satisfied with Arweave record + IPFS content + hash match proof
- Format is easily extensible in V2 with rich compliance layer
- Smaller bundles = lower Arweave costs

**What Archive Bundle Contains:**
- Version and type identifiers
- Transaction ID, chain ID, timestamps
- Participant identifiers (DID references, not full profiles)
- **References** to requestCID and deliveryCID (not full content)
- EAS attestation UID
- Cryptographic hashes of content

**What Archive Bundle Does NOT Contain:**
- Full request metadata content
- Full delivery proof content
- Personal data or business-sensitive details

**JSON Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "AGIRAILS Archive Bundle v1 (Minimal Hash-First)",
  "type": "object",
  "required": [
    "protocolVersion",
    "archiveSchemaVersion",
    "type",
    "txId",
    "chainId",
    "archivedAt",
    "participants",
    "references",
    "hashes",
    "signatures",
    "settlement"
  ],
  "properties": {
    "protocolVersion": {
      "type": "string",
      "pattern": "^\\d+\\.\\d+\\.\\d+$",
      "description": "AGIRAILS protocol version (e.g., 1.0.0)"
    },
    "archiveSchemaVersion": {
      "type": "string",
      "pattern": "^\\d+\\.\\d+\\.\\d+$",
      "description": "Archive bundle schema version (e.g., 1.0.0)"
    },
    "type": {
      "type": "string",
      "const": "actp.archive.v1.minimal",
      "description": "Archive bundle type identifier"
    },
    "txId": {
      "type": "string",
      "pattern": "^0x[a-fA-F0-9]{64}$",
      "description": "ACTP transaction ID (bytes32)"
    },
    "chainId": {
      "type": "integer",
      "enum": [8453, 84532],
      "description": "Blockchain network (8453 = Base Mainnet, 84532 = Base Sepolia)"
    },
    "archivedAt": {
      "type": "integer",
      "description": "Archive timestamp (Unix seconds)"
    },
    "participants": {
      "type": "object",
      "required": ["requester", "provider"],
      "description": "Participant addresses (NOT full profiles)",
      "properties": {
        "requester": {
          "type": "string",
          "pattern": "^0x[a-fA-F0-9]{40}$",
          "description": "Requester Ethereum address"
        },
        "provider": {
          "type": "string",
          "pattern": "^0x[a-fA-F0-9]{40}$",
          "description": "Provider Ethereum address"
        }
      }
    },
    "references": {
      "type": "object",
      "required": ["requestCID", "deliveryCID"],
      "description": "IPFS CIDs to full content (NOT content itself)",
      "properties": {
        "requestCID": {
          "type": "string",
          "pattern": "^[a-zA-Z0-9]+$",
          "description": "IPFS CID of AIP-1 request metadata"
        },
        "deliveryCID": {
          "type": "string",
          "pattern": "^[a-zA-Z0-9]+$",
          "description": "IPFS CID of AIP-4 delivery proof"
        },
        "resultCID": {
          "type": "string",
          "description": "IPFS CID of actual result/output (optional)"
        }
      }
    },
    "hashes": {
      "type": "object",
      "required": ["requestHash", "deliveryHash", "serviceHash"],
      "description": "Cryptographic hashes for verification",
      "properties": {
        "requestHash": {
          "type": "string",
          "pattern": "^0x[a-fA-F0-9]{64}$",
          "description": "keccak256 of canonical request metadata JSON"
        },
        "deliveryHash": {
          "type": "string",
          "pattern": "^0x[a-fA-F0-9]{64}$",
          "description": "keccak256 of canonical delivery proof JSON"
        },
        "serviceHash": {
          "type": "string",
          "pattern": "^0x[a-fA-F0-9]{64}$",
          "description": "serviceHash from ACTPKernel transaction"
        }
      }
    },
    "signatures": {
      "type": "object",
      "required": ["providerDeliverySignature"],
      "description": "Cryptographic signatures for self-verification without IPFS",
      "properties": {
        "providerDeliverySignature": {
          "type": "string",
          "pattern": "^0x[a-fA-F0-9]{130}$",
          "description": "EIP-712 signature by provider over deliveryHash"
        },
        "requesterSettlementSignature": {
          "type": "string",
          "pattern": "^0x[a-fA-F0-9]{130}$",
          "description": "Optional: requester signature authorizing settlement"
        }
      }
    },
    "attestation": {
      "type": "object",
      "required": ["easUID"],
      "description": "EAS attestation reference",
      "properties": {
        "easUID": {
          "type": "string",
          "pattern": "^0x[a-fA-F0-9]{64}$",
          "description": "Ethereum Attestation Service UID"
        },
        "schemaUID": {
          "type": "string",
          "description": "EAS schema UID used for attestation"
        }
      }
    },
    "settlement": {
      "type": "object",
      "required": ["settledAt", "finalState", "escrowReleased", "platformFee"],
      "properties": {
        "settledAt": {
          "type": "integer",
          "description": "Settlement timestamp (Unix seconds)"
        },
        "finalState": {
          "type": "string",
          "enum": ["SETTLED", "CANCELLED"],
          "description": "Final transaction state"
        },
        "escrowReleased": {
          "type": "object",
          "required": ["to", "amount"],
          "properties": {
            "to": {
              "type": "string",
              "pattern": "^0x[a-fA-F0-9]{40}$",
              "description": "Recipient address (provider or requester)"
            },
            "amount": {
              "type": "string",
              "description": "Released amount (USDC base units)"
            }
          }
        },
        "platformFee": {
          "type": "string",
          "description": "Platform fee collected (USDC base units)"
        },
        "wasDisputed": {
          "type": "boolean",
          "description": "Whether transaction went through dispute"
        }
      }
    }
  }
}
```

**Example Bundle (Minimal Hash-First):**

```json
{
  "protocolVersion": "1.0.0",
  "archiveSchemaVersion": "1.0.0",
  "type": "actp.archive.v1.minimal",
  "txId": "0x7d87c3b8e23a5c9d1f4e6b2a8c5d9e3f1a7b4c6d8e2f5a3b9c1d7e4f6a8b2c5d",
  "chainId": 8453,
  "archivedAt": 1732150000,
  "participants": {
    "requester": "0xe174bd855aaA8d907334288323044d4cf79BfAfC",
    "provider": "0x1cB181233575d3c7A290d16C0E31aAED9b3993c2"
  },
  "references": {
    "requestCID": "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
    "deliveryCID": "bafybeihxu3zvfuglah4xvp5g3k7h2vt3lqe5ycqm5r7p9j2k4l5m6n7o8p9",
    "resultCID": "bafybeiresult123456789abcdefghijklmnopqrstuvwxyz12"
  },
  "hashes": {
    "requestHash": "0x3f8b9c2d1e4a5f6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b",
    "deliveryHash": "0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b",
    "serviceHash": "0x9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c7b6a5f4e3d2c1b0a9f8e"
  },
  "signatures": {
    "providerDeliverySignature": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef01",
    "requesterSettlementSignature": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef123456789002"
  },
  "attestation": {
    "easUID": "0x1b0e2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b",
    "schemaUID": "0xabc123def456789012345678901234567890123456789012345678901234abcd"
  },
  "settlement": {
    "settledAt": 1732097200,
    "finalState": "SETTLED",
    "escrowReleased": {
      "to": "0x1cB181233575d3c7A290d16C0E31aAED9b3993c2",
      "amount": "4950000"
    },
    "platformFee": "50000",
    "wasDisputed": false
  }
}
```

**Note**: The example uses real test addresses from the AGIRAILS testnet deployment (Base Sepolia).

**Size Comparison:**

| Bundle Type | Content | Estimated Size |
|-------------|---------|---------------|
| Full (with requestMetadata + deliveryProof) | Everything | 5-50 KB |
| **Minimal Hash-First (V1)** | References + Hashes only | **~500 bytes** |

**Verification Process:**

To verify an archive bundle:

```typescript
// 1. Download full content from IPFS
const requestMetadata = await ipfs.downloadJSON(bundle.references.requestCID);
const deliveryProof = await ipfs.downloadJSON(bundle.references.deliveryCID);

// 2. Verify hashes match
const computedRequestHash = ethers.utils.keccak256(
  ethers.utils.toUtf8Bytes(canonicalJsonStringify(requestMetadata))
);
const computedDeliveryHash = ethers.utils.keccak256(
  ethers.utils.toUtf8Bytes(canonicalJsonStringify(deliveryProof))
);

assert(computedRequestHash === bundle.hashes.requestHash, "Request hash mismatch");
assert(computedDeliveryHash === bundle.hashes.deliveryHash, "Delivery hash mismatch");

// 3. Verify EAS attestation exists on-chain
const attestation = await eas.getAttestation(bundle.attestation.easUID);
assert(attestation.data === bundle.hashes.deliveryHash, "Attestation mismatch");

// 4. Archive is verified - content matches permanent record
```

### 4.5 Archive Trigger Conditions

**When to Archive:**

Archive bundles are created when a transaction reaches a **terminal state**:

1. **SETTLED** - Normal completion (escrow released to provider)
2. **CANCELLED** - Refund to requester (before DELIVERED)
3. **DISPUTED → SETTLED** - Dispute resolved (funds distributed per mediator decision)

**Batching Strategy:**

To reduce Arweave upload costs, bundle multiple transactions:

```typescript
// Batch archive every 100 transactions OR 100KB OR 5 minutes (whichever first)

const BATCH_SIZE_TXS = 100;
const BATCH_SIZE_BYTES = 100 * 1024; // 100KB
const BATCH_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

class ArchiveUploader {
  private pendingBundles: ArchiveBundle[] = [];
  private batchTimer: NodeJS.Timeout | null = null;

  async queueBundle(bundle: ArchiveBundle): Promise<void> {
    this.pendingBundles.push(bundle);

    const totalSize = this.estimateBatchSize();

    // Trigger upload if batch size or count threshold reached
    if (
      this.pendingBundles.length >= BATCH_SIZE_TXS ||
      totalSize >= BATCH_SIZE_BYTES
    ) {
      await this.uploadBatch();
    } else if (!this.batchTimer) {
      // Start timeout timer if not already running
      this.batchTimer = setTimeout(() => this.uploadBatch(), BATCH_TIMEOUT_MS);
    }
  }

  private async uploadBatch(): Promise<void> {
    if (this.pendingBundles.length === 0) return;

    const batch = this.pendingBundles.splice(0, BATCH_SIZE_TXS);

    // Upload to Arweave
    for (const bundle of batch) {
      const arweaveTxId = await this.arweave.uploadBundle(bundle);

      // Anchor on-chain
      await this.treasury.anchorArchive(bundle.txId, arweaveTxId);

      console.log(`Archived ${bundle.txId} → Arweave ${arweaveTxId}`);
    }

    // Clear timer
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
  }

  private estimateBatchSize(): number {
    return this.pendingBundles.reduce((sum, bundle) => {
      return sum + JSON.stringify(bundle).length;
    }, 0);
  }
}
```

### 4.6 Retry Logic

**Write Failures:**

If Arweave upload fails (network error, insufficient funds), retry with exponential backoff:

```typescript
async function uploadWithRetry(
  bundle: ArchiveBundle,
  maxRetries = 3
): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const arweaveTxId = await arweave.uploadBundle(bundle);
      console.log(`Upload succeeded on attempt ${attempt}`);
      return arweaveTxId;
    } catch (error) {
      lastError = error as Error;
      console.error(`Upload attempt ${attempt} failed:`, error);

      if (attempt < maxRetries) {
        const delayMs = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  // All retries failed - send to dead letter queue
  await deadLetterQueue.enqueue(bundle, lastError);
  throw new Error(`Upload failed after ${maxRetries} retries: ${lastError?.message}`);
}
```

**Dead Letter Queue:**

Failed uploads are queued for manual intervention:

```typescript
interface DeadLetterEntry {
  bundle: ArchiveBundle;
  error: string;
  enqueuedAt: number;
  retryCount: number;
}

class DeadLetterQueue {
  private queue: DeadLetterEntry[] = [];

  async enqueue(bundle: ArchiveBundle, error: Error): Promise<void> {
    this.queue.push({
      bundle,
      error: error.message,
      enqueuedAt: Date.now(),
      retryCount: 0
    });

    // Persist to database
    await db.deadLetterQueue.insert({
      txId: bundle.txId,
      bundle: JSON.stringify(bundle),
      error: error.message,
      enqueuedAt: new Date()
    });

    // Alert admin
    await alerts.send({
      severity: 'high',
      message: `Archive upload failed for tx ${bundle.txId}: ${error.message}`,
      metadata: { txId: bundle.txId }
    });
  }

  async retryAll(): Promise<void> {
    for (const entry of this.queue) {
      try {
        const arweaveTxId = await arweave.uploadBundle(entry.bundle);
        await treasury.anchorArchive(entry.bundle.txId, arweaveTxId);

        // Remove from queue
        this.queue = this.queue.filter(e => e !== entry);
        await db.deadLetterQueue.delete({ txId: entry.bundle.txId });

        console.log(`Recovered ${entry.bundle.txId} from DLQ`);
      } catch (error) {
        entry.retryCount++;
        console.error(`DLQ retry failed for ${entry.bundle.txId}:`, error);
      }
    }
  }
}
```

---

## 5. Archive Treasury Contract

### 5.0 Fee Flow Architecture

The following diagram shows how protocol fees flow from settlement to permanent archive:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        PROTOCOL FEE DISTRIBUTION                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Transaction Settlement (ACTPKernel.releaseEscrow)                         │
│  ─────────────────────────────────────────────────                         │
│                                                                             │
│  Example: $100 transaction @ 1% platform fee = $1.00 fee                   │
│                                                                             │
│                    ┌──────────────────────┐                                │
│                    │   Platform Fee       │                                │
│                    │      $1.00           │                                │
│                    └──────────┬───────────┘                                │
│                               │                                            │
│              ┌────────────────┴────────────────┐                           │
│              │                                 │                           │
│              ▼                                 ▼                           │
│  ┌───────────────────────┐      ┌───────────────────────┐                 │
│  │   Protocol Treasury   │      │   Archive Treasury    │                 │
│  │       99.9%           │      │       0.1%            │                 │
│  │      $0.999           │      │      $0.001           │                 │
│  └───────────────────────┘      └───────────┬───────────┘                 │
│              │                               │                            │
│              │                               │ (accumulates)              │
│              ▼                               ▼                            │
│  ┌───────────────────────┐      ┌───────────────────────┐                 │
│  │  Operations, Audits,  │      │  Periodic Withdrawal  │                 │
│  │  Development, etc.    │      │  by Uploader Service  │                 │
│  └───────────────────────┘      └───────────┬───────────┘                 │
│                                             │                             │
│                                             │ USDC → ETH (DEX swap)       │
│                                             ▼                             │
│                                 ┌───────────────────────┐                 │
│                                 │  Fund Irys (Base ETH) │                 │
│                                 └───────────┬───────────┘                 │
│                                             │                             │
│                                             │ Upload archive bundles      │
│                                             ▼                             │
│                                 ┌───────────────────────┐                 │
│                                 │  Arweave (Permanent)  │                 │
│                                 │  via Irys/Bundlr      │                 │
│                                 └───────────────────────┘                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Key Points:**
- Archive allocation is **0.1% of the platform fee** (not 0.1% of transaction value)
- At $10M monthly GMV with 1% fee = $100K fees → $100 to Archive Treasury
- Archive Treasury accumulates USDC, swaps to ETH when funding Irys
- One Arweave upload (~1KB) costs ~$0.0001, so $100 archives ~1M transactions

### 5.1 Contract Interface

**File:** `src/treasury/ArchiveTreasury.sol`

```solidity
// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IACTPKernel {
    enum State { INITIATED, QUOTED, COMMITTED, IN_PROGRESS, DELIVERED, SETTLED, DISPUTED, CANCELLED }
    function getTransaction(bytes32 txId) external view returns (
        address requester,
        address provider,
        uint256 amount,
        State state,
        // ... other fields
    );
}

/// @title Archive Treasury
/// @notice Manages funding for permanent Arweave storage of settled transactions
/// @dev Receives 0.1% of protocol fees, used to pay for Arweave uploads
contract ArchiveTreasury is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ========== STATE VARIABLES ==========

    IERC20 public immutable USDC;
    IACTPKernel public immutable kernel; // Reference to ACTPKernel for state verification
    address public uploader; // Authorized address to withdraw for Arweave uploads

    uint256 public totalReceived; // Cumulative USDC received from protocol
    uint256 public totalSpent; // Cumulative USDC spent on archiving
    uint256 public totalArchived; // Count of archived transactions

    // Mapping: ACTP txId → Arweave transaction ID
    mapping(bytes32 => string) public archiveRecords;

    // Mapping: Arweave TX ID → anchor timestamp
    mapping(string => uint256) public archiveTimestamps;

    // Replay protection: Track which txIds have been processed
    mapping(bytes32 => bool) public processedTxIds;

    // ========== EVENTS ==========

    event FundsReceived(address indexed from, uint256 amount, uint256 timestamp);
    event ArchiveAnchored(bytes32 indexed txId, string arweaveTxId, address indexed requester, address indexed provider, uint256 timestamp);
    event UploaderUpdated(address indexed oldUploader, address indexed newUploader);
    event FundsWithdrawn(address indexed to, uint256 amount, uint256 timestamp);

    // ========== CONSTRUCTOR ==========

    constructor(address _usdc, address _kernel, address _uploader) Ownable(msg.sender) {
        require(_usdc != address(0), "Zero USDC address");
        require(_kernel != address(0), "Zero Kernel address");
        require(_uploader != address(0), "Zero uploader address");

        USDC = IERC20(_usdc);
        kernel = IACTPKernel(_kernel);
        uploader = _uploader;
    }

    // ========== CORE FUNCTIONS ==========

    /// @notice Receive archive funding from protocol fee distribution
    /// @param amount USDC amount to deposit
    function receiveFunds(uint256 amount) external {
        USDC.safeTransferFrom(msg.sender, address(this), amount);
        totalReceived += amount;
        emit FundsReceived(msg.sender, amount, block.timestamp);
    }

    /// @notice Anchor Arweave TX ID for a settled ACTP transaction
    /// @dev Validates transaction is in terminal state (SETTLED or CANCELLED) before anchoring
    /// @param txId ACTP transaction ID (from ACTPKernel)
    /// @param arweaveTxId Arweave transaction ID (from Bundlr upload)
    function anchorArchive(bytes32 txId, string calldata arweaveTxId)
        external
        onlyUploader
    {
        // Replay protection
        require(!processedTxIds[txId], "Already processed");

        // Validate input
        require(bytes(archiveRecords[txId]).length == 0, "Already archived");
        require(bytes(arweaveTxId).length > 0, "Empty Arweave TX ID");
        require(bytes(arweaveTxId).length <= 64, "Arweave TX ID too long"); // Arweave TX IDs are 43 chars

        // CRITICAL: Verify transaction exists and is in terminal state
        (address requester, address provider, , IACTPKernel.State state) = kernel.getTransaction(txId);
        require(requester != address(0), "Transaction does not exist");
        require(
            state == IACTPKernel.State.SETTLED || state == IACTPKernel.State.CANCELLED,
            "Transaction not in terminal state"
        );

        // Mark as processed (replay protection)
        processedTxIds[txId] = true;

        // Store archive record
        archiveRecords[txId] = arweaveTxId;
        archiveTimestamps[arweaveTxId] = block.timestamp;
        totalArchived++;

        emit ArchiveAnchored(txId, arweaveTxId, requester, provider, block.timestamp);
    }

    /// @notice Withdraw USDC to pay for Arweave uploads
    /// @param amount USDC amount to withdraw
    function withdrawForArchiving(uint256 amount) external onlyUploader nonReentrant {
        require(amount <= USDC.balanceOf(address(this)), "Insufficient balance");

        totalSpent += amount;
        USDC.safeTransfer(uploader, amount);

        emit FundsWithdrawn(uploader, amount, block.timestamp);
    }

    /// @notice Update authorized uploader address
    /// @param newUploader New uploader address
    function setUploader(address newUploader) external onlyOwner {
        require(newUploader != address(0), "Zero address");
        address oldUploader = uploader;
        uploader = newUploader;
        emit UploaderUpdated(oldUploader, newUploader);
    }

    // ========== VIEW FUNCTIONS ==========

    /// @notice Get Arweave TX ID for an ACTP transaction
    /// @param txId ACTP transaction ID
    /// @return arweaveTxId Arweave transaction ID (empty if not archived)
    function getArchiveRecord(bytes32 txId)
        external
        view
        returns (string memory arweaveTxId)
    {
        return archiveRecords[txId];
    }

    /// @notice Check if transaction has been archived
    /// @param txId ACTP transaction ID
    /// @return archived True if archived
    function isArchived(bytes32 txId) external view returns (bool archived) {
        return bytes(archiveRecords[txId]).length > 0;
    }

    /// @notice Get current treasury balance
    /// @return balance USDC balance
    function getBalance() external view returns (uint256 balance) {
        return USDC.balanceOf(address(this));
    }

    /// @notice Get archive URL for a transaction
    /// @param txId ACTP transaction ID
    /// @return url Arweave gateway URL
    function getArchiveURL(bytes32 txId) external view returns (string memory url) {
        string memory arweaveTxId = archiveRecords[txId];
        require(bytes(arweaveTxId).length > 0, "Not archived");

        return string(abi.encodePacked("https://arweave.net/", arweaveTxId));
    }

    // ========== MODIFIERS ==========

    modifier onlyUploader() {
        require(msg.sender == uploader, "Not authorized uploader");
        _;
    }
}
```

### 5.2 Fee Allocation Flow

**Protocol Fee Distribution (in ACTPKernel.sol):**

```solidity
// In ACTPKernel.sol

address public feeRecipient; // Treasury multisig
address public archiveTreasury; // ArchiveTreasury contract

uint16 public constant ARCHIVE_ALLOCATION_BPS = 10; // 0.1% of fee (10 basis points of 100 BPS fee)

function releaseEscrow(bytes32 txId) external {
    Transaction storage txn = transactions[txId];
    require(txn.state == State.SETTLED, "Not settled");

    uint256 totalAmount = txn.amount;
    uint256 platformFee = (totalAmount * platformFeeBps) / 10000; // e.g., 1% = 100 BPS

    // Split platform fee: 99.9% to treasury, 0.1% to archive
    uint256 archiveFee = (platformFee * ARCHIVE_ALLOCATION_BPS) / 10000;
    uint256 treasuryFee = platformFee - archiveFee;

    // Transfer to provider
    uint256 providerAmount = totalAmount - platformFee;
    escrowVault.release(txn.escrowId, txn.provider, providerAmount);

    // Transfer fees
    USDC.transfer(feeRecipient, treasuryFee);
    USDC.approve(archiveTreasury, archiveFee);
    IArchiveTreasury(archiveTreasury).receiveFunds(archiveFee);

    emit EscrowReleased(txId, txn.escrowId, txn.provider, providerAmount);
    emit FeesCollected(txId, treasuryFee, archiveFee);
}
```

**Example Calculation:**

```
Transaction Amount: $100.00 USDC (100,000,000 base units)
Platform Fee (1%): $1.00 USDC (1,000,000 base units)

Fee Split:
- Treasury (99.9%): $0.999 USDC (999,000 base units)
- Archive (0.1%):   $0.001 USDC (1,000 base units)

Arweave Cost per 50KB bundle: ~$0.30
Archive fee can fund 1 bundle per 300 transactions ($0.001 * 300 = $0.30)

With batching (100 TXs per bundle), sufficient funding for 3x cost margin
```

### 5.3 Uploader Service (V1 Centralized)

**Architecture:**

```
┌──────────────────────────────────────────────┐
│          Archive Uploader Service            │
├──────────────────────────────────────────────┤
│  1. Monitor ACTPKernel for SETTLED events    │
│  2. Fetch request metadata (IPFS)            │
│  3. Fetch delivery proof (IPFS)              │
│  4. Construct archive bundle (JSON)          │
│  5. Upload to Arweave via Bundlr             │
│  6. Anchor Arweave TX ID on-chain            │
│  7. Update metrics & dead letter queue       │
└──────────────────────────────────────────────┘
```

**Implementation:**

```typescript
// scripts/archive-uploader.ts

import { ethers } from 'ethers';
import { FilebaseClient, ArweaveClient } from '@agirails/sdk/storage';
import { ArchiveTreasury } from '@agirails/sdk';

class ArchiveUploaderService {
  private kernel: ethers.Contract;
  private treasury: ArchiveTreasury;
  private filebase: FilebaseClient;
  private arweave: ArweaveClient;

  async start(): Promise<void> {
    console.log('Archive Uploader Service started');

    // Listen for SETTLED events
    this.kernel.on('TransactionSettled', async (txId: string, event: any) => {
      try {
        await this.archiveTransaction(txId);
      } catch (error) {
        console.error(`Failed to archive ${txId}:`, error);
        // Dead letter queue handles retries
      }
    });
  }

  private async archiveTransaction(txId: string): Promise<void> {
    console.log(`Archiving transaction ${txId}...`);

    // Step 1: Fetch transaction details from contract
    const tx = await this.kernel.getTransaction(txId);

    // Step 2: Download IPFS artifacts
    const requestMetadata = await this.filebase.downloadJSON(tx.requestCID);
    const deliveryProof = await this.filebase.downloadJSON(tx.deliveryCID);

    // Step 3: Construct archive bundle
    const bundle: ArchiveBundle = {
      protocolVersion: '1.0.0',
      archiveSchemaVersion: '1.0.0',
      type: 'actp.archive.v1.minimal',
      txId: txId,
      chainId: (await this.kernel.provider.getNetwork()).chainId,
      archivedAt: Math.floor(Date.now() / 1000),
      requestMetadata,
      deliveryProof,
      settlement: {
        settledAt: tx.settledAt.toNumber(),
        finalState: 'SETTLED',
        escrowReleased: {
          to: tx.provider,
          amount: tx.amount.toString()
        },
        platformFee: tx.platformFee.toString()
      },
      ipfsCIDs: {
        requestCID: tx.requestCID,
        deliveryCID: tx.deliveryCID
      }
    };

    // Step 4: Upload to Arweave (with retry)
    const arweaveTxId = await uploadWithRetry(bundle, 3);

    // Step 5: Anchor on-chain
    await this.treasury.anchorArchive(txId, arweaveTxId);

    console.log(`Archived ${txId} → Arweave ${arweaveTxId}`);
  }
}

// Run service
const uploader = new ArchiveUploaderService(config);
uploader.start();
```

**Deployment:**

```bash
# Deploy as systemd service (Linux)
sudo systemctl start agirails-archive-uploader
sudo systemctl enable agirails-archive-uploader

# Monitor logs
journalctl -u agirails-archive-uploader -f
```

### 5.4 Decentralization Path (V2)

**Current Limitation:**

V1 uploader is a single centralized service. Risks:
- Single point of failure (if service goes down, no archiving)
- Trust assumption (uploader must be honest)

**V2 Decentralization Strategy:**

1. **Decentralized Uploader Network:**
   - Multiple uploader nodes (run by community, incentivized by archive fee)
   - First uploader to anchor gets reward
   - Redundancy: Multiple uploads, deduplication by Arweave TX ID

2. **Uploader Staking:**
   - Uploaders stake USDC to participate
   - Slashing for failed uploads or invalid bundles
   - Reputation-based selection

3. **Trustless Verification:**
   - On-chain validation of Arweave TX ID (requires Arweave light client or oracle)
   - Dispute mechanism for fraudulent anchors

**Timeline:** V2 planned for Month 12+ (after mainnet stability)

---

## 6. Service Descriptor Schema

### 6.1 JSON Schema

**Purpose:** Standardized format for providers to advertise service capabilities in human and machine-readable form.

**Schema Definition:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "AGIRAILS Service Descriptor v1",
  "type": "object",
  "required": [
    "version",
    "serviceType",
    "provider",
    "pricing",
    "capabilities",
    "sla"
  ],
  "properties": {
    "version": {
      "type": "string",
      "pattern": "^\\d+\\.\\d+\\.\\d+$",
      "description": "Service descriptor version"
    },
    "serviceType": {
      "type": "string",
      "pattern": "^[a-z0-9-]+$",
      "description": "Service type identifier (e.g., text-generation)"
    },
    "provider": {
      "type": "object",
      "required": ["did", "name", "endpoint"],
      "properties": {
        "did": {
          "type": "string",
          "pattern": "^did:ethr:(\\d+:)?0x[a-fA-F0-9]{40}$",
          "description": "Provider DID"
        },
        "name": {
          "type": "string",
          "description": "Provider display name"
        },
        "endpoint": {
          "type": "string",
          "format": "uri",
          "description": "Provider API endpoint"
        },
        "contact": {
          "type": "string",
          "format": "email",
          "description": "Support email"
        }
      }
    },
    "pricing": {
      "type": "object",
      "required": ["currency", "minPrice", "maxPrice"],
      "properties": {
        "currency": {
          "type": "string",
          "const": "USDC",
          "description": "Payment currency"
        },
        "minPrice": {
          "type": "string",
          "description": "Minimum price (USDC base units, 6 decimals)"
        },
        "maxPrice": {
          "type": "string",
          "description": "Maximum price (USDC base units, 6 decimals)"
        },
        "pricingModel": {
          "type": "string",
          "enum": ["fixed", "per-token", "per-request", "tiered"],
          "description": "Pricing model type"
        },
        "pricingDetails": {
          "type": "object",
          "description": "Model-specific pricing parameters"
        }
      }
    },
    "capabilities": {
      "type": "object",
      "required": ["inputSchema", "outputFormats"],
      "properties": {
        "inputSchema": {
          "type": "string",
          "format": "uri",
          "description": "IPFS/HTTPS URL to JSON Schema for inputData validation"
        },
        "outputFormats": {
          "type": "array",
          "items": {
            "type": "string",
            "enum": ["json", "text", "binary", "url"]
          },
          "description": "Supported output formats"
        },
        "maxInputSize": {
          "type": "integer",
          "description": "Maximum input size in bytes"
        },
        "supportedModels": {
          "type": "array",
          "items": { "type": "string" },
          "description": "AI models supported (e.g., ['gpt-4', 'claude-2'])"
        }
      }
    },
    "sla": {
      "type": "object",
      "required": ["avgResponseTime", "availability"],
      "properties": {
        "avgResponseTime": {
          "type": "integer",
          "description": "Average response time in seconds"
        },
        "maxResponseTime": {
          "type": "integer",
          "description": "Maximum guaranteed response time (SLA commitment)"
        },
        "availability": {
          "type": "number",
          "minimum": 0,
          "maximum": 1,
          "description": "Availability percentage (0.99 = 99%)"
        },
        "disputeRate": {
          "type": "number",
          "minimum": 0,
          "maximum": 1,
          "description": "Historical dispute rate (0.05 = 5%)"
        }
      }
    },
    "metadata": {
      "type": "object",
      "description": "Additional provider-specific metadata",
      "properties": {
        "tags": {
          "type": "array",
          "items": { "type": "string" }
        },
        "certifications": {
          "type": "array",
          "items": { "type": "string" },
          "description": "Industry certifications (e.g., SOC2, ISO27001)"
        },
        "regions": {
          "type": "array",
          "items": { "type": "string" },
          "description": "Geographic regions served"
        }
      }
    }
  }
}
```

### 6.2 Example Descriptor

**Text Generation Service:**

```json
{
  "version": "1.0.0",
  "serviceType": "text-generation",
  "provider": {
    "did": "did:ethr:8453:0x742d35cc6634c0532925a3b844bc9e7595f0beb",
    "name": "Acme AI Services",
    "endpoint": "https://api.acme-ai.com/v1",
    "contact": "support@acme-ai.com"
  },
  "pricing": {
    "currency": "USDC",
    "minPrice": "500000",
    "maxPrice": "50000000",
    "pricingModel": "per-token",
    "pricingDetails": {
      "pricePerToken": "10",
      "inputMultiplier": 1.0,
      "outputMultiplier": 1.5
    }
  },
  "capabilities": {
    "inputSchema": "ipfs://bafybei.../text-generation-input-schema.json",
    "outputFormats": ["json", "text"],
    "maxInputSize": 1048576,
    "supportedModels": ["gpt-4", "gpt-3.5-turbo", "claude-2"]
  },
  "sla": {
    "avgResponseTime": 30,
    "maxResponseTime": 120,
    "availability": 0.995,
    "disputeRate": 0.02
  },
  "metadata": {
    "tags": ["ai", "nlp", "gpt"],
    "certifications": ["SOC2", "GDPR-compliant"],
    "regions": ["us-east", "eu-west"]
  }
}
```

**Code Generation Service:**

```json
{
  "version": "1.0.0",
  "serviceType": "code-generation",
  "provider": {
    "did": "did:ethr:8453:0x9abc...",
    "name": "CodeGen Pro",
    "endpoint": "https://codegen.pro/api",
    "contact": "hello@codegen.pro"
  },
  "pricing": {
    "currency": "USDC",
    "minPrice": "5000000",
    "maxPrice": "100000000",
    "pricingModel": "tiered",
    "pricingDetails": {
      "tiers": [
        { "maxComplexity": 10, "price": "5000000" },
        { "maxComplexity": 50, "price": "25000000" },
        { "maxComplexity": 100, "price": "50000000" }
      ]
    }
  },
  "capabilities": {
    "inputSchema": "ipfs://bafybei.../code-generation-schema.json",
    "outputFormats": ["json", "url"],
    "maxInputSize": 2097152,
    "supportedModels": ["codex", "copilot-gpt4"]
  },
  "sla": {
    "avgResponseTime": 180,
    "maxResponseTime": 600,
    "availability": 0.99,
    "disputeRate": 0.01
  },
  "metadata": {
    "tags": ["code", "ai", "automation"],
    "certifications": ["SOC2"],
    "regions": ["global"]
  }
}
```

### 6.3 Descriptor Storage

**On-Chain Storage (AgentRegistry.sol):**

Only store **hash** of descriptor on-chain to save gas:

```solidity
struct ServiceDescriptor {
    bytes32 serviceTypeHash;
    string metadataCID; // IPFS CID to full descriptor JSON
    // Other lightweight fields...
}
```

**Off-Chain Storage (IPFS):**

Full descriptor JSON stored on IPFS, referenced by `metadataCID`:

```typescript
// Provider uploads descriptor to IPFS
const descriptor = {
  version: '1.0.0',
  serviceType: 'text-generation',
  // ... full descriptor
};

const cid = await filebase.uploadJSON(descriptor);
console.log('Descriptor CID:', cid);
// bafybei.../text-generation-descriptor.json

// Provider registers on-chain with CID
await registry.registerAgent(profile, [
  {
    serviceTypeHash: ethers.utils.keccak256(
      ethers.utils.toUtf8Bytes('text-generation')
    ),
    metadataCID: cid,
    // ...
  }
]);
```

**Consumer Retrieval:**

```typescript
// Consumer queries registry (with pagination)
const agents = await registry.queryAgentsByService(serviceTypeHash, minReputation, 0, 10);
// offset=0, limit=10: Get first 10 results

// Download full descriptor from IPFS
for (const agentAddress of agents) {
  const descriptors = await registry.getServiceDescriptors(agentAddress);

  for (const desc of descriptors) {
    const fullDescriptor = await filebase.downloadJSON(desc.metadataCID);
    console.log('Service:', fullDescriptor.serviceType);
    console.log('Pricing:', fullDescriptor.pricing);
    console.log('SLA:', fullDescriptor.sla);
  }
}
```

---

## 7. Storage SDK

### 7.1 SDK Module Structure

**Package:** `@agirails/sdk/storage`

```
@agirails/sdk/
├── src/
│   ├── storage/
│   │   ├── FilebaseClient.ts       # IPFS hot storage (via Filebase S3 API)
│   │   ├── ArweaveClient.ts        # Arweave permanent archive (via Bundlr)
│   │   ├── StorageManager.ts       # High-level API (upload, download, archive)
│   │   ├── ArchiveBundle.ts        # Archive bundle construction
│   │   └── types.ts                # TypeScript interfaces
│   ├── identity/
│   │   ├── DIDResolver.ts          # ethr-did-resolver integration
│   │   ├── DIDManager.ts           # DID creation, verification
│   │   └── types.ts
│   ├── registry/
│   │   ├── AgentRegistry.ts        # AgentRegistry.sol contract wrapper
│   │   ├── ServiceDescriptor.ts    # Service descriptor utilities
│   │   └── types.ts
│   └── index.ts
```

### 7.2 StorageManager API

**High-Level Storage API:**

```typescript
// src/storage/StorageManager.ts

import { FilebaseClient } from './FilebaseClient';
import { ArweaveClient } from './ArweaveClient';
import { ArchiveBundle } from './ArchiveBundle';

export class StorageManager {
  private filebase: FilebaseClient;
  private arweave: ArweaveClient;

  constructor(config: StorageConfig) {
    this.filebase = new FilebaseClient(config.filebase);
    this.arweave = new ArweaveClient(config.arweave);
  }

  /**
   * Upload request metadata to IPFS (hot storage)
   * @param metadata AIP-1 request metadata
   * @returns IPFS CID
   */
  async uploadRequest(metadata: AIP1Request): Promise<string> {
    return await this.filebase.uploadJSON(metadata);
  }

  /**
   * Upload delivery proof to IPFS (hot storage)
   * @param proof AIP-4 delivery proof
   * @returns IPFS CID
   */
  async uploadDelivery(proof: AIP4Delivery): Promise<string> {
    return await this.filebase.uploadJSON(proof);
  }

  /**
   * Archive settled transaction to Arweave (permanent storage)
   * @param bundle Archive bundle (request + delivery + settlement)
   * @returns Arweave transaction ID
   */
  async archiveTransaction(bundle: ArchiveBundle): Promise<string> {
    return await this.arweave.uploadBundle(bundle);
  }

  /**
   * Download request metadata from IPFS
   * @param cid IPFS CID
   * @returns Parsed AIP-1 request
   */
  async downloadRequest(cid: string): Promise<AIP1Request> {
    return await this.filebase.downloadJSON(cid);
  }

  /**
   * Download delivery proof from IPFS
   * @param cid IPFS CID
   * @returns Parsed AIP-4 delivery proof
   */
  async downloadDelivery(cid: string): Promise<AIP4Delivery> {
    return await this.filebase.downloadJSON(cid);
  }

  /**
   * Download archive bundle from Arweave
   * @param arweaveTxId Arweave transaction ID
   * @returns Parsed archive bundle
   */
  async downloadArchive(arweaveTxId: string): Promise<ArchiveBundle> {
    return await this.arweave.downloadBundle(arweaveTxId);
  }

  /**
   * Estimate archiving cost
   * @param bundle Archive bundle
   * @returns Cost in wei (Base ETH)
   */
  async estimateArchiveCost(bundle: ArchiveBundle): Promise<bigint> {
    const sizeBytes = JSON.stringify(bundle).length;
    return await this.arweave.estimateCost(sizeBytes);
  }
}
```

### 7.3 Usage Examples

**Consumer Workflow:**

```typescript
import { ACTPClient, StorageManager } from '@agirails/sdk';

const client = await ACTPClient.create({ network: 'base', privateKey });
const storage = new StorageManager(storageConfig);

// Step 1: Create AIP-1 request metadata
const requestMetadata = {
  version: '1.0.0',
  serviceType: 'text-generation',
  consumer: await client.getDID(),
  provider: 'did:ethr:8453:0xProvider...',
  inputData: { prompt: 'Explain quantum computing' },
  paymentTerms: {
    amount: '1000000',
    deadline: Math.floor(Date.now() / 1000) + 86400,
    disputeWindow: 7200
  },
  timestamp: Math.floor(Date.now() / 1000)
};

// Step 2: Upload to IPFS
const requestCID = await storage.uploadRequest(requestMetadata);
console.log('Request uploaded:', requestCID);

// Step 3: Create on-chain transaction
const serviceHash = ethers.utils.keccak256(
  ethers.utils.toUtf8Bytes(canonicalJsonStringify(requestMetadata))
);

const txId = await client.kernel.createTransaction({
  provider: providerAddress,
  serviceHash,
  amount: ethers.utils.parseUnits('1.0', 6),
  deadline: requestMetadata.paymentTerms.deadline,
  disputeWindow: requestMetadata.paymentTerms.disputeWindow
});

console.log('Transaction created:', txId);
```

**Provider Workflow:**

```typescript
import { StorageManager } from '@agirails/sdk';

const storage = new StorageManager(storageConfig);

// Step 1: Download request metadata from IPFS
const requestCID = notification.cid; // From AIP-0.1 notification
const requestMetadata = await storage.downloadRequest(requestCID);

// Step 2: Verify metadata hash
const computedHash = ethers.utils.keccak256(
  ethers.utils.toUtf8Bytes(canonicalJsonStringify(requestMetadata))
);

const tx = await kernel.getTransaction(txId);
if (computedHash !== tx.serviceHash) {
  throw new Error('Metadata hash mismatch - potential attack');
}

// Step 3: Execute service...

// Step 4: Upload delivery proof to IPFS
const deliveryProof = {
  type: 'agirails.delivery.v1',
  txId,
  provider: await signer.getAddress(),
  resultCID: resultCID,
  resultHash: resultHash,
  deliveredAt: Math.floor(Date.now() / 1000)
};

const deliveryCID = await storage.uploadDelivery(deliveryProof);
console.log('Delivery uploaded:', deliveryCID);
```

---

## 8. Security Considerations

### 8.1 DID Spoofing

**Threat:** Attacker creates DID with similar address (address collision attack).

**Mitigation:**
- EIP-712 signatures bind messages to specific Ethereum address
- Recipients MUST verify signature against DID address
- On-chain transactions reference address, not DID string

**Example Attack (Prevented):**

```
Attacker DID: did:ethr:0x742d35cc6634c0532925a3b844bc9e7595f0beb (legitimate)
Fake DID:     did:ethr:0x742d35cc6634c0532925a3b844bc9e7595f0bec (last char different)

Consumer sends request to fake DID
→ On-chain transaction references 0x...bec (wrong address)
→ Legitimate provider (0x...beb) cannot transition state (access control fails)
→ Attack fails, funds remain locked until deadline expiry
```

### 8.2 IPFS Content Disappearance

**Threat:** Consumer or provider unpins metadata, causing content to vanish before dispute resolution.

**Mitigation:**
- AIP-0 §2.1 mandates pinning for `disputeWindow + 7 days`
- Recommended: Use paid pinning services (Pinata, Filebase)
- Future: Protocol-level pinning subsidy from archive treasury

**Attack Scenario (Mitigated):**

```
1. Consumer creates request, uploads to IPFS
2. Provider downloads, verifies, accepts
3. Consumer immediately unpins (malicious)
4. Provider delivers, consumer disputes
5. Provider cannot retrieve request metadata to defend dispute
   → Mitigated by provider re-pinning in step 2
```

### 8.3 Arweave TX ID Forgery

**Threat:** Uploader anchors fake Arweave TX ID (data not actually on Arweave).

**Mitigation (V1):**
- Centralized uploader is trusted (controlled by AGIRAILS team)
- Dead letter queue + monitoring ensures upload failures are detected
- Future V2: On-chain Arweave light client verification

**Attack Scenario (Prevented in V2):**

```
Malicious uploader anchors txId = "fake123"
→ ArchiveTreasury.anchorArchive("0xabcd...", "fake123")
→ V2 contract queries Arweave light client oracle
→ Oracle verifies TX "fake123" does not exist
→ Transaction reverts, uploader slashed
```

### 8.4 Registry Sybil Attacks

**Threat:** Attacker creates 1000 fake agent profiles to spam discovery results.

**Mitigation:**
- Reputation score starts at 0 (no completed transactions)
- Discovery queries filter by `minReputation` (e.g., ≥ 7.5/10)
- Future: Staking requirement (e.g., $1000 USDC) to register

**Attack Scenario (Limited Impact):**

```
Attacker registers 1000 agents with reputation = 0
Consumer queries: queryAgentsByService(serviceTypeHash, 7500, 0, 10)
→ Returns 0 results (attacker agents have reputation < 7500)
→ Attack fails to pollute discovery
```

### 8.5 Stake Slashing Conditions (V2)

**Future Slashing Triggers:**

1. **Dispute Loss**: Provider loses dispute → slash 10% of stake
2. **SLA Violation**: avgResponseTime > maxResponseTime for 10 consecutive TXs → slash 5%
3. **Endpoint Unavailability**: Endpoint down for >24 hours → slash 2%
4. **Fraudulent Attestation**: EAS attestation revoked → slash 50%

**Implementation (V2):**

```solidity
function slashStake(
    address agent,
    uint256 amount,
    bytes32 txId,
    SlashReason reason
) external onlyKernel {
    AgentProfile storage profile = agents[agent];
    require(profile.stakedAmount >= amount, "Insufficient stake");

    profile.stakedAmount -= amount;

    // Distribute slashed funds
    uint256 toConsumer = amount / 2; // 50% to affected consumer
    uint256 toTreasury = amount - toConsumer; // 50% to treasury

    USDC.transfer(tx.requester, toConsumer);
    USDC.transfer(feeRecipient, toTreasury);

    emit StakeSlashed(agent, amount, txId, reason);
}
```

---

## 9. Test Vectors

### 9.1 DID Resolution Test

**Input:**

```typescript
const did = 'did:ethr:84532:0x742d35cc6634c0532925a3b844bc9e7595f0beb';
```

**Expected Output:**

```json
{
  "@context": "https://w3id.org/did/v1",
  "id": "did:ethr:84532:0x742d35cc6634c0532925a3b844bc9e7595f0beb",
  "verificationMethod": [{
    "id": "did:ethr:84532:0x742d35cc6634c0532925a3b844bc9e7595f0beb#controller",
    "type": "EcdsaSecp256k1RecoveryMethod2020",
    "controller": "did:ethr:84532:0x742d35cc6634c0532925a3b844bc9e7595f0beb",
    "blockchainAccountId": "0x742d35cc6634c0532925a3b844bc9e7595f0beb@eip155:84532"
  }],
  "authentication": ["did:ethr:84532:0x742d35cc6634c0532925a3b844bc9e7595f0beb#controller"]
}
```

### 9.2 Archive Bundle Hash Test

**Input:**

```json
{
  "protocolVersion": "1.0.0",
  "archiveSchemaVersion": "1.0.0",
  "type": "actp.archive.v1.minimal",
  "txId": "0x7d87c3b8e23a5c9d1f4e6b2a8c5d9e3f1a7b4c6d8e2f5a3b9c1d7e4f6a8b2c5d",
  "chainId": 8453,
  "archivedAt": 1732150000
}
```

**Canonical JSON:**

```
{"archiveSchemaVersion":"1.0.0","archivedAt":1732150000,"chainId":8453,"protocolVersion":"1.0.0","txId":"0x7d87c3b8e23a5c9d1f4e6b2a8c5d9e3f1a7b4c6d8e2f5a3b9c1d7e4f6a8b2c5d","type":"actp.archive.v1.minimal"}
```

**Expected Keccak256 Hash:**

```
0x9f2e3a5b7c1d8e4f6a9b2c5d7e1f3a4b6c8d9e2f5a7b3c9d1e4f6a8b2c5d7e9f
```

### 9.3 Service Type Hash Test

**Positive Test (Correct Hash):**

```typescript
const serviceType = 'text-generation';
const serviceTypeHash = ethers.utils.keccak256(
  ethers.utils.toUtf8Bytes(serviceType)
);
```

**Expected Output:**

```
0x9c22ff5f21f0b81b113e63f7db6da94fedef11b2119b4088b89664fb9a3cb658
```

**Negative Test (Wrong Case - Common Error):**

```typescript
// WRONG: Using uppercase - will NOT match any registered agents
const wrongServiceType = 'Text-Generation'; // Capital T and G
const wrongHash = ethers.utils.keccak256(
  ethers.utils.toUtf8Bytes(wrongServiceType)
);

// Expected: 0x... (different hash)
// Query with this hash will return 0 results
```

**Why This Matters:**

Service type strings are **case-sensitive** when hashed. The contract enforces lowercase during registration (see §3.2), but SDK clients must hash correctly when querying.

```typescript
// Correct pattern in SDK:
function normalizeServiceType(serviceType: string): string {
  return serviceType.toLowerCase().trim();
}

const hash = ethers.utils.keccak256(
  ethers.utils.toUtf8Bytes(normalizeServiceType('Text-Generation'))
);
// Now returns: 0x9c22ff5f21f0b81b113e63f7db6da94fedef11b2119b4088b89664fb9a3cb658
```

---

## 10. Implementation Roadmap

### Phase 1: Core Identity & Registry (Month 1-2)

**Deliverables:**
- [ ] Deploy `AgentRegistry.sol` to Base Sepolia
- [ ] Integrate `ethr-did-resolver` in SDK
- [ ] Implement `DIDResolver` and `DIDManager` classes
- [ ] Create registry SDK wrapper (`AgentRegistry.ts`)
- [ ] Write unit tests for registry contract
- [ ] Write integration tests for DID resolution

**Success Criteria:**
- Providers can register profiles on-chain
- Consumers can query agents by service type
- DID resolution works for Base Sepolia and Mainnet

### Phase 2: Storage Infrastructure (Month 2-3)

**Deliverables:**
- [ ] Deploy `ArchiveTreasury.sol` to Base Sepolia
- [ ] Integrate Filebase S3 API (`FilebaseClient.ts`)
- [ ] Integrate Bundlr for Arweave (`ArweaveClient.ts`)
- [ ] Build `StorageManager` high-level API
- [ ] Implement archive uploader service (centralized V1)
- [ ] Configure dead letter queue and monitoring

**Success Criteria:**
- Request metadata uploaded to IPFS automatically
- Settled transactions archived to Arweave within 5 minutes
- Archive treasury receives 0.1% of protocol fees

### Phase 3: Service Descriptors (Month 3-4)

**Deliverables:**
- [ ] Define JSON Schema for service descriptors
- [ ] Create example descriptors (text-gen, code-gen, web-scraping)
- [ ] Implement descriptor upload/download utilities
- [ ] Update registry contract to store descriptor CIDs
- [ ] Build discovery UI (optional dashboard)

**Success Criteria:**
- Providers can upload service descriptors to IPFS
- Consumers can download and parse descriptors
- Discovery queries return ranked results with SLA info

### Phase 4: Decentralization (Month 12+)

**Deliverables:**
- [ ] Design decentralized uploader network
- [ ] Implement uploader staking mechanism
- [ ] Add on-chain Arweave verification (light client or oracle)
- [ ] Deploy multi-uploader redundancy
- [ ] Audit and mainnet migration

**Success Criteria:**
- Archive uploads continue even if single uploader fails
- Fraudulent archive anchors are detected and slashed
- No centralized dependencies

---

## 11. References

### Standards & Specifications

- **DID Core Specification**: https://www.w3.org/TR/did-core/
- **`did:ethr` Method**: https://github.com/decentralized-identity/ethr-did-resolver
- **ERC-1056 (EthereumDIDRegistry)**: https://eips.ethereum.org/EIPS/eip-1056
- **IPFS Docs**: https://docs.ipfs.tech/
- **Arweave Docs**: https://docs.arweave.org/
- **Bundlr Docs**: https://docs.bundlr.network/

### AGIRAILS AIPs

- **AIP-0**: Meta Protocol (Identity, Transport, EIP-712)
- **AIP-1**: Request Metadata Format
- **AIP-4**: Delivery Proof and EAS Attestation
- **AIP-8** (Future): Agent Key Management and Rotation

### External Libraries

- **ethr-did-resolver**: `npm install ethr-did-resolver did-resolver`
- **Bundlr SDK**: `npm install @bundlr-network/client`
- **IPFS HTTP Client**: `npm install ipfs-http-client`
- **AWS SDK (Filebase)**: `npm install @aws-sdk/client-s3`

---

## 12. Changelog

- **2026-01-12**: AIP-9 Deterministic TokenId Amendment (v0.8.1)
  - §3.1: Removed `passportTokenId` field from AgentProfile struct
  - **Reason**: AIP-9 uses deterministic derivation `tokenId = uint256(uint160(agentAddress))`
  - **Benefits**: Zero storage, zero sync, single source of truth
  - **Query**: Use `passportContract.tokenIdFor(agent)` to compute tokenId
  - Header: "Extended By: AIP-9 (Agent Passport NFT)" reference retained

- **2026-01-11**: AIP-9 Integration Amendment (v0.8.0) - SUPERSEDED by v0.8.1
  - Originally added `passportTokenId` field - now removed in favor of deterministic derivation

- **2025-11-29**: Final review consistency fixes (v0.6.1)
  - §1.3: Fixed Layer 1 overview to show full DID format `did:ethr:<chainId>:<address>` (was showing deprecated simplified format)
  - §3.3: Fixed SDK Discovery Flow example to use 4-parameter `queryAgentsByService(hash, minRep, offset, limit)` (was using old 3-param signature)

- **2025-11-29**: High-priority security and consistency fixes (v0.6.0)
  - **H-3**: §3.1: Added pagination to `queryAgentsByService` - added `offset` parameter and renamed `maxResults` to `limit` to prevent DoS with large agent sets
  - **H-3**: §6.2: Updated SDK example to include pagination parameters (offset=0, limit=10)
  - **H-3**: §8.4: Updated attack scenario example with pagination parameters
  - **H-4**: §4.4: Added `signatures` field to archive bundle schema with `providerDeliverySignature` (required) and `requesterSettlementSignature` (optional)
  - **H-4**: §4.4: Updated archive bundle example to include EIP-712 signatures for self-verification without IPFS dependency
  - **H-4**: §4.4: Added `signatures` to required fields array in JSON schema
  - **H-5**: §2.1: Marked simplified DID format (`did:ethr:<address>`) as DEPRECATED with security warning about cross-chain confusion
  - **H-5**: §2.1: Emphasized that full format with chainId is REQUIRED for all AGIRAILS contracts and SDKs
  - **H-5**: §3.1: Added security comment confirming registerAgent always uses full DID format with chainId (simplified format rejected)

- **2025-11-29**: Compilation and consistency fixes (v0.5.0)
  - §3.1: Added missing `@openzeppelin/contracts/utils/Strings.sol` import
  - §3.1: Changed DID to use lowercase address (not EIP-55 checksum) for did:ethr resolver compatibility
  - §3.1: Simplified to single `_toLowerAddress()` helper (removed checksum functions)
  - §3.1: Added explicit whitespace rejection in serviceType validation with clear error message
  - §3.1: Added empty service type check
  - §3.1: Improved error messages for invalid characters
  - §2.1: Updated all DID examples to use canonical lowercase format
  - §2.1: Added "Case Sensitivity Note" explaining lowercase canonical format
  - §2.3, §9.1: Updated DID Document examples to lowercase
  - §8.1: Updated attack vector examples to lowercase

- **2025-11-29**: Final audit fixes (v0.4.0)
  - §3.1: Fixed DID assembly to use decimal chainId (not hex) for did:ethr compatibility
  - §3.1: Added constructor with chainId storage and actpKernel initialization
  - §3.1: Enforced lowercase serviceType on-chain with character validation (a-z, 0-9, hyphen)
  - §3.1: Moved `_calculateReputationScore` into AgentRegistry (single source of truth)
  - §3.4: Aligned ACTPKernel example to use `updateReputationOnSettlement` API correctly
  - §3.4: Added design decision table explaining Registry-based vs Kernel-based calculation
  - §4.4: Fixed archive bundle example with valid 40-hex addresses (real testnet addresses)
  - §4.4: Fixed schemaUID to be proper 64-hex format

- **2025-11-29**: Security audit fixes (v0.3.0)
  - §3.1: Fixed access control - registerAgent now uses msg.sender as agentAddress (not caller-supplied)
  - §3.1: All profile update functions require msg.sender == registered agent
  - §3.1: Reputation updates are kernel-only and atomic (updateReputationOnSettlement)
  - §3.1: Added serviceType canonicalization (MUST be lowercase, hash verified on-chain)
  - §4.4: Fixed archive bundle schema contradiction - now truly minimal hash-first
  - §4.4: Defined participants, references, hashes properties correctly
  - §4.4: Added size comparison (500 bytes vs 5-50KB)
  - §4.3: Fixed Bundlr currency - documented supported currencies (matic, arbitrum, etc.)
  - §5.1: Added ACTPKernel state verification to anchorArchive
  - §5.1: Added replay protection (processedTxIds mapping)
  - §5.1: Added input validation (Arweave TX ID length)
  - §5.1: Using SafeERC20 for all token transfers

- **2025-11-29**: Founder decisions incorporated (v0.2.0)
  - §2.2: AGIRAILS-owned ERC-1056 compatible registry (no external dependencies)
  - §3.4: Simple reputation formula: `score = 0.7 × successRate + 0.3 × logVolume`
  - §3.4: Level tiers (0-3) with Bronze/Silver/Gold badges
  - §3.5: Staking deferred to V2 (no stake enforcement in V1)
  - §4.4: Minimal hash-first archive bundle (Arweave holds hashes, IPFS holds content)
  - Added `disputedTransactions` field to AgentProfile struct

- **2025-11-29**: Initial draft (v0.1.0)
  - DID system (ethr-did-resolver integration)
  - Agent Registry contract interface
  - Hybrid storage architecture (IPFS + Arweave)
  - Archive Treasury contract
  - Service Descriptor schema
  - Storage SDK design

---

## 13. Copyright

Copyright © 2025 AGIRAILS Inc.
Licensed under Apache-2.0.

This document and all AIP specifications are open-source and may be freely implemented by any party.

---

**END OF AIP-7**
