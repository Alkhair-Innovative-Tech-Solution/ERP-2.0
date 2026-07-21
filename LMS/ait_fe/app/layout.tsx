import type { Metadata } from 'next';
import { ThemeProvider } from '@/components/mainComponent/theme-provider';
import './globals.css';


export const metadata: Metadata = {
  title: 'AIT | Al-Khair Institute of Technology',
  description: 'We Are Here For Excellence \n AIT is committed to empowering underserved communities by providing high-quality tech education, driven by innovation and technology',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {//
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" sizes="180x180" href="/favicon/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon/favicon-16x16.png" />
        <link rel="manifest" href="/site.webmanifest" />
      </head>
      <body suppressHydrationWarning className="transition-colors duration-300">
        <ThemeProvider>
          <main>{children}</main>
        </ThemeProvider>
      </body>
    </html>
  );
}
