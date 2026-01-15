/**
 * Password Gate Module
 * Simple client-side password protection for friends-only access
 */

const SITE_PASSWORD = "ECHOVIVE";
const STORAGE_KEY = "cmpgvng_unlocked";

/**
 * Check if user is already authenticated
 */
function isUnlocked() {
  return sessionStorage.getItem(STORAGE_KEY) === "true";
}

/**
 * Check entered password
 */
function checkPassword() {
  const input = document.getElementById("passwordInput");
  const error = document.getElementById("passwordError");

  if (input.value === SITE_PASSWORD) {
    // Unlock and show app
    sessionStorage.setItem(STORAGE_KEY, "true");
    unlockApp();
  } else {
    // Show error
    error.classList.remove("hidden");
    input.value = "";
    input.focus();

    // Shake animation
    input.classList.add("shake");
    setTimeout(() => input.classList.remove("shake"), 500);
  }
}

/**
 * Unlock the app and hide password gate
 */
function unlockApp() {
  const gate = document.getElementById("passwordGate");
  const app = document.getElementById("appContainer");

  if (gate) gate.classList.add("hidden");
  if (app) app.classList.remove("hidden");
}

/**
 * Initialize password gate on page load
 */
function initPasswordGate() {
  const passwordInput = document.getElementById("passwordInput");

  // Check if already unlocked
  if (isUnlocked()) {
    unlockApp();
    return;
  }

  // Listen for Enter key
  if (passwordInput) {
    passwordInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        checkPassword();
      }
    });
    passwordInput.focus();
  }
}

// Auto-init when DOM is ready
document.addEventListener("DOMContentLoaded", initPasswordGate);

// Export
window.checkPassword = checkPassword;
window.unlockApp = unlockApp;
