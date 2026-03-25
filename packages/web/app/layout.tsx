import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { QueryProvider } from '@/components/providers/query-provider';
import { Sidebar } from '@/components/layout/sidebar';
import { ErrorBoundary } from '@/components/error-boundary';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'ClipChat',
  description: 'Chat-first video editing',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} flex h-screen overflow-hidden bg-background text-foreground`}>
        <QueryProvider>
          <Sidebar />
          <main className="flex-1 overflow-hidden">
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </main>
        </QueryProvider>
      </body>
    </html>
  );
}
