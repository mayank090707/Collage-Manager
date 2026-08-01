import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Calendar } from "./ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { CalendarIcon, CheckCircle, XCircle, Ban, BookOpen } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { logActivity } from "../../lib/activityTracker";

interface TimetableSlot {
  day: string;
  subject: string;
  period: number;
  faculty?: string;
}

// Status for each class period in the dialog
type SlotStatus = "attended" | "absent" | "cancelled";

interface SlotState {
  subject: string;
  period: number;
  status: SlotStatus;
  faculty: string;
  notes: string;
}

interface MarkAttendanceDialogProps {
  open: boolean;
  onClose: () => void;
}

export function MarkAttendanceDialog({ open, onClose }: MarkAttendanceDialogProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [slots, setSlots] = useState<SlotState[]>([]);
  const [semesterDuration, setSemesterDuration] = useState<string>("");

  useEffect(() => {
    if (open) {
      loadSemesterInfo();
      loadSubjectsForDate(selectedDate);
    }
  }, [open]);

  useEffect(() => {
    if (selectedDate) {
      loadSubjectsForDate(selectedDate);
    }
  }, [selectedDate]);

  const loadSemesterInfo = () => {
    const profile = JSON.parse(localStorage.getItem("student_profile") || "null");
    if (profile?.semesterStartDate && profile?.semesterEndDate) {
      const start = new Date(profile.semesterStartDate);
      const end = new Date(profile.semesterEndDate);
      const startStr = format(start, "MMM d, yyyy");
      const endStr = format(end, "MMM d, yyyy");
      setSemesterDuration(`${startStr} → ${endStr}`);
    } else {
      setSemesterDuration("");
    }
  };

  const loadSubjectsForDate = (date: Date) => {
    const dayName = format(date, "EEEE");
    const timetableStr = localStorage.getItem("timetable");
    if (timetableStr) {
      const timetable: TimetableSlot[] = JSON.parse(timetableStr);
      const daySlots = timetable
        .filter((slot) => slot.day === dayName)
        .sort((a, b) => a.period - b.period);

      // Load existing record for this date if any
      const existingRecords = JSON.parse(localStorage.getItem("attendance_records") || "[]");
      const existingRecord = existingRecords.find(
        (r: any) => r.date === format(date, "yyyy-MM-dd")
      );

      const initialSlots: SlotState[] = daySlots.map((slot) => {
        // Check if there's existing status for this slot
        const key = `${slot.subject}-${slot.period}`;
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

        return {
          subject: slot.subject,
          period: slot.period,
          status: existingStatus,
          faculty: existingFaculty,
          notes: existingNotes,
        };
      });

      setSlots(initialSlots);
    } else {
      setSlots([]);
    }
  };

  const updateSlot = (idx: number, field: keyof SlotState, value: string) => {
    setSlots((prev) => prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s)));
  };

  const setSlotStatus = (idx: number, status: SlotStatus) => {
    setSlots((prev) => prev.map((s, i) => (i === idx ? { ...s, status } : s)));
  };

  const handleSave = () => {
    const attendanceRecords = JSON.parse(localStorage.getItem("attendance_records") || "[]");
    const dateStr = format(selectedDate, "yyyy-MM-dd");

    // Build subjects (attended) and cancelled arrays
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
        date: dateStr,
        day: format(selectedDate, "EEEE"),
      }));

    const newRecord = {
      date: dateStr,
      subjects: attendedSubjects,
      cancelled: cancelledEntries,
    };

    const existingIndex = attendanceRecords.findIndex(
      (r: { date: string }) => r.date === dateStr
    );

    if (existingIndex >= 0) {
      attendanceRecords[existingIndex] = newRecord;
    } else {
      attendanceRecords.push(newRecord);
    }

    localStorage.setItem("attendance_records", JSON.stringify(attendanceRecords));

    logActivity(
      "ATTENDANCE_RECORDED",
      `Recorded attendance for ${format(selectedDate, "MMM dd, yyyy")} — ${attendedSubjects.length} attended, ${cancelledEntries.length} cancelled.`,
      "Attendance",
      undefined,
      undefined,
      "success"
    );

    toast.success("Attendance saved!");
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

          {/* Date Selector */}
          <div className="space-y-2">
            <Label className="text-gray-300 font-semibold">Select Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start bg-[#0a0a0f]/50 border-gray-700 hover:border-[var(--brand-start)] text-white"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "EEEE, PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-[#111118] border-gray-700">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  initialFocus
                  className="text-white"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Class Slots */}
          <div className="space-y-3">
            <Label className="text-gray-300 font-semibold">
              Classes on {format(selectedDate, "EEEE")}
            </Label>

            {slots.length === 0 ? (
              <div className="rounded-lg bg-gray-800/40 border border-gray-700 p-6 text-center">
                <p className="text-gray-400 text-sm">No classes scheduled for this day in your timetable.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {slots.map((slot, idx) => {
                  const key = `${slot.subject}-${slot.period}`;
                  return (
                    <div
                      key={key}
                      className="rounded-xl bg-[#0a0a0f]/60 border border-gray-800 p-4 space-y-3"
                    >
                      {/* Slot header */}
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-full bg-[var(--brand-start)]/20 border border-[var(--brand-start)]/40 flex items-center justify-center text-[var(--brand-start)] text-xs font-bold flex-shrink-0">
                          P{slot.period}
                        </span>
                        <span className="text-white font-semibold">{slot.subject}</span>
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
          <div className="flex justify-end space-x-3 pt-2">
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
              className="bg-[var(--brand-start)] hover:bg-amber-600 text-white shadow-[0_0_20px_rgba(var(--brand-start-rgb),0.3)]"
            >
              Save Attendance
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
