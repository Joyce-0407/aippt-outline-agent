import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AIPPT 大纲生成器",
  description: "基于 AI 的 PPT 大纲智能生成工具，三步生成专业 PPT 大纲",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}
