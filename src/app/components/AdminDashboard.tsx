import { useState, useEffect } from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";
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
  XCircle,
  RefreshCw,
  Award,
  Clock,
  BookOpen,
  Lock,
  ArrowLeft,
  History,
  FileText,
  UserX,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router";
import { getActivities, clearActivities, logActivity, ActivityLog, detectDevice } from "../../lib/activityTracker";
import { api } from "../../lib/api";

interface UserAccount {
  id: string;
  fullName: string;
  email: string;
  enrollmentNumber: string;
  collegeName: string;
  branch: string;
  admissionYear: number;
  graduationYear: number;
  lastLogin: string;
  lastLoginDevice: string;
  status: "active" | "offline" | "blocked";
}

interface LoginActivityRecord {
  _id?: string;
  attemptedEmail: string;
  userId?: string;
  success: boolean;
  timestamp: string;
  browser: string;
  os: string;
  device: string;
  ipAddress?: string;
}

interface AdminAuditRecord {
  _id?: string;
  action: string;
  targetEmail?: string;
  adminEmail: string;
  timestamp: string;
  device: string;
  ipAddress?: string;
  details?: string;
}

export function AdminDashboard() {
  const navigate = useNavigate();

  // Guard Check: Verify if user is Admin
  const userRole = localStorage.getItem("user_role");
  const userId = localStorage.getItem("college_manager_user_id");
  const isAdmin = userRole === "admin" || userId === "usr-admin";

  const [users, setUsers] = useState<UserAccount[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [backendLoginLogs, setBackendLoginLogs] = useState<LoginActivityRecord[]>([]);
  const [adminAuditLogs, setAdminAuditLogs] = useState<AdminAuditRecord[]>([]);
  const [adminEmail, setAdminEmail] = useState<string>("admin@campus-hub.com");

  const [activePartition, setActivePartition] = useState<"telemetry" | "users" | "audit">("telemetry");
  const [realStats, setRealStats] = useState({ totalUsers: 0, activeUsers: 0, onboarded: 0 });

  // Telemetry Filter States
  const [telemetrySearch, setTelemetrySearch] = useState("");
  const [telemetryFilterStatus, setTelemetryFilterStatus] = useState<"ALL" | "SUCCESS" | "FAILED">("ALL");

  // User Manager States
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserAccount | null>(null);

  // Dialog States
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showResetPassDialog, setShowResetPassDialog] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showCredChangeDialog, setShowCredChangeDialog] = useState(false);
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserAccount | null>(null);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [userHistoryLogs, setUserHistoryLogs] = useState<LoginActivityRecord[]>([]);
  const [historyUser, setHistoryUser] = useState<UserAccount | null>(null);

  // Form States
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editStatus, setEditStatus] = useState<"active" | "offline" | "blocked">("active");

  const [resetPassNew, setResetPassNew] = useState("");
  const [resetPassConfirm, setResetPassConfirm] = useState("");

  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newEnrollment, setNewEnrollment] = useState("");

  const [credNewEmail, setCredNewEmail] = useState("");
  const [credNewPassword, setCredNewPassword] = useState("");
  const [credConfirmPassword, setCredConfirmPassword] = useState("");

  useEffect(() => {
    if (isAdmin) {
      loadRealDatabaseData();
    }
  }, [isAdmin]);

  const loadRealDatabaseData = async () => {
    // Fetch live users
    try {
      const apiUsers = await api.getAdminUsers();
      if (Array.isArray(apiUsers)) {
        setUsers(apiUsers);
      }
    } catch (e) {
      console.warn("API admin users fetch failed.", e);
    }

    // Fetch Admin Email
    try {
      const email = await api.getAdminEmail();
      if (email) setAdminEmail(email);
    } catch (e) {}

    // Fetch Stats
    try {
      const stats = await api.getAdminStats();
      setRealStats(stats);
    } catch (e) {}

    // Fetch Backend Login Activity Records
    try {
      const loginLogs = await api.getLoginActivity();
      if (Array.isArray(loginLogs)) {
        setBackendLoginLogs(loginLogs);
      }
    } catch (e) {}

    // Fetch Admin Audit Log Records
    try {
      const auditLogs = await api.getAdminAuditLog();
      if (Array.isArray(auditLogs)) {
        setAdminAuditLogs(auditLogs);
      }
    } catch (e) {}

    // Local telemetry logs
    setActivities(getActivities());
  };

  // Status Toggle (Activate / Deactivate)
  const handleToggleStatus = async (user: UserAccount) => {
    if (user.id === "usr-admin") {
      toast.error("Cannot deactivate Root Admin account");
      return;
    }
    const newStatus = user.status === "active" ? "blocked" : "active";
    try {
      await api.toggleUserStatus({ id: user.id, status: newStatus });
      toast.success(`Account for ${user.email} set to ${newStatus}`);
      loadRealDatabaseData();
    } catch (err: any) {
      toast.error(err.message || "Failed to change status");
    }
  };

  // Change Admin Credentials
  const handleChangeAdminCredentials = async () => {
    if (credNewPassword && credNewPassword !== credConfirmPassword) {
      toast.error("New passwords do not match!");
      return;
    }
    try {
      await api.changeAdminCredentials({
        newEmail: credNewEmail.trim() || undefined,
        newPassword: credNewPassword || undefined,
        confirmPassword: credConfirmPassword || undefined,
      });
      toast.success("Admin credentials updated! Please log in again.");
      sessionStorage.removeItem("admin_session_key");
      sessionStorage.removeItem("admin_email");
      localStorage.removeItem("user_role");
      localStorage.removeItem("college_manager_user_id");
      setShowCredChangeDialog(false);
      navigate("/");
    } catch (err: any) {
      toast.error(err.message || "Credential update failed");
    }
  };

  // Open Edit User Dialog
  const handleEditClick = (user: UserAccount) => {
    setSelectedUser(user);
    setEditName(user.fullName);
    setEditEmail(user.email);
    setEditStatus(user.status || "active");
    setShowEditDialog(true);
  };

  // Save User Edit (Name, Email, Status)
  const handleSaveUser = async () => {
    if (!selectedUser) return;
    if (!editEmail.trim()) {
      toast.error("Email cannot be empty");
      return;
    }
    try {
      await api.updateAdminUser({
        id: selectedUser.id,
        fullName: editName,
        email: editEmail.trim(),
        status: editStatus,
      });
      toast.success(`Account ${editEmail} updated`);
      setShowEditDialog(false);
      loadRealDatabaseData();
    } catch (err: any) {
      toast.error(err.message || "Failed to update user");
    }
  };

  // Open Reset Password Dialog
  const handleOpenResetPass = (user: UserAccount) => {
    setSelectedUser(user);
    setResetPassNew("");
    setResetPassConfirm("");
    setShowResetPassDialog(true);
  };

  // Save Password Reset
  const handleSaveResetPass = async () => {
    if (!selectedUser) return;
    if (!resetPassNew) {
      toast.error("New password is required");
      return;
    }
    if (resetPassNew !== resetPassConfirm) {
      toast.error("Passwords do not match!");
      return;
    }
    try {
      await api.resetUserPassword({
        id: selectedUser.id,
        newPassword: resetPassNew,
        confirmPassword: resetPassConfirm,
      });
      toast.success(`Password reset successfully for ${selectedUser.email}`);
      setShowResetPassDialog(false);
    } catch (err: any) {
      toast.error(err.message || "Password reset failed");
    }
  };

  // Open Delete Confirmation
  const handleOpenDelete = (user: UserAccount) => {
    if (user.id === "usr-admin") {
      toast.error("Cannot delete Root Admin account!");
      return;
    }
    setUserToDelete(user);
    setShowDeleteConfirmDialog(true);
  };

  // Confirm Delete User
  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    try {
      await api.deleteAdminUser(userToDelete.id);
      toast.success(`Account ${userToDelete.email} permanently deleted`);
      setShowDeleteConfirmDialog(false);
      setUserToDelete(null);
      loadRealDatabaseData();
    } catch (err: any) {
      toast.error(err.message || "Delete failed");
    }
  };

  // Add New User
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
        enrollmentNumber: newEnrollment,
      });
      toast.success(`Account "${newEmail}" created successfully!`);
      setShowAddDialog(false);
      setNewName("");
      setNewEmail("");
      setNewPassword("");
      setNewEnrollment("");
      loadRealDatabaseData();
    } catch (err: any) {
      toast.error(err.message || "Failed to create account");
    }
  };

  // View User History
  const handleViewHistory = async (user: UserAccount) => {
    setHistoryUser(user);
    try {
      const logs = await api.getLoginActivityByEmail(user.email);
      setUserHistoryLogs(Array.isArray(logs) ? logs : []);
    } catch (e) {
      setUserHistoryLogs([]);
    }
    setShowHistoryDialog(true);
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
            The Admin Telemetry Control Hub is restricted. Please sign in with master administrator credentials.
          </p>
          <Button
            onClick={() => navigate("/")}
            className="bg-[var(--brand-start)] text-white hover:bg-amber-600 font-bold px-6 py-2.5 rounded-xl shadow-md"
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Login
          </Button>
        </Card>
      </div>
    );
  }

  // Calculate login stats for a user email
  const getUserStats = (email: string) => {
    const userLogs = backendLoginLogs.filter((l) => l.attemptedEmail.toLowerCase() === email.toLowerCase());
    const successful = userLogs.filter((l) => l.success).length;
    const failed = userLogs.filter((l) => !l.success).length;
    const lastSuccess = userLogs.find((l) => l.success);
    return { successful, failed, lastSuccess };
  };

  // Filtered backend login logs for Partition A
  const filteredLoginLogs = backendLoginLogs.filter((log) => {
    const query = telemetrySearch.toLowerCase();
    const matchesSearch =
      log.attemptedEmail.toLowerCase().includes(query) ||
      log.device.toLowerCase().includes(query) ||
      log.browser.toLowerCase().includes(query) ||
      log.os.toLowerCase().includes(query) ||
      (log.ipAddress && log.ipAddress.includes(query));

    const matchesStatus =
      telemetryFilterStatus === "ALL" ||
      (telemetryFilterStatus === "SUCCESS" && log.success) ||
      (telemetryFilterStatus === "FAILED" && !log.success);

    return matchesSearch && matchesStatus;
  });

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
              Enterprise control panel for live user audit logging, credential management, and security telemetry
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

        {/* Master Admin Identity Info Banner */}
        <Card className="bg-card border-2 border-[var(--brand-start)]/60 p-4 shadow-sm rounded-xl">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-[var(--brand-start)]/15 text-[var(--brand-start)]">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-foreground text-sm">Authenticated Master Admin</h3>
                <p className="text-xs text-muted-foreground font-medium">
                  Logged in with persistent super admin account
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-xs font-mono bg-muted/60 px-4 py-2 rounded-lg border border-border">
                <span className="text-muted-foreground text-[10px] block font-sans font-semibold">Master Admin Email</span>
                <strong className="text-foreground">{adminEmail}</strong>
              </div>
              <Button
                onClick={() => {
                  setCredNewEmail(adminEmail);
                  setCredNewPassword("");
                  setCredConfirmPassword("");
                  setShowCredChangeDialog(true);
                }}
                variant="outline"
                className="border-[var(--brand-start)] text-[var(--brand-start)] hover:bg-[var(--brand-start)]/10 text-xs font-bold"
              >
                <Key className="w-3.5 h-3.5 mr-1.5" />
                Change Admin Credentials
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* EXECUTIVE KPI METRICS PANEL */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card border border-border p-5 shadow-xs rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Login Attempts</span>
            <Activity className="w-5 h-5 text-[var(--brand-start)]" />
          </div>
          <p className="text-3xl font-black text-foreground">{backendLoginLogs.length}</p>
          <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Live MongoDB Audit Stream
          </p>
        </Card>

        <Card className="bg-card border border-border p-5 shadow-xs rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Registered Accounts</span>
            <Users className="w-5 h-5 text-emerald-500" />
          </div>
          <p className="text-3xl font-black text-foreground">{realStats.totalUsers}</p>
          <p className="text-xs text-muted-foreground font-semibold">Live count from MongoDB</p>
        </Card>

        <Card className="bg-card border border-border p-5 shadow-xs rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Active Users</span>
            <Award className="w-5 h-5 text-blue-500" />
          </div>
          <p className="text-3xl font-black text-foreground">{realStats.activeUsers}</p>
          <p className="text-xs text-muted-foreground font-semibold">Active account status</p>
        </Card>

        <Card className="bg-card border border-border p-5 shadow-xs rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Admin Actions</span>
            <ShieldCheck className="w-5 h-5 text-amber-500" />
          </div>
          <p className="text-3xl font-black text-foreground">{adminAuditLogs.length}</p>
          <p className="text-xs text-muted-foreground font-semibold">Security audit events</p>
        </Card>
      </div>

      {/* TOP-LEVEL CONTROL PARTITION TABS */}
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
          Partition A: Login Telemetry Audit ({backendLoginLogs.length})
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
          Partition B: Account Manager ({users.length})
        </button>

        <button
          onClick={() => setActivePartition("audit")}
          className={`px-5 py-3 rounded-xl font-bold text-sm transition-all flex items-center gap-2 border ${
            activePartition === "audit"
              ? "bg-[var(--brand-start)] text-white border-[var(--brand-start)] shadow-md"
              : "bg-card text-muted-foreground border-border hover:text-foreground hover:bg-muted/50"
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          Partition C: Admin Security Audit Log ({adminAuditLogs.length})
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════
         PARTITION A: LOGIN TELEMETRY AUDIT TRAIL
      ══════════════════════════════════════════════════════════ */}
      {activePartition === "telemetry" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-xl font-bold text-foreground">Authentication & Access Audit Trail</h2>
              <p className="text-xs text-muted-foreground font-medium">
                Persistent database record of all successful and failed authentication attempts with device telemetry
              </p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <select
                value={telemetryFilterStatus}
                onChange={(e) => setTelemetryFilterStatus(e.target.value as any)}
                className="bg-background border border-border text-foreground text-xs rounded-lg p-2 font-semibold"
              >
                <option value="ALL">All Statuses</option>
                <option value="SUCCESS">✓ Successful Logins Only</option>
                <option value="FAILED">✕ Failed Attempts Only</option>
              </select>
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={telemetrySearch}
                  onChange={(e) => setTelemetrySearch(e.target.value)}
                  placeholder="Filter email, device, IP..."
                  className="pl-9 bg-background border-border text-foreground text-xs"
                />
              </div>
            </div>
          </div>

          <Card className="bg-card border border-border overflow-hidden shadow-xs rounded-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/70 text-muted-foreground font-bold uppercase border-b border-border">
                  <tr>
                    <th className="p-3.5 w-32">Status</th>
                    <th className="p-3.5">Attempted Email</th>
                    <th className="p-3.5">Date & Time</th>
                    <th className="p-3.5">Device / Client</th>
                    <th className="p-3.5">Browser</th>
                    <th className="p-3.5">Operating System</th>
                    <th className="p-3.5">IP Address</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredLoginLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted-foreground font-medium">
                        No login audit records found matching criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredLoginLogs.map((log, idx) => (
                      <tr
                        key={log._id || idx}
                        className={`transition-colors ${
                          !log.success ? "bg-red-500/5 hover:bg-red-500/10" : "hover:bg-muted/30"
                        }`}
                      >
                        <td className="p-3.5 font-bold">
                          {log.success ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1 w-fit">
                              <CheckCircle2 className="w-3 h-3" /> SUCCESS
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30 flex items-center gap-1 w-fit">
                              <XCircle className="w-3 h-3" /> FAILED
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 font-mono font-bold text-foreground">{log.attemptedEmail}</td>
                        <td className="p-3.5 font-mono text-muted-foreground whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="p-3.5 font-semibold text-foreground">{log.device || "Unknown Device"}</td>
                        <td className="p-3.5 text-muted-foreground">{log.browser || "Unknown Browser"}</td>
                        <td className="p-3.5 text-muted-foreground">{log.os || "Unknown OS"}</td>
                        <td className="p-3.5 font-mono text-muted-foreground text-[11px]">
                          {log.ipAddress || "Not Available"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
         PARTITION B: USER & ACCOUNT MANAGER TABLE
      ══════════════════════════════════════════════════════════ */}
      {activePartition === "users" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-xl font-bold text-foreground">Registered Accounts & Management Controls</h2>
              <p className="text-xs text-muted-foreground font-medium">
                Complete account control: view history, edit profile, reset password, change status, or delete accounts
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

          <Card className="bg-card border border-border overflow-hidden shadow-xs rounded-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/60 text-muted-foreground text-xs uppercase font-bold border-b border-border">
                  <tr>
                    <th className="p-4">User & Role</th>
                    <th className="p-4">Login Email</th>
                    <th className="p-4">Account Status</th>
                    <th className="p-4">Last Login Event</th>
                    <th className="p-4 text-center">Login Counts (✓ / ✕)</th>
                    <th className="p-4 text-right">Management Actions</th>
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
                    .map((user) => {
                      const stats = getUserStats(user.email);
                      return (
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
                            <div className="text-xs text-muted-foreground font-mono">
                              {user.branch !== "Admin" ? `${user.branch} | Enr: ${user.enrollmentNumber}` : "System Role"}
                            </div>
                          </td>
                          <td className="p-4 font-mono text-xs text-foreground font-semibold">
                            <div className="flex items-center gap-1.5">
                              <Mail className="w-3.5 h-3.5 text-[var(--brand-start)]" />
                              {user.email}
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <span
                                className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold ${
                                  user.status === "active"
                                    ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                                    : "bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30"
                                }`}
                              >
                                ● {user.status.toUpperCase()}
                              </span>
                              {user.id !== "usr-admin" && (
                                <button
                                  onClick={() => handleToggleStatus(user)}
                                  title={user.status === "active" ? "Deactivate Account" : "Activate Account"}
                                  className="text-xs text-muted-foreground hover:text-foreground font-semibold underline"
                                >
                                  {user.status === "active" ? <UserX className="w-3.5 h-3.5 text-red-400" /> : <UserCheck className="w-3.5 h-3.5 text-emerald-400" />}
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="p-4 text-xs">
                            {user.lastLogin && user.lastLogin !== "Never" ? (
                              <div className="space-y-0.5">
                                <div className="font-semibold text-foreground flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-amber-500" />
                                  {user.lastLogin}
                                </div>
                                <div className="text-[11px] text-muted-foreground font-mono">
                                  {user.lastLoginDevice || (stats.lastSuccess ? stats.lastSuccess.device : "Unknown Device")}
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground font-semibold italic">Never Logged In</span>
                            )}
                          </td>
                          <td className="p-4 text-center font-mono text-xs">
                            <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20 mr-1.5">
                              ✓ {stats.successful}
                            </span>
                            <span className="px-2 py-1 rounded bg-red-500/10 text-red-600 dark:text-red-400 font-bold border border-red-500/20">
                              ✕ {stats.failed}
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleViewHistory(user)}
                                className="border-border text-foreground hover:bg-muted text-xs font-bold h-8 px-2.5"
                                title="View Login History"
                              >
                                <History className="w-3.5 h-3.5 mr-1 text-blue-500" />
                                History
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEditClick(user)}
                                className="border-border text-foreground hover:bg-muted text-xs font-bold h-8 px-2.5"
                              >
                                <Edit className="w-3.5 h-3.5 mr-1" />
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenResetPass(user)}
                                className="border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 text-xs font-bold h-8 px-2.5"
                              >
                                <Lock className="w-3.5 h-3.5 mr-1" />
                                Reset Pass
                              </Button>
                              {user.id !== "usr-admin" && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleOpenDelete(user)}
                                  className="text-red-500 hover:text-red-600 hover:bg-red-500/10 text-xs font-bold h-8 px-2"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
         PARTITION C: ADMIN SECURITY AUDIT LOG
      ══════════════════════════════════════════════════════════ */}
      {activePartition === "audit" && (
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-bold text-foreground">Master Admin Action Audit Log</h2>
            <p className="text-xs text-muted-foreground font-medium">
              Persistent, tamper-proof MongoDB record of sensitive administrative actions (credential changes, user edits, password resets, account deletions)
            </p>
          </div>

          <Card className="bg-card border border-border overflow-hidden shadow-xs rounded-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/70 text-muted-foreground font-bold uppercase border-b border-border">
                  <tr>
                    <th className="p-3.5 w-44">Timestamp</th>
                    <th className="p-3.5">Action Code</th>
                    <th className="p-3.5">Target Account</th>
                    <th className="p-3.5">Admin Identity</th>
                    <th className="p-3.5">Device & IP</th>
                    <th className="p-3.5">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {adminAuditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-muted-foreground font-medium">
                        No admin audit records logged yet.
                      </td>
                    </tr>
                  ) : (
                    adminAuditLogs.map((audit, idx) => (
                      <tr key={audit._id || idx} className="hover:bg-muted/30 transition-colors">
                        <td className="p-3.5 font-mono text-muted-foreground whitespace-nowrap">
                          {new Date(audit.timestamp).toLocaleString()}
                        </td>
                        <td className="p-3.5 font-mono font-bold text-[var(--brand-start)]">
                          <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30">
                            {audit.action}
                          </span>
                        </td>
                        <td className="p-3.5 font-mono font-bold text-foreground">
                          {audit.targetEmail || "N/A"}
                        </td>
                        <td className="p-3.5 font-semibold text-foreground">{audit.adminEmail}</td>
                        <td className="p-3.5 font-mono text-muted-foreground text-[11px]">
                          {audit.device} ({audit.ipAddress || "Local"})
                        </td>
                        <td className="p-3.5 text-muted-foreground font-medium">{audit.details || "None"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
         DIALOG MODALS
      ══════════════════════════════════════════════════════════ */}

      {/* CHANGE ADMIN CREDENTIALS DIALOG */}
      <Dialog open={showCredChangeDialog} onOpenChange={setShowCredChangeDialog}>
        <DialogContent className="bg-card border border-border text-foreground max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <Key className="w-4 h-4 text-[var(--brand-start)]" />
              Change Master Admin Credentials
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Admin Username / Email</Label>
              <Input
                type="email"
                value={credNewEmail}
                onChange={(e) => setCredNewEmail(e.target.value)}
                placeholder="admin@campus-hub.com"
                className="bg-background border-border text-foreground text-sm font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">New Master Password</Label>
              <Input
                type="password"
                value={credNewPassword}
                onChange={(e) => setCredNewPassword(e.target.value)}
                placeholder="Enter new master password"
                className="bg-background border-border text-foreground text-sm font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Confirm New Password</Label>
              <Input
                type="password"
                value={credConfirmPassword}
                onChange={(e) => setCredConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="bg-background border-border text-foreground text-sm font-mono"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCredChangeDialog(false)} className="border-border text-foreground font-bold text-xs">
              Cancel
            </Button>
            <Button onClick={handleChangeAdminCredentials} className="bg-[var(--brand-start)] text-white hover:bg-amber-600 font-bold text-xs">
              Update Admin Credentials
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ACCOUNT HISTORY MODAL WITH SECURITY SUMMARY */}
      <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
        <DialogContent className="bg-card border border-border text-foreground max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <History className="w-4 h-4 text-blue-500" />
              Account Security Summary & Login History — {historyUser?.email}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {historyUser && (() => {
              const stats = getUserStats(historyUser.email);
              return (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-muted/40 rounded-xl border border-border text-xs">
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase font-bold">Status</span>
                    <strong className={historyUser.status === "active" ? "text-emerald-500 font-bold" : "text-red-500 font-bold"}>
                      {historyUser.status.toUpperCase()}
                    </strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase font-bold">Successful Logins</span>
                    <strong className="text-emerald-500 font-mono font-bold">{stats.successful}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase font-bold">Failed Attempts</span>
                    <strong className="text-red-500 font-mono font-bold">{stats.failed}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase font-bold">Last Device</span>
                    <strong className="text-foreground font-mono font-semibold truncate block">
                      {historyUser.lastLoginDevice || (stats.lastSuccess ? stats.lastSuccess.device : "Unknown Device")}
                    </strong>
                  </div>
                </div>
              );
            })()}

            <div className="max-h-64 overflow-y-auto rounded-xl border border-border">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/70 text-muted-foreground font-bold uppercase sticky top-0 border-b border-border">
                  <tr>
                    <th className="p-2.5">Status</th>
                    <th className="p-2.5">Date & Time</th>
                    <th className="p-2.5">Device</th>
                    <th className="p-2.5">Browser</th>
                    <th className="p-2.5">OS</th>
                    <th className="p-2.5">IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {userHistoryLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-muted-foreground italic">
                        No login activity recorded for this account.
                      </td>
                    </tr>
                  ) : (
                    userHistoryLogs.map((log, i) => (
                      <tr key={log._id || i} className={!log.success ? "bg-red-500/5 font-medium" : ""}>
                        <td className="p-2.5 font-bold">
                          {log.success ? (
                            <span className="text-emerald-500 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Success</span>
                          ) : (
                            <span className="text-red-500 flex items-center gap-1"><XCircle className="w-3 h-3" /> Failed</span>
                          )}
                        </td>
                        <td className="p-2.5 font-mono text-muted-foreground">{new Date(log.timestamp).toLocaleString()}</td>
                        <td className="p-2.5 font-semibold text-foreground">{log.device || "Unknown Device"}</td>
                        <td className="p-2.5 text-muted-foreground">{log.browser || "Unknown Browser"}</td>
                        <td className="p-2.5 text-muted-foreground">{log.os || "Unknown OS"}</td>
                        <td className="p-2.5 font-mono text-muted-foreground text-[10px]">{log.ipAddress || "N/A"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowHistoryDialog(false)} className="border-border text-foreground font-bold text-xs">
              Close History
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* EDIT USER MODAL */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="bg-card border border-border text-foreground max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <Edit className="w-4 h-4 text-[var(--brand-start)]" />
              Edit Account Information
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
              <Label className="text-xs font-semibold text-muted-foreground">Account Status</Label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as any)}
                className="w-full bg-background border border-border text-foreground text-sm rounded-lg p-2 font-semibold"
              >
                <option value="active">Active</option>
                <option value="blocked">Deactivated / Blocked</option>
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)} className="border-border text-foreground font-bold text-xs">
              Cancel
            </Button>
            <Button onClick={handleSaveUser} className="bg-[var(--brand-start)] text-white hover:bg-amber-600 font-bold text-xs">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* RESET PASSWORD DIALOG */}
      <Dialog open={showResetPassDialog} onOpenChange={setShowResetPassDialog}>
        <DialogContent className="bg-card border border-border text-foreground max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-500" />
              Reset Account Password — {selectedUser?.email}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <p className="text-xs text-muted-foreground">
              Set a new password for this user account. Existing password is never displayed or accessible.
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">New Password</Label>
              <Input
                type="password"
                value={resetPassNew}
                onChange={(e) => setResetPassNew(e.target.value)}
                placeholder="Enter new password"
                className="bg-background border-border text-foreground text-sm font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Confirm New Password</Label>
              <Input
                type="password"
                value={resetPassConfirm}
                onChange={(e) => setResetPassConfirm(e.target.value)}
                placeholder="Confirm new password"
                className="bg-background border-border text-foreground text-sm font-mono"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResetPassDialog(false)} className="border-border text-foreground font-bold text-xs">
              Cancel
            </Button>
            <Button onClick={handleSaveResetPass} className="bg-amber-500 text-white hover:bg-amber-600 font-bold text-xs">
              Reset Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DELETE CONFIRMATION DIALOG */}
      <Dialog open={showDeleteConfirmDialog} onOpenChange={setShowDeleteConfirmDialog}>
        <DialogContent className="bg-card border border-red-500/40 text-foreground max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-red-500 flex items-center gap-2">
              <Trash2 className="w-4 h-4" />
              Confirm Permanent Account Deletion
            </DialogTitle>
          </DialogHeader>

          <div className="py-3 space-y-2">
            <p className="text-sm font-bold text-foreground">
              Are you sure you want to permanently delete account{" "}
              <span className="text-red-500 font-mono">{userToDelete?.email}</span>?
            </p>
            <p className="text-xs text-muted-foreground">
              This action cannot be undone. User profile, saved academic data, and associated logs will be permanently removed.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirmDialog(false)} className="border-border text-foreground font-bold text-xs">
              Cancel
            </Button>
            <Button onClick={handleConfirmDelete} className="bg-red-600 text-white hover:bg-red-700 font-bold text-xs">
              Delete Account Permanently
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
              Create New User Account
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
                placeholder="Password123!"
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
