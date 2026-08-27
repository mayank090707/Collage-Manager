import { Fragment, useEffect, useState } from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { motion } from "motion/react";
import { Clock, BookOpen, Edit2, Save, X, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PERIOD_TIMINGS } from "../../lib/academicUtils";

interface TimetableSlot {
  day: string;
  subject: string;
  period: number;
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

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
    const handleStorage = () => loadTimetable();
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
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
  const renderReadView = () => (
    <>
      {timetable.length === 0 ? (
        <Card className="bg-card border border-border/80 p-16 text-center shadow-sm">
          <BookOpen className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground text-lg font-medium">No timetable set up yet</p>
          <p className="text-muted-foreground text-sm mt-1">Click Edit Timetable to create your schedule</p>
        </Card>
      ) : (
        <>
          {/* Grid timetable */}
          <Card className="bg-card border border-border/80 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="p-4 text-left text-muted-foreground font-semibold text-sm w-28 bg-muted/50">Day</th>
                    {Array.from({ length: maxPeriods }, (_, i) => {
                      const periodNum = i + 1;
                      const timing = PERIOD_TIMINGS[periodNum];
                      return (
                        <Fragment key={periodNum}>
                          <th className="p-3 text-center text-muted-foreground font-semibold text-sm min-w-[140px] bg-muted/30">
                            <div className="font-bold text-foreground">Period {periodNum}</div>
                            {timing && (
                              <div className="text-[10px] font-medium text-muted-foreground mt-0.5 flex items-center justify-center gap-1">
                                <Clock className="w-2.5 h-2.5" />
                                {timing}
                              </div>
                            )}
                          </th>
                          {/* Insert Lunch Break column after Period 4 */}
                          {periodNum === 4 && (
                            <th className="p-3 text-center min-w-[110px] bg-amber-500/8 border-x border-amber-500/20">
                              <div className="text-amber-600 dark:text-amber-400 font-bold text-xs">🍽 Lunch Break</div>
                              <div className="text-[10px] font-medium text-amber-500/80 mt-0.5">12:50 – 1:40 PM</div>
                            </th>
                          )}
                        </Fragment>
                      );
                    })}
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
                        className="border-b border-border/60 hover:bg-muted/40 transition-colors"
                      >
                        <td className="p-4 bg-muted/20">
                          <span className={`font-bold text-sm ${hasClasses ? "text-foreground" : "text-muted-foreground"}`}>
                            {day}
                          </span>
                          {!hasClasses && (
                            <p className="text-xs text-muted-foreground mt-0.5">Free</p>
                          )}
                        </td>
                        {Array.from({ length: maxPeriods }, (_, i) => {
                          const periodNum = i + 1;
                          const slot = slots[i];
                          return (
                            <Fragment key={periodNum}>
                              <td className="p-2">
                                {slot ? (
                                  <div
                                    className={`bg-gradient-to-br ${subjectColorMap[slot.subject] || PERIOD_COLORS[0]} border rounded-lg p-3 text-center shadow-xs`}
                                  >
                                    <p className="text-sm font-bold leading-tight">{slot.subject}</p>
                                  </div>
                                ) : (
                                  <div className="h-12 rounded-lg border border-dashed border-border/60 flex items-center justify-center">
                                    <span className="text-muted-foreground text-xs">—</span>
                                  </div>
                                )}
                              </td>
                              {/* Lunch Break cell after Period 4 */}
                              {periodNum === 4 && (
                                <td className="p-2 bg-amber-500/5 border-x border-amber-500/15">
                                  <div className="h-12 rounded-lg border border-amber-500/30 bg-amber-500/10 flex flex-col items-center justify-center gap-0.5">
                                    <span className="text-amber-600 dark:text-amber-400 text-sm">🍽</span>
                                    <span className="text-amber-600 dark:text-amber-400 text-[10px] font-bold">Lunch</span>
                                  </div>
                                </td>
                              )}
                            </Fragment>
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
          <Card className="bg-card border border-border/80 p-6 shadow-sm">
            <h3 className="text-foreground font-bold mb-4">Subject Legend</h3>
            <div className="flex flex-wrap gap-3">
              {Object.entries(subjectColorMap).map(([subj, cls]) => (
                <div
                  key={subj}
                  className={`bg-gradient-to-r ${cls} border rounded-lg px-4 py-2 text-sm font-bold`}
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
  const renderEditView = () => (
    <Card className="bg-card border border-border/80 p-6 space-y-6 shadow-sm">
      {/* Add a new subject to the palette */}
      <div>
        <Label className="text-foreground font-semibold text-sm mb-2 block">Subject Palette</Label>
        <div className="flex flex-wrap gap-2 mb-3">
          {subjects.map((s) => (
            <span
              key={s}
              className="px-3 py-1 rounded-md bg-[var(--brand-start)]/10 border border-[var(--brand-start)]/30 text-[var(--brand-start)] text-xs font-bold"
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
            className="bg-background border-border focus:border-[var(--brand-start)] text-foreground text-sm"
          />
          <Button
            type="button"
            onClick={addNewSubjectToList}
            size="sm"
            variant="outline"
            className="border-border bg-transparent text-[var(--brand-start)] hover:bg-[var(--brand-start)]/10"
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
            <div key={day} className="p-4 rounded-xl bg-muted/40 border border-border/60 space-y-3">
              <div className="flex items-center justify-between border-b border-border/60 pb-2">
                <Label className="text-[var(--brand-start)] font-bold text-base">{day}</Label>
                <span className="text-xs text-muted-foreground font-semibold uppercase tracking-widest">{daySlots.length} Slots</span>
              </div>

              {/* Current slots */}
              {daySlots.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {daySlots.map((slot, idx) => (
                    <div
                      key={`${day}-${idx}`}
                      className="group flex items-center gap-1.5 pl-3 pr-1 py-1 rounded-full bg-[var(--brand-start)]/10 border border-[var(--brand-start)]/30 text-foreground text-sm font-semibold"
                    >
                      <span className="text-[10px] font-bold text-[var(--brand-start)]">P{slot.period}</span>
                      <span className="font-medium">{slot.subject}</span>
                      <button
                        type="button"
                        onClick={() => removeSlot(day, idx)}
                        className="p-1 rounded-full hover:bg-muted text-muted-foreground hover:text-red-500 transition-colors"
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
                    className="px-3 py-1.5 rounded-md border border-border bg-card text-foreground text-xs font-semibold hover:border-[var(--brand-start)] hover:text-[var(--brand-start)] transition-all flex items-center gap-1.5 shadow-2xs"
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
          className="text-red-500 hover:text-red-600 hover:bg-red-500/10 font-bold"
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
          <h1 className="text-3xl md:text-4xl mb-2 text-foreground font-black">
            Weekly Timetable
          </h1>
          <p className="text-muted-foreground text-lg">Your class schedule at a glance</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {editMode ? (
            <>
              <Button
                onClick={cancelEdit}
                variant="outline"
                className="border-border bg-card text-foreground hover:bg-muted font-bold"
              >
                <X className="w-4 h-4 mr-1.5" />
                Cancel
              </Button>
              <Button
                onClick={saveEdit}
                className="bg-[var(--brand-start)] hover:bg-amber-600 text-white font-bold"
              >
                <Save className="w-4 h-4 mr-1.5" />
                Save Timetable
              </Button>
            </>
          ) : (
            <Button
              onClick={enterEditMode}
              className="bg-[var(--brand-start)]/10 border border-[var(--brand-start)]/40 text-[var(--brand-start)] hover:bg-[var(--brand-start)]/20 font-bold"
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
            <Card key={label} className="bg-card border border-border/80 p-4 flex items-center gap-4 shadow-sm">
              <div className="w-10 h-10 rounded-lg bg-[var(--brand-start)]/10 border border-[var(--brand-start)]/20 flex items-center justify-center flex-shrink-0">
                <Icon className="w-5 h-5 text-[var(--brand-start)]" />
              </div>
              <div>
                <p className="text-2xl font-black text-foreground">{value}</p>
                <p className="text-xs text-muted-foreground font-semibold">{label}</p>
              </div>
            </Card>
          ))}
        </div>
      )}

      {editMode ? renderEditView() : renderReadView()}
    </div>
  );
}
