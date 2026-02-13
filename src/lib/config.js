/**
 * Configuration for OneDrive Upload App
 * Uses Cloudflare Worker for backend authentication
 */

export const CONFIG = {
  workerUrl: "https://cmpgvng-api.cmpgvng.workers.dev",
  upload: {
    maxFileSizeMB: 500,
    chunkSizeMB: 50,
    allowedTypes: ["image/*", "video/*"],
  },
  ui: {
    toastDuration: 4000,
  },
};

export const GOOGLE_CONFIG = {
  apiKey: "AIzaSyC9UoZZlDQcXJXkpqCrX-Tn1sbCJGP-7C8",
  clientId: "801285477829-4fc980pm18odkr95ckm4l2ja3h7dd96o.apps.googleusercontent.com",
  driveScope: "https://www.googleapis.com/auth/drive.readonly",
  photosScope: "https://www.googleapis.com/auth/photospicker.mediaitems.readonly",
  discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"],
};

export function validateConfig() {
  const errors = [];
  if (CONFIG.workerUrl.includes("YOUR_SUBDOMAIN")) {
    errors.push("Worker URL non configurato! Aggiorna config.js con l'URL del tuo worker.");
  }
  return errors;
}
