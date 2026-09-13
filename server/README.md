# The Office AI Gateway

`office-gateway.mjs` è il bridge server-side per eseguire realmente gli avatar. Le chiavi dei provider devono stare solo nell'ambiente del server.

## Model pool

Tutti gli avatar usano soltanto modelli frontier del pool Top 7 corrente: GPT-6 Astra, Claude Fable 5.1, Claude Opus 5, Muse Spark 1.3, GPT-5.6 Sol, GLM-5.3 e Grok 4.6. Un avatar può condividere lo stesso modello con un altro se è la scelta migliore per quel ruolo.

## Variabili previste

- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `META_API_KEY`
- `META_API_BASE` — base URL OpenAI-compatible del Meta Model API
- `ZAI_API_KEY`
- `ZAI_API_BASE` — base URL OpenAI-compatible del servizio GLM scelto
- `XAI_API_KEY`
- `OFFICE_SESSION_TOKEN` — token lungo e casuale usato per autorizzare una sessione del front-end
- `OFFICE_ALLOWED_ORIGIN` — normalmente `https://davidecravedi168-beep.github.io`
- `PORT` — opzionale

Il front-end conserva il token di sessione solo in `sessionStorage`: non viene inserito nel repository né persistito in `localStorage`.

Per avvio locale con Node 22+:

```bash
node server/office-gateway.mjs
```

Endpoint:

- `GET /health` — indica quali provider sono configurati senza esporre chiavi
- `POST /v1/jobs` — esegue il team assegnato e restituisce contributi, eventuali failure parziali e sintesi del Direttore

Avere un abbonamento consumer a ChatGPT, Claude o altri servizi non equivale automaticamente ad avere crediti API. Il gateway diventa realmente esecutivo solo quando le relative credenziali API sono disponibili sul server.
