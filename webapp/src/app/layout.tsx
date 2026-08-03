import type { Metadata } from "next";
import { Inter, Noto_Sans_Thai } from "next/font/google";
import "./globals.css";
import NavBar from "@/components/NavBar";
import BottomNav from "@/components/BottomNav";
import UiProvider from "@/components/ui/Feedback";
import { getUnreadCount } from "@/lib/notifications";
import { getCurrentUser, toScope } from "@/lib/auth";
import { canReachApprovals, visibleDepartmentIds } from "@/lib/roles";
import { getApprovableSheets } from "@/lib/approvalQueue";

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
  const currentUser = await getCurrentUser().catch(() => null);
  const navUser = currentUser
    ? { name: currentUser.displayName, role: currentUser.role }
    : null;
  // ยังไม่ล็อกอิน = อยู่หน้า login เท่านั้น ไม่ต้องยิง query · requester/dept_head นับเฉพาะแผนกในขอบเขตตัวเอง
  const scope = currentUser ? toScope(currentUser) : null;
  const unreadCount = currentUser
    ? await getUnreadCount(visibleDepartmentIds(scope!)).catch(() => 0)
    : 0;
  const approvalCount =
    scope && canReachApprovals(scope)
      ? await getApprovableSheets(scope).then((s) => s.length).catch(() => 0)
      : 0;

  return (
    <html lang="th" className={`${inter.variable} ${notoThai.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-surface-soft text-body font-sans">
        <UiProvider>
          <NavBar unreadCount={unreadCount} approvalCount={approvalCount} user={navUser} />
          {/* เว้นที่ด้านล่างให้แถบเมนูมือถือ (sm ขึ้นไปไม่มีแถบล่าง) */}
          <main className="flex-1 w-full max-w-6xl mx-auto px-3 py-5 pb-[calc(4.5rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-8 sm:pb-8">
            {children}
          </main>
          <BottomNav user={navUser} unreadCount={unreadCount} approvalCount={approvalCount} />
        </UiProvider>
      </body>
    </html>
  );
}
