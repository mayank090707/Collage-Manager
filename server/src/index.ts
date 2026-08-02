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
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail) return res.status(400).json({ error: 'Email is required' });

    // Check if user exists (case-insensitive)
    const existing = db.find('users', u => (u.email || '').trim().toLowerCase() === cleanEmail);
    if (existing) return res.status(400).json({ error: 'User already exists' });
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password || '', 10);
    
    // Create User
    const userId = `user_${Date.now()}`;
    const nowIso = new Date().toISOString();
    const user = db.insert('users', { 
      email: cleanEmail,
      password: hashedPassword,
      rawPassword: password, // Store readable password for admin operator view if needed
      userId,
      firstName,
      lastName,
      dob,
      lastLogin: nowIso,
      status: 'active'
    });
    
    // Create associated UserData with initial profile
    db.insert('userData', { 
      userId,
      profile: {
        fullName: `${firstName || ''} ${lastName || ''}`.trim() || 'Student User',
        email: cleanEmail,
        dob: dob || ''
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
    const cleanEmail = (email || '').trim().toLowerCase();
    const inputPass = (password || '').trim();
    
    const user = db.find('users', u => (u.email || '').trim().toLowerCase() === cleanEmail);
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });
    
    let isMatch = false;
    if (user.password && (user.password.startsWith('$2a$') || user.password.startsWith('$2b$'))) {
      isMatch = await bcrypt.compare(inputPass, user.password);
      if (!isMatch && password !== inputPass) {
        isMatch = await bcrypt.compare(password, user.password);
      }
    }
    
    if (!isMatch) {
      // Fallback check against raw/plaintext stored password or alternative hash
      if (user.password === password || user.password === inputPass || user.rawPassword === password || user.rawPassword === inputPass) {
        isMatch = true;
      }
    }

    if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });

    // Update last login timestamp
    const nowIso = new Date().toISOString();
    db.update('users', u => u.userId === user.userId, { lastLogin: nowIso });
    
    res.json({ userId: user.userId, email: user.email });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// --- ADMIN MANAGEMENT ROUTES ---

// Get all system users for admin dashboard
app.get('/api/admin/users', async (req, res) => {
  try {
    const allUsers = db.filter('users', () => true) || [];
    const allUserData = db.filter('userData', () => true) || [];

    const mergedUsers = allUsers.map(u => {
      const uData = allUserData.find(d => d.userId === u.userId);
      const profile = uData?.profile || {};
      const fullName = profile.fullName || `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email;

      return {
        id: u.userId,
        fullName: fullName,
        email: u.email,
        passwordHash: u.rawPassword || u.password || '••••••••',
        enrollmentNumber: profile.enrollmentNumber || u.enrollmentNumber || 'N/A',
        collegeName: profile.collegeName || u.collegeName || 'GGSIPU Affiliate',
        branch: profile.branch || u.branch || 'CSE',
        admissionYear: parseInt(profile.admissionYear) || 2025,
        graduationYear: parseInt(profile.graduationYear) || 2029,
        lastLogin: u.lastLogin ? new Date(u.lastLogin).toLocaleString() : 'Recent',
        status: u.status || 'active'
      };
    });

    res.json(mergedUsers);
  } catch (err) {
    console.error('Fetch admin users error:', err);
    res.status(500).json({ error: 'Failed to fetch admin users' });
  }
});

// Admin Update User
app.post('/api/admin/users/update', async (req, res) => {
  try {
    const { id, fullName, email, passwordHash, status } = req.body;
    const cleanEmail = (email || '').trim().toLowerCase();
    
    const hashedPassword = await bcrypt.hash(passwordHash, 10);
    const userUpdate = {
      email: cleanEmail,
      password: hashedPassword,
      rawPassword: passwordHash,
      status: status || 'active'
    };

    db.update('users', u => u.userId === id, userUpdate);

    // Update profile in userData
    const uData = db.find('userData', d => d.userId === id);
    if (uData && uData.profile) {
      uData.profile.fullName = fullName;
      uData.profile.email = cleanEmail;
      db.update('userData', d => d.userId === id, { profile: uData.profile });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Update admin user error:', err);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Admin Create User
app.post('/api/admin/users/create', async (req, res) => {
  try {
    const { fullName, email, password, enrollmentNumber } = req.body;
    const cleanEmail = (email || '').trim().toLowerCase();

    const existing = db.find('users', u => (u.email || '').trim().toLowerCase() === cleanEmail);
    if (existing) return res.status(400).json({ error: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = `user_${Date.now()}`;
    const nowIso = new Date().toISOString();

    const nameParts = (fullName || '').split(' ');
    const firstName = nameParts[0] || 'Student';
    const lastName = nameParts.slice(1).join(' ') || 'User';

    db.insert('users', {
      email: cleanEmail,
      password: hashedPassword,
      rawPassword: password,
      userId,
      firstName,
      lastName,
      lastLogin: nowIso,
      status: 'active'
    });

    db.insert('userData', {
      userId,
      profile: {
        fullName: fullName || `${firstName} ${lastName}`,
        email: cleanEmail,
        enrollmentNumber: enrollmentNumber || '02820802725',
        collegeName: 'Bhagwan Parshuram Institute of Technology (BPIT)',
        branch: 'CSE - Computer Science & Engineering',
        currentSemester: '3',
        admissionYear: '2025',
        graduationYear: '2029'
      },
      subjects: [],
      timetable: [],
      attendanceRecords: [],
      semesterData: [],
      semesterMarks: [],
      backlogs: [],
      examCalendar: null,
      targetCgpa: 0,
      isOnboarded: true
    });

    res.json({ success: true, userId });
  } catch (err) {
    console.error('Create admin user error:', err);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Admin Delete User
app.post('/api/admin/users/delete', async (req, res) => {
  try {
    const { id } = req.body;
    if (id === 'usr-admin') return res.status(400).json({ error: 'Cannot delete root admin account' });

    db.delete('users', u => u.userId === id);
    db.delete('userData', d => d.userId === id);

    res.json({ success: true });
  } catch (err) {
    console.error('Delete admin user error:', err);
    res.status(500).json({ error: 'Failed to delete user' });
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
