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
  Lightbulb,
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

interface AlternativeCombo {
  assignments: { name: string; credits: number; gp: number; grade: string; minMarks: number }[];
  sgpa: number;
  label: string;  // brief human description
}

// ── colour helper ─────────────────────────────────────────────────────────────
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

// ── Primary distribution (upgrade highest-credit subjects first) ──────────────
// Formula: SGPA = Σ(GP_i × C_i) / Σ(C_i)
function computeSubjectTargets(
  subjects: { name: string; credits: number }[],
  targetSGPA: number
): SubjectResult[] {
  if (subjects.length === 0 || targetSGPA <= 0) return [];

  const clamped = Math.min(targetSGPA, 10);
  const totalC  = subjects.reduce((s, sub) => s + sub.credits, 0);
  const needed  = clamped * totalC;

  const sorted = [...subjects].sort((a, b) => b.credits - a.credits);
  const gp: number[] = sorted.map(() => Math.floor(clamped));
  let total = gp.reduce((acc, g, i) => acc + g * sorted[i].credits, 0);

  for (let i = 0; i < gp.length; i++) {
    while (total < needed && gp[i] < 10) { gp[i]++; total += sorted[i].credits; }
    if (total >= needed) break;
  }

  return sorted.map((sub, i) => {
    const info = GRADE_TABLE.find(g => g.gp === gp[i]) ?? GRADE_TABLE[GRADE_TABLE.length - 1];
    return { name: sub.name, credits: sub.credits, gradePoint: gp[i], grade: info.grade, minMarks: info.minMarks, marksRange: info.marksRange };
  });
}

// ── Alternative combinations ──────────────────────────────────────────────────
// Generate up to 4 distinct grade-assignment vectors that satisfy the same SGPA
// (within ±0.005 floating-point tolerance) using different priority orderings.
function computeAlternatives(
  subjects: { name: string; credits: number }[],
  targetSGPA: number,
  primaryRows: SubjectResult[]
): AlternativeCombo[] {
  if (subjects.length < 2) return [];

  const clamped = Math.min(targetSGPA, 10);
  const totalC  = subjects.reduce((s, sub) => s + sub.credits, 0);
  const needed  = clamped * totalC;
  const TOLERANCE = 0.005;

  // Helper: given a sorted order, do the standard greedy assignment & return combo
  const tryOrder = (
    ordered: { name: string; credits: number }[],
    label: string
  ): AlternativeCombo | null => {
    const gp: number[] = ordered.map(() => Math.floor(clamped));
    let total = gp.reduce((acc, g, i) => acc + g * ordered[i].credits, 0);
    for (let i = 0; i < gp.length; i++) {
      while (total < needed && gp[i] < 10) { gp[i]++; total += ordered[i].credits; }
      if (total >= needed) break;
    }
    const sgpa = gp.reduce((acc, g, i) => acc + g * ordered[i].credits, 0) / totalC;
    if (Math.abs(sgpa - clamped) > TOLERANCE) return null;  // doesn't satisfy the target

    // Check distinct from primary
    const primaryGPMap = Object.fromEntries(primaryRows.map(r => [r.name, r.gradePoint]));
    const isDifferent = ordered.some((sub, i) => gp[i] !== primaryGPMap[sub.name]);
    if (!isDifferent) return null;

    return {
      sgpa,
      label,
      assignments: ordered.map((sub, i) => {
        const info = GRADE_TABLE.find(g => g.gp === gp[i]) ?? GRADE_TABLE[GRADE_TABLE.length - 1];
        return { name: sub.name, credits: sub.credits, gp: gp[i], grade: info.grade, minMarks: info.minMarks };
      }),
    };
  };

  const combos: AlternativeCombo[] = [];
  const seen = new Set<string>();

  const addIfNew = (combo: AlternativeCombo | null) => {
    if (!combo) return;
    const key = combo.assignments.map(a => `${a.name}:${a.gp}`).join("|");
    if (seen.has(key)) return;
    seen.add(key);
    combos.push(combo);
  };

  // Strategy 2 — upgrade lowest-credit subjects first
  const byCreditsAsc = [...subjects].sort((a, b) => a.credits - b.credits);
  addIfNew(tryOrder(byCreditsAsc, "Upgrade smaller subjects first"));

  // Strategy 3 — alternating (odd indices high, even low)
  const byName = [...subjects].sort((a, b) => a.name.localeCompare(b.name));
  const interleaved = [
    ...byName.filter((_, i) => i % 2 === 0),
    ...byName.filter((_, i) => i % 2 !== 0),
  ];
  addIfNew(tryOrder(interleaved, "Mixed priority order"));

  // Strategy 4 — reverse alphabetical
  const byNameDesc = [...subjects].sort((a, b) => b.name.localeCompare(a.name));
  addIfNew(tryOrder(byNameDesc, "Score later-listed subjects higher"));

  // Strategy 5 — uniform floor (all same GP, no upgrades needed)
  const floorGP = Math.floor(clamped);
  const uniformTotal = floorGP * totalC;
  if (Math.abs(uniformTotal / totalC - clamped) <= TOLERANCE) {
    const key = subjects.map(s => `${s.name}:${floorGP}`).join("|");
    if (!seen.has(key)) {
      const primaryGPMap = Object.fromEntries(primaryRows.map(r => [r.name, r.gradePoint]));
      const isDifferent = subjects.some(s => floorGP !== primaryGPMap[s.name]);
      if (isDifferent) {
        seen.add(key);
        const info = GRADE_TABLE.find(g => g.gp === floorGP) ?? GRADE_TABLE[GRADE_TABLE.length - 1];
        combos.push({
          sgpa: clamped,
          label: "Same grade in every subject",
          assignments: subjects.map(sub => ({ name: sub.name, credits: sub.credits, gp: floorGP, grade: info.grade, minMarks: info.minMarks })),
        });
      }
    }
  }

  return combos.slice(0, 3); // cap at 3 alternatives
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
  const [alternatives, setAlternatives] = useState<AlternativeCombo[]>([]);

  useEffect(() => {
    const compute = () => {
      const target     = parseFloat(localStorage.getItem("target_cgpa") || "0");
      const savedMarks = JSON.parse(localStorage.getItem("semester_marks") || "[]");
      const subs       = JSON.parse(localStorage.getItem("subjects") || "[]");
      const profile    = JSON.parse(localStorage.getItem("student_profile") || "{}");
      const semNum     = parseInt(profile.currentSemester || "1");

      setSemesterNum(semNum);

      // Only use previous semesters that have real marks (sgpa !== -1 sentinel)
      const prevMarks    = savedMarks.filter((m: any) => m.semester < semNum && m.sgpa !== -1);
      const sumPrevSGPAs = prevMarks.reduce((a: number, m: any) => a + (m.sgpa || 0), 0);
      const reqSGPA      = (target * semNum) - sumPrevSGPAs;

      // Current CGPA (credit-weighted, real marks only)
      const allResults   = prevMarks.flatMap((m: any) => m.results || []);
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

      const effectiveSGPA = Math.min(Math.max(reqSGPA, 0), 10);
      const computed = computeSubjectTargets(subs, effectiveSGPA);
      setRows(computed);
      setTotalCredits(subs.reduce((s: number, sub: any) => s + (sub.credits || 0), 0));

      // Generate alternative combos
      const alts = computeAlternatives(subs, effectiveSGPA, computed);
      setAlternatives(alts);
    };

    compute();
    window.addEventListener("storage", compute);
    return () => window.removeEventListener("storage", compute);
  }, []);

  const achievedSGPA =
    rows.length > 0 && totalCredits > 0
      ? rows.reduce((s, r) => s + r.gradePoint * r.credits, 0) / totalCredits
      : 0;

  return (
    <div className="p-6 md:p-10 space-y-8 max-w-5xl mx-auto">

      {/* ── Header ───────────────────────────────────────────────────────────── */}
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

        <Card className={`relative overflow-hidden border p-6 ${
          stats.isPossible ? "bg-[#111118]/90 border-gray-800/50" : "bg-red-500/8 border-red-500/30"
        }`}>
          <div className={`absolute inset-0 bg-gradient-to-br pointer-events-none ${
            stats.isPossible ? "from-[var(--brand-end)]/8 to-transparent" : "from-red-500/10 to-transparent"
          }`} />
          <div className="flex items-center gap-3 mb-3">
            <div className={`p-2 rounded-xl border ${
              stats.isPossible ? "bg-[var(--brand-end)]/15 border-[var(--brand-end)]/20" : "bg-red-500/15 border-red-500/20"
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
                        <td className="px-6 py-4 text-gray-700 text-sm tabular-nums">{idx + 1}</td>
                        <td className="px-6 py-4">
                          <span className="text-white font-semibold text-[15px] group-hover:text-[var(--brand-start)] transition-colors">
                            {row.name}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-[var(--brand-start)]/10 border border-[var(--brand-start)]/20 text-[var(--brand-start)] font-bold text-sm">
                            {row.credits}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`text-3xl font-black tabular-nums ${c.mark}`}>{row.minMarks}</span>
                          <span className="text-gray-600 text-sm ml-0.5">/100</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-block px-3 py-1 rounded-lg border text-sm font-bold ${c.badge}`}>
                            {row.grade}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-xl font-black text-white tabular-nums">{row.gradePoint}</span>
                          <span className="text-gray-600 text-sm">/10</span>
                        </td>
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
                <div>
                  <p className="text-[10px] text-gray-600 uppercase tracking-widest font-semibold mb-1">SGPA Achieved</p>
                  <p className="text-3xl font-black text-emerald-400 tabular-nums">
                    {achievedSGPA.toFixed(2)}
                    <span className="text-base font-normal text-gray-600"> / 10.00</span>
                  </p>
                </div>
                <div className="w-px h-10 bg-gray-800" />
                <div>
                  <p className="text-[10px] text-gray-600 uppercase tracking-widest font-semibold mb-1">Total Credits</p>
                  <p className="text-3xl font-black text-white tabular-nums">{totalCredits}</p>
                </div>
                <div className="w-px h-10 bg-gray-800" />
                <div>
                  <p className="text-[10px] text-gray-600 uppercase tracking-widest font-semibold mb-1">Subjects</p>
                  <p className="text-3xl font-black text-white tabular-nums">{rows.length}</p>
                </div>
                <div className="flex-1" />
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

      {/* ── Alternative Options ───────────────────────────────────────────────── */}
      {alternatives.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="space-y-4"
        >
          {/* Section heading */}
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/15 border border-indigo-500/20">
              <Lightbulb className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Another Option</h2>
              <p className="text-xs text-gray-500">
                Different grade combinations that achieve the same SGPA of{" "}
                <span className="text-indigo-400 font-semibold">{achievedSGPA.toFixed(2)}</span>
              </p>
            </div>
          </div>

          <div className="grid gap-4">
            {alternatives.map((alt, ai) => (
              <Card key={ai} className="bg-[#111118]/90 border-gray-800/40 overflow-hidden">
                {/* Alt card header */}
                <div className="px-6 py-4 border-b border-gray-800/40 bg-indigo-500/5 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-bold">
                      {ai + 1}
                    </span>
                    <p className="text-sm font-semibold text-indigo-300">{alt.label}</p>
                  </div>
                  <span className="text-xs text-gray-500">
                    SGPA achieved:&nbsp;
                    <span className="text-indigo-400 font-bold">{alt.sgpa.toFixed(2)}</span>
                  </span>
                </div>

                {/* Alt rows */}
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-[#0d0d14]/50">
                        {["Subject", "Credits", "Min Marks", "Grade", "GP"].map((h, i) => (
                          <th
                            key={i}
                            className={`px-5 py-3 text-[10px] text-gray-600 font-semibold uppercase tracking-widest ${i === 0 ? "text-left" : "text-center"}`}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {alt.assignments.map((a, si) => {
                        const c  = gradeColor(a.grade);
                        // Highlight changes vs primary
                        const primary = rows.find(r => r.name === a.name);
                        const changed = primary && primary.gradePoint !== a.gp;
                        return (
                          <tr
                            key={si}
                            className={`border-b border-gray-800/30 transition-colors ${changed ? "bg-indigo-500/5" : "hover:bg-white/[0.01]"}`}
                          >
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-2">
                                <span className={`text-sm font-medium ${changed ? "text-indigo-200" : "text-gray-300"}`}>
                                  {a.name}
                                </span>
                                {changed && (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 font-semibold uppercase tracking-wide">
                                    different
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-5 py-3 text-center">
                              <span className="text-sm text-gray-400 font-semibold">{a.credits}</span>
                            </td>
                            <td className="px-5 py-3 text-center">
                              <span className={`text-xl font-black tabular-nums ${c.mark}`}>{a.minMarks}</span>
                              <span className="text-gray-700 text-xs">/100</span>
                            </td>
                            <td className="px-5 py-3 text-center">
                              <span className={`inline-block px-2.5 py-0.5 rounded-lg border text-xs font-bold ${c.badge}`}>
                                {a.grade}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-center">
                              <span className="text-base font-black text-white tabular-nums">{a.gp}</span>
                              <span className="text-gray-600 text-xs">/10</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Alt footer note */}
                <div className="px-6 py-3 border-t border-gray-800/30 bg-[#0a0a0f]/30">
                  <p className="text-[11px] text-gray-600">
                    <span className="text-indigo-400 font-semibold">Note: </span>
                    Rows highlighted in blue differ from the primary recommendation above.
                    Both combinations yield an identical SGPA of{" "}
                    <span className="text-white font-semibold">{alt.sgpa.toFixed(2)}</span>.
                  </p>
                </div>
              </Card>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
