# AIP-18: Agent Intent Model — Provider, Buyer, and Dual Agents

**Status:** Draft
**Author:** AGIRAILS Core (Arha — from Damir Mujic's 2026-06-05 buyer-agent framing + a live onboarding-test incident the same day)
**Created:** 2026-06-05
**Last Revised:** 2026-06-05 (revision 1)
**Depends On:** AIP-0 (Protocol Overview), AIP-7 (Agent Identity, Registry & Storage), ADR-001 (Identity Field Architecture — `agentId` = ERC-8004 tokenId, address is the spine)
**Related:** AIP-1 (Service Request Metadata), AIP-6 (Attestation & Reputation), AIP-8/9/10/11 (Actor & Identity System), AIP-2.1 (Negotiation)

---

## §0 TL;DR

ACTP has three agent intents. They are not three schemas — they are two
orthogonal capability sets (**provider-side** and **buyer-side**) toggled by intent.

| Concern | `earn` (Provider) | `pay` (Buyer) | `both` (Dual) |
|---|---|---|---|
| Provides services | ✅ | — | ✅ |
| Buys services | — | ✅ | ✅ |
| **Provider config** (services, pricing, SLA, covenant, endpoint) | ✅ | — | ✅ |
| **Buyer config** (budget, servicesNeeded) | — | ✅ | ✅ |
| Address (Smart Wallet) = protocol spine | ✅ | ✅ | ✅ |
| **ERC-8004 identity** (portable WHO + reputation anchor) | default (opt-out) | default (opt-out) | default (opt-out) |
| AgentRegistry profile + configHash + discovery listing (provider layer) | ✅ | ❌ | ✅ |
| Public `{slug}.md` identity file (service card) | ✅ | ❌ | ✅ |
| Onboarding verb | **publish** | **link** | publish + link |
| Reputation surface | as provider | as counterparty | both |

**The bug this closes:** treating every agent as a provider. A pure buyer has
no services to sell, so service terms, covenant, configHash listing, and the
service `{slug}.md` are meaningless to it — and forcing it through provider
publish breaks (see §1).

---

## §1 Problem Statement

AGIRAILS' onboarding, config schema, and served `AGIRAILS.md` are
provider-centric; buyers are bolted on awkwardly via `intent: pay → status:
unlisted` while still being handed provider machinery.

**Live incident (2026-06-05).** Onboarding a `pay` agent (`adopt-test-1`):

1. `actp publish` defaulted to the 48 KB owner `AGIRAILS.md` and got **413
   Content too large (max 10 KB)** — because `resolveIdentityPath` only
   recognizes a `{slug}.md` with `services.length > 0`, which a buyer never has,
   so it fell back to the protocol doc.
2. The buyer was given service terms + covenant it cannot honor (it provides
   nothing).
3. Onboarding told the owner to fund **faucet ETH** — wrong: Tier-1 gas is
   paymaster-sponsored; a buyer needs **USDC**, not ETH.
4. "On-chain activation pending" was surfaced — a non-concept for a buyer (it
   never registers on AgentRegistry).

Root cause: **the protocol conflates "agent" with "provider."** Service terms,
covenant, and the configHash listing are *provider obligations*; they have no
meaning for a pure buyer.

---

## §2 First Principles

**2.1 Two roles, three intents.** Provider-side (sell) and buyer-side (buy) are
independent. `earn` = provider only; `pay` = buyer only; `both` = the union. No
third schema — `both` is simply both field groups present.

**2.2 Public commitments vs private operations.** A provider's terms (services,
pricing, SLA, covenant) are *public commitments* — they must be hashed, put
on-chain, and served so anyone can verify them trustlessly (AIP-7). A buyer's
**budget** is a *private operational cap* — publishing it leaks strategy and
invites gaming. Therefore budget is **never** hashed, on-chain, or on IPFS.

**2.3 Publish ≠ Link.** "Publish" registers a *provider* (AgentRegistry NFT +
configHash + discovery listing). A buyer has nothing to register as a provider,
so it "links" (a dashboard record + optional ERC-8004 identity). Conflating the
two is the §1 bug.

**2.4 The public identity file is a provider artifact.** `{slug}.md` states what
you *sell*. A pure buyer has no service card; at most it has a minimal
counterparty/reputation card. This is what eliminates the 413 class entirely.

---

## §3 The Model

**3.1 Field groups** (gated by intent — DEC-1):

- **Common** (all): `name`, `intent`, `network`, `payment_mode`, `wallet`, `did`, optional ERC-8004 id
- **Provider-side** (`earn` | `both`): `services[]`, `pricing`, `sla`, `covenant`, `endpoint?`
- **Buyer-side** (`pay` | `both`): `budget` (private), `servicesNeeded[]`

**3.2 Validation** (already enforced in the SDK; this AIP formalizes it):
- `earn` → requires `services`, no buyer fields required
- `pay` → requires `servicesNeeded`, **forbids** `services`
- `both` → requires **both** `services` and `servicesNeeded`

**3.3 Public vs private config:**
- **Published & hashed** (the service `{slug}.md`): provider-side only → exists for `earn` | `both`.
- **Private** (local `.actp` + owner-only dashboard): `budget` → never leaves the owner's control.

---

## §4 Architectural Decisions

**DEC-1 — Intent gates field groups, not a third type.** `both` = provider-side ∪ buyer-side. One schema, conditional groups. Avoids a combinatorial type explosion.

**DEC-2 — Buyer budget is private.** Never in the published/hashed config, never on-chain, never on IPFS. Lives in local `.actp` config + the owner-only dashboard. (Rationale: §2.2.)

**DEC-3 — Provider publishes; buyer links.**
- `earn`|`both`: `actp publish` → hash provider config → IPFS → `AgentRegistry.publishConfig(cid, hash)` → discovery listing; served at `/a/{slug}/{slug}.md`.
- `pay`: **link** → DB record (`status: buyer`, unlisted) + optional ERC-8004 identity. No AgentRegistry, no configHash, no public service file.
- `both`: provider publish **and** buyer link — one agent, two operations.

**DEC-4 — A pure buyer has no service `{slug}.md`.** The service identity file is a provider artifact. `actp init --intent pay` writes only the private `.actp` config (budget, servicesNeeded, wallet); it does **not** scaffold a service file. This removes the §1 413 root cause (no buyer service-file to misresolve, nothing oversized to publish).

**DEC-5 — Address is the spine; ERC-8004 is the portable-identity layer; AgentRegistry is the provider profile.** (Per ADR-001 + AIP-7.)
- **Address (Smart Wallet)** is the protocol spine: the kernel keys transactions off `requester`/`provider` *address*, `AgentRegistry.getAgent(address)` is address-keyed, and the DID is `did:ethr:chainId:address`. An agent can transact with an address alone.
- **ERC-8004 identity** is the canonical *portable* WHO + reputation anchor: `agentId` / `on_chain_id` (uint256) **is** the ERC-8004 tokenId (ADR-001). It is the AGIRAILS-product **default** for every real agent (gas-sponsored, ≈ free) and gives a clean `pay → both` upgrade path (same identity) — but it is **not** a hard protocol requirement. ADR-001 explicitly supports `agentId = 0` (address-only); the kernel never validates it. So: **default-on in onboarding, opt-out** for privacy / ephemeral / mock.
- **AgentRegistry** (AGIRAILS, address-keyed) holds the *provider* profile — configHash, service descriptors, listing. Present for `earn`|`both`, absent for `pay`. It is **not** an identity NFT and does **not** compete with ERC-8004.
- Multi-identity (ENS / Lens / Farcaster) is enriched **off-chain** by address (ADR-001 subgraph), never on-chain.
- Reputation (DEC-6) attaches to the ERC-8004 id when present, otherwise to the address.

> *Rev 1 correction:* an earlier draft first called ERC-8004 "optional" with no nuance, then over-corrected to "mandatory for every agent." Both were wrong. ADR-001 settles it: the **address** is the spine; ERC-8004 (= `agentId`) is the recommended portable-identity default, but the protocol supports `agentId = 0`.

**DEC-6 — Reputation: provider side is live; buyer side is a known gap (must be built).**
- **Provider reputation** (`earn`|`both`): **IMPLEMENTED.** On every settlement the kernel calls `AgentRegistry.updateReputationOnSettlement(txn.provider, …)` (ACTPKernel `_releaseEscrow`, anti-double-count C-2 fix, address-keyed); mirrored to DB `agent_stats` + EAS (AIP-6).
- **Buyer / counterparty reputation** (`pay`|`both`): **NOT YET BUILT.** The kernel records reputation only for `txn.provider`; the requester accrues none on-chain and `agent_stats` is provider-keyed. Securing it (pays promptly, low frivolous-dispute rate) requires a protocol change — extend settlement to also record requester behavior (kernel + AgentRegistry + interface), or a dedicated counterparty-reputation path. **This is a hard dependency for a credible buyer/dual economy and warrants its own scope (AIP-6 extension or a new AIP).**
- Reputation accrues to the **address**; the ERC-8004 identity makes it portable/standard across ecosystems (the reason ERC-8004 is default-on, DEC-5).

**DEC-7 — Onboarding doc branches by intent.**
- Provider doc: service identity → publish → (optional) demo.
- Buyer doc (short): set budget → get test USDC (`actp mint`, gas sponsored — **no faucet ETH**) → discover providers → first `actp request` / `client.pay()`.
- Dual doc: provider doc + buyer budget setup.
- Covenant and service terms appear **only** in provider/dual docs.

**DEC-8 — Gas is sponsored; buyers need USDC, not ETH.** Tier-1 (Smart Wallet + paymaster) sponsors gas. Onboarding must never instruct buyers to fund faucet ETH. Test USDC via `actp mint` (testnet). (Directly fixes §1.3.)

**DEC-9 — No new on-chain contract.** Reuses AgentRegistry (provider) + ERC-8004 (identity/reputation). Buyer link is a DB record + optional ERC-8004 — zero protocol-contract change. (Protocol-simplicity: AIP stays within existing primitives.)

---

## §5 Implementation Surface

**SDK (`@agirails/sdk`):**
- `resolveIdentityPath`: accept `pay`|`both` files (don't require `services.length > 0`); for `pay`, there is no service file to resolve.
- `actp publish`: branch by intent — provider path for `earn`|`both`; **link** path for `pay` (no AgentRegistry, no oversized-doc publish). Refuse to publish the owner protocol doc with clear guidance.
- `actp init --intent pay`: scaffold private buyer config only (no service `{slug}.md`).
- Buyer onboarding flow + `actp mint` guidance.

**Web (agirails.app):**
- Wizard: collect provider fields only for `earn`|`both`; buyer fields only for `pay`|`both`. Stop emitting `pricing`/`sla`/`covenant`/`endpoint` for `pay`.
- `owner-agirails-generator`: branch the served doc by intent (buyer = short, no covenant).
- Dashboard: buyer view = budget / spend / transactions (not service terms). Buyer profile = counterparty card, no service section.

**Doc:** `public/protocol/AGIRAILS.md` branches by intent (and is de-coerced — companion change, separate from this AIP).

---

## §6 Migration & Compatibility

- Existing `earn` agents: unaffected.
- Existing `pay` agents (currently `status: unlisted` with stray provider fields): re-link drops the meaningless provider fields; no on-chain change (they never had a provider NFT).
- `both` agents: gain the explicit private-budget split; provider side unchanged.

---

## §7 Resolved Decisions (formerly open questions)

1. **`servicesNeeded` visibility → opt-in semi-public.** Default private; the owner may opt it in so providers can surface inbound offers/matches. **Budget is always private** (DEC-2), regardless.
2. **Buyer public profile → minimal, opt-in.** A buyer has no public profile by default (dashboard-only). Once counterparty reputation (DEC-6) lands, an opt-in minimal "counterparty card" (settles promptly, dispute rate) may be exposed — never service terms.
3. **One `actp publish`, branching by intent (no separate command).** `actp publish` already branches internally (pay-only skips on-chain). Keep a single command for protocol-simplicity; `actp link` may exist only as a thin alias for discoverability. No new top-level verb.

---

## §8 Single-Page Test (per CLAUDE.md protocol-simplicity)

- **Trustless:** provider commitments remain public + hashed; buyer budget is explicitly private — verifiability is unchanged, privacy is improved.
- **Walkaway:** no new contracts; a new team rebuilds from AgentRegistry + ERC-8004 + a DB record.
- **Invariant added** (not a feature): *buyer budget never appears on-chain or in any hashed/published artifact.* (Privacy of operational caps is guaranteed, not best-effort.)
- **Consistent with ADR-001:** identity beyond the address stays optional at the protocol level (`agentId = 0` is valid); ERC-8004 is the product default, not a protocol invariant. The address remains the trustless minimum.
