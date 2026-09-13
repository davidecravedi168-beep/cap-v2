# The Office — Model Board

Mappatura operativa corrente (verificata il 13 settembre 2026):

| Avatar | Funzione | AI primaria | Backup |
|---|---|---|---|
| Direttore | Orchestrazione e sintesi | OpenAI GPT-5.6 Sol (`gpt-5.6-sol`) | Claude Opus 5 |
| Lumen | Ricerca web e fonti | Perplexity Agent API preset `high` | preset `medium` |
| Coda | Costruzione, coding, documenti | Claude Opus 5 (`claude-opus-5`) | GPT-5.6 Sol |
| Mosaic | Multimodale, immagini, PDF | Gemini 3.8 Flash (`gemini-3.8-flash`) | GPT-5.6 Sol |
| Sage | Strategia e scenari | Claude Opus 5 | GPT-5.6 Sol |
| Aegis | Sicurezza e rischio | GPT-5.6 Sol | Claude Opus 5 |
| Verity | Devil's advocate indipendente | Grok 4.6 (`grok-4.6`) | Claude Sonnet 5 |
| Ledger | Numeri e finanza | GPT-5.6 Sol | Claude Opus 5 |
| Archivist | Memoria e retrieval | GPT-5.6 Terra (`gpt-5.6-terra`) + retrieval | GPT-5.6 Sol |

## Regola fondamentale

L'avatar rappresenta un **ruolo stabile**, non un modello immutabile. Il Model Board può sostituire il modello quando cambiano qualità, costo, disponibilità o capacità. Per le revisioni importanti si preferisce, quando possibile, un provider diverso da quello che ha prodotto il lavoro.

## Runtime

Il browser non contiene chiavi API. Gli incarichi vengono preparati con il modello assegnato e inviati al gateway server-side solo quando è configurato e autenticato. Senza gateway rimangono nella coda locale, senza fingere che un modello li abbia eseguiti.
