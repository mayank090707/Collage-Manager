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
 */
export function computeRequiredSGPA(
  savedMarks: SavedSemesterEntry[],
  targetCgpa: number,
  currentSemNum: number
): number {
  const real = getRealSemesters(savedMarks);
  const prevReal = real.filter((m) => m.semester < currentSemNum);
  const sumPrev = prevReal.reduce((acc, m) => acc + (m.sgpa || 0), 0);
  return Math.max(0, targetCgpa * currentSemNum - sumPrev);
}
