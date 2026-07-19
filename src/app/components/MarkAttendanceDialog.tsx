import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Label } from "./ui/label";
import { Calendar } from "./ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface TimetableSlot {
  day: string;
  subject: string;
}

interface MarkAttendanceDialogProps {
  open: boolean;
  onClose: () => void;
}

export function MarkAttendanceDialog({ open, onClose }: MarkAttendanceDialogProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [todaySubjects, setTodaySubjects] = useState<string[]>([]);
  const [attendance, setAttendance] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (selectedDate) {
      loadSubjectsForDate(selectedDate);
    }
  }, [selectedDate]);

  const loadSubjectsForDate = (date: Date) => {
    const dayName = format(date, "EEEE");
    const timetableStr = localStorage.getItem("timetable");
    if (timetableStr) {
      const timetable: any[] = JSON.parse(timetableStr);
      const daySlots = timetable
        .filter((slot) => slot.day === dayName)
        .sort((a, b) => a.period - b.period);
        
      setTodaySubjects(daySlots.map(s => `${s.subject} (P${s.period})`));

      // Initialize attendance state
      const initialAttendance: Record<string, boolean> = {};
      daySlots.forEach((slot, idx) => {
        initialAttendance[`${slot.subject}-${slot.period}`] = false;
      });
      setAttendance(initialAttendance);
    }
  };

  const handleSave = () => {
    const attendanceRecords = JSON.parse(localStorage.getItem("attendance_records") || "[]");
    const newRecord = {
      date: format(selectedDate, "yyyy-MM-dd"),
      subjects: Object.entries(attendance)
        .filter(([_, present]) => present)
        .map(([key]) => key), // Saves "Math-1", "Math-2", etc.
    };

    // Check if record for this date already exists
    const existingIndex = attendanceRecords.findIndex(
      (r: { date: string }) => r.date === newRecord.date
    );

    if (existingIndex >= 0) {
      attendanceRecords[existingIndex] = newRecord;
    } else {
      attendanceRecords.push(newRecord);
    }

    localStorage.setItem("attendance_records", JSON.stringify(attendanceRecords));
    toast.success("Attendance marked successfully!");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#111118] border-gray-800 text-white max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-2xl bg-gradient-to-r from-[#00d4ff] to-[#a855f7] bg-clip-text text-transparent">
            Mark Attendance
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Date Selector */}
          <div className="space-y-2">
            <Label className="text-gray-300">Select Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start bg-[#0a0a0f]/50 border-gray-700 hover:border-[#00d4ff] text-white"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "PPP") : "Pick a date"}
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

          {/* Today's Subjects */}
          <div className="space-y-4">
            <Label className="text-gray-300">
              Classes on {format(selectedDate, "EEEE")}
            </Label>

            {todaySubjects.length === 0 ? (
              <p className="text-gray-400 text-sm">No classes scheduled for this day</p>
            ) : (
              <div className="space-y-3">
                {todaySubjects.map((displayLabel, idx) => {
                  // todaySubjects is ["Math (P1)", "Math (P2)"]
                  // attendance keys are "Math-1", "Math-2"
                  const match = displayLabel.match(/^(.*) \(P(\d+)\)$/);
                  const key = match ? `${match[1]}-${match[2]}` : displayLabel;
                  
                  return (
                    <div
                      key={key}
                      className="flex items-center space-x-3 p-4 rounded-lg bg-[#0a0a0f]/50 border border-gray-800 hover:border-gray-700 transition-colors"
                    >
                      <Checkbox
                        id={key}
                        checked={attendance[key] || false}
                        onCheckedChange={(checked) =>
                          setAttendance({ ...attendance, [key]: checked as boolean })
                        }
                        className="border-gray-600 data-[state=checked]:bg-[#00d4ff] data-[state=checked]:border-[#00d4ff]"
                      />
                      <Label
                        htmlFor={key}
                        className="flex-1 cursor-pointer text-white"
                      >
                        {displayLabel}
                      </Label>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-4">
            <Button
              variant="outline"
              onClick={onClose}
              className="border-gray-700 hover:border-gray-600 bg-transparent text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={todaySubjects.length === 0}
              className="bg-gradient-to-r from-[#00d4ff] to-[#a855f7] hover:from-[#00ffff] hover:to-[#8b5cf6] text-white shadow-[0_0_20px_rgba(0,212,255,0.3)]"
            >
              Save Attendance
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
