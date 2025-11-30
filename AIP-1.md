# AIP-1: Service Request Metadata Specification

**Status:** Implemented
**Author:** AGIRAILS Core Team
**Created:** 2025-11-16
**Updated:** 2025-11-24
**Depends On:** AIP-0 (Meta Protocol)
**Related:** AIP-7 (Agent Identity, Registry & Storage - defines permanent Arweave archive for request metadata)

---

## Implementation Status

**Deployment Date:** 2025-01-22
**Network:** Base Sepolia (testnet)
**Status:** Implemented - serviceHash storage operational

**Contract Integration:**
- `ACTPKernel.createTransaction()`: Lines 136-175
- `serviceHash` field: Stores keccak256 hash of request metadata
- Validation: Amount, deadline, dispute window checks enforced

**SDK Implementation:**
- `ProofGenerator`: Canonical JSON hashing (AIP-1 §3)
- `MessageSigner`: EIP-712 signing (AIP-1 §3.3)
- Validation utilities: validateAddress(), validateAmount()

**Known Gap:** RequestBuilder convenience class NOT implemented (line 905 note)
**Workaround:** Manual JSON construction with validation utilities

**Implementation Score:** 95/100 (Technical Audit 2025-11-24)

---

## Abstract

This document defines the **Service Request Metadata** format for AGIRAILS transactions. AIP-1 specifies the structure, validation rules, and hashing mechanism for request payloads that consumers upload to IPFS and reference on-chain via the `serviceHash` field.

AIP-1 is a **critical dependency** for consumer node implementations, as it defines the canonical format for describing:
- What service is being requested
- Input data and parameters
- Delivery requirements and constraints
- Payment terms and deadlines

The request metadata is **content-addressed** (stored on IPFS), **cryptographically verifiable** (hashed on-chain), and **machine-readable** (JSON Schema validated), enabling autonomous AI agents to discover, parse, and fulfill service requests without human intervention.

---

## 1. Overview

### 1.1 Purpose

AIP-1 serves multiple functions in the AGIRAILS protocol:

1. **Service Discovery**: Providers can filter and match requests based on `serviceType` and capabilities
2. **Trustless Verification**: On-chain `serviceHash` ensures metadata integrity (cannot be modified after transaction creation)
3. **Autonomous Execution**: Machine-readable format allows AI agents to parse and execute requests programmatically
4. **Dispute Resolution**: Immutable IPFS storage provides evidence of original request terms
5. **Interoperability**: Standardized schema enables cross-platform compatibility (n8n, Zapier, custom agents)

### 1.2 Lifecycle Position

AIP-1 request metadata is created at the **INITIATED** state of the transaction lifecycle:

```
Consumer Agent:
1. Constructs AIP-1 request metadata (JSON)
2. Validates against JSON Schema
3. Uploads to IPFS → obtains CID
4. Hashes metadata (canonical JSON) → obtains serviceHash
5. Calls ACTPKernel.createTransaction(serviceHash, ...)
6. Sends AIP-0.1 notification to provider with CID

Provider Agent:
7. Receives notification via IPFS Pubsub
8. Downloads metadata from IPFS using CID
9. Validates metadata against JSON Schema
10. Recomputes hash and compares to on-chain serviceHash
11. Decides whether to accept (transitionState to ACCEPTED)
```

### 1.3 Design Principles

- **Immutable After Creation**: Request metadata cannot be modified after `createTransaction()` is called
- **Content-Addressed Storage**: IPFS CID provides location-independent, tamper-proof storage
- **Deterministic Hashing**: Canonical JSON ensures identical hash across all implementations
- **Machine-First**: Optimized for agent parsing, not human readability
- **Extensible**: Custom fields allowed via `metadata` object for domain-specific requirements

---

## 2. Request Metadata Format

### 2.1 Core Schema

```json
{
  "version": "1.0.0",
  "serviceType": "text-generation",
  "requestId": "req_2024_11_16_abc123xyz",
  "consumer": "did:ethr:84532:0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "provider": "did:ethr:84532:0x8f4e7d2a9c1b5e3f6a8d2c4e1f7b9a3d5c8e2f6a",
  "chainId": 84532,
  "inputData": {
    "prompt": "Summarize the latest AI research papers on agent architectures",
    "maxTokens": 1000,
    "temperature": 0.7,
    "model": "gpt-4"
  },
  "deliveryRequirements": {
    "format": "json",
    "schema": "https://schema.agirails.io/text-generation-v1.json",
    "minQuality": 0.8,
    "maxLatency": 300
  },
  "paymentTerms": {
    "amount": "5000000",
    "currency": "USDC",
    "decimals": 6,
    "maxPrice": "10000000",
    "deadline": 1732000000,
    "disputeWindow": 7200
  },
  "metadata": {
    "priority": "high",
    "callbackUrl": "https://consumer.example.com/webhooks/delivery",
    "tags": ["research", "ai", "summarization"]
  },
  "timestamp": 1731700000
}
```

### 2.2 Field Definitions

#### 2.2.1 Required Fields

| Field | Type | Description | Validation |
|-------|------|-------------|------------|
| `version` | string | AIP-1 version (semver) | Pattern: `^\d+\.\d+\.\d+$` |
| `serviceType` | string | Service category identifier | Pattern: `^[a-z0-9-]+$`, max 64 chars |
| `requestId` | string | Consumer-generated unique ID | Pattern: `^[a-zA-Z0-9_-]{8,128}$` |
| `consumer` | string | Consumer DID | Valid `did:ethr:` format |
| `provider` | string | Provider DID | Valid `did:ethr:` format |
| `chainId` | integer | Blockchain network ID | Enum: [84532, 8453] |
| `inputData` | object | Service-specific parameters | Non-empty object |
| `paymentTerms` | object | Transaction payment details | See §2.2.3 |
| `timestamp` | integer | Request creation time (Unix seconds) | Must be ≤ current time + 300s |

#### 2.2.2 Optional Fields

| Field | Type | Description | Default |
|-------|------|-------------|---------|
| `deliveryRequirements` | object | Output format and quality constraints | `{}` |
| `metadata` | object | Custom consumer-defined fields | `{}` |

#### 2.2.3 Nested Object: `paymentTerms`

| Field | Type | Description | Validation |
|-------|------|-------------|------------|
| `amount` | string | Payment amount (base units) | Uint256 as string (JS safe integer limit) |
| `currency` | string | Payment token symbol | Currently: `"USDC"` only |
| `decimals` | integer | Token decimal places | For USDC: `6` |
| `maxPrice` | string | Maximum acceptable price | ≥ `amount` (base units) |
| `deadline` | integer | Transaction expiry (Unix seconds) | Must be > `timestamp` + 3600 |
| `disputeWindow` | integer | Dispute period (seconds) | Range: 3600-2592000 (1h-30d) |

**Notes:**
- `amount` is the **offered price** by the consumer
- `maxPrice` allows for quote negotiation (AIP-2) - provider can quote up to this amount
- If `maxPrice` is omitted, provider cannot negotiate (must accept `amount` as-is)
- All amounts are in **base units** (smallest token denomination: for USDC with 6 decimals, 1 USDC = 10^6 base units = 1,000,000)
- Use string type to avoid JavaScript `Number.MAX_SAFE_INTEGER` overflow (2^53-1)

#### 2.2.4 Nested Object: `deliveryRequirements` (Optional)

| Field | Type | Description | Default (if omitted) |
|-------|------|-------------|----------------------|
| `format` | string | Output format (`json`, `text`, `binary`, `url`) | `"json"` |
| `schema` | string | JSON Schema URL for output validation | (omit field) |
| `minQuality` | number | Minimum quality score (0.0-1.0) | `0.0` |
| `maxLatency` | integer | Maximum response time (seconds) | (omit field) |
| `encryption` | object | Encryption requirements (see §2.2.5) | (omit field) |

**Important**: Optional fields (`schema`, `maxLatency`, `encryption`) MUST be **omitted entirely** when not needed, NOT set to `null`. The JSON Schema validator will reject `null` values for these fields.

#### 2.2.5 Nested Object: `deliveryRequirements.encryption` (Optional)

| Field | Type | Description |
|-------|------|-------------|
| `required` | boolean | Whether encryption is mandatory |
| `algorithm` | string | Encryption algorithm (`aes-256-gcm`, `chacha20-poly1305`) |
| `publicKey` | string | Consumer's public key (hex) |

**Example:**
```json
"encryption": {
  "required": true,
  "algorithm": "aes-256-gcm",
  "publicKey": "0x04a1b2c3..."
}
```

### 2.3 Service Types

The `serviceType` field categorizes requests for provider matching. Standard service types:

| Service Type | Description | Example Input |
|--------------|-------------|---------------|
| `text-generation` | Generate text from prompt | `{ "prompt": "...", "maxTokens": 1000 }` |
| `image-generation` | Generate images from text | `{ "prompt": "...", "size": "1024x1024" }` |
| `code-generation` | Generate code from spec | `{ "language": "python", "task": "..." }` |
| `data-analysis` | Analyze structured data | `{ "dataset": "url", "query": "..." }` |
| `web-scraping` | Extract data from websites | `{ "url": "...", "selectors": [...] }` |
| `api-integration` | Call external APIs | `{ "endpoint": "...", "method": "POST" }` |
| `file-conversion` | Convert file formats | `{ "inputUrl": "...", "outputFormat": "pdf" }` |
| `translation` | Translate text | `{ "text": "...", "targetLang": "es" }` |
| `sentiment-analysis` | Analyze text sentiment | `{ "text": "...", "model": "bert" }` |
| `custom` | Domain-specific service | Provider-defined schema |

**Custom Service Types:**
- MUST use lowercase kebab-case (e.g., `legal-contract-review`)
- SHOULD be registered in AGIRAILS Service Registry (future AIP)
- MAY define custom JSON Schema for `inputData` validation

---

## 3. Canonical JSON Hashing

### 3.1 Hashing Algorithm

To ensure **deterministic serviceHash** across all implementations, request metadata MUST be hashed using:

1. **Canonical JSON Serialization** (see AIP-0 §3.2)
2. **UTF-8 Encoding**
3. **Keccak256 Hashing**

**Implementation:**
```typescript
import { toUtf8Bytes, keccak256 } from 'ethers';

function hashRequestMetadata(metadata: AIP1Request): string {
  const canonical = canonicalJsonStringify(metadata);
  const bytes = toUtf8Bytes(canonical);
  return keccak256(bytes); // Returns 0x prefixed bytes32 hex string
}
```

### 3.2 Canonical JSON Rules (Reference)

See AIP-0 §3.2 for complete specification. Summary:

1. **Alphabetic key sorting** (recursive)
2. **No whitespace** (compact representation)
3. **Consistent number formatting** (integers: no decimals, floats: max 18 decimals)
4. **UTF-8 encoding** (NFC normalization)
5. **Minimal escaping** (no unnecessary `\uXXXX` sequences)

**Example:**
```typescript
// Input (with whitespace and unsorted keys)
{
  "provider": "did:ethr:0xProvider",
  "consumer": "did:ethr:0xConsumer",
  "inputData": { "b": 2, "a": 1 }
}

// Canonical output (sorted, no whitespace)
{"consumer":"did:ethr:0xConsumer","inputData":{"a":1,"b":2},"provider":"did:ethr:0xProvider"}

// Keccak256 hash (bytes32)
0x8f4b7e8c9d2a3f5e6b1c8d7a4e9f2b5c3a6d8e1f7c4b9a2d5e8f1c3a6b9d2e5f
```

### 3.3 EIP-712 Nested Structure Hashing

**IMPORTANT**: When signing AIP-1 metadata with EIP-712 (for off-chain verification), nested objects MUST be hashed separately to maintain compatibility across implementations.

#### 3.3.1 Encoding Algorithm

The EIP-712 `ServiceRequest` type contains hash fields for nested structures:

```typescript
struct ServiceRequest {
  string version;
  string serviceType;
  string requestId;
  string consumer;
  string provider;
  uint256 chainId;
  bytes32 inputDataHash;          // Hash of inputData object
  bytes32 paymentTermsHash;        // Hash of paymentTerms object
  bytes32 deliveryRequirementsHash; // Hash of deliveryRequirements object
  bytes32 metadataHash;            // Hash of metadata object
  uint256 timestamp;
}
```

**Hashing Rules**:

1. **`inputDataHash`**:
   ```typescript
   inputDataHash = keccak256(toUtf8Bytes(canonicalJsonStringify(inputData)))
   ```
   - Use canonical JSON (§3.2 rules)
   - Always present (inputData is required)

2. **`paymentTermsHash`**:
   ```typescript
   const paymentTermsType = {
     PaymentTerms: [
       { name: 'amount', type: 'string' },
       { name: 'currency', type: 'string' },
       { name: 'decimals', type: 'uint8' },
       { name: 'maxPrice', type: 'string' },
       { name: 'deadline', type: 'uint256' },
       { name: 'disputeWindow', type: 'uint256' }
     ]
   };
   paymentTermsHash = keccak256(encodeData('PaymentTerms', paymentTerms, paymentTermsType))
   ```
   - Use EIP-712 typed struct encoding
   - If `maxPrice` is omitted, use empty string `""`
   - Always present (paymentTerms is required)

3. **`deliveryRequirementsHash`**:
   ```typescript
   const deliveryRequirementsType = {
     DeliveryRequirements: [
       { name: 'format', type: 'string' },
       { name: 'schema', type: 'string' },
       { name: 'minQuality', type: 'uint256' },
       { name: 'maxLatency', type: 'uint256' },
       { name: 'encryptionRequired', type: 'bool' },
       { name: 'encryptionAlgorithm', type: 'string' },
       { name: 'encryptionPublicKey', type: 'string' }
     ]
   };

   if (deliveryRequirements) {
     // Convert float minQuality to fixed-point uint256 (with fallback to 0.0)
     const minQualityScaled = Math.floor((deliveryRequirements.minQuality || 0.0) * 1e18);

     // Flatten encryption object
     const flatDeliveryReqs = {
       format: deliveryRequirements.format || 'json',
       schema: deliveryRequirements.schema || '',
       minQuality: minQualityScaled,
       maxLatency: deliveryRequirements.maxLatency || 0,
       encryptionRequired: deliveryRequirements.encryption?.required || false,
       encryptionAlgorithm: deliveryRequirements.encryption?.algorithm || '',
       encryptionPublicKey: deliveryRequirements.encryption?.publicKey || ''
     };

     deliveryRequirementsHash = keccak256(encodeData('DeliveryRequirements', flatDeliveryReqs, deliveryRequirementsType))
   } else {
     deliveryRequirementsHash = '0x0000000000000000000000000000000000000000000000000000000000000000';
   }
   ```
   - **minQuality Encoding**: Multiply float by `1e18` (18 decimals fixed-point). If omitted, use `0.0` as default.
     - Example: `0.85` → `850000000000000000`
     - Example: `0.0` (or omitted) → `0`
     - **IMPORTANT**: Always apply fallback `|| 0.0` before multiplication to avoid NaN
   - **Encryption Encoding**: Flatten nested object into three fields
     - If `encryption` omitted: `encryptionRequired=false`, `encryptionAlgorithm=''`, `encryptionPublicKey=''`
   - **Optional Fields**: Use default values (empty string or 0) if omitted
   - **If entire object omitted**: Use `bytes32(0)` (zero hash)

4. **`metadataHash`**:
   ```typescript
   if (metadata && Object.keys(metadata).length > 0) {
     metadataHash = keccak256(toUtf8Bytes(canonicalJsonStringify(metadata)))
   } else {
     metadataHash = '0x0000000000000000000000000000000000000000000000000000000000000000';
   }
   ```
   - Use canonical JSON (§3.2 rules)
   - If `metadata` omitted or empty: Use `bytes32(0)`

#### 3.3.2 Complete Example

```typescript
import { _TypedDataEncoder } from 'ethers';

function computeEIP712Hash(metadata: AIP1Request, domain: EIP712Domain): string {
  // Compute nested hashes
  const inputDataHash = keccak256(toUtf8Bytes(canonicalJsonStringify(metadata.inputData)));

  const paymentTermsHash = keccak256(_TypedDataEncoder.encodeData(
    'PaymentTerms',
    {
      amount: metadata.paymentTerms.amount,
      currency: metadata.paymentTerms.currency,
      decimals: metadata.paymentTerms.decimals,
      maxPrice: metadata.paymentTerms.maxPrice || '',
      deadline: metadata.paymentTerms.deadline,
      disputeWindow: metadata.paymentTerms.disputeWindow
    },
    { PaymentTerms: PaymentTermsType }
  ));

  const deliveryRequirementsHash = metadata.deliveryRequirements
    ? keccak256(_TypedDataEncoder.encodeData(
        'DeliveryRequirements',
        {
          format: metadata.deliveryRequirements.format || 'json',
          schema: metadata.deliveryRequirements.schema || '',
          minQuality: Math.floor((metadata.deliveryRequirements.minQuality || 0.0) * 1e18),
          maxLatency: metadata.deliveryRequirements.maxLatency || 0,
          encryptionRequired: metadata.deliveryRequirements.encryption?.required || false,
          encryptionAlgorithm: metadata.deliveryRequirements.encryption?.algorithm || '',
          encryptionPublicKey: metadata.deliveryRequirements.encryption?.publicKey || ''
        },
        { DeliveryRequirements: DeliveryRequirementsType }
      ))
    : '0x0000000000000000000000000000000000000000000000000000000000000000';

  const metadataHash = metadata.metadata && Object.keys(metadata.metadata).length > 0
    ? keccak256(toUtf8Bytes(canonicalJsonStringify(metadata.metadata)))
    : '0x0000000000000000000000000000000000000000000000000000000000000000';

  // Sign the root ServiceRequest struct
  const message = {
    version: metadata.version,
    serviceType: metadata.serviceType,
    requestId: metadata.requestId,
    consumer: metadata.consumer,
    provider: metadata.provider,
    chainId: metadata.chainId,
    inputDataHash,
    paymentTermsHash,
    deliveryRequirementsHash,
    metadataHash,
    timestamp: metadata.timestamp
  };

  return _TypedDataEncoder.hash(domain, { ServiceRequest: ServiceRequestType }, message);
}
```

**CRITICAL**: All implementations MUST use this exact encoding to ensure signature compatibility.

### 3.4 Hash Verification

**Provider Verification Flow:**

1. Download metadata from IPFS using CID (from AIP-0.1 notification)
2. Parse JSON and validate against AIP-1 JSON Schema
3. Compute `serviceHash = hashRequestMetadata(metadata)`
4. Query on-chain: `tx = ACTPKernel.getTransaction(txId)`
5. Compare: `assert(serviceHash === tx.serviceHash)`
6. If match: metadata is authentic (consumer cannot have modified it)
7. If mismatch: **reject transaction** (potential attack or data corruption)

**Security Properties:**
- **Immutability**: Consumer cannot modify request after on-chain commitment
- **Non-repudiation**: Consumer cannot claim different terms were agreed
- **Integrity**: IPFS content addressing + on-chain hash provides dual verification

---

## 4. IPFS Storage Requirements

### 4.1 Upload Process

**Consumer Obligations:**

1. **Immediate Upload**: MUST upload metadata to IPFS within 60 seconds of `createTransaction()`
2. **Pinning Duration**: MUST pin for `disputeWindow + 7 days` minimum
3. **CID Format**: MUST use CIDv1 (base32 encoding) for pubsub compatibility
4. **IPFS Node**: RECOMMENDED to use pinning service (Pinata, Web3.Storage, Filebase)

**Example (using IPFS HTTP API):**
```typescript
import { create as createIPFS } from 'ipfs-http-client';

const ipfs = createIPFS({ url: 'https://ipfs.infura.io:5001' });
const { cid } = await ipfs.add(JSON.stringify(metadata));
console.log('CID:', cid.toString()); // bafybeig...
```

### 4.2 Provider Download

**Provider Obligations:**

1. **Timely Retrieval**: MUST download within 1 hour of notification
2. **Re-Pinning**: SHOULD re-pin locally to prevent consumer unpinning attack
3. **Timeout Handling**: MUST timeout download after 60 seconds
4. **Gateway Fallback**: MAY use public IPFS gateways if direct IPFS node unavailable

**Example (with timeout and validation):**
```typescript
async function fetchAndValidateMetadata(cid: string, txId: string): Promise<AIP1Request> {
  // Download with timeout
  const response = await fetch(`https://ipfs.io/ipfs/${cid}`, {
    signal: AbortSignal.timeout(60000)
  });
  const metadata = await response.json();

  // Validate against JSON Schema
  const valid = ajv.validate(AIP1_SCHEMA, metadata);
  if (!valid) throw new Error('Invalid AIP-1 schema');

  // Verify hash against on-chain serviceHash
  const computedHash = hashRequestMetadata(metadata);
  const tx = await kernel.getTransaction(txId);
  if (computedHash !== tx.serviceHash) {
    throw new Error('Hash mismatch - potential attack');
  }

  return metadata;
}
```

### 4.3 Pinning Service Recommendations

| Service | Cost | Reliability | SDK Support |
|---------|------|-------------|-------------|
| **Pinata** | Free tier: 1GB | High | ✅ Node.js, Python |
| **Web3.Storage** | Free: Unlimited | Medium | ✅ Node.js, Browser |
| **Filebase** | Free tier: 5GB | High | ✅ S3-compatible API |
| **Infura IPFS** | Free tier: 5GB | Very High | ✅ Node.js |

**Production Recommendation**: Use **Pinata** or **Filebase** with automatic re-pinning.

---

## 5. Validation Rules

### 5.1 Schema Validation

All AIP-1 metadata MUST validate against the JSON Schema defined in `/Testnet/docs/schemas/aip-1-request.schema.json`.

**Validation Library:**
```typescript
import Ajv from 'ajv';
import AIP1_SCHEMA from './schemas/aip-1-request.schema.json';

const ajv = new Ajv({ strict: true, allErrors: true });
const validate = ajv.compile(AIP1_SCHEMA);

if (!validate(metadata)) {
  console.error('Validation errors:', validate.errors);
  throw new Error('Invalid AIP-1 metadata');
}
```

### 5.2 Business Logic Validation

Beyond JSON Schema, implementations MUST enforce:

1. **Temporal Consistency:**
   - `timestamp ≥ current_time - 300` (allow 5-minute clock skew in the past)
   - `timestamp ≤ current_time + 300` (allow 5-minute clock drift in the future)
   - `deadline ≥ current_time + 3600` (deadline must be at least 1 hour in the future)
   - `deadline > timestamp + 3600` (deadline must be at least 1 hour after timestamp)
   - `deadline ≤ timestamp + 2592000` (maximum 30-day deadline from timestamp)

2. **Economic Validation:**
   - `amount ≥ 50000` (USDC base units with 6 decimals) → $0.05 minimum transaction
   - `maxPrice ≥ amount` (if specified)
   - `maxPrice ≤ amount * 10` (prevent absurd quotes)

3. **Identity Validation:**
   - `consumer` DID MUST match on-chain `tx.requester` address
   - `provider` DID MUST match on-chain `tx.provider` address
   - `chainId` MUST match EIP-712 domain separator

4. **Input Data Validation:**
   - `inputData` MUST be non-empty object
   - For standard service types, validate against service-specific schema
   - Reject if `inputData` size > 1MB (prevent DoS via large IPFS uploads)

### 5.3 Security Validation

Implementations MUST reject metadata containing:

1. **Malicious URLs:**
   - `file://`, `ftp://` protocols are forbidden
   - Only `https://`, `ipfs://`, and `ipns://` protocols are allowed
   - Local network addresses (`127.0.0.1`, `192.168.*`, `10.*`) are forbidden

2. **Code Injection Attempts:**
   - JavaScript `<script>` tags in string fields
   - SQL injection patterns (`'; DROP TABLE`)

3. **Excessive Nesting:**
   - `inputData` depth > 10 levels (prevent stack overflow)

**Example Security Check:**
```typescript
function validateSecurityConstraints(metadata: AIP1Request): void {
  // Check for suspicious URLs
  const allowedProtocols = ['https:', 'ipfs:', 'ipns:'];
  const urlPattern = /(https?|ipfs|ipns):\/\/[^\s]+/g;
  const jsonStr = JSON.stringify(metadata);
  const urls = jsonStr.match(urlPattern) || [];

  for (const url of urls) {
    const parsed = new URL(url);

    // Check protocol is allowed
    if (!allowedProtocols.includes(parsed.protocol)) {
      throw new Error(`Protocol ${parsed.protocol} not allowed. Only https://, ipfs://, ipns:// permitted`);
    }

    // For https URLs, check for local network addresses
    if (parsed.protocol === 'https:' && (
        parsed.hostname === 'localhost' ||
        parsed.hostname.startsWith('192.168.') ||
        parsed.hostname.startsWith('10.'))) {
      throw new Error('Local network URLs not allowed');
    }
  }

  // Check for code injection
  if (jsonStr.includes('<script>') || jsonStr.includes('DROP TABLE')) {
    throw new Error('Potential code injection detected');
  }

  // Check nesting depth
  const depth = getMaxDepth(metadata.inputData);
  if (depth > 10) throw new Error('Input data too deeply nested');
}
```

---

## 6. SDK Implementation

### 6.1 Manual Request Construction

**⚠️ STATUS:** RequestBuilder is NOT yet implemented. Construct request metadata manually using the JSON schema.

**Current Approach** - Manual JSON construction with validation utilities:

```typescript
import {
  validateAddress,
  validateAmount,
  validateDeadline,
  validateDisputeWindow,
  IPFSClient,
  canonicalJsonStringify,
  computeCanonicalHash
} from '@agirails/sdk';
import { parseUnits } from 'ethers/lib/utils';

// Step 1: Construct request metadata manually following AIP-1 schema
const requestMetadata = {
  version: '1.0.0',
  timestamp: Math.floor(Date.now() / 1000),
  consumer: 'did:ethr:84532:0xConsumerAddress',
  provider: 'did:ethr:84532:0xProviderAddress',
  serviceType: 'text-generation',
  inputData: {
    prompt: 'Explain quantum computing',
    maxTokens: 500,
    temperature: 0.7
  },
  paymentTerms: {
    amount: '1000000', // 1 USDC (6 decimals)
    currency: 'USDC',
    decimals: 6,
    deadline: Math.floor(Date.now() / 1000) + 86400, // 24h
    disputeWindow: 7200 // 2h (in seconds)
  },
  deliveryRequirements: {
    format: 'json',
    maxSize: 1048576, // 1 MB
    encryption: false
  }
};

// Step 2: Validate using existing SDK utilities
validateAddress(requestMetadata.consumer.split(':').pop()!, 'consumer');
validateAddress(requestMetadata.provider.split(':').pop()!, 'provider');
validateAmount(parseUnits(requestMetadata.paymentTerms.amount, 6), 'amount');
validateDeadline(requestMetadata.paymentTerms.deadline, 'deadline');
validateDisputeWindow(requestMetadata.paymentTerms.disputeWindow, 'disputeWindow');

// Step 3: Compute canonical hash for integrity
const canonicalJson = canonicalJsonStringify(requestMetadata);
const metadataHash = computeCanonicalHash(requestMetadata);

// Step 4: Upload to IPFS
const ipfs = await IPFSClient.create({
  host: 'ipfs.infura.io',
  port: 5001,
  protocol: 'https'
});
const cid = await ipfs.add(canonicalJson);

console.log('Request CID:', cid);
console.log('Request Hash:', metadataHash);
```

### 6.2 Future: RequestBuilder Class (Planned)

The SDK will provide a `RequestBuilder` class in a future release to simplify this process:

```typescript
// PLANNED (not yet implemented)
import { RequestBuilder } from '@agirails/sdk';

const builder = new RequestBuilder()
  .setServiceType('text-generation')
  .setConsumer('did:ethr:0xConsumer...')
  .setProvider('did:ethr:0xProvider...')
  .setInputData({ prompt: '...', maxTokens: 500 })
  .setPaymentTerms({
    amount: '1000000',
    currency: 'USDC',
    deadline: Math.floor(Date.now() / 1000) + 86400
  });

const cid = await builder.uploadToIPFS();
```

**Timeline:** RequestBuilder implementation planned for SDK v0.2.0 (estimated 2-3 weeks)

---

## 7. Examples

### 7.1 Text Generation Service

```json
{
  "version": "1.0.0",
  "serviceType": "text-generation",
  "requestId": "req_text_001",
  "consumer": "did:ethr:84532:0xConsumer...",
  "provider": "did:ethr:84532:0xProvider...",
  "chainId": 84532,
  "inputData": {
    "prompt": "Write a technical blog post about blockchain scalability",
    "maxTokens": 2000,
    "temperature": 0.7,
    "model": "gpt-4"
  },
  "deliveryRequirements": {
    "format": "text",
    "minQuality": 0.85
  },
  "paymentTerms": {
    "amount": "5000000",
    "currency": "USDC",
    "decimals": 6,
    "deadline": 1732100000,
    "disputeWindow": 7200
  },
  "timestamp": 1731700000
}
```

### 7.2 Web Scraping Service

```json
{
  "version": "1.0.0",
  "serviceType": "web-scraping",
  "requestId": "req_scrape_002",
  "consumer": "did:ethr:84532:0xConsumer...",
  "provider": "did:ethr:84532:0xProvider...",
  "chainId": 84532,
  "inputData": {
    "url": "https://news.ycombinator.com",
    "selectors": {
      "title": ".titleline > a",
      "score": ".score",
      "comments": ".subtext > a:last-child"
    },
    "maxResults": 30
  },
  "deliveryRequirements": {
    "format": "json",
    "schema": "https://schema.agirails.io/hacker-news-v1.json"
  },
  "paymentTerms": {
    "amount": "500000",
    "currency": "USDC",
    "decimals": 6,
    "maxPrice": "1000000",
    "deadline": 1732000000,
    "disputeWindow": 3600
  },
  "metadata": {
    "tags": ["news", "tech", "aggregation"]
  },
  "timestamp": 1731700000
}
```

### 7.3 Code Generation Service

```json
{
  "version": "1.0.0",
  "serviceType": "code-generation",
  "requestId": "req_code_003",
  "consumer": "did:ethr:84532:0xConsumer...",
  "provider": "did:ethr:84532:0xProvider...",
  "chainId": 84532,
  "inputData": {
    "language": "python",
    "task": "Create a REST API for user authentication with JWT tokens",
    "framework": "FastAPI",
    "includeTests": true,
    "includeDocumentation": true
  },
  "deliveryRequirements": {
    "format": "url",
    "schema": "https://schema.agirails.io/code-delivery-v1.json",
    "minQuality": 0.9
  },
  "paymentTerms": {
    "amount": "50000000",
    "currency": "USDC",
    "decimals": 6,
    "deadline": 1732200000,
    "disputeWindow": 14400
  },
  "metadata": {
    "priority": "high",
    "callbackUrl": "https://consumer.example.com/code-delivery"
  },
  "timestamp": 1731700000
}
```

---

## 8. Security Considerations

### 8.1 Hash Integrity

**Threat:** Consumer uploads metadata to IPFS, creates transaction with hash H1, then modifies IPFS content (new hash H2) and tries to claim modified terms.

**Mitigation:**
- Provider MUST recompute hash from downloaded metadata
- Provider MUST compare computed hash to on-chain `tx.serviceHash`
- Provider MUST reject if mismatch (do not accept transaction)

### 8.2 IPFS Availability Attacks

**Threat:** Consumer creates transaction but never uploads metadata (or uploads then immediately unpins), causing provider to waste gas accepting non-existent job.

**Mitigation:**
- Provider SHOULD timeout IPFS download after 60 seconds
- Provider SHOULD NOT call `transitionState()` until metadata verified
- Future AIP: Economic penalty for consumer unavailability (reputation slashing)

### 8.3 Denial of Service via Large Payloads

**Threat:** Malicious consumer uploads 10GB file as `inputData`, causing provider to exhaust bandwidth/storage.

**Mitigation:**
- Providers MUST enforce `inputData` size limit (recommended: 1MB max)
- Providers SHOULD check IPFS object size before full download:
  ```typescript
  const stats = await ipfs.files.stat(`/ipfs/${cid}`);
  if (stats.size > 1_000_000) throw new Error('Payload too large');
  ```

### 8.4 Replay Attacks Across Chains

**Threat:** Consumer creates request on Base Sepolia (testnet), provider accepts. Attacker copies metadata to Base Mainnet with same hash.

**Mitigation:**
- `chainId` field in metadata MUST match on-chain transaction chain
- EIP-712 domain separator MUST include correct `chainId`
- Provider MUST validate: `metadata.chainId === tx.chainId === domain.chainId`

---

## 9. Future Extensions

### 9.1 Streaming Input Data (AIP-1.1)

For large datasets (>1MB), support streaming references:

```json
"inputData": {
  "datasetUrl": "ipfs://bafybei...",
  "datasetSize": 104857600,
  "datasetHash": "0x..."
}
```

### 9.2 Multi-Party Requests (AIP-1.2)

Support requests requiring multiple providers:

```json
"providers": [
  { "did": "did:ethr:0xProvider1", "role": "data-provider" },
  { "did": "did:ethr:0xProvider2", "role": "compute-provider" }
]
```

### 9.3 Conditional Execution (AIP-1.3)

Support oracle-dependent requests:

```json
"conditions": {
  "oracleUrl": "https://api.chainlink.com/...",
  "trigger": "price > 2000",
  "expiryIfNotMet": 1732000000
}
```

---

## 10. References

- **AIP-0**: Meta Protocol Specification
- **AIP-4**: Delivery Proof Specification (pending)
- **Yellow Paper**: ACTP Protocol Formal Specification
- **JSON Schema Specification**: https://json-schema.org/
- **IPFS Docs**: https://docs.ipfs.tech/
- **EIP-712**: Typed Structured Data Hashing and Signing

---

## Appendix A: JSON Schema

See `/Testnet/docs/schemas/aip-1-request.schema.json` for the complete JSON Schema definition.

---

## Appendix B: EIP-712 Type Definition

See `/Testnet/docs/schemas/aip-1-request.eip712.json` for the complete EIP-712 type definition.

---

## Appendix C: Test Vectors

**Test Vector 1: Minimal Valid Request**

```json
{
  "version": "1.0.0",
  "serviceType": "text-generation",
  "requestId": "req_min_001",
  "consumer": "did:ethr:84532:0x1234567890123456789012345678901234567890",
  "provider": "did:ethr:84532:0x0987654321098765432109876543210987654321",
  "chainId": 84532,
  "inputData": {
    "prompt": "Hello world"
  },
  "paymentTerms": {
    "amount": "50000",
    "currency": "USDC",
    "decimals": 6,
    "deadline": 1732000000,
    "disputeWindow": 3600
  },
  "timestamp": 1731700000
}
```

**Canonical JSON:**
```json
{"chainId":84532,"consumer":"did:ethr:84532:0x1234567890123456789012345678901234567890","inputData":{"prompt":"Hello world"},"paymentTerms":{"amount":"50000","currency":"USDC","deadline":1732000000,"decimals":6,"disputeWindow":3600},"provider":"did:ethr:84532:0x0987654321098765432109876543210987654321","requestId":"req_min_001","serviceType":"text-generation","timestamp":1731700000,"version":"1.0.0"}
```

**Expected Keccak256 Hash:**
```
0x4969f2a08b14d7895599e137a17caed80b28c777e3f23d7ca47c83ad3bf5ec69
```

**Verification Instructions:**
Implementers MUST verify their canonical JSON + keccak256 pipeline produces this exact hash. To compute:
1. Sort all object keys alphabetically (recursive)
2. Remove all whitespace
3. UTF-8 encode the result
4. Apply keccak256 hash function
5. Compare output to expected hash above

---

**Status:** This specification is **DRAFT** and subject to change based on community feedback and testnet deployment results.

**Next Steps:**
1. ✅ Create JSON Schema file
2. ✅ Create EIP-712 type definition
3. ⏳ Implement RequestBuilder in SDK
4. ⏳ Deploy testnet contracts and update contract addresses
5. ⏳ Create cross-language test vectors for hash compatibility
