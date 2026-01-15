/**
 * Authentication Module using MSAL.js
 * Handles Microsoft Account login/logout with PKCE flow
 */

// MSAL Configuration
const msalConfig = {
  auth: {
    clientId: CONFIG.azure.clientId,
    authority: CONFIG.azure.authority,
    redirectUri: CONFIG.azure.redirectUri,
  },
  cache: {
    cacheLocation: "localStorage",
    storeAuthStateInCookie: false,
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) return;
        switch (level) {
          case msal.LogLevel.Error:
            console.error(message);
            break;
          case msal.LogLevel.Warning:
            console.warn(message);
            break;
        }
      },
    },
  },
};

// Initialize MSAL instance
let msalInstance = null;
let graphClient = null;

/**
 * Initialize the authentication module
 */
async function initAuth() {
  try {
    msalInstance = new msal.PublicClientApplication(msalConfig);
    await msalInstance.initialize();

    // Handle redirect callback
    const response = await msalInstance.handleRedirectPromise();
    if (response) {
      handleAuthResponse(response);
    }

    // Check if user is already logged in
    const currentAccount = getCurrentAccount();
    if (currentAccount) {
      updateUIForUser(currentAccount);
    }

    return true;
  } catch (error) {
    console.error("Auth initialization failed:", error);
    showToast("Errore inizializzazione autenticazione", "error");
    return false;
  }
}

/**
 * Sign in with Microsoft popup
 */
async function signIn() {
  // Validate config first
  const errors = validateConfig();
  if (errors.length > 0) {
    showToast(errors[0], "error");
    console.error("Configuration errors:", errors);
    return null;
  }

  const loginRequest = {
    scopes: CONFIG.scopes,
  };

  try {
    const response = await msalInstance.loginPopup(loginRequest);
    handleAuthResponse(response);
    return response.account;
  } catch (error) {
    console.error("Login failed:", error);
    if (error.errorCode === "user_cancelled") {
      showToast("Login annullato", "warning");
    } else {
      showToast("Errore durante il login: " + error.message, "error");
    }
    return null;
  }
}

/**
 * Sign out current user
 */
async function signOut() {
  try {
    const account = getCurrentAccount();
    if (account) {
      await msalInstance.logoutPopup({
        account: account,
        postLogoutRedirectUri: CONFIG.azure.redirectUri,
      });
    }
    updateUIForLogout();
    showToast("Logout effettuato con successo", "success");
  } catch (error) {
    console.error("Logout failed:", error);
    showToast("Errore durante il logout", "error");
  }
}

/**
 * Handle authentication response
 */
function handleAuthResponse(response) {
  if (response && response.account) {
    msalInstance.setActiveAccount(response.account);
    updateUIForUser(response.account);
    initGraphClient();
    showToast(`Benvenuto, ${response.account.name}!`, "success");
  }
}

/**
 * Get current logged-in account
 */
function getCurrentAccount() {
  if (!msalInstance) return null;

  const accounts = msalInstance.getAllAccounts();
  if (accounts.length === 0) return null;

  // Return active account or first account
  return msalInstance.getActiveAccount() || accounts[0];
}

/**
 * Get access token for Graph API
 */
async function getAccessToken() {
  const account = getCurrentAccount();
  if (!account) {
    throw new Error("Utente non autenticato");
  }

  const tokenRequest = {
    scopes: CONFIG.scopes,
    account: account,
  };

  try {
    // Try silent token acquisition first
    const response = await msalInstance.acquireTokenSilent(tokenRequest);
    return response.accessToken;
  } catch (error) {
    // If silent fails, try popup
    if (error instanceof msal.InteractionRequiredAuthError) {
      const response = await msalInstance.acquireTokenPopup(tokenRequest);
      return response.accessToken;
    }
    throw error;
  }
}

/**
 * Initialize Microsoft Graph client
 */
function initGraphClient() {
  graphClient = MicrosoftGraph.Client.init({
    authProvider: async (done) => {
      try {
        const token = await getAccessToken();
        done(null, token);
      } catch (error) {
        done(error, null);
      }
    },
  });
}

/**
 * Get initialized Graph client
 */
function getGraphClient() {
  if (!graphClient) {
    initGraphClient();
  }
  return graphClient;
}

/**
 * Check if user is authenticated
 */
function isAuthenticated() {
  return getCurrentAccount() !== null;
}

// Export functions
window.initAuth = initAuth;
window.signIn = signIn;
window.signOut = signOut;
window.getCurrentAccount = getCurrentAccount;
window.getAccessToken = getAccessToken;
window.getGraphClient = getGraphClient;
window.isAuthenticated = isAuthenticated;
