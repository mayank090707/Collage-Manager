import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import {
  ArrowLeft,
  Target,
  TrendingUp,
  Info,
  AlertCircle,
  Calculator,
  BookOpen,
  ChevronRight,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

// ── IPU Grade Table (10-point scale) ──────────────────────────────────────────
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

function getGradeForGP(gp: number) {
  return GRADE_TABLE.find((g) => g.gp === gp) ?? GRADE_TABLE[GRADE_TABLE.length - 1];
}

function gradeColor(grade: string) {
  if (grade === "O")  return { bg: "bg-emerald-500/15 border-emerald-500/40",  text: "text-emerald-400",              bar: "#10b981" };
  if (grade === "A+") return { bg: "bg-amber-500/15 border-amber-500/40",       text: "text-amber-400",                bar: "#f59e0b" };
  if (grade === "A")  return { bg: "bg-sky-500/15 border-sky-500/40",           text: "text-sky-400",                  bar: "#38bdf8" };
  if (grade === "B+") return { bg: "bg-orange-500/15 border-orange-500/40",     text: "text-orange-400",               bar: "#f97316" };
  if (grade === "B")  return { bg: "bg-violet-500/15 border-violet-500/40",     text: "text-violet-400",               bar: "#8b5cf6" };
  if (grade === "C")  return { bg: "bg-yellow-500/15 border-yellow-500/40",     text: "text-yellow-400",               bar: "#eab308" };
  if (grade === "P")  return { bg: "bg-rose-500/15 border-rose-500/40",         text: "text-rose-400",                 bar: "#f43f5e" };
  return                     { bg: "bg-red-500/15 border-red-500/40",           text: "text-red-400",                  bar: "#ef4444" };
}

// ── IPU 10-point scale: distribute grade points to subjects ───────────────────
// Formula: SGPA = Σ(GP_i × C_i) / Σ(C_i)
// We solve for marks needed per subject by assigning GP floor then upgrading high-credit subjects.
interface SubjectResult {
  name: string;
  credits: number;
  gradePoint: number;
  grade: string;
  minMarks: number;
  marksRange: string;
}

function computeSubjectTargets(
  subjects: { name: string; credits: number }[],
  targetSGPA: number
): SubjectResult[] {
  if (subjects.length === 0) return [];

  const totalCredits = subjects.reduce((s, sub) => s + sub.credits, 0);
  const totalGPNeeded = targetSGPA * totalCredits;

  const sorted = [...subjects].sort((a, b) => b.credits - a.credits);
  const gpAssign: number[] = sorted.map(() => Math.floor(targetSGPA));

  let currentTotal = gpAssign.reduce((acc, gp, i) => acc + gp * sorted[i].credits, 0);

  // Upgrade subjects (highest credit first) until we reach the needed GP total
  for (let i = 0; i < gpAssign.length; i++) {
    while (currentTotal < totalGPNeeded && gpAssign[i] < 10) {
      gpAssign[i]++;
      currentTotal += sorted[i].credits;
    }
    if (currentTotal >= totalGPNeeded) break;
  }

  return sorted.map((sub, i) => {
    const gradeInfo = getGradeForGP(gpAssign[i]);
    return {
      name: sub.name,
      credits: sub.credits,
      gradePoint: gpAssign[i],
      grade: gradeInfo?.grade ?? "F",
      minMarks: gradeInfo?.minMarks ?? 0,
      marksRange: gradeInfo?.marksRange ?? "—",
    };
  });
}

// ── Component ─────────────────────────────────────────────────────────────────
export function TargetPredictor() {
  const navigate = useNavigate();

  // Section A: SGPA-to-CGPA stats
  const [stats, setStats] = useState({
    currentCgpa: 0,
    targetCgpa: 0,
    requiredSgpa: 0,
    gap: 0,
    isPossible: true,
  });

  // Section B: Grade breakdown for target CGPA
  interface RequiredRecord { grade: string; count: number; credits: number; marksRange: string; }
  const [requirements, setRequirements] = useState<RequiredRecord[]>([]);

  // Section C: Marks Predictor
  const [subjects, setSubjects] = useState<{ name: string; credits: number }[]>([]);
  const [predictSGPA, setPredictSGPA] = useState<string>("8.5");
  const [predictedResults, setPredictedResults] = useState<SubjectResult[]>([]);
  const [predictError, setPredictError] = useState<string>("");
  const [semesterNum, setSemesterNum] = useState<number>(1);

  // ── Initial load ────────────────────────────────────────────────────────────
  useEffect(() => {
    const calculate = () => {
      const target     = parseFloat(localStorage.getItem("target_cgpa") || "0");
      const savedMarks = JSON.parse(localStorage.getItem("semester_marks") || "[]");
      const subs       = JSON.parse(localStorage.getItem("subjects") || "[]");
      const profile    = JSON.parse(localStorage.getItem("student_profile") || "{}");
      const currentSemNum = parseInt(profile.currentSemester || "1");

      setSemesterNum(currentSemNum);
      setSubjects(subs);

      const currentSemCredits = subs.reduce((a: number, s: any) => a + (s.credits || 0), 0);
      const previousSemMarks  = savedMarks.filter((m: any) => m.semester < currentSemNum);
      const sumPreviousSGPAs  = previousSemMarks.reduce((a: number, m: any) => a + (m.sgpa || 0), 0);
      const reqSGPA           = (target * currentSemNum) - sumPreviousSGPAs;

      // Current CGPA (credit-weighted)
      const allResults   = savedMarks.flatMap((m: any) => m.results || []);
      const totalCredits = allResults.reduce((s: number, r: any) => s + (r.credits || 0), 0);
      const weighted     = allResults.reduce((s: number, r: any) => s + (r.gradePoint * (r.credits || 0)), 0);
      const currentCgpa  = totalCredits > 0 ? weighted / totalCredits : 0;

      setStats({
        currentCgpa,
        targetCgpa: target,
        requiredSgpa: Math.max(0, reqSGPA),
        gap: Math.max(0, target - currentCgpa),
        isPossible: reqSGPA <= 10.0,
      });

      // Grade distribution for Grade Requirements card
      if (reqSGPA <= 10.0 && subs.length > 0) {
        const pointsNeeded   = reqSGPA * currentSemCredits;
        const sortedSubs     = [...subs].sort((a: any, b: any) => b.credits - a.credits);
        const gpArr: number[] = sortedSubs.map(() => Math.floor(reqSGPA));
        let currentTotalGP   = gpArr.reduce((acc, gp, i) => acc + gp * sortedSubs[i].credits, 0);

        for (let i = 0; i < gpArr.length; i++) {
          while (currentTotalGP < pointsNeeded && gpArr[i] < 10) {
            gpArr[i]++;
            currentTotalGP += sortedSubs[i].credits;
          }
        }

        const groups: Record<string, RequiredRecord> = {};
        gpArr.forEach((gp, i) => {
          const grade = GRADE_TABLE.find(g => g.gp === gp)?.grade || "F";
          const key   = `${grade}-${sortedSubs[i].credits}`;
          if (!groups[key]) {
            groups[key] = {
              grade,
              count: 0,
              credits: sortedSubs[i].credits,
              marksRange: GRADE_TABLE.find(g => g.gp === gp)?.marksRange || "0",
            };
          }
          groups[key].count++;
        });

        setRequirements(Object.values(groups).sort((a, b) => b.credits - a.credits));
      }
    };

    calculate();
    window.addEventListener("storage", calculate);
    return () => window.removeEventListener("storage", calculate);
  }, []);

  // ── Marks Predictor handler ─────────────────────────────────────────────────
  const handlePredict = () => {
    setPredictError("");
    const val = parseFloat(predictSGPA);
    if (isNaN(val) || val < 0 || val > 10) {
      setPredictError("Please enter a valid SGPA between 0.00 and 10.00.");
      return;
    }
    if (subjects.length === 0) {
      setPredictError("No subjects found. Please complete onboarding first.");
      return;
    }
    const results = computeSubjectTargets(subjects, val);
    setPredictedResults(results);
  };

  // Verify SGPA achieved from predicted results
  const verifiedSGPA =
    predictedResults.length > 0
      ? predictedResults.reduce((s, r) => s + r.gradePoint * r.credits, 0) /
        predictedResults.reduce((s, r) => s + r.credits, 0)
      : null;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="p-8 space-y-10 max-w-6xl mx-auto">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate("/app")} className="text-gray-400 hover:text-white">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Dashboard
          </Button>
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-[var(--brand-start)] to-[var(--brand-end)] bg-clip-text text-transparent">
              Target Predictor
            </h1>
            <p className="text-gray-400">Strategic grade breakdown for Semester {semesterNum}</p>
          </div>
        </div>

        {stats.targetCgpa > 0 && (
          <div className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-gradient-to-r from-[var(--brand-start)]/10 to-[var(--brand-end)]/10 border border-[var(--brand-start)]/20">
            <div className="text-right">
              <p className="text-xs text-gray-500 uppercase tracking-tighter">CGPA Gap</p>
              <p className={`text-2xl font-black ${stats.gap > 0 ? "text-orange-400" : "text-emerald-400"}`}>
                {stats.gap.toFixed(2)}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Alert: target unreachable ── */}
      {!stats.isPossible && (
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="p-6 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-start gap-4">
          <AlertCircle className="w-8 h-8 text-red-500 flex-shrink-0" />
          <div className="space-y-1">
            <h3 className="text-xl font-bold text-red-400">Target Unreachable This Semester</h3>
            <p className="text-red-300/80">
              Your required SGPA of <span className="font-bold">{stats.requiredSgpa.toFixed(2)}</span> exceeds 10.0.
              Consider adjusting your target CGPA for a more gradual approach.
            </p>
          </div>
        </motion.div>
      )}

      {/* ── Summary Cards (2: Target CGPA + Required SGPA) ── */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-6 bg-[#111118]/80 border-gray-800/50 flex flex-col items-center justify-center text-center space-y-2">
          <Target className="w-8 h-8 text-[var(--brand-start)] mb-2" />
          <p className="text-sm text-gray-400 uppercase tracking-widest">Target CGPA</p>
          <p className="text-4xl font-black text-white">{stats.targetCgpa.toFixed(2)}</p>
        </Card>
        <Card className="p-6 bg-[#111118]/80 border-gray-800/50 flex flex-col items-center justify-center text-center space-y-2">
          <TrendingUp className="w-8 h-8 text-[var(--brand-end)] mb-2" />
          <p className="text-sm text-gray-400 uppercase tracking-widest">Required SGPA This Semester</p>
          <p className={`text-4xl font-black ${stats.isPossible ? "text-[var(--brand-end)]" : "text-red-500"}`}>
            {stats.requiredSgpa > 10 ? "10.0+" : stats.requiredSgpa.toFixed(2)}
          </p>
        </Card>
      </div>

      {/* ── Section A: Grade Requirements breakdown ── */}
      <div className="grid lg:grid-cols-2 gap-8">
        <Card className="bg-[#111118]/80 border-gray-800/50 p-8 space-y-6">
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[var(--brand-start)]/20 text-[var(--brand-start)]">
              <Calculator className="w-5 h-5" />
            </div>
            Grade Requirements
          </h2>
          <div className="space-y-4">
            {requirements.length > 0 ? requirements.map((req, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08 }}
                className="flex items-center justify-between p-4 rounded-xl bg-[#0a0a0f]/50 border border-gray-800 hover:border-[var(--brand-start)]/30 transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-xl border-2 flex flex-col items-center justify-center font-bold bg-black/40 ${
                    req.grade === "O"  ? "border-emerald-500 text-emerald-400" :
                    req.grade === "A+" ? "border-amber-500 text-amber-400" :
                    req.grade === "A"  ? "border-sky-500 text-sky-400" :
                    "border-gray-700 text-gray-400"
                  }`}>
                    <span className="text-xs opacity-50 font-normal">Grade</span>
                    <span className="text-xl -mt-1">{req.grade}</span>
                  </div>
                  <div>
                    <p className="text-white font-semibold text-lg">{req.count} Subject{req.count > 1 ? "s" : ""}</p>
                    <p className="text-sm text-gray-400">{req.credits} Credits each · Marks: {req.marksRange}</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-600" />
              </motion.div>
            )) : (
              <p className="text-gray-500 italic">No data. Ensure subjects are added during onboarding.</p>
            )}
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="bg-[#111118]/80 border-gray-800/50 p-6">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Info className="w-5 h-5 text-[var(--brand-start)]" />
              Strategic Insight
            </h3>
            <div className="space-y-4">
              <p className="text-gray-400 text-sm leading-relaxed">
                This prediction prioritizes obtaining higher grades in subjects with{" "}
                <span className="text-white font-bold">higher credits</span>, as they have a
                disproportionate impact on your SGPA.
              </p>
              {requirements[0] && (
                <div className="p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/10">
                  <p className="text-xs text-indigo-300 font-semibold mb-1 uppercase tracking-wider">Top Priority</p>
                  <p className="text-sm text-gray-300">
                    Focus heavily on the {requirements[0].credits}-credit subjects. An 'O' grade in a
                    high-credit subject can offset a lower grade in a smaller one.
                  </p>
                </div>
              )}
            </div>
          </Card>

          <Card className="bg-gradient-to-br from-[var(--brand-start)]/10 to-[var(--brand-end)]/10 border-[var(--brand-start)]/20 p-6">
            <h3 className="text-white font-bold mb-2">How it works</h3>
            <ul className="space-y-2 text-sm text-gray-400">
              {[
                "Analyzes current CGPA and your target to compute required SGPA.",
                "Distributes grade points across subjects weighted by credits.",
                "Uses the IPU 10-point scale: SGPA = Σ(GP × Credits) / Σ(Credits).",
              ].map((txt, i) => (
                <li key={i} className="flex gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--brand-start)] mt-1.5 flex-shrink-0" />
                  {txt}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      {/* ── Section B: Marks Predictor (target SGPA → marks per subject) ── */}
      <Card className="bg-[#111118]/80 border-gray-800/50 overflow-hidden">
        <div className="p-6 border-b border-gray-800/50 bg-gradient-to-r from-[var(--brand-start)]/5 to-[var(--brand-end)]/5">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-lg bg-[var(--brand-end)]/20 text-[var(--brand-end)]">
              <BookOpen className="w-5 h-5" />
            </div>
            <h2 className="text-2xl font-bold text-white">Marks Predictor</h2>
          </div>
          <p className="text-sm text-gray-400 ml-14">
            Enter a target SGPA for this semester and see the exact marks needed per subject.
          </p>
        </div>

        {/* Current semester subjects chip row */}
        <div className="px-6 pt-5">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">
            Semester {semesterNum} Subjects (from Onboarding)
          </p>
          {subjects.length > 0 ? (
            <div className="flex flex-wrap gap-2 mb-5">
              {subjects.map((s, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--brand-start)]/10 border border-[var(--brand-start)]/25 text-sm text-white"
                >
                  <span className="text-[var(--brand-start)] font-bold text-xs">{s.credits}cr</span>
                  {s.name}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 italic text-sm mb-5">
              No subjects found. Please complete onboarding to add subjects.
            </p>
          )}
        </div>

        {/* SGPA input row */}
        <div className="px-6 pb-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm text-gray-400 mb-2 font-medium">
                Target SGPA for This Semester
              </label>
              <input
                type="number"
                min="0"
                max="10"
                step="0.01"
                value={predictSGPA}
                onChange={(e) => setPredictSGPA(e.target.value)}
                className="w-full bg-[#0a0a0f] border border-gray-700 rounded-xl px-4 py-3 text-white text-lg font-semibold focus:outline-none focus:border-[var(--brand-start)] transition-colors placeholder:text-gray-600"
                placeholder="e.g. 8.5"
              />
              {predictError && (
                <p className="text-red-400 text-xs mt-1">{predictError}</p>
              )}
            </div>
            <Button
              onClick={handlePredict}
              className="bg-gradient-to-r from-[var(--brand-start)] to-[var(--brand-end)] text-black font-bold px-8 py-3 rounded-xl hover:opacity-90 transition-opacity h-[52px]"
            >
              <Calculator className="w-4 h-4 mr-2" />
              Predict Marks
            </Button>
          </div>
        </div>

        {/* Results table */}
        <AnimatePresence>
          {predictedResults.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
            >
              {/* Grade scale legend */}
              <div className="mx-6 mb-4 flex gap-1.5 flex-wrap">
                {GRADE_TABLE.slice(0, -1).map((g) => {
                  const c = gradeColor(g.grade);
                  return (
                    <span
                      key={g.grade}
                      className={`text-xs px-2 py-0.5 rounded border ${c.bg} ${c.text}`}
                    >
                      {g.grade} ≥{g.minMarks}
                    </span>
                  );
                })}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-[#0a0a0f]/60 border-t border-gray-800/40">
                    <tr>
                      {["#", "Subject", "Credits", "Min Marks Needed", "Marks Range", "Grade", "GP"].map((h, i) => (
                        <th
                          key={i}
                          className={`p-4 text-gray-400 text-xs font-medium uppercase tracking-wide ${i === 0 ? "text-left w-8" : i <= 1 ? "text-left" : "text-center"}`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {predictedResults.map((row, idx) => {
                      const colors = gradeColor(row.grade);
                      return (
                        <motion.tr
                          key={idx}
                          initial={{ opacity: 0, x: -15 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          className="border-b border-gray-800/30 hover:bg-gray-800/10 transition-colors"
                        >
                          <td className="p-4 text-gray-600 text-sm">{idx + 1}</td>
                          <td className="p-4 text-white font-medium">{row.name}</td>
                          <td className="p-4 text-center">
                            <span className="px-2 py-1 rounded bg-[var(--brand-start)]/10 text-[var(--brand-start)] text-sm font-semibold">
                              {row.credits}
                            </span>
                          </td>
                          <td className="p-4 text-center">
                            <span className={`text-2xl font-bold ${colors.text}`}>{row.minMarks}</span>
                            <span className="text-gray-500 text-sm"> /100</span>
                          </td>
                          <td className="p-4 text-center text-gray-400 text-sm">{row.marksRange}</td>
                          <td className="p-4 text-center">
                            <span className={`px-3 py-1 rounded-lg border text-sm font-bold ${colors.bg} ${colors.text}`}>
                              {row.grade}
                            </span>
                          </td>
                          <td className="p-4 text-center">
                            <span className="text-lg font-bold text-white">{row.gradePoint}</span>
                            <span className="text-gray-500 text-sm">/10</span>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Footer summary */}
              <div className="p-6 border-t border-gray-800/50 bg-[#0a0a0f]/30 flex flex-wrap items-center gap-6">
                <div>
                  <p className="text-xs text-gray-400 mb-1">Predicted SGPA Achieved</p>
                  <p className="text-3xl font-black text-emerald-400">
                    {verifiedSGPA?.toFixed(2)} <span className="text-base font-normal text-gray-500">/ 10.00</span>
                  </p>
                </div>
                <div className="w-px h-10 bg-gray-700" />
                <div>
                  <p className="text-xs text-gray-400 mb-1">Total Credits</p>
                  <p className="text-3xl font-black text-white">
                    {predictedResults.reduce((s, r) => s + r.credits, 0)}
                  </p>
                </div>
                <div className="flex-1" />
                <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-sm text-emerald-400 max-w-xs">
                  <span className="font-bold">Formula used:</span>{" "}
                  SGPA = Σ(GP × Credits) ÷ Σ(Credits) · IPU 10-point scale
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </div>
  );
}

