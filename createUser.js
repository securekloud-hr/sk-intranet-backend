// createUser.js
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import User from "./models/User.js"; // <-- make sure this path is correct

dotenv.config();

const createUser = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URL);
    console.log("✅ Connected to MongoDB");

    const hashedPassword = await bcrypt.hash("admin123", 10); // password

    const newUser = new User({
      username: "varadha",
      userid: "varadha",
      email: "varadha.com",
      password: "123456",
      type: "user",
    });

    await newUser.save();
    console.log("🎉 User created successfully!");
    console.log("Login credentials:");
    console.log("User ID: admin");
    console.log("Password: admin123");

    mongoose.connection.close();
  } catch (error) {
    console.error("❌ Error creating user:", error.message);
    mongoose.connection.close();
  }
};

createUser();
