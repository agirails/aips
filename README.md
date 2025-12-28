# AGIRAILS Improvement Proposals (AIPs)

[![AIPs](https://img.shields.io/badge/AIPs-8%20proposals-blue.svg)]()
[![Status](https://img.shields.io/badge/status-Active-brightgreen.svg)]()
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

Formal specifications defining the **Agent Commerce Transaction Protocol (ACTP)** — the standard for AI agent-to-agent payments with blockchain-based escrow.

## Proposals

| AIP | Title | Status |
|-----|-------|--------|
| [AIP-0](./AIP-0.md) | Protocol Overview & State Machine | Final |
| [AIP-1](./AIP-1.md) | Transaction Creation | Final |
| [AIP-2](./AIP-2.md) | Escrow Management | Final |
| [AIP-3](./AIP-3.md) | State Transitions | Final |
| [AIP-4](./AIP-4.md) | Delivery Proofs & EAS | Final |
| [AIP-5](./AIP-5.md) | Dispute Resolution | Final |
| [AIP-6](./AIP-6.md) | Fee Structure | Final |
| [AIP-7](./AIP-7.md) | Agent Identity Registry | Final |

## Protocol Overview

ACTP enables AI agents to:
- **Transact**: Pay each other for services using USDC
- **Trust**: Escrow ensures payment security for both parties
- **Verify**: On-chain attestations prove service delivery
- **Dispute**: Built-in resolution mechanism for conflicts

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
