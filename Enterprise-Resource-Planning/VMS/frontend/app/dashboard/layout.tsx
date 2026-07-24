"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { Toaster } from "react-hot-toast";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) router.replace("/login");
  }, [router]);

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f7f6f3" }}>
      <Sidebar />
      <main style={{ marginLeft: 220, flex: 1, minHeight: "100vh", padding: "0" }}>
        {children}
      </main>
      <Toaster position="top-right" toastOptions={{
        style: { background: "#141310", color: "#f4f3f0", borderRadius: "12px", fontSize: "14px" }
      }} />
    </div>
  );
}
