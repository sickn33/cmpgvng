# Cloudflare Worker per CMP GVNG

Questo worker gestisce l'upload di file su OneDrive senza richiedere autenticazione agli utenti.

## Setup

1. Installa Wrangler CLI:

   ```bash
   npm install -g wrangler
   ```

2. Effettua login su Cloudflare:

   ```bash
   wrangler login
   ```

3. Configura i secrets:

   ```bash
   wrangler secret put AZURE_CLIENT_ID
   wrangler secret put AZURE_CLIENT_SECRET
   wrangler secret put AZURE_REFRESH_TOKEN
   wrangler secret put ONEDRIVE_DRIVE_ID
   wrangler secret put ONEDRIVE_FOLDER_ID
   ```

4. Deploy:
   ```bash
   wrangler deploy
   ```

## Generare Refresh Token

Esegui lo script helper nella cartella principale:

```bash
node get-refresh-token.js
```

Segui le istruzioni per autenticarti e ottenere il refresh token.
