# The Office — Model Board reale

Stato operativo: 15 settembre 2026.

Questo file descrive **i modelli realmente instradati dal percorso pubblico zero-cost**. Non è una wishlist e non deve mostrare come attivi modelli che il gateway non sta realmente eseguendo.

## Regola

Ogni avatar è un ruolo stabile. Il backend sceglie un modello preferito per quel ruolo e passa ai fallback solo se il precedente non completa la richiesta. La UI deve mostrare il **provider e il modello effettivamente restituiti**, non il modello desiderato.

| Agente | Funzione | Preferenza reale zero-cost | Fallback principali |
|---|---|---|---|
| Direttore | Orchestrazione e sintesi | BlockRun · `nvidia/nemotron-3-ultra-550b` | Pollinations `openai`, Vireonix `auto` |
| Lumen | Analisi/ricerca sui materiali forniti | BlockRun · `nvidia/nemotron-3.5-lightning` | Nemotron Ultra, Pollinations, Vireonix |
| Coda | Coding e documenti | BlockRun · `cohere/north-mini-code` | `poolside/laguna-xs-2.1`, Nemotron Ultra, Vireonix |
| Mosaic | Materiali / multimodale quando disponibile | BlockRun · `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning` | Llama 3.2 11B Vision, Nemotron 3.5 Lightning, Vireonix |
| Sage | Strategia e scenari | BlockRun · `nvidia/nemotron-3-ultra-550b` | Nemotron 3.5 Lightning, Vireonix, Pollinations |
| Aegis | Sicurezza e rischio | BlockRun · `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning` | Nemotron Ultra, Vireonix |
| Verity | Controprova | Vireonix · `auto` | Nemotron 3.5 Lightning, Nemotron Nano Omni Reasoning |
| Ledger | Numeri e finanza | BlockRun · `nvidia/nemotron-3-ultra-550b` | Nemotron Nano Omni Reasoning, Vireonix |
| Archivist | Sintesi del contesto/memoria approvata | BlockRun · `nvidia/nemotron-3.5-lightning` | Nemotron Ultra, Vireonix |
| Qualita | Quality gate | Vireonix · `auto` | Nemotron Nano Omni Reasoning, Nemotron 3.5 Lightning |

## Cosa non è ancora attivo

GPT-6 Astra, Claude Fable/Opus, GPT-5.6 Sol, Grok e altri modelli commerciali/frontier **non vengono dichiarati attivi** nel percorso pubblico zero-cost. Potranno entrare in un percorso separato solo quando esisterà un accesso realmente configurato e una policy di costo esplicita.

Lumen non ha ancora browsing web autonomo nel gateway pubblico. Mosaic non deve dichiarare visione di immagini/PDF se il contenuto multimodale non è realmente passato al modello. Archivist non inventa memoria: usa solo il contesto che l’app gli fornisce.

## Verifica runtime

`GET /health` del gateway espone `modelBoardVersion`, `roleRouting` e la mappatura pubblica. Ogni risposta a `/v1/jobs` riporta `routedAgent`, `provider`, `model` e `preferred`, così è possibile distinguere la preferenza dal modello realmente eseguito.
