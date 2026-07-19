import { useEffect, useState } from "react";
import { Card } from "./ui/card";
import { motion } from "motion/react";
import { Clock, BookOpen } from "lucide-react";

interface TimetableSlot {
  day: string;
  subject: string;
  period: number;
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const PERIOD_COLORS = [
  "from-[var(--brand-start)]/20 to-[var(--brand-start)]/20 border-[var(--brand-start)]/40 text-[var(--brand-start)]",
  "from-[var(--brand-end)]/20 to-[#8b5cf6]/20 border-[var(--brand-end)]/40 text-[var(--brand-end)]",
  "from-emerald-500/20 to-teal-500/20 border-emerald-500/40 text-emerald-400",
  "from-orange-500/20 to-amber-500/20 border-orange-500/40 text-orange-400",
  "from-pink-500/20 to-rose-500/20 border-pink-500/40 text-pink-400",
  "from-yellow-500/20 to-lime-500/20 border-yellow-500/40 text-yellow-400",
  "from-sky-500/20 to-cyan-500/20 border-sky-500/40 text-sky-400",
  "from-violet-500/20 to-purple-500/20 border-violet-500/40 text-violet-400",
];

export function Timetable() {
  const [timetable, setTimetable] = useState<TimetableSlot[]>([]);
  const [subjectColorMap, setSubjectColorMap] = useState<Record<string, string>>({});

  useEffect(() => {
    const saved = localStorage.getItem("timetable");
    if (saved) {
      const slots: TimetableSlot[] = JSON.parse(saved);
      setTimetable(slots);

      // Assign a consistent color to each unique subject
      const uniqueSubjects = Array.from(new Set(slots.map((s) => s.subject)));
      const colorMap: Record<string, string> = {};
      uniqueSubjects.forEach((subj, i) => {
        colorMap[subj] = PERIOD_COLORS[i % PERIOD_COLORS.length];
      });
      setSubjectColorMap(colorMap);
    }
  }, []);

  const getSlotsForDay = (day: string) =>
    timetable.filter((t) => t.day === day).sort((a, b) => a.period - b.period);

  const maxPeriods = Math.max(
    1,
    ...DAYS.map((d) => getSlotsForDay(d).length)
  );

  const totalSubjects = new Set(timetable.map((t) => t.subject)).size;
  const totalPeriods = timetable.length;

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl mb-2 bg-gradient-to-r from-[var(--brand-start)] via-white to-[var(--brand-end)] bg-clip-text text-transparent">
          Weekly Timetable
        </h1>
        <p className="text-gray-400 text-lg">Your class schedule at a glance</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Active Days", value: DAYS.filter((d) => getSlotsForDay(d).length > 0).length, icon: Clock },
          { label: "Total Periods / Week", value: totalPeriods, icon: BookOpen },
          { label: "Subjects", value: totalSubjects, icon: BookOpen },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label} className="bg-[#111118]/80 backdrop-blur-xl border-gray-800/50 p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-[var(--brand-start)]/20 to-[var(--brand-end)]/20 flex items-center justify-center">
              <Icon className="w-5 h-5 text-[var(--brand-start)]" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{value}</p>
              <p className="text-xs text-gray-400">{label}</p>
            </div>
          </Card>
        ))}
      </div>

      {timetable.length === 0 ? (
        <Card className="bg-[#111118]/80 backdrop-blur-xl border-gray-800/50 p-16 text-center">
          <BookOpen className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 text-lg">No timetable set up yet</p>
          <p className="text-gray-600 text-sm mt-1">Set up your timetable during onboarding</p>
        </Card>
      ) : (
        <>
          {/* Grid timetable */}
          <Card className="bg-[#111118]/80 backdrop-blur-xl border-gray-800/50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-800/60">
                    <th className="p-4 text-left text-gray-400 font-medium w-28 bg-[#0a0a0f]/40">Day</th>
                    {Array.from({ length: maxPeriods }, (_, i) => (
                      <th key={i} className="p-4 text-center text-gray-400 font-medium min-w-[140px] bg-[#0a0a0f]/20">
                        Period {i + 1}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DAYS.map((day, dayIdx) => {
                    const slots = getSlotsForDay(day);
                    const hasClasses = slots.length > 0;
                    return (
                      <motion.tr
                        key={day}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: dayIdx * 0.05 }}
                        className="border-b border-gray-800/40 hover:bg-gray-800/10 transition-colors"
                      >
                        <td className="p-4 bg-[#0a0a0f]/30">
                          <span className={`font-semibold text-sm ${hasClasses ? "text-white" : "text-gray-600"}`}>
                            {day}
                          </span>
                          {!hasClasses && (
                            <p className="text-xs text-gray-700 mt-0.5">Free</p>
                          )}
                        </td>
                        {Array.from({ length: maxPeriods }, (_, i) => {
                          const slot = slots[i];
                          return (
                            <td key={i} className="p-2">
                              {slot ? (
                                <div
                                  className={`bg-gradient-to-br ${subjectColorMap[slot.subject] || PERIOD_COLORS[0]} border rounded-lg p-3 text-center`}
                                >
                                  <p className="text-sm font-medium leading-tight">{slot.subject}</p>
                                </div>
                              ) : (
                                <div className="h-12 rounded-lg border border-dashed border-gray-800/40 flex items-center justify-center">
                                  <span className="text-gray-700 text-xs">—</span>
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Legend */}
          <Card className="bg-[#111118]/80 backdrop-blur-xl border-gray-800/50 p-6">
            <h3 className="text-white font-semibold mb-4">Subject Legend</h3>
            <div className="flex flex-wrap gap-3">
              {Object.entries(subjectColorMap).map(([subj, cls]) => (
                <div
                  key={subj}
                  className={`bg-gradient-to-r ${cls} border rounded-lg px-4 py-2 text-sm font-medium`}
                >
                  {subj}
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
