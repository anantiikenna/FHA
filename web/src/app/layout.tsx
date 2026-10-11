import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import "./globals.css";

export const metadata: Metadata = {
  title: "FHA — Development Approval & Property Mapping",
  description: "Federal Housing Authority — Engineer workflow for property inspection and approval verification",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
    >
      <head>
        {/* No-flash theme: apply stored (or OS) theme before hydration. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("fha:theme");var d=t?t==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;if(d)document.documentElement.classList.add("dark");}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <div className="flex min-h-screen flex-col">
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-500/10 dark:to-orange-500/10 border-b border-amber-200/60 dark:border-amber-500/30">
            <div className="max-w-screen-xl mx-auto flex items-center justify-center gap-2 py-1.5 px-4">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
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
