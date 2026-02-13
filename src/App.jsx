import { useState } from "react";
import { AuthProvider, useAuth } from "./contexts/AuthContext.jsx";
import { ToastProvider } from "./contexts/ToastContext.jsx";
import { UploadProvider } from "./contexts/UploadContext.jsx";
import { PasswordGate } from "./components/PasswordGate.jsx";
import { Header } from "./components/Header.jsx";
import { NavTabs } from "./components/NavTabs.jsx";
import { DropZone } from "./components/DropZone.jsx";
import { FileQueue } from "./components/FileQueue.jsx";
import { ProgressCard } from "./components/ProgressCard.jsx";
import { CompletedList } from "./components/CompletedList.jsx";
import { Gallery } from "./components/Gallery.jsx";
import { ToastContainer } from "./components/Toast.jsx";

function UploadView() {
  return (
    <section
      className="upload-section"
      aria-labelledby="upload-heading"
    >
      <h2 id="upload-heading" className="visually-hidden">
        Carica foto e video
      </h2>
      <DropZone />
      <FileQueue />
      <ProgressCard />
      <CompletedList />
    </section>
  );
}

function GalleryView() {
  return (
    <section
      className="gallery-root-section"
      aria-labelledby="gallery-heading"
    >
      <h2 id="gallery-heading" className="visually-hidden">
        Galleria dei momenti caricati
      </h2>
      <Gallery />
    </section>
  );
}

function AppShell() {
  const [section, setSection] = useState("upload");

  return (
    <div className="app-root">
      <div className="container">
        <div className="app-shell" style={{ padding: "var(--space-8)" }}>
          <Header />
          <NavTabs activeSection={section} onSectionChange={setSection} />
          <main role="main" style={{ marginTop: "var(--space-8)" }}>
            {section === "upload" && <UploadView />}
            {section === "gallery" && <GalleryView />}
          </main>
          
          <footer style={{ marginTop: "var(--space-16)", textAlign: "center", color: "var(--text-muted)" }}>
            <p className="text-sm flex-center gap-2">
              Created with
              <span className="icon" style={{ color: "var(--status-error)", width: "16px" }}>
                <svg viewBox="0 0 24 24" fill="currentColor" stroke="none">
                  <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                </svg>
              </span>
              for the memories
            </p>
          </footer>
        </div>
      </div>
      <ToastContainer />
    </div>
  );
}

function AppContent() {
  const { isUnlocked } = useAuth();
  if (!isUnlocked) return <PasswordGate />;
  return <AppShell />;
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <UploadProvider>
          <AppContent />
        </UploadProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
