var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// worker.js
var GRAPH_API_BASE = "https://graph.microsoft.com/v1.0";
var TOKEN_ENDPOINT = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
var GOOGLE_DRIVE_API = "https://www.googleapis.com/drive/v3";
var CHUNK_SIZE = 5 * 1024 * 1024;
var worker_default = {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return handleCors(env);
    }
    const corsHeaders = getCorsHeaders(env);
    try {
      const url = new URL(request.url);
      if (url.pathname === "/health") {
        return new Response(
          JSON.stringify({ status: "ok", timestamp: (/* @__PURE__ */ new Date()).toISOString() }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          }
        );
      }
      if (url.pathname === "/upload" && request.method === "POST") {
        return await handleUpload(request, env, corsHeaders);
      }
      if (url.pathname === "/gallery" && request.method === "GET") {
        return await handleGallery(request, env, corsHeaders);
      }
      if (url.pathname === "/upload-from-google" && request.method === "POST") {
        return await handleGoogleDriveUpload(request, env, corsHeaders);
      }
      if (url.pathname === "/upload-from-google-photos" && request.method === "POST") {
        return await handleGooglePhotosUpload(request, env, corsHeaders);
      }
      if (url.pathname === "/photos-session" && request.method === "POST") {
        return await proxyPhotosCreateSession(request, corsHeaders);
      }
      if (url.pathname.startsWith("/photos-session/") && request.method === "GET") {
        const pathParts = url.pathname.replace("/photos-session/", "").split("/");
        const sessionId = pathParts[0];
        const action = pathParts[1];
        console.log(
          "Photos proxy route - sessionId:",
          sessionId,
          "action:",
          action
        );
        if (action === "items") {
          return await proxyPhotosGetItems(request, sessionId, corsHeaders);
        }
        return await proxyPhotosGetSession(request, sessionId, corsHeaders);
      }
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    } catch (error) {
      console.error("Worker error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  }
};
function getCorsHeaders(env) {
  return {
    "Access-Control-Allow-Origin": env.CORS_ORIGIN || "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400"
  };
}
__name(getCorsHeaders, "getCorsHeaders");
function handleCors(env) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(env)
  });
}
__name(handleCors, "handleCors");
async function handleUpload(request, env, corsHeaders) {
  const formData = await request.formData();
  const password = formData.get("password");
  if (!password || password !== env.SITE_PASSWORD) {
    return new Response(JSON.stringify({ error: "Password non valida" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
  const file = formData.get("file");
  if (!file) {
    return new Response(JSON.stringify({ error: "No file provided" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
  const maxSize = parseInt(env.MAX_FILE_SIZE_MB || "500") * 1024 * 1024;
  if (file.size > maxSize) {
    return new Response(
      JSON.stringify({
        error: `File too large. Max size: ${env.MAX_FILE_SIZE_MB}MB`
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
  const accessToken = await getAccessToken(env);
  const fileName = sanitizeFileName(file.name);
  let result;
  if (file.size < 4 * 1024 * 1024) {
    result = await uploadSmallFile(file, fileName, accessToken, env);
  } else {
    result = await uploadLargeFile(file, fileName, accessToken, env);
  }
  return new Response(
    JSON.stringify({
      success: true,
      fileName: result.name,
      size: result.size,
      webUrl: result.webUrl
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    }
  );
}
__name(handleUpload, "handleUpload");
async function getAccessToken(env) {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: env.AZURE_CLIENT_ID,
      client_secret: env.AZURE_CLIENT_SECRET,
      refresh_token: env.AZURE_REFRESH_TOKEN,
      grant_type: "refresh_token",
      scope: "https://graph.microsoft.com/Files.ReadWrite.All offline_access"
    })
  });
  if (!response.ok) {
    const error = await response.text();
    console.error("Token refresh failed:", error);
    throw new Error("Failed to refresh access token");
  }
  const data = await response.json();
  return data.access_token;
}
__name(getAccessToken, "getAccessToken");
async function uploadSmallFile(file, fileName, accessToken, env) {
  const uploadUrl = `${GRAPH_API_BASE}/drives/${env.ONEDRIVE_DRIVE_ID}/items/${env.ONEDRIVE_FOLDER_ID}:/${fileName}:/content`;
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": file.type || "application/octet-stream"
    },
    body: file
  });
  if (!response.ok) {
    const error = await response.text();
    console.error("Upload failed:", error);
    throw new Error("Failed to upload file");
  }
  return await response.json();
}
__name(uploadSmallFile, "uploadSmallFile");
async function uploadLargeFile(file, fileName, accessToken, env) {
  const sessionUrl = `${GRAPH_API_BASE}/drives/${env.ONEDRIVE_DRIVE_ID}/items/${env.ONEDRIVE_FOLDER_ID}:/${fileName}:/createUploadSession`;
  const sessionResponse = await fetch(sessionUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      item: {
        "@microsoft.graph.conflictBehavior": "rename"
      }
    })
  });
  if (!sessionResponse.ok) {
    const error = await sessionResponse.text();
    console.error("Session creation failed:", error);
    throw new Error("Failed to create upload session");
  }
  const session = await sessionResponse.json();
  const uploadUrl = session.uploadUrl;
  const fileSize = file.size;
  let uploadedBytes = 0;
  let result;
  while (uploadedBytes < fileSize) {
    const chunkStart = uploadedBytes;
    const chunkEnd = Math.min(uploadedBytes + CHUNK_SIZE, fileSize);
    const chunkBlob = file.slice(chunkStart, chunkEnd);
    const chunkArrayBuffer = await chunkBlob.arrayBuffer();
    const chunkResponse = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Length": chunkArrayBuffer.byteLength.toString(),
        "Content-Range": `bytes ${chunkStart}-${chunkEnd - 1}/${fileSize}`
      },
      body: chunkArrayBuffer
    });
    if (!chunkResponse.ok) {
      const error = await chunkResponse.text();
      console.error("Chunk upload failed:", error);
      throw new Error("Failed to upload file chunk");
    }
    result = await chunkResponse.json();
    uploadedBytes = chunkEnd;
  }
  return result;
}
__name(uploadLargeFile, "uploadLargeFile");
function sanitizeFileName(name) {
  return name.replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, " ").trim();
}
__name(sanitizeFileName, "sanitizeFileName");
async function handleGallery(request, env, corsHeaders) {
  const url = new URL(request.url);
  const password = url.searchParams.get("password");
  if (!password || password !== env.SITE_PASSWORD) {
    return new Response(JSON.stringify({ error: "Password non valida" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
  const accessToken = await getAccessToken(env);
  let allItems = [];
  let nextLink = `${GRAPH_API_BASE}/drives/${env.ONEDRIVE_DRIVE_ID}/items/${env.ONEDRIVE_FOLDER_ID}/children?$select=id,name,size,file,image,video,createdDateTime,@microsoft.graph.downloadUrl&$expand=thumbnails&$top=999`;
  console.log("Starting gallery fetch...");
  while (nextLink) {
    console.log("Fetching page:", nextLink);
    const response = await fetch(nextLink, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    if (!response.ok) {
      const error = await response.text();
      console.error("List files failed:", error);
      throw new Error("Failed to list files");
    }
    const data = await response.json();
    if (data.value) {
      allItems = allItems.concat(data.value);
    }
    nextLink = data["@odata.nextLink"];
  }
  console.log(`Fetched total ${allItems.length} items`);
  const items = allItems.filter(
    (item) => item.file && (item.file.mimeType.startsWith("image/") || item.file.mimeType.startsWith("video/"))
  ).map((item) => {
    let thumbnailUrl = null;
    if (item.thumbnails && item.thumbnails.length > 0) {
      const thumb = item.thumbnails[0];
      thumbnailUrl = thumb.large?.url || thumb.medium?.url || thumb.small?.url;
    }
    return {
      id: item.id,
      name: item.name,
      size: item.size,
      mimeType: item.file.mimeType,
      isVideo: item.file.mimeType.startsWith("video/"),
      createdDateTime: item.createdDateTime,
      thumbnailUrl,
      downloadUrl: item["@microsoft.graph.downloadUrl"],
      width: item.image?.width || item.video?.width,
      height: item.image?.height || item.video?.height
    };
  }).sort((a, b) => new Date(b.createdDateTime) - new Date(a.createdDateTime));
  return new Response(
    JSON.stringify({
      success: true,
      count: items.length,
      items
    }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    }
  );
}
__name(handleGallery, "handleGallery");
async function handleGoogleDriveUpload(request, env, corsHeaders) {
  const body = await request.json();
  const { fileId, fileName, mimeType, googleAccessToken, password } = body;
  if (password && password !== env.SITE_PASSWORD) {
    return new Response(JSON.stringify({ error: "Password non valida" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
  if (!fileId || !googleAccessToken) {
    return new Response(
      JSON.stringify({ error: "Missing fileId or googleAccessToken" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
  try {
    console.log(`Downloading file ${fileId} from Google Drive...`);
    const googleFileResponse = await fetch(
      `${GOOGLE_DRIVE_API}/files/${fileId}?alt=media`,
      {
        headers: {
          Authorization: `Bearer ${googleAccessToken}`
        }
      }
    );
    if (!googleFileResponse.ok) {
      const error = await googleFileResponse.text();
      console.error("Google Drive download failed:", error);
      throw new Error(
        `Failed to download from Google Drive: ${googleFileResponse.status}`
      );
    }
    const fileContent = await googleFileResponse.arrayBuffer();
    const fileSize = fileContent.byteLength;
    console.log(`Downloaded ${fileSize} bytes. Uploading to OneDrive...`);
    const oneDriveToken = await getAccessToken(env);
    const sanitizedName = sanitizeFileName(fileName || `file_${fileId}`);
    let result;
    if (fileSize < 4 * 1024 * 1024) {
      result = await uploadSmallFileFromBuffer(
        fileContent,
        sanitizedName,
        mimeType,
        oneDriveToken,
        env
      );
    } else {
      result = await uploadLargeFileFromBuffer(
        fileContent,
        sanitizedName,
        oneDriveToken,
        env
      );
    }
    return new Response(
      JSON.stringify({
        success: true,
        fileName: result.name,
        size: result.size,
        webUrl: result.webUrl,
        source: "google-drive"
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    console.error("Google Drive transfer error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Transfer failed" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
}
__name(handleGoogleDriveUpload, "handleGoogleDriveUpload");
async function uploadSmallFileFromBuffer(buffer, fileName, mimeType, accessToken, env) {
  const uploadUrl = `${GRAPH_API_BASE}/drives/${env.ONEDRIVE_DRIVE_ID}/items/${env.ONEDRIVE_FOLDER_ID}:/${fileName}:/content`;
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": mimeType || "application/octet-stream"
    },
    body: buffer
  });
  if (!response.ok) {
    const error = await response.text();
    console.error("Upload failed:", error);
    throw new Error("Failed to upload file to OneDrive");
  }
  return await response.json();
}
__name(uploadSmallFileFromBuffer, "uploadSmallFileFromBuffer");
async function uploadLargeFileFromBuffer(buffer, fileName, accessToken, env) {
  const sessionUrl = `${GRAPH_API_BASE}/drives/${env.ONEDRIVE_DRIVE_ID}/items/${env.ONEDRIVE_FOLDER_ID}:/${fileName}:/createUploadSession`;
  const sessionResponse = await fetch(sessionUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      item: {
        "@microsoft.graph.conflictBehavior": "rename"
      }
    })
  });
  if (!sessionResponse.ok) {
    const error = await sessionResponse.text();
    console.error("Session creation failed:", error);
    throw new Error("Failed to create upload session");
  }
  const session = await sessionResponse.json();
  const uploadUrl = session.uploadUrl;
  const fileSize = buffer.byteLength;
  let uploadedBytes = 0;
  let result;
  while (uploadedBytes < fileSize) {
    const chunkStart = uploadedBytes;
    const chunkEnd = Math.min(uploadedBytes + CHUNK_SIZE, fileSize);
    const chunk = buffer.slice(chunkStart, chunkEnd);
    const chunkResponse = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Length": chunk.byteLength.toString(),
        "Content-Range": `bytes ${chunkStart}-${chunkEnd - 1}/${fileSize}`
      },
      body: chunk
    });
    if (!chunkResponse.ok) {
      const error = await chunkResponse.text();
      console.error("Chunk upload failed:", error);
      throw new Error("Failed to upload file chunk");
    }
    result = await chunkResponse.json();
    uploadedBytes = chunkEnd;
  }
  return result;
}
__name(uploadLargeFileFromBuffer, "uploadLargeFileFromBuffer");
async function handleGooglePhotosUpload(request, env, corsHeaders) {
  const body = await request.json();
  const { mediaItemId, fileName, mimeType, baseUrl, googleAccessToken } = body;
  if (!baseUrl || !googleAccessToken) {
    return new Response(
      JSON.stringify({ error: "Missing baseUrl or googleAccessToken" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
  try {
    const downloadUrl = baseUrl.includes("?") ? `${baseUrl}&d` : `${baseUrl}=d`;
    console.log(`Downloading from Google Photos: ${mediaItemId}`);
    const photoResponse = await fetch(downloadUrl, {
      headers: {
        Authorization: `Bearer ${googleAccessToken}`
      }
    });
    if (!photoResponse.ok) {
      const error = await photoResponse.text();
      console.error("Google Photos download failed:", error);
      throw new Error(
        `Failed to download from Google Photos: ${photoResponse.status}`
      );
    }
    const fileContent = await photoResponse.arrayBuffer();
    const fileSize = fileContent.byteLength;
    console.log(`Downloaded ${fileSize} bytes. Uploading to OneDrive...`);
    const oneDriveToken = await getAccessToken(env);
    const sanitizedName = sanitizeFileName(
      fileName || `photo_${mediaItemId}.jpg`
    );
    let result;
    if (fileSize < 4 * 1024 * 1024) {
      result = await uploadSmallFileFromBuffer(
        fileContent,
        sanitizedName,
        mimeType || "image/jpeg",
        oneDriveToken,
        env
      );
    } else {
      result = await uploadLargeFileFromBuffer(
        fileContent,
        sanitizedName,
        oneDriveToken,
        env
      );
    }
    return new Response(
      JSON.stringify({
        success: true,
        fileName: result.name,
        size: result.size,
        webUrl: result.webUrl,
        source: "google-photos"
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    console.error("Google Photos transfer error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Transfer failed" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
}
__name(handleGooglePhotosUpload, "handleGooglePhotosUpload");
async function proxyPhotosCreateSession(request, corsHeaders) {
  const body = await request.json();
  const { accessToken } = body;
  if (!accessToken) {
    return new Response(JSON.stringify({ error: "Missing accessToken" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
  const response = await fetch(
    "https://photospicker.googleapis.com/v1/sessions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({})
    }
  );
  const data = await response.json();
  return new Response(JSON.stringify(data), {
    status: response.status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}
__name(proxyPhotosCreateSession, "proxyPhotosCreateSession");
async function proxyPhotosGetSession(request, sessionId, corsHeaders) {
  const url = new URL(request.url);
  const accessToken = url.searchParams.get("accessToken");
  if (!accessToken) {
    return new Response(JSON.stringify({ error: "Missing accessToken" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
  const response = await fetch(
    `https://photospicker.googleapis.com/v1/sessions/${sessionId}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  );
  const data = await response.json();
  return new Response(JSON.stringify(data), {
    status: response.status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}
__name(proxyPhotosGetSession, "proxyPhotosGetSession");
async function proxyPhotosGetItems(request, sessionId, corsHeaders) {
  const url = new URL(request.url);
  const accessToken = url.searchParams.get("accessToken");
  if (!accessToken) {
    return new Response(JSON.stringify({ error: "Missing accessToken" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
  try {
    console.log("proxyPhotosGetItems called - sessionId:", sessionId);
    const response = await fetch(
      `https://photospicker.googleapis.com/v1/sessions/${sessionId}/mediaItems`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    );
    console.log("Photos API mediaItems response status:", response.status);
    const responseText = await response.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error(
        "Failed to parse Photos API response as JSON:",
        responseText.substring(0, 200)
      );
      return new Response(
        JSON.stringify({
          error: "Invalid response from Google Photos API",
          details: responseText.substring(0, 200)
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }
    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("proxyPhotosGetItems error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Unknown error in proxy" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
}
__name(proxyPhotosGetItems, "proxyPhotosGetItems");
export {
  worker_default as default
};
//# sourceMappingURL=worker.js.map
