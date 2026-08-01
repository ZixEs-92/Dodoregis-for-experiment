import type { MetadataRoute } from "next";

/**
 * ติดตั้งเป็นแอปบนมือถือได้ (Add to Home Screen)
 * เปิดจากไอคอนหน้าจอ → เข้าหน้าสแกนได้เร็วขึ้น ไม่ต้องผ่านแถบ URL
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Dodoregis — ระบบลงทะเบียนงานทดสอบ",
    short_name: "Dodoregis",
    description: "ลงทะเบียนและติดตามงานทดสอบ พร้อมสแกน QR ชิ้นงาน",
    start_url: "/",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#181d26",
    lang: "th",
    icons: [
      {
        // ไอคอน SVG ตัว D บนพื้นเข้ม — สเกลได้ทุกขนาดโดยไม่ต้องมีไฟล์ png หลายชุด
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
    shortcuts: [
      { name: "สแกน QR ชิ้นงาน", short_name: "สแกน", url: "/scan" },
      { name: "รายการงาน", short_name: "งาน", url: "/requests" },
    ],
  };
}
