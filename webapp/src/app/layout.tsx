import type { Metadata } from "next";
import { Inter, Noto_Sans_Thai } from "next/font/google";
import "./globals.css";
import NavBar from "@/components/NavBar";
import { getUnreadCount } from "@/lib/notifications";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

// Inter ไม่มีอักษรไทย — ให้ไทย fallback มาที่ Noto Sans Thai แทน system font
const notoThai = Noto_Sans_Thai({
  variable: "--font-noto-thai",
  subsets: ["thai"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Dodoregis — ระบบลงทะเบียนงานทดสอบ",
  description: "ระบบลงทะเบียนและติดตามงานทดสอบ",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const unreadCount = await getUnreadCount().catch(() => 0);

  return (
    <html lang="th" className={`${inter.variable} ${notoThai.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-surface-soft text-body font-sans">
        <NavBar unreadCount={unreadCount} />
        <main className="flex-1 w-full max-w-6xl mx-auto px-3 py-5 sm:px-6 sm:py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
