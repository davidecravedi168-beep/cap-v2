# The Office — universal AI work system

The Office non è un pannello per una singola app e non è un ufficio software. È un front-end/prototipo di **ufficio AI generale**: riceve un risultato da ottenere, classifica il lavoro, forma il team adatto, prevede revisione indipendente e blocca le azioni sensibili dietro approvazione umana.

## Modello mentale

- **Area** = contesto permanente (casa, finanze, lavoro, pratiche, viaggi, tecnologia, studio, personale o altro).
- **Progetto** = obiettivo che dura nel tempo e raccoglie più lavori.
- **Lavoro** = incarico concreto da completare adesso.

Il software è soltanto uno dei possibili ambiti. Ricerca, confronti, analisi numeriche, documenti, pianificazione, scrittura, file/immagini e decisioni sono trattati allo stesso livello.

## Routing locale della demo

`universal-office.js` aggiunge una universal intake e un routing euristico locale per mostrare l'esperienza prevista: tipo di lavoro, area, specialisti, reviewer e approval gate. Non chiama modelli esterni e non finge di aver eseguito attività reali.

L'architettura di produzione prevista è:

`brief → orchestrator → specialisti paralleli → reviewer indipendente → quality gate → owner approval (se serve) → executor`

## Sicurezza

La build statica non contiene chiavi API e non esegue pagamenti, invii, cancellazioni, acquisti o altre azioni esterne. L'Approval Desk è una simulazione UX. Qualsiasi futura integrazione reale dovrà conservare il principio fail-closed: nessuna azione sensibile senza consenso esplicito e scope verificabile.

## File principali

- `index.html` — shell e viste base
- `styles.css` / `oddities.css` — design originale
- `app.js` — UI core e loader
- `universal-office.js` — intake, Aree/Progetti/Lavori e routing generale
- `universal-office.css` — stile del layer universale
- `.github/workflows/pages.yml` — deploy GitHub Pages
- `.github/workflows/office-ui.yml` — controlli sintattici/contratto UI
