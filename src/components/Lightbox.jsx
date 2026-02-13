import { useEffect } from "react";
import { createPortal } from "react-dom";
import { getMediaUrl } from "../lib/api.js";

export function Lightbox({ items, index, onClose, onNavigate }) {
  const item = items[index];
  if (!item) return null;

  const mediaUrl = getMediaUrl(item);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onNavigate(-1);
      if (e.key === "ArrowRight") onNavigate(1);
    };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [onClose, onNavigate]);

  function handleBackdropClick(e) {
    if (e.target.id === "lightbox") onClose();
  }

  const content = (
    <div
      id="lightbox"
      className="lightbox"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label="Lightbox"
    >
      <button className="lightbox-close" onClick={onClose} aria-label="Close">
        &times;
      </button>
      <button
        className="lightbox-nav lightbox-prev"
        onClick={() => onNavigate(-1)}
        aria-label="Previous"
      >
        &#10094;
      </button>
      <div className="lightbox-content">
        {item.isVideo ? (
          <video src={mediaUrl} controls playsInline style={{ maxWidth: "100%", maxHeight: "85vh" }} />
        ) : (
          <img src={mediaUrl} alt={item.name} id="lightboxImage" />
        )}
      </div>
      <button
        className="lightbox-nav lightbox-next"
        onClick={() => onNavigate(1)}
        aria-label="Next"
      >
        &#10095;
      </button>
      <div className="lightbox-info">
        <h3 className="text-h3" style={{ marginBottom: "var(--space-2)" }}>{item.name}</h3>
        <span className="text-sm" style={{ opacity: 0.8 }}>
          {index + 1} / {items.length}
        </span>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
