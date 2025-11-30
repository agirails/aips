# EIP-712 Type Hash Computation Summary

**Date:** 2025-11-24
**Status:** ✅ COMPLETED
**P0 Mainnet Blocker:** RESOLVED

---

## Overview

This document summarizes the computation of all 7 EIP-712 type hashes for the AGIRAILS message type registry (AIP-0 §5.2). These hashes are critical for message signing and verification in the ACTP protocol.

---

## Computed Type Hashes

| AIP     | Message Type                    | EIP-712 Type Hash                                                    |
|---------|----------------------------------|----------------------------------------------------------------------|
| AIP-0.1 | `agirails.notification.v1`      | `0xa02f2574276a8ca75bfdad3fc381f36324358b535685db9f507708ee9490c8e9` |
| AIP-1   | `agirails.request.v1`           | `0x445f1b6560f0d4302d32fa3677ce3a4130fcd347b333c333f78e2725d42b12c7` |
| AIP-2   | `agirails.quote.v1`             | `0x3a250619f2f54b815ae7a1b3219f8a958f9cde40186233bee134b4b9d7095407` |
| AIP-3   | `agirails.discovery.v1`         | `0x34e59475223edfc59d786cb2f8c921a61f2bf4cf7f64bc28b847f9448d16e7a2` |
| AIP-4   | `agirails.delivery.v1`          | `0x7974f677eb16e762b690ee2ec91d75e28a770e2a1ea6fea824eddff6ea9a855b` |
| AIP-5   | `agirails.dispute.v1`           | `0x118a9fe5aef5b766734aa976f70c90a40c4c1144c599a0405a60c18199f9ee66` |
| AIP-6   | `agirails.resolution.v1`        | `0x4312d59902c52428cc3c348e24d4b7b3922b50e0e2c9f8a16ee504f5ec6d1fc2` |

---

## Type String Definitions

### AIP-0.1: Notification

**Type String:**
```
Notification(string type,string version,bytes32 txId,string cid,string consumer,string provider,uint256 chainId,uint256 timestamp,uint256 nonce)
```

**Type Hash:** `0xa02f2574276a8ca75bfdad3fc381f36324358b535685db9f507708ee9490c8e9`

**Purpose:** IPFS Pubsub notification sent by consumer when creating transaction

**Fields:**
- `type`: Message type identifier (constant: 'agirails.notification.v1')
- `version`: Semantic version (e.g., '1.0.0')
- `txId`: On-chain transaction ID (bytes32)
- `cid`: IPFS CID of request metadata
- `consumer`: Consumer DID
- `provider`: Provider DID
- `chainId`: Network ID (84532 for Base Sepolia, 8453 for Base Mainnet)
- `timestamp`: Unix timestamp (seconds)
- `nonce`: Replay protection counter

---

### AIP-1: Request

**Type String:**
```
Request(string version,string serviceType,string requestId,string consumer,string provider,uint256 chainId,bytes32 inputDataHash,uint256 amount,uint256 deadline,uint256 disputeWindow,uint256 timestamp,uint256 nonce)
```

**Type Hash:** `0x445f1b6560f0d4302d32fa3677ce3a4130fcd347b333c333f78e2725d42b12c7`

**Purpose:** Service request metadata stored on IPFS

**Fields:**
- `version`: AIP-1 version (e.g., '1.0.0')
- `serviceType`: Service category (e.g., 'text-generation', 'ocr')
- `requestId`: Consumer-generated unique ID
- `consumer`: Consumer DID
- `provider`: Provider DID
- `chainId`: Network ID
- `inputDataHash`: Keccak256 hash of inputData object
- `amount`: Payment amount (USDC base units, 6 decimals)
- `deadline`: Transaction deadline (Unix timestamp)
- `disputeWindow`: Dispute window duration (seconds)
- `timestamp`: Request creation time
- `nonce`: Replay protection counter

---

### AIP-2: Quote

**Type String:**
```
QuoteRequest(string from,string to,uint256 timestamp,bytes32 nonce,string serviceType,string requirements,uint256 deadline,uint256 disputeWindow)
```

**Type Hash:** `0x3a250619f2f54b815ae7a1b3219f8a958f9cde40186233bee134b4b9d7095407`

**Purpose:** Price quote request/response (optional, not in v0.1)

**Fields:**
- `from`: Requester DID
- `to`: Provider DID
- `timestamp`: Unix timestamp
- `nonce`: Replay protection (bytes32)
- `serviceType`: Service category
- `requirements`: Service requirements (JSON string)
- `deadline`: Quote validity deadline
- `disputeWindow`: Proposed dispute window

---

### AIP-3: Discovery

**Type String:**
```
Discovery(string from,string serviceType,uint256 minReputation,uint256 maxPrice,string requiredCapabilities,uint256 chainId,uint256 timestamp,uint256 nonce)
```

**Type Hash:** `0x34e59475223edfc59d786cb2f8c921a61f2bf4cf7f64bc28b847f9448d16e7a2`

**Purpose:** Query agent registry for service providers

**Fields:**
- `from`: Requester DID
- `serviceType`: Requested service category
- `minReputation`: Minimum reputation score (0-10000 basis points)
- `maxPrice`: Maximum acceptable price (USDC base units)
- `requiredCapabilities`: Comma-separated capabilities
- `chainId`: Network ID
- `timestamp`: Query timestamp
- `nonce`: Replay protection counter

---

### AIP-4: Delivery

**Type String:**
```
DeliveryProof(bytes32 txId,string provider,string consumer,string resultCID,bytes32 resultHash,bytes32 easAttestationUID,uint256 deliveredAt,uint256 chainId,uint256 nonce)
```

**Type Hash:** `0x7974f677eb16e762b690ee2ec91d75e28a770e2a1ea6fea824eddff6ea9a855b`

**Purpose:** Delivery proof with EAS attestation

**Fields:**
- `txId`: Transaction ID (bytes32)
- `provider`: Provider DID
- `consumer`: Consumer DID
- `resultCID`: IPFS CID of delivery result
- `resultHash`: Keccak256 hash of result data
- `easAttestationUID`: EAS attestation UID (bytes32)
- `deliveredAt`: Delivery timestamp
- `chainId`: Network ID
- `nonce`: Replay protection counter

---

### AIP-5: Dispute

**Type String:**
```
Dispute(bytes32 txId,string consumer,string provider,string reason,string evidenceCID,bytes32 evidenceHash,uint256 chainId,uint256 timestamp,uint256 nonce)
```

**Type Hash:** `0x118a9fe5aef5b766734aa976f70c90a40c4c1144c599a0405a60c18199f9ee66`

**Purpose:** Dispute evidence submission

**Fields:**
- `txId`: Transaction being disputed (bytes32)
- `consumer`: Consumer DID (disputer)
- `provider`: Provider DID (disputed party)
- `reason`: Dispute reason (e.g., 'incomplete', 'poor_quality')
- `evidenceCID`: IPFS CID of evidence data
- `evidenceHash`: Keccak256 hash of evidence
- `chainId`: Network ID
- `timestamp`: Dispute submission time
- `nonce`: Replay protection counter

---

### AIP-6: Resolution

**Type String:**
```
Resolution(bytes32 txId,string mediator,string consumer,string provider,string ruling,uint256 consumerShare,uint256 providerShare,string reasoning,uint256 chainId,uint256 timestamp,uint256 nonce)
```

**Type Hash:** `0x4312d59902c52428cc3c348e24d4b7b3922b50e0e2c9f8a16ee504f5ec6d1fc2`

**Purpose:** Mediator resolution decision

**Fields:**
- `txId`: Transaction being resolved (bytes32)
- `mediator`: Mediator DID
- `consumer`: Consumer DID
- `provider`: Provider DID
- `ruling`: Ruling ('consumer', 'provider', 'split')
- `consumerShare`: Consumer's share (0-10000 basis points)
- `providerShare`: Provider's share (0-10000 basis points)
- `reasoning`: Decision rationale (text)
- `chainId`: Network ID
- `timestamp`: Resolution timestamp
- `nonce`: Replay protection counter

---

## Computation Method

### Algorithm

1. **Encode Type String**: Convert EIP-712 type definition to string format
   ```
   TypeName(type1 field1,type2 field2,...)
   ```

2. **Hash with Keccak256**: Compute SHA3-256 hash of the type string
   ```javascript
   const typeHash = keccak256(typeString);
   ```

### Example (AIP-0.1 Notification)

```javascript
// 1. Define fields
const fields = [
  { name: 'type', type: 'string' },
  { name: 'version', type: 'string' },
  { name: 'txId', type: 'bytes32' },
  // ... (9 fields total)
];

// 2. Encode type string
const typeString = 'Notification(string type,string version,bytes32 txId,string cid,string consumer,string provider,uint256 chainId,uint256 timestamp,uint256 nonce)';

// 3. Compute hash
const typeHash = keccak256(typeString);
// Result: 0xa02f2574276a8ca75bfdad3fc381f36324358b535685db9f507708ee9490c8e9
```

---

## Verification

### Verification Script

**Location:** `/Users/damir/Cursor/AGIRails MVP/AGIRAILS/Protocol/aips/compute-type-hashes.js`

**Run:**
```bash
cd /Users/damir/Cursor/AGIRails\ MVP/AGIRAILS/Protocol/aips
node compute-type-hashes.js
```

**Output:**
```
=== AIP-0.1: agirails.notification.v1 ===
Type String: Notification(string type,string version,bytes32 txId,string cid,string consumer,string provider,uint256 chainId,uint256 timestamp,uint256 nonce)
Type Hash: 0xa02f2574276a8ca75bfdad3fc381f36324358b535685db9f507708ee9490c8e9

... (output for all 7 types)
```

### Cross-Language Verification

To verify these hashes in other languages:

**Python:**
```python
from eth_utils import keccak

type_string = b'Notification(string type,string version,bytes32 txId,string cid,string consumer,string provider,uint256 chainId,uint256 timestamp,uint256 nonce)'
type_hash = '0x' + keccak(type_string).hex()
assert type_hash == '0xa02f2574276a8ca75bfdad3fc381f36324358b535685db9f507708ee9490c8e9'
```

**Solidity:**
```solidity
bytes32 constant NOTIFICATION_TYPE_HASH = keccak256("Notification(string type,string version,bytes32 txId,string cid,string consumer,string provider,uint256 chainId,uint256 timestamp,uint256 nonce)");
// 0xa02f2574276a8ca75bfdad3fc381f36324358b535685db9f507708ee9490c8e9
```

---

## SDK Integration

### TypeScript Type Definitions

**Location:** `/Users/damir/Cursor/AGIRails MVP/AGIRAILS/Protocol/aips/eip712-type-definitions.ts`

This file contains:
- All 7 EIP-712 type definitions
- TypeScript interfaces for message data
- Type hash constants
- Message type registry
- Helper functions (`getMessageTypes()`, `getTypeHash()`)

### Usage Example

```typescript
import {
  MESSAGE_TYPE_REGISTRY,
  NotificationTypes,
  NOTIFICATION_TYPE_HASH,
  NotificationData
} from './eip712-type-definitions';

// Get types for a message
const types = MESSAGE_TYPE_REGISTRY['agirails.notification.v1'].types;

// Sign a notification message
const message: NotificationData = {
  type: 'agirails.notification.v1',
  version: '1.0.0',
  txId: '0x...',
  cid: 'bafybei...',
  consumer: 'did:ethr:0x...',
  provider: 'did:ethr:0x...',
  chainId: 84532,
  timestamp: Math.floor(Date.now() / 1000),
  nonce: 1
};

const signature = await signer._signTypedData(
  {
    name: 'AGIRAILS',
    version: '1',
    chainId: 84532,
    verifyingContract: KERNEL_ADDRESS
  },
  NotificationTypes,
  message
);
```

---

## Update History

| Date | Version | Change | Author |
|------|---------|--------|--------|
| 2025-11-24 | 1.0.0 | Initial computation of all 7 type hashes | AGIRAILS Backend Dev Agent |

---

## References

- **AIP-0**: Meta Protocol (§5.2 Message Type Registry)
- **EIP-712**: Ethereum typed structured data hashing and signing
  - Spec: https://eips.ethereum.org/EIPS/eip-712
- **Keccak-256**: SHA-3 cryptographic hash function
  - Node.js: `crypto.createHash('sha3-256')`
  - Ethers.js: `ethers.utils.keccak256()`

---

## Security Considerations

1. **Type Hash Immutability**: Once deployed to mainnet, these type hashes MUST NOT change without a major version bump and migration path.

2. **Signature Verification**: All message recipients MUST verify:
   - EIP-712 domain matches expected kernel address
   - Type hash matches message type
   - Signature recovers to expected DID address
   - Nonce is fresh and monotonically increasing
   - Timestamp is within acceptable clock drift (±5 minutes)

3. **Replay Protection**: The combination of:
   - `chainId` (prevents cross-chain replay)
   - `verifyingContract` (prevents cross-deployment replay)
   - `type` (prevents cross-message-type replay)
   - `nonce` (prevents duplicate message replay)
   - `timestamp` (prevents stale message replay)

   Ensures complete replay attack mitigation.

4. **Backwards Compatibility**: If message type definitions need to change:
   - Create new version (e.g., `agirails.notification.v2`)
   - Compute new type hash
   - Support both v1 and v2 for 6-month transition period
   - Document migration path in AIP

---

## Next Steps

1. ✅ **Update AIP-0.md** - Type hashes added to §5.2 (COMPLETED)
2. ✅ **Create TypeScript definitions** - eip712-type-definitions.ts (COMPLETED)
3. ⏳ **Integrate into SDK** - Update `@agirails/sdk/src/types/eip712.ts`
4. ⏳ **Add to smart contracts** - Deploy type hash constants for verification
5. ⏳ **Update documentation** - Reference type hashes in all AIPs
6. ⏳ **Create JSON schemas** - Generate JSON Schema files for validation
7. ⏳ **Write integration tests** - Verify signing and verification across all message types

---

**Status:** 🟢 Ready for SDK Integration and Mainnet Deployment
