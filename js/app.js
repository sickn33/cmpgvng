/**
 * Main Application Entry Point
 * Initializes all modules on page load
 */

document.addEventListener("DOMContentLoaded", async () => {
  console.log("🚀 App starting...");

  // Check configuration
  const configErrors = validateConfig();
  if (configErrors.length > 0) {
    console.warn("⚠️ Configuration warnings:", configErrors);
    // Show warning after a short delay
    setTimeout(() => {
      configErrors.forEach((error) => showToast(error, "warning"));
    }, 1000);
  }

  // Initialize UI
  initUI();
  console.log("✅ UI initialized");

  // Initialize authentication
  const authSuccess = await initAuth();
  if (authSuccess) {
    console.log("✅ Auth initialized");
  } else {
    console.error("❌ Auth initialization failed");
  }

  console.log("🎉 App ready!");
});
