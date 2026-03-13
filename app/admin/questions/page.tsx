"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import api from "@/lib/api";
import AdminNav from "@/components/AdminNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";

interface Question {
  _id: string;
  text: string;
  type: "mcq" | "true-false" | "short-text" | "essay";
  options: string[];
  order: number;
  maxMarks: number;
}

const TYPE_LABELS: Record<string, string> = {
  mcq: "Multiple Choice",
  "true-false": "True / False",
  "short-text": "Short Answer",
  essay: "Essay",
};

const emptyForm = {
  text: "",
  type: "mcq" as Question["type"],
  options: ["", "", "", ""],
  maxMarks: 10,
};

export default function QuestionsPage() {
  const router = useRouter();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Question | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("adminToken");
    if (!token) { router.push("/admin/login"); return; }
    fetchQuestions();
  }, [router]);

  async function fetchQuestions() {
    try {
      const res = await api.get("/admin/questions");
      setQuestions(res.data);
    } catch {
      toast.error("Failed to load questions");
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditTarget(null);
    setForm({ ...emptyForm, options: ["", "", "", ""] });
    setDialogOpen(true);
  }

  function openEdit(q: Question) {
    setEditTarget(q);
    setForm({
      text: q.text,
      type: q.type,
      options: q.options.length ? [...q.options, ...Array(4).fill("")].slice(0, 4) : ["", "", "", ""],
      maxMarks: q.maxMarks,
    });
    setDialogOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      text: form.text,
      type: form.type,
      options: form.type === "mcq" ? form.options.filter(Boolean) : [],
      maxMarks: form.maxMarks,
    };

    if (form.type === "mcq" && payload.options.length < 2) {
      toast.error("MCQ questions need at least 2 options");
      setSaving(false);
      return;
    }

    try {
      if (editTarget) {
        await api.put(`/admin/questions/${editTarget._id}`, payload);
        toast.success("Question updated");
      } else {
        await api.post("/admin/questions", payload);
        toast.success("Question created");
      }
      setDialogOpen(false);
      fetchQuestions();
    } catch {
      toast.error("Failed to save question");
    } finally {
      setSaving(false);
    }
  }

  async function deleteQuestion(id: string) {
    if (!confirm("Delete this question?")) return;
    try {
      await api.delete(`/admin/questions/${id}`);
      toast.success("Question deleted");
      fetchQuestions();
    } catch {
      toast.error("Failed to delete question");
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Questions</h1>
            <p className="text-sm text-gray-500">{questions.length} question{questions.length !== 1 ? "s" : ""} in the exam</p>
          </div>
          <Button onClick={openCreate}>+ Add Question</Button>
        </div>

        {loading ? (
          <p className="text-gray-400 animate-pulse">Loading questions…</p>
        ) : questions.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-lg">No questions yet.</p>
            <p className="text-sm">Add questions for the exam.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {questions.map((q, i) => (
              <Card key={q._id} className="shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl font-bold text-gray-200 w-8 shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs">{TYPE_LABELS[q.type]}</Badge>
                        <span className="text-xs text-gray-400">{q.maxMarks} mark{q.maxMarks !== 1 ? "s" : ""}</span>
                      </div>
                      <p className="text-gray-800 leading-relaxed">{q.text}</p>
                      {q.type === "mcq" && q.options.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {q.options.map((opt, j) => (
                            <li key={j} className="text-sm text-gray-500 flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-gray-100 text-xs flex items-center justify-center font-medium">
                                {String.fromCharCode(65 + j)}
                              </span>
                              {opt}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button size="sm" variant="outline" onClick={() => openEdit(q)}>Edit</Button>
                      <Button size="sm" variant="destructive" onClick={() => deleteQuestion(q._id)}>Delete</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editTarget ? "Edit Question" : "Add Question"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 pt-2">
            <div className="space-y-1">
              <Label>Question Type</Label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm({ ...form, type: v as Question["type"] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mcq">Multiple Choice (MCQ)</SelectItem>
                  <SelectItem value="true-false">True / False</SelectItem>
                  <SelectItem value="short-text">Short Answer</SelectItem>
                  <SelectItem value="essay">Essay</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Question Text</Label>
              <Textarea
                placeholder="Enter the question…"
                value={form.text}
                onChange={(e) => setForm({ ...form, text: e.target.value })}
                required
                className="resize-none h-24"
              />
            </div>

            {form.type === "mcq" && (
              <div className="space-y-2">
                <Label>Options</Label>
                {form.options.map((opt, i) => (
                  <Input
                    key={i}
                    placeholder={`Option ${String.fromCharCode(65 + i)}`}
                    value={opt}
                    onChange={(e) => {
                      const opts = [...form.options];
                      opts[i] = e.target.value;
                      setForm({ ...form, options: opts });
                    }}
                  />
                ))}
              </div>
            )}

            <div className="space-y-1">
              <Label>Max Marks</Label>
              <Input
                type="number"
                min={1}
                value={form.maxMarks}
                onChange={(e) => setForm({ ...form, maxMarks: Number(e.target.value) })}
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? "Saving…" : editTarget ? "Update Question" : "Add Question"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
