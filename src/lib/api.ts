const API_BASE_URL = '/api';

// Helper to get current user ID
const getUserId = () => localStorage.getItem('college_manager_user_id');

// Storage key to API field mapping
const DB_MAP: Record<string, string> = {
  'student_profile': 'profile',
  'subjects': 'subjects',
  'timetable': 'timetable',
  'attendance_records': 'attendanceRecords',
  'semester_data': 'semesterData',
  'semester_marks': 'semesterMarks',
  'backlogs': 'backlogs',
  'exam_calendar_v2': 'examCalendar',
  'target_cgpa': 'targetCgpa',
  'onboarding_complete': 'isOnboarded'
};

// GLOBAL INTERCEPTOR:
// This ensures that any component calling localStorage.setItem 
// automatically triggers a sync to the backend database.
let isSyncing = false;
const originalSetItem = localStorage.setItem;
localStorage.setItem = function(key, value) {
  originalSetItem.apply(this, arguments as any);
  
  if (isSyncing) return; // Prevent loop during DB sync

  const userId = getUserId();
  const dbKey = DB_MAP[key];
  if (dbKey && userId) {
    let parsedValue = value;
    try { parsedValue = JSON.parse(value); } catch(e) {}
    
    fetch(`${API_BASE_URL}/user/${userId}/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: dbKey, value: parsedValue }),
    }).catch(err => console.error('Auto-sync failed:', err));
  }
};

/**
 * Generic API client to handle database operations.
 * Server-side database (db.json) is the Source of Truth.
 */
export const api = {
  async signup(credentials: any) {
    const response = await fetch(`${API_BASE_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });
    if (!response.ok) throw new Error((await response.json()).error || 'Signup failed');
    return response.json();
  },

  async login(credentials: any) {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });
    if (!response.ok) throw new Error((await response.json()).error || 'Login failed');
    return response.json();
  },

  async getAdminUsers() {
    const response = await fetch(`${API_BASE_URL}/admin/users`);
    if (!response.ok) throw new Error('Failed to fetch admin users');
    return response.json();
  },

  async updateAdminUser(userData: any) {
    const response = await fetch(`${API_BASE_URL}/admin/users/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData),
    });
    if (!response.ok) throw new Error('Failed to update user');
    return response.json();
  },

  async createAdminUser(userData: any) {
    const response = await fetch(`${API_BASE_URL}/admin/users/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData),
    });
    if (!response.ok) throw new Error((await response.json()).error || 'Failed to create user');
    return response.json();
  },

  async deleteAdminUser(id: string) {
    const response = await fetch(`${API_BASE_URL}/admin/users/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (!response.ok) throw new Error('Failed to delete user');
    return response.json();
  },

  /**
   * Fetches state from server (Source of Truth) and safely updates localStorage cache.
   * If server data is empty while localStorage has data, logs conflict and syncs local data up.
   */
  async syncFromDB() {
    const userId = getUserId();
    if (!userId) return null;

    try {
      const response = await fetch(`${API_BASE_URL}/user/${userId}`);
      if (!response.ok) return null;
      
      const data = await response.json();
      const localProfileStr = localStorage.getItem('student_profile');

      // CONFLICT DETECTION: Server has no profile, but local storage has cached profile
      if (!data.profile && localProfileStr) {
        console.warn('[SYNC CONFLICT] Server returned unpopulated profile while localStorage holds valid user profile. Triggering safe migration to server...');
        await this.migrateLocalStorageToDB();
        return data;
      }
      
      // Update localStorage with fresh DB data safely
      isSyncing = true; // Start bypassing interceptor
      if (data.profile) {
        localStorage.setItem('student_profile', JSON.stringify(data.profile));
      }
      if (Array.isArray(data.subjects) && (data.subjects.length > 0 || !localStorage.getItem('subjects'))) {
        localStorage.setItem('subjects', JSON.stringify(data.subjects));
      }
      if (Array.isArray(data.timetable) && (data.timetable.length > 0 || !localStorage.getItem('timetable'))) {
        localStorage.setItem('timetable', JSON.stringify(data.timetable));
      }
      if (Array.isArray(data.attendanceRecords) && (data.attendanceRecords.length > 0 || !localStorage.getItem('attendance_records'))) {
        localStorage.setItem('attendance_records', JSON.stringify(data.attendanceRecords));
      }
      if (Array.isArray(data.semesterData) && (data.semesterData.length > 0 || !localStorage.getItem('semester_data'))) {
        localStorage.setItem('semester_data', JSON.stringify(data.semesterData));
      }
      if (Array.isArray(data.semesterMarks) && (data.semesterMarks.length > 0 || !localStorage.getItem('semester_marks'))) {
        localStorage.setItem('semester_marks', JSON.stringify(data.semesterMarks));
      }
      if (Array.isArray(data.backlogs) && (data.backlogs.length > 0 || !localStorage.getItem('backlogs'))) {
        localStorage.setItem('backlogs', JSON.stringify(data.backlogs));
      }
      if (data.examCalendar) {
        localStorage.setItem('exam_calendar_v2', JSON.stringify(data.examCalendar));
      }
      if (data.targetCgpa !== undefined && data.targetCgpa !== null) {
        localStorage.setItem('target_cgpa', data.targetCgpa.toString());
      }
      if (data.isOnboarded !== undefined && data.isOnboarded !== null) {
        localStorage.setItem('onboarding_complete', data.isOnboarded.toString());
      }
      isSyncing = false; // End bypassing interceptor
      
      return data;
    } catch (error) {
      isSyncing = false;
      console.warn('Backend sync failed, using cached local storage.', error);
      return null;
    }
  },

  /**
   * Updates a specific data field in the DB
   */
  async updateField(key: string, value: any) {
    const userId = getUserId();
    if (!userId) return;

    try {
      const response = await fetch(`${API_BASE_URL}/user/${userId}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      });
      return response.json();
    } catch (error) {
      console.error('Update failed:', error);
    }
  },

  /**
   * Migrates all current local storage data to the DB
   */
  async migrateLocalStorageToDB() {
    const userId = getUserId();
    if (!userId) return;

    const data = {
      profile: JSON.parse(localStorage.getItem('student_profile') || 'null'),
      subjects: JSON.parse(localStorage.getItem('subjects') || '[]'),
      timetable: JSON.parse(localStorage.getItem('timetable') || '[]'),
      attendanceRecords: JSON.parse(localStorage.getItem('attendance_records') || '[]'),
      semesterData: JSON.parse(localStorage.getItem('semester_data') || '[]'),
      semesterMarks: JSON.parse(localStorage.getItem('semester_marks') || '[]'),
      backlogs: JSON.parse(localStorage.getItem('backlogs') || '[]'),
      examCalendar: JSON.parse(localStorage.getItem('exam_calendar_v2') || 'null'),
      targetCgpa: parseFloat(localStorage.getItem('target_cgpa') || '0'),
      isOnboarded: localStorage.getItem('onboarding_complete') === 'true'
    };

    try {
      const response = await fetch(`${API_BASE_URL}/user/${userId}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return response.json();
    } catch (error) {
      console.error('Migration failed:', error);
    }
  },

  mapToStorageKey(key: string): string {
    const maps: Record<string, string> = {
      profile: 'student_profile',
      subjects: 'subjects',
      timetable: 'timetable',
      attendanceRecords: 'attendance_records',
      semesterData: 'semester_data',
      semesterMarks: 'semester_marks',
      backlogs: 'backlogs',
      examCalendar: 'exam_calendar_v2',
      targetCgpa: 'target_cgpa'
    };
    return maps[key] || key;
  }
};
