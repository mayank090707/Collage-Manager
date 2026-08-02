import { useState, useEffect } from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";
import { motion } from "motion/react";
import {
  Users,
  ShieldCheck,
  Activity,
  Database,
  Edit,
  Trash2,
  UserPlus,
  Search,
  Key,
  Mail,
  CheckCircle2,
  Server,
  RefreshCw,
  Award,
  Clock,
  BookOpen,
  Calendar,
  FileText,
  Lock,
  ArrowLeft,
  Sparkles,
  Laptop,
  GraduationCap,
  Layers,
  ChevronRight,
  Eye,
  EyeOff
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router";
import { getActivities, clearActivities, logActivity, ActivityLog } from "../../lib/activityTracker";
import { api } from "../../lib/api";

interface UserAccount {
  id: string;
  fullName: string;
  email: string;
  passwordHash: string;
  enrollmentNumber: string;
  collegeName: string;
  branch: string;
  admissionYear: number;
  graduationYear: number;
  lastLogin: string;
  status: "active" | "offline" | "blocked";
}

export function AdminDashboard() {
  const navigate = useNavigate();

  // Guard Check: Verify if user is Admin
  const userRole = localStorage.getItem("user_role");
  const userId = localStorage.getItem("college_manager_user_id");
  const isAdmin = userRole === "admin" || userId === "usr-admin";

  const [users, setUsers] = useState<UserAccount[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [activePartition, setActivePartition] = useState<"telemetry" | "users" | "explorer">("telemetry");
  
  // Telemetry Filter States
  const [telemetrySearch, setTelemetrySearch] = useState("");
  const [telemetryCategory, setTelemetryCategory] = useState<string>("ALL");

  // User Manager States
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserAccount | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});

  // Edit Form State
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editName, setEditName] = useState("");
  const [editStatus, setEditStatus] = useState<"active" | "offline" | "blocked">("active");

  // Add Form State
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newEnrollment, setNewEnrollment] = useState("");

  // Explorer Partition States (Dynamic data from database)
  const [explorerTopic, setExplorerTopic] = useState<"profile" | "marks" | "attendance" | "timetable">("profile");
  const [showRawJson, setShowRawJson] = useState(false);

  // Dynamic Database Stores State
  const [profileData, setProfileData] = useState<any>({});
  const [marksData, setMarksData] = useState<any[]>([]);
  const [attendanceData, setAttendanceData] = useState<any[]>([]);
  const [timetableData, setTimetableData] = useState<any[]>([]);

  useEffect(() => {
    if (isAdmin) {
      loadRealDatabaseData();
    }
  }, [isAdmin]);

  const loadRealDatabaseData = async () => {
    let loadedUsers: UserAccount[] = [];

    // 1. Try fetching live users from API
    try {
      const apiUsers = await api.getAdminUsers();
      if (Array.isArray(apiUsers) && apiUsers.length > 0) {
        loadedUsers = apiUsers;
      }
    } catch (e) {
      console.warn("API admin users fetch failed, reading local storage.");
    }

    // 2. Read local fallback if API returns empty
    if (loadedUsers.length === 0) {
      const storedUsersStr = localStorage.getItem("system_users");
      if (storedUsersStr) {
        try { loadedUsers = JSON.parse(storedUsersStr); } catch (e) {}
      }
    }

    // Read active student profile from localStorage
    const currentProfile = JSON.parse(localStorage.getItem("student_profile") || "{}");

    if (loadedUsers.length === 0) {
      loadedUsers = [
        {
          id: "usr-admin",
          fullName: "System Admin",
          email: "admin@campus-hub.com",
          passwordHash: "AdminPassword123",
          enrollmentNumber: "0000000000",
          collegeName: "GGSIPU Main Campus",
          branch: "Administration",
          admissionYear: 2023,
          graduationYear: 2027,
          lastLogin: new Date().toLocaleString(),
          status: "active",
        },
        {
          id: "user_mayanksharma",
          fullName: "Mayank Sharma",
          email: "mayanksharma@gmail.com",
          passwordHash: "Student @123",
          enrollmentNumber: "02920802725",
          collegeName: "Bhagwan Parshuram Institute of Technology (BPIT)",
          branch: "CSE - Computer Science & Engineering",
          admissionYear: 2025,
          graduationYear: 2029,
          lastLogin: "Active Now",
          status: "active",
        },
        {
          id: "usr-student-1",
          fullName: currentProfile.fullName || "Mayank Verma",
          email: currentProfile.email || "demo@gmail.com",
          passwordHash: "Student123!",
          enrollmentNumber: currentProfile.enrollmentNumber || "02820802725",
          collegeName: currentProfile.collegeName || "Bhagwan Parshuram Institute of Technology (BPIT)",
          branch: currentProfile.branch || "CSE - Computer Science & Engineering",
          admissionYear: parseInt(currentProfile.admissionYear) || 2025,
          graduationYear: parseInt(currentProfile.graduationYear) || 2029,
          lastLogin: "Active Now",
          status: "active",
        },
      ];
    }

    setUsers(loadedUsers);
    localStorage.setItem("system_users", JSON.stringify(loadedUsers));

    // 3. Read real Telemetry Logs from activityTracker
    const loadedActivities = getActivities();
    setActivities(loadedActivities);

    // 4. Read dynamic student database tables
    try {
      setProfileData(currentProfile);
      setMarksData(JSON.parse(localStorage.getItem("semester_marks") || "[]"));
      setAttendanceData(JSON.parse(localStorage.getItem("attendance_records") || "[]"));
      setTimetableData(JSON.parse(localStorage.getItem("timetable") || "[]"));
    } catch (e) {
      console.error("Database reading error:", e);
    }
  };

  const handleClearActivities = () => {
    if (confirm("Are you sure you want to clear all telemetry logs from the database?")) {
      clearActivities();
      setActivities([]);
      toast.success("Telemetry logs cleared!");
    }
  };

  const togglePasswordReveal = (id: string) => {
    setRevealedPasswords(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleEditClick = (user: UserAccount) => {
    setSelectedUser(user);
    setEditName(user.fullName);
    setEditEmail(user.email);
    setEditPassword(user.passwordHash);
    setEditStatus(user.status || "active");
    setShowEditDialog(true);
  };

  const handleSaveUser = async () => {
    if (!selectedUser) return;
    if (!editEmail.trim() || !editPassword.trim()) {
      toast.error("Email and password cannot be empty");
      return;
    }

    const updated = users.map((u) =>
      u.id === selectedUser.id
        ? { ...u, fullName: editName, email: editEmail, passwordHash: editPassword, status: editStatus }
        : u
    );

    setUsers(updated);
    localStorage.setItem("system_users", JSON.stringify(updated));

    try {
      await api.updateAdminUser({
        id: selectedUser.id,
        fullName: editName,
        email: editEmail,
        passwordHash: editPassword,
        status: editStatus
      });
    } catch (err) {
      console.error("API update error:", err);
    }

    if (selectedUser.id !== "usr-admin") {
      const profile = JSON.parse(localStorage.getItem("student_profile") || "{}");
      profile.fullName = editName;
      profile.email = editEmail;
      localStorage.setItem("student_profile", JSON.stringify(profile));
    }

    logActivity(
      "ACCOUNT_UPDATED",
      `Admin updated login credentials for account ${editEmail}.`,
      "System",
      "admin@campus-hub.com",
      "System Admin",
      "info"
    );

    setShowEditDialog(false);
    toast.success(`Credentials updated for ${editEmail}`);
    loadRealDatabaseData();
  };

  const handleDeleteUser = async (id: string, name: string) => {
    if (id === "usr-admin") {
      toast.error("Cannot delete root admin account!");
      return;
    }

    if (confirm(`Are you sure you want to delete user account "${name}"?`)) {
      const updated = users.filter((u) => u.id !== id);
      setUsers(updated);
      localStorage.setItem("system_users", JSON.stringify(updated));

      try {
        await api.deleteAdminUser(id);
      } catch (err) {
        console.error("API delete user error:", err);
      }

      logActivity(
        "ACCOUNT_DELETED",
        `Admin deleted user account "${name}" (${id}).`,
        "System",
        "admin@campus-hub.com",
        "System Admin",
        "warning"
      );

      toast.success(`User ${name} removed`);
      loadRealDatabaseData();
    }
  };

  const handleAddUser = async () => {
    if (!newEmail.trim() || !newPassword.trim() || !newName.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      await api.createAdminUser({
        fullName: newName,
        email: newEmail,
        password: newPassword,
        enrollmentNumber: newEnrollment
      });
    } catch (err: any) {
      console.error("API create user error:", err);
    }

    const newUser: UserAccount = {
      id: "usr-" + Date.now(),
      fullName: newName,
      email: newEmail,
      passwordHash: newPassword,
      enrollmentNumber: newEnrollment || "00" + Math.floor(10000000 + Math.random() * 90000000),
      collegeName: "GGSIPU Affiliate",
      branch: "CSE",
      admissionYear: 2025,
      graduationYear: 2029,
      lastLogin: "Created just now",
      status: "active",
    };

    const updated = [...users, newUser];
    setUsers(updated);
    localStorage.setItem("system_users", JSON.stringify(updated));

    logActivity(
      "ACCOUNT_CREATED",
      `Admin created new user account for ${newName} (${newEmail}).`,
      "System",
      "admin@campus-hub.com",
      "System Admin",
      "success"
    );

    setShowAddDialog(false);
    setNewName("");
    setNewEmail("");
    setNewPassword("");
    setNewEnrollment("");
    toast.success(`Account "${newEmail}" created successfully!`);
    loadRealDatabaseData();
  };

  // Guard UI for Non-Admin Users
  if (!isAdmin) {
    return (
      <div className="p-6 md:p-12 max-w-2xl mx-auto text-center space-y-6 mt-12">
        <Card className="p-8 border-2 border-red-500/30 bg-card shadow-xl rounded-2xl relative overflow-hidden">
          <div className="w-16 h-16 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto mb-4 border border-red-500/20">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-foreground mb-2">Access Restricted: Admin Privileges Required</h2>
          <p className="text-muted-foreground text-sm max-w-md mx-auto mb-6">
            The Admin Telemetry Control Hub is restricted. Please sign in with your master administrator credentials.
          </p>
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-semibold max-w-md mx-auto mb-6 text-left space-y-1">
            <div className="font-bold flex items-center gap-1.5 mb-1">
              <ShieldCheck className="w-4 h-4" /> Dedicated Admin Credentials:
            </div>
            <div><strong>Email:</strong> admin@campus-hub.com</div>
            <div><strong>Password:</strong> AdminPassword123</div>
          </div>
          <Button
            onClick={() => navigate("/app")}
            className="bg-[var(--brand-start)] text-white hover:bg-amber-600 font-bold px-6 py-2.5 rounded-xl shadow-md"
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  // Filter Telemetry Activities
  const filteredActivities = activities.filter((act) => {
    const matchesSearch =
      act.description.toLowerCase().includes(telemetrySearch.toLowerCase()) ||
      act.userName.toLowerCase().includes(telemetrySearch.toLowerCase()) ||
      act.userEmail.toLowerCase().includes(telemetrySearch.toLowerCase()) ||
      act.actionType.toLowerCase().includes(telemetrySearch.toLowerCase());

    const matchesCategory =
      telemetryCategory === "ALL" || act.category.toUpperCase() === telemetryCategory.toUpperCase();

    return matchesSearch && matchesCategory;
  });

  const getCategoryBadge = (category: string) => {
    switch (category.toLowerCase()) {
      case "login":
        return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1"><Key className="w-3 h-3" /> LOGIN</span>;
      case "marks":
        return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 flex items-center gap-1"><Award className="w-3 h-3" /> MARKS</span>;
      case "attendance":
        return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> ATTENDANCE</span>;
      case "studymaterial":
        return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1"><BookOpen className="w-3 h-3" /> MATERIAL</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-500/15 text-slate-600 dark:text-slate-400 border border-slate-500/30 flex items-center gap-1"><Activity className="w-3 h-3" /> SYSTEM</span>;
    }
  };

  // Compute storage size
  const storageKb = (JSON.stringify(localStorage).length / 1024).toFixed(1);

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
      
      {/* HEADER SECTION & MASTER CREDENTIALS BANNER */}
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap pb-4 border-b border-border">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-3xl md:text-4xl font-black text-foreground">Admin Telemetry Hub</h1>
              <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/40 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                SUPER ADMIN ACTIVE
              </span>
            </div>
            <p className="text-muted-foreground text-sm font-medium">
              Enterprise control panel for live user audit logging, credential management, and database telemetry
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={loadRealDatabaseData}
              variant="outline"
              className="border-border text-foreground hover:bg-muted font-bold"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Sync Database
            </Button>
            <Button
              onClick={() => setShowAddDialog(true)}
              className="bg-[var(--brand-start)] text-white hover:bg-amber-600 font-bold shadow-md"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Add User Account
            </Button>
          </div>
        </div>

        {/* Master Admin Identity Info Badge */}
        <Card className="bg-card border-2 border-[var(--brand-start)]/60 p-4 shadow-sm rounded-xl">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-[var(--brand-start)]/15 text-[var(--brand-start)]">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-foreground text-sm">Authenticated Master Admin</h3>
                <p className="text-xs text-muted-foreground font-medium">
                  Logged in with dedicated super admin identity
                </p>
              </div>
            </div>
            <div className="flex items-center gap-5 text-xs font-mono bg-muted/60 px-4 py-2 rounded-lg border border-border">
              <div>
                <span className="text-muted-foreground text-[10px] block font-sans font-semibold">Master Admin Email</span>
                <strong className="text-foreground">admin@campus-hub.com</strong>
              </div>
              <div className="h-6 w-px bg-border"></div>
              <div>
                <span className="text-muted-foreground text-[10px] block font-sans font-semibold">Master Admin Password</span>
                <strong className="text-[var(--brand-start)]">AdminPassword123</strong>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* PARTITION 1: EXECUTIVE KPI METRICS PANEL */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card border border-border p-5 shadow-xs rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Telemetry Logs</span>
            <Activity className="w-5 h-5 text-[var(--brand-start)]" />
          </div>
          <p className="text-3xl font-black text-foreground">{activities.length}</p>
          <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Real-time stream active
          </p>
        </Card>

        <Card className="bg-card border border-border p-5 shadow-xs rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">System Users</span>
            <Users className="w-5 h-5 text-emerald-500" />
          </div>
          <p className="text-3xl font-black text-foreground">{users.length}</p>
          <p className="text-xs text-muted-foreground font-semibold">Registered user profiles</p>
        </Card>

        <Card className="bg-card border border-border p-5 shadow-xs rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Academic Marks</span>
            <Award className="w-5 h-5 text-blue-500" />
          </div>
          <p className="text-3xl font-black text-foreground">{marksData.length}</p>
          <p className="text-xs text-muted-foreground font-semibold">Semesters in database</p>
        </Card>

        <Card className="bg-card border border-border p-5 shadow-xs rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Database Storage</span>
            <Database className="w-5 h-5 text-amber-500" />
          </div>
          <p className="text-3xl font-black text-foreground">{storageKb} KB</p>
          <p className="text-xs text-muted-foreground font-semibold">Active LocalStorage size</p>
        </Card>
      </div>

      {/* PARTITION 2: TOP-LEVEL CONTROL PARTITION TABS */}
      <div className="flex items-center gap-2 border-b border-border pb-2 overflow-x-auto whitespace-nowrap scrollbar-none">
        <button
          onClick={() => setActivePartition("telemetry")}
          className={`px-5 py-3 rounded-xl font-bold text-sm transition-all flex items-center gap-2 border ${
            activePartition === "telemetry"
              ? "bg-[var(--brand-start)] text-white border-[var(--brand-start)] shadow-md"
              : "bg-card text-muted-foreground border-border hover:text-foreground hover:bg-muted/50"
          }`}
        >
          <Activity className="w-4 h-4" />
          Partition A: Activity Telemetry ({activities.length})
        </button>

        <button
          onClick={() => setActivePartition("users")}
          className={`px-5 py-3 rounded-xl font-bold text-sm transition-all flex items-center gap-2 border ${
            activePartition === "users"
              ? "bg-[var(--brand-start)] text-white border-[var(--brand-start)] shadow-md"
              : "bg-card text-muted-foreground border-border hover:text-foreground hover:bg-muted/50"
          }`}
        >
          <Users className="w-4 h-4" />
          Partition B: User Credential Manager ({users.length})
        </button>

        <button
          onClick={() => setActivePartition("explorer")}
          className={`px-5 py-3 rounded-xl font-bold text-sm transition-all flex items-center gap-2 border ${
            activePartition === "explorer"
              ? "bg-[var(--brand-start)] text-white border-[var(--brand-start)] shadow-md"
              : "bg-card text-muted-foreground border-border hover:text-foreground hover:bg-muted/50"
          }`}
        >
          <Layers className="w-4 h-4" />
          Partition C: Live Database Inspector
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════
         PARTITION A: REAL-TIME AUDIT TELEMETRY STREAM
      ══════════════════════════════════════════════════════════ */}
      {activePartition === "telemetry" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4 flex-wrap bg-card p-4 rounded-2xl border border-border shadow-xs">
            <div>
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <Activity className="w-5 h-5 text-[var(--brand-start)]" />
                Live User Activity Audit Stream
              </h2>
              <p className="text-xs text-muted-foreground font-medium">
                Tracks user behavior, logins, marks submissions, and attendance in real time
              </p>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {/* Category Filter Pills */}
              <div className="flex items-center gap-1 bg-muted p-1 rounded-xl border border-border text-xs font-bold">
                {["ALL", "LOGIN", "MARKS", "ATTENDANCE", "STUDYMATERIAL", "SYSTEM"].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setTelemetryCategory(cat)}
                    className={`px-3 py-1.5 rounded-lg transition-all capitalize ${
                      telemetryCategory === cat
                        ? "bg-card text-[var(--brand-start)] shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {cat === "STUDYMATERIAL" ? "Material" : cat}
                  </button>
                ))}
              </div>

              {/* Search Bar */}
              <div className="relative w-full sm:w-60">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={telemetrySearch}
                  onChange={(e) => setTelemetrySearch(e.target.value)}
                  placeholder="Filter logs..."
                  className="pl-9 bg-background border-border text-xs h-9"
                />
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleClearActivities}
                className="border-border text-red-500 hover:text-red-600 hover:bg-red-500/10 text-xs font-bold"
              >
                Clear Stream
              </Button>
            </div>
          </div>

          {/* Activity Cards List */}
          <div className="space-y-3">
            {filteredActivities.length === 0 ? (
              <Card className="p-8 text-center border border-border text-muted-foreground text-xs font-medium">
                No activity logs match the current search filters.
              </Card>
            ) : (
              filteredActivities.map((act) => (
                <div
                  key={act.id}
                  className="bg-card border border-border p-4 rounded-xl shadow-xs hover:border-[var(--brand-start)]/50 transition-all flex items-start gap-4"
                >
                  <div className="pt-0.5">{getCategoryBadge(act.category)}</div>

                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground text-sm">{act.userName}</span>
                        <span className="text-xs font-mono text-muted-foreground">({act.userEmail})</span>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                        <Clock className="w-3.5 h-3.5 text-amber-500" />
                        <span>{act.timestamp}</span>
                      </div>
                    </div>

                    <p className="text-xs text-foreground font-medium leading-relaxed bg-muted/40 p-2.5 rounded-lg border border-border/60">
                      {act.description}
                    </p>

                    <div className="flex items-center gap-3 pt-1 text-[11px] text-muted-foreground font-mono">
                      <span className="bg-muted px-2 py-0.5 rounded border border-border text-foreground font-bold">
                        ACTION: {act.actionType}
                      </span>
                      {act.deviceInfo && (
                        <span className="flex items-center gap-1">
                          <Laptop className="w-3 h-3 text-sky-500" /> {act.deviceInfo}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
         PARTITION B: USER & CREDENTIAL MANAGER TABLE
      ══════════════════════════════════════════════════════════ */}
      {activePartition === "users" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-xl font-bold text-foreground">System Users & Credential Ledger</h2>
              <p className="text-xs text-muted-foreground font-medium">
                Manage accounts, update emails/passwords, or create new student login profiles
              </p>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={userSearchTerm}
                onChange={(e) => setUserSearchTerm(e.target.value)}
                placeholder="Search user or email..."
                className="pl-9 bg-background border-border text-foreground text-xs"
              />
            </div>
          </div>

          <Card className="bg-card border border-border overflow-hidden shadow-xs rounded-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/60 text-muted-foreground text-xs uppercase font-bold border-b border-border">
                  <tr>
                    <th className="p-4">User & Role</th>
                    <th className="p-4">Login Email</th>
                    <th className="p-4">Password Credentials</th>
                    <th className="p-4">College Campus & Branch</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {users
                    .filter(
                      (u) =>
                        u.fullName.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
                        u.email.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
                        u.enrollmentNumber.includes(userSearchTerm)
                    )
                    .map((user) => (
                      <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                        <td className="p-4">
                          <div className="font-bold text-foreground flex items-center gap-2">
                            {user.fullName}
                            {user.id === "usr-admin" && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                                MASTER ADMIN
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground font-mono">Enr: {user.enrollmentNumber}</div>
                        </td>
                        <td className="p-4 font-mono text-xs text-foreground font-semibold">
                          <div className="flex items-center gap-1.5">
                            <Mail className="w-3.5 h-3.5 text-[var(--brand-start)]" />
                            {user.email}
                          </div>
                        </td>
                        <td className="p-4 font-mono text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-amber-600 dark:text-amber-400">
                              {revealedPasswords[user.id] ? user.passwordHash : "••••••••••••"}
                            </span>
                            <button
                              onClick={() => togglePasswordReveal(user.id)}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              {revealedPasswords[user.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </td>
                        <td className="p-4 text-xs text-muted-foreground">
                          <span className="font-semibold text-foreground">{user.collegeName}</span> ({user.branch})
                        </td>
                        <td className="p-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                              user.status === "active"
                                ? "bg-emerald-500/20 text-emerald-600 border border-emerald-500/30"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            ● {user.status}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEditClick(user)}
                              className="border-border text-foreground hover:bg-muted text-xs font-bold"
                            >
                              <Edit className="w-3.5 h-3.5 mr-1" />
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteUser(user.id, user.fullName)}
                              className="text-red-500 hover:text-red-600 hover:bg-red-500/10 text-xs font-bold"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
         PARTITION C: LIVE DATABASE INSPECTOR (PARTITIONED TOPIC VIEW)
      ══════════════════════════════════════════════════════════ */}
      {activePartition === "explorer" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-4 bg-card p-4 rounded-2xl border border-border shadow-xs">
            <div>
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <Database className="w-5 h-5 text-[var(--brand-start)]" />
                Live Student Database Topic Inspector
              </h2>
              <p className="text-xs text-muted-foreground font-medium">
                Structured, partitioned view of real dynamic data loaded directly from browser storage
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Partitioned Topic Selector */}
              <div className="flex gap-1 bg-muted p-1 rounded-xl border border-border text-xs font-bold">
                {[
                  { id: "profile", label: "1. Student Profile" },
                  { id: "marks", label: "2. Marks & SGPA" },
                  { id: "attendance", label: "3. Attendance" },
                  { id: "timetable", label: "4. Timetable" },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setExplorerTopic(t.id as any)}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      explorerTopic === t.id
                        ? "bg-card text-[var(--brand-start)] shadow-xs font-bold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRawJson(!showRawJson)}
                className="border-border text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                {showRawJson ? "Hide Raw Code" : "View Raw JSON Code"}
              </Button>
            </div>
          </div>

          {/* TOPIC 1: PROFILE INFORMATION */}
          {explorerTopic === "profile" && (
            <Card className="p-6 bg-card border border-border shadow-xs rounded-xl space-y-6">
              <div className="flex items-center gap-4 pb-4 border-b border-border">
                <div className="w-12 h-12 rounded-xl bg-[var(--brand-start)]/15 text-[var(--brand-start)] border border-[var(--brand-start)]/30 flex items-center justify-center font-black text-lg">
                  {(profileData.fullName || "M")[0]}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">{profileData.fullName || "Student Profile"}</h3>
                  <p className="text-xs text-muted-foreground font-mono">{profileData.email || "demo@gmail.com"}</p>
                </div>
                <span className="ml-auto px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-600 border border-emerald-500/30">
                  Active Student Record
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                <div className="p-3 bg-muted/40 rounded-lg border border-border">
                  <span className="text-muted-foreground block font-semibold">Enrollment Number</span>
                  <strong className="text-foreground text-sm font-mono">{profileData.enrollmentNumber || "02820802725"}</strong>
                </div>
                <div className="p-3 bg-muted/40 rounded-lg border border-border">
                  <span className="text-muted-foreground block font-semibold">College Campus</span>
                  <strong className="text-foreground text-sm">{profileData.collegeName || "Bhagwan Parshuram Institute of Technology"}</strong>
                </div>
                <div className="p-3 bg-muted/40 rounded-lg border border-border">
                  <span className="text-muted-foreground block font-semibold">Branch</span>
                  <strong className="text-foreground text-sm">{profileData.branch || "Computer Science & Engineering"}</strong>
                </div>
                <div className="p-3 bg-muted/40 rounded-lg border border-border">
                  <span className="text-muted-foreground block font-semibold">Current Semester</span>
                  <strong className="text-foreground text-sm">Semester {profileData.currentSemester || 1}</strong>
                </div>
                <div className="p-3 bg-muted/40 rounded-lg border border-border">
                  <span className="text-muted-foreground block font-semibold">Admission / Graduation</span>
                  <strong className="text-foreground text-sm">{profileData.admissionYear || 2025} - {profileData.graduationYear || 2029}</strong>
                </div>
                <div className="p-3 bg-muted/40 rounded-lg border border-border">
                  <span className="text-muted-foreground block font-semibold">Date of Birth</span>
                  <strong className="text-foreground text-sm">{profileData.dob || "2005-07-09"}</strong>
                </div>
              </div>
            </Card>
          )}

          {/* TOPIC 2: ACADEMIC MARKS & SGPA */}
          {explorerTopic === "marks" && (
            <Card className="p-6 bg-card border border-border shadow-xs rounded-xl space-y-4">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Award className="w-5 h-5 text-blue-500" />
                Semester Marks & Academic Standing Ledger
              </h3>

              {marksData.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  No semester marks logged in database yet. Student can enter marks from Academics section.
                </div>
              ) : (
                <div className="space-y-6">
                  {marksData.map((semData: any) => (
                    <div key={semData.semester} className="border border-border rounded-xl p-4 space-y-3 bg-muted/20">
                      <div className="flex items-center justify-between border-b border-border pb-2">
                        <div className="font-bold text-sm text-foreground">
                          Semester {semData.semester} Results
                        </div>
                        <div className="text-xs font-bold text-[var(--brand-start)] bg-[var(--brand-start)]/10 px-2.5 py-1 rounded-lg border border-[var(--brand-start)]/30">
                          SGPA: {semData.sgpa > 0 ? semData.sgpa.toFixed(2) : "Pending"}
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="text-muted-foreground font-bold uppercase bg-muted/50 border-b border-border">
                            <tr>
                              <th className="p-2.5">Subject</th>
                              <th className="p-2.5 text-center">Credits</th>
                              <th className="p-2.5 text-center">Internal (/40)</th>
                              <th className="p-2.5 text-center">External (/60)</th>
                              <th className="p-2.5 text-center">Total (/100)</th>
                              <th className="p-2.5 text-center">Grade</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/60">
                            {(semData.results || semData.subjects || []).map((res: any, idx: number) => (
                              <tr key={idx}>
                                <td className="p-2.5 font-semibold text-foreground">{res.subjectName || res.name}</td>
                                <td className="p-2.5 text-center font-mono">{res.credits}</td>
                                <td className="p-2.5 text-center font-mono">{res.internal ?? res.internalMarks}</td>
                                <td className="p-2.5 text-center font-mono">{res.external ?? res.externalMarks}</td>
                                <td className="p-2.5 text-center font-mono font-bold text-foreground">
                                  {res.total ?? (res.internal + res.external)}
                                </td>
                                <td className="p-2.5 text-center">
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-600 border border-emerald-500/30">
                                    {res.grade || "A"}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {/* TOPIC 3: ATTENDANCE RECORDS */}
          {explorerTopic === "attendance" && (
            <Card className="p-6 bg-card border border-border shadow-xs rounded-xl space-y-4">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-purple-500" />
                Real Attendance Database Logs
              </h3>

              {attendanceData.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  No attendance records saved in local database yet.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {attendanceData.map((rec: any, idx: number) => (
                    <div key={idx} className="p-4 bg-muted/30 rounded-xl border border-border space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-foreground">
                        <span>Date: {rec.date}</span>
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-600 text-[10px]">
                          {rec.subjects?.length || 0} Attended
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground font-mono bg-background p-2 rounded border border-border">
                        {rec.subjects && rec.subjects.length > 0
                          ? rec.subjects.join(", ")
                          : "No classes attended"}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {/* TOPIC 4: WEEKLY TIMETABLE SCHEDULE */}
          {explorerTopic === "timetable" && (
            <Card className="p-6 bg-card border border-border shadow-xs rounded-xl space-y-4">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Calendar className="w-5 h-5 text-amber-500" />
                Saved Class Timetable Slots
              </h3>

              {timetableData.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  No timetable schedule configured in database.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {timetableData.map((t: any, idx: number) => (
                    <div key={idx} className="p-3.5 bg-muted/40 rounded-xl border border-border space-y-1">
                      <div className="flex items-center justify-between text-xs font-bold text-[var(--brand-start)]">
                        <span>{t.day}</span>
                        <span>P{t.period}</span>
                      </div>
                      <div className="font-bold text-sm text-foreground">{t.subject}</div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {/* Developer Code View */}
          {showRawJson && (
            <Card className="p-4 bg-zinc-950 border border-zinc-800 text-zinc-100 font-mono text-xs overflow-x-auto rounded-xl space-y-2">
              <div className="text-amber-400 font-bold">Raw JSON State ({explorerTopic}):</div>
              <pre className="whitespace-pre-wrap leading-relaxed">
                {explorerTopic === "profile" && JSON.stringify(profileData, null, 2)}
                {explorerTopic === "marks" && JSON.stringify(marksData, null, 2)}
                {explorerTopic === "attendance" && JSON.stringify(attendanceData, null, 2)}
                {explorerTopic === "timetable" && JSON.stringify(timetableData, null, 2)}
              </pre>
            </Card>
          )}
        </div>
      )}

      {/* EDIT USER CREDENTIALS MODAL */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="bg-card border border-border text-foreground max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <Edit className="w-4 h-4 text-[var(--brand-start)]" />
              Edit Account Credentials
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Full Name</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="bg-background border-border text-foreground text-sm font-semibold"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Login Email</Label>
              <Input
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                className="bg-background border-border text-foreground text-sm font-mono font-semibold"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Password Credentials</Label>
              <Input
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                className="bg-background border-border text-foreground text-sm font-mono font-semibold"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Account Status</Label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as any)}
                className="w-full bg-background border border-border text-foreground text-sm rounded-lg p-2 font-semibold"
              >
                <option value="active">Active</option>
                <option value="offline">Offline</option>
                <option value="blocked">Blocked</option>
              </select>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowEditDialog(false)} className="border-border text-foreground font-bold text-xs">
              Cancel
            </Button>
            <Button onClick={handleSaveUser} className="bg-[var(--brand-start)] text-white hover:bg-amber-600 font-bold text-xs">
              Save Credentials
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ADD USER MODAL */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="bg-card border border-border text-foreground max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-[var(--brand-start)]" />
              Create New User Profile
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Full Name</Label>
              <Input
                placeholder="Full Name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="bg-background border-border text-foreground text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Login Email</Label>
              <Input
                type="email"
                placeholder="student@ipu.ac.in"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="bg-background border-border text-foreground text-sm font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Password Credentials</Label>
              <Input
                type="password"
                placeholder="Password123"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="bg-background border-border text-foreground text-sm font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Enrollment Number</Label>
              <Input
                placeholder="02820802725"
                value={newEnrollment}
                onChange={(e) => setNewEnrollment(e.target.value)}
                className="bg-background border-border text-foreground text-sm"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)} className="border-border text-foreground font-bold text-xs">
              Cancel
            </Button>
            <Button onClick={handleAddUser} className="bg-[var(--brand-start)] text-white hover:bg-amber-600 font-bold text-xs">
              Create Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
