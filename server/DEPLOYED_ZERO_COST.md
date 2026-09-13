# Deployed zero-cost gateway

Neon project: `office-free-runtime`

Function slug: `officefree`

Invocation base URL:
`https://br-floral-shadow-aygwywoy-officefree.compute.c-5.us-east-2.aws.neon.tech/`

Deployment 8 completed successfully on Node.js 24 on 13 September 2026.

The active gateway requires no provider secret: it uses six no-key BlockRun free models in rotation plus the no-key Vireonix `auto` pool. The runtime enforces a bounded 22-second provider deadline, sanitizes upstream errors, reports `retryable` on temporary free-capacity exhaustion, and never introduces a paid fallback.
