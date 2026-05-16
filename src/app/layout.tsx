import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ccSongs",
  description: "用音乐理解你的每一种情绪 — cc 为你的心情挑选一首歌。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
