const express = require('express');
const router = express.Router();
console.log("✅ learningRoutes.js loaded");
const Skill = require('../models/Skill');
const Certificate = require('../models/Certificate');
const Course = require('../models/Course');
const Wellness = require('../models/WellnessEvent');
const SportsEntertainment = require('../models/SportsEntertainmentEvent');


// ➕ Add Skill
router.post('/add-skill', async (req, res) => {
  try {
    const { userId, skillName } = req.body;
    if (!userId || !skillName) {
      return res.status(400).json({ error: 'userId and skillName are required' });
    }

    const newSkill = new Skill({ userId, skillName });
    await newSkill.save();
    res.status(201).json({ message: 'Skill added successfully', skill: newSkill });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 📥 Get Skills for a User
router.get('/skills/:userId', async (req, res) => {
  try {
    const skills = await Skill.find({ userId: req.params.userId });
    res.json(skills);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ➕ Add Certificate
router.post('/add-certificate', async (req, res) => {
  try {
    const { userId, title, provider } = req.body;
    if (!userId || !title || !provider) {
      return res.status(400).json({ error: 'userId, title, and provider are required' });
    }

    const newCertificate = new Certificate({ userId, title, provider });
    await newCertificate.save();
    res.status(201).json({ message: 'Certificate added successfully', certificate: newCertificate });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 📥 Get Certificates for a User
router.get('/certificates/:userId', async (req, res) => {
  try {
    const certificates = await Certificate.find({ userId: req.params.userId });
    res.json(certificates);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ➕ Add Course
router.post('/add-course', async (req, res) => {
  try {
    const { userId, title, instructor, duration, category } = req.body;
    if (!userId || !title || !instructor || !duration || !category) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const newCourse = new Course({ userId, title, instructor, duration, category });
    await newCourse.save();
    res.status(201).json({ message: 'Course added successfully', course: newCourse });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 📥 Get Courses for a User
router.get('/courses/:userId', async (req, res) => {
  try {
    const courses = await Course.find({ userId: req.params.userId });
    res.json(courses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ➕ Add Wellness
router.post('/add-wellness', async (req, res) => {
  try {
    const { userId, title, instructor, duration } = req.body;
    if (!userId || !title || !instructor || !duration) {
      return res.status(400).json({ error: 'userId, title, instructor, and duration are required' });
    }
    const newWellness = new Wellness({ userId, title, instructor, duration });
    await newWellness.save();
    res.status(201).json({ message: 'Wellness session added successfully', wellness: newWellness });
  } catch (err) {
    console.error("Add Wellness Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// 📥 Get Wellness for a User
router.get('/wellness/:userId', async (req, res) => {
  try {
    const wellness = await Wellness.find({ userId: req.params.userId });
    res.json(wellness);
  } catch (err) {
    console.error("Get Wellness Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ➕ Add Sports/Entertainment
router.post('/add-sports-entertainment', async (req, res) => {
  try {
    const { userId, title, instructor, duration } = req.body;
    if (!userId || !title || !instructor || !duration) {
      return res.status(400).json({ error: 'userId, title, instructor, and duration are required' });
    }
    const newSportsEntertainment = new SportsEntertainment({ userId, title, instructor, duration });
    await newSportsEntertainment.save();
    res.status(201).json({ message: 'Sports/Entertainment activity added successfully', sportsEntertainment: newSportsEntertainment });
  } catch (err) {
    console.error("Add Sports/Entertainment Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// 📥 Get Sports/Entertainment for a User
router.get('/sports-entertainment/:userId', async (req, res) => {
  try {
    const sportsEntertainment = await SportsEntertainment.find({ userId: req.params.userId });
    res.json(sportsEntertainment);
  } catch (err) {
    console.error("Get Sports/Entertainment Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ➕ Register for Event
router.post('/register-event', async (req, res) => {
  try {
    const { userId, eventId, eventTitle } = req.body;
    if (!userId || !eventId || !eventTitle) {
      return res.status(400).json({ error: 'userId, eventId, and eventTitle are required' });
    }
    const existingRegistration = await EventRegistration.findOne({ userId, eventId });
    if (existingRegistration) {
      return res.status(400).json({ error: 'Already registered for this event' });
    }
    const newRegistration = new EventRegistration({ userId, eventId, eventTitle });
    await newRegistration.save();
    res.status(201).json({ message: 'Registered successfully', registration: newRegistration });
  } catch (err) {
    console.error("Register Event Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// 📥 Get Registrations for a User
router.get('/registrations/:userId', async (req, res) => {
  try {
    const registrations = await EventRegistration.find({ userId: req.params.userId });
    res.json(registrations);
  } catch (err) {
    console.error("Get Registrations Error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;