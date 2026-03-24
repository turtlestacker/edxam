import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Revision Tracker",
  description: "Daily revision planning with exam-led scheduling",
  manifest: "/manifest.json"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
