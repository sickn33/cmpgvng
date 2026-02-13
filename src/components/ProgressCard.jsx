import { useUpload } from "../contexts/UploadContext.jsx";

export function ProgressCard() {
  const { showProgress, progressPercent } = useUpload();

  if (!showProgress) return null;

  return (
    <div className="progress-card">
      <h3 className="text-h3 flex-center gap-2" style={{ marginBottom: "var(--space-2)" }}>
        <span className="icon spinning">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
        </span>
        Uploading...
      </h3>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${progressPercent}%` }}></div>
      </div>
      <p className="text-display" style={{ fontSize: "2rem", color: "var(--accent-primary)" }}>{Math.round(progressPercent)}%</p>
    </div>
  );
}
