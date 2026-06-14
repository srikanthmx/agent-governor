import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { webAppMode } from "./deployment";

export const metadata: Metadata = {
  title: "Agent Governor",
  description: "Your subscribed AI coding tools, governed from anywhere",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const mode = webAppMode();

  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen">
          <Sidebar mode={mode} />
          <main className="flex-1 ml-[220px]">
            <div className="max-w-[1080px] mx-auto px-8 py-8">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
