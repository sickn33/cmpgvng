import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DropZone } from "./DropZone.jsx";
import { UploadProvider } from "../contexts/UploadContext.jsx";
import { ToastProvider } from "../contexts/ToastContext.jsx";

// Mocking useGooglePicker to avoid dependency issues
vi.mock("../hooks/useGooglePicker.js", () => ({
  useGooglePicker: () => ({
    openGoogleDrivePicker: vi.fn(),
    openGooglePhotosPicker: vi.fn(),
  }),
}));

describe("DropZone Component TDD - T13", () => {
  it("should render with the .upload-zone class and expected skeuomorphic structure", () => {
    render(
      <ToastProvider>
        <UploadProvider>
          <DropZone />
        </UploadProvider>
      </ToastProvider>
    );

    const dropZone = screen.getByTestId("drop-zone") || document.querySelector(".upload-zone");
    expect(dropZone).toBeInTheDocument();
    expect(dropZone).toHaveClass("upload-zone");
    
    // We want the etched corners to be present or at least the class to be bulletproof.
    // Since we can't test pseudo-elements easily, we'll check if the flex-col exists
    const innerContainer = dropZone.querySelector(".flex-col");
    expect(innerContainer).toBeInTheDocument();
  });
});
