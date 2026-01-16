/**
 * CMP GVNG - Cloudflare Worker
 * Handles file uploads to OneDrive without requiring user authentication
 */

// Constants
const GRAPH_API_BASE = "https://graph.microsoft.com/v1.0";
const TOKEN_ENDPOINT =
  "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const GOOGLE_DRIVE_API = "https://www.googleapis.com/drive/v3";
const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks for large files

/**
 * Main request handler
 */
export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return handleCors(env);
    }

    // Add CORS headers to all responses
    const corsHeaders = getCorsHeaders(env);

    try {
      const url = new URL(request.url);

      // Health check endpoint
      if (url.pathname === "/health") {
        return new Response(
          JSON.stringify({ status: "ok", timestamp: new Date().toISOString() }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Upload endpoint
      if (url.pathname === "/upload" && request.method === "POST") {
        return await handleUpload(request, env, corsHeaders);
      }

      // Gallery endpoint - list files with thumbnails
      if (url.pathname === "/gallery" && request.method === "GET") {
        return await handleGallery(request, env, corsHeaders);
      }

      // Google Drive to OneDrive transfer endpoint
      if (url.pathname === "/upload-from-google" && request.method === "POST") {
        return await handleGoogleDriveUpload(request, env, corsHeaders);
      }

      // Google Photos to OneDrive transfer endpoint
      if (
        url.pathname === "/upload-from-google-photos" &&
        request.method === "POST"
      ) {
        return await handleGooglePhotosUpload(request, env, corsHeaders);
      }

      // Photos Picker API Proxy - Create Session
      if (url.pathname === "/photos-session" && request.method === "POST") {
        return await proxyPhotosCreateSession(request, corsHeaders);
      }

      // Photos Picker API Proxy - Get Session Status or Items
      if (
        url.pathname.startsWith("/photos-session/") &&
        request.method === "GET"
      ) {
        // Parse: /photos-session/{sessionId} or /photos-session/{sessionId}/items
        const pathParts = url.pathname
          .replace("/photos-session/", "")
          .split("/");
        const sessionId = pathParts[0];
        const action = pathParts[1]; // undefined or "items"

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

      // Media proxy endpoint - stream video/image from OneDrive
      if (url.pathname.startsWith("/media/") && request.method === "GET") {
        const itemId = url.pathname.replace("/media/", "");
        return await handleMediaProxy(request, env, itemId, corsHeaders);
      }

      // 404 for unknown routes
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Worker error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  },
};

/**
 * Get CORS headers
 */
function getCorsHeaders(env) {
  return {
    "Access-Control-Allow-Origin": env.CORS_ORIGIN || "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

/**
 * Handle CORS preflight requests
 */
function handleCors(env) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(env),
  });
}

/**
 * Handle file upload
 */
async function handleUpload(request, env, corsHeaders) {
  // Parse multipart form data
  const formData = await request.formData();

  // Verify password first
  const password = formData.get("password");
  if (!password || password !== env.SITE_PASSWORD) {
    return new Response(JSON.stringify({ error: "Password non valida" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const file = formData.get("file");

  if (!file) {
    return new Response(JSON.stringify({ error: "No file provided" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Validate file size
  const maxSize = parseInt(env.MAX_FILE_SIZE_MB || "500") * 1024 * 1024;
  if (file.size > maxSize) {
    return new Response(
      JSON.stringify({
        error: `File too large. Max size: ${env.MAX_FILE_SIZE_MB}MB`,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // Get fresh access token
  const accessToken = await getAccessToken(env);

  // Sanitize filename
  const fileName = sanitizeFileName(file.name);

  // Upload to OneDrive
  let result;
  if (file.size < 4 * 1024 * 1024) {
    // Small file - direct upload
    result = await uploadSmallFile(file, fileName, accessToken, env);
  } else {
    // Large file - chunked upload
    result = await uploadLargeFile(file, fileName, accessToken, env);
  }

  return new Response(
    JSON.stringify({
      success: true,
      fileName: result.name,
      size: result.size,
      webUrl: result.webUrl,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

/**
 * Get access token using refresh token
 */
async function getAccessToken(env) {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: env.AZURE_CLIENT_ID,
      client_secret: env.AZURE_CLIENT_SECRET,
      refresh_token: env.AZURE_REFRESH_TOKEN,
      grant_type: "refresh_token",
      scope: "https://graph.microsoft.com/Files.ReadWrite.All offline_access",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Token refresh failed:", error);
    throw new Error("Failed to refresh access token");
  }

  const data = await response.json();
  return data.access_token;
}

/**
 * Upload small file (< 4MB) directly
 */
async function uploadSmallFile(file, fileName, accessToken, env) {
  const uploadUrl = `${GRAPH_API_BASE}/drives/${env.ONEDRIVE_DRIVE_ID}/items/${env.ONEDRIVE_FOLDER_ID}:/${fileName}:/content`;

  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": file.type || "application/octet-stream",
    },
    body: file,
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Upload failed:", error);
    throw new Error("Failed to upload file");
  }

  return await response.json();
}

/**
 * Upload large file using upload session (chunked)
 */
async function uploadLargeFile(file, fileName, accessToken, env) {
  // Create upload session
  const sessionUrl = `${GRAPH_API_BASE}/drives/${env.ONEDRIVE_DRIVE_ID}/items/${env.ONEDRIVE_FOLDER_ID}:/${fileName}:/createUploadSession`;

  const sessionResponse = await fetch(sessionUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      item: {
        "@microsoft.graph.conflictBehavior": "rename",
      },
    }),
  });

  if (!sessionResponse.ok) {
    const error = await sessionResponse.text();
    console.error("Session creation failed:", error);
    throw new Error("Failed to create upload session");
  }

  const session = await sessionResponse.json();
  const uploadUrl = session.uploadUrl;

  // Upload in chunks
  // Optimization: Do NOT load entire file into memory. Slice blobs instead.
  const fileSize = file.size;
  let uploadedBytes = 0;
  let result;

  while (uploadedBytes < fileSize) {
    const chunkStart = uploadedBytes;
    const chunkEnd = Math.min(uploadedBytes + CHUNK_SIZE, fileSize);

    // Slice only the needed chunk from the file blob
    const chunkBlob = file.slice(chunkStart, chunkEnd);
    const chunkArrayBuffer = await chunkBlob.arrayBuffer();

    const chunkResponse = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Length": chunkArrayBuffer.byteLength.toString(),
        "Content-Range": `bytes ${chunkStart}-${chunkEnd - 1}/${fileSize}`,
      },
      body: chunkArrayBuffer,
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

/**
 * Sanitize filename for OneDrive
 */
function sanitizeFileName(name) {
  return name
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Handle gallery request - list files with thumbnails
 */
async function handleGallery(request, env, corsHeaders) {
  // Get password from query string
  const url = new URL(request.url);
  const password = url.searchParams.get("password");

  if (!password || password !== env.SITE_PASSWORD) {
    return new Response(JSON.stringify({ error: "Password non valida" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Get fresh access token
  const accessToken = await getAccessToken(env);

  // List files in the folder
  // List files in the folder (fetch all pages)
  let allItems = [];
  let nextLink = `${GRAPH_API_BASE}/drives/${env.ONEDRIVE_DRIVE_ID}/items/${env.ONEDRIVE_FOLDER_ID}/children?$select=id,name,size,file,image,video,createdDateTime,@microsoft.graph.downloadUrl&$expand=thumbnails&$top=999`;

  console.log("Starting gallery fetch...");

  while (nextLink) {
    console.log("Fetching page:", nextLink);
    const response = await fetch(nextLink, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
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

  // Transform the response to just what we need
  const items = allItems
    .filter(
      (item) =>
        item.file &&
        (item.file.mimeType.startsWith("image/") ||
          item.file.mimeType.startsWith("video/"))
    )
    .map((item) => {
      // Get thumbnail URL (prefer large, fallback to medium, then small)
      let thumbnailUrl = null;
      if (item.thumbnails && item.thumbnails.length > 0) {
        const thumb = item.thumbnails[0];
        thumbnailUrl =
          thumb.large?.url || thumb.medium?.url || thumb.small?.url;
      }

      // Debug: log video items to see what OneDrive returns
      if (item.file.mimeType.startsWith("video/")) {
        console.log(
          "Video item raw data:",
          JSON.stringify({
            name: item.name,
            mimeType: item.file.mimeType,
            downloadUrl: item["@microsoft.graph.downloadUrl"]?.substring(0, 50),
            hasDownloadUrl: !!item["@microsoft.graph.downloadUrl"],
            keys: Object.keys(item),
          })
        );
      }

      return {
        id: item.id,
        name: item.name,
        size: item.size,
        mimeType: item.file.mimeType,
        isVideo: item.file.mimeType.startsWith("video/"),
        createdDateTime: item.createdDateTime,
        thumbnailUrl: thumbnailUrl,
        downloadUrl: item["@microsoft.graph.downloadUrl"],
        width: item.image?.width || item.video?.width,
        height: item.image?.height || item.video?.height,
      };
    })
    .sort((a, b) => new Date(b.createdDateTime) - new Date(a.createdDateTime)); // Newest first

  return new Response(
    JSON.stringify({
      success: true,
      count: items.length,
      items: items,
    }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

/**
 * Handle Google Drive to OneDrive transfer
 */
async function handleGoogleDriveUpload(request, env, corsHeaders) {
  const body = await request.json();
  const { fileId, fileName, mimeType, googleAccessToken, password } = body;

  // Verify password (can be passed in body or use session)
  if (password && password !== env.SITE_PASSWORD) {
    return new Response(JSON.stringify({ error: "Password non valida" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!fileId || !googleAccessToken) {
    return new Response(
      JSON.stringify({ error: "Missing fileId or googleAccessToken" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  try {
    // Step 1: Download file from Google Drive
    console.log(`Downloading file ${fileId} from Google Drive...`);

    const googleFileResponse = await fetch(
      `${GOOGLE_DRIVE_API}/files/${fileId}?alt=media`,
      {
        headers: {
          Authorization: `Bearer ${googleAccessToken}`,
        },
      }
    );

    if (!googleFileResponse.ok) {
      const error = await googleFileResponse.text();
      console.error("Google Drive download failed:", error);
      throw new Error(
        `Failed to download from Google Drive: ${googleFileResponse.status}`
      );
    }

    // Step 2: Get file content
    const fileContent = await googleFileResponse.arrayBuffer();
    const fileSize = fileContent.byteLength;

    console.log(`Downloaded ${fileSize} bytes. Uploading to OneDrive...`);

    // Step 3: Get OneDrive access token
    const oneDriveToken = await getAccessToken(env);

    // Step 4: Sanitize filename
    const sanitizedName = sanitizeFileName(fileName || `file_${fileId}`);

    // Step 5: Upload to OneDrive
    let result;
    if (fileSize < 4 * 1024 * 1024) {
      // Small file - direct upload
      result = await uploadSmallFileFromBuffer(
        fileContent,
        sanitizedName,
        mimeType,
        oneDriveToken,
        env
      );
    } else {
      // Large file - chunked upload
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
        source: "google-drive",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Google Drive transfer error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Transfer failed" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
}

/**
 * Upload small file from ArrayBuffer (<4MB)
 */
async function uploadSmallFileFromBuffer(
  buffer,
  fileName,
  mimeType,
  accessToken,
  env
) {
  const uploadUrl = `${GRAPH_API_BASE}/drives/${env.ONEDRIVE_DRIVE_ID}/items/${env.ONEDRIVE_FOLDER_ID}:/${fileName}:/content`;

  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": mimeType || "application/octet-stream",
    },
    body: buffer,
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Upload failed:", error);
    throw new Error("Failed to upload file to OneDrive");
  }

  return await response.json();
}

/**
 * Upload large file from ArrayBuffer using chunked upload
 */
async function uploadLargeFileFromBuffer(buffer, fileName, accessToken, env) {
  // Create upload session
  const sessionUrl = `${GRAPH_API_BASE}/drives/${env.ONEDRIVE_DRIVE_ID}/items/${env.ONEDRIVE_FOLDER_ID}:/${fileName}:/createUploadSession`;

  const sessionResponse = await fetch(sessionUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      item: {
        "@microsoft.graph.conflictBehavior": "rename",
      },
    }),
  });

  if (!sessionResponse.ok) {
    const error = await sessionResponse.text();
    console.error("Session creation failed:", error);
    throw new Error("Failed to create upload session");
  }

  const session = await sessionResponse.json();
  const uploadUrl = session.uploadUrl;

  // Upload in chunks
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
        "Content-Range": `bytes ${chunkStart}-${chunkEnd - 1}/${fileSize}`,
      },
      body: chunk,
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

/**
 * Handle Google Photos to OneDrive transfer
 */
async function handleGooglePhotosUpload(request, env, corsHeaders) {
  const body = await request.json();
  const { mediaItemId, fileName, mimeType, baseUrl, googleAccessToken } = body;

  if (!baseUrl || !googleAccessToken) {
    return new Response(
      JSON.stringify({ error: "Missing baseUrl or googleAccessToken" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  try {
    // Step 1: Download photo from Google Photos
    // For photos, append =d to get full resolution download
    const downloadUrl = baseUrl.includes("?") ? `${baseUrl}&d` : `${baseUrl}=d`;

    console.log(`Downloading from Google Photos: ${mediaItemId}`);

    const photoResponse = await fetch(downloadUrl, {
      headers: {
        Authorization: `Bearer ${googleAccessToken}`,
      },
    });

    if (!photoResponse.ok) {
      const error = await photoResponse.text();
      console.error("Google Photos download failed:", error);
      throw new Error(
        `Failed to download from Google Photos: ${photoResponse.status}`
      );
    }

    // Step 2: Get file content
    const fileContent = await photoResponse.arrayBuffer();
    const fileSize = fileContent.byteLength;

    console.log(`Downloaded ${fileSize} bytes. Uploading to OneDrive...`);

    // Step 3: Get OneDrive access token
    const oneDriveToken = await getAccessToken(env);

    // Step 4: Sanitize filename
    const sanitizedName = sanitizeFileName(
      fileName || `photo_${mediaItemId}.jpg`
    );

    // Step 5: Upload to OneDrive
    let result;
    console.log(
      `Uploading to OneDrive: ${sanitizedName}, size: ${fileSize} bytes`
    );

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

    console.log(
      "OneDrive upload result:",
      JSON.stringify(result).substring(0, 300)
    );

    return new Response(
      JSON.stringify({
        success: true,
        fileName: result.name,
        size: result.size,
        webUrl: result.webUrl,
        source: "google-photos",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Google Photos transfer error:", error.message, error.stack);
    return new Response(
      JSON.stringify({ error: error.message || "Transfer failed" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
}

/**
 * Proxy: Create Photos Picker session
 */
async function proxyPhotosCreateSession(request, corsHeaders) {
  const body = await request.json();
  const { accessToken } = body;

  if (!accessToken) {
    return new Response(JSON.stringify({ error: "Missing accessToken" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const response = await fetch(
    "https://photospicker.googleapis.com/v1/sessions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    }
  );

  const data = await response.json();
  return new Response(JSON.stringify(data), {
    status: response.status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Proxy: Get Photos Picker session status
 */
async function proxyPhotosGetSession(request, sessionId, corsHeaders) {
  const url = new URL(request.url);
  const accessToken = url.searchParams.get("accessToken");

  if (!accessToken) {
    return new Response(JSON.stringify({ error: "Missing accessToken" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const response = await fetch(
    `https://photospicker.googleapis.com/v1/sessions/${sessionId}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  const data = await response.json();
  return new Response(JSON.stringify(data), {
    status: response.status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Proxy: Get Photos Picker selected items
 */
async function proxyPhotosGetItems(request, sessionId, corsHeaders) {
  const url = new URL(request.url);
  const accessToken = url.searchParams.get("accessToken");

  if (!accessToken) {
    return new Response(JSON.stringify({ error: "Missing accessToken" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    console.log("proxyPhotosGetItems called - sessionId:", sessionId);

    // CORRECTED: sessionId is a query parameter, not part of the path
    const response = await fetch(
      `https://photospicker.googleapis.com/v1/mediaItems?sessionId=${sessionId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    console.log("Photos API mediaItems response status:", response.status);
    console.log(
      "Photos API response headers:",
      JSON.stringify(Object.fromEntries(response.headers.entries()))
    );

    // Get response as text first to handle non-JSON responses
    const responseText = await response.text();
    console.log("Photos API raw response:", responseText.substring(0, 500));

    // Try to parse as JSON
    let data;
    try {
      data = JSON.parse(responseText);
      console.log(
        "Photos API parsed data:",
        JSON.stringify(data).substring(0, 500)
      );
    } catch (parseError) {
      console.error(
        "Failed to parse Photos API response as JSON:",
        responseText.substring(0, 500)
      );
      return new Response(
        JSON.stringify({
          error: "Invalid response from Google Photos API",
          details: responseText.substring(0, 500),
          status: response.status,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // If there's an error in the response, log it
    if (data.error) {
      console.error(
        "Google Photos API returned error:",
        JSON.stringify(data.error)
      );
    }

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("proxyPhotosGetItems error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Unknown error in proxy" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
}

/**
 * Handle media proxy - stream video/image from OneDrive
 */
async function handleMediaProxy(request, env, itemId, corsHeaders) {
  // Get password from query string
  const url = new URL(request.url);
  const password = url.searchParams.get("password");

  if (!password || password !== env.SITE_PASSWORD) {
    return new Response(JSON.stringify({ error: "Password non valida" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Get fresh access token
    const accessToken = await getAccessToken(env);

    // Get file download URL from OneDrive
    // Using /content endpoint which returns a 302 redirect to the actual file
    const contentUrl = `${GRAPH_API_BASE}/drives/${env.ONEDRIVE_DRIVE_ID}/items/${itemId}/content`;

    console.log("Media proxy: fetching", itemId);

    const response = await fetch(contentUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      redirect: "follow", // Follow the 302 redirect
    });

    if (!response.ok) {
      console.error("Media proxy error:", response.status);
      return new Response(JSON.stringify({ error: "Failed to fetch media" }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Stream the response back with appropriate headers
    const contentType =
      response.headers.get("content-type") || "application/octet-stream";

    return new Response(response.body, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600", // Cache for 1 hour
      },
    });
  } catch (error) {
    console.error("Media proxy error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}
