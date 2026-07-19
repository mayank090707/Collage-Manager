import { useState, useEffect } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Progress } from "../ui/progress";
import { Target, TrendingUp, Award } from "lucide-react";
import { toast } from "sonner";
import { motion } from "motion/react";

interface SemesterData {
  semester: number;
  sgpa: number;
}

export function CGPATab() {
  const [cgpa, setCgpa] = useState(0);
  const [targetCgpa, setTargetCgpa] = useState(0);
  const [completedSemesters, setCompletedSemesters] = useState(0);
  const [totalSemesters, setTotalSemesters] = useState(8);
  const [semesterData, setSemesterData] = useState<SemesterData[]>([]);
  const [showTargetDialog, setShowTargetDialog] = useState(false);
  const [newTarget, setNewTarget] = useState("");
  const [requiredSgpa, setRequiredSgpa] = useState(0);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    const savedSemesterData = JSON.parse(localStorage.getItem("semester_data") || "[]");
    const savedTarget = parseFloat(localStorage.getItem("target_cgpa") || "0");

    setSemesterData(savedSemesterData);
    setTargetCgpa(savedTarget);

    // Calculate CGPA from all semesters
    const validSemesters = savedSemesterData.filter(
      (sem: SemesterData) => sem.sgpa > 0
    );
    setCompletedSemesters(validSemesters.length);

    if (validSemesters.length > 0) {
      const totalSgpa = validSemesters.reduce(
        (sum: number, sem: SemesterData) => sum + sem.sgpa,
        0
      );
      const calculatedCgpa = totalSgpa / validSemesters.length;
      setCgpa(calculatedCgpa);
    }

    // Calculate required SGPA for CURRENT semester to reach target
    if (savedTarget > 0) {
      const subjects = JSON.parse(localStorage.getItem("subjects") || "[]");
      const currentSemCredits = subjects.reduce((acc: number, s: any) => acc + (s.credits || 0), 0) || 20;
      
      const totalCreditsHist = savedSemesterData.reduce((acc: number, s: SemesterData) => acc + 20, 0); // Approx credits if not stored
      const totalPointsHist = savedSemesterData.reduce((acc: number, s: SemesterData) => acc + (s.sgpa * 20), 0);

      // Re-calculate more accurately if possible
      const savedMarks = JSON.parse(localStorage.getItem("semester_marks") || "[]");
      const accurateCreditsHist = savedMarks.reduce((acc: number, s: any) => 
        acc + s.results.reduce((subAcc: number, r: any) => subAcc + (r.credits || 0), 0), 0);
      const accuratePointsHist = savedMarks.reduce((acc: number, s: any) => 
        acc + (s.sgpa * s.results.reduce((subAcc: number, r: any) => subAcc + (r.credits || 0), 0)), 0);

      const finalCreditsHist = accurateCreditsHist || totalCreditsHist;
      const finalPointsHist = accuratePointsHist || totalPointsHist;

      const totalCreditsByEnd = finalCreditsHist + currentSemCredits;
      const totalPointsNeededByEnd = savedTarget * totalCreditsByEnd;
      const pointsToEarn = totalPointsNeededByEnd - finalPointsHist;
      
      setRequiredSgpa(Math.max(0, pointsToEarn / currentSemCredits));
    }
  };

  useEffect(() => {
    const handleStorage = () => loadData();
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const handleSaveTarget = () => {
    const target = parseFloat(newTarget);
    if (isNaN(target) || target < 0 || target > 10) {
      toast.error("Please enter a valid CGPA between 0 and 10");
      return;
    }

    localStorage.setItem("target_cgpa", target.toString());
    setTargetCgpa(target);
    setShowTargetDialog(false);
    toast.success("Target CGPA updated successfully!");
    window.dispatchEvent(new Event("storage"));
    loadData();
  };

  const remainingSemesters = totalSemesters - completedSemesters;

  return (
    <div className="space-y-6 relative">
      {/* Gap Display at Top Right */}
      {targetCgpa > 0 && (
        <div className="absolute -top-12 right-0 flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#00d4ff]/10 to-[#a855f7]/10 border border-[#00d4ff]/20 backdrop-blur-md">
          <span className="text-gray-400 text-sm font-medium">Gap to Target:</span>
          <span className={`text-lg font-bold ${(targetCgpa - cgpa) > 0 ? "text-orange-400" : "text-emerald-400"}`}>
            {(targetCgpa - cgpa).toFixed(2)}
          </span>
        </div>
      )}

      {/* Current CGPA Card */}
      <div className="grid md:grid-cols-3 gap-6">
        <Card className="bg-gradient-to-br from-[#00d4ff]/20 to-[#0ea5e9]/20 border-[#00d4ff]/30 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-lg bg-gradient-to-br from-[#00d4ff] to-[#0ea5e9]">
              <Award className="w-6 h-6 text-white" />
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-gray-300">Current CGPA</p>
            <p className="text-4xl text-white">{cgpa.toFixed(2)}</p>
            <Progress value={(cgpa / 10) * 100} className="h-2 bg-gray-800" />
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-[#a855f7]/20 to-[#8b5cf6]/20 border-[#a855f7]/30 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-lg bg-gradient-to-br from-[#a855f7] to-[#8b5cf6]">
              <Target className="w-6 h-6 text-white" />
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setNewTarget(targetCgpa.toString());
                setShowTargetDialog(true);
              }}
              className="text-[#a855f7] hover:text-[#8b5cf6] hover:bg-[#a855f7]/10"
            >
              Edit
            </Button>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-gray-300">Target CGPA</p>
            <p className="text-4xl text-white">
              {targetCgpa > 0 ? targetCgpa.toFixed(2) : "Not Set"}
            </p>
            {targetCgpa > 0 && (
              <Progress value={(targetCgpa / 10) * 100} className="h-2 bg-gray-800" />
            )}
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border-emerald-500/30 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-gray-300">Required SGPA (Next Sem)</p>
            <p className="text-4xl text-white">
              {requiredSgpa > 0 ? requiredSgpa.toFixed(2) : "-"}
            </p>
            {requiredSgpa > 10 && (
              <p className="text-xs text-orange-400">
                Target may not be achievable
              </p>
            )}
          </div>
        </Card>
      </div>

      {/* Progress Overview */}
      <Card className="bg-[#111118]/80 backdrop-blur-xl border-gray-800/50 p-6">
        <h3 className="text-xl text-white mb-6">Academic Progress</h3>

        <div className="grid md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Completed Semesters</span>
              <span className="text-white text-lg">{completedSemesters} / {totalSemesters}</span>
            </div>
            <Progress
              value={(completedSemesters / totalSemesters) * 100}
              className="h-3 bg-gray-800"
            />

            <div className="flex justify-between items-center">
              <span className="text-gray-400">Remaining Semesters</span>
              <span className="text-white text-lg">{remainingSemesters}</span>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Gap to Target</span>
              <span
                className={`text-lg ${
                  targetCgpa > cgpa ? "text-orange-400" : "text-emerald-400"
                }`}
              >
                {targetCgpa > 0 ? (targetCgpa - cgpa).toFixed(2) : "-"}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-gray-400">Progress to Target</span>
              <span className="text-white text-lg">
                {targetCgpa > 0 ? ((cgpa / targetCgpa) * 100).toFixed(1) : "-"}%
              </span>
            </div>
            {targetCgpa > 0 && (
              <Progress
                value={(cgpa / targetCgpa) * 100}
                className="h-3 bg-gray-800"
              />
            )}
          </div>
        </div>
      </Card>

      {/* Semester-wise SGPA History */}
      <Card className="bg-[#111118]/80 backdrop-blur-xl border-gray-800/50 p-6">
        <h3 className="text-xl text-white mb-6">Semester-wise SGPA</h3>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((sem, index) => {
            const semData = semesterData.find((s) => s.semester === sem);
            const hasSgpa = semData && semData.sgpa > 0;

            return (
              <motion.div
                key={sem}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card
                  className={`p-4 text-center ${
                    hasSgpa
                      ? "bg-gradient-to-br from-[#00d4ff]/10 to-[#a855f7]/10 border-[#00d4ff]/30"
                      : "bg-[#0a0a0f]/30 border-gray-800"
                  }`}
                >
                  <p className="text-sm text-gray-400 mb-2">Semester {sem}</p>
                  <p className="text-2xl text-white">
                    {hasSgpa ? semData.sgpa.toFixed(2) : "-"}
                  </p>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </Card>

      {/* Target CGPA Dialog */}
      <Dialog open={showTargetDialog} onOpenChange={setShowTargetDialog}>
        <DialogContent className="bg-[#111118] border-gray-800 text-white">
          <DialogHeader>
            <DialogTitle className="text-2xl bg-gradient-to-r from-[#00d4ff] to-[#a855f7] bg-clip-text text-transparent">
              Set Target CGPA
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="target" className="text-gray-300">
                Target CGPA (0-10)
              </Label>
              <Input
                id="target"
                type="number"
                step="0.01"
                min="0"
                max="10"
                value={newTarget}
                onChange={(e) => setNewTarget(e.target.value)}
                className="bg-[#0a0a0f]/50 border-gray-700 focus:border-[#00d4ff] text-white"
                placeholder="9.0"
              />
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowTargetDialog(false)}
                className="border-gray-700 hover:border-gray-600 bg-transparent text-white"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveTarget}
                className="bg-gradient-to-r from-[#00d4ff] to-[#a855f7] hover:from-[#00ffff] hover:to-[#8b5cf6] text-white"
              >
                Save Target
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
