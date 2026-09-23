import "dotenv/config";
import fs from "fs";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import Admin from "./models/Admin.js";

const seedAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const adminData = JSON.parse(
      fs.readFileSync("./seed-admin.json", "utf-8")
    );

    const existingAdmin = await Admin.findOne({
      email: adminData.email,
    });

    if (existingAdmin) {
      console.log("Admin already exists");
      await mongoose.disconnect();
      return;
    }

    adminData.password = await bcrypt.hash(adminData.password, 10);
    await Admin.create(adminData);
    console.log(`Admin created: ${adminData.email}`);
    await mongoose.disconnect();
  } catch (error) {
    console.error("Seed failed:", error);
    await mongoose.disconnect();
    process.exit(1);
  }
};

seedAdmin();