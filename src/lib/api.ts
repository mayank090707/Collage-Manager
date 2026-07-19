const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:5000/api'
  : '/api';

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
 * It also maintains a local sync to keep the app feeling fast.
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

  /**
   * Fetches the entire state from the server and populates localStorage
   */
  async syncFromDB() {
    const userId = getUserId();
    if (!userId) return null;

    try {
      const response = await fetch(`${API_BASE_URL}/user/${userId}`);
      if (!response.ok) return null;
      
      const data = await response.json();
      
      // Update localStorage with fresh DB data
      isSyncing = true; // Start bypassing interceptor
      if (data.profile) localStorage.setItem('student_profile', JSON.stringify(data.profile));
      if (data.subjects) localStorage.setItem('subjects', JSON.stringify(data.subjects));
      if (data.timetable) localStorage.setItem('timetable', JSON.stringify(data.timetable));
      if (data.attendanceRecords) localStorage.setItem('attendance_records', JSON.stringify(data.attendanceRecords));
      if (data.semesterData) localStorage.setItem('semester_data', JSON.stringify(data.semesterData));
      if (data.semesterMarks) localStorage.setItem('semester_marks', JSON.stringify(data.semesterMarks));
      if (data.backlogs) localStorage.setItem('backlogs', JSON.stringify(data.backlogs));
      if (data.examCalendar) localStorage.setItem('exam_calendar_v2', JSON.stringify(data.examCalendar));
      if (data.targetCgpa) localStorage.setItem('target_cgpa', data.targetCgpa.toString());
      if (data.isOnboarded) localStorage.setItem('onboarding_complete', data.isOnboarded.toString());
      isSyncing = false; // End bypassing interceptor
      
      return data;
    } catch (error) {
      isSyncing = false;
      console.warn('Backend offline, using local storage.');
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
