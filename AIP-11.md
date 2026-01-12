# AIP-11: Token Bound Accounts

**Status:** Draft
**Author:** AGIRAILS Core Team
**Created:** 2026-01-11
**Updated:** 2026-01-11
**Version:** 0.1.1
**Depends On:** AIP-9 (Agent Passport NFT), ERC-6551 (Token Bound Accounts)
**Related:** AIP-10 (Reputation Badges)

---

## Abstract

This AIP specifies the **Token Bound Account (TBA)** system for AGIRAILS Agent Passports. Each Agent Passport NFT (AIP-9) has an associated smart contract wallet (TBA) that can hold assets on behalf of the agent.

**Key Design Decision: PASSIVE TBA**

AGIRAILS TBAs are intentionally **passive** - they:
- **CAN** receive and hold ERC-1155 badge tokens (AIP-10)
- **CAN** receive and hold ERC-20/721 tokens
- **CANNOT** execute arbitrary transactions
- **CANNOT** sign messages
- **CANNOT** interact with DeFi protocols

This design minimizes attack surface while enabling badge portability.

---

## 1. Motivation

### 1.1 The Portability Problem

Without TBAs, agent badges (AIP-10) face ownership challenges:
- Badges minted to EOA (owner wallet) don't travel with agent
- Selling agent passport doesn't transfer earned badges
- Badge ownership fragmentes across multiple addresses

### 1.2 Solution: Bound Accounts

ERC-6551 Token Bound Accounts solve this by creating a smart contract wallet for each NFT:

```
Agent Passport (ERC-721)
    └── Token Bound Account (Smart Contract)
            └── Badge 1 (ERC-1155)
            └── Badge 2 (ERC-1155)
            └── ... (any assets)
```

When the passport transfers, all TBA assets travel with it automatically.

### 1.3 Why Passive Design?

Full ERC-6551 implementations can execute arbitrary transactions. This creates risks:
- Complex attack surface
- Phishing via malicious dApps
- Gas cost for execution features
- Regulatory complexity

AGIRAILS TBAs are **receive-only** - dramatically simpler and safer.

---

## 2. Specification

### 2.1 ERC-6551 Overview

ERC-6551 defines:
1. **Registry Contract** - Deploys TBA contracts deterministically
2. **Account Implementation** - Template for TBA smart contracts
3. **Account Interface** - Minimal interface all TBAs must implement

**TBA Address Derivation:**
```
TBA Address = CREATE2(
    registryAddress,
    keccak256(chainId, tokenContract, tokenId, implementationAddress, salt),
    implementationBytecode
)
```

### 2.2 AGIRAILS TBA Registry

AGIRAILS deploys its own ERC-6551 Registry on Base:

```solidity
// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.20;

interface IERC6551Registry {
    /// @notice Deploy a token bound account for a passport
    function createAccount(
        address implementation,
        bytes32 salt,
        uint256 chainId,
        address tokenContract,
        uint256 tokenId
    ) external returns (address);

    /// @notice Compute the address of a token bound account
    function account(
        address implementation,
        bytes32 salt,
        uint256 chainId,
        address tokenContract,
        uint256 tokenId
    ) external view returns (address);
}
```

**Deployment Addresses:**

| Network | ERC6551Registry | AgentTBA Implementation |
|---------|-----------------|-------------------------|
| Base Sepolia | TBD | TBD |
| Base Mainnet | TBD | TBD |

### 2.3 AgentTBA Implementation (Passive)

```solidity
// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.20;

import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "@openzeppelin/contracts/interfaces/IERC1271.sol";

/// @title IERC6551Account
/// @notice Minimal ERC-6551 account interface
interface IERC6551Account {
    receive() external payable;

    function token()
        external
        view
        returns (uint256 chainId, address tokenContract, uint256 tokenId);

    function state() external view returns (uint256);

    function isValidSigner(address signer, bytes calldata context)
        external
        view
        returns (bytes4 magicValue);
}

/// @title IERC6551Executable
/// @notice Optional execute interface (NOT implemented in AgentTBA)
interface IERC6551Executable {
    function execute(
        address to,
        uint256 value,
        bytes calldata data,
        uint8 operation
    ) external payable returns (bytes memory);
}

/// @title AgentTBA
/// @notice Passive Token Bound Account for AGIRAILS Agent Passports
/// @dev INTENTIONALLY does NOT implement IERC6551Executable
/// @dev This is a receive-only wallet for holding badges and tokens
contract AgentTBA is
    IERC6551Account,
    IERC165,
    IERC721Receiver,
    IERC1155Receiver,
    IERC1271
{
    // ========== CONSTANTS ==========

    /// @notice ERC-1271 magic value for valid signature
    bytes4 constant MAGIC_VALUE = 0x1626ba7e;

    /// @notice ERC-1271 invalid signature
    bytes4 constant INVALID_SIGNATURE = 0xffffffff;

    // ========== STATE ==========

    /// @notice Execution nonce (for future compatibility, always 0)
    uint256 private _state;

    // ========== ERRORS ==========

    error ExecutionDisabled();
    error SigningDisabled();

    // ========== RECEIVE ==========

    /// @notice Receive ETH
    receive() external payable override {}

    // ========== ERC-6551 ACCOUNT ==========

    /// @notice Return the token this account is bound to
    function token()
        external
        view
        override
        returns (uint256 chainId, address tokenContract, uint256 tokenId)
    {
        bytes memory footer = new bytes(0x60);
        assembly {
            extcodecopy(address(), add(footer, 0x20), 0x4d, 0x60)
        }
        return abi.decode(footer, (uint256, address, uint256));
    }

    /// @notice Return the state (nonce) of this account
    function state() external view override returns (uint256) {
        return _state;
    }

    /// @notice Check if signer is valid (ALWAYS returns invalid)
    /// @dev AgentTBA does NOT support signing
    function isValidSigner(address, bytes calldata)
        external
        pure
        override
        returns (bytes4)
    {
        // Signing disabled for passive TBA
        return bytes4(0);
    }

    // ========== ERC-1271 (Disabled) ==========

    /// @notice Validate signature (ALWAYS returns invalid)
    /// @dev AgentTBA cannot sign messages
    function isValidSignature(bytes32, bytes memory)
        external
        pure
        override
        returns (bytes4)
    {
        // Signing disabled
        return INVALID_SIGNATURE;
    }

    // ========== EXECUTE (Disabled) ==========

    /// @notice Execute is DISABLED for passive TBA
    /// @dev This function reverts unconditionally
    function execute(address, uint256, bytes calldata, uint8)
        external
        payable
        returns (bytes memory)
    {
        revert ExecutionDisabled();
    }

    // ========== TOKEN RECEIVERS ==========

    /// @notice Handle ERC-721 tokens (badges can be NFTs)
    function onERC721Received(address, address, uint256, bytes calldata)
        external
        pure
        override
        returns (bytes4)
    {
        return this.onERC721Received.selector;
    }

    /// @notice Handle ERC-1155 tokens (badges are ERC-1155)
    function onERC1155Received(address, address, uint256, uint256, bytes calldata)
        external
        pure
        override
        returns (bytes4)
    {
        return this.onERC1155Received.selector;
    }

    /// @notice Handle ERC-1155 batch transfers
    function onERC1155BatchReceived(
        address,
        address,
        uint256[] calldata,
        uint256[] calldata,
        bytes calldata
    ) external pure override returns (bytes4) {
        return this.onERC1155BatchReceived.selector;
    }

    // ========== VIEW FUNCTIONS ==========

    /// @notice Get the owner of this TBA (passport holder)
    function owner() public view returns (address) {
        (uint256 chainId, address tokenContract, uint256 tokenId) = this.token();
        if (chainId != block.chainid) return address(0);
        return IERC721(tokenContract).ownerOf(tokenId);
    }

    /// @notice Get the agent address this TBA is bound to
    function agent() external view returns (address) {
        (, , uint256 tokenId) = this.token();
        // tokenId = uint256(uint160(agentAddress)) from AIP-9
        return address(uint160(tokenId));
    }

    // ========== ERC-165 ==========

    /// @notice Check interface support
    function supportsInterface(bytes4 interfaceId)
        public
        pure
        override(IERC165, IERC1155Receiver)
        returns (bool)
    {
        return
            interfaceId == type(IERC165).interfaceId ||
            interfaceId == type(IERC6551Account).interfaceId ||
            interfaceId == type(IERC721Receiver).interfaceId ||
            interfaceId == type(IERC1155Receiver).interfaceId ||
            interfaceId == type(IERC1271).interfaceId;
    }
}
```

### 2.4 TBA Address Computation

Compute TBA address without deployment:

```typescript
import { ethers } from 'ethers';

function computeTBAAddress(
  registryAddress: string,
  implementationAddress: string,
  chainId: number,
  passportAddress: string,
  tokenId: bigint,
  salt: string = ethers.constants.HashZero
): string {
  // ERC-6551 address derivation
  const code = ethers.utils.concat([
    '0x3d60ad80600a3d3981f3363d3d373d3d3d363d73',
    implementationAddress,
    '0x5af43d82803e903d91602b57fd5bf3',
  ]);

  const bytecodeHash = ethers.utils.keccak256(code);

  const innerSalt = ethers.utils.keccak256(
    ethers.utils.solidityPack(
      ['uint256', 'address', 'uint256'],
      [chainId, passportAddress, tokenId]
    )
  );

  const finalSalt = ethers.utils.keccak256(
    ethers.utils.solidityPack(
      ['bytes32', 'bytes32'],
      [salt, innerSalt]
    )
  );

  return ethers.utils.getCreate2Address(
    registryAddress,
    finalSalt,
    bytecodeHash
  );
}
```

---

## 3. Integration with AIP-9

### 3.1 TBA Creation on Passport Mint

When an Agent Passport is minted (AIP-9), the TBA is **lazily created** on first badge claim:

```solidity
// In BadgeClaimer (AIP-10)
function claimBadge(address agent, uint256 badgeId) external {
    address tba = registry.account(
        implementation,
        bytes32(0),
        block.chainid,
        address(passportContract),
        passportContract.tokenIdFor(agent)
    );

    // Deploy TBA if not exists (counterfactual deployment)
    if (tba.code.length == 0) {
        registry.createAccount(
            implementation,
            bytes32(0),
            block.chainid,
            address(passportContract),
            passportContract.tokenIdFor(agent)
        );
    }

    // Mint badge to TBA (AIP-10 signature)
    badgeContract.mint(tba, badgeId, bytes32(0)); // easUID = 0 for non-EAS badges
}
```

### 3.2 TBA Ownership Follows Passport

Since TBA ownership is derived from passport ownership:

1. Alice owns Passport #123
2. TBA for #123 returns `owner() = Alice`
3. Alice sells Passport #123 to Bob
4. TBA for #123 now returns `owner() = Bob`
5. All badges in TBA are now Bob's

**No explicit transfer needed** - TBA ownership is computed, not stored.

---

## 4. Integration with AIP-10

### 4.1 Badge Minting to TBA

Badges (AIP-10) are minted directly to the agent's TBA:

```solidity
// BadgeClaimer mints to TBA, not to owner EOA (AIP-10 signature)
badgeContract.mint(
    agentTBA,    // TBA address
    badgeId,     // Badge type ID
    bytes32(0)   // EAS UID (0 for non-EAS badges)
);
```

### 4.2 Badge Display

When displaying agent badges:
1. Compute TBA address from passport tokenId
2. Query ERC-1155 balance of TBA
3. Display owned badges

```typescript
const tbaAddress = computeTBAAddress(...);
const badgeContract = new ethers.Contract(BADGE_ADDRESS, BADGE_ABI, provider);

const badgeIds = [1, 2, 3, 4, 5, 6]; // All badge types
const balances = await badgeContract.balanceOfBatch(
  badgeIds.map(() => tbaAddress),
  badgeIds
);
```

---

## 5. Invariants

### 5.1 Protocol Invariants

| ID | Invariant | Verification |
|----|-----------|--------------|
| INV-11.1 | TBA address is deterministic | Same inputs → same address |
| INV-11.2 | TBA owner = passport owner | Computed from passport ownership |
| INV-11.3 | Execute is disabled | Always reverts |
| INV-11.4 | Signing is disabled | Always returns invalid |
| INV-11.5 | TBA can receive any token | ERC-721/1155 receivers implemented |
| INV-11.6 | Badge ownership travels with passport | TBA content unchanged on transfer |

### 5.2 Security Invariants

| ID | Invariant | Threat Mitigated |
|----|-----------|------------------|
| SEC-11.1 | No execute() | Prevents malicious transactions |
| SEC-11.2 | No valid signatures | Prevents phishing attacks |
| SEC-11.3 | Read-only token query | No state manipulation |
| SEC-11.4 | Counterfactual address | No front-running on deployment |

---

## 6. Security Considerations

### 6.1 Why Passive Design is Safer

| Feature | Full TBA | Passive TBA |
|---------|----------|-------------|
| Execute arbitrary calls | Yes | No |
| Sign messages | Yes | No |
| Approve tokens | Yes | No |
| DeFi interactions | Yes | No |
| Attack surface | Large | Minimal |

### 6.2 Threat Mitigations

| Threat | Mitigation |
|--------|------------|
| Reentrancy via execute | execute() disabled |
| Signature phishing | isValidSignature returns invalid |
| Token approval drain | No approve functionality |
| Flash loan attacks | No DeFi interaction possible |
| Upgrade manipulation | Immutable implementation |

---

## 7. Gas Costs

| Operation | Estimated Gas | Notes |
|-----------|---------------|-------|
| Deploy TBA (first badge claim) | ~100,000 | One-time cost |
| Receive ERC-1155 | ~30,000 | Per badge |
| Compute TBA address | 0 | Off-chain |
| Query owner | ~3,000 | View function |

---

## 8. Implementation Checklist

| Phase | Task | Status |
|-------|------|--------|
| **Phase 1** | Deploy ERC6551Registry to Base Sepolia | Pending |
| **Phase 2** | Deploy AgentTBA implementation | Pending |
| **Phase 3** | Integrate with BadgeClaimer (AIP-10) | Pending |
| **Phase 4** | SDK: TBA address computation | Pending |
| **Phase 5** | Security audit | Pending |
| **Phase 6** | Mainnet deployment | Pending |

---

## 9. References

### AGIRAILS AIPs

- **AIP-9**: Agent Passport NFT (TBA is bound to passport)
- **AIP-10**: Reputation Badges (badges minted to TBA)

### External Standards

- **ERC-6551**: Token Bound Accounts
  - Specification: https://eips.ethereum.org/EIPS/eip-6551
  - Reference Implementation: https://github.com/erc6551/reference
- **ERC-721**: Non-Fungible Token Standard
- **ERC-1155**: Multi Token Standard
- **ERC-1271**: Standard Signature Validation Method

---

## 10. Changelog

- **2026-01-11**: Interface alignment (v0.1.1)
  - Fixed badge mint signature to match AIP-10: `mint(to, badgeId, easUID)`
  - Updated Section 3.1 and 4.1 examples

- **2026-01-11**: Initial draft (v0.1.0)
  - Passive TBA design specification
  - AgentTBA implementation (no execute, no sign)
  - Integration with AIP-9 and AIP-10

---

## 11. Copyright

Copyright 2026 AGIRAILS Inc.
Licensed under Apache-2.0.

This document and all AIP specifications are open-source and may be freely implemented by any party.

---

**END OF AIP-11**
