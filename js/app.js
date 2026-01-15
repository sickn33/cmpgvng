/**
 * Main Application Entry Point
 * Simplified version - no authentication required
 */

document.addEventListener("DOMContentLoaded", async () => {
  console.log("🚀 App starting...");

  // Check configuration
  const configErrors = validateConfig();
  if (configErrors.length > 0) {
    console.warn("⚠️ Configuration warnings:", configErrors);
    setTimeout(() => {
      configErrors.forEach((error) => showToast(error, "warning"));
    }, 1000);
  }

  // Initialize UI
  initUI();
  console.log("✅ UI initialized");

  // Show upload section immediately (no login required)
  showUploadSection();

  console.log("🎉 App ready!");
});

/**
 * Show the upload section (called after password gate)
 */
function showUploadSection() {
  const welcomeSection = document.getElementById("welcomeSection");
  const uploadSection = document.getElementById("uploadSection");

  if (welcomeSection) welcomeSection.classList.add("hidden");
  if (uploadSection) uploadSection.classList.remove("hidden");
}

// Export
window.showUploadSection = showUploadSection;
