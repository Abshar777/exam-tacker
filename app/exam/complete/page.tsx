"use client";
import { useEffect, useState, useCallback } from "react";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  results: ResultEntry[];
}

export default function ExamCompletePage() {
  const [grades, setGrades] = useState<GradeData | null>(null);
  const [loadingGrades, setLoadingGrades] = useState(true);

  const fetchGrades = useCallback(async () => {
    setLoadingGrades(true);
    try {
      const res = await api.get("/exam/grades");
      setGrades(res.data);
    } catch {
      // Token may be gone or not graded — show pending state
    } finally {
      setLoadingGrades(false);
    }
  }, []);

  useEffect(() => {
    fetchGrades();
  }, [fetchGrades]);

  const percentage =
    grades && grades.totalPossible > 0
      ? Math.round((grades.totalMarks / grades.totalPossible) * 100)
      : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 p-4">
      <div className="max-w-2xl mx-auto pt-10 pb-20">

        {/* Submission confirmation banner */}
        <Card className="shadow-xl text-center mb-6">
          <CardContent className="pt-10 pb-8 space-y-3">
            <div className="text-6xl">✅</div>
            <h1 className="text-2xl font-bold text-gray-800">Exam Submitted!</h1>
            <p className="text-gray-500">Your answers have been recorded successfully.</p>
            {grades?.submittedAt && (
              <p className="text-xs text-gray-400">
                Submitted at {new Date(grades.submittedAt).toLocaleString()}
              </p>
            )}
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 inline-block">
              ⚠ You cannot log in again. This exam is complete.
            </p>
          </CardContent>
        </Card>

        {/* Grade section */}
        {loadingGrades ? (
          <Card className="shadow-sm">
            <CardContent className="py-12 text-center text-gray-400 animate-pulse">
              Loading results…
            </CardContent>
          </Card>
        ) : !grades ? (
          <Card className="shadow-sm">
            <CardContent className="py-12 text-center space-y-3">
              <div className="text-4xl">📋</div>
              <p className="text-gray-600 font-medium">Results not available yet</p>
              <p className="text-sm text-gray-400">
                Your instructor will grade your answers and publish results.
              </p>
              <Button variant="outline" size="sm" onClick={fetchGrades}>
                ↻ Refresh
              </Button>
            </CardContent>
          </Card>
        ) : !grades.isGraded ? (
          <Card className="shadow-sm">
            <CardContent className="py-12 text-center space-y-3">
              <div className="text-4xl">⏳</div>
              <p className="text-gray-600 font-medium">Awaiting Grading</p>
              <p className="text-sm text-gray-400">
                Your instructor hasn&apos;t graded your exam yet. Check back later.
              </p>
              <Button variant="outline" size="sm" onClick={fetchGrades}>
                ↻ Refresh
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Score summary card */}
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
                    <Badge
                      className={`mt-1 ${
                        percentage! >= 70
                          ? "bg-green-100 text-green-700 hover:bg-green-100 border-0"
                          : "bg-red-100 text-red-600 hover:bg-red-100 border-0"
                      }`}
                    >
                      {percentage! >= 70 ? "Pass" : "Fail"}
                    </Badge>
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

            {/* Per-question breakdown */}
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3 px-1">
              Answer Breakdown
            </h2>
            <div className="space-y-3">
              {grades.results.map((entry, i) => (
                <Card key={i} className="shadow-sm">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-bold text-gray-300">Q{i + 1}</span>
                      <Badge variant="outline" className="text-xs capitalize">
                        {entry.question.type.replace("-", " ")}
                      </Badge>
                      <span className="ml-auto text-xs text-gray-400">
                        {entry.question.maxMarks} marks
                      </span>
                    </div>
                    <CardTitle className="text-sm font-medium text-gray-800 leading-relaxed">
                      {entry.question.text}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    {/* Student's answer */}
                    <div className="bg-slate-50 rounded-lg p-3 text-sm border border-slate-100">
                      <p className="text-xs font-semibold text-slate-400 mb-1">Your Answer</p>
                      {entry.answer ? (
                        <p className="text-gray-800 whitespace-pre-wrap">{entry.answer}</p>
                      ) : (
                        <p className="text-gray-400 italic">No answer provided</p>
                      )}
                    </div>

                    {/* Score row */}
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-sm font-bold ${
                          entry.marksAwarded === entry.question.maxMarks
                            ? "text-green-600"
                            : entry.marksAwarded === 0
                            ? "text-red-500"
                            : "text-yellow-600"
                        }`}
                      >
                        {entry.marksAwarded ?? 0} / {entry.question.maxMarks} marks
                      </span>
                      {entry.feedback && (
                        <p className="text-xs text-gray-500 italic text-right max-w-xs">
                          💬 {entry.feedback}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
