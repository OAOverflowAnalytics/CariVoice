import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CariVoice · Caribbean stories in your voice",
  description:
    "Record, transcribe, illustrate, and preserve Caribbean folklore in the voice you grew up with.",
};

export const viewport: Viewport = {
  themeColor: "#fff4e8",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
