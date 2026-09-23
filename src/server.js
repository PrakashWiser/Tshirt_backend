import "dotenv/config";
import http from "http";
import { Server } from "socket.io";
import app from "./app.js";
import connectDatabase from "./config/database.js";

const startServer = async () => {
  try {
    await connectDatabase();
    const port = Number(process.env.PORT || 3100);
    const server = http.createServer(app);
    const io = new Server(server, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:5173",
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
    server.listen(port);
    console.log(`🚀 Server Running on port ${port}`);
  } catch (error) {
    process.exit(1);
  }
};

startServer();
