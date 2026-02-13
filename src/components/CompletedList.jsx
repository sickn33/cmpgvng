import { useUpload } from "../contexts/UploadContext.jsx";
import { formatFileSize, escapeHtml } from "../lib/utils.js";

export function CompletedList() {
  const { completedItems } = useUpload();

  if (completedItems.length === 0) return null;

  return (
    <div className="file-card">
      <h3 className="text-h3 flex-center gap-2" style={{ marginBottom: "var(--space-4)" }}>
        <span className="icon" style={{ color: "var(--status-success)" }}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        </span>
        Upload Complete
      </h3>
      <div className="file-list">
        {completedItems.map((item, i) => (
          <div key={i} className="file-item" style={{ borderLeft: "2px solid var(--status-success)" }}>
            <span className="status-icon">✅</span>
            <div className="file-info">
              <span className="file-name">{escapeHtml(item.name)}</span>
            </div>
            <span className="file-meta">{formatFileSize(item.size || 0)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
