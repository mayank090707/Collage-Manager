import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Bell, Calendar, TrendingUp, CheckCircle, LayoutGrid, PenLine, Target, AlertCircle, LogOut, History, AlertTriangle, X, ChevronRight } from "lucide-react";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Progress } from "./ui/progress";
import { motion } from "motion/react";
import { MarkAttendanceDialog } from "./MarkAttendanceDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import confetti from "canvas-confetti";
import { toast } from "sonner";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { computeCGPA, computeRequiredSGPA, computeAttendanceStats } from "../../lib/academicUtils";

interface StudentProfile {
  fullName: string;
  currentSemester: string;
  [key: string]: string;
}

interface NotificationItem {
  id: string;
  type: "attendance" | "exam";
  title: string;
  message: string;
  link: string;
  level: "warning" | "urgent";
}

export function Dashboard() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [showAttendanceDialog, setShowAttendanceDialog] = useState(false);
  const [showTargetDialog, setShowTargetDialog] = useState(false);
  const [showRecentActivityDialog, setShowRecentActivityDialog] = useState(false);
  const [showNotificationsPopover, setShowNotificationsPopover] = useState(false);
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
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [stats, setStats] = useState<{
    attendance: number;
    cgpa: number;
    targetCgpa: number;
    backlogs: number;
    upcomingExams: number;
    requiredSgpa: number | null;
  }>({
    attendance: 0,
    cgpa: 0,
    targetCgpa: 0,
    backlogs: 0,
    upcomingExams: 0,
    requiredSgpa: null,
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
        requiredSgpa: null as number | null,
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

      // 2. Attendance Calculation via shared utility
      const attResult = computeAttendanceStats();
      updatedStats.attendance = attResult.overallAttendance;

      // 2.5 Check for Congrats
      if (localStorage.getItem("show_congrats_popup") === "true") {
        setShowCongrats(true);
        localStorage.removeItem("show_congrats_popup");
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
          const evDate = new Date(ev.date + "T00:00:00");
          evDate.setHours(0, 0, 0, 0);
          return ev.examType && ev.examType !== "custom" && evDate >= today;
        }).length;
      }

      // 4. CGPA — credit-weighted via shared utility
      const savedMarks = JSON.parse(localStorage.getItem("semester_marks") || "[]");
      const cgpaVal = computeCGPA(savedMarks);
      updatedStats.cgpa = cgpaVal ?? 0;

      // 5. Required SGPA via shared utility
      if (updatedStats.targetCgpa > 0) {
        const savedProfileRaw = localStorage.getItem("student_profile");
        const localProfile = savedProfileRaw ? JSON.parse(savedProfileRaw) : {};
        const currentSemNum = parseInt(localProfile.currentSemester || "1");
        updatedStats.requiredSgpa = computeRequiredSGPA(savedMarks, updatedStats.targetCgpa, currentSemNum);
      }

      // 6. Notifications Calculation (Low Attendance & Exams within 3 days ONLY)
      const notifList: NotificationItem[] = [];

      // A) Low Attendance Alerts (only if attendance has been marked)
      if (attResult.hasData) {
        attResult.subjectList.forEach((sub) => {
          if (sub.total > 0 && sub.percentage < 75) {
            notifList.push({
              id: `low-att-${sub.subject}`,
              type: "attendance",
              title: "Low Attendance Warning",
              message: `Attendance in ${sub.subject} is ${sub.percentage}% (below required 75%).`,
              link: "/app/academics",
              level: "warning"
            });
          }
        });
      }

      // B) Exams within 3 days Alert
      if (examData.dayEvents) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        examData.dayEvents.forEach((ev: any) => {
          if (ev.examType && ev.examType !== "custom" && ev.date) {
            const evDate = new Date(ev.date + "T00:00:00");
            evDate.setHours(0, 0, 0, 0);
            const diffTime = evDate.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays >= 0 && diffDays <= 3) {
              const dayStr = diffDays === 0 ? "Today" : diffDays === 1 ? "Tomorrow" : `in ${diffDays} days`;
              notifList.push({
                id: `exam-${ev.date}-${ev.title || ev.subject || "Exam"}`,
                type: "exam",
                title: "Upcoming Exam Alert",
                message: `${ev.title || ev.subject || "Exam"} is scheduled ${dayStr} (${ev.date}).`,
                link: "/app/exams",
                level: "urgent"
              });
            }
          }
        });
      }

      setNotifications(notifList);

      // 7. Recent Activity Logic
      const rawAttendanceRecords = JSON.parse(localStorage.getItem("attendance_records") || "[]");
      const activities: any[] = [];
      const sortedAttendance = [...rawAttendanceRecords].sort((a: any, b: any) => b.date.localeCompare(a.date)).slice(0, 3);
      sortedAttendance.forEach(a => {
        activities.push({
          text: `Attendance marked for ${a.date}`,
          time: a.date,
          color: "bg-[var(--brand-start)]"
        });
      });

      const sortedMarks = [...savedMarks].sort((a: any, b: any) => b.semester - a.semester).slice(0, 2);
      sortedMarks.forEach(m => {
        activities.push({
          text: `Semester ${m.semester} result updated`,
          time: "Recently",
          color: "bg-[var(--brand-end)]"
        });
      });

      if (updatedStats.targetCgpa > 0) {
        activities.push({
          text: `Target CGPA set to ${updatedStats.targetCgpa.toFixed(2)}`,
          time: "Active",
          color: "bg-emerald-500"
        });
      }

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
      subtitle: stats.attendance >= 75 ? "On track" : "Needs attention"
    },
    {
      title: "Current CGPA",
      value: stats.cgpa.toFixed(2),
      icon: TrendingUp,
      color: "from-[var(--brand-start)] to-[var(--brand-start)]",
      progress: (stats.cgpa / 10) * 100,
      subtitle: "Credit-weighted"
    },
    {
      title: "Target CGPA",
      value: stats.targetCgpa > 0 ? stats.targetCgpa.toFixed(2) : "Not Set",
      icon: Target,
      color: "from-[var(--brand-start)] to-amber-500",
      progress: (stats.targetCgpa / 10) * 100,
      subtitle: "Graduation Goal"
    },
    {
      title: "Active Backlogs",
      value: stats.backlogs,
      icon: AlertCircle,
      color: stats.backlogs > 0 ? "from-red-500 to-orange-500" : "from-green-500 to-emerald-500",
      progress: stats.backlogs > 0 ? 100 : 0,
      subtitle: stats.backlogs > 0 ? "Clear soon" : "Clean record"
    },
    {
      title: "Upcoming Exams",
      value: stats.upcomingExams,
      icon: Calendar,
      color: "from-purple-500 to-pink-500",
      progress: Math.min((stats.upcomingExams / 10) * 100, 100),
      subtitle: "Scheduled exams"
    },
    {
      title: "Required SGPA",
      value: stats.requiredSgpa !== null ? (stats.requiredSgpa > 10 ? "10.0+" : stats.requiredSgpa.toFixed(2)) : "N/A",
      icon: TrendingUp,
      color: "from-cyan-500 to-blue-500",
      progress: stats.requiredSgpa !== null ? Math.min((stats.requiredSgpa / 10) * 100, 100) : 0,
      subtitle: stats.requiredSgpa !== null ? "Current sem target" : "Enter prev sem results first"
    },
  ];

  const handleSaveTarget = () => {
    const target = parseFloat(newTarget);
    if (isNaN(target) || target < 0 || target > 10) {
      toast.error("Please enter a valid CGPA between 0 and 10");
      return;
    }

    localStorage.setItem("target_cgpa", target.toString());
    setShowTargetDialog(false);
    toast.success("Target CGPA updated successfully!");
    window.dispatchEvent(new Event("storage"));
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

        <div className="flex items-center space-x-4 self-end sm:self-auto relative">
          {/* Notification Bell Button */}
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setShowNotificationsPopover(!showNotificationsPopover);
                setShowProfileDropdown(false);
              }}
              className="relative text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-800/50 rounded-full"
            >
              <Bell className="w-5 h-5" />
              {notifications.length > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-background">
                  {notifications.length}
                </span>
              )}
            </Button>

            {/* Notification Popover Dropdown */}
            {showNotificationsPopover && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowNotificationsPopover(false)}
                />
                <div className="absolute right-0 mt-2 w-80 sm:w-96 origin-top-right rounded-2xl border border-slate-200 dark:border-gray-800 bg-white/95 dark:bg-[#111118]/95 backdrop-blur-xl p-4 shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-border">
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-[var(--brand-start)]" />
                      <span className="font-bold text-foreground text-sm">Notifications</span>
                    </div>
                    {notifications.length > 0 && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[var(--brand-start)]/10 text-[var(--brand-start)] border border-[var(--brand-start)]/30">
                        {notifications.length} Active
                      </span>
                    )}
                  </div>

                  <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                    {notifications.length > 0 ? (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          className={`p-3 rounded-xl border text-xs flex items-start gap-3 transition-all ${
                            n.level === "urgent"
                              ? "bg-purple-500/10 border-purple-500/30 text-purple-600 dark:text-purple-300"
                              : "bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-300"
                          }`}
                        >
                          <div className="mt-0.5 flex-shrink-0">
                            {n.type === "attendance" ? (
                              <AlertTriangle className="w-4 h-4 text-red-500" />
                            ) : (
                              <Calendar className="w-4 h-4 text-purple-500" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-foreground mb-0.5">{n.title}</p>
                            <p className="text-muted-foreground leading-relaxed">{n.message}</p>
                            <button
                              onClick={() => {
                                setShowNotificationsPopover(false);
                                navigate(n.link);
                              }}
                              className="mt-2 text-[11px] font-bold text-[var(--brand-start)] hover:underline flex items-center gap-1"
                            >
                              View Details <ChevronRight size={12} />
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-8 text-center text-muted-foreground text-xs">
                        <CheckCircle className="w-8 h-8 mx-auto mb-2 text-emerald-500/60" />
                        <p className="font-semibold text-foreground mb-0.5">All Caught Up!</p>
                        <p>No low attendance warnings or upcoming exams within 3 days.</p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
          
          <div className="relative">
            <button
              onClick={() => {
                setShowProfileDropdown(!showProfileDropdown);
                setShowNotificationsPopover(false);
              }}
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
                {/* Backdrop overlay */}
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

                  {/* Profile Actions */}
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-gray-800 space-y-2">
                    <button
                      onClick={() => {
                        setShowRecentActivityDialog(true);
                        setShowProfileDropdown(false);
                      }}
                      className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-[var(--brand-start)]/10 hover:bg-[var(--brand-start)]/20 text-[var(--brand-start)] font-semibold transition-all border border-[var(--brand-start)]/20 text-sm active:scale-[0.98]"
                    >
                      <History className="w-4 h-4" />
                      <span>View Recent Activity</span>
                    </button>

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
        <h2 className="text-2xl mb-4 font-bold text-foreground">Quick Actions</h2>
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
            className="h-24 bg-gradient-to-br from-[var(--brand-start)]/10 to-amber-500/10 border border-[var(--brand-start)]/25 hover:border-[var(--brand-start)]/60 hover:bg-[var(--brand-start)]/20 text-foreground flex flex-col items-center justify-center gap-2 rounded-xl transition-all"
          >
            <Calendar className="w-6 h-6" />
            <span className="text-sm">Exam Calendar</span>
          </Button>
          <Button
            onClick={() => navigate("/app/enter-marks")}
            className="h-24 bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/25 hover:border-purple-500/60 hover:bg-purple-500/20 text-foreground flex flex-col items-center justify-center gap-2 rounded-xl transition-all"
          >
            <PenLine className="w-6 h-6" />
            <span className="text-sm">Enter Marks</span>
          </Button>
          <Button
            onClick={() => navigate("/app/timetable")}
            className="h-24 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/25 hover:border-emerald-500/60 hover:bg-emerald-500/20 text-foreground flex flex-col items-center justify-center gap-2 rounded-xl transition-all"
          >
            <LayoutGrid className="w-6 h-6" />
            <span className="text-sm">Timetable</span>
          </Button>
          <Button
            onClick={() => navigate("/app/target-predictor")}
            className="h-24 bg-gradient-to-br from-indigo-500/10 to-blue-500/10 border border-indigo-500/25 hover:border-indigo-500/60 hover:bg-indigo-500/20 text-foreground flex flex-col items-center justify-center gap-1 rounded-xl transition-all"
          >
            <TrendingUp className="w-5 h-5" />
            <span className="text-sm">Target Predictor</span>
          </Button>
          <Button
            onClick={() => navigate("/app/marks-calculator")}
            className="h-24 bg-gradient-to-br from-rose-500/10 to-orange-500/10 border border-rose-500/25 hover:border-rose-500/60 hover:bg-rose-500/20 text-foreground flex flex-col items-center justify-center gap-1 rounded-xl transition-all"
          >
            <Target className="w-5 h-5" />
            <span className="text-sm text-center leading-tight">Marks Calculator</span>
          </Button>
        </div>
      </div>

      {/* Mark Attendance Dialog */}
      {showAttendanceDialog && (
        <MarkAttendanceDialog
          open={showAttendanceDialog}
          onClose={() => setShowAttendanceDialog(false)}
        />
      )}

      {/* Recent Activity Modal */}
      <Dialog open={showRecentActivityDialog} onOpenChange={setShowRecentActivityDialog}>
        <DialogContent className="bg-card border border-border text-foreground max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-[var(--brand-start)] flex items-center gap-2">
              <History className="w-5 h-5 text-[var(--brand-start)]" />
              Recent Activity History
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2 max-h-96 overflow-y-auto pr-1">
            {recentActivities.length > 0 ? (
              recentActivities.map((activity, i) => (
                <div key={i} className="flex items-start space-x-3 p-3 rounded-xl bg-muted/40 border border-border/50">
                  <div className={`w-2.5 h-2.5 mt-1.5 rounded-full ${activity.color}`}></div>
                  <div className="flex-1">
                    <p className="font-semibold text-foreground text-sm">{activity.text}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{activity.time}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-muted-foreground text-sm">
                <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No recent activities recorded.</p>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <Button
              variant="outline"
              onClick={() => setShowRecentActivityDialog(false)}
              className="border-border text-foreground"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Congrats Popup */}
      <Dialog open={showCongrats} onOpenChange={setShowCongrats}>
        <DialogContent className="bg-card border border-border text-center p-12 max-w-lg">
          <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", duration: 0.8 }}>
            <div className="w-24 h-24 rounded-full bg-gradient-to-r from-[var(--brand-start)] to-[var(--brand-end)] mx-auto mb-6 flex items-center justify-center shadow-[0_0_50px_rgba(var(--brand-start-rgb), 0.5)]">
              <CheckCircle className="w-12 h-12 text-white" />
            </div>
            <DialogHeader>
              <DialogTitle className="text-4xl font-bold text-[var(--brand-start)] mb-4">
                Congratulations!
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-xl leading-relaxed">
                Welcome to your command center. Your profile, subjects, and timetable have been successfully synchronized.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-8">
              <Button 
                onClick={() => setShowCongrats(false)}
                className="w-full h-14 text-lg font-semibold bg-[var(--brand-start)] hover:bg-amber-600 text-white shadow-[0_0_20px_rgba(var(--brand-start-rgb), 0.3)] transition-all hover:scale-105"
              >
                Let&apos;s Get Started
              </Button>
            </div>
          </motion.div>
        </DialogContent>
      </Dialog>

      {/* Target CGPA Dialog */}
      <Dialog open={showTargetDialog} onOpenChange={setShowTargetDialog}>
        <DialogContent className="bg-card border border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-[var(--brand-start)]">
              Set Target CGPA
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="target-dashboard" className="text-muted-foreground font-semibold">
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
                className="bg-background border-border focus:border-[var(--brand-start)] text-foreground"
                placeholder="9.0"
              />
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowTargetDialog(false)}
                className="border-border hover:bg-muted text-foreground"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveTarget}
                className="bg-[var(--brand-start)] hover:bg-amber-600 text-white"
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
