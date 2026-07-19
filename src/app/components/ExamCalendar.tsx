import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import {
  ArrowLeft, ChevronLeft, ChevronRight, Plus, Pencil, Trash2,
  CalendarDays, Clock, Flame, AlertTriangle, Settings, Check, X
} from "lucide-react";
import {
  format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameDay, isToday, isWithinInterval, parseISO, differenceInDays,
  eachMonthOfInterval, isSameMonth, getYear, getMonth,
} from "date-fns";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SemesterConfig {
  semester: number;
  startDate: string; // "YYYY-MM-DD" first day of start month
  endDate: string;   // "YYYY-MM-DD" last day of end month
}

type ExamType = "midsem1" | "midsem2" | "endsem";

interface ExamPeriod {
  type: ExamType;
  label: string;
  startDate: string | null;
  endDate: string | null;
}

interface DayEvent {
  id: string;
  date: string; // "YYYY-MM-DD"
  label: string;
  examType: ExamType | "custom";
}

// ─── Constants ────────────────────────────────────────────────────────────────

const EXAM_META: Record<ExamType, { label: string; color: string; bg: string; border: string; dot: string; glow: string }> = {
  midsem1: {
    label: "Mid Semester 1",
    color: "text-[#00d4ff]",
    bg: "bg-[#00d4ff]/20",
    border: "border-[#00d4ff]/50",
    dot: "bg-[#00d4ff]",
    glow: "shadow-[0_0_10px_rgba(0,212,255,0.4)]",
  },
  midsem2: {
    label: "Mid Semester 2",
    color: "text-[#a855f7]",
    bg: "bg-[#a855f7]/20",
    border: "border-[#a855f7]/50",
    dot: "bg-[#a855f7]",
    glow: "shadow-[0_0_10px_rgba(168,85,247,0.4)]",
  },
  endsem: {
    label: "End Semester",
    color: "text-orange-400",
    bg: "bg-orange-500/20",
    border: "border-orange-500/50",
    dot: "bg-orange-400",
    glow: "shadow-[0_0_10px_rgba(249,115,22,0.4)]",
  },
};

const CUSTOM_EVENT_COLORS = ["bg-emerald-400", "bg-pink-400", "bg-yellow-400", "bg-sky-400", "bg-rose-400"];
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const YEARS = [2022, 2023, 2024, 2025, 2026, 2027, 2028];

function makeDate(year: number, month: number, day: number) {
  return format(new Date(year, month, day), "yyyy-MM-dd");
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ExamCalendar() {
  const navigate = useNavigate();

  // Persistence keys
  const STORAGE_KEY = "exam_calendar_v2";

  const loadState = () => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); } catch { return null; }
  };

  const [semConfig, setSemConfig] = useState<SemesterConfig | null>(null);
  const [examPeriods, setExamPeriods] = useState<ExamPeriod[]>([
    { type: "midsem1", label: "Mid Semester 1", startDate: null, endDate: null },
    { type: "midsem2", label: "Mid Semester 2", startDate: null, endDate: null },
    { type: "endsem",  label: "End Semester",   startDate: null, endDate: null },
  ]);
  const [dayEvents, setDayEvents] = useState<DayEvent[]>([]);

  // Setup form state
  const [setupSem, setSetupSem] = useState("1");
  const [setupStartMonth, setSetupStartMonth] = useState(7);  // July (0-indexed)
  const [setupStartYear, setSetupStartYear] = useState(2024);
  const [setupEndMonth, setSetupEndMonth] = useState(11);     // December
  const [setupEndYear, setSetupEndYear] = useState(2024);

  // Exam period dialog
  const [editingPeriod, setEditingPeriod] = useState<ExamType | null>(null);
  const [periodForm, setPeriodForm] = useState({ startDate: "", endDate: "" });

  // Day event state
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dayForm, setDayForm] = useState({ label: "", examType: "custom" as ExamType | "custom" });
  const [editingEvent, setEditingEvent] = useState<DayEvent | null>(null);

  // Calendar scroll
  const [viewMonth, setViewMonth] = useState(0); // index into semester months

  useEffect(() => {
    const saved = loadState();
    if (saved) {
      setSemConfig(saved.semConfig);
      setExamPeriods(saved.examPeriods);
      setDayEvents(saved.dayEvents || []);
    }
  }, []);

  const persist = (config: SemesterConfig, periods: ExamPeriod[], events: DayEvent[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ semConfig: config, examPeriods: periods, dayEvents: events }));
  };

  // ── Setup submit ────────────────────────────────────────────────────────────
  const handleSetupSubmit = () => {
    if (setupStartYear > setupEndYear || (setupStartYear === setupEndYear && setupStartMonth > setupEndMonth)) {
      toast.error("End month must be after start month");
      return;
    }
    const startDate = makeDate(setupStartYear, setupStartMonth, 1);
    const endDateObj = endOfMonth(new Date(setupEndYear, setupEndMonth, 1));
    const endDate = format(endDateObj, "yyyy-MM-dd");
    const config: SemesterConfig = { semester: parseInt(setupSem), startDate, endDate };
    const fresh: ExamPeriod[] = [
      { type: "midsem1", label: "Mid Semester 1", startDate: null, endDate: null },
      { type: "midsem2", label: "Mid Semester 2", startDate: null, endDate: null },
      { type: "endsem",  label: "End Semester",   startDate: null, endDate: null },
    ];
    setSemConfig(config);
    setExamPeriods(fresh);
    setDayEvents([]);
    persist(config, fresh, []);
    toast.success("Semester configured!");
  };

  // ── Get all months in semester ──────────────────────────────────────────────
  const semesterMonths: Date[] = semConfig
    ? eachMonthOfInterval({ start: parseISO(semConfig.startDate), end: parseISO(semConfig.endDate) })
    : [];

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const getExamTypeForDate = (dateStr: string): ExamType | null => {
    for (const period of examPeriods) {
      if (!period.startDate || !period.endDate) continue;
      try {
        if (isWithinInterval(parseISO(dateStr), { start: parseISO(period.startDate), end: parseISO(period.endDate) })) {
          return period.type;
        }
      } catch {}
    }
    return null;
  };

  const getEventsOnDate = (dateStr: string) => dayEvents.filter((e) => e.date === dateStr);

  // ── Save exam period ────────────────────────────────────────────────────────
  const handleSavePeriod = () => {
    if (!periodForm.startDate || !periodForm.endDate) {
      toast.error("Please set both start and end dates");
      return;
    }
    if (periodForm.startDate > periodForm.endDate) {
      toast.error("End date must be after start date");
      return;
    }
    const updated = examPeriods.map((p) =>
      p.type === editingPeriod ? { ...p, startDate: periodForm.startDate, endDate: periodForm.endDate } : p
    );
    setExamPeriods(updated);
    persist(semConfig!, updated, dayEvents);
    setEditingPeriod(null);
    toast.success(`${EXAM_META[editingPeriod!].label} dates set!`);
  };

  const clearPeriod = (type: ExamType) => {
    const updated = examPeriods.map((p) => p.type === type ? { ...p, startDate: null, endDate: null } : p);
    setExamPeriods(updated);
    persist(semConfig!, updated, dayEvents);
    toast.success("Exam period cleared");
  };

  // ── Day event actions ───────────────────────────────────────────────────────
  const handleSaveDayEvent = () => {
    if (!dayForm.label.trim()) {
      toast.error("Please enter a label");
      return;
    }
    let updated: DayEvent[];
    if (editingEvent) {
      updated = dayEvents.map((e) => e.id === editingEvent.id ? { ...e, label: dayForm.label, examType: dayForm.examType } : e);
    } else {
      const event: DayEvent = {
        id: Date.now().toString(),
        date: selectedDate!,
        label: dayForm.label,
        examType: dayForm.examType,
      };
      updated = [...dayEvents, event];
    }
    setDayEvents(updated);
    persist(semConfig!, examPeriods, updated);
    setSelectedDate(null);
    setEditingEvent(null);
    setDayForm({ label: "", examType: "custom" });
    toast.success("Event saved!");
  };

  const handleDeleteEvent = (id: string) => {
    const updated = dayEvents.filter((e) => e.id !== id);
    setDayEvents(updated);
    persist(semConfig!, examPeriods, updated);
    toast.success("Event removed");
  };

  const openDayDialog = (dateStr: string) => {
    setSelectedDate(dateStr);
    setEditingEvent(null);
    setDayForm({ label: "", examType: getExamTypeForDate(dateStr) || "custom" });
  };

  const openEditEvent = (event: DayEvent) => {
    setSelectedDate(event.date);
    setEditingEvent(event);
    setDayForm({ label: event.label, examType: event.examType });
  };

  // ── Upcoming exams ──────────────────────────────────────────────────────────
  const upcomingExamEvents = dayEvents
    .filter((e) => e.examType !== "custom" && differenceInDays(parseISO(e.date), new Date()) >= 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  // ─── SETUP SCREEN ───────────────────────────────────────────────────────────
  if (!semConfig) {
    return (
      <div className="p-8 max-w-2xl mx-auto space-y-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate("/app/exams")} className="text-gray-400 hover:text-white hover:bg-gray-800/50">
            <ArrowLeft className="w-4 h-4 mr-2" />Back
          </Button>
          <div>
            <h1 className="text-4xl bg-gradient-to-r from-[#00d4ff] via-white to-[#a855f7] bg-clip-text text-transparent">
              Exam Calendar
            </h1>
            <p className="text-gray-400 mt-1">Set up your semester to get started</p>
          </div>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="bg-[#111118]/80 backdrop-blur-xl border-gray-800/50 p-8 space-y-8">
            {/* Step indicator */}
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-[#00d4ff] to-[#a855f7] flex items-center justify-center text-white text-sm font-bold">1</div>
              <h2 className="text-xl font-bold text-white">Semester Details</h2>
            </div>

            {/* Semester number */}
            <div className="space-y-2">
              <Label className="text-gray-300 font-semibold">Which Semester?</Label>
              <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
                {[1,2,3,4,5,6,7,8].map((s) => (
                  <button
                    key={s}
                    onClick={() => setSetupSem(s.toString())}
                    className={`py-3 rounded-xl border text-sm font-bold transition-all ${
                      setupSem === s.toString()
                        ? "bg-gradient-to-r from-[#00d4ff]/30 to-[#a855f7]/30 border-[#00d4ff] text-white shadow-[0_0_12px_rgba(0,212,255,0.3)]"
                        : "border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white"
                    }`}
                  >
                    Sem {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-gray-800/50" />

            {/* Start month/year */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-[#00d4ff]" />
                <Label className="text-gray-300 font-semibold">Semester Start</Label>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-gray-500 text-xs">Month</Label>
                  <Select value={setupStartMonth.toString()} onValueChange={(v) => setSetupStartMonth(parseInt(v))}>
                    <SelectTrigger className="bg-[#0a0a0f]/50 border-gray-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#111118] border-gray-700 text-white">
                      {MONTHS.map((m, i) => <SelectItem key={i} value={i.toString()}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-gray-500 text-xs">Year</Label>
                  <Select value={setupStartYear.toString()} onValueChange={(v) => setSetupStartYear(parseInt(v))}>
                    <SelectTrigger className="bg-[#0a0a0f]/50 border-gray-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#111118] border-gray-700 text-white">
                      {YEARS.map((y) => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* End month/year */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-[#a855f7]" />
                <Label className="text-gray-300 font-semibold">Semester End</Label>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-gray-500 text-xs">Month</Label>
                  <Select value={setupEndMonth.toString()} onValueChange={(v) => setSetupEndMonth(parseInt(v))}>
                    <SelectTrigger className="bg-[#0a0a0f]/50 border-gray-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#111118] border-gray-700 text-white">
                      {MONTHS.map((m, i) => <SelectItem key={i} value={i.toString()}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-gray-500 text-xs">Year</Label>
                  <Select value={setupEndYear.toString()} onValueChange={(v) => setSetupEndYear(parseInt(v))}>
                    <SelectTrigger className="bg-[#0a0a0f]/50 border-gray-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#111118] border-gray-700 text-white">
                      {YEARS.map((y) => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Preview */}
            <div className="rounded-xl bg-[#0a0a0f]/60 border border-gray-800/60 p-4 flex items-center justify-between">
              <span className="text-gray-400 text-sm">Semester duration</span>
              <span className="text-white font-semibold">
                {MONTHS[setupStartMonth]} {setupStartYear} → {MONTHS[setupEndMonth]} {setupEndYear}
              </span>
            </div>

            <Button
              onClick={handleSetupSubmit}
              className="w-full h-12 bg-gradient-to-r from-[#00d4ff] to-[#a855f7] hover:from-[#00ffff] hover:to-[#8b5cf6] text-white font-semibold shadow-[0_0_20px_rgba(0,212,255,0.3)]"
            >
              Create Semester Calendar →
            </Button>
          </Card>
        </motion.div>
      </div>
    );
  }

  // ─── CALENDAR VIEW ──────────────────────────────────────────────────────────
  const currentMonthData = semesterMonths[viewMonth] ?? semesterMonths[0];

  const getCalendarDays = (monthDate: Date) => {
    const start = startOfMonth(monthDate);
    const end = endOfMonth(monthDate);
    const days = eachDayOfInterval({ start, end });
    return Array(start.getDay()).fill(null).concat(days);
  };

  return (
    <div className="p-8 space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center gap-4 flex-wrap">
        <Button variant="ghost" onClick={() => navigate("/app/exams")} className="text-gray-400 hover:text-white hover:bg-gray-800/50">
          <ArrowLeft className="w-4 h-4 mr-2" />Back
        </Button>
        <div className="flex-1">
          <h1 className="text-4xl bg-gradient-to-r from-[#00d4ff] via-white to-[#a855f7] bg-clip-text text-transparent">
            Semester {semConfig.semester} Calendar
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {format(parseISO(semConfig.startDate), "MMMM yyyy")} — {format(parseISO(semConfig.endDate), "MMMM yyyy")}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => { setSemConfig(null); localStorage.removeItem(STORAGE_KEY); }}
          className="border-gray-700 bg-transparent text-gray-400 hover:text-white hover:border-gray-500"
        >
          <Settings className="w-4 h-4 mr-2" />
          Reconfigure
        </Button>
      </div>

      {/* ── Exam Type Cards ── */}
      <div className="grid md:grid-cols-3 gap-4">
        {examPeriods.map((period) => {
          const meta = EXAM_META[period.type];
          return (
            <motion.div key={period.type} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card className={`${meta.bg} border ${meta.border} p-5 relative overflow-hidden`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className={`flex items-center gap-2 mb-1`}>
                      <div className={`w-3 h-3 rounded-full ${meta.dot}`} />
                      <p className={`text-sm font-bold ${meta.color}`}>{meta.label}</p>
                    </div>
                    {period.startDate && period.endDate ? (
                      <p className="text-white text-sm font-medium">
                        {format(parseISO(period.startDate), "MMM d")} — {format(parseISO(period.endDate), "MMM d, yyyy")}
                      </p>
                    ) : (
                      <p className="text-gray-500 text-sm">Dates not set</p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditingPeriod(period.type);
                        setPeriodForm({
                          startDate: period.startDate || semConfig.startDate,
                          endDate: period.endDate || semConfig.startDate,
                        });
                      }}
                      className={`w-8 h-8 ${meta.color} hover:bg-white/10`}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    {period.startDate && (
                      <Button variant="ghost" size="icon" onClick={() => clearPeriod(period.type)} className="w-8 h-8 text-gray-500 hover:text-red-400 hover:bg-red-500/10">
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
                {period.startDate && period.endDate && (
                  <div className={`text-xs ${meta.color} bg-black/20 rounded-lg px-3 py-1.5`}>
                    {differenceInDays(parseISO(period.endDate), parseISO(period.startDate)) + 1} days · {dayEvents.filter((e) => e.examType === period.type).length} exams marked
                  </div>
                )}
                {!period.startDate && (
                  <button
                    onClick={() => {
                      setEditingPeriod(period.type);
                      setPeriodForm({ startDate: semConfig.startDate, endDate: semConfig.startDate });
                    }}
                    className={`text-xs ${meta.color} underline underline-offset-2 hover:no-underline`}
                  >
                    + Set exam dates
                  </button>
                )}
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* ── Legend ── */}
      <div className="flex items-center gap-4 flex-wrap text-xs text-gray-400">
        <span className="font-semibold">Legend:</span>
        {Object.entries(EXAM_META).map(([type, meta]) => (
          <span key={type} className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-sm ${meta.dot}`} />
            {meta.label}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400" />Custom Event
        </span>
        <span className="ml-auto text-gray-500">Click any date to add an event or label</span>
      </div>

      {/* ── Month Navigation ── */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => setViewMonth((v) => Math.max(0, v - 1))}
          disabled={viewMonth === 0}
          className="text-gray-400 hover:text-white disabled:opacity-30"
        >
          <ChevronLeft className="w-5 h-5 mr-1" />Prev Month
        </Button>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {semesterMonths.map((m, i) => (
            <button
              key={i}
              onClick={() => setViewMonth(i)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                viewMonth === i
                  ? "bg-gradient-to-r from-[#00d4ff]/20 to-[#a855f7]/20 border border-[#00d4ff]/50 text-white"
                  : "text-gray-500 hover:text-gray-300 hover:bg-gray-800/40"
              }`}
            >
              {format(m, "MMM")}
            </button>
          ))}
        </div>
        <Button
          variant="ghost"
          onClick={() => setViewMonth((v) => Math.min(semesterMonths.length - 1, v + 1))}
          disabled={viewMonth === semesterMonths.length - 1}
          className="text-gray-400 hover:text-white disabled:opacity-30"
        >
          Next Month<ChevronRight className="w-5 h-5 ml-1" />
        </Button>
      </div>

      {/* ── Calendar Grid ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={viewMonth}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          <Card className="bg-[#111118]/80 backdrop-blur-xl border-gray-800/50 overflow-hidden">
            {/* Month header */}
            <div className="px-6 py-4 border-b border-gray-800/50 bg-[#0a0a0f]/40 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">{format(currentMonthData, "MMMM yyyy")}</h2>
              <span className="text-xs text-gray-500 bg-gray-800/60 px-3 py-1 rounded-full">
                Semester {semConfig.semester}
              </span>
            </div>

            <div className="p-5">
              {/* Weekday headers */}
              <div className="grid grid-cols-7 mb-2">
                {WEEKDAY_LABELS.map((d) => (
                  <div key={d} className="text-center text-xs font-semibold text-gray-600 py-2 tracking-wider uppercase">{d}</div>
                ))}
              </div>

              {/* Day cells */}
              <div className="grid grid-cols-7 gap-1">
                {getCalendarDays(currentMonthData).map((day, idx) => {
                  if (!day) return <div key={`pad-${idx}`} className="aspect-[1/1.2]" />;

                  const dateStr = format(day, "yyyy-MM-dd");
                  const examType = getExamTypeForDate(dateStr);
                  const events = getEventsOnDate(dateStr);
                  const isCurrentDay = isToday(day);
                  const meta = examType ? EXAM_META[examType] : null;

                  return (
                    <motion.button
                      key={dateStr}
                      onClick={() => openDayDialog(dateStr)}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      className={`relative rounded-xl p-1.5 flex flex-col items-center min-h-[72px] border transition-all text-left ${
                        examType && meta
                          ? `${meta.bg} border ${meta.border} ${meta.glow}`
                          : isCurrentDay
                          ? "bg-[#00d4ff]/5 border border-[#00d4ff]/30"
                          : "border border-transparent hover:bg-gray-800/30 hover:border-gray-700/50"
                      }`}
                    >
                      {/* Date number */}
                      <span
                        className={`text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full mb-1 ${
                          isCurrentDay
                            ? "bg-[#00d4ff] text-[#0a0a0f]"
                            : examType && meta
                            ? meta.color
                            : "text-gray-300"
                        }`}
                      >
                        {format(day, "d")}
                      </span>

                      {/* Exam type label */}
                      {examType && meta && (
                        <span className={`text-[9px] font-semibold ${meta.color} leading-tight text-center px-1`}>
                          {examType === "midsem1" ? "MID-1" : examType === "midsem2" ? "MID-2" : "END"}
                        </span>
                      )}

                      {/* Day events */}
                      {events.slice(0, 2).map((ev, i) => {
                        const evMeta = ev.examType !== "custom" ? EXAM_META[ev.examType as ExamType] : null;
                        return (
                          <div
                            key={ev.id}
                            onClick={(e) => { e.stopPropagation(); openEditEvent(ev); }}
                            className={`w-full mt-0.5 px-1 py-0.5 rounded text-[9px] font-medium truncate leading-tight ${
                              evMeta
                                ? `${evMeta.bg} ${evMeta.color}`
                                : "bg-emerald-500/20 text-emerald-300"
                            }`}
                          >
                            {ev.label}
                          </div>
                        );
                      })}
                      {events.length > 2 && (
                        <span className="text-[9px] text-gray-500 mt-0.5">+{events.length - 2} more</span>
                      )}

                      {/* Add icon on hover */}
                      {events.length === 0 && !examType && (
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                          <Plus className="w-4 h-4 text-gray-600" />
                        </div>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </div>
          </Card>
        </motion.div>
      </AnimatePresence>

      {/* ── Upcoming exam events countdown ── */}
      {upcomingExamEvents.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-400" />
            Exam Day Countdown
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {upcomingExamEvents.map((ev, i) => {
              const daysLeft = differenceInDays(parseISO(ev.date), new Date());
              const meta = ev.examType !== "custom" ? EXAM_META[ev.examType as ExamType] : null;
              const urgentBg =
                daysLeft <= 1 ? "from-red-500/25 to-rose-500/25 border-red-500/50" :
                daysLeft <= 3 ? "from-orange-500/25 to-amber-500/25 border-orange-500/50" :
                daysLeft <= 7 ? "from-yellow-500/20 to-amber-400/20 border-yellow-500/40" :
                meta ? `${meta.bg} ${meta.border}` : "from-emerald-500/15 to-teal-500/15 border-emerald-500/30";
              const daysText = daysLeft === 0 ? "Today" : daysLeft === 1 ? "Tomorrow" : `${daysLeft} days`;
              const daysColor = daysLeft <= 1 ? "text-red-400" : daysLeft <= 3 ? "text-orange-400" : daysLeft <= 7 ? "text-yellow-400" : meta ? meta.color : "text-emerald-400";

              return (
                <motion.div
                  key={ev.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Card className={`relative overflow-hidden bg-gradient-to-br ${urgentBg} border p-4`}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      {meta && <span className={`text-[10px] font-bold ${meta.color} bg-black/20 px-2 py-0.5 rounded-full`}>{meta.label}</span>}
                      {daysLeft <= 3 && <Flame className="w-4 h-4 text-orange-400 flex-shrink-0" />}
                    </div>
                    <p className="text-white font-semibold text-sm mb-1 leading-tight">{ev.label}</p>
                    <p className="text-gray-400 text-xs mb-3 flex items-center gap-1">
                      <CalendarDays className="w-3 h-3" />
                      {format(parseISO(ev.date), "EEE, MMM d yyyy")}
                    </p>
                    <div className={`text-3xl font-black ${daysColor} leading-none`}>
                      {daysLeft > 0 ? daysLeft : "0"}
                      <span className="text-sm font-semibold ml-1">{daysLeft === 1 ? "day" : "days"}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{daysText}</p>
                    {/* Bottom urgency bar */}
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black/20">
                      <div
                        className={`h-full transition-all ${daysLeft <= 1 ? "bg-red-500" : daysLeft <= 3 ? "bg-orange-400" : daysLeft <= 7 ? "bg-yellow-400" : meta ? meta.dot : "bg-emerald-400"}`}
                        style={{ width: `${Math.max(4, Math.min(100, 100 - (daysLeft / 60) * 100))}%` }}
                      />
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Set Exam Period Dialog ─── */}
      <Dialog open={editingPeriod !== null} onOpenChange={() => setEditingPeriod(null)}>
        <DialogContent className="bg-[#111118] border-gray-800 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className={`text-xl ${editingPeriod ? EXAM_META[editingPeriod].color : ""}`}>
              Set {editingPeriod ? EXAM_META[editingPeriod].label : ""} Dates
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-gray-400 text-sm">
              Mark the date range when {editingPeriod ? EXAM_META[editingPeriod].label : ""} exams are held. These days will be highlighted on the calendar.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-gray-300">Start Date</Label>
                <Input
                  type="date"
                  value={periodForm.startDate}
                  min={semConfig.startDate}
                  max={semConfig.endDate}
                  onChange={(e) => setPeriodForm({ ...periodForm, startDate: e.target.value })}
                  className="bg-[#0a0a0f]/50 border-gray-700 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300">End Date</Label>
                <Input
                  type="date"
                  value={periodForm.endDate}
                  min={periodForm.startDate || semConfig.startDate}
                  max={semConfig.endDate}
                  onChange={(e) => setPeriodForm({ ...periodForm, endDate: e.target.value })}
                  className="bg-[#0a0a0f]/50 border-gray-700 text-white"
                />
              </div>
            </div>
            {periodForm.startDate && periodForm.endDate && (
              <div className={`rounded-lg px-4 py-3 ${editingPeriod ? EXAM_META[editingPeriod].bg : ""} border ${editingPeriod ? EXAM_META[editingPeriod].border : ""} text-sm`}>
                <span className="text-gray-300">Duration: </span>
                <span className="text-white font-semibold">
                  {differenceInDays(parseISO(periodForm.endDate), parseISO(periodForm.startDate)) + 1} days
                </span>
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setEditingPeriod(null)} className="flex-1 border-gray-700 bg-transparent text-white">
                Cancel
              </Button>
              <Button onClick={handleSavePeriod} className={`flex-1 ${editingPeriod ? `bg-gradient-to-r ${editingPeriod === "midsem1" ? "from-[#00d4ff] to-[#0ea5e9]" : editingPeriod === "midsem2" ? "from-[#a855f7] to-[#8b5cf6]" : "from-orange-500 to-amber-500"}` : ""} text-white`}>
                <Check className="w-4 h-4 mr-2" />
                Confirm Dates
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Add / Edit Day Event Dialog ─── */}
      <Dialog open={selectedDate !== null} onOpenChange={() => { setSelectedDate(null); setEditingEvent(null); }}>
        <DialogContent className="bg-[#111118] border-gray-800 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl text-white">
              {selectedDate ? format(parseISO(selectedDate), "EEEE, MMMM d yyyy") : ""}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            {/* Existing events on this date */}
            {selectedDate && getEventsOnDate(selectedDate).length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Events on this day</p>
                {getEventsOnDate(selectedDate).map((ev) => {
                  const evMeta = ev.examType !== "custom" ? EXAM_META[ev.examType as ExamType] : null;
                  return (
                    <div key={ev.id} className={`flex items-center justify-between rounded-lg px-3 py-2 border ${evMeta ? `${evMeta.bg} ${evMeta.border}` : "bg-emerald-500/10 border-emerald-500/20"}`}>
                      <div>
                        <p className={`text-sm font-medium ${evMeta ? evMeta.color : "text-emerald-300"}`}>{ev.label}</p>
                        <p className="text-xs text-gray-500">{evMeta ? evMeta.label : "Custom"}</p>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEditEvent(ev)} className="w-7 h-7 text-gray-400 hover:text-white">
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteEvent(ev.id)} className="w-7 h-7 text-red-400 hover:text-red-300 hover:bg-red-500/10">
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
                <div className="border-t border-gray-800/60 pt-2">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                    {editingEvent ? "Edit event" : "Add another event"}
                  </p>
                </div>
              </div>
            )}

            {/* Exam type for this day (auto-detected) */}
            {selectedDate && getExamTypeForDate(selectedDate) && !editingEvent && (
              <div className={`rounded-lg px-3 py-2 ${EXAM_META[getExamTypeForDate(selectedDate)!].bg} border ${EXAM_META[getExamTypeForDate(selectedDate)!].border} flex items-center gap-2`}>
                <div className={`w-2 h-2 rounded-full ${EXAM_META[getExamTypeForDate(selectedDate)!].dot}`} />
                <span className={`text-xs font-semibold ${EXAM_META[getExamTypeForDate(selectedDate)!].color}`}>
                  This date is within {EXAM_META[getExamTypeForDate(selectedDate)!].label} period
                </span>
              </div>
            )}

            {/* Event label input */}
            <div className="space-y-2">
              <Label className="text-gray-300">Event / Exam Name</Label>
              <Input
                autoFocus
                value={dayForm.label}
                onChange={(e) => setDayForm({ ...dayForm, label: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && handleSaveDayEvent()}
                className="bg-[#0a0a0f]/50 border-gray-700 focus:border-[#00d4ff] text-white"
                placeholder='e.g. "DS Paper", "Holiday", "Assignment Due"'
              />
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label className="text-gray-300">Category</Label>
              <div className="flex gap-2 flex-wrap">
                {[
                  { value: "midsem1", label: "Mid-1" },
                  { value: "midsem2", label: "Mid-2" },
                  { value: "endsem",  label: "End Sem" },
                  { value: "custom",  label: "Other" },
                ].map(({ value, label }) => {
                  const m = value !== "custom" ? EXAM_META[value as ExamType] : null;
                  return (
                    <button
                      key={value}
                      onClick={() => setDayForm({ ...dayForm, examType: value as ExamType | "custom" })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                        dayForm.examType === value
                          ? m ? `${m.bg} ${m.border} ${m.color}` : "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                          : "border-gray-700 text-gray-400 hover:border-gray-500"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <Button variant="outline" onClick={() => { setSelectedDate(null); setEditingEvent(null); }} className="flex-1 border-gray-700 bg-transparent text-white">
                Cancel
              </Button>
              <Button onClick={handleSaveDayEvent} className="flex-1 bg-gradient-to-r from-[#00d4ff] to-[#a855f7] text-white">
                <Check className="w-4 h-4 mr-1" />
                {editingEvent ? "Update" : "Add Event"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
