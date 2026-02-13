import { useState, useEffect } from "react";
import { useToast } from "../contexts/ToastContext.jsx";
import { fetchGallery } from "../lib/api.js";
import { escapeHtml } from "../lib/utils.js";
import { Lightbox } from "./Lightbox.jsx";

export function Gallery() {
  const { showToast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lightboxIndex, setLightboxIndex] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const password = sessionStorage.getItem("cmpgvng_password");
      if (!password) {
        showToast("Sessione scaduta, ricarica la pagina", "error");
        setLoading(false);
        return;
      }
      try {
        const res = await fetchGallery(password);
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Errore nel caricamento della galleria");
        }
        const data = await res.json();
        if (!cancelled) {
          const sortedItems = (data.items || []).sort((a, b) => {
            // Sort by ID descending (Upload order - newest first)
            return (b.id || "").localeCompare(a.id || "", undefined, { numeric: true, sensitivity: 'base' });
          });
          setItems(sortedItems);
        }
      } catch (err) {
        console.error("Gallery error:", err);
        if (!cancelled) showToast(err.message, "error");
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [showToast]);

  if (loading) {
    return (
      <div className="flex-center" style={{ minHeight: "300px", flexDirection: "column", gap: "var(--space-4)" }}>
        <div style={{ width: "40px", height: "40px", border: "2px solid var(--text-muted)", borderTopColor: "var(--accent-primary)", borderRadius: "50%", animation: "spin 1s linear infinite" }}></div>
        <p className="text-body" style={{ color: "var(--text-secondary)" }}>Loading archive...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex-center" style={{ minHeight: "300px", flexDirection: "column", gap: "var(--space-4)", textAlign: "center" }}>
        <span className="icon" style={{ width: "64px", height: "64px", color: "var(--text-muted)" }}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect width="20" height="16" x="2" y="4" rx="2" />
            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
          </svg>
        </span>
        <h3 className="text-h2">No moments yet</h3>
        <p className="text-body" style={{ color: "var(--text-secondary)" }}>Upload the first memory to start the archive.</p>
      </div>
    );
  }

  return (
    <section className="gallery-section">
      <div className="gallery-masonry">
        {items
          .filter(item => item.thumbnailUrl) // T12: Only show items with thumbnails
          .map((item, index) => (
          <div
            key={item.id}
            className="photo-mount"
            onClick={() => setLightboxIndex(index)}
          >
            <div className="photo-content">
              <span className="corner-decor corner-tl"></span>
              <span className="corner-decor corner-tr"></span>
              <span className="corner-decor corner-bl"></span>
              <span className="corner-decor corner-br"></span>
              
              {item.isVideo && (
                 <div style={{ position: "absolute", top: "8px", right: "8px", background: "rgba(0,0,0,0.6)", color: "white", padding: "2px 6px", borderRadius: "4px", fontSize: "0.75rem", zIndex: 2 }}>Video</div>
              )}
              <img
                src={item.thumbnailUrl}
                alt={escapeHtml(item.name)}
                loading="lazy"
                onError={(e) => {
                  // T12: If thumbnail fails, hide the entire mount
                  e.target.closest('.photo-mount').style.display = 'none';
                }}
              />
            </div>
            {/* T11: Caption is now in-flow (relative) in index.css */}
            <div className="photo-caption">
              {escapeHtml(item.name || "Untitled Memory").split('.')[0]}
            </div>
          </div>
        ))}
      </div>
      {lightboxIndex !== null && (
        <Lightbox
          items={items}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={(dir) => {
            let next = lightboxIndex + dir;
            if (next < 0) next = items.length - 1;
            else if (next >= items.length) next = 0;
            setLightboxIndex(next);
          }}
        />
      )}
    </section>
  );
}
