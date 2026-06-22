import type { Metadata } from "next";
import "./globals.css";
import { NavBar } from "@/components/NavBar";

export const metadata: Metadata = {
  title: "TikTok台本ジェネレーター",
  description: "過去動画の型を踏襲して、ナレーター別にタイトル・台本・ストーリーを生成",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-neutral-50 text-neutral-900">
        <NavBar />
        <main className="flex-1 w-full max-w-3xl mx-auto px-4 pb-24 pt-4">
          {children}
        </main>
      </body>
    </html>
  );
}
