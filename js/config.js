/**
 * Configuration for OneDrive Upload App
 * Uses Cloudflare Worker for backend authentication
 */

const CONFIG = {
  // Cloudflare Worker URL
  workerUrl: "https://cmpgvng-api.cmpgvng.workers.dev",

  // Upload Settings
  upload: {
    maxFileSizeMB: 500, // Maximum file size in MB
    chunkSizeMB: 50, // Chunk size for progress updates
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

  if (CONFIG.workerUrl.includes("YOUR_SUBDOMAIN")) {
    errors.push(
      "Worker URL non configurato! Aggiorna config.js con l'URL del tuo worker."
    );
  }

  return errors;
}

// Export for use in other modules
window.CONFIG = CONFIG;
window.validateConfig = validateConfig;
