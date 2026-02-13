import { createContext, useContext, useState, useEffect } from "react";

const STORAGE_KEY = "cmpgvng_unlocked";
const PASSWORD_KEY = "cmpgvng_password";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (sessionStorage.getItem(STORAGE_KEY) === "true") {
      setIsUnlocked(true);
      setPassword(sessionStorage.getItem(PASSWORD_KEY) || "");
    }
  }, []);

  function checkPassword(inputPassword) {
    const trimmed = (inputPassword || "").trim();
    if (trimmed.length > 0) {
      sessionStorage.setItem(PASSWORD_KEY, trimmed);
      sessionStorage.setItem(STORAGE_KEY, "true");
      setPassword(trimmed);
      setIsUnlocked(true);
      return true;
    }
    return false;
  }

  function clearPassword() {
    sessionStorage.removeItem(PASSWORD_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
    setPassword("");
    setIsUnlocked(false);
  }

  function getPassword() {
    return sessionStorage.getItem(PASSWORD_KEY) || password;
  }

  return (
    <AuthContext.Provider
      value={{
        isUnlocked,
        password: getPassword(),
        checkPassword,
        clearPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
