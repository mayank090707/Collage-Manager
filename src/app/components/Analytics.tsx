import { useState, useEffect } from "react";
import { Card } from "./ui/card";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from "recharts";
import { TrendingUp, TrendingDown, Award, AlertCircle, Target, CheckCircle } from "lucide-react";
import { motion } from "motion/react";

export function Analytics() {
  const [sgpaData, setSgpaData] = useState<any[]>([]);
  const [attendanceData, setAttendanceData] = useState<any[]>([]);
  const [subjectPerformance, setSubjectPerformance] = useState<any[]>([]);
  const [insights, setInsights] = useState<string[]>([]);

  useEffect(() => {
    loadAnalyticsData();
  }, []);

  const loadAnalyticsData = () => {
    // Load SGPA trend
    const semesterData = JSON.parse(localStorage.getItem("semester_data") || "[]");
    const sgpaChart = semesterData
      .filter((sem: any) => sem.sgpa > 0)
      .map((sem: any) => ({
        semester: `Sem ${sem.semester}`,
        sgpa: parseFloat(sem.sgpa.toFixed(2)),
      }));
    setSgpaData(sgpaChart);

    // Load attendance by subject
    const subjects = JSON.parse(localStorage.getItem("subjects") || "[]");
    const attendanceRecords = JSON.parse(localStorage.getItem("attendance_records") || "[]");
    const timetable = JSON.parse(localStorage.getItem("timetable") || "[]");

    const attendanceChart = subjects.map((subject: any) => {
      const totalClasses = timetable.filter((t: any) => t.subject === subject.name).length * attendanceRecords.length;
      const attendedClasses = attendanceRecords.filter((record: any) => record.subjects.includes(subject.name)).length;
      const percentage = totalClasses > 0 ? (attendedClasses / totalClasses) * 100 : 0;

      return {
        subject: subject.name.length > 15 ? subject.name.substring(0, 15) + "..." : subject.name,
        attendance: parseFloat(percentage.toFixed(1)),
      };
    });
    setAttendanceData(attendanceChart);

    // Subject performance (for radar chart)
    const currentSemester = semesterData[semesterData.length - 1];
    if (currentSemester && currentSemester.subjects) {
      const performance = currentSemester.subjects.slice(0, 6).map((sub: any) => ({
        subject: sub.subjectName.length > 10 ? sub.subjectName.substring(0, 10) + "..." : sub.subjectName,
        score: sub.totalMarks,
      }));
      setSubjectPerformance(performance);
    }

    // Generate insights
    generateInsights(sgpaChart, attendanceChart, semesterData, attendanceRecords.length > 0);
  };

  const generateInsights = (sgpaChart: any[], attendanceChart: any[], semesterData: any[], hasAttendanceMarked: boolean) => {
    const newInsights: string[] = [];

    // SGPA trend
    if (sgpaChart.length >= 2) {
      const latest = sgpaChart[sgpaChart.length - 1].sgpa;
      const previous = sgpaChart[sgpaChart.length - 2].sgpa;
      if (latest > previous) {
        newInsights.push(`Your SGPA improved by ${(latest - previous).toFixed(2)} points! Keep up the excellent work.`);
      } else if (latest < previous) {
        newInsights.push(`Your SGPA decreased by ${(previous - latest).toFixed(2)} points. Focus on improvement next semester.`);
      }
    }

    // Attendance
    if (hasAttendanceMarked && attendanceChart.length > 0) {
      const avgAttendance = attendanceChart.reduce((sum, item) => sum + item.attendance, 0) / attendanceChart.length;
      if (avgAttendance >= 85) {
        newInsights.push("Excellent attendance record! You're well above the minimum requirement.");
      } else if (avgAttendance < 75) {
        newInsights.push("Your attendance is below 75%. Consider improving it to meet requirements.");
      }
    }

    // CGPA calculation
    const validSemesters = semesterData.filter((sem: any) => sem.sgpa > 0);
    if (validSemesters.length > 0) {
      const cgpa = validSemesters.reduce((sum: number, sem: any) => sum + sem.sgpa, 0) / validSemesters.length;
      if (cgpa >= 9.0) {
        newInsights.push("Outstanding CGPA! You're on track for top honors and excellent placement opportunities.");
      } else if (cgpa >= 8.0) {
        newInsights.push("Great CGPA! Maintain this performance for strong placement opportunities.");
      }
    }

    // Backlogs
    const backlogs = JSON.parse(localStorage.getItem("backlogs") || "[]");
    const activeBacklogs = backlogs.filter((b: any) => b.status === "active").length;
    if (activeBacklogs === 0) {
      newInsights.push("No active backlogs - excellent academic standing!");
    } else if (activeBacklogs > 0) {
      newInsights.push(`You have ${activeBacklogs} active backlog(s). Prioritize clearing them soon.`);
    }

    // Target CGPA
    const targetCgpa = parseFloat(localStorage.getItem("target_cgpa") || "0");
    if (targetCgpa > 0 && validSemesters.length > 0) {
      const currentCgpa = validSemesters.reduce((sum: number, sem: any) => sum + sem.sgpa, 0) / validSemesters.length;
      if (currentCgpa >= targetCgpa) {
        newInsights.push("Congratulations! You've achieved your target CGPA.");
      }
    }

    setInsights(newInsights);
  };

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-4xl font-black mb-2 bg-gradient-to-r from-[var(--brand-start)] to-amber-600 bg-clip-text text-transparent">
          Analytics
        </h1>
        <p className="text-muted-foreground text-lg">Visualize your academic performance and insights</p>
      </div>

      {/* Key Insights */}
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-4">AI-Powered Insights</h2>
        <div className="grid gap-4">
          {insights.map((insight, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="bg-[var(--brand-start)]/10 border border-[var(--brand-start)]/30 backdrop-blur-xl p-4">
                <div className="flex items-start space-x-3">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-[var(--brand-start)] to-amber-600 mt-1 flex-shrink-0">
                    {insight.includes("improved") || insight.includes("Excellent") || insight.includes("Outstanding") || insight.includes("Congratulations") ? (
                      <TrendingUp className="w-4 h-4 text-white" />
                    ) : insight.includes("decreased") || insight.includes("below") || insight.includes("backlog") ? (
                      <AlertCircle className="w-4 h-4 text-white" />
                    ) : (
                      <Award className="w-4 h-4 text-white" />
                    )}
                  </div>
                  <p className="text-foreground font-medium flex-1 leading-relaxed">{insight}</p>
                </div>
              </Card>
            </motion.div>
          ))}
          {insights.length === 0 && (
            <Card className="bg-card backdrop-blur-xl border border-border/60 p-8 text-center">
              <p className="text-muted-foreground">Complete your academic records to see personalized insights</p>
            </Card>
          )}
        </div>
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* SGPA Trend */}
        <Card className="bg-card backdrop-blur-xl border border-border/60 p-6">
          <h3 className="text-xl font-bold text-foreground mb-6">SGPA Trend</h3>
          {sgpaData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={sgpaData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="semester" stroke="var(--muted-foreground)" />
                <YAxis domain={[0, 10]} stroke="var(--muted-foreground)" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    color: "var(--foreground)",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="sgpa"
                  stroke="url(#sgpaGradient)"
                  strokeWidth={3}
                  dot={{ fill: "#fbbf24", r: 6 }}
                  activeDot={{ r: 8 }}
                />
                <defs>
                  <linearGradient id="sgpaGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#fbbf24" />
                    <stop offset="100%" stopColor="#f97316" />
                  </linearGradient>
                </defs>
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              No SGPA data available
            </div>
          )}
        </Card>

        {/* Attendance by Subject */}
        <Card className="bg-card backdrop-blur-xl border border-border/60 p-6">
          <h3 className="text-xl font-bold text-foreground mb-6">Attendance by Subject</h3>
          {attendanceData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={attendanceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="subject" stroke="var(--muted-foreground)" angle={-45} textAnchor="end" height={100} />
                <YAxis domain={[0, 100]} stroke="var(--muted-foreground)" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    color: "var(--foreground)",
                  }}
                />
                <Bar dataKey="attendance" fill="url(#attendanceGradient)" radius={[8, 8, 0, 0]} />
                <defs>
                  <linearGradient id="attendanceGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fbbf24" />
                    <stop offset="100%" stopColor="#f97316" />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              No attendance data available
            </div>
          )}
        </Card>
      </div>

      {/* Subject Performance Radar */}
      {subjectPerformance.length > 0 && (
        <Card className="bg-card backdrop-blur-xl border border-border/60 p-6">
          <h3 className="text-xl font-bold text-foreground mb-6">Subject Performance Distribution</h3>
          <ResponsiveContainer width="100%" height={400}>
            <RadarChart data={subjectPerformance}>
              <PolarGrid stroke="var(--border)" />
              <PolarAngleAxis dataKey="subject" stroke="var(--muted-foreground)" />
              <PolarRadiusAxis domain={[0, 100]} stroke="var(--muted-foreground)" />
              <Radar
                name="Score"
                dataKey="score"
                stroke="#fbbf24"
                fill="#fbbf24"
                fillOpacity={0.3}
                strokeWidth={2}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  color: "var(--foreground)",
                }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Performance Indicators */}
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-4">Performance Indicators</h2>
        <div className="grid md:grid-cols-3 gap-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="bg-emerald-500/10 border border-emerald-500/30 p-6">
              <div className="flex items-center justify-between mb-4">
                <CheckCircle className="w-8 h-8 text-emerald-500" />
                <span className="text-2xl font-black text-emerald-500">85%</span>
              </div>
              <p className="text-sm text-foreground font-semibold mb-1">Placement Readiness</p>
              <p className="text-xs text-muted-foreground">Based on CGPA and attendance</p>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="bg-[var(--brand-start)]/10 border border-[var(--brand-start)]/30 p-6">
              <div className="flex items-center justify-between mb-4">
                <TrendingUp className="w-8 h-8 text-[var(--brand-start)]" />
                <span className="text-2xl font-black text-[var(--brand-start)]">Good</span>
              </div>
              <p className="text-sm text-foreground font-semibold mb-1">Academic Trend</p>
              <p className="text-xs text-muted-foreground">Consistent performance</p>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="bg-amber-500/10 border border-amber-500/30 p-6">
              <div className="flex items-center justify-between mb-4">
                <Target className="w-8 h-8 text-amber-500" />
                <span className="text-2xl font-black text-amber-500">On Track</span>
              </div>
              <p className="text-sm text-foreground font-semibold mb-1">Target Progress</p>
              <p className="text-xs text-muted-foreground">Meeting expectations</p>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
