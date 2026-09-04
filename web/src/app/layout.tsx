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
  title: "FHA — Development Approval & Property Mapping",
  description: "Federal Housing Authority — Engineer workflow for property inspection and approval verification",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <div className="flex min-h-screen flex-col">
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200/60">
            <div className="max-w-screen-xl mx-auto flex items-center justify-center gap-2 py-1.5 px-4">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              <p className="text-xs font-medium text-amber-800">
                Prototype Environment — Synthetic data, not official FHA records
              </p>
            </div>
          </div>
          <div className="flex-1 flex flex-col">{children}</div>
        </div>
      </body>
    </html>
  );
}
