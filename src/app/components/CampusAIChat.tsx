import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router";
import { Bot, X, Send, Sparkles, ExternalLink, RefreshCw, MessageSquare } from "lucide-react";
import { api } from "../../lib/api";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  intent?: string;
  actions?: Array<{ label: string; route: string }>;
  timestamp: string;
}

const SUGGESTED_QUESTIONS = [
  { label: "📊 Where is my attendance?", text: "Where can I check my attendance?" },
  { label: "🎯 What is my current CGPA?", text: "What is my current CGPA?" },
  { label: "⚡ How many classes can I bunk?", text: "How many classes can I bunk?" },
  { label: "📚 Where are the PYQs?", text: "Where are my PYQs?" },
  { label: "📅 What's on my timetable today?", text: "What classes do I have today?" },
  { label: "📝 When are my upcoming exams?", text: "When is my next exam?" },
];

export function CampusAIChat() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome-1",
      role: "assistant",
      content: "Hi! 👋 I'm **Campus AI**, your official intelligent assistant for Campus Hub. How can I help you today?",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const aiContextRef = useRef<any>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen, isLoading]);

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || isLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput("");
    setIsLoading(true);

    // Format history for backend context
    const historyPayload = messages
      .filter((m) => m.id !== "welcome-1")
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const res = await api.askCampusAI(query, historyPayload, aiContextRef.current);

      if (res.context) {
        aiContextRef.current = res.context;
      }

      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: res.message || "I couldn't process that request right now.",
        intent: res.intent,
        actions: res.actions || [],
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Sorry, I'm having trouble connecting right now. Please try again.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleActionClick = (route: string) => {
    navigate(route);
    // On mobile screens, auto-close or minimize chat when navigating
    if (window.innerWidth < 640) {
      setIsOpen(false);
    }
  };

  const handleClearHistory = () => {
    aiContextRef.current = null;
    setMessages([
      {
        id: "welcome-1",
        role: "assistant",
        content: "Session reset! 👋 How can I help you navigate or check data in Campus Hub?",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
  };

  return (
    <>
      {/* ── Floating Trigger Button ────────────────────────────────────────────── */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-full bg-slate-950/90 border border-amber-500/40 text-amber-300 hover:text-amber-200 hover:border-amber-400/70 shadow-[0_0_20px_rgba(245,158,11,0.25)] backdrop-blur-md transition-all duration-300 hover:scale-105 active:scale-95 group cursor-pointer"
          aria-label="Open Campus AI"
        >
          <div className="relative">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center text-slate-950 font-bold shadow-md">
              <Bot className="w-4 h-4" />
            </div>
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-slate-950 animate-pulse" />
          </div>
          <span className="font-semibold text-sm tracking-wide text-slate-100 group-hover:text-amber-300 transition-colors">
            Campus AI
          </span>
          <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
        </button>
      )}

      {/* ── Chat Window Panel ─────────────────────────────────────────────────── */}
      {isOpen && (
        <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 w-[calc(100vw-2rem)] sm:w-[420px] h-[600px] max-h-[85vh] rounded-2xl border border-amber-500/30 bg-slate-950/95 shadow-[0_10px_40px_rgba(0,0,0,0.8)] backdrop-blur-xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-200">
          
          {/* ── Header ────────────────────────────────────────────────────────── */}
          <div className="p-3.5 px-4 bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/40 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center text-slate-950 shadow-md">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="font-bold text-slate-100 text-sm tracking-wide">Campus AI</h3>
                  <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-amber-500/20 border border-amber-500/40 text-amber-300 rounded-md">
                    v1.0
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-medium">Your Campus Assistant</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={handleClearHistory}
                title="Reset session"
                className="p-1.5 text-slate-400 hover:text-amber-300 hover:bg-slate-800/60 rounded-lg transition-colors cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                title="Close chat"
                className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>
          </div>

          {/* ── Messages Scroll Area ───────────────────────────────────────────── */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3.5 custom-scrollbar bg-slate-950/60">
            
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
              >
                <div
                  className={`px-4 py-2.5 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-amber-500/20 border border-amber-500/40 text-amber-100 rounded-2xl rounded-tr-none max-w-[85%] shadow-sm"
                      : "bg-slate-900/90 border border-slate-800/90 text-slate-200 rounded-2xl rounded-tl-none max-w-[92%] shadow-sm"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>

                  {/* Render Intent Action Buttons */}
                  {msg.actions && msg.actions.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex flex-wrap gap-2">
                      {msg.actions.map((act, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleActionClick(act.route)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 hover:from-amber-400 hover:to-amber-500 transition-all shadow-md active:scale-95 cursor-pointer"
                        >
                          <span>{act.label}</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <span className="text-[10px] text-slate-500 mt-1 px-1">{msg.timestamp}</span>
              </div>
            ))}

            {/* ── Suggested Question Pills ───────────────────────────────────── */}
            {messages.length === 1 && !isLoading && (
              <div className="pt-2">
                <p className="text-xs font-medium text-slate-400 mb-2.5 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                  Suggested questions
                </p>
                <div className="grid grid-cols-1 gap-1.5">
                  {SUGGESTED_QUESTIONS.map((q, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSend(q.text)}
                      className="text-left text-xs px-3 py-2 rounded-xl bg-slate-900/80 hover:bg-amber-500/10 border border-slate-800 hover:border-amber-500/40 text-slate-300 hover:text-amber-200 transition-all duration-200 flex items-center justify-between group cursor-pointer"
                    >
                      <span>{q.label}</span>
                      <span className="text-amber-400/60 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all">→</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Loading / Typing Indicator ─────────────────────────────────── */}
            {isLoading && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-2xl rounded-tl-none bg-slate-900/90 border border-slate-800 text-amber-400 text-xs w-fit">
                <Bot className="w-4 h-4 animate-spin text-amber-400" />
                <span>Campus AI is thinking...</span>
                <div className="flex gap-1 ml-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* ── Input Bar ─────────────────────────────────────────────────────── */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="p-3 border-t border-slate-800/80 bg-slate-900/80 backdrop-blur-md flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Campus AI..."
              className="flex-1 bg-slate-950/80 border border-slate-800 focus:border-amber-500/60 text-slate-100 text-sm rounded-xl px-3.5 py-2.5 outline-none placeholder:text-slate-500 transition-colors"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="bg-gradient-to-tr from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 disabled:opacity-40 text-slate-950 p-2.5 rounded-xl transition-all shadow-md active:scale-95 cursor-pointer font-bold flex items-center justify-center"
              aria-label="Send message"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>

        </div>
      )}
    </>
  );
}
