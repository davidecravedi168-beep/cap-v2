# Runtime flow

1. L'utente assegna un lavoro dal front-end.
2. Il Direttore/routing sceglie gli avatar necessari.
3. `office-runtime.js` crea il job con gli ID dei modelli correnti del Model Board.
4. Senza gateway il job resta `queued` localmente e viene mostrato come non eseguito.
5. Con gateway autenticato il job viene inviato a `POST /v1/jobs`.
6. Gli specialisti vengono eseguiti in parallelo quando utile.
7. Il Direttore riceve i contributi e produce la sintesi finale.
8. Failure parziali vengono restituite esplicitamente.
9. Le future azioni esterne sensibili devono passare dall'Approval Gate prima dell'Executor.

Il sistema non tratta gli avatar come modelli fissi: l'identità è il ruolo; il Model Board decide il modello corrente.
