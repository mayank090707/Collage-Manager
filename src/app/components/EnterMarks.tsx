import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { ArrowLeft, Save, BookOpen, Award, TrendingUp, X, Plus } from "lucide-react";
import { toast } from "sonner";
import { motion } from "motion/react";

interface SubjectMark {
  subjectName: string;
  credits: number;
  internalMarks: number | "";
  externalMarks: number | "";
}

interface SemesterResult {
  subjectName: string;
  credits: number;
  internal: number;
  external: number;
  total: number;
  grade: string;
  gradePoint: number;
}

interface SavedSemester {
  semester: number;
  results: SemesterResult[];
  sgpa: number;
}

// Hardcoded defaults removed per user request - user will provide all subjects and credits.

function getGrade(total: number): { grade: string; gradePoint: number } {
  if (total >= 90) return { grade: "O", gradePoint: 10 };
  if (total >= 75) return { grade: "A+", gradePoint: 9 };
  if (total >= 65) return { grade: "A", gradePoint: 8 };
  if (total >= 55) return { grade: "B+", gradePoint: 7 };
  if (total >= 50) return { grade: "B", gradePoint: 6 };
  if (total >= 45) return { grade: "C", gradePoint: 5 };
  if (total >= 40) return { grade: "P", gradePoint: 4 };
  return { grade: "F", gradePoint: 0 };
}

function calcSGPA(results: SemesterResult[]): number {
  const totalCredits = results.reduce((s, r) => s + r.credits, 0);
  const weighted = results.reduce((s, r) => s + r.gradePoint * r.credits, 0);
  return totalCredits > 0 ? weighted / totalCredits : 0;
}

function gradeColor(grade: string) {
  if (grade === "O") return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
  if (grade === "A+") return "bg-[#00d4ff]/20 text-[#00d4ff] border-[#00d4ff]/40";
  if (grade === "A") return "bg-sky-500/20 text-sky-300 border-sky-500/40";
  if (grade === "B+") return "bg-[#a855f7]/20 text-[#a855f7] border-[#a855f7]/40";
  if (grade === "B") return "bg-violet-500/20 text-violet-300 border-violet-500/40";
  if (grade === "C") return "bg-yellow-500/20 text-yellow-300 border-yellow-500/40";
  if (grade === "P") return "bg-orange-500/20 text-orange-300 border-orange-500/40";
  return "bg-red-500/20 text-red-400 border-red-500/40";
}

export function EnterMarks() {
  const navigate = useNavigate();
  const [activeSem, setActiveSem] = useState(1);
  const [currentSem, setCurrentSem] = useState(1);

  // marks[sem][subjectIdx] = { internalMarks, externalMarks }
  const [marks, setMarks] = useState<Record<number, SubjectMark[]>>({});
  const [savedSemesters, setSavedSemesters] = useState<SavedSemester[]>([]);

  const addSubject = () => {
    setMarks(prev => ({
      ...prev,
      [activeSem]: [...(prev[activeSem] || []), { subjectName: "", credits: 4, internalMarks: "", externalMarks: "" }]
    }));
  };

  const removeSubject = (idx: number) => {
    setMarks(prev => {
      const copy = [...(prev[activeSem] || [])];
      copy.splice(idx, 1);
      return { ...prev, [activeSem]: copy };
    });
  };

  const updateSubjectInfo = (idx: number, field: "subjectName" | "credits", val: any) => {
    setMarks(prev => {
      const copy = [...(prev[activeSem] || [])];
      copy[idx] = { ...copy[idx], [field]: val };
      return { ...prev, [activeSem]: copy };
    });
  };

  useEffect(() => {
    const profile = JSON.parse(localStorage.getItem("student_profile") || "{}");
    const semNum = parseInt(profile.currentSemester) || 1;
    setCurrentSem(semNum);
    setActiveSem(semNum);

    // Load saved marks
    const saved: SavedSemester[] = JSON.parse(localStorage.getItem("semester_marks") || "[]");
    setSavedSemesters(saved);

    // Build subjects per semester: 
    // Load from saved semester_marks, if empty and it's current sem load from subjects
    const onboardingSubjects: { name: string; credits: number }[] = JSON.parse(localStorage.getItem("subjects") || "[]").map((s: any) => ({
      name: s.name,
      credits: s.credits,
    }));

    const initMarks: Record<number, SubjectMark[]> = {};
    for (let s = 1; s <= 8; s++) {
      const savedSem = saved.find((sv) => sv.semester === s);
      if (savedSem && savedSem.results.length > 0) {
        initMarks[s] = savedSem.results.map((r) => ({
          subjectName: r.subjectName,
          credits: r.credits,
          internalMarks: r.internal ?? "",
          externalMarks: r.external ?? "",
        }));
      } else if (s === semNum) {
        initMarks[s] = onboardingSubjects.map(sub => ({
          subjectName: sub.name,
          credits: sub.credits,
          internalMarks: "",
          externalMarks: "",
        }));
      } else {
        initMarks[s] = []; // Start blank for other semesters
      }
    }
    setMarks(initMarks);
  }, []);

  const updateMark = (sem: number, idx: number, field: "internalMarks" | "externalMarks", val: string) => {
    const num = val === "" ? "" : Math.min(parseInt(val) || 0, field === "internalMarks" ? 40 : 60);
    setMarks((prev) => {
      const copy = [...(prev[sem] || [])];
      copy[idx] = { ...copy[idx], [field]: num };
      return { ...prev, [sem]: copy };
    });
  };

  const getSemResults = (sem: number): SemesterResult[] => {
    return (marks[sem] || []).map((m) => {
      const internal = typeof m.internalMarks === "number" ? m.internalMarks : 0;
      const external = typeof m.externalMarks === "number" ? m.externalMarks : 0;
      const total = internal + external;
      const { grade, gradePoint } = getGrade(total);
      return {
        subjectName: m.subjectName,
        credits: m.credits,
        internal,
        external,
        total,
        grade,
        gradePoint,
      };
    });
  };

  const handleSave = (sem: number) => {
    const results = getSemResults(sem);
    const sgpa = calcSGPA(results);
    const updated: SavedSemester = { semester: sem, results, sgpa };
    const rest = savedSemesters.filter((s) => s.semester !== sem);
    const newSaved = [...rest, updated].sort((a, b) => a.semester - b.semester);
    setSavedSemesters(newSaved);
    localStorage.setItem("semester_marks", JSON.stringify(newSaved));
    // Also sync with legacy key used elsewhere
    localStorage.setItem("semester_data", JSON.stringify(newSaved.map((sv) => ({
      semester: sv.semester,
      subjects: sv.results.map((r) => ({
        subjectName: r.subjectName,
        credits: r.credits,
        internalMarks: r.internal,
        externalMarks: r.external,
        totalMarks: r.total,
        grade: r.grade,
        gradePoint: r.gradePoint,
      })),
      sgpa: sv.sgpa,
    }))));
    toast.success(`Semester ${sem} marks saved!`);
    
    // If this is the current semester, update the global subjects list for sync with Required Marks
    if (sem === currentSem) {
      const globalSubjects = results.map(r => ({
        name: r.subjectName,
        credits: r.credits,
        code: "" // Optional: you could try to keep codes if you had them
      }));
      localStorage.setItem("subjects", JSON.stringify(globalSubjects));
    }
    
    // Refresh local stats if on Dashboard or other pages
    window.dispatchEvent(new Event("storage"));
  };

  const getCGPA = () => {
    if (savedSemesters.length === 0) return null;
    const allEnteredSGPAs = savedSemesters.map((s) => s.sgpa || 0);
    return allEnteredSGPAs.length > 0
      ? allEnteredSGPAs.reduce((a, b) => a + b, 0) / allEnteredSGPAs.length
      : 0;
  };

  const activeSemResults = getSemResults(activeSem);
  const activeSGPA = calcSGPA(activeSemResults);
  const cgpa = getCGPA();

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4 flex-wrap">
        <Button variant="ghost" onClick={() => navigate("/app/academics")} className="text-gray-400 hover:text-white hover:bg-gray-800/50">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Academics
        </Button>
        <div className="flex-1">
          <h1 className="text-4xl mb-1 bg-gradient-to-r from-[#00d4ff] via-white to-[#a855f7] bg-clip-text text-transparent">
            Enter Marks
          </h1>
          <p className="text-gray-400">Grading System · Internal (40) + External (60) = 100</p>
        </div>
      </div>

      {/* Semester tabs */}
      <div className="flex gap-2 flex-wrap">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => {
          const saved = savedSemesters.find((s) => s.semester === sem);
          return (
            <button
              key={sem}
              onClick={() => setActiveSem(sem)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                activeSem === sem
                  ? "bg-gradient-to-r from-[#00d4ff]/20 to-[#a855f7]/20 border-[#00d4ff] text-white shadow-[0_0_12px_rgba(0,212,255,0.2)]"
                  : "border-gray-700 text-gray-400 hover:border-gray-600 hover:text-white"
              }`}
            >
              Sem {sem}
              {sem === currentSem && <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-[#00d4ff] inline-block align-middle" />}
              {saved && <span className="ml-1.5 text-xs text-emerald-400">✓</span>}
            </button>
          );
        })}
      </div>

      {/* Marks table */}
      <motion.div key={activeSem} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
        <Card className="bg-[#111118]/80 backdrop-blur-xl border-gray-800/50 overflow-hidden">
          <div className="p-6 border-b border-gray-800/50 flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-xl font-bold text-white">Semester {activeSem}</h2>
              {activeSem === currentSem && <span className="text-xs text-[#00d4ff]">Current semester · Subjects from your onboarding</span>}
            </div>
            <Button onClick={() => handleSave(activeSem)} className="bg-gradient-to-r from-[#00d4ff] to-[#a855f7] hover:from-[#00ffff] hover:to-[#8b5cf6] text-white">
              <Save className="w-4 h-4 mr-2" />
              Save Semester {activeSem}
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#0a0a0f]/50">
                <tr className="border-b border-gray-800/50">
                  <th className="text-left p-4 text-gray-400 text-sm font-medium">#</th>
                  <th className="text-left p-4 text-gray-400 text-sm font-medium">Subject</th>
                  <th className="text-center p-4 text-gray-400 text-sm font-medium">Credits</th>
                  <th className="text-center p-4 text-gray-400 text-sm font-medium">Internal<br /><span className="text-gray-600 text-xs">(max 40)</span></th>
                  <th className="text-center p-4 text-gray-400 text-sm font-medium">External<br /><span className="text-gray-600 text-xs">(max 60)</span></th>
                  <th className="text-center p-4 text-gray-400 text-sm font-medium">Total<br /><span className="text-gray-600 text-xs">(/ 100)</span></th>
                  <th className="text-center p-4 text-gray-400 text-sm font-medium">Grade</th>
                  <th className="text-center p-4 text-gray-400 text-sm font-medium">GP</th>
                  <th className="text-center p-4 text-gray-400 text-sm font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {(marks[activeSem] || []).map((m, idx) => {
                  const internal = typeof m.internalMarks === "number" ? m.internalMarks : 0;
                  const external = typeof m.externalMarks === "number" ? m.externalMarks : 0;
                  const hasMarks = m.internalMarks !== "" || m.externalMarks !== "";
                  const total = hasMarks ? internal + external : null;
                  const { grade, gradePoint } = total !== null ? getGrade(total) : { grade: "—", gradePoint: 0 };

                  return (
                    <tr key={idx} className="border-b border-gray-800/30 hover:bg-gray-800/10 transition-colors">
                      <td className="p-4 text-gray-500 text-sm">{idx + 1}</td>
                      <td className="p-4">
                        <Input
                          value={m.subjectName}
                          onChange={(e) => updateSubjectInfo(idx, "subjectName", e.target.value)}
                          className="bg-transparent border-none focus:ring-0 text-white font-medium p-0 h-auto"
                          placeholder="Subject Name"
                        />
                      </td>
                      <td className="p-4 text-center">
                        <Input
                          type="number"
                          value={m.credits}
                          onChange={(e) => updateSubjectInfo(idx, "credits", parseInt(e.target.value) || 0)}
                          className="w-16 mx-auto bg-[#0a0a0f]/50 border-gray-700 text-center text-sm"
                        />
                      </td>
                      <td className="p-4 text-center">
                        <Input
                          type="number"
                          min="0"
                          max="40"
                          value={m.internalMarks}
                          onChange={(e) => updateMark(activeSem, idx, "internalMarks", e.target.value)}
                          className="w-20 mx-auto bg-[#0a0a0f]/50 border-gray-700 focus:border-[#00d4ff] text-white text-center"
                          placeholder="0"
                        />
                      </td>
                      <td className="p-4 text-center">
                        <Input
                          type="number"
                          min="0"
                          max="60"
                          value={m.externalMarks}
                          onChange={(e) => updateMark(activeSem, idx, "externalMarks", e.target.value)}
                          className="w-20 mx-auto bg-[#0a0a0f]/50 border-gray-700 focus:border-[#a855f7] text-white text-center"
                          placeholder="0"
                        />
                      </td>
                      <td className="p-4 text-center">
                        <span className={`text-lg font-bold ${total !== null ? (total >= 40 ? "text-white" : "text-red-400") : "text-gray-600"}`}>
                          {total !== null ? total : "—"}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        {total !== null ? (
                          <span className={`px-2 py-1 rounded-lg border text-xs font-bold ${gradeColor(grade)}`}>
                            {grade}
                          </span>
                        ) : (
                          <span className="text-gray-600">—</span>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        <span className={`font-semibold ${total !== null ? "text-white" : "text-gray-600"}`}>
                          {total !== null ? gradePoint : "—"}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeSubject(idx)}
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            
            <div className="p-4 border-t border-gray-800/30 bg-gray-800/5">
              <Button
                onClick={addSubject}
                variant="ghost"
                className="text-[#00d4ff] hover:text-white hover:bg-[#00d4ff]/20 transition-all font-medium"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Subject
              </Button>
            </div>
          </div>

          {/* Semester SGPA footer */}
          <div className="p-6 border-t border-gray-800/50 bg-[#0a0a0f]/30">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-[#00d4ff]/20 to-[#a855f7]/20 flex items-center justify-center">
                    <Award className="w-5 h-5 text-[#00d4ff]" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Semester {activeSem} SGPA</p>
                    <p className="text-2xl font-bold text-white">
                      {activeSGPA > 0 ? activeSGPA.toFixed(2) : "—"}
                    </p>
                  </div>
                </div>
                {cgpa !== null && (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-emerald-500/20 to-teal-500/20 flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Overall CGPA (saved semesters)</p>
                      <p className="text-2xl font-bold text-white">{cgpa.toFixed(2)}</p>
                    </div>
                  </div>
                )}
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500 mb-1">Grading Scale</p>
                <div className="flex gap-1.5 flex-wrap justify-end">
                  {[["O","≥90"], ["A+","≥75"], ["A","≥65"], ["B+","≥55"], ["B","≥50"], ["C","≥45"], ["P","≥40"], ["F","<40"]].map(([g, r]) => (
                    <span key={g} className={`text-xs px-1.5 py-0.5 rounded border ${gradeColor(g)}`}>{g} {r}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* CGPA summary across semesters */}
      {savedSemesters.length > 0 && (
        <Card className="bg-[#111118]/80 backdrop-blur-xl border-gray-800/50 p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            CGPA Overview
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {savedSemesters.map((sv) => (
              <div key={sv.semester} className="bg-[#0a0a0f]/50 border border-gray-800/50 rounded-xl p-4 text-center">
                <p className="text-xs text-gray-400 mb-1">Semester {sv.semester}</p>
                <p className="text-2xl font-bold text-white">{sv.sgpa.toFixed(2)}</p>
                <p className="text-xs text-gray-500 mt-1">SGPA</p>
              </div>
            ))}
            {cgpa !== null && (
              <div className="bg-gradient-to-br from-[#00d4ff]/10 to-[#a855f7]/10 border border-[#00d4ff]/30 rounded-xl p-4 text-center">
                <p className="text-xs text-[#00d4ff] mb-1">Overall</p>
                <p className="text-2xl font-bold text-white">{cgpa.toFixed(2)}</p>
                <p className="text-xs text-gray-500 mt-1">CGPA</p>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
