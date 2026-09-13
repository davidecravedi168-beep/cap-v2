# The Office AI Gateway

`office-gateway.mjs` è il bridge server-side che esegue realmente gli avatar. Il browser pubblico non contiene chiavi API.

## Frontier 7

Il pool operativo corrente è composto da GPT-6 Astra, Claude Fable 5.1, Claude Opus 5, Muse Spark 1.3, GPT-5.6 Sol, GLM-5.3 e Grok 4.6. Gli avatar sono ruoli stabili; il Model Board assegna il modello più adatto e può sostituirlo quando cambia la frontiera.

## Una sola integrazione

Il gateway usa **OpenRouter** come trasporto unico. In questo modo The Office non richiede sette integrazioni e sette chiavi separate: serve una sola `OPENROUTER_API_KEY`, mentre il modello cambia per ogni avatar tramite slug esplicito. Lumen abilita anche il server tool di web search.

Variabili:

- `OPENROUTER_API_KEY` — unica chiave dei modelli
- `OFFICE_SESSION_TOKEN` — token lungo e casuale che autorizza il front-end
- `OFFICE_ALLOWED_ORIGIN` — normalmente `https://davidecravedi168-beep.github.io`
- `OFFICE_MAX_TEAM` — massimo numero di agenti per un singolo incarico, default 5
- `OFFICE_MAX_OUTPUT_TOKENS` — limite output per singola chiamata, default 10000
- `PORT` — opzionale

Il front-end conserva `OFFICE_SESSION_TOKEN` solo in `sessionStorage`: non viene inserito nel repository e non persiste dopo la chiusura della sessione browser.

Per avvio locale con Node 22+:

```bash
node server/office-gateway.mjs
```

Endpoint:

- `GET /health` — stato runtime, presenza credenziali e modelli configurati senza esporre segreti
- `POST /v1/jobs` — esegue specialisti in parallelo e fa sintetizzare il risultato al Direttore

## Costi

Gli abbonamenti consumer a ChatGPT, Claude, Grok ecc. non includono automaticamente l'uso API. I modelli Frontier 7 sono a consumo: è consigliato creare una chiave OpenRouter con un limite di spesa e mantenere `OFFICE_MAX_TEAM`/`OFFICE_MAX_OUTPUT_TOKENS` contenuti.
