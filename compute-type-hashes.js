/**
 * EIP-712 Type Hash Computation for AIP-0 Message Registry
 *
 * This script computes the keccak256 hash of each message type's
 * EIP-712 type string for inclusion in AIP-0 §5.2
 *
 * Run: node compute-type-hashes.js
 */

const crypto = require('crypto');

/**
 * Keccak256 hash implementation
 */
function keccak256(data) {
  return '0x' + crypto.createHash('sha3-256').update(data).digest('hex');
}

/**
 * Helper function to encode EIP-712 type string
 */
function encodeType(name, fields) {
  const fieldStrings = fields.map(f => `${f.type} ${f.name}`);
  return `${name}(${fieldStrings.join(',')})`;
}

/**
 * Compute type hash
 */
function computeTypeHash(name, fields) {
  const typeString = encodeType(name, fields);
  const hash = keccak256(typeString);
  return hash;
}

// =============================================================================
// AIP-0.1: Notification
// =============================================================================

const NotificationFields = [
  { name: 'type', type: 'string' },
  { name: 'version', type: 'string' },
  { name: 'txId', type: 'bytes32' },
  { name: 'cid', type: 'string' },
  { name: 'consumer', type: 'string' },
  { name: 'provider', type: 'string' },
  { name: 'chainId', type: 'uint256' },
  { name: 'timestamp', type: 'uint256' },
  { name: 'nonce', type: 'uint256' }
];

const notificationTypeString = encodeType('Notification', NotificationFields);
const notificationHash = computeTypeHash('Notification', NotificationFields);

console.log('=== AIP-0.1: agirails.notification.v1 ===');
console.log('Type String:', notificationTypeString);
console.log('Type Hash:', notificationHash);
console.log();

// =============================================================================
// AIP-1: Request
// =============================================================================

const RequestFields = [
  { name: 'version', type: 'string' },
  { name: 'serviceType', type: 'string' },
  { name: 'requestId', type: 'string' },
  { name: 'consumer', type: 'string' },
  { name: 'provider', type: 'string' },
  { name: 'chainId', type: 'uint256' },
  { name: 'inputDataHash', type: 'bytes32' },
  { name: 'amount', type: 'uint256' },
  { name: 'deadline', type: 'uint256' },
  { name: 'disputeWindow', type: 'uint256' },
  { name: 'timestamp', type: 'uint256' },
  { name: 'nonce', type: 'uint256' }
];

const requestTypeString = encodeType('Request', RequestFields);
const requestHash = computeTypeHash('Request', RequestFields);

console.log('=== AIP-1: agirails.request.v1 ===');
console.log('Type String:', requestTypeString);
console.log('Type Hash:', requestHash);
console.log();

// =============================================================================
// AIP-2: Quote (already defined in SDK)
// =============================================================================

const QuoteRequestFields = [
  { name: 'from', type: 'string' },
  { name: 'to', type: 'string' },
  { name: 'timestamp', type: 'uint256' },
  { name: 'nonce', type: 'bytes32' },
  { name: 'serviceType', type: 'string' },
  { name: 'requirements', type: 'string' },
  { name: 'deadline', type: 'uint256' },
  { name: 'disputeWindow', type: 'uint256' }
];

const quoteRequestTypeString = encodeType('QuoteRequest', QuoteRequestFields);
const quoteRequestHash = computeTypeHash('QuoteRequest', QuoteRequestFields);

console.log('=== AIP-2: agirails.quote.v1 (QuoteRequest) ===');
console.log('Type String:', quoteRequestTypeString);
console.log('Type Hash:', quoteRequestHash);
console.log();

// =============================================================================
// AIP-3: Discovery
// =============================================================================

const DiscoveryFields = [
  { name: 'from', type: 'string' },
  { name: 'serviceType', type: 'string' },
  { name: 'minReputation', type: 'uint256' },
  { name: 'maxPrice', type: 'uint256' },
  { name: 'requiredCapabilities', type: 'string' },
  { name: 'chainId', type: 'uint256' },
  { name: 'timestamp', type: 'uint256' },
  { name: 'nonce', type: 'uint256' }
];

const discoveryTypeString = encodeType('Discovery', DiscoveryFields);
const discoveryHash = computeTypeHash('Discovery', DiscoveryFields);

console.log('=== AIP-3: agirails.discovery.v1 ===');
console.log('Type String:', discoveryTypeString);
console.log('Type Hash:', discoveryHash);
console.log();

// =============================================================================
// AIP-4: Delivery (already defined in SDK)
// =============================================================================

const DeliveryProofFields = [
  { name: 'txId', type: 'bytes32' },
  { name: 'provider', type: 'string' },
  { name: 'consumer', type: 'string' },
  { name: 'resultCID', type: 'string' },
  { name: 'resultHash', type: 'bytes32' },
  { name: 'easAttestationUID', type: 'bytes32' },
  { name: 'deliveredAt', type: 'uint256' },
  { name: 'chainId', type: 'uint256' },
  { name: 'nonce', type: 'uint256' }
];

const deliveryProofTypeString = encodeType('DeliveryProof', DeliveryProofFields);
const deliveryProofHash = computeTypeHash('DeliveryProof', DeliveryProofFields);

console.log('=== AIP-4: agirails.delivery.v1 ===');
console.log('Type String:', deliveryProofTypeString);
console.log('Type Hash:', deliveryProofHash);
console.log();

// =============================================================================
// AIP-5: Dispute
// =============================================================================

const DisputeFields = [
  { name: 'txId', type: 'bytes32' },
  { name: 'consumer', type: 'string' },
  { name: 'provider', type: 'string' },
  { name: 'reason', type: 'string' },
  { name: 'evidenceCID', type: 'string' },
  { name: 'evidenceHash', type: 'bytes32' },
  { name: 'chainId', type: 'uint256' },
  { name: 'timestamp', type: 'uint256' },
  { name: 'nonce', type: 'uint256' }
];

const disputeTypeString = encodeType('Dispute', DisputeFields);
const disputeHash = computeTypeHash('Dispute', DisputeFields);

console.log('=== AIP-5: agirails.dispute.v1 ===');
console.log('Type String:', disputeTypeString);
console.log('Type Hash:', disputeHash);
console.log();

// =============================================================================
// AIP-6: Resolution
// =============================================================================

const ResolutionFields = [
  { name: 'txId', type: 'bytes32' },
  { name: 'mediator', type: 'string' },
  { name: 'consumer', type: 'string' },
  { name: 'provider', type: 'string' },
  { name: 'ruling', type: 'string' },
  { name: 'consumerShare', type: 'uint256' },
  { name: 'providerShare', type: 'uint256' },
  { name: 'reasoning', type: 'string' },
  { name: 'chainId', type: 'uint256' },
  { name: 'timestamp', type: 'uint256' },
  { name: 'nonce', type: 'uint256' }
];

const resolutionTypeString = encodeType('Resolution', ResolutionFields);
const resolutionHash = computeTypeHash('Resolution', ResolutionFields);

console.log('=== AIP-6: agirails.resolution.v1 ===');
console.log('Type String:', resolutionTypeString);
console.log('Type Hash:', resolutionHash);
console.log();

// =============================================================================
// Summary Table (for AIP-0 Update)
// =============================================================================

console.log('=======================================================================');
console.log('SUMMARY: EIP-712 Type Hashes for AIP-0 §5.2 Message Registry');
console.log('=======================================================================');
console.log();
console.log('| AIP     | Message Type                    | EIP-712 Type Hash |');
console.log('|---------|----------------------------------|-------------------|');
console.log(`| AIP-0.1 | agirails.notification.v1        | ${notificationHash} |`);
console.log(`| AIP-1   | agirails.request.v1             | ${requestHash} |`);
console.log(`| AIP-2   | agirails.quote.v1               | ${quoteRequestHash} |`);
console.log(`| AIP-3   | agirails.discovery.v1           | ${discoveryHash} |`);
console.log(`| AIP-4   | agirails.delivery.v1            | ${deliveryProofHash} |`);
console.log(`| AIP-5   | agirails.dispute.v1             | ${disputeHash} |`);
console.log(`| AIP-6   | agirails.resolution.v1          | ${resolutionHash} |`);
console.log();
console.log('=======================================================================');
console.log('IMPORTANT: Copy these hashes to AIP-0.md lines 820-826');
console.log('=======================================================================');
