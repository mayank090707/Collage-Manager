/**
 * Controlled Student Data Tool Layer for Campus AI
 *
 * Provides identity-verified helper functions to fetch only specific,
 * authorized student data from MongoDB.
 *
 * Security:
 *  - Client user IDs in message text are NEVER trusted.
 *  - ALWAYS verifies authenticated userId.
 *  - Returns minimal data necessary to fulfill user query.
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

/**
 * Get registered subject names and codes for authenticated user
 */
export async function getStudentSubjects(userId: string): Promise<Array<{ name: string; code?: string }>> {
  const userData = await fetchUserData(userId);
  if (!userData || !userData.subjects) return [];
  return userData.subjects.map((s: any) => ({
    name: typeof s === 'string' ? s : s.name || s.subject || '',
    code: typeof s === 'object' ? s.code : undefined,
  })).filter((s: any) => s.name.length > 0);
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
  multipleMatches?: string[];
}

/**
 * Compute overall and subject-level attendance stats
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

  subjects.forEach((subjectObj: any) => {
    const subjectName = typeof subjectObj === 'string' ? subjectObj : subjectObj.name;
    const subjectCode = typeof subjectObj === 'object' ? subjectObj.code : undefined;

    let attended = 0;
    let conducted = 0;

    records.forEach((record: any) => {
      if (!record.date) return;
      const parts = record.date.split("-").map(Number);
      if (parts.length !== 3) return;
      const [year, month, day] = parts;
      const dateObj = new Date(year, month - 1, day);
      const dayName = new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(dateObj);

      const slots = timetable.filter((t: any) => t.day === dayName && t.subject === subjectName);
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
        (k: string) => k.startsWith(`${subjectName}-`) && !processedKeys.has(k)
      ) || [];
      const manualCancelledEntries = record.cancelled?.filter(
        (c: any) => (c.subject === subjectName || c.key?.startsWith(`${subjectName}-`)) && !processedKeys.has(c.key)
      ) || [];
      const manualAbsentEntries = record.absentManual?.filter(
        (a: any) => (a.subject === subjectName || a.key?.startsWith(`${subjectName}-`)) && !processedKeys.has(a.key)
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
    const safeBunks = percentage >= 75 ? Math.max(0, Math.floor((attended - 0.75 * conducted) / 0.75)) : 0;

    subjectList.push({
      subject: subjectName,
      code: subjectCode,
      attended,
      total: conducted,
      absent: conducted - attended,
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
 * Get subject-specific attendance with fuzzy alias matching & ambiguity resolution
 */
export async function getSubjectAttendance(userId: string, subjectQuery?: string): Promise<AttendanceResult> {
  const overall = await getOverallAttendance(userId);
  if (!overall.found || !overall.hasData) return overall;

  if (!subjectQuery || !subjectQuery.trim()) {
    return overall;
  }

  const query = subjectQuery.toLowerCase().trim();
  const stats = overall.subjectStats || [];

  // Match 1: Exact match or code match
  const exact = stats.find(s => s.subject.toLowerCase() === query || (s.code && s.code.toLowerCase() === query));
  if (exact) {
    return { found: true, hasData: true, matchedSubject: exact, overallAttendance: overall.overallAttendance };
  }

  // Match 2: Contains substring match
  const matches = stats.filter(s =>
    s.subject.toLowerCase().includes(query) ||
    query.includes(s.subject.toLowerCase()) ||
    (s.code && s.code.toLowerCase().includes(query))
  );

  if (matches.length === 1) {
    return { found: true, hasData: true, matchedSubject: matches[0], overallAttendance: overall.overallAttendance };
  }

  if (matches.length > 1) {
    return {
      found: true,
      hasData: true,
      matchedSubject: null,
      multipleMatches: matches.map(m => m.subject),
      allSubjects: stats.map(s => s.subject),
      message: `Multiple subjects matched "${subjectQuery}": ${matches.map(m => m.subject).join(', ')}.`
    };
  }

  return {
    found: true,
    hasData: true,
    matchedSubject: null,
    allSubjects: stats.map(s => s.subject),
    message: `No exact subject match found for "${subjectQuery}". Registered subjects: ${stats.map(s => s.subject).join(', ')}.`
  };
}

/**
 * Academic subject comparison (lowest, highest, below 75%, safe)
 */
export async function compareSubjects(userId: string) {
  const overall = await getOverallAttendance(userId);
  if (!overall.found || !overall.hasData) return { found: false, message: "No attendance data available." };

  const stats = [...(overall.subjectStats || [])];
  if (stats.length === 0) return { found: true, hasData: false };

  stats.sort((a, b) => a.percentage - b.percentage);
  const lowest = stats[0];
  const highest = stats[stats.length - 1];

  const below75 = stats.filter(s => s.percentage < 75);
  const safe = stats.filter(s => s.safeBunks > 0);

  return {
    found: true,
    hasData: true,
    overallAttendance: overall.overallAttendance,
    lowest,
    highest,
    below75,
    safe,
    allStats: stats,
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
    return { found: true, hasMarks: false, cgpa: null, targetCgpa: userData.targetCgpa || 0 };
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
 * Get SGPA for specific semester or latest
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
      hasMarks: !!(sem && sem.sgpa !== -1),
      semester,
      sgpa: sem && sem.sgpa !== -1 ? sem.sgpa : null,
      results: sem ? sem.results : []
    };
  }

  const realSems = savedMarks.filter((s: any) => s.sgpa !== -1);
  if (realSems.length === 0) return { found: true, hasMarks: false };

  const latest = realSems[realSems.length - 1];
  return {
    found: true,
    hasMarks: true,
    semester: latest.semester,
    sgpa: latest.sgpa,
    allSemesters: realSems.map((s: any) => ({ semester: s.semester, sgpa: s.sgpa }))
  };
}

/**
 * Compare semesters (best, worst, trend)
 */
export async function compareSemesters(userId: string) {
  const userData = await fetchUserData(userId);
  if (!userData) return { found: false };

  const savedMarks = userData.semesterMarks || [];
  const realSems = savedMarks.filter((s: any) => s.sgpa !== -1);
  if (realSems.length === 0) return { found: true, hasMarks: false };

  const sorted = [...realSems].sort((a, b) => b.sgpa - a.sgpa);
  const bestSem = sorted[0];
  const worstSem = sorted[sorted.length - 1];

  let trend = "stable";
  if (realSems.length >= 2) {
    const last = realSems[realSems.length - 1].sgpa;
    const prev = realSems[realSems.length - 2].sgpa;
    if (last > prev) trend = "improving";
    else if (last < prev) trend = "declining";
  }

  return {
    found: true,
    hasMarks: true,
    bestSem,
    worstSem,
    trend,
    allSemesters: realSems.map((s: any) => ({ semester: s.semester, sgpa: s.sgpa })),
  };
}

/**
 * Get Target CGPA and Required SGPA calculation
 */
export async function getTargetCGPA(userId: string) {
  const userData = await fetchUserData(userId);
  if (!userData) return { found: false };

  const targetCgpa = userData.targetCgpa || 0;
  const profile = userData.profile || {};
  const currentSem = parseInt(profile.currentSemester) || 1;
  const savedMarks = userData.semesterMarks || [];

  const cgpaInfo = await getCGPA(userId);

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
 * Get marks and grades for semester/subject
 */
export async function getMarks(userId: string, semester?: number, subjectQuery?: string) {
  const userData = await fetchUserData(userId);
  if (!userData) return { found: false };

  const savedMarks = userData.semesterMarks || [];
  if (savedMarks.length === 0) return { found: true, hasMarks: false };

  const targetSem = semester || (savedMarks[savedMarks.length - 1]?.semester || 1);
  const semRecord = savedMarks.find((s: any) => s.semester === targetSem);

  if (!semRecord || !semRecord.results || semRecord.results.length === 0) {
    return { found: true, hasMarks: false, semester: targetSem };
  }

  let results = semRecord.results;
  if (subjectQuery) {
    const q = subjectQuery.toLowerCase().trim();
    results = results.filter((r: any) => r.subjectName?.toLowerCase().includes(q) || r.subjectCode?.toLowerCase().includes(q));
  }

  return {
    found: true,
    hasMarks: results.length > 0,
    semester: targetSem,
    results: results.map((r: any) => ({
      subjectName: r.subjectName,
      subjectCode: r.subjectCode,
      internal: r.internal,
      external: r.external,
      total: (r.internal ?? 0) + (r.external ?? 0),
      grade: r.grade,
      gradePoint: r.gradePoint,
      credits: r.credits,
    })),
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
    clearedBacklogs: cleared.map((b: any) => ({
      subjectName: b.subjectName,
      subjectCode: b.subjectCode,
      semester: b.semester,
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
 * Get Today's schedule and next class
 */
export async function getTodaysSchedule(userId: string) {
  const dayName = new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(new Date());
  return getTimetable(userId, dayName);
}

/**
 * Get Upcoming Exams
 */
export async function getUpcomingExams(userId: string) {
  const userData = await fetchUserData(userId);
  if (!userData) return { found: false };

  const calendar = userData.examCalendar;
  if (!calendar) return { found: true, hasExams: false, upcomingExams: [] };

  const dayEvents = calendar.dayEvents || [];
  const examPeriods = calendar.examPeriods || [];

  const todayStr = new Date().toISOString().split('T')[0];

  const upcomingEvents = dayEvents
    .filter((e: any) => e.date >= todayStr && e.examType !== 'holiday' && e.examType !== 'custom')
    .sort((a: any, b: any) => a.date.localeCompare(b.date));

  const upcomingPeriods = examPeriods
    .filter((p: any) => p.endDate >= todayStr)
    .sort((a: any, b: any) => a.startDate.localeCompare(b.startDate));

  return {
    found: true,
    hasExams: upcomingEvents.length > 0 || upcomingPeriods.length > 0,
    upcomingEvents: upcomingEvents.map((e: any) => ({
      label: e.label,
      date: e.date,
      examType: e.examType,
    })),
    upcomingPeriods: upcomingPeriods.map((p: any) => ({
      type: p.type,
      startDate: p.startDate,
      endDate: p.endDate,
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
    nextExam: exams.found && exams.upcomingEvents.length > 0 ? exams.upcomingEvents[0] : null,
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
