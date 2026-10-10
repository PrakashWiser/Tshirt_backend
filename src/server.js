import "dotenv/config";
import http from "http";
import mongoose from "mongoose";
import { Server } from "socket.io";
import app from "./app.js";
import connectDatabase from "./config/database.js";
import Order from "./models/Order.js";
import { authenticateSocket } from "./middleware/socketAuthMiddleware.js";

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

    io.use(authenticateSocket);

    io.on("connection", (socket) => {
      socket.on("join-admin", () => {
        if (socket.data.user.role === "admin") {
          socket.join("admin");
        }
      });

      socket.on("join-user", () => {
        socket.join(`user-${socket.data.user._id}`);
      });

      socket.on("join-order", async (orderId) => {
        if (!mongoose.Types.ObjectId.isValid(orderId)) return;

        const filter = { _id: orderId };
        if (socket.data.user.role !== "admin") {
          filter.user = socket.data.user._id;
        }

        try {
          const order = await Order.findOne(filter).select("_id");
          if (order) socket.join(`order-${order._id}`);
        } catch {
          return;
        }
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
