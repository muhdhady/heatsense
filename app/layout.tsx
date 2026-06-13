// Root layout — wraps every page in the application.
//
// Share Tech Mono is used as the global font. It gives numeric readings
// (BPM, temperature) a distinct monospace appearance that matches the
// industrial monitoring aesthetic.
//
// The Toaster component (from sonner) renders toast notifications globally
// so any page can call toast.success() / toast.error() without managing its
// own notification state.

import type { Metadata } from "next";
import { Share_Tech_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const shareTechMono = Share_Tech_Mono({
  weight: '400',
  subsets: ["latin"],
  variable: '--font-share-tech'
});

export const metadata: Metadata = {
  title: "HeatSense Dashboard",
  description: "Industrial Safety Monitoring System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${shareTechMono.className} antialiased`}>
        {children}
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
