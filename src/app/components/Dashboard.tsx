import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Bell, Calendar, TrendingUp, CheckCircle, LayoutGrid, PenLine, Target, AlertCircle, LogOut, History, AlertTriangle, X, ChevronRight, Quote, ArrowRight, Clock, ChevronDown, Bookmark } from "lucide-react";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Progress } from "./ui/progress";
import { motion } from "motion/react";
import { MarkAttendanceDialog } from "./MarkAttendanceDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import confetti from "canvas-confetti";
import { toast } from "sonner";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { computeCGPA, computeRequiredSGPA, computeAttendanceStats, PERIOD_TIMINGS_MAP } from "../../lib/academicUtils";

interface StudentProfile {
  fullName: string;
  currentSemester: string;
  [key: string]: string;
}

interface NotificationItem {
  id: string;
  type: "attendance" | "exam" | "my-space";
  title: string;
  message: string;
  link: string;
  level: "warning" | "urgent" | "info";
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
  const [attendanceDetails, setAttendanceDetails] = useState<{ totalAttended: number; totalConducted: number }>({
    totalAttended: 0,
    totalConducted: 0,
  });

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
  const [selectedOverviewSem, setSelectedOverviewSem] = useState<string>("current");
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
      setAttendanceDetails({
        totalAttended: attResult.totalAttended,
        totalConducted: attResult.totalConducted,
      });

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

      // C) "My Space" Scheduled Topics Alert (Topics scheduled for today)
      const mySpaceRaw = localStorage.getItem("my_space_topics");
      if (mySpaceRaw) {
        try {
          const mySpaceList: any[] = JSON.parse(mySpaceRaw);
          const now = new Date();
          const year = now.getFullYear();
          const month = String(now.getMonth() + 1).padStart(2, "0");
          const day = String(now.getDate()).padStart(2, "0");
          const todayFormatted = `${year}-${month}-${day}`;

          mySpaceList.forEach((topic) => {
            if (topic.targetDate === todayFormatted && topic.status !== "completed") {
              const timeStr = topic.targetTime ? ` at ${topic.targetTime}` : "";
              notifList.push({
                id: `myspace-${topic.id}`,
                type: "my-space",
                title: `Topic Reminder — ${topic.subject}`,
                message: `${topic.unit}: Cover topic "${topic.title}" today${timeStr}.`,
                link: "/app/study-material",
                level: "info"
              });
            }
          });
        } catch (e) {
          console.error("Failed to calculate my_space notifications", e);
        }
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

  const getTodaySchedule = () => {
    const timetableStr = localStorage.getItem("timetable");
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const todayName = dayNames[currentTime.getDay()];
    const isWeekend = todayName === "Saturday" || todayName === "Sunday";

    if (isWeekend) {
      return { isWeekend: true, isNoClasses: false, slots: [], dayName: todayName };
    }

    if (!timetableStr) {
      // Default fallback schedule matching timetable timings when no timetable has been set up yet
      return {
        isWeekend: false,
        isNoClasses: false,
        dayName: todayName,
        slots: [
          { subject: "Data Structures", timing: "09:30 AM – 10:20 AM", status: "In Progress" },
          { subject: "Discrete Mathematics", timing: "10:20 AM – 11:10 AM", status: "Upcoming" },
          { subject: "Digital Electronics", timing: "11:10 AM – 12:00 PM", status: "Upcoming" },
          { subject: "Physics", timing: "12:00 PM – 12:50 PM", status: "Upcoming" },
          { subject: "Environmental Science", timing: "01:40 PM – 02:30 PM", status: "Upcoming" },
        ],
      };
    }

    const timetable: { day: string; subject: string; period: number }[] = JSON.parse(timetableStr);

    const currentMin = currentTime.getHours() * 60 + currentTime.getMinutes();

    const slots = timetable
      .filter((t) => t.day === todayName)
      .sort((a, b) => a.period - b.period)
      .map((t) => {
        const timingInfo = PERIOD_TIMINGS_MAP[t.period] || {
          display: `Period ${t.period}`,
          startMin: (8 + t.period) * 60,
          endMin: (9 + t.period) * 60,
        };

        let status = "Upcoming";
        if (currentMin >= timingInfo.startMin && currentMin < timingInfo.endMin) {
          status = "In Progress";
        } else if (currentMin >= timingInfo.endMin) {
          status = "Completed";
        }

        return {
          subject: t.subject,
          timing: timingInfo.display,
          period: t.period,
          status,
        };
      });

    if (slots.length === 0) {
      return { isWeekend: false, isNoClasses: true, slots: [], dayName: todayName };
    }

    return { isWeekend: false, isNoClasses: false, slots, dayName: todayName };
  };

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

  const scheduleData = getTodaySchedule();

  // Performance Overview calculations per selected option
  const savedMarks = JSON.parse(localStorage.getItem("semester_marks") || "[]");
  const currentSemNum = parseInt(profile?.currentSemester || "1", 10);

  // Generate Overview Semester Selector options
  const overviewSemOptions = [
    { value: "1", label: "1st Semester" },
    { value: "2", label: "2nd Semester" },
  ];
  for (let s = 3; s < currentSemNum; s++) {
    const suffix = s === 3 ? "rd" : "th";
    overviewSemOptions.push({ value: s.toString(), label: `${s}${suffix} Semester` });
  }
  overviewSemOptions.push({ value: "current", label: `This Semester (Sem ${currentSemNum})` });
  overviewSemOptions.push({ value: "overall", label: "Overall" });

  let overviewAttDisplay = "-";
  let overviewAttPercentNum = 0;
  let overviewClassesHeld = "-";
  let overviewClassesAttended = "-";
  let overviewGpaLabel = "CGPA";
  let overviewGpaDisplay = "-";
  let overviewTargetCgpaDisplay = "-";

  if (selectedOverviewSem === "overall") {
    overviewGpaLabel = "CGPA";
    overviewGpaDisplay = stats.cgpa > 0 ? stats.cgpa.toFixed(2) : "-";
    overviewTargetCgpaDisplay = stats.targetCgpa > 0 ? stats.targetCgpa.toFixed(2) : "-";

    if (attendanceDetails.totalConducted > 0) {
      overviewAttPercentNum = stats.attendance;
      overviewAttDisplay = `${stats.attendance.toFixed(1)}%`;
      overviewClassesHeld = `${attendanceDetails.totalConducted}`;
      overviewClassesAttended = `${attendanceDetails.totalAttended}`;
    }
  } else if (selectedOverviewSem === "current") {
    overviewGpaLabel = "SGPA";
    const currentSemMark = savedMarks.find((m: any) => m.semester === currentSemNum);
    if (currentSemMark && currentSemMark.sgpa && currentSemMark.sgpa !== -1 && currentSemMark.sgpa > 0) {
      overviewGpaDisplay = currentSemMark.sgpa.toFixed(2);
    } else {
      overviewGpaDisplay = "-";
    }

    overviewTargetCgpaDisplay = stats.targetCgpa > 0 ? stats.targetCgpa.toFixed(2) : "-";

    if (attendanceDetails.totalConducted > 0) {
      overviewAttPercentNum = stats.attendance;
      overviewAttDisplay = `${stats.attendance.toFixed(1)}%`;
      overviewClassesHeld = `${attendanceDetails.totalConducted}`;
      overviewClassesAttended = `${attendanceDetails.totalAttended}`;
    }
  } else {
    // Specific past semester option (e.g. "1" or "2")
    const semNum = parseInt(selectedOverviewSem, 10);
    overviewGpaLabel = "SGPA";

    const semMark = savedMarks.find((m: any) => m.semester === semNum);
    if (semMark && semMark.sgpa && semMark.sgpa !== -1 && semMark.sgpa > 0) {
      overviewGpaDisplay = semMark.sgpa.toFixed(2);
    } else {
      overviewGpaDisplay = "-";
    }

    // Records for past sem attendance & target CGPA not found -> "-"
    overviewAttDisplay = "-";
    overviewAttPercentNum = 0;
    overviewClassesHeld = "-";
    overviewClassesAttended = "-";
    overviewTargetCgpaDisplay = "-";
  }

  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (circumference * Math.min(100, Math.max(0, overviewAttPercentNum))) / 100;

  return (
    <div className="p-4 md:p-8 space-y-8">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">
            {getGreeting()}, {profile?.fullName?.split(" ")[0] || "Mayank"}
          </h1>
          <p className="text-muted-foreground text-sm font-medium">
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
                              : n.type === "my-space"
                              ? "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-300"
                              : "bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-300"
                          }`}
                        >
                          <div className="mt-0.5 flex-shrink-0">
                            {n.type === "attendance" ? (
                              <AlertTriangle className="w-4 h-4 text-red-500" />
                            ) : n.type === "my-space" ? (
                              <Bookmark className="w-4 h-4 text-amber-500" />
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
                  {profile?.fullName?.charAt(0) || "M"}
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
                        {profile?.fullName?.charAt(0) || "M"}
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

      {/* 1. PHOTO 1 DESIGN: Welcome Hero Banner */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-3xl bg-[#0a0a0f] border border-white/10 shadow-2xl p-6 sm:p-10 text-white min-h-[300px] flex flex-col justify-between group"
      >
        {/* Background Image with Gradient Mask */}
        <div
          className="absolute inset-0 bg-cover bg-right-bottom opacity-50 group-hover:scale-105 transition-transform duration-700 pointer-events-none"
          style={{ backgroundImage: "url('/campus_banner.png')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0f] via-[#0a0a0f]/90 to-transparent pointer-events-none" />

        {/* Hero Content */}
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div className="max-w-xl space-y-4">
            <div className="inline-flex items-center gap-2">
              <span className="text-xs sm:text-sm font-extrabold tracking-wider uppercase text-amber-400 bg-amber-400/10 px-3 py-1 rounded-full border border-amber-400/20 shadow-sm">
                WELCOME BACK, {profile?.fullName?.split(" ")[0]?.toUpperCase() || "MAYANK"}! 👋
              </span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.1]">
              Your Campus. <br />
              <span className="bg-gradient-to-r from-amber-400 via-amber-500 to-orange-400 bg-clip-text text-transparent">
                Your Journey.
              </span>
            </h1>

            <p className="text-slate-300 text-sm sm:text-base md:text-lg max-w-md font-medium leading-relaxed">
              Stay organized, stay ahead and make every semester your best one yet.
            </p>

            <div className="pt-2">
              <Button
                onClick={() => navigate("/app/academics")}
                className="h-12 px-6 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-bold text-base rounded-xl shadow-[0_0_25px_rgba(245,158,11,0.4)] transition-all hover:scale-105 flex items-center gap-2"
              >
                <span>Explore Campus Hub</span>
                <ArrowRight className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Quote Card (Bottom Right Overlay matching Photo 1) */}
          <div className="lg:self-end">
            <div className="bg-[#15151f]/85 backdrop-blur-xl border border-white/10 p-5 rounded-2xl max-w-xs space-y-2 shadow-2xl relative">
              <Quote className="w-6 h-6 text-amber-400 fill-amber-400/20" />
              <p className="text-white font-semibold text-sm sm:text-base leading-snug">
                Discipline today,<br />Success tomorrow.
              </p>
              <p className="text-amber-400 text-xs font-bold flex items-center gap-1">
                Keep going! ✨
              </p>
            </div>
          </div>
        </div>
      </motion.div>

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

      {/* 2. PHOTO 2 DESIGN: Quick Actions & Today's Schedule Side-by-Side */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left: Quick Actions */}
        <div className="lg:col-span-6 space-y-4 flex flex-col justify-between">
          <h2 className="text-2xl font-bold text-foreground">Quick Actions</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 flex-1">
            <Button
              onClick={() => setShowAttendanceDialog(true)}
              className="h-28 bg-gradient-to-br from-[var(--brand-start)]/10 to-[var(--brand-start)]/10 dark:from-[var(--brand-start)]/20 dark:to-[var(--brand-start)]/20 border border-[var(--brand-start)]/30 hover:border-[var(--brand-start)] hover:bg-[var(--brand-start)]/30 text-gray-900 dark:text-white flex flex-col items-center justify-center gap-2 rounded-2xl transition-all hover:shadow-[0_0_20px_rgba(var(--brand-start-rgb),0.3)] group"
            >
              <div className="p-2 rounded-xl bg-[var(--brand-start)]/20 group-hover:scale-110 transition-transform">
                <CheckCircle className="w-6 h-6 text-[var(--brand-start)]" />
              </div>
              <span className="text-xs sm:text-sm font-bold">Mark Attendance</span>
            </Button>

            <Button
              onClick={() => navigate("/app/exam-calendar")}
              className="h-28 bg-gradient-to-br from-[var(--brand-start)]/10 to-amber-500/10 border border-[var(--brand-start)]/25 hover:border-[var(--brand-start)]/60 hover:bg-[var(--brand-start)]/20 text-foreground flex flex-col items-center justify-center gap-2 rounded-2xl transition-all group"
            >
              <div className="p-2 rounded-xl bg-amber-500/20 group-hover:scale-110 transition-transform">
                <Calendar className="w-6 h-6 text-amber-500" />
              </div>
              <span className="text-xs sm:text-sm font-bold">Exam Calendar</span>
            </Button>

            <Button
              onClick={() => navigate("/app/enter-marks")}
              className="h-28 bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/25 hover:border-purple-500/60 hover:bg-purple-500/20 text-foreground flex flex-col items-center justify-center gap-2 rounded-2xl transition-all group"
            >
              <div className="p-2 rounded-xl bg-purple-500/20 group-hover:scale-110 transition-transform">
                <PenLine className="w-6 h-6 text-purple-400" />
              </div>
              <span className="text-xs sm:text-sm font-bold">Enter Marks</span>
            </Button>

            <Button
              onClick={() => navigate("/app/timetable")}
              className="h-28 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/25 hover:border-emerald-500/60 hover:bg-emerald-500/20 text-foreground flex flex-col items-center justify-center gap-2 rounded-2xl transition-all group"
            >
              <div className="p-2 rounded-xl bg-emerald-500/20 group-hover:scale-110 transition-transform">
                <LayoutGrid className="w-6 h-6 text-emerald-400" />
              </div>
              <span className="text-xs sm:text-sm font-bold">Timetable</span>
            </Button>

            <Button
              onClick={() => navigate("/app/target-predictor")}
              className="h-28 bg-gradient-to-br from-indigo-500/10 to-blue-500/10 border border-indigo-500/25 hover:border-indigo-500/60 hover:bg-indigo-500/20 text-foreground flex flex-col items-center justify-center gap-2 rounded-2xl transition-all group"
            >
              <div className="p-2 rounded-xl bg-indigo-500/20 group-hover:scale-110 transition-transform">
                <TrendingUp className="w-6 h-6 text-indigo-400" />
              </div>
              <span className="text-xs sm:text-sm font-bold">Target Predictor</span>
            </Button>

            <Button
              onClick={() => navigate("/app/marks-calculator")}
              className="h-28 bg-gradient-to-br from-rose-500/10 to-orange-500/10 border border-rose-500/25 hover:border-rose-500/60 hover:bg-rose-500/20 text-foreground flex flex-col items-center justify-center gap-2 rounded-2xl transition-all group"
            >
              <div className="p-2 rounded-xl bg-rose-500/20 group-hover:scale-110 transition-transform">
                <Target className="w-6 h-6 text-rose-400" />
              </div>
              <span className="text-xs sm:text-sm font-bold text-center leading-tight">Marks Calculator</span>
            </Button>
          </div>
        </div>

        {/* Right: Today's Schedule (Matching Photo 2) */}
        <div className="lg:col-span-6">
          <div className="bg-[#121217] border border-white/10 rounded-3xl p-6 text-white shadow-2xl space-y-4 h-full flex flex-col justify-between min-h-[340px]">
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30">
                  <Calendar className="w-5 h-5 text-amber-400" />
                </div>
                <h2 className="text-xl font-bold text-white tracking-tight">Today&apos;s Schedule</h2>
              </div>
              <Button
                variant="outline"
                onClick={() => navigate("/app/timetable")}
                className="border-amber-500/40 text-amber-400 hover:bg-amber-500/10 rounded-full px-4 py-1.5 text-xs font-bold transition-all"
              >
                View Timetable
              </Button>
            </div>

            {scheduleData.isWeekend ? (
              <div className="py-8 px-6 text-center bg-[#181822] rounded-2xl border border-white/5 space-y-3 my-auto">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-3xl shadow-[0_0_20px_rgba(245,158,11,0.2)]">
                  🌴
                </div>
                <h3 className="text-lg font-black text-white">Weekend Holiday</h3>
                <p className="text-amber-400/90 text-xs font-bold uppercase tracking-wider">
                  {scheduleData.dayName}
                </p>
                <p className="text-gray-400 text-xs sm:text-sm max-w-xs mx-auto leading-relaxed">
                  No classes scheduled for today! Take time to rest, relax, and recharge for the week ahead.
                </p>
              </div>
            ) : scheduleData.isNoClasses ? (
              <div className="py-8 px-6 text-center bg-[#181822] rounded-2xl border border-white/5 space-y-3 my-auto">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-3xl">
                  ✨
                </div>
                <h3 className="text-lg font-bold text-white">No Classes Today</h3>
                <p className="text-gray-400 text-xs sm:text-sm max-w-xs mx-auto">
                  You have a free day today with no classes scheduled on your timetable.
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1 flex-1">
                {scheduleData.slots.map((slot, idx) => (
                  <div
                    key={idx}
                    className="bg-[#181822] hover:bg-[#1f1f2c] border border-white/5 rounded-2xl p-4 flex items-center justify-between transition-all relative overflow-hidden group shadow-sm"
                  >
                    {/* Amber vertical accent line matching Photo 2 */}
                    <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-amber-500 rounded-l-2xl" />

                    <div className="pl-3">
                      <h4 className="font-bold text-white text-base group-hover:text-amber-400 transition-colors">
                        {slot.subject}
                      </h4>
                      <p className="text-gray-400 text-xs mt-1 font-medium flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-amber-500/70" />
                        {slot.timing}
                      </p>
                    </div>

                    <div>
                      <span
                        className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all ${
                          slot.status === "In Progress"
                            ? "bg-amber-500/20 text-amber-400 border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.25)] animate-pulse"
                            : slot.status === "Completed"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                            : "bg-white/5 text-gray-400 border-white/10"
                        }`}
                      >
                        {slot.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. PHOTO 3 DESIGN: Performance Overview Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <Card className="bg-[#121217] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl text-white space-y-6">
          {/* Section Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30">
                <TrendingUp className="w-5 h-5 text-amber-400" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Performance Overview
              </h2>
            </div>

            {/* Semester Dropdown Selector */}
            <div className="relative">
              <select
                value={selectedOverviewSem}
                onChange={(e) => setSelectedOverviewSem(e.target.value)}
                className="appearance-none bg-[#1c1c26] border border-white/10 hover:border-amber-500/40 text-amber-400 font-bold text-xs sm:text-sm py-2 pl-4 pr-9 rounded-xl focus:outline-none cursor-pointer transition-all"
              >
                {overviewSemOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-amber-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Upper Section: Attendance Donut Ring + SGPA/CGPA Block */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center">
            {/* Attendance Circular Donut Ring Gauge */}
            <div className="bg-[#181822] border border-white/5 rounded-2xl p-6 flex flex-col items-center justify-center min-h-[160px] relative overflow-hidden">
              <div className="relative flex items-center justify-center">
                <svg className="w-36 h-36 transform -rotate-90" viewBox="0 0 110 110">
                  <defs>
                    <linearGradient id="attRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#f59e0b" />
                      <stop offset="50%" stopColor="#eab308" />
                      <stop offset="100%" stopColor="#10b981" />
                    </linearGradient>
                  </defs>
                  <circle cx="55" cy="55" r={radius} stroke="#22222e" strokeWidth="10" fill="transparent" />
                  <circle
                    cx="55"
                    cy="55"
                    r={radius}
                    stroke="url(#attRingGrad)"
                    strokeWidth="10"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    fill="transparent"
                    className="transition-all duration-1000 ease-out"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                    {overviewAttDisplay}
                  </span>
                  <span className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                    Attendance
                  </span>
                </div>
              </div>
            </div>

            {/* SGPA / CGPA Display Box */}
            <div className="bg-[#181822] border border-white/5 rounded-2xl p-6 flex flex-col items-center justify-center min-h-[160px] text-center">
              <span className="text-4xl sm:text-5xl font-black text-white tracking-tight">
                {overviewGpaDisplay}
              </span>
              <span className="text-xs sm:text-sm font-bold text-gray-400 uppercase tracking-wider mt-2">
                {overviewGpaLabel}
              </span>
            </div>
          </div>

          {/* Lower Section: 3 Metrics Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-[#181822] border border-white/5 rounded-2xl p-5 text-center">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                Classes Held
              </p>
              <p className="text-2xl sm:text-3xl font-black text-white mt-2">
                {overviewClassesHeld}
              </p>
            </div>

            <div className="bg-[#181822] border border-white/5 rounded-2xl p-5 text-center">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                Classes Attended
              </p>
              <p className="text-2xl sm:text-3xl font-black text-emerald-400 mt-2">
                {overviewClassesAttended}
              </p>
            </div>

            <div className="bg-[#181822] border border-white/5 rounded-2xl p-5 text-center cursor-pointer hover:border-amber-500/30 transition-all" onClick={() => { setNewTarget(stats.targetCgpa.toString()); setShowTargetDialog(true); }}>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                Target CGPA
              </p>
              <p className="text-2xl sm:text-3xl font-black text-amber-400 mt-2">
                {overviewTargetCgpaDisplay}
              </p>
            </div>
          </div>
        </Card>
      </motion.div>

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
