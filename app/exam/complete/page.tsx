"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface ResultEntry {
  question: {
    text: string;
    type: string;
    options: string[];
    maxMarks: number;
    order: number;
  };
  answer: string;
  marksAwarded: number | null;
  feedback: string | null;
}

interface GradeData {
  isGraded: boolean;
  totalMarks: number;
  totalPossible: number;
  submittedAt: string;
  suspendedReason: string | null;
  results: ResultEntry[];
}

export default function ExamCompletePage() {
  const router = useRouter();
  const [grades, setGrades] = useState<GradeData | null>(null);
  const [loadingGrades, setLoadingGrades] = useState(false);
  const [gradesFetched, setGradesFetched] = useState(false);

  // Read suspension reason from localStorage (set on re-login or from the exam page)
  const [localSuspendedReason, setLocalSuspendedReason] = useState<string | null>(null);

  function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("student");
    router.push("/login");
  }

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("student") || "{}");
      setLocalSuspendedReason(stored.suspendedReason ?? null);
    } catch { /* ignore */ }
  }, []);

  // Use grade data's suspendedReason if available (authoritative), otherwise fall back to localStorage
  const suspendedReason = grades?.suspendedReason ?? localSuspendedReason;

  const fetchGrades = useCallback(async () => {
    setLoadingGrades(true);
    try {
      const res = await api.get("/exam/grades");
      setGrades(res.data);
    } catch {
      // Token may be gone or grades not yet available
    } finally {
      setLoadingGrades(false);
      setGradesFetched(true);
    }
  }, []);

  const percentage =
    grades && grades.totalPossible > 0
      ? Math.round((grades.totalMarks / grades.totalPossible) * 100)
      : null;

  return (
    <div
      className={`min-h-screen ${
        suspendedReason
          ? "bg-gradient-to-br from-red-50 to-orange-100"
          : "bg-gradient-to-br from-green-50 to-emerald-100"
      }`}
    >
      {/* ── Top nav with logout ──────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur border-b shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <span className="text-lg font-bold text-indigo-700">tLogic</span>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 pt-8 pb-20">

        {/* ── Submission / suspension banner ─────────────────────────────── */}
        <Card className={`shadow-xl text-center mb-6 ${suspendedReason ? "border-red-200" : ""}`}>
          <CardContent className="pt-10 pb-8 space-y-4">
            <div className="text-6xl">{suspendedReason ? "🚫" : "✅"}</div>
            <h1 className="text-2xl font-bold text-gray-800">
              {suspendedReason ? "Exam Suspended" : "Exam Submitted!"}
            </h1>

            {/* Suspension notice */}
            {suspendedReason && (
              <div className="bg-red-50 border border-red-300 rounded-xl px-5 py-4 text-left space-y-1 mx-auto max-w-sm">
                <p className="text-red-700 font-semibold text-sm">
                  ⚠ Your exam has been suspended due to a violation
                </p>
                <p className="text-red-600 text-sm">{suspendedReason}</p>
              </div>
            )}

            {!suspendedReason && (
              <p className="text-gray-500">Your answers have been recorded successfully.</p>
            )}

            {suspendedReason && (
              <p className="text-gray-500 text-sm">
                All your answered questions were saved before termination.
                Your instructor will review your submission.
              </p>
            )}

            {grades?.submittedAt && (
              <p className="text-xs text-gray-400">
                {suspendedReason ? "Terminated" : "Submitted"} at{" "}
                {new Date(grades.submittedAt).toLocaleString()}
              </p>
            )}

            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 inline-block">
              ⚠ You cannot take this exam again.
            </p>
          </CardContent>
        </Card>

        {/* ── Grades section ─────────────────────────────────────────────── */}
        {!gradesFetched ? (
          /* Initial state — show the See Grades button */
          <Card className="shadow-sm">
            <CardContent className="py-12 text-center space-y-4">
              <div className="text-5xl">📊</div>
              <p className="text-gray-700 font-semibold text-lg">Want to see your results?</p>
              <p className="text-sm text-gray-400">
                Click below to view your grade breakdown. Grades are available once your instructor has reviewed your answers.
              </p>
              <Button
                onClick={fetchGrades}
                disabled={loadingGrades}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 h-11 text-base"
              >
                {loadingGrades ? "Loading…" : "📊 See Grades"}
              </Button>
            </CardContent>
          </Card>
        ) : !grades ? (
          /* Fetch error / not yet available */
          <Card className="shadow-sm">
            <CardContent className="py-12 text-center space-y-3">
              <div className="text-4xl">📋</div>
              <p className="text-gray-600 font-semibold">Your grades are not updated yet</p>
              <p className="text-sm text-gray-400">
                Your instructor will grade your answers and publish results. Check back later.
              </p>
              <Button variant="outline" size="sm" onClick={fetchGrades} disabled={loadingGrades}>
                {loadingGrades ? "Refreshing…" : "↻ Refresh"}
              </Button>
            </CardContent>
          </Card>
        ) : !grades.isGraded ? (
          /* Submitted but not yet graded */
          <Card className="shadow-sm">
            <CardContent className="py-12 text-center space-y-3">
              <div className="text-4xl">⏳</div>
              <p className="text-gray-600 font-semibold">Awaiting Grading</p>
              <p className="text-sm text-gray-400">
                Your instructor hasn&apos;t graded your exam yet. Check back later.
              </p>
              <Button variant="outline" size="sm" onClick={fetchGrades} disabled={loadingGrades}>
                {loadingGrades ? "Refreshing…" : "↻ Refresh"}
              </Button>
            </CardContent>
          </Card>
        ) : (
          /* Grades available */
          <>
            {/* Score summary */}
            <Card className="shadow-sm mb-5 border-indigo-100">
              <CardContent className="py-6">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Your Score</p>
                    <p className="text-4xl font-bold text-indigo-600">
                      {grades.totalMarks}
                      <span className="text-gray-300 text-2xl font-normal"> / {grades.totalPossible}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-4xl font-bold ${
                        percentage! >= 70
                          ? "text-green-600"
                          : percentage! >= 50
                          ? "text-yellow-600"
                          : "text-red-500"
                      }`}
                    >
                      {percentage}%
                    </p>
                    {/* <Badge
                      className={`mt-1 ${
                        percentage! >= 70
                          ? "bg-green-100 text-green-700 hover:bg-green-100 border-0"
                          : "bg-red-100 text-red-600 hover:bg-red-100 border-0"
                      }`}
                    >
                      {percentage! >= 70 ? "Pass" : "Fail"}
                    </Badge> */}
                  </div>
                </div>
                <div className="mt-4 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-2.5 rounded-full transition-all duration-700 ${
                      percentage! >= 70
                        ? "bg-green-500"
                        : percentage! >= 50
                        ? "bg-yellow-500"
                        : "bg-red-500"
                    }`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Per-question marks table */}
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3 px-1">
              Marks Per Question
            </h2>
            <Card className="shadow-sm overflow-hidden">
              <div className="divide-y">
                {grades.results.map((entry, i) => {
                  const awarded = entry.marksAwarded ?? 0;
                  const max = entry.question.maxMarks;
                  const full = awarded === max;
                  const zero = awarded === 0;
                  return (
                    <div key={i} className="flex items-center gap-4 px-5 py-3">
                      {/* Question number */}
                      <span className="w-8 text-sm font-bold text-gray-400 shrink-0">
                        Q{i + 1}
                      </span>

                      {/* Mini progress bar */}
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-2 rounded-full transition-all duration-500 ${
                            full ? "bg-green-500" : zero ? "bg-red-400" : "bg-yellow-400"
                          }`}
                          style={{ width: `${max > 0 ? (awarded / max) * 100 : 0}%` }}
                        />
                      </div>

                      {/* Score */}
                      <span
                        className={`text-sm font-semibold w-16 text-right shrink-0 ${
                          full ? "text-green-600" : zero ? "text-red-500" : "text-yellow-600"
                        }`}
                      >
                        {awarded} / {max}
                      </span>

                      {/* Feedback (optional) */}
                      {entry.feedback && (
                        <span className="text-xs text-gray-400 italic truncate max-w-[140px]" title={entry.feedback}>
                          💬 {entry.feedback}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
