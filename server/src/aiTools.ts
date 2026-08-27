/**
 * Controlled Student Data Tool Layer for Campus AI
 *
 * Provides identity-verified helper functions to fetch only specific,
 * authorized student data from MongoDB.
 *
 * Rules:
 *  - NEVER queries database directly from client or raw AI prompt.
 *  - ALWAYS verifies userId.
 *  - Returns minimal data necessary to fulfill user query.
 *  - Returns clean fallback objects/null if student data is not found.
 */

import { db } from './DB';

export interface StudentDataResponse {
  userId: string;
  found: boolean;
  data: any;
}

/**
 * Fetch raw userData for authenticated userId
 */
async function fetchUserData(userId: string) {
  if (!userId) return null;
  const userData = await db.find('userData', d => d.userId === userId);
  return userData || null;
}

export interface AttendanceResult {
  found: boolean;
  hasData?: boolean;
  overallAttendance?: number;
  totalAttended?: number;
  totalConducted?: number;
  subjectStats?: any[];
  message?: string;
  matchedSubject?: any;
  allSubjects?: string[];
}

/**
 * Helper to compute overall and subject-level attendance stats
 */
export async function getOverallAttendance(userId: string): Promise<AttendanceResult> {
  const userData = await fetchUserData(userId);
  if (!userData) return { found: false, message: "No Campus Hub account data found." };

  const subjects = userData.subjects || [];
  const records = userData.attendanceRecords || [];
  const timetable = userData.timetable || [];

  if (subjects.length === 0 || records.length === 0) {
    return {
      found: true,
      hasData: false,
      overallAttendance: 0,
      totalAttended: 0,
      totalConducted: 0,
      subjectStats: [],
      message: "No attendance records logged yet."
    };
  }

  let grandAttended = 0;
  let grandConducted = 0;
  const subjectList: any[] = [];

  subjects.forEach((subject: any) => {
    let attended = 0;
    let conducted = 0;

    records.forEach((record: any) => {
      if (!record.date) return;
      const parts = record.date.split("-").map(Number);
      if (parts.length !== 3) return;
      const [year, month, day] = parts;
      const dateObj = new Date(year, month - 1, day);
      const dayName = new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(dateObj);

      const slots = timetable.filter((t: any) => t.day === dayName && t.subject === subject.name);
      const processedKeys = new Set<string>();

      slots.forEach((slot: any) => {
        const key = `${slot.subject}-${slot.period}`;
        processedKeys.add(key);
        const isCancelled = record.cancelled?.some((c: any) => c.key === key);
        if (!isCancelled) {
          conducted++;
          if (record.subjects?.includes(key)) attended++;
        }
      });

      const manualAttendedKeys = record.subjects?.filter(
        (k: string) => k.startsWith(`${subject.name}-`) && !processedKeys.has(k)
      ) || [];
      const manualCancelledEntries = record.cancelled?.filter(
        (c: any) => (c.subject === subject.name || c.key?.startsWith(`${subject.name}-`)) && !processedKeys.has(c.key)
      ) || [];
      const manualAbsentEntries = record.absentManual?.filter(
        (a: any) => (a.subject === subject.name || a.key?.startsWith(`${subject.name}-`)) && !processedKeys.has(a.key)
      ) || [];

      const extraKeys = new Set<string>([
        ...manualAttendedKeys,
        ...manualCancelledEntries.map((c: any) => c.key),
        ...manualAbsentEntries.map((a: any) => a.key),
      ]);

      extraKeys.forEach((key) => {
        const isCancelled = record.cancelled?.some((c: any) => c.key === key);
        if (!isCancelled) {
          conducted++;
          if (record.subjects?.includes(key)) attended++;
        }
      });
    });

    grandAttended += attended;
    grandConducted += conducted;

    const percentage = conducted > 0 ? parseFloat(((attended / conducted) * 100).toFixed(1)) : 0;
    const classesNeeded = Math.max(0, Math.ceil((0.75 * conducted - attended) / 0.25));
    const safeBunks = percentage > 75 ? Math.max(0, Math.floor((attended - 0.75 * conducted) / 0.75)) : 0;

    subjectList.push({
      subject: subject.name,
      code: subject.code,
      attended,
      total: conducted,
      percentage,
      classesNeeded,
      safeBunks,
    });
  });

  const overallAttendance = grandConducted > 0 ? parseFloat(((grandAttended / grandConducted) * 100).toFixed(1)) : 0;

  return {
    found: true,
    hasData: grandConducted > 0,
    overallAttendance,
    totalAttended: grandAttended,
    totalConducted: grandConducted,
    subjectStats: subjectList,
  };
}

/**
 * Get subject-specific attendance & safe bunks
 */
export async function getSubjectAttendance(userId: string, subjectQuery?: string): Promise<AttendanceResult> {
  const overall = await getOverallAttendance(userId);
  if (!overall.found || !overall.hasData) return overall;

  if (!subjectQuery || !subjectQuery.trim()) {
    return overall;
  }

  const query = subjectQuery.toLowerCase().trim();
  const matched = (overall.subjectStats || []).find((s: any) =>
    s.subject.toLowerCase().includes(query) || (s.code && s.code.toLowerCase().includes(query))
  );

  if (!matched) {
    return {
      found: true,
      hasData: true,
      matchedSubject: null,
      allSubjects: (overall.subjectStats || []).map((s: any) => s.subject),
      message: `No exact subject match found for "${subjectQuery}".`
    };
  }

  return {
    found: true,
    hasData: true,
    matchedSubject: matched,
    overallAttendance: overall.overallAttendance
  };
}

/**
 * Compute CGPA
 */
export async function getCGPA(userId: string) {
  const userData = await fetchUserData(userId);
  if (!userData) return { found: false };

  const savedMarks = userData.semesterMarks || [];
  const realSems = savedMarks.filter((s: any) => {
    if (s.sgpa === -1) return false;
    return s.results && s.results.some((r: any) => (r.internal ?? 0) > 0 || (r.external ?? 0) > 0);
  });

  if (realSems.length === 0) {
    return { found: true, hasMarks: false, cgpa: null };
  }

  const allResults = realSems.flatMap((s: any) => s.results || []);
  const tc = allResults.reduce((sum: number, r: any) => sum + (r.credits || 0), 0);
  const wp = allResults.reduce((sum: number, r: any) => sum + (r.gradePoint || 0) * (r.credits || 0), 0);
  const cgpa = tc > 0 ? parseFloat((wp / tc).toFixed(2)) : null;

  return {
    found: true,
    hasMarks: true,
    cgpa,
    evaluatedSemestersCount: realSems.length,
    targetCgpa: userData.targetCgpa || 0,
  };
}

/**
 * Get SGPA for a semester
 */
export async function getSGPA(userId: string, semester?: number) {
  const userData = await fetchUserData(userId);
  if (!userData) return { found: false };

  const savedMarks = userData.semesterMarks || [];
  if (savedMarks.length === 0) return { found: true, hasMarks: false };

  if (semester) {
    const sem = savedMarks.find((s: any) => s.semester === semester);
    return {
      found: true,
      semester,
      sgpa: sem && sem.sgpa !== -1 ? sem.sgpa : null,
      results: sem ? sem.results : []
    };
  }

  // Return latest semester
  const realSems = savedMarks.filter((s: any) => s.sgpa !== -1);
  if (realSems.length === 0) return { found: true, hasMarks: false };

  const latest = realSems[realSems.length - 1];
  return {
    found: true,
    semester: latest.semester,
    sgpa: latest.sgpa,
    allSemesters: realSems.map((s: any) => ({ semester: s.semester, sgpa: s.sgpa }))
  };
}

/**
 * Get Target CGPA and Required SGPA
 */
export async function getTargetCGPA(userId: string) {
  const userData = await fetchUserData(userId);
  if (!userData) return { found: false };

  const targetCgpa = userData.targetCgpa || 0;
  const profile = userData.profile || {};
  const currentSem = parseInt(profile.currentSemester) || 1;
  const savedMarks = userData.semesterMarks || [];

  const cgpaInfo = await getCGPA(userId);

  // Compute required SGPA
  let requiredSgpa: number | null = null;
  if (targetCgpa > 0) {
    const realSems = savedMarks.filter((s: any) => s.sgpa !== -1 && s.results?.some((r: any) => (r.internal ?? 0) > 0 || (r.external ?? 0) > 0));
    const prevReal = realSems.filter((m: any) => m.semester < currentSem);
    if (currentSem === 1 || prevReal.length > 0) {
      const sumPrev = prevReal.reduce((acc: number, m: any) => acc + (m.sgpa || 0), 0);
      requiredSgpa = Math.max(0, parseFloat((targetCgpa * currentSem - sumPrev).toFixed(2)));
    }
  }

  return {
    found: true,
    currentCgpa: cgpaInfo.cgpa,
    targetCgpa,
    currentSemester: currentSem,
    requiredSgpa,
  };
}

/**
 * Get Backlogs
 */
export async function getBacklogs(userId: string) {
  const userData = await fetchUserData(userId);
  if (!userData) return { found: false };

  const backlogs = userData.backlogs || [];
  const active = backlogs.filter((b: any) => b.status === 'active' || b.status === 'registered');
  const cleared = backlogs.filter((b: any) => b.status === 'cleared');

  return {
    found: true,
    activeCount: active.length,
    clearedCount: cleared.length,
    totalCount: backlogs.length,
    activeBacklogs: active.map((b: any) => ({
      subjectName: b.subjectName,
      subjectCode: b.subjectCode,
      semester: b.semester,
      status: b.status,
    })),
  };
}

/**
 * Get Timetable for specific day or today
 */
export async function getTimetable(userId: string, dayQuery?: string) {
  const userData = await fetchUserData(userId);
  if (!userData) return { found: false };

  const timetable = userData.timetable || [];
  if (timetable.length === 0) return { found: true, hasSchedule: false, timetable: [] };

  const targetDay = dayQuery ? dayQuery.trim() : new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(new Date());

  const daySchedule = timetable.filter((t: any) => t.day.toLowerCase() === targetDay.toLowerCase());

  return {
    found: true,
    hasSchedule: daySchedule.length > 0,
    day: targetDay,
    schedule: daySchedule.map((t: any) => ({
      subject: t.subject,
      period: t.period,
    })),
    totalPeriods: daySchedule.length,
  };
}

/**
 * Get Upcoming Exams
 */
export async function getUpcomingExams(userId: string) {
  const userData = await fetchUserData(userId);
  if (!userData) return { found: false };

  const calendar = userData.examCalendar;
  if (!calendar || !calendar.exams || calendar.exams.length === 0) {
    return { found: true, hasExams: false, upcomingExams: [] };
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const upcoming = calendar.exams
    .filter((e: any) => e.date >= todayStr)
    .sort((a: any, b: any) => a.date.localeCompare(b.date));

  return {
    found: true,
    hasExams: upcoming.length > 0,
    upcomingExams: upcoming.slice(0, 5).map((e: any) => ({
      subjectName: e.subjectName,
      examType: e.examType,
      date: e.date,
      startTime: e.startTime,
      duration: e.duration,
      room: e.room,
    })),
  };
}

/**
 * Academic Summary (combines Attendance, CGPA, Backlogs, Next Exam)
 */
export async function getAcademicSummary(userId: string) {
  const [att, cgpa, backlogs, exams, profileData] = await Promise.all([
    getOverallAttendance(userId),
    getCGPA(userId),
    getBacklogs(userId),
    getUpcomingExams(userId),
    fetchUserData(userId)
  ]);

  const profile = profileData?.profile || {};

  return {
    found: true,
    studentName: profile.fullName || "Student",
    currentSemester: profile.currentSemester || "N/A",
    branch: profile.branch || "N/A",
    overallAttendance: att.found ? att.overallAttendance : 0,
    cgpa: cgpa.found ? cgpa.cgpa : null,
    targetCgpa: profileData?.targetCgpa || 0,
    activeBacklogsCount: backlogs.found ? backlogs.activeCount : 0,
    nextExam: exams.found && exams.upcomingExams.length > 0 ? exams.upcomingExams[0] : null,
  };
}

/**
 * Placement Readiness Evaluation
 */
export async function getPlacementReadiness(userId: string) {
  const summary = await getAcademicSummary(userId);
  if (!summary.found) return { found: false };

  const cgpa = summary.cgpa || 0;
  const backlogs = summary.activeBacklogsCount;
  const attendance = summary.overallAttendance || 0;

  let score = 0;
  let status = "Needs Improvement";

  if (cgpa >= 8.5) score += 40;
  else if (cgpa >= 7.5) score += 30;
  else if (cgpa >= 6.5) score += 20;

  if (backlogs === 0) score += 30;
  else score += 10;

  if (attendance >= 85) score += 30;
  else if (attendance >= 75) score += 20;
  else score += 10;

  if (score >= 80) status = "High Placement Readiness (Tier 1 Ready)";
  else if (score >= 60) status = "Moderate Placement Readiness";

  return {
    found: true,
    readinessScore: score,
    status,
    cgpa,
    activeBacklogs: backlogs,
    overallAttendance: attendance,
  };
}
