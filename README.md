# The Office · 3.1

Un ufficio AI generale con una scrivania, ruoli riconoscibili e risultati che si possono leggere, correggere e conservare.

**Apri:** https://davidecravedi168-beep.github.io/cap-v2/

Il vecchio indirizzo `/office.html` apre la stessa versione. Gli incarichi della precedente interfaccia vengono recuperati senza cancellare l’archivio originale.

## Cosa funziona

- Brief in linguaggio naturale, classificazione locale, area, progetto, priorità, ricerca e archivio.
- **Risposta rapida:** una chiamata al gateway gratuito già collegato.
- **Tavola rotonda:** fino a due specialisti, sintesi del Direttore e controprova di Verity, con chiamate reali e separate. Un modello può coprire più ruoli: l’interfaccia lo dichiara.
- Ogni contributo ricevuto viene salvato. Un tentativo interrotto può riprendere dai passaggi riusciti, su richiesta del proprietario.
- Risultati integrali con tabelle, elenchi e codice; copia ed esportazione Markdown.
- Un seguito include il brief e il risultato del lavoro precedente e ne conserva la classificazione di riservatezza.
- Allegati TXT, Markdown, CSV e JSON: massimo quattro file, 12.000 caratteri complessivi. Il contenuto è incluso nel lavoro quando lo affidi.
- Decisione del proprietario sul risultato e feedback di utilità. Approvare un risultato non esegue azioni esterne.
- Memoria locale approvata, esportazione/importazione controllata e protezione contro la perdita di dati in caso di archivio danneggiato o spazio esaurito.
- Avatar cliccabili, pausa caffè, navigazione mobile, scorciatoia ⌘/Ctrl+Invio nel brief e `/` per un nuovo incarico.

## Limiti reali

Il gateway attualmente collegato usa BlockRun e Vireonix senza una chiave API nel browser. Disponibilità e identità del modello dipendono dal servizio; una risposta al controllo di connessione non dimostra che l’AI stia rispondendo. Il risultato di ogni incarico mostra il provider e il modello dichiarati dalla risposta.

L’esecuzione gratuita è destinata a materiale **pubblico**. Non inviare credenziali o dati riservati. Le memorie approvate non vengono inviate al gateway pubblico. Nessun token di accesso è incluso nel repository.

La tavola rotonda separa le chiamate, non garantisce modelli o provider diversi. Un verdetto di revisione non costituisce una prova di accuratezza. Se mancano contributi o la controprova non passa, il risultato viene segnalato come parziale.

Non sono collegati ricerca web, lettura di immagini/PDF, posta, pagamenti o operazioni su file esterni. I link proposti dai modelli non sono fonti verificate automaticamente. Non sono collegati automaticamente gli account ChatGPT, Claude, Gemini o Grok.

Lo storico nel browser è locale, non cifrato dall’app e non sincronizzato fra dispositivi. La chiusura della pagina ferma l’orchestrazione nel browser; una richiesta già inviata può continuare sul gateway. Il registro locale è diagnostico e modificabile.

## Gateway personale (codice disponibile, da configurare)

`server/secure-function.mjs` offre un percorso separato autenticato per uso personale: token esclusivamente in memoria nel browser, schema delle richieste vincolato, cifratura AES-256-GCM, idempotenza, quote, registro concatenato e verifica dei prezzi dei modelli gratuiti OpenRouter. Richiede una chiave OpenRouter sul server, token personale, chiave di cifratura e schema Postgres. **Questo percorso non è il servizio pubblico attualmente attivo.**

La modalità `independent` pretende un modello revisore effettivamente distinto e ritorna un esito parziale se il controllo fallisce. Le chiavi vanno configurate nel servizio, mai nei file pubblicati. Nessuna API con effetti esterni è implementata.

## Sviluppo e pubblicazione

```sh
npm run check
npm test
npm run build
npm run dev
```

Richiede Node 24. I test e il frontend non richiedono pacchetti esterni. La dipendenza `pg` serve soltanto al gateway personale.

Il deploy GitHub Pages passa da tutti i controlli prima di pubblicare `dist`. Il pacchetto contiene esclusivamente frontend e pagina di verifica responsive. I moduli sono in una directory identificata dal contenuto, così una nuova release non mischia JavaScript vecchio e nuovo.

`qa/responsive.html` è una pagina per verificare il layout a 360, 390, 768 e 1280 pixel. Non equivale a un test su un dispositivo iOS fisico.

## Riferimenti di progettazione

- [LangGraph: persistenza e checkpoint](https://docs.langchain.com/oss/javascript/langgraph/persistence): distinguere stato del lavoro e memoria fra lavori.
- [CrewAI: Flows](https://docs.crewai.com/en/concepts/flows): ruoli, passaggi e gestione esplicita dello stato.
- [Relevance AI: Workforce](https://relevanceai.com/workforce): team coordinati e controlli sul flusso di lavoro.

Sono riferimenti per scelte progettuali; The Office non incorpora questi framework e non ne rivendica tutte le capacità.
