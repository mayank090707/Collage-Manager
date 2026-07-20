import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Edit, Mail, Phone, GraduationCap, Calendar, Award, CheckCircle, AlertCircle, LogOut } from "lucide-react";
import { toast } from "sonner";
import { motion } from "motion/react";
import { computeCGPA } from "../../lib/academicUtils";

interface StudentProfile {
  fullName: string;
  enrollmentNumber: string;
  email: string;
  collegeName: string;
  course: string;
  branch: string;
  currentSemester: string;
  admissionYear: string;
  graduationYear: string;
}

export function Profile() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editData, setEditData] = useState<StudentProfile | null>(null);

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
  const [stats, setStats] = useState({
    attendance: 0,
    cgpa: 0,
    targetCgpa: 0,
    backlogs: 0,
  });

  useEffect(() => {
    loadProfile();
    loadStats();
  }, []);

  const loadProfile = () => {
    const saved = localStorage.getItem("student_profile");
    if (saved) {
      const data = JSON.parse(saved);
      setProfile(data);
      setEditData(data);
    }
  };

  const loadStats = () => {
    // Load attendance
    const attendanceRecords = JSON.parse(localStorage.getItem("attendance_records") || "[]");
    const timetable = JSON.parse(localStorage.getItem("timetable") || "[]");

    let totalAttendance = 0;
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
      
      totalAttendance = totalPossible > 0 ? (totalAttended / totalPossible) * 100 : 0;
    }

    // Load CGPA — credit-weighted via shared utility (matches Dashboard & Academics)
    const semesterMarks = JSON.parse(localStorage.getItem("semester_marks") || "[]");
    const cgpa = computeCGPA(semesterMarks) ?? 0;

    // Load target CGPA
    const targetCgpa = parseFloat(localStorage.getItem("target_cgpa") || "0");

    // Load backlogs
    const backlogs = JSON.parse(localStorage.getItem("backlogs") || "[]");
    const activeBacklogs = backlogs.filter((b: any) => b.status === "active").length;

    setStats({
      attendance: totalAttendance,
      cgpa,
      targetCgpa,
      backlogs: activeBacklogs,
    });
  };

  const handleSaveProfile = () => {
    if (!editData) return;

    localStorage.setItem("student_profile", JSON.stringify(editData));
    setProfile(editData);
    setShowEditDialog(false);
    toast.success("Profile updated successfully!");
  };

  // For Academic History, use semester_marks (sgpa > 0 only)
  const semesterMarksRaw = JSON.parse(localStorage.getItem("semester_marks") || "[]");
  const validSemesters = semesterMarksRaw.filter((s: any) => s.sgpa > 0);


  return (
    <div className="p-4 md:p-8 space-y-6 md:space-y-8">
      <div>
        <h1 className="text-3xl md:text-4xl font-black mb-2 bg-gradient-to-r from-[var(--brand-start)] via-amber-600 to-[var(--brand-start)] bg-clip-text text-transparent">
          Profile
        </h1>
        <p className="text-muted-foreground text-base">View and manage your profile information</p>
      </div>

      {profile && (
        <>
          {/* Profile Header */}
          <Card className="bg-card backdrop-blur-xl border border-border/60 p-5 md:p-8">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-5 mb-6 md:mb-8">
              <div className="flex items-center space-x-4 md:space-x-6">
                <Avatar className="w-16 h-16 md:w-24 md:h-24 border-4 border-[var(--brand-start)] shadow-lg flex-shrink-0">
                  <AvatarFallback className="bg-gradient-to-br from-[var(--brand-start)] to-amber-600 text-white text-2xl md:text-3xl font-bold">
                    {profile.fullName.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h2 className="text-xl md:text-3xl font-bold text-foreground mb-1">{profile.fullName}</h2>
                  <p className="text-muted-foreground text-sm md:text-base">{profile.enrollmentNumber}</p>
                  <p className="text-muted-foreground text-sm">{profile.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                <Button
                  onClick={() => setShowEditDialog(true)}
                  className="bg-[var(--brand-start)] hover:bg-amber-600 text-white font-semibold flex-1 sm:flex-none"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Profile
                </Button>
                <Button
                  onClick={handleLogout}
                  variant="outline"
                  className="border-red-500/40 hover:border-red-500 bg-red-500/5 hover:bg-red-500 text-red-500 hover:text-white font-semibold transition-all flex-1 sm:flex-none"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-lg bg-[var(--brand-start)]/15">
                  <GraduationCap className="w-5 h-5 text-[var(--brand-start)]" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Course</p>
                  <p className="text-foreground font-semibold text-sm">{profile.course}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-lg bg-blue-500/15">
                  <GraduationCap className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Branch</p>
                  <p className="text-foreground font-semibold text-sm">{profile.branch}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-lg bg-emerald-500/15">
                  <Calendar className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Current Semester</p>
                  <p className="text-foreground font-semibold text-sm">Semester {profile.currentSemester}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-lg bg-purple-500/15">
                  <Award className="w-5 h-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Year</p>
                  <p className="text-foreground font-semibold text-sm">{profile.admissionYear} - {profile.graduationYear}</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Academic Stats */}
          <div>
            <h3 className="text-xl md:text-2xl font-bold text-foreground mb-4">Academic Overview</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <Card className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 p-5">
                  <CheckCircle className="w-7 h-7 text-emerald-500 mb-3" />
                  <p className="text-xs text-muted-foreground font-medium mb-1">Overall Attendance</p>
                  <p className="text-2xl md:text-3xl font-black text-foreground">{stats.attendance.toFixed(1)}%</p>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <Card className="bg-[var(--brand-start)]/5 dark:bg-[var(--brand-start)]/10 border border-[var(--brand-start)]/30 p-5">
                  <Award className="w-7 h-7 text-[var(--brand-start)] mb-3" />
                  <p className="text-xs text-muted-foreground font-medium mb-1">Current CGPA</p>
                  <p className="text-2xl md:text-3xl font-black text-foreground">{stats.cgpa.toFixed(2)}</p>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <Card className="bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/30 p-5">
                  <Award className="w-7 h-7 text-purple-500 mb-3" />
                  <p className="text-xs text-muted-foreground font-medium mb-1">Target CGPA</p>
                  <p className="text-2xl md:text-3xl font-black text-foreground">{stats.targetCgpa > 0 ? stats.targetCgpa.toFixed(2) : "-"}</p>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                <Card className={`${stats.backlogs > 0 ? "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30" : "bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/30"} border p-5`}>
                  <AlertCircle className={`w-7 h-7 mb-3 ${stats.backlogs > 0 ? "text-red-500" : "text-green-500"}`} />
                  <p className="text-xs text-muted-foreground font-medium mb-1">Active Backlogs</p>
                  <p className="text-2xl md:text-3xl font-black text-foreground">{stats.backlogs}</p>
                </Card>
              </motion.div>
            </div>
          </div>

          {/* Academic History */}
          <div>
            <h3 className="text-xl md:text-2xl font-bold text-foreground mb-4">Academic History</h3>
            <Card className="bg-card border border-border/60 p-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => {
                  const semData = validSemesters.find((s: any) => s.semester === sem);
                  return (
                    <div
                      key={sem}
                      className={`p-4 rounded-lg border ${
                        semData
                          ? "bg-[var(--brand-start)]/5 dark:bg-[var(--brand-start)]/10 border-[var(--brand-start)]/30"
                          : "bg-muted/50 border-border"
                      }`}
                    >
                      <p className="text-xs text-muted-foreground font-medium mb-1">Semester {sem}</p>
                      <p className="text-xl font-black text-foreground">{semData ? semData.sgpa.toFixed(2) : "-"}</p>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          {/* College Information */}
          <div>
            <h3 className="text-xl md:text-2xl font-bold text-foreground mb-4">College Information</h3>
            <Card className="bg-card border border-border/60 p-5">
              <div className="grid md:grid-cols-2 gap-5">
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-1">College Name</p>
                  <p className="text-base font-semibold text-foreground">{profile.collegeName || "Not specified"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-1">Enrollment Number</p>
                  <p className="text-base font-semibold text-foreground">{profile.enrollmentNumber}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-1">Admission Year</p>
                  <p className="text-base font-semibold text-foreground">{profile.admissionYear}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-1">Expected Graduation</p>
                  <p className="text-base font-semibold text-foreground">{profile.graduationYear}</p>
                </div>
              </div>
            </Card>
          </div>
        </>
      )}

      {/* Edit Profile Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="bg-card border border-border text-foreground max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-[var(--brand-start)]">
              Edit Profile
            </DialogTitle>
          </DialogHeader>

          {editData && (
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-muted-foreground font-semibold text-sm">Full Name</Label>
                  <Input
                    id="fullName"
                    value={editData.fullName}
                    onChange={(e) => setEditData({ ...editData, fullName: e.target.value })}
                    className="bg-background border-border focus:border-[var(--brand-start)] text-foreground"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-muted-foreground font-semibold text-sm">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={editData.email}
                    onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                    className="bg-background border-border focus:border-[var(--brand-start)] text-foreground"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="collegeName" className="text-muted-foreground font-semibold text-sm">College Name</Label>
                  <Input
                    id="collegeName"
                    value={editData.collegeName}
                    onChange={(e) => setEditData({ ...editData, collegeName: e.target.value })}
                    className="bg-background border-border focus:border-[var(--brand-start)] text-foreground"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="branch" className="text-muted-foreground font-semibold text-sm">Branch</Label>
                  <Input
                    id="branch"
                    value={editData.branch}
                    onChange={(e) => setEditData({ ...editData, branch: e.target.value })}
                    className="bg-background border-border focus:border-[var(--brand-start)] text-foreground"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-border">
                <Button
                  variant="outline"
                  onClick={() => setShowEditDialog(false)}
                  className="border-border hover:bg-muted text-foreground"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveProfile}
                  className="bg-[var(--brand-start)] hover:bg-amber-600 text-white font-bold"
                >
                  Save Changes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
