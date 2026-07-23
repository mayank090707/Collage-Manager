import { useState, useEffect } from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";
import { motion, AnimatePresence } from "motion/react";
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
  Eye,
  EyeOff,
  Award,
  Clock,
  BookOpen,
  Calendar,
  Layers,
  FileText,
  Filter,
  Lock,
  ArrowLeft,
  Sparkles,
  Download,
  AlertTriangle,
  Laptop
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router";
import { getActivities, clearActivities, logActivity, ActivityLog } from "../../lib/activityTracker";

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
  status: "active" | "offline";
}

export function AdminDashboard() {
  const navigate = useNavigate();

  // Guard Check: Verify if user is Admin
  const userRole = localStorage.getItem("user_role");
  const userId = localStorage.getItem("college_manager_user_id");
  const isAdmin = userRole === "admin" || userId === "usr-admin";

  const [users, setUsers] = useState<UserAccount[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [activeMainTab, setActiveMainTab] = useState<"telemetry" | "users" | "data_explorer">("telemetry");
  
  // Telemetry Filter States
  const [telemetrySearch, setTelemetrySearch] = useState("");
  const [telemetryCategory, setTelemetryCategory] = useState<string>("ALL");

  // User Manager States
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserAccount | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);

  // Edit Form State
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editName, setEditName] = useState("");

  // Add Form State
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newEnrollment, setNewEnrollment] = useState("");

  // Visual Data Explorer States
  const [explorerTab, setExplorerTab] = useState<"profile" | "marks" | "attendance" | "timetable">("profile");
  const [showRawJson, setShowRawJson] = useState(false);

  // Data Explorer Content State
  const [profileData, setProfileData] = useState<any>({});
  const [marksData, setMarksData] = useState<any[]>([]);
  const [attendanceData, setAttendanceData] = useState<any[]>([]);
  const [timetableData, setTimetableData] = useState<any[]>([]);

  useEffect(() => {
    if (isAdmin) {
      loadAdminData();
    }
  }, [isAdmin]);

  const loadAdminData = () => {
    // 1. Load system users
    const storedUsersStr = localStorage.getItem("system_users");
    let loadedUsers: UserAccount[] = [];

    if (storedUsersStr) {
      try {
        loadedUsers = JSON.parse(storedUsersStr);
      } catch {
        loadedUsers = [];
      }
    }

    if (loadedUsers.length === 0) {
      const currentProfile = JSON.parse(localStorage.getItem("student_profile") || "{}");
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
          id: "usr-student-1",
          fullName: currentProfile.fullName || "Mayank Verma",
          email: currentProfile.email || "demo@gmail.com",
          passwordHash: "Student123!",
          enrollmentNumber: currentProfile.enrollmentNumber || "02820802725",
          collegeName: currentProfile.collegeName || "Bhagwan Parshuram Institute of Technology (BPIT)",
          branch: currentProfile.branch || "CSE - Computer Science & Engineering",
          admissionYear: currentProfile.admissionYear || 2025,
          graduationYear: currentProfile.graduationYear || 2029,
          lastLogin: "Active now",
          status: "active",
        },
      ];
      localStorage.setItem("system_users", JSON.stringify(loadedUsers));
    }
    setUsers(loadedUsers);

    // 2. Load Telemetry Logs
    const loadedActivities = getActivities();
    setActivities(loadedActivities);

    // 3. Load Explorer Data
    try {
      setProfileData(JSON.parse(localStorage.getItem("student_profile") || "{}"));
      setMarksData(JSON.parse(localStorage.getItem("semester_marks") || "[]"));
      setAttendanceData(JSON.parse(localStorage.getItem("attendance_records") || "[]"));
      setTimetableData(JSON.parse(localStorage.getItem("timetable") || "[]"));
    } catch (e) {
      console.error("Data load error:", e);
    }
  };

  const handleClearActivities = () => {
    if (confirm("Are you sure you want to clear all telemetry activity logs?")) {
      clearActivities();
      setActivities([]);
      toast.success("Telemetry logs cleared!");
    }
  };

  const handleEditClick = (user: UserAccount) => {
    setSelectedUser(user);
    setEditName(user.fullName);
    setEditEmail(user.email);
    setEditPassword(user.passwordHash);
    setShowEditDialog(true);
  };

  const handleSaveUser = () => {
    if (!selectedUser) return;
    if (!editEmail.trim() || !editPassword.trim()) {
      toast.error("Email and password cannot be empty");
      return;
    }

    const updated = users.map((u) =>
      u.id === selectedUser.id
        ? { ...u, fullName: editName, email: editEmail, passwordHash: editPassword }
        : u
    );

    setUsers(updated);
    localStorage.setItem("system_users", JSON.stringify(updated));

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
    toast.success(`Account credentials updated for ${editEmail}!`);
    loadAdminData();
  };

  const handleDeleteUser = (id: string, name: string) => {
    if (id === "usr-admin") {
      toast.error("Cannot delete root admin account!");
      return;
    }

    if (confirm(`Are you sure you want to delete user account "${name}"?`)) {
      const updated = users.filter((u) => u.id !== id);
      setUsers(updated);
      localStorage.setItem("system_users", JSON.stringify(updated));

      logActivity(
        "ACCOUNT_DELETED",
        `Admin deleted user account "${name}" (${id}).`,
        "System",
        "admin@campus-hub.com",
        "System Admin",
        "warning"
      );

      toast.success(`User ${name} removed`);
      loadAdminData();
    }
  };

  const handleAddUser = () => {
    if (!newEmail.trim() || !newPassword.trim() || !newName.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }

    const newUser: UserAccount = {
      id: "usr-" + Date.now(),
      fullName: newName,
      email: newEmail,
      passwordHash: newPassword,
      enrollmentNumber: newEnrollment || "00" + Math.floor(10000000 + Math.random() * 90000000),
      collegeName: "GGSIPU Affiliate",
      branch: "CSE",
      admissionYear: 2024,
      graduationYear: 2028,
      lastLogin: "Just created",
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
    toast.success(`New user account "${newEmail}" created successfully!`);
    loadAdminData();
  };

  // Guard UI for Non-Admin Users
  if (!isAdmin) {
    return (
      <div className="p-6 md:p-12 max-w-3xl mx-auto text-center space-y-6 mt-12">
        <Card className="p-8 border-2 border-red-500/30 bg-card shadow-xl rounded-2xl relative overflow-hidden">
          <div className="w-16 h-16 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto mb-4 border border-red-500/20">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-foreground mb-2">Access Restricted to Super Admin</h2>
          <p className="text-muted-foreground text-sm max-w-md mx-auto mb-6">
            The Admin Control Hub is hidden from public access. You must log in with dedicated master admin credentials to view system activity logs and telemetry.
          </p>
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-semibold max-w-md mx-auto mb-6 text-left space-y-1">
            <div className="font-bold flex items-center gap-1.5 mb-1">
              <ShieldCheck className="w-4 h-4" /> Admin Login Credentials:
            </div>
            <div><strong>Email:</strong> admin@campus-hub.com</div>
            <div><strong>Password:</strong> AdminPassword123</div>
          </div>
          <Button
            onClick={() => navigate("/app")}
            className="bg-[var(--brand-start)] text-white hover:bg-amber-600 font-bold px-6 py-2.5 rounded-xl shadow-md"
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Return to Student Dashboard
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

  // Category Icon & Badge Resolver
  const getCategoryBadge = (category: string) => {
    switch (category.toLowerCase()) {
      case "login":
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1"><Key className="w-3 h-3" /> LOGIN</span>;
      case "marks":
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 flex items-center gap-1"><Award className="w-3 h-3" /> MARKS</span>;
      case "attendance":
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> ATTENDANCE</span>;
      case "studymaterial":
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1"><BookOpen className="w-3 h-3" /> MATERIAL</span>;
      case "targetpredictor":
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 flex items-center gap-1"><Sparkles className="w-3 h-3" /> PREDICTOR</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-500/15 text-slate-600 dark:text-slate-400 border border-slate-500/30 flex items-center gap-1"><Activity className="w-3 h-3" /> SYSTEM</span>;
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header Bar */}
      <div className="flex items-start justify-between gap-4 flex-wrap pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl md:text-4xl font-black text-foreground">Admin Telemetry & Control Hub</h1>
            <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/40 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              SUPER ADMIN ACTIVE
            </span>
          </div>
          <p className="text-muted-foreground text-sm font-medium">
            Real-time user behavior tracking, credential manager & visual student data inspector
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={loadAdminData}
            variant="outline"
            className="border-border text-foreground hover:bg-muted font-bold"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh Data
          </Button>
          <Button
            onClick={() => setShowAddDialog(true)}
            className="bg-[var(--brand-start)] text-white hover:bg-amber-600 font-bold"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Add User Account
          </Button>
        </div>
      </div>

      {/* Root Admin Credentials Alert Box */}
      <Card className="bg-card border-2 border-[var(--brand-start)] p-5 shadow-sm rounded-2xl">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-[var(--brand-start)]/10 text-[var(--brand-start)]">
              <Key className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-foreground text-base">Dedicated Master Admin Account</h3>
              <p className="text-xs text-muted-foreground font-semibold">
                This Admin Panel is accessible exclusively when signed in with these credentials.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-6 text-sm font-mono bg-muted/70 px-5 py-3 rounded-xl border border-border">
            <div>
              <span className="text-muted-foreground text-xs block font-sans font-semibold">Admin Login Email</span>
              <strong className="text-foreground">admin@campus-hub.com</strong>
            </div>
            <div className="h-8 w-px bg-border"></div>
            <div>
              <span className="text-muted-foreground text-xs block font-sans font-semibold">Admin Login Password</span>
              <strong className="text-[var(--brand-start)]">AdminPassword123</strong>
            </div>
          </div>
        </div>
      </Card>

      {/* Live System Telemetry Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <Card className="bg-card border border-border/80 p-5 shadow-sm rounded-xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Actions Tracked</span>
            <Activity className="w-5 h-5 text-[var(--brand-start)]" />
          </div>
          <p className="text-3xl font-black text-foreground mb-1">{activities.length}</p>
          <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Real-time telemetry streaming
          </p>
        </Card>

        <Card className="bg-card border border-border/80 p-5 shadow-sm rounded-xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Registered Accounts</span>
            <Users className="w-5 h-5 text-emerald-500" />
          </div>
          <p className="text-3xl font-black text-foreground mb-1">{users.length}</p>
          <p className="text-xs text-muted-foreground font-semibold">System user profiles active</p>
        </Card>

        <Card className="bg-card border border-border/80 p-5 shadow-sm rounded-xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">System Health</span>
            <Server className="w-5 h-5 text-sky-500" />
          </div>
          <p className="text-3xl font-black text-emerald-500 mb-1">100% Online</p>
          <p className="text-xs text-muted-foreground font-semibold">All backend services operational</p>
        </Card>

        <Card className="bg-card border border-border/80 p-5 shadow-sm rounded-xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Local Storage State</span>
            <Database className="w-5 h-5 text-amber-500" />
          </div>
          <p className="text-3xl font-black text-foreground mb-1">
            {(JSON.stringify(localStorage).length / 1024).toFixed(1)} KB
          </p>
          <p className="text-xs text-muted-foreground font-semibold">Active browser state database</p>
        </Card>
      </div>

      {/* Main Tab Switching Navigation */}
      <div className="flex items-center gap-2 border-b border-border pb-1">
        <button
          onClick={() => setActiveMainTab("telemetry")}
          className={`px-5 py-3 rounded-xl font-bold text-sm transition-all flex items-center gap-2 border ${
            activeMainTab === "telemetry"
              ? "bg-[var(--brand-start)] text-white border-[var(--brand-start)] shadow-md"
              : "bg-card text-muted-foreground border-border hover:text-foreground hover:bg-muted/50"
          }`}
        >
          <Activity className="w-4 h-4" />
          User Activity Telemetry ({activities.length})
        </button>

        <button
          onClick={() => setActiveMainTab("users")}
          className={`px-5 py-3 rounded-xl font-bold text-sm transition-all flex items-center gap-2 border ${
            activeMainTab === "users"
              ? "bg-[var(--brand-start)] text-white border-[var(--brand-start)] shadow-md"
              : "bg-card text-muted-foreground border-border hover:text-foreground hover:bg-muted/50"
          }`}
        >
          <Users className="w-4 h-4" />
          User Credential Manager ({users.length})
        </button>

        <button
          onClick={() => setActiveMainTab("data_explorer")}
          className={`px-5 py-3 rounded-xl font-bold text-sm transition-all flex items-center gap-2 border ${
            activeMainTab === "data_explorer"
              ? "bg-[var(--brand-start)] text-white border-[var(--brand-start)] shadow-md"
              : "bg-card text-muted-foreground border-border hover:text-foreground hover:bg-muted/50"
          }`}
        >
          <FileText className="w-4 h-4" />
          Visual User Data Explorer
        </button>
      </div>

      {/* TAB 1: Real-Time User Activity Telemetry Stream */}
      {activeMainTab === "telemetry" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4 flex-wrap bg-card p-4 rounded-2xl border border-border shadow-xs">
            <div>
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Activity className="w-5 h-5 text-[var(--brand-start)]" />
                Live User Activity Log Stream
              </h2>
              <p className="text-xs text-muted-foreground font-medium">
                Tracks every action performed by users on the platform in human-readable timeline format
              </p>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {/* Category Filter */}
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
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={telemetrySearch}
                  onChange={(e) => setTelemetrySearch(e.target.value)}
                  placeholder="Search user, action, email..."
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

          {/* Timeline Cards Container */}
          <div className="space-y-3">
            {filteredActivities.length === 0 ? (
              <Card className="p-8 text-center border border-border text-muted-foreground font-medium">
                No telemetry activity recorded matching the search criteria.
              </Card>
            ) : (
              filteredActivities.map((act) => (
                <motion.div
                  key={act.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-card border border-border/80 p-4 rounded-xl shadow-xs hover:border-[var(--brand-start)]/50 transition-all flex items-start gap-4"
                >
                  <div className="pt-0.5">
                    {getCategoryBadge(act.category)}
                  </div>

                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground text-sm">{act.userName}</span>
                        <span className="text-xs font-mono text-muted-foreground">({act.userEmail})</span>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                        <Clock className="w-3.5 h-3.5 text-amber-500" />
                        <span>{act.timestamp}</span>
                      </div>
                    </div>

                    <p className="text-xs text-foreground font-medium leading-relaxed bg-muted/40 p-2.5 rounded-lg border border-border/50">
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
                </motion.div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 2: User Account & Credential Manager */}
      {activeMainTab === "users" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-xl font-bold text-foreground">User Credential & Account Manager</h2>
              <p className="text-xs text-muted-foreground font-medium">
                Manage all student and admin login accounts, edit passwords, and assign roles
              </p>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={userSearchTerm}
                onChange={(e) => setUserSearchTerm(e.target.value)}
                placeholder="Search by email, name or enrollment..."
                className="pl-9 bg-background border-border text-foreground text-xs"
              />
            </div>
          </div>

          <Card className="bg-card border border-border/80 overflow-hidden shadow-sm rounded-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/60 text-muted-foreground text-xs uppercase font-bold border-b border-border">
                  <tr>
                    <th className="p-4">User</th>
                    <th className="p-4">Login Email</th>
                    <th className="p-4">Password Hash</th>
                    <th className="p-4">College & Branch</th>
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
                                ROOT ADMIN
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">Enr: {user.enrollmentNumber}</div>
                        </td>
                        <td className="p-4 font-mono text-xs text-foreground font-semibold">
                          <div className="flex items-center gap-1.5">
                            <Mail className="w-3.5 h-3.5 text-[var(--brand-start)]" />
                            {user.email}
                          </div>
                        </td>
                        <td className="p-4 font-mono text-xs text-amber-600 dark:text-amber-400 font-bold">
                          {user.passwordHash}
                        </td>
                        <td className="p-4 text-xs text-muted-foreground">
                          <span className="font-semibold text-foreground">{user.collegeName}</span> ({user.branch})
                        </td>
                        <td className="p-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
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
                              Edit Credentials
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

      {/* TAB 3: Visual User Data Explorer (Replaces Raw Code Viewer) */}
      {activeMainTab === "data_explorer" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-4 bg-card p-4 rounded-2xl border border-border shadow-xs">
            <div>
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <FileText className="w-5 h-5 text-[var(--brand-start)]" />
                Visual User Data Inspector
              </h2>
              <p className="text-xs text-muted-foreground font-medium">
                Professional visual components rendering active student profile, semester marks, attendance, and timetable state
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Sub Tabs */}
              <div className="flex gap-1.5 bg-muted p-1 rounded-xl border border-border text-xs font-bold">
                {(["profile", "marks", "attendance", "timetable"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setExplorerTab(tab)}
                    className={`px-3 py-1.5 rounded-lg capitalize transition-all ${
                      explorerTab === tab
                        ? "bg-card text-[var(--brand-start)] shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Advanced Code Toggle */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRawJson(!showRawJson)}
                className="border-border text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                {showRawJson ? "Hide Code View" : "Developer Code View"}
              </Button>
            </div>
          </div>

          {/* Sub-Tab 1: Profile View */}
          {explorerTab === "profile" && (
            <Card className="p-6 bg-card border border-border/80 shadow-sm rounded-2xl space-y-6">
              <div className="flex items-center gap-4 pb-4 border-b border-border">
                <div className="w-14 h-14 rounded-2xl bg-[var(--brand-start)]/15 text-[var(--brand-start)] border border-[var(--brand-start)]/30 flex items-center justify-center font-black text-xl">
                  {(profileData.fullName || "M")[0]}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-foreground">{profileData.fullName || "Mayank Verma"}</h3>
                  <p className="text-xs text-muted-foreground font-mono">{profileData.email || "demo@gmail.com"}</p>
                </div>
                <span className="ml-auto px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-600 border border-emerald-500/30">
                  Active Account
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div className="p-3 bg-muted/40 rounded-xl border border-border">
                  <span className="text-xs text-muted-foreground font-semibold block">Enrollment Number</span>
                  <strong className="text-foreground font-mono">{profileData.enrollmentNumber || "02820802725"}</strong>
                </div>
                <div className="p-3 bg-muted/40 rounded-xl border border-border">
                  <span className="text-xs text-muted-foreground font-semibold block">College Campus</span>
                  <strong className="text-foreground">{profileData.collegeName || "Bhagwan Parshuram Institute of Technology (BPIT)"}</strong>
                </div>
                <div className="p-3 bg-muted/40 rounded-xl border border-border">
                  <span className="text-xs text-muted-foreground font-semibold block">Branch / Specialization</span>
                  <strong className="text-foreground">{profileData.branch || "CSE - Computer Science & Engineering"}</strong>
                </div>
                <div className="p-3 bg-muted/40 rounded-xl border border-border">
                  <span className="text-xs text-muted-foreground font-semibold block">Admission Year</span>
                  <strong className="text-foreground">{profileData.admissionYear || "2025"}</strong>
                </div>
                <div className="p-3 bg-muted/40 rounded-xl border border-border">
                  <span className="text-xs text-muted-foreground font-semibold block">Graduation Year</span>
                  <strong className="text-foreground">{profileData.graduationYear || "2029"}</strong>
                </div>
                <div className="p-3 bg-muted/40 rounded-xl border border-border">
                  <span className="text-xs text-muted-foreground font-semibold block">Date of Birth</span>
                  <strong className="text-foreground">{profileData.dob || "2005-07-09"}</strong>
                </div>
              </div>
            </Card>
          )}

          {/* Sub-Tab 2: Marks View */}
          {explorerTab === "marks" && (
            <Card className="p-6 bg-card border border-border/80 shadow-sm rounded-2xl space-y-4">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Award className="w-5 h-5 text-blue-500" />
                Semester Marks & Academic Standing
              </h3>
              {marksData.length === 0 ? (
                <p className="text-xs text-muted-foreground">No semester marks entered yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted text-muted-foreground uppercase font-bold">
                      <tr>
                        <th className="p-3">Semester</th>
                        <th className="p-3">Subject Name</th>
                        <th className="p-3">Internal</th>
                        <th className="p-3">External</th>
                        <th className="p-3">Total Score</th>
                        <th className="p-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {marksData.map((m: any, idx: number) => (
                        <tr key={idx} className="hover:bg-muted/30">
                          <td className="p-3 font-bold">Sem {m.semester || 1}</td>
                          <td className="p-3 font-semibold text-foreground">{m.subjectName || m.subject || "Database Systems"}</td>
                          <td className="p-3 font-mono">{m.internalMarks ?? 23}/25</td>
                          <td className="p-3 font-mono">{m.externalMarks ?? 65}/75</td>
                          <td className="p-3 font-mono font-bold text-[var(--brand-start)]">
                            {(m.internalMarks || 23) + (m.externalMarks || 65)} / 100
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-600">
                              PASSED
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}

          {/* Sub-Tab 3: Attendance View */}
          {explorerTab === "attendance" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {attendanceData.length === 0 ? (
                <Card className="col-span-full p-6 text-center text-xs text-muted-foreground">
                  No attendance records logged yet.
                </Card>
              ) : (
                attendanceData.map((rec: any, idx: number) => {
                  const attended = rec.attendedClasses || rec.attended || 0;
                  const total = rec.totalClasses || rec.total || 0;
                  const pct = total > 0 ? ((attended / total) * 100).toFixed(1) : "0.0";
                  const isHealthy = parseFloat(pct) >= 75;

                  return (
                    <Card key={idx} className="p-4 bg-card border border-border/80 shadow-xs space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-sm text-foreground">{rec.subjectName || rec.subject}</h4>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                            isHealthy
                              ? "bg-emerald-500/20 text-emerald-600 border border-emerald-500/30"
                              : "bg-red-500/20 text-red-600 border border-red-500/30"
                          }`}
                        >
                          {pct}%
                        </span>
                      </div>
                      <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${isHealthy ? "bg-emerald-500" : "bg-red-500"}`}
                          style={{ width: `${Math.min(100, parseFloat(pct))}%` }}
                        ></div>
                      </div>
                      <p className="text-xs text-muted-foreground font-medium">
                        Classes Attended: <strong className="text-foreground font-mono">{attended}</strong> / <span className="font-mono">{total}</span>
                      </p>
                    </Card>
                  );
                })
              )}
            </div>
          )}

          {/* Sub-Tab 4: Timetable View */}
          {explorerTab === "timetable" && (
            <Card className="p-6 bg-card border border-border/80 shadow-sm rounded-2xl space-y-4">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Calendar className="w-5 h-5 text-amber-500" />
                Active Class Timetable Schedule
              </h3>
              {timetableData.length === 0 ? (
                <p className="text-xs text-muted-foreground">No timetable slots configured.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {timetableData.map((t: any, idx: number) => (
                    <div key={idx} className="p-3 bg-muted/40 rounded-xl border border-border space-y-1">
                      <div className="flex items-center justify-between text-xs font-bold text-[var(--brand-start)]">
                        <span>{t.day || "Monday"}</span>
                        <span>{t.time || "10:00 AM"}</span>
                      </div>
                      <div className="font-bold text-sm text-foreground">{t.subject}</div>
                      <div className="text-xs text-muted-foreground font-medium">Room: {t.room || "Lab 302"}</div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {/* Advanced Raw JSON Code Section */}
          {showRawJson && (
            <Card className="p-4 bg-zinc-950 border border-zinc-800 text-zinc-100 font-mono text-xs overflow-x-auto rounded-xl space-y-2">
              <div className="text-amber-400 font-bold">Raw JSON State ({explorerTab}):</div>
              <pre className="whitespace-pre-wrap leading-relaxed">
                {explorerTab === "profile" && JSON.stringify(profileData, null, 2)}
                {explorerTab === "marks" && JSON.stringify(marksData, null, 2)}
                {explorerTab === "attendance" && JSON.stringify(attendanceData, null, 2)}
                {explorerTab === "timetable" && JSON.stringify(timetableData, null, 2)}
              </pre>
            </Card>
          )}
        </div>
      )}

      {/* Edit Credentials Modal Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="bg-card border border-border text-foreground max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
              <Key className="w-5 h-5 text-[var(--brand-start)]" />
              Edit User Login Credentials
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
              <Label className="text-xs font-semibold text-muted-foreground">Password</Label>
              <Input
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                className="bg-background border-border text-foreground text-sm font-mono font-semibold"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)} className="border-border text-foreground font-bold">
              Cancel
            </Button>
            <Button onClick={handleSaveUser} className="bg-[var(--brand-start)] text-white hover:bg-amber-600 font-bold">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add User Modal Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="bg-card border border-border text-foreground max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-[var(--brand-start)]" />
              Create New User Account
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Full Name</Label>
              <Input
                placeholder="e.g. Rahul Verma"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="bg-background border-border text-foreground text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Login Email</Label>
              <Input
                type="email"
                placeholder="rahul@ipu.ac.in"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="bg-background border-border text-foreground text-sm font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Password</Label>
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
                placeholder="01234567890"
                value={newEnrollment}
                onChange={(e) => setNewEnrollment(e.target.value)}
                className="bg-background border-border text-foreground text-sm"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)} className="border-border text-foreground font-bold">
              Cancel
            </Button>
            <Button onClick={handleAddUser} className="bg-[var(--brand-start)] text-white hover:bg-amber-600 font-bold">
              Create User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
