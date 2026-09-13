# 3.1 · 13 settembre 2026

La precedente UI mostrava diversi avatar su una singola chiamata AI, accorciava i risultati nello storico e lasciava il lavoro precedente incompleto. Questa release consolida il frontend modulare recuperato e aggiunge una tavola rotonda con chiamate separate.

## Cambiamenti

- Un’unica versione su `/` e `/office.html`, con asset identificati dal contenuto.
- Nuova stanza con nove avatar, scrivania, risultati completi e controlli per telefono.
- Flusso specialisti → sintesi → controprova, contributi verificabili e ripresa dopo interruzione.
- Seguito contestuale dei lavori, materiali testuali, progetti e approvazione del risultato.
- Memoria selettiva, feedback misurabile, importazione sicura e gestione di archivi danneggiati.
- Distinzione fra una seconda lettura dello stesso modello e una revisione fra modelli distinti.

## Verifica

I test automatici coprono migrazione dello storico, richieste duplicate, privacy dei materiali, annullamento, timeout, revisori, ripresa dei contributi, rendering sicuro, importazione, autenticazione, cifratura e vincolo sui prezzi. Le prove sul servizio reale usano esclusivamente brief sintetici pubblici.

## Confini della release

Il gateway protetto è codice disponibile, da configurare. Lo storico attivo rimane sul dispositivo. Non vengono attivati modelli a pagamento o connettori per azioni esterne. L’aggiornamento migliora un prodotto in sviluppo; non rappresenta una certificazione di superiorità sul mercato.
