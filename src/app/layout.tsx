import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { SideRail } from "@/components/ui/SideRail";
import { DataMigration } from "@/components/ui/DataMigration";
import "./globals.css";

const geistSans = GeistSans;
const geistMono = GeistMono;

export const metadata: Metadata = {
  title: "Nexiova · 你的 AI 学习规划战略搭档",
  description: "把模糊的想法变成清晰可执行的个人化学习计划",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="h-full bg-[var(--bg-0)]">
        <DataMigration />
        <SideRail />
        {children}
      </body>
    </html>
  );
}
