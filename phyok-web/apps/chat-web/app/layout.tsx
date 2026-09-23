import type { Metadata } from "next";
import type { ReactNode } from "react";

import { StoreProvider } from "@/store/provider";

import "./globals.css";

export const metadata: Metadata = {
  title: "心理学空间 · Agent Pro",
  description: "《心理学空间·自我探索Agent Pro》聊天端"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <StoreProvider>{children}</StoreProvider>
      </body>
    </html>
  );
}
