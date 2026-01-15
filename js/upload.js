/**
 * Upload Module
 * Handles file uploads to OneDrive using Microsoft Graph API
 * Uses sharing link approach for public shared folders
 */

// File queue management
let fileQueue = [];
let uploadInProgress = false;
let currentUploadIndex = 0;
let totalBytesUploaded = 0;
let totalBytesToUpload = 0;

// Cached target folder info (resolved from share link)
let targetDriveItem = null;

/**
 * Encode sharing URL for Graph API
 * See: https://learn.microsoft.com/en-us/graph/api/shares-get
 */
function encodeSharingUrl(url) {
  // Base64 encode the URL
  const base64 = btoa(url)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return "u!" + base64;
}

/**
 * Resolve the target folder - tries multiple approaches
 */
async function resolveShareLink() {
  if (targetDriveItem) {
    return targetDriveItem; // Use cached value
  }

  const client = getGraphClient();
  const folderName = CONFIG.oneDrive.folderName || "CMP GVNG";

  // Approach 1: Try direct IDs if configured (works for owner)
  if (CONFIG.oneDrive.driveId && CONFIG.oneDrive.folderId) {
    console.log("🔗 Tentativo con ID diretti...");
    try {
      const folder = await client
        .api(
          `/drives/${CONFIG.oneDrive.driveId}/items/${CONFIG.oneDrive.folderId}`
        )
        .get();

      targetDriveItem = {
        driveId: CONFIG.oneDrive.driveId,
        itemId: CONFIG.oneDrive.folderId,
        name: folder.name,
      };
      console.log("✅ Cartella trovata con ID:", folder.name);
      return targetDriveItem;
    } catch (error) {
      console.log(
        "⚠️ ID diretti non funzionano, cerco in sharedWithMe...",
        error.message
      );
    }
  }

  // Approach 2: Search in "Shared with me" (works for friends)
  console.log("🔍 Cerco in 'Condivisi con me'...");
  try {
    const sharedItems = await client.api("/me/drive/sharedWithMe").get();

    console.log(
      "📋 Elementi trovati in sharedWithMe:",
      sharedItems.value?.length || 0
    );

    if (sharedItems.value && sharedItems.value.length > 0) {
      // Debug: show all shared items
      console.log("📂 Cartelle condivise disponibili:");
      sharedItems.value.forEach((item) => {
        console.log(`   - "${item.name}" (folder: ${!!item.folder})`);
      });

      for (const item of sharedItems.value) {
        // Match by name (case insensitive)
        if (
          item.name.toLowerCase() === folderName.toLowerCase() &&
          item.folder
        ) {
          targetDriveItem = {
            driveId: item.remoteItem.parentReference.driveId,
            itemId: item.remoteItem.id,
            name: item.name,
          };
          console.log("✅ Cartella trovata in sharedWithMe:", item.name);
          return targetDriveItem;
        }
      }
    }
    console.log(`⚠️ Cartella "${folderName}" non trovata in sharedWithMe`);
  } catch (error) {
    console.log("⚠️ Errore sharedWithMe:", error.message);
  }

  // Approach 3: Try share link
  const shareLink = CONFIG.oneDrive.shareLink;
  if (shareLink) {
    console.log("🔗 Tentativo con share link...");
    try {
      const encodedUrl = encodeSharingUrl(shareLink);
      const sharedItem = await client
        .api(`/shares/${encodedUrl}/driveItem`)
        .get();

      targetDriveItem = {
        driveId: sharedItem.parentReference.driveId,
        itemId: sharedItem.id,
        name: sharedItem.name,
      };
      console.log("✅ Cartella trovata via share link:", sharedItem.name);
      return targetDriveItem;
    } catch (error) {
      console.log(
        "⚠️ Share link non funziona, creo cartella locale...",
        error.message
      );
    }
  }

  // Approach 4: Fallback - create folder in user's drive
  return await createFallbackFolder();
}

/**
 * Create fallback folder in user's drive
 */
async function createFallbackFolder() {
  const client = getGraphClient();
  const folderName = CONFIG.oneDrive.folderName || "CMP GVNG";

  try {
    // First check if it exists
    const existing = await client
      .api("/me/drive/root/children")
      .filter(`name eq '${folderName}'`)
      .get();

    if (existing.value && existing.value.length > 0) {
      const folder = existing.value[0];
      targetDriveItem = {
        driveId: null,
        itemId: folder.id,
        name: folder.name,
        isFallback: true,
      };
      console.log("✅ Cartella esistente trovata:", folder.name);
      return targetDriveItem;
    }

    // Create new folder
    const newFolder = await client.api("/me/drive/root/children").post({
      name: folderName,
      folder: {},
      "@microsoft.graph.conflictBehavior": "rename",
    });

    targetDriveItem = {
      driveId: null,
      itemId: newFolder.id,
      name: newFolder.name,
      isFallback: true,
    };
    console.log("✅ Cartella creata:", newFolder.name);
    return targetDriveItem;
  } catch (error) {
    throw new Error("Impossibile creare cartella di backup: " + error.message);
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

  if (!isAuthenticated()) {
    showToast("Devi effettuare il login prima", "error");
    return;
  }

  // Resolve share link first
  showToast("🔗 Connessione alla cartella condivisa...", "info");
  try {
    await resolveShareLink();
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
    showToast(`✅ ${successCount} file caricati con successo!`, "success");
  } else {
    showToast(`${successCount} caricati, ${errorCount} errori`, "warning");
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
  const sessionUrl = getSessionUrl(fileName);

  const sessionResponse = await client.api(sessionUrl).post({
    item: {
      "@microsoft.graph.conflictBehavior": "rename",
    },
  });

  const uploadUrl = sessionResponse.uploadUrl;
  let uploadedBytes = 0;
  const fileSize = file.size;

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
    fileItem.progress = Math.round((uploadedBytes / fileSize) * 100);
    updateProgressBar((totalBytesUploaded / totalBytesToUpload) * 100);
    renderFileQueue();
  }

  return true;
}

/**
 * Get the upload path for a file
 */
function getUploadPath(fileName) {
  if (!targetDriveItem) {
    return `/me/drive/root:/${fileName}:/content`;
  }

  if (targetDriveItem.driveId) {
    // Shared folder
    return `/drives/${targetDriveItem.driveId}/items/${targetDriveItem.itemId}:/${fileName}:/content`;
  }

  // User's own drive
  return `/me/drive/items/${targetDriveItem.itemId}:/${fileName}:/content`;
}

/**
 * Get the session URL for large file upload
 */
function getSessionUrl(fileName) {
  if (!targetDriveItem) {
    return `/me/drive/root:/${fileName}:/createUploadSession`;
  }

  if (targetDriveItem.driveId) {
    return `/drives/${targetDriveItem.driveId}/items/${targetDriveItem.itemId}:/${fileName}:/createUploadSession`;
  }

  return `/me/drive/items/${targetDriveItem.itemId}:/${fileName}:/createUploadSession`;
}

/**
 * Sanitize file name for upload
 */
function sanitizeFileName(name) {
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
window.uploadAll = uploadAll;
window.formatFileSize = formatFileSize;
window.getFilePreviewUrl = getFilePreviewUrl;
window.resolveShareLink = resolveShareLink;
window.fileQueue = fileQueue;
