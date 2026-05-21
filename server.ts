import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import path from "path";
import * as admin from "firebase-admin";

let isFirebaseAdminInitialized = false;

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
      if (serviceAccount && typeof serviceAccount.private_key === 'string') {
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
      }

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      isFirebaseAdminInitialized = true;
      console.log("Firebase Admin initialized successfully.");
    } catch (error: any) {
      console.error("⚠️ Failed to parse/initialize FIREBASE_SERVICE_ACCOUNT:", error.message);
    }
  }

async function start() {
  const app = express();
  app.use(cors());
  app.use(express.json()); // Enable JSON body parsing for API requests
  
  // Custom API endpoint for sending push notifications
  app.post("/api/notify", async (req, res) => {
    if (!isFirebaseAdminInitialized) {
      return res.status(500).json({ error: "Firebase Admin is not configured. Missing FIREBASE_SERVICE_ACCOUNT." });
    }

    try {
      const { token, to, title, body, data } = req.body;
      const targetToken = token || to;
      
      if (!targetToken || !title) {
        return res.status(400).json({ error: "Missing required fields (token/to, title)." });
      }

      const message = {
        token: targetToken,
        notification: { title, body },
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

      const response = await admin.messaging().send(message);
      return res.status(200).json({ success: true, messageId: response });
    } catch (error: any) {
      console.error("Error sending push notification:", error);
      return res.status(500).json({ error: error.message });
    }
  });

  const server = createServer(app);
  const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
  });

  io.on("connection", (socket) => {
    socket.on("join_room", (roomId) => {
      socket.join(roomId);
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
  });

  if (process.env.NODE_ENV === "production") {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  }

  const PORT = 3000;
  server.listen(PORT, "0.0.0.0", () => console.log(`Server running on port ${PORT}`));
}

start();
