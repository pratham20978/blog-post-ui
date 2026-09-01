import type { Metadata } from "next";

import { AuthForm } from "@/features/auth/ui/AuthForm";

export const metadata: Metadata = {
  title: "Create an account",
  robots: { index: false, follow: false },
};

export default function SignupPage() {
  return <AuthForm purpose="signup" />;
}
