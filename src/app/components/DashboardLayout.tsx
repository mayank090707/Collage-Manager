import { Outlet, useNavigate, useLocation } from "react-router";
import { ThemeToggle } from "./ThemeToggle";
import { Home, BookOpen, Calendar, User, BarChart3, Sparkles, LogOut, LayoutGrid } from "lucide-react";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { motion } from "motion/react";

export function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { icon: Home, label: "Dashboard", path: "/app" },
    { icon: BookOpen, label: "Academics", path: "/app/academics" },
    { icon: Calendar, label: "Exams", path: "/app/exams" },
    { icon: LayoutGrid, label: "Timetable", path: "/app/timetable" },
    { icon: BarChart3, label: "Analytics", path: "/app/analytics" },
    { icon: User, label: "Profile", path: "/app/profile" },
  ];

  const isActive = (path: string) => {
    if (path === "/app") {
      return location.pathname === "/app";
    }
    return location.pathname.startsWith(path);
  };

  const handleLogout = () => {
    localStorage.removeItem("college_manager_user_id");
    localStorage.removeItem("college_manager_remember");
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

  return (
    <div className="min-h-screen bg-background flex text-foreground">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-card/80 backdrop-blur-xl flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-border flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Sparkles className="w-8 h-8 text-[#00d4ff]" />
            <span className="text-xl font-bold bg-gradient-to-r from-[#00d4ff] to-[#a855f7] bg-clip-text text-transparent">
              College Manager
            </span>
          </div>
          <ThemeToggle />
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all ${
                  active
                    ? "bg-gradient-to-r from-[#00d4ff]/10 to-[#a855f7]/10 dark:from-[#00d4ff]/20 dark:to-[#a855f7]/20 text-[#00d4ff] dark:text-[#00d4ff] border border-[#00d4ff]/20 dark:border-transparent shadow-[0_4px_12px_rgba(0,212,255,0.1)]"
                    : "text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-gray-800/50"
                }`}
              >
                <Icon className={`w-5 h-5 transition-colors ${active ? "text-[#00d4ff]" : "text-slate-500 dark:text-gray-400 group-hover:text-slate-900 dark:group-hover:text-white"}`} />
                <span className="font-medium tracking-tight">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-border">
          <Button
            onClick={handleLogout}
            variant="ghost"
            className="w-full justify-start text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
          >
            <LogOut className="w-5 h-5 mr-3" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {/* Background Effects */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-40 right-40 w-96 h-96 bg-[#00d4ff] rounded-full mix-blend-multiply dark:mix-blend-multiply filter blur-[128px] opacity-10 dark:opacity-10 animate-blob"></div>
          <div className="absolute bottom-40 left-40 w-96 h-96 bg-[#a855f7] rounded-full mix-blend-multiply dark:mix-blend-multiply filter blur-[128px] opacity-10 dark:opacity-10 animate-blob animation-delay-2000"></div>
        </div>

        <div className="relative z-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
