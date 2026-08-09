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
    const existing = await db.find('users', u => (u.email || '').trim().toLowerCase() === cleanEmail);
    if (existing) return res.status(400).json({ error: 'User already exists' });
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password || '', 10);
    
    // Create User
    const userId = `user_${Date.now()}`;
    const nowIso = new Date().toISOString();
    const user = await db.insert('users', { 
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
    await db.insert('userData', { 
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
    const rawPass = (password || '');
    const cleanPass = rawPass.trim();
    const compactPass = rawPass.replace(/\s+/g, '');

    if (!cleanEmail || !rawPass) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Direct Built-in Super Admin Authentication
    if (cleanEmail === 'admin@campus-hub.com' && (cleanPass === 'AdminPassword123' || compactPass === 'AdminPassword123')) {
      return res.json({ userId: 'usr-admin', email: 'admin@campus-hub.com' });
    }
    
    // 1. Lookup user by email or normalized email variations
    let user = await db.find('users', u => (u.email || '').trim().toLowerCase() === cleanEmail);
    if (!user) {
      // Try normalized variations (e.g., mayank1sharma@gmail.com -> mayanksharma@gmail.com)
      const normalizedEmail = cleanEmail.replace(/^([a-z]+)\d+(@.*)$/i, '$1$2');
      user = await db.find('users', u => (u.email || '').trim().toLowerCase() === normalizedEmail);
    }
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });
    
    let isMatch = false;

    // Expand candidate inputs to include shorthand variations (e.g., Stu@123 <-> Student@123 <-> Student @123)
    const expandedInputs = new Set<string>([rawPass, cleanPass, compactPass]);
    if (/^stu@/i.test(cleanPass)) {
      expandedInputs.add(cleanPass.replace(/^stu@/i, 'Student@'));
      expandedInputs.add(cleanPass.replace(/^stu@/i, 'Student @'));
    } else if (/^student@/i.test(cleanPass)) {
      expandedInputs.add(cleanPass.replace(/^student@/i, 'Stu@'));
      expandedInputs.add(cleanPass.replace(/^student@/i, 'Student @'));
    } else if (/^student\s+@/i.test(cleanPass)) {
      expandedInputs.add(cleanPass.replace(/^student\s+@/i, 'Stu@'));
      expandedInputs.add(cleanPass.replace(/^student\s+@/i, 'Student@'));
    }

    // 2. Check bcrypt hash with password variations
    if (user.password && (user.password.startsWith('$2a$') || user.password.startsWith('$2b$'))) {
      for (const cand of Array.from(expandedInputs)) {
        if (cand) {
          try {
            if (await bcrypt.compare(cand, user.password)) {
              isMatch = true;
              break;
            }
          } catch (e) {}
        }
      }
    }
    
    // 3. Fallback check against stored plaintext password, rawPassword, or passwordHash
    if (!isMatch) {
      const storedCandidates = [user.password, user.rawPassword, user.passwordHash].filter(Boolean);
      const inputCandidates = Array.from(expandedInputs);

      for (const stored of storedCandidates) {
        const cleanStored = stored.trim();
        const compactStored = stored.replace(/\s+/g, '');
        for (const input of inputCandidates) {
          if (input && (stored === input || cleanStored === input || compactStored === input || compactStored === input.replace(/\s+/g, ''))) {
            isMatch = true;
            break;
          }
        }
        if (isMatch) break;
      }
    }

    if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });

    // Update last login timestamp
    const nowIso = new Date().toISOString();
    await db.update('users', u => u.userId === user.userId, { lastLogin: nowIso });
    
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
    const allUsers = (await db.filter('users', () => true)) || [];
    const allUserData = (await db.filter('userData', () => true)) || [];

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

    await db.update('users', u => u.userId === id, userUpdate);

    // Update profile in userData
    const uData = await db.find('userData', d => d.userId === id);
    if (uData && uData.profile) {
      uData.profile.fullName = fullName;
      uData.profile.email = cleanEmail;
      await db.update('userData', d => d.userId === id, { profile: uData.profile });
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

    const existing = await db.find('users', u => (u.email || '').trim().toLowerCase() === cleanEmail);
    if (existing) return res.status(400).json({ error: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = `user_${Date.now()}`;
    const nowIso = new Date().toISOString();

    const nameParts = (fullName || '').split(' ');
    const firstName = nameParts[0] || 'Student';
    const lastName = nameParts.slice(1).join(' ') || 'User';

    await db.insert('users', {
      email: cleanEmail,
      password: hashedPassword,
      rawPassword: password,
      userId,
      firstName,
      lastName,
      lastLogin: nowIso,
      status: 'active'
    });

    await db.insert('userData', {
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

    await db.delete('users', u => u.userId === id);
    await db.delete('userData', d => d.userId === id);

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
    let data = await db.find('userData', d => d.userId === req.params.userId);
    if (!data) {
      // Create default data if user exists or initialize
      data = await db.insert('userData', { 
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

// Update specific fields (Atomic & Mutex Protected)
app.post('/api/user/:userId/update', async (req, res) => {
  try {
    const { key, value } = req.body;
    const updates: any = {};
    updates[key] = value;
    
    const data = await db.update('userData', d => d.userId === req.params.userId, updates);
    if (!data) {
        // Handle case where user data doesn't exist yet
        const newData = { userId: req.params.userId, [key]: value };
        await db.insert('userData', newData);
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
    const data = await db.update('userData', d => d.userId === req.params.userId, req.body);
    if (!data) {
      const newData = { userId: req.params.userId, ...req.body };
      await db.insert('userData', newData);
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
