// apps/web/app/layout.tsx
import "./globals.css";
import { Inter } from "next/font/google";
import React from "react";

const inter = Inter({ subsets: ["latin"], weight: ["400","500","700"] });

// somewhere that runs on client startup
if (typeof window !== 'undefined') {
  const t = localStorage.getItem('token');
  if (t) {
    // lazy import to avoid SSR issues אם צריך
    import('@/lib/api').then(({ default: api }) => {
      api.defaults.headers.common['Authorization'] = `Bearer ${t}`;
    });
  }
}


export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr">
      <body className={`${inter.className} min-h-screen bg-gradient-to-b from-white to-slate-100 text-gray-900 antialiased`}>
        {children}
      </body>
    </html>
  );
}
