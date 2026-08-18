/**
 * Shared academic calculation utilities.
 * All CGPA/SGPA logic in the app should use these helpers
 * so every page shows the same number.
 */

export interface SavedSemesterEntry {
  semester: number;
  results: { credits: number; gradePoint: number; internal?: number; external?: number }[];
  sgpa: number;
}

/**
 * Returns only semesters that have real marks entered (sgpa !== -1 sentinel
 * AND at least one subject with marks > 0).
 * This guards against both:
 *  • The current-semester placeholder saved with sgpa = -1
 *  • Old data saved before the sentinel was introduced (sgpa = 0, no marks)
 */
export function getRealSemesters(savedMarks: SavedSemesterEntry[]): SavedSemesterEntry[] {
  return savedMarks.filter((s) => {
    if (s.sgpa === -1) return false;
    const hasMarks = s.results.some(
      (r) => (r.internal ?? 0) > 0 || (r.external ?? 0) > 0
    );
    return hasMarks;
  });
}

/**
 * Credit-weighted CGPA across all semesters with real marks.
 * Formula:  CGPA = Σ(GP_i × Credit_i) / Σ(Credit_i)  for all subjects in all real semesters.
 * Returns null when no real marks exist yet.
 */
export function computeCGPA(savedMarks: SavedSemesterEntry[]): number | null {
  const real = getRealSemesters(savedMarks);
  if (real.length === 0) return null;
  const allResults = real.flatMap((s) => s.results);
  const tc = allResults.reduce((sum, r) => sum + (r.credits || 0), 0);
  const wp = allResults.reduce((sum, r) => sum + (r.gradePoint || 0) * (r.credits || 0), 0);
  return tc > 0 ? wp / tc : null;
}

/**
 * Read semester_marks from localStorage, compute credit-weighted CGPA.
 * Returns null if no marks have been saved.
 */
export function getCGPAFromStorage(): number | null {
  const savedMarks: SavedSemesterEntry[] = JSON.parse(
    localStorage.getItem("semester_marks") || "[]"
  );
  return computeCGPA(savedMarks);
}

/**
 * Required SGPA for the current semester so that simple-average CGPA = target.
 * Formula: reqSGPA = (targetCGPA × currentSemNum) − sumOfPreviousSGPAs
 * Returns null if target <= 0 OR if currentSemNum > 1 and no previous semester results are saved.
 */
export function computeRequiredSGPA(
  savedMarks: SavedSemesterEntry[],
  targetCgpa: number,
  currentSemNum: number
): number | null {
  if (targetCgpa <= 0) return null;
  const real = getRealSemesters(savedMarks);
  const prevReal = real.filter((m) => m.semester < currentSemNum);

  // If in semester > 1, require previous semester results to be entered first
  if (currentSemNum > 1 && prevReal.length === 0) {
    return null;
  }

  const sumPrev = prevReal.reduce((acc, m) => acc + (m.sgpa || 0), 0);
  return Math.max(0, targetCgpa * currentSemNum - sumPrev);
}

/**
 * Unified Attendance Calculation Helper.
 * All views (Dashboard, Academics AttendanceTab, Analytics, Profile)
 * use this function to calculate overall attendance %, subject stats,
 * total attended, and total conducted classes.
 */
export interface SubjectAttendanceStat {
  subject: string;
  code?: string;
  credits?: number;
  attended: number;
  total: number;
  percentage: number;
  classesNeeded: number;
  safeBunks: number;
}

export interface OverallAttendanceResult {
  overallAttendance: number;
  totalAttended: number;
  totalConducted: number;
  subjectStats: Record<string, SubjectAttendanceStat>;
  subjectList: SubjectAttendanceStat[];
  hasData: boolean;
}

export function computeAttendanceStats(): OverallAttendanceResult {
  const subjectsStr = localStorage.getItem("subjects");
  const recordsStr = localStorage.getItem("attendance_records");
  const timetableStr = localStorage.getItem("timetable");

  if (!subjectsStr || !recordsStr || !timetableStr) {
    return {
      overallAttendance: 0,
      totalAttended: 0,
      totalConducted: 0,
      subjectStats: {},
      subjectList: [],
      hasData: false,
    };
  }

  let subjects: { id: string; name: string; code: string; credits: number }[] = [];
  let records: { date: string; subjects: string[]; cancelled?: { key: string; subject?: string; period?: number }[]; absentManual?: { key: string; subject: string; period: number }[] }[] = [];
  let timetable: { day: string; subject: string; period: number }[] = [];

  try {
    subjects = JSON.parse(subjectsStr);
    records = JSON.parse(recordsStr);
    timetable = JSON.parse(timetableStr);
  } catch {
    return {
      overallAttendance: 0,
      totalAttended: 0,
      totalConducted: 0,
      subjectStats: {},
      subjectList: [],
      hasData: false,
    };
  }

  if (subjects.length === 0 || records.length === 0 || timetable.length === 0) {
    return {
      overallAttendance: 0,
      totalAttended: 0,
      totalConducted: 0,
      subjectStats: {},
      subjectList: [],
      hasData: false,
    };
  }

  let grandAttended = 0;
  let grandConducted = 0;
  const statsMap: Record<string, SubjectAttendanceStat> = {};
  const statsList: SubjectAttendanceStat[] = [];

  subjects.forEach((subject) => {
    let attended = 0;
    let conducted = 0;

    records.forEach((record) => {
      const parts = record.date.split("-").map(Number);
      if (parts.length !== 3) return;
      const [year, month, day] = parts;
      const dateObj = new Date(year, month - 1, day);
      const dayName = new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(dateObj);

      const slots = timetable.filter((t) => t.day === dayName && t.subject === subject.name);
      const processedKeys = new Set<string>();

      // A) Process timetable slots for this subject
      slots.forEach((slot) => {
        const key = `${slot.subject}-${slot.period}`;
        processedKeys.add(key);
        const isCancelled = record.cancelled?.some((c) => c.key === key);
        if (!isCancelled) {
          conducted++;
          if (record.subjects?.includes(key)) {
            attended++;
          }
        }
      });

      // B) Process extra/manual slots recorded for this subject on this date
      const manualAttendedKeys = record.subjects?.filter(
        (k) => k.startsWith(`${subject.name}-`) && !processedKeys.has(k)
      ) || [];
      
      const manualCancelledEntries = record.cancelled?.filter(
        (c) => (c.subject === subject.name || c.key?.startsWith(`${subject.name}-`)) && !processedKeys.has(c.key)
      ) || [];

      // Also include absent manual slots (extra classes the user added but was absent for)
      const manualAbsentEntries = record.absentManual?.filter(
        (a) => (a.subject === subject.name || a.key?.startsWith(`${subject.name}-`)) && !processedKeys.has(a.key)
      ) || [];

      // Combine unique extra keys
      const extraKeys = new Set<string>([
        ...manualAttendedKeys,
        ...manualCancelledEntries.map((c) => c.key),
        ...manualAbsentEntries.map((a) => a.key),
      ]);

      extraKeys.forEach((key) => {
        const isCancelled = record.cancelled?.some((c) => c.key === key);
        if (!isCancelled) {
          conducted++;
          if (record.subjects?.includes(key)) {
            attended++;
          }
        }
      });
    });

    grandAttended += attended;
    grandConducted += conducted;

    const percentage = conducted > 0 ? (attended / conducted) * 100 : 0;
    const classesNeeded = Math.max(0, Math.ceil((0.75 * conducted - attended) / 0.25));
    const safeBunks = percentage > 75 ? Math.max(0, Math.floor((attended - 0.75 * conducted) / 0.75)) : 0;

    const statItem: SubjectAttendanceStat = {
      subject: subject.name,
      code: subject.code,
      credits: subject.credits,
      attended,
      total: conducted,
      percentage: parseFloat(percentage.toFixed(1)),
      classesNeeded,
      safeBunks,
    };

    statsMap[subject.name] = statItem;
    statsList.push(statItem);
  });

  const overallAttendance = grandConducted > 0 ? parseFloat(((grandAttended / grandConducted) * 100).toFixed(1)) : 0;

  return {
    overallAttendance,
    totalAttended: grandAttended,
    totalConducted: grandConducted,
    subjectStats: statsMap,
    subjectList: statsList,
    hasData: grandConducted > 0,
  };
}

/**
 * Standard period timing definitions used across Timetable and Dashboard.
 */
export const PERIOD_TIMINGS: Record<number, string> = {
  1: "9:30 – 10:20 AM",
  2: "10:20 – 11:10 AM",
  3: "11:10 – 12:00 PM",
  4: "12:00 – 12:50 PM",
  5: "1:40 – 2:30 PM",
  6: "2:30 – 3:20 PM",
  7: "3:20 – 4:10 PM",
  8: "4:10 – 5:00 PM",
};

export const PERIOD_TIMINGS_MAP: Record<number, { display: string; startMin: number; endMin: number }> = {
  1: { display: "09:30 AM – 10:20 AM", startMin: 9 * 60 + 30, endMin: 10 * 60 + 20 },
  2: { display: "10:20 AM – 11:10 AM", startMin: 10 * 60 + 20, endMin: 11 * 60 + 10 },
  3: { display: "11:10 AM – 12:00 PM", startMin: 11 * 60 + 10, endMin: 12 * 60 },
  4: { display: "12:00 PM – 12:50 PM", startMin: 12 * 60, endMin: 12 * 60 + 50 },
  5: { display: "01:40 PM – 02:30 PM", startMin: 13 * 60 + 40, endMin: 14 * 60 + 30 },
  6: { display: "02:30 PM – 03:20 PM", startMin: 14 * 60 + 30, endMin: 15 * 60 + 20 },
  7: { display: "03:20 PM – 04:10 PM", startMin: 15 * 60 + 20, endMin: 16 * 60 + 10 },
  8: { display: "04:10 PM – 05:00 PM", startMin: 16 * 60 + 10, endMin: 17 * 60 },
};


