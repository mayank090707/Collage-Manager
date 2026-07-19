import { useState, useEffect } from "react";
import { Card } from "../ui/card";
import { Progress } from "../ui/progress";
import { CheckCircle, XCircle, TrendingUp, AlertTriangle } from "lucide-react";
import { motion } from "motion/react";

interface Subject {
  id: string;
  name: string;
  code: string;
  credits: number;
}

interface AttendanceRecord {
  date: string;
  subjects: string[];
}

export function AttendanceTab() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [subjectStats, setSubjectStats] = useState<
    Record<
      string,
      {
        attended: number;
        total: number;
        percentage: number;
        classesNeeded: number;
        safeBunks: number;
      }
    >
  >({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    const subjectsStr = localStorage.getItem("subjects");
    const recordsStr = localStorage.getItem("attendance_records");
    const timetableStr = localStorage.getItem("timetable");

    if (subjectsStr) {
      const loadedSubjects: Subject[] = JSON.parse(subjectsStr);
      setSubjects(loadedSubjects);

      if (recordsStr && timetableStr) {
        const records: AttendanceRecord[] = JSON.parse(recordsStr);
        const timetable = JSON.parse(timetableStr);
        setAttendanceRecords(records);

        // Calculate stats for each subject
        const stats: typeof subjectStats = {};
        loadedSubjects.forEach((subject) => {
          // Count total classes from timetable
          const totalClasses = timetable.filter(
            (t: { subject: string }) => t.subject === subject.name
          ).length * records.length;

          // Count attended classes
          const attendedClasses = records.filter((record) =>
            record.subjects.includes(subject.name)
          ).length;

          const percentage = totalClasses > 0 ? (attendedClasses / totalClasses) * 100 : 0;

          // Calculate classes needed to reach 75%
          const classesNeeded = Math.max(
            0,
            Math.ceil((0.75 * totalClasses - attendedClasses) / 0.25)
          );

          // Calculate safe bunks (how many can be missed while staying above 75%)
          const safeBunks = Math.floor((attendedClasses - 0.75 * totalClasses) / 0.75);

          stats[subject.name] = {
            attended: attendedClasses,
            total: totalClasses,
            percentage,
            classesNeeded,
            safeBunks: Math.max(0, safeBunks),
          };
        });

        setSubjectStats(stats);
      }
    }
  };

  const overallAttendance =
    subjects.length > 0
      ? subjects.reduce((sum, subject) => {
          return sum + (subjectStats[subject.name]?.percentage || 0);
        }, 0) / subjects.length
      : 0;

  const totalAttended = Object.values(subjectStats).reduce((sum, stat) => sum + stat.attended, 0);
  const totalConducted = Object.values(subjectStats).reduce((sum, stat) => sum + stat.total, 0);

  return (
    <div className="space-y-6">
      {/* Overall Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-[#111118]/80 backdrop-blur-xl border-gray-800/50 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Overall Attendance</span>
            <TrendingUp className="w-5 h-5 text-[#00d4ff]" />
          </div>
          <div className="text-3xl text-white mb-2">{overallAttendance.toFixed(1)}%</div>
          <Progress value={overallAttendance} className="h-2 bg-gray-800" />
        </Card>

        <Card className="bg-[#111118]/80 backdrop-blur-xl border-gray-800/50 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Classes Attended</span>
            <CheckCircle className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="text-3xl text-white">{totalAttended}</div>
        </Card>

        <Card className="bg-[#111118]/80 backdrop-blur-xl border-gray-800/50 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Classes Conducted</span>
            <XCircle className="w-5 h-5 text-gray-500" />
          </div>
          <div className="text-3xl text-white">{totalConducted}</div>
        </Card>

        <Card className="bg-[#111118]/80 backdrop-blur-xl border-gray-800/50 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Classes Missed</span>
            <AlertTriangle className="w-5 h-5 text-orange-500" />
          </div>
          <div className="text-3xl text-white">{totalConducted - totalAttended}</div>
        </Card>
      </div>

      {/* Subject-wise Attendance */}
      <div>
        <h3 className="text-xl text-white mb-4">Subject-wise Attendance</h3>
        <div className="grid gap-4">
          {subjects.map((subject, index) => {
            const stats = subjectStats[subject.name];
            if (!stats) return null;

            const isLow = stats.percentage < 75;

            return (
              <motion.div
                key={subject.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="bg-[#111118]/80 backdrop-blur-xl border-gray-800/50 p-6 hover:border-gray-700 transition-colors">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h4 className="text-lg text-white">{subject.name}</h4>
                      <p className="text-sm text-gray-400">{subject.code}</p>
                    </div>
                    <div
                      className={`px-3 py-1 rounded-full text-sm ${
                        isLow
                          ? "bg-red-500/20 text-red-400 border border-red-500/30"
                          : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      }`}
                    >
                      {stats.percentage.toFixed(1)}%
                    </div>
                  </div>

                  <Progress
                    value={stats.percentage}
                    className="h-3 bg-gray-800 mb-4"
                  />

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-gray-400">Attended</p>
                      <p className="text-white">{stats.attended}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Total</p>
                      <p className="text-white">{stats.total}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Classes Needed (75%)</p>
                      <p className="text-white">{stats.classesNeeded}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Safe Bunks</p>
                      <p className="text-white">{stats.safeBunks}</p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}

          {subjects.length === 0 && (
            <Card className="bg-[#111118]/80 backdrop-blur-xl border-gray-800/50 p-12 text-center">
              <p className="text-gray-400">No subjects found. Please complete onboarding first.</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
