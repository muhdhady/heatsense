import type { Metadata } from "next";
import { Share_Tech_Mono } from "next/font/google";
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
      </body>
    </html>
  );
}