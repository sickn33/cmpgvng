# 📸 I Nostri Momenti - Upload Interface

Interfaccia web semplice e moderna per caricare foto e video su OneDrive condiviso.

## 🚀 Funzionalità

- ✅ Drag & drop per caricare file
- ✅ Supporto per file grandi (fino a 500MB)
- ✅ Anteprima immagini
- ✅ Progress bar in tempo reale
- ✅ Design moderno dark mode
- ✅ Mobile responsive
- ✅ Autenticazione sicura con Microsoft

## ⚙️ Configurazione

### 1. Registra l'app su Azure AD

1. Vai su [Azure Portal](https://portal.azure.com)
2. Cerca "App registrations" e clicca "New registration"
3. Configura:

   - **Name**: I Nostri Momenti (o altro nome)
   - **Supported account types**: Accounts in any organizational directory and personal Microsoft accounts
   - **Redirect URI**: Select "Single-page application (SPA)" e inserisci `https://TUO-USERNAME.github.io/NOME-REPO`

4. Dopo la registrazione, copia il **Application (client) ID**

### 2. Configura i permessi API

1. Nella pagina dell'app, vai su "API permissions"
2. Clicca "Add a permission" > "Microsoft Graph" > "Delegated permissions"
3. Cerca e aggiungi:
   - `User.Read`
   - `Files.ReadWrite.All`
4. Clicca "Grant admin consent" (se hai accesso admin)

### 3. Aggiorna la configurazione

Modifica `js/config.js`:

```javascript
const CONFIG = {
    azure: {
        clientId: 'IL-TUO-CLIENT-ID', // <-- Inserisci qui
        ...
    },
    oneDrive: {
        folderPath: '/Momenti Condivisi', // <-- Nome cartella condivisa
    },
    ...
};
```

### 4. Deploy su GitHub Pages

1. Vai nelle Settings del repository
2. Pages > Source: "GitHub Actions"
3. Il deploy avverrà automaticamente ad ogni push

## 🧪 Test Locale

```bash
npx serve .
# Apri http://localhost:3000
```

## 📁 Struttura Progetto

```
├── index.html          # Pagina principale
├── css/
│   └── style.css       # Stili (dark mode, glassmorphism)
├── js/
│   ├── config.js       # Configurazione Azure AD
│   ├── auth.js         # Autenticazione MSAL
│   ├── upload.js       # Upload files
│   ├── ui.js           # Gestione UI
│   └── app.js          # Entry point
└── .github/
    └── workflows/
        └── deploy.yml  # GitHub Actions
```

## 🔐 Sicurezza

- Autenticazione OAuth 2.0 con PKCE (standard più sicuro)
- Nessun segreto salvato nel codice
- Token gestiti automaticamente da MSAL.js
- Gli utenti devono avere un account Microsoft

## 📝 Licenza

MIT
