import { useState, useEffect } from "react";
import { Card } from "../ui/card";
import { Progress } from "../ui/progress";
import { CheckCircle, XCircle, TrendingUp, AlertTriangle, Ban, Calendar } from "lucide-react";
import { motion } from "motion/react";
import { format } from "date-fns";
import { computeAttendanceStats } from "../../../lib/academicUtils";

interface Subject {
  id: string;
  name: string;
  code: string;
  credits: number;
}

interface CancelledEntry {
  key: string;
  subject: string;
  period: number;
  faculty: string;
  notes: string;
  date: string;
  day: string;
}

interface AttendanceRecord {
  date: string;
  subjects: string[];          // ["Math-1", "Math-2", ...]
  cancelled?: CancelledEntry[]; // new field
}

interface TimetableSlot {
  day: string;
  subject: string;
  period: number;
}

export function AttendanceTab() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [cancelledClasses, setCancelledClasses] = useState<CancelledEntry[]>([]);
  const [semesterDuration, setSemesterDuration] = useState<string>("");
  const [overallAttendance, setOverallAttendance] = useState<number>(0);
  const [totalAttended, setTotalAttended] = useState<number>(0);
  const [totalConducted, setTotalConducted] = useState<number>(0);
  const [subjectStats, setSubjectStats] = useState<
    Record<
      string,
      {
        attended: number;
        total: number;
        percentage: number;
        classesNeeded: number;
        safeBunks: number;
      }
    >
  >({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    // Load semester duration
    const profile = JSON.parse(localStorage.getItem("student_profile") || "null");
    if (profile?.semesterStartDate && profile?.semesterEndDate) {
      try {
        const start = new Date(profile.semesterStartDate);
        const end = new Date(profile.semesterEndDate);
        setSemesterDuration(
          `${format(start, "MMM d, yyyy")} → ${format(end, "MMM d, yyyy")}`
        );
      } catch {}
    }

    const subjectsStr = localStorage.getItem("subjects");
    const recordsStr = localStorage.getItem("attendance_records");

    if (subjectsStr) {
      const loadedSubjects: Subject[] = JSON.parse(subjectsStr);
      setSubjects(loadedSubjects);
    }

    if (recordsStr) {
      const records: AttendanceRecord[] = JSON.parse(recordsStr);
      setAttendanceRecords(records);

      const allCancelled: CancelledEntry[] = [];
      records.forEach((r) => {
        if (r.cancelled && r.cancelled.length > 0) {
          allCancelled.push(...r.cancelled);
        }
      });
      setCancelledClasses(allCancelled);
    }

    // Unified Attendance Stats via shared helper
    const attResult = computeAttendanceStats();
    setOverallAttendance(attResult.overallAttendance);
    setTotalAttended(attResult.totalAttended);
    setTotalConducted(attResult.totalConducted);
    setSubjectStats(attResult.subjectStats);
  };

  return (
    <div className="space-y-6">
      {/* Semester Tenure Banner */}
      {semesterDuration && (
        <div className="flex items-center gap-3 rounded-xl bg-[var(--brand-start)]/10 border border-[var(--brand-start)]/25 px-5 py-3">
          <Calendar className="w-5 h-5 text-[var(--brand-start)] flex-shrink-0" />
          <div>
            <p className="text-[11px] text-[var(--brand-start)] font-bold uppercase tracking-widest">
              Current Semester Duration
            </p>
            <p className="text-foreground font-bold text-sm">{semesterDuration}</p>
          </div>
        </div>
      )}

      {/* Overall Stats — 3 cards (no advisor callouts) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-card border border-border/80 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground font-semibold">Overall Attendance</span>
            <TrendingUp className="w-5 h-5 text-[var(--brand-start)]" />
          </div>
          <div className="text-3xl font-black text-foreground mb-2">{overallAttendance.toFixed(1)}%</div>
          <Progress value={overallAttendance} className="h-2 bg-muted" />
        </Card>

        <Card className="bg-card border border-border/80 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground font-semibold">Classes Attended</span>
            <CheckCircle className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="text-3xl font-black text-foreground">{totalAttended}</div>
        </Card>

        <Card className="bg-card border border-border/80 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground font-semibold">Classes Conducted</span>
            <XCircle className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="text-3xl font-black text-foreground">{totalConducted}</div>
        </Card>
      </div>

      {/* Subject-wise Attendance */}
      <div>
        <h3 className="text-xl font-bold text-foreground mb-4">Subject-wise Attendance</h3>
        <div className="grid gap-4">
          {subjects.map((subject, index) => {
            const stats = subjectStats[subject.name];
            if (!stats) return null;

            const hasMarked = stats.total > 0;
            const isLow = hasMarked && stats.percentage < 75;

            return (
              <motion.div
                key={subject.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="bg-card border border-border/80 p-6 hover:border-[var(--brand-start)]/50 transition-all shadow-sm">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="text-lg font-bold text-foreground">{subject.name}</h4>
                      <p className="text-xs text-muted-foreground font-semibold">
                        {subject.code} • {subject.credits} Credits
                      </p>
                    </div>
                    <div
                      className={`px-3 py-1 rounded-full text-xs font-black ${
                        !hasMarked
                          ? "bg-muted text-muted-foreground border border-border"
                          : isLow
                          ? "bg-red-500/20 text-red-600 border border-red-500/30 dark:text-red-400"
                          : "bg-emerald-500/20 text-emerald-600 border border-emerald-500/30 dark:text-emerald-400"
                      }`}
                    >
                      {hasMarked ? `${stats.percentage.toFixed(1)}%` : "N/A"}
                    </div>
                  </div>

                  <Progress
                    value={hasMarked ? stats.percentage : 0}
                    className="h-3 bg-muted mb-4"
                  />

                  {/* Recommendation Alert Badge */}
                  {!hasMarked ? (
                    <div className="p-3 rounded-lg border text-xs font-semibold mb-4 flex items-center gap-2 bg-muted/40 border-border text-muted-foreground">
                      <Calendar className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                      <span>
                        <strong>No attendance marked yet:</strong> Tracking will activate once the first class attendance is marked.
                      </span>
                    </div>
                  ) : isLow ? (
                    <div className="p-3 rounded-lg border text-xs font-semibold mb-4 flex items-center gap-2 bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0 text-red-500" />
                      <span>
                        <strong>Low Attendance Warning:</strong> Attend the next{" "}
                        <strong>{stats.classesNeeded}</strong> consecutive classes to reach 75%.
                      </span>
                    </div>
                  ) : (
                    <div className="p-3 rounded-lg border text-xs font-semibold mb-4 flex items-center gap-2 bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400">
                      <CheckCircle className="w-4 h-4 flex-shrink-0 text-emerald-500" />
                      <span>
                        <strong>Safe Attendance:</strong> You can safely bunk{" "}
                        <strong>{stats.safeBunks}</strong> classes and stay above 75%.
                      </span>
                    </div>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                    <div className="bg-muted/40 p-2.5 rounded-lg border border-border/50">
                      <p className="text-muted-foreground font-medium">Attended</p>
                      <p className="text-foreground font-black text-sm">{stats.attended} Classes</p>
                    </div>
                    <div className="bg-muted/40 p-2.5 rounded-lg border border-border/50">
                      <p className="text-muted-foreground font-medium">Total Conducted</p>
                      <p className="text-foreground font-black text-sm">{stats.total} Classes</p>
                    </div>
                    <div className="bg-muted/40 p-2.5 rounded-lg border border-border/50">
                      <p className="text-muted-foreground font-medium">Classes Needed (75%)</p>
                      <p className="text-amber-600 dark:text-amber-400 font-black text-sm">
                        {hasMarked ? stats.classesNeeded : "-"}
                      </p>
                    </div>
                    <div className="bg-muted/40 p-2.5 rounded-lg border border-border/50">
                      <p className="text-muted-foreground font-medium">Safe Bunks</p>
                      <p className="text-emerald-600 dark:text-emerald-400 font-black text-sm">
                        {hasMarked ? stats.safeBunks : "-"}
                      </p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}

          {subjects.length === 0 && (
            <Card className="bg-card border border-border/80 p-12 text-center shadow-sm">
              <p className="text-muted-foreground font-medium">
                No subjects found. Please complete onboarding first.
              </p>
            </Card>
          )}
        </div>
      </div>

      {/* Classes Which Did Not Happen */}
      {cancelledClasses.length > 0 && (
        <div>
          <h3 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
            <Ban className="w-5 h-5 text-gray-400" />
            Classes Which Did Not Happen
          </h3>
          <div className="grid gap-3">
            {cancelledClasses.map((entry, idx) => (
              <motion.div
                key={`${entry.date}-${entry.key}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.04 }}
              >
                <Card className="bg-card border border-border/60 p-4">
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="w-10 h-10 rounded-lg bg-gray-500/10 border border-gray-500/30 flex items-center justify-center flex-shrink-0">
                      <Ban className="w-4 h-4 text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-foreground font-bold text-sm">{entry.subject}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-500/15 border border-gray-500/30 text-gray-400">
                          Period {entry.period}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                        <span>{entry.date} ({entry.day})</span>
                        {entry.faculty && (
                          <span className="text-[var(--brand-start)] font-medium">
                            Faculty: {entry.faculty}
                          </span>
                        )}
                        {entry.notes && <span className="italic">{entry.notes}</span>}
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
