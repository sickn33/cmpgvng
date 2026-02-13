import { useState, useRef } from "react";
import { useAuth } from "../contexts/AuthContext.jsx";

export function PasswordGate() {
  const { checkPassword } = useAuth();
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);
  const inputRef = useRef(null);

  function handleSubmit(e) {
    e.preventDefault();
    setError(false);
    if (checkPassword(password)) {
      return;
    }
    setError(true);
    setShake(true);
    inputRef.current?.focus();
    setTimeout(() => setShake(false), 500);
  }

  return (
    <div className="password-gate">
      <div className="glass-card password-card">
        <span className="icon icon-xl">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </span>
        <h2>Area Riservata</h2>
        <p>Inserisci la password per accedere</p>
        <form onSubmit={handleSubmit}>
          <input
            id="passwordInput"
            ref={inputRef}
            type="password"
            className={`password-input ${shake ? "shake" : ""}`}
            placeholder="Password..."
            autoComplete="off"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit(e)}
          />
          <button id="passwordSubmit" type="submit" className="btn btn-primary">
            <span className="icon icon-sm">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </span>
            Entra
          </button>
        </form>
        {error && (
          <p className="password-error">
            <span className="icon icon-sm icon-error">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="m15 9-6 6" />
                <path d="m9 9 6 6" />
              </svg>
            </span>
            Password errata
          </p>
        )}
      </div>
    </div>
  );
}
