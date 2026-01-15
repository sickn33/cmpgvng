/**
 * Configuration for OneDrive Upload App
 *
 * ⚠️ IMPORTANT: Update these values before deploying!
 */

const CONFIG = {
  // Azure AD Application Configuration
  // Get these from: https://portal.azure.com > App Registrations
  azure: {
    clientId: "ffa3d5cd-74a4-401b-849e-44043d444d49", // Application (client) ID
    authority: "https://login.microsoftonline.com/common", // Use 'common' for multi-tenant + personal
    redirectUri: window.location.origin, // Will be the GitHub Pages URL
  },

  // Microsoft Graph API Scopes
  scopes: [
    "User.Read", // Read user profile
    "Files.ReadWrite.All", // Read and write files in OneDrive
  ],

  // OneDrive Target Configuration
  // Per caricare su una cartella condivisa di un altro utente (es. Sickn33),
  // serve il Drive ID e il Folder ID specifici.
  oneDrive: {
    // Option 1: Upload to logged-in user's root (Default)
    // Leave driveId null

    // Option 2: Upload to specific shared folder/drive
    // You can find these using Graph Explorer (https://developer.microsoft.com/graph/graph-explorer)
    // Query: https://graph.microsoft.com/v1.0/me/drive/root:/NomeCartella
    driveId: null, // es. 'b!Pk9...'
    folderId: null, // es. '01KM...'

    // Fallback (solo per upload su PROPRIO drive):
    folderPath: "/Momenti Condivisi",
  },

  // Upload Settings
  upload: {
    maxFileSizeMB: 500, // Maximum file size in MB
    chunkSizeMB: 5, // Chunk size for large file uploads
    allowedTypes: ["image/*", "video/*"],
  },

  // UI Settings
  ui: {
    toastDuration: 4000, // Toast notification duration in ms
  },
};

// Validate configuration
function validateConfig() {
  const errors = [];

  if (CONFIG.azure.clientId === "YOUR_CLIENT_ID_HERE") {
    errors.push("Azure Client ID non configurato!");
  }

  return errors;
}

// Export for use in other modules
window.CONFIG = CONFIG;
window.validateConfig = validateConfig;
