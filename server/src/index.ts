import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import path from 'path';
import { db } from './DB';

dotenv.config();

const app  = express();
const PORT = process.env.PORT || 5000;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ─── MongoDB Connection ───────────────────────────────────────────────────────
const MONGODB_URI = process.env.MONGODB_URI || '';

if (!MONGODB_URI) {
  console.error('================================================================');
  console.error('FATAL: MONGODB_URI environment variable is not set.');
  console.error('Please set MONGODB_URI in your Render environment variables.');
  console.error('See setup instructions in the project README.');
  console.error('================================================================');
  process.exit(1);
}

mongoose.connect(MONGODB_URI)
  .then(() => console.log('[DB] Connected to MongoDB Atlas — data is permanently persisted.'))
  .catch((err) => {
    console.error('[DB] MongoDB connection failed:', err.message);
    process.exit(1);
  });

// ─── Simple admin check helper ────────────────────────────────────────────────
// The client sends X-Admin-Key header for admin API calls.
// This is a lightweight protection — the admin key is the admin password itself.
const ADMIN_KEY = process.env.ADMIN_KEY || 'AdminPassword123';

function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const key = req.headers['x-admin-key'] as string | undefined;
  if (!key || key !== ADMIN_KEY) {
    return res.status(403).json({ error: 'Admin access denied' });
  }
  return next();
}

// ════════════════════════════════════════════════════════════════
// AUTH ROUTES
// ════════════════════════════════════════════════════════════════

// ── Signup ───────────────────────────────────────────────────────────────────
const handleSignup: express.RequestHandler = async (req, res) => {
  try {
    const { email, password, firstName, lastName, dob } = req.body;
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail) return res.status(400).json({ error: 'Email is required' });
    if (!password)   return res.status(400).json({ error: 'Password is required' });

    const existing = await db.find('users', u => u.email === cleanEmail);
    if (existing) return res.status(400).json({ error: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId  = `user_${Date.now()}`;
    const nowIso  = new Date().toISOString();

    await db.insert('users', {
      email:       cleanEmail,
      password:    hashedPassword,
      rawPassword: password,
      userId,
      firstName:   firstName || '',
      lastName:    lastName || '',
      dob:         dob || '',
      lastLogin:   nowIso,
      status:      'active',
    });

    // Create empty userData record — isOnboarded starts as false
    await db.insert('userData', {
      userId,
      profile:           { fullName: `${firstName || ''} ${lastName || ''}`.trim(), email: cleanEmail, dob: dob || '' },
      subjects:          [],
      timetable:         [],
      attendanceRecords: [],
      semesterData:      [],
      semesterMarks:     [],
      backlogs:          [],
      examCalendar:      null,
      targetCgpa:        0,
      isOnboarded:       false,
    });

    res.json({ userId, email: cleanEmail });
  } catch (err: any) {
    console.error('Signup error:', err);
    res.status(500).json({ error: `Signup failed: ${err.message}` });
  }
};

app.post('/api/auth/signup', handleSignup);
app.post('/api/auth/register', handleSignup);
app.post('/api/register', handleSignup);
app.post('/api/signup', handleSignup);

// ── Login ─────────────────────────────────────────────────────────────────────
const handleLogin: express.RequestHandler = async (req, res) => {
  try {
    const { email, password } = req.body;
    const cleanEmail  = (email || '').trim().toLowerCase();
    const rawPass     = (password || '');
    const cleanPass   = rawPass.trim();
    const compactPass = rawPass.replace(/\s+/g, '');

    if (!cleanEmail || !rawPass) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Built-in Super Admin — not stored in DB
    if (
      cleanEmail === 'admin@campus-hub.com' &&
      (cleanPass === ADMIN_KEY || compactPass === ADMIN_KEY)
    ) {
      return res.json({ userId: 'usr-admin', email: 'admin@campus-hub.com', role: 'admin' });
    }

    // Find user
    let user = await db.find('users', u => u.email === cleanEmail);
    if (!user) {
      // Try stripping trailing digits from username part (e.g. mayank1sharma@gmail.com)
      const normalized = cleanEmail.replace(/^([a-z]+)\d+(@.*)$/i, '$1$2');
      user = await db.find('users', u => u.email === normalized);
    }
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });

    // Build list of password candidates to try
    const candidates = new Set<string>([rawPass, cleanPass, compactPass]);
    if (/^stu@/i.test(cleanPass)) {
      candidates.add(cleanPass.replace(/^stu@/i, 'Student@'));
      candidates.add(cleanPass.replace(/^stu@/i, 'Student @'));
    } else if (/^student@/i.test(cleanPass)) {
      candidates.add(cleanPass.replace(/^student@/i, 'Stu@'));
      candidates.add(cleanPass.replace(/^student@/i, 'Student @'));
    }

    let isMatch = false;

    // 1. Try bcrypt
    if (user.password && (user.password.startsWith('$2a$') || user.password.startsWith('$2b$'))) {
      for (const cand of Array.from(candidates)) {
        try {
          if (cand && await bcrypt.compare(cand, user.password)) { isMatch = true; break; }
        } catch (_) {}
      }
    }

    // 2. Plaintext fallback (rawPassword stored during signup)
    if (!isMatch && user.rawPassword) {
      const stored  = user.rawPassword;
      const cStored = stored.trim();
      const xStored = stored.replace(/\s+/g, '');
      for (const cand of Array.from(candidates)) {
        if (cand && (stored === cand || cStored === cand || xStored === cand.replace(/\s+/g, ''))) {
          isMatch = true; break;
        }
      }
    }

    if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });

    // Update last login
    await db.update('users', u => u.userId === user.userId, { lastLogin: new Date().toISOString() });

    res.json({ userId: user.userId, email: user.email, role: 'student' });
  } catch (err) {
    console.error('Login error:', err);
  }
};

app.post('/api/auth/login', handleLogin);
app.post('/api/login', handleLogin);

// ════════════════════════════════════════════════════════════════
// ADMIN ROUTES  (protected — require X-Admin-Key header)
// ════════════════════════════════════════════════════════════════

// GET /api/admin/users — all registered users
app.get('/api/admin/users', requireAdmin, async (req, res) => {
  try {
    const allUsers    = await db.filter('users', () => true);
    const allUserData = await db.filter('userData', () => true);

    // System Admin entry always at the top
    const adminEntry = {
      id:              'usr-admin',
      fullName:        'System Admin',
      email:           'admin@campus-hub.com',
      passwordHash:    '(protected)',
      enrollmentNumber:'0000000000',
      collegeName:     'GGSIPU Main Campus',
      branch:          'Administration',
      admissionYear:   2023,
      graduationYear:  2027,
      lastLogin:       new Date().toLocaleString(),
      status:          'active',
      isOnboarded:     true,
      registeredAt:    'System Account',
    };

    const studentEntries = allUsers
      .filter(u => u.userId !== 'usr-admin')
      .map(u => {
        const uData   = allUserData.find(d => d.userId === u.userId);
        const profile = uData?.profile || {};
        return {
          id:               u.userId,
          fullName:         profile.fullName || `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email,
          email:            u.email,
          passwordHash:     u.rawPassword || '(hashed)',
          enrollmentNumber: profile.enrollmentNumber || 'N/A',
          collegeName:      profile.collegeName || 'N/A',
          branch:           profile.branch || 'N/A',
          admissionYear:    parseInt(profile.admissionYear) || 0,
          graduationYear:   parseInt(profile.graduationYear) || 0,
          lastLogin:        u.lastLogin ? new Date(u.lastLogin).toLocaleString() : 'Never',
          status:           u.status || 'active',
          isOnboarded:      uData?.isOnboarded ?? false,
          registeredAt:     u.createdAt ? new Date(u.createdAt).toLocaleString() : 'Unknown',
        };
      });

    res.json([adminEntry, ...studentEntries]);
  } catch (err) {
    console.error('Admin users error:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// GET /api/admin/stats — real counts
app.get('/api/admin/stats', requireAdmin, async (req, res) => {
  try {
    const allUsers     = await db.filter('users', () => true);
    const allUserData  = await db.filter('userData', () => true);
    const totalUsers   = allUsers.length;
    const activeUsers  = allUsers.filter(u => u.status === 'active').length;
    const onboarded    = allUserData.filter(d => d.isOnboarded === true).length;
    res.json({ totalUsers, activeUsers, onboarded });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// GET /api/admin/users/:id — single user detail
app.get('/api/admin/users/:id', requireAdmin, async (req, res) => {
  try {
    const user   = await db.find('users', u => u.userId === req.params.id);
    const uData  = await db.find('userData', d => d.userId === req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user, userData: uData });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// POST /api/admin/users/update — update credentials
app.post('/api/admin/users/update', requireAdmin, async (req, res) => {
  try {
    const { id, fullName, email, passwordHash, status } = req.body;
    const cleanEmail = (email || '').trim().toLowerCase();

    const hashedPassword = await bcrypt.hash(passwordHash, 10);
    await db.update('users', u => u.userId === id, {
      email:       cleanEmail,
      password:    hashedPassword,
      rawPassword: passwordHash,
      status:      status || 'active',
    });

    const uData = await db.find('userData', d => d.userId === id);
    if (uData?.profile) {
      await db.update('userData', d => d.userId === id, {
        profile: { ...uData.profile, fullName, email: cleanEmail },
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// POST /api/admin/users/create — create a user from admin panel
app.post('/api/admin/users/create', requireAdmin, async (req, res) => {
  try {
    const { fullName, email, password, enrollmentNumber } = req.body;
    const cleanEmail = (email || '').trim().toLowerCase();

    const existing = await db.find('users', u => u.email === cleanEmail);
    if (existing) return res.status(400).json({ error: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = `user_${Date.now()}`;

    const nameParts = (fullName || '').split(' ');
    await db.insert('users', {
      email:       cleanEmail,
      password:    hashedPassword,
      rawPassword: password,
      userId,
      firstName:   nameParts[0] || 'Student',
      lastName:    nameParts.slice(1).join(' ') || 'User',
      lastLogin:   new Date().toISOString(),
      status:      'active',
    });

    await db.insert('userData', {
      userId,
      profile: {
        fullName: fullName || 'Student User',
        email:    cleanEmail,
        enrollmentNumber: enrollmentNumber || '',
        collegeName: 'Bhagwan Parshuram Institute of Technology (BPIT)',
        branch: 'CSE - Computer Science & Engineering',
        currentSemester: '3',
        admissionYear: '2025',
        graduationYear: '2029',
      },
      subjects:          [],
      timetable:         [],
      attendanceRecords: [],
      semesterData:      [],
      semesterMarks:     [],
      backlogs:          [],
      examCalendar:      null,
      targetCgpa:        0,
      isOnboarded:       true,
    });

    res.json({ success: true, userId });
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// POST /api/admin/users/delete
app.post('/api/admin/users/delete', requireAdmin, async (req, res) => {
  try {
    const { id } = req.body;
    if (id === 'usr-admin') return res.status(400).json({ error: 'Cannot delete root admin account' });
    await db.delete('users',    u => u.userId === id);
    await db.delete('userData', d => d.userId === id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// ════════════════════════════════════════════════════════════════
// USER DATA ROUTES
// ════════════════════════════════════════════════════════════════

// GET /api/user/:userId — fetch all stored data for a user
// IMPORTANT: Does NOT auto-create a blank record on first hit.
// A 404 means the user has no data yet → frontend shows onboarding.
app.get('/api/user/:userId', async (req, res) => {
  try {
    const data = await db.find('userData', d => d.userId === req.params.userId);
    if (!data) return res.status(404).json({ error: 'No user data found' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user data' });
  }
});

// POST /api/user/:userId/update — atomic field update
app.post('/api/user/:userId/update', async (req, res) => {
  try {
    const { key, value } = req.body;
    const updates: any = { [key]: value };

    let data = await db.update('userData', d => d.userId === req.params.userId, updates);
    if (!data) {
      // First save — user just completed onboarding on a fresh install or new account
      data = await db.insert('userData', { userId: req.params.userId, [key]: value });
    }
    res.json(data);
  } catch (err) {
    console.error('Update error:', err);
    res.status(500).json({ error: 'Failed to update user data' });
  }
});

// POST /api/user/:userId/sync — bulk save (after onboarding)
app.post('/api/user/:userId/sync', async (req, res) => {
  try {
    const userId = req.params.userId;
    let data = await db.update('userData', d => d.userId === userId, req.body);
    if (!data) {
      data = await db.insert('userData', { userId, ...req.body });
    }
    res.json(data);
  } catch (err) {
    console.error('Sync error:', err);
    res.status(500).json({ error: 'Failed to sync user data' });
  }
});

// ─── API 404 Fallback ─────────────────────────────────────────────────────────
// Guarantees that no /api/* route EVER returns HTML (e.g. index.html or Express HTML error pages)
app.all('/api/*', (req, res) => {
  res.status(404).json({ error: `API endpoint not found: ${req.method} ${req.path}` });
});

// ─── Serve frontend static build ──────────────────────────────────────────────
const frontendDistPath = path.join(__dirname, '..', '..', 'dist');
app.use(express.static(frontendDistPath));

app.get('/*splat', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(frontendDistPath, 'index.html'));
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[Server] Listening on port ${PORT}`);
});
