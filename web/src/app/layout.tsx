import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FHA Development Approval & Property Mapping System",
  description: "FHA Engineer workflow — map → plot → approval → inspection (DEMO DATA)",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <div className="flex min-h-screen flex-col">
          <div className="bg-amber-100 text-amber-900 text-center text-xs font-semibold py-1 px-2 border-b border-amber-200">
            DEMO / SAMPLE DATA — NOT AN OFFICIAL FHA RECORD — Synthetic GIS & fictional records
          </div>
          <div className="flex-1 flex flex-col">{children}</div>
        </div>
      </body>
    </html>
  );
}
