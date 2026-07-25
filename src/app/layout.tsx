import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/AppShell";
import { RoleProvider, GuestBanner } from "@/components/RoleProvider";

export const metadata: Metadata = {
  title: "cloud9 コンテンツマネージャー",
  description:
    "動画の台本生成・制作進行と、撮影プラン・投稿文の生成をまとめて管理",
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
        <RoleProvider>
          <GuestBanner />
          <AppShell>{children}</AppShell>
        </RoleProvider>
      </body>
    </html>
  );
}
