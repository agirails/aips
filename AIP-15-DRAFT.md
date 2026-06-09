# AIP-15: Session Key Authority for AI Agents

**Status:** Draft
**Author:** AGIRAILS Core (synthesizing input from Seiryu / Kai Twin / Hermes Agent, Apex security team, and Damir Mujic)
**Created:** 2026-05-19
**Replaces:** Partially supersedes AIP-13 for the AI-agent execution surface (AIP-13 remains canonical for deployment-platform key handling — Railway, Vercel, Hetzner, server processes)
**Related:** AIP-12 (Agent Discovery + Smart Wallet auto-provisioning), AIP-13 (Deployment Security)
**Status of input documents:**
- *AIP-RFC: Durable Credential Persistence for AI Agent Runtimes* (Seiryu, 2026-05-19) — surfaced the failure mode and proposed FileCredentialStore + BIP-39 recovery
- *Apex Review* (2026-05-19) — endorsed the RFC structure, flagged two minor clarifications
- *Response: Counter-proposal* (Damir, 2026-05-19) — argued for runtime-native adapters, raised AIP-15 question
- *Deep dive* (Claude ultra-think, 2026-05-19) — argued that the entire framing is wrong, surfaced session-key paradigm
- *Codex first-principles trilogy* (2026-05-25) — reframed Session Keys → Policy-Bound Delegated Authority; flagged AP2/Crossmint market reality
- *First-principles + adversarial assessment* (Claude, 2026-05-25) — challenged 150 KB of escalation by verifying actual addressable surface
- *§Calibration 2026-05-25 below* — supersedes urgency framing of the original v1 draft

---

## ⚠ Calibration 2026-05-25 (read this before §TL;DR)

This draft was authored 2026-05-19 in the heat of the original RFC →
Apex review → counter-proposal sequence. On 2026-05-25 a first-principles
verification pass revealed that the v1 draft significantly overstates
the urgency and addressable surface of the problem. **The architectural
direction is sound; the urgency framing is not.** This note recalibrates
without rewriting the analysis below.

### What v1 implied vs what's actually true

| v1 implied | Verified 2026-05-25 |
|------------|---------------------|
| "Every session-based AI runtime hits this cliff" | The May 2 incident's actual cause was Justin's specific containerized Hermes deployment (Telegram bot, WSL2, sandboxed cwd between sessions). |
| "Claude Desktop is High risk" | Claude Desktop launches MCP servers as **local Node processes with full host-OS filesystem access**. `.env` in the MCP project dir survives session reset. Not affected. |
| "MCP server is High risk" | The MCP server is the same — runs locally, `process.cwd()` or `ACTP_DIR` resolves to a persistent path on the user's host machine. Not affected. |
| "Cursor / VS Code is Low risk but still in the failure class" | Workspace dir survives restart. Not affected. |
| "Hermes Agent (Telegram/Discord) High risk" | Justin's specific deployment, yes. Anyone running Hermes with a persistent host filesystem mount, no. |
| "Generic LLM Chat (web) High risk" | Sandboxed runtimes that lose `.env` also can't execute Node.js / Python and therefore can't run our SDK at all — they have no AGIRAILS integration path today. |
| "Multi-thousand-dollar trust collapse at MCP-adoption scale" | The actual incident was \$40. Current mainnet lifetime GMV is \$19. Total mainnet transactions: 9. We do not have the user base for ecosystem-level trust collapse from this failure mode. |

### What the actual addressable surface is

**Today**:
- Justin's specific Hermes containerized deployment pattern
- Future hypothetical sandboxed runtimes (ChatGPT Apps, etc.) — but those don't run Node.js MCP servers locally either, so the SDK has no path into them anyway
- Edge case: developers running MCP server in `docker run --rm` (rare; documented anti-pattern)

**Not today**:
- 90%+ of plausible AGIRAILS deployments

### What this changes about the AIP

| Element | v1 stance | Calibrated stance |
|---------|-----------|--------------------|
| Phase 0 (`AGIRAILS.md` spec note for containerized runtimes) | "Urgent, must ship this week, addresses systemic risk" | **DEFERRED. Not currently scheduled.** Addressable surface = Justin's specific Hermes containerized setup. He can document the pattern in his own Hermes docs; we do not modify our canonical `AGIRAILS.md` for a single-deployment edge case. If/when a second runtime hits this failure mode, reconsider. |
| Phase 1–4 (session keys, ERC-7715, full PBDA spec, mainnet rollout) | "Sequential build over 2–3 months" | **"Gated on customer signal: \$1,000 lifetime mainnet GMV + 20 unique operators + 10 MCP server users completing first-tx. Do not start before."** |
| AGIRAILS Wallet (§11 strategic addendum) | "Optional product decision" | "Do not consider before Phase 1–4 trigger numbers are crossed. Strict gate." |
| Positioning ("only protocol where losing your agent cannot lose customer funds") | Bold purple-cow framing | **Overclaim** — Codex's "losing an agent should mean rotating authority, not losing funds" is more defensible. Use that until v2 is shipped. |
| Architectural reframe (Session Keys → Policy-Bound Delegated Authority) | Not in v1 | Codex's reframe is correct. v2 will adopt PBDA naming + intent-level policy schema. Tracked here, not specced yet. |
| `DelegationPolicy` 13-dimension schema (Codex) | Not in v1 | Captured for future v2; for MVP, 3 dimensions (cap / expiry / scope) is enough. |
| AP2 / Crossmint / Coinbase Agentic Wallets / Skyfire competitive landscape (Codex) | Not in v1 | Material market reality. v2 must address — adopt AP2 Mandate envelope vs build our own, compete vs partner with Crossmint. |

### Net action right now: **nothing**

To remove any ambiguity:

| Question | Answer |
|----------|--------|
| Are we shipping Phase 0 (spec note) this week? | **No.** Deferred — single-deployment edge case, Justin can document his own pattern. |
| Are we shipping Phases 1–4 (session keys, PBDA, mainnet)? | **No.** Gated on the three trigger numbers below. Today's signal does not justify the build. |
| Are we shipping AGIRAILS Wallet (§11)? | **No.** Strictly post-trigger AND post-v2-mainnet AND tied to a paying customer/partner. |
| What IS happening right now? | Mainnet redeploy is live and functioning. Phase 0 credential persistence work is **not on the work list**. AIP-15 v2 is **not on the work list**. |
| What would change this? | One of: (a) trigger conditions cross, (b) a second deployment beyond Justin's hits the credential failure mode, (c) a paying customer requires session-key UX. |

The protocol is intentionally **standing still on this axis**. Investment
goes to product features that move the trigger numbers, not to building
infrastructure for users who don't exist yet.

### Operator-side wallet integration that already exists (relevant context)

`agirails.app/web` already ships:
- EIP-6963 wallet discovery (browser-injected wallets — MetaMask, Coinbase Wallet, Rabby) via `app/(marketing)/_components/onboarding-wizard/steps/step-auth.tsx`
- OAuth sign-in (Google, GitHub) via Supabase
- Agent ownership claim flow with wallet signature verification
- Operator funding pattern (EOA → Smart Wallet transfer)

What is **not** there: operator-wallet → agent session-key delegation
flow (which is exactly what AIP-15 v2 would build). When/if v2 triggers
fire, the existing EIP-6963 + onboarding wizard infrastructure is the
foundation — v2 Phase 2 (`actp connect` + `SessionKeyProvider`) would
extend rather than replace. Estimate: ~70% of v2 frontend work is on
top of existing infra rather than from scratch. This makes future v2
cheaper than the original v1 phase estimates implied — but it does
not justify starting v2 before the trigger conditions cross.

### What stays valid from v1

- The architectural direction (session keys + policy + ephemeral signer, with the operator's master wallet holding actual funds) is the correct long-term shape. The ecosystem is converging here (Coinbase, Privy, ERC-7715, Crossmint).
- AIP-13 / AIP-15 split (deployment platforms vs agent runtimes) stays clean.
- AIP-15 v2 is the right direction *once* customer signal warrants the investment. Not before.
- The 5-layer architecture sketch in §3 is correct as design space, not as commitment.

### Trigger conditions to begin AIP-15 v2 work

| Metric | Threshold | Today |
|--------|-----------|-------|
| Lifetime mainnet GMV | ≥ \$1,000 | \$19 |
| Unique mainnet operators | ≥ 20 | ~5 |
| MCP-server-onboarded agents that completed first mainnet tx | ≥ 10 | 2–3 |

**Until all three thresholds cross, do not invest design time in AIP-15
v2 beyond preserving this draft as an artifact of the design space we
explored.** The current addressable surface does not justify a 2–3 month
build.

If the thresholds cross within 3 months, the design space below is
ready for v2 commitment.
If they don't cross within 3 months, the protocol has a more
fundamental product-market-fit problem that AIP-15 won't fix.

### What the v1 cycle taught us (decision log entry)

The 2026-05-19 → 2026-05-25 cycle produced ~150 KB of analysis across
seven documents in response to a \$40 incident affecting one deployment
pattern. This led to the addition of *§First-Principles Pravilo* in
`~/Arha/.arha/CLAUDE.base.md` and a decision log entry at
`~/Arha/.arha/decisions/2026-05-25-first-principles-rule-in-claude-base.md`
specifically to prevent this escalation pattern from recurring.

The original v1 draft below is **preserved as design-space exploration**,
not as a commitment. Read it knowing the urgency framing is recalibrated.

---

## TL;DR

> **Calibrated note**: The TL;DR below reflects v1's original framing.
> See §Calibration 2026-05-25 above for the recalibration. The
> architectural direction stands; the urgency is gated on the trigger
> conditions named above.



A May 2, 2026 incident proved a structural design gap: when an AI agent
running in a session-based runtime (Hermes, Claude Desktop, MCP server,
generic LLM chat) initializes an AGIRAILS wallet using the current
spec, the keystore password is written to `.env`. On the next session
reset, `.env` vanishes, the keystore becomes unrecoverable, and any
custodied USDC is permanently locked. **$40 was lost as the test case;
the system risk is multi-thousand-dollar trust collapse if this
becomes the dominant failure mode at MCP-server-adoption scale.**

Two responses to this incident are on the table:

1. **Persist the credential better** (Seiryu's RFC) — add a
   `CredentialStore` interface to the SDK, default to
   `~/.agirails/credentials.json`, generate a BIP-39 recovery phrase,
   extend `actp deploy:check`.

2. **Remove the credential from the agent altogether** (this AIP) —
   migrate AI-agent execution to **session keys**: time-bound,
   scope-limited, revocable authority delegated from a master wallet
   the operator controls. The agent never holds funds-recoverable
   keys; lost session key = mint a new one, zero funds at risk.

This AIP proposes (2) as the canonical AI-agent authority model and
relegates custodial keystores (AIP-13) to **deployment-platform**
deployments (long-running server processes, CI/CD, infrastructure
runners — places where AIP-13's `ACTP_KEYSTORE_BASE64` + paymasters
solve the problem cleanly).

The AGIRAILS network would become **the first AI-agent payment
protocol designed so that losing an agent cannot lose customer funds.**
That positioning is the strategic prize.

---

## 1. Motivation

### 1.1 The incident (2026-05-02)

A Hermes Agent (Kai twin, operated by Justin Rooschuz) initialized an
AGIRAILS wallet on Base Mainnet via the 9-step onboarding checklist in
`AGIRAILS.md`. The SDK generated a keystore and wrote the password to
`.env`. The agent completed a test transaction successfully. **On the
next session reset, `.env` was gone — and with it, the keystore
password. The wallet was permanently locked. $40 in USDC became
irretrievable.**

The agent did nothing wrong. It followed the spec exactly. The spec
assumed a persistent filesystem that doesn't exist in session-based
AI agent runtimes.

### 1.2 Why this happens — the structural cause

Verified against current code:

- `src/cli/utils/wallet.ts:31` reads `process.env.ACTP_KEY_PASSWORD`
  on every wallet operation. 14 other call sites do the same.
- `AGIRAILS.md` Step 3 literally instructs the agent:
  ```bash
  echo "ACTP_KEY_PASSWORD=$(openssl rand -base64 32)" >> .env
  ```
  with the HTML comment: *"The user does not need to see or know the
  password — it lives in `.env` and is read automatically by the SDK."*
- `python-sdk-v2` has the identical pattern (5 files: `deploy_env.py`,
  `claim_code.py`, `claim.py`, etc.).

The spec is the failure mode.

### 1.3 Why it's about to get much worse

AGIRAILS is explicitly targeting AI agents as first-class network
participants:

- `AGIRAILS.md` has a dedicated "For AI Agents" 9-step onboarding
- `agirails-mcp-server` (v0.1.9 as of 2026-05-18) puts AGIRAILS
  payments inside Claude Desktop, Cursor, VS Code, Windsurf — all
  session-based
- Agent Cards v2 + ERC-8004 identity NFTs encourage persistent agent
  identities
- `actp agent` daemon (shipped in 3.5.0) is designed for long-running
  autonomous operation

The MCP server's documented adoption rate (200 downloads in 7 days
organically, zero marketing) is the wedge. **Every AI agent that
onboards to mainnet through MCP using the current spec will hit this
cliff on first session reset.** Without intervention, this becomes the
dominant support burden and trust-loss event.

### 1.4 Affected runtimes (per Seiryu's appendix, verified)

| Runtime | Session Model | `.env` Survives? | Risk |
|---------|--------------|------------------|------|
| Hermes Agent (CLI) | Per-session process | Depends on filesystem config | Medium |
| Hermes Agent (Telegram/Discord) | Per-message or per-session | No — containerized | **High** |
| Claude Desktop | Per-conversation process | No | **High** |
| Cursor / VS Code | Per-workspace, resets on restart | Yes (workspace dir) | Low |
| OpenClaw | Per-session | Depends on config | Medium |
| n8n | Long-running server | Yes | Low |
| Generic LLM Chat (web) | Per-request | No — sandboxed | **High** |
| ChatGPT Apps (new) | Per-conversation | No — server-side sandbox | **High** |

The Apex 2026-05-17 audit had already identified the MCP server as
defensively strong on the **input** boundary and weak on the **output**
boundary (FIND-017). The credential-persistence gap is the third axis:
weak on the **execution-environment** boundary.

---

## 2. The argument for *not* solving this with better credential persistence

### 2.1 Three responses to the incident

| Response | What it does | What it doesn't do |
|----------|--------------|---------------------|
| **A. Seiryu's RFC** — `CredentialStore` interface, `~/.agirails/credentials.json` default, BIP-39 recovery phrase, runtime adapters as Phase 3 | Patches custodial-key persistence | Doesn't fix the runtimes most at risk (Claude Desktop, generic LLM chat, containerized agents — RFC's own appendix marks these "High" and Phase 1 doesn't touch them) |
| **B. Spec-rewrite + runtime-native persistence** (Damir's first response) | Tells agents to use Hermes memory / Claude config / MCP state.json instead of `.env`. 5-line spec change. | Still custodial keys. Still single point of failure. Doesn't fix jailbreak / mode collapse / supply chain threats. |
| **C. Session-key authority** (this AIP) | Removes the custodial key from the agent altogether. Agent gets time-bound, scope-limited delegated authority. | Architectural shift; requires SDK + spec + ecosystem work. |

### 2.2 Why "store the credential better" is the wrong frame

The RFC and Damir's first response are **arguing inside the same
frame**: how should the agent store its custodial private key more
reliably. The frame rests on eight unstated assumptions, most of
which don't survive first-principles examination.

| # | Assumption | True? | If false |
|---|------------|-------|----------|
| 1 | AI agents should hold custodial keys | No | The whole problem disappears |
| 2 | Persistence is what we want | No | Ephemerality is the design hint, not the bug |
| 3 | Agent identity = signing authority | No | NFT ownership separates cleanly from session signing |
| 4 | The agent is the credential owner | No | The operator is. The agent is a delegate. |
| 5 | Lost credential = lost funds | No (with session keys) | Recovery becomes a non-event |
| 6 | Threat model is "operator loses password" | Incomplete | Jailbreak, supply chain, mode collapse, multi-instance — all worse with custodial persistence |
| 7 | Single password is the right credential shape | No | Multi-party / threshold / time-bound is strictly safer |
| 8 | Solving this requires new AGIRAILS code | No | ERC-7715, Permissionless.js, Privy, Coinbase Wallet API for AI Agents already productize this |

### 2.3 The first-principles question

What is the AI agent actually trying to do, as a user need?

> "I want my AI agent to receive USDC for work it does and pay other
> AI agents for services it consumes — without me being in the loop
> for every transaction, but **also without exposing me to
> catastrophic loss if the agent or its environment is compromised.**"

The RFC reads the first half of that sentence. The second half is
where session keys live.

This is not "the agent needs to hold the operator's private keys
forever." It is "the agent needs **delegated authority with caps and
revocation.**" The web has been answering this question since OAuth2
in 2010. SSH agents have been answering it since 1995. Banking
corporate-card systems have been answering it since the 1980s.
**Web3 answered it in 2024 with ERC-7715 (Wallet Permissions) and
ERC-6900 (Modular Smart Accounts), both standardized within the last
twelve months.**

The agent ecosystem is converging on this same answer. AGIRAILS is the
outlier proposing to patch the older model.

---

## 3. The proposed solution: Session Key Authority

### 3.1 Architecture in one paragraph

The operator owns a **master wallet** (any wallet they already use —
MetaMask, Coinbase Wallet, hardware wallet, Privy embedded wallet, a
Smart Wallet they already manage). The master wallet owns a Smart
Wallet that holds the operator's USDC and the operator's AGIRAILS
agent identity NFT (ERC-8004). The Smart Wallet has a **SessionKey
module** attached. When the agent starts a session, it requests a
session key from the operator's wallet, scoped to:

- **What it can call**: only ACTP kernel functions (no arbitrary
  contract calls, no token transfers outside the protocol)
- **How much it can spend**: a daily / per-tx cap set by the operator
- **How long it lasts**: 24 hours by default, renewable
- **How to revoke it**: any time, by the operator, with one click

The agent holds this session key in whatever runtime-native storage
makes sense (Claude Desktop config, Hermes memory, MCP state file,
OS keychain via `keytar`). **Loss of the session key has bounded
blast radius** — at worst, an attacker spends the session's daily cap
before the operator notices and revokes.

### 3.2 What the user experience looks like

#### For the operator (non-technical case — "Iva")

1. Opens an AGIRAILS-compatible agent in Claude Desktop / MCP / etc.
2. Agent prompts: *"Connect your wallet to grant me payment authority
   for AGIRAILS commerce."*
3. Operator scans QR with mobile wallet (WalletConnect) or clicks an
   in-browser wallet button.
4. Wallet shows a clear permission grant:
   > *"This agent (Arha, slug `arha-research`) is requesting:*
   > - *Up to $50 USDC/day in spending*
   > - *Calls to the AGIRAILS protocol only*
   > - *Valid for 24 hours, then auto-renews*
   > - *You can revoke at agirails.app/agents at any time*"
5. Operator signs once. Done.
6. No password. No `.env` file. No BIP-39 phrase. No technical
   vocabulary at all.

#### For the agent (in code)

```typescript
import { ACTPClient, SessionKeyProvider } from '@agirails/sdk';

const client = await ACTPClient.create({
  mode: 'mainnet',
  authority: SessionKeyProvider.fromOperatorConnection(),
  // No keystore, no .env, no ACTP_KEY_PASSWORD
});

await client.pay(provider, '$5');
```

If the session key has expired, the SDK automatically requests a
new one (via the runtime-appropriate channel — Claude Desktop notification,
WalletConnect push, etc.). If the operator hasn't connected a wallet yet,
the SDK throws a clear error: `"Operator wallet not connected. Run
`actp connect` or open agirails.app/connect in your browser."`

#### For the AGIRAILS operator dashboard

`agirails.app/wallet` shows:
- All connected agents (per master wallet)
- Per-agent budget consumption
- Per-agent transaction history
- "Revoke" button next to every active session
- "Freeze all sessions" emergency button
- Insurance policy details (if AGIRAILS Wallet is used; see §11)

### 3.3 Implementation primitive: ERC-7715 + ERC-6900

The full architecture composes three standardized primitives:

| Standard | Role | Maturity (2026-05) |
|----------|------|---------------------|
| ERC-4337 (Account Abstraction) | Smart Wallet base layer | Production; AGIRAILS already uses it for AIP-12 Tier 1 |
| ERC-6900 (Modular Smart Accounts) | Plug-in validators and signers | Stage 2 standardization |
| ERC-7715 (Wallet Permissions) | Standardized API for requesting delegated authority | Last Call |
| ERC-5792 (Wallet Call API) | Multi-call batching for session UX | Final |

**The session-key module is not new code we write — it's a published
ERC-6900 module from libraries we'd import.** Reference
implementations exist in Zerodev's `@zerodev/permissions`,
Permissionless.js's `@permissionless/session-keys`, Pimlico's modular
account stack, and Safe's Module Manager.

### 3.4 Cross-SDK requirements

This must ship in both TS and Python SDKs simultaneously. Python's
share of AGIRAILS integrations is non-trivial (per memory notes, the
Python SDK reached 60 files / 14k LOC by Feb 2026). Any spec change
that's TS-only orphans Python users.

The session-key abstraction lives in the SDK layer:

```python
# Python
from agirails import ACTPClient, SessionKeyProvider

client = await ACTPClient.create(
    mode='mainnet',
    authority=SessionKeyProvider.from_operator_connection(),
)
```

The underlying signing happens via:
- Permissionless.js (Node/browser) for TS
- A new `agirails-permissions` Python package that implements the
  ERC-7715 client protocol (or via `web3.py` + Privy/Coinbase MPC API
  bindings)

---

## 4. The strategic prize — why this is more than a bug fix

### 4.1 Industry alignment

The major players have already shipped agent-payment infrastructure
along this exact pattern:

| Player | Approach | Status |
|--------|----------|--------|
| Coinbase Wallet API for AI Agents | Embedded wallet + session keys (Privy backend) | Shipped 2026 Q1 |
| Privy Embedded Wallets for AI | TEE-backed keys + signed permissions | Shipped |
| WalletConnect AppKit Agent Sessions | Session-key-based EIP-1193 | Recent feature |
| Anthropic MCP (credential handling) | Punts to client; Claude Desktop has session model | By design |
| OpenAI Operator | Avoids money handling; sidesteps the problem | N/A |
| Fireblocks / Cobo MPC for agents | Threshold signing, no SPOF | Enterprise |
| ERC-7715 (Wallet Permissions) | Standardized | Last Call |
| ERC-6900 (Modular Accounts) | Standardized | Stage 2 |

**AGIRAILS is the outlier** proposing to patch custodial keys. If we
ship Seiryu's RFC, we ship the wrong architecture relative to where
the ecosystem is going — and rip it out in 6 months when forced to
align.

### 4.2 The purple cow positioning

A boring framing of session keys is: *"AGIRAILS now uses standardized
delegated authority for AI agents."* Nobody cares.

A remarkable framing is:

> **AGIRAILS is the only AI agent commerce protocol where losing your
> agent cannot lose your customer funds.**

That sentence is the entire pitch. Every other agent-payments stack
in the market lets a hijacked agent drain a wallet. AGIRAILS would be
the one where the worst possible jailbreak / mode collapse / supply
chain attack is bounded by the agent's session budget — at most $50,
not the operator's whole balance.

**Purple cow test**: is anyone going to retweet this? Yes. Is anyone
going to retweet "we added a credential store with BIP-39 recovery"?
No.

**Lovable product test**: does this dissolve a deep fear customers
have? Yes — every single class of "AI agent runs amok with my money"
fear, in one architectural primitive. The operator's master wallet is
untouchable by the agent; the session key has hard caps; revocation
is one click; activity is dashboardable.

### 4.3 Regulatory positioning

EU MiCA, US stablecoin legislation in flight, UK FCA, Singapore MAS —
all distinguish:

- **Custodial wallets** → typically require money-transmitter or VASP
  licensing
- **Non-custodial wallets** → mostly out of scope

If AGIRAILS AI agents hold custodial keys at scale, AGIRAILS itself
may be classified as a money transmitter or custodian — a multi-year,
multi-jurisdictional compliance burden.

Session keys with operator-held masters → operator is the responsible
party, AGIRAILS is pure protocol infrastructure. **Order-of-magnitude
cleaner regulatory position.** This is a material business
consideration the Seiryu RFC and the first counter-response both
missed.

### 4.4 Insurance and underwriting

Custodial-key agent fleets are uninsurable at scale — actuarial models
have no way to price the catastrophic-loss tail. Session-key fleets
with operator-set caps are eminently insurable: the per-event maximum
loss is the daily cap × the time-to-revoke. Lloyd's of London
underwrites systems with this profile routinely.

If AGIRAILS Wallet (see §11) ships with a built-in insurance backstop,
the marketing line writes itself: *"Insured-by-default AI agent
payments."* Custodial systems can't offer this.

### 4.5 Operator-extensible scaling

A non-trivial operator (small business, dev team, agent fleet)
running 10 agent instances under the current spec has 10 keystores to
manage, each a separate failure point. Under session-key authority:
**one master wallet → 10 session keys**, each scoped per-instance,
all visible in one dashboard, all revokable centrally.

This matters because agent fleets are coming. Multi-agent products
(swarms, agent guilds, redundant pools) are the next adoption wave.
Session keys scale naturally; custodial keystores don't.

---

## 5. The threat models the RFC didn't address

The RFC's only modeled threat is "operator loses password." A real
threat enumeration that AIP-15 has to address:

### 5.1 Jailbreak / prompt injection

An adversarial input convinces the agent to drain funds. **We
literally patched this attack class in `agirails-mcp-server` v0.1.9
yesterday (FIND-017, 2026-05-18).** Same class, applied to the
agent's signing authority.

With custodial keys + persistence: **full wallet at risk in one tx**.
With session keys + spending caps: **limited to today's budget**, and
the attacker still has to extract value via the constrained ACTP-only
function selector list — no `transfer()` to attacker EOA possible.

### 5.2 Mode collapse / pathological behavior

Agent decides "I should buy more compute" or enters a payment loop or
gets stuck paying the LLM provider to "get smarter." Documented
failure modes in the AutoGPT-era literature.

With custodial keys: catastrophic. With session keys + daily cap:
bounded; operator notices on the alerted refill request and decides.

### 5.3 Supply chain attacks on the SDK

A compromised `@agirails/sdk` npm version reads from the
`CredentialStore` and exfiltrates it. RFC's proposed
`~/.agirails/credentials.json` is a single juicy target. **The MCP
server FIND-022 patch this week (semver floor tightening) was exactly
this attack class.** Custodial-key persistence multiplies the impact
of any SDK compromise.

With session keys: a compromised SDK can only spend the session's
daily cap before the operator's wallet sees an anomaly. Master keys
never touch the SDK.

### 5.4 Operator-machine compromise

Operator's laptop compromised. Attacker reads `.env` or
`~/.agirails/`. With custodial keys: instant total drain. With
session keys held in OS keychain (hardware-backed on modern
T2/M-series/TPM 2.0): keychain compromise requires kernel-level
access, and even then only the active session is exposed.

### 5.5 Multi-instance race conditions

Operator runs N agent instances sharing one custodial keystore.
Concurrent tx submissions collide on nonces, cause failed UserOps and
double-spend windows.

With session keys: per-instance keys derive cleanly from one master
permission; no nonce collisions.

### 5.6 Phishing the credential

Attacker hosts a fake "AGIRAILS support" page asking for the
keystore password. Or tricks the agent (via prompt injection in a
fetched agent card — FIND-017 again) into transmitting the
credential.

With session keys: there's no shared secret to phish. The signing
happens via the operator's wallet, which already has its own
anti-phishing UX (MetaMask Snaps, Coinbase Wallet warnings, etc.).

---

## 6. Honest comparison of approaches

| Dimension | A. Seiryu RFC (CredentialStore) | B. Spec rewrite + runtime persistence | C. Session keys (this AIP) | D. AGIRAILS Wallet (product) |
|-----------|-------------------------------|--------------------------------------|----------------------------|----------------------------|
| Effort | 2–3 wk SDK refactor + cross-SDK + RFC process | 1 wk spec + 2 lines Python | 2–3 wk integration + spec + docs | 3–6 mo product build |
| Cross-SDK paritet | Required, not in RFC | Required, trivial | Required, planned | Required, controlled |
| Fixes Claude Desktop / sandboxed runtimes | No (Phase 1 doesn't, Phase 3 might) | Yes (uses runtime's own storage) | Yes (no credential to lose) | Yes (no credential to lose) |
| Fixes jailbreak / mode collapse / supply chain | No | No | Yes (bounded by cap) | Yes (bounded by cap) |
| Industry alignment | Diverges | Tactical only | Converges (ERC-7715) | Defines new category |
| Regulatory position | Custodial → exposed | Custodial → exposed | Non-custodial → clean | Non-custodial + product → clean |
| UX for non-technical operator | Same (still .env + password) | Better | Much better (Connect Wallet) | Best (in-product onboarding) |
| Strategic moat | None | None | Some | Strong |
| Insurability | Unpriceable tail | Unpriceable tail | Insurable | Insurable with built-in backstop |
| Honors Seiryu's RFC work | Yes (it IS the RFC) | Partially (spec rewrite mirrors RFC Step 0 + 3 suggestions) | Reframes, but core failure-mode identification is correct | Reframes wholesale |

**Recommendation order**: B + C as joint MVP, D as strategic
follow-on. A is the wrong architecture even though the underlying
incident identification is correct.

---

## 7. Specification

### 7.1 New SDK surface

```typescript
// @agirails/sdk

export interface AuthorityProvider {
  /** Get a signer for the next transaction (may be a fresh session key). */
  getSigner(): Promise<Signer>;

  /** Check whether authority is currently valid (not expired / revoked). */
  isValid(): Promise<boolean>;

  /** Refresh authority — may trigger a wallet connection / re-grant flow. */
  refresh(): Promise<void>;

  /** Get current session metadata (budget remaining, expiry, etc.). */
  getMetadata(): Promise<SessionMetadata>;
}

export interface SessionMetadata {
  type: 'custodial' | 'session-key' | 'mpc';
  expiresAt: number;
  budgetUsdcRemaining?: string;  // for session-key authorities
  scopedTo?: string[];           // function selectors allowed
  revocableAt: string;           // URL where operator can revoke
}

export class SessionKeyProvider implements AuthorityProvider {
  /** Connect via WalletConnect / EIP-1193 / browser wallet. */
  static fromOperatorConnection(opts?: ConnectOptions): SessionKeyProvider;

  /** Connect via Privy / Coinbase Wallet API / Magic embedded wallet. */
  static fromEmbeddedWallet(provider: EmbeddedWalletProvider): SessionKeyProvider;

  /** Connect via AGIRAILS Wallet (if §11 ships). */
  static fromAgirailsWallet(operatorEmail: string): SessionKeyProvider;
}

// For backward-compat: keystore-based authority remains available
// for deployment-platform deployments (servers, CI/CD, long-running infra).
export class KeystoreProvider implements AuthorityProvider {
  static fromActpDirectory(actpDir: string): KeystoreProvider;
}
```

### 7.2 `actp` CLI changes

New default in `actp init`:

```bash
actp init --mode mainnet
# Detects runtime context. If session-based (Claude Desktop, MCP, Hermes):
#   → defaults to session-key authority
#   → prints: "Run `actp connect` to grant your wallet."
# If server / deployment runtime (Railway, Vercel, server process):
#   → defaults to AIP-13 keystore + ACTP_KEYSTORE_BASE64 flow
```

New commands:

```bash
actp connect       # WalletConnect / browser flow to grant session-key permission
actp sessions      # List active sessions + budgets
actp revoke <id>   # Revoke a specific session
actp revoke --all  # Emergency revoke
```

Existing `actp deploy:check` extended to detect:
- Session-key authority configured for session-based runtime ✓
- Keystore + `ACTP_KEY_PASSWORD` configured for deployment runtime ✓
- Mismatched configuration → WARN

### 7.3 `AGIRAILS.md` spec changes

Replace Step 3 of the "For AI Agents" onboarding entirely:

> **Step 3 (NEW): Connect your operator's wallet for delegated authority.**
>
> Do NOT create a custodial keystore. Instead, request session-key
> authority from the operator's master wallet:
>
> ```bash
> actp connect
> ```
>
> This opens a wallet-connection flow (WalletConnect / browser wallet /
> AGIRAILS Wallet). The operator approves a time-bound, scope-limited
> permission grant. Your session key:
>
> - Can only call AGIRAILS protocol functions
> - Spends at most the operator-set daily cap (default $50 USDC)
> - Expires in 24 hours and auto-renews if the operator's wallet is
>   still connected
> - Can be revoked instantly by the operator at agirails.app/agents
>
> Store the session key in your runtime's native persistent storage
> (Claude Desktop project config, Hermes memory, MCP state.json, OS
> keychain). The session key is rotation-safe — losing it means
> minting a new one next session, never losing funds.

Add Step 0:

> **Step 0: Runtime awareness check.**
>
> If you're running in a session-based environment (Claude Desktop,
> Hermes Agent, Cursor, VS Code, generic LLM chat, MCP server) — i.e.
> anywhere the filesystem may reset between sessions — use session-key
> authority (Step 3 below). **Do not create a custodial keystore in
> session-based runtimes.** Custodial keystores are designed for
> long-running server processes (Railway, Vercel, Hetzner, Fly.io)
> where AIP-13's `ACTP_KEYSTORE_BASE64` flow applies.

### 7.4 Smart Wallet side (Solidity)

`AGIRAILSSmartWallet.sol` (new) implements ERC-4337 + ERC-6900,
with the following modules attached by default:

| Module | Purpose |
|--------|---------|
| `SessionKeyModule` | Validates UserOps from session keys against per-key permissions |
| `SpendingCapModule` | Enforces per-day USDC spending limits |
| `FunctionSelectorWhitelistModule` | Restricts which functions session keys can call (default: ACTP kernel + USDC.transfer to ACTP escrow) |
| `TimeboundModule` | Expires session keys at their declared `validUntil` |
| `RevocationModule` | Allows the master to revoke any session key via single tx |

Reference implementations:
- ZeroDev `@zerodev/permissions` (production-grade, widely deployed)
- Permissionless.js session-key plugin
- Safe Module Manager + Zodiac modules

We adopt one (likely ZeroDev for production maturity), wrap it in an
`AGIRAILSSmartWallet` factory, audit it as part of the next security
cycle. **We do not write our own — that's a year of audit work.**

### 7.5 Backward compatibility

Custodial-keystore authority **remains available** under
`KeystoreProvider`. AIP-13's `ACTP_KEYSTORE_BASE64` flow stays
canonical for deployment-platform deployments. The split is:

| Use case | Authority model |
|----------|-----------------|
| AI agent in session-based runtime (Claude Desktop, MCP, Hermes, generic LLM chat) | **SessionKeyProvider** (default) |
| Long-running server / Railway / Vercel / Hetzner / Fly.io | **KeystoreProvider** + AIP-13 (default) |
| Power user / dev / testing | Either, by explicit choice via `--authority session-key` or `--authority keystore` flag |

No existing deployment breaks. Existing keystores continue to work.

---

## 8. Migration path

### 8.1 Phased rollout

> **Recalibrated 2026-05-25**: Only Phase 0 is currently approved for
> work. Phases 1–4 are gated on the trigger conditions in §Calibration
> 2026-05-25 (≥\$1,000 lifetime mainnet GMV + ≥20 unique operators +
> ≥10 MCP server users with first-tx). Do not start Phases 1–4 before
> all three thresholds cross. The original phase timing below is
> preserved as a build-readiness sketch for when the trigger fires.

**Phase 0 (this week, no code, immediate mitigation):**

- Spec update to `AGIRAILS.md` Step 3 telling agents to use
  runtime-native persistence (not `.env`) for the keystore password.
  Mirrors Seiryu RFC's tactical suggestion + the first counter-response.
  Cross-SDK paritet (Python doc update).
- This is **Option B from the comparison table** — interim fix, ships
  in days, no SDK code change, addresses Claude Desktop / Hermes /
  containerized runtimes via their own persistence primitives.

**Phase 1 (post-trigger: next 2 weeks of build, OS keychain default):**

- Add `keytar` (or platform-equivalent) to SDK. Default keystore
  password storage on desktop runtimes becomes the OS keychain
  (T2 / Apple Silicon Secure Enclave / Windows TPM / freedesktop
  Secret Service). 1-day patch in code, 1-week including QA across
  three OSes.
- Hardware-backed encryption on every modern desktop. Eliminates a
  class of credential-exfiltration attack.

**Phase 2 (post-trigger: 4–6 weeks of build, session-key MVP on Sepolia):**

- Integrate ZeroDev `@zerodev/permissions` (or Permissionless.js).
- Ship `actp connect` + `SessionKeyProvider` in TS SDK.
- Build operator dashboard MVP at `agirails.app/agents/sessions`.
- Validate end-to-end UX with three runtime targets: Claude Desktop,
  MCP server, Hermes Agent.
- Document the EIP-712 domain bindings for session-key grants (already
  largely solved by ZeroDev's existing audit; we re-confirm).

**Phase 3 (post-trigger: 2–3 months of build, mainnet + Python paritet):**

- Mainnet `AGIRAILSSmartWallet` deploy (coordinated with the kernel
  redeploy plan, MAINNET-REDEPLOY-PLAN.md).
- Python SDK paritet (`agirails-permissions` package).
- Spec promotion: `AGIRAILS.md` Step 3 made session-key the default
  for session-based runtimes.

**Phase 4 (post-Phase 3, strategic — AGIRAILS Wallet product, see §11):**

Even harder gate than Phases 1–3. Do not consider until AIP-15 v2 has
shipped to mainnet AND there is a clear product-side reason (paying
customer, enterprise contract, integrated partner) that requires
operator-facing wallet UX. Otherwise this is scope creep with multi-month
opportunity cost.


- See §11. Board-level decision.

### 8.2 Existing agents on the old custodial model

The May 2 incident already happened. Any agent that loses its
keystore password between now and Phase 3 still loses funds. Two
mitigations during the transition:

1. **Phase 0 spec rewrite ships immediately** — no new agent
   onboarded after this lands hits the `.env` failure mode.

2. **Agent identity NFT rotation**: existing agents that have lost
   keystore access can still rotate via on-chain `setAgentWallet()`
   if the operator has any other proof of ownership. This is the
   AIP-13 Layer 3 recovery path already documented. We commit to
   helping affected agents migrate.

3. **The May 2 $40 incident**: not recoverable. Treat as paid
   tuition for the spec change.

---

## 9. Open questions

1. **Embedded-wallet provider choice for session-key infrastructure.**
   Candidates: Privy (best UX, has AI-agent-specific docs), Coinbase
   Wallet API (strongest brand alignment with USDC settlement),
   Magic (oldest player), Web3Auth, Dynamic. **Damir + board to
   decide based on partnership terms.** Default in code: pluggable
   provider interface; ship with Privy as the first integration if
   no other reason emerges.

2. **Does the operator need an embedded wallet at all?** If they
   already have MetaMask / Coinbase Wallet / a hardware wallet,
   WalletConnect is sufficient. Embedded wallets are for the
   onboarding-friction case ("I don't have a wallet, give me one").
   Likely answer: **support both paths.**

3. **Default daily spending cap.** $50 is a placeholder. Likely
   should be tuned per-runtime or per-network. Possibly: $1 on
   testnet, $50 on mainnet, configurable per-operator.

4. **Session-key recovery if the operator's master wallet is lost.**
   Operator-level problem, not agent-level. We don't solve master-key
   recovery in this AIP — that's standard wallet UX (seed phrase,
   social recovery, hardware backup). We can document recommended
   patterns.

5. **Compatibility with non-EVM chains.** Currently AGIRAILS is
   Base-only. Future expansion to Solana / Bitcoin-Lightning / etc.
   would need analogous session-key infra. Not in scope for AIP-15.

6. **Honest pricing question.** Embedded-wallet providers charge for
   per-active-user / per-transaction. If AGIRAILS bundles Privy
   (or equivalent), do we pay or pass through? Affects unit
   economics. Likely answer: bundle for first N users free, premium
   tier above.

7. **Agent-to-agent delegation.** When Agent A subcontracts to Agent
   B (current x402 / ACTP flow), can A's session key issue a
   sub-session-key to B? Or does B always go back to its own operator?
   **Likely: sub-delegation only with explicit operator approval, per
   ERC-7715 spec.** Document explicitly.

8. **Tier 2 BYOW continued availability.** Some power users (devs,
   integrators) will want raw private keys for testing / scripting.
   Keep available behind explicit flag, don't deprecate.

---

## 10. Honest acknowledgements

**Seiryu (Kai Twin / Hermes Agent) wrote the RFC that surfaced this
problem.** The May 2 incident triage was correct, the urgency framing
was correct, the affected-runtimes appendix is accurate and useful.
**AIP-15 would not exist without Seiryu's RFC.** The disagreement is
purely on the proposed solution, not on the problem identification.

**Apex (Justin's security team) reviewed the RFC.** Their endorsement
of the structure is fair; their two flagged clarifications are real.
The shortcoming of their review — not flagging that `actp agent`
daemon already shipped, not catching the Phase-1-doesn't-fix-high-risk-runtimes
mismatch — is a reminder that even good security reviewers can miss
strategic-level misframings.

**Damir's first counter-response** identified the Python-SDK gap and
the runtime-adapter pattern correctly, but stayed inside the
"custodial keys, better stored" frame. The ultra-think pass that led
to AIP-15 is what broke the frame.

**This AIP credits the entire conversation, not just the final
position.** The May 2 incident was real; the credential persistence
problem was real; the RFC's proposed solution was the right shape for
the wrong frame.

---

## 11. Strategic addendum — AGIRAILS Wallet as a product

This section is informational, not part of the AIP-15 spec itself.
The session-key authority model defined above stands on its own. But
it enables a strategic option worth surfacing.

### 11.1 The product

**AGIRAILS Wallet** — a hosted Smart Wallet specifically designed for
AI agents:

- Session keys by default; operator never thinks about keys
- Spending modules pre-configured with sensible defaults
- Master key custody via Privy / Coinbase MPC / Magic / Turnkey
  (operator picks their preferred backend at signup)
- BotID integration for anti-Sybil at provisioning
- Owner dashboard at `agirails.app/wallet`: see all agents, set
  budgets, view tx history, freeze instantly
- Built-in insurance: a per-wallet insurance policy underwritten via
  partnership with on-chain insurance providers (Nexus Mutual, Sherlock)
- White-label: enterprises can deploy their own branded version

### 11.2 Why it's a moat

If we ship only the protocol-side session-key support (AIP-15 core),
we're aligned with the ecosystem but not differentiated. Anyone can
integrate Permissionless.js + AGIRAILS.

If we ship AGIRAILS Wallet on top, we own the operator relationship.
Every AGIRAILS payment flows through our wallet by default. The
protocol layer becomes commoditizable; the wallet+protocol stack is
not.

### 11.3 The risks

- Scope creep — wallet infrastructure is a big engineering surface
- Distraction from core protocol work
- Funding required (wallet infrastructure has ongoing operational cost
  beyond initial build)
- Partnership dependence — picking the wrong embedded-wallet provider
  is hard to undo

### 11.4 Recommendation

**Out of scope for AIP-15 itself.** AIP-15 ships protocol-level
session-key support. AGIRAILS Wallet is a separate product decision
that the board / leadership team should evaluate against:

- Runway available for product work
- Strategic priority versus other product lines
- Partnership opportunities (Privy / Coinbase / Magic)
- Regulatory readiness (operating a wallet has its own compliance
  considerations even when non-custodial)

This addendum exists to surface the option, not to commit to it.

---

## 12. Success metrics

> **Recalibrated 2026-05-25**: Two distinct metric classes — *trigger
> conditions* (what justifies STARTING AIP-15 v2 work at all) and
> *outcome metrics* (what success looks like AFTER v2 ships). v1 only
> defined outcome metrics; this was an unstated assumption that v2
> work was already justified.

### Trigger conditions (must cross BEFORE starting v2 build)

If any one of these does not cross within 3 months, AIP-15 v2 is not
the right investment — the protocol has a more fundamental product-
market-fit problem that better credentials won't fix.

| Metric | Threshold | Today (2026-05-25) |
|--------|-----------|--------------------|
| Lifetime mainnet GMV | ≥ \$1,000 | \$19 |
| Unique mainnet operators | ≥ 20 | ~5 |
| MCP-server-onboarded agents that completed first mainnet tx | ≥ 10 | 2–3 |

### Outcome metrics (only meaningful AFTER v2 ships)

For AIP-15 v2 itself (protocol-level success), measured 3 months after
Phase 3 GA:

- **Zero AGIRAILS-onboarded mainnet agents lose funds to credential
  loss after Phase 3 ships.** Hard target.
- **80%+ of new MCP-server-onboarded agents use session-key authority
  by 3 months post-launch.** Adoption target.
- **Agent onboarding time-to-first-payment drops from current
  ~15 minutes (with all the keystore + `.env` ceremony) to under
  2 minutes** with `actp connect`. UX target.
- **Cross-SDK paritet (TS + Python) within 30 days of TS GA.**
  Ecosystem target.

For the strategic angle (if AGIRAILS Wallet ships per §11):

- **>50% of new agent onboardings use AGIRAILS Wallet** within 6
  months of GA.
- **Zero insurance claims paid** in first 12 months (validating cap
  defaults).
- **Two enterprise white-label deals signed** in first 12 months.

---

## 13. Process note

Per Apex's recommendation, the **Phase 0 tactical fix** (spec rewrite
+ runtime-native persistence) can ship as a single non-AIP PR this
week. No new public interface, no breaking change. It addresses the
immediate Claude Desktop / Hermes / containerized runtime risk
without committing to any larger architectural change.

The full AIP-15 (session-key authority) requires the standard AIP
process: this draft → community comment period → reference
implementation on Sepolia → reference implementation on mainnet →
spec promotion.

The §11 AGIRAILS Wallet decision is **not an AIP** — it's a product
roadmap call, made separately.

---

## 14. References

### Standards
- ERC-4337 Account Abstraction (Final, deployed): https://eips.ethereum.org/EIPS/eip-4337
- ERC-6900 Modular Smart Accounts (Stage 2): https://eips.ethereum.org/EIPS/eip-6900
- ERC-7715 Wallet Permissions (Last Call): https://eips.ethereum.org/EIPS/eip-7715
- ERC-5792 Wallet Call API (Final): https://eips.ethereum.org/EIPS/eip-5792
- ERC-8004 Agent Identity (deployed canonically on Base): https://eips.ethereum.org/EIPS/eip-8004

### Reference implementations
- ZeroDev `@zerodev/permissions`
- Permissionless.js session-key plugin
- Safe Module Manager + Zodiac modules
- Privy Embedded Wallets for AI Agents (productized)
- Coinbase Wallet API for AI Agents (productized)

### Internal documents
- `AGIRAILS.md` Step 3 (current, deficient)
- `AIP-12-DRAFT.md` (Agent Discovery + Smart Wallet auto-provisioning;
   AIP-15 extends Tier 1)
- `AIP-13.md` (Deployment Security; AIP-15 partitions the use cases
  rather than replaces)
- `Protocol/actp-kernel/deployments/MAINNET-REDEPLOY-PLAN.md`
  (next mainnet kernel redeploy; AIP-15 affects timing if we want to
   deploy `AGIRAILSSmartWallet` factory in the same window)
- `responses/2026-05-19-credential-persistence-rfc-response.md`
  (Damir's first counter-response)
- `responses/2026-05-19-credential-persistence-deep-dive.md`
  (ultra-think pass)
- Original RFC: `AIP-Credential-Persistence (1).md` (Seiryu)
- Apex review: `aip-credential-persistence-review (1).md`

### Threat model precedents
- OWASP LLM Top 10 (LLM01 prompt injection, LLM02 insecure output handling)
- Invariant Labs MCP Tool Poisoning disclosure (2025-04-01)
- AGIRAILS Apex Audit FIND-017 (output-direction prompt injection in MCP server)
- AGIRAILS Apex Audit FIND-022 (supply chain via SDK semver)

---

## Appendix A — First-principles sketch of why session keys are the right shape

The pattern of "stable owner identity + ephemeral execution authority"
recurs across every system that has all three of:

- Long-lived **identity** that accrues reputation / state
- **Ephemeral execution** environments that come and go
- Need to access **shared resources** (funds, APIs, files)

Cross-domain instances:

| Domain | Owner identity | Ephemeral authority |
|--------|----------------|---------------------|
| Unix shells | User account | SSH session |
| OAuth web apps | User account | Access token (1h) + refresh token |
| Corporate banking | Company | Per-employee corporate card with cap + freeze |
| Browser cookies | User identity | Session cookie (revoked on logout) |
| AWS workloads | IAM user / role | STS temporary credentials |
| Mobile apps | App Store ID | App attestation tokens |
| Hardware wallets | Seed-phrase-derived root key | Per-tx signature (no persistent app authority) |
| Modern Web3 dApps (post-2024) | User wallet | ERC-7715 wallet permission |

Every single one of these arrived at the same architecture **for the
same reason**: shared resources require stable accountability, while
execution environments require flexibility and bounded blast radius.

AGIRAILS's AI agents have exactly these three properties:
- ERC-8004 NFT = stable identity that accrues reputation
- Session-based runtimes = ephemeral execution
- Operator wallet / customer funds = shared resources

**The pattern says session keys. The training data says session keys.
The ecosystem ships session keys. Seiryu's RFC tries to solve the
problem by making the ephemeral environment more persistent, which is
working against the grain.** Working with the grain is faster, safer,
and more remarkable.

That's the first-principles answer.

---

*End of AIP-15 first draft. ~7 pages. Ready for review, revision, and
community discussion.*
