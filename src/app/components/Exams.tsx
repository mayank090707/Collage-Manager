import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import {
  CalendarDays, Clock, Flame, ChevronLeft, ChevronRight, AlertTriangle, BookOpen, Settings2
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
  examType: ExamType | "holiday" | "custom";
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

// ── Component ─────────────────────────────────────────────────────────────────
export function Exams() {
  const navigate = useNavigate();
  const [data, setData] = useState<CalendarState | null>(null);
  const [viewMonth, setViewMonth] = useState(new Date());

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
  const upcomingExamEvents = allEvents
    .filter((e) => e.examType !== "custom" && differenceInDays(parseISO(e.date), new Date()) >= 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  const pastExamEvents = allEvents
    .filter((e) => e.examType !== "custom" && differenceInDays(parseISO(e.date), new Date()) < 0)
    .sort((a, b) => b.date.localeCompare(a.date));

  const hasUrgent = upcomingExamEvents.some(
    (e) => differenceInDays(parseISO(e.date), new Date()) <= 3
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
            Exams
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
            <p className="text-red-300 font-semibold text-sm">Urgent — Exams in the next 3 days!</p>
            <p className="text-red-400/70 text-xs mt-0.5">Check your schedule and prepare accordingly.</p>
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
                        const evMeta = ev.examType !== "custom" && ev.examType !== "holiday" ? EXAM_META[ev.examType as ExamType] : null;
                        return (
                          <div
                            key={ev.id}
                            className={`w-[90%] mt-0.5 px-1 py-0.5 rounded text-[8px] font-semibold truncate leading-tight text-center ${
                              evMeta ? `${evMeta.bg} ${evMeta.color}` : "bg-emerald-500/20 text-emerald-300"
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
          {/* Upcoming exam events */}
          <Card className="bg-[#111118]/80 backdrop-blur-xl border-gray-800/50 p-5">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Upcoming Exams</h3>
            {upcomingExamEvents.length > 0 ? (
              <div className="space-y-2">
                {upcomingExamEvents.map((ev, i) => {
                  const daysLeft = differenceInDays(parseISO(ev.date), new Date());
                  const u = urgencyStyle(daysLeft);
                  const evMeta = ev.examType !== "custom" ? EXAM_META[ev.examType as ExamType] : null;
                  return (
                    <motion.div
                      key={ev.id}
                      initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className={`bg-gradient-to-r ${u.card} border rounded-xl p-3`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          {evMeta && (
                            <span className={`text-[10px] font-bold ${evMeta.pill} border rounded-full px-2 py-0.5 mb-1 inline-block`}>
                              {evMeta.label}
                            </span>
                          )}
                          <p className="text-white font-semibold text-sm truncate">{ev.label}</p>
                          <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                            <CalendarDays className="w-3 h-3" />
                            {format(parseISO(ev.date), "EEE, MMM d")}
                          </p>
                        </div>
                        <div className={`flex-shrink-0 text-right`}>
                          <p className={`text-xl font-black ${u.text} leading-none`}>
                            {daysLeft === 0 ? "Today" : daysLeft === 1 ? "1d" : `${daysLeft}d`}
                          </p>
                          {daysLeft > 0 && <p className="text-[10px] text-gray-500">left</p>}
                          {daysLeft <= 3 && <Flame className={`w-3.5 h-3.5 ${u.text} mx-auto mt-0.5`} />}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <BookOpen className="w-10 h-10 text-gray-700 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">No upcoming exams</p>
              </div>
            )}
          </Card>

          {/* Past exams */}
          {pastExamEvents.length > 0 && (
            <Card className="bg-[#111118]/80 backdrop-blur-xl border-gray-800/50 p-5">
              <h3 className="text-sm font-bold text-gray-600 uppercase tracking-wider mb-3">Completed</h3>
              <div className="space-y-2">
                {pastExamEvents.slice(0, 6).map((ev) => {
                  const evMeta = ev.examType !== "custom" ? EXAM_META[ev.examType as ExamType] : null;
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

      {/* Bottom countdown cards */}
      {upcomingExamEvents.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-400" />
            Countdown
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {upcomingExamEvents.map((ev, i) => {
              const daysLeft = differenceInDays(parseISO(ev.date), new Date());
              const u = urgencyStyle(daysLeft);
              const evMeta = ev.examType !== "custom" ? EXAM_META[ev.examType as ExamType] : null;
              return (
                <motion.div
                  key={ev.id}
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Card className={`relative overflow-hidden bg-gradient-to-br ${u.card} border p-5`}>
                    {evMeta && (
                      <span className={`text-[10px] font-bold ${evMeta.color} mb-2 block`}>{evMeta.label}</span>
                    )}
                    <p className="text-white font-semibold text-sm leading-tight mb-1">{ev.label}</p>
                    <p className="text-gray-400 text-xs mb-3 flex items-center gap-1">
                      <CalendarDays className="w-3 h-3" />
                      {format(parseISO(ev.date), "EEE, MMM d yyyy")}
                    </p>
                    <div className={`text-4xl font-black ${u.text} leading-none`}>
                      {daysLeft > 0 ? daysLeft : 0}
                      <span className="text-sm font-semibold ml-1">{daysLeft === 1 ? "day" : "days"}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {daysLeft === 0 ? "Today!" : daysLeft === 1 ? "Tomorrow" : "remaining"}
                    </p>
                    {/* urgency bar */}
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black/20">
                      <div
                        className={`h-full ${u.dot}`}
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
    </div>
  );
}
