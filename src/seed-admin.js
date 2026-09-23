import "dotenv/config";
import fs from "fs";
import mongoose from "mongoose";
import User from "./models/User.js";

const seedAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const adminData = JSON.parse(
      fs.readFileSync("./seed-admin.json", "utf-8")
    );

    const existingAdmin = await User.findOne({
      email: adminData.email,
    });

    if (existingAdmin) {
      existingAdmin.password = adminData.password;
      existingAdmin.role = "admin";
      existingAdmin.isActive = true;

      await existingAdmin.save();

      console.log("Admin password reset successfully");

      await mongoose.disconnect();
      return;
    }

    await User.create({
      ...adminData,
      role: "admin",
    });

    console.log(`Admin created: ${adminData.email}`);
    await mongoose.disconnect();
  } catch (error) {
    console.error("Seed failed:", error);
    await mongoose.disconnect();
    process.exit(1);
  }
};

seedAdmin();