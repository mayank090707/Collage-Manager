import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import {
  CalendarDays, Clock, Flame, ChevronLeft, ChevronRight, AlertTriangle, BookOpen, Settings2, Timer, CheckCircle2
} from "lucide-react";
import {
  format, parseISO, differenceInDays, isPast,
  startOfMonth, endOfMonth, eachDayOfInterval,
  addMonths, subMonths, isSameDay, isToday, isWithinInterval,
} from "date-fns";
import { motion } from "motion/react";

// ── Types (mirrors ExamCalendar storage) ─────────────────────────────────────
type ExamType = "midsem1" | "midsem2" | "endsem";

interface ExamPeriod {
  type: ExamType;
  label: string;
  startDate: string | null;
  endDate: string | null;
}

interface DayEvent {
  id: string;
  date: string;
  label: string;
  examType: ExamType | "holiday" | "custom" | "assignment";
  completed?: boolean;
}

interface SemesterConfig {
  semester: number;
  startDate: string;
  endDate: string;
}

interface CalendarState {
  semConfig: SemesterConfig;
  examPeriods: ExamPeriod[];
  dayEvents: DayEvent[];
}

// ── Style maps ────────────────────────────────────────────────────────────────
const EXAM_META: Record<ExamType, { label: string; color: string; bg: string; border: string; dot: string; pill: string }> = {
  midsem1: {
    label: "Mid Sem 1", color: "text-[var(--brand-start)]",
    bg: "bg-[var(--brand-start)]/15", border: "border-[var(--brand-start)]/40",
    dot: "bg-[var(--brand-start)]", pill: "bg-[var(--brand-start)]/20 text-[var(--brand-start)] border-[var(--brand-start)]/40",
  },
  midsem2: {
    label: "Mid Sem 2", color: "text-[var(--brand-end)]",
    bg: "bg-[var(--brand-end)]/15", border: "border-[var(--brand-end)]/40",
    dot: "bg-[var(--brand-end)]", pill: "bg-[var(--brand-end)]/20 text-[var(--brand-end)] border-[var(--brand-end)]/40",
  },
  endsem: {
    label: "End Sem", color: "text-orange-400",
    bg: "bg-orange-500/15", border: "border-orange-500/40",
    dot: "bg-orange-400", pill: "bg-orange-500/20 text-orange-400 border-orange-500/40",
  },
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ── Indian National Holidays ──────────────────────────────────────────────────
const FIXED_HOLIDAYS: Record<string, string> = {
  "01-26": "Republic Day",
  "08-15": "Independence Day",
  "10-02": "Gandhi Jayanti",
  "12-25": "Christmas Day",
  "11-01": "Diwali (Approx.)",
};

const SPECIFIC_HOLIDAYS: Record<string, string> = {
  "2024-03-25": "Holi",
  "2024-11-01": "Diwali",
  "2024-04-14": "Ambedkar Jayanti",
  "2024-08-26": "Janmashtami",
  "2024-10-12": "Dussehra",
  "2024-11-15": "Guru Nanak Jayanti",
  "2025-03-14": "Holi",
  "2025-10-20": "Diwali",
  "2025-04-14": "Ambedkar Jayanti",
  "2025-08-16": "Janmashtami",
  "2025-10-02": "Gandhi Jayanti / Dussehra",
  "2025-11-05": "Guru Nanak Jayanti",
  "2025-03-31": "Eid",
  "2026-03-03": "Holika Dahan",
  "2026-03-04": "Holi",
  "2026-04-14": "Ambedkar Jayanti",
  "2026-09-04": "Janmashtami",
  "2026-10-20": "Dussehra",
  "2026-11-08": "Diwali",
  "2026-11-24": "Guru Nanak Jayanti",
};

function getNationalHoliday(dateStr: string): string | null {
  if (SPECIFIC_HOLIDAYS[dateStr]) return SPECIFIC_HOLIDAYS[dateStr];
  const monthDay = dateStr.slice(5);
  return FIXED_HOLIDAYS[monthDay] || null;
}

function isWeekend(day: Date): boolean {
  const dow = day.getDay();
  return dow === 0 || dow === 6; // 0=Sunday, 6=Saturday
}

function urgencyStyle(days: number) {
  if (days <= 1) return { card: "from-red-500/25 to-rose-600/25 border-red-500/50", text: "text-red-400", dot: "bg-red-500" };
  if (days <= 3) return { card: "from-orange-500/25 to-amber-500/25 border-orange-500/50", text: "text-orange-400", dot: "bg-orange-400" };
  if (days <= 7) return { card: "from-yellow-500/20 to-amber-400/20 border-yellow-500/40", text: "text-yellow-400", dot: "bg-yellow-400" };
  return { card: "from-[var(--brand-start)]/15 to-[var(--brand-end)]/15 border-[var(--brand-start)]/30", text: "text-[var(--brand-start)]", dot: "bg-[var(--brand-end)]" };
}

// ── Countdown Timer Types & Helper Components ─────────────────────────────────
interface UpcomingExamTarget {
  id: string;
  label: string;
  subtitle?: string;
  dateStr: string; // ISO date string YYYY-MM-DD
  endDateStr?: string | null;
  examType: ExamType | "holiday" | "custom" | "assignment";
  isPeriod?: boolean;
}

function calculateTimeRemaining(targetDateStr: string, endDateStr?: string | null) {
  try {
    const now = new Date();
    const targetDate = parseISO(targetDateStr);
    targetDate.setHours(9, 30, 0, 0); // Count down to 9:30 AM on scheduled date
    const diffMs = targetDate.getTime() - now.getTime();

    if (diffMs <= 0) {
      if (endDateStr) {
        const endDate = parseISO(endDateStr);
        endDate.setHours(23, 59, 59, 999);
        if (now.getTime() <= endDate.getTime()) {
          return { months: 0, days: 0, hours: 0, minutes: 0, seconds: 0, isOngoing: true, isEnded: false };
        }
      }
      return { months: 0, days: 0, hours: 0, minutes: 0, seconds: 0, isOngoing: false, isEnded: true };
    }

    const totalSeconds = Math.floor(diffMs / 1000);
    const seconds = totalSeconds % 60;
    const totalMinutes = Math.floor(totalSeconds / 60);
    const minutes = totalMinutes % 60;
    const totalHours = Math.floor(totalMinutes / 60);
    const hours = totalHours % 24;
    const totalDays = Math.floor(totalHours / 24);
    const months = Math.floor(totalDays / 30);
    const days = totalDays % 30;

    return { months, days, hours, minutes, seconds, isOngoing: false, isEnded: false };
  } catch {
    return { months: 0, days: 0, hours: 0, minutes: 0, seconds: 0, isOngoing: false, isEnded: true };
  }
}

export function ExamLiveCountdownCard({ target }: { target: UpcomingExamTarget }) {
  const [timeLeft, setTimeLeft] = useState(() =>
    calculateTimeRemaining(target.dateStr, target.endDateStr)
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(calculateTimeRemaining(target.dateStr, target.endDateStr));
    }, 1000);
    return () => clearInterval(interval);
  }, [target.dateStr, target.endDateStr]);

  const meta = target.examType !== "custom" && target.examType !== "holiday" ? EXAM_META[target.examType as ExamType] : null;

  if (timeLeft.isEnded) {
    return null;
  }

  if (timeLeft.isOngoing) {
    return (
      <Card className="relative overflow-hidden bg-gradient-to-br from-red-500/20 via-[#111118] to-rose-500/10 border border-red-500/40 p-5 rounded-2xl shadow-[0_0_20px_rgba(239,68,68,0.2)]">
        <div className="flex items-center gap-2 mb-2">
          <span className="flex h-2.5 w-2.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
          </span>
          <span className="text-[11px] font-extrabold uppercase tracking-widest text-red-400">🚨 Exam In Progress</span>
        </div>
        <h3 className="text-lg font-bold text-white mb-1">{target.label}</h3>
        <p className="text-xs text-gray-400">{target.subtitle || "Currently active exam period."}</p>
      </Card>
    );
  }

  const { months, days, hours, minutes, seconds } = timeLeft;
  const pad = (n: number) => n.toString().padStart(2, "0");

  const brandColor = meta ? meta.color : "text-amber-400";
  const borderColor = meta ? meta.border : "border-amber-500/40";
  const glowColor = meta ? meta.bg : "bg-amber-500/10";

  return (
    <Card className={`relative overflow-hidden bg-[#111118]/90 backdrop-blur-xl border ${borderColor} p-5 rounded-2xl shadow-xl`}>
      <div className={`absolute -top-12 -right-12 w-36 h-36 ${glowColor} rounded-full blur-3xl pointer-events-none`} />

      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
          </span>
          <span className={`text-[11px] font-extrabold uppercase tracking-widest ${brandColor}`}>
            Next Exam Countdown
          </span>
        </div>
        {meta && (
          <span className={`text-[10px] font-bold ${meta.pill} border rounded-full px-2 py-0.5`}>
            {meta.label}
          </span>
        )}
      </div>

      <div className="mb-4">
        <h3 className="text-lg font-bold text-white leading-snug flex items-center gap-2">
          <Timer className={`w-5 h-5 ${brandColor}`} />
          {target.label}
        </h3>
        <p className="text-xs text-gray-400 flex items-center gap-1.5 mt-1">
          <CalendarDays className="w-3.5 h-3.5 text-gray-500" />
          Starts on {format(parseISO(target.dateStr), "EEEE, MMM d, yyyy")} at 9:30 AM
        </p>
      </div>

      {/* Countdown Grid */}
      <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
        <div className="flex flex-col items-center bg-[#0a0a0f] border border-gray-800/80 rounded-xl py-2 px-1 text-center">
          <span className="text-xl sm:text-2xl font-black font-mono tracking-tight text-white">{pad(months)}</span>
          <span className="text-[8px] sm:text-[9px] font-extrabold uppercase tracking-wider text-amber-400/90 mt-1">Months</span>
        </div>
        <div className="flex flex-col items-center bg-[#0a0a0f] border border-gray-800/80 rounded-xl py-2 px-1 text-center">
          <span className="text-xl sm:text-2xl font-black font-mono tracking-tight text-white">{pad(days)}</span>
          <span className="text-[8px] sm:text-[9px] font-extrabold uppercase tracking-wider text-amber-400/90 mt-1">Days</span>
        </div>
        <div className="flex flex-col items-center bg-[#0a0a0f] border border-gray-800/80 rounded-xl py-2 px-1 text-center">
          <span className="text-xl sm:text-2xl font-black font-mono tracking-tight text-white">{pad(hours)}</span>
          <span className="text-[8px] sm:text-[9px] font-extrabold uppercase tracking-wider text-amber-400/90 mt-1">Hours</span>
        </div>
        <div className="flex flex-col items-center bg-[#0a0a0f] border border-gray-800/80 rounded-xl py-2 px-1 text-center">
          <span className="text-xl sm:text-2xl font-black font-mono tracking-tight text-white">{pad(minutes)}</span>
          <span className="text-[8px] sm:text-[9px] font-extrabold uppercase tracking-wider text-amber-400/90 mt-1">Mins</span>
        </div>
        <div className={`flex flex-col items-center bg-[#0a0a0f] border ${borderColor} rounded-xl py-2 px-1 text-center relative shadow-sm`}>
          <span className={`text-xl sm:text-2xl font-black font-mono tracking-tight ${brandColor} animate-pulse`}>{pad(seconds)}</span>
          <span className={`text-[8px] sm:text-[9px] font-extrabold uppercase tracking-wider ${brandColor} mt-1`}>Secs</span>
        </div>
      </div>
    </Card>
  );
}

// Compact inline HH:MM:SS countdown shown when a deadline card is clicked
function InlineCountdown({ dateStr, urgencyText }: { dateStr: string; urgencyText: string }) {
  const [time, setTime] = useState(() => calculateTimeRemaining(dateStr));
  useEffect(() => {
    const iv = setInterval(() => setTime(calculateTimeRemaining(dateStr)), 1000);
    return () => clearInterval(iv);
  }, [dateStr]);

  if (time.isEnded) return <p className="text-xs text-gray-500 text-center">Deadline passed (9:30 AM target)</p>;
  if (time.isOngoing) return (
    <div className="flex items-center justify-center gap-2">
      <span className="flex h-2 w-2 relative">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
      </span>
      <span className="text-xs text-red-400 font-bold">In Progress</span>
    </div>
  );

  const pad = (n: number) => n.toString().padStart(2, "0");
  return (
    <div className="flex items-center justify-center gap-1.5">
      {time.months > 0 && (
        <div className="flex flex-col items-center bg-black/30 rounded-lg px-2 py-1.5 min-w-[36px]">
          <span className={`text-base font-black font-mono ${urgencyText}`}>{pad(time.months)}</span>
          <span className="text-[8px] text-gray-500 uppercase font-bold">mo</span>
        </div>
      )}
      <div className="flex flex-col items-center bg-black/30 rounded-lg px-2 py-1.5 min-w-[36px]">
        <span className={`text-base font-black font-mono ${urgencyText}`}>{pad(time.days)}</span>
        <span className="text-[8px] text-gray-500 uppercase font-bold">d</span>
      </div>
      <div className="flex flex-col items-center bg-black/30 rounded-lg px-2 py-1.5 min-w-[36px]">
        <span className={`text-base font-black font-mono ${urgencyText}`}>{pad(time.hours)}</span>
        <span className="text-[8px] text-gray-500 uppercase font-bold">h</span>
      </div>
      <div className="flex flex-col items-center bg-black/30 rounded-lg px-2 py-1.5 min-w-[36px]">
        <span className={`text-base font-black font-mono ${urgencyText}`}>{pad(time.minutes)}</span>
        <span className="text-[8px] text-gray-500 uppercase font-bold">m</span>
      </div>
      <div className="flex flex-col items-center bg-black/30 border border-white/10 rounded-lg px-2 py-1.5 min-w-[36px]">
        <span className={`text-base font-black font-mono ${urgencyText} animate-pulse`}>{pad(time.seconds)}</span>
        <span className="text-[8px] text-gray-500 uppercase font-bold">s</span>
      </div>
    </div>
  );
}

export function getUnifiedUpcomingTargets(data: CalendarState): UpcomingExamTarget[] {
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const targets: UpcomingExamTarget[] = [];

  // 1. Specific day events (exams + assignments, skip holidays/custom)
  for (const ev of data.dayEvents) {
    if (ev.examType === "holiday" || ev.examType === "custom") continue;
    if (ev.date >= todayStr) {
      const isAssignment = ev.examType === "assignment";
      targets.push({
        id: ev.id,
        label: ev.label,
        subtitle: isAssignment
          ? "Assignment Deadline"
          : (ev.examType as string) !== "custom" && (ev.examType as string) !== "holiday"
            ? EXAM_META[ev.examType as ExamType]?.label
            : undefined,
        dateStr: ev.date,
        examType: ev.examType,
        isPeriod: false,
      });
    }
  }

  // 2. Exam periods (Mid Sem 1, Mid Sem 2, End Sem)
  for (const p of data.examPeriods) {
    if (!p.startDate) continue;
    const isFuture = p.startDate >= todayStr;
    const isOngoing = p.endDate ? p.startDate <= todayStr && p.endDate >= todayStr : false;

    if (isFuture || isOngoing) {
      const meta = EXAM_META[p.type];
      targets.push({
        id: `period-${p.type}`,
        label: `${meta.label}${isOngoing ? " (In Progress)" : " Start"}`,
        subtitle: p.endDate ? `${format(parseISO(p.startDate), "MMM d")} – ${format(parseISO(p.endDate), "MMM d, yyyy")}` : format(parseISO(p.startDate), "MMM d, yyyy"),
        dateStr: p.startDate,
        endDateStr: p.endDate,
        examType: p.type,
        isPeriod: true,
      });
    }
  }

  targets.sort((a, b) => a.dateStr.localeCompare(b.dateStr));

  const seen = new Set<string>();
  return targets.filter((t) => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });
}

// ── Component ─────────────────────────────────────────────────────────────────
export function Exams() {
  const navigate = useNavigate();
  const [data, setData] = useState<CalendarState | null>(null);
  const [viewMonth, setViewMonth] = useState(new Date());
  const [selectedCountdownId, setSelectedCountdownId] = useState<string | null>(null);

  const loadExamData = () => {
    try {
      const raw = localStorage.getItem("exam_calendar_v2");
      if (raw) {
        const parsed: CalendarState = JSON.parse(raw);
        setData(parsed);
        setViewMonth(parseISO(parsed.semConfig.startDate));
      }
    } catch {}
  };

  // Toggle completed status of a dayEvent and save to localStorage
  const toggleCompleted = (eventId: string) => {
    if (!data) return;
    const updated: CalendarState = {
      ...data,
      dayEvents: data.dayEvents.map((ev) =>
        ev.id === eventId ? { ...ev, completed: !ev.completed } : ev
      ),
    };
    localStorage.setItem("exam_calendar_v2", JSON.stringify(updated));
    setData(updated);
    window.dispatchEvent(new Event("storage"));
  };

  useEffect(() => {
    loadExamData();
    const handleStorage = () => loadExamData();
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  // ── Helpers ──────────────────────────────────────────────────────────────
  const getExamTypeForDate = (dateStr: string): ExamType | null => {
    if (!data) return null;
    for (const p of data.examPeriods) {
      if (!p.startDate || !p.endDate) continue;
      try {
        if (isWithinInterval(parseISO(dateStr), { start: parseISO(p.startDate), end: parseISO(p.endDate) }))
          return p.type;
      } catch {}
    }
    return null;
  };

  const getEventsOnDate = (dateStr: string) =>
    data?.dayEvents.filter((e) => e.date === dateStr) ?? [];

  const calendarDays = (() => {
    const start = startOfMonth(viewMonth);
    const end = endOfMonth(viewMonth);
    return Array(start.getDay()).fill(null).concat(eachDayOfInterval({ start, end }));
  })();

  // ── Derived lists ─────────────────────────────────────────────────────────
  const allEvents = data?.dayEvents ?? [];
  const unifiedTargets = data ? getUnifiedUpcomingTargets(data) : [];
  // primaryTarget should be the nearest real EXAM (not assignment) for the countdown
  const REAL_EXAM_TYPES = ["midsem1", "midsem2", "endsem"];
  const primaryTarget =
    unifiedTargets.find((t) => REAL_EXAM_TYPES.includes(t.examType as string)) ||
    unifiedTargets[0] ||
    null;

  const pastExamEvents = allEvents
    .filter((e) => (e.examType as string) !== "custom" && (e.examType as string) !== "holiday" && differenceInDays(parseISO(e.date), new Date()) < 0)
    .sort((a, b) => b.date.localeCompare(a.date));

  // hasUrgent only fires for real exams — assignments use the notification bell instead
  const hasUrgent = unifiedTargets.some(
    (t) =>
      REAL_EXAM_TYPES.includes(t.examType as string) &&
      differenceInDays(parseISO(t.dateStr), new Date()) <= 3
  );

  // ── Empty state ───────────────────────────────────────────────────────────
  if (!data) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[60vh] space-y-6 text-center">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[var(--brand-start)]/20 to-[var(--brand-end)]/20 border border-[var(--brand-start)]/30 flex items-center justify-center">
          <CalendarDays className="w-10 h-10 text-[var(--brand-start)]" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">No Exam Calendar Yet</h2>
          <p className="text-gray-400 max-w-sm">
            Set up your semester calendar to view exam dates here. Go to the Exam Calendar to get started.
          </p>
        </div>
        <Button
          onClick={() => navigate("/app/exam-calendar")}
          className="bg-gradient-to-r from-[var(--brand-start)] to-[var(--brand-end)] text-white px-6"
        >
          Set Up Exam Calendar
        </Button>
      </div>
    );
  }

  const { semConfig, examPeriods } = data;

  // ── Full render ───────────────────────────────────────────────────────────
  return (
    <div className="p-8 space-y-8">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-4xl mb-1 bg-gradient-to-r from-[var(--brand-start)] via-white to-[var(--brand-end)] bg-clip-text text-transparent">
            Calendar
          </h1>
          <p className="text-gray-400">
            Semester {semConfig.semester} ·{" "}
            {format(parseISO(semConfig.startDate), "MMM yyyy")} –{" "}
            {format(parseISO(semConfig.endDate), "MMM yyyy")}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => navigate("/app/exam-calendar")}
          className="border-gray-700 bg-transparent text-gray-400 hover:text-white hover:border-gray-500"
        >
          <Settings2 className="w-4 h-4 mr-2" />
          Edit Calendar
        </Button>
      </div>

      {/* Urgent alert */}
      {hasUrgent && (
        <motion.div
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-3 px-5 py-4 rounded-xl bg-red-500/10 border border-red-500/30"
        >
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-300 font-semibold text-sm">Urgent — Exam coming up in the next 3 days!</p>
            <p className="text-red-400/70 text-xs mt-0.5">Check your calendar and prepare accordingly.</p>
          </div>
        </motion.div>
      )}

      {/* Exam period summary cards */}
      <div className="grid md:grid-cols-3 gap-4">
        {examPeriods.map((period) => {
          const meta = EXAM_META[period.type];
          const periodEvents = allEvents.filter((e) => e.examType === period.type);
          return (
            <Card key={period.type} className={`${meta.bg} border ${meta.border} p-5`}>
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-2.5 h-2.5 rounded-full ${meta.dot}`} />
                <p className={`text-sm font-bold ${meta.color}`}>{meta.label}</p>
              </div>
              {period.startDate && period.endDate ? (
                <>
                  <p className="text-white font-semibold text-base">
                    {format(parseISO(period.startDate), "MMM d")} – {format(parseISO(period.endDate), "MMM d, yyyy")}
                  </p>
                  <p className="text-gray-500 text-xs mt-1">
                    {differenceInDays(parseISO(period.endDate), parseISO(period.startDate)) + 1} days ·{" "}
                    {periodEvents.length} exam{periodEvents.length !== 1 ? "s" : ""} marked
                  </p>
                </>
              ) : (
                <p className="text-gray-600 text-sm">No dates set</p>
              )}
            </Card>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-5 gap-6">

        {/* ── Calendar ── */}
        <div className="lg:col-span-3">
          <Card className="bg-[#111118]/80 backdrop-blur-xl border-gray-800/50 overflow-hidden">
            {/* Month nav */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800/50 bg-[#0a0a0f]/40">
              <Button
                variant="ghost" size="icon"
                onClick={() => setViewMonth(subMonths(viewMonth, 1))}
                className="text-gray-400 hover:text-white hover:bg-gray-700/50"
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <div className="text-center">
                <p className="text-lg font-bold text-white">{format(viewMonth, "MMMM")}</p>
                <p className="text-xs text-gray-500">{format(viewMonth, "yyyy")}</p>
              </div>
              <Button
                variant="ghost" size="icon"
                onClick={() => setViewMonth(addMonths(viewMonth, 1))}
                className="text-gray-400 hover:text-white hover:bg-gray-700/50"
              >
                <ChevronRight className="w-5 h-5" />
              </Button>
            </div>

            <div className="p-4">
              {/* Weekday headers */}
              <div className="grid grid-cols-7 mb-1">
                {WEEKDAYS.map((d, i) => (
                  <div
                    key={d}
                    className={`text-center text-xs font-semibold py-2 uppercase tracking-wider ${
                      i === 0 || i === 6 ? "text-red-400 font-bold" : "text-gray-600"
                    }`}
                  >
                    {d}
                  </div>
                ))}
              </div>

              {/* Day cells */}
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day, idx) => {
                  if (!day) return <div key={`pad-${idx}`} className="aspect-[1/1.15]" />;

                  const dateStr = format(day, "yyyy-MM-dd");
                  const examType = getExamTypeForDate(dateStr);
                  const events = getEventsOnDate(dateStr);
                  const isCurrent = isToday(day);
                  const meta = examType ? EXAM_META[examType] : null;
                  const weekend = isWeekend(day);
                  
                  const nationalHoliday = getNationalHoliday(dateStr);
                  const customHoliday = events.find(
                    (e) => e.examType === "holiday" || e.label.toLowerCase().includes("holiday")
                  );
                  const holidayName = nationalHoliday || (customHoliday ? customHoliday.label : null);
                  const isHoliday = !!holidayName;

                  // Determine cell container styling
                  let cellClass = "";
                  let dateNumClass = "text-gray-400";

                  if (examType && meta) {
                    cellClass = `${meta.bg} ${meta.border} shadow-sm`;
                    dateNumClass = meta.color;
                  } else if (isHoliday) {
                    cellClass = "bg-purple-500/20 border border-purple-500/40 shadow-[0_0_10px_rgba(168,85,247,0.25)] hover:bg-purple-500/30";
                    dateNumClass = "text-purple-300 font-extrabold";
                  } else if (weekend) {
                    cellClass = "bg-red-500/10 border border-red-500/25 hover:bg-red-500/20";
                    dateNumClass = "text-red-400 font-bold";
                  } else if (isCurrent) {
                    cellClass = "bg-[var(--brand-start)]/8 border-[var(--brand-start)]/30";
                    dateNumClass = "bg-[var(--brand-start)] text-[#0a0a0f]";
                  } else {
                    cellClass = "border-transparent hover:bg-gray-800/20";
                  }

                  return (
                    <motion.div
                      key={dateStr}
                      whileHover={{ scale: 1.04 }}
                      className={`relative rounded-xl flex flex-col items-center pt-1.5 pb-1 min-h-[64px] border transition-all cursor-default ${cellClass}`}
                    >
                      {/* Today ring */}
                      {isCurrent && (
                        <div className="absolute inset-0 rounded-xl border border-[var(--brand-start)]/50 pointer-events-none" />
                      )}

                      <span className={`text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full ${
                        isCurrent && !examType ? "bg-[var(--brand-start)] text-[#0a0a0f]" : dateNumClass
                      }`}>
                        {format(day, "d")}
                      </span>

                      {/* Holiday Badge (Purple) */}
                      {holidayName && (
                        <span className="text-[8px] font-bold text-purple-300 bg-purple-500/30 border border-purple-500/50 rounded px-1 py-0.5 leading-tight text-center mt-0.5 max-w-full truncate shadow-xs">
                          🎉 {holidayName}
                        </span>
                      )}

                      {/* Exam band label (if not holiday) */}
                      {examType && meta && !holidayName && (
                        <span className={`text-[8px] font-bold ${meta.color} mt-0.5 leading-none`}>
                          {examType === "midsem1" ? "MID-1" : examType === "midsem2" ? "MID-2" : "END"}
                        </span>
                      )}

                      {/* Event chips */}
                      {events.filter((ev) => ev !== customHoliday).slice(0, 2).map((ev) => {
                        const evMeta = ev.examType !== "custom" && ev.examType !== "holiday" && ev.examType !== "assignment" ? EXAM_META[ev.examType as ExamType] : null;
                        const isEvAssignment = ev.examType === "assignment";
                        return (
                          <div
                            key={ev.id}
                            className={`w-[90%] mt-0.5 px-1 py-0.5 rounded text-[8px] font-semibold truncate leading-tight text-center ${
                              evMeta
                                ? `${evMeta.bg} ${evMeta.color}`
                                : isEvAssignment
                                ? ev.completed
                                  ? "bg-blue-950/90 text-blue-400/60 border border-blue-900/60 line-through"
                                  : "bg-blue-500/20 text-blue-300"
                                : "bg-emerald-500/20 text-emerald-300"
                            }`}
                          >
                            {ev.label}
                          </div>
                        );
                      })}
                      {events.length > 2 && (
                        <span className="text-[8px] text-gray-500 mt-0.5">+{events.length - 2}</span>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Legend */}
            <div className="px-4 pb-4 flex items-center gap-3 flex-wrap">
              {Object.entries(EXAM_META).map(([type, m]) => (
                <span key={type} className="flex items-center gap-1.5 text-xs text-gray-400">
                  <span className={`w-2 h-2 rounded-sm ${m.dot}`} />{m.label}
                </span>
              ))}
              <span className="flex items-center gap-1.5 text-xs text-blue-300">
                <span className="w-2 h-2 rounded-sm bg-blue-500 border border-blue-400" />Assignment (Blue)
              </span>
              <span className="flex items-center gap-1.5 text-xs text-purple-300">
                <span className="w-2 h-2 rounded-sm bg-purple-500 border border-purple-400" />Holiday (Purple)
              </span>
              <span className="flex items-center gap-1.5 text-xs text-red-400">
                <span className="w-2 h-2 rounded-sm bg-red-500 border border-red-400" />Weekend (Red)
              </span>
              <span className="flex items-center gap-1.5 text-xs text-gray-400">
                <span className="w-2 h-2 rounded-sm bg-emerald-400" />Other Event
              </span>
            </div>
          </Card>
        </div>

        {/* ── Right panel ── */}
        <div className="lg:col-span-2 space-y-4">

          {/* Primary Live Countdown Card (for nearest real exam) */}
          {primaryTarget && REAL_EXAM_TYPES.includes(primaryTarget.examType as string) && (
            <ExamLiveCountdownCard target={primaryTarget} />
          )}

          {/* Upcoming deadlines list */}
          <Card className="bg-[#111118]/80 backdrop-blur-xl border-gray-800/50 p-5">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center justify-between">
              <span>Upcoming Deadlines</span>
              <span className="text-xs text-blue-400 font-mono font-semibold">{unifiedTargets.length} scheduled</span>
            </h3>
            {unifiedTargets.length > 0 ? (
              <div className="space-y-2.5">
                {unifiedTargets.map((t, i) => {
                  const daysLeft = differenceInDays(parseISO(t.dateStr), new Date());
                  const u = urgencyStyle(daysLeft);
                  const isAssBtn = t.examType === "assignment";
                  const evMeta = !isAssBtn && (t.examType as string) !== "custom" && (t.examType as string) !== "holiday" ? EXAM_META[t.examType as ExamType] : null;
                  // Find the actual dayEvent to get completed status (for assignments/day events)
                  const dayEvent = data?.dayEvents.find((ev) => ev.id === t.id);
                  const isCompleted = dayEvent?.completed ?? false;
                  const isExpanded = selectedCountdownId === t.id;

                  return (
                    <motion.div
                      key={t.id}
                      initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className={`border rounded-xl overflow-hidden transition-all duration-300 ${
                        isCompleted
                          ? "bg-gradient-to-r from-gray-800/40 to-gray-700/30 border-gray-700/40 opacity-70"
                          : `bg-gradient-to-r ${u.card}`
                      }`}
                    >
                      {/* Main row — click to toggle countdown */}
                      <button
                        onClick={() => setSelectedCountdownId(isExpanded ? null : t.id)}
                        className="w-full text-left p-3.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            {isAssBtn ? (
                              <span className={`text-[10px] font-bold border rounded-full px-2 py-0.5 mb-1 inline-block ${
                                isCompleted ? "bg-blue-900/40 border-blue-900/60 text-blue-400/70 line-through" : "bg-blue-500/20 border-blue-500/40 text-blue-300"
                              }`}>
                                📋 Assignment
                              </span>
                            ) : evMeta && (
                              <span className={`text-[10px] font-bold ${evMeta.pill} border rounded-full px-2 py-0.5 mb-1 inline-block`}>
                                {evMeta.label}
                              </span>
                            )}
                            <p className={`font-semibold text-sm truncate ${isCompleted ? "text-gray-500 line-through" : "text-white"}`}>{t.label}</p>
                            {t.subtitle && <p className="text-[11px] text-gray-400 truncate">{t.subtitle}</p>}
                            <p className="text-xs text-gray-400 flex items-center gap-1 mt-1">
                              <CalendarDays className="w-3.5 h-3.5 text-gray-500" />
                              {format(parseISO(t.dateStr), "EEE, MMM d, yyyy")}
                            </p>
                          </div>
                          <div className="flex-shrink-0 text-right flex flex-col items-center gap-1">
                            {isCompleted ? (
                              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                            ) : (
                              <>
                                <p className={`text-xl font-black ${u.text} leading-none`}>
                                  {daysLeft <= 0 ? "Today" : daysLeft === 1 ? "1d" : `${daysLeft}d`}
                                </p>
                                {daysLeft > 0 && <p className="text-[10px] text-gray-500">left</p>}
                                {daysLeft <= 3 && <Flame className={`w-3.5 h-3.5 ${u.text}`} />}
                              </>
                            )}
                          </div>
                        </div>
                      </button>

                      {/* Expanded countdown + tick */}
                      {isExpanded && !isCompleted && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="border-t border-white/10 px-3.5 pb-3.5 pt-3 space-y-3"
                        >
                          {/* Live HH:MM:SS inline countdown */}
                          <InlineCountdown dateStr={t.dateStr} urgencyText={u.text} />
                          {/* Tick button — only for day events (id matches a dayEvent) */}
                          {dayEvent && (
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleCompleted(t.id); }}
                              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold hover:bg-emerald-500/20 transition-all"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              Mark as Submitted / Done
                            </button>
                          )}
                        </motion.div>
                      )}

                      {/* Show un-tick option for completed items */}
                      {isCompleted && dayEvent && (
                        <div className="border-t border-gray-700/30 px-3.5 pb-2.5 pt-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleCompleted(t.id); }}
                            className="text-[11px] text-gray-600 hover:text-gray-400 underline underline-offset-2 transition-colors"
                          >
                            Undo — mark as pending
                          </button>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <BookOpen className="w-10 h-10 text-gray-700 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">No upcoming deadlines</p>
              </div>
            )}
          </Card>

          {/* Past exams */}
          {pastExamEvents.length > 0 && (
            <Card className="bg-[#111118]/80 backdrop-blur-xl border-gray-800/50 p-5">
              <h3 className="text-sm font-bold text-gray-600 uppercase tracking-wider mb-3">Completed</h3>
              <div className="space-y-2">
                {pastExamEvents.slice(0, 6).map((ev) => {
                  const evMeta = (ev.examType as string) !== "custom" && (ev.examType as string) !== "holiday" ? EXAM_META[ev.examType as ExamType] : null;
                  return (
                    <div key={ev.id} className="flex items-center gap-3 opacity-50">
                      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${evMeta ? evMeta.dot : "bg-emerald-400"}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-300 truncate">{ev.label}</p>
                        <p className="text-xs text-gray-600">{format(parseISO(ev.date), "MMM d, yyyy")}</p>
                      </div>
                      <span className="text-xs text-gray-600 flex-shrink-0">Done ✓</span>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* ── Bottom Section: All Deadlines (Exams + Assignments) ── */}
      {unifiedTargets.length > 0 && (
        <div className="space-y-4 pt-2">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-blue-400" />
            Deadlines
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {unifiedTargets.map((target) => {
              const isAssignment = target.examType === "assignment";
              const targetMeta = !isAssignment && target.examType !== "custom" && target.examType !== "holiday"
                ? EXAM_META[target.examType as ExamType] : null;
              const dl = differenceInDays(parseISO(target.dateStr), new Date());
              const urgBase = urgencyStyle(dl);
              // Use blue accent for assignments instead of brand color
              const urg = isAssignment && dl > 7
                ? { ...urgBase, card: "from-blue-500/15 to-blue-400/10 border-blue-500/30", text: "text-blue-400" }
                : urgBase;
              const isOngoing = (() => {
                if (!target.endDateStr) return false;
                const now = new Date();
                try { return parseISO(target.dateStr) <= now && parseISO(target.endDateStr) >= now; } catch { return false; }
              })();
              return (
                <motion.div
                  key={target.id}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className={`relative overflow-hidden bg-gradient-to-br ${urg.card} border rounded-2xl p-5 shadow-lg`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <span className={`text-[10px] font-bold border rounded-full px-2 py-0.5 mb-2 inline-block uppercase tracking-wide ${
                        isAssignment ? "bg-blue-500/20 border-blue-500/40 text-blue-300" :
                        targetMeta ? `${targetMeta.bg} ${targetMeta.border} ${targetMeta.color}` :
                        "bg-gray-700/40 border-gray-600/40 text-gray-400"
                      }`}>
                        {isAssignment ? "📋 Assignment" : targetMeta ? targetMeta.label : "Event"}
                      </span>
                      <h3 className="text-base font-bold text-white leading-snug truncate">{target.label}</h3>
                      {target.subtitle && <p className="text-xs text-gray-400 mt-0.5 truncate">{target.subtitle}</p>}
                      <p className="text-xs text-gray-500 flex items-center gap-1 mt-2">
                        <CalendarDays className="w-3.5 h-3.5" />
                        {isOngoing ? "Ends " : "Due "}{format(parseISO(target.endDateStr ?? target.dateStr), "EEE, MMM d, yyyy")}
                      </p>
                    </div>
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
                          <p className={`text-2xl font-black leading-none ${urg.text}`}>
                            {dl <= 0 ? "Today" : dl === 1 ? "1d" : `${dl}d`}
                          </p>
                          {dl > 0 && <p className="text-[10px] text-gray-500">left</p>}
                        </>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
