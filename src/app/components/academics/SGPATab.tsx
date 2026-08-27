import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../ui/accordion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Edit, Save, PenLine } from "lucide-react";
import { toast } from "sonner";

interface SubjectMark {
  subjectName: string;
  subjectCode: string;
  credits: number;
  internalMarks: number;
  externalMarks: number;
  totalMarks: number;
  grade: string;
  gradePoint: number;
}

interface SemesterData {
  semester: number;
  subjects: SubjectMark[];
  sgpa: number;
}

export function SGPATab() {
  const navigate = useNavigate();
  const [semesterData, setSemesterData] = useState<SemesterData[]>([]);
  const [currentSemester, setCurrentSemester] = useState(1);
  const [editingSemester, setEditingSemester] = useState<number | null>(null);
  const [editingData, setEditingData] = useState<SubjectMark[]>([]);

  useEffect(() => {
    loadData();
    const handleStorage = () => loadData();
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const loadData = () => {
    const profile = JSON.parse(localStorage.getItem("student_profile") || "{}");
    const subjects = JSON.parse(localStorage.getItem("subjects") || "[]");
    const savedSemesterData = JSON.parse(localStorage.getItem("semester_data") || "[]");

    setCurrentSemester(parseInt(profile.currentSemester) || 1);

    // If semester data exists, use it
    if (savedSemesterData.length > 0) {
      setSemesterData(savedSemesterData);
    } else {
      // Initialize current semester with subjects from onboarding
      const currentSemData: SemesterData = {
        semester: parseInt(profile.currentSemester) || 1,
        subjects: subjects.map((s: any) => ({
          subjectName: s.name,
          subjectCode: s.code,
          credits: s.credits,
          internalMarks: 0,
          externalMarks: 0,
          totalMarks: 0,
          grade: "-",
          gradePoint: 0,
        })),
        sgpa: 0,
      };
      setSemesterData([currentSemData]);
    }
  };

  const calculateGrade = (totalMarks: number): { grade: string; gradePoint: number } => {
    if (totalMarks >= 90) return { grade: "O", gradePoint: 10 };
    if (totalMarks >= 80) return { grade: "A+", gradePoint: 9 };
    if (totalMarks >= 70) return { grade: "A", gradePoint: 8 };
    if (totalMarks >= 60) return { grade: "B+", gradePoint: 7 };
    if (totalMarks >= 50) return { grade: "B", gradePoint: 6 };
    if (totalMarks >= 40) return { grade: "C", gradePoint: 5 };
    return { grade: "F", gradePoint: 0 };
  };

  const calculateSGPA = (subjects: SubjectMark[]): number => {
    const totalCredits = subjects.reduce((sum, s) => sum + s.credits, 0);
    const weightedGradePoints = subjects.reduce((sum, s) => sum + s.gradePoint * s.credits, 0);
    return totalCredits > 0 ? weightedGradePoints / totalCredits : 0;
  };

  const handleEditSemester = (semester: number) => {
    const semData = semesterData.find((s) => s.semester === semester);
    if (semData) {
      setEditingData([...semData.subjects]);
      setEditingSemester(semester);
    }
  };

  const handleSaveMarks = () => {
    if (editingSemester === null) return;

    // Calculate totals, grades, and grade points
    const updatedSubjects = editingData.map((subject) => {
      const total = subject.internalMarks + subject.externalMarks;
      const { grade, gradePoint } = calculateGrade(total);
      return {
        ...subject,
        totalMarks: total,
        grade,
        gradePoint,
      };
    });

    const sgpa = calculateSGPA(updatedSubjects);

    // Update semester data
    const updatedSemesterData = semesterData.map((sem) =>
      sem.semester === editingSemester
        ? { ...sem, subjects: updatedSubjects, sgpa }
        : sem
    );

    setSemesterData(updatedSemesterData);
    localStorage.setItem("semester_data", JSON.stringify(updatedSemesterData));
    setEditingSemester(null);
    toast.success("Marks saved successfully!");
  };

  const updateMark = (index: number, field: "internalMarks" | "externalMarks", value: string) => {
    const numValue = parseInt(value) || 0;
    const maxValue = field === "internalMarks" ? 40 : 60;

    if (numValue < 0 || numValue > maxValue) {
      toast.error(`${field === "internalMarks" ? "Internal" : "External"} marks must be between 0 and ${maxValue}`);
      return;
    }

    const updated = [...editingData];
    updated[index] = { ...updated[index], [field]: numValue };
    setEditingData(updated);
  };

  return (
    <div className="space-y-6">
      <Card className="bg-[#111118]/80 backdrop-blur-xl border-gray-800/50 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl text-white">Semester-wise Performance</h3>
          <Button
            onClick={() => navigate("/app/enter-marks")}
            className="bg-[var(--brand-start)] hover:bg-amber-600 text-white"
          >
            <PenLine className="w-4 h-4 mr-2" />
            Enter Marks
          </Button>
        </div>

        <Accordion type="single" collapsible className="space-y-2">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => {
            const semData = semesterData.find((s) => s.semester === sem);
            const hasData = semData && semData.subjects.length > 0;

            return (
              <AccordionItem
                key={sem}
                value={`semester-${sem}`}
                className="border border-gray-800 rounded-lg overflow-hidden bg-[#0a0a0f]/30"
              >
                <AccordionTrigger className="px-6 py-4 hover:bg-gray-800/30 text-white">
                  <div className="flex items-center justify-between w-full pr-4">
                    <span>Semester {sem}</span>
                    {hasData && (
                      <span className="text-[var(--brand-start)]">SGPA: {semData.sgpa.toFixed(2)}</span>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-4">
                  {hasData ? (
                    <div className="space-y-4">
                      <div className="flex justify-end">
                        <Button
                          onClick={() => handleEditSemester(sem)}
                          size="sm"
                          className="bg-[var(--brand-start)]/20 hover:bg-[var(--brand-start)]/30 text-[var(--brand-start)] border border-[var(--brand-start)]/30"
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          Edit Marks
                        </Button>
                      </div>

                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="border-gray-800 hover:bg-transparent">
                              <TableHead className="text-gray-400">Subject</TableHead>
                              <TableHead className="text-gray-400">Code</TableHead>
                              <TableHead className="text-gray-400">Credits</TableHead>
                              <TableHead className="text-gray-400">Internal</TableHead>
                              <TableHead className="text-gray-400">External</TableHead>
                              <TableHead className="text-gray-400">Total</TableHead>
                              <TableHead className="text-gray-400">Grade</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {semData.subjects.map((subject, idx) => (
                              <TableRow key={idx} className="border-gray-800 hover:bg-gray-800/20">
                                <TableCell className="text-white">{subject.subjectName}</TableCell>
                                <TableCell className="text-gray-400">{subject.subjectCode}</TableCell>
                                <TableCell className="text-white">{subject.credits}</TableCell>
                                <TableCell className="text-white">{subject.internalMarks}</TableCell>
                                <TableCell className="text-white">{subject.externalMarks}</TableCell>
                                <TableCell className="text-white">{subject.totalMarks}</TableCell>
                                <TableCell>
                                  <span
                                    className={`px-2 py-1 rounded ${
                                      subject.grade === "F"
                                        ? "bg-red-500/20 text-red-400"
                                        : "bg-emerald-500/20 text-emerald-400"
                                    }`}
                                  >
                                    {subject.grade}
                                  </span>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-400">
                      {sem === currentSemester
                        ? "Click 'Edit Marks' to enter your marks for this semester"
                        : "No data available for this semester"}
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </Card>

      {/* Edit Marks Dialog */}
      <Dialog open={editingSemester !== null} onOpenChange={() => setEditingSemester(null)}>
        <DialogContent className="bg-[#111118] border-gray-800 text-white max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl bg-gradient-to-r from-[var(--brand-start)] to-[var(--brand-end)] bg-clip-text text-transparent">
              Edit Marks - Semester {editingSemester}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-800 hover:bg-transparent">
                    <TableHead className="text-gray-400">Subject</TableHead>
                    <TableHead className="text-gray-400">Code</TableHead>
                    <TableHead className="text-gray-400">Credits</TableHead>
                    <TableHead className="text-gray-400">Internal (0-40)</TableHead>
                    <TableHead className="text-gray-400">External (0-60)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {editingData.map((subject, idx) => (
                    <TableRow key={idx} className="border-gray-800">
                      <TableCell className="text-white">{subject.subjectName}</TableCell>
                      <TableCell className="text-gray-400">{subject.subjectCode}</TableCell>
                      <TableCell className="text-white">{subject.credits}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          max="40"
                          value={subject.internalMarks || ""}
                          onChange={(e) => updateMark(idx, "internalMarks", e.target.value)}
                          className="w-24 bg-[#0a0a0f]/50 border-gray-700 text-white"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          max="60"
                          value={subject.externalMarks || ""}
                          onChange={(e) => updateMark(idx, "externalMarks", e.target.value)}
                          className="w-24 bg-[#0a0a0f]/50 border-gray-700 text-white"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setEditingSemester(null)}
                className="border-gray-700 hover:border-gray-600 bg-transparent text-white"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveMarks}
                className="bg-[var(--brand-start)] hover:bg-amber-600 text-white"
              >
                <Save className="w-4 h-4 mr-2" />
                Save Marks
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
