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

// ════════════════════════════════════════════════════════════════
// CAMPUS AI CHATBOT ROUTE
// ════════════════════════════════════════════════════════════════
import {
  getOverallAttendance,
  getSubjectAttendance,
  getCGPA,
  getSGPA,
  getTargetCGPA,
  getBacklogs,
  getTimetable,
  getUpcomingExams,
  getAcademicSummary,
  getPlacementReadiness,
} from './aiTools';

app.post('/api/ai/chat', async (req: express.Request, res: express.Response) => {
  try {
    const { userId, message, history } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'Authenticated userId is required' });
    }
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message text is required' });
    }

    const text = message.trim();
    const lower = text.toLowerCase();

    // Extract previous assistant message / intent from session history if available for follow-ups
    const lastUserMsg = history && history.length >= 2 ? history[history.length - 2]?.content || '' : '';
    const lastAssistantMsg = history && history.length >= 1 ? history[history.length - 1]?.content || '' : '';

    // ── 1. Contextual Follow-up Detection ─────────────────────────────────
    let subjectQuery: string | undefined;
    let isFollowUp = false;

    if (
      lower.startsWith('what about ') ||
      lower.startsWith('how about ') ||
      lower.startsWith('show me ') ||
      lower.includes('for ')
    ) {
      // Check if previous topic was attendance
      if (lastAssistantMsg.toLowerCase().includes('attendance') || lastUserMsg.toLowerCase().includes('attendance')) {
        const match = lower.replace(/^(what about|how about|show me|for)\s+/i, '').replace(/\?$/, '').trim();
        if (match) {
          subjectQuery = match;
          isFollowUp = true;
        }
      }
    }

    // ── 2. Intent Engine & Action Mappings ──────────────────────────────────
    let intent = 'UNKNOWN';
    let responseMessage = '';
    let actions: Array<{ label: string; route: string }> = [];

    // --- Navigation Query Detection ---
    if (/\b(pyq|pyqs|previous year|past papers|old questions)\b/.test(lower)) {
      intent = 'NAVIGATE_PYQ';
      responseMessage = 'You can find Previous Year Questions (PYQs) under Study Material → PYQ.';
      actions = [{ label: 'Open PYQs', route: '/app/study-material' }];
    } else if (/\b(syllabus)\b/.test(lower)) {
      intent = 'NAVIGATE_SYLLABUS';
      responseMessage = 'The official course syllabus is available in Study Material → Syllabus.';
      actions = [{ label: 'Open Syllabus', route: '/app/study-material' }];
    } else if (/\b(important topics|key topics)\b/.test(lower)) {
      intent = 'NAVIGATE_IMPORTANT_TOPICS';
      responseMessage = 'Important study topics are categorized under Study Material → Important Topics.';
      actions = [{ label: 'Open Important Topics', route: '/app/study-material' }];
    } else if (/\b(study reference|reference books|notes|resources)\b/.test(lower)) {
      intent = 'NAVIGATE_STUDY_REFERENCE';
      responseMessage = 'Study reference materials and textbooks are located under Study Material → Study Reference.';
      actions = [{ label: 'Open Study Reference', route: '/app/study-material' }];
    } else if (/\b(my space|personal notes|custom topics)\b/.test(lower)) {
      intent = 'NAVIGATE_MY_SPACE';
      responseMessage = 'Your personal revision notes and topic planner are available in Study Material → My Space.';
      actions = [{ label: 'Open My Space', route: '/app/study-material' }];
    } else if (/\b(study material)\b/.test(lower) && !/\b(what|how|where)\b/.test(lower)) {
      intent = 'NAVIGATE_STUDY_MATERIAL';
      responseMessage = 'All study material including Syllabus, PYQs, and References are in the Study Material section.';
      actions = [{ label: 'Open Study Material', route: '/app/study-material' }];
    } else if (/\b(placement|placement readiness|job ready)\b/.test(lower) && /\b(where|show|how)\b/.test(lower) && /\b(find|check|see)\b/.test(lower)) {
      intent = 'NAVIGATE_ANALYTICS';
      responseMessage = 'Placement readiness score and analytics are calculated in the Analytics tab.';
      actions = [{ label: 'Open Analytics', route: '/app/analytics' }];
    } else if (/\b(analytics|trend|trends|performance overview)\b/.test(lower) && /\b(where|show|find|check)\b/.test(lower)) {
      intent = 'NAVIGATE_ANALYTICS';
      responseMessage = 'Academic analytics and trend charts are available in the Analytics section.';
      actions = [{ label: 'Open Analytics', route: '/app/analytics' }];
    } else if (/\b(profile|account|student details)\b/.test(lower) && /\b(where|show|find|check)\b/.test(lower)) {
      intent = 'NAVIGATE_PROFILE';
      responseMessage = 'Your student profile, enrollment details, and academic history are in the Profile tab.';
      actions = [{ label: 'Open Profile', route: '/app/profile' }];
    } else if (/\b(dashboard|home|hero|overview)\b/.test(lower) && /\b(where|show|go|open)\b/.test(lower)) {
      intent = 'NAVIGATE_DASHBOARD';
      responseMessage = 'You can access your main overview on the Dashboard.';
      actions = [{ label: 'Open Dashboard', route: '/app' }];
    } else if (/\b(exam calendar|upcoming exams)\b/.test(lower) && /\b(where|show|check|find)\b/.test(lower)) {
      intent = 'NAVIGATE_EXAMS';
      responseMessage = 'You can check your mid-sem & end-sem exam schedule in the Exams tab.';
      actions = [{ label: 'Open Exams', route: '/app/exams' }];
    } else if (/\b(timetable|schedule|class timings|periods)\b/.test(lower) && /\b(where|show|check|find)\b/.test(lower)) {
      intent = 'NAVIGATE_TIMETABLE';
      responseMessage = 'Your weekly timetable and class timings are available in the Timetable section.';
      actions = [{ label: 'Open Timetable', route: '/app/timetable' }];
    } else if (/\b(target cgpa|target predictor|cgpa target)\b/.test(lower) && /\b(where|calculator|predictor|how to set)\b/.test(lower)) {
      intent = 'NAVIGATE_TARGET_PREDICTOR';
      responseMessage = 'You can calculate target SGPA requirements in Academics → Target Predictor.';
      actions = [{ label: 'Open Target Predictor', route: '/app/target-predictor' }];
    } else if (/\b(marks calculator)\b/.test(lower)) {
      intent = 'NAVIGATE_MARKS_CALCULATOR';
      responseMessage = 'You can simulate internal & external marks in Marks Calculator.';
      actions = [{ label: 'Open Marks Calculator', route: '/app/marks-calculator' }];
    } else if (/\b(enter marks|semester marks)\b/.test(lower) && /\b(where|how|add)\b/.test(lower)) {
      intent = 'NAVIGATE_MARKS_CALCULATOR';
      responseMessage = 'You can enter and update your semester marks in Enter Marks.';
      actions = [{ label: 'Open Enter Marks', route: '/app/enter-marks' }];
    } else if (/\b(backlogs|backlog)\b/.test(lower) && /\b(where|show|check|find)\b/.test(lower)) {
      intent = 'NAVIGATE_BACKLOGS';
      responseMessage = 'Backlog records and status are managed under Academics → Backlogs.';
      actions = [{ label: 'Open Backlogs', route: '/app/academics' }];
    } else if (/\b(attendance)\b/.test(lower) && /\b(where|show|check|find|see)\b/.test(lower)) {
      intent = 'NAVIGATE_ATTENDANCE';
      responseMessage = 'You can view and mark your daily attendance in Academics → Attendance.';
      actions = [{ label: 'Open Attendance', route: '/app/academics' }];
    } else if (/\b(sgpa)\b/.test(lower) && /\b(where|show|check|find)\b/.test(lower)) {
      intent = 'NAVIGATE_SGPA';
      responseMessage = 'Semester SGPA breakdown is available in Academics → SGPA.';
      actions = [{ label: 'Open SGPA', route: '/app/academics' }];
    } else if (/\b(cgpa)\b/.test(lower) && /\b(where|show|check|find)\b/.test(lower)) {
      intent = 'NAVIGATE_CGPA';
      responseMessage = 'Your cumulative CGPA and academic progress are in Academics → CGPA.';
      actions = [{ label: 'Open CGPA', route: '/app/academics' }];
    }

    // --- Student Data Query Detection ---
    if (!responseMessage || isFollowUp) {
      if (isFollowUp && subjectQuery) {
        intent = 'GET_SUBJECT_ATTENDANCE';
        const subData = await getSubjectAttendance(userId, subjectQuery);
        if (!subData.found) {
          responseMessage = "I couldn't find that information in your Campus Hub account.";
        } else if (subData.matchedSubject) {
          const s = subData.matchedSubject;
          responseMessage = `Your ${s.subject} attendance is ${s.percentage}%. Attended ${s.attended} of ${s.total} conducted classes.`;
          if (s.safeBunks > 0) {
            responseMessage += ` You can safely bunk ${s.safeBunks} class${s.safeBunks > 1 ? 'es' : ''} while remaining above 75%.`;
          } else if (s.classesNeeded > 0) {
            responseMessage += ` You need to attend the next ${s.classesNeeded} class${s.classesNeeded > 1 ? 'es' : ''} to reach 75%.`;
          }
          actions = [{ label: 'Open Attendance', route: '/app/academics' }];
        } else {
          responseMessage = `I couldn't find attendance records specifically for "${subjectQuery}". Available subjects: ${subData.allSubjects?.join(', ')}.`;
          actions = [{ label: 'Open Attendance', route: '/app/academics' }];
        }
      } else if (/\b(bunk|bunks|safe bunks|miss class|skip class)\b/.test(lower)) {
        intent = 'GET_SAFE_BUNKS';
        // Extract subject if mentioned
        const words = lower.replace(/\b(how many|classes|can|i|bunk|in|safe|bunks|for|\?)\b/g, ' ').trim();
        if (words.length > 1) {
          const subData = await getSubjectAttendance(userId, words);
          if (subData.matchedSubject) {
            const s = subData.matchedSubject;
            if (s.safeBunks > 0) {
              responseMessage = `Your ${s.subject} attendance is ${s.percentage}%, and according to your current data you can safely miss ${s.safeBunks} class${s.safeBunks > 1 ? 'es' : ''} while remaining above 75%.`;
            } else {
              responseMessage = `Your ${s.subject} attendance is ${s.percentage}%. You have 0 safe bunks available. Need to attend ${s.classesNeeded} more class${s.classesNeeded > 1 ? 'es' : ''} for 75%.`;
            }
          }
        }
        if (!responseMessage) {
          const att = await getOverallAttendance(userId);
          if (!att.found || !att.hasData) {
            responseMessage = "I couldn't find that information in your Campus Hub account.";
          } else {
            const safeSubs = (att.subjectStats || []).filter((s: any) => s.safeBunks > 0);
            if (safeSubs.length > 0) {
              const details = safeSubs.map((s: any) => `${s.subject}: ${s.safeBunks} bunk${s.safeBunks > 1 ? 's' : ''}`).join(', ');
              responseMessage = `Your overall attendance is ${att.overallAttendance}%. Safe bunks available: ${details}.`;
            } else {
              responseMessage = `Your overall attendance is ${att.overallAttendance}%. You currently have 0 safe bunks across your subjects.`;
            }
          }
        }
        actions = [{ label: 'Open Attendance', route: '/app/academics' }];
      } else if (/\b(placement|placement readiness|readiness)\b/.test(lower)) {
        intent = 'GET_PLACEMENT_READINESS';
        const placement = await getPlacementReadiness(userId);
        if (!placement.found) {
          responseMessage = "I couldn't find that information in your Campus Hub account.";
        } else {
          responseMessage = `Your Placement Readiness Score is ${placement.readinessScore}/100 (${placement.status}). Overall Attendance: ${placement.overallAttendance}%, CGPA: ${placement.cgpa || 'N/A'}, Active Backlogs: ${placement.activeBacklogs}.`;
          actions = [{ label: 'View Analytics', route: '/app/analytics' }];
        }
      } else if (/\b(attendance)\b/.test(lower)) {
        // Check if a specific subject is queried
        const subMatch = lower.match(/attendance (?:in|for) ([a-z0-9\s]+)/i) || lower.match(/([a-z0-9\s]+) attendance/i);
        const candidateSubject = subMatch ? subMatch[1].replace(/\b(my|what|is|the|overall|how|check)\b/g, '').trim() : '';

        if (candidateSubject && candidateSubject.length > 1 && candidateSubject !== 'overall') {
          intent = 'GET_SUBJECT_ATTENDANCE';
          const subData = await getSubjectAttendance(userId, candidateSubject);
          if (subData.matchedSubject) {
            const s = subData.matchedSubject;
            responseMessage = `Your ${s.subject} attendance is ${s.percentage}%. Attended ${s.attended} of ${s.total} conducted classes.`;
            if (s.safeBunks > 0) responseMessage += ` Safe bunks: ${s.safeBunks}.`;
            actions = [{ label: 'Open Attendance', route: '/app/academics' }];
          }
        }

        if (!responseMessage) {
          intent = 'GET_ATTENDANCE';
          const att = await getOverallAttendance(userId);
          if (!att.found || !att.hasData) {
            responseMessage = "I couldn't find that information in your Campus Hub account.";
          } else {
            responseMessage = `Your overall attendance is ${att.overallAttendance}% (${att.totalAttended} attended out of ${att.totalConducted} classes).`;
          }
          actions = [{ label: 'Open Attendance', route: '/app/academics' }];
        }
      } else if (/\b(cgpa)\b/.test(lower)) {
        if (/\b(target|goal|need|reach)\b/.test(lower)) {
          intent = 'GET_TARGET_CGPA';
          const target = await getTargetCGPA(userId);
          if (!target.found) {
            responseMessage = "I couldn't find that information in your Campus Hub account.";
          } else {
            responseMessage = `Your current CGPA is ${target.currentCgpa ?? 'N/A'} and your target is ${target.targetCgpa}.`;
            if (target.requiredSgpa !== null) {
              responseMessage += ` Based on your current academic data, your required SGPA for the next semester is ${target.requiredSgpa}.`;
            }
          }
          actions = [{ label: 'Open Target Predictor', route: '/app/target-predictor' }];
        } else {
          intent = 'GET_CGPA';
          const cgpaInfo = await getCGPA(userId);
          if (!cgpaInfo.found || cgpaInfo.cgpa === null) {
            responseMessage = "I couldn't find that information in your Campus Hub account.";
          } else {
            responseMessage = `Your current CGPA is ${cgpaInfo.cgpa}.`;
          }
          actions = [{ label: 'Open CGPA', route: '/app/academics' }];
        }
      } else if (/\b(sgpa)\b/.test(lower)) {
        intent = 'GET_SGPA';
        const sgpaInfo = await getSGPA(userId);
        if (!sgpaInfo.found || !sgpaInfo.hasMarks) {
          responseMessage = "I couldn't find that information in your Campus Hub account.";
        } else {
          responseMessage = `Your SGPA for Semester ${sgpaInfo.semester} is ${sgpaInfo.sgpa}.`;
        }
        actions = [{ label: 'Open SGPA', route: '/app/academics' }];
      } else if (/\b(backlogs|backlog)\b/.test(lower)) {
        intent = 'GET_BACKLOGS';
        const backlogs = await getBacklogs(userId);
        if (!backlogs.found) {
          responseMessage = "I couldn't find that information in your Campus Hub account.";
        } else if (backlogs.activeCount === 0) {
          responseMessage = 'Great news! You have 0 active backlogs.';
        } else {
          const listStr = backlogs.activeBacklogs.map((b: any) => `${b.subjectName} (Sem ${b.semester})`).join(', ');
          responseMessage = `You have ${backlogs.activeCount} active backlog${backlogs.activeCount > 1 ? 's' : ''}: ${listStr}.`;
        }
        actions = [{ label: 'Open Backlogs', route: '/app/academics' }];
      } else if (/\b(timetable|classes today|schedule today|classes do i have)\b/.test(lower)) {
        intent = 'GET_TIMETABLE';
        const timetable = await getTimetable(userId);
        if (!timetable.found || !timetable.hasSchedule) {
          responseMessage = `No classes scheduled for ${timetable.day || 'today'}. Enjoy your free day!`;
        } else {
          const classList = timetable.schedule.map((s: any) => `Period ${s.period}: ${s.subject}`).join(', ');
          responseMessage = `Here is your schedule for ${timetable.day}: ${classList}.`;
        }
        actions = [{ label: 'Open Timetable', route: '/app/timetable' }];
      } else if (/\b(exam|exams|next exam|mid sem|end sem)\b/.test(lower)) {
        intent = 'GET_UPCOMING_EXAMS';
        const exams = await getUpcomingExams(userId);
        if (!exams.found || !exams.hasExams) {
          responseMessage = "I couldn't find any upcoming exam dates in your Campus Hub account.";
        } else {
          const next = exams.upcomingExams[0];
          responseMessage = `Your next exam is ${next.subjectName} (${next.examType}) on ${next.date} at ${next.startTime || 'scheduled time'}.`;
        }
        actions = [{ label: 'Open Exams', route: '/app/exams' }];
      } else if (/\b(summary|overview|academic status|how am i doing)\b/.test(lower)) {
        intent = 'GET_ACADEMIC_SUMMARY';
        const summary = await getAcademicSummary(userId);
        if (!summary.found) {
          responseMessage = "I couldn't find that information in your Campus Hub account.";
        } else {
          responseMessage = `Hi ${summary.studentName}! Your CGPA is ${summary.cgpa ?? 'N/A'}, Overall Attendance is ${summary.overallAttendance}%, and active backlogs: ${summary.activeBacklogsCount}.`;
        }
        actions = [
          { label: 'Open Attendance', route: '/app/academics' },
          { label: 'Open Analytics', route: '/app/analytics' }
        ];
      }
    }

    // --- Fallback Unknown Intent ---
    if (!responseMessage) {
      intent = 'UNKNOWN';
      responseMessage = "I'm not sure what you're looking for. I can help you find attendance, CGPA, SGPA, exams, timetable, analytics, study material and other Campus Hub features.";
      actions = [
        { label: 'Open Attendance', route: '/app/academics' },
        { label: 'Open Timetable', route: '/app/timetable' },
        { label: 'Open Study Material', route: '/app/study-material' },
        { label: 'Open Analytics', route: '/app/analytics' },
      ];
    }

    return res.json({
      message: responseMessage,
      intent,
      actions,
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
// Guarantees that no /api/* route EVER returns HTML (e.g. index.html or Express HTML error pages)
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
