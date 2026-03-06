import "~/styles/globals.css";

import { type Metadata } from "next";
import { Toaster } from "~/components/ui/sonner";
import { ThemeProvider } from "~/components/theme-provider";
import { FocusProvider } from "~/components/focus-provider";
import { DataProvider } from "~/components/data-provider";

export const metadata: Metadata = {
  title: "Study Sprint",
  description: "Empowering Focus for Students",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <DataProvider>
            <FocusProvider>
              {children}
              <Toaster />
            </FocusProvider>
          </DataProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
