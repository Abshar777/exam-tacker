"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/admin", label: "Students" },
  { href: "/admin/questions", label: "Questions" },
];

export default function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();

  function logout() {
    localStorage.removeItem("adminToken");
    localStorage.removeItem("admin");
    router.push("/admin/login");
  }

  return (
    <header className="bg-white border-b shadow-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="text-xl font-bold text-gray-800">tLogic <span className="text-xs text-gray-400 font-normal">Admin</span></span>
          <nav className="flex gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  pathname === item.href
                    ? "bg-indigo-100 text-indigo-700"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <Button variant="outline" size="sm" onClick={logout}>
          Logout
        </Button>
      </div>
    </header>
  );
}
