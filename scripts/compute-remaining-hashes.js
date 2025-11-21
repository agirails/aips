/**
 * Compute hashes for remaining test vectors
 */

const crypto = require('crypto');

function canonicalJsonStringify(obj) {
  if (obj === null) return 'null';
  if (obj === undefined) return 'undefined';

  const type = typeof obj;

  if (type === 'boolean') return obj.toString();
  if (type === 'number') {
    if (Number.isInteger(obj)) {
      return obj.toString();
    } else {
      const fixed = obj.toFixed(18);
      return fixed.replace(/\.?0+$/, '');
    }
  }
  if (type === 'string') {
    return JSON.stringify(obj);
  }

  if (Array.isArray(obj)) {
    const items = obj.map(item => canonicalJsonStringify(item));
    return '[' + items.join(',') + ']';
  }

  if (type === 'object') {
    const keys = Object.keys(obj).sort();
    const pairs = keys.map(key => {
      const value = canonicalJsonStringify(obj[key]);
      return `"${key}":${value}`;
    });
    return '{' + pairs.join(',') + '}';
  }

  throw new Error(`Unsupported type: ${type}`);
}

function hashRequestMetadata(metadata) {
  const canonical = canonicalJsonStringify(metadata);
  const hash = crypto.createHash('sha3-256');
  hash.update(canonical, 'utf8');
  return '0x' + hash.digest('hex');
}

// Test Vector 2: Full-featured request
const fullFeaturedRequest = {
  "version": "1.0.0",
  "serviceType": "code-generation",
  "requestId": "req_full_002",
  "consumer": "did:ethr:84532:0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "provider": "did:ethr:84532:0x8f4e7d2a9c1b5e3f6a8d2c4e1f7b9a3d5c8e2f6a",
  "chainId": 84532,
  "inputData": {
    "language": "python",
    "task": "Create a REST API for user authentication",
    "framework": "FastAPI",
    "includeTests": true
  },
  "deliveryRequirements": {
    "format": "url",
    "schema": "https://schema.agirails.io/code-delivery-v1.json",
    "minQuality": 0.9,
    "maxLatency": 300
  },
  "paymentTerms": {
    "amount": "50000000",
    "currency": "USDC",
    "decimals": 6,
    "maxPrice": "100000000",
    "deadline": 1732200000,
    "disputeWindow": 14400
  },
  "metadata": {
    "priority": "high",
    "callbackUrl": "https://consumer.example.com/webhooks/delivery",
    "tags": ["code", "python", "api"]
  },
  "timestamp": 1731700000
};

// Test Vector 3: Edge case - maxPrice equals amount
const maxPriceEdgeCase = {
  "version": "1.0.0",
  "serviceType": "text-generation",
  "requestId": "req_edge_001",
  "consumer": "did:ethr:84532:0x1234567890123456789012345678901234567890",
  "provider": "did:ethr:84532:0x0987654321098765432109876543210987654321",
  "chainId": 84532,
  "inputData": {
    "prompt": "Test"
  },
  "paymentTerms": {
    "amount": "5000000",
    "currency": "USDC",
    "decimals": 6,
    "maxPrice": "5000000",
    "deadline": 1732000000,
    "disputeWindow": 3600
  },
  "timestamp": 1731700000
};

// Test Vector 4: Base Mainnet
const mainnetRequest = {
  "version": "1.0.0",
  "serviceType": "text-generation",
  "requestId": "req_mainnet_001",
  "consumer": "did:ethr:8453:0x1234567890123456789012345678901234567890",
  "provider": "did:ethr:8453:0x0987654321098765432109876543210987654321",
  "chainId": 8453,
  "inputData": {
    "prompt": "Production request"
  },
  "paymentTerms": {
    "amount": "1000000",
    "currency": "USDC",
    "decimals": 6,
    "deadline": 1732000000,
    "disputeWindow": 7200
  },
  "timestamp": 1731700000
};

console.log('=== Remaining Test Vector Hashes ===\n');

console.log('Test Vector 2: Full-Featured Request');
const canonical2 = canonicalJsonStringify(fullFeaturedRequest);
const hash2 = hashRequestMetadata(fullFeaturedRequest);
console.log('Canonical JSON:', canonical2.substring(0, 100) + '...');
console.log('Keccak256 Hash:', hash2);
console.log();

console.log('Test Vector 3: Edge Case - maxPrice = amount');
const canonical3 = canonicalJsonStringify(maxPriceEdgeCase);
const hash3 = hashRequestMetadata(maxPriceEdgeCase);
console.log('Canonical JSON:', canonical3.substring(0, 100) + '...');
console.log('Keccak256 Hash:', hash3);
console.log();

console.log('Test Vector 4: Base Mainnet');
const canonical4 = canonicalJsonStringify(mainnetRequest);
const hash4 = hashRequestMetadata(mainnetRequest);
console.log('Canonical JSON:', canonical4.substring(0, 100) + '...');
console.log('Keccak256 Hash:', hash4);
console.log();

console.log('=== Summary ===');
console.log('Full-Featured Request Hash:', hash2);
console.log('Max-Price Edge Case Hash:', hash3);
console.log('Base Mainnet Request Hash:', hash4);
