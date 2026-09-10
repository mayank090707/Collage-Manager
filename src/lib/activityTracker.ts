export interface ActivityLog {
  id: string;
  timestamp: string;
  isoDate: string;
  userId: string;
  userEmail: string;
  userName: string;
  actionType: string;
  category: "Login" | "Marks" | "Attendance" | "Profile" | "StudyMaterial" | "TargetPredictor" | "Timetable" | "System";
  description: string;
  status: "success" | "info" | "warning" | "error";
  deviceInfo?: string;
}

const STORAGE_KEY = "system_activity_logs";

// ─── Device Detection ──────────────────────────────────────────────────────
// Parses a User-Agent string into a clean "OS / Browser" string.
// Returns "Unknown Device" when indeterminate — never fabricates device info.
export function detectDevice(ua?: string): string {
  const str = ua || (typeof navigator !== "undefined" ? navigator.userAgent : "");
  if (!str) return "Unknown Device";

  // Detect OS/device type
  let os = "Unknown OS";
  if (/iPhone/i.test(str))                               os = "iPhone";
  else if (/iPad/i.test(str))                            os = "iPad";
  else if (/Android/i.test(str))                         os = "Android";
  else if (/Windows NT/i.test(str))                      os = "Windows PC";
  else if (/Macintosh|Mac OS X/i.test(str))              os = "macOS";
  else if (/Linux/i.test(str))                           os = "Linux";
  else if (/CrOS/i.test(str))                            os = "ChromeOS";

  // Detect browser (order matters — Edge before Chrome, Samsung before Chrome)
  let browser = "Unknown Browser";
  if (/Edg\//i.test(str))                               browser = "Edge";
  else if (/OPR\/|Opera/i.test(str))                    browser = "Opera";
  else if (/SamsungBrowser/i.test(str))                 browser = "Samsung Browser";
  else if (/Firefox\//i.test(str))                      browser = "Firefox";
  else if (/Chrome\//i.test(str) && !/Chromium/i.test(str)) browser = "Chrome";
  else if (/Chromium\//i.test(str))                     browser = "Chromium";
  else if (/Safari\//i.test(str) && !/Chrome\//i.test(str)) browser = "Safari";
  else if (/MSIE|Trident/i.test(str))                   browser = "Internet Explorer";

  // Combine: if both are known, show both; if only one, show that
  if (os !== "Unknown OS" && browser !== "Unknown Browser") return `${os} / ${browser}`;
  if (os !== "Unknown OS")      return os;
  if (browser !== "Unknown Browser") return browser;
  return "Unknown Device";
}

export const getActivities = (): ActivityLog[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error("Error parsing activity logs:", e);
  }

  // Seed default realistic activity logs if none exist
  const device = detectDevice();
  const seededLogs: ActivityLog[] = [
    {
      id: "act-101",
      timestamp: new Date(Date.now() - 3 * 60 * 1000).toLocaleString(),
      isoDate: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
      userId: "usr-student-1",
      userEmail: "demo@gmail.com",
      userName: "Mayank Verma",
      actionType: "LOGIN_SUCCESS",
      category: "Login",
      description: "Mayank Verma logged into student portal.",
      status: "success",
      deviceInfo: device,
    },
    {
      id: "act-102",
      timestamp: new Date(Date.now() - 8 * 60 * 1000).toLocaleString(),
      isoDate: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
      userId: "usr-student-1",
      userEmail: "demo@gmail.com",
      userName: "Mayank Verma",
      actionType: "MARKS_UPDATED",
      category: "Marks",
      description: "Updated Internal Assessment marks for 'Database Management Systems' (Semester 4) to 23/25.",
      status: "info",
      deviceInfo: device,
    },
    {
      id: "act-103",
      timestamp: new Date(Date.now() - 15 * 60 * 1000).toLocaleString(),
      isoDate: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      userId: "usr-student-1",
      userEmail: "demo@gmail.com",
      userName: "Mayank Verma",
      actionType: "ATTENDANCE_RECORDED",
      category: "Attendance",
      description: "Recorded attendance for 'Data Structures' (+1 Present). Current percentage: 86.4%.",
      status: "success",
      deviceInfo: device,
    },
    {
      id: "act-104",
      timestamp: new Date(Date.now() - 32 * 60 * 1000).toLocaleString(),
      isoDate: new Date(Date.now() - 32 * 60 * 1000).toISOString(),
      userId: "usr-student-1",
      userEmail: "demo@gmail.com",
      userName: "Mayank Verma",
      actionType: "STUDY_MATERIAL_DOWNLOAD",
      category: "StudyMaterial",
      description: "Downloaded resource 'Algorithms_Lecture_Notes_Unit2.pdf' from Study Material repository.",
      status: "info",
      deviceInfo: device,
    },
    {
      id: "act-105",
      timestamp: new Date(Date.now() - 50 * 60 * 1000).toLocaleString(),
      isoDate: new Date(Date.now() - 50 * 60 * 1000).toISOString(),
      userId: "usr-student-1",
      userEmail: "demo@gmail.com",
      userName: "Mayank Verma",
      actionType: "TARGET_CGPA_CALCULATED",
      category: "TargetPredictor",
      description: "Ran Target Predictor with target 9.20 CGPA. Target SGPA required: 9.65 for Semester 5.",
      status: "info",
      deviceInfo: device,
    },
    {
      id: "act-106",
      timestamp: new Date(Date.now() - 120 * 60 * 1000).toLocaleString(),
      isoDate: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
      userId: "usr-admin",
      userEmail: "admin@campus-hub.com",
      userName: "System Admin",
      actionType: "ADMIN_LOGIN",
      category: "System",
      description: "Super Admin authenticated using master credentials.",
      status: "warning",
      deviceInfo: device,
    },
  ];

  localStorage.setItem(STORAGE_KEY, JSON.stringify(seededLogs));
  return seededLogs;
};

export const logActivity = (
  actionType: string,
  description: string,
  category: ActivityLog["category"] = "System",
  userEmail?: string,
  userName?: string,
  status: ActivityLog["status"] = "info",
  deviceInfoOverride?: string
): ActivityLog => {
  const logs = getActivities();

  let currentProfile: any = {};
  try {
    const profileStr = localStorage.getItem("student_profile");
    if (profileStr) currentProfile = JSON.parse(profileStr);
  } catch (e) {}

  const currentUserId = localStorage.getItem("college_manager_user_id") || "usr-guest";
  const userRole = localStorage.getItem("user_role");

  const resolvedEmail =
    userEmail ||
    (userRole === "admin" ? "admin@campus-hub.com" : currentProfile.email || "student@ipu.ac.in");
  const resolvedName =
    userName ||
    (userRole === "admin" ? "System Admin" : currentProfile.fullName || "Student User");

  // Use override → live UA detection → "Unknown Device"
  const deviceInfo = deviceInfoOverride || detectDevice();

  const newLog: ActivityLog = {
    id: "act-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
    timestamp: new Date().toLocaleString(),
    isoDate: new Date().toISOString(),
    userId: currentUserId,
    userEmail: resolvedEmail,
    userName: resolvedName,
    actionType,
    category,
    description,
    status,
    deviceInfo,
  };

  const updated = [newLog, ...logs].slice(0, 150); // Keep latest 150 activity records
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return newLog;
};

export const clearActivities = () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
};
