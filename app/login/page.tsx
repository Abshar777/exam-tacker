"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const router = useRouter();
  const [studentId, setStudentId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post("/auth/student/login", { studentId, password });
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("student", JSON.stringify(res.data.student));
      // Completed students go straight to the grades/results page
      if (res.data.student.examCompleted) {
        router.push("/exam/complete");
      } else {
        router.push("/exam");
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        "Login failed";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold text-indigo-700 tracking-tight">tLogic</h1>
        <p className="text-gray-500 mt-1">Online Examination System</p>
      </div>
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader>
          <CardTitle className="text-center text-xl">Student Login</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="studentId">Student ID</Label>
              <Input
                id="studentId"
                placeholder="Enter your student ID"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                required
                autoComplete="username"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Logging in…" : "Login"}
            </Button>
          </form>
          <p className="text-xs text-center text-gray-400 mt-4">
            Once you start the exam, a 70-minute timer begins. After completion, you can log in again to view your grades.
          </p>
        </CardContent>
      </Card>
      <p className="mt-6 text-sm text-gray-500">
        Admin?{" "}
        <a href="/admin/login" className="text-indigo-600 hover:underline font-medium">
          Admin Login →
        </a>
      </p>
    </div>
  );
}
