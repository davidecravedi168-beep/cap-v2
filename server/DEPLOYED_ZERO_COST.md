# Deployed zero-cost gateway

Neon project: `office-free-runtime`

Function slug: `officefree`

Invocation base URL:
`https://br-floral-shadow-aygwywoy-officefree.compute.c-5.us-east-2.aws.neon.tech/`

Deployment **11** completed successfully on Node.js 24 on **15 September 2026**.

The active gateway runs the V9.3 real Model Board (`2026-09-15-v2`). It routes each Office role to a preferred zero-cost provider/model and records the provider and model that actually answered. The route can fall back when free capacity is unavailable; the preferred model is never presented as the executed model unless the provider actually reports it.

Active zero-cost transports are BlockRun free models, Pollinations, and Vireonix `auto`. There is no paid fallback. Bolt/StackBlitz are not part of this gateway.

The production `/health` response exposes `roleRouting`, `modelBoardVersion`, and the current public role mapping. `/v1/jobs` returns `routedAgent`, `provider`, `model`, and `preferred` so the UI can distinguish assignment from execution.
