import { useState, useEffect } from "react";
import { Card } from "./ui/card";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ReferenceLine,
  Cell,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Award,
  AlertCircle,
  Target,
  BookOpen,
  Users,
  BarChart2,
  Minus,
  AlertTriangle,
  CheckCircle,
  Ban,
} from "lucide-react";
import { motion } from "motion/react";
import { format } from "date-fns";
import { getRealSemesters, computeCGPA, computeAttendanceStats } from "../../lib/academicUtils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SemesterMark {
  semester: number;
  sgpa: number;
  results: { subjectName?: string; credits: number; gradePoint: number; internal?: number; external?: number }[];
}

interface AttendanceRecord {
  date: string;
  subjects: string[];
  cancelled?: { key: string }[];
}

interface TimetableSlot {
  day: string;
  subject: string;
  period: number;
}

interface Subject {
  id: string;
  name: string;
  code: string;
  credits: number;
}

interface SubjectAttendanceStat {
  subject: string;
  attended: number;
  total: number;
  percentage: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const dayName = (dateStr: string) => {
  const d = new Date(dateStr + "T00:00:00");
  return format(d, "EEEE");
};

// ─── Component ────────────────────────────────────────────────────────────────

export function Analytics() {
  // ── Raw state ──────────────────────────────────────────────────────────────
  const [sgpaData, setSgpaData] = useState<{ semester: string; sgpa: number }[]>([]);
  const [cgpa, setCgpa] = useState<number | null>(null);
  const [targetCgpa, setTargetCgpa] = useState<number>(0);
  const [attendanceBySubject, setAttendanceBySubject] = useState<SubjectAttendanceStat[]>([]);
  const [overallAttendance, setOverallAttendance] = useState<number>(0);
  const [subjectRadarData, setSubjectRadarData] = useState<{ subject: string; score: number }[]>([]);
  const [semesterGradeBreakdown, setSemesterGradeBreakdown] = useState<
    { grade: string; count: number }[]
  >([]);
  const [insights, setInsights] = useState<{ text: string; type: "good" | "warn" | "info" | "neutral" }[]>([]);
  const [hasMarksData, setHasMarksData] = useState(false);
  const [hasAttendanceData, setHasAttendanceData] = useState(false);
  const [semesterCount, setSemesterCount] = useState(0);

  // ── Load ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    loadAll();
    const handleStorage = () => loadAll();
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const loadAll = () => {
    // -------- Semester marks (exam results) --------
    const rawMarks: SemesterMark[] = JSON.parse(localStorage.getItem("semester_marks") || "[]");
    const realSemesters = getRealSemesters(rawMarks as any);
    const hasMarks = realSemesters.length > 0;
    setHasMarksData(hasMarks);
    setSemesterCount(realSemesters.length);

    // SGPA trend
    const sgpaChart = realSemesters.map((s) => ({
      semester: `Sem ${s.semester}`,
      sgpa: parseFloat(s.sgpa.toFixed(2)),
    }));
    setSgpaData(sgpaChart);

    // CGPA
    const cgpaVal = computeCGPA(rawMarks as any);
    setCgpa(cgpaVal);

    // Target CGPA
    const tgt = parseFloat(localStorage.getItem("target_cgpa") || "0");
    setTargetCgpa(tgt);

    // Subject-level radar for latest semester with data
    const latestSem = realSemesters[realSemesters.length - 1];
    if (latestSem?.results?.length) {
      const radar = latestSem.results
        .filter((r: any) => r.subjectName)
        .slice(0, 7)
        .map((r: any) => ({
          subject:
            r.subjectName.length > 10 ? r.subjectName.substring(0, 10) + "…" : r.subjectName,
          score: parseFloat(
            ((((r.internal || 0) + (r.external || 0)) / 100) * 100).toFixed(1)
          ),
        }));
      setSubjectRadarData(radar);
    } else {
      setSubjectRadarData([]);
    }

    // Grade distribution across ALL real semesters
    const gradeCounts: Record<string, number> = {};
    realSemesters.forEach((sem) => {
      sem.results.forEach((r: any) => {
        const gp = r.gradePoint ?? 0;
        let grade = "F";
        if (gp >= 10) grade = "O";
        else if (gp >= 9) grade = "A+";
        else if (gp >= 8) grade = "A";
        else if (gp >= 7) grade = "B+";
        else if (gp >= 6) grade = "B";
        else if (gp >= 5) grade = "C";
        gradeCounts[grade] = (gradeCounts[grade] || 0) + 1;
      });
    });
    const gradeOrder = ["O", "A+", "A", "B+", "B", "C", "F"];
    setSemesterGradeBreakdown(
      gradeOrder
        .filter((g) => gradeCounts[g])
        .map((g) => ({ grade: g, count: gradeCounts[g] }))
    );

    // -------- Attendance --------
    const attResult = computeAttendanceStats();
    setHasAttendanceData(attResult.hasData);

    if (attResult.hasData) {
      const subjectStats: SubjectAttendanceStat[] = attResult.subjectList.map((sub) => ({
        subject: sub.subject.length > 14 ? sub.subject.substring(0, 14) + "…" : sub.subject,
        attended: sub.attended,
        total: sub.total,
        percentage: sub.percentage,
      }));

      setAttendanceBySubject(subjectStats.filter((s) => s.total > 0));
      setOverallAttendance(attResult.overallAttendance);
    } else {
      setAttendanceBySubject([]);
      setOverallAttendance(0);
    }

    // -------- Insights --------
    const records: AttendanceRecord[] = JSON.parse(localStorage.getItem("attendance_records") || "[]");
    const subjects: Subject[] = JSON.parse(localStorage.getItem("subjects") || "[]");
    const timetable: TimetableSlot[] = JSON.parse(localStorage.getItem("timetable") || "[]");
    buildInsights(sgpaChart, realSemesters, records, subjects, timetable, cgpaVal, tgt);
  };

  const buildInsights = (
    sgpaChart: { semester: string; sgpa: number }[],
    realSems: any[],
    records: AttendanceRecord[],
    subjects: Subject[],
    timetable: TimetableSlot[],
    cgpaVal: number | null,
    tgt: number
  ) => {
    const list: { text: string; type: "good" | "warn" | "info" | "neutral" }[] = [];

    // SGPA trend
    if (sgpaChart.length >= 2) {
      const latest = sgpaChart[sgpaChart.length - 1].sgpa;
      const prev = sgpaChart[sgpaChart.length - 2].sgpa;
      const diff = parseFloat((latest - prev).toFixed(2));
      if (diff > 0) {
        list.push({ text: `Your SGPA improved by ${diff} points from the previous semester. Keep it up!`, type: "good" });
      } else if (diff < 0) {
        list.push({ text: `Your SGPA dropped by ${Math.abs(diff)} points. Focus on the weaker subjects next semester.`, type: "warn" });
      } else {
        list.push({ text: "Your SGPA remained consistent between the last two semesters.", type: "neutral" });
      }
    }

    // CGPA vs target
    if (cgpaVal !== null && tgt > 0) {
      const gap = parseFloat((tgt - cgpaVal).toFixed(2));
      if (gap <= 0) {
        list.push({ text: `Congratulations! You have achieved your target CGPA of ${tgt.toFixed(2)}.`, type: "good" });
      } else {
        list.push({ text: `You are ${gap} points away from your target CGPA of ${tgt.toFixed(2)}.`, type: "info" });
      }
    }

    // CGPA bracket
    if (cgpaVal !== null) {
      if (cgpaVal >= 9.0) {
        list.push({ text: "Outstanding CGPA! You are on track for top honors and excellent placement opportunities.", type: "good" });
      } else if (cgpaVal >= 8.0) {
        list.push({ text: "Great CGPA. Maintain this performance for strong placement prospects.", type: "good" });
      } else if (cgpaVal >= 7.0) {
        list.push({ text: "Decent CGPA. A focused push in the next couple of semesters could make a big difference.", type: "info" });
      } else if (cgpaVal > 0) {
        list.push({ text: "Your CGPA needs improvement. Identify weaker subjects and aim for consistent internal marks.", type: "warn" });
      }
    }

    // Grade distribution alerts
    const hasF = realSems.some((s) =>
      s.results.some((r: any) => (r.gradePoint ?? 0) === 0)
    );
    if (hasF) {
      list.push({ text: "You have one or more F grades in your results. Consider clearing backlogs to strengthen your CGPA.", type: "warn" });
    }

    // Attendance
    if (records.length > 0 && subjects.length > 0 && timetable.length > 0) {
      let totalAtt = 0, totalCond = 0;
      const lowSubjects: string[] = [];

      subjects.forEach((subject) => {
        let att = 0, cond = 0;
        records.forEach((record) => {
          const day = dayName(record.date);
          const slots = timetable.filter((t) => t.day === day && t.subject === subject.name);
          slots.forEach((slot) => {
            const key = `${slot.subject}-${slot.period}`;
            const isCancelled = record.cancelled?.some((c) => c.key === key);
            if (!isCancelled) {
              cond++;
              if (record.subjects.includes(key)) att++;
            }
          });
        });
        totalAtt += att;
        totalCond += cond;
        if (cond > 0 && (att / cond) * 100 < 75) {
          lowSubjects.push(subject.name);
        }
      });

      const overall = totalCond > 0 ? (totalAtt / totalCond) * 100 : 0;
      if (overall >= 90) {
        list.push({ text: `Excellent attendance at ${overall.toFixed(1)}%! You have a strong safety buffer above 75%.`, type: "good" });
      } else if (overall >= 75) {
        list.push({ text: `Your overall attendance is ${overall.toFixed(1)}% — above the 75% threshold. Stay consistent.`, type: "info" });
      } else if (overall > 0) {
        list.push({ text: `Overall attendance is ${overall.toFixed(1)}% — below the required 75%. Attend classes regularly to avoid shortage.`, type: "warn" });
      }

      if (lowSubjects.length > 0) {
        list.push({
          text: `${lowSubjects.length === 1 ? `"${lowSubjects[0]}"` : `${lowSubjects.length} subjects`} ${lowSubjects.length === 1 ? "has" : "have"} attendance below 75%. Prioritize attending these classes.`,
          type: "warn",
        });
      } else if (records.length > 0) {
        list.push({ text: "All subjects are above the 75% attendance requirement — great discipline!", type: "good" });
      }
    }

    if (list.length === 0) {
      list.push({ text: "Enter your marks in the Academics section and mark attendance regularly to see personalised insights.", type: "neutral" });
    }

    setInsights(list);
  };

  // ── Derived indicators (dynamic) ───────────────────────────────────────────
  const placementScore = (() => {
    if (cgpa === null && overallAttendance === 0) return null;
    const cgpaScore = cgpa !== null ? (cgpa / 10) * 60 : 30; // 60% weight
    const attScore = overallAttendance > 0 ? (overallAttendance / 100) * 40 : 20; // 40% weight
    return Math.round(cgpaScore + attScore);
  })();

  const academicTrend = (() => {
    if (sgpaData.length < 2) return null;
    const diff = sgpaData[sgpaData.length - 1].sgpa - sgpaData[sgpaData.length - 2].sgpa;
    if (diff > 0.1) return { label: "Improving", color: "text-emerald-500", Icon: TrendingUp };
    if (diff < -0.1) return { label: "Declining", color: "text-red-500", Icon: TrendingDown };
    return { label: "Stable", color: "text-[var(--brand-start)]", Icon: Minus };
  })();

  const targetProgress = (() => {
    if (!cgpa || !targetCgpa) return null;
    const pct = Math.min((cgpa / targetCgpa) * 100, 100);
    const label = pct >= 100 ? "Achieved!" : pct >= 75 ? "On Track" : "Needs Focus";
    return { pct: parseFloat(pct.toFixed(1)), label };
  })();

  // ── Tooltip styling ────────────────────────────────────────────────────────
  const tooltipStyle = {
    backgroundColor: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    color: "var(--foreground)",
  };

  const gradeColors: Record<string, string> = {
    O: "#10b981",
    "A+": "#22c55e",
    A: "#84cc16",
    "B+": "#fbbf24",
    B: "#f97316",
    C: "#ef4444",
    F: "#dc2626",
  };

  return (
    <div className="p-4 md:p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-black mb-2 bg-gradient-to-r from-[var(--brand-start)] to-amber-600 bg-clip-text text-transparent">
          Analytics
        </h1>
        <p className="text-muted-foreground text-lg">
          Visualize your academic performance and attendance trends
        </p>
      </div>

      {/* ── AI Insights ─────────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-4">Smart Insights</h2>
        <div className="grid gap-3">
          {insights.map((insight, index) => {
            const iconMap = {
              good: <CheckCircle className="w-4 h-4 text-white" />,
              warn: <AlertTriangle className="w-4 h-4 text-white" />,
              info: <Award className="w-4 h-4 text-white" />,
              neutral: <BookOpen className="w-4 h-4 text-white" />,
            };
            const bgMap = {
              good: "bg-emerald-500/10 border-emerald-500/30",
              warn: "bg-red-500/10 border-red-500/30",
              info: "bg-[var(--brand-start)]/10 border-[var(--brand-start)]/30",
              neutral: "bg-muted border-border/60",
            };
            const iconBgMap = {
              good: "from-emerald-500 to-teal-500",
              warn: "from-red-500 to-orange-500",
              info: "from-[var(--brand-start)] to-amber-600",
              neutral: "from-slate-500 to-slate-600",
            };
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -18 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.07 }}
              >
                <Card className={`${bgMap[insight.type]} border backdrop-blur-xl p-4`}>
                  <div className="flex items-start space-x-3">
                    <div
                      className={`p-2 rounded-lg bg-gradient-to-br ${iconBgMap[insight.type]} mt-0.5 flex-shrink-0`}
                    >
                      {iconMap[insight.type]}
                    </div>
                    <p className="text-foreground font-medium flex-1 leading-relaxed text-sm">
                      {insight.text}
                    </p>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* ── Performance Indicators (dynamic) ─────────────────────────────────── */}
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-4">Performance Indicators</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {/* Placement Readiness */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="bg-card border border-border/60 p-6">
              <div className="flex items-center justify-between mb-3">
                <Users className="w-7 h-7 text-emerald-500" />
                <span className="text-2xl font-black text-emerald-500">
                  {placementScore !== null ? `${placementScore}%` : "—"}
                </span>
              </div>
              <p className="text-sm text-foreground font-semibold mb-1">Placement Readiness</p>
              <p className="text-xs text-muted-foreground">
                {placementScore !== null
                  ? "Based on credit-weighted CGPA & attendance"
                  : "Enter marks & attendance to calculate"}
              </p>
            </Card>
          </motion.div>

          {/* Academic Trend */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="bg-card border border-border/60 p-6">
              <div className="flex items-center justify-between mb-3">
                {academicTrend ? (
                  <academicTrend.Icon className={`w-7 h-7 ${academicTrend.color}`} />
                ) : (
                  <BarChart2 className="w-7 h-7 text-muted-foreground" />
                )}
                <span
                  className={`text-2xl font-black ${
                    academicTrend ? academicTrend.color : "text-muted-foreground"
                  }`}
                >
                  {academicTrend ? academicTrend.label : "—"}
                </span>
              </div>
              <p className="text-sm text-foreground font-semibold mb-1">Academic Trend</p>
              <p className="text-xs text-muted-foreground">
                {semesterCount >= 2
                  ? `Based on last ${semesterCount} semester results`
                  : "Enter at least 2 semester results to see trend"}
              </p>
            </Card>
          </motion.div>

          {/* Target Progress */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="bg-card border border-border/60 p-6">
              <div className="flex items-center justify-between mb-3">
                <Target className="w-7 h-7 text-amber-500" />
                <span className="text-2xl font-black text-amber-500">
                  {targetProgress ? targetProgress.label : "—"}
                </span>
              </div>
              <p className="text-sm text-foreground font-semibold mb-1">Target Progress</p>
              <p className="text-xs text-muted-foreground">
                {targetProgress
                  ? `${targetProgress.pct}% of target CGPA ${targetCgpa.toFixed(2)} reached`
                  : "Set your target CGPA in the Academics section"}
              </p>
            </Card>
          </motion.div>
        </div>
      </div>

      {/* ── Attendance Charts ─────────────────────────────────────────────────── */}
      {hasAttendanceData && (
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-4">Attendance Trends</h2>
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Attendance by Subject — Bar */}
            <Card className="bg-card backdrop-blur-xl border border-border/60 p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-foreground">Attendance by Subject</h3>
                <span
                  className={`text-sm font-bold px-3 py-1 rounded-full border ${
                    overallAttendance >= 75
                      ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30 dark:text-emerald-400"
                      : "bg-red-500/10 text-red-600 border-red-500/30 dark:text-red-400"
                  }`}
                >
                  Overall: {overallAttendance}%
                </span>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={attendanceBySubject} margin={{ bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="subject"
                    stroke="var(--muted-foreground)"
                    angle={-40}
                    textAnchor="end"
                    height={80}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis domain={[0, 100]} stroke="var(--muted-foreground)" tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(val: number) => [`${val}%`, "Attendance"]}
                  />
                  <ReferenceLine y={75} stroke="#f97316" strokeDasharray="4 4" label={{ value: "75%", fill: "#f97316", fontSize: 11 }} />
                  <defs>
                    <linearGradient id="attGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#fbbf24" />
                      <stop offset="100%" stopColor="#f97316" />
                    </linearGradient>
                  </defs>
                  <Bar dataKey="percentage" radius={[6, 6, 0, 0]}>
                    {attendanceBySubject.map((entry, i) => (
                      <Cell
                        key={`att-${i}`}
                        fill={entry.percentage >= 75 ? "url(#attGrad)" : "#ef4444"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>

            {/* Low attendance subjects — detail */}
            <Card className="bg-card backdrop-blur-xl border border-border/60 p-6">
              <h3 className="text-xl font-bold text-foreground mb-4">Subject-wise Breakdown</h3>
              <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
                {attendanceBySubject
                  .sort((a, b) => a.percentage - b.percentage)
                  .map((sub, i) => {
                    const safeBunks =
                      sub.percentage > 75
                        ? Math.floor((sub.attended - 0.75 * sub.total) / 0.75)
                        : 0;
                    const needed =
                      sub.percentage < 75
                        ? Math.max(0, Math.ceil((0.75 * sub.total - sub.attended) / 0.25))
                        : 0;
                    const isLow = sub.percentage < 75;

                    return (
                      <div
                        key={i}
                        className={`flex items-center justify-between p-3 rounded-xl border text-xs ${
                          isLow
                            ? "bg-red-500/8 border-red-500/25 dark:bg-red-500/10"
                            : "bg-muted/40 border-border/50"
                        }`}
                      >
                        <div className="flex-1 min-w-0 mr-3">
                          <p className="font-bold text-foreground truncate">{sub.subject}</p>
                          <p className="text-muted-foreground mt-0.5">
                            {sub.attended}/{sub.total} classes
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p
                            className={`font-black text-sm ${
                              isLow
                                ? "text-red-500"
                                : "text-emerald-500"
                            }`}
                          >
                            {sub.percentage}%
                          </p>
                          <p className="text-muted-foreground mt-0.5">
                            {isLow
                              ? `Attend ${needed} more`
                              : safeBunks > 0
                              ? `${safeBunks} safe bunks`
                              : "Just at 75%"}
                          </p>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </Card>
          </div>
        </div>
      )}

      {!hasAttendanceData && (
        <Card className="bg-card border border-border/60 p-10 text-center">
          <Ban className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-foreground font-semibold mb-1">No Attendance Data Yet</p>
          <p className="text-muted-foreground text-sm">
            Mark attendance from the Dashboard or Academics section to see attendance trends here.
          </p>
        </Card>
      )}

      {/* ── Exam Results Analysis (only when marks data exists) ──────────────── */}
      {hasMarksData && (
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-4">Exam Results Analysis</h2>
          <div className="grid lg:grid-cols-2 gap-6">
            {/* SGPA Trend */}
            <Card className="bg-card backdrop-blur-xl border border-border/60 p-6">
              <h3 className="text-xl font-bold text-foreground mb-6">SGPA Trend</h3>
              {sgpaData.length >= 1 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={sgpaData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="semester" stroke="var(--muted-foreground)" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 10]} stroke="var(--muted-foreground)" tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <ReferenceLine
                      y={cgpa ?? 0}
                      stroke="#6366f1"
                      strokeDasharray="4 4"
                      label={{ value: `CGPA: ${cgpa?.toFixed(2)}`, fill: "#6366f1", fontSize: 11 }}
                    />
                    {targetCgpa > 0 && (
                      <ReferenceLine
                        y={targetCgpa}
                        stroke="#10b981"
                        strokeDasharray="4 4"
                        label={{ value: `Target: ${targetCgpa}`, fill: "#10b981", fontSize: 11 }}
                      />
                    )}
                    <defs>
                      <linearGradient id="sgpaGrad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#fbbf24" />
                        <stop offset="100%" stopColor="#f97316" />
                      </linearGradient>
                    </defs>
                    <Line
                      type="monotone"
                      dataKey="sgpa"
                      stroke="url(#sgpaGrad)"
                      strokeWidth={3}
                      dot={{ fill: "#fbbf24", r: 6 }}
                      activeDot={{ r: 8 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
                  At least one semester result needed for the trend chart.
                </div>
              )}
            </Card>

            {/* Grade Distribution */}
            <Card className="bg-card backdrop-blur-xl border border-border/60 p-6">
              <h3 className="text-xl font-bold text-foreground mb-6">
                Grade Distribution
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  (All Semesters)
                </span>
              </h3>
              {semesterGradeBreakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={semesterGradeBreakdown}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="grade" stroke="var(--muted-foreground)" />
                    <YAxis stroke="var(--muted-foreground)" allowDecimals={false} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(val: number) => [val, "Subjects"]}
                    />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                      {semesterGradeBreakdown.map((entry, i) => (
                        <Cell key={`gc-${i}`} fill={gradeColors[entry.grade] || "#fbbf24"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
                  No grade data available.
                </div>
              )}
            </Card>
          </div>

          {/* Radar — Latest Semester Subject-wise performance */}
          {subjectRadarData.length >= 3 && (
            <Card className="bg-card backdrop-blur-xl border border-border/60 p-6 mt-6">
              <h3 className="text-xl font-bold text-foreground mb-6">
                Latest Semester — Subject Performance
              </h3>
              <ResponsiveContainer width="100%" height={380}>
                <RadarChart data={subjectRadarData}>
                  <PolarGrid stroke="var(--border)" />
                  <PolarAngleAxis dataKey="subject" stroke="var(--muted-foreground)" tick={{ fontSize: 11 }} />
                  <PolarRadiusAxis domain={[0, 100]} stroke="var(--muted-foreground)" tick={{ fontSize: 10 }} />
                  <Radar
                    name="Score (%)"
                    dataKey="score"
                    stroke="#fbbf24"
                    fill="#fbbf24"
                    fillOpacity={0.25}
                    strokeWidth={2}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(val: number) => [`${val}%`, "Score"]}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </Card>
          )}

          {/* Semester CGPA Summary Table */}
          <Card className="bg-card backdrop-blur-xl border border-border/60 p-6 mt-6">
            <h3 className="text-xl font-bold text-foreground mb-4">
              Semester-wise SGPA Summary
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {sgpaData.map((sem, i) => {
                const prev = sgpaData[i - 1]?.sgpa;
                const delta = prev !== undefined ? sem.sgpa - prev : null;
                return (
                  <motion.div
                    key={sem.semester}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.06 }}
                  >
                    <div className="p-4 rounded-xl border border-[var(--brand-start)]/30 bg-[var(--brand-start)]/5 text-center">
                      <p className="text-xs text-muted-foreground mb-1 font-semibold uppercase tracking-wide">
                        {sem.semester}
                      </p>
                      <p className="text-2xl font-black text-foreground">{sem.sgpa.toFixed(2)}</p>
                      {delta !== null && (
                        <p
                          className={`text-xs font-bold mt-1 ${
                            delta > 0
                              ? "text-emerald-500"
                              : delta < 0
                              ? "text-red-500"
                              : "text-muted-foreground"
                          }`}
                        >
                          {delta > 0 ? "▲" : delta < 0 ? "▼" : "—"}{" "}
                          {Math.abs(delta).toFixed(2)}
                        </p>
                      )}
                    </div>
                  </motion.div>
                );
              })}

              {/* CGPA summary tile */}
              {cgpa !== null && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: sgpaData.length * 0.06 }}
                >
                  <div className="p-4 rounded-xl border border-amber-500/40 bg-amber-500/10 text-center">
                    <p className="text-xs text-muted-foreground mb-1 font-semibold uppercase tracking-wide">
                      CGPA
                    </p>
                    <p className="text-2xl font-black text-[var(--brand-start)]">
                      {cgpa.toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Credit-weighted</p>
                  </div>
                </motion.div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Placeholder when no marks data AND no attendance */}
      {!hasMarksData && (
        <Card className="bg-card border border-border/60 p-10 text-center">
          <AlertCircle className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-foreground font-semibold mb-1">No Exam Results Yet</p>
          <p className="text-muted-foreground text-sm">
            Enter your semester marks in the{" "}
            <span className="text-[var(--brand-start)] font-semibold">Academics → SGPA</span>{" "}
            section to unlock exam results analysis, SGPA trends, grade distribution, and more.
          </p>
        </Card>
      )}
    </div>
  );
}
