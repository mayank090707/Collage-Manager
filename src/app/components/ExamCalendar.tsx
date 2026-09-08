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
import { getUnifiedUpcomingTargets } from "./Exams";

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
  examType: ExamType | "holiday" | "custom" | "assignment";
  completed?: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const EXAM_META: Record<ExamType, { label: string; color: string; bg: string; border: string; dot: string; glow: string }> = {
  midsem1: {
    label: "Mid Semester 1",
    color: "text-[var(--brand-start)]",
    bg: "bg-[var(--brand-start)]/20",
    border: "border-[var(--brand-start)]/50",
    dot: "bg-[var(--brand-start)]",
    glow: "shadow-[0_0_10px_rgba(var(--brand-start-rgb), 0.4)]",
  },
  midsem2: {
    label: "Mid Semester 2",
    color: "text-[var(--brand-end)]",
    bg: "bg-[var(--brand-end)]/20",
    border: "border-[var(--brand-end)]/50",
    dot: "bg-[var(--brand-end)]",
    glow: "shadow-[0_0_10px_rgba(var(--brand-end-rgb), 0.4)]",
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

// ─── Indian National Holidays (fixed-date or approximate floating dates) ───────
// Format: MM-DD for annual fixed dates, YYYY-MM-DD for specific year dates
const FIXED_HOLIDAYS: Record<string, string> = {
  "01-26": "Republic Day",
  "08-15": "Independence Day",
  "10-02": "Gandhi Jayanti",
  "12-25": "Christmas Day",
  "11-01": "Diwali (Approx.)",  // approximate — adjust per year
};

// Specific year-based holidays (Diwali, Holi, Janmashtami shift every year)
const SPECIFIC_HOLIDAYS: Record<string, string> = {
  // 2024
  "2024-03-25": "Holi",
  "2024-11-01": "Diwali",
  "2024-04-14": "Ambedkar Jayanti / Baisakhi",
  "2024-08-26": "Janmashtami",
  "2024-10-12": "Dussehra",
  "2024-11-15": "Guru Nanak Jayanti",
  "2024-01-22": "Ram Mandir Prana Pratishtha",
  // 2025
  "2025-03-14": "Holi",
  "2025-10-20": "Diwali",
  "2025-04-14": "Ambedkar Jayanti / Baisakhi",
  "2025-08-16": "Janmashtami",
  "2025-10-02": "Gandhi Jayanti / Dussehra",
  "2025-11-05": "Guru Nanak Jayanti",
  "2025-03-31": "Id-ul-Fitr (Eid)",
  // 2026 (Official Indian Gazetted Calendar Dates)
  "2026-03-03": "Holika Dahan",
  "2026-03-04": "Holi",
  "2026-04-14": "Ambedkar Jayanti / Baisakhi",
  "2026-09-04": "Janmashtami",
  "2026-10-20": "Dussehra (Vijayadashami)",
  "2026-11-08": "Diwali (Deepavali)",
  "2026-11-24": "Guru Nanak Jayanti",
};

function getNationalHoliday(dateStr: string): string | null {
  if (SPECIFIC_HOLIDAYS[dateStr]) return SPECIFIC_HOLIDAYS[dateStr];
  const monthDay = dateStr.slice(5); // "MM-DD"
  return FIXED_HOLIDAYS[monthDay] || null;
}

function isWeekend(day: Date): boolean {
  const dow = day.getDay();
  return dow === 0 || dow === 6; // 0=Sunday, 6=Saturday
}

function makeDate(year: number, month: number, day: number) {
  return format(new Date(year, month, day), "yyyy-MM-dd");
}

// ─── Deadline Card (replaces live countdown) ──────────────────────────────────

interface UpcomingDeadlineTarget {
  id: string;
  label: string;
  subtitle?: string;
  dateStr: string;
  endDateStr?: string | null;
  examType: ExamType | "holiday" | "custom" | "assignment";
  isPeriod?: boolean;
}

function urgencyStyle(days: number) {
  if (days <= 1) return { card: "from-red-500/25 to-rose-600/25 border-red-500/50", text: "text-red-400", dot: "bg-red-500" };
  if (days <= 3) return { card: "from-orange-500/25 to-amber-500/25 border-orange-500/50", text: "text-orange-400", dot: "bg-orange-400" };
  if (days <= 7) return { card: "from-yellow-500/20 to-amber-400/20 border-yellow-500/40", text: "text-yellow-400", dot: "bg-yellow-400" };
  return { card: "from-blue-500/15 to-blue-400/10 border-blue-500/30", text: "text-blue-400", dot: "bg-blue-400" };
}

function DeadlineCard({ target }: { target: UpcomingDeadlineTarget }) {
  const isAssignment = target.examType === "assignment";
  const meta = !isAssignment && target.examType !== "custom" && target.examType !== "holiday"
    ? EXAM_META[target.examType as ExamType]
    : null;

  const daysLeft = differenceInDays(parseISO(target.dateStr), new Date());
  const u = urgencyStyle(daysLeft);

  // Check if ongoing (period event)
  const isOngoing = (() => {
    if (!target.endDateStr) return false;
    const now = new Date();
    try {
      return parseISO(target.dateStr) <= now && parseISO(target.endDateStr) >= now;
    } catch { return false; }
  })();

  const typeLabel = isAssignment
    ? "📋 Assignment"
    : meta
    ? meta.label
    : "Event";

  const typePill = isAssignment
    ? "bg-blue-500/20 border-blue-500/40 text-blue-300"
    : meta
    ? `${meta.bg} ${meta.border} ${meta.color}`
    : "bg-gray-700/40 border-gray-600/40 text-gray-400";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative overflow-hidden bg-gradient-to-br ${u.card} border rounded-2xl p-5 shadow-lg backdrop-blur-sm`}
    >
      {/* Glow blob */}
      <div className={`absolute -top-10 -right-10 w-32 h-32 ${isAssignment ? "bg-blue-500/10" : meta ? meta.bg : "bg-gray-700/10"} rounded-full blur-3xl pointer-events-none`} />

      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Type pill */}
          <span className={`text-[10px] font-bold border rounded-full px-2 py-0.5 mb-2 inline-block uppercase tracking-wide ${typePill}`}>
            {typeLabel}
          </span>

          <h3 className="text-base font-bold text-white leading-snug truncate">{target.label}</h3>

          {target.subtitle && (
            <p className="text-xs text-gray-400 mt-0.5 truncate">{target.subtitle}</p>
          )}

          <p className="text-xs text-gray-500 flex items-center gap-1 mt-2">
            <CalendarDays className="w-3.5 h-3.5" />
            {isOngoing ? "Ends " : "Due "}{format(parseISO(target.endDateStr ?? target.dateStr), "EEE, MMM d, yyyy")}
          </p>
        </div>

        {/* Days badge */}
        <div className="flex-shrink-0 text-right">
          {isOngoing ? (
            <div className="flex flex-col items-center">
              <span className="flex h-3 w-3 relative mb-1">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
              </span>
              <p className="text-[10px] text-red-400 font-bold uppercase">Active</p>
            </div>
          ) : (
            <>
              <p className={`text-2xl font-black leading-none ${u.text}`}>
                {daysLeft <= 0 ? "Today" : daysLeft === 1 ? "1d" : `${daysLeft}d`}
              </p>
              {daysLeft > 0 && <p className="text-[10px] text-gray-500">left</p>}
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
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
  const [dayForm, setDayForm] = useState<{ label: string; examType: ExamType | "holiday" | "custom" | "assignment" }>({ label: "", examType: "custom" });
  const [editingEvent, setEditingEvent] = useState<DayEvent | null>(null);

  // Calendar scroll
  const [viewMonth, setViewMonth] = useState(0); // index into semester months

  useEffect(() => {
    // 1) Try to restore from previously saved exam calendar state
    const saved = loadState();
    if (saved && saved.semConfig) {
      setSemConfig(saved.semConfig);
      setExamPeriods(saved.examPeriods);
      setDayEvents(saved.dayEvents || []);
      return; // already configured — skip onboarding auto-fill
    }

    // 2) Auto-configure from onboarding student_profile data
    try {
      const profile = JSON.parse(localStorage.getItem("student_profile") || "null");
      if (profile) {
        const semNum = parseInt(profile.currentSemester || "1");
        if (!isNaN(semNum)) setSetupSem(semNum.toString());

        const startRaw: string = profile.semesterStartDate || "";
        const endRaw: string   = profile.semesterEndDate || "";

        if (startRaw) {
          const d = new Date(startRaw);
          if (!isNaN(d.getTime())) {
            setSetupStartMonth(d.getMonth());
            setSetupStartYear(d.getFullYear());
          }
        }
        if (endRaw) {
          const d = new Date(endRaw);
          if (!isNaN(d.getTime())) {
            setSetupEndMonth(d.getMonth());
            setSetupEndYear(d.getFullYear());
          }
        }

        // 3) If both dates are available, auto-create the config and skip the setup screen
        if (startRaw && endRaw) {
          const startD = new Date(startRaw);
          const endD   = new Date(endRaw);
          if (!isNaN(startD.getTime()) && !isNaN(endD.getTime())) {
            const startDate = format(new Date(startD.getFullYear(), startD.getMonth(), 1), "yyyy-MM-dd");
            const endDate   = format(endOfMonth(new Date(endD.getFullYear(), endD.getMonth(), 1)), "yyyy-MM-dd");
            const config: SemesterConfig = { semester: semNum, startDate, endDate };
            const fresh: ExamPeriod[] = [
              { type: "midsem1", label: "Mid Semester 1", startDate: null, endDate: null },
              { type: "midsem2", label: "Mid Semester 2", startDate: null, endDate: null },
              { type: "endsem",  label: "End Semester",   startDate: null, endDate: null },
            ];
            setSemConfig(config);
            setExamPeriods(fresh);
            setDayEvents([]);
            persist(config, fresh, []);
            toast.success("Exam calendar set up from your onboarding data!");
          }
        }
      }
    } catch (e) {}
  }, []);

  const persist = (config: SemesterConfig, periods: ExamPeriod[], events: DayEvent[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ semConfig: config, examPeriods: periods, dayEvents: events }));
    window.dispatchEvent(new Event("storage"));
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
  // Check if onboarding gave us partial data (semester number but not dates)
  const profileRaw = (() => { try { return JSON.parse(localStorage.getItem("student_profile") || "null"); } catch { return null; } })();
  const profileHasPartialData = profileRaw && profileRaw.currentSemester && !(profileRaw.semesterStartDate && profileRaw.semesterEndDate);

  if (!semConfig) {
    return (
      <div className="p-8 max-w-2xl mx-auto space-y-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate("/app/exams")} className="text-gray-400 hover:text-white hover:bg-gray-800/50">
            <ArrowLeft className="w-4 h-4 mr-2" />Back
          </Button>
          <div>
            <h1 className="text-4xl bg-gradient-to-r from-[var(--brand-start)] via-white to-[var(--brand-end)] bg-clip-text text-transparent">
              Exam Calendar
            </h1>
            <p className="text-gray-400 mt-1">Set up your semester to get started</p>
          </div>
        </div>

        {/* Onboarding data detected banner */}
        {profileHasPartialData && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-3 p-4 rounded-xl bg-[var(--brand-start)]/10 border border-[var(--brand-start)]/30"
          >
            <AlertTriangle className="w-5 h-5 text-[var(--brand-start)] flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-bold text-[var(--brand-start)]">Profile detected — Semester {profileRaw.currentSemester} pre-selected</p>
              <p className="text-gray-400 mt-0.5">
                Your semester start/end dates were not filled in during onboarding. Please set them below, or go back to your <strong className="text-white">Profile → Edit</strong> to add them.
              </p>
            </div>
          </motion.div>
        )}

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="bg-[#111118]/80 backdrop-blur-xl border-gray-800/50 p-8 space-y-8">
            {/* Step indicator */}
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-[var(--brand-start)] to-[var(--brand-end)] flex items-center justify-center text-white text-sm font-bold">1</div>
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
                        ? "bg-gradient-to-r from-[var(--brand-start)]/30 to-[var(--brand-end)]/30 border-[var(--brand-start)] text-white shadow-[0_0_12px_rgba(var(--brand-start-rgb), 0.3)]"
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
                <div className="w-2 h-2 rounded-full bg-[var(--brand-start)]" />
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
                <div className="w-2 h-2 rounded-full bg-[var(--brand-end)]" />
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
              className="w-full h-12 bg-[var(--brand-start)] hover:bg-amber-600 text-white font-semibold shadow-[0_0_20px_rgba(var(--brand-start-rgb), 0.3)]"
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
  const unifiedUpcomingTargets = semConfig ? getUnifiedUpcomingTargets({ semConfig, examPeriods, dayEvents }) : [];

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
          <h1 className="text-4xl bg-gradient-to-r from-[var(--brand-start)] via-white to-[var(--brand-end)] bg-clip-text text-transparent">
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
          <span className="w-2.5 h-2.5 rounded-sm bg-blue-500 border border-blue-400" />📋 Assignment (Blue)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-purple-500 border border-purple-400" />🎉 Holiday (Purple)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-red-500/80 border border-red-400" />Weekend (Red)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400" />Other Event
        </span>
        <span className="ml-auto text-gray-500">Click any date to add an event or note</span>
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
                  ? "bg-gradient-to-r from-[var(--brand-start)]/20 to-[var(--brand-end)]/20 border border-[var(--brand-start)]/50 text-white"
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
                {WEEKDAY_LABELS.map((d, i) => (
                  <div
                    key={d}
                    className={`text-center text-xs font-semibold py-2 tracking-wider uppercase ${
                      i === 0 || i === 6 ? "text-red-400 font-bold" : "text-gray-600"
                    }`}
                  >
                    {d}
                  </div>
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
                  const weekend = isWeekend(day);
                  const nationalHoliday = getNationalHoliday(dateStr);
                  const customHoliday = events.find(
                    (e) => e.examType === "holiday" || e.label.toLowerCase().includes("holiday")
                  );
                  const holidayName = nationalHoliday || (customHoliday ? customHoliday.label : null);
                  const isHoliday = !!holidayName;
                  const isRedDay = weekend || isHoliday;

                  // Determine cell background class
                  let cellClass = "";
                  let dateNumClass = "text-gray-300";

                  if (examType && meta) {
                    cellClass = `${meta.bg} border ${meta.border} ${meta.glow}`;
                    dateNumClass = meta.color;
                  } else if (isHoliday) {
                    cellClass = "bg-purple-500/20 border border-purple-500/40 hover:bg-purple-500/30 shadow-[0_0_10px_rgba(168,85,247,0.25)]";
                    dateNumClass = "text-purple-300 font-black";
                  } else if (weekend) {
                    cellClass = "bg-red-500/10 border border-red-500/25 hover:bg-red-500/20";
                    dateNumClass = "text-red-400 font-bold";
                  } else if (isCurrentDay) {
                    cellClass = "bg-[var(--brand-start)]/5 border border-[var(--brand-start)]/30";
                    dateNumClass = "bg-[var(--brand-start)] text-[#0a0a0f]";
                  } else {
                    cellClass = "border border-transparent hover:bg-gray-800/30 hover:border-gray-700/50";
                  }

                  return (
                    <motion.button
                      key={dateStr}
                      onClick={() => openDayDialog(dateStr)}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      className={`relative rounded-xl p-1.5 flex flex-col items-center min-h-[72px] transition-all text-left ${cellClass}`}
                    >
                      {/* Date number */}
                      <span
                        className={`text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full mb-0.5 ${
                          isCurrentDay && !examType ? "bg-[var(--brand-start)] text-[#0a0a0f]" : dateNumClass
                        }`}
                      >
                        {format(day, "d")}
                      </span>

                      {/* Festival / Holiday badge */}
                      {holidayName && (
                        <span className="text-[9px] font-bold text-purple-300 bg-purple-500/25 border border-purple-500/40 rounded px-1.5 py-0.5 leading-tight text-center mt-0.5 max-w-full truncate shadow-xs">
                          🎉 {holidayName}
                        </span>
                      )}

                      {/* Exam type label (non-holiday days) */}
                      {examType && meta && !holidayName && (
                        <span className={`text-[9px] font-semibold ${meta.color} leading-tight text-center px-1`}>
                          {examType === "midsem1" ? "MID-1" : examType === "midsem2" ? "MID-2" : "END"}
                        </span>
                      )}

                      {/* Day events */}
                      {events.filter((ev) => ev !== customHoliday).slice(0, 2).map((ev) => {
                        const evMeta = ev.examType !== "custom" && ev.examType !== "holiday" && ev.examType !== "assignment" ? EXAM_META[ev.examType as ExamType] : null;
                        const isEvHoliday = ev.examType === "holiday";
                        const isEvAssignment = ev.examType === "assignment";
                        return (
                          <div
                            key={ev.id}
                            onClick={(e) => { e.stopPropagation(); openEditEvent(ev); }}
                            className={`w-full mt-0.5 px-1 py-0.5 rounded text-[9px] font-medium truncate leading-tight ${
                              evMeta
                                ? `${evMeta.bg} ${evMeta.color}`
                                : isEvAssignment
                                ? ev.completed
                                  ? "bg-blue-950/90 text-blue-400/60 border border-blue-900/60 line-through"
                                  : "bg-blue-500/25 text-blue-300 border border-blue-500/30"
                                : isEvHoliday
                                ? "bg-purple-500/30 text-purple-200 border border-purple-500/40"
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

                      {/* Add icon on hover (only show if no events) */}
                      {events.length === 0 && !examType && (
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                          <Plus className={`w-4 h-4 ${isRedDay ? "text-red-500/60" : "text-gray-600"}`} />
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

      {/* ── Deadlines section (Exams + Assignments) ── */}
      {unifiedUpcomingTargets.length > 0 && (
        <div className="space-y-4 pt-2">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-blue-400" />
            Deadlines
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {unifiedUpcomingTargets.map((target) => (
              <DeadlineCard key={target.id} target={target} />
            ))}
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
              <Button onClick={handleSavePeriod} className={`flex-1 ${editingPeriod ? `bg-gradient-to-r ${editingPeriod === "midsem1" ? "from-[var(--brand-start)] to-[var(--brand-start)]" : editingPeriod === "midsem2" ? "from-[var(--brand-start)] to-amber-500" : "from-orange-500 to-amber-500"}` : ""} text-white`}>
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
                  const evMeta = ev.examType !== "custom" && ev.examType !== "holiday" && ev.examType !== "assignment" ? EXAM_META[ev.examType as ExamType] : null;
                  const isEvAssignment = ev.examType === "assignment";
                  const isEvHoliday = ev.examType === "holiday";
                  return (
                    <div key={ev.id} className={`flex items-center justify-between rounded-lg px-3 py-2 border ${
                      evMeta ? `${evMeta.bg} ${evMeta.border}` :
                      isEvAssignment ? "bg-blue-500/15 border-blue-500/30" :
                      isEvHoliday ? "bg-purple-500/15 border-purple-500/30" :
                      "bg-emerald-500/10 border-emerald-500/20"
                    }`}>
                      <div>
                        <p className={`text-sm font-medium ${
                          evMeta ? evMeta.color :
                          isEvAssignment ? "text-blue-300" :
                          isEvHoliday ? "text-purple-300" :
                          "text-emerald-300"
                        }`}>{ev.label}</p>
                        <p className="text-xs text-gray-500">
                          {evMeta ? evMeta.label : isEvAssignment ? "Assignment" : isEvHoliday ? "Holiday" : "Custom"}
                        </p>
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
                className="bg-[#0a0a0f]/50 border-gray-700 focus:border-[var(--brand-start)] text-white"
                placeholder='e.g. "DS Paper", "Holiday", "Assignment Due"'
              />
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label className="text-gray-300">Category</Label>
              <div className="flex gap-2 flex-wrap">
                {[
                  { value: "midsem1",    label: "Mid-1" },
                  { value: "midsem2",    label: "Mid-2" },
                  { value: "endsem",     label: "End Sem" },
                  { value: "assignment", label: "📋 Assignment" },
                  { value: "holiday",    label: "🎉 Holiday" },
                  { value: "custom",     label: "Other" },
                ].map(({ value, label }) => {
                  const m = value !== "custom" && value !== "holiday" && value !== "assignment" ? EXAM_META[value as ExamType] : null;
                  const isHolidayCat   = value === "holiday";
                  const isAssignment   = value === "assignment";
                  return (
                    <button
                      key={value}
                      onClick={() => setDayForm({ ...dayForm, examType: value as ExamType | "holiday" | "custom" | "assignment" })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                        dayForm.examType === value
                          ? m
                            ? `${m.bg} ${m.border} ${m.color}`
                            : isAssignment
                            ? "bg-blue-500/25 border-blue-500/50 text-blue-300"
                            : isHolidayCat
                            ? "bg-purple-500/25 border-purple-500/50 text-purple-300"
                            : "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
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
              <Button onClick={handleSaveDayEvent} className="flex-1 bg-gradient-to-r from-[var(--brand-start)] to-[var(--brand-end)] text-white">
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
