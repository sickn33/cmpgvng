# CMP GVNG - OneDrive Gallery Implementation

## Background and Motivation

L'utente vuole aggiungere una galleria immagini al sito https://sickn33.github.io/cmpgvng/ che attualmente permette solo di **caricare** file su OneDrive. La nuova funzionalità deve:

- Mostrare le immagini già caricate su OneDrive
- Integrarsi con il design esistente (glassmorphism, dark mode)
- Essere semplice da implementare e mantenere

## Key Challenges and Analysis

1. **Backend**: Il worker Cloudflare attuale ha solo endpoint `/upload`. Serve un nuovo endpoint `/gallery` per listare i file nella cartella OneDrive.

2. **OneDrive API**: Usare Microsoft Graph API per:

   - Listare i file nella cartella (`GET /drives/{driveId}/items/{folderId}/children`)
   - Ottenere thumbnail delle immagini (più veloce del download completo)

3. **Frontend**: Aggiungere:

   - Sezione galleria con griglia responsive
   - Lightbox per vedere le immagini a schermo intero
   - Navigazione tra upload e galleria

4. **Tipo di galleria scelto**: **Griglia responsive con lightbox** - è il più semplice e funzionale.

## High-level Task Breakdown

- [ ] Task 1: Aggiungere endpoint `/gallery` al worker Cloudflare
  - Success: L'endpoint ritorna lista di file con thumbnail URLs
- [ ] Task 2: Deploy del worker aggiornato
  - Success: `curl https://cmpgvng-api.cmpgvng.workers.dev/gallery` ritorna JSON
- [ ] Task 3: Creare HTML per la sezione galleria
  - Success: Toggle tra "Carica" e "Galleria" visibile nell'interfaccia
- [ ] Task 4: Creare CSS per griglia galleria e lightbox
  - Success: Stile coerente con design esistente
- [ ] Task 5: Creare JavaScript per fetch e rendering galleria
  - Success: Immagini caricate e visualizzate correttamente
- [ ] Task 6: Implementare lightbox per vista full-screen
  - Success: Click su immagine apre vista grande con navigazione
- [ ] Task 7: Test manuale end-to-end
  - Success: Utente può vedere le immagini caricate

## Project Status Board

- [ ] Backend (Worker Cloudflare)
- [ ] Frontend (HTML/CSS/JS)
- [ ] Testing e verifica

## Executor's Feedback or Assistance Requests

_Nessuna richiesta al momento_

## Lessons

- Backup creato in: `cmpgvng-backup-20260115_133437`
- Worker URL: `https://cmpgvng-api.cmpgvng.workers.dev`
- Variabili ambiente necessarie: `ONEDRIVE_DRIVE_ID`, `ONEDRIVE_FOLDER_ID`
