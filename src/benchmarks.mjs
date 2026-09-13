export const BENCHMARKS = [
  { rank: 1, name: 'Relevance AI', category: 'Ufficio di agenti', take: 'Team di specialisti, flussi visibili e punti di approvazione.', url: 'https://relevanceai.com/workforce' },
  { rank: 2, name: 'LangGraph + LangSmith', category: 'Orchestrazione e qualità', take: 'Stato persistente, ripresa dopo gli errori, test su casi reali.', url: 'https://docs.langchain.com/oss/python/langgraph/persistence' },
  { rank: 3, name: 'CrewAI', category: 'Team e processi', take: 'Ruoli stabili, passaggi strutturati e revisione dei contributi.', url: 'https://docs.crewai.com/en/concepts/flows' },
  { rank: 4, name: 'n8n', category: 'Automazioni e connettori', take: 'Integrazioni, debug dei singoli passaggi e ambienti separati.', url: 'https://n8n.io/features/' },
  { rank: 5, name: 'Microsoft Copilot Studio', category: 'Governo aziendale', take: 'Identità, permessi, controllo dei dati e registro delle attività.', url: 'https://www.microsoft.com/en-us/microsoft-365-copilot/microsoft-copilot-studio' },
];
export const CAPABILITIES = [
  ['Incarichi, aree e progetti', 'Disponibile', 'Coda locale con priorità, ricerca, esportazione e ripristino dopo interruzione.'],
  ['Risposte AI gratuite', 'Motore collegato', 'BlockRun / Vireonix; disponibilità e modello dipendono dal provider. Solo materiali pubblici.'],
  ['Tavola rotonda', 'Disponibile', 'Richieste separate per specialisti, Direttore e Verity; contributi salvati. Modelli uguali non sono spacciati per revisori indipendenti.'],
  ['Continuità degli incarichi', 'Disponibile', 'Seguito con brief e risultato precedente; nei lavori interrotti ripresa dei contributi già ricevuti.'],
  ['Materiali di testo', 'Disponibile', 'TXT, Markdown, CSV e JSON: fino a quattro file e 12.000 caratteri, inclusi solo nell’incarico a cui li alleghi.'],
  ['Modelli effettivamente usati', 'Disponibile', 'Mostrati dalla risposta del gateway; mai dedotti dal nome dell’avatar.'],
  ['Memoria selettiva', 'Disponibile', 'Note locali approvate. Invio possibile solo al gateway protetto e con selezione esplicita.'],
  ['Valutazione dei risultati', 'Disponibile', 'Feedback del proprietario. Non è un benchmark scientifico né addestramento dei modelli.'],
  ['Gateway personale', 'Da collegare', 'Codice protetto con token, limiti e modalità gratuita verificata. Richiede configurazione personale.'],
  ['Revisori con modelli distinti', 'Gateway protetto', 'Confronto sull’identità effettiva dei modelli. Se il controllo fallisce, risultato parziale.'],
  ['Ricerca web live', 'Non collegata', 'I link citati da un modello non sono fonti verificate automaticamente.'],
  ['Immagini e PDF', 'Non collegati', 'Sono supportati gli allegati di testo. Foto, PDF e ricerche web richiedono connettori dedicati.'],
  ['Pagamenti, invii e cancellazioni', 'Non eseguibili', 'Nessun connettore con effetti esterni attivo. Puoi preparare e valutare le bozze.'],
  ['Multiutente e audit duraturo', 'Da attivare', 'Il registro nel browser è modificabile e non sostituisce l’audit di un server.'],
];
