# The Office — lavoro recuperato da Work

Questa nota consolida il disegno già sviluppato per The Office, così non viene perso mentre l'interfaccia evolve.

## Missione
The Office è un ufficio AI generale, non un contenitore per app specifiche. Riceve qualsiasi tipo di lavoro: ricerca, decisioni, analisi, documenti, pianificazione, file, immagini, software, organizzazione o attività miste.

## Architettura recuperata

`utente → Direttore/orchestratore → specialisti in parallelo → reviewer indipendenti → Quality Director → Approval Gate umano quando necessario → Executor → audit + memoria`

Principi da preservare:
- i ruoli restano stabili, i modelli possono cambiare nel tempo;
- il Direttore sceglie il team in base al lavoro, non in base al progetto;
- i reviewer devono poter usare un provider/modello diverso dal produttore per ridurre il rischio di errori correlati;
- nessuna azione sensibile deve partire senza approvazione esplicita e scope verificabile;
- memoria e apprendimento derivano da esiti revisionati, non da auto-addestramento cieco;
- ogni incarico deve lasciare audit di chi ha lavorato, con quale modello, quali fonti/strumenti e quale revisione;
- il Model Board aggiorna la scelta dei modelli senza cambiare l'identità degli avatar.

## Gerarchia di prodotto
- **Area**: contesto permanente.
- **Progetto**: obiettivo che dura nel tempo.
- **Lavoro**: incarico concreto da completare.

## Esperienza
- home centrata su “Cosa dobbiamo fare?”;
- ufficio/tavola rotonda interattiva;
- avatar cliccabili con ruolo, AI primaria, backup e stato;
- Approval Desk;
- memoria e Model Board;
- Weekly League basata su risultati verificati, qualità prima della quantità;
- eccentricità/stranezze leggere per dare personalità, senza ridurre chiarezza e affidabilità.

## Stato operativo
Il front-end può già creare, classificare, instradare e persistere lavori. L'inferenza AI reale deve passare da un gateway server-side: nessuna chiave API deve essere inclusa nel codice pubblico di GitHub Pages.
