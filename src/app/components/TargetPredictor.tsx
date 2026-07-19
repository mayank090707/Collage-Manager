import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { ArrowLeft, Target, TrendingUp, Info, AlertCircle, CheckCircle2 } from "lucide-react";
import { motion } from "motion/react";

interface RequiredRecord {
  grade: string;
  count: number;
  credits: number;
  marksRange: string;
}

const GRADE_TABLE = [
  { grade: "O", gp: 10, marks: "90-100" },
  { grade: "A+", gp: 9, marks: "75-89" },
  { grade: "A", gp: 8, marks: "65-74" },
  { grade: "B+", gp: 7, marks: "55-64" },
  { grade: "B", gp: 6, marks: "50-54" },
  { grade: "C", gp: 5, marks: "45-49" },
  { grade: "P", gp: 4, marks: "40-44" },
  { grade: "F", gp: 0, marks: "<40" },
];

export function TargetPredictor() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    currentCgpa: 0,
    targetCgpa: 0,
    requiredSgpa: 0,
    gap: 0,
    isPossible: true,
    maxAchievable: 0
  });
  const [requirements, setRequirements] = useState<RequiredRecord[]>([]);

  useEffect(() => {
    const calculate = () => {
      const target = parseFloat(localStorage.getItem("target_cgpa") || "0");
      const savedMarks = JSON.parse(localStorage.getItem("semester_marks") || "[]");
      const subjects = JSON.parse(localStorage.getItem("subjects") || "[]");
      const profile = JSON.parse(localStorage.getItem("student_profile") || "{}");
      const currentSemNum = parseInt(profile.currentSemester || "1");

      const currentSemCredits = subjects.reduce((acc: number, s: any) => acc + (s.credits || 0), 0);

      // Formula: (SGPA1 + SGPA2 + ... + x) / N = targetCGPA
      // => x = targetCGPA × N − sum of previous SGPAs
      const previousSemMarks = savedMarks.filter((m: any) => m.semester < currentSemNum);
      const sumPreviousSGPAs = previousSemMarks.reduce((acc: number, m: any) => acc + (m.sgpa || 0), 0);

      const reqSGPA = (target * currentSemNum) - sumPreviousSGPAs;

      // Current CGPA = credit-weighted average
      const allResults = savedMarks.flatMap((m: any) => m.results || []);
      const totalCredits = allResults.reduce((s: number, r: any) => s + (r.credits || 0), 0);
      const weighted = allResults.reduce((s: number, r: any) => s + (r.gradePoint * (r.credits || 0)), 0);
      const currentCgpa = totalCredits > 0 ? weighted / totalCredits : 0;

      // Max achievable CGPA if this sem gets perfect 10.0
      const maxAchievable = (sumPreviousSGPAs + 10.0) / currentSemNum;

      setStats({
        currentCgpa,
        targetCgpa: target,
        requiredSgpa: Math.max(0, reqSGPA),
        gap: Math.max(0, target - currentCgpa),
        isPossible: reqSGPA <= 10.0,
        maxAchievable
      });

      // Grade Distribution Logic
      if (reqSGPA <= 10.0 && subjects.length > 0) {
        const pointsNeeded = reqSGPA * currentSemCredits;
        const sortedSubjects = [...subjects].sort((a, b) => b.credits - a.credits);

        // Assign base grade point
        const baseGP = Math.floor(reqSGPA);

        // Accurate distribution for display
        const gpAssignment: number[] = sortedSubjects.map(() => baseGP);
        let currentTotalGP = gpAssignment.reduce((acc, gp, i) => acc + (gp * sortedSubjects[i].credits), 0);

        for (let i = 0; i < gpAssignment.length; i++) {
          while (currentTotalGP < pointsNeeded && gpAssignment[i] < 10) {
            gpAssignment[i]++;
            currentTotalGP += sortedSubjects[i].credits;
          }
        }

        // Group by resulting grade and credit
        const groups: Record<string, RequiredRecord> = {};
        gpAssignment.forEach((gp, i) => {
          const grade = GRADE_TABLE.find(g => g.gp === gp)?.grade || "F";
          const key = `${grade}-${sortedSubjects[i].credits}`;
          if (!groups[key]) {
            groups[key] = {
              grade,
              count: 0,
              credits: sortedSubjects[i].credits,
              marksRange: GRADE_TABLE.find(g => g.gp === gp)?.marks || "0"
            };
          }
          groups[key].count++;
        });

        setRequirements(Object.values(groups).sort((a, b) => b.credits - a.credits));
      }
    };

    calculate();
  }, []);

  return (
    <div className="p-8 space-y-8 max-w-6xl mx-auto">
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
            <p className="text-gray-400">Strategic grade breakdown for the current semester</p>
          </div>
        </div>

        {stats.targetCgpa > 0 && (
          <div className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-gradient-to-r from-[var(--brand-start)]/10 to-[var(--brand-end)]/10 border border-[var(--brand-start)]/20 shadow-[0_0_20px_rgba(var(--brand-start-rgb), 0.1)]">
            <div className="text-right">
              <p className="text-xs text-gray-500 uppercase tracking-tighter">CGPA Gap</p>
              <p className={`text-2xl font-black ${stats.gap > 0 ? "text-orange-400" : "text-emerald-400"}`}>
                {stats.gap.toFixed(2)}
              </p>
            </div>
          </div>
        )}
      </div>

      {!stats.isPossible && (
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="p-6 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-start gap-4">
          <AlertCircle className="w-8 h-8 text-red-500 flex-shrink-0" />
          <div className="space-y-1">
            <h3 className="text-xl font-bold text-red-400">Target Unreachable This Semester</h3>
            <p className="text-red-300/80">
              Your required SGPA exceeds 10.0. Even with a perfect score, your CGPA will max out at <span className="font-bold underline">{stats.maxAchievable.toFixed(2)}</span>. 
              We recommend adjusting your target for this semester.
            </p>
          </div>
        </motion.div>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        <Card className="p-6 bg-[#111118]/80 border-gray-800/50 flex flex-col items-center justify-center text-center space-y-2">
          <Target className="w-8 h-8 text-[var(--brand-start)] mb-2" />
          <p className="text-sm text-gray-400 uppercase tracking-widest">Target CGPA</p>
          <p className="text-4xl font-black text-white">{stats.targetCgpa.toFixed(2)}</p>
        </Card>
        <Card className="p-6 bg-[#111118]/80 border-gray-800/50 flex flex-col items-center justify-center text-center space-y-2">
          <TrendingUp className="w-8 h-8 text-[var(--brand-end)] mb-2" />
          <p className="text-sm text-gray-400 uppercase tracking-widest">Required SGPA</p>
          <p className={`text-4xl font-black ${stats.isPossible ? "text-[var(--brand-end)]" : "text-red-500"}`}>
            {stats.requiredSgpa > 10 ? "10.0+" : stats.requiredSgpa.toFixed(2)}
          </p>
        </Card>
        <Card className="p-6 bg-[#111118]/80 border-gray-800/50 flex flex-col items-center justify-center text-center space-y-2">
          <CheckCircle2 className="w-8 h-8 text-emerald-400 mb-2" />
          <p className="text-sm text-gray-400 uppercase tracking-widest">Max Achievable</p>
          <p className="text-4xl font-black text-emerald-400">{stats.maxAchievable.toFixed(2)}</p>
        </Card>
      </div>

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
                transition={{ delay: i * 0.1 }}
                className="flex items-center justify-between p-4 rounded-xl bg-[#0a0a0f]/50 border border-gray-800 hover:border-[var(--brand-start)]/30 transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-xl border-2 flex flex-col items-center justify-center font-bold relative bg-black/40 ${
                    req.grade === "O" ? "border-emerald-500 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]" :
                    req.grade === "A+" ? "border-[var(--brand-start)] text-[var(--brand-start)] shadow-[0_0_15px_rgba(var(--brand-start-rgb), 0.2)]" :
                    req.grade === "A" ? "border-sky-500 text-sky-400" :
                    "border-gray-700 text-gray-400"
                  }`}>
                    <span className="text-xs opacity-50 font-normal">Grade</span>
                    <span className="text-xl -mt-1">{req.grade}</span>
                  </div>
                  <div>
                    <p className="text-white font-semibold text-lg">{req.count} Subject{req.count > 1 ? "s" : ""}</p>
                    <p className="text-sm text-gray-400">{req.credits} Credits each • Range: {req.marksRange}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-gray-500">
                    Required for SGPA
                  </div>
                </div>
              </motion.div>
            )) : (
              <p className="text-gray-500 italic">No data available. Ensure subjects are added in onboarding.</p>
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
                This prediction prioritizes obtaining higher grades in subjects with <span className="text-white font-bold">higher credits</span>, as they have a disproportionate impact on your SGPA.
              </p>
              <div className="p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/10">
                <p className="text-xs text-indigo-300 font-semibold mb-1 uppercase tracking-wider">Top Priority</p>
                <p className="text-sm text-gray-300">
                  Focus heavily on the {requirements[0]?.credits}-credit subjects. An 'O' grade in a high-credit subject can often offset a lower grade in a smaller one.
                </p>
              </div>
            </div>
          </Card>

          <Card className="bg-gradient-to-br from-[var(--brand-start)]/10 to-[var(--brand-end)]/10 border-[var(--brand-start)]/20 p-6">
            <h3 className="text-white font-bold mb-2">How it works</h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li className="flex gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--brand-start)] mt-1.5 flex-shrink-0" />
                Analyzes current CGPA and remaining credits for the semester.
              </li>
              <li className="flex gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--brand-start)] mt-1.5 flex-shrink-0" />
                Distributes the required grade points across your subjects.
              </li>
              <li className="flex gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--brand-start)] mt-1.5 flex-shrink-0" />
                Tailored specifically for the IPU marking system (10.0 scale).
              </li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

const Calculator = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" height="24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg"><rect height="18" rx="2" ry="2" width="14" x="5" y="3"/><line x1="8" x2="16" y1="7" y2="7"/><line x1="8" x2="16" y1="11" y2="11"/><line x1="8" x2="16" y1="15" y2="15"/><line x1="10" x2="10" y1="18" y2="21"/><line x1="14" x2="14" y1="18" y2="21"/></svg>
);
