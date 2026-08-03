// ตาข่ายกันสิทธิ์ชั้นนอก (Next 16 เปลี่ยนชื่อจาก middleware.ts → proxy.ts)
// นโยบาย: ทั้งระบบต้องล็อกอิน ยกเว้น /login เท่านั้น
//
// ที่นี่ตรวจแค่ "มี session cookie ที่ลายเซ็นถูกและยังไม่หมดอายุ" — ไม่แตะ DB ไม่เช็ค role
// เพราะ proxy รันก่อนทุก request จึงต้องเบา และ role ใน token อาจเก่ากว่าใน DB
// การเช็ค role/แผนกตัวจริงอยู่ที่ page guard + server action ทุกตัว (defense in depth)
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

/** เส้นทางที่เข้าได้โดยไม่ต้องล็อกอิน */
const PUBLIC_PREFIXES = ["/login"];

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (session) return NextResponse.next();

  // API ตอบ 401 ตรง ๆ (redirect ไปหน้า HTML ทำให้ fetch ฝั่ง client งง)
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบก่อน" }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  if (pathname !== "/") loginUrl.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // ข้ามไฟล์ static/ไอคอน/manifest (เบราว์เซอร์ดึง manifest แบบไม่ส่ง cookie)
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.svg$|.*\\.png$).*)",
  ],
};
