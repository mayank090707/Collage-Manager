import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Card } from "./ui/card";
import { Trash2, Plus, X } from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";

interface Subject {
  id: string;
  name: string;
  credits: number;
}

interface TimetableSlot {
  day: string;
  subject: string;
  period: number;
}

export function OnboardingFlow() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  const [studentInfo, setStudentInfo] = useState({
    fullName: "",
    enrollmentNumber: "",
    email: "",
    collegeName: "",
    course: "",
    branch: "",
    currentSemester: "",
    admissionYear: "",
    graduationYear: "",
    targetCgpa: "",
    backlogCount: "0",
    backlogSubjects: [] as string[],
  });

  useEffect(() => {
    // Try to pre-fill from what we got during login/sync
    const saved = localStorage.getItem("student_profile");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setStudentInfo(prev => ({
          ...prev,
          ...parsed
        }));
      } catch (e) {}
    }
  }, []);

  const [subjects, setSubjects] = useState<Subject[]>([]);

  const [timetable, setTimetable] = useState<TimetableSlot[]>([]);
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  const addSubject = () => {
    setSubjects([...subjects, { id: Date.now().toString(), name: "", credits: 0 }]);
  };

  const removeSubject = (id: string) => {
    setSubjects(subjects.filter((s) => s.id !== id));
  };

  const updateSubject = (id: string, field: keyof Subject, value: string | number) => {
    setSubjects(subjects.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  };

  const handleBacklogCountChange = (val: string) => {
    const count = parseInt(val) || 0;
    const existing = studentInfo.backlogSubjects;
    const updated =
      count > existing.length
        ? [...existing, ...Array(count - existing.length).fill("")]
        : existing.slice(0, count);
    setStudentInfo({ ...studentInfo, backlogCount: val, backlogSubjects: updated });
  };

  const updateBacklogSubject = (index: number, value: string) => {
    const updated = [...studentInfo.backlogSubjects];
    updated[index] = value;
    setStudentInfo({ ...studentInfo, backlogSubjects: updated });
  };

  const handleNext = () => {
    if (step === 1) {
      if (!studentInfo.fullName || !studentInfo.enrollmentNumber || !studentInfo.email) {
        toast.error("Please fill in all required fields");
        return;
      }
    } else if (step === 2) {
      if (subjects.length === 0) {
        toast.error("Please add at least one subject");
        return;
      }
      if (subjects.some((s) => !s.name || s.credits <= 0)) {
        toast.error("Please complete all subject information");
        return;
      }
      
      const names = subjects.map(s => s.name.toLowerCase().trim());
      const uniqueNames = new Set(names);
      if (names.length !== uniqueNames.size) {
        toast.error("Subject names must be unique! Duplicate subjects are not allowed.");
        return;
      }
    }

    if (step < 3) {
      setStep(step + 1);
    } else {
      localStorage.setItem("student_profile", JSON.stringify(studentInfo));
      localStorage.setItem("target_cgpa", studentInfo.targetCgpa);
      localStorage.setItem("subjects", JSON.stringify(subjects));
      localStorage.setItem("timetable", JSON.stringify(timetable));
      localStorage.setItem("onboarding_complete", "true");
      localStorage.setItem("show_congrats_popup", "true");
      
      // Async sync to backend
      import("../../lib/api").then(({ api }) => {
        api.migrateLocalStorageToDB().then(() => {
          toast.success("Database synced successfully!");
        });
      });

      toast.success("Onboarding completed successfully!");
      navigate("/app");
    }
  };

  const addTimetableSlot = (day: string, subjectName: string) => {
    const daySlots = timetable.filter((t) => t.day === day);
    setTimetable([...timetable, { day, subject: subjectName, period: daySlots.length + 1 }]);
  };

  const removeTimetableSlot = (day: string, indexInDay: number) => {
    // Find slots for this day
    const daySlots = timetable.filter((t) => t.day === day);
    const otherSlots = timetable.filter((t) => t.day !== day);
    
    // Remove the one at indexInDay (0-based)
    daySlots.splice(indexInDay, 1);
    
    // Reorder remaining
    const reordered = daySlots.map((s, i) => ({ ...s, period: i + 1 }));
    setTimetable([...otherSlots, ...reordered]);
  };

  const getDaySlots = (day: string) => {
    return timetable.filter((t) => t.day === day).sort((a, b) => a.period - b.period);
  };

  const inputCls = "bg-[#0a0a0f]/50 border-gray-700 focus:border-[#00d4ff] text-white";

  const COLLEGES = [
    "Maharaja Agrasen Institute of Technology (MAIT)",
    "Bhagwan Parshuram Institute of Technology (BPIT)",
    "Bharati Vidyapeeth's College of Engineering (BVCOE)",
    "University School of Information, Communication and Technology (USICT)",
    "Indira Gandhi Delhi Technical University for Women (IGDTUW)",
    "Akhilesh Das Gupta Institute of Technology & Management (ADGITM)",
    "Guru Tegh Bahadur Institute of Technology (GTBIT)",
    "HMR Institute of Technology & Management",
    "Maharaja Surajmal Institute of Technology (MSIT)",
    "Vardhaman Mahavir Medical College (VMMC)",
  ];

  const BRANCHES = [
    "CSE - Computer Science & Engineering",
    "IT - Information Technology",
    "CSE-DS - Computer Science & Data Science",
    "CSE-AIML - Computer Science & AI/ML",
    "ECE - Electronics & Communication Engineering",
    "EEE - Electrical & Electronics Engineering",
    "MAE - Mechanical & Automation Engineering",
    "CVE - Civil Engineering",
  ];

  return (
    <div className="min-h-screen bg-background relative overflow-hidden text-foreground">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-20 w-96 h-96 bg-[#00d4ff] rounded-full mix-blend-multiply filter blur-[128px] opacity-20 animate-blob"></div>
        <div className="absolute top-40 right-20 w-96 h-96 bg-[#a855f7] rounded-full mix-blend-multiply filter blur-[128px] opacity-20 animate-blob animation-delay-2000"></div>
      </div>

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-4xl">
          {/* Progress */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              {[1, 2, 3].map((s) => (
                <div key={s} className="flex items-center flex-1">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                      step >= s
                        ? "bg-gradient-to-r from-[#00d4ff] to-[#a855f7] text-white shadow-[0_0_20px_rgba(0,212,255,0.5)]"
                        : "bg-gray-700 text-gray-400"
                    }`}
                  >
                    {s}
                  </div>
                  {s < 3 && (
                    <div className={`flex-1 h-1 mx-2 rounded ${step > s ? "bg-gradient-to-r from-[#00d4ff] to-[#a855f7]" : "bg-gray-700"}`} />
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-between text-sm text-gray-400">
              <span>Student Info</span>
              <span>Subjects</span>
              <span>Timetable</span>
            </div>
          </div>

          <motion.div key={step} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <Card className="bg-[#111118]/80 backdrop-blur-xl border-gray-800/50 p-8">

              {/* ── STEP 1: Student Info ── */}
              {step === 1 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-3xl mb-1 bg-gradient-to-r from-[#00d4ff] to-[#a855f7] bg-clip-text text-transparent">
                      Student Information
                    </h2>
                    <p className="text-gray-400">Let's start by setting up your profile</p>
                  </div>

                  <div className="grid md:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <Label className="text-gray-300">Full Name *</Label>
                      <Input value={studentInfo.fullName} onChange={(e) => setStudentInfo({ ...studentInfo, fullName: e.target.value })} className={inputCls} placeholder="John Doe" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-300">Enrollment Number *</Label>
                      <Input value={studentInfo.enrollmentNumber} onChange={(e) => setStudentInfo({ ...studentInfo, enrollmentNumber: e.target.value })} className={inputCls} placeholder="2024/123456" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-300">Email *</Label>
                      <Input type="email" value={studentInfo.email} onChange={(e) => setStudentInfo({ ...studentInfo, email: e.target.value })} className={inputCls} placeholder="student@college.edu" />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-gray-300">College Name</Label>
                      <Select value={studentInfo.collegeName} onValueChange={(v) => setStudentInfo({ ...studentInfo, collegeName: v })}>
                        <SelectTrigger className={inputCls}><SelectValue placeholder="Select your college" /></SelectTrigger>
                        <SelectContent className="bg-[#111118] border-gray-700 text-white max-h-60 overflow-y-auto">
                          {COLLEGES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-gray-300">Course</Label>
                      <Select value={studentInfo.course} onValueChange={(v) => setStudentInfo({ ...studentInfo, course: v })}>
                        <SelectTrigger className={inputCls}><SelectValue placeholder="Select course" /></SelectTrigger>
                        <SelectContent className="bg-[#111118] border-gray-700 text-white">
                          {["B.Tech", "BCA", "MBA", "MCA"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-gray-300">Branch</Label>
                      <Select value={studentInfo.branch} onValueChange={(v) => setStudentInfo({ ...studentInfo, branch: v })}>
                        <SelectTrigger className={inputCls}><SelectValue placeholder="Select your branch" /></SelectTrigger>
                        <SelectContent className="bg-[#111118] border-gray-700 text-white">
                          {BRANCHES.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-300">Current Semester</Label>
                      <Select value={studentInfo.currentSemester} onValueChange={(v) => setStudentInfo({ ...studentInfo, currentSemester: v })}>
                        <SelectTrigger className={inputCls}><SelectValue placeholder="Select semester" /></SelectTrigger>
                        <SelectContent className="bg-[#111118] border-gray-700 text-white">
                          {[1,2,3,4,5,6,7,8].map((s) => <SelectItem key={s} value={s.toString()}>Semester {s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-300">Admission Year</Label>
                      <Input type="number" value={studentInfo.admissionYear} onChange={(e) => setStudentInfo({ ...studentInfo, admissionYear: e.target.value })} className={inputCls} placeholder="2024" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-300">Graduation Year</Label>
                      <Input type="number" value={studentInfo.graduationYear} onChange={(e) => setStudentInfo({ ...studentInfo, graduationYear: e.target.value })} className={inputCls} placeholder="2028" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-300">Target CGPA</Label>
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        max="10"
                        value={studentInfo.targetCgpa}
                        onChange={(e) => setStudentInfo({ ...studentInfo, targetCgpa: e.target.value })}
                        className={inputCls}
                        placeholder="e.g. 9.0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-300">Number of Backlogs</Label>
                      <Input
                        type="number"
                        min="0"
                        value={studentInfo.backlogCount}
                        onChange={(e) => handleBacklogCountChange(e.target.value)}
                        className={inputCls}
                        placeholder="0"
                      />
                    </div>
                  </div>

                  {parseInt(studentInfo.backlogCount) > 0 && (
                    <div className="space-y-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                      <Label className="text-red-300 font-semibold">Backlog Subjects</Label>
                      <div className="grid md:grid-cols-2 gap-3">
                        {studentInfo.backlogSubjects.map((subj, idx) => (
                          <div key={idx} className="space-y-1">
                            <Label className="text-gray-400 text-xs">Backlog #{idx + 1}</Label>
                            <Input
                              value={subj}
                              onChange={(e) => updateBacklogSubject(idx, e.target.value)}
                              className="bg-[#0a0a0f]/50 border-red-700/50 focus:border-red-400 text-white"
                              placeholder={`Subject name e.g. Data Structures`}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── STEP 2: Subjects ── */}
              {step === 2 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-3xl mb-1 bg-gradient-to-r from-[#00d4ff] to-[#a855f7] bg-clip-text text-transparent">
                      Current Semester Subjects
                    </h2>
                    <p className="text-gray-400">Add your subjects — credits are used for SGPA/CGPA calculations</p>
                  </div>

                  <div className="space-y-3">
                    {subjects.map((subject, idx) => (
                      <div key={subject.id} className="flex gap-3 items-end bg-[#0a0a0f]/30 p-4 rounded-lg border border-gray-800/50">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-r from-[#00d4ff]/20 to-[#a855f7]/20 border border-[#00d4ff]/30 flex items-center justify-center text-[#00d4ff] text-sm font-bold flex-shrink-0 self-center">
                          {idx + 1}
                        </div>
                        <div className="flex-1 space-y-1">
                          <Label className="text-gray-300 text-xs">Subject Name</Label>
                          <Input value={subject.name} onChange={(e) => updateSubject(subject.id, "name", e.target.value)} className={inputCls} placeholder="e.g. Data Structures" />
                        </div>
                        <div className="w-28 space-y-1">
                          <Label className="text-gray-300 text-xs">Credits</Label>
                          <Input
                            type="number"
                            value={subject.credits || ""}
                            onChange={(e) => updateSubject(subject.id, "credits", parseInt(e.target.value) || 0)}
                            className={inputCls}
                            min="1"
                          />
                        </div>
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeSubject(subject.id)} className="text-red-400 hover:text-red-300 hover:bg-red-500/10 flex-shrink-0">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  <Button type="button" onClick={addSubject} variant="outline" className="w-full border-dashed border-gray-700 hover:border-[#00d4ff] bg-transparent text-[#00d4ff] hover:bg-[#00d4ff]/10">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Subject
                  </Button>
                </div>
              )}

              {/* ── STEP 3: Timetable ── */}
              {step === 3 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-3xl mb-1 bg-gradient-to-r from-[#00d4ff] to-[#a855f7] bg-clip-text text-transparent">
                      Create Your Timetable
                    </h2>
                    <p className="text-gray-400">
                      Click subjects to add them as periods. You can add the same subject multiple times (e.g. for labs).
                    </p>
                  </div>

                  <div className="space-y-6">
                    {days.map((day) => {
                      const daySlots = getDaySlots(day);
                      return (
                        <div key={day} className="space-y-3 p-4 rounded-xl bg-[#0a0a0f]/30 border border-gray-800/50">
                          <div className="flex items-center justify-between border-b border-gray-800/50 pb-2">
                            <Label className="text-[#00d4ff] font-bold text-lg">{day}</Label>
                            <span className="text-xs text-gray-500 uppercase tracking-widest">{daySlots.length} Slots</span>
                          </div>

                          {/* Subject Buttons to Add */}
                          <div className="flex flex-wrap gap-2">
                            {subjects.filter((s) => s.name).map((subject) => (
                              <button
                                key={subject.id}
                                type="button"
                                onClick={() => addTimetableSlot(day, subject.name)}
                                className="px-3 py-1.5 rounded-md border border-gray-700 bg-gray-800/30 text-gray-300 text-xs hover:border-[#00d4ff] hover:text-white transition-all flex items-center gap-1.5"
                              >
                                <Plus size={12} />
                                {subject.name}
                              </button>
                            ))}
                          </div>

                          {/* Current Day Schedule */}
                          {daySlots.length > 0 ? (
                            <div className="flex flex-wrap gap-2 pt-2">
                              {daySlots.map((slot, idx) => (
                                <div
                                  key={`${day}-${idx}`}
                                  className="group flex items-center gap-2 pl-3 pr-1 py-1 rounded-full bg-gradient-to-r from-[#00d4ff]/10 to-[#a855f7]/10 border border-[#00d4ff]/30 text-white text-sm"
                                >
                                  <span className="text-[10px] font-bold opacity-50">P{slot.period}</span>
                                  <span className="font-medium">{slot.subject}</span>
                                  <button
                                    type="button"
                                    onClick={() => removeTimetableSlot(day, idx)}
                                    className="p-1 rounded-full hover:bg-black/20 text-gray-400 hover:text-red-400 transition-colors"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[10px] text-gray-600 italic">No periods assigned yet</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex justify-between mt-8">
                {step > 1 && (
                  <Button type="button" onClick={() => setStep(step - 1)} variant="outline" className="border-gray-700 hover:border-gray-600 bg-transparent text-white">
                    Previous
                  </Button>
                )}
                <Button type="button" onClick={handleNext} className="ml-auto bg-gradient-to-r from-[#00d4ff] to-[#a855f7] hover:from-[#00ffff] hover:to-[#8b5cf6] text-white shadow-[0_0_20px_rgba(0,212,255,0.3)]">
                  {step === 3 ? "Complete Setup" : "Next →"}
                </Button>
              </div>
            </Card>
          </motion.div>
        </div>
      </div>

      <style>{`
        @keyframes blob {
          0% { transform: translate(0px,0px) scale(1); }
          33% { transform: translate(30px,-50px) scale(1.1); }
          66% { transform: translate(-20px,20px) scale(0.9); }
          100% { transform: translate(0px,0px) scale(1); }
        }
        .animate-blob { animation: blob 7s infinite; }
        .animation-delay-2000 { animation-delay: 2s; }
      `}</style>
    </div>
  );
}
