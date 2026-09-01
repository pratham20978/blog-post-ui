"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useAuth } from "@/app/providers/AuthProvider";
import { useConfig } from "@/app/providers/ConfigProvider";
import { messageFor } from "@/shared/api/errors";
import { BFF_BASE, localRoutes, routes } from "@/shared/api/routes";
import type {
  APIResponse,
  AuthPurpose,
  OAuthProviderName,
  OAuthStartResponse,
  OtpRequestAccepted,
} from "@/shared/contracts";
import { Button } from "@/shared/ui/Button";
import { Field } from "@/shared/ui/Field";
import { Rule } from "@/shared/ui/primitives";

import { OtpInput } from "./OtpInput";

/**
 * Sign in and sign up — the same flow, differently framed.
 *
 * Authentication here is passwordless: an emailed code, or OAuth. There is no
 * password field to build, and `purpose` is the only thing that differs
 * between the two pages.
 *
 * The email step's response is deliberately identical whether or not an
 * account exists, so this UI must not imply a difference either — saying
 * "no account found" would rebuild the enumeration oracle the backend refuses
 * to be.
 */
export function AuthForm({ purpose }: { purpose: AuthPurpose }) {
  const { oauthProviders, dataSource, devOtpCode } = useConfig();
  const { refresh } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [resendAt, setResendAt] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  // Sample mode. The code step is real either way — `/api/auth/otp-verify`
  // handles both — but no email can be sent and OAuth has no provider to
  // redirect to, so those two steps are stubbed and say so.
  const simulated = dataSource === "fixtures";

  useEffect(() => {
    if (resendAt === null) return;

    const tick = () => setSecondsLeft(Math.max(0, Math.ceil((resendAt - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [resendAt]);

  async function requestCode(address: string) {
    setPending(true);
    setError(null);

    try {
      if (simulated) {
        setResendAt(Date.now() + 30_000);
        setStep("code");
        return;
      }

      const response = await fetch(`${BFF_BASE}${routes.otpRequest()}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: address, purpose }),
      });
      const body = (await response.json()) as APIResponse<OtpRequestAccepted>;

      if (!body.success || !body.data) {
        setError(body.error?.safe_message ?? "Could not send a code.");
        return;
      }

      setResendAt(new Date(body.data.resend_after).getTime());
      setStep("code");
    } catch (cause) {
      setError(messageFor(cause));
    } finally {
      setPending(false);
    }
  }

  async function verify(submitted: string) {
    setPending(true);
    setError(null);

    try {
      // A local route rather than the BFF passthrough: this response carries
      // the token pair, and it must be turned into httpOnly cookies on the
      // server rather than handed to the browser.
      const response = await fetch(localRoutes.otpVerify(), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, code: submitted }),
      });
      const body = (await response.json()) as APIResponse<unknown>;

      if (!body.success) {
        setError(body.error?.safe_message ?? "That code did not work.");
        setCode("");
        return;
      }

      await refresh();
      router.push("/blogs");
      router.refresh();
    } catch (cause) {
      setError(messageFor(cause));
    } finally {
      setPending(false);
    }
  }

  async function startOAuth(provider: OAuthProviderName) {
    setPending(true);
    setError(null);

    try {
      if (simulated) {
        setError("Sample mode: OAuth needs the backend running.");
        return;
      }

      const response = await fetch(`${BFF_BASE}${routes.oauthStart(provider)}?redirect_path=/blogs`);
      const body = (await response.json()) as APIResponse<OAuthStartResponse>;

      if (!body.success || !body.data) {
        setError(body.error?.safe_message ?? "Could not start sign-in.");
        return;
      }

      // `assign`, not `location.href = …`: a full-page navigation to the
      // provider, expressed as a call rather than a mutation of a global.
      window.location.assign(body.data.authorization_url);
    } catch (cause) {
      setError(messageFor(cause));
    } finally {
      setPending(false);
    }
  }

  const signingUp = purpose === "signup";

  if (step === "code") {
    return (
      <div>
        <h1 className="text-title font-semibold tracking-title">Check your email</h1>
        {/*
          Three states, not two. There is no email adapter yet, so "we sent you
          a code" is only true once one exists — saying it while nothing was
          sent leaves the reader waiting on an email that is never coming.
        */}
        <p className="mt-3 text-[0.9375rem] text-muted">
          {devOtpCode ? (
            <>
              No email is sent yet. Enter{" "}
              <code className="font-mono text-fg">{devOtpCode}</code> to sign in as{" "}
              <span className="text-fg">{email}</span>.
            </>
          ) : (
            <>
              We sent a six-digit code to <span className="text-fg">{email}</span>.
            </>
          )}
        </p>

        <form
          className="mt-8"
          onSubmit={(event) => {
            event.preventDefault();
            void verify(code);
          }}
        >
          <OtpInput
            value={code}
            onChange={setCode}
            onComplete={(complete) => void verify(complete)}
            disabled={pending}
            invalid={Boolean(error)}
          />

          {error && (
            <p role="alert" className="mt-3 text-meta text-danger">
              {error}
            </p>
          )}

          <Button type="submit" block disabled={pending || code.length < 6} className="mt-6">
            {pending ? "Verifying…" : "Continue"}
          </Button>
        </form>

        <div className="mt-6 flex items-center justify-between text-meta">
          <button
            type="button"
            onClick={() => {
              setStep("email");
              setCode("");
              setError(null);
            }}
            className="text-muted underline underline-offset-4 hover:text-fg"
          >
            Use a different address
          </button>

          <button
            type="button"
            disabled={secondsLeft > 0 || pending}
            onClick={() => void requestCode(email)}
            className="text-muted underline underline-offset-4 hover:text-fg disabled:no-underline disabled:opacity-50"
          >
            {secondsLeft > 0 ? `Resend in ${secondsLeft}s` : "Resend code"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-title font-semibold tracking-title">
        {signingUp ? "Create an account" : "Sign in"}
      </h1>
      <p className="mt-3 text-[0.9375rem] text-muted">
        {signingUp
          ? "Save articles, keep your place, and join the discussion."
          : "Enter your email and we will send you a code."}
      </p>

      <form
        className="mt-8"
        onSubmit={(event) => {
          event.preventDefault();
          void requestCode(email);
        }}
      >
        <Field
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={error}
          disabled={pending}
        />

        <Button type="submit" block disabled={pending || !email} className="mt-5">
          {pending ? "Sending…" : "Continue with email"}
        </Button>
      </form>

      {oauthProviders.length > 0 && (
        <>
          <div className="my-8 flex items-center gap-4">
            <Rule className="flex-1" />
            <span className="text-eyebrow uppercase tracking-eyebrow text-muted">or</span>
            <Rule className="flex-1" />
          </div>

          <div className="flex flex-col gap-3">
            {oauthProviders.map((provider) => (
              <Button
                key={provider}
                type="button"
                variant="secondary"
                block
                disabled={pending}
                onClick={() => void startOAuth(provider)}
              >
                Continue with {provider === "google" ? "Google" : "GitHub"}
              </Button>
            ))}
          </div>
        </>
      )}

      <p className="mt-8 text-meta text-muted">
        {signingUp ? (
          <>
            Already have an account?{" "}
            <Link href="/login" className="text-fg underline underline-offset-4">
              Sign in
            </Link>
          </>
        ) : (
          <>
            New here?{" "}
            <Link href="/signup" className="text-fg underline underline-offset-4">
              Create an account
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
