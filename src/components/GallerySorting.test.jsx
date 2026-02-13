import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Gallery } from "./Gallery.jsx";
import { ToastProvider } from "../contexts/ToastContext.jsx";
import { AuthProvider } from "../contexts/AuthContext.jsx";
import * as api from "../lib/api.js";

vi.mock("../lib/api.js", () => ({
  fetchGallery: vi.fn(),
  getMediaUrl: vi.fn((item) => item.url),
}));

describe("Gallery Component TDD - T15 (Sorting)", () => {
  it("should sort items by ctime descending (newest first)", async () => {
    // Mock Auth state
    sessionStorage.setItem("cmpgvng_password", "test");
    sessionStorage.setItem("cmpgvng_unlocked", "true");

    const mockItems = [
      { id: "100", name: "old.jpg", thumbnailUrl: "old.jpg", url: "old.jpg" },
      { id: "300", name: "new.jpg", thumbnailUrl: "new.jpg", url: "new.jpg" },
      { id: "200", name: "middle.jpg", thumbnailUrl: "middle.jpg", url: "middle.jpg" },
    ];

    vi.mocked(api.fetchGallery).mockResolvedValue({
      ok: true,
      json: async () => ({ items: mockItems }),
    });

    render(
      <ToastProvider>
        <AuthProvider>
          <Gallery />
        </AuthProvider>
      </ToastProvider>
    );

    // Wait for the items to render
    const captions = await screen.findAllByText(/old|new|middle/i);
    
    // We expect the newest upload (highest ID) first
    const order = captions.map(c => c.textContent.trim());
    expect(order).toEqual(["new", "middle", "old"]);
  });
});
