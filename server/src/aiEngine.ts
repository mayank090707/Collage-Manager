/**
 * Campus AI Core Intelligence & Natural Language Engine
 *
 * Implements:
 *  - Entity Extraction (Subject, Semester, Day, Date, Miss Count, Target Value)
 *  - Dynamic Subject Recognition & Alias Resolution (Zero Hardcoded Subjects)
 *  - Multi-Intent Detection & Compound Query Handling
 *  - Stateful Follow-up Context Resolution
 *  - Deterministic Execution & Calculation Reuse
 *  - Multiple Action Button Mapping
 *  - Optional Gemini LLM Natural Language Synthesis Fallback
 */

import {
  getStudentSubjects,
  getOverallAttendance,
  getSubjectAttendance,
  compareSubjects,
  getCGPA,
  getSGPA,
  compareSemesters,
  getTargetCGPA,
  getMarks,
  getBacklogs,
  getTimetable,
  getUpcomingExams,
  getAcademicSummary,
  getPlacementReadiness,
} from './aiTools';

export interface ConversationContext {
  lastSubject?: string;
  lastSemester?: number;
  lastTopic?: string;
  lastIntents?: string[];
}

export interface AIResponse {
  message: string;
  intent: string;
  entities: {
    subject?: string;
    semester?: number | string;
    day?: string;
    missCount?: number;
    targetValue?: number;
  };
  actions: Array<{ label: string; route: string }>;
  contextToSave: ConversationContext;
}

// Map of intents to user-friendly navigation buttons
const ROUTE_MAP: Record<string, { label: string; route: string }> = {
  DASHBOARD: { label: 'Open Dashboard', route: '/app' },
  ATTENDANCE: { label: 'Open Attendance', route: '/app/academics' },
  SGPA: { label: 'Open SGPA', route: '/app/academics' },
  CGPA: { label: 'Open CGPA', route: '/app/academics' },
  BACKLOGS: { label: 'Open Backlogs', route: '/app/academics' },
  EXAMS: { label: 'Open Exams', route: '/app/exams' },
  TIMETABLE: { label: 'Open Timetable', route: '/app/timetable' },
  ANALYTICS: { label: 'Open Analytics', route: '/app/analytics' },
  STUDY_MATERIAL: { label: 'Open Study Material', route: '/app/study-material' },
  SYLLABUS: { label: 'Open Syllabus', route: '/app/study-material' },
  PYQ: { label: 'Open PYQs', route: '/app/study-material' },
  IMPORTANT_TOPICS: { label: 'Open Important Topics', route: '/app/study-material' },
  STUDY_REFERENCE: { label: 'Open Study Reference', route: '/app/study-material' },
  MY_SPACE: { label: 'Open My Space', route: '/app/study-material' },
  PROFILE: { label: 'Open Profile', route: '/app/profile' },
  TARGET_PREDICTOR: { label: 'Open Target Predictor', route: '/app/target-predictor' },
  MARKS_CALCULATOR: { label: 'Open Marks Calculator', route: '/app/marks-calculator' },
};

/**
 * Common Subject Alias Normalization Helper
 */
const ALIAS_MAP: Record<string, string[]> = {
  oops: ['object oriented programming', 'object oriented programming & systems', 'oop', 'java', 'cpp', 'c++'],
  ds: ['data structures', 'data structure', 'dsa', 'data structures & algorithms'],
  dlcd: ['digital logic', 'digital logic circuit design', 'digital logic design'],
  maths: ['discrete mathematics', 'discrete maths', 'applied mathematics', 'engineering mathematics', 'math', 'mathematics'],
  cm: ['computational methods', 'numerical methods'],
  os: ['operating systems', 'operating system'],
  dbms: ['database management system', 'database management', 'database'],
  cn: ['computer networks', 'networking'],
};

/**
 * Resolve user text against student's actual registered subjects
 */
function resolveSubjectEntity(
  userText: string,
  registeredSubjects: Array<{ name: string; code?: string }>
): { matchedSubject?: string; multipleMatches?: string[]; requestedUnknown?: string } {
  if (registeredSubjects.length === 0) return {};

  const text = userText.toLowerCase();

  // 1. Direct check against registered subject names and codes
  for (const s of registeredSubjects) {
    const sNameLower = s.name.toLowerCase();
    const sCodeLower = s.code ? s.code.toLowerCase() : '';

    if (text.includes(sNameLower) || (sCodeLower && text.includes(sCodeLower))) {
      return { matchedSubject: s.name };
    }
  }

  // 2. Alias match
  for (const [aliasKey, fullNames] of Object.entries(ALIAS_MAP)) {
    const aliasRegex = new RegExp(`\\b${aliasKey}\\b`, 'i');
    if (aliasRegex.test(text)) {
      // Check which registered subject matches this alias
      const matches = registeredSubjects.filter(s => {
        const nameL = s.name.toLowerCase();
        return aliasKey === nameL || fullNames.some(fn => nameL.includes(fn) || fn.includes(nameL));
      });

      if (matches.length === 1) {
        return { matchedSubject: matches[0].name };
      } else if (matches.length > 1) {
        return { multipleMatches: matches.map(m => m.name) };
      }
    }
  }

  // 3. Substring word match against registered subjects
  const candidates: string[] = [];
  for (const s of registeredSubjects) {
    const words = s.name.toLowerCase().split(/\s+/).filter(w => w.length > 2 && !['and', 'for', 'the', 'with', 'lab'].includes(w));
    if (words.some(w => text.includes(w))) {
      candidates.push(s.name);
    }
  }

  if (candidates.length === 1) {
    return { matchedSubject: candidates[0] };
  } else if (candidates.length > 1) {
    return { multipleMatches: candidates };
  }

  // 4. Extract potential subject term if explicit "in [subject]" or "for [subject]" was used
  const subQueryMatch = text.match(/\b(?:in|for|of|about)\s+([a-z0-9\s]+)/i);
  if (subQueryMatch) {
    const rawQuery = subQueryMatch[1].replace(/\b(my|the|overall|semester|today|tomorrow|class|exam|attendance|marks|grade)\b/g, '').trim();
    if (rawQuery.length > 1) {
      return { requestedUnknown: rawQuery };
    }
  }

  return {};
}

/**
 * Extract numerical & temporal entities from user text
 */
function extractEntities(text: string, registeredSubjects: Array<{ name: string; code?: string }>) {
  const lower = text.toLowerCase();

  // Semester entity
  let semester: number | string | undefined;
  const semMatch = lower.match(/\bsem(?:ester)?\s*([1-8])\b/i) || lower.match(/\b([1-8])(?:st|nd|rd|th)?\s*sem(?:ester)?\b/i);
  if (semMatch) {
    semester = parseInt(semMatch[1], 10);
  } else if (/\blast sem(?:ester)?\b/.test(lower) || /\bprevious sem(?:ester)?\b/.test(lower)) {
    semester = 'previous';
  } else if (/\bbest sem(?:ester)?\b/.test(lower) || /\bhighest sem(?:ester)?\b/.test(lower)) {
    semester = 'best';
  }

  // Day entity
  let day: string | undefined;
  if (/\btoday\b/.test(lower)) day = 'today';
  else if (/\btomorrow\b/.test(lower)) day = 'tomorrow';
  else if (/\byesterday\b/.test(lower)) day = 'yesterday';
  else {
    const dayMatch = lower.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i);
    if (dayMatch) day = dayMatch[1];
  }

  // Miss count entity (for safe bunks / skipping classes)
  let missCount: number | undefined;
  const missMatch = lower.match(/\b(miss|bunk|skip)\s*([0-9]+)\b/i) || lower.match(/\b([0-9]+)\s*(?:classes|lectures|bunks)\b/i);
  if (missMatch) {
    missCount = parseInt(missMatch[1] || missMatch[2], 10);
  }

  // Target value entity (e.g. CGPA target 9.7 or 75%)
  let targetValue: number | undefined;
  const targetMatch = lower.match(/\b(?:target|reach|get)\s*([0-9]+(?:\.[0-9]+)?)\b/i);
  if (targetMatch) {
    targetValue = parseFloat(targetMatch[1]);
  }

  // Subject entity
  const subjectRes = resolveSubjectEntity(text, registeredSubjects);

  return {
    semester,
    day,
    missCount,
    targetValue,
    subject: subjectRes.matchedSubject,
    multipleMatches: subjectRes.multipleMatches,
    requestedUnknown: subjectRes.requestedUnknown,
  };
}

/**
 * Main Process Query Entrypoint
 */
export async function processCampusAIQuery(
  userId: string,
  userMessage: string,
  contextHistory?: ConversationContext
): Promise<AIResponse> {
  const registeredSubjects = await getStudentSubjects(userId);
  const entities = extractEntities(userMessage, registeredSubjects);
  const lower = userMessage.toLowerCase().trim();

  // Handle Stateful Context Inheritance
  let activeSubject = entities.subject;
  if (!activeSubject && contextHistory?.lastSubject) {
    // If query is a follow-up ("what about OOPS?", "how many can I bunk?", "can I skip tomorrow?")
    if (
      /\b(bunk|miss|skip|classes|attendance|marks|grade)\b/.test(lower) ||
      lower.startsWith('what about') ||
      lower.startsWith('how about') ||
      lower.startsWith('and') ||
      lower.startsWith('for')
    ) {
      activeSubject = contextHistory.lastSubject;
    }
  }

  // Handle Ambiguous Subject Match
  if (entities.multipleMatches && entities.multipleMatches.length > 1 && !activeSubject) {
    return {
      message: `Which subject do you mean? I found multiple matches in your account: ${entities.multipleMatches.join(', ')}.`,
      intent: 'AMBIGUOUS_SUBJECT',
      entities: { subject: undefined },
      actions: [{ label: 'Open Attendance', route: '/app/academics' }],
      contextToSave: { ...contextHistory },
    };
  }

  // Handle Unknown Subject Mentioned
  if (entities.requestedUnknown && !activeSubject && registeredSubjects.length > 0) {
    const subListStr = registeredSubjects.map(s => s.name).join(', ');
    return {
      message: `I couldn't find "${entities.requestedUnknown}" in your registered subjects. Your current subjects are: ${subListStr}.`,
      intent: 'UNKNOWN_SUBJECT',
      entities: {},
      actions: [{ label: 'Open Attendance', route: '/app/academics' }],
      contextToSave: { ...contextHistory },
    };
  }

  const actions: Array<{ label: string; route: string }> = [];
  const actionKeys = new Set<string>();

  const addAction = (key: string) => {
    if (ROUTE_MAP[key] && !actionKeys.has(key)) {
      actionKeys.add(key);
      actions.push(ROUTE_MAP[key]);
    }
  };

  // Intent Flags
  let isNavQuery = false;
  let isAttendanceQuery = false;
  let isBunkQuery = false;
  let isCgpaQuery = false;
  let isSgpaQuery = false;
  let isMarksQuery = false;
  let isBacklogQuery = false;
  let isExamQuery = false;
  let isTimetableQuery = false;
  let isAnalyticsQuery = false;
  let isSummaryQuery = false;
  let isOffTopic = false;

  // ── Navigation Detection ──
  if (/\b(pyq|pyqs|previous year|past papers)\b/.test(lower)) {
    addAction('PYQ');
    isNavQuery = true;
  }
  if (/\b(syllabus)\b/.test(lower)) {
    addAction('SYLLABUS');
    isNavQuery = true;
  }
  if (/\b(important topics|key topics)\b/.test(lower)) {
    addAction('IMPORTANT_TOPICS');
    isNavQuery = true;
  }
  if (/\b(study reference|reference books|notes)\b/.test(lower)) {
    addAction('STUDY_REFERENCE');
    isNavQuery = true;
  }
  if (/\b(my space|personal notes)\b/.test(lower)) {
    addAction('MY_SPACE');
    isNavQuery = true;
  }
  if (/\b(study material)\b/.test(lower) && !/\b(what|how|where|find)\b/.test(lower)) {
    addAction('STUDY_MATERIAL');
    isNavQuery = true;
  }
  if (/\b(profile|account|student details)\b/.test(lower) && /\b(where|show|open|find|go)\b/.test(lower)) {
    addAction('PROFILE');
    isNavQuery = true;
  }

  // ── Data Queries Detection ──
  if (/\b(bunk|bunks|safe bunks|miss|skip|absent)\b/.test(lower)) isBunkQuery = true;
  if (/\b(attendance|attended|conducted|classes)\b/.test(lower)) isAttendanceQuery = true;
  if (/\b(cgpa)\b/.test(lower)) isCgpaQuery = true;
  if (/\b(sgpa)\b/.test(lower)) isSgpaQuery = true;
  if (/\b(marks|score|scored|internal|external|grade|grades)\b/.test(lower)) isMarksQuery = true;
  if (/\b(backlog|backlogs|re-appear|failed)\b/.test(lower)) isBacklogQuery = true;
  if (/\b(exam|exams|mid sem|end sem|test|assessment)\b/.test(lower)) isExamQuery = true;
  if (/\b(timetable|schedule|class|classes|lecture|lectures|period|periods|timing)\b/.test(lower)) isTimetableQuery = true;
  if (/\b(placement|readiness|analytics|trend)\b/.test(lower)) isAnalyticsQuery = true;
  if (/\b(summary|overview|academic status|report|how am i doing)\b/.test(lower)) isSummaryQuery = true;

  // Off-topic refusal check
  if (
    !isNavQuery && !isAttendanceQuery && !isBunkQuery && !isCgpaQuery &&
    !isSgpaQuery && !isMarksQuery && !isBacklogQuery && !isExamQuery &&
    !isTimetableQuery && !isAnalyticsQuery && !isSummaryQuery
  ) {
    if (/\b(poem|joke|story|code|recipe|weather|who are you|hello|hi|hey|thanks|thank you)\b/.test(lower)) {
      if (/\b(hello|hi|hey)\b/.test(lower)) {
        return {
          message: "Hello! I'm Campus AI, your personal academic assistant. How can I help you with your attendance, SGPA, CGPA, exams, timetable, or study material today?",
          intent: 'GREETING',
          entities: {},
          actions: [{ label: 'Open Attendance', route: '/app/academics' }, { label: 'Open Timetable', route: '/app/timetable' }],
          contextToSave: { ...contextHistory },
        };
      }
      return {
        message: "I'm Campus AI, your Campus Hub academic assistant. I can help answer questions about your attendance, CGPA, SGPA, backlogs, exams, timetable, analytics, study material, and Campus Hub features.",
        intent: 'OFF_TOPIC',
        entities: {},
        actions: [{ label: 'Open Dashboard', route: '/app' }],
        contextToSave: { ...contextHistory },
      };
    }
  }

  const responseSections: string[] = [];
  let primaryIntent = 'GET_ACADEMIC_DATA';

  // ── 1. Attendance / Safe Bunks Response Logic ──
  if (isAttendanceQuery || isBunkQuery) {
    addAction('ATTENDANCE');

    if (activeSubject) {
      primaryIntent = isBunkQuery ? 'GET_SAFE_BUNKS' : 'GET_SUBJECT_ATTENDANCE';
      const subAtt = await getSubjectAttendance(userId, activeSubject);

      if (subAtt.found && subAtt.matchedSubject) {
        const s = subAtt.matchedSubject;

        if (isBunkQuery && entities.missCount !== undefined) {
          const newAttended = s.attended;
          const newConducted = s.total + entities.missCount;
          const newPct = newConducted > 0 ? parseFloat(((newAttended / newConducted) * 100).toFixed(1)) : 0;

          let msg = `Your current **${s.subject}** attendance is **${s.percentage}%** (${s.attended}/${s.total}). `;
          if (newPct >= 75) {
            msg += `If you miss ${entities.missCount} class${entities.missCount > 1 ? 'es' : ''}, your attendance will be **${newPct}%** (still safe above 75%).`;
          } else {
            msg += `⚠️ If you miss ${entities.missCount} class${entities.missCount > 1 ? 'es' : ''}, your attendance will drop to **${newPct}%** (below 75% threshold!).`;
          }
          responseSections.push(msg);
        } else {
          let msg = `**${s.subject} Attendance: ${s.percentage}%**\n` +
            `• Attended: ${s.attended}\n` +
            `• Absent: ${s.absent}\n` +
            `• Conducted: ${s.total}\n`;

          if (s.safeBunks > 0) {
            msg += `• Safe Bunks Available: **${s.safeBunks}** class${s.safeBunks > 1 ? 'es' : ''} (while staying above 75%).`;
          } else if (s.classesNeeded > 0) {
            msg += `• Required: Must attend next **${s.classesNeeded}** class${s.classesNeeded > 1 ? 'es' : ''} to reach 75%.`;
          } else {
            msg += `• Status: Exactly at requirement (75%).`;
          }
          responseSections.push(msg);
        }
      } else {
        responseSections.push(`I couldn't find attendance records logged for **${activeSubject}** yet.`);
      }
    } else if (/\b(lowest|worst|weakest)\b/.test(lower)) {
      primaryIntent = 'COMPARE_SUBJECTS';
      const comp = await compareSubjects(userId);
      if (comp.found && comp.lowest) {
        responseSections.push(
          `Your lowest attendance is in **${comp.lowest.subject}** at **${comp.lowest.percentage}%** (${comp.lowest.attended}/${comp.lowest.total} classes attended).`
        );
        if (comp.lowest.classesNeeded > 0) {
          responseSections.push(`You need to attend the next ${comp.lowest.classesNeeded} classes in ${comp.lowest.subject} to reach 75%.`);
        }
      }
    } else if (/\b(highest|best)\b/.test(lower)) {
      primaryIntent = 'COMPARE_SUBJECTS';
      const comp = await compareSubjects(userId);
      if (comp.found && comp.highest) {
        responseSections.push(
          `Your highest attendance is in **${comp.highest.subject}** at **${comp.highest.percentage}%** (${comp.highest.attended}/${comp.highest.total} classes attended).`
        );
      }
    } else if (/\b(below 75|under 75|shortage)\b/.test(lower)) {
      primaryIntent = 'COMPARE_SUBJECTS';
      const comp = await compareSubjects(userId);
      if (comp.found && comp.below75 && comp.below75.length > 0) {
        const listStr = comp.below75.map((s: any) => `• **${s.subject}**: ${s.percentage}% (Need ${s.classesNeeded} classes)`).join('\n');
        responseSections.push(`You have **${comp.below75.length}** subject(s) below 75%:\n${listStr}`);
      } else {
        responseSections.push(`Great job! All of your subjects are currently **above 75%** attendance.`);
      }
    } else {
      primaryIntent = 'GET_OVERALL_ATTENDANCE';
      const overall = await getOverallAttendance(userId);
      if (!overall.found || !overall.hasData) {
        responseSections.push("You don't have any attendance records logged in Campus Hub yet.");
      } else {
        let msg = `Your overall attendance is **${overall.overallAttendance}%** (${overall.totalAttended} attended out of ${overall.totalConducted} classes).`;

        const comp = await compareSubjects(userId);
        if (comp.found && comp.safe && comp.safe.length > 0) {
          const safeDetails = comp.safe.map((s: any) => `${s.subject} (${s.safeBunks})`).join(', ');
          msg += `\nSafe bunks available: ${safeDetails}.`;
        }
        responseSections.push(msg);
      }
    }
  }

  // ── 2. CGPA & Required SGPA Response Logic ──
  if (isCgpaQuery) {
    addAction('CGPA');
    const cgpaInfo = await getCGPA(userId);
    const targetInfo = await getTargetCGPA(userId);

    primaryIntent = 'GET_CGPA';
    if (!cgpaInfo.found || cgpaInfo.cgpa === null) {
      responseSections.push("Your CGPA data has not been calculated yet. Make sure your semester marks are entered in Campus Hub.");
    } else {
      let msg = `Your current CGPA is **${cgpaInfo.cgpa}**.`;
      if (targetInfo.targetCgpa > 0) {
        addAction('TARGET_PREDICTOR');
        msg += `\n• Target CGPA: **${targetInfo.targetCgpa}**`;
        if (targetInfo.requiredSgpa !== null) {
          msg += `\n• Required SGPA for Semester ${targetInfo.currentSemester}: **${targetInfo.requiredSgpa}**`;
        }
      }
      responseSections.push(msg);
    }
  }

  // ── 3. SGPA & Semester Response Logic ──
  if (isSgpaQuery && !isCgpaQuery) {
    addAction('SGPA');

    if (entities.semester === 'best') {
      primaryIntent = 'COMPARE_SEMESTERS';
      const compSem = await compareSemesters(userId);
      if (compSem.found && compSem.bestSem) {
        responseSections.push(`Your best performance was in **Semester ${compSem.bestSem.semester}** with an SGPA of **${compSem.bestSem.sgpa}**.`);
      }
    } else if (typeof entities.semester === 'number') {
      primaryIntent = 'GET_SEMESTER_SGPA';
      const sgpaInfo = await getSGPA(userId, entities.semester);
      if (sgpaInfo.found && sgpaInfo.hasMarks && sgpaInfo.sgpa !== null) {
        responseSections.push(`Your SGPA for **Semester ${sgpaInfo.semester}** was **${sgpaInfo.sgpa}**.`);
      } else {
        responseSections.push(`No SGPA record found for Semester ${entities.semester}.`);
      }
    } else {
      primaryIntent = 'GET_SGPA';
      const sgpaInfo = await getSGPA(userId);
      if (sgpaInfo.found && sgpaInfo.hasMarks) {
        responseSections.push(`Your latest SGPA for **Semester ${sgpaInfo.semester}** is **${sgpaInfo.sgpa}**.`);
      } else {
        responseSections.push("No SGPA records found in your account.");
      }
    }
  }

  // ── 4. Marks Response Logic ──
  if (isMarksQuery) {
    addAction('MARKS_CALCULATOR');
    const semNum = typeof entities.semester === 'number' ? entities.semester : undefined;
    const marksInfo = await getMarks(userId, semNum, activeSubject);

    if (!marksInfo.found || !marksInfo.hasMarks) {
      responseSections.push(`No marks entered for ${activeSubject ? activeSubject : `Semester ${marksInfo.semester || 1}`} yet.`);
    } else {
      const list = marksInfo.results.map((r: any) =>
        `• **${r.subjectName}**: ${r.total}/100 (Internal: ${r.internal ?? 'N/A'}, External: ${r.external ?? 'N/A'}, Grade: ${r.grade || 'N/A'})`
      ).join('\n');
      responseSections.push(`Marks for Semester ${marksInfo.semester}:\n${list}`);
    }
  }

  // ── 5. Backlogs Response Logic ──
  if (isBacklogQuery) {
    addAction('BACKLOGS');
    primaryIntent = 'GET_BACKLOGS';
    const backlogs = await getBacklogs(userId);
    if (!backlogs.found) {
      responseSections.push("I couldn't find backlog data in your Campus Hub account.");
    } else if (backlogs.activeCount === 0) {
      responseSections.push("🎉 Great news! You have **0 active backlogs**.");
    } else {
      const listStr = backlogs.activeBacklogs.map((b: any) => `• **${b.subjectName}** (Sem ${b.semester}) - Status: ${b.status}`).join('\n');
      responseSections.push(`You currently have **${backlogs.activeCount}** active backlog(s):\n${listStr}`);
    }
  }

  // ── 6. Exams Response Logic ──
  if (isExamQuery) {
    addAction('EXAMS');
    primaryIntent = 'GET_EXAMS';
    const exams = await getUpcomingExams(userId);
    if (!exams.found || !exams.hasExams) {
      responseSections.push("You don't currently have any exam dates configured in Campus Hub.");
    } else if (exams.upcomingEvents && exams.upcomingEvents.length > 0) {
      const next = exams.upcomingEvents[0];
      responseSections.push(`Your next upcoming exam event is **${next.label}** scheduled for **${next.date}**.`);
    } else if (exams.upcomingPeriods && exams.upcomingPeriods.length > 0) {
      const nextP = exams.upcomingPeriods[0];
      responseSections.push(`Your next exam period is **${nextP.type.toUpperCase()}** starting on **${nextP.startDate}** to **${nextP.endDate}**.`);
    }
  }

  // ── 7. Timetable / Schedule Response Logic ──
  if (isTimetableQuery) {
    addAction('TIMETABLE');
    primaryIntent = 'GET_TIMETABLE';
    const dayToQuery = entities.day || 'today';
    const timetable = await getTimetable(userId, dayToQuery === 'today' ? undefined : dayToQuery);

    if (!timetable.found || !timetable.hasSchedule) {
      responseSections.push(`No classes scheduled for **${timetable.day || dayToQuery}**. Enjoy your day!`);
    } else {
      let filtered = timetable.schedule;
      if (activeSubject) {
        filtered = filtered.filter((s: any) => s.subject.toLowerCase().includes(activeSubject!.toLowerCase()));
      }

      if (filtered.length === 0) {
        responseSections.push(`You don't have any **${activeSubject}** class scheduled on ${timetable.day}.`);
      } else {
        const classList = filtered.map((s: any) => `• Period ${s.period}: **${s.subject}**`).join('\n');
        responseSections.push(`Schedule for **${timetable.day}**:\n${classList}`);
      }
    }
  }

  // ── 8. Placement Readiness / Analytics Response Logic ──
  if (isAnalyticsQuery) {
    addAction('ANALYTICS');
    primaryIntent = 'GET_PLACEMENT_READINESS';
    const placement = await getPlacementReadiness(userId);
    if (placement.found) {
      responseSections.push(
        `**Placement Readiness Score: ${placement.readinessScore}/100** (${placement.status})\n` +
        `• CGPA: ${placement.cgpa || 'N/A'}\n` +
        `• Overall Attendance: ${placement.overallAttendance}%\n` +
        `• Active Backlogs: ${placement.activeBacklogs}`
      );
    }
  }

  // ── 9. Academic Summary Response Logic ──
  if (isSummaryQuery) {
    addAction('ATTENDANCE');
    addAction('ANALYTICS');
    primaryIntent = 'GET_ACADEMIC_SUMMARY';
    const summary = await getAcademicSummary(userId);
    if (summary.found) {
      responseSections.push(
        `**Academic Summary for ${summary.studentName} (Sem ${summary.currentSemester})**\n` +
        `• CGPA: **${summary.cgpa ?? 'N/A'}** (Target: ${summary.targetCgpa})\n` +
        `• Overall Attendance: **${summary.overallAttendance}%**\n` +
        `• Active Backlogs: **${summary.activeBacklogsCount}**`
      );
    }
  }

  // Pure Navigation Query Fallback
  if (responseSections.length === 0 && isNavQuery) {
    primaryIntent = 'NAVIGATE';
    responseSections.push("Here is the requested link to open the page in Campus Hub.");
  }

  // Final Fallback if nothing matched
  if (responseSections.length === 0) {
    primaryIntent = 'UNKNOWN';
    responseSections.push(
      "I'm here to help with your Campus Hub academics! You can ask me about your overall attendance, subject attendance, safe bunks, CGPA, SGPA, backlogs, exams, or timetable."
    );
    addAction('ATTENDANCE');
    addAction('TIMETABLE');
    addAction('EXAMS');
  }

  const finalMessage = responseSections.join('\n\n');

  return {
    message: finalMessage,
    intent: primaryIntent,
    entities: {
      subject: activeSubject,
      semester: entities.semester,
      day: entities.day,
      missCount: entities.missCount,
      targetValue: entities.targetValue,
    },
    actions,
    contextToSave: {
      lastSubject: activeSubject || contextHistory?.lastSubject,
      lastSemester: typeof entities.semester === 'number' ? entities.semester : contextHistory?.lastSemester,
      lastTopic: primaryIntent,
    },
  };
}
