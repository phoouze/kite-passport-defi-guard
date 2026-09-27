# Kite Passport DeFi Guard

Experimental DeFi intent decoding and pre-execution authorization for the Kite AI Passport ecosystem.

> **Security:** This project is an experimental contribution. It is not audited and must not be used as a production risk-control component for real funds.

## What it does

The first implementation decodes:

- ERC-20 `approve(address,uint256)`
- Uniswap V3 `exactInputSingle(...)`

Both are normalized into typed intents before a policy engine decides whether the requested action is allowed.

The engine currently covers explicit rejection paths for:

1. disallowed protocol
2. disallowed target contract
3. disallowed token
4. disallowed spender
5. disallowed recipient
6. unlimited ERC-20 approval
7. approval amount above policy cap
8. swap amount above policy cap
9. zero minimum swap output
10. deadline outside the permitted window
11. native value not permitted
12. unknown calldata selector (decoder rejection)

For supported intents it also produces an expected-result description and asset exposure changes before execution.

## Risk assessment

Preflight now includes a separate risk assessment layer in addition to the hard ALLOW/DENY policy decision. This is intentionally advisory: a transaction may be policy-compliant while still carrying elevated risk signals.

Risk levels are `LOW`, `MEDIUM`, `HIGH`, and `CRITICAL`. Current signals include:

- policy-denied transactions
- unlimited approvals
- approvals using at least 80% of the configured cap
- unusually large uncapped approvals
- swaps using at least 80% of the configured input cap
- zero minimum output
- swap deadlines longer than 30 minutes
- transactions carrying native value

This separation lets a Passport/agent enforce deterministic authorization rules while still surfacing context that may deserve user confirmation or additional controls.

## Architecture

```text
Transaction calldata
      |
      v
Protocol adapter
      |
      v
Normalized DeFi intent
      |
      v
Policy engine
   /      \
ALLOW     DENY + reason(s)
  |
  v
Expected result + exposure changes
```

## Install and test

```bash
npm install
npm test
npm run build
```

## Evidence status

The included unit tests use deterministic generated calldata so the decoder and policy engine can be tested safely.

The bounty asks for **real transaction test vectors**. Those should be added separately with their public chain ID, transaction hash, block number, target contract and raw calldata. Do not label generated fixtures as real transactions.

## Scope

This first contribution intentionally keeps the core small and auditable. Additional adapters such as Aerodrome, Moonwell, Morpho and Avantis can implement the same `ProtocolAdapter` interface.

Kite Passport already uses user-approved spending sessions with explicit limits. This project explores a DeFi-specific intent/policy layer before execution.

## License

MIT
