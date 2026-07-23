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
  Eye,
  Award,
} from "lucide-react";
import { toast } from "sonner";

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
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserAccount | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);

  // Edit form state
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editName, setEditName] = useState("");

  // Add form state
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newEnrollment, setNewEnrollment] = useState("");

  // Storage data viewer state
  const [activeStorageTab, setActiveStorageTab] = useState<"users" | "profile" | "marks" | "attendance" | "timetable">("users");
  const [rawStorageData, setRawStorageData] = useState<string>("");

  useEffect(() => {
    loadAdminData();
  }, []);

  const loadAdminData = () => {
    // Load existing users from localStorage or initialize defaults
    const storedUsersStr = localStorage.getItem("system_users");
    let loadedUsers: UserAccount[] = [];

    if (storedUsersStr) {
      try {
        loadedUsers = JSON.parse(storedUsersStr);
      } catch {
        loadedUsers = [];
      }
    }

    // Default users if empty
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
          fullName: currentProfile.fullName || "Student User",
          email: currentProfile.email || "student@ipu.ac.in",
          passwordHash: "Student123!",
          enrollmentNumber: currentProfile.enrollmentNumber || "01234567890",
          collegeName: currentProfile.collegeName || "USICT",
          branch: currentProfile.branch || "CSE",
          admissionYear: currentProfile.admissionYear || 2023,
          graduationYear: currentProfile.graduationYear || 2027,
          lastLogin: "2 minutes ago",
          status: "active",
        },
      ];
      localStorage.setItem("system_users", JSON.stringify(loadedUsers));
    }

    setUsers(loadedUsers);
    inspectStorageData(activeStorageTab);
  };

  const inspectStorageData = (key: string) => {
    const storageKeyMap: Record<string, string> = {
      users: "system_users",
      profile: "student_profile",
      marks: "semester_marks",
      attendance: "attendance_records",
      timetable: "timetable",
    };
    const keyToRead = storageKeyMap[key] || key;
    const item = localStorage.getItem(keyToRead);
    setRawStorageData(item ? JSON.stringify(JSON.parse(item), null, 2) : "// No data saved in storage for key: " + keyToRead);
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

    // Also update student_profile if modifying student account
    if (selectedUser.id !== "usr-admin") {
      const profile = JSON.parse(localStorage.getItem("student_profile") || "{}");
      profile.fullName = editName;
      profile.email = editEmail;
      localStorage.setItem("student_profile", JSON.stringify(profile));
    }

    setShowEditDialog(false);
    toast.success(`Account credentials updated for ${editEmail}!`);
    inspectStorageData(activeStorageTab);
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
      toast.success(`User ${name} removed`);
      inspectStorageData(activeStorageTab);
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
    setShowAddDialog(false);

    setNewName("");
    setNewEmail("");
    setNewPassword("");
    setNewEnrollment("");
    toast.success(`New user account "${newEmail}" created successfully!`);
    inspectStorageData(activeStorageTab);
  };

  const filteredUsers = users.filter(
    (u) =>
      u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.enrollmentNumber.includes(searchTerm)
  );

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl md:text-4xl font-black text-foreground">Admin Control Dashboard</h1>
            <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/40 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              SUPER ADMIN ACCESSED
            </span>
          </div>
          <p className="text-muted-foreground text-sm font-medium">
            System Telemetry, User Credential Editor & Backend Storage Inspector
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={loadAdminData}
            variant="outline"
            className="border-border text-foreground hover:bg-muted font-bold"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh Telemetry
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

      {/* Admin Credentials Alert Card */}
      <Card className="bg-card border-2 border-[var(--brand-start)] p-5 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-[var(--brand-start)]/10 text-[var(--brand-start)]">
              <Key className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-foreground text-base">Root Master Admin Credentials</h3>
              <p className="text-xs text-muted-foreground font-semibold">
                Use these exact credentials on the login screen to access full admin rights.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-6 text-sm font-mono bg-muted/60 px-4 py-2.5 rounded-xl border border-border">
            <div>
              <span className="text-muted-foreground text-xs block font-sans font-semibold">Admin Email</span>
              <strong className="text-foreground">admin@campus-hub.com</strong>
            </div>
            <div className="h-8 w-px bg-border"></div>
            <div>
              <span className="text-muted-foreground text-xs block font-sans font-semibold">Admin Password</span>
              <strong className="text-[var(--brand-start)]">AdminPassword123</strong>
            </div>
          </div>
        </div>
      </Card>

      {/* Live System Telemetry Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <Card className="bg-card border border-border/80 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Accounts</span>
            <Users className="w-5 h-5 text-[var(--brand-start)]" />
          </div>
          <p className="text-3xl font-black text-foreground mb-1">{users.length}</p>
          <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> 100% System Synchronized
          </p>
        </Card>

        <Card className="bg-card border border-border/80 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Live Active Sessions</span>
            <Activity className="w-5 h-5 text-emerald-500" />
          </div>
          <p className="text-3xl font-black text-foreground mb-1">
            {users.filter((u) => u.status === "active").length}
          </p>
          <p className="text-xs text-muted-foreground font-semibold">Real-time user tracking active</p>
        </Card>

        <Card className="bg-card border border-border/80 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">System Health</span>
            <Server className="w-5 h-5 text-sky-500" />
          </div>
          <p className="text-3xl font-black text-emerald-500 mb-1">Healthy</p>
          <p className="text-xs text-muted-foreground font-semibold">All backend services operational</p>
        </Card>

        <Card className="bg-card border border-border/80 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Storage Memory</span>
            <Database className="w-5 h-5 text-amber-500" />
          </div>
          <p className="text-3xl font-black text-foreground mb-1">
            {(JSON.stringify(localStorage).length / 1024).toFixed(1)} KB
          </p>
          <p className="text-xs text-muted-foreground font-semibold">LocalStorage DB utilized</p>
        </Card>
      </div>

      {/* User Account Credential Manager */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-xl font-bold text-foreground">User Credential & Account Management</h2>
            <p className="text-xs text-muted-foreground font-medium">View and edit login email/passwords for all users</p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by email, name or enrollment..."
              className="pl-9 bg-background border-border text-foreground text-xs"
            />
          </div>
        </div>

        <Card className="bg-card border border-border/80 overflow-hidden shadow-sm">
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
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-foreground">{user.fullName}</div>
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
                          Edit Login
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
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground font-medium">
                      No matching user accounts found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Backend Storage Inspector */}
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-xl font-bold text-foreground">Backend & LocalStorage Data Inspector</h2>
            <p className="text-xs text-muted-foreground font-medium">Inspect raw JSON state stored in browser backend</p>
          </div>
          <div className="flex gap-1.5 bg-muted p-1 rounded-xl border border-border">
            {(["users", "profile", "marks", "attendance", "timetable"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setActiveStorageTab(tab);
                  inspectStorageData(tab);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${
                  activeStorageTab === tab
                    ? "bg-card text-[var(--brand-start)] shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <Card className="bg-zinc-950 border border-zinc-800 p-4 text-zinc-100 font-mono text-xs overflow-x-auto shadow-inner rounded-xl">
          <pre className="whitespace-pre-wrap leading-relaxed">{rawStorageData}</pre>
        </Card>
      </div>

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
