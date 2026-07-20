import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Bell, Calendar, TrendingUp, CheckCircle, LayoutGrid, PenLine, Target, AlertCircle, LogOut } from "lucide-react";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Progress } from "./ui/progress";
import { motion } from "motion/react";
import { MarkAttendanceDialog } from "./MarkAttendanceDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import confetti from "canvas-confetti";
import { toast } from "sonner";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { computeCGPA, computeRequiredSGPA } from "../../lib/academicUtils";

interface StudentProfile {
  fullName: string;
  currentSemester: string;
  [key: string]: string;
}

export function Dashboard() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [showAttendanceDialog, setShowAttendanceDialog] = useState(false);
  const [showTargetDialog, setShowTargetDialog] = useState(false);
  const [newTarget, setNewTarget] = useState("");
  const [showCongrats, setShowCongrats] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem("college_manager_user_id");
    localStorage.removeItem("college_manager_remember");
    localStorage.removeItem("college_manager_remember_expiry");
    localStorage.removeItem("student_profile");
    localStorage.removeItem("subjects");
    localStorage.removeItem("timetable");
    localStorage.removeItem("attendance_records");
    localStorage.removeItem("semester_data");
    localStorage.removeItem("semester_marks");
    localStorage.removeItem("backlogs");
    localStorage.removeItem("exam_calendar_v2");
    localStorage.removeItem("target_cgpa");
    navigate("/");
  };

  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [stats, setStats] = useState({
    attendance: 0,
    cgpa: 0,
    targetCgpa: 0,
    backlogs: 0,
    upcomingExams: 0,
    requiredSgpa: 0,
  });

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  };

  useEffect(() => {
    const calculateStats = () => {
      const updatedStats = {
        attendance: 0,
        cgpa: 0,
        targetCgpa: 0,
        backlogs: 0,
        upcomingExams: 0,
        requiredSgpa: 0,
      };

      // 1. Profile & Basic Info
      const savedProfile = localStorage.getItem("student_profile");
      if (savedProfile) {
        const p = JSON.parse(savedProfile);
        setProfile(p);
        updatedStats.backlogs = parseInt(p.backlogCount || "0");
      }

      // Load target CGPA from global key
      updatedStats.targetCgpa = parseFloat(localStorage.getItem("target_cgpa") || "0");

      // 2. Attendance Calculation (Strict Period-Based)
      const attendanceRecords = JSON.parse(localStorage.getItem("attendance_records") || "[]");
      const timetable = JSON.parse(localStorage.getItem("timetable") || "[]");
      
      if (attendanceRecords.length > 0 && timetable.length > 0) {
        let totalAttended = 0;
        let totalPossible = 0;
        
        attendanceRecords.forEach((record: any) => {
          const dayName = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date(record.date));
          const slotsForDay = timetable.filter((s: any) => s.day === dayName);
          
          if (slotsForDay.length > 0) {
            totalAttended += record.subjects?.length || 0;
            totalPossible += slotsForDay.length;
          }
        });
        
        updatedStats.attendance = totalPossible > 0 ? Math.round((totalAttended / totalPossible) * 100) : 0;
      }

      // 2.5 Check for Congrats
      if (localStorage.getItem("show_congrats_popup") === "true") {
        setShowCongrats(true);
        localStorage.removeItem("show_congrats_popup");
        // Fire confetti!
        setTimeout(() => {
          confetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#fbbf24', '#f97316', '#ffffff']
          });
        }, 500);
      }

      // 3. Upcoming Exams Calculation
      const examData = JSON.parse(localStorage.getItem("exam_calendar_v2") || "{}");
      if (examData.dayEvents) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        updatedStats.upcomingExams = examData.dayEvents.filter((ev: any) => {
          const evDate = new Date(ev.date);
          evDate.setHours(0, 0, 0, 0);
          return ev.examType !== "custom" && evDate >= today;
        }).length;
      }

      // 4. CGPA — credit-weighted via shared utility (skips sentinel -1 & zero-mark entries)
      const savedMarks = JSON.parse(localStorage.getItem("semester_marks") || "[]");
      const cgpaVal = computeCGPA(savedMarks);
      updatedStats.cgpa = cgpaVal ?? 0;

      // 5. Required SGPA via shared utility
      if (updatedStats.targetCgpa > 0) {
        const savedProfileRaw = localStorage.getItem("student_profile");
        const localProfile = savedProfileRaw ? JSON.parse(savedProfileRaw) : {};
        const currentSemNum = parseInt(localProfile.currentSemester || "1");
        updatedStats.requiredSgpa = computeRequiredSGPA(savedMarks, updatedStats.targetCgpa, currentSemNum);
      } else if (updatedStats.targetCgpa > 0) {
        updatedStats.requiredSgpa = updatedStats.targetCgpa;
      }


      // 6. Recent Activity Logic
      const activities: any[] = [];
      const sortedAttendance = [...attendanceRecords].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 2);
      sortedAttendance.forEach(a => {
        activities.push({
          text: `Attendance marked for ${new Date(a.date).toLocaleDateString()}`,
          time: a.date,
          color: "bg-[var(--brand-start)]"
        });
      });

      const sortedMarks = [...savedMarks].sort((a, b) => b.semester - a.semester).slice(0, 1);
      sortedMarks.forEach(m => {
        activities.push({
          text: `Semester ${m.semester} result updated`,
          time: "Recently",
          color: "bg-[var(--brand-end)]"
        });
      });
      setRecentActivities(activities);
      setStats(updatedStats);
    };

    calculateStats();
    
    // Listen for storage changes from other components
    const handleStorageChange = () => calculateStats();
    window.addEventListener("storage", handleStorageChange);
    
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => {
      clearInterval(timer);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  const statCards = [
    {
      title: "Overall Attendance",
      value: `${stats.attendance}%`,
      icon: CheckCircle,
      color: "from-emerald-500 to-teal-500",
      progress: stats.attendance,
    },
    {
      title: "Current CGPA",
      value: stats.cgpa.toFixed(2),
      icon: TrendingUp,
      color: "from-[var(--brand-start)] to-[var(--brand-start)]",
      progress: (stats.cgpa / 10) * 100,
    },
    {
      title: "Target CGPA",
      value: stats.targetCgpa.toFixed(2),
      icon: Target,
      color: "from-[var(--brand-end)] to-[#8b5cf6]",
      progress: (stats.targetCgpa / 10) * 100,
    },
    {
      title: "Active Backlogs",
      value: stats.backlogs,
      icon: AlertCircle,
      color: stats.backlogs > 0 ? "from-red-500 to-orange-500" : "from-green-500 to-emerald-500",
      progress: stats.backlogs > 0 ? 100 : 0,
    },
    {
      title: "Upcoming Exams",
      value: stats.upcomingExams,
      icon: Calendar,
      color: "from-purple-500 to-pink-500",
      progress: Math.min((stats.upcomingExams / 10) * 100, 100),
    },
    {
      title: "Required SGPA",
      value: stats.requiredSgpa.toFixed(2),
      icon: TrendingUp,
      color: "from-cyan-500 to-blue-500",
      progress: (stats.requiredSgpa / 10) * 100,
    },
  ];

  const handleSaveTarget = () => {
    const target = parseFloat(newTarget);
    if (isNaN(target) || target < 0 || target > 10) {
      toast.error("Please enter a valid CGPA between 0 and 10");
      return;
    }

    localStorage.setItem("target_cgpa", target.toString());
    setStats(prev => ({ ...prev, targetCgpa: target }));
    setShowTargetDialog(false);
    toast.success("Target CGPA updated successfully!");
    
    // Notify other components
    window.dispatchEvent(new Event("storage"));
    
    // Recalculate stats to update required SGPA using simple average
    const savedMarks = JSON.parse(localStorage.getItem("semester_marks") || "[]");
    const savedProfileRaw = localStorage.getItem("student_profile");
    const localProfile = savedProfileRaw ? JSON.parse(savedProfileRaw) : {};
    const currentSemNum = parseInt(localProfile.currentSemester || "1");

    const previousSemMarks = savedMarks.filter((m: any) => m.semester < currentSemNum);
    const sumPreviousSGPAs = previousSemMarks.reduce((acc: number, m: any) => acc + (m.sgpa || 0), 0);

    const req = (target * currentSemNum) - sumPreviousSGPAs;
    setStats(prev => ({ ...prev, requiredSgpa: Math.max(0, req) }));
  };

  return (
    <div className="p-4 md:p-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl mb-2 font-black bg-gradient-to-r from-[var(--brand-start)] via-slate-800 dark:via-white to-[var(--brand-end)] bg-clip-text text-transparent">
            {getGreeting()}, {profile?.fullName?.split(" ")[0] || "Student"}
          </h1>
          <p className="text-slate-600 dark:text-gray-400 text-base md:text-lg font-medium">
            Current Semester: {profile?.currentSemester || "N/A"}
          </p>
        </div>

        <div className="flex items-center space-x-4 self-end sm:self-auto">
          <Button
            variant="ghost"
            size="icon"
            className="relative text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-800/50 rounded-full"
          >
            <Bell className="w-5 h-5" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-[var(--brand-start)] rounded-full"></span>
          </Button>
          
          <div className="relative">
            <button
              onClick={() => setShowProfileDropdown(!showProfileDropdown)}
              className="focus:outline-none rounded-full block"
            >
              <Avatar className="w-12 h-12 border-2 border-[var(--brand-start)] shadow-[0_0_15px_rgba(var(--brand-start-rgb), 0.3)] hover:scale-105 transition-transform cursor-pointer">
                <AvatarFallback className="bg-gradient-to-br from-[var(--brand-start)] to-[var(--brand-end)] text-white font-bold">
                  {profile?.fullName?.charAt(0) || "S"}
                </AvatarFallback>
              </Avatar>
            </button>

            {showProfileDropdown && (
              <>
                {/* Backdrop overlay to close when clicking outside */}
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setShowProfileDropdown(false)}
                />
                
                {/* Dropdown Menu */}
                <div className="absolute right-0 mt-2 w-72 origin-top-right rounded-2xl border border-slate-200 dark:border-gray-800 bg-white/95 dark:bg-[#111118]/95 backdrop-blur-xl p-5 shadow-[0_10px_40px_rgba(0,0,0,0.15)] dark:shadow-[0_10px_40px_rgba(0,0,0,0.5)] z-50 text-slate-800 dark:text-gray-200 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="flex items-center space-x-3 pb-3 mb-3 border-b border-slate-100 dark:border-gray-800">
                    <Avatar className="w-10 h-10 border border-[var(--brand-start)]">
                      <AvatarFallback className="bg-gradient-to-br from-[var(--brand-start)] to-[var(--brand-end)] text-white text-sm font-bold">
                        {profile?.fullName?.charAt(0) || "S"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-slate-900 dark:text-white truncate">
                        {profile?.fullName || "Student"}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-gray-400 truncate">
                        {profile?.email || "No email"}
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-2 text-sm text-slate-600 dark:text-gray-300">
                    <div className="flex justify-between py-1">
                      <span className="text-slate-400 dark:text-gray-500 font-medium">Enrollment:</span>
                      <span className="font-semibold text-slate-800 dark:text-gray-200">{profile?.enrollmentNumber || "N/A"}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-400 dark:text-gray-500 font-medium">Semester:</span>
                      <span className="font-semibold text-slate-800 dark:text-gray-200">Semester {profile?.currentSemester || "N/A"}</span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-gray-800">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white font-semibold transition-all border border-red-500/20 hover:border-transparent text-sm active:scale-[0.98]"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Logout</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="relative overflow-hidden bg-white dark:bg-[#111118]/80 backdrop-blur-xl border-slate-200 dark:border-gray-800/50 p-6 hover:border-[var(--brand-start)]/50 dark:hover:border-[var(--brand-start)]/50 transition-all group shadow-sm dark:shadow-none hover:shadow-md dark:hover:shadow-none">
                {/* Glow Effect */}
                <div className={`absolute inset-0 bg-gradient-to-br ${stat.color} opacity-0 group-hover:opacity-10 transition-opacity`}></div>

                {/* Icon with Gradient Background */}
                <div className={`inline-flex p-3 rounded-lg bg-gradient-to-br ${stat.color} mb-4`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-500 dark:text-gray-400 group-hover:text-slate-700 dark:group-hover:text-gray-300 transition-colors uppercase tracking-wider">{stat.title}</p>
                    {stat.title === "Target CGPA" && (
                      <Button
                        variant="ghost" 
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          setNewTarget(stats.targetCgpa.toString());
                          setShowTargetDialog(true);
                        }}
                        className="h-6 w-6 text-slate-400 hover:text-[var(--brand-end)] hover:bg-black/5 dark:hover:bg-white/10 relative z-50"
                      >
                        <PenLine className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                  <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{stat.value}</p>
                  <Progress value={stat.progress} className="h-2 bg-gray-100 dark:bg-gray-800" />
                </div>

                {/* Decorative Corner */}
                <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${stat.color} opacity-5 rounded-bl-full`}></div>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-2xl mb-4 text-gray-900 dark:text-white">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <Button
            onClick={() => setShowAttendanceDialog(true)}
            className="h-24 bg-gradient-to-br from-[var(--brand-start)]/10 to-[var(--brand-start)]/10 dark:from-[var(--brand-start)]/20 dark:to-[var(--brand-start)]/20 border border-[var(--brand-start)]/30 hover:border-[var(--brand-start)] hover:bg-[var(--brand-start)]/30 text-gray-900 dark:text-white flex flex-col items-center justify-center gap-2 rounded-xl transition-all hover:shadow-[0_0_20px_rgba(var(--brand-start-rgb), 0.3)]"
          >
            <CheckCircle className="w-6 h-6" />
            <span className="text-sm">Mark Attendance</span>
          </Button>
          <Button
            onClick={() => navigate("/app/exam-calendar")}
            className="h-24 bg-gradient-to-br from-[var(--brand-end)]/20 to-[#8b5cf6]/20 border border-[var(--brand-end)]/30 hover:border-[var(--brand-end)] hover:bg-[var(--brand-end)]/30 text-gray-800 dark:text-white flex flex-col items-center justify-center gap-2 rounded-xl transition-all hover:shadow-[0_0_20px_rgba(var(--brand-end-rgb),0.3)]"
          >
            <Calendar className="w-6 h-6" />
            <span className="text-sm">Exam Calendar</span>
          </Button>
          <Button
            onClick={() => navigate("/app/enter-marks")}
            className="h-24 bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 hover:border-purple-500 hover:bg-purple-500/30 text-gray-800 dark:text-white flex flex-col items-center justify-center gap-2 rounded-xl transition-all hover:shadow-[0_0_20px_rgba(var(--brand-end-rgb),0.3)]"
          >
            <PenLine className="w-6 h-6" />
            <span className="text-sm">Enter Marks</span>
          </Button>
          <Button
            onClick={() => navigate("/app/timetable")}
            className="h-24 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 hover:border-emerald-500 hover:bg-emerald-500/30 text-gray-800 dark:text-white flex flex-col items-center justify-center gap-2 rounded-xl transition-all hover:shadow-[0_0_20px_rgba(16,185,129,0.3)]"
          >
            <LayoutGrid className="w-6 h-6" />
            <span className="text-sm">Timetable</span>
          </Button>
          <Button
            onClick={() => navigate("/app/target-predictor")}
            className="h-24 bg-gradient-to-br from-indigo-500/20 to-blue-500/20 border border-indigo-500/30 hover:border-indigo-500 hover:bg-indigo-500/30 text-gray-800 dark:text-white flex flex-col items-center justify-center gap-1 rounded-xl transition-all hover:shadow-[0_0_20px_rgba(99,102,241,0.3)]"
          >
            <TrendingUp className="w-5 h-5" />
            <span className="text-sm">Target Predictor</span>
          </Button>
          <Button
            onClick={() => navigate("/app/marks-calculator")}
            className="h-24 bg-gradient-to-br from-rose-500/10 to-orange-500/10 dark:from-rose-500/20 dark:to-orange-500/20 border border-rose-500/30 hover:border-rose-500 hover:bg-rose-500/30 text-gray-900 dark:text-white flex flex-col items-center justify-center gap-1 rounded-xl transition-all hover:shadow-[0_0_20px_rgba(244,63,94,0.3)]"
          >
            <Target className="w-5 h-5" />
            <span className="text-sm text-center leading-tight">Marks Calculator</span>
          </Button>
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <h2 className="text-2xl mb-4 text-gray-900 dark:text-white">Recent Activity</h2>
        <Card className="bg-white dark:bg-[#111118]/80 backdrop-blur-xl border border-gray-200 dark:border-gray-800/50 p-6">
          <div className="space-y-4">
            {recentActivities.length > 0 ? (
              recentActivities.map((activity, i) => (
                <div key={i} className="flex items-start space-x-4 pb-4 last:pb-0 last:border-b-0 border-b border-gray-100 dark:border-gray-800">
                  <div className={`w-2 h-2 mt-2 rounded-full ${activity.color}`}></div>
                  <div className="flex-1">
                    <p className="font-medium text-slate-800 dark:text-white">{activity.text}</p>
                    <p className="text-sm text-slate-500 dark:text-gray-400 font-medium">{activity.time}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-sm">No recent activity detected</p>
            )}
          </div>
        </Card>
      </div>

      {/* Mark Attendance Dialog */}
      {showAttendanceDialog && (
        <MarkAttendanceDialog
          open={showAttendanceDialog}
          onClose={() => setShowAttendanceDialog(false)}
        />
      )}

      {/* Congrats Popup */}
      <Dialog open={showCongrats} onOpenChange={setShowCongrats}>
        <DialogContent className="bg-[#111118]/95 backdrop-blur-2xl border-gray-800 text-center p-12 max-w-lg">
          <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", duration: 0.8 }}>
            <div className="w-24 h-24 rounded-full bg-gradient-to-r from-[var(--brand-start)] to-[var(--brand-end)] mx-auto mb-6 flex items-center justify-center shadow-[0_0_50px_rgba(var(--brand-start-rgb), 0.5)]">
              <CheckCircle className="w-12 h-12 text-white" />
            </div>
            <DialogHeader>
              <DialogTitle className="text-4xl font-bold bg-gradient-to-r from-[var(--brand-start)] to-[var(--brand-end)] bg-clip-text text-transparent mb-4">
                Congratulations!
              </DialogTitle>
              <DialogDescription className="text-gray-300 text-xl leading-relaxed">
                Welcome to your command center. Your profile, subjects, and timetable have been successfully synchronized.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-8">
              <Button 
                onClick={() => setShowCongrats(false)}
                className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-[var(--brand-start)] to-[var(--brand-end)] hover:from-[#00ffff] hover:to-[#8b5cf6] text-white shadow-[0_0_20px_rgba(var(--brand-start-rgb), 0.3)] transition-all hover:scale-105"
              >
                Let&apos;s Get Started
              </Button>
            </div>
          </motion.div>
        </DialogContent>
      </Dialog>
      {/* Target CGPA Dialog */}
      <Dialog open={showTargetDialog} onOpenChange={setShowTargetDialog}>
        <DialogContent className="bg-[#111118] border-gray-800 text-white">
          <DialogHeader>
            <DialogTitle className="text-2xl bg-gradient-to-r from-[var(--brand-start)] to-[var(--brand-end)] bg-clip-text text-transparent">
              Set Target CGPA
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="target-dashboard" className="text-gray-300">
                Target CGPA (0-10)
              </Label>
              <Input
                id="target-dashboard"
                type="number"
                step="0.01"
                min="0"
                max="10"
                value={newTarget}
                onChange={(e) => setNewTarget(e.target.value)}
                className="bg-[#0a0a0f]/50 border-gray-700 focus:border-[var(--brand-start)] text-white"
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
                className="bg-gradient-to-r from-[var(--brand-start)] to-[var(--brand-end)] hover:from-[#00ffff] hover:to-[#8b5cf6] text-white"
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
