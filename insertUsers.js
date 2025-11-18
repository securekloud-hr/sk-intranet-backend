const mongoose = require("mongoose");
require("dotenv").config();

// Connect to MongoDB
mongoose.connect(process.env.mongodb_url, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ DB Error", err));

// Define User schema and model
const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  role: String,
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model("User", userSchema);

// ✅ Sample users (no password field)
const users = [
  {
    name: "Ajay Sharma",
    email: "ajay.sharma@company.com",
    role: "employee"
  },
  {
    name: "Sneha Rao",
    email: "sneha.rao@company.com",
    role: "manager"
  },
   {
    name: "vasudha",
    email: "vasudha@company.com",
    role: "manager"
  },
  {
    name: "Vikram",
    email: "vikram.patel@company.com",
    role: "employee"
  }
];

// ✅ Insert users
async function insertUsers() {
  try {
    await User.insertMany(users);
    console.log("✅ Users inserted successfully");
  } catch (err) {
    console.error("❌ Error inserting users:", err);
  } finally {
    mongoose.disconnect();
  }
}

insertUsers(); // <--- call the function
