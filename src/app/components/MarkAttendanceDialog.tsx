import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { CheckCircle, XCircle, Ban, BookOpen, Plus, Trash2, Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { logActivity } from "../../lib/activityTracker";
import { getHolidayInfo } from "../../lib/academicUtils";

interface TimetableSlot {
  day: string;
  subject: string;
  period: number;
  faculty?: string;
}

type SlotStatus = "attended" | "absent" | "cancelled";

interface SlotState {
  id: string; // unique ID for React rendering
  subject: string;
  period: number;
  status: SlotStatus;
  faculty: string;
  notes: string;
  isManual?: boolean;
}

interface MarkAttendanceDialogProps {
  open: boolean;
  onClose: () => void;
}

export function MarkAttendanceDialog({ open, onClose }: MarkAttendanceDialogProps) {
  const [selectedDateStr, setSelectedDateStr] = useState<string>(
    format(new Date(), "yyyy-MM-dd")
  );
  const [slots, setSlots] = useState<SlotState[]>([]);
  const [semesterDuration, setSemesterDuration] = useState<string>("");
  const [allSubjects, setAllSubjects] = useState<{ id: string; name: string }[]>([]);
  const [showAddSubjectDropdown, setShowAddSubjectDropdown] = useState<boolean>(false);
  const [newSlotSubject, setNewSlotSubject] = useState<string>("");

  useEffect(() => {
    if (open) {
      loadSemesterInfo();
      loadAllSubjects();
      loadSubjectsForDateStr(selectedDateStr);
    }
  }, [open]);

  useEffect(() => {
    if (selectedDateStr) {
      loadSubjectsForDateStr(selectedDateStr);
    }
  }, [selectedDateStr]);

  const loadSemesterInfo = () => {
    const profile = JSON.parse(localStorage.getItem("student_profile") || "null");
    if (profile?.semesterStartDate && profile?.semesterEndDate) {
      try {
        const start = new Date(profile.semesterStartDate);
        const end = new Date(profile.semesterEndDate);
        const startStr = format(start, "MMM d, yyyy");
        const endStr = format(end, "MMM d, yyyy");
        setSemesterDuration(`${startStr} → ${endStr}`);
      } catch {
        setSemesterDuration("");
      }
    } else {
      setSemesterDuration("");
    }
  };

  const loadAllSubjects = () => {
    const subjectsStr = localStorage.getItem("subjects");
    if (subjectsStr) {
      try {
        const subs = JSON.parse(subjectsStr);
        setAllSubjects(subs);
        if (subs.length > 0) setNewSlotSubject(subs[0].name);
      } catch {}
    }
  };

  const loadSubjectsForDateStr = (dateStr: string) => {
    if (!dateStr) return;
    const parts = dateStr.split("-").map(Number);
    if (parts.length !== 3) return;
    const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
    const dayName = format(dateObj, "EEEE");

    const timetableStr = localStorage.getItem("timetable");
    const timetable: TimetableSlot[] = timetableStr ? JSON.parse(timetableStr) : [];
    const daySlots = timetable
      .filter((slot) => slot.day === dayName)
      .sort((a, b) => a.period - b.period);

    // Existing attendance records for this date
    const existingRecords = JSON.parse(localStorage.getItem("attendance_records") || "[]");
    const existingRecord = existingRecords.find((r: any) => r.date === dateStr);

    const initialSlots: SlotState[] = [];
    const processedKeys = new Set<string>();

    // 1. Process Timetable slots
    daySlots.forEach((slot) => {
      const key = `${slot.subject}-${slot.period}`;
      processedKeys.add(key);

      let existingStatus: SlotStatus = "absent";
      let existingFaculty = slot.faculty || "";
      let existingNotes = "";

      if (existingRecord) {
        if (existingRecord.subjects?.includes(key)) {
          existingStatus = "attended";
        } else if (existingRecord.cancelled?.some((c: any) => c.key === key)) {
          existingStatus = "cancelled";
          const cancelledEntry = existingRecord.cancelled.find((c: any) => c.key === key);
          existingFaculty = cancelledEntry?.faculty || existingFaculty;
          existingNotes = cancelledEntry?.notes || "";
        }
      }

      initialSlots.push({
        id: key,
        subject: slot.subject,
        period: slot.period,
        status: existingStatus,
        faculty: existingFaculty,
        notes: existingNotes,
        isManual: false,
      });
    });

    // 2. Load any extra manual slots previously recorded for this date
    if (existingRecord) {
      if (existingRecord.subjects) {
        existingRecord.subjects.forEach((key: string) => {
          if (!processedKeys.has(key)) {
            const lastDashIndex = key.lastIndexOf("-");
            const subName = lastDashIndex > 0 ? key.substring(0, lastDashIndex) : key;
            const periodNum = lastDashIndex > 0 ? parseInt(key.substring(lastDashIndex + 1)) || 1 : 1;
            
            initialSlots.push({
              id: key,
              subject: subName,
              period: periodNum,
              status: "attended",
              faculty: "",
              notes: "",
              isManual: true,
            });
            processedKeys.add(key);
          }
        });
      }

      if (existingRecord.cancelled) {
        existingRecord.cancelled.forEach((c: any) => {
          if (c.key && !processedKeys.has(c.key)) {
            const lastDashIndex = c.key.lastIndexOf("-");
            const subName = c.subject || (lastDashIndex > 0 ? c.key.substring(0, lastDashIndex) : c.key);
            const periodNum = c.period || (lastDashIndex > 0 ? parseInt(c.key.substring(lastDashIndex + 1)) || 1 : 1);

            initialSlots.push({
              id: c.key,
              subject: subName,
              period: periodNum,
              status: "cancelled",
              faculty: c.faculty || "",
              notes: c.notes || "",
              isManual: true,
            });
            processedKeys.add(c.key);
          }
        });
      }

      // Restore absent manual slots (extra classes that were added but marked absent)
      if (existingRecord.absentManual) {
        existingRecord.absentManual.forEach((a: any) => {
          if (a.key && !processedKeys.has(a.key)) {
            initialSlots.push({
              id: a.key,
              subject: a.subject,
              period: a.period,
              status: "absent",
              faculty: "",
              notes: "",
              isManual: true,
            });
            processedKeys.add(a.key);
          }
        });
      }
    }

    setSlots(initialSlots);
  };

  const updateSlot = (idx: number, field: keyof SlotState, value: string) => {
    setSlots((prev) => prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s)));
  };

  const setSlotStatus = (idx: number, status: SlotStatus) => {
    setSlots((prev) => prev.map((s, i) => (i === idx ? { ...s, status } : s)));
  };

  const handleAddManualSlot = () => {
    if (!newSlotSubject) {
      toast.error("Please select a subject to add");
      return;
    }

    // Find next available period number for this subject
    const subjectSlots = slots.filter((s) => s.subject === newSlotSubject);
    const maxPeriod = subjectSlots.length > 0 ? Math.max(...subjectSlots.map((s) => s.period)) : 0;
    const nextPeriod = maxPeriod + 1;
    const key = `${newSlotSubject}-${nextPeriod}`;

    const newSlot: SlotState = {
      id: `${key}-${Date.now()}`,
      subject: newSlotSubject,
      period: nextPeriod,
      status: "attended",
      faculty: "",
      notes: "",
      isManual: true,
    };

    setSlots((prev) => [...prev, newSlot]);
    setShowAddSubjectDropdown(false);
    toast.success(`Added ${newSlotSubject} (Period ${nextPeriod})`);
  };

  const handleRemoveSlot = (idx: number) => {
    setSlots((prev) => prev.filter((_, i) => i !== idx));
  };



  const handleSave = () => {
    const attendanceRecords = JSON.parse(localStorage.getItem("attendance_records") || "[]");
    const parts = selectedDateStr.split("-").map(Number);
    const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);

    const attendedSubjects = slots
      .filter((s) => s.status === "attended")
      .map((s) => `${s.subject}-${s.period}`);

    const cancelledEntries = slots
      .filter((s) => s.status === "cancelled")
      .map((s) => ({
        key: `${s.subject}-${s.period}`,
        subject: s.subject,
        period: s.period,
        faculty: s.faculty,
        notes: s.notes,
        date: selectedDateStr,
        day: format(dateObj, "EEEE"),
      }));

    // Persist absent extra/manual slots explicitly so they count as
    // "conducted but not attended" in computeAttendanceStats.
    // Regular timetable absent slots are already inferred by the stats engine,
    // but manually added extra classes have no timetable entry to infer from.
    const absentManualEntries = slots
      .filter((s) => s.status === "absent" && s.isManual)
      .map((s) => ({
        key: `${s.subject}-${s.period}`,
        subject: s.subject,
        period: s.period,
      }));

    const newRecord = {
      date: selectedDateStr,
      subjects: attendedSubjects,
      cancelled: cancelledEntries,
      absentManual: absentManualEntries,
    };

    const existingIndex = attendanceRecords.findIndex(
      (r: { date: string }) => r.date === selectedDateStr
    );

    if (existingIndex >= 0) {
      attendanceRecords[existingIndex] = newRecord;
    } else {
      attendanceRecords.push(newRecord);
    }

    localStorage.setItem("attendance_records", JSON.stringify(attendanceRecords));
    window.dispatchEvent(new Event("storage"));

    logActivity(
      "ATTENDANCE_RECORDED",
      `Recorded attendance for ${format(dateObj, "MMM dd, yyyy")} — ${attendedSubjects.length} attended, ${cancelledEntries.length} cancelled, ${absentManualEntries.length} absent (extra).`,
      "Attendance",
      undefined,
      undefined,
      "success"
    );

    toast.success(`Attendance saved for ${format(dateObj, "MMM d, yyyy")}!`);
    onClose();
  };


  const statusConfig: Record<SlotStatus, { label: string; icon: any; color: string; ring: string }> = {
    attended: {
      label: "Attended",
      icon: CheckCircle,
      color: "bg-emerald-500/20 border-emerald-500 text-emerald-400",
      ring: "ring-2 ring-emerald-500",
    },
    absent: {
      label: "Absent",
      icon: XCircle,
      color: "bg-red-500/20 border-red-500 text-red-400",
      ring: "ring-2 ring-red-500",
    },
    cancelled: {
      label: "Class Cancelled",
      icon: Ban,
      color: "bg-gray-500/20 border-gray-500 text-gray-400",
      ring: "ring-2 ring-gray-500",
    },
  };

  // Helper date parsing for headers
  const dateParts = selectedDateStr.split("-").map(Number);
  const selectedDateObj = dateParts.length === 3 ? new Date(dateParts[0], dateParts[1] - 1, dateParts[2]) : new Date();
  const formattedDayName = format(selectedDateObj, "EEEE");
  const formattedDateTitle = format(selectedDateObj, "EEEE, MMMM d, yyyy");

  const holidayInfo = getHolidayInfo(selectedDateStr);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#111118] border-gray-800 text-white max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl bg-gradient-to-r from-[var(--brand-start)] to-[var(--brand-end)] bg-clip-text text-transparent">
            Mark Attendance
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Semester Tenure */}
          {semesterDuration && (
            <div className="rounded-lg bg-[var(--brand-start)]/10 border border-[var(--brand-start)]/30 px-4 py-2.5 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[var(--brand-start)] flex-shrink-0" />
              <div>
                <p className="text-[10px] text-[var(--brand-start)] font-bold uppercase tracking-widest">Semester Duration</p>
                <p className="text-white text-sm font-semibold">{semesterDuration}</p>
              </div>
            </div>
          )}

          {/* Date Selector & Quick Shortcuts */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-gray-300 font-semibold flex items-center gap-1.5">
                <CalendarIcon className="w-4 h-4 text-[var(--brand-start)]" />
                Select Date (Any Day)
              </Label>
              <span className="text-xs text-[var(--brand-start)] font-bold">{formattedDateTitle}</span>
            </div>

            {/* Native Date Input */}
            <Input
              type="date"
              value={selectedDateStr}
              onChange={(e) => e.target.value && setSelectedDateStr(e.target.value)}
              className="bg-[#0a0a0f] border-gray-700 text-white focus:border-[var(--brand-start)] h-11 text-base font-semibold cursor-pointer"
            />
          </div>

          {/* Holiday Banner if selected date is a holiday */}
          {holidayInfo.isHoliday && (
            <div className="rounded-xl bg-purple-500/15 border border-purple-500/40 p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-xl flex-shrink-0">
                🎉
              </div>
              <div>
                <p className="text-[10px] text-purple-300 font-bold uppercase tracking-widest">Holiday Notice</p>
                <p className="text-white text-base font-extrabold">
                  {holidayInfo.holidayName ? `Holiday Today: ${holidayInfo.holidayName}` : "Holiday Today"} — No Class
                </p>
                <p className="text-purple-200/80 text-xs mt-0.5">
                  Holiday today so no class scheduled on your calendar.
                </p>
              </div>
            </div>
          )}

          {/* Class Slots Header & Add Class Action */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <Label className="text-gray-300 font-semibold">
                Classes on {formattedDayName} ({format(selectedDateObj, "MMM d")})
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowAddSubjectDropdown(!showAddSubjectDropdown)}
                className="border-[var(--brand-start)]/50 text-[var(--brand-start)] hover:bg-[var(--brand-start)]/10 text-xs h-8 gap-1 font-bold"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Extra Class
              </Button>
            </div>

            {/* Add Extra Class Dropdown */}
            {showAddSubjectDropdown && (
              <div className="p-3.5 rounded-xl bg-gray-900/90 border border-[var(--brand-start)]/40 space-y-3 animate-in fade-in duration-150">
                <p className="text-xs font-bold text-[var(--brand-start)]">Add Extra or Rescheduled Class</p>
                {allSubjects.length > 0 ? (
                  <div className="flex items-center gap-2">
                    <select
                      value={newSlotSubject}
                      onChange={(e) => setNewSlotSubject(e.target.value)}
                      className="flex-1 bg-[#0a0a0f] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:border-[var(--brand-start)] outline-none"
                    >
                      {allSubjects.map((sub) => (
                        <option key={sub.id} value={sub.name}>
                          {sub.name}
                        </option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      onClick={handleAddManualSlot}
                      className="bg-[var(--brand-start)] hover:bg-amber-600 text-white text-xs px-4"
                    >
                      Add
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">No subjects found in profile. Please add subjects first.</p>
                )}
              </div>
            )}

            {slots.length === 0 ? (
              holidayInfo.isHoliday ? (
                <div className="rounded-xl bg-purple-500/10 border border-purple-500/30 p-6 text-center space-y-2">
                  <span className="text-3xl">🎉</span>
                  <h4 className="text-white font-bold text-base">Holiday Today — No Class</h4>
                  <p className="text-purple-300/80 text-xs max-w-sm mx-auto">
                    {holidayInfo.holidayName ? `${holidayInfo.holidayName} is marked on your calendar.` : "This day is marked as a holiday."} Holiday today so no class.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl bg-gray-800/30 border border-gray-700 p-6 text-center space-y-2">
                  <p className="text-gray-400 text-sm">
                    No classes scheduled in your timetable for <strong>{formattedDayName}</strong>.
                  </p>
                  <p className="text-xs text-gray-500">
                    Did you have an extra or rescheduled class? Click <strong>&quot;Add Extra Class&quot;</strong> above to mark attendance.
                  </p>
                </div>
              )
            ) : (
              <div className="space-y-4">
                {slots.map((slot, idx) => {
                  return (
                    <div
                      key={slot.id}
                      className="rounded-xl bg-[#0a0a0f]/60 border border-gray-800 p-4 space-y-3 relative group"
                    >
                      {/* Slot header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="w-7 h-7 rounded-full bg-[var(--brand-start)]/20 border border-[var(--brand-start)]/40 flex items-center justify-center text-[var(--brand-start)] text-xs font-bold flex-shrink-0">
                            P{slot.period}
                          </span>
                          <span className="text-white font-semibold">{slot.subject}</span>
                          {slot.isManual && (
                            <span className="text-[10px] bg-amber-500/20 border border-amber-500/40 text-amber-400 px-2 py-0.5 rounded-full font-bold">
                              Extra Class
                            </span>
                          )}
                        </div>

                        {slot.isManual && (
                          <button
                            type="button"
                            onClick={() => handleRemoveSlot(idx)}
                            className="text-gray-500 hover:text-red-400 transition-colors p-1"
                            title="Remove class slot"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {/* 3-option status buttons */}
                      <div className="grid grid-cols-3 gap-2">
                        {(["attended", "absent", "cancelled"] as SlotStatus[]).map((status) => {
                          const cfg = statusConfig[status];
                          const Icon = cfg.icon;
                          const isActive = slot.status === status;
                          return (
                            <button
                              key={status}
                              type="button"
                              onClick={() => setSlotStatus(idx, status)}
                              className={`flex flex-col items-center gap-1.5 py-2 px-1 rounded-lg border text-xs font-semibold transition-all ${
                                isActive
                                  ? cfg.color + " " + cfg.ring
                                  : "border-gray-700 text-gray-500 hover:border-gray-500 hover:text-gray-300 bg-transparent"
                              }`}
                            >
                              <Icon className={`w-4 h-4 ${isActive ? "" : "opacity-60"}`} />
                              {cfg.label}
                            </button>
                          );
                        })}
                      </div>

                      {/* Cancelled extra info */}
                      {slot.status === "cancelled" && (
                        <div className="space-y-2 pt-1">
                          <Input
                            value={slot.faculty}
                            onChange={(e) => updateSlot(idx, "faculty", e.target.value)}
                            placeholder="Faculty name (optional)"
                            className="bg-[#0a0a0f]/50 border-gray-700 text-white text-sm placeholder:text-gray-600 focus:border-gray-500 h-8"
                          />
                          <Input
                            value={slot.notes}
                            onChange={(e) => updateSlot(idx, "notes", e.target.value)}
                            placeholder="Notes (optional)"
                            className="bg-[#0a0a0f]/50 border-gray-700 text-white text-sm placeholder:text-gray-600 focus:border-gray-500 h-8"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-2 border-t border-gray-800/80">
            <Button
              variant="outline"
              onClick={onClose}
              className="border-gray-700 hover:border-gray-600 bg-transparent text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={slots.length === 0}
              className="bg-[var(--brand-start)] hover:bg-amber-600 text-white shadow-[0_0_20px_rgba(var(--brand-start-rgb),0.3)] font-bold px-6"
            >
              Save Attendance
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
