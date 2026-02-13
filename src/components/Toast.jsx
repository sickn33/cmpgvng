import { useToast } from "../contexts/ToastContext.jsx";
import { escapeHtml } from "../lib/utils.js";

const icons = {
  success: "✅",
  error: "❌",
  warning: "⚠️",
  info: "ℹ️",
};

export function ToastContainer() {
  const { toasts } = useToast();

  return (
    <div className="toast-container" id="toastContainer">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          <span className="toast-icon">{icons[t.type] || icons.info}</span>
          <span className="toast-message">{escapeHtml(t.message)}</span>
        </div>
      ))}
    </div>
  );
}
