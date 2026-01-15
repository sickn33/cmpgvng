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
  oneDrive: {
    // Sharing link to the folder
    shareLink:
      "https://zx3kf-my.sharepoint.com/:f:/g/personal/sickn33_zx3kf_onmicrosoft_com/IgC6rwobP4XZRZNcEh2A8OabARgaXO3fMrqeVOS6FgtX7BE",

    // Direct IDs (used as primary method)
    driveId:
      "b!zLuElr4ANkOzaCMUCo3ydAMREhc0rexBm-NcSpCh0sAXIfhYVm2jSImpjTuGNiLM",
    folderId: "01RQILE7F2V4FBWP4F3FCZGXASDWAPBZU3",

    // Fallback folder name (created in user's drive if all else fails)
    folderName: "CMP GVNG",
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
