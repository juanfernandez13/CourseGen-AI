import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    'mammoth', '@google/genai', 'archiver', 'uuid', 'jsonrepair',
    'adm-zip', 'multer',
  ],
};

export default nextConfig;
