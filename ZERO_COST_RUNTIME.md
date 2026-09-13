# The Office — Zero Cost Runtime

Policy attiva: **0 € di spesa API**.

Il runtime operativo usa esclusivamente endpoint OpenRouter con suffisso `:free` oppure `openrouter/free`. Il gateway applica anche `provider.max_price.prompt = 0` e `provider.max_price.completion = 0`: se un provider/model non è gratuito, la richiesta deve fallire invece di generare un addebito.

## Free 7 operativo

- NVIDIA Nemotron 3 Ultra — Direttore / orchestrazione
- Poolside Laguna S 2.1 — coding e implementazione
- NVIDIA Nemotron 3 Super — strategia e quality review
- inclusionAI Ling 3.0 Flash VL — multimodale
- inclusionAI Ling 3.0 Flash Fin — numeri e finanza
- Google Gemma 4 26B A4B IT — sicurezza/review
- OpenAI gpt-oss-20b — devil's advocate / seconda opinione

Il vecchio Frontier 7 proprietario resta un benchmark qualitativo, ma non viene invocato in modalità 0 € perché i modelli proprietari frontier hanno costo API. The Office mostra il modello realmente eseguito.

## Hosting

Il gateway è una Neon Function sul piano Free. La funzione non conserva la chiave OpenRouter: il browser la mantiene solo in `sessionStorage` e la invia al gateway per la singola richiesta. Nessuna chiave è committata nel repository.

## Limiti deliberati

La ricerca web a pagamento di OpenRouter è disabilitata in modalità 0 €. Lumen può lavorare su materiali forniti, URL/contenuti già acquisiti e knowledge del modello, ma non deve fingere browsing live.
