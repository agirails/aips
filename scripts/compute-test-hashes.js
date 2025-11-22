/**
 * Utility script to compute canonical JSON hashes for AIP-1 test vectors
 * Uses Node.js built-in crypto module (no external dependencies)
 *
 * Run: node compute-test-hashes.js
 */

const crypto = require('crypto');

/**
 * Canonical JSON stringify implementation per AIP-0 §3.2
 */
function canonicalJsonStringify(obj) {
  if (obj === null) return 'null';
  if (obj === undefined) return 'undefined';

  const type = typeof obj;

  if (type === 'boolean') return obj.toString();
  if (type === 'number') {
    if (Number.isInteger(obj)) {
      return obj.toString();
    } else {
      // Limit to 18 decimal places for floats
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
    // Sort keys alphabetically
    const keys = Object.keys(obj).sort();
    const pairs = keys.map(key => {
      const value = canonicalJsonStringify(obj[key]);
      return `"${key}":${value}`;
    });
    return '{' + pairs.join(',') + '}';
  }

  throw new Error(`Unsupported type: ${type}`);
}

/**
 * Hash request metadata using canonical JSON + keccak256
 */
function hashRequestMetadata(metadata) {
  const canonical = canonicalJsonStringify(metadata);

  // Keccak256 using Node's crypto (requires Node 12+)
  const hash = crypto.createHash('sha3-256');
  hash.update(canonical, 'utf8');
  return '0x' + hash.digest('hex');
}

// Test Vector 1: Minimal Valid Request
const minimalRequest = {
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
};

// Test Vector 2: Canonical JSON example (key sorting)
const keySortingExample = {
  "z": 1,
  "a": 2,
  "m": {
    "y": 3,
    "x": 4
  }
};

// Test Vector 3: Number formatting example
const numberFormattingExample = {
  "integer": 42,
  "float": 3.14159265358979323846
};

console.log('=== AIP-1 Test Vector Hashes ===\n');

console.log('Test Vector 1: Minimal Valid Request');
const canonical1 = canonicalJsonStringify(minimalRequest);
const hash1 = hashRequestMetadata(minimalRequest);
console.log('Canonical JSON:', canonical1);
console.log('Keccak256 Hash:', hash1);
console.log();

console.log('Test Vector 2: Key Sorting');
const canonical2 = canonicalJsonStringify(keySortingExample);
const hash2 = hashRequestMetadata(keySortingExample);
console.log('Input:', JSON.stringify(keySortingExample));
console.log('Canonical JSON:', canonical2);
console.log('Expected:', '{"a":2,"m":{"x":4,"y":3},"z":1}');
console.log('Match:', canonical2 === '{"a":2,"m":{"x":4,"y":3},"z":1}');
console.log('Keccak256 Hash:', hash2);
console.log();

console.log('Test Vector 3: Number Formatting');
const canonical3 = canonicalJsonStringify(numberFormattingExample);
const hash3 = hashRequestMetadata(numberFormattingExample);
console.log('Input:', JSON.stringify(numberFormattingExample));
console.log('Canonical JSON:', canonical3);
console.log('Keccak256 Hash:', hash3);
console.log();

// Output for AIP-1.md Appendix C
console.log('=== For AIP-1.md Appendix C ===\n');
console.log('**Expected Hash (Minimal Valid Request):**');
console.log('```');
console.log(hash1);
console.log('```');
console.log();
console.log('**Canonical JSON (for verification):**');
console.log('```');
console.log(canonical1);
console.log('```');
console.log();
console.log('**Key Sorting Example Hash:**');
console.log('```');
console.log(hash2);
console.log('```');
