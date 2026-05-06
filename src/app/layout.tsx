import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MoodPlayer Agent",
  description: "A small-window music agent that chooses one track for your current mood.",
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
