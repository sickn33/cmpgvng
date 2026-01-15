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

// Cached target folder info
let targetFolderInfo = null;

/**
 * Find the shared folder "CMP GVNG" that was shared with the user
 */
async function findSharedFolder() {
  if (targetFolderInfo) {
    return targetFolderInfo; // Use cached value
  }

  const client = getGraphClient();
  const folderName = "CMP GVNG";

  try {
    // First, try to find in user's own drive
    console.log("🔍 Cercando cartella nel tuo drive...");
    const ownFolder = await client
      .api("/me/drive/root/children")
      .filter(`name eq '${folderName}'`)
      .get();

    if (ownFolder.value && ownFolder.value.length > 0) {
      const folder = ownFolder.value[0];
      targetFolderInfo = {
        driveId: null, // null means use /me/drive
        folderId: folder.id,
        name: folder.name,
      };
      console.log("✅ Cartella trovata nel tuo drive:", folder.name);
      return targetFolderInfo;
    }

    // If not found, check shared items
    console.log("🔍 Cercando nelle cartelle condivise...");
    const sharedItems = await client.api("/me/drive/sharedWithMe").get();

    if (sharedItems.value) {
      for (const item of sharedItems.value) {
        if (item.name === folderName && item.folder) {
          targetFolderInfo = {
            driveId: item.remoteItem.parentReference.driveId,
            folderId: item.remoteItem.id,
            name: item.name,
          };
          console.log("✅ Cartella condivisa trovata:", item.name);
          return targetFolderInfo;
        }
      }
    }

    // If still not found, create it in user's drive
    console.log("📁 Creo cartella nel tuo drive...");
    const newFolder = await client.api("/me/drive/root/children").post({
      name: folderName,
      folder: {},
      "@microsoft.graph.conflictBehavior": "fail",
    });

    targetFolderInfo = {
      driveId: null,
      folderId: newFolder.id,
      name: newFolder.name,
    };
    console.log("✅ Cartella creata:", newFolder.name);
    return targetFolderInfo;
  } catch (error) {
    console.error("Errore nella ricerca cartella:", error);
    // Fallback: create folder in root
    try {
      const newFolder = await client.api("/me/drive/root/children").post({
        name: folderName,
        folder: {},
        "@microsoft.graph.conflictBehavior": "rename",
      });
      targetFolderInfo = {
        driveId: null,
        folderId: newFolder.id,
        name: newFolder.name,
      };
      return targetFolderInfo;
    } catch (e) {
      throw new Error(
        "Impossibile trovare o creare la cartella di destinazione"
      );
    }
  }
}

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

  // Find target folder first
  showToast("🔍 Cerco cartella di destinazione...", "info");
  try {
    await findSharedFolder();
  } catch (error) {
    showToast("Errore: " + error.message, "error");
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

  // Construct session creation URL based on target folder
  const sessionUrl = getSessionUrl(fileName);

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
  if (!targetFolderInfo) {
    // Fallback to user's root
    return `/me/drive/root:/${fileName}:/content`;
  }

  if (targetFolderInfo.driveId) {
    // Shared folder on another drive
    return `/drives/${targetFolderInfo.driveId}/items/${targetFolderInfo.folderId}:/${fileName}:/content`;
  }

  // User's own drive
  return `/me/drive/items/${targetFolderInfo.folderId}:/${fileName}:/content`;
}

/**
 * Get the session URL for large file upload
 */
function getSessionUrl(fileName) {
  if (!targetFolderInfo) {
    return `/me/drive/root:/${fileName}:/createUploadSession`;
  }

  if (targetFolderInfo.driveId) {
    return `/drives/${targetFolderInfo.driveId}/items/${targetFolderInfo.folderId}:/${fileName}:/createUploadSession`;
  }

  return `/me/drive/items/${targetFolderInfo.folderId}:/${fileName}:/createUploadSession`;
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
window.findSharedFolder = findSharedFolder;
window.fileQueue = fileQueue;
