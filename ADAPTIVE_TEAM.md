# The Office V9.4 — Adaptive Team

V9.4 rende selettiva la Tavola Rotonda senza introdurre costi o fingere machine learning.

## Regola

1. Il fit con il compito viene prima dello storico.
2. Lo storico locale può ordinare agenti già pertinenti o far entrare un secondo specialista quando esistono segnali sufficienti.
3. Prima del Direttore vengono convocati al massimo due specialisti.
4. Verity resta una controprova separata e non compete per il ruolo di specialista.
5. Un checkpoint conserva la decisione del team, quindi una ripresa non cambia squadra a metà lavoro.

## Performance Board

Il ranking usa solo dati osservati nel workspace locale:

- chiamate effettive per agente;
- risposte riuscite e failure registrate;
- feedback `Utile / Da migliorare`;
- decisioni `Approva / Da rivedere`;
- provider e modello realmente riportati nei contributi;
- latenza, quando disponibile.

Il punteggio è un indice operativo smussato e deterministico. **Non è accuratezza, non è training e non è machine learning.** Con pochi dati resta vicino a un valore neutro e il fit del compito domina sempre.

## Costi e sicurezza

V9.4 riusa il gateway zero-cost esistente e non abilita Bolt, StackBlitz, Netlify o fallback a pagamento. Non aggiunge azioni esterne: pagamenti, invii, cancellazioni e altre operazioni rischiose restano fuori dal runtime pubblico.
