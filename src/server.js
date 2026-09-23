import "dotenv/config";
import http from "http";
import { Server } from "socket.io";
import app from "./app.js";
import connectDatabase from "./config/database.js";

const startServer = async () => {
  try {
    await connectDatabase();

    const port = Number(process.env.PORT || 3100);

    const allowedOrigins = process.env.FRONTEND_URL
      ? process.env.FRONTEND_URL.split(",").map((origin) => origin.trim())
      : ["http://localhost:5173"];

    const server = http.createServer(app);

    const io = new Server(server, {
      cors: {
        origin: allowedOrigins,
        credentials: true,
      },
    });

    io.on("connection", (socket) => {
      socket.on("join-admin", () => {
        socket.join("admin");
      });

      socket.on("join-user", (userId) => {
        socket.join(`user-${userId}`);
      });

      socket.on("join-order", (orderId) => {
        socket.join(`order-${orderId}`);
      });
    });

    app.set("io", io);

    server.listen(port, () => {
      console.log(`🚀 Server Running on port ${port}`);
    });
  } catch (error) {
    console.error("Server startup error:", error);
    process.exit(1);
  }
};

startServer();