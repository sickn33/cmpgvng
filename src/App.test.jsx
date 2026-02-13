import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App.jsx";

// Simple smoke + navigation test to protect core UI flows
describe("App shell UI", () => {
  it("renders password gate first", () => {
    render(<App />);
    expect(
      screen.getByRole("heading", { name: /area riservata/i })
    ).toBeInTheDocument();
  });

  it("can switch tabs after unlocking", async () => {
    const user = userEvent.setup();
    render(<App />);

    // Sblocca l'area inserendo una password valida
    const passwordInput = screen.getByPlaceholderText(/password\.\.\./i);
    await user.type(passwordInput, "test");
    await user.click(screen.getByRole("button", { name: /entra/i }));

    // Ora le tab devono essere presenti e cliccabili
    const galleryTab = await screen.findByRole("button", { name: /galleria/i });
    await user.click(galleryTab);
    expect(galleryTab).toHaveAttribute("aria-pressed", "true");
  });
});

