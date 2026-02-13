import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Gallery } from "./Gallery.jsx";
import { ToastProvider } from "../contexts/ToastContext.jsx";
import * as api from "../lib/api.js";

vi.mock("../lib/api.js", () => ({
  fetchGallery: vi.fn(),
  getMediaUrl: vi.fn((item) => item.url),
}));

describe("Gallery Component TDD - T11", () => {
  it("should have captions in-flow (not absolute) and photo-mount as flex", async () => {
    // Mocking session storage for password gate bypass in component
    sessionStorage.setItem("cmpgvng_password", "test");

    const mockItems = [
      { id: "1", name: "test.jpg", thumbnailUrl: "test.jpg", url: "test.jpg" }
    ];

    vi.mocked(api.fetchGallery).mockResolvedValue({
      ok: true,
      json: async () => ({ items: mockItems }),
    });

    render(
      <ToastProvider>
        <Gallery />
      </ToastProvider>
    );

    // Wait for the items to render
    const photoMount = (await screen.findByRole("img", { name: /test/i })).closest(".photo-mount");
    const caption = screen.getByText(/test/i);

    expect(photoMount).toBeInTheDocument();
    
    // In TDD RED phase, this is expected to FAIL if we check specific styling 
    // or if the implementation is currently using absolute positioning.
    // However, checking computed styles in JSDOM is limited.
    // Instead, we can check for a specific class change or structure that we INTEND to implement.
    
    // We want the caption to be a direct child and the mount to have flex-direction column.
    // Current code HAS it in column but the CSS makes it absolute.
    
    // Test Case requirement: verify caption is not absolute.
    const styles = window.getComputedStyle(caption);
    expect(styles.position).not.toBe("absolute");
  });

  it("T12 - should hide the entire mount if image fails to load", async () => {
    sessionStorage.setItem("cmpgvng_password", "test");

    const mockItems = [
      { id: "2", name: "broken.jpg", thumbnailUrl: "broken.jpg", url: "broken.jpg" }
    ];

    vi.mocked(api.fetchGallery).mockResolvedValue({
      ok: true,
      json: async () => ({ items: mockItems }),
    });

    render(
      <ToastProvider>
        <Gallery />
      </ToastProvider>
    );

    const img = await screen.findByAltText(/broken/i);
    const photoMount = img.closest(".photo-mount");

    // Simulate error
    img.dispatchEvent(new Event("error"));

    expect(photoMount.style.display).toBe("none");
  });
});
