import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // ค่า default ของ Next คือ 1MB — ไฟล์แนบเกิน 1MB จะถูกปฏิเสธเงียบ ๆ
      // ต้องมากกว่า MAX_UPLOAD_TOTAL_MB (20MB) เผื่อ overhead ของ multipart
      bodySizeLimit: "22mb",
    },
  },
};

export default nextConfig;
