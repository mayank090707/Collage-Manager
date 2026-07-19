import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { db } from './DB';
import path from 'path';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// --- AUTH ROUTES ---

// Signup
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password, firstName, lastName, dob } = req.body;
    
    // Check if user exists
    const existing = db.find('users', u => u.email === email);
    if (existing) return res.status(400).json({ error: 'User already exists' });
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create User
    const userId = `user_${Date.now()}`;
    const user = db.insert('users', { 
      email, 
      password: hashedPassword, 
      userId,
      firstName,
      lastName,
      dob
    });
    
    // Create associated UserData with initial profile
    db.insert('userData', { 
      userId,
      profile: {
        fullName: `${firstName} ${lastName}`,
        email: email,
        dob: dob
      },
      subjects: [],
      timetable: [],
      attendanceRecords: [],
      semesterData: [],
      semesterMarks: [],
      backlogs: [],
      examCalendar: null,
      targetCgpa: 0
    });
    
    res.json({ userId, email: user.email });
  } catch (err: any) {
    console.error('Signup error:', err);
    res.status(500).json({ error: `Signup failed: ${err.message}` });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = db.find('users', u => u.email === email);
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });
    
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });
    
    res.json({ userId: user.userId, email: user.email });
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// --- DATA ROUTES ---

// Get all data for a user
app.get('/api/user/:userId', async (req, res) => {
  try {
    let data = db.find('userData', d => d.userId === req.params.userId);
    if (!data) {
      // Create default data if not found
      data = db.insert('userData', { 
        userId: req.params.userId,
        profile: null,
        subjects: [],
        timetable: [],
        attendanceRecords: [],
        semesterData: [],
        semesterMarks: [],
        backlogs: [],
        examCalendar: null,
        targetCgpa: 0
      });
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user data' });
  }
});

// Update specific fields
app.post('/api/user/:userId/update', async (req, res) => {
  try {
    const { key, value } = req.body;
    const updates: any = {};
    updates[key] = value;
    
    const data = db.update('userData', d => d.userId === req.params.userId, updates);
    if (!data) {
        // Handle case where user data doesn't exist yet
        const newData = { userId: req.params.userId, [key]: value };
        db.insert('userData', newData);
        return res.json(newData);
    }
    res.json(data);
  } catch (err) {
    console.error('Update error:', err);
    res.status(500).json({ error: 'Failed to update user data' });
  }
});

// Bulk update (for migration/initial setup)
app.post('/api/user/:userId/sync', async (req, res) => {
  try {
    const data = db.update('userData', d => d.userId === req.params.userId, req.body);
    if (!data) {
      const newData = { userId: req.params.userId, ...req.body };
      db.insert('userData', newData);
      return res.json(newData);
    }
    res.json(data);
  } catch (err) {
    console.error('Sync error:', err);
    res.status(500).json({ error: 'Failed to sync user data' });
  }
});

// Serve frontend static build files in production
const frontendDistPath = path.join(__dirname, '..', '..', 'dist');
app.use(express.static(frontendDistPath));

// Catch-all route to serve the Single Page App (index.html)
app.get('/*splat', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(frontendDistPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Using Local File Database: db.json`);
});
