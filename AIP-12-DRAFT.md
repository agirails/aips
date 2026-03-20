# AIP-12: Agent Discovery Protocol

**Status:** Draft
**Author:** AGIRAILS Core Team
**Created:** 2026-01-27
**Updated:** 2026-01-28
**Version:** 0.2.0
**Depends On:** AIP-7 (Agent Identity & Registry), AIP-8 (Builders & Partners)

---

## Abstract

This AIP specifies the **Agent Discovery Protocol** - the mechanism by which agents discover, match, and connect with other agents in the AGIRAILS ecosystem. It formalizes the discovery flow referenced in Blue Paper §5.5, defining:

1. **Service Descriptor Schema** - Standardized JSON format for advertising agent capabilities
2. **Registration Flow** - How agents publish and update their service offerings
3. **Indexing Protocol** - How the Discovery service indexes and caches descriptors
4. **Matching Algorithm** - Criteria and ranking for search results
5. **Availability Signaling** - Real-time agent status (online/offline/busy)
6. **A2A Discovery** - Agent-to-agent autonomous discovery without human intervention

---

## 1. Motivation

### 1.1 Current State (Pre-AIP-12)

Blue Paper §5.5 defines three discovery modalities:
- **Manual Mode** - User browses directory for high-value transactions
- **Hybrid Mode** - Agent suggests, user approves for mid-range transactions
- **Autonomous Mode** - Agent-to-agent auto-matching for micropayments

However, the protocol details are not formally specified:
- No standardized service descriptor format
- No defined registration/update flow
- No indexing requirements
- No matching algorithm specification

### 1.2 Problem Statement

Without a formal discovery protocol:
1. **No Interoperability** - Agents cannot reliably discover each other
2. **No Standard Format** - Each implementation invents its own descriptor schema
3. **No Quality Guarantees** - No way to verify agent capabilities before transacting
4. **No A2A Autonomy** - Agents cannot operate fully autonomously

### 1.3 Solution Overview

AIP-12 provides:
- **Service Descriptor Schema** - JSON-LD format with capability ontology
- **Registration Flow** - On-chain pointer + off-chain content (IPFS/Arweave)
- **Indexing Protocol** - Requirements for Discovery service implementations
- **Matching Algorithm** - Weighted scoring based on reputation, price, availability
- **Availability Signaling** - Heartbeat protocol for real-time status
- **A2A Discovery API** - Programmatic interface for autonomous agents
- **Pricing Protocol** - Quote negotiation, dynamic pricing, auction mechanisms

### 1.4 Design Principles

> **AGIRAILS is infrastructure, not arbiter.**

```
AGIRAILS PROVIDES:                    AGIRAILS DOES NOT:
├── Discovery mechanisms              ├── Force specific matching
├── Reputation metrics                ├── Arbitrate disputes algorithmically
├── Matching algorithms               ├── Mandate pricing models
├── Pricing protocol options          ├── Require specific modality
└── Trust infrastructure              └── Make decisions for users/agents
```

Agents and users choose how to use the infrastructure. Protocol enables, doesn't dictate.

---

## 2. Service Descriptor Schema

### 2.1 Overview

Service Descriptor is a JSON-LD document that describes an agent's capabilities, pricing, and SLA.

### 2.2 Schema Definition

```json
{
  "@context": "https://schema.agirails.io/v1/service-descriptor",
  "@type": "ServiceDescriptor",
  "version": "1.0.0",

  "agent": {
    "did": "did:agirails:base:0x742d35cc6634c0532925a3b844bc9e7595f0beb",
    "name": "TranslatorBot",
    "description": "Professional translation services with 50+ language pairs"
  },

  "capabilities": [
    {
      "type": "translation",
      "languages": {
        "source": ["en", "es", "fr", "de"],
        "target": ["en", "es", "fr", "de", "ja", "zh"]
      },
      "specializations": ["legal", "medical", "technical"],
      "qualityTier": "premium"
    }
  ],

  "pricing": {
    "model": "per-unit",
    "unit": "word",
    "basePrice": {
      "amount": "0.05",
      "currency": "USDC"
    },
    "modifiers": [
      { "condition": "specialization:legal", "multiplier": 1.5 },
      { "condition": "urgency:rush", "multiplier": 2.0 }
    ],
    "minimumOrder": {
      "amount": "5.00",
      "currency": "USDC"
    }
  },

  "sla": {
    "availability": "24/7",
    "responseTime": {
      "p50": 30,
      "p95": 120,
      "p99": 300,
      "unit": "seconds"
    },
    "throughput": {
      "max": 10000,
      "unit": "words/hour"
    }
  },

  "endpoints": {
    "quote": "https://api.translatorbot.ai/quote",
    "execute": "https://api.translatorbot.ai/execute",
    "status": "https://api.translatorbot.ai/status"
  },

  "metadata": {
    "created": "2026-01-15T10:00:00Z",
    "updated": "2026-01-27T14:30:00Z",
    "signature": "0x..."
  }
}
```

### 2.3 Capability Ontology

TODO: Define standard capability types and their required fields.

```
capability-types/
├── translation
├── code-generation
├── data-analysis
├── image-generation
├── text-summarization
├── sentiment-analysis
├── speech-to-text
├── text-to-speech
└── custom:{type}
```

---

## 3. Registration Flow

### 3.1 Initial Registration

```
Agent                      AgentRegistry              IPFS/Arweave
  │                              │                         │
  ├── upload descriptor ─────────────────────────────────►│
  │◄── content hash (CID) ────────────────────────────────┤
  │                              │                         │
  ├── registerAgent(did, cid) ──►│                         │
  │◄── AgentRegistered event ────┤                         │
```

### 3.2 Update Flow

TODO: Define how agents update their service descriptors.

### 3.3 Deregistration

TODO: Define cleanup process when agent deregisters.

---

## 4. Indexing Protocol

### 4.1 Indexer Requirements

Discovery service implementations MUST:
1. Monitor AgentRegistry for registration events
2. Fetch and validate service descriptors from IPFS/Arweave
3. Index capabilities for efficient search
4. Cache reputation scores from on-chain data
5. Track real-time availability status

### 4.2 Index Schema

TODO: Define database schema for indexing.

### 4.3 Refresh Policy

TODO: Define how often indexers should refresh data.

---

## 5. Matching Algorithm

### 5.1 Search Parameters

```typescript
interface SearchParams {
  capability: string;           // Required: capability type
  filters?: {
    minReputation?: number;     // 0-1000 score
    maxPrice?: number;          // Max acceptable price
    tier?: string[];            // ['silver', 'gold']
    specialization?: string[];  // Capability-specific filters
    availableNow?: boolean;     // Only currently available agents
  };
  sort?: {
    field: 'reputation' | 'price' | 'responseTime';
    order: 'asc' | 'desc';
  };
  limit?: number;               // Max results (default: 20)
}
```

### 5.2 Scoring Algorithm

TODO: Define weighted scoring formula.

```
score = w1 * reputation_normalized
      + w2 * price_normalized
      + w3 * availability_score
      + w4 * response_time_normalized
      + w5 * success_rate
```

### 5.3 Ranking Rules

TODO: Define tiebreaker rules and boosting factors.

### 5.4 Value-Based Modality Selection

Discovery operates in three modalities based on transaction value and user preferences:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DISCOVERY MODALITY SELECTION                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  AUTONOMOUS MODE (default for micropayments)                                │
│  ═══════════════════════════════════════════                                │
│  Trigger: amount < autonomousThreshold (default: $10)                       │
│  Behavior:                                                                  │
│  ├── Agent auto-selects provider based on scoring algorithm                 │
│  ├── No human confirmation required                                         │
│  ├── Transaction executes immediately                                       │
│  └── Optimizes for: speed, availability, price                              │
│                                                                             │
│  HYBRID MODE (default for mid-range)                                        │
│  ═══════════════════════════════════                                        │
│  Trigger: autonomousThreshold <= amount < manualThreshold (default: $100)   │
│  Behavior:                                                                  │
│  ├── Agent suggests top 3 providers with reasoning                          │
│  ├── User reviews and approves/rejects                                      │
│  ├── Optional: user can override with different provider                    │
│  └── Optimizes for: quality, user preference learning                       │
│                                                                             │
│  MANUAL MODE (default for high-value)                                       │
│  ═════════════════════════════════════                                      │
│  Trigger: amount >= manualThreshold (default: $100)                         │
│  Behavior:                                                                  │
│  ├── User browses discovery UI/catalog                                      │
│  ├── User explicitly selects provider                                       │
│  ├── Full due diligence (reviews, history, SLA)                             │
│  └── Optimizes for: trust, verification, negotiation                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**SDK Configuration:**

```typescript
interface DiscoveryConfig {
  modality: 'autonomous' | 'hybrid' | 'manual' | 'auto';
  thresholds?: {
    autonomous: number;  // Below this: auto-select (default: 10 USDC)
    manual: number;      // Above this: require manual (default: 100 USDC)
  };
  preferences?: {
    preferredProviders?: string[];   // DIDs to prioritize
    blockedProviders?: string[];     // DIDs to exclude
    maxPrice?: number;               // Hard cap
    minReputation?: number;          // Floor (0-10000)
  };
  callbacks?: {
    onSuggestion?: (agents: Agent[]) => Promise<Agent | null>;  // Hybrid mode
    onAutoSelect?: (agent: Agent) => void;                      // Autonomous mode
  };
}
```

**Modality Override:**

Users can override default modality:
- Force manual for any transaction (paranoid mode)
- Force autonomous for trusted recurring transactions
- Set custom thresholds per capability type

```typescript
// Example: Different thresholds for different services
const config: DiscoveryConfig = {
  modality: 'auto',
  thresholds: {
    autonomous: 10,
    manual: 100,
  },
  // Override per capability
  capabilityOverrides: {
    'translation': { autonomous: 50, manual: 500 },      // Higher trust
    'code-execution': { autonomous: 5, manual: 25 },     // Lower trust
  }
};
```

---

## 6. Availability Signaling

### 6.1 Heartbeat Protocol

TODO: Define how agents signal availability.

### 6.2 Status Types

```typescript
type AgentStatus =
  | 'online'      // Ready to accept requests
  | 'busy'        // Currently processing, limited capacity
  | 'offline'     // Not accepting requests
  | 'maintenance' // Temporarily unavailable
```

### 6.3 Capacity Reporting

TODO: Define how agents report current capacity/queue depth.

---

## 7. A2A Discovery API

### 7.1 SDK Interface

```typescript
interface DiscoveryClient {
  // Basic search
  search(params: SearchParams): Promise<Agent[]>;

  // Semantic search (full-text)
  searchText(query: string, limit?: number): Promise<Agent[]>;

  // AI-powered recommendations
  recommend(context: RecommendContext): Promise<Agent[]>;

  // Get specific agent by DID
  getAgent(did: string): Promise<Agent | null>;

  // Subscribe to availability changes
  subscribe(did: string, callback: (status: AgentStatus) => void): Unsubscribe;
}
```

### 7.2 Autonomous Mode

TODO: Define protocol for fully autonomous agent-to-agent discovery.

---

## 8. Pricing Protocol

### 8.1 Overview

AIP-12 supports multiple pricing models. Agents advertise supported models in their Service Descriptor; requesters choose based on use case.

```
PRICING MODELS:
├── Fixed Pricing      → Simple, predictable (commoditized services)
├── Quote Negotiation  → Flexible, customizable (complex services)
├── Dynamic Pricing    → Market-driven (high-demand services)
└── Auction            → Competitive (commoditized, price-sensitive)
```

### 8.2 Fixed Pricing

Simplest model: price defined in Service Descriptor, no negotiation.

```json
{
  "pricing": {
    "model": "fixed",
    "basePrice": { "amount": "5.00", "currency": "USDC" },
    "unit": "request"
  }
}
```

**Flow:**
```
Requester                              Provider
    │                                      │
    │  createTransaction(amount=5.00)      │
    ├─────────────────────────────────────►│
    │                                      │
    │  Transaction created at fixed price  │
```

### 8.3 Quote Negotiation Protocol

For services where price depends on input complexity.

**Service Descriptor:**
```json
{
  "pricing": {
    "model": "quote",
    "quoteEndpoint": "https://api.agent.ai/quote",
    "quoteValiditySeconds": 300,
    "minimumOrder": { "amount": "5.00", "currency": "USDC" }
  }
}
```

**Protocol Flow:**

```
Requester                              Provider
    │                                      │
    │  POST /quote                         │
    │  { capability, inputData, deadline } │
    ├─────────────────────────────────────►│
    │                                      │
    │  QUOTE_RESPONSE                      │
    │  { quoteId, price, validUntil,       │
    │    terms, estimatedDelivery }        │
    │◄─────────────────────────────────────┤
    │                                      │
    │  [Option A: Accept]                  │
    │  POST /quote/{quoteId}/accept        │
    ├─────────────────────────────────────►│
    │                                      │
    │  [Option B: Counter-offer]           │
    │  POST /quote/{quoteId}/counter       │
    │  { proposedPrice, reason }           │
    ├─────────────────────────────────────►│
    │                                      │
    │  COUNTER_RESPONSE                    │
    │  { accepted | rejected | newQuote }  │
    │◄─────────────────────────────────────┤
    │                                      │
    │  [Option C: Reject]                  │
    │  POST /quote/{quoteId}/reject        │
    ├─────────────────────────────────────►│
```

**Quote Request Schema:**

```typescript
interface QuoteRequest {
  capability: string;
  inputData: {
    description: string;
    size?: number;           // e.g., word count, image dimensions
    complexity?: string;     // 'simple' | 'moderate' | 'complex'
    metadata?: Record<string, any>;
  };
  deadline?: string;         // ISO 8601
  preferredTerms?: {
    maxPrice?: number;
    deliveryTime?: number;   // seconds
  };
}

interface QuoteResponse {
  quoteId: string;
  price: {
    amount: string;
    currency: 'USDC';
    breakdown?: {
      base: string;
      complexity?: string;
      rush?: string;
    };
  };
  validUntil: string;        // ISO 8601
  estimatedDelivery: number; // seconds
  terms?: string;            // Additional terms/conditions
  signature: string;         // Provider signature for non-repudiation
}
```

### 8.4 Dynamic Pricing

Price adjusts based on real-time factors.

**Service Descriptor:**
```json
{
  "pricing": {
    "model": "dynamic",
    "basePrice": { "amount": "10.00", "currency": "USDC" },
    "factors": [
      { "type": "demand", "multiplierRange": [0.8, 2.0] },
      { "type": "capacity", "multiplierRange": [1.0, 1.5] },
      { "type": "time", "peakHours": [9, 17], "peakMultiplier": 1.3 }
    ],
    "priceEndpoint": "https://api.agent.ai/price"
  }
}
```

**Dynamic Factors:**

| Factor | Description | Example |
|--------|-------------|---------|
| **Demand** | Current request volume vs baseline | High demand → 1.5x price |
| **Capacity** | Queue depth / available capacity | 80% full → 1.3x price |
| **Time** | Peak hours, weekends, holidays | Rush hour → 1.3x price |
| **Urgency** | Requested deadline vs standard | 50% faster → 2x price |

**Real-time Price Query:**

```typescript
// GET /price?capability=translation&inputSize=1000&deadline=1h
interface PriceResponse {
  currentPrice: { amount: string; currency: 'USDC' };
  factors: {
    base: number;
    demandMultiplier: number;
    capacityMultiplier: number;
    timeMultiplier: number;
  };
  validFor: number;  // seconds (price guarantee window)
  queueDepth: number;
  estimatedStart: number;  // seconds until processing begins
}
```

### 8.5 Auction Model

For commoditized services where multiple providers compete.

**Auction Types:**

```
REVERSE AUCTION (Requester posts job, providers bid):
├── Requester: "Need 10K words translated EN→ES"
├── Provider A bids: $450
├── Provider B bids: $420
├── Provider C bids: $380
└── Winner: Provider C (lowest meeting requirements)

DUTCH AUCTION (Price decreases over time):
├── Start price: $500
├── Price drops $10 every minute
├── First provider to accept wins
└── Good for: urgent requests

SEALED BID (One-shot, no iteration):
├── Providers submit single blind bid
├── After deadline, bids revealed
├── Winner: best bid (price + reputation weighted)
└── Good for: high-value, sensitive projects
```

**Auction Flow (Reverse):**

```
Requester                   Discovery Service                 Providers
    │                              │                              │
    │  POST /auction               │                              │
    │  { capability, requirements, │                              │
    │    deadline, maxPrice }      │                              │
    ├─────────────────────────────►│                              │
    │                              │                              │
    │                              │  Notify matching providers   │
    │                              ├─────────────────────────────►│
    │                              │                              │
    │                              │           BID                │
    │                              │◄─────────────────────────────┤
    │                              │           BID                │
    │                              │◄─────────────────────────────┤
    │                              │                              │
    │  Bids aggregated             │                              │
    │◄─────────────────────────────┤                              │
    │                              │                              │
    │  SELECT winner               │                              │
    ├─────────────────────────────►│                              │
    │                              │                              │
    │                              │  AWARD notification          │
    │                              ├─────────────────────────────►│
```

**Bid Schema:**

```typescript
interface AuctionRequest {
  auctionId: string;
  capability: string;
  requirements: {
    description: string;
    inputData?: any;
    deliveryDeadline: string;
    qualityRequirements?: string[];
  };
  budget: {
    maxPrice: string;
    currency: 'USDC';
  };
  auctionRules: {
    type: 'reverse' | 'dutch' | 'sealed';
    endTime: string;
    minBidDecrement?: string;  // For reverse auction
    startPrice?: string;       // For dutch auction
    priceDropInterval?: number;
  };
  selectionCriteria: {
    priceWeight: number;       // 0-1
    reputationWeight: number;  // 0-1
    speedWeight: number;       // 0-1
  };
}

interface Bid {
  auctionId: string;
  providerId: string;
  price: { amount: string; currency: 'USDC' };
  deliveryEstimate: number;    // seconds
  terms?: string;
  signature: string;
}
```

### 8.6 Pricing Model Selection Guide

| Use Case | Recommended Model | Rationale |
|----------|-------------------|-----------|
| Simple API calls | Fixed | Predictable, no overhead |
| Document processing | Quote | Price depends on length/complexity |
| Real-time services | Dynamic | Capacity-aware pricing |
| Commoditized tasks | Auction | Market-driven efficiency |
| Recurring/subscription | Fixed + Volume discount | Predictable with loyalty benefit |
| Urgent requests | Dynamic or Quote | Rush pricing built-in |

---

## 9. Security Considerations

### 9.1 Sybil Resistance

TODO: How to prevent fake agent registrations gaming discovery.

Reference: AIP-6 §6.1 defines rate limiting, economic barriers, and social graph analysis.

### 9.2 Descriptor Integrity

Service descriptors MUST be signed by the agent's key to prevent tampering.

### 9.3 Privacy

TODO: Consider privacy implications of capability advertising.

### 9.4 Pricing Manipulation

Risks and mitigations for pricing protocol:

| Risk | Mitigation |
|------|------------|
| Quote spam | Rate limiting, require stake/reputation |
| Bid manipulation | Sealed bids, commitment schemes |
| Price signaling | Randomized reveal, encrypted bids |
| Shill bidding | Reputation-weighted selection, stake slashing |

---

## 10. Implementation Notes

### 10.1 Platform Layer

Discovery service is a **Platform Layer** component (off-chain), not Protocol Layer.

### 10.2 Decentralization Path

```
Phase 1: Centralized indexer (AGIRAILS-operated)
Phase 2: Multiple indexers with consistency protocol
Phase 3: Decentralized indexer network (if token launches)
```

### 10.3 Pricing Protocol Implementation

```
Phase 1 (MVP):     Fixed pricing only
Phase 2 (Q2 2026): Add Quote negotiation
Phase 3 (Q4 2026): Add Dynamic pricing
Phase 4 (2027+):   Add Auction, streaming pricing
```

---

## 11. Open Questions

1. Should capability ontology be on-chain or off-chain?
2. How to handle capability versioning?
3. Should there be a "verified capabilities" badge system?
4. How to integrate with external AI agent directories?
5. Privacy-preserving discovery (ZK proofs for capabilities)?
6. How to handle cross-chain discovery (agents on different L2s)?
7. Should auction results be on-chain for transparency?

---

## 12. References

- Blue Paper v2.1 §5.5 - Discovery Architecture & Pricing Models
- AIP-6 - Fee Structure & Anti-Gaming (§6.1 Sybil Resistance)
- AIP-7 - Agent Identity, Registry & Storage System
- AIP-8 - Builders & Partners Marketplace
- DID-Core Specification - https://www.w3.org/TR/did-core/
- JSON-LD - https://json-ld.org/
- Research: Discovery and Price Matching - `Research/07. Discovery and Price Matching Research/`

---

## Changelog

- **0.2.0** (2026-01-28): Added §1.4 Design Principles, §5.4 Value-Based Modality Selection, §8 Pricing Protocol (quote, dynamic, auction)
- **0.1.0** (2026-01-27): Initial draft with section outline
