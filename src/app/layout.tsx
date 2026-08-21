import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Instrument_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

// Display: headlines and headline money. Optical sizing tightens it as it grows.
const display = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});

// UI text: labels, prose, controls.
const sans = Instrument_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

// Data: every rupee figure in a row, table or readout. The statement-print voice.
const mono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  // Resolves the generated opengraph-image into an absolute URL: without
  // this, Next falls back to localhost and every shared link's preview
  // image would point at a URL that only resolves on the machine it was
  // built on.
  metadataBase: new URL("https://corpusfinance.vercel.app"),
  title: "Corpus: every account, one number",
  description:
    "A private finance hub: Indian stocks, mutual funds, US holdings, bank balances and cards resolved into a single net worth.",
};

export const viewport: Viewport = {
  themeColor: "#100e0c",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Dark-only by design: the `dark` class is applied on the server so there's
  // no flash and no half-maintained light theme.
  return (
    <html
      lang="en"
      className={`dark ${display.variable} ${sans.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="bg-background text-foreground min-h-full">
        {children}
      </body>
    </html>
  );
}
