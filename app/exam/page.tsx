"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import api from "@/lib/api";
import ExamTimer from "@/components/ExamTimer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

interface Question {
  _id: string;
  text: string;
  type: "mcq" | "true-false" | "short-text" | "essay";
  options: string[];
  order: number;
  maxMarks: number;
}

interface SavedAnswer {
  questionId: string;
  answer: string;
}

type Phase = "loading" | "warning" | "exam" | "submitting";

const MAX_TAB_WARNINGS = 4;
const DRAFT_KEY = "examDrafts";

// ─────────────────────────────────────────────────────────────────────────────
// LocalStorage draft helpers — survive browser close / laptop off
// ─────────────────────────────────────────────────────────────────────────────
function saveDraft(questionId: string, answer: string) {
  try {
    const drafts = JSON.parse(localStorage.getItem(DRAFT_KEY) || "{}");
    drafts[questionId] = answer;
    localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts));
  } catch { /* quota exceeded — ignore */ }
}

function loadDrafts(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || "{}"); }
  catch { return {}; }
}

function clearDrafts() {
  try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
}

// ─────────────────────────────────────────────────────────────────────────────
export default function ExamPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("loading");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeRemainingMs, setTimeRemainingMs] = useState(MAX_TAB_WARNINGS * 60 * 1000);
  const [savingStatus, setSavingStatus] = useState<"saved" | "saving" | "offline" | "">("");
  const [studentName, setStudentName] = useState("");
  const [startingExam, setStartingExam] = useState(false);

  // Tab-switch violation state
  const [tabWarnings, setTabWarnings] = useState(0);
  const tabWarningsRef = useRef(0);
  const [warningDialogOpen, setWarningDialogOpen] = useState(false);
  const [warningDialogCount, setWarningDialogCount] = useState(0);
  const switchGuard = useRef(false);

  // Suspension state — tracks whether we're suspending (vs normal submit)
  const [isSuspending, setIsSuspending] = useState(false);

  // Offline state
  const [isOffline, setIsOffline] = useState(false);
  const pendingFlush = useRef(false);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submitted = useRef(false);
  const answersRef = useRef<Record<string, string>>({});
  const questionsRef = useRef<Question[]>([]);

  useEffect(() => { answersRef.current = answers; }, [answers]);
  useEffect(() => { questionsRef.current = questions; }, [questions]);

  // ── Flush all pending answers to server ────────────────────────────────────
  const flushAllAnswers = useCallback(async (
    currentAnswers: Record<string, string>,
    qs: Question[]
  ) => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    await Promise.allSettled(
      qs
        .filter((q) => (currentAnswers[q._id] || "").trim() !== "")
        .map((q) =>
          api.post("/exam/answer", { questionId: q._id, answer: currentAnswers[q._id] })
        )
    );
  }, []);

  // ── Prevent copy-paste (exam phase only) ───────────────────────────────────
  useEffect(() => {
    if (phase !== "exam") return;
    const block = (e: ClipboardEvent) => {
      e.preventDefault();
      toast.warning("Copy-paste is not allowed during the exam.");
    };
    const blockSilent = (e: ClipboardEvent) => e.preventDefault();
    document.addEventListener("paste", block);
    document.addEventListener("copy", blockSilent);
    document.addEventListener("cut", blockSilent);
    return () => {
      document.removeEventListener("paste", block);
      document.removeEventListener("copy", blockSilent);
      document.removeEventListener("cut", blockSilent);
    };
  }, [phase]);

  // ── Offline / online detection ─────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    setIsOffline(!navigator.onLine);

    const goOffline = () => {
      setIsOffline(true);
      setSavingStatus("offline");
      pendingFlush.current = true;
    };

    const goOnline = async () => {
      setIsOffline(false);
      if (pendingFlush.current && phase === "exam") {
        pendingFlush.current = false;
        setSavingStatus("saving");
        // Sync any locally drafted answers that didn't make it to the server
        await flushAllAnswers(answersRef.current, questionsRef.current);
        clearDrafts();
        setSavingStatus("saved");
        setTimeout(() => setSavingStatus(""), 2000);
        // Also check if time expired while offline
        const statusRes = await api.get("/exam/status").catch(() => null);
        if (statusRes?.data?.completed) {
          router.push("/exam/complete");
        }
      }
    };

    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, [phase, flushAllAnswers, router]);

  // ── Save draft to localStorage on tab/browser close ────────────────────────
  useEffect(() => {
    if (phase !== "exam") return;
    const handleBeforeUnload = () => {
      // Clear pending debounce — localStorage already has latest drafts
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [phase]);

  // ── Tab / window switch detection ─────────────────────────────────────────
  useEffect(() => {
    if (phase !== "exam") return;

    const handleSwitch = () => {
      if (switchGuard.current) return;
      switchGuard.current = true;
      setTimeout(() => { switchGuard.current = false; }, 1200);

      tabWarningsRef.current += 1;
      const count = tabWarningsRef.current;
      setTabWarnings(count);

      if (count >= MAX_TAB_WARNINGS) return; // suspend handled in separate effect

      // Show the popup dialog for warnings 1 → MAX-1
      setWarningDialogCount(count);
      setWarningDialogOpen(true);
    };

    const onVisibilityChange = () => { if (document.hidden) handleSwitch(); };
    const onBlur = () => handleSwitch();

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onBlur);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onBlur);
    };
  }, [phase]);

  // ── Auto-suspend on MAX violations ────────────────────────────────────────
  useEffect(() => {
    if (tabWarnings < MAX_TAB_WARNINGS) return;
    if (submitted.current) return;

    const suspendExam = async () => {
      submitted.current = true;
      setWarningDialogOpen(false);
      setIsSuspending(true);
      setPhase("submitting");
      await flushAllAnswers(answersRef.current, questionsRef.current);
      clearDrafts();
      try {
        await api.post("/exam/submit", {
          reason: `Exam suspended: tab/window switching detected ${MAX_TAB_WARNINGS} times`,
        });
      } catch { /* navigate anyway */ }
      router.push("/exam/complete");
    };

    suspendExam();
  }, [tabWarnings, flushAllAnswers, router]);

  // ── Screenshot detection — instant suspension ─────────────────────────────
  useEffect(() => {
    if (phase !== "exam") return;

    const handleScreenshotKey = async (e: KeyboardEvent) => {
      const isScreenshot =
        e.key === "PrintScreen" ||
        e.key === "F13" || // Some keyboards map PrintScreen → F13
        // macOS: Cmd+Shift+3/4/5/6 (full, selection, screen record, etc.)
        (e.metaKey && e.shiftKey && ["3", "4", "5", "6"].includes(e.key)) ||
        // macOS with Ctrl: Cmd+Ctrl+Shift+3/4 (to clipboard)
        (e.metaKey && e.ctrlKey && e.shiftKey && ["3", "4"].includes(e.key)) ||
        // Windows Snipping Tool shortcut fallback
        (e.ctrlKey && e.key === "PrintScreen");

      if (!isScreenshot || submitted.current) return;

      e.preventDefault();
      e.stopPropagation();

      submitted.current = true;
      setIsSuspending(true);
      setPhase("submitting");
      await flushAllAnswers(answersRef.current, questionsRef.current);
      clearDrafts();
      try {
        await api.post("/exam/submit", {
          reason: "Exam suspended: screenshot attempt detected",
        });
      } catch { /* navigate anyway */ }
      router.push("/exam/complete");
    };

    // Listen on both keydown and keyup — PrintScreen fires on keyup in some browsers
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();

    document.addEventListener("keydown", handleScreenshotKey, true);
    document.addEventListener("keyup", handleScreenshotKey, true);
    document.addEventListener("contextmenu", handleContextMenu);

    return () => {
      document.removeEventListener("keydown", handleScreenshotKey, true);
      document.removeEventListener("keyup", handleScreenshotKey, true);
      document.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [phase, flushAllAnswers, router]);

  // ── Load questions and status on mount ────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { router.push("/login"); return; }

    const stored = localStorage.getItem("student");
    if (stored) setStudentName(JSON.parse(stored).name ?? "");

    async function load() {
      try {
        const [qRes, statusRes] = await Promise.all([
          api.get("/exam/questions"),
          api.get("/exam/status"),
        ]);

        if (statusRes.data.completed) { router.push("/exam/complete"); return; }

        const serverQuestions: Question[] = qRes.data;
        setQuestions(serverQuestions);
        questionsRef.current = serverQuestions;

        // Build answer map: merge server saves + any localStorage drafts
        const serverAnswers: Record<string, string> = {};
        (statusRes.data.answers as SavedAnswer[]).forEach((a) => {
          serverAnswers[a.questionId] = a.answer;
        });
        const drafts = loadDrafts();
        const merged = { ...serverAnswers, ...drafts }; // draft overrides server (more recent)
        setAnswers(merged);
        answersRef.current = merged;

        if (statusRes.data.examStartedAt) {
          setTimeRemainingMs(statusRes.data.timeRemainingMs);
          // If drafts exist, sync them up immediately
          if (Object.keys(drafts).length > 0) {
            await flushAllAnswers(merged, serverQuestions);
            clearDrafts();
          }
          setPhase("exam");
        } else {
          setPhase("warning");
        }
      } catch {
        toast.error("Failed to load exam. Please refresh.");
      }
    }
    load();
  }, [router, flushAllAnswers]);

  // ── Confirm start ─────────────────────────────────────────────────────────
  async function handleConfirmStart() {
    setStartingExam(true);
    try {
      const res = await api.post("/exam/start");
      const elapsed = Date.now() - new Date(res.data.examStartedAt).getTime();
      setTimeRemainingMs(Math.max(0, 70 * 60 * 1000 - elapsed));
      setPhase("exam");
    } catch {
      toast.error("Failed to start exam. Please try again.");
    } finally {
      setStartingExam(false);
    }
  }

  // ── Auto-save (API + localStorage draft) ──────────────────────────────────
  const saveAnswer = useCallback(async (questionId: string, answer: string) => {
    if (isOffline) {
      setSavingStatus("offline");
      return;
    }
    setSavingStatus("saving");
    try {
      await api.post("/exam/answer", { questionId, answer });
      setSavingStatus("saved");
      // Clear this draft from localStorage once server confirms
      const drafts = loadDrafts();
      delete drafts[questionId];
      localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts));
      setTimeout(() => setSavingStatus(""), 2000);
    } catch (err: unknown) {
      const errMsg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      // If server says time expired, redirect
      if (errMsg?.includes("Time expired")) {
        router.push("/exam/complete");
        return;
      }
      setSavingStatus("");
    }
  }, [isOffline, router]);

  function handleAnswerChange(questionId: string, value: string) {
    setAnswers((prev) => {
      const next = { ...prev, [questionId]: value };
      answersRef.current = next;
      return next;
    });
    // Immediate localStorage draft — survives browser close / laptop off
    saveDraft(questionId, value);
    setSavingStatus("saving");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => saveAnswer(questionId, value), 800);
  }

  // ── Submit (manual, timer expire, suspend) ────────────────────────────────
  async function handleSubmit(auto = false, reason?: string) {
    if (submitted.current) return;
    submitted.current = true;
    setPhase("submitting");

    await flushAllAnswers(answersRef.current, questionsRef.current);
    clearDrafts();

    try {
      await api.post("/exam/submit", reason ? { reason } : {});
      if (auto && !reason) toast.info("⏱ Time is up! Your exam has been automatically submitted.");
      else if (!reason) toast.success("Exam submitted successfully!");
      setTimeout(() => router.push("/exam/complete"), 1200);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        "Submission failed";
      // If already submitted server-side (e.g. time expired), just redirect
      if (msg.includes("already submitted") || msg.includes("Time expired")) {
        router.push("/exam/complete");
        return;
      }
      toast.error(msg);
      submitted.current = false;
      setPhase("exam");
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  RENDER
  // ══════════════════════════════════════════════════════════════════════════

  if (phase === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400 animate-pulse">Loading exam…</p>
      </div>
    );
  }

  // ── Warning / instructions screen ─────────────────────────────────────────
  if (phase === "warning") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-lg">
          <div className="text-center mb-6">
            <span className="text-5xl">⚠️</span>
            <h1 className="text-3xl font-bold text-gray-800 mt-3">Before You Begin</h1>
            <p className="text-gray-500 mt-1">
              Welcome, <span className="font-semibold text-indigo-600">{studentName}</span>. Please read carefully.
            </p>
          </div>
          <Card className="shadow-lg border-amber-200">
            <CardContent className="pt-6 space-y-4">
              <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Exam Rules &amp; Instructions</h2>
              <ul className="space-y-3">
                {[
                  { icon: "⏱", text: "You have exactly 70 minutes. The exam auto-submits when time runs out — all answered questions are automatically saved." },
                  { icon: "🔒", text: "Once you click \"Start Exam\", the timer begins and cannot be paused or reset, even if you lose internet or close the browser." },
                  { icon: "📝", text: "You must answer each question before moving to the next one. No skipping allowed." },
                  { icon: "🚫", text: "Copy and paste is completely disabled throughout the entire exam." },
                  { icon: "💾", text: "Your answers are saved automatically after every change. They are also stored locally in case of disconnection." },
                  { icon: "🖥️", text: `Switching tabs or windows will trigger a warning popup. You have ${MAX_TAB_WARNINGS} chances — on the ${MAX_TAB_WARNINGS}th switch your exam is immediately terminated and marked as suspended.` },
                  { icon: "📸", text: "Taking screenshots (PrintScreen, Mac Cmd+Shift+3/4/5, or any screen capture shortcut) will immediately terminate and suspend your exam." },
                  { icon: "📶", text: "If your internet disconnects, answers will be saved locally and synced automatically when you reconnect. The timer keeps running on the server." },
                  { icon: "🚪", text: "This is a one-time exam attempt. After completion you can log in again to view your grades." },
                ].map((rule, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-gray-700">
                    <span className="text-xl shrink-0 mt-0.5">{rule.icon}</span>
                    <span>{rule.text}</span>
                  </li>
                ))}
              </ul>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
                <strong>Important:</strong> Ensure a stable internet connection and uninterrupted environment for 70 minutes before starting.
              </div>
              <div className="border-t pt-4">
                <p className="text-xs text-gray-400 mb-4 text-center">
                  By clicking &quot;Start Exam&quot; you agree to all rules above.
                </p>
                <Button
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-base h-12"
                  onClick={handleConfirmStart}
                  disabled={startingExam || questions.length === 0}
                >
                  {startingExam ? "Starting…" : questions.length === 0 ? "No Questions Available" : "✅  I Understand — Start Exam"}
                </Button>
                {questions.length === 0 && (
                  <p className="text-center text-xs text-red-500 mt-2">No questions added yet. Contact your administrator.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ── Submitting / suspending screen ────────────────────────────────────────
  if (phase === "submitting") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gray-50">
        <div className="text-5xl animate-pulse">{isSuspending ? "🚫" : "📤"}</div>
        <p className="text-lg font-semibold text-gray-700">
          {isSuspending ? "Terminating exam…" : "Submitting your exam…"}
        </p>
        {isSuspending && (
          <p className="text-sm text-red-500 max-w-sm text-center">
            Your exam has been suspended due to a violation. All answered questions have been saved.
          </p>
        )}
        <p className="text-xs text-gray-400">Please do not close this tab.</p>
      </div>
    );
  }

  // ── Exam screen ───────────────────────────────────────────────────────────
  const currentQuestion = questions[currentIndex];
  const currentAnswer = answers[currentQuestion._id] || "";
  const hasAnswer = currentAnswer.trim() !== "";
  const isLast = currentIndex === questions.length - 1;
  const allAnswered = questions.every((q) => (answers[q._id] || "").trim() !== "");

  function renderAnswerInput() {
    switch (currentQuestion.type) {
      case "mcq":
        return (
          <div className="space-y-3">
            {currentQuestion.options.map((opt, i) => (
              <label
                key={i}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  currentAnswer === opt ? "border-indigo-500 bg-indigo-50" : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                <input
                  type="radio"
                  name={`q-${currentQuestion._id}`}
                  value={opt}
                  checked={currentAnswer === opt}
                  onChange={() => handleAnswerChange(currentQuestion._id, opt)}
                  className="accent-indigo-600"
                />
                <span className="text-gray-700">{opt}</span>
              </label>
            ))}
          </div>
        );
      case "true-false":
        return (
          <div className="flex gap-4">
            {["True", "False"].map((opt) => (
              <label
                key={opt}
                className={`flex-1 flex items-center justify-center gap-2 p-4 rounded-lg border cursor-pointer font-medium transition-colors ${
                  currentAnswer === opt ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-gray-200 hover:border-gray-300 text-gray-600"
                }`}
              >
                <input
                  type="radio"
                  name={`q-${currentQuestion._id}`}
                  value={opt}
                  checked={currentAnswer === opt}
                  onChange={() => handleAnswerChange(currentQuestion._id, opt)}
                  className="accent-indigo-600"
                />
                {opt}
              </label>
            ))}
          </div>
        );
      case "short-text":
        return (
          <Textarea
            placeholder="Type your answer here…"
            value={currentAnswer}
            onPaste={(e) => e.preventDefault()}
            onCopy={(e) => e.preventDefault()}
            onCut={(e) => e.preventDefault()}
            onChange={(e) => handleAnswerChange(currentQuestion._id, e.target.value)}
            className="resize-none h-24"
          />
        );
      case "essay":
        return (
          <Textarea
            placeholder="Write your essay answer here…"
            value={currentAnswer}
            onPaste={(e) => e.preventDefault()}
            onCopy={(e) => e.preventDefault()}
            onCut={(e) => e.preventDefault()}
            onChange={(e) => handleAnswerChange(currentQuestion._id, e.target.value)}
            className="resize-none h-48"
          />
        );
    }
  }

  return (
    <>
      {/* ── Tab-switch Warning Popup ─────────────────────────────────────── */}
      {warningDialogOpen && (
        <div className="fixed inset-0 z-[200] bg-black/75 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center space-y-5">
            <div className="text-6xl">⚠️</div>
            <div>
              <h2 className="text-2xl font-bold text-red-700">Tab Switch Detected!</h2>
              <p className="text-sm text-gray-400 mt-1">Violation {warningDialogCount} of {MAX_TAB_WARNINGS}</p>
            </div>

            {/* Violation dots */}
            <div className="flex justify-center gap-2">
              {Array.from({ length: MAX_TAB_WARNINGS }).map((_, i) => (
                <div
                  key={i}
                  className={`w-4 h-4 rounded-full border-2 transition-colors ${
                    i < warningDialogCount
                      ? "bg-red-500 border-red-500"
                      : "bg-gray-100 border-gray-300"
                  }`}
                />
              ))}
            </div>

            <p className="text-gray-600 text-sm leading-relaxed">
              Switching tabs or windows is strictly not allowed during the exam.
              {warningDialogCount < MAX_TAB_WARNINGS - 1 ? (
                <span className="block mt-1 font-medium text-orange-600">
                  You have {MAX_TAB_WARNINGS - warningDialogCount} warning{MAX_TAB_WARNINGS - warningDialogCount !== 1 ? "s" : ""} remaining.
                </span>
              ) : (
                <span className="block mt-1 font-bold text-red-600">
                  🚨 This is your FINAL warning. The next switch will immediately terminate your exam.
                </span>
              )}
            </p>

            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-xs text-amber-700">
              ⏱ Your exam timer is still running!
            </div>

            <Button
              className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white"
              onClick={() => setWarningDialogOpen(false)}
            >
              I understand — Return to Exam
            </Button>
          </div>
        </div>
      )}

      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* ── Top bar ──────────────────────────────────────────────────────── */}
        <header className="sticky top-0 z-50 bg-white border-b shadow-sm">
          <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xl font-bold text-indigo-700">tLogic</span>
              <Badge variant="outline" className="text-xs">Q {currentIndex + 1} / {questions.length}</Badge>
            </div>
            <div className="flex items-center gap-3">
              {/* Violation indicator */}
              {tabWarnings > 0 && (
                <div
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border cursor-pointer ${
                    tabWarnings === 1
                      ? "bg-yellow-50 text-yellow-700 border-yellow-300"
                      : tabWarnings === 2
                      ? "bg-orange-50 text-orange-700 border-orange-400 animate-pulse"
                      : tabWarnings >= 3
                      ? "bg-red-50 text-red-700 border-red-400 animate-pulse"
                      : ""
                  }`}
                  onClick={() => { setWarningDialogCount(tabWarnings); setWarningDialogOpen(true); }}
                  title="Click to review warning"
                >
                  <span>⚠</span>
                  <span>{tabWarnings}/{MAX_TAB_WARNINGS} violations</span>
                </div>
              )}

              {/* Save status */}
              {savingStatus === "saving" && <span className="text-xs text-gray-400 animate-pulse">Saving…</span>}
              {savingStatus === "saved" && <span className="text-xs text-green-600">✓ Saved</span>}
              {savingStatus === "offline" && <span className="text-xs text-orange-500">📵 Offline — draft saved</span>}

              <ExamTimer timeRemainingMs={timeRemainingMs} onExpire={() => handleSubmit(true)} />
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-1 bg-gray-100">
            <div
              className="h-1 bg-indigo-500 transition-all duration-300"
              style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
            />
          </div>
        </header>

        {/* ── Offline banner ───────────────────────────────────────────────── */}
        {isOffline && (
          <div className="bg-orange-500 text-white text-sm text-center py-2 px-4 font-medium">
            📵 No internet connection — answers are saved locally and will sync when you reconnect. Your timer is still running.
          </div>
        )}

        {/* ── Final-warning banner (3rd violation) ─────────────────────────── */}
        {tabWarnings === MAX_TAB_WARNINGS - 1 && !isOffline && (
          <div className="bg-red-600 text-white text-sm text-center py-2 px-4 font-semibold">
            🚨 Final warning! The next tab or window switch will immediately terminate your exam.
          </div>
        )}

        {/* ── Main content ─────────────────────────────────────────────────── */}
        <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">
          <Card className="shadow-md">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between mb-2">
                <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100 border-0">
                  {currentQuestion.type === "mcq" ? "Multiple Choice"
                    : currentQuestion.type === "true-false" ? "True / False"
                    : currentQuestion.type === "short-text" ? "Short Answer"
                    : "Essay"}
                </Badge>
                <span className="text-sm text-gray-400">
                  {currentQuestion.maxMarks} mark{currentQuestion.maxMarks !== 1 ? "s" : ""}
                </span>
              </div>
              <CardTitle className="text-lg leading-relaxed text-gray-800">
                <span className="text-indigo-600 font-bold mr-2">Q{currentIndex + 1}.</span>
                {currentQuestion.text}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {renderAnswerInput()}
              <div className="flex items-center justify-between pt-4 border-t">
                <Button variant="outline" disabled={currentIndex === 0} onClick={() => setCurrentIndex((i) => i - 1)}>
                  ← Previous
                </Button>
                {isLast ? (
                  <Button onClick={() => handleSubmit(false)} disabled={!allAnswered} className="bg-green-600 hover:bg-green-700 text-white">
                    Submit Exam
                  </Button>
                ) : (
                  <Button disabled={!hasAnswer} onClick={() => setCurrentIndex((i) => i + 1)}>
                    Next →
                  </Button>
                )}
              </div>
              {!hasAnswer && (
                <p className="text-xs text-amber-600 text-center">⚠ You must answer this question before moving to the next one.</p>
              )}
            </CardContent>
          </Card>

          {/* Question navigator */}
          <div className="mt-6">
            <p className="text-xs text-gray-500 mb-2 font-medium">Question Navigator</p>
            <div className="flex flex-wrap gap-2">
              {questions.map((q, i) => (
                <button
                  key={q._id}
                  onClick={() => {
                    const allPrevAnswered = questions.slice(0, i).every((pq) => (answers[pq._id] || "").trim() !== "");
                    if (allPrevAnswered || i <= currentIndex) setCurrentIndex(i);
                    else toast.warning("Answer previous questions first.");
                  }}
                  className={`w-9 h-9 rounded-full text-sm font-medium border transition-colors ${
                    i === currentIndex
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : (answers[q._id] || "").trim()
                      ? "bg-green-100 text-green-700 border-green-300"
                      : "bg-white text-gray-500 border-gray-300"
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
