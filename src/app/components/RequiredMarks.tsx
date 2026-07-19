import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { ArrowLeft, Target, Award, TrendingUp, Info, AlertTriangle } from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";

interface Subject {
  name: string;
  credits: number;
}

interface RequiredRow {
  name: string;
  credits: number;
  requiredMarks: number;
  grade: string;
  gradePoint: number;
  achievable: boolean;
}

// IPU grade thresholds
const GRADE_TABLE = [
  { min: 90, grade: "O",  gp: 10 },
  { min: 75, grade: "A+", gp: 9  },
  { min: 65, grade: "A",  gp: 8  },
  { min: 55, grade: "B+", gp: 7  },
  { min: 50, grade: "B",  gp: 6  },
  { min: 45, grade: "C",  gp: 5  },
  { min: 40, grade: "P",  gp: 4  },
  { min: 0,  grade: "F",  gp: 0  },
];

function getGradeForMarks(marks: number) {
  return GRADE_TABLE.find((g) => marks >= g.min) ?? GRADE_TABLE[GRADE_TABLE.length - 1];
}

// Hardcoded required marks per subject (representative IPU values for a target ~8.5 SGPA)
// These represent the minimum marks each subject needs to hit to collectively clear the semester well.
const HARDCODED_REQUIRED: Record<string, number> = {
  default: 75, // A+ band by default
};

// Extra overrides for common subject names to add variety
const SUBJECT_OVERRIDES: Array<{ keyword: string; marks: number }> = [
  { keyword: "mathematics",   marks: 70 },
  { keyword: "math",          marks: 70 },
  { keyword: "physics",       marks: 65 },
  { keyword: "chemistry",     marks: 65 },
  { keyword: "drawing",       marks: 80 },
  { keyword: "graphics",      marks: 80 },
  { keyword: "communication", marks: 75 },
  { keyword: "english",       marks: 75 },
  { keyword: "project",       marks: 85 },
  { keyword: "seminar",       marks: 85 },
  { keyword: "lab",           marks: 80 },
  { keyword: "practical",     marks: 80 },
  { keyword: "training",      marks: 85 },
];

function getRequiredMarks(subjectName: string): number {
  const lower = subjectName.toLowerCase();
  const override = SUBJECT_OVERRIDES.find((o) => lower.includes(o.keyword));
  return override ? override.marks : HARDCODED_REQUIRED.default;
}

function gradeColor(grade: string) {
  if (grade === "O")  return { bg: "bg-emerald-500/15 border-emerald-500/40", text: "text-emerald-300", bar: "#10b981" };
  if (grade === "A+") return { bg: "bg-[var(--brand-start)]/15 border-[var(--brand-start)]/40",    text: "text-[var(--brand-start)]",   bar: "#fbbf24" };
  if (grade === "A")  return { bg: "bg-sky-500/15 border-sky-500/40",         text: "text-sky-300",     bar: "#38bdf8" };
  if (grade === "B+") return { bg: "bg-[var(--brand-end)]/15 border-[var(--brand-end)]/40",    text: "text-[var(--brand-end)]",   bar: "#f97316" };
  if (grade === "B")  return { bg: "bg-violet-500/15 border-violet-500/40",   text: "text-violet-300",  bar: "#8b5cf6" };
  if (grade === "C")  return { bg: "bg-yellow-500/15 border-yellow-500/40",   text: "text-yellow-300",  bar: "#eab308" };
  if (grade === "P")  return { bg: "bg-orange-500/15 border-orange-500/40",   text: "text-orange-300",  bar: "#f97316" };
  return { bg: "bg-red-500/15 border-red-500/40", text: "text-red-400", bar: "#ef4444" };
}

export function RequiredMarks() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<RequiredRow[]>([]);
  const [targetSGPA, setTargetSGPA] = useState<number>(0);
  const [targetCGPA, setTargetCGPA] = useState<number>(0);
  const [maxAchievableSGPA, setMaxAchievableSGPA] = useState<number>(0);
  const [maxAchievableCGPA, setMaxAchievableCGPA] = useState<number>(0);
  const [profile, setProfile] = useState<{ fullName: string; currentSemester: string; targetCgpa?: string }>({ 
    fullName: "Student", 
    currentSemester: "1" 
  });

  const calculateRequirements = () => {
    const prof = JSON.parse(localStorage.getItem("student_profile") || "{}");
    if (!prof.currentSemester) {
      toast.error("Please complete onboarding first!");
      navigate("/onboarding");
      return;
    }
    setProfile(prof);

    const currentSemNum = parseInt(prof.currentSemester);
    const savedMarks = JSON.parse(localStorage.getItem("semester_marks") || "[]");
    const tCgpa = parseFloat(localStorage.getItem("target_cgpa") || prof.targetCgpa || "8.5");
    setTargetCGPA(tCgpa);

    // 1. Check if previous semesters are entered
    if (currentSemNum > 1) {
      const enteredSems = savedMarks.map((s: any) => s.semester);
      const missing = [];
      for (let i = 1; i < currentSemNum; i++) {
        if (!enteredSems.includes(i)) missing.push(i);
      }

      if (missing.length > 0) {
        toast.error(`Please enter marks for Semester ${missing.join(", ")} first!`);
        navigate("/app/enter-marks");
        return;
      }
    }

    // 2. Get current semester subjects from onboarding
    const subjects: Subject[] = JSON.parse(localStorage.getItem("subjects") || "[]");
    if (subjects.length === 0) {
      toast.error("No subjects found for current semester. Please update them in Enter Marks or Onboarding.");
      navigate("/app/enter-marks");
      return;
    }

    // 3. Calculation Logic
    // Formula: (SGPA1 + SGPA2 + ... + x) / N = targetCGPA
    // => x = (targetCGPA × N) - (SGPA1 + SGPA2 + ...)
    const previousSemMarks = savedMarks.filter((s: any) => s.semester < currentSemNum);
    const sumPreviousSGPAs = previousSemMarks.reduce((acc: number, s: any) => acc + (s.sgpa || 0), 0);

    const reqSGPA = (tCgpa * currentSemNum) - sumPreviousSGPAs;
    let targetSGPAValue = reqSGPA;
    setTargetSGPA(targetSGPAValue);

    // Max Achievable CGPA if this sem gets 10.0
    const maxAchievableCGPAValue = (sumPreviousSGPAs + 10.0) / currentSemNum;
    setMaxAchievableCGPA(maxAchievableCGPAValue);
    setMaxAchievableSGPA(10.0);

    // Reuse reqSGPA as local variable name for grade distribution below
    const currentSemCredits = subjects.reduce((acc, s) => acc + (s.credits || 0), 0);

    // 4. Intelligent Grade Distribution
    // We need reqSGPA for this semester.
    // Total Semester GP Needed = reqSGPA * currentSemCredits
    let remainingGPNeeded = reqSGPA * currentSemCredits;
    
    // Sort subjects by credits (descending) to prioritize high-credit subjects
    const sortedSubjects = [...subjects].sort((a, b) => b.credits - a.credits);
    const subjectGrades: Record<string, { gp: number; marks: number; grade: string }> = {};

    // First pass: Assign a floor GP to everyone
    const floorGP = Math.floor(reqSGPA);
    sortedSubjects.forEach(s => {
      subjectGrades[s.name] = { 
        gp: floorGP,
        marks: GRADE_TABLE.find(g => g.gp === floorGP)?.min || 40,
        grade: GRADE_TABLE.find(g => g.gp === floorGP)?.grade || "P"
      };
      remainingGPNeeded -= (floorGP * s.credits);
    });

    // Second pass: Distribute the remainder by upgrading subjects to GP + 1
    for (const s of sortedSubjects) {
      if (remainingGPNeeded <= 0) break;
      const current = subjectGrades[s.name];
      if (current.gp < 10) {
        const upgradeAvailable = 1.0 * s.credits; 
        // We always upgrade by 1 full grade point because that's how IPU grading works
        subjectGrades[s.name].gp += 1;
        const newGrade = GRADE_TABLE.find(g => g.gp === subjectGrades[s.name].gp) || GRADE_TABLE[0];
        subjectGrades[s.name].grade = newGrade.grade;
        subjectGrades[s.name].marks = newGrade.min;
        remainingGPNeeded -= upgradeAvailable;
      }
    }

    const built: RequiredRow[] = subjects.map((s) => ({
      name: s.name,
      credits: s.credits,
      requiredMarks: subjectGrades[s.name].marks,
      grade: subjectGrades[s.name].grade,
      gradePoint: subjectGrades[s.name].gp,
      achievable: reqSGPA <= 10.0
    }));

    setRows(built);
  };

  useEffect(() => {
    calculateRequirements();
    
    // Sync when storage changes (e.g. Target CGPA updated on Dashboard)
    const handleStorage = () => calculateRequirements();
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const totalCredits = rows.reduce((s, r) => s + r.credits, 0);

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4 flex-wrap">
        <Button variant="ghost" onClick={() => navigate("/app")} className="text-gray-400 hover:text-white hover:bg-gray-800/50">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>
        <div className="flex-1">
          <h1 className="text-4xl mb-1 bg-gradient-to-r from-[var(--brand-start)] via-white to-[var(--brand-end)] bg-clip-text text-transparent">
            Marks Required
          </h1>
          <p className="text-gray-400">Exact marks needed per subject this semester to reach your target CGPA</p>
        </div>
      </div>

      {/* Dependency Warning */}
      {targetSGPA > 10 && (
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/30">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-red-400 font-bold">Target CGPA Impossible This Semester</h4>
            <p className="text-sm text-red-300/80">
              Even with a perfect 10.0 SGPA, your CGPA would only reach <span className="font-bold">{maxAchievableCGPA.toFixed(2)}</span>.
              Try setting a more gradual target for this semester.
            </p>
          </div>
        </motion.div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-[#111118]/80 backdrop-blur-xl border-gray-800/50 p-5">
          <div className="flex items-center gap-3 mb-2">
            <Target className="w-5 h-5 text-[var(--brand-start)]" />
            <span className="text-xs text-gray-400">Target CGPA</span>
          </div>
          <p className="text-3xl font-bold text-white">{targetCGPA.toFixed(2)}</p>
        </Card>
        <Card className={`backdrop-blur-xl border p-5 ${targetSGPA <= 10 ? "bg-emerald-500/10 border-emerald-500/30" : "bg-red-500/10 border-red-500/30"}`}>
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className={`w-5 h-5 ${targetSGPA <= 10 ? "text-emerald-400" : "text-red-400"}`} />
            <span className="text-xs text-gray-400">Required SGPA</span>
          </div>
          <p className={`text-3xl font-bold ${targetSGPA <= 10 ? "text-emerald-400" : "text-red-400"}`}>{targetSGPA > 10 ? "10.0+" : targetSGPA.toFixed(2)}</p>
        </Card>
        <Card className="bg-[#111118]/80 backdrop-blur-xl border-gray-800/50 p-5">
          <div className="flex items-center gap-3 mb-2">
            <Award className="w-5 h-5 text-[var(--brand-end)]" />
            <span className="text-xs text-gray-400">Status</span>
          </div>
          <p className="text-xl font-bold text-white">{targetSGPA <= 10 ? "On Track" : "Goal Adjusted"}</p>
        </Card>
        <Card className="bg-[#111118]/80 backdrop-blur-xl border-gray-800/50 p-5">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            <span className="text-xs text-gray-400">Highest Achievable</span>
          </div>
          <p className="text-3xl font-bold text-emerald-400">{maxAchievableCGPA.toFixed(2)}</p>
        </Card>
      </div>

      {/* Subject Counts Summary */}
      <div className="grid md:grid-cols-3 gap-6">
        <Card className="md:col-span-2 bg-[#111118]/80 backdrop-blur-xl border-gray-800/50 p-6">
          <h3 className="text-xl text-white mb-4">Subject Requirement Overview</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
              <p className="text-2xl font-bold text-red-400">
                {rows.filter(r => r.requiredMarks >= 90).length}
              </p>
              <p className="text-xs text-gray-400">Critical (90+)</p>
            </div>
            <div className="p-4 rounded-xl bg-[var(--brand-end)]/10 border border-[var(--brand-end)]/20">
              <p className="text-2xl font-bold text-[var(--brand-end)]">
                {rows.filter(r => r.requiredMarks >= 75 && r.requiredMarks < 90).length}
              </p>
              <p className="text-xs text-gray-400">Difficult (75+)</p>
            </div>
            <div className="p-4 rounded-xl bg-[var(--brand-start)]/10 border border-[var(--brand-start)]/20">
              <p className="text-2xl font-bold text-[var(--brand-start)]">
                {rows.filter(r => r.requiredMarks >= 65 && r.requiredMarks < 75).length}
              </p>
              <p className="text-xs text-gray-400">Moderate (65+)</p>
            </div>
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <p className="text-2xl font-bold text-emerald-400">
                {rows.filter(r => r.requiredMarks < 65).length}
              </p>
              <p className="text-xs text-gray-400">Achievable (&lt;65)</p>
            </div>
          </div>
        </Card>

        <Card className="bg-[#111118]/80 backdrop-blur-xl border-gray-800/50 p-6 flex flex-col justify-center">
          <div className="flex items-center gap-3 mb-2">
            <Info className="w-5 h-5 text-[var(--brand-start)]" />
            <h4 className="text-white font-semibold">Pro-Tip</h4>
          </div>
          <p className="text-sm text-gray-400 leading-relaxed">
            Focus on high-credit subjects ({Math.max(...rows.map(r => r.credits))} credits) to see the biggest impact on your SGPA.
          </p>
        </Card>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 px-5 py-4 rounded-xl bg-[var(--brand-start)]/5 border border-[var(--brand-start)]/20">
        <Info className="w-4 h-4 text-[var(--brand-start)] flex-shrink-0 mt-0.5" />
        <p className="text-sm text-gray-400">
          Required marks are the <span className="text-white">minimum out of 100</span> you need in each subject (Internal 40 + External 60).
          Calculated to reach your final target CGPA of <span className="text-[var(--brand-start)]">{targetCGPA.toFixed(2)}</span> by graduation.
        </p>
      </div>

      {/* Marks table */}
      <Card className="bg-[#111118]/80 backdrop-blur-xl border-gray-800/50 overflow-hidden">
        <div className="p-6 border-b border-gray-800/50">
          <h2 className="text-xl font-bold text-white">
            Semester {profile.currentSemester} — Subject-wise Targets
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#0a0a0f]/60">
              <tr className="border-b border-gray-800/50">
                <th className="text-left p-4 text-gray-400 text-sm font-medium w-8">#</th>
                <th className="text-left p-4 text-gray-400 text-sm font-medium">Subject</th>
                <th className="text-center p-4 text-gray-400 text-sm font-medium">Credits</th>
                <th className="text-center p-4 text-gray-400 text-sm font-medium">
                  Min Marks Needed
                  <span className="block text-gray-600 text-xs font-normal">(out of 100)</span>
                </th>
                <th className="text-center p-4 text-gray-400 text-sm font-medium">Target Grade</th>
                <th className="text-center p-4 text-gray-400 text-sm font-medium">GP</th>
                <th className="text-left p-4 text-gray-400 text-sm font-medium w-48">Confidence Band</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const colors = gradeColor(row.grade);
                return (
                  <motion.tr
                    key={idx}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    className="border-b border-gray-800/30 hover:bg-gray-800/10 transition-colors"
                  >
                    <td className="p-4 text-gray-600 text-sm">{idx + 1}</td>
                    <td className="p-4">
                      <p className="text-white font-medium">{row.name}</p>
                    </td>
                    <td className="p-4 text-center">
                      <span className="px-2 py-1 rounded bg-[var(--brand-start)]/10 text-[var(--brand-start)] text-sm font-semibold">
                        {row.credits}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span className={`text-2xl font-bold ${targetSGPA > 10 ? "text-red-400" : colors.text}`}>
                        {targetSGPA > 10 ? "90+" : row.requiredMarks}
                      </span>
                      <span className="text-gray-500 text-sm"> /100</span>
                    </td>
                    <td className="p-4 text-center">
                      <span className={`px-3 py-1 rounded-lg border text-sm font-bold ${targetSGPA > 10 ? "bg-red-500/10 text-red-400 border-red-500/40" : `${colors.bg} ${colors.text}`}`}>
                        {targetSGPA > 10 ? "O" : row.grade}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="text-lg font-bold text-white">{targetSGPA > 10 ? "10" : row.gradePoint}</span>
                      <span className="text-gray-500 text-sm">/10</span>
                    </td>
                    <td className="p-4">
                      <div className="relative h-2 bg-gray-800 rounded-full overflow-hidden w-full">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${targetSGPA > 10 ? 100 : row.requiredMarks}%` }}
                          transition={{ delay: idx * 0.04 + 0.2, duration: 0.6, ease: "easeOut" }}
                          className="absolute inset-y-0 left-0 rounded-full"
                          style={{ background: `linear-gradient(to right, ${targetSGPA > 10 ? "#ef4444" : colors.bar}aa, ${targetSGPA > 10 ? "#ef4444" : colors.bar})` }}
                        />
                      </div>
                      <p className="text-xs text-gray-600 mt-1">{targetSGPA > 10 ? "Critical" : "Required"}</p>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer SGPA summary */}
        <div className="p-6 border-t border-gray-800/50 bg-[#0a0a0f]/30">
          <div className="flex items-center justify-between flex-wrap gap-6">
            <div className="flex items-center gap-8">
              <div>
                <p className="text-xs text-gray-400 mb-1">To reach target CGPA</p>
                <p className={`text-3xl font-bold ${targetSGPA <= 10 ? "text-emerald-400" : "text-red-400"}`}>
                  {targetSGPA > 10 ? "Impossible" : `${targetSGPA.toFixed(2)} SGPA`}
                </p>
              </div>
              <div className="w-px h-10 bg-gray-700" />
              <div>
                <p className="text-xs text-gray-400 mb-1">Target CGPA</p>
                <p className="text-3xl font-bold text-[var(--brand-start)]">{targetCGPA.toFixed(2)}</p>
              </div>
              <div className="flex items-center gap-2">
                {targetSGPA <= 10 ? (
                  <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-sm font-semibold">
                    ✓ Reachable
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 text-sm font-semibold">
                    ⚠ Needs Adjustment
                  </span>
                )}
              </div>
            </div>

            {/* IPU grade scale reference */}
            <div className="text-right">
              <p className="text-xs text-gray-500 mb-2">Grade Scale</p>
              <div className="flex gap-1.5 flex-wrap justify-end">
                {[["O","≥90","text-emerald-400"],["A+","≥75","text-[var(--brand-start)]"],["A","≥65","text-sky-400"],["B+","≥55","text-[var(--brand-end)]"],["B","≥50","text-violet-400"],["C","≥45","text-yellow-400"],["P","≥40","text-orange-400"],["F","<40","text-red-400"]].map(([g, r, cls]) => (
                  <span key={g} className={`text-xs ${cls} bg-gray-800/60 border border-gray-700/50 px-1.5 py-0.5 rounded`}>
                    {g} {r}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
