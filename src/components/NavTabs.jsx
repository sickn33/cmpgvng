export function NavTabs({ activeSection, onSectionChange }) {
  return (
    <nav className="nav-group" aria-label="Sezioni principali">
      <button
        type="button"
        className={`nav-item ${activeSection === "upload" ? "active" : ""}`}
        onClick={() => onSectionChange("upload")}
        aria-pressed={activeSection === "upload"}
      >
        <span className="icon">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" x2="12" y1="3" y2="15" />
          </svg>
        </span>
        Upload
      </button>
      <button
        type="button"
        className={`nav-item ${activeSection === "gallery" ? "active" : ""}`}
        onClick={() => onSectionChange("gallery")}
        aria-pressed={activeSection === "gallery"}
      >
        <span className="icon">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
            <circle cx="9" cy="9" r="2" />
            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
          </svg>
        </span>
        Gallery
      </button>
    </nav>
  );
}
