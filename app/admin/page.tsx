"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import api from "@/lib/api";
import AdminNav from "@/components/AdminNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Student {
  _id: string;
  studentId: string;
  name: string;
  examCompleted: boolean;
  examStartedAt: string | null;
  examSubmittedAt: string | null;
  suspendedReason: string | null;
  createdAt: string;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ studentId: "", name: "", password: "" });
  const [creating, setCreating] = useState(false);
  const [showStudentPassword, setShowStudentPassword] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("adminToken");
    if (!token) { router.push("/admin/login"); return; }
    fetchStudents();
  }, [router]);

  async function fetchStudents() {
    try {
      const res = await api.get("/admin/students");
      setStudents(res.data);
    } catch {
      toast.error("Failed to load students");
    } finally {
      setLoading(false);
    }
  }

  async function createStudent(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      await api.post("/admin/students", form);
      toast.success(`Student "${form.name}" created`);
      setForm({ studentId: "", name: "", password: "" });
      setDialogOpen(false);
      fetchStudents();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        "Failed to create student";
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  }

  async function deleteStudent(id: string, name: string) {
    if (!confirm(`Delete student "${name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/admin/students/${id}`);
      toast.success("Student deleted");
      fetchStudents();
    } catch {
      toast.error("Failed to delete student");
    }
  }

  const examStatus = (s: Student) => {
    if (s.examCompleted && s.suspendedReason)
      return <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-0">🚫 Suspended</Badge>;
    if (s.examCompleted)
      return <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-0">✓ Submitted</Badge>;
    if (s.examStartedAt)
      return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100 border-0">⏳ In Progress</Badge>;
    return <Badge variant="outline" className="text-gray-500">Not Started</Badge>;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Students</h1>
            <p className="text-sm text-gray-500">{students.length} registered student{students.length !== 1 ? "s" : ""}</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setShowStudentPassword(false); }}>
            <DialogTrigger render={<Button />}>+ Add Student</DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Student Account</DialogTitle>
              </DialogHeader>
              <form onSubmit={createStudent} className="space-y-4 pt-2">
                <div className="space-y-1">
                  <Label>Student ID</Label>
                  <Input
                    placeholder="e.g. STU001"
                    value={form.studentId}
                    onChange={(e) => setForm({ ...form, studentId: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label>Full Name</Label>
                  <Input
                    placeholder="e.g. John Doe"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label>Password</Label>
                  <div className="relative">
                    <Input
                      type={showStudentPassword ? "text" : "password"}
                      placeholder="Set a password"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      required
                      minLength={6}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowStudentPassword((v) => !v)}
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600"
                      aria-label={showStudentPassword ? "Hide password" : "Show password"}
                    >
                      {showStudentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={creating}>
                  {creating ? "Creating…" : "Create Student"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <p className="text-gray-400 animate-pulse">Loading students…</p>
        ) : students.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-lg">No students yet.</p>
            <p className="text-sm">Click &quot;+ Add Student&quot; to create the first one.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Suspension Reason</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((s) => (
                  <TableRow
                    key={s._id}
                    className={s.suspendedReason ? "bg-red-50/40" : ""}
                  >
                    <TableCell className="font-mono font-medium">{s.studentId}</TableCell>
                    <TableCell>{s.name}</TableCell>
                    <TableCell>{examStatus(s)}</TableCell>
                    <TableCell className="text-sm max-w-xs">
                      {s.suspendedReason ? (
                        <span className="text-red-600 text-xs">{s.suspendedReason}</span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {s.examStartedAt ? new Date(s.examStartedAt).toLocaleString() : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {s.examSubmittedAt ? new Date(s.examSubmittedAt).toLocaleString() : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {s.examCompleted && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => router.push(`/admin/students/${s._id}`)}
                          >
                            {s.suspendedReason ? "Review" : "Grade"}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => deleteStudent(s._id, s.name)}
                        >
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </main>
    </div>
  );
}
