import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    'mammoth', '@google/genai', 'archiver', 'uuid', 'jsonrepair', 'exceljs',
    'adm-zip',
  ],
};

export default nextConfig;
