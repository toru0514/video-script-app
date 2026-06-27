import type { Metadata } from "next";
import "./globals.css";
import { NavBar } from "@/components/NavBar";

export const metadata: Metadata = {
  title: "動画マネージャー",
  description: "動画の制作進行（ナレーション・動画生成・公開）を管理し、台本・ストーリーを生成",
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
