/**
 * Upload Module
 * Handles file uploads to OneDrive using Microsoft Graph API
 */

// File queue management
let fileQueue = [];
let uploadInProgress = false;
let currentUploadIndex = 0;
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
      status: "pending", // pending, uploading, success, error
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
 * Clear completed files from queue
 */
function clearCompletedFiles() {
  fileQueue = fileQueue.filter(
    (f) => f.status !== "success" && f.status !== "error"
  );
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

  if (!isAuthenticated()) {
    showToast("Devi effettuare il login prima", "error");
    return;
  }

  uploadInProgress = true;
  currentUploadIndex = 0;
  totalBytesUploaded = 0;
  totalBytesToUpload = pendingFiles.reduce((acc, f) => acc + f.file.size, 0);

  showProgressCard(true);
  updateProgressBar(0);

  for (let i = 0; i < fileQueue.length; i++) {
    if (fileQueue[i].status !== "pending") continue;

    currentUploadIndex = i;
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
      showToast(`Errore caricamento: ${fileQueue[i].name}`, "error");
    }

    renderFileQueue();
  }

  uploadInProgress = false;
  showProgressCard(false);

  const successCount = fileQueue.filter((f) => f.status === "success").length;
  const errorCount = fileQueue.filter((f) => f.status === "error").length;

  if (errorCount === 0) {
    showToast(
      `✅ Tutti i ${successCount} file caricati con successo!`,
      "success"
    );
  } else {
    showToast(`${successCount} file caricati, ${errorCount} errori`, "warning");
  }
}

/**
 * Upload a single file
 */
async function uploadFile(fileItem) {
  const file = fileItem.file;
  const fileName = sanitizeFileName(file.name);
  const chunkSize = CONFIG.upload.chunkSizeMB * 1024 * 1024;

  // Small files (< 4MB) - simple upload
  if (file.size < 4 * 1024 * 1024) {
    return await uploadSmallFile(file, fileName, fileItem);
  }

  // Large files - use upload session
  return await uploadLargeFile(file, fileName, fileItem, chunkSize);
}

/**
 * Upload small file (< 4MB)
 */
async function uploadSmallFile(file, fileName, fileItem) {
  const client = getGraphClient();
  const path = getUploadPath(fileName);

  const response = await client.api(path).putStream(file);

  totalBytesUploaded += file.size;
  updateProgressBar((totalBytesUploaded / totalBytesToUpload) * 100);

  return response;
}

/**
 * Upload large file using upload session
 */
async function uploadLargeFile(file, fileName, fileItem, chunkSize) {
  const client = getGraphClient();

  // Construct session creation URL
  let sessionUrl;
  if (CONFIG.oneDrive.driveId && CONFIG.oneDrive.folderId) {
    // For specific drive: /drives/{drive-id}/items/{item-id}:/{filename}:/createUploadSession
    sessionUrl = `/drives/${CONFIG.oneDrive.driveId}/items/${CONFIG.oneDrive.folderId}:/${fileName}:/createUploadSession`;
  } else if (CONFIG.oneDrive.folderId) {
    sessionUrl = `/me/drive/items/${CONFIG.oneDrive.folderId}:/${fileName}:/createUploadSession`;
  } else {
    const folderPath = CONFIG.oneDrive.folderPath.replace(/^\//, "");
    sessionUrl = `/me/drive/root:/${folderPath}/${fileName}:/createUploadSession`;
  }

  const sessionResponse = await client.api(sessionUrl).post({
    item: {
      "@microsoft.graph.conflictBehavior": "rename",
    },
  });

  const uploadUrl = sessionResponse.uploadUrl;
  let uploadedBytes = 0;
  const fileSize = file.size;

  // Upload file in chunks
  while (uploadedBytes < fileSize) {
    const chunkStart = uploadedBytes;
    const chunkEnd = Math.min(uploadedBytes + chunkSize, fileSize);
    const chunk = file.slice(chunkStart, chunkEnd);

    const response = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Length": chunk.size,
        "Content-Range": `bytes ${chunkStart}-${chunkEnd - 1}/${fileSize}`,
      },
      body: chunk,
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    uploadedBytes = chunkEnd;
    totalBytesUploaded += chunk.size;

    // Update file progress
    fileItem.progress = Math.round((uploadedBytes / fileSize) * 100);

    // Update overall progress
    updateProgressBar((totalBytesUploaded / totalBytesToUpload) * 100);
    renderFileQueue();
  }

  return true;
}

/**
 * Get the upload path for a file
 */
function getUploadPath(fileName) {
  // Case 1: Target specific Drive and Folder (Shared Scenario)
  if (CONFIG.oneDrive.driveId && CONFIG.oneDrive.folderId) {
    return `/drives/${CONFIG.oneDrive.driveId}/items/${CONFIG.oneDrive.folderId}:/${fileName}:/content`;
  }

  // Case 2: Target Folder ID on User's Drive
  if (CONFIG.oneDrive.folderId) {
    return `/me/drive/items/${CONFIG.oneDrive.folderId}:/${fileName}:/content`;
  }

  // Case 3: Target Path on User's Root (Default)
  const folderPath = CONFIG.oneDrive.folderPath.replace(/^\//, "");
  return `/me/drive/root:/${folderPath}/${fileName}:/content`;
}

/**
 * Sanitize file name for upload
 */
function sanitizeFileName(name) {
  // Remove invalid characters for OneDrive
  return name
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
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
window.clearCompletedFiles = clearCompletedFiles;
window.uploadAll = uploadAll;
window.formatFileSize = formatFileSize;
window.getFilePreviewUrl = getFilePreviewUrl;
window.fileQueue = fileQueue;
