# CMP GVNG - Scratchpad

---

# 🎬 Video Playback Fix - Error Code 4

## Background and Motivation

L'utente riceve un errore quando cerca di riprodurre video nella galleria:

```
Video load error: Event {isTrusted: true, type: 'error'...}
Video error code: 4 message:
```

**Error code 4** = `MEDIA_ERR_SRC_NOT_SUPPORTED` secondo HTML5 MediaError spec.

## Key Challenges and Analysis

### Root Cause Investigation (Systematic Debugging)

Ho analizzato il codice usando la skill `systematic-debugging`. Cause identificate:

#### 1. **`downloadUrl` scaduto** (CAUSA PRINCIPALE)

- In `gallery.js:143-147`, il codice usa `item.downloadUrl` se disponibile
- `@microsoft.graph.downloadUrl` di OneDrive **scade dopo pochi minuti**
- Se la gallery è stata caricata tempo fa, l'URL non è più valido

#### 2. **CORS bloccato sui video**

- Gli URL diretti Microsoft (`my.microsoftpersonalcontent.com`) possono bloccare CORS
- Per immagini funziona ma i video hanno policy più restrittive

#### 3. **Range Requests non gestite**

- I video richiedono HTTP Range requests per lo streaming/seeking
- Il worker ha `Accept-Ranges: bytes` nell'output ma **non gestisce Range in input**

## High-level Task Breakdown

### Task 1: Forzare uso proxy per video

- [ ] **1.1**: Modificare `gallery.js` per usare SEMPRE `/media/{id}` endpoint per video
- [ ] **1.2**: Mantenere `downloadUrl` solo per immagini (ottimizzazione)
- **Success criteria**: Video usa sempre proxy, immagini usano URL diretto se disponibile

### Task 2: Implementare Range Request Support nel Worker

- [ ] **2.1**: Modificare `handleMediaProxy()` per leggere header `Range`
- [ ] **2.2**: Passare l'header Range a OneDrive quando richiesto
- [ ] **2.3**: Restituire corretto `206 Partial Content` con headers appropriati
- **Success criteria**: Video si carica con seeking funzionante

### Task 3: Testing e Verifica

- [ ] **3.1**: Test manuale con video nella galleria
- [ ] **3.2**: Verifica seeking video funziona (click a metà timeline)
- [ ] **3.3**: Verifica immagini continuano a funzionare
- **Success criteria**: Video play + seek, immagini visualizzate, no console errors

## Technical Details

### Modifica gallery.js (Task 1)

```javascript
// PRIMA (problematico per video):
const mediaUrl = item.downloadUrl || `${CONFIG.workerUrl}/media/${item.id}?...`;

// DOPO (forza proxy per video):
const mediaUrl = item.isVideo
  ? `${CONFIG.workerUrl}/media/${item.id}?password=${encodeURIComponent(
      password
    )}`
  : item.downloadUrl || `${CONFIG.workerUrl}/media/${item.id}?...`;
```

### Modifica worker.js - Range Support (Task 2)

```javascript
async function handleMediaProxy(request, env, itemId, corsHeaders) {
  // Leggere Range header dalla richiesta
  const rangeHeader = request.headers.get("Range");

  // ... fetch da OneDrive ...

  // Se richiesto range, passarlo a OneDrive e restituire 206
  if (rangeHeader) {
    responseHeaders["Content-Range"] = "...";
    return new Response(response.body, {
      status: 206,
      headers: responseHeaders,
    });
  }
}
```

## Project Status Board

- [ ] Approvazione piano dall'utente
- [ ] Task 1: Frontend fix proxy per video
- [ ] Task 2: Backend Range requests
- [ ] Task 3: Testing

## Executor's Feedback or Assistance Requests

🔸 **In attesa approvazione piano prima di procedere all'implementazione.**

## Lessons

- `@microsoft.graph.downloadUrl` scade rapidamente - non usare per media che richiede tempo per caricare
- Video streaming richiede Range requests support
- Usare proxy come fallback più affidabile del download URL diretto

---

# Google Drive + Photos to OneDrive Integration - cmpgvng

## Background and Motivation

L'utente vuole aggiungere la possibilità di importare foto direttamente da Google Drive E **Google Photos** e caricarle automaticamente sulla cartella OneDrive.

### Google Drive Integration ✅ COMPLETATO

- Picker funziona
- Trasferimento a OneDrive funziona

### Google Photos Integration 🔄 IN CORSO

- Session creation ✅
- Session polling ✅
- mediaItems fetch ❌ Errore - da debuggare

**Stack attuale:**

- Frontend: HTML + CSS + JavaScript vanilla
- Backend: Cloudflare Workers
- Storage: OneDrive (via Microsoft Graph API)

## Key Challenges and Analysis

### Challenge 1: Google OAuth + Picker API

- **Problema**: Serve autenticazione OAuth per accedere a Google Drive
- **Soluzione**: Google Picker API gestisce l'autenticazione tramite popup
- **Requisiti**: Creare progetto su Google Cloud Console, ottenere API Key + OAuth Client ID

### Challenge 2: Download file da Google → Upload a OneDrive

- **Problema**: Il file deve essere scaricato da Google e poi caricato su OneDrive
- **Soluzione**: Il Cloudflare Worker farà da proxy:
  1. Riceve URL del file da Google
  2. Scarica il file (usa OAuth token dell'utente)
  3. Carica su OneDrive (usa token esistente)

### Challenge 3: File grandi (>100MB)

- **Problema**: Cloudflare Workers ha limiti di memoria
- **Soluzione**: Streaming o chunked transfer (valutare se necessario)

### Challenge 4: Mantenere il sistema esistente intatto

- **Strategia**: Codice completamente separato
  - Nuovo pulsante nell'UI (non modifica drag & drop esistente)
  - Nuovo endpoint nel Worker (`/upload-from-google`)
  - Nessuna modifica alle funzioni esistenti

## Skill Selezionata

### 🏆 Primary: `senior-fullstack`

**Motivo**: Fornisce linee guida complete per:

- Architettura backend con servizi esterni (API Google + OneDrive)
- Pattern di integrazione tra componenti
- Best practices per code quality e testing

### 📋 Supporting Skills:

1. **`backend-dev-guidelines`** - Pattern per gestire autenticazione, API calls, error handling
2. **`planning-with-files`** - Approccio per task complessi multi-step
3. **`frontend-dev-guidelines`** - Best practices per UI components

### ⚠️ Skill Mancante:

Non esiste una skill specifica per **OAuth/API Integration** o **Google Drive API**. Dovremo basarci sulla documentazione ufficiale di Google.

## High-level Task Breakdown

### Phase 1: Setup Google Cloud Project

- [ ] **Task 1.1**: Creare progetto su Google Cloud Console
- [ ] **Task 1.2**: Abilitare Google Picker API e Drive API
- [ ] **Task 1.3**: Configurare OAuth consent screen
- [ ] **Task 1.4**: Creare credenziali (API Key + OAuth Client ID)
- [ ] **Success criteria**: Credenziali ottenute e funzionanti

### Phase 2: Frontend - Google Picker Integration

- [ ] **Task 2.1**: Aggiungere pulsante "Importa da Google Drive" nell'UI
- [ ] **Task 2.2**: Caricare Google Picker API script
- [ ] **Task 2.3**: Implementare flow: click → auth → picker → selezione
- [ ] **Task 2.4**: Gestire evento "file selezionati"
- [ ] **Success criteria**: Picker si apre, utente può selezionare file, frontend riceve lista file

### Phase 3: Backend - Cloudflare Worker

- [ ] **Task 3.1**: Aggiungere nuovo endpoint `/upload-from-google`
- [ ] **Task 3.2**: Implementare download file da Google Drive (con access token)
- [ ] **Task 3.3**: Implementare upload a OneDrive (riusare logica esistente)
- [ ] **Task 3.4**: Gestire errori e timeout
- [ ] **Success criteria**: File trasferito correttamente da Google a OneDrive

### Phase 4: Testing & Verification

- [ ] **Task 4.1**: Test end-to-end con file piccolo
- [ ] **Task 4.2**: Test con file grande (>50MB)
- [ ] **Task 4.3**: Verifica che upload normale funziona ancora
- [ ] **Success criteria**: Tutte le funzionalità lavorano, nessuna regression

## Technical Considerations

### Google Picker API Flow

```
[User clicks button]
       ↓
[Load gapi client library]
       ↓
[gapi.auth2.authorize() → Google OAuth popup]
       ↓
[User grants permission]
       ↓
[new google.picker.PickerBuilder() → File picker popup]
       ↓
[User selects files]
       ↓
[Callback receives file metadata + access token]
       ↓
[Send to backend: { fileId, accessToken }]
       ↓
[Worker downloads from Google, uploads to OneDrive]
```

### Nuovo Endpoint Worker

```javascript
// POST /upload-from-google
{
  "fileId": "1abc123...",
  "fileName": "photo.jpg",
  "googleAccessToken": "ya29.xxx...",
  "mimeType": "image/jpeg"
}
```

## Project Status Board

- [x] Planning: Skill selection and feasibility analysis
- [x] Phase 1: Google Cloud setup
- [x] Phase 2: Frontend integration
- [x] Phase 3: Backend worker
- [x] Phase 4: Testing ✅ VERIFIED

## Executor's Feedback or Assistance Requests

**🔸 In attesa di approvazione utente per procedere con il piano.**

Domande per l'utente:

1. Hai già un account Google Cloud Console? (Se no, te ne serve uno - è gratuito)
2. Vuoi procedere fase per fase con test intermedi, o preferisci vedere tutto il codice prima di implementare?

## Lessons

- Il progetto attuale non ha skill specifiche per OAuth o Google API integration
- Usare `senior-fullstack` come riferimento per architettura generale
- Mantenere codice separato per evitare regressioni
- Consultare documentazione Google Picker API: https://developers.google.com/picker

## Risorse Utili

- [Google Picker API Docs](https://developers.google.com/picker)
- [Google Drive API Docs](https://developers.google.com/drive/api)
- [Google Cloud Console](https://console.cloud.google.com)
