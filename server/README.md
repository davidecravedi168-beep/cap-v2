# The Office AI Gateway

`office-gateway.mjs` è il bridge server-side per eseguire realmente gli avatar. Le chiavi dei provider devono stare solo nell'ambiente del server.

Variabili previste:

- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `GEMINI_API_KEY`
- `PERPLEXITY_API_KEY`
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

Nota: avere un abbonamento consumer a ChatGPT/Claude/Perplexity non equivale automaticamente ad avere crediti API. Il gateway diventa realmente esecutivo solo quando le relative credenziali API sono disponibili sul server.
