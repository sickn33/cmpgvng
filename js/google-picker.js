/**
 * Google Drive & Photos Picker Integration
 * Allows importing photos from Google Drive and Google Photos to OneDrive
 */

const GOOGLE_CONFIG = {
  apiKey: "AIzaSyC9UoZZlDQcXJXkpqCrX-Tn1sbCJGP-7C8",
  clientId:
    "801285477829-4fc980pm18odkr95ckm4l2ja3h7dd96o.apps.googleusercontent.com",
  // Scopes for both Drive and Photos
  driveScope: "https://www.googleapis.com/auth/drive.readonly",
  photosScope:
    "https://www.googleapis.com/auth/photospicker.mediaitems.readonly",
  discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"],
};

// State
let gapiLoaded = false;
let gisLoaded = false;
let driveTokenClient = null;
let photosTokenClient = null;
let driveAccessToken = null;
let photosAccessToken = null;

// Photos Picker state
let photosPickerWindow = null;
let photosSessionId = null;
let photosPollingInterval = null;

/**
 * Load Google API scripts dynamically
 */
function loadGoogleApis() {
  return new Promise((resolve, reject) => {
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

    // Load GAPI (for Drive Picker)
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
        initTokenClients();
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
 * Initialize OAuth token clients for Drive and Photos
 */
function initTokenClients() {
  // Drive token client
  driveTokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CONFIG.clientId,
    scope: GOOGLE_CONFIG.driveScope,
    callback: (tokenResponse) => {
      if (tokenResponse.error) {
        console.error("Drive OAuth Error:", tokenResponse.error);
        showToast("Errore durante l'autenticazione Google Drive", "error");
        return;
      }
      driveAccessToken = tokenResponse.access_token;
      createAndShowDrivePicker();
    },
  });

  // Photos token client
  photosTokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CONFIG.clientId,
    scope: GOOGLE_CONFIG.photosScope,
    callback: (tokenResponse) => {
      if (tokenResponse.error) {
        console.error("Photos OAuth Error:", tokenResponse.error);
        showToast("Errore durante l'autenticazione Google Photos", "error");
        return;
      }
      photosAccessToken = tokenResponse.access_token;
      createPhotosPickerSession();
    },
  });
}

// ============================================
// GOOGLE DRIVE PICKER
// ============================================

/**
 * Open Google Drive Picker
 */
async function openGoogleDrivePicker() {
  try {
    showToast("Caricamento Google Drive...", "info");
    await loadGoogleApis();

    if (!driveAccessToken) {
      driveTokenClient.requestAccessToken({ prompt: "" });
    } else {
      createAndShowDrivePicker();
    }
  } catch (error) {
    console.error("Error opening Google Drive Picker:", error);
    showToast("Errore nel caricamento di Google Drive", "error");
  }
}

/**
 * Create and display the Google Drive Picker
 */
function createAndShowDrivePicker() {
  const docsView = new google.picker.DocsView(google.picker.ViewId.DOCS_IMAGES)
    .setIncludeFolders(true)
    .setSelectFolderEnabled(false);

  const picker = new google.picker.PickerBuilder()
    .setAppId(GOOGLE_CONFIG.clientId.split("-")[0])
    .setOAuthToken(driveAccessToken)
    .setDeveloperKey(GOOGLE_CONFIG.apiKey)
    .addView(docsView)
    .addView(new google.picker.DocsView(google.picker.ViewId.DOCS_VIDEOS))
    .setCallback(handleDrivePickerCallback)
    .setTitle("Seleziona foto e video da Google Drive")
    .enableFeature(google.picker.Feature.MULTISELECT_ENABLED)
    .build();

  picker.setVisible(true);
}

/**
 * Handle files selected in Drive Picker
 */
async function handleDrivePickerCallback(data) {
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

    for (const file of files) {
      await transferFileFromGoogleDrive(file);
    }
  }
}

/**
 * Transfer a file from Google Drive to OneDrive
 */
async function transferFileFromGoogleDrive(file) {
  const fileId = file.id;
  const fileName = file.name;
  const mimeType = file.mimeType;

  const queueItem = {
    id: `gdrive-${fileId}`,
    name: fileName,
    type: mimeType,
    size: file.sizeBytes || 0,
    status: "pending",
    source: "google-drive",
  };

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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileId: fileId,
        fileName: fileName,
        mimeType: mimeType,
        googleAccessToken: driveAccessToken,
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

// ============================================
// GOOGLE PHOTOS PICKER
// ============================================

/**
 * Open Google Photos Picker
 */
async function openGooglePhotosPicker() {
  try {
    showToast("Caricamento Google Photos...", "info");
    await loadGoogleApis();

    if (!photosAccessToken) {
      photosTokenClient.requestAccessToken({ prompt: "" });
    } else {
      createPhotosPickerSession();
    }
  } catch (error) {
    console.error("Error opening Google Photos Picker:", error);
    showToast("Errore nel caricamento di Google Photos", "error");
  }
}

/**
 * Create a Photos Picker session and open picker
 */
async function createPhotosPickerSession() {
  try {
    // Create session via worker proxy (to bypass CORS)
    const response = await fetch(`${CONFIG.workerUrl}/photos-session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ accessToken: photosAccessToken }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Photos session creation failed:", error);
      throw new Error("Impossibile creare sessione Google Photos");
    }

    const session = await response.json();
    photosSessionId = session.id;
    console.log("Photos session created:", photosSessionId);

    // Open picker in popup
    const pickerUrl = session.pickerUri;
    console.log("Opening Photos picker URL:", pickerUrl);

    photosPickerWindow = window.open(
      pickerUrl,
      "GooglePhotosPicker",
      "width=800,height=600,menubar=no,toolbar=no,location=no"
    );

    // Check if popup was blocked
    if (!photosPickerWindow || photosPickerWindow.closed) {
      console.error("Photos popup was blocked!");
      showToast("Popup bloccato! Abilita i popup per questo sito.", "error");
      return;
    }

    showToast("Seleziona le foto da Google Photos...", "info");

    // Start polling after a short delay to allow popup to load
    setTimeout(() => {
      startPhotosSessionPolling();
    }, 2000);
  } catch (error) {
    console.error("Error creating Photos session:", error);
    showToast("Errore con Google Photos: " + error.message, "error");
  }
}

/**
 * Poll Photos Picker session for completion
 */
function startPhotosSessionPolling() {
  // Clear any existing polling
  if (photosPollingInterval) {
    clearInterval(photosPollingInterval);
  }

  let pollCount = 0;
  const maxPolls = 1800; // 30 minutes max (plenty of time to select photos)
  let windowClosedCount = 0; // Track how many times we poll after window closes

  console.log("Starting Photos session polling...");

  photosPollingInterval = setInterval(async () => {
    pollCount++;
    console.log(
      `Poll #${pollCount}, window closed: ${photosPickerWindow?.closed}`
    );

    // Max polling time reached
    if (pollCount > maxPolls) {
      clearInterval(photosPollingInterval);
      showToast("Timeout selezione foto (30 min)", "warning");
      console.log("Polling stopped: max polls reached");
      return;
    }

    try {
      // Check session status via worker proxy (to bypass CORS)
      const response = await fetch(
        `${
          CONFIG.workerUrl
        }/photos-session/${photosSessionId}?accessToken=${encodeURIComponent(
          photosAccessToken
        )}`
      );

      console.log(`Poll #${pollCount} response status: ${response.status}`);

      if (!response.ok) {
        console.log(
          "Photos polling: response not ok, status:",
          response.status
        );
        // Check if window was closed without making selection
        if (photosPickerWindow && photosPickerWindow.closed) {
          windowClosedCount++;
          console.log(`Window closed, count: ${windowClosedCount}`);
          if (windowClosedCount > 15) {
            clearInterval(photosPollingInterval);
            showToast("Selezione annullata", "info");
            console.log("Polling stopped: window closed for 15+ seconds");
            return;
          }
        }
        return; // Keep polling
      }

      const session = await response.json();
      console.log("Photos session status:", session);

      if (session.mediaItemsSet) {
        console.log("Photos: mediaItemsSet is true, fetching items...");
        clearInterval(photosPollingInterval);

        // Close popup if still open
        if (photosPickerWindow && !photosPickerWindow.closed) {
          photosPickerWindow.close();
        }

        // Fetch selected media items
        await fetchAndTransferPhotosMediaItems();
        return;
      }

      // If window is closed but mediaItemsSet is still false, track it
      if (photosPickerWindow && photosPickerWindow.closed) {
        windowClosedCount++;
        console.log(
          `Window closed but mediaItemsSet still false, count: ${windowClosedCount}`
        );
        if (windowClosedCount > 15) {
          clearInterval(photosPollingInterval);
          showToast("Selezione annullata", "info");
          console.log(
            "Polling stopped: window closed for 15+ seconds without selection"
          );
          return;
        }
      } else {
        windowClosedCount = 0; // Reset if window is open
      }
    } catch (error) {
      console.error("Photos polling error:", error);
      console.error("Error stack:", error.stack);
    }
  }, 1000); // Poll every second
}

/**
 * Fetch selected media items and transfer to OneDrive
 */
async function fetchAndTransferPhotosMediaItems() {
  try {
    // Fetch items via worker proxy (to bypass CORS)
    const url = `${
      CONFIG.workerUrl
    }/photos-session/${photosSessionId}/items?accessToken=${encodeURIComponent(
      photosAccessToken
    )}`;
    console.log("Fetching Photos items from:", url);

    const response = await fetch(url);
    console.log("Photos items response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Photos items fetch error response:", errorText);
      throw new Error(`Failed to fetch media items: ${response.status}`);
    }

    const data = await response.json();
    console.log("Photos items data:", data);
    const mediaItems = data.mediaItems || [];

    if (mediaItems.length === 0) {
      showToast("Nessuna foto selezionata", "warning");
      return;
    }

    showToast(
      `${mediaItems.length} foto selezionate da Google Photos`,
      "success"
    );

    // Transfer each item
    for (const item of mediaItems) {
      await transferFileFromGooglePhotos(item);
    }
  } catch (error) {
    console.error("Error fetching Photos media items:", error);
    showToast("Errore nel recupero delle foto", "error");
  }
}

/**
 * Transfer a photo from Google Photos to OneDrive
 */
async function transferFileFromGooglePhotos(mediaItem) {
  const itemId = mediaItem.id;
  const fileName = mediaItem.mediaFile?.filename || `photo_${itemId}.jpg`;
  const mimeType = mediaItem.mediaFile?.mimeType || "image/jpeg";
  const baseUrl = mediaItem.mediaFile?.baseUrl;

  const queueItem = {
    id: `gphotos-${itemId}`,
    name: fileName,
    type: mimeType,
    size: 0,
    status: "pending",
    source: "google-photos",
  };

  if (!window.fileQueue) {
    window.fileQueue = [];
  }
  window.fileQueue.push(queueItem);
  renderFileQueue();

  try {
    queueItem.status = "uploading";
    renderFileQueue();

    const response = await fetch(
      `${CONFIG.workerUrl}/upload-from-google-photos`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mediaItemId: itemId,
          fileName: fileName,
          mimeType: mimeType,
          baseUrl: baseUrl,
          googleAccessToken: photosAccessToken,
        }),
      }
    );

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
 * Revoke Google access tokens
 */
function revokeGoogleAccess() {
  if (driveAccessToken) {
    google.accounts.oauth2.revoke(driveAccessToken, () => {
      driveAccessToken = null;
    });
  }
  if (photosAccessToken) {
    google.accounts.oauth2.revoke(photosAccessToken, () => {
      photosAccessToken = null;
    });
  }
  showToast("Disconnesso da Google", "info");
}

// Export functions
window.openGoogleDrivePicker = openGoogleDrivePicker;
window.openGooglePhotosPicker = openGooglePhotosPicker;
window.revokeGoogleAccess = revokeGoogleAccess;
window.GOOGLE_CONFIG = GOOGLE_CONFIG;
