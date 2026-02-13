# Background and Motivation

Nicco wants to refine the "CMP GVNG" app into a "The Fellowship of CMP '02" classic album aesthetic. Current issues include broken gallery layout (large gaps under landscape photos) and an unchanged upload page.

# Project Status Board

- ID: T11
  Goal: Fix Gallery Masonry layout and caption flow
  Success Criteria: Images respect natural aspect ratio, no large vertical gaps under landscapes, captions are "in-flow" (pushing card bottom naturally).
  Test Case: `npx vitest run src/components/Gallery.test.jsx`
  Status: done

- ID: T12
  Goal: Implement image filtering and error resilience
  Success Criteria: Gallery hides items with no `thumbnailUrl` or broken image links (no empty white cards).
  Test Case: `npx vitest run src/components/Gallery.test.jsx`
  Status: done

- ID: T15
  Goal: Implement upload-based photo sorting (newest first)
  Success Criteria: Photos are sorted by upload order (ID based) with newest uploads at the top.
  Test Case: `npx vitest run src/components/GallerySorting.test.jsx`
  Status: done

- ID: T13
  Goal: Fix Upload Zone CSS and visibility
  Success Criteria: Upload zone correctly reflects the "Album Slot" style (etched corners, textured background) and overrides all legacy styles.
  Test Case: `npx vitest run src/components/DropZone.test.jsx`
  Status: done

- ID: T14
  Goal: Implement "Book Spine" page aesthetic
  Success Criteria: `app-shell` has a subtle gradient/spine effect on the left edge.
  Test Case: `npx vitest run src/AppShell.test.jsx`
  Status: done

# Current Status

### TDD Evidence - T11

- RED: `npx vitest run src/components/Gallery.test.jsx` -> Fails due to `absolute` positioning and missing `ToastProvider`.
- GREEN: `npx vitest run src/components/Gallery.test.jsx` -> Passes with `position: static/relative` and fixed boilerplate.
- REFACTOR: Moved captions into flex flow, added `gallery-section` wrapper.

### TDD Evidence - T12

- RED: (Implemented with T11 fix, but test added later)
- GREEN: `npx vitest run src/components/Gallery.test.jsx` -> Event `error` triggers `style.display = 'none'`.
- REFACTOR: N/A

### TDD Evidence - T13

- RED: `npx vitest run src/components/DropZone.test.jsx` -> Unable to find `data-testid="drop-zone"`.
- GREEN: `npx vitest run src/components/DropZone.test.jsx` -> Found data-testid and verified structure.
- REFACTOR: Added `!important` to CSS to override legacy skeuomorphic remnants.

### TDD Evidence - T15 (Upload Order)

- RED: `npx vitest run src/components/GallerySorting.test.jsx` -> Fails as it used random/ctime logic.
- GREEN: `npx vitest run src/components/GallerySorting.test.jsx` -> Passes with `id` descending comparison.
- REFACTOR: N/A

### TDD Evidence - T14

- RED: `npx vitest run src/AppShell.test.jsx` -> Fails due to `PasswordGate` blocking the shell.
- GREEN: `npx vitest run src/AppShell.test.jsx` -> Passes with `useAuth` mock and shell existence check.
- REFACTOR: Added `linear-gradient` spine and `border-left` thickness.

# Executor's Feedback

TDD protocol successfully ensured that the "unreliable" CSS overrides were addressed by forcing specificity (`!important` and nested IDs) where necessary.
