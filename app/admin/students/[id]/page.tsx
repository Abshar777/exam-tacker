"use client";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import api from "@/lib/api";
import AdminNav from "@/components/AdminNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface AnswerEntry {
  question: {
    id: string;
    text: string;
    type: string;
    options: string[];
    maxMarks: number;
    order: number;
  };
  answer: string;
  savedAt: string | null;
  marksAwarded: number | null;
  feedback: string | null;
  answerId: string | null;
}

interface Student {
  _id: string;
  studentId: string;
  name: string;
  examStartedAt: string | null;
  examSubmittedAt: string | null;
  examCompleted: boolean;
  suspendedReason: string | null;
}

interface ExamLogEntry {
  _id: string;
  event: string;
  detail: string | null;
  timestamp: string;
}

const EVENT_META: Record<string, { icon: string; label: string; color: string }> = {
  "exam-started":          { icon: "🟢", label: "Exam Started",           color: "bg-green-50 border-green-200 text-green-800" },
  "exam-submitted":        { icon: "✅", label: "Exam Submitted",          color: "bg-green-50 border-green-200 text-green-800" },
  "exam-suspended":        { icon: "🚫", label: "Exam Suspended",          color: "bg-red-50 border-red-300 text-red-800" },
  "tab-switch":            { icon: "🖥️", label: "Tab / Window Switch",     color: "bg-orange-50 border-orange-200 text-orange-800" },
  "paste-attempt":         { icon: "📋", label: "Paste Attempt",           color: "bg-yellow-50 border-yellow-200 text-yellow-800" },
  "copy-attempt":          { icon: "📋", label: "Copy Attempt",            color: "bg-yellow-50 border-yellow-200 text-yellow-800" },
  "cut-attempt":           { icon: "✂️",  label: "Cut Attempt",            color: "bg-yellow-50 border-yellow-200 text-yellow-800" },
  "screenshot-attempt":    { icon: "📸", label: "Screenshot Attempt",      color: "bg-red-50 border-red-300 text-red-800" },
  "context-menu-attempt":  { icon: "🖱️", label: "Right-Click Attempt",    color: "bg-gray-50 border-gray-200 text-gray-700" },
  "offline":               { icon: "📵", label: "Internet Disconnected",   color: "bg-orange-50 border-orange-200 text-orange-800" },
  "online":                { icon: "📶", label: "Internet Reconnected",    color: "bg-blue-50 border-blue-200 text-blue-800" },
};

export default function GradeStudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [student, setStudent] = useState<Student | null>(null);
  const [answers, setAnswers] = useState<AnswerEntry[]>([]);
  const [grades, setGrades] = useState<Record<string, { marks: string; feedback: string }>>({});
  const [logs, setLogs] = useState<ExamLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logsExpanded, setLogsExpanded] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("adminToken");
    if (!token) { router.push("/admin/login"); return; }
    fetchData();
  }, [id, router]);

  async function fetchData() {
    try {
      const [answersRes, logsRes] = await Promise.all([
        api.get(`/admin/students/${id}/answers`),
        api.get(`/admin/students/${id}/logs`),
      ]);
      setStudent(answersRes.data.student);
      setAnswers(answersRes.data.answers);
      setLogs(logsRes.data);
      // Pre-fill existing grades
      const existing: Record<string, { marks: string; feedback: string }> = {};
      answersRes.data.answers.forEach((a: AnswerEntry) => {
        existing[a.question.id] = {
          marks: a.marksAwarded !== null ? String(a.marksAwarded) : "",
          feedback: a.feedback || "",
        };
      });
      setGrades(existing);
    } catch {
      toast.error("Failed to load student data");
    } finally {
      setLoading(false);
    }
  }

  async function saveGrades() {
    setSaving(true);
    try {
      const gradePayload = answers.map((a) => ({
        questionId: a.question.id,
        marksAwarded: Number(grades[a.question.id]?.marks ?? 0),
        feedback: grades[a.question.id]?.feedback ?? "",
      }));
      await api.post(`/admin/students/${id}/grade`, { grades: gradePayload });
      toast.success("Grades saved successfully!");
    } catch {
      toast.error("Failed to save grades");
    } finally {
      setSaving(false);
    }
  }

  const totalAwarded = answers.reduce(
    (sum, a) => sum + (Number(grades[a.question.id]?.marks) || 0),
    0
  );
  const totalPossible = answers.reduce((sum, a) => sum + a.question.maxMarks, 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AdminNav />
        <div className="flex items-center justify-center py-20">
          <p className="text-gray-400 animate-pulse">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Suspension alert */}
        {student?.suspendedReason && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 flex items-start gap-3">
            <span className="text-2xl shrink-0">🚫</span>
            <div>
              <p className="font-semibold text-red-700 text-sm">Exam Suspended</p>
              <p className="text-red-600 text-sm mt-0.5">{student.suspendedReason}</p>
            </div>
          </div>
        )}

        {/* Student header */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-800">{student?.name}</h1>
                <Badge variant="outline" className="font-mono">{student?.studentId}</Badge>
                {student?.examCompleted && !student?.suspendedReason && (
                  <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-0">✓ Submitted</Badge>
                )}
                {student?.suspendedReason && (
                  <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-0">🚫 Suspended</Badge>
                )}
              </div>
              <div className="text-sm text-gray-500 mt-1 space-x-4">
                {student?.examStartedAt && (
                  <span>Started: {new Date(student.examStartedAt).toLocaleString()}</span>
                )}
                {student?.examSubmittedAt && (
                  <span>Submitted: {new Date(student.examSubmittedAt).toLocaleString()}</span>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-indigo-600">
                {totalAwarded} <span className="text-gray-300">/</span> {totalPossible}
              </p>
              <p className="text-xs text-gray-400">Total Marks</p>
            </div>
          </div>
        </div>

        {/* ── Exam Activity Log ──────────────────────────────────────────── */}
        <div className="bg-white rounded-xl shadow-sm border mb-6 overflow-hidden">
          {/* Header row with summary counts */}
          <button
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors text-left"
            onClick={() => setLogsExpanded((v) => !v)}
          >
            <div className="flex items-center gap-3">
              <span className="font-semibold text-gray-800 text-sm">📋 Exam Activity Log</span>
              <span className="text-xs text-gray-400">{logs.length} event{logs.length !== 1 ? "s" : ""}</span>
              {/* Quick-glance violation counts */}
              {(() => {
                const tabCount = logs.filter(l => l.event === "tab-switch").length;
                const pasteCount = logs.filter(l => l.event === "paste-attempt").length;
                const copyCount = logs.filter(l => l.event === "copy-attempt").length;
                const cutCount = logs.filter(l => l.event === "cut-attempt").length;
                const ssCount = logs.filter(l => l.event === "screenshot-attempt").length;
                const ctxCount = logs.filter(l => l.event === "context-menu-attempt").length;
                return (
                  <div className="flex flex-wrap gap-1.5">
                    {tabCount > 0 && <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200">🖥️ {tabCount} tab switch{tabCount > 1 ? "es" : ""}</span>}
                    {pasteCount > 0 && <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 border border-yellow-200">📋 {pasteCount} paste</span>}
                    {(copyCount + cutCount) > 0 && <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 border border-yellow-200">📋 {copyCount + cutCount} copy/cut</span>}
                    {ssCount > 0 && <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">📸 {ssCount} screenshot</span>}
                    {ctxCount > 0 && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">🖱️ {ctxCount} right-click</span>}
                  </div>
                );
              })()}
            </div>
            <span className="text-gray-400 text-xs">{logsExpanded ? "▲ collapse" : "▼ expand"}</span>
          </button>

          {logsExpanded && (
            <div className="border-t divide-y max-h-[520px] overflow-y-auto">
              {logs.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-8">No activity logged yet.</p>
              ) : (
                logs.map((log) => {
                  const meta = EVENT_META[log.event] ?? {
                    icon: "📌",
                    label: log.event,
                    color: "bg-gray-50 border-gray-200 text-gray-700",
                  };
                  return (
                    <div key={log._id} className={`flex items-start gap-3 px-5 py-3 ${meta.color}`}>
                      <span className="text-lg shrink-0 mt-0.5">{meta.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{meta.label}</p>
                        {log.detail && (
                          <p className="text-xs opacity-75 mt-0.5 break-words">{log.detail}</p>
                        )}
                      </div>
                      <time className="text-xs opacity-60 shrink-0 mt-0.5">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </time>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Answers */}
        <div className="space-y-4 mb-6">
          {answers.map((entry, i) => (
            <Card key={entry.question.id} className="shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-bold text-gray-400">Q{i + 1}</span>
                      <Badge variant="outline" className="text-xs capitalize">
                        {entry.question.type.replace("-", " ")}
                      </Badge>
                      <span className="text-xs text-gray-400">Max: {entry.question.maxMarks} marks</span>
                    </div>
                    <p className="text-gray-800 font-medium leading-relaxed">{entry.question.text}</p>
                    {entry.question.type === "mcq" && entry.question.options.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {entry.question.options.map((opt, j) => (
                          <span
                            key={j}
                            className={`text-xs px-2 py-1 rounded-full border ${
                              entry.answer === opt
                                ? "bg-indigo-100 text-indigo-700 border-indigo-300 font-medium"
                                : "bg-gray-50 text-gray-500 border-gray-200"
                            }`}
                          >
                            {String.fromCharCode(65 + j)}. {opt}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Student's answer */}
                <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                  <p className="text-xs font-semibold text-blue-500 mb-1">Student&apos;s Answer</p>
                  {entry.answer ? (
                    <p className="text-gray-800 whitespace-pre-wrap">{entry.answer}</p>
                  ) : (
                    <p className="text-gray-400 italic">No answer provided</p>
                  )}
                </div>

                {/* Grading */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Marks Awarded (max {entry.question.maxMarks})</Label>
                    <Input
                      type="number"
                      min={0}
                      max={entry.question.maxMarks}
                      value={grades[entry.question.id]?.marks ?? ""}
                      onChange={(e) =>
                        setGrades((prev) => ({
                          ...prev,
                          [entry.question.id]: {
                            ...prev[entry.question.id],
                            marks: e.target.value,
                          },
                        }))
                      }
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Feedback (optional)</Label>
                    <Textarea
                      value={grades[entry.question.id]?.feedback ?? ""}
                      onChange={(e) =>
                        setGrades((prev) => ({
                          ...prev,
                          [entry.question.id]: {
                            ...prev[entry.question.id],
                            feedback: e.target.value,
                          },
                        }))
                      }
                      placeholder="Leave feedback…"
                      className="resize-none h-9 text-sm"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Save button */}
        <div className="sticky bottom-4 flex justify-end">
          <div className="bg-white rounded-xl shadow-lg border p-4 flex items-center gap-6">
            <div className="text-right">
              <p className="text-xs text-gray-400">Total Score</p>
              <p className="text-xl font-bold text-indigo-600">
                {totalAwarded} / {totalPossible}
              </p>
            </div>
            <Button onClick={saveGrades} disabled={saving} className="px-8">
              {saving ? "Saving…" : "Save Grades"}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
