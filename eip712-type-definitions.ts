/**
 * Complete EIP-712 Type Definitions for AGIRAILS Message Types
 *
 * This file contains all 7 message type definitions with computed type hashes.
 * Ready for integration into @agirails/sdk
 *
 * Generated: 2025-11-24
 * Reference: AIP-0 §5.2 Message Type Registry
 */

/**
 * EIP-712 Domain for ACTP
 */
export interface EIP712Domain {
  name: string;
  version: string;
  chainId: number;
  verifyingContract: string;
}

/**
 * Standard ACTP Domain Configuration
 */
export const ACTP_DOMAIN: Omit<EIP712Domain, 'chainId' | 'verifyingContract'> = {
  name: 'AGIRAILS',
  version: '1'
};

// =============================================================================
// AIP-0.1: Notification (agirails.notification.v1)
// =============================================================================

export const NotificationTypes = {
  Notification: [
    { name: 'type', type: 'string' },           // 'agirails.notification.v1'
    { name: 'version', type: 'string' },        // '1.0.0'
    { name: 'txId', type: 'bytes32' },          // Transaction ID
    { name: 'cid', type: 'string' },            // IPFS CID of request metadata
    { name: 'consumer', type: 'string' },       // Consumer DID
    { name: 'provider', type: 'string' },       // Provider DID
    { name: 'chainId', type: 'uint256' },       // Network ID
    { name: 'timestamp', type: 'uint256' },     // Unix timestamp
    { name: 'nonce', type: 'uint256' }          // Replay protection
  ]
};

export interface NotificationData {
  type: 'agirails.notification.v1';
  version: string;
  txId: string;                 // bytes32 as hex string
  cid: string;                  // IPFS CID
  consumer: string;             // DID
  provider: string;             // DID
  chainId: number;
  timestamp: number;
  nonce: number;
}

/**
 * Type Hash: Notification(string type,string version,bytes32 txId,string cid,string consumer,string provider,uint256 chainId,uint256 timestamp,uint256 nonce)
 */
export const NOTIFICATION_TYPE_HASH = '0xa02f2574276a8ca75bfdad3fc381f36324358b535685db9f507708ee9490c8e9';

// =============================================================================
// AIP-1: Request (agirails.request.v1)
// =============================================================================

export const RequestTypes = {
  Request: [
    { name: 'version', type: 'string' },        // '1.0.0'
    { name: 'serviceType', type: 'string' },    // Service category
    { name: 'requestId', type: 'string' },      // Consumer-generated ID
    { name: 'consumer', type: 'string' },       // Consumer DID
    { name: 'provider', type: 'string' },       // Provider DID
    { name: 'chainId', type: 'uint256' },       // Network ID
    { name: 'inputDataHash', type: 'bytes32' }, // Hash of inputData object
    { name: 'amount', type: 'uint256' },        // Payment amount (base units)
    { name: 'deadline', type: 'uint256' },      // Transaction deadline
    { name: 'disputeWindow', type: 'uint256' }, // Dispute window (seconds)
    { name: 'timestamp', type: 'uint256' },     // Request creation time
    { name: 'nonce', type: 'uint256' }          // Replay protection
  ]
};

export interface RequestData {
  version: string;
  serviceType: string;
  requestId: string;
  consumer: string;             // DID
  provider: string;             // DID
  chainId: number;
  inputDataHash: string;        // bytes32 as hex string
  amount: string;               // uint256 as string (BigNumber)
  deadline: number;
  disputeWindow: number;
  timestamp: number;
  nonce: number;
}

/**
 * Type Hash: Request(string version,string serviceType,string requestId,string consumer,string provider,uint256 chainId,bytes32 inputDataHash,uint256 amount,uint256 deadline,uint256 disputeWindow,uint256 timestamp,uint256 nonce)
 */
export const REQUEST_TYPE_HASH = '0x445f1b6560f0d4302d32fa3677ce3a4130fcd347b333c333f78e2725d42b12c7';

// =============================================================================
// AIP-2: Quote (agirails.quote.v1)
// =============================================================================

export const QuoteRequestTypes = {
  QuoteRequest: [
    { name: 'from', type: 'string' },           // DID
    { name: 'to', type: 'string' },             // DID
    { name: 'timestamp', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
    { name: 'serviceType', type: 'string' },
    { name: 'requirements', type: 'string' },
    { name: 'deadline', type: 'uint256' },
    { name: 'disputeWindow', type: 'uint256' }
  ]
};

export interface QuoteRequestData {
  from: string;
  to: string;
  timestamp: number;
  nonce: string;                // bytes32 as hex string
  serviceType: string;
  requirements: string;
  deadline: number;
  disputeWindow: number;
}

/**
 * Type Hash: QuoteRequest(string from,string to,uint256 timestamp,bytes32 nonce,string serviceType,string requirements,uint256 deadline,uint256 disputeWindow)
 */
export const QUOTE_REQUEST_TYPE_HASH = '0x3a250619f2f54b815ae7a1b3219f8a958f9cde40186233bee134b4b9d7095407';

// =============================================================================
// AIP-3: Discovery (agirails.discovery.v1)
// =============================================================================

export const DiscoveryTypes = {
  Discovery: [
    { name: 'from', type: 'string' },           // Requester DID
    { name: 'serviceType', type: 'string' },    // Requested service
    { name: 'minReputation', type: 'uint256' }, // Minimum reputation score (0-10000)
    { name: 'maxPrice', type: 'uint256' },      // Maximum acceptable price
    { name: 'requiredCapabilities', type: 'string' }, // Comma-separated capabilities
    { name: 'chainId', type: 'uint256' },       // Network ID
    { name: 'timestamp', type: 'uint256' },     // Query timestamp
    { name: 'nonce', type: 'uint256' }          // Replay protection
  ]
};

export interface DiscoveryData {
  from: string;                 // DID
  serviceType: string;
  minReputation: number;        // 0-10000 basis points
  maxPrice: string;             // uint256 as string (BigNumber)
  requiredCapabilities: string;
  chainId: number;
  timestamp: number;
  nonce: number;
}

/**
 * Type Hash: Discovery(string from,string serviceType,uint256 minReputation,uint256 maxPrice,string requiredCapabilities,uint256 chainId,uint256 timestamp,uint256 nonce)
 */
export const DISCOVERY_TYPE_HASH = '0x34e59475223edfc59d786cb2f8c921a61f2bf4cf7f64bc28b847f9448d16e7a2';

// =============================================================================
// AIP-4: Delivery (agirails.delivery.v1)
// =============================================================================

export const DeliveryProofTypes = {
  DeliveryProof: [
    { name: 'txId', type: 'bytes32' },
    { name: 'provider', type: 'string' },
    { name: 'consumer', type: 'string' },
    { name: 'resultCID', type: 'string' },
    { name: 'resultHash', type: 'bytes32' },
    { name: 'easAttestationUID', type: 'bytes32' },
    { name: 'deliveredAt', type: 'uint256' },
    { name: 'chainId', type: 'uint256' },
    { name: 'nonce', type: 'uint256' }
  ]
};

export interface DeliveryProofData {
  txId: string;                 // bytes32 as hex string
  provider: string;             // DID
  consumer: string;             // DID
  resultCID: string;            // IPFS CID
  resultHash: string;           // bytes32 as hex string
  easAttestationUID: string;    // bytes32 as hex string
  deliveredAt: number;
  chainId: number;
  nonce: number;
}

/**
 * Type Hash: DeliveryProof(bytes32 txId,string provider,string consumer,string resultCID,bytes32 resultHash,bytes32 easAttestationUID,uint256 deliveredAt,uint256 chainId,uint256 nonce)
 */
export const DELIVERY_PROOF_TYPE_HASH = '0x7974f677eb16e762b690ee2ec91d75e28a770e2a1ea6fea824eddff6ea9a855b';

// =============================================================================
// AIP-5: Dispute (agirails.dispute.v1)
// =============================================================================

export const DisputeTypes = {
  Dispute: [
    { name: 'txId', type: 'bytes32' },          // Transaction being disputed
    { name: 'consumer', type: 'string' },       // Consumer DID (disputer)
    { name: 'provider', type: 'string' },       // Provider DID (disputed party)
    { name: 'reason', type: 'string' },         // Dispute reason category
    { name: 'evidenceCID', type: 'string' },    // IPFS CID of evidence
    { name: 'evidenceHash', type: 'bytes32' },  // Hash of evidence data
    { name: 'chainId', type: 'uint256' },       // Network ID
    { name: 'timestamp', type: 'uint256' },     // Dispute submission time
    { name: 'nonce', type: 'uint256' }          // Replay protection
  ]
};

export interface DisputeData {
  txId: string;                 // bytes32 as hex string
  consumer: string;             // DID
  provider: string;             // DID
  reason: string;               // e.g., 'incomplete', 'poor_quality', 'wrong_format'
  evidenceCID: string;          // IPFS CID
  evidenceHash: string;         // bytes32 as hex string
  chainId: number;
  timestamp: number;
  nonce: number;
}

/**
 * Type Hash: Dispute(bytes32 txId,string consumer,string provider,string reason,string evidenceCID,bytes32 evidenceHash,uint256 chainId,uint256 timestamp,uint256 nonce)
 */
export const DISPUTE_TYPE_HASH = '0x118a9fe5aef5b766734aa976f70c90a40c4c1144c599a0405a60c18199f9ee66';

// =============================================================================
// AIP-6: Resolution (agirails.resolution.v1)
// =============================================================================

export const ResolutionTypes = {
  Resolution: [
    { name: 'txId', type: 'bytes32' },          // Transaction being resolved
    { name: 'mediator', type: 'string' },       // Mediator DID
    { name: 'consumer', type: 'string' },       // Consumer DID
    { name: 'provider', type: 'string' },       // Provider DID
    { name: 'ruling', type: 'string' },         // Ruling: 'consumer', 'provider', 'split'
    { name: 'consumerShare', type: 'uint256' }, // Basis points (0-10000)
    { name: 'providerShare', type: 'uint256' }, // Basis points (0-10000)
    { name: 'reasoning', type: 'string' },      // Decision rationale
    { name: 'chainId', type: 'uint256' },       // Network ID
    { name: 'timestamp', type: 'uint256' },     // Resolution timestamp
    { name: 'nonce', type: 'uint256' }          // Replay protection
  ]
};

export interface ResolutionData {
  txId: string;                 // bytes32 as hex string
  mediator: string;             // DID
  consumer: string;             // DID
  provider: string;             // DID
  ruling: 'consumer' | 'provider' | 'split';
  consumerShare: number;        // 0-10000 basis points
  providerShare: number;        // 0-10000 basis points
  reasoning: string;
  chainId: number;
  timestamp: number;
  nonce: number;
}

/**
 * Type Hash: Resolution(bytes32 txId,string mediator,string consumer,string provider,string ruling,uint256 consumerShare,uint256 providerShare,string reasoning,uint256 chainId,uint256 timestamp,uint256 nonce)
 */
export const RESOLUTION_TYPE_HASH = '0x4312d59902c52428cc3c348e24d4b7b3922b50e0e2c9f8a16ee504f5ec6d1fc2';

// =============================================================================
// Registry Export
// =============================================================================

/**
 * Complete message type registry with type hashes
 */
export const MESSAGE_TYPE_REGISTRY = {
  'agirails.notification.v1': {
    types: NotificationTypes,
    typeHash: NOTIFICATION_TYPE_HASH,
    aip: 'AIP-0.1'
  },
  'agirails.request.v1': {
    types: RequestTypes,
    typeHash: REQUEST_TYPE_HASH,
    aip: 'AIP-1'
  },
  'agirails.quote.v1': {
    types: QuoteRequestTypes,
    typeHash: QUOTE_REQUEST_TYPE_HASH,
    aip: 'AIP-2'
  },
  'agirails.discovery.v1': {
    types: DiscoveryTypes,
    typeHash: DISCOVERY_TYPE_HASH,
    aip: 'AIP-3'
  },
  'agirails.delivery.v1': {
    types: DeliveryProofTypes,
    typeHash: DELIVERY_PROOF_TYPE_HASH,
    aip: 'AIP-4'
  },
  'agirails.dispute.v1': {
    types: DisputeTypes,
    typeHash: DISPUTE_TYPE_HASH,
    aip: 'AIP-5'
  },
  'agirails.resolution.v1': {
    types: ResolutionTypes,
    typeHash: RESOLUTION_TYPE_HASH,
    aip: 'AIP-6'
  }
} as const;

/**
 * Get EIP-712 types for a message type identifier
 */
export function getMessageTypes(messageType: string): Record<string, any> {
  const entry = MESSAGE_TYPE_REGISTRY[messageType as keyof typeof MESSAGE_TYPE_REGISTRY];
  if (!entry) {
    throw new Error(`Unknown message type: ${messageType}`);
  }
  return entry.types;
}

/**
 * Get type hash for a message type identifier
 */
export function getTypeHash(messageType: string): string {
  const entry = MESSAGE_TYPE_REGISTRY[messageType as keyof typeof MESSAGE_TYPE_REGISTRY];
  if (!entry) {
    throw new Error(`Unknown message type: ${messageType}`);
  }
  return entry.typeHash;
}
