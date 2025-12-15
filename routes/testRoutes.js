const express = require("express");
const router = express.Router();
const Test = require("../models/Test");

router.get("/", async (req, res) => {
  try {
    const data = await Test.find({});
    res.json({ success: true, data });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});
router.get("/", async (req,res) => {
  try{
    const data =await.Test.find({});
    res.json({sucess;false, error: err.messge});
  }
  });
module.exports = router;
