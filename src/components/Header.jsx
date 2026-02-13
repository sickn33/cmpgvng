export function Header() {
  return (
    <header className="flex-col gap-2" style={{ marginBottom: "var(--space-8)", textAlign: "center" }}>
      <div className="flex-center gap-4">
        <span className="icon" style={{ color: "var(--accent-primary)", width: "48px", height: "48px" }}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
            <circle cx="12" cy="13" r="3" />
          </svg>
        </span>
        <h1 className="text-display" style={{ margin: 0 }}>The Fellowship of CMP '02</h1>
      </div>
      <p className="text-sm" style={{ color: "var(--text-secondary)", letterSpacing: "0.2em", textTransform: "uppercase" }}>
        Est. 2002 · Archive
      </p>
    </header>
  );
}
