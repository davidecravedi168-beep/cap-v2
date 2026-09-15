# Deployed zero-cost gateway

Neon project: `office-free-runtime`

Function slug: `officefree`

Invocation base URL:
`https://br-floral-shadow-aygwywoy-officefree.compute.c-5.us-east-2.aws.neon.tech/`

Deployment **13** completed successfully on Node.js 24 on **15 September 2026**.

The active gateway runs Model Board `2026-09-15-v4`. Office roles remain explicit, but the public zero-cost path only uses providers that are genuinely usable without developer payment at deployment time. The provider/model that actually answers is recorded and never inferred from the preferred role.

Active public zero-cost transport: Vireonix `auto`.

Disabled from the zero-cost path:
- BlockRun: current Chat Completions require x402 payment.
- Pollinations: the previously used key reached its provider budget.

There is no paid fallback. Bolt/StackBlitz are not part of this gateway. If Vireonix is unavailable or rate-limited, the request fails transparently with `zeroCost: true` and `retryable: true`; the gateway never spends money to hide the failure.

The production `/health` response exposes `roleRouting`, `modelBoardVersion`, active `providers`, disabled providers, and the public role mapping. `/v1/jobs` returns `routedAgent`, `provider`, `model`, and `preferred` so the UI can distinguish assignment from actual execution.
