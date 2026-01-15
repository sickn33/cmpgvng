/**
 * Password Gate Module
 * Stores password for server-side verification
 * The actual password is NOT stored in this file - verification happens on the Worker
 */

const STORAGE_KEY = "cmpgvng_unlocked";
const PASSWORD_KEY = "cmpgvng_password";

/**
 * Check if user has entered a password this session
 */
function isUnlocked() {
  return sessionStorage.getItem(STORAGE_KEY) === "true";
}

/**
 * Store password and unlock the gate
 * Actual verification happens on upload via Cloudflare Worker
 */
function checkPassword() {
  const input = document.getElementById("passwordInput");
  const error = document.getElementById("passwordError");

  const password = input.value.trim();

  if (password.length > 0) {
    // Store password for later use in uploads
    sessionStorage.setItem(PASSWORD_KEY, password);
    sessionStorage.setItem(STORAGE_KEY, "true");
    unlockApp();
  } else {
    // Show error for empty password
    error.classList.remove("hidden");
    input.focus();
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
 * Clear stored password (for logout/error handling)
 */
function clearPassword() {
  sessionStorage.removeItem(PASSWORD_KEY);
  sessionStorage.removeItem(STORAGE_KEY);
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
window.clearPassword = clearPassword;
