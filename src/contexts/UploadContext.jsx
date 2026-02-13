import { createContext, useContext, useState, useCallback } from "react";
import { CONFIG, validateConfig } from "../lib/config.js";
import { uploadFile as apiUploadFile } from "../lib/api.js";
import { useToast } from "./ToastContext.jsx";

const UploadContext = createContext(null);

function isAllowedFileType(file) {
  return CONFIG.upload.allowedTypes.some((pattern) => {
    if (pattern.endsWith("/*")) {
      const category = pattern.replace("/*", "");
      return file.type.startsWith(category);
    }
    return file.type === pattern;
  });
}

export function UploadProvider({ children }) {
  const { showToast } = useToast();
  const [fileQueue, setFileQueue] = useState([]);
  const [uploadInProgress, setUploadInProgress] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [completedItems, setCompletedItems] = useState([]);

  const addFilesToQueue = useCallback(
    (files) => {
      const maxSize = CONFIG.upload.maxFileSizeMB * 1024 * 1024;
      let addedCount = 0;

      setFileQueue((prev) => {
        const next = [...prev];
        for (const file of files) {
          if (!isAllowedFileType(file)) {
            showToast(`Tipo file non supportato: ${file.name}`, "warning");
            continue;
          }
          if (file.size > maxSize) {
            showToast(
              `File troppo grande: ${file.name} (max ${CONFIG.upload.maxFileSizeMB}MB)`,
              "warning"
            );
            continue;
          }
          if (next.some((f) => f.name === file.name && f.size === file.size)) {
            showToast(`File già in coda: ${file.name}`, "warning");
            continue;
          }
          next.push({
            file,
            name: file.name,
            size: file.size,
            type: file.type,
            status: "pending",
            progress: 0,
            error: null,
            source: null,
          });
          addedCount++;
        }
        return next;
      });

      if (addedCount > 0) {
        showToast(`${addedCount} file aggiunti alla coda`, "success");
      }
    },
    [showToast]
  );

  const addGoogleQueueItem = useCallback((item) => {
    setFileQueue((prev) => [...prev, item]);
  }, []);

  const updateQueueItem = useCallback((index, updates) => {
    setFileQueue((prev) => {
      const next = [...prev];
      if (next[index]) next[index] = { ...next[index], ...updates };
      return next;
    });
  }, []);

  const updateQueueItemById = useCallback((id, updates) => {
    setFileQueue((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  }, []);

  const removeFromQueue = useCallback(
    (index) => {
      setFileQueue((prev) => {
        const item = prev[index];
        if (item?.status === "uploading") {
          showToast("Non puoi rimuovere un file durante il caricamento", "warning");
          return prev;
        }
        return prev.filter((_, i) => i !== index);
      });
    },
    [showToast]
  );

  const addCompletedItem = useCallback((item) => {
    setCompletedItems((prev) => [...prev, item]);
  }, []);

  const uploadAll = useCallback(async () => {
    if (uploadInProgress) {
      showToast("Caricamento già in corso", "warning");
      return;
    }

    const password = sessionStorage.getItem("cmpgvng_password") || "";
    const pending = fileQueue.filter((f) => f.status === "pending" && !f.source);
    if (pending.length === 0) {
      showToast("Nessun file da caricare", "warning");
      return;
    }

    const configErrors = validateConfig();
    if (configErrors.length > 0) {
      showToast(configErrors[0], "error");
      return;
    }

    setUploadInProgress(true);
    setShowProgress(true);
    setProgressPercent(0);

    let totalBytesUploaded = 0;
    const totalBytesToUpload = pending.reduce(
      (acc, f) => acc + (f.file ? f.file.size : f.size || 0),
      0
    );

    const maxRetries = 3;
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < fileQueue.length; i++) {
      const item = fileQueue[i];
      if (item.status !== "pending" || item.source) continue;

      updateQueueItem(i, { status: "uploading" });

      let attempts = 0;
      let response;
      let lastError;

      while (attempts < maxRetries) {
        try {
          response = await apiUploadFile(item.file, password);
          if (response.ok) break;
          if (response.status >= 400 && response.status < 500 && response.status !== 429) {
            throw new Error(`Upload failed with status: ${response.status}`);
          }
          throw new Error(`Server error: ${response.status}`);
        } catch (err) {
          lastError = err;
          attempts++;
          if (err.message?.includes("Upload failed with status")) throw err;
          if (attempts < maxRetries) {
            await new Promise((r) => setTimeout(r, Math.pow(2, attempts - 1) * 1000));
            showToast(`Riprovo il caricamento (${attempts}/${maxRetries})...`, "info");
          }
        }
      }

      if (!response || !response.ok) {
        const errorData = response ? await response.json().catch(() => ({})) : {};
        updateQueueItem(i, { status: "error", error: errorData.error || lastError?.message });
        showToast(`Errore: ${errorData.error || lastError?.message}`, "error");
        errorCount++;
      } else {
        totalBytesUploaded += item.file.size;
        setProgressPercent((totalBytesUploaded / totalBytesToUpload) * 100);
        updateQueueItem(i, { status: "success", progress: 100 });
        addCompletedItem({ ...item, status: "success" });
        successCount++;
      }
    }

    setUploadInProgress(false);
    setShowProgress(false);

    if (errorCount === 0) {
      showToast(`✅ ${successCount} file caricati con successo!`, "success");
    } else {
      showToast(`${successCount} caricati, ${errorCount} errori`, "warning");
    }
  }, [fileQueue, uploadInProgress, showToast, updateQueueItem, addCompletedItem]);

  const activeFiles = fileQueue.filter((f) => f.status === "pending" || f.status === "uploading");

  return (
    <UploadContext.Provider
      value={{
        fileQueue,
        activeFiles,
        uploadInProgress,
        showProgress,
        progressPercent,
        completedItems,
        addFilesToQueue,
        addGoogleQueueItem,
        updateQueueItem,
        updateQueueItemById,
        removeFromQueue,
        addCompletedItem,
        uploadAll,
      }}
    >
      {children}
    </UploadContext.Provider>
  );
}

export function useUpload() {
  const ctx = useContext(UploadContext);
  if (!ctx) throw new Error("useUpload must be used within UploadProvider");
  return ctx;
}
