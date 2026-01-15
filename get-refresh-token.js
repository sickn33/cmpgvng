/**
 * Helper script to obtain a refresh token for the Cloudflare Worker
 *
 * Usage:
 *   1. Update CLIENT_ID and CLIENT_SECRET below
 *   2. Run: node get-refresh-token.js
 *   3. Open the URL in your browser and sign in
 *   4. After redirect, copy the 'code' parameter from the URL
 *   5. Paste the code when prompted
 *   6. Save the refresh_token as a Cloudflare secret
 */

const http = require("http");
const https = require("https");
const { URL, URLSearchParams } = require("url");
const readline = require("readline");

// ⚠️ UPDATE THESE VALUES
const CLIENT_ID = "ffa3d5cd-74a4-401b-849e-44043d444d49"; // Your Azure AD App Client ID
const CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET || ""; // Set via: AZURE_CLIENT_SECRET=xxx node get-refresh-token.js
const REDIRECT_URI = "http://localhost:3333/callback";
const SCOPES = "https://graph.microsoft.com/Files.ReadWrite.All offline_access";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function main() {
  console.log("\n🔐 CMP GVNG - Refresh Token Generator\n");

  if (!CLIENT_SECRET) {
    console.log("❌ Errore: Devi inserire il CLIENT_SECRET in questo file!");
    console.log("\n📋 Per ottenere il Client Secret:");
    console.log("   1. Vai su https://portal.azure.com");
    console.log("   2. Azure Active Directory → App registrations");
    console.log('   3. Seleziona la tua app "cmpgvng"');
    console.log("   4. Certificates & secrets → New client secret");
    console.log("   5. Copia il Value (NON l'ID)");
    console.log("   6. Incollalo in questo file alla riga CLIENT_SECRET\n");
    rl.close();
    process.exit(1);
  }

  // Build authorization URL
  const authUrl = new URL(
    "https://login.microsoftonline.com/common/oauth2/v2.0/authorize"
  );
  authUrl.searchParams.set("client_id", CLIENT_ID);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  authUrl.searchParams.set("scope", SCOPES);
  authUrl.searchParams.set("response_mode", "query");

  console.log(
    "📋 Step 1: Apri questo URL nel browser e accedi con il TUO account Microsoft:\n"
  );
  console.log(authUrl.toString());
  console.log("\n");

  // Start local server to catch the callback
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:3333`);

    if (url.pathname === "/callback") {
      const code = url.searchParams.get("code");
      const error = url.searchParams.get("error");

      if (error) {
        res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
        res.end(
          `<h1>❌ Errore</h1><p>${url.searchParams.get(
            "error_description"
          )}</p>`
        );
        console.log("\n❌ Errore:", url.searchParams.get("error_description"));
        server.close();
        rl.close();
        return;
      }

      if (code) {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(`
          <html>
            <body style="font-family: sans-serif; padding: 40px; text-align: center;">
              <h1>✅ Autorizzazione ricevuta!</h1>
              <p>Torna al terminale per vedere il refresh token.</p>
            </body>
          </html>
        `);

        console.log(
          "\n✅ Codice di autorizzazione ricevuto! Scambio in corso...\n"
        );

        try {
          const tokens = await exchangeCodeForTokens(code);

          console.log(
            "═══════════════════════════════════════════════════════════════"
          );
          console.log("✅ REFRESH TOKEN OTTENUTO!");
          console.log(
            "═══════════════════════════════════════════════════════════════\n"
          );
          console.log(
            "📋 Ora esegui questo comando per salvarlo su Cloudflare:\n"
          );
          console.log("   cd worker");
          console.log("   wrangler secret put AZURE_REFRESH_TOKEN\n");
          console.log("Quando richiesto, incolla questo valore:\n");
          console.log(
            "───────────────────────────────────────────────────────────────"
          );
          console.log(tokens.refresh_token);
          console.log(
            "───────────────────────────────────────────────────────────────\n"
          );
          console.log(
            "⚠️  IMPORTANTE: Non condividere mai questo token con nessuno!\n"
          );
        } catch (err) {
          console.log("❌ Errore nello scambio del codice:", err.message);
        }

        server.close();
        rl.close();
      }
    }
  });

  server.listen(3333, () => {
    console.log("🌐 Server in ascolto su http://localhost:3333/callback");
    console.log("   (attendo il redirect dopo il login...)\n");
  });
}

async function exchangeCodeForTokens(code) {
  return new Promise((resolve, reject) => {
    const postData = new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code: code,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
      scope: SCOPES,
    }).toString();

    const options = {
      hostname: "login.microsoftonline.com",
      path: "/common/oauth2/v2.0/token",
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(postData),
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            reject(new Error(parsed.error_description || parsed.error));
          } else {
            resolve(parsed);
          }
        } catch (e) {
          reject(new Error("Invalid response from token endpoint"));
        }
      });
    });

    req.on("error", reject);
    req.write(postData);
    req.end();
  });
}

main().catch(console.error);
