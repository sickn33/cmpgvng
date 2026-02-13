/**
 * Google Drive & Photos Picker integration
 * Preserves exact request shapes for Worker API
 */

import { useRef, useEffect, useCallback } from "react";
import { useUpload } from "../contexts/UploadContext.jsx";
import { useToast } from "../contexts/ToastContext.jsx";
import { GOOGLE_CONFIG } from "../lib/config.js";
import {
  uploadFromGoogleDrive as apiUploadFromGoogleDrive,
  uploadFromGooglePhotos as apiUploadFromGooglePhotos,
  createPhotosSession as apiCreatePhotosSession,
  getPhotosSession as apiGetPhotosSession,
  getPhotosItems as apiGetPhotosItems,
} from "../lib/api.js";

let gapiLoaded = false;
let gisLoaded = false;
let driveTokenClient = null;
let photosTokenClient = null;
let driveAccessToken = null;
let photosAccessToken = null;
let photosPickerWindow = null;
let photosPollingInterval = null;

function loadGoogleApis(showToast) {
  return new Promise((resolve, reject) => {
    if (gapiLoaded && gisLoaded) {
      resolve();
      return;
    }
    let scriptsLoaded = 0;
    const checkBothLoaded = () => {
      scriptsLoaded++;
      if (scriptsLoaded === 2) resolve();
    };
    if (!document.getElementById("gapi-script")) {
      const s = document.createElement("script");
      s.id = "gapi-script";
      s.src = "https://apis.google.com/js/api.js";
      s.onload = () => {
        gapi.load("picker", () => {
          gapiLoaded = true;
          checkBothLoaded();
        });
      };
      s.onerror = () => reject(new Error("Failed to load Google API"));
      document.head.appendChild(s);
    } else checkBothLoaded();
    if (!document.getElementById("gis-script")) {
      const s = document.createElement("script");
      s.id = "gis-script";
      s.src = "https://accounts.google.com/gsi/client";
      s.onload = () => {
        gisLoaded = true;
        initTokenClients();
        checkBothLoaded();
      };
      s.onerror = () =>
        reject(new Error("Failed to load Google Identity Services"));
      document.head.appendChild(s);
    } else checkBothLoaded();
  });
}

function initTokenClients() {
  driveTokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CONFIG.clientId,
    scope: GOOGLE_CONFIG.driveScope,
    callback: (r) => {
      if (r.error) {
        window.__googleShowToast?.("Errore durante l'autenticazione Google Drive", "error");
        return;
      }
      driveAccessToken = r.access_token;
      window.__createDrivePicker?.();
    },
  });
  photosTokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CONFIG.clientId,
    scope: GOOGLE_CONFIG.photosScope,
    callback: (r) => {
      if (r.error) {
        window.__googleShowToast?.("Errore durante l'autenticazione Google Photos", "error");
        return;
      }
      photosAccessToken = r.access_token;
      window.__createPhotosSession?.();
    },
  });
}

export function useGooglePicker() {
  const { addGoogleQueueItem, updateQueueItemById, addCompletedItem } = useUpload();
  const { showToast } = useToast();
  const ref = useRef({ addGoogleQueueItem, updateQueueItemById, addCompletedItem, showToast });
  useEffect(() => {
    ref.current = { addGoogleQueueItem, updateQueueItemById, addCompletedItem, showToast };
    window.__googleShowToast = showToast;
  }, [addGoogleQueueItem, updateQueueItemById, addCompletedItem, showToast]);

  const createAndShowDrivePicker = useCallback(() => {
    const docsView = new google.picker.DocsView(google.picker.ViewId.DOCS_IMAGES)
      .setIncludeFolders(true)
      .setSelectFolderEnabled(false);
    const picker = new google.picker.PickerBuilder()
      .setAppId(GOOGLE_CONFIG.clientId.split("-")[0])
      .setOAuthToken(driveAccessToken)
      .setDeveloperKey(GOOGLE_CONFIG.apiKey)
      .addView(docsView)
      .addView(new google.picker.DocsView(google.picker.ViewId.DOCS_VIDEOS))
      .setCallback((data) => handleDrivePickerCallback(data, ref.current))
      .setTitle("Seleziona foto e video da Google Drive")
      .enableFeature(google.picker.Feature.MULTISELECT_ENABLED)
      .build();
    picker.setVisible(true);
  }, []);

  useEffect(() => {
    window.__createDrivePicker = createAndShowDrivePicker;
    return () => { delete window.__createDrivePicker; };
  }, [createAndShowDrivePicker]);

  const openGoogleDrivePicker = useCallback(async () => {
    try {
      showToast("Caricamento Google Drive...", "info");
      await loadGoogleApis(showToast);
      if (!driveAccessToken) {
        driveTokenClient.requestAccessToken({ prompt: "" });
      } else {
        createAndShowDrivePicker();
      }
    } catch (err) {
      console.error("Error opening Google Drive Picker:", err);
      showToast("Errore nel caricamento di Google Drive", "error");
    }
  }, [showToast, createAndShowDrivePicker]);

  const createPhotosPickerSession = useCallback(async () => {
    const { showToast, addGoogleQueueItem, updateQueueItemById, addCompletedItem } = ref.current;
    try {
      const res = await apiCreatePhotosSession(photosAccessToken);
      if (!res.ok) throw new Error("Impossibile creare sessione Google Photos");
      const session = await res.json();
      const sessionId = session.id;
      photosPickerWindow = window.open(
        session.pickerUri,
        "GooglePhotosPicker",
        "width=800,height=600,menubar=no,toolbar=no,location=no"
      );
      if (!photosPickerWindow || photosPickerWindow.closed) {
        showToast("Popup bloccato! Abilita i popup per questo sito.", "error");
        return;
      }
      showToast("Seleziona le foto da Google Photos...", "info");
      let pollCount = 0;
      const maxPolls = 1800;
      const interval = setInterval(async () => {
        pollCount++;
        if (pollCount > maxPolls) {
          clearInterval(interval);
          showToast("Timeout selezione foto (30 min)", "warning");
          return;
        }
        try {
          const r = await apiGetPhotosSession(sessionId, photosAccessToken);
          if (!r.ok) return;
          const s = await r.json();
          if (s.mediaItemsSet) {
            clearInterval(interval);
            try { photosPickerWindow?.close(); } catch (_) {}
            const itemsRes = await apiGetPhotosItems(sessionId, photosAccessToken);
            if (!itemsRes.ok) throw new Error("Failed to fetch media items");
            const data = await itemsRes.json();
            const items = data.mediaItems || [];
            if (items.length === 0) {
              showToast("Nessuna foto selezionata", "warning");
              return;
            }
            showToast(`${items.length} foto selezionate da Google Photos`, "success");
            for (const item of items) {
              await transferFromPhotos(item, ref.current);
            }
          }
        } catch (_) {}
      }, 1000);
    } catch (err) {
      showToast("Errore con Google Photos: " + err.message, "error");
    }
  }, []);

  useEffect(() => {
    window.__createPhotosSession = createPhotosPickerSession;
    return () => { delete window.__createPhotosSession; };
  }, [createPhotosPickerSession]);

  const openGooglePhotosPicker = useCallback(async () => {
    try {
      showToast("Caricamento Google Photos...", "info");
      await loadGoogleApis(showToast);
      if (!photosAccessToken) {
        photosTokenClient.requestAccessToken({ prompt: "" });
      } else {
        createPhotosPickerSession();
      }
    } catch (err) {
      console.error("Error opening Google Photos Picker:", err);
      showToast("Errore nel caricamento di Google Photos", "error");
    }
  }, [showToast, createPhotosPickerSession]);

  return { openGoogleDrivePicker, openGooglePhotosPicker };
}

async function handleDrivePickerCallback(data, actions) {
  const { addGoogleQueueItem, updateQueueItemById, addCompletedItem, showToast } = actions;
  if (data.action === google.picker.Action.CANCEL) return;
  if (data.action !== google.picker.Action.PICKED) return;
  const files = data.docs;
  if (!files?.length) {
    showToast("Nessun file selezionato", "warning");
    return;
  }
  showToast(`${files.length} file selezionati da Google Drive`, "success");
  for (const file of files) {
    await transferFromDrive(file, actions);
  }
}

async function transferFromDrive(file, actions) {
  const { addGoogleQueueItem, updateQueueItemById, addCompletedItem, showToast } = actions;
  const id = `gdrive-${file.id}`;
  const item = {
    id,
    name: file.name,
    type: file.mimeType,
    size: file.sizeBytes || 0,
    status: "pending",
    source: "google-drive",
  };
  addGoogleQueueItem(item);
  updateQueueItemById(id, { status: "uploading" });
  try {
    const res = await apiUploadFromGoogleDrive(
      file.id,
      file.name,
      file.mimeType,
      driveAccessToken
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    updateQueueItemById(id, { status: "success" });
    addCompletedItem({ ...item, status: "success" });
    showToast(`${file.name} caricato con successo!`, "success");
  } catch (err) {
    console.error("Error transferring", file.name, err);
    updateQueueItemById(id, { status: "error", error: err.message });
    showToast(`Errore nel trasferimento di ${file.name}`, "error");
  }
}

async function transferFromPhotos(mediaItem, actions) {
  const { addGoogleQueueItem, updateQueueItemById, addCompletedItem, showToast } = actions;
  const id = `gphotos-${mediaItem.id}`;
  const fileName = mediaItem.mediaFile?.filename || `photo_${mediaItem.id}.jpg`;
  const mimeType = mediaItem.mediaFile?.mimeType || "image/jpeg";
  const baseUrl = mediaItem.mediaFile?.baseUrl;
  const item = {
    id,
    name: fileName,
    type: mimeType,
    size: 0,
    status: "pending",
    source: "google-photos",
  };
  addGoogleQueueItem(item);
  updateQueueItemById(id, { status: "uploading" });
  try {
    const res = await apiUploadFromGooglePhotos(
      mediaItem.id,
      fileName,
      mimeType,
      baseUrl,
      photosAccessToken
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    updateQueueItemById(id, { status: "success" });
    addCompletedItem({ ...item, status: "success" });
    showToast(`${fileName} caricato con successo!`, "success");
  } catch (err) {
    console.error("Error transferring", fileName, err);
    updateQueueItemById(id, { status: "error", error: err.message });
    showToast(`Errore nel trasferimento di ${fileName}`, "error");
  }
}
