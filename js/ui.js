/**
 * UI Module
 * Handles all user interface interactions
 */

/**
 * Initialize UI event listeners
 */
function initUI() {
  initDropZone();
  initFileInput();
  triggerStaggeredAnimations();
}

/**
 * Trigger staggered entry animations
 */
function triggerStaggeredAnimations() {
  const elements = [
    document.querySelector(".header"),
    document.querySelector(".welcome-section"),
    document.querySelector(".features"),
    document.querySelector(".drop-zone-content"),
    document.querySelector(".completed-card"),
  ];

  let delay = 0;
  elements.forEach((el) => {
    if (el) {
      el.style.opacity = "0"; // Ensure hidden initially
      setTimeout(() => {
        el.classList.add("fade-in-stagger");
      }, delay);
      delay += 150; // 150ms delay between items
    }
  });
}

/**
 * Initialize drag and drop zone
 */
function initDropZone() {
  const dropZone = document.getElementById("dropZone");
  if (!dropZone) return;

  // Prevent default drag behaviors
  ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
    dropZone.addEventListener(eventName, preventDefaults, false);
    document.body.addEventListener(eventName, preventDefaults, false);
  });

  // Highlight drop zone when dragging over
  ["dragenter", "dragover"].forEach((eventName) => {
    dropZone.addEventListener(
      eventName,
      () => {
        dropZone.classList.add("dragover");
      },
      false
    );
  });

  ["dragleave", "drop"].forEach((eventName) => {
    dropZone.addEventListener(
      eventName,
      () => {
        dropZone.classList.remove("dragover");
      },
      false
    );
  });

  // Handle dropped files
  dropZone.addEventListener("drop", handleDrop, false);

  // Click to select files
  // Click to select files
  dropZone.addEventListener("click", (e) => {
    // Avoid double triggering if clicking the label/input directly
    if (
      e.target.tagName !== "INPUT" &&
      !e.target.closest(".file-input-label")
    ) {
      document.getElementById("fileInput").click();
    }
  });
}

/**
 * Prevent default behaviors
 */
function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

/**
 * Handle dropped files
 */
function handleDrop(e) {
  const dt = e.dataTransfer;
  const files = dt.files;

  if (files.length > 0) {
    addFilesToQueue(files);
  }
}

/**
 * Initialize file input
 */
function initFileInput() {
  const fileInput = document.getElementById("fileInput");
  if (!fileInput) return;

  fileInput.addEventListener("change", (e) => {
    const files = e.target.files;
    if (files.length > 0) {
      addFilesToQueue(files);
    }
    // Reset input to allow selecting the same file again
    e.target.value = "";
  });
}

/**
 * Update UI for logged-in user
 */
function updateUIForUser(account) {
  const loginBtn = document.getElementById("loginBtn");
  const userInfo = document.getElementById("userInfo");
  const userName = document.getElementById("userName");
  const welcomeSection = document.getElementById("welcomeSection");
  const uploadSection = document.getElementById("uploadSection");

  if (loginBtn) loginBtn.classList.add("hidden");
  if (userInfo) userInfo.classList.remove("hidden");
  if (userName) userName.textContent = account.name || account.username;
  if (welcomeSection) welcomeSection.classList.add("hidden");
  if (uploadSection) uploadSection.classList.remove("hidden");
}

/**
 * Update UI for logout
 */
function updateUIForLogout() {
  const loginBtn = document.getElementById("loginBtn");
  const userInfo = document.getElementById("userInfo");
  const welcomeSection = document.getElementById("welcomeSection");
  const uploadSection = document.getElementById("uploadSection");

  if (loginBtn) loginBtn.classList.remove("hidden");
  if (userInfo) userInfo.classList.add("hidden");
  if (welcomeSection) loginBtn.classList.remove("hidden"); // Fixed logic: welcomeSection should be shown
  if (welcomeSection) welcomeSection.classList.remove("hidden");
  if (uploadSection) uploadSection.classList.add("hidden");

  // Clear file queue
  fileQueue = [];
  renderFileQueue();
}

/**
 * Render file queue in UI
 */
function renderFileQueue() {
  const fileList = document.getElementById("fileList");
  const fileQueueCard = document.getElementById("fileQueueCard");
  const uploadAllBtn = document.getElementById("uploadAllBtn");

  if (!fileList) return;

  // Get only pending and uploading files
  const activeFiles = fileQueue.filter(
    (f) => f.status === "pending" || f.status === "uploading"
  );

  // Show/hide queue card
  if (fileQueueCard) {
    if (activeFiles.length > 0) {
      fileQueueCard.classList.remove("hidden");
    } else {
      fileQueueCard.classList.add("hidden");
    }
  }

  // Disable upload button during upload
  if (uploadAllBtn) {
    uploadAllBtn.disabled = fileQueue.some((f) => f.status === "uploading");
  }

  // Render file items
  fileList.innerHTML = activeFiles
    .map((item, index) => {
      const realIndex = fileQueue.indexOf(item);
      const previewUrl = getFilePreviewUrl(item.file);
      const statusIcon = getStatusIcon(item.status);

      return `
            <div class="file-item" data-index="${realIndex}">
                ${
                  previewUrl
                    ? `<img src="${previewUrl}" class="file-preview" alt="${item.name}">`
                    : `<div class="file-preview-placeholder">${getFileIcon(
                        item.type
                      )}</div>`
                }
                <div class="file-details">
                    <div class="file-name">${escapeHtml(item.name)}</div>
                    <div class="file-size">
                        ${formatFileSize(item.size)}
                        ${
                          item.status === "uploading"
                            ? ` • ${item.progress}%`
                            : ""
                        }
                    </div>
                </div>
                <div class="file-status">
                    ${statusIcon}
                    ${
                      item.status === "pending"
                        ? `<button class="file-remove" onclick="removeFromQueue(${realIndex})" title="Rimuovi">❌</button>`
                        : ""
                    }
                </div>
            </div>
        `;
    })
    .join("");
}

/**
 * Get status icon for file
 */
function getStatusIcon(status) {
  switch (status) {
    case "pending":
      return '<span class="status-icon">⏳</span>';
    case "uploading":
      return '<span class="status-icon uploading">⬆️</span>';
    case "success":
      return '<span class="status-icon success">✅</span>';
    case "error":
      return '<span class="status-icon error">❌</span>';
    default:
      return "";
  }
}

/**
 * Get file icon based on type
 */
function getFileIcon(type) {
  if (type.startsWith("image/")) return "🖼️";
  if (type.startsWith("video/")) return "🎬";
  return "📄";
}

/**
 * Show/hide progress card
 */
function showProgressCard(show) {
  const progressCard = document.getElementById("progressCard");
  if (progressCard) {
    if (show) {
      progressCard.classList.remove("hidden");
    } else {
      progressCard.classList.add("hidden");
    }
  }
}

/**
 * Update progress bar
 */
function updateProgressBar(percentage) {
  const progressBar = document.getElementById("progressBar");
  const progressText = document.getElementById("progressText");

  if (progressBar) {
    progressBar.style.width = `${percentage}%`;
  }
  if (progressText) {
    progressText.textContent = `${Math.round(percentage)}%`;
  }
}

/**
 * Add file to completed list
 */
function addToCompletedList(fileItem) {
  const completedCard = document.getElementById("completedCard");
  const completedList = document.getElementById("completedList");

  if (!completedList) return;

  if (completedCard) {
    completedCard.classList.remove("hidden");
  }

  const itemHtml = `
        <div class="completed-item">
            <span class="status-icon">✅</span>
            <span class="file-name">${escapeHtml(fileItem.name)}</span>
            <span class="file-size">${formatFileSize(fileItem.size)}</span>
        </div>
    `;

  completedList.insertAdjacentHTML("beforeend", itemHtml);
}

/**
 * Show toast notification
 */
function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const icons = {
    success: "✅",
    error: "❌",
    warning: "⚠️",
    info: "ℹ️",
  };

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
        <span class="toast-icon">${icons[type]}</span>
        <span class="toast-message">${escapeHtml(message)}</span>
    `;

  container.appendChild(toast);

  // Auto remove after duration
  setTimeout(() => {
    toast.style.animation = "slideIn 0.3s ease reverse";
    setTimeout(() => toast.remove(), 300);
  }, CONFIG.ui.toastDuration);
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Export functions
window.initUI = initUI;
window.updateUIForUser = updateUIForUser;
window.updateUIForLogout = updateUIForLogout;
window.renderFileQueue = renderFileQueue;
window.showProgressCard = showProgressCard;
window.updateProgressBar = updateProgressBar;
window.addToCompletedList = addToCompletedList;
window.showToast = showToast;
