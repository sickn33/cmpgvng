/**
 * Gallery Module - Handles fetching and displaying images from OneDrive
 */

// Gallery state
let galleryItems = [];
let currentLightboxIndex = 0;
let galleryLoaded = false;

/**
 * Fetch gallery items from the API
 */
async function fetchGallery() {
  // DEBUG: Log sessionStorage state
  console.log(
    "[Gallery Debug] sessionStorage keys:",
    Object.keys(sessionStorage)
  );
  console.log(
    "[Gallery Debug] cmpgvng_password:",
    sessionStorage.getItem("cmpgvng_password")
  );
  console.log(
    "[Gallery Debug] cmpgvng_unlocked:",
    sessionStorage.getItem("cmpgvng_unlocked")
  );

  const password = sessionStorage.getItem("cmpgvng_password");
  if (!password) {
    console.error("[Gallery Debug] Password NOT found in sessionStorage!");
    showToast("Sessione scaduta, ricarica la pagina", "error");
    return [];
  }

  console.log(
    "[Gallery Debug] Making API request to:",
    `${CONFIG.workerUrl}/gallery`
  );

  const response = await fetch(
    `${CONFIG.workerUrl}/gallery?password=${encodeURIComponent(password)}`
  );

  console.log("[Gallery Debug] API response status:", response.status);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Errore nel caricamento della galleria");
  }

  const data = await response.json();
  console.log("[Gallery Debug] Got items:", data.items?.length || 0);
  return data.items || [];
}

/**
 * Render the gallery grid
 */
function renderGallery(items) {
  const grid = document.getElementById("galleryGrid");
  const loading = document.getElementById("galleryLoading");
  const empty = document.getElementById("galleryEmpty");

  loading.classList.add("hidden");

  if (items.length === 0) {
    empty.classList.remove("hidden");
    grid.classList.add("hidden");
    return;
  }

  empty.classList.add("hidden");
  grid.classList.remove("hidden");

  grid.innerHTML = items
    .map(
      (item, index) => `
    <div class="gallery-item" onclick="openLightbox(${index})">
      ${
        item.isVideo
          ? '<span class="gallery-item-video-badge">🎬 Video</span>'
          : ""
      }
      <img 
        src="${item.thumbnailUrl || ""}" 
        alt="${escapeHtml(item.name)}"
        loading="lazy"
        onerror="this.style.display='none'"
      />
      <div class="gallery-item-overlay">
        <span class="gallery-item-name">${escapeHtml(item.name)}</span>
      </div>
    </div>
  `
    )
    .join("");
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Load gallery (called when switching to gallery tab)
 */
async function loadGallery() {
  // Only load once per session, unless forced
  if (galleryLoaded && galleryItems.length > 0) {
    return;
  }

  const loading = document.getElementById("galleryLoading");
  const empty = document.getElementById("galleryEmpty");
  const grid = document.getElementById("galleryGrid");

  // Show loading
  loading.classList.remove("hidden");
  empty.classList.add("hidden");
  grid.classList.add("hidden");

  try {
    galleryItems = await fetchGallery();
    renderGallery(galleryItems);
    galleryLoaded = true;
  } catch (error) {
    console.error("Gallery error:", error);
    loading.classList.add("hidden");
    showToast(error.message, "error");
  }
}

/**
 * Refresh gallery (force reload)
 */
async function refreshGallery() {
  galleryLoaded = false;
  await loadGallery();
}

/**
 * Open lightbox at specific index
 */
function openLightbox(index) {
  if (!galleryItems[index]) return;

  currentLightboxIndex = index;
  const item = galleryItems[index];
  const lightbox = document.getElementById("lightbox");
  const image = document.getElementById("lightboxImage");
  const video = document.getElementById("lightboxVideo");

  // Show lightbox
  lightbox.classList.remove("hidden");
  document.body.style.overflow = "hidden";

  // Update content
  if (item.isVideo) {
    image.style.display = "none";
    video.style.display = "block";
    video.src = item.downloadUrl;
  } else {
    video.style.display = "none";
    video.src = "";
    image.style.display = "block";
    image.src = item.downloadUrl || item.thumbnailUrl;
    image.alt = item.name;
  }

  // Update info
  document.getElementById("lightboxTitle").textContent = item.name;
  document.getElementById("lightboxCounter").textContent = `${index + 1} / ${
    galleryItems.length
  }`;
}

/**
 * Close lightbox
 */
function closeLightbox() {
  const lightbox = document.getElementById("lightbox");
  const video = document.getElementById("lightboxVideo");

  lightbox.classList.add("hidden");
  document.body.style.overflow = "";

  // Stop video if playing
  video.pause();
  video.src = "";
}

/**
 * Navigate lightbox (prev/next)
 */
function navigateLightbox(direction) {
  let newIndex = currentLightboxIndex + direction;

  // Wrap around
  if (newIndex < 0) {
    newIndex = galleryItems.length - 1;
  } else if (newIndex >= galleryItems.length) {
    newIndex = 0;
  }

  openLightbox(newIndex);
}

/**
 * Show section (upload or gallery)
 */
function showSection(section) {
  const uploadSection = document.getElementById("uploadSection");
  const gallerySection = document.getElementById("gallerySection");
  const tabUpload = document.getElementById("tabUpload");
  const tabGallery = document.getElementById("tabGallery");

  if (section === "upload") {
    uploadSection.classList.remove("hidden");
    gallerySection.classList.add("hidden");
    tabUpload.classList.add("active");
    tabGallery.classList.remove("active");
  } else {
    uploadSection.classList.add("hidden");
    gallerySection.classList.remove("hidden");
    tabUpload.classList.remove("active");
    tabGallery.classList.add("active");

    // Load gallery when switching to it
    loadGallery();
  }
}

// Keyboard navigation for lightbox
document.addEventListener("keydown", (e) => {
  const lightbox = document.getElementById("lightbox");
  if (lightbox.classList.contains("hidden")) return;

  switch (e.key) {
    case "Escape":
      closeLightbox();
      break;
    case "ArrowLeft":
      navigateLightbox(-1);
      break;
    case "ArrowRight":
      navigateLightbox(1);
      break;
  }
});

// Click outside to close lightbox
document.getElementById("lightbox")?.addEventListener("click", (e) => {
  if (e.target.id === "lightbox") {
    closeLightbox();
  }
});

// Export functions
window.showSection = showSection;
window.openLightbox = openLightbox;
window.closeLightbox = closeLightbox;
window.navigateLightbox = navigateLightbox;
window.loadGallery = loadGallery;
window.refreshGallery = refreshGallery;
