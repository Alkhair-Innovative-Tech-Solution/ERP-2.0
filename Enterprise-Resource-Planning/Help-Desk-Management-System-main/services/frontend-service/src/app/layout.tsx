import type { Metadata } from "next";
import "../styles/globals.css";
import { AuthProvider } from "../lib/auth";
import { ReactQueryProvider } from "../lib/queryClient";
import { Layout } from "../components/layout/layout";
import { Toast } from "../components/ui/Toast";
import { SessionTimeout } from "../components/auth/SessionTimeout";

export const metadata: Metadata = {
  title: "HDMS - Help Desk Management System",
  description: "Professional Help Desk Management System",
  icons: {
    icon: [
      { url: '/Logo.png', type: 'image/png' },
    ],
    shortcut: '/Logo.png',
    apple: '/Logo.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/Logo.png" type="image/png" />
        <link rel="shortcut icon" href="/Logo.png" type="image/png" />
        <link rel="apple-touch-icon" href="/Logo.png" />
      </head>
      <body
        className="antialiased"
        suppressHydrationWarning={true}
        style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}
      >
        <ReactQueryProvider>
          <AuthProvider>
            <SessionTimeout />
            <Layout>
              {children}
            </Layout>
            <Toast />
          </AuthProvider>
        </ReactQueryProvider>
      </body>
    </html>
  );
}
