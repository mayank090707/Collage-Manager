const API_BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '') || '/api';

// Helper — get current user ID
const getUserId = () => localStorage.getItem('college_manager_user_id');

// Helper — safely parse response body (JSON or text/HTML error fallback)
async function parseResponse(response: Response): Promise<any> {
  const text = await response.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch (_) {
    // Response was HTML or plain text (e.g. 404/500 page from proxy)
  }

  if (!response.ok) {
    const errorMsg = json?.error || (text.includes('<!DOCTYPE') ? `Server error (${response.status}): Endpoint not found or backend unreachable.` : text) || `Request failed with status ${response.status}`;
    throw new Error(errorMsg);
  }

  return json || {};
}

// Admin key for protected admin API calls
const ADMIN_KEY = 'AdminPassword123';

// Storage key → API field mapping
const DB_MAP: Record<string, string> = {
  'student_profile':  'profile',
  'subjects':         'subjects',
  'timetable':        'timetable',
  'attendance_records': 'attendanceRecords',
  'semester_data':    'semesterData',
  'semester_marks':   'semesterMarks',
  'backlogs':         'backlogs',
  'exam_calendar_v2': 'examCalendar',
  'target_cgpa':      'targetCgpa',
  'onboarding_complete': 'isOnboarded',
};

// GLOBAL INTERCEPTOR: any localStorage.setItem() for known keys auto-syncs to the backend
let isSyncing = false;
const originalSetItem = localStorage.setItem.bind(localStorage);
localStorage.setItem = function(key: string, value: string) {
  originalSetItem(key, value);
  if (isSyncing) return;

  const userId = getUserId();
  const dbKey  = DB_MAP[key];
  if (dbKey && userId) {
    let parsedValue: any = value;
    try { parsedValue = JSON.parse(value); } catch (_) {}
    // Convert string "true"/"false" for isOnboarded
    if (dbKey === 'isOnboarded') parsedValue = (value === 'true');

    fetch(`${API_BASE_URL}/user/${userId}/update`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ key: dbKey, value: parsedValue }),
    }).catch(err => console.warn('Auto-sync failed (will retry on next save):', err));
  }
};

export const api = {
  // ── Auth ────────────────────────────────────────────────────────────────
  async signup(credentials: any) {
    const response = await fetch(`${API_BASE_URL}/auth/signup`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(credentials),
    });
    return parseResponse(response);
  },

  async login(credentials: any) {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(credentials),
    });
    return parseResponse(response);
  },

  // ── Admin ────────────────────────────────────────────────────────────────
  async getAdminUsers() {
    const response = await fetch(`${API_BASE_URL}/admin/users`, {
      headers: { 'x-admin-key': ADMIN_KEY },
    });
    return parseResponse(response);
  },

  async getAdminStats() {
    const response = await fetch(`${API_BASE_URL}/admin/stats`, {
      headers: { 'x-admin-key': ADMIN_KEY },
    });
    return parseResponse(response);
  },

  async updateAdminUser(userData: any) {
    const response = await fetch(`${API_BASE_URL}/admin/users/update`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': ADMIN_KEY },
      body:    JSON.stringify(userData),
    });
    return parseResponse(response);
  },

  async createAdminUser(userData: any) {
    const response = await fetch(`${API_BASE_URL}/admin/users/create`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': ADMIN_KEY },
      body:    JSON.stringify(userData),
    });
    return parseResponse(response);
  },

  async deleteAdminUser(id: string) {
    const response = await fetch(`${API_BASE_URL}/admin/users/delete`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': ADMIN_KEY },
      body:    JSON.stringify({ id }),
    });
    return parseResponse(response);
  },

  // ── syncFromDB ───────────────────────────────────────────────────────────
  /**
   * Fetches the current user's data from MongoDB and restores it to localStorage.
   *
   * Returns:
   *   { data, isNewUser: true }  — no data found on server (brand new account)
   *   { data, isNewUser: false } — data found and restored
   *   null                       — network/server error (use cached localStorage)
   */
  async syncFromDB(): Promise<any> {
    const userId = getUserId();
    if (!userId) return null;

    try {
      const response = await fetch(`${API_BASE_URL}/user/${userId}`);

      // 404 = brand new user who has never onboarded
      if (response.status === 404) {
        console.log('[SYNC] No server data found for user — first-time user, showing onboarding.');
        return { isNewUser: true };
      }

      if (!response.ok) return null;

      const data = await response.json();

      isSyncing = true; // Pause the auto-sync interceptor while restoring
      let hasChanged = false;

      const setIfDifferent = (key: string, newValue: string) => {
        if (localStorage.getItem(key) !== newValue) {
          localStorage.setItem(key, newValue);
          hasChanged = true;
        }
      };

      if (data.profile)           setIfDifferent('student_profile',    JSON.stringify(data.profile));
      if (Array.isArray(data.subjects))          setIfDifferent('subjects',           JSON.stringify(data.subjects));
      if (Array.isArray(data.timetable))         setIfDifferent('timetable',          JSON.stringify(data.timetable));
      if (Array.isArray(data.attendanceRecords)) setIfDifferent('attendance_records', JSON.stringify(data.attendanceRecords));
      if (Array.isArray(data.semesterData))      setIfDifferent('semester_data',      JSON.stringify(data.semesterData));
      if (Array.isArray(data.semesterMarks))     setIfDifferent('semester_marks',     JSON.stringify(data.semesterMarks));
      if (Array.isArray(data.backlogs))          setIfDifferent('backlogs',           JSON.stringify(data.backlogs));
      if (data.examCalendar != null)             setIfDifferent('exam_calendar_v2',   JSON.stringify(data.examCalendar));
      if (data.targetCgpa   != null)             setIfDifferent('target_cgpa',        data.targetCgpa.toString());
      if (data.isOnboarded  != null)             setIfDifferent('onboarding_complete', data.isOnboarded.toString());

      isSyncing = false;

      if (hasChanged) {
        window.dispatchEvent(new Event('storage'));
      }

      return { ...data, isNewUser: false };
    } catch (error) {
      isSyncing = false;
      console.warn('[SYNC] Backend unreachable — using cached localStorage data.');
      return null;
    }
  },

  // ── updateField ──────────────────────────────────────────────────────────
  async updateField(key: string, value: any) {
    const userId = getUserId();
    if (!userId) return;
    try {
      await fetch(`${API_BASE_URL}/user/${userId}/update`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ key, value }),
      });
    } catch (error) {
      console.error('updateField failed:', error);
    }
  },

  // ── migrateLocalStorageToDB ──────────────────────────────────────────────
  /**
   * Pushes all current localStorage data to MongoDB.
   * Called at the end of onboarding to persist initial data.
   */
  async migrateLocalStorageToDB() {
    const userId = getUserId();
    if (!userId) return;

    const isOnboarded = localStorage.getItem('onboarding_complete') === 'true';

    const data = {
      profile:           JSON.parse(localStorage.getItem('student_profile') || 'null'),
      subjects:          JSON.parse(localStorage.getItem('subjects') || '[]'),
      timetable:         JSON.parse(localStorage.getItem('timetable') || '[]'),
      attendanceRecords: JSON.parse(localStorage.getItem('attendance_records') || '[]'),
      semesterData:      JSON.parse(localStorage.getItem('semester_data') || '[]'),
      semesterMarks:     JSON.parse(localStorage.getItem('semester_marks') || '[]'),
      backlogs:          JSON.parse(localStorage.getItem('backlogs') || '[]'),
      examCalendar:      JSON.parse(localStorage.getItem('exam_calendar_v2') || 'null'),
      targetCgpa:        parseFloat(localStorage.getItem('target_cgpa') || '0'),
      isOnboarded,
    };

    try {
      await fetch(`${API_BASE_URL}/user/${userId}/sync`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(data),
      });
      console.log('[SYNC] Onboarding data migrated to MongoDB.');
    } catch (error) {
      console.error('[SYNC] Migration failed:', error);
    }
  },

  mapToStorageKey(key: string): string {
    const maps: Record<string, string> = {
      profile:           'student_profile',
      subjects:          'subjects',
      timetable:         'timetable',
      attendanceRecords: 'attendance_records',
      semesterData:      'semester_data',
      semesterMarks:     'semester_marks',
      backlogs:          'backlogs',
      examCalendar:      'exam_calendar_v2',
      targetCgpa:        'target_cgpa',
    };
    return maps[key] || key;
  },
};
