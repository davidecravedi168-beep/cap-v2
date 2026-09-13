# The Office — backend 0 €

Backend attivo: Neon Function `officefree` sul piano Neon Free.

## Regola economica

Ogni chiamata OpenRouter usa solo modelli `:free` o `openrouter/free` e imposta `provider.max_price.prompt = 0` e `provider.max_price.completion = 0`. Se non esiste un endpoint gratuito disponibile, la richiesta fallisce. Non esiste fallback a pagamento.

La ricerca web OpenRouter non viene attivata perché comporta costi separati anche con modelli gratuiti.

## Segreto server-side

La sola variabile da configurare nella Neon Function è:

`OPENROUTER_API_KEY`

Va impostata nell'ambiente della funzione Neon e non nel browser, non in GitHub Pages e non nel repository.

## Quota

Il client limita il team a tre ruoli e il gateway esegue al massimo due specialisti, poi Quality e Direttore. Questo contiene il numero di richieste e rende il sistema compatibile con una quota free limitata. Se la quota finisce, il job fallisce senza spesa.
