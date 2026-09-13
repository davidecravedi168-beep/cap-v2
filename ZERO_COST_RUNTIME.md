# The Office — Zero Cost Runtime

Policy attiva: **0 € di spesa API**.

Il runtime operativo usa esclusivamente endpoint OpenRouter `:free` oppure il router `openrouter/free`. Il gateway applica anche `provider.max_price.prompt = 0` e `provider.max_price.completion = 0`: se un endpoint non è gratuito, la richiesta deve fallire invece di generare un addebito.

## Free 7 operativo

- NVIDIA Nemotron 3 Ultra — Direttore / orchestrazione
- Poolside Laguna S 2.1 — coding e implementazione
- NVIDIA Nemotron 3 Super — strategia e quality review
- inclusionAI Ling 3.0 Flash VL — multimodale
- inclusionAI Ling 3.0 Flash Fin — numeri e finanza
- Google Gemma 4 26B A4B IT — sicurezza/review
- OpenAI gpt-oss-20b — devil's advocate / seconda opinione

Il vecchio Frontier 7 proprietario resta soltanto un benchmark qualitativo: non viene invocato in modalità 0 € perché i modelli proprietari frontier hanno costo API. The Office deve mostrare il modello realmente eseguito.

## Hosting e segreti

Il gateway è una Neon Function sul piano Free. La chiave OpenRouter deve stare **solo** nella variabile d'ambiente server-side `OPENROUTER_API_KEY` della funzione Neon. Il browser non riceve, memorizza o inoltra la chiave provider e nessuna chiave viene committata nel repository.

La funzione pubblica accetta richieste browser solo dall'origine GitHub Pages di The Office. Il vincolo economico non dipende dal client: è imposto anche lato server con prezzo massimo pari a zero.

## Limiti deliberati

La ricerca web OpenRouter è disabilitata perché comporta costi anche quando il modello è gratuito. Lumen può lavorare su materiali forniti, URL/contenuti già acquisiti e conoscenza del modello, ma non deve fingere browsing live.

Il piano Free di OpenRouter ha limiti di richieste: il runtime tiene il team piccolo (massimo due specialisti, poi quality gate e Direttore) per preservare quota. Se la quota gratuita finisce, The Office deve fermarsi e riprovare in seguito: **mai fallback a pagamento**.
