# Security boundary

The Office front-end is pubblico su GitHub Pages. Nessuna chiave dei provider deve essere presente nel browser o nel repository.

Il gateway deve:
- tenere le API key solo in variabili d'ambiente server-side;
- accettare richieste solo dall'origine prevista;
- richiedere un token di sessione separato dalle API key;
- non loggare token o chiavi;
- mantenere le azioni sensibili dietro Approval Gate;
- restituire errori parziali senza trasformarli in risultati riusciti.

Il token di sessione del browser è temporaneo e resta in `sessionStorage`; va ruotato se esposto.
