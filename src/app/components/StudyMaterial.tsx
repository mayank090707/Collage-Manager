import { useState, useEffect } from "react";
import { useSearchParams, useLocation } from "react-router";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import {
  BookOpen,
  FileText,
  GraduationCap,
  Youtube,
  ChevronRight,
  ArrowLeft,
  LayoutGrid,
  Star,
  FileCode,
  ExternalLink,
  Download,
  Eye,
  Sparkles,
  Bookmark,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Plus,
  Trash2,
  Calendar,
  CheckSquare,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { logActivity } from "../../lib/activityTracker";
import { toast } from "sonner";

/* ─── Types ─────────────────────────────────────────────────── */
export interface MySpaceTopic {
  id: string;
  subject: string;
  unit: string;
  title: string;
  targetDate?: string;
  targetTime?: string;
  status: "none" | "completed" | "later" | "missed";
  createdAt: number;
}

type Section = "all" | "syllabus" | "important-topics" | "pyq" | "study-reference" | "my-space";
type Breadcrumb = { label: string; onClick: () => void };

const YEARS = ["2023-24", "2024-25", "2025-26"] as const;
const EXAM_TYPES = ["Mid Sem-1", "Mid Sem-2", "End Sem"] as const;
const UNITS = ["Unit-1", "Unit-2", "Unit-3", "Unit-4"] as const;

const SECTION_META = [
  {
    id: "syllabus" as Section,
    label: "Syllabus",
    icon: FileCode,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-500/10",
    border: "border-blue-200 dark:border-blue-500/30",
    desc: "View official course syllabus for your current semester",
  },
  {
    id: "important-topics" as Section,
    label: "Important Topics",
    icon: Star,
    color: "text-[var(--brand-start)]",
    bg: "bg-[var(--brand-start)]/5 dark:bg-[var(--brand-start)]/10",
    border: "border-[var(--brand-start)]/30",
    desc: "Unit-wise important topics for each subject",
  },
  {
    id: "pyq" as Section,
    label: "PYQ",
    icon: GraduationCap,
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-500/10",
    border: "border-emerald-200 dark:border-emerald-500/30",
    desc: "Previous year question papers — Mid Sem & End Sem",
  },
  {
    id: "study-reference" as Section,
    label: "Study Reference",
    icon: Youtube,
    color: "text-red-500 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-500/10",
    border: "border-red-200 dark:border-red-500/30",
    desc: "YouTube reference links and video resources per unit",
  },
  {
    id: "my-space" as Section,
    label: "My Space",
    icon: Bookmark,
    color: "text-amber-500 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-500/10",
    border: "border-amber-200 dark:border-amber-500/30",
    desc: "Personalized unit-wise study planner, target dates & checklist",
  },
];

/* ─── Default subjects per semester ─────────────────────────── */
const DEFAULT_SUBJECTS: Record<string, string[]> = {
  "1": ["Engineering Mathematics-I", "Applied Physics-I", "Applied Chemistry", "Manufacturing Processes", "Intro to IT"],
  "2": ["Engineering Mathematics-II", "Applied Physics-II", "Environmental Studies", "Electronic Devices", "Programming in C"],
  "3": ["Data Structures & Algorithms", "Digital Electronics", "Computer Organization", "Discrete Mathematics", "OOP with C++"],
  "4": ["DBMS", "Software Engineering", "Operating Systems", "Theory of Computation", "Applied Mathematics-IV"],
  "5": ["Computer Networks", "Algorithm Design", "Compiler Design", "Software Testing", "Java Programming"],
  "6": ["Artificial Intelligence", "Information Security", "Web Engineering", "Computer Graphics", "Mobile Architecture"],
  "7": ["Cloud Computing", "Big Data Analytics", "Distributed Systems", "Machine Learning", "Ad-hoc Networks"],
  "8": ["Major Project", "Technical Seminar", "Professional Ethics", "Entrepreneurship", "Industrial Training"],
};

const SYLLABUS_PDF_MAP: Record<string, { title: string; url: string; branch: string; filename: string }> = {
  "3": {
    title: "Semester 3 B.Tech Official Syllabus (IPU CSE / IT)",
    url: "/syllabus/Sem_3_IPU_CSE_IT.pdf",
    branch: "Computer Science & Engineering / Information Technology",
    filename: "Sem_3_IPU_CSE_IT_Syllabus.pdf",
  },
};

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════ */
export function StudyMaterial() {
  const [searchParams] = useSearchParams();
  const location = useLocation();

  const [subjects, setSubjects] = useState<string[]>([]);
  const [currentSemester, setCurrentSemester] = useState("1");
  const [activeSyllabusSem, setActiveSyllabusSem] = useState<string>("3");

  // Navigation state
  const [activeSection, setActiveSection] = useState<Section>("all");
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const [selectedExamType, setSelectedExamType] = useState<string | null>(null);

  // Sync tab from search params / location state
  useEffect(() => {
    const tabParam = searchParams.get("tab") || (location.state as any)?.tab;
    if (tabParam && ["all", "syllabus", "important-topics", "pyq", "study-reference", "my-space"].includes(tabParam)) {
      setActiveSection(tabParam as Section);
    }
  }, [searchParams, location]);

  // My Space topics & input state
  const [mySpaceTopics, setMySpaceTopics] = useState<MySpaceTopic[]>([]);
  const [newTopicTitle, setNewTopicTitle] = useState("");
  const [newTopicDate, setNewTopicDate] = useState("");
  const [newTopicTime, setNewTopicTime] = useState("");

  const loadStudyMaterialData = () => {
    // Load current semester
    const profileSaved = localStorage.getItem("student_profile");
    let sem = "1";
    if (profileSaved) {
      const profile = JSON.parse(profileSaved);
      if (profile.currentSemester) {
        setCurrentSemester(profile.currentSemester);
        sem = profile.currentSemester;
      }
    }
    // Load subjects
    const subsSaved = localStorage.getItem("subjects");
    if (subsSaved) {
      const parsed = JSON.parse(subsSaved);
      if (parsed.length > 0) {
        setSubjects(parsed.map((s: any) => s.name));
      } else {
        setSubjects(DEFAULT_SUBJECTS[sem] || DEFAULT_SUBJECTS["1"]);
      }
    } else {
      setSubjects(DEFAULT_SUBJECTS[sem] || DEFAULT_SUBJECTS["1"]);
    }

    // Load My Space topics
    const savedMySpace = localStorage.getItem("my_space_topics");
    if (savedMySpace) {
      try {
        setMySpaceTopics(JSON.parse(savedMySpace));
      } catch (e) {
        console.error("Failed to parse my_space_topics", e);
      }
    }
  };

  useEffect(() => {
    loadStudyMaterialData();
    const handleStorage = () => loadStudyMaterialData();
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const saveMySpaceTopics = (updated: MySpaceTopic[]) => {
    setMySpaceTopics(updated);
    localStorage.setItem("my_space_topics", JSON.stringify(updated));
    window.dispatchEvent(new Event("storage"));
  };

  const handleAddTopic = (subject: string, unit: string) => {
    if (!newTopicTitle.trim()) {
      toast.error("Please enter a topic title");
      return;
    }
    const topic: MySpaceTopic = {
      id: `topic-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      subject,
      unit,
      title: newTopicTitle.trim(),
      targetDate: newTopicDate || undefined,
      targetTime: newTopicTime || undefined,
      status: "none",
      createdAt: Date.now(),
    };
    const updated = [topic, ...mySpaceTopics];
    saveMySpaceTopics(updated);
    setNewTopicTitle("");
    setNewTopicDate("");
    setNewTopicTime("");
    toast.success(`Topic added to ${unit}!`);
  };

  const handleToggleStatus = (id: string, status: "none" | "completed" | "later" | "missed") => {
    const updated = mySpaceTopics.map((t) => (t.id === id ? { ...t, status } : t));
    saveMySpaceTopics(updated);
  };

  const handleDeleteTopic = (id: string) => {
    const updated = mySpaceTopics.filter((t) => t.id !== id);
    saveMySpaceTopics(updated);
    toast.success("Topic removed");
  };

  // ── Reset drill-down when section changes ──────────────────
  const goToSection = (section: Section) => {
    setActiveSection(section);
    setSelectedSubject(null);
    setSelectedUnit(null);
    setSelectedYear(null);
    setSelectedExamType(null);
  };

  const goBack = () => {
    if (selectedExamType) { setSelectedExamType(null); return; }
    if (selectedUnit) { setSelectedUnit(null); return; }
    if (selectedYear) { setSelectedYear(null); return; }
    if (selectedSubject) { setSelectedSubject(null); return; }
    goToSection("all");
  };

  // ── Build breadcrumbs ──────────────────────────────────────
  const breadcrumbs: Breadcrumb[] = [
    { label: "Study Material", onClick: () => goToSection("all") },
  ];
  if (activeSection !== "all") {
    const meta = SECTION_META.find((s) => s.id === activeSection)!;
    breadcrumbs.push({ label: meta.label, onClick: () => { setSelectedSubject(null); setSelectedUnit(null); setSelectedYear(null); setSelectedExamType(null); } });
  }
  if (selectedSubject) breadcrumbs.push({ label: selectedSubject, onClick: () => { setSelectedUnit(null); setSelectedYear(null); setSelectedExamType(null); setSelectedSubject(selectedSubject); } });
  if (selectedUnit) breadcrumbs.push({ label: selectedUnit, onClick: () => { setSelectedExamType(null); setSelectedUnit(selectedUnit); } });
  if (selectedYear) breadcrumbs.push({ label: selectedYear, onClick: () => { setSelectedExamType(null); setSelectedYear(selectedYear); } });
  if (selectedExamType) breadcrumbs.push({ label: selectedExamType, onClick: () => {} });

  /* ── Render helpers ───────────────────────────────────────── */
  const renderBreadcrumbs = () => (
    <div className="flex items-center gap-1.5 flex-wrap text-sm mb-6">
      {breadcrumbs.map((b, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
          <button
            onClick={b.onClick}
            className={`font-semibold transition-colors ${
              i === breadcrumbs.length - 1
                ? "text-foreground cursor-default"
                : "text-[var(--brand-start)] hover:opacity-80"
            }`}
          >
            {b.label}
          </button>
        </span>
      ))}
    </div>
  );

  const renderBackButton = () =>
    activeSection !== "all" && (
      <Button
        variant="ghost"
        size="sm"
        onClick={goBack}
        className="mb-4 flex items-center gap-2 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </Button>
    );

  /* ══════════════════════════════════════════════════════════
     VIEW: ALL — section selector
   ══════════════════════════════════════════════════════════ */
  const renderAll = () => (
    <motion.div
      key="all"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {SECTION_META.map((sec) => {
          const Icon = sec.icon;
          return (
            <motion.div
              key={sec.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Card
                onClick={() => goToSection(sec.id)}
                className={`cursor-pointer p-6 border-2 ${sec.border} ${sec.bg} hover:shadow-lg transition-all duration-200 group`}
              >
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-xl border ${sec.border} bg-white/50 dark:bg-white/5 shadow-sm`}>
                    <Icon className={`w-6 h-6 ${sec.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className={`text-lg font-bold mb-1 ${sec.color}`}>{sec.label}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{sec.desc}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:translate-x-1 transition-transform mt-1 flex-shrink-0" />
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );

  /* ══════════════════════════════════════════════════════════
     VIEW: SYLLABUS
   ══════════════════════════════════════════════════════════ */
  const renderSyllabus = () => {
    const activeData = SYLLABUS_PDF_MAP[activeSyllabusSem];

    return (
      <motion.div
        key="syllabus"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className="space-y-6"
      >
        {/* Header & Semester Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20">
              <FileCode className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Official IPU Syllabus</h2>
              <p className="text-sm text-muted-foreground">Select a semester to view or download course curriculum</p>
            </div>
          </div>

          {/* Semester Selector Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {["1", "2", "3", "4", "5", "6", "7", "8"].map((sem) => {
              const isAvailable = Boolean(SYLLABUS_PDF_MAP[sem]);
              const isActive = activeSyllabusSem === sem;
              return (
                <button
                  key={sem}
                  onClick={() => setActiveSyllabusSem(sem)}
                  className={`relative px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    isActive
                      ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                      : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <span>Sem {sem}</span>
                  {isAvailable && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="PDF Available" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Box */}
        {activeData ? (
          <div className="space-y-4">
            {/* Action Bar & Metadata */}
            <Card className="p-5 border border-blue-500/30 bg-gradient-to-r from-blue-500/10 via-indigo-500/5 to-background flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30">
                    SEMESTER {activeSyllabusSem} • {activeData.branch}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-foreground">{activeData.title}</h3>
              </div>

              <div className="flex items-center gap-3 w-full md:w-auto">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 md:flex-initial gap-2 border-blue-200 dark:border-blue-500/30 hover:bg-blue-50 dark:hover:bg-blue-500/10"
                  onClick={() => {
                    logActivity(
                      "SYLLABUS_ACCESSED",
                      `Opened Semester ${activeSyllabusSem} syllabus PDF in new tab.`,
                      "StudyMaterial",
                      undefined,
                      undefined,
                      "info"
                    );
                    window.open(activeData.url, "_blank");
                  }}
                >
                  <ExternalLink className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  Open in New Tab
                </Button>
                <a
                  href={activeData.url}
                  download={activeData.filename}
                  className="flex-1 md:flex-initial"
                  onClick={() => {
                    logActivity(
                      "SYLLABUS_ACCESSED",
                      `Downloaded Semester ${activeSyllabusSem} syllabus PDF file.`,
                      "StudyMaterial",
                      undefined,
                      undefined,
                      "info"
                    );
                  }}
                >
                  <Button
                    size="sm"
                    className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-md shadow-blue-500/20"
                  >
                    <Download className="w-4 h-4" />
                    Download PDF
                  </Button>
                </a>
              </div>
            </Card>
          </div>
        ) : (
          <Card className="p-10 border border-dashed border-border bg-card flex flex-col items-center gap-5 text-center">
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
              <Sparkles className="w-10 h-10 text-amber-500" />
            </div>
            <div className="max-w-md">
              <h3 className="text-lg font-bold text-foreground mb-1">
                Semester {activeSyllabusSem} Syllabus Coming Soon
              </h3>
              <p className="text-muted-foreground text-sm">
                The official PDF for Semester {activeSyllabusSem} has not been uploaded yet. Semester 3 syllabus is currently available for viewing and download.
              </p>
            </div>
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2.5 rounded-xl shadow-md flex items-center gap-2"
              onClick={() => setActiveSyllabusSem("3")}
            >
              <Eye className="w-4 h-4" />
              View Semester 3 Syllabus
            </Button>
          </Card>
        )}
      </motion.div>
    );
  };

  /* ══════════════════════════════════════════════════════════
     VIEW: SUBJECT GRID (shared for Important Topics, PYQ, Study Reference)
   ══════════════════════════════════════════════════════════ */
  const renderSubjectGrid = (sectionId: Section, iconEl: React.ReactNode, colorClass: string, borderClass: string, bgClass: string) => (
    <motion.div
      key={`${sectionId}-subjects`}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-4"
    >
      <p className="text-sm text-muted-foreground">Select a subject to continue</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {subjects.map((sub, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
          >
            <Card
              onClick={() => setSelectedSubject(sub)}
              className={`cursor-pointer p-5 border ${borderClass} ${bgClass} hover:shadow-md transition-all group flex items-center gap-4`}
            >
              <div className={`p-2 rounded-lg border ${borderClass} bg-white/50 dark:bg-white/5`}>
                {iconEl}
              </div>
              <span className="font-semibold text-foreground flex-1 text-sm">{sub}</span>
              <ChevronRight className={`w-4 h-4 ${colorClass} opacity-60 group-hover:opacity-100 group-hover:translate-x-1 transition-all flex-shrink-0`} />
            </Card>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );

  /* ══════════════════════════════════════════════════════════
     VIEW: UNIT GRID
   ══════════════════════════════════════════════════════════ */
  const renderUnitGrid = (colorClass: string, borderClass: string, bgClass: string) => (
    <motion.div
      key="units"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-4"
    >
      <p className="text-sm text-muted-foreground">Select a unit</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {UNITS.map((unit, i) => (
          <motion.div
            key={i}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
          >
            <Card
              onClick={() => setSelectedUnit(unit)}
              className={`cursor-pointer p-6 border-2 ${borderClass} ${bgClass} hover:shadow-lg transition-all text-center group`}
            >
              <div className={`text-2xl font-black mb-1 ${colorClass}`}>{i + 1}</div>
              <div className="text-sm font-semibold text-foreground">{unit}</div>
            </Card>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );

  /* ══════════════════════════════════════════════════════════
     VIEW: IMAGE PLACEHOLDER
   ══════════════════════════════════════════════════════════ */
  const renderImagePlaceholder = (label: string, iconEl: React.ReactNode, colorClass: string, borderClass: string, bgClass: string) => (
    <motion.div
      key="image"
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
    >
      <Card className={`border-2 ${borderClass} ${bgClass} p-10 flex flex-col items-center gap-6 text-center`}>
        <div className={`p-4 rounded-2xl border ${borderClass} bg-white/60 dark:bg-white/5`}>
          {iconEl}
        </div>
        <div>
          <h3 className={`text-lg font-bold ${colorClass} mb-2`}>{label}</h3>
          <p className="text-muted-foreground text-sm max-w-xs mx-auto">
            Content for this section will be added soon. Stay tuned!
          </p>
        </div>
        <div className={`w-full max-w-sm h-48 rounded-xl border-2 border-dashed ${borderClass} flex items-center justify-center`}>
          <div className="text-center">
            <div className={`text-4xl mb-2 ${colorClass} opacity-30`}>📸</div>
            <p className="text-xs text-muted-foreground font-medium">Image placeholder</p>
            <p className="text-xs text-muted-foreground opacity-70">Will be added later</p>
          </div>
        </div>
      </Card>
    </motion.div>
  );

  /* ══════════════════════════════════════════════════════════
     VIEW: YEAR GRID (PYQ)
   ══════════════════════════════════════════════════════════ */
  const renderYearGrid = () => (
    <motion.div
      key="years"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-4"
    >
      <p className="text-sm text-muted-foreground">Select a year</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {YEARS.map((year, i) => (
          <motion.div
            key={i}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            <Card
              onClick={() => setSelectedYear(year)}
              className="cursor-pointer p-6 border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 hover:shadow-md transition-all text-center group"
            >
              <GraduationCap className="w-8 h-8 text-emerald-600 dark:text-emerald-400 mx-auto mb-3" />
              <div className="text-lg font-bold text-foreground">{year}</div>
              <ChevronRight className="w-4 h-4 text-emerald-500 mx-auto mt-2 opacity-60 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
            </Card>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );

  /* ══════════════════════════════════════════════════════════
     VIEW: EXAM TYPE GRID (PYQ)
   ══════════════════════════════════════════════════════════ */
  const renderExamTypeGrid = () => (
    <motion.div
      key="exam-types"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-4"
    >
      <p className="text-sm text-muted-foreground">Select exam type</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {EXAM_TYPES.map((type, i) => (
          <motion.div
            key={i}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            <Card
              onClick={() => setSelectedExamType(type)}
              className="cursor-pointer p-6 border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/70 dark:bg-emerald-500/10 hover:shadow-md transition-all text-center group"
            >
              <FileText className="w-8 h-8 text-emerald-600 dark:text-emerald-400 mx-auto mb-3" />
              <div className="text-base font-bold text-foreground">{type}</div>
              <ChevronRight className="w-4 h-4 text-emerald-500 mx-auto mt-2 opacity-60 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
            </Card>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );

  /* ══════════════════════════════════════════════════════════
     VIEW: YOUTUBE LINKS PLACEHOLDER
   ══════════════════════════════════════════════════════════ */
  const renderYtPlaceholder = () => (
    <motion.div
      key="yt-links"
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
    >
      <Card className="border-2 border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 p-10 flex flex-col items-center gap-6 text-center">
        <div className="p-4 rounded-2xl border border-red-200 dark:border-red-500/30 bg-white/60 dark:bg-white/5">
          <Youtube className="w-12 h-12 text-red-500" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-red-600 dark:text-red-400 mb-2">
            YouTube References — {selectedUnit}
          </h3>
          <p className="text-muted-foreground text-sm max-w-xs mx-auto">
            YouTube video links for this unit will be added soon.
          </p>
        </div>
        <div className="w-full max-w-sm space-y-3">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="flex items-center gap-3 p-3 rounded-xl border border-dashed border-red-200 dark:border-red-500/30 bg-white/40 dark:bg-white/5"
            >
              <Youtube className="w-5 h-5 text-red-400 flex-shrink-0" />
              <div className="flex-1 text-left">
                <p className="text-xs font-semibold text-muted-foreground">Video {n} — Placeholder</p>
                <p className="text-xs text-muted-foreground opacity-60">Link will be added later</p>
              </div>
              <ExternalLink className="w-4 h-4 text-muted-foreground opacity-30" />
            </div>
          ))}
        </div>
      </Card>
    </motion.div>
  );

  /* ══════════════════════════════════════════════════════════
     VIEW: MY SPACE (Planner & Checklist)
   ══════════════════════════════════════════════════════════ */
  const renderMySpace = () => {
    // 1. Subject Grid
    if (!selectedSubject) {
      return (
        <motion.div
          key="myspace-subjects"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="space-y-4"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground font-medium">Select a subject to view or manage your unit planner</p>
            <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 font-bold">
              {mySpaceTopics.length} Total Topics Saved
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {subjects.map((sub, i) => {
              const subTopicCount = mySpaceTopics.filter((t) => t.subject === sub).length;
              const completedCount = mySpaceTopics.filter((t) => t.subject === sub && t.status === "completed").length;

              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                >
                  <Card
                    onClick={() => setSelectedSubject(sub)}
                    className="cursor-pointer p-5 border border-amber-200 dark:border-amber-500/30 bg-amber-50/50 dark:bg-amber-500/10 hover:shadow-md transition-all group flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2.5 rounded-xl border border-amber-300 dark:border-amber-500/30 bg-white/70 dark:bg-white/5 shadow-sm">
                        <Bookmark className="w-5 h-5 text-amber-500" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-foreground text-sm truncate">{sub}</h4>
                        <p className="text-xs text-muted-foreground">
                          {subTopicCount > 0
                            ? `${completedCount}/${subTopicCount} topics completed`
                            : "No topics added yet"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {subTopicCount > 0 && (
                        <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-300">
                          {subTopicCount}
                        </span>
                      )}
                      <ChevronRight className="w-4 h-4 text-amber-500 opacity-60 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      );
    }

    // 2. Unit Grid
    if (!selectedUnit) {
      return (
        <motion.div
          key="myspace-units"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="space-y-4"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground font-medium">
              Select a unit for <span className="font-bold text-foreground">{selectedSubject}</span>
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedUnit("All Units")}
              className="border-amber-500/40 text-amber-500 hover:bg-amber-500/10 text-xs font-bold gap-1.5"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              View All Units
            </Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {UNITS.map((unit, i) => {
              const unitTopics = mySpaceTopics.filter(
                (t) => t.subject === selectedSubject && t.unit === unit
              );
              const doneTopics = unitTopics.filter((t) => t.status === "completed").length;

              return (
                <motion.div
                  key={i}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                >
                  <Card
                    onClick={() => setSelectedUnit(unit)}
                    className="cursor-pointer p-6 border-2 border-amber-200 dark:border-amber-500/30 bg-amber-50/50 dark:bg-amber-500/10 hover:shadow-lg transition-all text-center group relative overflow-hidden"
                  >
                    <div className="text-3xl font-black mb-1 text-amber-500">{i + 1}</div>
                    <div className="text-sm font-bold text-foreground mb-2">{unit}</div>

                    <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground px-2 py-0.5 rounded-full bg-white/60 dark:bg-white/5 border border-border">
                      {unitTopics.length === 0
                        ? "0 topics"
                        : `${doneTopics}/${unitTopics.length} done`}
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      );
    }

    // 3. Topic Editor & Checklist View
    const isAllUnitsView = selectedUnit === "All Units";
    const filteredTopics = mySpaceTopics.filter((t) => {
      if (t.subject !== selectedSubject) return false;
      if (isAllUnitsView) return true;
      return t.unit === selectedUnit;
    });

    return (
      <motion.div
        key="myspace-editor"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className="space-y-6"
      >
        {/* Header & Quick Unit Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-border">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                {selectedSubject}
              </span>
              <span className="text-xs text-muted-foreground">({filteredTopics.length} topics)</span>
            </div>
            <h3 className="text-xl font-bold text-foreground">
              {isAllUnitsView ? "All Units Study Topics & Checklist" : `${selectedUnit} Study Topics & Checklist`}
            </h3>
          </div>

          {/* Unit Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {[...UNITS, "All Units"].map((u) => {
              const active = selectedUnit === u;
              return (
                <button
                  key={u}
                  onClick={() => setSelectedUnit(u)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    active
                      ? "bg-amber-500 text-black shadow-md shadow-amber-500/20"
                      : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {u}
                </button>
              );
            })}
          </div>
        </div>

        {/* Add Topic Input Form Card */}
        <Card className="p-5 border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-background shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Add New Topic for {selectedSubject}</span>
            </h4>
            {!isAllUnitsView && (
              <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                Target Unit: {selectedUnit}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            {/* Topic Title */}
            <div className="sm:col-span-6">
              <label className="text-[11px] font-semibold text-muted-foreground mb-1 block">
                Topic Title *
              </label>
              <input
                type="text"
                value={newTopicTitle}
                onChange={(e) => setNewTopicTitle(e.target.value)}
                placeholder="e.g. Binary Search Trees & Rotations"
                className="w-full px-3 py-2 text-sm rounded-xl bg-background border border-border focus:outline-none focus:ring-2 focus:ring-amber-500"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddTopic(selectedSubject, isAllUnitsView ? "Unit-1" : selectedUnit);
                }}
              />
            </div>

            {/* Target Unit (if All Units view) */}
            {isAllUnitsView && (
              <div className="sm:col-span-2">
                <label className="text-[11px] font-semibold text-muted-foreground mb-1 block">
                  Select Unit *
                </label>
                <select
                  id="target-unit-select"
                  defaultValue="Unit-1"
                  className="w-full px-3 py-2 text-sm rounded-xl bg-background border border-border focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  {UNITS.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Optional Target Date */}
            <div className={isAllUnitsView ? "sm:col-span-2" : "sm:col-span-3"}>
              <label className="text-[11px] font-semibold text-muted-foreground mb-1 block">
                Date (Optional)
              </label>
              <input
                type="date"
                value={newTopicDate}
                onChange={(e) => setNewTopicDate(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl bg-background border border-border focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {/* Optional Target Time */}
            <div className={isAllUnitsView ? "sm:col-span-2" : "sm:col-span-3"}>
              <label className="text-[11px] font-semibold text-muted-foreground mb-1 block">
                Time (Optional)
              </label>
              <input
                type="time"
                value={newTopicTime}
                onChange={(e) => setNewTopicTime(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl bg-background border border-border focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <Button
              onClick={() => {
                let unitToAdd = isAllUnitsView ? "Unit-1" : selectedUnit;
                if (isAllUnitsView) {
                  const selectEl = document.getElementById("target-unit-select") as HTMLSelectElement;
                  if (selectEl) unitToAdd = selectEl.value;
                }
                handleAddTopic(selectedSubject, unitToAdd);
              }}
              className="bg-amber-500 hover:bg-amber-600 text-black font-bold shadow-md shadow-amber-500/20 text-xs px-5 py-2 rounded-xl flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Add Topic</span>
            </Button>
          </div>
        </Card>

        {/* Legend for Status Colors */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs p-3 rounded-xl bg-muted/40 border border-border">
          <span className="font-bold text-foreground flex items-center gap-1.5">
            <CheckSquare className="w-4 h-4 text-amber-500" />
            Checklist Status Legend:
          </span>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
              <span className="w-3 h-3 rounded-full bg-emerald-500" /> Done (Green)
            </span>
            <span className="flex items-center gap-1.5 font-semibold text-amber-600 dark:text-amber-400">
              <span className="w-3 h-3 rounded-full bg-amber-500" /> Later / In-Progress (Yellow)
            </span>
            <span className="flex items-center gap-1.5 font-semibold text-red-600 dark:text-red-400">
              <span className="w-3 h-3 rounded-full bg-red-500" /> Missed / Forgotten (Red)
            </span>
          </div>
        </div>

        {/* Display Final Screen: Topics List */}
        {filteredTopics.length > 0 ? (
          <div className="space-y-3">
            {filteredTopics.map((topic) => {
              // Determine card styling based on user status
              let cardStyle = "bg-card border-border hover:border-amber-500/40";
              let badgeStyle = "bg-muted text-muted-foreground border-border";
              let statusLabel = "To Do";

              if (topic.status === "completed") {
                cardStyle = "bg-emerald-500/10 border-emerald-500/40 dark:bg-emerald-500/15";
                badgeStyle = "bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border-emerald-500/40";
                statusLabel = "Done";
              } else if (topic.status === "later") {
                cardStyle = "bg-amber-500/10 border-amber-500/40 dark:bg-amber-500/15";
                badgeStyle = "bg-amber-500/20 text-amber-600 dark:text-amber-300 border-amber-500/40";
                statusLabel = "Later";
              } else if (topic.status === "missed") {
                cardStyle = "bg-red-500/10 border-red-500/40 dark:bg-red-500/15";
                badgeStyle = "bg-red-500/20 text-red-600 dark:text-red-300 border-red-500/40";
                statusLabel = "Missed";
              }

              // Date/Time Display Logic
              const hasDateOrTime = Boolean(topic.targetDate || topic.targetTime);
              const dateTimeDisplay = hasDateOrTime
                ? `${topic.targetDate || ""} ${topic.targetTime ? "at " + topic.targetTime : ""}`.trim()
                : "-";

              return (
                <Card
                  key={topic.id}
                  className={`p-4 border transition-all duration-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 ${cardStyle}`}
                >
                  {/* Topic Title & Date Info */}
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border ${badgeStyle}`}>
                        {statusLabel.toUpperCase()}
                      </span>
                      <span className="text-xs font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                        {topic.unit}
                      </span>
                    </div>

                    <h4 className="text-base font-bold text-foreground leading-snug">
                      {topic.title}
                    </h4>

                    <div className="flex items-center gap-4 text-xs text-muted-foreground font-medium flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-amber-500" />
                        <span>Date & Time: <strong className="text-foreground">{dateTimeDisplay}</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* Manual Checklist Action Buttons */}
                  <div className="flex items-center gap-2 flex-wrap pt-2 md:pt-0 border-t md:border-t-0 border-border/50">
                    <button
                      onClick={() => handleToggleStatus(topic.id, topic.status === "completed" ? "none" : "completed")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 border ${
                        topic.status === "completed"
                          ? "bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-500/20"
                          : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                      }`}
                      title="Mark topic as Done (Green)"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Done</span>
                    </button>

                    <button
                      onClick={() => handleToggleStatus(topic.id, topic.status === "later" ? "none" : "later")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 border ${
                        topic.status === "later"
                          ? "bg-amber-500 text-black border-amber-500 shadow-md shadow-amber-500/20"
                          : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/20"
                      }`}
                      title="Mark topic as Later / In-Progress (Yellow)"
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>Later</span>
                    </button>

                    <button
                      onClick={() => handleToggleStatus(topic.id, topic.status === "missed" ? "none" : "missed")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 border ${
                        topic.status === "missed"
                          ? "bg-red-600 text-white border-red-600 shadow-md shadow-red-500/20"
                          : "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30 hover:bg-red-500/20"
                      }`}
                      title="Mark topic as Forgotten / Missed (Red)"
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Missed</span>
                    </button>

                    <button
                      onClick={() => handleDeleteTopic(topic.id)}
                      className="p-1.5 rounded-xl text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors ml-1"
                      title="Delete topic"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="p-10 border border-dashed border-border bg-card flex flex-col items-center justify-center gap-3 text-center">
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20">
              <Bookmark className="w-8 h-8 text-amber-500" />
            </div>
            <h4 className="text-base font-bold text-foreground">No Study Topics Added Yet</h4>
            <p className="text-xs text-muted-foreground max-w-sm">
              Use the form above to add custom study topics, specify target dates and times, and track your progress with your custom checklist!
            </p>
          </Card>
        )}
      </motion.div>
    );
  };

  /* ══════════════════════════════════════════════════════════
     SECTION TABS
   ══════════════════════════════════════════════════════════ */
  const renderSectionTabs = () => {
    const tabs = [
      { id: "all" as Section, label: "All", icon: LayoutGrid },
      ...SECTION_META.map((s) => ({ id: s.id, label: s.label, icon: s.icon })),
    ];
    return (
      <div className="flex items-center gap-2 flex-wrap mb-6 p-1 bg-muted/50 rounded-xl border border-border">
        {tabs.map(({ id, label, icon: Icon }) => {
          const active = activeSection === id;
          return (
            <button
              key={id}
              onClick={() => goToSection(id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all flex-1 sm:flex-none justify-center sm:justify-start ${
                active
                  ? "bg-[var(--brand-start)] text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/80"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          );
        })}
      </div>
    );
  };

  /* ══════════════════════════════════════════════════════════
     RENDER LOGIC PER SECTION
   ══════════════════════════════════════════════════════════ */
  const renderContent = () => {
    /* ── ALL ── */
    if (activeSection === "all") return renderAll();

    /* ── SYLLABUS ── */
    if (activeSection === "syllabus") return renderSyllabus();

    /* ── MY SPACE ── */
    if (activeSection === "my-space") return renderMySpace();

    /* ── IMPORTANT TOPICS ── */
    if (activeSection === "important-topics") {
      if (!selectedSubject) {
        return renderSubjectGrid(
          "important-topics",
          <Star className="w-4 h-4 text-[var(--brand-start)]" />,
          "text-[var(--brand-start)]",
          "border-[var(--brand-start)]/30",
          "bg-[var(--brand-start)]/5 dark:bg-[var(--brand-start)]/10"
        );
      }
      if (!selectedUnit) {
        return renderUnitGrid(
          "text-[var(--brand-start)]",
          "border-[var(--brand-start)]/30",
          "bg-[var(--brand-start)]/5 dark:bg-[var(--brand-start)]/10"
        );
      }
      return renderImagePlaceholder(
        `${selectedSubject} — ${selectedUnit} Important Topics`,
        <Star className="w-12 h-12 text-[var(--brand-start)]" />,
        "text-[var(--brand-start)]",
        "border-[var(--brand-start)]/30",
        "bg-[var(--brand-start)]/5 dark:bg-[var(--brand-start)]/10"
      );
    }

    /* ── PYQ ── */
    if (activeSection === "pyq") {
      if (!selectedSubject) {
        return renderSubjectGrid(
          "pyq",
          <GraduationCap className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />,
          "text-emerald-600 dark:text-emerald-400",
          "border-emerald-200 dark:border-emerald-500/30",
          "bg-emerald-50 dark:bg-emerald-500/10"
        );
      }
      if (!selectedYear) return renderYearGrid();
      if (!selectedExamType) return renderExamTypeGrid();
      return renderImagePlaceholder(
        `${selectedSubject} — ${selectedYear} ${selectedExamType}`,
        <GraduationCap className="w-12 h-12 text-emerald-600 dark:text-emerald-400" />,
        "text-emerald-600 dark:text-emerald-400",
        "border-emerald-200 dark:border-emerald-500/30",
        "bg-emerald-50 dark:bg-emerald-500/10"
      );
    }

    /* ── STUDY REFERENCE ── */
    if (activeSection === "study-reference") {
      if (!selectedSubject) {
        return renderSubjectGrid(
          "study-reference",
          <Youtube className="w-4 h-4 text-red-500" />,
          "text-red-500",
          "border-red-200 dark:border-red-500/30",
          "bg-red-50 dark:bg-red-500/10"
        );
      }
      if (!selectedUnit) {
        return renderUnitGrid(
          "text-red-500",
          "border-red-200 dark:border-red-500/30",
          "bg-red-50 dark:bg-red-500/10"
        );
      }
      return renderYtPlaceholder();
    }

    return null;
  };

  /* ══════════════════════════════════════════════════════════
     JSX
   ══════════════════════════════════════════════════════════ */
  return (
    <div className="p-4 md:p-8 space-y-4">
      {/* Header */}
      <div className="mb-2">
        <h1 className="text-3xl md:text-4xl font-black bg-gradient-to-r from-[var(--brand-start)] via-amber-600 to-[var(--brand-start)] bg-clip-text text-transparent mb-1">
          Study Material
        </h1>
        <p className="text-muted-foreground text-sm">
          Semester {currentSemester} — Syllabus, Important Topics, PYQ & Study References
        </p>
      </div>

      {/* Section Tabs */}
      {renderSectionTabs()}

      {/* Breadcrumbs (only when drilling down) */}
      {breadcrumbs.length > 1 && renderBreadcrumbs()}

      {/* Back button */}
      {(selectedSubject || selectedUnit || selectedYear || selectedExamType) && renderBackButton()}

      {/* Content */}
      <AnimatePresence mode="wait">
        {renderContent()}
      </AnimatePresence>
    </div>
  );
}
