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

  const isProduction = process.env.NODE_ENV === "production";
  
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
