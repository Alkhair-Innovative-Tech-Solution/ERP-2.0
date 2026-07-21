import type { Metadata } from 'next';
import { Toaster } from 'react-hot-toast';
import './globals.css';

export const metadata: Metadata = {
  title: 'AIT LMS - Learning Management System',
  description: 'Modern Learning Management System with Student, Teacher, and Admin dashboards',
};

import AutoLoginGuard from '@/components/AutoLoginGuard';
import { Providers } from '@/components/Providers';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Plus+Jakarta+Sans:ital,wght@0,200..800;1,200..800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning>
        <AutoLoginGuard />
        <Providers>{children}</Providers>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              fontFamily: "'Inter', sans-serif",
              fontSize: '14px',
              fontWeight: 500,
            },
          }}
        />
      </body>
    </html>
  );
}

