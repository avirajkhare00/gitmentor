import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import GoogleAnalytics from './components/GoogleAnalytics'

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "GitMentor - Your Personal GitHub Growth Guide",
  description: "Get personalized feedback and actionable insights to improve your GitHub profile and coding practices.",
  keywords: ["GitHub", "Developer Feedback", "Code Analysis", "Programming Mentor", "Developer Growth"],
  authors: [{ name: "GitMentor Team" }],
  openGraph: {
    title: "GitMentor - Your Personal GitHub Growth Guide",
    description: "Get personalized feedback and actionable insights to improve your GitHub profile and coding practices.",
    type: "website",
    locale: "en_US",
    siteName: "GitMentor",
  },
  twitter: {
    card: "summary_large_image",
    title: "GitMentor - Your Personal GitHub Growth Guide",
    description: "Get personalized feedback and actionable insights to improve your GitHub profile and coding practices.",
  },
  robots: "index, follow",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID && (
          <GoogleAnalytics GA_MEASUREMENT_ID={process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID} />
        )}
        {children}
      </body>
    </html>
  );
}
