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
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-4xl mb-2 bg-gradient-to-r from-[var(--brand-start)] via-white to-[var(--brand-end)] bg-clip-text text-transparent">
          Profile
        </h1>
        <p className="text-gray-400 text-lg">View and manage your profile information</p>
      </div>

      {profile && (
        <>
          {/* Profile Header */}
          <Card className="bg-gradient-to-br from-[#111118]/80 to-[#111118]/60 backdrop-blur-xl border-gray-800/50 p-8">
            <div className="flex items-start justify-between mb-8">
              <div className="flex items-center space-x-6">
                <Avatar className="w-24 h-24 border-4 border-[var(--brand-start)] shadow-[0_0_30px_rgba(var(--brand-start-rgb), 0.4)]">
                  <AvatarFallback className="bg-gradient-to-br from-[var(--brand-start)] to-[var(--brand-end)] text-white text-3xl">
                    {profile.fullName.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h2 className="text-3xl text-white mb-2">{profile.fullName}</h2>
                  <p className="text-gray-400 text-lg">{profile.enrollmentNumber}</p>
                  <p className="text-gray-400">{profile.email}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <Button
                  onClick={() => setShowEditDialog(true)}
                  className="bg-gradient-to-r from-[var(--brand-start)] to-[var(--brand-end)] hover:from-[#00ffff] hover:to-[#8b5cf6] text-white font-semibold"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Profile
                </Button>
                <Button
                  onClick={handleLogout}
                  variant="outline"
                  className="border-red-500/30 hover:border-red-500 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white font-semibold transition-all"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </Button>
              </div>
            </div>

            <div className="grid md:grid-cols-4 gap-6">
              <div className="flex items-center space-x-3">
                <div className="p-3 rounded-lg bg-[var(--brand-start)]/20">
                  <GraduationCap className="w-5 h-5 text-[var(--brand-start)]" />
                </div>
                <div>
                  <p className="text-sm text-gray-400">Course</p>
                  <p className="text-white">{profile.course}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <div className="p-3 rounded-lg bg-[var(--brand-end)]/20">
                  <GraduationCap className="w-5 h-5 text-[var(--brand-end)]" />
                </div>
                <div>
                  <p className="text-sm text-gray-400">Branch</p>
                  <p className="text-white">{profile.branch}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <div className="p-3 rounded-lg bg-emerald-500/20">
                  <Calendar className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-sm text-gray-400">Current Semester</p>
                  <p className="text-white">Semester {profile.currentSemester}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <div className="p-3 rounded-lg bg-purple-500/20">
                  <Award className="w-5 h-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-sm text-gray-400">Year</p>
                  <p className="text-white">{profile.admissionYear} - {profile.graduationYear}</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Academic Stats */}
          <div>
            <h3 className="text-2xl text-white mb-4">Academic Overview</h3>
            <div className="grid md:grid-cols-4 gap-6">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <Card className="bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border-emerald-500/30 p-6">
                  <div className="flex items-center justify-between mb-2">
                    <CheckCircle className="w-8 h-8 text-emerald-400" />
                  </div>
                  <p className="text-sm text-gray-300 mb-1">Overall Attendance</p>
                  <p className="text-3xl text-white">{stats.attendance.toFixed(1)}%</p>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <Card className="bg-gradient-to-br from-[var(--brand-start)]/20 to-[var(--brand-start)]/20 border-[var(--brand-start)]/30 p-6">
                  <div className="flex items-center justify-between mb-2">
                    <Award className="w-8 h-8 text-[var(--brand-start)]" />
                  </div>
                  <p className="text-sm text-gray-300 mb-1">Current CGPA</p>
                  <p className="text-3xl text-white">{stats.cgpa.toFixed(2)}</p>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <Card className="bg-gradient-to-br from-[var(--brand-end)]/20 to-[#8b5cf6]/20 border-[var(--brand-end)]/30 p-6">
                  <div className="flex items-center justify-between mb-2">
                    <Award className="w-8 h-8 text-[var(--brand-end)]" />
                  </div>
                  <p className="text-sm text-gray-300 mb-1">Target CGPA</p>
                  <p className="text-3xl text-white">{stats.targetCgpa > 0 ? stats.targetCgpa.toFixed(2) : "-"}</p>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                <Card className={`bg-gradient-to-br ${stats.backlogs > 0 ? "from-red-500/20 to-orange-500/20 border-red-500/30" : "from-green-500/20 to-emerald-500/20 border-green-500/30"} p-6`}>
                  <div className="flex items-center justify-between mb-2">
                    <AlertCircle className={`w-8 h-8 ${stats.backlogs > 0 ? "text-red-400" : "text-green-400"}`} />
                  </div>
                  <p className="text-sm text-gray-300 mb-1">Active Backlogs</p>
                  <p className="text-3xl text-white">{stats.backlogs}</p>
                </Card>
              </motion.div>
            </div>
          </div>

          {/* Academic History */}
          <div>
            <h3 className="text-2xl text-white mb-4">Academic History</h3>
            <Card className="bg-[#111118]/80 backdrop-blur-xl border-gray-800/50 p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => {
                  const semData = validSemesters.find((s: any) => s.semester === sem);
                  return (
                    <div
                      key={sem}
                      className={`p-4 rounded-lg border ${
                        semData
                          ? "bg-gradient-to-br from-[var(--brand-start)]/10 to-[var(--brand-end)]/10 border-[var(--brand-start)]/30"
                          : "bg-[#0a0a0f]/30 border-gray-800"
                      }`}
                    >
                      <p className="text-sm text-gray-400 mb-1">Semester {sem}</p>
                      <p className="text-xl text-white">{semData ? semData.sgpa.toFixed(2) : "-"}</p>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          {/* College Information */}
          <div>
            <h3 className="text-2xl text-white mb-4">College Information</h3>
            <Card className="bg-[#111118]/80 backdrop-blur-xl border-gray-800/50 p-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-gray-400 mb-1">College Name</p>
                  <p className="text-lg text-white">{profile.collegeName || "Not specified"}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400 mb-1">Enrollment Number</p>
                  <p className="text-lg text-white">{profile.enrollmentNumber}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400 mb-1">Admission Year</p>
                  <p className="text-lg text-white">{profile.admissionYear}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400 mb-1">Expected Graduation</p>
                  <p className="text-lg text-white">{profile.graduationYear}</p>
                </div>
              </div>
            </Card>
          </div>
        </>
      )}

      {/* Edit Profile Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="bg-[#111118] border-gray-800 text-white max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl bg-gradient-to-r from-[var(--brand-start)] to-[var(--brand-end)] bg-clip-text text-transparent">
              Edit Profile
            </DialogTitle>
          </DialogHeader>

          {editData && (
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-gray-300">Full Name</Label>
                  <Input
                    id="fullName"
                    value={editData.fullName}
                    onChange={(e) => setEditData({ ...editData, fullName: e.target.value })}
                    className="bg-[#0a0a0f]/50 border-gray-700 focus:border-[var(--brand-start)] text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-gray-300">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={editData.email}
                    onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                    className="bg-[#0a0a0f]/50 border-gray-700 focus:border-[var(--brand-start)] text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="collegeName" className="text-gray-300">College Name</Label>
                  <Input
                    id="collegeName"
                    value={editData.collegeName}
                    onChange={(e) => setEditData({ ...editData, collegeName: e.target.value })}
                    className="bg-[#0a0a0f]/50 border-gray-700 focus:border-[var(--brand-start)] text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="branch" className="text-gray-300">Branch</Label>
                  <Input
                    id="branch"
                    value={editData.branch}
                    onChange={(e) => setEditData({ ...editData, branch: e.target.value })}
                    className="bg-[#0a0a0f]/50 border-gray-700 focus:border-[var(--brand-start)] text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowEditDialog(false)}
                  className="border-gray-700 hover:border-gray-600 bg-transparent text-white"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveProfile}
                  className="bg-gradient-to-r from-[var(--brand-start)] to-[var(--brand-end)] hover:from-[#00ffff] hover:to-[#8b5cf6] text-white"
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
