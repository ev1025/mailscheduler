import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/layout/app-shell";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "매일 캘린더",
  description: "캘린더, 가계부, 메모, 영양제 비교",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // maximumScale 미지정 — 사용자 핀치 줌 허용 (WCAG 1.4.4 접근성).
  // iOS Safari 자동 줌은 input·textarea·select 글자크기 16px 이상으로 방지.
  themeColor: "#0F172A",
  viewportFit: "cover",
  // resizes-content: 키보드가 올라오면 layout viewport 자체가 축소.
  // 100dvh, 바텀시트 bottom:0 등이 자동으로 키보드 위에 맞춰짐 → JS 오프셋
  // 계산 불필요. FormPage 는 100dvh 를 그대로 쓰고, 내부 flex-1 overflow-y-auto
  // 가 자연스럽게 줄어 Textarea 가림 해소.
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AppShell>{children}</AppShell>
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
