/**
 * Upload Module
 * Handles file uploads via Cloudflare Worker
 * No authentication required - worker handles OneDrive auth
 */

// File queue management
let fileQueue = [];
let uploadInProgress = false;
let totalBytesUploaded = 0;
let totalBytesToUpload = 0;

/**
 * Add files to the upload queue
 */
function addFilesToQueue(files) {
  const maxSize = CONFIG.upload.maxFileSizeMB * 1024 * 1024;
  let addedCount = 0;

  for (const file of files) {
    // Check file type
    if (!isAllowedFileType(file)) {
      showToast(`Tipo file non supportato: ${file.name}`, "warning");
      continue;
    }

    // Check file size
    if (file.size > maxSize) {
      showToast(
        `File troppo grande: ${file.name} (max ${CONFIG.upload.maxFileSizeMB}MB)`,
        "warning"
      );
      continue;
    }

    // Check for duplicates
    if (fileQueue.some((f) => f.name === file.name && f.size === file.size)) {
      showToast(`File già in coda: ${file.name}`, "warning");
      continue;
    }

    fileQueue.push({
      file: file,
      name: file.name,
      size: file.size,
      type: file.type,
      status: "pending",
      progress: 0,
      error: null,
    });
    addedCount++;
  }

  if (addedCount > 0) {
    renderFileQueue();
    showToast(`${addedCount} file aggiunti alla coda`, "success");
  }
}

/**
 * Check if file type is allowed
 */
function isAllowedFileType(file) {
  const allowedTypes = CONFIG.upload.allowedTypes;
  return allowedTypes.some((pattern) => {
    if (pattern.endsWith("/*")) {
      const category = pattern.replace("/*", "");
      return file.type.startsWith(category);
    }
    return file.type === pattern;
  });
}

/**
 * Remove file from queue
 */
function removeFromQueue(index) {
  if (fileQueue[index].status === "uploading") {
    showToast("Non puoi rimuovere un file durante il caricamento", "warning");
    return;
  }
  fileQueue.splice(index, 1);
  renderFileQueue();
}

/**
 * Upload all files in queue
 */
async function uploadAll() {
  if (uploadInProgress) {
    showToast("Caricamento già in corso", "warning");
    return;
  }

  const pendingFiles = fileQueue.filter((f) => f.status === "pending");
  if (pendingFiles.length === 0) {
    showToast("Nessun file da caricare", "warning");
    return;
  }

  // Check config
  const configErrors = validateConfig();
  if (configErrors.length > 0) {
    showToast(configErrors[0], "error");
    return;
  }

  uploadInProgress = true;
  totalBytesUploaded = 0;
  totalBytesToUpload = pendingFiles.reduce((acc, f) => acc + f.file.size, 0);

  showProgressCard(true);
  updateProgressBar(0);

  for (let i = 0; i < fileQueue.length; i++) {
    if (fileQueue[i].status !== "pending") continue;

    fileQueue[i].status = "uploading";
    renderFileQueue();

    try {
      await uploadFile(fileQueue[i]);
      fileQueue[i].status = "success";
      fileQueue[i].progress = 100;
      addToCompletedList(fileQueue[i]);
    } catch (error) {
      console.error("Upload failed:", error);
      fileQueue[i].status = "error";
      fileQueue[i].error = error.message;
      showToast(`Errore: ${error.message}`, "error");
    }

    renderFileQueue();
  }

  uploadInProgress = false;
  showProgressCard(false);

  const successCount = fileQueue.filter((f) => f.status === "success").length;
  const errorCount = fileQueue.filter((f) => f.status === "error").length;

  if (errorCount === 0) {
    showToast(`✅ ${successCount} file caricati con successo!`, "success");
  } else {
    showToast(`${successCount} caricati, ${errorCount} errori`, "warning");
  }
}

async function uploadFile(fileItem) {
  const file = fileItem.file;

  // Get password from sessionStorage (set by password gate)
  const password = sessionStorage.getItem("cmpgvng_password") || "";

  // Create FormData
  const formData = new FormData();
  formData.append("file", file);
  formData.append("password", password);

  // Upload to Worker with Retry Logic
  let attempts = 0;
  const maxRetries = 3;
  let response;
  let lastError;

  while (attempts < maxRetries) {
    try {
      response = await fetch(`${CONFIG.workerUrl}/upload`, {
        method: "POST",
        body: formData,
      });

      // If success (200-299), break loop
      if (response.ok) break;

      // If client error (4xx), do not retry (unless 429 Too Many Requests)
      if (
        response.status >= 400 &&
        response.status < 500 &&
        response.status !== 429
      ) {
        throw new Error(`Upload failed with status: ${response.status}`);
      }

      // If server error (5xx) or 429, throw to trigger retry
      throw new Error(`Server error: ${response.status}`);
    } catch (error) {
      lastError = error;
      attempts++;
      console.warn(`Upload attempt ${attempts} failed: ${error.message}`);

      // If client error (4xx) that isn't 429, don't retry, just throw immediately
      if (error.message.includes("Upload failed with status")) {
        throw error;
      }

      if (attempts < maxRetries) {
        // Wait with exponential backoff before retrying (1s, 2s, 4s)
        const delay = Math.pow(2, attempts - 1) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
        showToast(
          `Riprovo il caricamento (${attempts}/${maxRetries})...`,
          "info"
        );
      }
    }
  }

  if (!response || !response.ok) {
    if (response) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error || `Upload failed after ${maxRetries} attempts`
      );
    }
    throw lastError || new Error("Upload failed");
  }

  const result = await response.json();

  // Update progress
  totalBytesUploaded += file.size;
  updateProgressBar((totalBytesUploaded / totalBytesToUpload) * 100);

  return result;
}

/**
 * Format file size for display
 */
function formatFileSize(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

/**
 * Generate preview URL for image files
 */
function getFilePreviewUrl(file) {
  if (file.type.startsWith("image/")) {
    return URL.createObjectURL(file);
  }
  return null;
}

// Export functions
window.addFilesToQueue = addFilesToQueue;
window.removeFromQueue = removeFromQueue;
window.uploadAll = uploadAll;
window.formatFileSize = formatFileSize;
window.getFilePreviewUrl = getFilePreviewUrl;
window.fileQueue = fileQueue;
