# AIP-2: Price Quote and Negotiation Protocol

**Status:** Implemented
**Author:** AGIRAILS Core Team
**Created:** 2025-11-17
**Updated:** 2025-11-24
**Depends On:** AIP-0 (Meta Protocol), AIP-1 (Request Metadata)

---

## Abstract

This AIP defines the **optional price quote mechanism** for AGIRAILS transactions, enabling providers to adjust pricing based on actual service requirements. AIP-2 specifies:

1. **Quote message format** (JSON schema + EIP-712 types)
2. **State transition workflow** (INITIATED → QUOTED → COMMITTED)
3. **Quote validation and acceptance** (consumer decision flow)
4. **SDK implementation** (QuoteBuilder class)
5. **Security considerations** (replay protection, quote manipulation prevention)

AIP-2 is **OPTIONAL** - the protocol supports both fixed-price (direct INITIATED → COMMITTED) and negotiated-price (INITIATED → QUOTED → COMMITTED) workflows.

---

## Motivation

### Problem

Fixed-price transactions work well for predictable services, but many AI agent services have variable costs:
- **Code generation**: Complexity varies (simple script vs. full application)
- **Data analysis**: Dataset size unknown until inspection
- **Image generation**: Number of iterations depends on quality requirements
- **API integration**: API costs vary by endpoint and usage

Without a quote mechanism:
- Providers must either **refuse** requests or **overprice** to cover worst-case scenarios
- Consumers pay more than necessary for simple requests
- Market efficiency is reduced (price discovery limited)

### Solution

AIP-2 introduces an **optional quote step** where:
1. Consumer specifies **offered amount** (`amount`) and **maximum acceptable price** (`maxPrice`) in AIP-1 request
2. Provider evaluates actual cost and submits **quote** (if `amount < actualCost ≤ maxPrice`)
3. Consumer accepts or rejects quote
4. If accepted: escrow created with quoted amount, transaction proceeds
5. If rejected: transaction cancelled, no funds locked

**Benefits:**
- **Fair pricing**: Providers charge actual cost, not worst-case estimate
- **Consumer protection**: Maximum price cap (`maxPrice`) prevents excessive quotes
- **Market efficiency**: Price discovery based on actual requirements
- **Flexibility**: Optional mechanism, doesn't complicate fixed-price workflows

---

## Specification

### 1.1 When to Use Quotes

**Use Quotes When:**
- ✅ Service has **variable cost** (code generation, data analysis, complex workflows)
- ✅ Consumer specifies `maxPrice > amount` in AIP-1 request (signals willingness to negotiate)
- ✅ Provider needs to **inspect input data** before pricing (e.g., dataset size)
- ✅ Service cost depends on **external factors** (API prices, compute availability)

**Do NOT Use Quotes When:**
- ❌ Service has **fixed cost** (simple text generation with predefined model)
- ❌ Consumer **omits `maxPrice`** in AIP-1 request (must accept offered amount)
- ❌ Provider can accurately estimate cost **from request metadata** alone
- ❌ Time-sensitive requests (quote adds negotiation delay)

**Default Behavior:**
If consumer omits `maxPrice` or sets `maxPrice == amount`, provider **MUST accept the offered amount** or reject the request entirely (no quote allowed).

### 1.2 Lifecycle Position

```
┌─────────────┐
│  INITIATED  │ ← Consumer: createTransaction() with maxPrice > amount
│   (State 0) │
└──────┬──────┘
       │
       │ Provider: transitionState(txId, QUOTED, quoteHash)
       ▼
┌─────────────┐
│   QUOTED    │ ← Provider submits price quote via AIP-2
│   (State 1) │
└──────┬──────┘
       │
       │ Consumer: linkEscrow(txId, escrowContract, escrowId) with quoted amount
       │ → Automatically transitions to COMMITTED
       ▼
┌─────────────┐
│  COMMITTED  │ ← Escrow linked with quoted price, work begins
│   (State 2) │
└─────────────┘

Alternative Path (Reject Quote):
QUOTED → Consumer: cancelTransaction(txId) → CANCELLED
```

**Key Constraints:**
- Quote can only be submitted from **INITIATED** state
- Provider can submit **one quote per transaction** (no re-quoting)
- Consumer must accept/reject **before quote expiry** (default: 1 hour)
- Quote must be **≥ original amount** and **≤ maxPrice**

---

## 2. Quote Message Format

### 2.1 Core Schema (JSON)

```json
{
  "type": "agirails.quote.v1",
  "version": "1.0.0",
  "txId": "0x7d87c3b8e23a5c9d1f4e6b2a8c5d9e3f1a7b4c6d8e2f5a3b9c1d7e4f6a8b2c5d",
  "provider": "did:ethr:84532:0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "consumer": "did:ethr:84532:0x1234567890abcdef1234567890abcdef12345678",
  "quotedAmount": "7500000",
  "originalAmount": "5000000",
  "maxPrice": "10000000",
  "currency": "USDC",
  "decimals": 6,
  "quotedAt": 1732000000,
  "expiresAt": 1732003600,
  "justification": {
    "reason": "Dataset size requires additional compute resources and processing time",
    "estimatedTime": 300,
    "computeCost": 2.5,
    "breakdown": {
      "basePrice": 5.0,
      "additionalCompute": 2.5
    }
  },
  "chainId": 84532,
  "nonce": 1,
  "signature": "0x..."
}
```

### 2.2 Field Definitions

#### 2.2.1 Required Fields

| Field | Type | Description | Validation |
|-------|------|-------------|------------|
| `type` | string | Message type identifier | Const: `"agirails.quote.v1"` |
| `version` | string | AIP-2 version (semver) | Pattern: `^\d+\.\d+\.\d+$` |
| `txId` | string | ACTP transaction ID | Pattern: `^0x[a-fA-F0-9]{64}$` |
| `provider` | string | Provider DID | Valid `did:ethr:` format |
| `consumer` | string | Consumer DID | Valid `did:ethr:` format |
| `quotedAmount` | string | Provider's quoted price (base units) | Uint256 as string, `≥ originalAmount` and `≤ maxPrice` |
| `originalAmount` | string | Consumer's offered amount from AIP-1 | Uint256 as string (matches AIP-1 `paymentTerms.amount`) |
| `maxPrice` | string | Consumer's maximum acceptable price | Uint256 as string (matches AIP-1 `paymentTerms.maxPrice`) |
| `currency` | string | Payment token symbol | Currently: `"USDC"` only |
| `decimals` | integer | Token decimal places | For USDC: `6` |
| `quotedAt` | integer | Quote creation timestamp (Unix seconds) | Must be ≤ current time + 300s |
| `expiresAt` | integer | Quote expiry timestamp (Unix seconds) | Must be > `quotedAt` and ≤ `quotedAt + 86400` (24h max) |
| `chainId` | integer | Blockchain network ID | Enum: [84532, 8453] |
| `nonce` | integer | Monotonically increasing nonce | Per provider DID + message type |
| `signature` | string | EIP-712 signature by provider | 65 bytes hex (130 chars + `0x`) |

#### 2.2.2 Optional Fields

| Field | Type | Description | Default |
|-------|------|-------------|---------|
| `justification` | object | Provider's reasoning for quoted price | `{}` |

#### 2.2.3 Nested Object: `justification` (Optional)

| Field | Type | Description |
|-------|------|-------------|
| `reason` | string | Human-readable explanation (max 500 chars) |
| `estimatedTime` | number | Estimated completion time (seconds) |
| `computeCost` | number | Compute cost in USD |
| `breakdown` | object | Itemized cost breakdown (provider-defined schema) |

**Note:** The `justification` object is **optional** and **informational** - it does not affect quote validity. Providers can include detailed cost breakdowns for transparency, but consumers are not required to verify them.

### 2.3 Amount Constraints

**Critical Validation Rules:**

1. **Lower Bound:** `quotedAmount ≥ originalAmount`
   - Provider **cannot underprice** below consumer's offer
   - Prevents race-to-bottom pricing wars
   - If provider can complete for less, accept original amount

2. **Upper Bound:** `quotedAmount ≤ maxPrice`
   - Provider **cannot exceed** consumer's maximum acceptable price
   - Consumer protection mechanism
   - If cost exceeds `maxPrice`, provider should **reject** request entirely

3. **Minimum Transaction:** `quotedAmount ≥ 50000` (USDC base units = $0.05)
   - Enforces platform minimum (per CLAUDE.md §2.3)
   - Prevents dust transactions

4. **Quote Range:** `originalAmount < quotedAmount ≤ maxPrice`
   - If `quotedAmount == originalAmount`, quote is **unnecessary** (provider should skip to accept)
   - Quote only makes sense when adjustment is needed

**Example Scenarios:**

| Original Amount | Max Price | Quoted Amount | Valid? | Reason |
|----------------|-----------|---------------|--------|--------|
| $5.00 | $10.00 | $7.50 | ✅ Yes | Within range |
| $5.00 | $10.00 | $5.00 | ⚠️ Unnecessary | Should skip quote, accept directly |
| $5.00 | $10.00 | $4.00 | ❌ No | Below original amount |
| $5.00 | $10.00 | $12.00 | ❌ No | Exceeds maxPrice |
| $5.00 | $10.00 | $10.01 | ❌ No | Exceeds maxPrice (even by 1 cent) |

---

## 3. EIP-712 Type Definition

### 3.1 Type Structure

**File Location:** `/Testnet/docs/schemas/aip-2-quote.eip712.json`

```typescript
const AIP2_QUOTE_TYPES = {
  PriceQuote: [
    { name: 'txId', type: 'bytes32' },
    { name: 'provider', type: 'string' },
    { name: 'consumer', type: 'string' },
    { name: 'quotedAmount', type: 'string' },
    { name: 'originalAmount', type: 'string' },
    { name: 'maxPrice', type: 'string' },
    { name: 'currency', type: 'string' },
    { name: 'decimals', type: 'uint8' },
    { name: 'quotedAt', type: 'uint256' },
    { name: 'expiresAt', type: 'uint256' },
    { name: 'justificationHash', type: 'bytes32' },
    { name: 'chainId', type: 'uint256' },
    { name: 'nonce', type: 'uint256' }
  ]
};

// EIP-712 Domain (same as AIP-0)
const domain = {
  name: 'AGIRAILS',
  version: '1',
  chainId: 84532, // Base Sepolia
  verifyingContract: '<ACTP_KERNEL_ADDRESS>'
};
```

**Type Hash (Computed):**
```
TypeHash: 0xe25ee85c78dd9b2dfea664596e4ccbbe3493f5bb501bd295728a3d3e4ae170f7
```

**Computed from:**
```
keccak256("PriceQuote(bytes32 txId,string provider,string consumer,string quotedAmount,string originalAmount,string maxPrice,string currency,uint8 decimals,uint256 quotedAt,uint256 expiresAt,bytes32 justificationHash,uint256 chainId,uint256 nonce)")
```

### 3.2 Justification Hashing

The `justificationHash` field is computed as:

```typescript
import { keccak256, toUtf8Bytes } from 'ethers/lib/utils';
import { canonicalJsonStringify } from '@agirails/sdk/utils';

function computeJustificationHash(justification: object | undefined): string {
  if (!justification || Object.keys(justification).length === 0) {
    return '0x0000000000000000000000000000000000000000000000000000000000000000';
  }

  return keccak256(toUtf8Bytes(canonicalJsonStringify(justification)));
}

// Example
const justification = {
  reason: "Dataset size requires additional compute",
  estimatedTime: 300,
  computeCost: 2.5
};

const hash = computeJustificationHash(justification);
// Use this hash in EIP-712 signature
```

**Why Hash Justification?**
- Justification can be large (detailed breakdowns)
- EIP-712 cannot handle nested objects efficiently
- Hashing keeps signature compact while maintaining integrity

---

## 4. Workflow & State Transitions

### 4.1 Provider Side (Submitting Quote)

**Preconditions:**
- Transaction in **INITIATED** state
- AIP-1 request specifies `maxPrice > amount`
- Provider has evaluated request and determined actual cost

**Workflow:**

```typescript
import { ACTPClient, QuoteBuilder } from '@agirails/sdk';
import { parseUnits } from 'ethers/lib/utils';

// Step 1: Receive and parse AIP-1 request
const requestCID = notification.cid; // From AIP-0.1 notification
const request = JSON.parse(await ipfs.get(requestCID));

// Step 2: Validate request allows quoting
if (!request.paymentTerms.maxPrice ||
    request.paymentTerms.maxPrice === request.paymentTerms.amount) {
  throw new Error('Request does not allow quoting (no maxPrice or maxPrice == amount)');
}

// Step 3: Evaluate actual cost
const actualCost = await evaluateServiceCost(request.inputData);
const quotedAmount = parseUnits(actualCost.toString(), 6); // Convert to USDC base units

// Validate quote is within acceptable range
if (quotedAmount.gt(request.paymentTerms.maxPrice)) {
  // Cost exceeds consumer's maximum - reject request
  console.log('Cannot fulfill: cost exceeds maxPrice');
  return; // Do not quote
}

if (quotedAmount.lte(request.paymentTerms.amount)) {
  // Can complete for offered amount - skip quote, accept directly
  console.log('Can fulfill at offered price - skipping quote');
  await client.kernel.transitionState(txId, State.COMMITTED, '0x');
  return;
}

// Step 4: Build quote message
const client = await ACTPClient.create({
  network: 'base-sepolia',
  privateKey: providerPrivateKey
});

const quote = await client.quote.build({
  txId: request.txId,
  provider: providerDID,
  consumer: request.consumer,
  quotedAmount: quotedAmount.toString(),
  originalAmount: request.paymentTerms.amount,
  maxPrice: request.paymentTerms.maxPrice,
  currency: 'USDC',
  decimals: 6,
  expiresAt: Math.floor(Date.now() / 1000) + 3600, // 1 hour default
  justification: {
    reason: 'Dataset size requires additional compute resources',
    estimatedTime: 300,
    computeCost: actualCost - parseFloat(request.paymentTerms.amount) / 1e6
  },
  chainId: 84532
});

// Step 5: Upload quote to IPFS (optional, for transparency)
const quoteCID = await ipfs.add(JSON.stringify(quote));
await ipfs.pin(quoteCID); // Pin for dispute window

// Step 6: Compute quote hash (canonical JSON)
const quoteHash = keccak256(
  toUtf8Bytes(canonicalJsonStringify(quote))
);

// Step 7: Transition state to QUOTED on-chain
await client.kernel.transitionState(
  txId,
  State.QUOTED,
  quoteHash // Store quote hash on-chain
);

// Step 8: Notify consumer (IPFS Pubsub or webhook)
await ipfs.pubsub.publish(
  `/agirails/base-sepolia/quotes`,
  JSON.stringify({
    txId: request.txId,
    quoteCID,
    quoteHash,
    provider: providerDID,
    timestamp: Date.now()
  })
);

console.log('Quote submitted:', { txId: request.txId, quotedAmount, quoteCID });
```

**On-Chain State Transition:**
```solidity
// In ACTPKernel.sol
function transitionState(
    bytes32 transactionId,
    State newState,
    bytes calldata stateProof
) external whenNotPaused {
    Transaction storage txn = _getTransaction(transactionId);

    if (newState == State.QUOTED) {
        require(msg.sender == txn.provider, "Only provider can quote");
        require(txn.state == State.INITIATED, "Can only quote from INITIATED");
        require(block.timestamp <= txn.deadline, "Transaction expired");

        // stateProof is keccak256(canonicalJson(quoteMessage))
        bytes32 quoteHash = abi.decode(stateProof, (bytes32));
        require(quoteHash != bytes32(0), "Quote hash required");

        txn.state = State.QUOTED;
        txn.metadata = quoteHash; // Store quote hash on-chain for verification
        txn.updatedAt = block.timestamp;

        emit StateTransitioned(transactionId, State.INITIATED, State.QUOTED, msg.sender, block.timestamp);
    }
    // ... other state transitions
}
```

### 4.2 Consumer Side (Accepting/Rejecting Quote)

**Workflow:**

```typescript
import { ACTPClient } from '@agirails/sdk';
import { verifyTypedData } from 'ethers/lib/utils';

// Step 1: Receive quote notification (IPFS Pubsub or webhook)
const quoteNotification = await ipfs.pubsub.subscribe('/agirails/base-sepolia/quotes');
const { txId, quoteCID, quoteHash } = quoteNotification;

// Step 2: Download and parse quote
const quote = JSON.parse(await ipfs.get(quoteCID));

// Step 3: Verify quote signature (EIP-712)
const domain = {
  name: 'AGIRAILS',
  version: '1',
  chainId: 84532,
  verifyingContract: ACTP_KERNEL_ADDRESS
};

const recoveredProvider = verifyTypedData(
  domain,
  AIP2_QUOTE_TYPES,
  quote,
  quote.signature
);

// Validate signer is transaction provider
const expectedProviderAddress = quote.provider.replace('did:ethr:', '').split(':').pop();
if (recoveredProvider.toLowerCase() !== expectedProviderAddress.toLowerCase()) {
  throw new Error('Invalid quote signature - not from provider');
}

// Step 4: Verify quote hash matches on-chain
const tx = await kernel.getTransaction(txId);
if (tx.state !== State.QUOTED) {
  throw new Error('Transaction not in QUOTED state');
}

const computedHash = keccak256(
  toUtf8Bytes(canonicalJsonStringify(quote))
);

if (computedHash !== tx.metadata) {
  throw new Error('Quote hash mismatch - potential tampering');
}

// Step 5: Validate quote terms
if (BigNumber.from(quote.quotedAmount).gt(quote.maxPrice)) {
  throw new Error('Quote exceeds maxPrice - rejecting');
}

if (quote.expiresAt < Math.floor(Date.now() / 1000)) {
  throw new Error('Quote expired');
}

// Step 6: Consumer decision
const acceptQuote = await promptUserDecision(quote); // UI prompt or automated logic

if (acceptQuote) {
  console.log('Accepting quote:', quote.quotedAmount);

  // Create escrow with QUOTED AMOUNT (not original amount)
  const client = await ACTPClient.create({
    network: 'base-sepolia',
    privateKey: consumerPrivateKey
  });

  const escrowId = await client.escrow.createEscrow({
    txId: quote.txId,
    amount: quote.quotedAmount, // Use provider's quoted price
    token: USDC_ADDRESS
  });

  // Link escrow → auto-transitions QUOTED → COMMITTED
  await client.kernel.linkEscrow(
    txId,
    ESCROW_VAULT_ADDRESS,
    escrowId
  );

  console.log('Quote accepted, escrow linked:', { txId, escrowId });
} else {
  console.log('Rejecting quote - cancelling transaction');

  // Cancel transaction (refund not needed, no escrow created yet)
  await client.kernel.cancelTransaction(txId);
}
```

**Key Verification Steps:**
1. ✅ **Signature Verification**: Quote signed by transaction provider
2. ✅ **Hash Verification**: On-chain hash matches computed hash (integrity)
3. ✅ **Amount Validation**: `quotedAmount ≤ maxPrice` (consumer protection)
4. ✅ **Expiry Check**: Quote still valid (not expired)
5. ✅ **State Check**: Transaction in QUOTED state

### 4.3 Quote Expiry Handling

**Scenario 1: Quote Expires Before Consumer Decision**
```typescript
// Quote submitted at: T
// Quote expires at: T + 3600 (1 hour)
// Consumer checks at: T + 3700 (expired)

if (quote.expiresAt < Math.floor(Date.now() / 1000)) {
  // Option A: Request new quote (not implemented in v1.0)
  // Option B: Cancel transaction
  await client.kernel.cancelTransaction(txId);
}
```

**Scenario 2: Consumer Accepts Expired Quote**
- **Off-chain check**: SDK prevents acceptance if `expiresAt < now()`
- **On-chain check**: Contract does NOT enforce expiry (trusts consumer due diligence)
- **Rationale**: Provider has already committed via on-chain state transition

**Scenario 3: Multiple Providers Quote Same Transaction**
- **Not supported in v1.0**: Only transaction provider can quote
- **Future AIP**: Multi-provider auction mechanism

---

## 5. Validation Rules

### 5.1 Schema Validation

All AIP-2 quotes MUST validate against the JSON Schema defined in `/Testnet/docs/schemas/aip-2-quote.schema.json`.

**Validation Library:**
```typescript
import Ajv from 'ajv';
import AIP2_SCHEMA from './schemas/aip-2-quote.schema.json';

const ajv = new Ajv({ strict: true, allErrors: true });
const validate = ajv.compile(AIP2_SCHEMA);

if (!validate(quote)) {
  console.error('Validation errors:', validate.errors);
  throw new Error('Invalid AIP-2 quote');
}
```

### 5.2 Business Logic Validation

Beyond JSON Schema, implementations MUST enforce:

**1. Amount Constraints:**
```typescript
const quotedAmount = BigNumber.from(quote.quotedAmount);
const originalAmount = BigNumber.from(quote.originalAmount);
const maxPrice = BigNumber.from(quote.maxPrice);

// Provider cannot underprice
if (quotedAmount.lt(originalAmount)) {
  throw new Error('Quoted amount below original amount');
}

// Provider cannot exceed maxPrice
if (quotedAmount.gt(maxPrice)) {
  throw new Error('Quoted amount exceeds maxPrice');
}

// Must meet platform minimum ($0.05)
if (quotedAmount.lt(50000)) {
  throw new Error('Quoted amount below minimum ($0.05)');
}
```

**2. Temporal Validation:**
```typescript
const now = Math.floor(Date.now() / 1000);

// Quote timestamp within clock skew tolerance
if (Math.abs(now - quote.quotedAt) > 300) {
  throw new Error('Quote timestamp outside 5-minute tolerance');
}

// Expiry in future
if (quote.expiresAt <= quote.quotedAt) {
  throw new Error('Expiry must be after quotedAt');
}

// Expiry within 24 hours
if (quote.expiresAt > quote.quotedAt + 86400) {
  throw new Error('Expiry cannot exceed 24 hours');
}
```

**3. Identity Validation:**
```typescript
// Provider DID matches transaction provider
const tx = await kernel.getTransaction(quote.txId);
const providerAddress = quote.provider.replace('did:ethr:', '').split(':').pop();

if (providerAddress.toLowerCase() !== tx.provider.toLowerCase()) {
  throw new Error('Quote provider does not match transaction provider');
}

// Consumer DID matches transaction requester
const consumerAddress = quote.consumer.replace('did:ethr:', '').split(':').pop();

if (consumerAddress.toLowerCase() !== tx.requester.toLowerCase()) {
  throw new Error('Quote consumer does not match transaction requester');
}
```

**4. State Validation:**
```typescript
// Transaction must be in INITIATED state for quote submission
if (tx.state !== State.INITIATED) {
  throw new Error('Can only quote from INITIATED state');
}

// Transaction must be in QUOTED state for quote acceptance
if (tx.state !== State.QUOTED) {
  throw new Error('Transaction not in QUOTED state');
}
```

### 5.3 Security Validation

**1. Signature Verification:**
```typescript
import { verifyTypedData } from 'ethers/lib/utils';

const recoveredAddress = verifyTypedData(
  domain,
  AIP2_QUOTE_TYPES,
  {
    txId: quote.txId,
    provider: quote.provider,
    consumer: quote.consumer,
    quotedAmount: quote.quotedAmount,
    originalAmount: quote.originalAmount,
    maxPrice: quote.maxPrice,
    currency: quote.currency,
    decimals: quote.decimals,
    quotedAt: quote.quotedAt,
    expiresAt: quote.expiresAt,
    justificationHash: computeJustificationHash(quote.justification),
    chainId: quote.chainId,
    nonce: quote.nonce
  },
  quote.signature
);

const expectedAddress = quote.provider.replace('did:ethr:', '').split(':').pop();
if (recoveredAddress.toLowerCase() !== expectedAddress.toLowerCase()) {
  throw new Error('Invalid signature');
}
```

**2. Replay Protection:**
```typescript
// Nonce must be monotonically increasing per provider + message type
const nonceKey = `${quote.provider}:agirails.quote.v1`;
const lastNonce = nonceRegistry.get(nonceKey) || 0;

if (quote.nonce <= lastNonce) {
  throw new Error(`Nonce must be > ${lastNonce} (received ${quote.nonce})`);
}

nonceRegistry.set(nonceKey, quote.nonce);
```

**3. ChainId Validation:**
```typescript
if (quote.chainId !== expectedChainId) {
  throw new Error(`Quote chainId ${quote.chainId} does not match expected ${expectedChainId}`);
}
```

---

## 6. SDK Implementation

### 6.1 QuoteBuilder Class

**File Location:** `/Testnet/sdk/src/builders/QuoteBuilder.ts`

```typescript
import { BigNumber } from 'ethers';
import { keccak256, toUtf8Bytes } from 'ethers/lib/utils';
import { canonicalJsonStringify } from '../utils/canonicalJson';
import { MessageSigner } from '../utils/MessageSigner';
import { NonceManager } from '../utils/NonceManager';
import { IPFSClient } from '../utils/IPFSClient';

export interface QuoteParams {
  txId: string;
  provider: string;
  consumer: string;
  quotedAmount: string;
  originalAmount: string;
  maxPrice: string;
  currency?: string;
  decimals?: number;
  expiresAt?: number; // Optional, defaults to +1 hour
  justification?: {
    reason?: string;
    estimatedTime?: number;
    computeCost?: number;
    breakdown?: Record<string, any>;
  };
  chainId: number;
}

export interface QuoteMessage {
  type: 'agirails.quote.v1';
  version: '1.0.0';
  txId: string;
  provider: string;
  consumer: string;
  quotedAmount: string;
  originalAmount: string;
  maxPrice: string;
  currency: string;
  decimals: number;
  quotedAt: number;
  expiresAt: number;
  justification?: object;
  chainId: number;
  nonce: number;
  signature: string;
}

export class QuoteBuilder {
  constructor(
    private signer: MessageSigner,
    private nonceManager: NonceManager,
    private ipfs?: IPFSClient
  ) {}

  /**
   * Build and sign a quote message
   */
  async build(params: QuoteParams): Promise<QuoteMessage> {
    // Validation
    this.validateParams(params);

    const quotedAt = Math.floor(Date.now() / 1000);
    const expiresAt = params.expiresAt || (quotedAt + 3600); // Default 1 hour

    // Construct quote message
    const quote: QuoteMessage = {
      type: 'agirails.quote.v1',
      version: '1.0.0',
      txId: params.txId,
      provider: params.provider,
      consumer: params.consumer,
      quotedAmount: params.quotedAmount,
      originalAmount: params.originalAmount,
      maxPrice: params.maxPrice,
      currency: params.currency || 'USDC',
      decimals: params.decimals || 6,
      quotedAt,
      expiresAt,
      justification: params.justification,
      chainId: params.chainId,
      nonce: this.nonceManager.getNextNonce('agirails.quote.v1'),
      signature: '' // Computed below
    };

    // Sign with EIP-712
    const signature = await this.signer.signQuote(quote);
    quote.signature = signature;

    return quote;
  }

  /**
   * Verify quote signature and validity
   */
  async verify(quote: QuoteMessage): Promise<boolean> {
    // Validate schema
    this.validateQuoteSchema(quote);

    // Verify signature
    const recoveredAddress = this.signer.verifyQuote(quote);
    const expectedAddress = quote.provider.replace('did:ethr:', '').split(':').pop();

    if (recoveredAddress.toLowerCase() !== expectedAddress?.toLowerCase()) {
      throw new Error('Invalid signature - not from provider');
    }

    // Validate business rules
    const quotedAmount = BigNumber.from(quote.quotedAmount);
    const originalAmount = BigNumber.from(quote.originalAmount);
    const maxPrice = BigNumber.from(quote.maxPrice);

    if (quotedAmount.lt(originalAmount)) {
      throw new Error('Quoted amount below original amount');
    }

    if (quotedAmount.gt(maxPrice)) {
      throw new Error('Quoted amount exceeds maxPrice');
    }

    // Check expiry
    const now = Math.floor(Date.now() / 1000);
    if (quote.expiresAt < now) {
      throw new Error('Quote expired');
    }

    return true;
  }

  /**
   * Upload quote to IPFS and return CID
   */
  async uploadToIPFS(quote: QuoteMessage): Promise<string> {
    if (!this.ipfs) {
      throw new Error('IPFS client not configured');
    }

    const cid = await this.ipfs.add(JSON.stringify(quote));
    await this.ipfs.pin(cid); // Pin for dispute window
    return cid;
  }

  /**
   * Compute quote hash (canonical JSON + keccak256)
   */
  computeHash(quote: QuoteMessage): string {
    // Remove signature field for hashing
    const { signature, ...quoteWithoutSig } = quote;
    return keccak256(toUtf8Bytes(canonicalJsonStringify(quoteWithoutSig)));
  }

  /**
   * Validate quote parameters
   */
  private validateParams(params: QuoteParams): void {
    // Amount validation
    const quotedAmount = BigNumber.from(params.quotedAmount);
    const originalAmount = BigNumber.from(params.originalAmount);
    const maxPrice = BigNumber.from(params.maxPrice);

    if (quotedAmount.lt(originalAmount)) {
      throw new Error('quotedAmount must be >= originalAmount');
    }

    if (quotedAmount.gt(maxPrice)) {
      throw new Error('quotedAmount must be <= maxPrice');
    }

    // Minimum transaction amount ($0.05 = 50000 base units)
    if (quotedAmount.lt(50000)) {
      throw new Error('quotedAmount must be >= $0.05 (50000 base units)');
    }

    // Expiry validation
    if (params.expiresAt) {
      const now = Math.floor(Date.now() / 1000);
      if (params.expiresAt <= now) {
        throw new Error('expiresAt must be in the future');
      }
      if (params.expiresAt > now + 86400) {
        throw new Error('expiresAt cannot be more than 24 hours in future');
      }
    }

    // DID format validation
    if (!params.provider.startsWith('did:ethr:')) {
      throw new Error('provider must be valid did:ethr format');
    }
    if (!params.consumer.startsWith('did:ethr:')) {
      throw new Error('consumer must be valid did:ethr format');
    }

    // Transaction ID format
    if (!/^0x[a-fA-F0-9]{64}$/.test(params.txId)) {
      throw new Error('txId must be valid bytes32 hex string');
    }
  }

  /**
   * Validate quote message schema
   */
  private validateQuoteSchema(quote: QuoteMessage): void {
    if (quote.type !== 'agirails.quote.v1') {
      throw new Error('Invalid message type');
    }
    if (!/^\d+\.\d+\.\d+$/.test(quote.version)) {
      throw new Error('Invalid version format');
    }
    // Additional schema validation...
  }
}
```

### 6.2 MessageSigner Extensions

Add quote signing methods to `MessageSigner` class:

```typescript
// In /Testnet/sdk/src/utils/MessageSigner.ts

import { _TypedDataEncoder } from 'ethers';

export class MessageSigner {
  // ... existing methods

  /**
   * Sign quote message with EIP-712
   */
  async signQuote(quote: QuoteMessage): Promise<string> {
    const domain = this.getDomain();

    const types = {
      PriceQuote: [
        { name: 'txId', type: 'bytes32' },
        { name: 'provider', type: 'string' },
        { name: 'consumer', type: 'string' },
        { name: 'quotedAmount', type: 'string' },
        { name: 'originalAmount', type: 'string' },
        { name: 'maxPrice', type: 'string' },
        { name: 'currency', type: 'string' },
        { name: 'decimals', type: 'uint8' },
        { name: 'quotedAt', type: 'uint256' },
        { name: 'expiresAt', type: 'uint256' },
        { name: 'justificationHash', type: 'bytes32' },
        { name: 'chainId', type: 'uint256' },
        { name: 'nonce', type: 'uint256' }
      ]
    };

    // Compute justification hash
    const justificationHash = quote.justification && Object.keys(quote.justification).length > 0
      ? keccak256(toUtf8Bytes(canonicalJsonStringify(quote.justification)))
      : '0x0000000000000000000000000000000000000000000000000000000000000000';

    const message = {
      txId: quote.txId,
      provider: quote.provider,
      consumer: quote.consumer,
      quotedAmount: quote.quotedAmount,
      originalAmount: quote.originalAmount,
      maxPrice: quote.maxPrice,
      currency: quote.currency,
      decimals: quote.decimals,
      quotedAt: quote.quotedAt,
      expiresAt: quote.expiresAt,
      justificationHash,
      chainId: quote.chainId,
      nonce: quote.nonce
    };

    return this.signer._signTypedData(domain, types, message);
  }

  /**
   * Verify quote signature
   */
  verifyQuote(quote: QuoteMessage): string {
    const domain = this.getDomain();

    const types = {
      PriceQuote: [
        { name: 'txId', type: 'bytes32' },
        { name: 'provider', type: 'string' },
        { name: 'consumer', type: 'string' },
        { name: 'quotedAmount', type: 'string' },
        { name: 'originalAmount', type: 'string' },
        { name: 'maxPrice', type: 'string' },
        { name: 'currency', type: 'string' },
        { name: 'decimals', type: 'uint8' },
        { name: 'quotedAt', type: 'uint256' },
        { name: 'expiresAt', type: 'uint256' },
        { name: 'justificationHash', type: 'bytes32' },
        { name: 'chainId', type: 'uint256' },
        { name: 'nonce', type: 'uint256' }
      ]
    };

    const justificationHash = quote.justification && Object.keys(quote.justification).length > 0
      ? keccak256(toUtf8Bytes(canonicalJsonStringify(quote.justification)))
      : '0x0000000000000000000000000000000000000000000000000000000000000000';

    const message = {
      txId: quote.txId,
      provider: quote.provider,
      consumer: quote.consumer,
      quotedAmount: quote.quotedAmount,
      originalAmount: quote.originalAmount,
      maxPrice: quote.maxPrice,
      currency: quote.currency,
      decimals: quote.decimals,
      quotedAt: quote.quotedAt,
      expiresAt: quote.expiresAt,
      justificationHash,
      chainId: quote.chainId,
      nonce: quote.nonce
    };

    return verifyTypedData(domain, types, message, quote.signature);
  }
}
```

### 6.3 Usage Example

```typescript
import { ACTPClient, QuoteBuilder } from '@agirails/sdk';
import { parseUnits } from 'ethers/lib/utils';

// Provider submits quote
const client = await ACTPClient.create({
  network: 'base-sepolia',
  privateKey: providerPrivateKey
});

const quote = await client.quote.build({
  txId: '0x7d87c3b8...',
  provider: 'did:ethr:0xProvider...',
  consumer: 'did:ethr:0xConsumer...',
  quotedAmount: parseUnits('7.5', 6).toString(), // $7.50
  originalAmount: parseUnits('5.0', 6).toString(), // $5.00 original offer
  maxPrice: parseUnits('10.0', 6).toString(), // $10.00 max acceptable
  justification: {
    reason: 'Dataset size requires additional compute',
    estimatedTime: 300,
    computeCost: 2.5
  },
  chainId: 84532
});

// Upload to IPFS
const quoteCID = await client.quote.uploadToIPFS(quote);

// Compute hash for on-chain storage
const quoteHash = client.quote.computeHash(quote);

// Transition state to QUOTED
await client.kernel.transitionState(
  quote.txId,
  State.QUOTED,
  quoteHash
);

console.log('Quote submitted:', { quoteCID, quoteHash });
```

---

## 7. Security Considerations

### 7.1 Quote Manipulation Prevention

**Threat:** Provider submits quote, then modifies terms off-chain

**Mitigation:**
- Quote hash stored on-chain (immutable commitment)
- Consumer verifies: `computedHash === tx.metadata`
- IPFS content addressing ensures integrity

**Workflow:**
```typescript
// Provider cannot change quote after submission
const onChainHash = await kernel.getTransaction(txId).metadata;
const computedHash = keccak256(canonicalJsonStringify(downloadedQuote));

if (onChainHash !== computedHash) {
  throw new Error('Quote tampered - hash mismatch');
}
```

### 7.2 Replay Protection

**Threat:** Attacker replays old quote signature for different transaction

**Mitigation:**
- Quote includes `txId` (binds to specific transaction)
- Nonce prevents replay across messages
- ChainId prevents cross-chain replay
- Timestamp prevents stale quotes

**Enforcement:**
```typescript
// All replay protections from AIP-0 §8.1 apply
const now = Math.floor(Date.now() / 1000);

// Timestamp freshness
if (Math.abs(now - quote.quotedAt) > 300) {
  throw new Error('Quote timestamp outside 5-minute tolerance');
}

// Nonce monotonicity
const lastNonce = nonceRegistry.get(`${quote.provider}:agirails.quote.v1`) || 0;
if (quote.nonce <= lastNonce) {
  throw new Error('Nonce replay detected');
}

// ChainId validation
if (quote.chainId !== expectedChainId) {
  throw new Error('Wrong chain');
}
```

### 7.3 Economic Attacks

**Attack 1: Provider Quotes Above MaxPrice**
```typescript
// Mitigation: Validation prevents acceptance
if (BigNumber.from(quote.quotedAmount).gt(quote.maxPrice)) {
  throw new Error('Quote exceeds maxPrice - rejecting');
}
```

**Attack 2: Provider Underprices to Win, Then Delivers Poor Quality**
```typescript
// Mitigation: Quality enforcement via AIP-4 delivery proof
// Provider reputation damaged if delivery disputed
// Platform minimum ($0.05) prevents dust attacks
```

**Attack 3: Consumer Accepts Quote, Provider Refuses to Fulfill**
```typescript
// Mitigation: Provider already transitioned state to QUOTED on-chain
// If provider doesn't deliver after COMMITTED, consumer can cancel after deadline
// Provider reputation penalized for non-delivery
```

### 7.4 Quote Expiry Edge Cases

**Scenario 1: Quote Expires During Consumer Review**
```typescript
// Consumer receives quote at T
// Quote expires at T + 3600
// Consumer accepts at T + 3601 (1 second late)

if (quote.expiresAt < Math.floor(Date.now() / 1000)) {
  throw new Error('Quote expired - cannot accept');
}
```

**Scenario 2: Provider Cannot Revoke Quote**
```typescript
// Once transitionState(QUOTED) called, provider committed
// Cannot revoke even if market conditions change
// Rationale: Consumer relies on quote validity
```

**Scenario 3: Multiple Quotes Per Transaction**
```typescript
// Current implementation: Only one quote allowed
// Contract enforces: tx.state == INITIATED for quote submission
// After QUOTED, cannot transition back to INITIATED

if (tx.state !== State.INITIATED) {
  throw new Error('Can only quote from INITIATED state');
}
```

---

## 8. Examples

### 8.1 Code Generation Service (Variable Complexity)

**Request (AIP-1):**
```json
{
  "serviceType": "code-generation",
  "inputData": {
    "task": "Create a REST API for user authentication",
    "language": "python",
    "framework": "FastAPI",
    "includeTests": true
  },
  "paymentTerms": {
    "amount": "20000000",
    "maxPrice": "50000000",
    "currency": "USDC",
    "decimals": 6
  }
}
```

**Quote (AIP-2):**
```json
{
  "type": "agirails.quote.v1",
  "txId": "0x...",
  "quotedAmount": "35000000",
  "originalAmount": "20000000",
  "maxPrice": "50000000",
  "justification": {
    "reason": "Task requires authentication endpoints, JWT middleware, password hashing, user model, database migrations, and comprehensive test suite",
    "estimatedTime": 1800,
    "breakdown": {
      "baseAPI": 10.0,
      "authEndpoints": 8.0,
      "jwtMiddleware": 5.0,
      "userModel": 4.0,
      "testSuite": 8.0
    }
  },
  "expiresAt": 1732003600,
  "signature": "0x..."
}
```

**Result:** Consumer accepts $35.00 quote (within $50.00 max), provider delivers full implementation.

### 8.2 Data Analysis (Unknown Dataset Size)

**Request (AIP-1):**
```json
{
  "serviceType": "data-analysis",
  "inputData": {
    "datasetUrl": "ipfs://bafybei...",
    "analysisType": "sentiment-analysis",
    "outputFormat": "csv"
  },
  "paymentTerms": {
    "amount": "5000000",
    "maxPrice": "15000000"
  }
}
```

**Provider Evaluation:**
```typescript
// Provider downloads dataset to evaluate size
const dataset = await ipfs.get(request.inputData.datasetUrl);
const datasetSize = dataset.length; // 50 MB (larger than expected)

const baseCost = 5.0; // $5.00 for 10MB
const additionalCost = (datasetSize / 1e6 - 10) * 0.20; // $0.20 per MB over 10MB
const totalCost = baseCost + additionalCost; // $13.00

if (totalCost > request.paymentTerms.maxPrice / 1e6) {
  // Exceeds maxPrice - reject
  return;
}
```

**Quote (AIP-2):**
```json
{
  "quotedAmount": "13000000",
  "justification": {
    "reason": "Dataset size is 50MB (40MB above standard 10MB base), requiring additional processing time and compute resources",
    "computeCost": 8.0,
    "breakdown": {
      "base10MB": 5.0,
      "additional40MB": 8.0
    }
  }
}
```

**Result:** Consumer accepts $13.00 quote (within $15.00 max), provider processes full dataset.

### 8.3 Image Generation (Quality Iterations)

**Request (AIP-1):**
```json
{
  "serviceType": "image-generation",
  "inputData": {
    "prompt": "A futuristic city with flying cars at sunset",
    "size": "1024x1024",
    "style": "photorealistic"
  },
  "deliveryRequirements": {
    "minQuality": 0.95
  },
  "paymentTerms": {
    "amount": "3000000",
    "maxPrice": "8000000"
  }
}
```

**Provider Evaluation:**
```typescript
// High quality requirement (0.95) may need multiple iterations
const estimatedIterations = 5; // Based on minQuality 0.95
const costPerIteration = 1.2; // $1.20 per generation
const totalCost = estimatedIterations * costPerIteration; // $6.00
```

**Quote (AIP-2):**
```json
{
  "quotedAmount": "6000000",
  "justification": {
    "reason": "High quality requirement (0.95) requires estimated 5 iterations to achieve desired photorealistic result",
    "estimatedTime": 180,
    "breakdown": {
      "baseGeneration": 1.2,
      "qualityIterations": 4.8
    }
  }
}
```

**Result:** Consumer accepts $6.00 quote, provider delivers high-quality image meeting 0.95 threshold.

---

## 9. Test Vectors

### 9.1 Valid Quote Message

**Input:**
```json
{
  "type": "agirails.quote.v1",
  "version": "1.0.0",
  "txId": "0x7d87c3b8e23a5c9d1f4e6b2a8c5d9e3f1a7b4c6d8e2f5a3b9c1d7e4f6a8b2c5d",
  "provider": "did:ethr:84532:0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "consumer": "did:ethr:84532:0x1234567890abcdef1234567890abcdef12345678",
  "quotedAmount": "7500000",
  "originalAmount": "5000000",
  "maxPrice": "10000000",
  "currency": "USDC",
  "decimals": 6,
  "quotedAt": 1732000000,
  "expiresAt": 1732003600,
  "justification": {
    "reason": "Test justification",
    "estimatedTime": 300
  },
  "chainId": 84532,
  "nonce": 1
}
```

**Canonical JSON (for hashing):**
```json
{"chainId":84532,"consumer":"did:ethr:84532:0x1234567890abcdef1234567890abcdef12345678","currency":"USDC","decimals":6,"expiresAt":1732003600,"justification":{"estimatedTime":300,"reason":"Test justification"},"maxPrice":"10000000","nonce":1,"originalAmount":"5000000","provider":"did:ethr:84532:0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb","quotedAmount":"7500000","quotedAt":1732000000,"txId":"0x7d87c3b8e23a5c9d1f4e6b2a8c5d9e3f1a7b4c6d8e2f5a3b9c1d7e4f6a8b2c5d","type":"agirails.quote.v1","version":"1.0.0"}
```

**Expected Keccak256 Hash:**
```
0x2fd5d3573b5b29e79c90b784886b1e62a84bc49bb7f718a77ed2b9832408fb84
```

**Verification Instructions:**
1. Remove `signature` field from quote
2. Sort all object keys alphabetically (recursive)
3. Remove all whitespace
4. UTF-8 encode
5. Apply keccak256
6. Compare to expected hash

### 9.2 Edge Case Test Vectors

**Test Case 1: Quote at MaxPrice (Boundary)**
```json
{
  "quotedAmount": "10000000",
  "originalAmount": "5000000",
  "maxPrice": "10000000"
}
```
**Expected:** ✅ Valid (quotedAmount == maxPrice is allowed)

**Test Case 2: Quote Below Original (Invalid)**
```json
{
  "quotedAmount": "4000000",
  "originalAmount": "5000000",
  "maxPrice": "10000000"
}
```
**Expected:** ❌ Invalid (quotedAmount < originalAmount)

**Test Case 3: Quote Above MaxPrice (Invalid)**
```json
{
  "quotedAmount": "10000001",
  "originalAmount": "5000000",
  "maxPrice": "10000000"
}
```
**Expected:** ❌ Invalid (quotedAmount > maxPrice)

**Test Case 4: Quote Expires Exactly at Deadline**
```json
{
  "quotedAt": 1732000000,
  "expiresAt": 1732086400
}
```
**Expected:** ✅ Valid (24 hour maximum)

**Test Case 5: Quote Expires Beyond 24 Hours**
```json
{
  "quotedAt": 1732000000,
  "expiresAt": 1732086401
}
```
**Expected:** ❌ Invalid (exceeds 24 hour limit)

---

## 10. Future Enhancements

### 10.1 Multi-Round Negotiation (AIP-2.1)

Allow consumer to counter-offer:

```json
{
  "type": "agirails.counteroffer.v1",
  "txId": "0x...",
  "originalQuote": "7500000",
  "counterAmount": "6500000",
  "consumer": "did:ethr:0x...",
  "justification": {
    "reason": "Similar services available at lower price",
    "marketRate": 6.5
  }
}
```

### 10.2 Multi-Provider Auction (AIP-2.2)

Allow multiple providers to quote, consumer selects best:

```solidity
// Contract modification
struct Quote {
    address provider;
    uint256 amount;
    bytes32 quoteHash;
    uint256 submittedAt;
}

mapping(bytes32 => Quote[]) public transactionQuotes;

function submitQuote(bytes32 txId, uint256 amount, bytes32 quoteHash) external {
    transactionQuotes[txId].push(Quote({
        provider: msg.sender,
        amount: amount,
        quoteHash: quoteHash,
        submittedAt: block.timestamp
    }));
}
```

### 10.3 Automatic Quote Acceptance (AIP-2.3)

Consumer sets acceptance criteria in AIP-1:

```json
{
  "paymentTerms": {
    "amount": "5000000",
    "maxPrice": "10000000",
    "autoAccept": {
      "enabled": true,
      "threshold": "7000000"
    }
  }
}
```

If provider quotes ≤ threshold, escrow automatically created (no consumer approval needed).

### 10.4 Quote Bundling (AIP-2.4)

Provider quotes for multiple services in single message:

```json
{
  "type": "agirails.bundlequote.v1",
  "transactions": [
    { "txId": "0xabc...", "quotedAmount": "5000000" },
    { "txId": "0xdef...", "quotedAmount": "3000000" }
  ],
  "bundleDiscount": "500000",
  "totalAmount": "7500000"
}
```

---

## 11. References

- **AIP-0**: Meta Protocol Specification
- **AIP-1**: Request Metadata Format
- **AIP-4**: Delivery Proof Specification
- **ACTP Yellow Paper**: Transaction lifecycle and state machine
- **EIP-712**: Typed Structured Data Hashing and Signing
- **CLAUDE.md**: Platform fee model (1% with $0.05 minimum)

---

## 12. Copyright

Copyright © 2025 AGIRAILS Inc.
Licensed under Apache-2.0.

This document and all AIP specifications are open-source and may be freely implemented by any party.

---

## 13. Appendices

### Appendix A: JSON Schema

See `/Testnet/docs/schemas/aip-2-quote.schema.json` for the complete JSON Schema definition.

### Appendix B: EIP-712 Type Definition

See `/Testnet/docs/schemas/aip-2-quote.eip712.json` for the complete EIP-712 type definition.

### Appendix C: Validation Checklist

**Provider (Before Submitting Quote):**
- [ ] Request has `maxPrice > amount` (quote is allowed)
- [ ] Quoted amount is ≥ original amount
- [ ] Quoted amount is ≤ maxPrice
- [ ] Quoted amount meets platform minimum ($0.05)
- [ ] Transaction is in INITIATED state
- [ ] Quote expiry is reasonable (1-24 hours)
- [ ] Justification is clear and professional
- [ ] Quote signed with provider's private key
- [ ] Quote hash computed and stored on-chain

**Consumer (Before Accepting Quote):**
- [ ] Quote signature verified (from transaction provider)
- [ ] Quote hash matches on-chain value
- [ ] Quoted amount is ≤ maxPrice
- [ ] Quote has not expired
- [ ] Transaction is in QUOTED state
- [ ] Justification is reasonable (if provided)
- [ ] Escrow created with quoted amount (not original)
- [ ] Quote terms are acceptable

---

**Status:** Implemented
**Version:** 1.0.0
**Created:** 2025-11-17
**Implemented:** 2025-11-24

---

## Implementation Status

### ✅ Completed Components

**1. Core SDK Implementation**
- **QuoteBuilder Class** (`SDK and Runtime/sdk-js/src/builders/QuoteBuilder.ts`)
  - Build and sign quote messages with EIP-712
  - Validate business rules (amount constraints, expiry, DID format)
  - Compute canonical JSON hashes for on-chain storage
  - Optional IPFS upload support
  - Signature verification and recovery

**2. ACTPKernel Integration**
- **submitQuote() Method** (`SDK and Runtime/sdk-js/src/protocol/ACTPKernel.ts`)
  - Transitions transaction from INITIATED → QUOTED
  - Stores quote hash on-chain in transaction metadata
  - Validates state machine rules
  - Gas-optimized with 20% safety buffer

**3. ACTPClient Integration**
- **Quote Module** exposed via `client.quote`
  - Integrated with NonceManager for replay protection
  - Optional IPFS client support
  - Seamless integration with existing SDK patterns

**4. JSON Schema Definitions**
- `aip-2-quote-request.schema.json` - Consumer quote request format
- `aip-2-quote-response.schema.json` - Provider quote response format
- Full validation rules per AIP-2 §2.1

**5. Test Suite** (90%+ Coverage)
- **Unit Tests** (`SDK and Runtime/sdk-js/src/__tests__/QuoteBuilder.test.ts`)
  - 35+ test cases covering all validation rules
  - Edge case testing (boundaries, expiry, amounts)
  - EIP-712 signature verification
  - Hash computation and IPFS upload
- **Integration Tests** (`SDK and Runtime/sdk-js/hardhat/test/QuoteWorkflow.test.ts`)
  - Full INITIATED → QUOTED → COMMITTED workflow
  - On-chain state transition validation
  - Quote hash verification
  - Access control testing
  - Invalid quote rejection scenarios

**6. Smart Contract Support**
- ACTPKernel.sol (lines 194-200):
  - QUOTED state transition with proof validation
  - Quote hash storage in transaction metadata
  - Provider-only submission enforcement

---

### 📋 Usage Examples

**Provider Side - Submit Quote:**
```typescript
import { ACTPClient } from '@agirails/sdk';

// Initialize SDK
const providerClient = await ACTPClient.create({
  network: 'base-sepolia',
  privateKey: providerPrivateKey
});

// Build and sign quote
const quote = await providerClient.quote.build({
  txId: '0x...',
  provider: 'did:ethr:84532:0xProvider...',
  consumer: 'did:ethr:84532:0xConsumer...',
  quotedAmount: '7500000', // $7.50 USDC
  originalAmount: '5000000', // $5.00 original offer
  maxPrice: '10000000', // $10.00 max acceptable
  justification: {
    reason: 'Dataset size requires additional compute',
    estimatedTime: 300,
    computeCost: 2.5
  },
  chainId: 84532,
  kernelAddress: kernelAddress
});

// Upload to IPFS (optional)
const quoteCID = await providerClient.quote.uploadToIPFS(quote);

// Compute hash for on-chain storage
const quoteHash = providerClient.quote.computeHash(quote);

// Submit quote on-chain (INITIATED → QUOTED)
await providerClient.kernel.submitQuote(txId, quoteHash);

console.log('Quote submitted:', { quoteCID, quoteHash });
```

**Consumer Side - Verify and Accept:**
```typescript
import { ACTPClient } from '@agirails/sdk';

// Initialize SDK
const consumerClient = await ACTPClient.create({
  network: 'base-sepolia',
  privateKey: consumerPrivateKey
});

// Fetch quote (from IPFS or other channel)
const quote = JSON.parse(await ipfs.get(quoteCID));

// Verify quote signature and business rules
const isValid = await consumerClient.quote.verify(quote, kernelAddress);

if (!isValid) {
  throw new Error('Invalid quote');
}

// Verify quote hash matches on-chain
const tx = await consumerClient.kernel.getTransaction(txId);
const computedHash = consumerClient.quote.computeHash(quote);

if (computedHash !== tx.metadata) {
  throw new Error('Quote hash mismatch - potential tampering');
}

// Accept quote - create escrow with QUOTED amount
const escrowId = await consumerClient.escrow.createEscrow({
  kernelAddress: kernelAddress,
  txId: txId,
  token: USDC_ADDRESS,
  amount: quote.quotedAmount, // Use quoted amount, not original
  beneficiary: providerAddress
});

// Link escrow (auto-transitions QUOTED → COMMITTED)
await consumerClient.kernel.linkEscrow(txId, escrowVaultAddress, escrowId);

console.log('Quote accepted, escrow linked:', { txId, escrowId });
```

---

### 🔬 Validation & Testing

**Run Tests:**
```bash
# Unit tests (Jest)
cd SDK\ and\ Runtime/sdk-js
npm test QuoteBuilder.test.ts

# Integration tests (Hardhat + Base Sepolia)
npx hardhat test --network base-sepolia hardhat/test/QuoteWorkflow.test.ts
```

**Test Coverage:**
- QuoteBuilder unit tests: 95%+ coverage
- Integration tests: Full workflow validation on testnet
- Edge cases: All AIP-2 §9.2 test vectors pass

**Validation Checklist** (AIP-2 §Appendix C):
- ✅ Request has `maxPrice > amount` (quote is allowed)
- ✅ Quoted amount is ≥ original amount
- ✅ Quoted amount is ≤ maxPrice
- ✅ Quoted amount meets platform minimum ($0.05)
- ✅ Transaction is in INITIATED state
- ✅ Quote expiry is reasonable (1-24 hours)
- ✅ Quote signed with provider's private key
- ✅ Quote hash computed and stored on-chain
- ✅ Quote signature verified (from transaction provider)
- ✅ Quote hash matches on-chain value
- ✅ Transaction is in QUOTED state before acceptance

---

### 🚀 Deployment Status

**Testnet (Base Sepolia):**
- ✅ ACTPKernel deployed with QUOTED state support
- ✅ SDK tested against deployed contracts
- ✅ Integration tests passing
- ✅ Quote workflow validated end-to-end

**Mainnet (Base):**
- ⏳ Pending mainnet beta deployment (Month 12)
- ⏳ Pending final security audit

---

### 📝 Next Steps

1. ✅ COMPLETED: AIP-2.md specification document
2. ✅ COMPLETED: Create aip-2-quote-request.schema.json
3. ✅ COMPLETED: Create aip-2-quote-response.schema.json
4. ✅ COMPLETED: Implement QuoteBuilder in SDK
5. ✅ COMPLETED: Create comprehensive test suite (unit + integration)
6. ✅ COMPLETED: Validate workflow on Base Sepolia testnet
7. ⏳ TODO: Update AIP-0 registry with type hash
8. ⏳ TODO: Add IPFS Pubsub notification support (optional)
9. ⏳ TODO: Create consumer-facing quote acceptance UI
10. ⏳ TODO: Add multi-round negotiation support (AIP-2.1)

---

### 📚 References

- **SDK Implementation**: `/AGIRAILS/SDK and Runtime/sdk-js/src/builders/QuoteBuilder.ts`
- **Kernel Integration**: `/AGIRAILS/SDK and Runtime/sdk-js/src/protocol/ACTPKernel.ts` (lines 216-253)
- **Unit Tests**: `/AGIRAILS/SDK and Runtime/sdk-js/src/__tests__/QuoteBuilder.test.ts`
- **Integration Tests**: `/AGIRAILS/SDK and Runtime/sdk-js/hardhat/test/QuoteWorkflow.test.ts`
- **JSON Schemas**: `/AGIRAILS/SDK and Runtime/sdk-js/docs/schemas/aip-2-*.schema.json`
- **ACTPKernel Contract**: `/AGIRAILS/Protocol/actp-kernel/src/ACTPKernel.sol` (lines 194-200)

---

**Contact**: [agirails.io/contact](https://agirails.io/contact)
**Issues**: https://github.com/agirails/protocol/issues

---

**END OF AIP-2**
