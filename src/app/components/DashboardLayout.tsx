import { Outlet, useNavigate, useLocation } from "react-router";
import { ThemeToggle } from "./ThemeToggle";
import {
  Home,
  BookOpen,
  Calendar,
  User,
  BarChart3,
  Sparkles,
  LogOut,
  LayoutGrid,
  Menu,
  X,
  FolderOpen,
  ShieldCheck
} from "lucide-react";
import { Button } from "./ui/button";
import { useState, useEffect } from "react";

export function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Auto-collapse sidebar on smaller screens initially
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };
    handleResize(); // run on mount
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const menuItems = [
    { icon: Home, label: "Dashboard", path: "/app" },
    { icon: BookOpen, label: "Academics", path: "/app/academics" },
    { icon: Calendar, label: "Exams", path: "/app/exams" },
    { icon: LayoutGrid, label: "Timetable", path: "/app/timetable" },
    { icon: BarChart3, label: "Analytics", path: "/app/analytics" },
    { icon: FolderOpen, label: "Study Material", path: "/app/study-material" },
    { icon: User, label: "Profile", path: "/app/profile" },
    { icon: ShieldCheck, label: "Admin Panel", path: "/app/admin" },
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

  return (
    <div className="min-h-screen bg-background text-foreground relative flex flex-col">
      
      {/* Mobile/Tablet Backdrop overlay */}
      {isSidebarOpen && (
        <div 
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300"
        />
      )}

      {/* Top Navbar Header */}
      <header className="sticky top-0 bg-background/80 backdrop-blur-md border-b border-border p-4 flex items-center justify-between z-30 lg:px-8">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"
          >
            <Menu className="w-6 h-6" />
          </Button>
          <div className="flex items-center space-x-2">
            <img src="/logo.png" alt="Campus Hub Logo" className="w-8 h-8 object-contain rounded-lg border border-gray-800/10 shadow-sm bg-white p-0.5" />
            <span className="text-lg font-bold bg-gradient-to-r from-brand-start to-brand-end bg-clip-text text-transparent">
              Campus Hub
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <ThemeToggle />
        </div>
      </header>
 
      <div className="flex flex-1 relative">
        {/* Sidebar Drawer */}
        <aside 
          className={`fixed lg:top-[65px] top-0 bottom-0 left-0 z-50 lg:z-20 w-64 border-r border-border bg-card/95 lg:bg-card/85 backdrop-blur-xl flex flex-col transition-transform duration-300 ease-in-out ${
            isSidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          {/* Header ONLY visible inside drawer on Mobile/Tablet */}
          <div className="p-6 border-b border-border flex items-center justify-between lg:hidden bg-background/50">
            <div className="flex items-center space-x-2">
              <img src="/logo.png" alt="Campus Hub Logo" className="w-8 h-8 object-contain rounded-lg border border-gray-800/10 shadow-sm bg-white p-0.5" />
              <span className="text-lg font-bold bg-gradient-to-r from-brand-start to-brand-end bg-clip-text text-transparent">
                Campus Hub
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsSidebarOpen(false)}
              className="text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <button
                  key={item.path}
                  onClick={() => {
                    navigate(item.path);
                    // Close drawer on mobile upon navigating
                    if (window.innerWidth < 1024) {
                      setIsSidebarOpen(false);
                    }
                  }}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all ${
                    active
                      ? "bg-gradient-to-r from-brand-start/10 to-brand-end/10 dark:from-brand-start/20 dark:to-brand-end/20 text-brand-start border border-brand-start/20 shadow-[0_4px_12px_rgba(var(--brand-start-rgb),0.15)]"
                      : "text-slate-800 dark:text-gray-400 hover:text-slate-950 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-gray-800/50"
                  }`}
                >
                  <Icon className={`w-5 h-5 transition-colors ${active ? "text-brand-start" : "text-slate-700 dark:text-gray-400 group-hover:text-slate-950 dark:group-hover:text-white"}`} />
                  <span className="font-semibold tracking-tight text-sm">{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Logout */}
          <div className="p-4 border-t border-border bg-background/20">
            <Button
              onClick={handleLogout}
              variant="ghost"
              className="w-full justify-start text-slate-500 dark:text-gray-400 hover:text-red-400 hover:bg-red-500/10 font-semibold"
            >
              <LogOut className="w-5 h-5 mr-3" />
              Logout
            </Button>
          </div>
        </aside>

        {/* Main Content Area */}
        <main 
          className={`flex-1 overflow-x-hidden min-w-0 transition-all duration-300 ease-in-out ${
            isSidebarOpen ? "lg:pl-64" : "lg:pl-0"
          }`}
        >
          {/* Background Effects */}
          <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
            <div className="absolute top-40 right-40 w-96 h-96 bg-brand-start rounded-full mix-blend-multiply dark:mix-blend-multiply filter blur-[128px] opacity-10 dark:opacity-10 animate-blob"></div>
            <div className="absolute bottom-40 left-40 w-96 h-96 bg-brand-end rounded-full mix-blend-multiply dark:mix-blend-multiply filter blur-[128px] opacity-10 dark:opacity-10 animate-blob animation-delay-2000"></div>
          </div>

          <div className="relative z-10 w-full min-h-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
