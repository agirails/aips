# AGIRAILS Improvement Proposals (AIPs)

[![AIPs](https://img.shields.io/badge/AIPs-12%20proposals-blue.svg)]()
[![Status](https://img.shields.io/badge/status-Active-brightgreen.svg)]()
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

Formal specifications defining the **Agent Commerce Transaction Protocol (ACTP)** — the standard for AI agent-to-agent payments with blockchain-based escrow.

## Proposals

### Core Protocol (AIP 0-6)

| AIP | Title | Status |
|-----|-------|--------|
| [AIP-0](./AIP-0.md) | Protocol Overview & State Machine | Final |
| [AIP-1](./AIP-1.md) | Transaction Creation | Final |
| [AIP-2](./AIP-2.md) | Escrow Management | Final |
| [AIP-3](./AIP-3.md) | State Transitions | Final |
| [AIP-4](./AIP-4.md) | Delivery Proofs & EAS | Final |
| [AIP-5](./AIP-5.md) | Dispute Resolution | Final |
| [AIP-6](./AIP-6.md) | Fee Structure | Final |

### Identity & Marketplace (AIP 7-8)

| AIP | Title | Status |
|-----|-------|--------|
| [AIP-7](./AIP-7.md) | Agent Identity Registry | Final |
| [AIP-8](./AIP-8.md) | Builders & Partners Marketplace | Draft |

### NFT & Trust Layer (AIP 9-11)

| AIP | Title | Status | Depends On |
|-----|-------|--------|------------|
| [AIP-9](./AIP-9.md) | Agent Passport NFT | Draft | AIP-7, AIP-8 |
| [AIP-10](./AIP-10.md) | Reputation Badges | Draft | AIP-8, AIP-9, AIP-11 |
| [AIP-11](./AIP-11.md) | Token Bound Accounts | Draft | AIP-9 |

## Protocol Overview

ACTP enables AI agents to:
- **Transact**: Pay each other for services using USDC
- **Trust**: Escrow ensures payment security for both parties
- **Verify**: On-chain attestations prove service delivery
- **Dispute**: Built-in resolution mechanism for conflicts

## NFT & Trust Layer

The NFT layer (AIP 9-11) provides portable identity and verifiable reputation:

- **Agent Passport (AIP-9)**: ERC-721 NFT representing agent ownership. `tokenId = uint256(uint160(agentAddress))` ensures deterministic, collision-free derivation. Tradeable on OpenSea/Blur.

- **Reputation Badges (AIP-10)**: Soulbound ERC-1155 badges earned through protocol usage. Uses AIP-8 thresholds ($1K GMV, 5 counterparties, 95% success). EAS attestations are source of truth.

- **Token Bound Accounts (AIP-11)**: Passive ERC-6551 wallets that hold badges. CANNOT execute or sign - receive-only design minimizes attack surface. Badges travel with Passport on transfer.

```
Agent Passport (ERC-721)
    └── Token Bound Account (ERC-6551)
            ├── AGENT_PRODUCTION badge
            ├── SPEED_CERTIFIED badge
            └── QUALITY_VERIFIED badge
```

## State Machine

```
INITIATED → QUOTED → COMMITTED → IN_PROGRESS → DELIVERED → SETTLED
                ↘                      ↘              ↘
              CANCELLED              CANCELLED      DISPUTED → SETTLED
```

## Implementation

- **Smart Contracts**: [actp-kernel](https://github.com/agirails/actp-kernel)
- **TypeScript SDK**: [sdk-js](https://github.com/agirails/sdk-js)
- **Python SDK**: [sdk-python](https://github.com/agirails/sdk-python)

## Contributing

1. Fork this repository
2. Create a new AIP following the template in existing AIPs
3. Submit a Pull Request with your proposal
4. Discuss in [Discord](https://discord.gg/nuhCt75qe4)

## Links

- [AGIRAILS Documentation](https://docs.agirails.io)
- [ACTP Kernel](https://github.com/agirails/actp-kernel)
- [Discord](https://discord.gg/nuhCt75qe4)
- [Website](https://agirails.io)

## License

[Apache-2.0](./LICENSE)
