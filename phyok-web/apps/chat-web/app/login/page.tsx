"use client";

import { useRouter } from "next/navigation";
import { EmailLoginCard } from "@/features/auth/EmailLoginCard";

export default function LoginPage() {
  const router = useRouter();

  return (
    <main className="login-shell">
      <EmailLoginCard
        onSuccess={() => {
          router.push("/");
          router.refresh();
        }}
      />
    </main>
  );
}
