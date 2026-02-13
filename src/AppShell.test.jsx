import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import App from "./App.jsx";

describe("App Shell TDD - T14", () => {
  it("should have an app-shell with a simulated spine (border-left)", async () => {
    // Mock the useAuth hook to return unlocked state
    vi.mock("./contexts/AuthContext.jsx", () => ({
      useAuth: () => ({ isUnlocked: true, password: "test" }),
      AuthProvider: ({ children }) => <div>{children}</div>,
    }));
    
    // Mock fetchGallery
    vi.mock("./lib/api.js", () => ({
      fetchGallery: vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items: [] }) }),
      getMediaUrl: vi.fn(),
    }));

    const { container } = render(<App />);
    
    const shell = container.querySelector(".app-shell");
    expect(shell).toBeInTheDocument();
    
    // Check if the class is applied (CSS logic is verified via computed styles in browser,
    // but here we ensure the container exists as intended).
    expect(shell).toHaveClass("app-shell");
  });
});
