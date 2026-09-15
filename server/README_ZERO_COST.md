# The Office — backend 0 €

Backend attivo: Neon Function `officefree` sul piano Neon Free.

## Regola economica

Il percorso pubblico etichettato `0 €` può chiamare solo provider che, al momento del deploy, non richiedono pagamento o credito sviluppatore. Non esiste fallback a pagamento e un errore del provider non viene mai trasformato in una spesa automatica.

Provider pubblico attivo: **Vireonix `auto`**.

Provider esclusi dal percorso zero-cost:
- **BlockRun** — le Chat Completions correnti richiedono pagamento x402;
- **Pollinations** — la key precedentemente usata ha raggiunto il budget del provider.

Se l’unico provider gratuito è temporaneamente indisponibile o rate-limited, il job fallisce in modo trasparente con `zeroCost: true` e, quando appropriato, `retryable: true`.

## Ruoli

Direttore, Ledger, Coda, Sage, Verity e gli altri ruoli restano distinti tramite istruzioni specialistiche e orchestrazione. Il sistema non dichiara modelli differenti quando il provider effettivo è lo stesso: provenienza e modello realmente restituiti vengono registrati per ogni chiamata.

## Timeout

Il gateway V10.0.2 assegna a Vireonix fino a circa 26 secondi dentro un budget complessivo di 28 secondi. In precedenza parte del tempo veniva consumato da provider non più realmente gratuiti, lasciando al fallback una finestra troppo breve.

## Sicurezza e costi

Bolt e StackBlitz restano bloccati dal Cost Guard. Pagamenti, cancellazioni, pubblicazioni e altre azioni esterne non vengono autorizzati da un semplice budget dell’obiettivo e continuano a richiedere controllo umano secondo la Company Constitution.
