const mongoose = require("mongoose");

mongoose.connect("mongodb://127.0.0.1:27017/intranetsite")
  .then(async () => {
    console.log("✅ Connected to DB");

    const Employee = mongoose.connection.collection("employees");
    const count = await Employee.countDocuments();
    console.log("👥 Employee count:", count);

    const one = await Employee.findOne();
    console.log("📄 Sample Employee:", one);

    await mongoose.disconnect();
  })
  .catch(err => console.error("❌ Error:", err));
