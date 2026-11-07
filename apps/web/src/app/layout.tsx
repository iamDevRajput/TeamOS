import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TeamOS — Delivery Risk Intelligence',
  description: 'Delivery risk intelligence grounded in project tasks, dependencies and GitHub activity',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}

