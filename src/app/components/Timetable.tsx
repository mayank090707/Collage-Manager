import { useEffect, useState } from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { motion } from "motion/react";
import { Clock, BookOpen, Edit2, Save, X, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

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
  const [editMode, setEditMode] = useState(false);
  const [editTimetable, setEditTimetable] = useState<TimetableSlot[]>([]);

  // Subject list for the edit panel
  const [subjects, setSubjects] = useState<string[]>([]);
  const [newSubject, setNewSubject] = useState("");

  useEffect(() => {
    loadTimetable();
  }, []);

  const loadTimetable = () => {
    const saved = localStorage.getItem("timetable");
    if (saved) {
      const slots: TimetableSlot[] = JSON.parse(saved);
      setTimetable(slots);
      rebuildColorMap(slots);
    }

    // Pre-fill known subjects from onboarding
    const subs: { name: string }[] = JSON.parse(localStorage.getItem("subjects") || "[]");
    if (subs.length > 0) {
      setSubjects(subs.map((s) => s.name));
    }
  };

  const rebuildColorMap = (slots: TimetableSlot[]) => {
    const uniqueSubjects = Array.from(new Set(slots.map((s) => s.subject)));
    const colorMap: Record<string, string> = {};
    uniqueSubjects.forEach((subj, i) => {
      colorMap[subj] = PERIOD_COLORS[i % PERIOD_COLORS.length];
    });
    setSubjectColorMap(colorMap);
  };

  const getSlotsForDay = (slots: TimetableSlot[], day: string) =>
    slots.filter((t) => t.day === day).sort((a, b) => a.period - b.period);

  const maxPeriods = Math.max(1, ...DAYS.map((d) => getSlotsForDay(timetable, d).length));

  const totalSubjects = new Set(timetable.map((t) => t.subject)).size;
  const totalPeriods = timetable.length;

  // ── Edit Helpers ──────────────────────────────────────────────────────────────
  const enterEditMode = () => {
    setEditTimetable(JSON.parse(JSON.stringify(timetable)));
    setEditMode(true);
  };

  const cancelEdit = () => {
    setEditMode(false);
    setEditTimetable([]);
  };

  const saveEdit = () => {
    const reordered = DAYS.flatMap((day) => {
      const daySlots = getSlotsForDay(editTimetable, day);
      return daySlots.map((s, i) => ({ ...s, period: i + 1 }));
    });
    setTimetable(reordered);
    localStorage.setItem("timetable", JSON.stringify(reordered));
    rebuildColorMap(reordered);
    setEditMode(false);
    toast.success("Timetable saved!");
    window.dispatchEvent(new Event("storage"));
  };

  const addSlot = (day: string, subjectName: string) => {
    if (!subjectName.trim()) return;
    const daySlots = getSlotsForDay(editTimetable, day);
    setEditTimetable([
      ...editTimetable,
      { day, subject: subjectName.trim(), period: daySlots.length + 1 },
    ]);
  };

  const removeSlot = (day: string, idx: number) => {
    const daySlots = getSlotsForDay(editTimetable, day);
    const others = editTimetable.filter((t) => t.day !== day);
    daySlots.splice(idx, 1);
    const reordered = daySlots.map((s, i) => ({ ...s, period: i + 1 }));
    setEditTimetable([...others, ...reordered]);
  };

  const addNewSubjectToList = () => {
    const trimmed = newSubject.trim();
    if (trimmed && !subjects.includes(trimmed)) {
      setSubjects([...subjects, trimmed]);
      setNewSubject("");
    }
  };

  // ── Read-only view ─────────────────────────────────────────────────────────────
  const ReadView = () => (
    <>
      {timetable.length === 0 ? (
        <Card className="bg-[#111118]/80 backdrop-blur-xl border-gray-800/50 p-16 text-center">
          <BookOpen className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 text-lg">No timetable set up yet</p>
          <p className="text-gray-600 text-sm mt-1">Click Edit Timetable to create your schedule</p>
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
                    const slots = getSlotsForDay(timetable, day);
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
    </>
  );

  // ── Edit view ──────────────────────────────────────────────────────────────────
  const EditView = () => (
    <Card className="bg-[#111118]/80 backdrop-blur-xl border-gray-800/50 p-6 space-y-6">
      {/* Add a new subject to the palette */}
      <div>
        <Label className="text-gray-300 text-sm mb-2 block">Subject Palette</Label>
        <div className="flex flex-wrap gap-2 mb-3">
          {subjects.map((s) => (
            <span
              key={s}
              className="px-3 py-1 rounded-md bg-[var(--brand-start)]/10 border border-[var(--brand-start)]/30 text-[var(--brand-start)] text-xs font-medium"
            >
              {s}
            </span>
          ))}
        </div>
        <div className="flex gap-2 max-w-sm">
          <Input
            value={newSubject}
            onChange={(e) => setNewSubject(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addNewSubjectToList()}
            placeholder="Add a subject…"
            className="bg-[#0a0a0f]/50 border-gray-700 focus:border-[var(--brand-start)] text-white text-sm"
          />
          <Button
            type="button"
            onClick={addNewSubjectToList}
            size="sm"
            variant="outline"
            className="border-gray-700 bg-transparent text-[var(--brand-start)] hover:bg-[var(--brand-start)]/10"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Per-day slot editor */}
      <div className="space-y-5">
        {DAYS.map((day) => {
          const daySlots = getSlotsForDay(editTimetable, day);
          return (
            <div key={day} className="p-4 rounded-xl bg-[#0a0a0f]/30 border border-gray-800/50 space-y-3">
              <div className="flex items-center justify-between border-b border-gray-800/50 pb-2">
                <Label className="text-[var(--brand-start)] font-bold text-base">{day}</Label>
                <span className="text-xs text-gray-500 uppercase tracking-widest">{daySlots.length} Slots</span>
              </div>

              {/* Current slots */}
              {daySlots.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {daySlots.map((slot, idx) => (
                    <div
                      key={`${day}-${idx}`}
                      className="group flex items-center gap-1.5 pl-3 pr-1 py-1 rounded-full bg-gradient-to-r from-[var(--brand-start)]/10 to-[var(--brand-end)]/10 border border-[var(--brand-start)]/30 text-white text-sm"
                    >
                      <span className="text-[10px] font-bold opacity-50">P{slot.period}</span>
                      <span className="font-medium">{slot.subject}</span>
                      <button
                        type="button"
                        onClick={() => removeSlot(day, idx)}
                        className="p-1 rounded-full hover:bg-black/20 text-gray-400 hover:text-red-400 transition-colors"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add subject buttons */}
              <div className="flex flex-wrap gap-2">
                {subjects.filter((s) => s).map((subject) => (
                  <button
                    key={subject}
                    type="button"
                    onClick={() => addSlot(day, subject)}
                    className="px-3 py-1.5 rounded-md border border-gray-700 bg-gray-800/30 text-gray-300 text-xs hover:border-[var(--brand-start)] hover:text-white transition-all flex items-center gap-1.5"
                  >
                    <Plus size={12} />
                    {subject}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Clear all */}
      <div className="flex justify-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setEditTimetable([])}
          className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
        >
          <Trash2 className="w-4 h-4 mr-1.5" />
          Clear All
        </Button>
      </div>
    </Card>
  );

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl md:text-4xl mb-2 bg-gradient-to-r from-[var(--brand-start)] via-white to-[var(--brand-end)] bg-clip-text text-transparent font-black">
            Weekly Timetable
          </h1>
          <p className="text-gray-400">Your class schedule at a glance</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {editMode ? (
            <>
              <Button
                onClick={cancelEdit}
                variant="outline"
                className="border-gray-700 bg-transparent text-gray-300 hover:text-white"
              >
                <X className="w-4 h-4 mr-1.5" />
                Cancel
              </Button>
              <Button
                onClick={saveEdit}
                className="bg-gradient-to-r from-[var(--brand-start)] to-[var(--brand-end)] text-white hover:from-[#00ffff] hover:to-[#8b5cf6]"
              >
                <Save className="w-4 h-4 mr-1.5" />
                Save Timetable
              </Button>
            </>
          ) : (
            <Button
              onClick={enterEditMode}
              className="bg-gradient-to-r from-[var(--brand-start)]/20 to-[var(--brand-end)]/20 border border-[var(--brand-start)]/40 text-white hover:from-[var(--brand-start)]/30 hover:to-[var(--brand-end)]/30"
            >
              <Edit2 className="w-4 h-4 mr-1.5 text-[var(--brand-start)]" />
              Edit Timetable
            </Button>
          )}
        </div>
      </div>

      {/* Stats row */}
      {!editMode && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Active Days", value: DAYS.filter((d) => getSlotsForDay(timetable, d).length > 0).length, icon: Clock },
            { label: "Total Periods / Week", value: totalPeriods, icon: BookOpen },
            { label: "Subjects", value: totalSubjects, icon: BookOpen },
          ].map(({ label, value, icon: Icon }) => (
            <Card key={label} className="bg-[#111118]/80 backdrop-blur-xl border-gray-800/50 p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-[var(--brand-start)]/20 to-[var(--brand-end)]/20 flex items-center justify-center flex-shrink-0">
                <Icon className="w-5 h-5 text-[var(--brand-start)]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{value}</p>
                <p className="text-xs text-gray-400">{label}</p>
              </div>
            </Card>
          ))}
        </div>
      )}

      {editMode ? <EditView /> : <ReadView />}
    </div>
  );
}
