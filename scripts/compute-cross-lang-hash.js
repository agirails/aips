/**
 * Compute hash for cross-language compatibility test vector
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

// Cross-language compatibility test vector
const crossLangRequest = {
  "version": "1.0.0",
  "serviceType": "text-generation",
  "requestId": "req_cross_lang_001",
  "consumer": "did:ethr:84532:0x1234567890123456789012345678901234567890",
  "provider": "did:ethr:84532:0x0987654321098765432109876543210987654321",
  "chainId": 84532,
  "inputData": {
    "prompt": "Hello"
  },
  "paymentTerms": {
    "amount": "1000000",
    "currency": "USDC",
    "decimals": 6,
    "deadline": 1732000000,
    "disputeWindow": 3600
  },
  "timestamp": 1731700000
};

console.log('=== Cross-Language Compatibility Test Vector ===\n');

const canonical = canonicalJsonStringify(crossLangRequest);
const hash = hashRequestMetadata(crossLangRequest);

console.log('Metadata:');
console.log(JSON.stringify(crossLangRequest, null, 2));
console.log();

console.log('Canonical JSON:');
console.log(canonical);
console.log();

console.log('Keccak256 Hash:');
console.log(hash);
console.log();

console.log('=== Verification ===');
console.log('This hash MUST be identical across all language implementations');
console.log('(TypeScript, Python, Go, Rust, Java)');
console.log();
console.log('Hash to use in test-vectors.json:');
console.log(hash);
