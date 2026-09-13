# The Office — Model Board

Mappatura operativa corrente, verificata il 13 settembre 2026.

## Frontier 7

The Office usa soltanto modelli frontier/top-player per i dipendenti attivi:

1. GPT-6 Astra
2. Claude Fable 5.1
3. Claude Opus 5
4. Muse Spark 1.3
5. GPT-5.6 Sol
6. GLM-5.3
7. Grok 4.6

Questa è una **selezione operativa di sette modelli frontier**, non una classifica assoluta immutabile. La base è l'Artificial Analysis Intelligence Index v4.3, integrata con fit sul ruolo e diversità di provider. Il Model Board va rivalidato quando cambia la frontiera.

| Avatar | Funzione | AI primaria | Backup |
|---|---|---|---|
| Direttore | Orchestrazione e sintesi | GPT-6 Astra | Claude Fable 5.1 |
| Lumen | Ricerca web e fonti | GPT-6 Astra + web search | Claude Fable 5.1 |
| Coda | Costruzione, coding, documenti | Claude Fable 5.1 | GPT-6 Astra |
| Mosaic | Multimodale, immagini, PDF/video | Muse Spark 1.3 | GPT-6 Astra |
| Sage | Strategia e scenari | Claude Opus 5 | GPT-6 Astra |
| Aegis | Sicurezza e rischio | GPT-5.6 Sol | Claude Opus 5 |
| Verity | Devil's advocate indipendente | Grok 4.6 | GLM-5.3 |
| Ledger | Numeri e finanza | GLM-5.3 | GPT-6 Astra |
| Archivist | Memoria e retrieval | Claude Fable 5.1 + retrieval | GPT-6 Astra |
| Qualita | Quality gate | Claude Fable 5.1 | Grok 4.6 |
| Executor | Esecuzione controllata | GPT-6 Astra | Claude Fable 5.1 |

## Slug runtime

Il gateway usa OpenRouter come trasporto unico: `openai/gpt-6-astra`, `anthropic/claude-fable-5.1`, `anthropic/claude-opus-5`, `meta/muse-spark-1.3`, `openai/gpt-5.6-sol`, `z-ai/glm-5.3`, `x-ai/grok-4.6`.

## Regola fondamentale

L'avatar rappresenta un **ruolo stabile**, non un modello immutabile. Il Model Board può sostituire il modello quando cambiano benchmark, disponibilità, capacità o affidabilità, ma deve restare nel pool frontier approvato. Per le revisioni importanti si preferisce un provider diverso da quello che ha prodotto il lavoro.

## Runtime

Il browser non contiene chiavi API. Gli incarichi vengono preparati con il modello assegnato e inviati al gateway server-side solo quando è configurato e autenticato. Senza gateway rimangono nella coda locale e vengono mostrati come non eseguiti: The Office non finge che un modello abbia lavorato.
