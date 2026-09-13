# Free 7 — source basis

Verified 13 September 2026 against the current BlockRun and Vireonix public documentation.

Operational zero-account / zero-key pool used by The Office:
- BlockRun — NVIDIA Nemotron 3.5 Lightning
- BlockRun — NVIDIA Nemotron 3 Ultra 550B
- BlockRun — NVIDIA Nemotron 3 Nano Omni 30B A3B Reasoning
- BlockRun — NVIDIA Llama 3.2 11B Vision
- BlockRun — Cohere North Mini Code
- BlockRun — Poolside Laguna XS 2.1
- Vireonix — `auto` free model pool

The runtime rotates the six BlockRun models deterministically and falls back to Vireonix. Calls are made without an API key, wallet, paid model identifier, or payment path. Provider failures are sanitized before being returned to the browser so third-party promotional/error text is not exposed directly to the user.

Availability is still best-effort because all seven engines use shared free capacity. The runtime therefore uses bounded retries and a hard request deadline rather than claiming an SLA.
