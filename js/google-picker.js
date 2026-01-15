/**
 * Google Drive Picker Integration
 * Allows importing photos from Google Drive to OneDrive
 */

const GOOGLE_CONFIG = {
  apiKey: "AIzaSyC9UoZZlDQcXJXkpqCrX-Tn1sbCJGP-7C8",
  clientId:
    "801285477829-4fc980pm18odkr95ckm4l2ja3h7dd96o.apps.googleusercontent.com",
  scope: "https://www.googleapis.com/auth/drive.readonly",
  discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"],
};

// State
let gapiLoaded = false;
let gisLoaded = false;
let tokenClient = null;
let accessToken = null;

/**
 * Load Google API scripts dynamically
 */
function loadGoogleApis() {
  return new Promise((resolve, reject) => {
    // Check if already loaded
    if (gapiLoaded && gisLoaded) {
      resolve();
      return;
    }

    let scriptsLoaded = 0;
    const checkBothLoaded = () => {
      scriptsLoaded++;
      if (scriptsLoaded === 2) {
        resolve();
      }
    };

    // Load GAPI (for Picker)
    if (!document.getElementById("gapi-script")) {
      const gapiScript = document.createElement("script");
      gapiScript.id = "gapi-script";
      gapiScript.src = "https://apis.google.com/js/api.js";
      gapiScript.onload = () => {
        gapi.load("picker", () => {
          gapiLoaded = true;
          checkBothLoaded();
        });
      };
      gapiScript.onerror = () => reject(new Error("Failed to load Google API"));
      document.head.appendChild(gapiScript);
    } else {
      checkBothLoaded();
    }

    // Load GIS (for OAuth)
    if (!document.getElementById("gis-script")) {
      const gisScript = document.createElement("script");
      gisScript.id = "gis-script";
      gisScript.src = "https://accounts.google.com/gsi/client";
      gisScript.onload = () => {
        gisLoaded = true;
        initTokenClient();
        checkBothLoaded();
      };
      gisScript.onerror = () =>
        reject(new Error("Failed to load Google Identity Services"));
      document.head.appendChild(gisScript);
    } else {
      checkBothLoaded();
    }
  });
}

/**
 * Initialize OAuth token client
 */
function initTokenClient() {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CONFIG.clientId,
    scope: GOOGLE_CONFIG.scope,
    callback: (tokenResponse) => {
      if (tokenResponse.error) {
        console.error("OAuth Error:", tokenResponse.error);
        showToast("Errore durante l'autenticazione Google", "error");
        return;
      }
      accessToken = tokenResponse.access_token;
      createAndShowPicker();
    },
  });
}

/**
 * Open Google Drive Picker
 */
async function openGoogleDrivePicker() {
  try {
    showToast("Caricamento Google Drive...", "info");

    // Load APIs if not already loaded
    await loadGoogleApis();

    // Request access token (will trigger OAuth popup if needed)
    if (!accessToken) {
      tokenClient.requestAccessToken({ prompt: "" });
    } else {
      createAndShowPicker();
    }
  } catch (error) {
    console.error("Error opening Google Drive Picker:", error);
    showToast("Errore nel caricamento di Google Drive", "error");
  }
}

/**
 * Create and display the Google Picker
 */
function createAndShowPicker() {
  const docsView = new google.picker.DocsView(google.picker.ViewId.DOCS_IMAGES)
    .setIncludeFolders(true)
    .setSelectFolderEnabled(false);

  const picker = new google.picker.PickerBuilder()
    .setAppId(GOOGLE_CONFIG.clientId.split("-")[0])
    .setOAuthToken(accessToken)
    .setDeveloperKey(GOOGLE_CONFIG.apiKey)
    .addView(docsView)
    .addView(new google.picker.DocsView(google.picker.ViewId.DOCS_VIDEOS))
    .setCallback(handlePickerCallback)
    .setTitle("Seleziona foto e video da Google Drive")
    .enableFeature(google.picker.Feature.MULTISELECT_ENABLED)
    .build();

  picker.setVisible(true);
}

/**
 * Handle files selected in the Picker
 */
async function handlePickerCallback(data) {
  if (data.action === google.picker.Action.CANCEL) {
    return;
  }

  if (data.action === google.picker.Action.PICKED) {
    const files = data.docs;

    if (files.length === 0) {
      showToast("Nessun file selezionato", "warning");
      return;
    }

    showToast(`${files.length} file selezionati da Google Drive`, "success");

    // Process each file
    for (const file of files) {
      await transferFileFromGoogleDrive(file);
    }
  }
}

/**
 * Transfer a file from Google Drive to OneDrive via Worker
 */
async function transferFileFromGoogleDrive(file) {
  const fileId = file.id;
  const fileName = file.name;
  const mimeType = file.mimeType;

  // Add to queue with pending status
  const queueItem = {
    id: `gdrive-${fileId}`,
    name: fileName,
    type: mimeType,
    size: file.sizeBytes || 0,
    status: "pending",
    source: "google-drive",
  };

  // Add to file queue (uses existing queue system)
  if (!window.fileQueue) {
    window.fileQueue = [];
  }
  window.fileQueue.push(queueItem);
  renderFileQueue();

  try {
    queueItem.status = "uploading";
    renderFileQueue();

    const response = await fetch(`${CONFIG.workerUrl}/upload-from-google`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fileId: fileId,
        fileName: fileName,
        mimeType: mimeType,
        googleAccessToken: accessToken,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    const result = await response.json();

    queueItem.status = "completed";
    renderFileQueue();
    addToCompletedList(queueItem);
    showToast(`${fileName} caricato con successo!`, "success");

    return result;
  } catch (error) {
    console.error(`Error transferring ${fileName}:`, error);
    queueItem.status = "error";
    queueItem.error = error.message;
    renderFileQueue();
    showToast(`Errore nel trasferimento di ${fileName}`, "error");
    throw error;
  }
}

/**
 * Revoke Google access token (logout)
 */
function revokeGoogleAccess() {
  if (accessToken) {
    google.accounts.oauth2.revoke(accessToken, () => {
      accessToken = null;
      showToast("Disconnesso da Google Drive", "info");
    });
  }
}

// Export functions
window.openGoogleDrivePicker = openGoogleDrivePicker;
window.revokeGoogleAccess = revokeGoogleAccess;
window.GOOGLE_CONFIG = GOOGLE_CONFIG;
