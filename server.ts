import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import path from "path";
import { initializeApp, cert, getApp, getApps } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

let isFirebaseAdminInitialized = false;

async function start() {
  // Initialize Firebase Admin if Service Account is provided
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      let accountStr = process.env.FIREBASE_SERVICE_ACCOUNT;
      
      // If it's not a JSON string, try decoding from base64
      if (accountStr && !accountStr.trim().startsWith('{')) {
        try {
          accountStr = Buffer.from(accountStr, 'base64').toString('utf8');
        } catch (e) {
          // Ignore, fallback to original string
        }
      }

      const serviceAccount = JSON.parse(accountStr);
      console.log("[BLABLU] Service Account Project ID:", serviceAccount.project_id);
      if (serviceAccount && typeof serviceAccount.private_key === 'string') {
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
      }

      if (getApps().length === 0) {
        initializeApp({
          credential: cert(serviceAccount)
        });
      }
      isFirebaseAdminInitialized = true;
      console.log("[BLABLU] Firebase Admin initialized successfully.");
    } catch (error: any) {
      console.error("⚠️ [BLABLU] Failed to parse/initialize FIREBASE_SERVICE_ACCOUNT:", error.message);
    }
  }

  const app = express();
  app.use(cors());
  app.use(express.json()); // Enable JSON body parsing for API requests
  
  // Custom API endpoint for sending push notifications
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", firebase: isFirebaseAdminInitialized });
  });

  app.post("/api/notify", async (req, res) => {
    console.log("[BLABLU] /api/notify request received:", req.body);
    if (!isFirebaseAdminInitialized) {
      console.warn("[BLABLU] Notification skipped: Firebase Admin not initialized");
      return res.status(500).json({ error: "Firebase Admin is not configured. Missing FIREBASE_SERVICE_ACCOUNT." });
    }

    try {
      const { token, to, title, body, data } = req.body;
      const targetToken = token || to;
      
      if (!targetToken) {
        console.warn("[BLABLU] Notification skipped: Missing target token");
        return res.status(400).json({ error: "Missing required fields (token/to)." });
      }

      console.log(`[BLABLU] Sending push to ${targetToken.substring(0, 8)}...`);

      const message = {
        token: targetToken,
        notification: { title: title || "Blablu", body: body || "New message" },
        data: data || {},
        android: {
          notification: {
            channelId: 'blablu_chat',
            sound: 'default'
          }
        },
        apns: {
          payload: {
            aps: {
              sound: 'default'
            }
          }
        }
      };

      const response = await getMessaging().send(message);
      console.log("[BLABLU] Push notification sent successfully:", response);
      return res.status(200).json({ success: true, messageId: response });
    } catch (error: any) {
      const errorMessage = error?.message || String(error);
      const errorCode = error?.code || "";

      // Handle the "Requested entity was not found" (token not registered) error
      if (errorCode === 'messaging/registration-token-not-registered' || 
          errorCode === 'messaging/invalid-registration-token' ||
          errorMessage.includes('Requested entity was not found') ||
          errorMessage.includes('registration-token-not-registered')) {
        console.warn(`[BLABLU] Push failed: Token is invalid or not registered. Target: ${req.body.token || req.body.to}`);
        return res.status(410).json({ error: "Token no longer valid", code: errorCode || 'token_expired' });
      }
      
      console.error("[BLABLU] Error sending push notification:", errorMessage, error);
      return res.status(500).json({ error: errorMessage, code: errorCode });
    }
  });

  const crypto = await import("crypto");

  app.post("/api/cloudinary/delete", async (req, res) => {
    try {
      const { url } = req.body;
      if (!url || !url.includes("cloudinary.com")) {
        return res.status(400).json({ error: "Invalid Cloudinary URL" });
      }

      // Extract public_id from URL: /v<timestamp>/<public_id>.<ext>
      // e.g. https://res.cloudinary.com/dcwl4l70x/video/upload/v1716382902/blablu_videos/sample.mp4
      // the public_id is usually everything after /upload/v<timestamp>/ up to the extension
      // Actually with an upload preset "blablu_videos", it might be "blablu_videos/sample"
      
      const uploadIndex = url.indexOf("/upload/");
      if (uploadIndex === -1) return res.status(400).json({ error: "Could not parse public_id" });
      
      // substring after /upload/
      let pathAfterUpload = url.substring(uploadIndex + 8);
      // remove v1234567/ folder if present
      if (pathAfterUpload.startsWith("v") && pathAfterUpload.includes("/")) {
        const parts = pathAfterUpload.split("/");
        if (/^v\d+$/.test(parts[0])) {
           parts.shift(); // remove the v123456...
        }
        pathAfterUpload = parts.join("/");
      }
      
      // remove extension
      const public_id = pathAfterUpload.substring(0, pathAfterUpload.lastIndexOf(".")) || pathAfterUpload;
      
      const apiSecret = "S18YyZ7fYMjRMXpdVewGhsVQIYM";
      const apiKey = "225312649125656";
      const cloudName = "dcwl4l70x";
      const timestamp = Math.round(new Date().getTime() / 1000);

      const stringToSign = `invalidate=true&public_id=${public_id}&timestamp=${timestamp}${apiSecret}`;
      const signature = crypto.createHash('sha1').update(stringToSign).digest('hex');

      const params = new URLSearchParams();
      params.append('public_id', public_id);
      params.append('signature', signature);
      params.append('api_key', apiKey);
      params.append('timestamp', timestamp.toString());
      params.append('invalidate', 'true');

      const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/video/destroy`, {
        method: 'POST',
        body: params
      });
      const data = await response.json();
      console.log("[BLABLU] Cloudinary destroy result:", data);
      res.json(data);
    } catch (e: any) {
      console.error("[BLABLU] Cloudinary delete error", e);
      res.status(500).json({ error: e.message });
    }
  });

  const server = createServer(app);
  const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
  });

  io.on("connection", (socket) => {
    socket.on("join-room", (roomId) => {
      socket.join(roomId);
      console.log(`Socket ${socket.id} joined room ${roomId}`);
    });

    socket.on("sensor_event", (data) => {
      const { roomId } = data;
      socket.to(roomId).emit("sensor_event", data);
    });

    socket.on("live_location", (data) => {
      const { roomId } = data;
      socket.to(roomId).emit("live_location", data);
    });
    
    socket.on("location_ping", (data) => {
      socket.to(data.roomId).emit("location_ping");
    });

    socket.on("location_pong", (data) => {
      socket.to(data.roomId).emit("location_pong", data);
    });

    socket.on("chat_message", (data) => {
      const { roomId } = data;
      socket.to(roomId).emit("chat_message", data);
    });
  });

  const fs = await import("fs");
  const isProduction = process.env.NODE_ENV === "production" || 
                       process.env.K_SERVICE ||
                       fs.existsSync(path.join(process.cwd(), "dist", "index.html"));
  
  if (isProduction) {
    const distPath = path.join(process.cwd(), "dist");
    console.log(`[BLABLU] Running in PRODUCTION mode. Serving: ${distPath}`);
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  } else {
    console.log("[BLABLU] Running in DEVELOPMENT mode (Vite Middleware)");
    try {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa"
      });
      app.use(vite.middlewares);
    } catch (e) {
      console.error("[BLABLU] Failed to load Vite middleware. Check if 'vite' is installed.", e);
    }
  }

  const PORT = 3000;
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`[BLABLU] Server listening on 0.0.0.0:${PORT}`);
    console.log(`[BLABLU] NODE_ENV: ${process.env.NODE_ENV}`);
    console.log(`[BLABLU] CWD: ${process.cwd()}`);
  }).on('error', (err) => {
    console.error("[BLABLU] Server fail to start:", err);
    process.exit(1);
  });
}

start().catch(err => {
  console.error("[BLABLU] Fatal startup error:", err);
  process.exit(1);
});
