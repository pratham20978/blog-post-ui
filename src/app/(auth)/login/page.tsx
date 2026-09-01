import type { Metadata } from "next";

import { AuthForm } from "@/features/auth/ui/AuthForm";

export const metadata: Metadata = {
  title: "Sign in",
  // A sign-in form has no business in search results.
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return <AuthForm purpose="login" />;
}
