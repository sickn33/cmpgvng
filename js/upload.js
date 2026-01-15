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

  // Upload to Worker
  const response = await fetch(`${CONFIG.workerUrl}/upload`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Upload failed: ${response.status}`);
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
