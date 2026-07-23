import { useState, useEffect } from "react";
import { Card } from "../ui/card";
import { Progress } from "../ui/progress";
import { CheckCircle, XCircle, TrendingUp, AlertTriangle } from "lucide-react";
import { motion } from "motion/react";

interface Subject {
  id: string;
  name: string;
  code: string;
  credits: number;
}

interface AttendanceRecord {
  date: string;
  subjects: string[];
}

export function AttendanceTab() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
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
    const subjectsStr = localStorage.getItem("subjects");
    const recordsStr = localStorage.getItem("attendance_records");
    const timetableStr = localStorage.getItem("timetable");

    if (subjectsStr) {
      const loadedSubjects: Subject[] = JSON.parse(subjectsStr);
      setSubjects(loadedSubjects);

      if (recordsStr && timetableStr) {
        const records: AttendanceRecord[] = JSON.parse(recordsStr);
        const timetable = JSON.parse(timetableStr);
        setAttendanceRecords(records);

        // Calculate stats for each subject
        const stats: typeof subjectStats = {};
        loadedSubjects.forEach((subject) => {
          // Count total classes from timetable
          const totalClasses = timetable.filter(
            (t: { subject: string }) => t.subject === subject.name
          ).length * records.length;

          // Count attended classes
          const attendedClasses = records.filter((record) =>
            record.subjects.includes(subject.name)
          ).length;

          const percentage = totalClasses > 0 ? (attendedClasses / totalClasses) * 100 : 0;

          // Calculate classes needed to reach 75%
          const classesNeeded = Math.max(
            0,
            Math.ceil((0.75 * totalClasses - attendedClasses) / 0.25)
          );

          // Calculate safe bunks (how many can be missed while staying above 75%)
          const safeBunks = Math.floor((attendedClasses - 0.75 * totalClasses) / 0.75);

          stats[subject.name] = {
            attended: attendedClasses,
            total: totalClasses,
            percentage,
            classesNeeded,
            safeBunks: Math.max(0, safeBunks),
          };
        });

        setSubjectStats(stats);
      }
    }
  };

  const overallAttendance =
    subjects.length > 0
      ? subjects.reduce((sum, subject) => {
          return sum + (subjectStats[subject.name]?.percentage || 0);
        }, 0) / subjects.length
      : 0;

  const totalAttended = Object.values(subjectStats).reduce((sum, stat) => sum + stat.attended, 0);
  const totalConducted = Object.values(subjectStats).reduce((sum, stat) => sum + stat.total, 0);

  // Overall classes needed & total safe bunks
  const totalClassesNeeded = Object.values(subjectStats).reduce((sum, stat) => sum + stat.classesNeeded, 0);
  const totalSafeBunks = Object.values(subjectStats).reduce((sum, stat) => sum + stat.safeBunks, 0);

  return (
    <div className="space-y-6">
      {/* Overall Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
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

        <Card className="bg-card border border-border/80 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground font-semibold">Classes Missed</span>
            <AlertTriangle className="w-5 h-5 text-orange-500" />
          </div>
          <div className="text-3xl font-black text-foreground">{totalConducted - totalAttended}</div>
        </Card>
      </div>

      {/* 75% Attendance Advisor Bunk/Required Callout Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-amber-500/10 border border-amber-500/30 p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-base font-bold text-foreground mb-1">Classes Required for 75% Goal</h4>
              <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mb-1">
                {totalClassesNeeded > 0 ? `${totalClassesNeeded} Classes Needed` : "Goal Achieved! 🎉"}
              </p>
              <p className="text-xs text-muted-foreground font-medium">
                {totalClassesNeeded > 0
                  ? "Total consecutive classes you must attend across low attendance subjects to reach 75%."
                  : "All your subjects currently meet or exceed the mandatory 75% attendance threshold!"}
              </p>
            </div>
          </div>
        </Card>

        <Card className="bg-emerald-500/10 border border-emerald-500/30 p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-base font-bold text-foreground mb-1">Safe Bunks Available</h4>
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mb-1">
                {totalSafeBunks} Classes Bunkable
              </p>
              <p className="text-xs text-muted-foreground font-medium">
                Total safe class bunks available across subjects while maintaining at least 75% attendance.
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Subject-wise Attendance */}
      <div>
        <h3 className="text-xl font-bold text-foreground mb-4">Subject-wise Attendance</h3>
        <div className="grid gap-4">
          {subjects.map((subject, index) => {
            const stats = subjectStats[subject.name];
            if (!stats) return null;

            const isLow = stats.percentage < 75;

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
                      <p className="text-xs text-muted-foreground font-semibold">{subject.code} • {subject.credits} Credits</p>
                    </div>
                    <div
                      className={`px-3 py-1 rounded-full text-xs font-black ${
                        isLow
                          ? "bg-red-500/20 text-red-600 border border-red-500/30 dark:text-red-400"
                          : "bg-emerald-500/20 text-emerald-600 border border-emerald-500/30 dark:text-emerald-400"
                      }`}
                    >
                      {stats.percentage.toFixed(1)}%
                    </div>
                  </div>

                  <Progress
                    value={stats.percentage}
                    className="h-3 bg-muted mb-4"
                  />

                  {/* Recommendation Alert Badge */}
                  <div
                    className={`p-3 rounded-lg border text-xs font-semibold mb-4 flex items-center gap-2 ${
                      isLow
                        ? "bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400"
                        : "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                    }`}
                  >
                    {isLow ? (
                      <>
                        <AlertTriangle className="w-4 h-4 flex-shrink-0 text-red-500" />
                        <span>
                          <strong>Low Attendance Warning:</strong> Attend the next <strong>{stats.classesNeeded}</strong> consecutive classes to reach 75%.
                        </span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 flex-shrink-0 text-emerald-500" />
                        <span>
                          <strong>Safe Attendance:</strong> You can safely bunk <strong>{stats.safeBunks}</strong> classes and stay above 75%.
                        </span>
                      </>
                    )}
                  </div>

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
                      <p className="text-amber-600 dark:text-amber-400 font-black text-sm">{stats.classesNeeded}</p>
                    </div>
                    <div className="bg-muted/40 p-2.5 rounded-lg border border-border/50">
                      <p className="text-muted-foreground font-medium">Safe Bunks</p>
                      <p className="text-emerald-600 dark:text-emerald-400 font-black text-sm">{stats.safeBunks}</p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}

          {subjects.length === 0 && (
            <Card className="bg-card border border-border/80 p-12 text-center shadow-sm">
              <p className="text-muted-foreground font-medium">No subjects found. Please complete onboarding first.</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
