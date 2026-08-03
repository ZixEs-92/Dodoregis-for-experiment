// หน้าสแกนเป็น client component (ต้องใช้กล้อง) เลยกันสิทธิ์ที่ layout ฝั่ง server แทน
// สแกน QR ตอนยังไม่ล็อกอิน → เด้งไป /login?next=/scan แล้วพากลับมาให้เอง
import { guardPageUser } from "@/lib/guard";

export default async function ScanLayout({ children }: { children: React.ReactNode }) {
  await guardPageUser("/scan");
  return children;
}
