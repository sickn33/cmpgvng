/**
 * API layer - exact request shapes for Worker integration
 * Do NOT change request format - preserves OneDrive and Google integrations
 */

import { CONFIG } from "./config.js";

export async function uploadFile(file, password) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("password", password);

  const response = await fetch(`${CONFIG.workerUrl}/upload`, {
    method: "POST",
    body: formData,
  });
  return response;
}

export async function fetchGallery(password) {
  const response = await fetch(
    `${CONFIG.workerUrl}/gallery?password=${encodeURIComponent(password)}`
  );
  return response;
}

export async function uploadFromGoogleDrive(fileId, fileName, mimeType, googleAccessToken) {
  const response = await fetch(`${CONFIG.workerUrl}/upload-from-google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileId,
      fileName,
      mimeType,
      googleAccessToken,
    }),
  });
  return response;
}

export async function createPhotosSession(accessToken) {
  const response = await fetch(`${CONFIG.workerUrl}/photos-session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessToken }),
  });
  return response;
}

export async function getPhotosSession(sessionId, accessToken) {
  const response = await fetch(
    `${CONFIG.workerUrl}/photos-session/${sessionId}?accessToken=${encodeURIComponent(accessToken)}`
  );
  return response;
}

export async function getPhotosItems(sessionId, accessToken) {
  const response = await fetch(
    `${CONFIG.workerUrl}/photos-session/${sessionId}/items?accessToken=${encodeURIComponent(accessToken)}`
  );
  return response;
}

export async function uploadFromGooglePhotos(mediaItemId, fileName, mimeType, baseUrl, googleAccessToken) {
  const response = await fetch(`${CONFIG.workerUrl}/upload-from-google-photos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mediaItemId,
      fileName,
      mimeType,
      baseUrl,
      googleAccessToken,
    }),
  });
  return response;
}

export function getMediaUrl(item) {
  const password = sessionStorage.getItem("cmpgvng_password") || "";
  return (
    item.downloadUrl ||
    `${CONFIG.workerUrl}/media/${item.id}?password=${encodeURIComponent(password)}`
  );
}
