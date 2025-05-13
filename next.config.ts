import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    domains: ['lh3.googleusercontent.com', 'firebasestorage.googleapis.com'],
  },
  eslint: {
    // გამოვრთოთ ESLint შეცდომები დეპლოიმენტის დროს
    ignoreDuringBuilds: true,
  },
  typescript: {
    // ტიპების შემოწმების გამორთვა დეპლოიმენტის დროს
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
