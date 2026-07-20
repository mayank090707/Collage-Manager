import { useState, useEffect } from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { 
  FolderOpen, 
  Plus, 
  ExternalLink, 
  Trash2, 
  Search, 
  Filter, 
  BookOpen, 
  FileText, 
  Bookmark, 
  FileCode,
  GraduationCap
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "motion/react";

interface Resource {
  id: string;
  title: string;
  category: "syllabus" | "notes" | "pyq" | "book" | "other";
  subject: string;
  link: string;
  addedAt: string;
  comments?: string;
}

const CATEGORIES = [
  { id: "all", label: "All Items", icon: FolderOpen },
  { id: "notes", label: "Notes", icon: FileText },
  { id: "syllabus", label: "Syllabus", icon: FileCode },
  { id: "pyq", label: "PYQs (Exam Papers)", icon: GraduationCap },
  { id: "book", label: "Reference Books", icon: BookOpen },
  { id: "other", label: "Bookmarks/Others", icon: Bookmark }
];

export function StudyMaterial() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [currentSemester, setCurrentSemester] = useState<string>("1");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [activeSubject, setActiveSubject] = useState("all");
  const [showAddModal, setShowAddModal] = useState(false);

  // Form states
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<Resource["category"]>("notes");
  const [subject, setSubject] = useState("");
  const [link, setLink] = useState("");
  const [comments, setComments] = useState("");

  useEffect(() => {
    loadProfileAndSubjects();
    loadResources();
  }, []);

  const loadProfileAndSubjects = () => {
    // Current Semester
    const profileSaved = localStorage.getItem("student_profile");
    let sem = "1";
    if (profileSaved) {
      const profile = JSON.parse(profileSaved);
      if (profile.currentSemester) {
        setCurrentSemester(profile.currentSemester);
        sem = profile.currentSemester;
      }
    }

    // Subjects
    const subsSaved = localStorage.getItem("subjects");
    if (subsSaved) {
      const parsedSubs = JSON.parse(subsSaved);
      if (parsedSubs.length > 0) {
        setSubjects(parsedSubs.map((s: any) => s.name));
        return;
      }
    }

    // Fallbacks if no subjects are configured
    const defaultSubjects: Record<string, string[]> = {
      "1": ["Engineering Mathematics-I", "Applied Physics-I", "Applied Chemistry", "Manufacturing Processes", "Introduction to IT"],
      "2": ["Engineering Mathematics-II", "Applied Physics-II", "Environmental Studies", "Electronic Devices", "Programming in C"],
      "3": ["Data Structures", "Digital Electronics", "Computer Organization", "Discrete Mathematics", "Object Oriented Programming"],
      "4": ["Database Management Systems", "Software Engineering", "Operating Systems", "Theory of Computation", "Applied Mathematics-IV"],
      "5": ["Computer Networks", "Algorithm Design", "Compiler Design", "Software Testing", "Java Programming"],
      "6": ["Artificial Intelligence", "Information Security", "Web Engineering", "Computer Graphics", "Mobile Architecture"],
      "7": ["Cloud Computing", "Big Data Analytics", "Distributed Systems", "Machine Learning", "Ad-hoc Networks"],
      "8": ["Major Project", "Technical Seminar", "Professional Ethics", "Entrepreneurship", "Industrial Training"]
    };

    setSubjects(defaultSubjects[sem] || defaultSubjects["1"]);
  };

  const loadResources = () => {
    const saved = localStorage.getItem("study_materials");
    if (saved) {
      setResources(JSON.parse(saved));
    } else {
      // Seed initial sample data so the UI isn't empty/placeholder-heavy on first visit
      const seedData: Resource[] = [
        {
          id: "seed-1",
          title: "Complete Lecture Notes (Units 1-4)",
          category: "notes",
          subject: subjects[0] || "Core Course Subject",
          link: "https://drive.google.com/drive/folders/sample-notes-drive",
          addedAt: new Date().toLocaleDateString(),
          comments: "Includes handwritten diagrams and professor-provided slides."
        },
        {
          id: "seed-2",
          title: "Official Syllabus & Reference Schemes",
          category: "syllabus",
          subject: subjects[0] || "Core Course Subject",
          link: "https://ipu.ac.in/syllabus",
          addedAt: new Date().toLocaleDateString(),
          comments: "Latest approved syllabus structure."
        },
        {
          id: "seed-3",
          title: "End-Term Theory PYQ 2024",
          category: "pyq",
          subject: subjects[1] || "Allied Science/Math",
          link: "https://drive.google.com/file/d/sample-exam-pdf/view",
          addedAt: new Date().toLocaleDateString(),
          comments: "Contains solutions annotated by seniors."
        },
        {
          id: "seed-4",
          title: "Standard Reference E-Book (10th Edition)",
          category: "book",
          subject: subjects[2] || "Programming & Tech",
          link: "https://example.com/books/textbook-pdf",
          addedAt: new Date().toLocaleDateString(),
          comments: "Recommended textbook as per IPU regulations."
        }
      ];
      setResources(seedData);
      localStorage.setItem("study_materials", JSON.stringify(seedData));
    }
  };

  const handleAddResource = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !link.trim() || !subject) {
      toast.error("Please fill in all required fields!");
      return;
    }

    // Basic URL validation
    let validatedLink = link.trim();
    if (!/^https?:\/\//i.test(validatedLink)) {
      validatedLink = "https://" + validatedLink;
    }

    const newResource: Resource = {
      id: "res-" + Date.now(),
      title: title.trim(),
      category,
      subject,
      link: validatedLink,
      addedAt: new Date().toLocaleDateString(),
      comments: comments.trim() || undefined
    };

    const updated = [newResource, ...resources];
    setResources(updated);
    localStorage.setItem("study_materials", JSON.stringify(updated));

    // Reset Form
    setTitle("");
    setCategory("notes");
    setSubject("");
    setLink("");
    setComments("");
    setShowAddModal(false);
    toast.success("Study material added successfully!");
  };

  const handleDeleteResource = (id: string) => {
    const updated = resources.filter((r) => r.id !== id);
    setResources(updated);
    localStorage.setItem("study_materials", JSON.stringify(updated));
    toast.success("Material removed.");
  };

  // Filter Logic
  const filteredResources = resources.filter((res) => {
    const matchesSearch = res.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (res.comments && res.comments.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = activeCategory === "all" || res.category === activeCategory;
    const matchesSubject = activeSubject === "all" || res.subject === activeSubject;

    return matchesSearch && matchesCategory && matchesSubject;
  });

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl md:text-4xl mb-2 bg-gradient-to-r from-[var(--brand-start)] via-gray-800 dark:via-white to-[var(--brand-start)] bg-clip-text text-transparent font-black">
            Study Material
          </h1>
          <p className="text-slate-500 dark:text-gray-400">
            Access and organize Syllabus, PYQs, Textbooks, and Lecture notes for Semester {currentSemester}
          </p>
        </div>

        <Button
          onClick={() => {
            // Auto-select first subject if possible
            if (subjects.length > 0) setSubject(subjects[0]);
            setShowAddModal(true);
          }}
          className="bg-gradient-to-r from-[var(--brand-start)] to-[var(--brand-start)] hover:brightness-110 text-white font-semibold shadow-md flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Add Resource
        </Button>
      </div>

      {/* Quick Stats Banner */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Resources", count: resources.length, icon: FolderOpen, color: "text-[var(--brand-start)] bg-[var(--brand-start)]/10 border-[var(--brand-start)]/20" },
          { label: "Handwritten Notes", count: resources.filter(r => r.category === "notes").length, icon: FileText, color: "text-blue-500 bg-blue-500/10 border-blue-500/20" },
          { label: "Past Year Papers", count: resources.filter(r => r.category === "pyq").length, icon: GraduationCap, color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" },
          { label: "Reference Books", count: resources.filter(r => r.category === "book").length, icon: BookOpen, color: "text-purple-500 bg-purple-500/10 border-purple-500/20" }
        ].map((stat, i) => {
          const Icon = stat.icon;
          return (
            <Card key={i} className="bg-card dark:bg-[#111118]/80 backdrop-blur-xl border border-border/50 dark:border-gray-800/50 p-4 flex items-center gap-4 shadow-sm">
              <div className={`p-2.5 rounded-lg border ${stat.color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-black text-slate-800 dark:text-white">{stat.count}</p>
                <p className="text-xs text-slate-500 dark:text-gray-400 font-medium">{stat.label}</p>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Filters Pane */}
      <Card className="bg-card dark:bg-[#111118]/80 backdrop-blur-xl border border-border/50 dark:border-gray-800/50 p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row items-center gap-4">
          {/* Search bar */}
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-gray-500 w-4  h-4" />
            <Input
              type="text"
              placeholder="Search resources, topics, descriptions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-full bg-slate-50 hover:bg-slate-100/50 dark:bg-[#0a0a0f]/50 border border-border/80 dark:border-gray-700/80 focus:border-[var(--brand-start)] text-slate-800 dark:text-white rounded-lg h-10 transition-all font-medium placeholder-slate-400 dark:placeholder-gray-500"
            />
          </div>

          {/* Subject Filter */}
          <div className="flex items-center gap-2 w-full md:w-auto flex-shrink-0">
            <Filter className="text-slate-400 dark:text-gray-500 w-4 h-4" />
            <select
              value={activeSubject}
              onChange={(e) => setActiveSubject(e.target.value)}
              className="bg-slate-50 dark:bg-[#0a0a0f]/50 border border-border/80 dark:border-gray-700/80 focus:border-[var(--brand-start)] text-slate-800 dark:text-white rounded-lg h-10 px-3 font-medium outline-none text-sm w-full md:w-56"
            >
              <option value="all">Filter by Subject</option>
              {subjects.map((sub, idx) => (
                <option key={idx} value={sub}>{sub}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex items-center flex-wrap gap-2 pt-2 border-t border-border/30 dark:border-gray-850">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const active = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                  active
                    ? "bg-[var(--brand-start)]/10 dark:bg-[var(--brand-start)]/20 text-[var(--brand-start)] border-[var(--brand-start)]/30 shadow-sm"
                    : "bg-slate-50 dark:bg-gray-800/10 border-border/50 dark:border-gray-800/50 text-slate-600 dark:text-gray-400 hover:text-slate-800 dark:hover:text-white"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {cat.label}
              </button>
            );
          })}
        </div>
      </Card>

      {/* Resources List Group */}
      {filteredResources.length === 0 ? (
        <Card className="bg-card dark:bg-[#111118]/80 border border-border/50 dark:border-gray-800/50 text-center py-16">
          <BookOpen className="w-16 h-16 text-slate-300 dark:text-gray-700 mx-auto mb-4" />
          <h3 className="text-slate-700 dark:text-gray-300 text-lg font-bold">No results found</h3>
          <p className="text-slate-500 dark:text-gray-500 text-sm mt-1 whitespace-pre-line leading-relaxed">
            Try adjusting your search query, selecting another category, 
            or click "Add Resource" to register a new material.
          </p>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {filteredResources.map((res, idx) => {
            const catInfo = CATEGORIES.find(c => c.id === res.category) || CATEGORIES[0];
            const CatIcon = catInfo.icon;
            return (
              <motion.div
                key={res.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: idx * 0.05 }}
              >
                <Card className="bg-card dark:bg-[#111118]/90 border border-border/50 dark:border-gray-850 hover:border-[var(--brand-start)]/30 dark:hover:border-[var(--brand-start)]/30 shadow-sm hover:shadow-md transition-all p-5 flex flex-col h-full justify-between">
                  <div className="space-y-3">
                    {/* Header: Class tag & Subject */}
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="text-[10px] uppercase tracking-wider font-extrabold px-2.5 py-1 rounded bg-[var(--brand-start)]/10 text-[var(--brand-start)] border border-[var(--brand-start)]/20">
                        {catInfo.label}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-gray-400 font-bold max-w-[65%] truncate bg-slate-100 dark:bg-gray-800/30 px-2 py-0.5 rounded">
                        {res.subject}
                      </span>
                    </div>

                    {/* Title */}
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white leading-snug line-clamp-2">
                      {res.title}
                    </h3>

                    {/* Description/Comments */}
                    {res.comments && (
                      <p className="text-sm text-slate-500 dark:text-gray-450 line-clamp-3 italic leading-relaxed">
                        "{res.comments}"
                      </p>
                    )}
                  </div>

                  {/* Footer Row */}
                  <div className="flex items-center justify-between border-t border-border/20 dark:border-gray-800/40 mt-5 pt-4">
                    <span className="text-[10px] text-slate-400 dark:text-gray-500 font-medium">
                      Added {res.addedAt}
                    </span>

                    <div className="flex items-center gap-2">
                      {/* Delete */}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteResource(res.id)}
                        className="text-slate-400 hover:text-red-500 hover:bg-red-500/10 h-8 w-8 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>

                      {/* Open Link */}
                      <a href={res.link} target="_blank" rel="noopener noreferrer">
                        <Button
                          size="sm"
                          className="bg-gradient-to-r from-[var(--brand-start)]/15 to-[var(--brand-start)]/15 hover:from-[var(--brand-start)]/30 hover:to-[var(--brand-start)]/30 border border-[var(--brand-start)]/30 text-[var(--brand-start)] font-bold text-xs"
                        >
                          Access Resource
                          <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
                        </Button>
                      </a>
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Add Resource Dialog Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="bg-card dark:bg-[#111118] border border-border/50 dark:border-gray-800 text-slate-800 dark:text-white max-w-lg rounded-xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-[var(--brand-start)] to-[var(--brand-start)] bg-clip-text text-transparent flex items-center gap-2">
              <FolderOpen className="w-6 h-6 text-[var(--brand-start)]" />
              Add Study Resource
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleAddResource} className="space-y-4 pt-2">
            {/* Title */}
            <div className="space-y-1.5">
              <Label htmlFor="title" className="text-slate-600 dark:text-gray-300 font-semibold text-sm">Resource Name/Title <span className="text-red-500">*</span></Label>
              <Input
                id="title"
                placeholder="e.g. Unit 3 Trees & Graphs Notes PDF"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="bg-slate-50 dark:bg-[#0a0a0f]/50 border-gray-300 dark:border-gray-700/80 focus:border-[var(--brand-start)] focus:ring-0 text-slate-800 dark:text-white text-sm"
              />
            </div>

            {/* Category and Subject in row */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="category" className="text-slate-600 dark:text-gray-300 font-semibold text-sm">Category</Label>
                <select
                  id="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as Resource["category"])}
                  className="w-full bg-slate-50 dark:bg-[#0a0a0f]/50 border border-gray-300 dark:border-gray-700/80 focus:border-[var(--brand-start)] text-slate-850 dark:text-white rounded-lg h-9 px-3 text-sm focus:outline-none"
                >
                  <option value="notes">Notes</option>
                  <option value="syllabus">Syllabus</option>
                  <option value="pyq">PYQs (Exams)</option>
                  <option value="book">Reference Books</option>
                  <option value="other">Bookmarks/Other</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="subject" className="text-slate-600 dark:text-gray-300 font-semibold text-sm">Subject <span className="text-red-500">*</span></Label>
                <select
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  required
                  className="w-full bg-slate-50 dark:bg-[#0a0a0f]/50 border border-gray-300 dark:border-gray-700/80 focus:border-[var(--brand-start)] text-slate-850 dark:text-white rounded-lg h-9 px-3 text-sm focus:outline-none"
                >
                  <option value="" disabled>Select Subject</option>
                  {subjects.map((sub, idx) => (
                    <option key={idx} value={sub}>{sub}</option>
                  ))}
                  <option value="General/Other">General/Other Topic</option>
                </select>
              </div>
            </div>

            {/* URL Link */}
            <div className="space-y-1.5">
              <Label htmlFor="link" className="text-slate-600 dark:text-gray-300 font-semibold text-sm">URL / Drive Link <span className="text-red-500">*</span></Label>
              <Input
                id="link"
                placeholder="e.g. drive.google.com/xyz..."
                value={link}
                onChange={(e) => setLink(e.target.value)}
                required
                className="bg-slate-50 dark:bg-[#0a0a0f]/50 border-gray-300 dark:border-gray-700/80 focus:border-[var(--brand-start)] focus:ring-0 text-slate-800 dark:text-white text-sm"
              />
            </div>

            {/* Comments / Description */}
            <div className="space-y-1.5">
              <Label htmlFor="comments" className="text-slate-600 dark:text-gray-300 font-semibold text-sm">Comments / Notes (Optional)</Label>
              <textarea
                id="comments"
                rows={3}
                placeholder="e.g. Prepared by Prof. Garg, cover page missing but content is fully accurate."
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0a0a0f]/50 border border-gray-300 dark:border-gray-700/80 rounded-lg text-slate-800 dark:text-white text-sm focus:border-[var(--brand-start)] focus:outline-none focus:ring-0"
              />
            </div>

            {/* Buttons */}
            <div className="flex justify-end space-x-3 pt-3 border-t border-border/20 dark:border-gray-800/40">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAddModal(false)}
                className="border-gray-300 dark:border-gray-705 dark:hover:bg-gray-850 hover:bg-slate-100 text-slate-600 dark:text-white"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-gradient-to-r from-[var(--brand-start)] to-[var(--brand-start)] text-white hover:brightness-110 font-bold"
              >
                Add Resource
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
