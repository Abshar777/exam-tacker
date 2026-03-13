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

export default function ExamPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("loading");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeRemainingMs, setTimeRemainingMs] = useState(70 * 60 * 1000);
  const [savingStatus, setSavingStatus] = useState<"saved" | "saving" | "">("");
  const [studentName, setStudentName] = useState("");
  const [startingExam, setStartingExam] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submitted = useRef(false);

  // Prevent copy-paste globally (only active during exam phase)
  useEffect(() => {
    if (phase !== "exam") return;
    const blockPaste = (e: ClipboardEvent) => {
      e.preventDefault();
      toast.warning("Copy-paste is not allowed during the exam.");
    };
    const blockCopy = (e: ClipboardEvent) => e.preventDefault();
    document.addEventListener("paste", blockPaste);
    document.addEventListener("copy", blockCopy);
    document.addEventListener("cut", blockCopy);
    return () => {
      document.removeEventListener("paste", blockPaste);
      document.removeEventListener("copy", blockCopy);
      document.removeEventListener("cut", blockCopy);
    };
  }, [phase]);

  // Load questions and status on mount
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

        if (statusRes.data.completed) {
          router.push("/exam/complete");
          return;
        }

        setQuestions(qRes.data);

        const savedAnswers: Record<string, string> = {};
        (statusRes.data.answers as SavedAnswer[]).forEach((a) => {
          savedAnswers[a.questionId] = a.answer;
        });
        setAnswers(savedAnswers);

        // If exam already started (resumed session), skip warning
        if (statusRes.data.examStartedAt) {
          setTimeRemainingMs(statusRes.data.timeRemainingMs);
          setPhase("exam");
        } else {
          setPhase("warning");
        }
      } catch {
        toast.error("Failed to load exam. Please refresh.");
      }
    }
    load();
  }, [router]);

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

  const saveAnswer = useCallback(async (questionId: string, answer: string) => {
    setSavingStatus("saving");
    try {
      await api.post("/exam/answer", { questionId, answer });
      setSavingStatus("saved");
      setTimeout(() => setSavingStatus(""), 2000);
    } catch {
      setSavingStatus("");
    }
  }, []);

  function handleAnswerChange(questionId: string, value: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    setSavingStatus("saving");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => saveAnswer(questionId, value), 800);
  }

  async function handleSubmit(auto = false) {
    if (submitted.current) return;
    submitted.current = true;
    setPhase("submitting");

    const q = questions[currentIndex];
    if (q && answers[q._id]) await saveAnswer(q._id, answers[q._id]);

    try {
      await api.post("/exam/submit");
      if (auto) toast.info("Time is up! Your exam has been automatically submitted.");
      else toast.success("Exam submitted successfully!");
      setTimeout(() => router.push("/exam/complete"), 1200);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        "Submission failed";
      toast.error(msg);
      submitted.current = false;
      setPhase("exam");
    }
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (phase === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400 animate-pulse">Loading exam…</p>
      </div>
    );
  }

  // ── Warning / instructions screen ────────────────────────────────────────────
  if (phase === "warning") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-lg">
          <div className="text-center mb-6">
            <span className="text-5xl">⚠️</span>
            <h1 className="text-3xl font-bold text-gray-800 mt-3">Before You Begin</h1>
            <p className="text-gray-500 mt-1">
              Welcome,{" "}
              <span className="font-semibold text-indigo-600">{studentName}</span>.
              Please read the following rules carefully.
            </p>
          </div>

          <Card className="shadow-lg border-amber-200">
            <CardContent className="pt-6 space-y-4">
              <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">
                Exam Rules &amp; Instructions
              </h2>
              <ul className="space-y-3">
                {[
                  { icon: "⏱", text: "You have exactly 70 minutes. The exam auto-submits when time runs out." },
                  { icon: "🔒", text: 'Once you click "Start Exam", the timer begins and cannot be paused or reset.' },
                  { icon: "📝", text: "You must answer each question before moving to the next one. No skipping allowed." },
                  { icon: "🚫", text: "Copy and paste is completely disabled throughout the entire exam." },
                  { icon: "💾", text: "Your answers are saved automatically after every change — no need to click save." },
                  { icon: "🚪", text: "This is a one-time attempt. After submission you cannot log in again." },
                ].map((rule, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-gray-700">
                    <span className="text-xl shrink-0 mt-0.5">{rule.icon}</span>
                    <span>{rule.text}</span>
                  </li>
                ))}
              </ul>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
                <strong>Important:</strong> Make sure you have a stable internet connection and will
                not be interrupted for the next 70 minutes before starting.
              </div>

              <div className="border-t pt-4">
                <p className="text-xs text-gray-400 mb-4 text-center">
                  By clicking &quot;Start Exam&quot; you confirm you have read and understood all rules above.
                </p>
                <Button
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-base h-12"
                  onClick={handleConfirmStart}
                  disabled={startingExam || questions.length === 0}
                >
                  {startingExam
                    ? "Starting…"
                    : questions.length === 0
                    ? "No Questions Available"
                    : "✅  I Understand — Start Exam"}
                </Button>
                {questions.length === 0 && (
                  <p className="text-center text-xs text-red-500 mt-2">
                    No questions have been added yet. Please contact your administrator.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ── Submitting screen ────────────────────────────────────────────────────────
  if (phase === "submitting") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <div className="text-4xl animate-pulse">📤</div>
        <p className="text-lg font-medium text-gray-700">Submitting your exam…</p>
        <p className="text-sm text-gray-400">Please do not close this tab.</p>
      </div>
    );
  }

  // ── Exam screen ──────────────────────────────────────────────────────────────
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
                  currentAnswer === opt
                    ? "border-indigo-500 bg-indigo-50"
                    : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
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
                  currentAnswer === opt
                    ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                    : "border-gray-200 hover:border-gray-300 text-gray-600"
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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-50 bg-white border-b shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold text-indigo-700">tLogic</span>
            <Badge variant="outline" className="text-xs">
              Q {currentIndex + 1} / {questions.length}
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            {savingStatus === "saving" && (
              <span className="text-xs text-gray-400 animate-pulse">Saving…</span>
            )}
            {savingStatus === "saved" && (
              <span className="text-xs text-green-600">✓ Saved</span>
            )}
            <ExamTimer timeRemainingMs={timeRemainingMs} onExpire={() => handleSubmit(true)} />
          </div>
        </div>
        <div className="h-1 bg-gray-100">
          <div
            className="h-1 bg-indigo-500 transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
          />
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">
        <Card className="shadow-md">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between mb-2">
              <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100 border-0">
                {currentQuestion.type === "mcq"
                  ? "Multiple Choice"
                  : currentQuestion.type === "true-false"
                  ? "True / False"
                  : currentQuestion.type === "short-text"
                  ? "Short Answer"
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
              <Button
                variant="outline"
                disabled={currentIndex === 0}
                onClick={() => setCurrentIndex((i) => i - 1)}
              >
                ← Previous
              </Button>
              {isLast ? (
                <Button
                  onClick={() => handleSubmit(false)}
                  disabled={!allAnswered}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  Submit Exam
                </Button>
              ) : (
                <Button
                  disabled={!hasAnswer}
                  onClick={() => setCurrentIndex((i) => i + 1)}
                  title={!hasAnswer ? "Please answer this question before proceeding" : ""}
                >
                  Next →
                </Button>
              )}
            </div>

            {!hasAnswer && (
              <p className="text-xs text-amber-600 text-center">
                ⚠ You must answer this question before moving to the next one.
              </p>
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
                  const allPrevAnswered = questions
                    .slice(0, i)
                    .every((pq) => (answers[pq._id] || "").trim() !== "");
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
  );
}
