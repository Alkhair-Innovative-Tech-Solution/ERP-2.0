import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import { AgentationWrapper } from "../components/AgentationWrapper";

export const metadata: Metadata = {
  title: "VMS — Visitor Management",
  description: "Front desk visitor management system",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <AgentationWrapper />
        <Toaster position="top-right" toastOptions={{
          style: { background: "#141310", color: "#f4f3f0", borderRadius: "12px", fontSize: "14px", fontFamily: "var(--font-body)" }
        }} />
      </body>
    </html>
  );
}
