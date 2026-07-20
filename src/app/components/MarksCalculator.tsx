import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { ArrowLeft, Calculator, Plus, Trash2, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";

interface CalcSubject {
  id: string;
  name: string;
  credits: number;
  marks: number;
}

const GRADE_POINTS: Record<string, number> = {
  "O": 10, "A+": 9, "A": 8, "B+": 7, "B": 6, "C": 5, "P": 4, "F": 0
};

function getGradeInfo(marks: number) {
  if (marks >= 90) return { grade: "O", gp: 10, color: "text-emerald-400" };
  if (marks >= 75) return { grade: "A+", gp: 9, color: "text-[var(--brand-start)]" };
  if (marks >= 65) return { grade: "A", gp: 8, color: "text-sky-400" };
  if (marks >= 55) return { grade: "B+", gp: 7, color: "text-[var(--brand-end)]" };
  if (marks >= 50) return { grade: "B", gp: 6, color: "text-violet-400" };
  if (marks >= 45) return { grade: "C", gp: 5, color: "text-yellow-400" };
  if (marks >= 40) return { grade: "P", gp: 4, color: "text-orange-400" };
  return { grade: "F", gp: 0, color: "text-red-400" };
}

export function MarksCalculator() {
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState<CalcSubject[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [resultData, setResultData] = useState({ sgpa: 0, cgpa: 0 });

  useEffect(() => {
    const savedSubjects = JSON.parse(localStorage.getItem("subjects") || "[]");
    if (savedSubjects.length > 0) {
      setSubjects(savedSubjects.map((s: any) => ({
        id: s.id || Math.random().toString(36).substr(2, 9),
        name: s.name,
        credits: s.credits,
        marks: 0
      })));
    } else {
      // Default empty state
      setSubjects([{ id: "1", name: "", credits: 4, marks: 0 }]);
    }
  }, []);

  const addSubject = () => {
    setSubjects([...subjects, { id: Date.now().toString(), name: "", credits: 4, marks: 0 }]);
  };

  const removeSubject = (id: string) => {
    setSubjects(subjects.filter(s => s.id !== id));
  };

  const updateSubject = (id: string, field: keyof CalcSubject, value: any) => {
    setSubjects(subjects.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const calculateSgpa = () => {
    if (subjects.length === 0) {
      toast.error("Add at least one subject!");
      return;
    }

    const totalCredits = subjects.reduce((acc, s) => acc + s.credits, 0);
    const weightedPoints = subjects.reduce((acc, s) => {
      const { gp } = getGradeInfo(s.marks);
      return acc + (gp * s.credits);
    }, 0);

    const sgpa = weightedPoints / totalCredits;

    // Calculate predicted CGPA
    const savedMarks = JSON.parse(localStorage.getItem("semester_marks") || "[]");
    const totalCreditsHist = savedMarks.reduce((acc: number, s: any) => 
      acc + s.results.reduce((subAcc: number, r: any) => subAcc + (r.credits || 0), 0), 0);
    const totalPointsHist = savedMarks.reduce((acc: number, s: any) => 
      acc + (s.sgpa * s.results.reduce((subAcc: number, r: any) => subAcc + (r.credits || 0), 0)), 0);

    const finalCgpa = (totalPointsHist + weightedPoints) / (totalCreditsHist + totalCredits);

    setResultData({ sgpa, cgpa: finalCgpa });
    setShowResult(true);

    if (sgpa >= 8.5) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    }
  };

  return (
    <div className="p-8 space-y-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate("/app")} className="text-gray-400 hover:text-white">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Dashboard
        </Button>
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-[var(--brand-start)] to-[var(--brand-end)] bg-clip-text text-transparent">
            Marks Calculator
          </h1>
          <p className="text-gray-400">Simulate your SGPA based on predicted marks</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 bg-[#111118]/80 backdrop-blur-xl border-gray-800/50 p-6 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-semibold text-white">Subject Marks</h2>
            <Button onClick={addSubject} variant="outline" size="sm" className="border-gray-700 bg-transparent text-[var(--brand-start)] hover:bg-[var(--brand-start)]/10">
              <Plus className="w-4 h-4 mr-2" /> Add Subject
            </Button>
          </div>

          <div className="space-y-3">
            <AnimatePresence>
              {subjects.map((sub, idx) => (
                <motion.div
                  key={sub.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="grid grid-cols-12 gap-3 items-end p-4 rounded-xl bg-[#0a0a0f]/50 border border-gray-800 group hover:border-[var(--brand-start)]/30 transition-all"
                >
                  <div className="col-span-5 space-y-2">
                    <Label className="text-xs text-gray-500 uppercase tracking-wider">Subject Name</Label>
                    <Input 
                      value={sub.name} 
                      onChange={(e) => updateSubject(sub.id, "name", e.target.value)}
                      className="bg-[#111118] border-gray-700" 
                      placeholder="Enter subject..."
                    />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label className="text-xs text-gray-500 uppercase tracking-wider text-center block">Credits</Label>
                    <Input 
                      type="number" 
                      value={sub.credits} 
                      onChange={(e) => updateSubject(sub.id, "credits", parseInt(e.target.value) || 0)}
                      className="bg-[#111118] border-gray-700 text-center" 
                    />
                  </div>
                  <div className="col-span-3 space-y-2">
                    <Label className="text-xs text-gray-500 uppercase tracking-wider text-center block">Total Marks (/100)</Label>
                    <Input 
                      type="number" 
                      value={sub.marks || ""} 
                      onChange={(e) => updateSubject(sub.id, "marks", parseInt(e.target.value) || 0)}
                      className="bg-[#111118] border-gray-700 text-center text-lg font-bold text-[var(--brand-start)]" 
                      placeholder="85"
                    />
                  </div>
                  <div className="col-span-2 flex items-center justify-center gap-2">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold border border-gray-700 ${getGradeInfo(sub.marks).color}`}>
                      {getGradeInfo(sub.marks).grade}
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => removeSubject(sub.id)}
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <Button 
            onClick={calculateSgpa}
            className="w-full h-14 text-lg font-bold bg-[var(--brand-start)] hover:bg-amber-600 text-white shadow-[0_0_20px_rgba(var(--brand-start-rgb), 0.3)] mt-6"
          >
            <Calculator className="w-5 h-5 mr-2" />
            Calculate Prediction
          </Button>
        </Card>

        <Card className="bg-[#111118]/80 backdrop-blur-xl border-gray-800/50 p-6 flex flex-col justify-between">
          <div className="space-y-6">
            <h3 className="text-xl font-semibold text-white border-b border-gray-800 pb-2">Information</h3>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5" />
                <p className="text-sm text-gray-400">Enter your total marks (internal + external) out of 100.</p>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-[var(--brand-start)] mt-0.5" />
                <p className="text-sm text-gray-400">This calculation uses the standard IPU 10-point scale.</p>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-[var(--brand-end)] mt-0.5" />
                <p className="text-sm text-gray-400">You can edit subjects and credits here - these changes won't be saved to your profile permanently.</p>
              </div>
            </div>
          </div>

          <div className="pt-8 text-center text-xs text-gray-500 uppercase tracking-widest bg-emerald-500/5 p-4 rounded-xl border border-emerald-500/10 mt-auto">
            Predicted SGPA is based entirely on the marks entered above.
          </div>
        </Card>
      </div>

      {/* Result Dialog */}
      <Dialog open={showResult} onOpenChange={setShowResult}>
        <DialogContent className="bg-[#111118]/95 backdrop-blur-2xl border-gray-800 p-8 max-w-sm text-center">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="space-y-6"
          >
            <div className="w-20 h-20 rounded-full bg-gradient-to-r from-[var(--brand-start)] to-[var(--brand-end)] mx-auto flex items-center justify-center shadow-[0_0_30px_rgba(var(--brand-start-rgb), 0.4)]">
              <Calculator className="w-10 h-10 text-white" />
            </div>
            
            <DialogHeader>
              <DialogTitle className="text-3xl font-bold text-white mb-2">Prediction Results</DialogTitle>
              <div className="space-y-4 pt-4">
                <div className="p-4 rounded-xl bg-gray-800/50 border border-gray-700">
                  <p className="text-sm text-gray-400 mb-1 uppercase tracking-wider">Predicted SGPA</p>
                  <p className="text-5xl font-black bg-gradient-to-r from-[var(--brand-start)] to-[var(--brand-end)] bg-clip-text text-transparent">
                    {resultData.sgpa.toFixed(2)}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-[var(--brand-start)]/5 border border-[var(--brand-start)]/10">
                  <p className="text-xs text-gray-400 mb-1 uppercase tracking-wider">Projected CGPA</p>
                  <p className="text-2xl font-bold text-white">
                    {resultData.cgpa.toFixed(2)}
                  </p>
                </div>
              </div>
            </DialogHeader>

            <Button 
              onClick={() => setShowResult(false)}
              className="w-full bg-gray-800 hover:bg-gray-700 text-white"
            >
              Close
            </Button>
          </motion.div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
