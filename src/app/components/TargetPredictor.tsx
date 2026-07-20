import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import {
  ArrowLeft,
  Target,
  TrendingUp,
  AlertCircle,
  BookOpen,
  Info,
} from "lucide-react";
import { motion } from "motion/react";

// ── IPU Grade Table (10-point scale) ─────────────────────────────────────────
const GRADE_TABLE = [
  { grade: "O",  gp: 10, minMarks: 90,  marksRange: "90–100" },
  { grade: "A+", gp: 9,  minMarks: 75,  marksRange: "75–89"  },
  { grade: "A",  gp: 8,  minMarks: 65,  marksRange: "65–74"  },
  { grade: "B+", gp: 7,  minMarks: 55,  marksRange: "55–64"  },
  { grade: "B",  gp: 6,  minMarks: 50,  marksRange: "50–54"  },
  { grade: "C",  gp: 5,  minMarks: 45,  marksRange: "45–49"  },
  { grade: "P",  gp: 4,  minMarks: 40,  marksRange: "40–44"  },
  { grade: "F",  gp: 0,  minMarks: 0,   marksRange: "<40"    },
];

interface SubjectResult {
  name: string;
  credits: number;
  gradePoint: number;
  grade: string;
  minMarks: number;
  marksRange: string;
}

// Grade bar / badge colour helpers
function gradeColor(grade: string) {
  if (grade === "O")  return { badge: "bg-emerald-500/20 border-emerald-500/50 text-emerald-300", bar: "#10b981", mark: "text-emerald-300" };
  if (grade === "A+") return { badge: "bg-amber-500/20 border-amber-500/50 text-amber-300",        bar: "#f59e0b", mark: "text-amber-300"   };
  if (grade === "A")  return { badge: "bg-sky-500/20 border-sky-500/50 text-sky-300",              bar: "#38bdf8", mark: "text-sky-300"     };
  if (grade === "B+") return { badge: "bg-orange-500/20 border-orange-500/50 text-orange-300",     bar: "#f97316", mark: "text-orange-300"  };
  if (grade === "B")  return { badge: "bg-violet-500/20 border-violet-500/50 text-violet-300",     bar: "#8b5cf6", mark: "text-violet-300"  };
  if (grade === "C")  return { badge: "bg-yellow-500/20 border-yellow-500/50 text-yellow-300",     bar: "#eab308", mark: "text-yellow-300"  };
  if (grade === "P")  return { badge: "bg-rose-500/20 border-rose-500/50 text-rose-300",           bar: "#f43f5e", mark: "text-rose-300"    };
  return                     { badge: "bg-red-500/20 border-red-500/50 text-red-300",              bar: "#ef4444", mark: "text-red-300"     };
}

// ── 10-point scale distribution ───────────────────────────────────────────────
// SGPA = Σ(GP_i × C_i) / Σ(C_i)
// Solve for marks: assign floor(SGPA) GP to every subject, then upgrade
// highest-credit subjects first until Σ(GP_i × C_i) ≥ SGPA × Σ(C_i).
function computeSubjectTargets(
  subjects: { name: string; credits: number }[],
  targetSGPA: number
): SubjectResult[] {
  if (subjects.length === 0 || targetSGPA <= 0) return [];

  const clampedSGPA = Math.min(targetSGPA, 10);
  const totalCredits = subjects.reduce((s, sub) => s + sub.credits, 0);
  const totalGPNeeded = clampedSGPA * totalCredits;

  // Sort highest-credit first so upgrades land on heavy subjects
  const sorted = [...subjects].sort((a, b) => b.credits - a.credits);
  const gpAssign: number[] = sorted.map(() => Math.floor(clampedSGPA));
  let currentTotal = gpAssign.reduce((acc, gp, i) => acc + gp * sorted[i].credits, 0);

  for (let i = 0; i < gpAssign.length; i++) {
    while (currentTotal < totalGPNeeded && gpAssign[i] < 10) {
      gpAssign[i]++;
      currentTotal += sorted[i].credits;
    }
    if (currentTotal >= totalGPNeeded) break;
  }

  return sorted.map((sub, i) => {
    const gradeInfo = GRADE_TABLE.find(g => g.gp === gpAssign[i]) ?? GRADE_TABLE[GRADE_TABLE.length - 1];
    return {
      name: sub.name,
      credits: sub.credits,
      gradePoint: gpAssign[i],
      grade: gradeInfo.grade,
      minMarks: gradeInfo.minMarks,
      marksRange: gradeInfo.marksRange,
    };
  });
}

// ── Component ─────────────────────────────────────────────────────────────────
export function TargetPredictor() {
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    targetCgpa: 0,
    requiredSgpa: 0,
    gap: 0,
    isPossible: true,
    currentCgpa: 0,
  });
  const [semesterNum, setSemesterNum] = useState(1);
  const [rows, setRows] = useState<SubjectResult[]>([]);
  const [totalCredits, setTotalCredits] = useState(0);

  useEffect(() => {
    const compute = () => {
      const target      = parseFloat(localStorage.getItem("target_cgpa") || "0");
      const savedMarks  = JSON.parse(localStorage.getItem("semester_marks") || "[]");
      const subs        = JSON.parse(localStorage.getItem("subjects") || "[]");
      const profile     = JSON.parse(localStorage.getItem("student_profile") || "{}");
      const semNum      = parseInt(profile.currentSemester || "1");

      setSemesterNum(semNum);

      // Previous semesters
      const prevMarks       = savedMarks.filter((m: any) => m.semester < semNum);
      const sumPrevSGPAs    = prevMarks.reduce((a: number, m: any) => a + (m.sgpa || 0), 0);
      const reqSGPA         = (target * semNum) - sumPrevSGPAs;

      // Current CGPA (credit-weighted across all entered semesters)
      const allResults   = savedMarks.flatMap((m: any) => m.results || []);
      const tc           = allResults.reduce((s: number, r: any) => s + (r.credits || 0), 0);
      const wp           = allResults.reduce((s: number, r: any) => s + (r.gradePoint || 0) * (r.credits || 0), 0);
      const currentCgpa  = tc > 0 ? wp / tc : 0;

      setStats({
        targetCgpa:   target,
        requiredSgpa: Math.max(0, reqSGPA),
        gap:          Math.max(0, target - currentCgpa),
        isPossible:   reqSGPA <= 10.0,
        currentCgpa,
      });

      // Compute marks required per subject using the required SGPA
      const computed = computeSubjectTargets(subs, Math.min(Math.max(reqSGPA, 0), 10));
      setRows(computed);
      setTotalCredits(subs.reduce((s: number, sub: any) => s + (sub.credits || 0), 0));
    };

    compute();
    window.addEventListener("storage", compute);
    return () => window.removeEventListener("storage", compute);
  }, []);

  // Verified SGPA back-calculated from assigned grade points
  const achievedSGPA =
    rows.length > 0 && totalCredits > 0
      ? rows.reduce((s, r) => s + r.gradePoint * r.credits, 0) / totalCredits
      : 0;

  return (
    <div className="p-6 md:p-10 space-y-8 max-w-5xl mx-auto">

      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => navigate("/app")}
            className="text-gray-400 hover:text-white hover:bg-gray-800/50 -ml-2"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Dashboard
          </Button>
          <div>
            <h1 className="text-3xl md:text-4xl font-black bg-gradient-to-r from-[var(--brand-start)] via-white to-[var(--brand-end)] bg-clip-text text-transparent leading-tight">
              Target Predictor
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Semester {semesterNum} · marks needed to achieve your CGPA goal
            </p>
          </div>
        </div>

        {stats.gap > 0 && (
          <div className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-orange-500/10 border border-orange-500/25">
            <TrendingUp className="w-4 h-4 text-orange-400" />
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider leading-none">CGPA Gap</p>
              <p className="text-xl font-black text-orange-400 leading-tight">{stats.gap.toFixed(2)}</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Impossible target banner ──────────────────────────────────────────── */}
      {!stats.isPossible && (
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-4 p-5 rounded-2xl bg-red-500/10 border border-red-500/30"
        >
          <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-base font-bold text-red-400">Target CGPA Unreachable This Semester</h3>
            <p className="text-sm text-red-300/75 mt-1">
              Required SGPA exceeds 10.0. Even a perfect score can't bridge the gap in one semester.
              The table below shows marks for a <strong>10.0 SGPA</strong> — the best possible outcome.
            </p>
          </div>
        </motion.div>
      )}

      {/* ── Summary Cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {/* Target CGPA */}
        <Card className="relative overflow-hidden bg-[#111118]/90 border-gray-800/50 p-6">
          <div className="absolute inset-0 bg-gradient-to-br from-[var(--brand-start)]/8 to-transparent pointer-events-none" />
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-xl bg-[var(--brand-start)]/15 border border-[var(--brand-start)]/20">
              <Target className="w-5 h-5 text-[var(--brand-start)]" />
            </div>
            <span className="text-xs text-gray-500 uppercase tracking-widest font-semibold">Target CGPA</span>
          </div>
          <p className="text-5xl font-black text-white tracking-tight">{stats.targetCgpa.toFixed(2)}</p>
          <p className="text-xs text-gray-600 mt-2">Your graduation goal</p>
        </Card>

        {/* Required SGPA */}
        <Card className={`relative overflow-hidden border p-6 ${
          stats.isPossible
            ? "bg-[#111118]/90 border-gray-800/50"
            : "bg-red-500/8 border-red-500/30"
        }`}>
          <div className={`absolute inset-0 bg-gradient-to-br pointer-events-none ${
            stats.isPossible ? "from-[var(--brand-end)]/8 to-transparent" : "from-red-500/10 to-transparent"
          }`} />
          <div className="flex items-center gap-3 mb-3">
            <div className={`p-2 rounded-xl border ${
              stats.isPossible
                ? "bg-[var(--brand-end)]/15 border-[var(--brand-end)]/20"
                : "bg-red-500/15 border-red-500/20"
            }`}>
              <TrendingUp className={`w-5 h-5 ${stats.isPossible ? "text-[var(--brand-end)]" : "text-red-400"}`} />
            </div>
            <span className="text-xs text-gray-500 uppercase tracking-widest font-semibold">Required SGPA</span>
          </div>
          <p className={`text-5xl font-black tracking-tight ${stats.isPossible ? "text-[var(--brand-end)]" : "text-red-400"}`}>
            {stats.requiredSgpa > 10 ? "10.0+" : stats.requiredSgpa.toFixed(2)}
          </p>
          <p className="text-xs text-gray-600 mt-2">
            {stats.isPossible ? `Needed this semester (Sem ${semesterNum})` : "Exceeds maximum — target adjusted to 10.0"}
          </p>
        </Card>
      </div>

      {/* ── Marks Required Table ──────────────────────────────────────────────── */}
      <Card className="bg-[#111118]/90 border-gray-800/50 overflow-hidden">

        {/* Card header */}
        <div className="flex items-center justify-between flex-wrap gap-3 px-7 py-5 border-b border-gray-800/50 bg-gradient-to-r from-[var(--brand-start)]/5 via-transparent to-[var(--brand-end)]/5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[var(--brand-start)]/15 border border-[var(--brand-start)]/20">
              <BookOpen className="w-5 h-5 text-[var(--brand-start)]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Marks Required</h2>
              <p className="text-xs text-gray-500">
                Semester {semesterNum} · auto-calculated using IPU 10-point scale
              </p>
            </div>
          </div>

          {/* Grade scale pills */}
          <div className="flex gap-1.5 flex-wrap">
            {GRADE_TABLE.slice(0, -1).map((g) => {
              const c = gradeColor(g.grade);
              return (
                <span key={g.grade} className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${c.badge}`}>
                  {g.grade} ≥{g.minMarks}
                </span>
              );
            })}
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center px-6">
            <Info className="w-10 h-10 text-gray-700" />
            <p className="text-gray-500 font-medium">No subjects found for Semester {semesterNum}.</p>
            <p className="text-sm text-gray-600">Please complete onboarding or enter subjects in the app.</p>
          </div>
        ) : (
          <>
            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-[#0d0d14]/70">
                    <th className="text-left px-6 py-4 text-[11px] text-gray-500 font-semibold uppercase tracking-widest w-10">#</th>
                    <th className="text-left px-6 py-4 text-[11px] text-gray-500 font-semibold uppercase tracking-widest">Subject</th>
                    <th className="text-center px-6 py-4 text-[11px] text-gray-500 font-semibold uppercase tracking-widest">Credits</th>
                    <th className="text-center px-6 py-4 text-[11px] text-gray-500 font-semibold uppercase tracking-widest">
                      Min Marks Required
                      <span className="block text-[10px] text-gray-700 normal-case tracking-normal font-normal">out of 100</span>
                    </th>
                    <th className="text-center px-6 py-4 text-[11px] text-gray-500 font-semibold uppercase tracking-widest">Grade</th>
                    <th className="text-center px-6 py-4 text-[11px] text-gray-500 font-semibold uppercase tracking-widest">GP</th>
                    <th className="text-left px-6 py-4 text-[11px] text-gray-500 font-semibold uppercase tracking-widest w-40">Progress</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => {
                    const c = gradeColor(row.grade);
                    const pct = Math.min((row.minMarks / 100) * 100, 100);
                    return (
                      <motion.tr
                        key={idx}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05, duration: 0.3 }}
                        className="border-b border-gray-800/40 hover:bg-white/[0.02] transition-colors group"
                      >
                        {/* # */}
                        <td className="px-6 py-4 text-gray-700 text-sm tabular-nums">{idx + 1}</td>

                        {/* Subject */}
                        <td className="px-6 py-4">
                          <span className="text-white font-semibold text-[15px] group-hover:text-[var(--brand-start)] transition-colors">
                            {row.name}
                          </span>
                        </td>

                        {/* Credits */}
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-[var(--brand-start)]/10 border border-[var(--brand-start)]/20 text-[var(--brand-start)] font-bold text-sm">
                            {row.credits}
                          </span>
                        </td>

                        {/* Min Marks */}
                        <td className="px-6 py-4 text-center">
                          <span className={`text-3xl font-black tabular-nums ${c.mark}`}>
                            {row.minMarks}
                          </span>
                          <span className="text-gray-600 text-sm ml-0.5">/100</span>
                        </td>

                        {/* Grade badge */}
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-block px-3 py-1 rounded-lg border text-sm font-bold ${c.badge}`}>
                            {row.grade}
                          </span>
                        </td>

                        {/* GP */}
                        <td className="px-6 py-4 text-center">
                          <span className="text-xl font-black text-white tabular-nums">{row.gradePoint}</span>
                          <span className="text-gray-600 text-sm">/10</span>
                        </td>

                        {/* Progress bar */}
                        <td className="px-6 py-4">
                          <div className="space-y-1.5">
                            <div className="relative h-2 bg-gray-800/80 rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{ delay: idx * 0.05 + 0.2, duration: 0.7, ease: "easeOut" }}
                                className="absolute inset-y-0 left-0 rounded-full"
                                style={{ background: `linear-gradient(90deg, ${c.bar}80, ${c.bar})` }}
                              />
                            </div>
                            <p className="text-[10px] text-gray-600">{row.marksRange}</p>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="px-7 py-5 border-t border-gray-800/50 bg-[#0a0a0f]/40">
              <div className="flex flex-wrap items-center gap-8">
                {/* SGPA achieved */}
                <div>
                  <p className="text-[10px] text-gray-600 uppercase tracking-widest font-semibold mb-1">SGPA Achieved</p>
                  <p className="text-3xl font-black text-emerald-400 tabular-nums">
                    {achievedSGPA.toFixed(2)}
                    <span className="text-base font-normal text-gray-600"> / 10.00</span>
                  </p>
                </div>

                <div className="w-px h-10 bg-gray-800" />

                {/* Total credits */}
                <div>
                  <p className="text-[10px] text-gray-600 uppercase tracking-widest font-semibold mb-1">Total Credits</p>
                  <p className="text-3xl font-black text-white tabular-nums">{totalCredits}</p>
                </div>

                <div className="w-px h-10 bg-gray-800" />

                {/* Subject count */}
                <div>
                  <p className="text-[10px] text-gray-600 uppercase tracking-widest font-semibold mb-1">Subjects</p>
                  <p className="text-3xl font-black text-white tabular-nums">{rows.length}</p>
                </div>

                <div className="flex-1" />

                {/* Formula note */}
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--brand-start)]/5 border border-[var(--brand-start)]/15 text-xs text-gray-500 max-w-xs">
                  <Info className="w-3.5 h-3.5 text-[var(--brand-start)] flex-shrink-0" />
                  <span>
                    <span className="text-[var(--brand-start)] font-semibold">IPU Formula: </span>
                    SGPA = Σ(GP × Credits) ÷ Σ(Credits)
                  </span>
                </div>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
