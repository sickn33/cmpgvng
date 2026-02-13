# UI/UX Improvements Walkthrough

## Latest Update: Warm Editorial Shell + Accessibility 📜

Applicata palette "Parchment & Linen" per un look classico, caldo e tattile (Light Mode), ora strutturata come design system (colori, tipografia, spaziatura, motion).

### Palette "Manoscritto"

| Elemento    | Colore          | Hex                      | Feeling          |
| ----------- | --------------- | ------------------------ | ---------------- |
| **Sfondo**  | Linen/Cream     | `#F4F1EA`                | Carta antica     |
| **Testo**   | Dark Coffee     | `#2D2420`                | Inchiostro scuro |
| **Accento** | Sienna          | `#A0522D`                | Ceralacca/Cuoio  |
| **Glass**   | White Parchment | `rgba(255,255,255, 0.5)` | Velina bianca    |

render_diffs(file:///Users/nicco/Antigravity%20Projects/cmpgvng/css/style.css)

### Dettagli Tecnici

- **Light Mode Transition**: Inversione completa del tema (da dark a light).
- **Noise Texture**: Adattata per essere visibile su sfondo chiaro (`mix-blend-mode: multiply`).
- **Typography**: `Cormorant Garamond` risalta come vero testo stampato su carta.
- **Shell semantico**: `App` ora usa `header` + `nav` + `main` + `footer`, con sezioni `Carica` e `Galleria` in `<section>` con intestazioni `.visually-hidden` per screen reader.
- **Accessibilità**: focus-ring coerente, tab con `aria-pressed`, lightbox dichiarato come `role="dialog"` e navigabile da tastiera (ESC, frecce).

Il risultato è un'interfaccia che sembra un documento storico o un diario di bordo elegante, ma più accessibile e coerente sul piano strutturale.

---

_Created with Frontend-Design Skill_
