import { useUpload } from "../contexts/UploadContext.jsx";
import { formatFileSize, getFilePreviewUrl, getFileIcon } from "../lib/utils.js";
import { escapeHtml } from "../lib/utils.js";

export function FileQueue() {
  const { fileQueue, activeFiles, removeFromQueue, uploadAll, uploadInProgress } = useUpload();

  if (activeFiles.length === 0) return null;

  return (
    <div className="file-card">
      <div className="flex-center" style={{ justifyContent: "space-between", marginBottom: "var(--space-4)" }}>
        <h3 className="text-h3 flex-center gap-2">
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
              <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
              <path d="M12 11h4" />
              <path d="M12 16h4" />
              <path d="M8 11h.01" />
              <path d="M8 16h.01" />
            </svg>
          </span>
          Queue
        </h3>
        <button className="btn btn-primary" onClick={uploadAll} disabled={uploadInProgress}>
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
          Upload All
        </button>
      </div>
      <div className="file-list">
        {activeFiles.map((item, idx) => {
          const realIndex = fileQueue.indexOf(item);
          const previewUrl = item.file ? getFilePreviewUrl(item.file) : null;
          const statusIcon =
            item.status === "pending"
              ? "⏳"
              : item.status === "uploading"
              ? "⬆️"
              : item.status === "success"
              ? "✅"
              : "❌";
          return (
            <div key={item.id || `file-${realIndex}-${item.name}`} className="file-item" data-index={realIndex}>
              {previewUrl ? (
                <img src={previewUrl} className="file-preview" alt={item.name} />
              ) : (
                <div className="file-preview flex-center" style={{ background: "var(--surface-dim)", color: "var(--text-muted)" }}>
                  {getFileIcon(item.type)}
                </div>
              )}
              <div className="file-info">
                <div className="file-name">{escapeHtml(item.name)}</div>
                <div className="file-meta">
                  {formatFileSize(item.size || 0)}
                  {item.status === "uploading" && ` • ${item.progress || 0}%`}
                </div>
              </div>
              <div className="flex-center gap-2">
                <span className="status-icon" style={{ fontSize: "1.2em" }}>{statusIcon}</span>
                {item.status === "pending" && (
                  <button
                    style={{ background: "none", border: "none", cursor: "pointer", opacity: 0.6 }}
                    onClick={() => removeFromQueue(realIndex)}
                    title="Remove"
                  >
                    ❌
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
