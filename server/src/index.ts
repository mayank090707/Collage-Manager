import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import path from 'path';
import { db } from './DB';
import { AdminConfigModel, LoginActivityModel, AdminAuditLogModel, UserModel } from './models';

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
  .then(async () => {
    console.log('[DB] Connected to MongoDB Atlas — data is permanently persisted.');
    await runStartupTasks();
  })
  .catch((err) => {
    console.error('[DB] MongoDB connection failed:', err.message);
    process.exit(1);
  });

// ─── User-Agent Parser ───────────────────────────────────────────────────────
// Inline UA parser — no external npm dependency
// Returns { browser, os, device } strings
function parseUA(ua: string): { browser: string; os: string; device: string } {
  if (!ua) return { browser: 'Unknown Browser', os: 'Unknown OS', device: 'Unknown Device' };

  // Detect OS / Device type
  let os = 'Unknown OS';
  if (/iPhone/i.test(ua))                               os = 'iPhone';
  else if (/iPad/i.test(ua))                            os = 'iPad';
  else if (/Android/i.test(ua))                         os = 'Android';
  else if (/Windows NT/i.test(ua))                      os = 'Windows PC';
  else if (/Macintosh|Mac OS X/i.test(ua))              os = 'macOS';
  else if (/Linux/i.test(ua))                           os = 'Linux';
  else if (/CrOS/i.test(ua))                            os = 'ChromeOS';

  // Detect Browser (order matters — check Edge before Chrome, Samsung before Chrome)
  let browser = 'Unknown Browser';
  if (/Edg\//i.test(ua))                               browser = 'Edge';
  else if (/OPR\//i.test(ua) || /Opera/i.test(ua))     browser = 'Opera';
  else if (/SamsungBrowser/i.test(ua))                  browser = 'Samsung Browser';
  else if (/Firefox\//i.test(ua))                       browser = 'Firefox';
  else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) browser = 'Chrome';
  else if (/Chromium\//i.test(ua))                      browser = 'Chromium';
  else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = 'Safari';
  else if (/MSIE|Trident/i.test(ua))                    browser = 'Internet Explorer';

  // Combined device string
  const device =
    os !== 'Unknown OS' && browser !== 'Unknown Browser'
      ? `${os} / ${browser}`
      : os !== 'Unknown OS' ? os
      : browser !== 'Unknown Browser' ? browser
      : 'Unknown Device';

  return { browser, os, device };
}

// ─── IP Address Helper ────────────────────────────────────────────────────────
function getClientIP(req: express.Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  if (Array.isArray(forwarded))      return forwarded[0].trim();
  return req.socket?.remoteAddress || req.ip || '';
}

// ─── Startup Tasks ────────────────────────────────────────────────────────────
// 1. Seed AdminConfig if empty
// 2. Wipe rawPassword from all User records (one-time security migration)
async function runStartupTasks() {
  try {
    // 1. Seed AdminConfig
    const existingConfig = await AdminConfigModel.findOne({});
    if (!existingConfig) {
      const defaultEmail = (process.env.ADMIN_EMAIL || 'admin@campus-hub.com').toLowerCase().trim();
      const defaultPass  = process.env.ADMIN_KEY || 'AdminPassword123';
      const hash         = await bcrypt.hash(defaultPass, 12);
      await AdminConfigModel.create({ adminEmail: defaultEmail, passwordHash: hash, updatedAt: new Date() });
      console.log('[AdminConfig] Seeded default admin credentials in MongoDB.');
    } else {
      console.log(`[AdminConfig] Admin credentials loaded (email: ${existingConfig.adminEmail}).`);
    }

    // 2. Remove rawPassword from all User records (security migration)
    const migrationResult = await UserModel.updateMany(
      { rawPassword: { $exists: true } },
      { $unset: { rawPassword: '' } }
    );
    if (migrationResult.modifiedCount > 0) {
      console.log(`[Security] Removed plaintext rawPassword from ${migrationResult.modifiedCount} user record(s).`);
    }
  } catch (err: any) {
    console.error('[StartupTasks] Error:', err.message);
  }
}

// ─── Admin Config Cache ───────────────────────────────────────────────────────
// Avoids a DB round-trip on every admin request
let cachedAdminConfig: { adminEmail: string; passwordHash: string } | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 60_000; // 60 seconds

async function getAdminConfig(): Promise<{ adminEmail: string; passwordHash: string }> {
  const now = Date.now();
  if (cachedAdminConfig && (now - cachedAt) < CACHE_TTL_MS) return cachedAdminConfig;
  const config = await AdminConfigModel.findOne({}).lean() as any;
  if (!config) throw new Error('AdminConfig not found in database');
  cachedAdminConfig = { adminEmail: config.adminEmail, passwordHash: config.passwordHash };
  cachedAt = now;
  return cachedAdminConfig!;
}

function invalidateAdminCache() {
  cachedAdminConfig = null;
  cachedAt = 0;
}

// ─── requireAdmin Middleware ──────────────────────────────────────────────────
// The client sends X-Admin-Key header = the admin's current password.
// We bcrypt-compare against AdminConfig.passwordHash in MongoDB.
const requireAdmin: express.RequestHandler = async (req, res, next) => {
  try {
    const key = req.headers['x-admin-key'] as string | undefined;
    if (!key) {
      return res.status(403).json({ error: 'Admin access denied' });
    }
    const config = await getAdminConfig();
    const isValid = await bcrypt.compare(key, config.passwordHash);
    if (!isValid) {
      return res.status(403).json({ error: 'Admin access denied' });
    }
    // Attach admin email for use in route handlers
    (req as any).adminEmail = config.adminEmail;
    return next();
  } catch (err: any) {
    console.error('[requireAdmin] Error:', err.message);
    return res.status(500).json({ error: 'Admin auth check failed' });
  }
};

// ─── Admin Audit Logger ───────────────────────────────────────────────────────
async function logAdminAction(
  req: express.Request,
  action: string,
  targetEmail?: string,
  details?: string
) {
  try {
    const adminEmail = (req as any).adminEmail || 'admin';
    const ua = req.headers['user-agent'] || '';
    const { device } = parseUA(ua);
    const ipAddress = getClientIP(req);
    await AdminAuditLogModel.create({
      action,
      targetEmail: targetEmail || '',
      adminEmail,
      timestamp: new Date(),
      device,
      ipAddress,
      details: details || '',
    });
  } catch (err: any) {
    console.error('[AdminAuditLog] Failed to log:', err.message);
  }
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

    const hashedPassword = await bcrypt.hash(password, 12);
    const userId  = `user_${Date.now()}`;
    const nowIso  = new Date().toISOString();

    // NEVER store rawPassword — only the bcrypt hash
    await db.insert('users', {
      email:       cleanEmail,
      password:    hashedPassword,
      userId,
      firstName:   firstName || '',
      lastName:    lastName || '',
      dob:         dob || '',
      lastLogin:   nowIso,
      lastLoginDevice: '',
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
  const ua         = req.headers['user-agent'] || '';
  const ipAddress  = getClientIP(req);
  const { browser, os, device } = parseUA(ua);

  try {
    const { email, password } = req.body;
    const cleanEmail  = (email || '').trim().toLowerCase();
    const rawPass     = (password || '');
    const cleanPass   = rawPass.trim();
    const compactPass = rawPass.replace(/\s+/g, '');

    if (!cleanEmail || !rawPass) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // ── Admin login: check against AdminConfig in DB ──────────────────────
    try {
      const adminConfig = await getAdminConfig();
      if (cleanEmail === adminConfig.adminEmail) {
        const isAdminMatch = await bcrypt.compare(cleanPass, adminConfig.passwordHash)
          || await bcrypt.compare(compactPass, adminConfig.passwordHash);

        if (isAdminMatch) {
          // Record successful admin login
          await LoginActivityModel.create({
            attemptedEmail: cleanEmail,
            userId: 'usr-admin',
            success: true,
            timestamp: new Date(),
            browser, os, device,
            userAgent: ua,
            ipAddress,
          });
          return res.json({ userId: 'usr-admin', email: cleanEmail, role: 'admin' });
        } else {
          // Record failed admin login attempt
          await LoginActivityModel.create({
            attemptedEmail: cleanEmail,
            userId: null,
            success: false,
            timestamp: new Date(),
            browser, os, device,
            userAgent: ua,
            ipAddress,
          });
          return res.status(400).json({ error: 'Invalid credentials' });
        }
      }
    } catch (_) {
      // If AdminConfig lookup fails, fall through to student login
    }

    // ── Student login ─────────────────────────────────────────────────────
    let user = await db.find('users', u => u.email === cleanEmail);
    if (!user) {
      // Try stripping trailing digits from username part
      const normalized = cleanEmail.replace(/^([a-z]+)\d+(@.*)$/i, '$1$2');
      user = await db.find('users', u => u.email === normalized);
    }

    if (!user) {
      // Record failed login for unknown email
      await LoginActivityModel.create({
        attemptedEmail: cleanEmail,
        userId: null,
        success: false,
        timestamp: new Date(),
        browser, os, device,
        userAgent: ua,
        ipAddress,
      });
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Check if account is blocked
    if (user.status === 'blocked') {
      await LoginActivityModel.create({
        attemptedEmail: cleanEmail,
        userId: user.userId,
        success: false,
        timestamp: new Date(),
        browser, os, device,
        userAgent: ua,
        ipAddress,
      });
      return res.status(400).json({ error: 'Account is deactivated. Please contact admin.' });
    }

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

    // Try bcrypt hash only (rawPassword is no longer stored)
    if (user.password && (user.password.startsWith('$2a$') || user.password.startsWith('$2b$'))) {
      for (const cand of Array.from(candidates)) {
        try {
          if (cand && await bcrypt.compare(cand, user.password)) { isMatch = true; break; }
        } catch (_) {}
      }
    }

    if (!isMatch) {
      // Record failed login
      await LoginActivityModel.create({
        attemptedEmail: cleanEmail,
        userId: user.userId,
        success: false,
        timestamp: new Date(),
        browser, os, device,
        userAgent: ua,
        ipAddress,
      });
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Record successful login
    const nowIso = new Date().toISOString();
    await LoginActivityModel.create({
      attemptedEmail: cleanEmail,
      userId: user.userId,
      success: true,
      timestamp: new Date(),
      browser, os, device,
      userAgent: ua,
      ipAddress,
    });

    // Update last login & device on User record
    await db.update('users', u => u.userId === user.userId, {
      lastLogin: nowIso,
      lastLoginDevice: device,
    });

    res.json({ userId: user.userId, email: user.email, role: 'student' });
  } catch (err: any) {
    console.error('Login error:', err);
    // Still record a failed login if we can
    try {
      const cleanEmail = ((req.body?.email) || '').trim().toLowerCase();
      if (cleanEmail) {
        await LoginActivityModel.create({
          attemptedEmail: cleanEmail,
          userId: null,
          success: false,
          timestamp: new Date(),
          browser, os, device,
          userAgent: ua,
          ipAddress,
        });
      }
    } catch (_) {}
    res.status(500).json({ error: 'Login failed due to server error' });
  }
};

app.post('/api/auth/login', handleLogin);
app.post('/api/login', handleLogin);

// ════════════════════════════════════════════════════════════════
// ADMIN ROUTES  (protected — require X-Admin-Key header)
// ════════════════════════════════════════════════════════════════

// GET /api/admin/credentials/email — return only the admin email (not the hash)
app.get('/api/admin/credentials/email', requireAdmin, async (req, res) => {
  try {
    const config = await getAdminConfig();
    res.json({ adminEmail: config.adminEmail });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch admin email' });
  }
});

// POST /api/admin/credentials — change admin email and/or password
app.post('/api/admin/credentials', requireAdmin, async (req, res) => {
  try {
    const { newEmail, newPassword, confirmPassword } = req.body;

    // Validate
    if (!newEmail && !newPassword) {
      return res.status(400).json({ error: 'Provide at least a new email or new password' });
    }
    if (newPassword && newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'New passwords do not match' });
    }
    if (newPassword && newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const config = await AdminConfigModel.findOne({});
    if (!config) return res.status(500).json({ error: 'Admin config not found' });

    if (newEmail) {
      const cleanEmail = newEmail.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }
      config.adminEmail = cleanEmail;
    }
    if (newPassword) {
      config.passwordHash = await bcrypt.hash(newPassword, 12);
    }
    config.updatedAt = new Date();
    await config.save();
    invalidateAdminCache();

    await logAdminAction(req, 'CREDENTIAL_CHANGE', config.adminEmail, 'Admin credentials updated');

    res.json({ success: true, message: 'Admin credentials updated. Please log in again.' });
  } catch (err: any) {
    console.error('Change credentials error:', err);
    res.status(500).json({ error: 'Failed to update credentials' });
  }
});

// GET /api/admin/users — all registered users (no passwords returned)
app.get('/api/admin/users', requireAdmin, async (req, res) => {
  try {
    const allUsers    = await db.filter('users', () => true);
    const allUserData = await db.filter('userData', () => true);

    // System Admin entry always at the top
    let adminLastLogin = 'N/A';
    try {
      const adminConfig = await getAdminConfig();
      const lastAdminActivity = await LoginActivityModel.findOne(
        { userId: 'usr-admin', success: true },
        {},
        { sort: { timestamp: -1 } }
      ).lean() as any;
      if (lastAdminActivity) {
        adminLastLogin = new Date(lastAdminActivity.timestamp).toLocaleString();
      }
    } catch (_) {}

    const adminEntry = {
      id:               'usr-admin',
      fullName:         'System Admin',
      email:            (await getAdminConfig().catch(() => ({ adminEmail: 'admin@campus-hub.com' }))).adminEmail,
      enrollmentNumber: '0000000000',
      collegeName:      'GGSIPU Main Campus',
      branch:           'Administration',
      admissionYear:    2023,
      graduationYear:   2027,
      lastLogin:        adminLastLogin,
      lastLoginDevice:  '',
      status:           'active',
      isOnboarded:      true,
      registeredAt:     'System Account',
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
          enrollmentNumber: profile.enrollmentNumber || 'N/A',
          collegeName:      profile.collegeName || 'N/A',
          branch:           profile.branch || 'N/A',
          admissionYear:    parseInt(profile.admissionYear) || 0,
          graduationYear:   parseInt(profile.graduationYear) || 0,
          lastLogin:        u.lastLogin ? new Date(u.lastLogin).toLocaleString() : 'Never',
          lastLoginDevice:  u.lastLoginDevice || '',
          status:           u.status || 'active',
          isOnboarded:      uData?.isOnboarded ?? false,
          registeredAt:     u.createdAt ? new Date(u.createdAt).toLocaleString() : 'Unknown',
          // NEVER return password or rawPassword
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

// GET /api/admin/users/:id — single user detail (no password returned)
app.get('/api/admin/users/:id', requireAdmin, async (req, res) => {
  try {
    const user   = await db.find('users', u => u.userId === req.params.id);
    const uData  = await db.find('userData', d => d.userId === req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    // Exclude password fields
    const { password, rawPassword, ...safeUser } = user;
    res.json({ user: safeUser, userData: uData });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// POST /api/admin/users/update — update name, email, status only (no password)
app.post('/api/admin/users/update', requireAdmin, async (req, res) => {
  try {
    const { id, fullName, email, status } = req.body;
    if (id === 'usr-admin') {
      return res.status(400).json({ error: 'Use /api/admin/credentials to update admin account' });
    }
    const cleanEmail = (email || '').trim().toLowerCase();

    const user = await db.find('users', u => u.userId === id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const oldEmail = user.email;

    await db.update('users', u => u.userId === id, {
      email:  cleanEmail,
      status: status || 'active',
    });

    const uData = await db.find('userData', d => d.userId === id);
    if (uData?.profile) {
      await db.update('userData', d => d.userId === id, {
        profile: { ...uData.profile, fullName, email: cleanEmail },
      });
    }

    await logAdminAction(req, 'USER_EDITED', cleanEmail,
      `Updated: name="${fullName}", email="${oldEmail}"→"${cleanEmail}", status="${status}"`);

    res.json({ success: true });
  } catch (err: any) {
    console.error('Update user error:', err);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// POST /api/admin/users/reset-password — securely reset a user's password
app.post('/api/admin/users/reset-password', requireAdmin, async (req, res) => {
  try {
    const { id, newPassword, confirmPassword } = req.body;
    if (!id) return res.status(400).json({ error: 'User ID is required' });
    if (!newPassword) return res.status(400).json({ error: 'New password is required' });
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const user = await db.find('users', u => u.userId === id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const hashed = await bcrypt.hash(newPassword, 12);
    await db.update('users', u => u.userId === id, { password: hashed });

    await logAdminAction(req, 'USER_PASSWORD_RESET', user.email, `Password reset for userId=${id}`);

    // Response never contains the new password
    res.json({ success: true, message: 'Password reset successfully' });
  } catch (err: any) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// POST /api/admin/users/toggle-status — activate or deactivate account
app.post('/api/admin/users/toggle-status', requireAdmin, async (req, res) => {
  try {
    const { id, status } = req.body;
    if (!id) return res.status(400).json({ error: 'User ID is required' });
    if (!['active', 'blocked'].includes(status)) {
      return res.status(400).json({ error: 'Status must be "active" or "blocked"' });
    }
    if (id === 'usr-admin') {
      return res.status(400).json({ error: 'Cannot deactivate the root admin account' });
    }

    const user = await db.find('users', u => u.userId === id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    await db.update('users', u => u.userId === id, { status });
    await logAdminAction(req, 'USER_STATUS_CHANGED', user.email,
      `Account status changed to "${status}"`);

    res.json({ success: true, status });
  } catch (err: any) {
    console.error('Toggle status error:', err);
    res.status(500).json({ error: 'Failed to update account status' });
  }
});

// POST /api/admin/users/create — create a user from admin panel
app.post('/api/admin/users/create', requireAdmin, async (req, res) => {
  try {
    const { fullName, email, password, enrollmentNumber } = req.body;
    const cleanEmail = (email || '').trim().toLowerCase();

    const existing = await db.find('users', u => u.email === cleanEmail);
    if (existing) return res.status(400).json({ error: 'User already exists' });

    // NEVER store rawPassword
    const hashedPassword = await bcrypt.hash(password, 12);
    const userId = `user_${Date.now()}`;

    const nameParts = (fullName || '').split(' ');
    await db.insert('users', {
      email:           cleanEmail,
      password:        hashedPassword,
      userId,
      firstName:       nameParts[0] || 'Student',
      lastName:        nameParts.slice(1).join(' ') || 'User',
      lastLogin:       new Date().toISOString(),
      lastLoginDevice: '',
      status:          'active',
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

    await logAdminAction(req, 'USER_CREATED', cleanEmail, `New account created: ${fullName}`);

    res.json({ success: true, userId });
  } catch (err: any) {
    console.error('Create user error:', err);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// POST /api/admin/users/delete
app.post('/api/admin/users/delete', requireAdmin, async (req, res) => {
  try {
    const { id } = req.body;
    if (id === 'usr-admin') return res.status(400).json({ error: 'Cannot delete root admin account' });

    const user = await db.find('users', u => u.userId === id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const deletedEmail = user.email;

    await db.delete('users',    u => u.userId === id);
    await db.delete('userData', d => d.userId === id);

    // Clean up login activity for this user
    await (db as any).deleteMany('loginActivity', (la: any) => la.userId === id);

    await logAdminAction(req, 'USER_DELETED', deletedEmail, `Account permanently deleted`);

    res.json({ success: true });
  } catch (err: any) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// ── Login Activity Routes ──────────────────────────────────────────────────────

// GET /api/admin/login-activity — all login activity (newest first, max 500)
app.get('/api/admin/login-activity', requireAdmin, async (req, res) => {
  try {
    const records = await LoginActivityModel.find({})
      .sort({ timestamp: -1 })
      .limit(500)
      .lean();
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch login activity' });
  }
});

// GET /api/admin/login-activity/user/:userId — activity for one userId
app.get('/api/admin/login-activity/user/:userId', requireAdmin, async (req, res) => {
  try {
    const userId = (req.params as any).userId;
    const records = await LoginActivityModel.find({ userId })
      .sort({ timestamp: -1 })
      .limit(200)
      .lean();
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user login activity' });
  }
});

// GET /api/admin/login-activity/email/:email — activity for one email (incl. failed)
app.get('/api/admin/login-activity/email/:email', requireAdmin, async (req, res) => {
  try {
    const rawEmail = (req.params as any).email || '';
    const email = decodeURIComponent(rawEmail).toLowerCase().trim();
    const records = await LoginActivityModel.find({ attemptedEmail: email })
      .sort({ timestamp: -1 })
      .limit(200)
      .lean();
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch email login activity' });
  }
});

// DELETE /api/admin/login-activity — clear all login activity
app.delete('/api/admin/login-activity', requireAdmin, async (req, res) => {
  try {
    await LoginActivityModel.deleteMany({});
    await logAdminAction(req, 'LOGIN_ACTIVITY_CLEARED', '', 'All login activity records cleared');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to clear login activity' });
  }
});

// GET /api/admin/audit-log — admin action audit trail
app.get('/api/admin/audit-log', requireAdmin, async (req, res) => {
  try {
    const records = await AdminAuditLogModel.find({})
      .sort({ timestamp: -1 })
      .limit(300)
      .lean();
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
});

// ════════════════════════════════════════════════════════════════
// USER DATA ROUTES
// ════════════════════════════════════════════════════════════════

// GET /api/user/:userId — fetch all stored data for a user
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

// ════════════════════════════════════════════════════════════════
// CAMPUS AI CHATBOT ROUTE
// ════════════════════════════════════════════════════════════════
import { processCampusAIQuery } from './aiEngine';

app.post('/api/ai/chat', async (req: express.Request, res: express.Response) => {
  try {
    const { userId, message, history, context } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'Authenticated userId is required' });
    }
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message text is required' });
    }

    const aiResult = await processCampusAIQuery(userId, message.trim(), context);

    return res.json({
      message: aiResult.message,
      intent: aiResult.intent,
      entities: aiResult.entities,
      actions: aiResult.actions,
      context: aiResult.contextToSave,
    });
  } catch (err) {
    console.error('Campus AI endpoint error:', err);
    return res.status(500).json({
      message: "Sorry, I'm having trouble connecting right now. Please try again.",
      intent: 'ERROR',
      actions: [],
    });
  }
});

// ─── API 404 Fallback ─────────────────────────────────────────────────────────
app.use('/api', (req, res) => {
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
