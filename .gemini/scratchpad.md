# OneDrive Upload Web Interface

## Background and Motivation

L'utente vuole creare un'interfaccia web semplice e user-friendly per permettere ai suoi amici di caricare foto e video su un drive condiviso OneDrive. Il problema principale è che l'interfaccia nativa di OneDrive è complessa per utenti non tecnici.

**Obiettivi:**

1. Interfaccia web semplice e intuitiva
2. Hosting gratuito su GitHub Pages
3. Upload diretto a OneDrive tramite Microsoft Graph API
4. Accessibile a tutti gli amici senza login complesso

**Vincoli tecnici identificati:**

- GitHub Pages supporta solo contenuti statici (HTML, CSS, JS)
- Microsoft Graph API richiede autenticazione OAuth 2.0
- Per una SPA, serve Azure AD App Registration con flow PKCE
- I file vengono caricati tramite `PUT` a Microsoft Graph endpoint

## Key Challenges and Analysis

### Sfida 1: Autenticazione

**Opzioni:**

1. **Login individuale (OAuth)** - Ogni utente si autentica con il proprio account Microsoft

   - Pro: Sicuro, audit trail
   - Contro: Richiede account Microsoft, più complesso per gli utenti

2. **Token pre-autorizzato (Non raccomandato)** - Token dell'owner nel frontend

   - Pro: Zero login per gli utenti
   - Contro: Molto insicuro, token esposto pubblicamente

3. **Backend proxy (Raccomandato per produzione)** - Backend che gestisce auth
   - Pro: Sicuro, flessibile
   - Contro: Richiede hosting backend (non solo GitHub Pages)

**Decisione:** Per un MVP hostato su GitHub Pages, useremo l'**opzione 1** (OAuth). Gli amici dovranno avere un account Microsoft (anche solo con email personale) e autenticarsi una volta. È il compromesso migliore tra sicurezza e semplicità.

### Sfida 2: Permessi OneDrive

Per caricare su una cartella condivisa, l'utente owner deve:

1. Condividere la cartella con gli amici (già fatto)
2. Gli amici devono avere permessi di modifica/upload

L'API Microsoft Graph permette di caricare file usando:

- `PUT /me/drive/items/{parent-item-id}:/{filename}:/content` (per file < 4MB)
- Upload session per file > 4MB

### Sfida 3: UX/UI

- Design moderno e accattivante
- Drag & drop per file
- Progress bar durante upload
- Preview per immagini
- Responsive (mobile-friendly)

## High-level Task Breakdown

### Fase 1: Setup Progetto e Azure AD

- [ ] Task 1.1: Registrare app su Azure AD Portal
- [ ] Task 1.2: Configurare permessi API (Files.ReadWrite.All)
- [ ] Task 1.3: Abilitare PKCE per SPA

### Fase 2: Struttura Progetto

- [ ] Task 2.1: Creare struttura base HTML/CSS/JS
- [ ] Task 2.2: Integrare MSAL.js per autenticazione
- [ ] Task 2.3: Integrare Microsoft Graph SDK

### Fase 3: Implementazione Core

- [ ] Task 3.1: Implementare login/logout con MSAL
- [ ] Task 3.2: Implementare upload file semplice (< 4MB)
- [ ] Task 3.3: Implementare upload file grandi (> 4MB) con resumable upload
- [ ] Task 3.4: Implementare drag & drop

### Fase 4: UI/UX Polish

- [ ] Task 4.1: Design moderno (dark mode, glassmorphism)
- [ ] Task 4.2: Progress bar e feedback visivo
- [ ] Task 4.3: Preview immagini
- [ ] Task 4.4: Mobile responsive

### Fase 5: Deploy

- [ ] Task 5.1: Setup GitHub Pages
- [ ] Task 5.2: Configurare redirect URI su Azure AD
- [ ] Task 5.3: Test end-to-end

## Project Status Board

### Da Fare

- [ ] Creare implementation_plan.md dettagliato
- [ ] Attendere approvazione utente

### In Corso

- [/] Analisi requisiti e ricerca API

### Completato

- [x] Ricerca skill rilevanti
- [x] Ricerca Microsoft Graph API
- [x] Identificazione flow autenticazione

## Executor's Feedback or Assistance Requests

### 🔴 PROBLEMA ATTIVO: Utenti esterni non riescono a caricare file

**Data:** 2026-01-15

**Descrizione:** Gli utenti esterni con cui è stata condivisa la cartella non riescono a caricare file.

**Indagine (seguendo systematic-debugging skill):**

#### Fase 1: Root Cause Investigation

**Flusso attuale in `upload.js`:**

1. **Approccio 1 (ID diretti)**: Usa `driveId`/`folderId` hardcoded → funziona SOLO per owner
2. **Approccio 2 (sharedWithMe)**: Cerca in "Condivisi con me" → dovrebbe funzionare per amici
3. **Approccio 3 (share link)**: Usa share link encodato
4. **Approccio 4 (fallback)**: Crea cartella nel drive utente

**Possibili cause:**

- [ ] La cartella non appare in "sharedWithMe" dell'utente (condivisione solo tramite link?)
- [ ] Permessi solo lettura sulla cartella (Edit vs View)
- [ ] Share link non ha permessi di scrittura
- [ ] CSP blocca richieste (già aggiunto `*.sharepoint.com` e `*.microsoftpersonalcontent.com`)
- [ ] Scopes API insufficienti (`Files.ReadWrite.All` dovrebbe bastare)

**Informazioni necessarie dall'utente:**

1. Che errore appare nella console del browser dell'utente esterno?
2. La cartella è stata condivisa con permesso "Edit" o solo "View"?
3. L'utente esterno vede la cartella in "Condivisi con me" nel suo OneDrive web?

**Stato:** ⏳ In attesa informazioni utente

## Lessons

1. **Microsoft Graph API** richiede Azure AD App Registration
2. **MSAL.js 2.0+** supporta PKCE flow per SPA (più sicuro del vecchio Implicit Grant)
3. **GitHub Pages** può hostare l'app ma richiede che tutta la logica sia client-side
4. Per file > 4MB serve usare **upload session** (resumable upload)
5. I permessi necessari sono `Files.ReadWrite.All` (delegated)

## References

- [Microsoft Graph File Upload](https://learn.microsoft.com/en-us/graph/api/driveitem-put-content)
- [MSAL.js 2.0 SPA Tutorial](https://learn.microsoft.com/en-us/azure/active-directory/develop/tutorial-v2-javascript-auth-code)
- [Microsoft Graph JavaScript SDK](https://github.com/microsoftgraph/msgraph-sdk-javascript)
