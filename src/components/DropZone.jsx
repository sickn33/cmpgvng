import { useRef } from "react";
import { useUpload } from "../contexts/UploadContext.jsx";
import { useToast } from "../contexts/ToastContext.jsx";
import { useGooglePicker } from "../hooks/useGooglePicker.js";

export function DropZone() {
  const fileInputRef = useRef(null);
  const { addFilesToQueue } = useUpload();
  const { showToast } = useToast();
  const { openGoogleDrivePicker, openGooglePhotosPicker } = useGooglePicker();

  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  function handleDrop(e) {
    preventDefaults(e);
    const files = e.dataTransfer?.files;
    if (files?.length) addFilesToQueue(Array.from(files));
  }

  function handleFileSelect(e) {
    const files = e.target.files;
    if (files?.length) addFilesToQueue(Array.from(files));
    e.target.value = "";
  }

  function handleDropZoneClick(e) {
    if (
      !e.target.closest(".file-input-label") &&
      !e.target.closest(".btn-secondary")
    ) {
      fileInputRef.current?.click();
    }
  }

  function handleDriveClick(e) {
    e.stopPropagation();
    openGoogleDrivePicker();
  }

  function handlePhotosClick(e) {
    e.stopPropagation();
    openGooglePhotosPicker();
  }

  return (
    <div
      className="upload-zone"
      id="dropZone"
      data-testid="drop-zone"
      onClick={handleDropZoneClick}
      onDragEnter={(e) => {
        preventDefaults(e);
        e.currentTarget.classList.add("drag-active");
      }}
      onDragOver={preventDefaults}
      onDragLeave={(e) => {
        preventDefaults(e);
        e.currentTarget.classList.remove("drag-active");
      }}
      onDrop={handleDrop}
    >
      <div className="flex-col flex-center gap-4">
        <span className="icon" style={{ width: "64px", height: "64px", color: "var(--accent-primary)", opacity: 0.8 }}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
          </svg>
        </span>
        <h3 className="text-h2">Drag & Drop Files</h3>
        <p className="text-body" style={{ color: "var(--text-secondary)" }}>or use the options below</p>
        
        <div className="flex-center gap-2" style={{ marginTop: "var(--space-4)" }}>
          <label className="btn btn-primary file-input-label">
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
                <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
            </span>
            Select Files
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,video/*"
              hidden
              onChange={handleFileSelect}
            />
          </label>
          <button className="btn btn-secondary google-drive-btn" onClick={handleDriveClick} title="Import from Google Drive">
            <span className="icon">
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path fill="currentColor" d="M7.71 3.5L1.15 15l3.43 5.95 6.56-11.45L7.71 3.5zm8.58 0H7.71l6.56 11.5h8.58L16.29 3.5zM12 12.5L5.44 24h13.12L12 12.5z" />
              </svg>
            </span>
            Drive
          </button>
          <button className="btn btn-secondary google-photos-btn" onClick={handlePhotosClick} title="Import from Google Photos">
            <span className="icon">
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
              </svg>
            </span>
            Photos
          </button>
        </div>
        <p className="text-xs" style={{ color: "var(--text-muted)", marginTop: "var(--space-2)" }}>Images & Videos up to 500MB</p>
      </div>
    </div>
  );
}
