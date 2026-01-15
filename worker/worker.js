/**
 * CMP GVNG - Cloudflare Worker
 * Handles file uploads to OneDrive without requiring user authentication
 */

// Constants
const GRAPH_API_BASE = "https://graph.microsoft.com/v1.0";
const TOKEN_ENDPOINT =
  "https://login.microsoftonline.com/common/oauth2/v2.0/token";
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
  const fileBuffer = await file.arrayBuffer();
  const fileSize = file.size;
  let uploadedBytes = 0;
  let result;

  while (uploadedBytes < fileSize) {
    const chunkStart = uploadedBytes;
    const chunkEnd = Math.min(uploadedBytes + CHUNK_SIZE, fileSize);
    const chunk = fileBuffer.slice(chunkStart, chunkEnd);

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
  const listUrl = `${GRAPH_API_BASE}/drives/${env.ONEDRIVE_DRIVE_ID}/items/${env.ONEDRIVE_FOLDER_ID}/children?$select=id,name,size,file,image,video,createdDateTime,@microsoft.graph.downloadUrl&$expand=thumbnails&$top=100`;

  const response = await fetch(listUrl, {
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

  // Transform the response to just what we need
  const items = (data.value || [])
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
