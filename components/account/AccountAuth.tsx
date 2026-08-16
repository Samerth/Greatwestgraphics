"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field, Input } from "@/components/checkout/FormField";
import { Button } from "@/components/shared/Button";

type Mode =
  | "sign-in"
  | "sign-up"
  | "otp-request"
  | "otp-verify"
  | "confirm"
  | "reset-request"
  | "reset-confirm";

async function postJson(path: string, body: unknown) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error?.message || "Something went wrong. Please try again.");
  }
  return payload;
}

export function AccountAuth({ next = "/portal/jobs" }: { next?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [otpSession, setOtpSession] = useState("");
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  function finishAuth() {
    router.push(next);
    router.refresh();
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    setSubmitting(true);
    try {
      await postJson("/api/auth/sign-in", { email, password });
      finishAuth();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sign-in failed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    setSubmitting(true);
    try {
      const result = await postJson("/api/auth/sign-up", { email, password, name });
      if (result.confirmed) {
        await postJson("/api/auth/sign-in", { email, password });
        finishAuth();
      } else {
        setMode("confirm");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create your account.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    setSubmitting(true);
    try {
      const result = await postJson("/api/auth/confirm", { email, code, password });
      if (result.signedIn) {
        finishAuth();
      } else {
        setMode("sign-in");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not confirm your account.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    setSubmitting(true);
    try {
      const result = await postJson("/api/auth/request-otp", { email });
      setOtpSession(result.session);
      setMode("otp-verify");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not send a code.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRequestReset(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    setSubmitting(true);
    try {
      await postJson("/api/auth/forgot-password", { email });
      setMode("reset-confirm");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not send a code.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmReset(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    setSubmitting(true);
    try {
      const result = await postJson("/api/auth/reset-password", {
        email,
        code,
        password,
      });
      if (result.signedIn) {
        finishAuth();
      } else {
        setMode("sign-in");
      }
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not reset your password.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    setSubmitting(true);
    try {
      await postJson("/api/auth/verify-otp", { email, code, session: otpSession });
      finishAuth();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That code didn't work.");
    } finally {
      setSubmitting(false);
    }
  }

  if (mode === "confirm") {
    return (
      <form onSubmit={handleConfirm} className="max-w-sm">
        <p className="text-sm text-text-secondary mb-sp-3">
          We sent a code to <b>{email}</b>. Enter it below to confirm your account.
        </p>
        <Field label="Confirmation code">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            required
            autoFocus
          />
        </Field>
        {error && <p className="text-[13px] text-red-600 font-semibold mb-sp-3">{error}</p>}
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? "Confirming…" : "Confirm account"}
        </Button>
      </form>
    );
  }

  if (mode === "reset-request") {
    return (
      <form onSubmit={handleRequestReset} className="max-w-sm">
        <p className="text-sm text-text-secondary mb-sp-3">
          Enter your email and we&apos;ll send you a code to choose a new
          password.
        </p>
        <Field label="Email">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
        </Field>
        {error && <p className="text-[13px] text-red-600 font-semibold mb-sp-3">{error}</p>}
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? "Sending…" : "Send reset code"}
        </Button>
        <button
          type="button"
          onClick={() => setMode("sign-in")}
          className="mt-sp-3 text-[13px] font-semibold text-text-tertiary hover:text-accent"
        >
          ← Back to sign-in
        </button>
      </form>
    );
  }

  if (mode === "reset-confirm") {
    return (
      <form onSubmit={handleConfirmReset} className="max-w-sm">
        <p className="text-sm text-text-secondary mb-sp-3">
          If <b>{email}</b> has an account, a reset code is on its way. Enter it
          with your new password.
        </p>
        <Field label="Reset code">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            required
            autoFocus
          />
        </Field>
        <Field label="New password">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
        </Field>
        {error && <p className="text-[13px] text-red-600 font-semibold mb-sp-3">{error}</p>}
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? "Saving…" : "Set new password"}
        </Button>
        <button
          type="button"
          onClick={() => setMode("reset-request")}
          className="mt-sp-3 text-[13px] font-semibold text-text-tertiary hover:text-accent"
        >
          Send a new code
        </button>
      </form>
    );
  }

  if (mode === "otp-request") {
    return (
      <form onSubmit={handleRequestOtp} className="max-w-sm">
        <Field label="Email">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
        </Field>
        {error && <p className="text-[13px] text-red-600 font-semibold mb-sp-3">{error}</p>}
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? "Sending…" : "Email me a code"}
        </Button>
        <button
          type="button"
          onClick={() => setMode("sign-in")}
          className="mt-sp-3 text-[13px] font-semibold text-text-tertiary hover:text-accent"
        >
          ← Back to password sign-in
        </button>
      </form>
    );
  }

  if (mode === "otp-verify") {
    return (
      <form onSubmit={handleVerifyOtp} className="max-w-sm">
        <p className="text-sm text-text-secondary mb-sp-3">
          We sent a code to <b>{email}</b>.
        </p>
        <Field label="Code">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            required
            autoFocus
          />
        </Field>
        {error && <p className="text-[13px] text-red-600 font-semibold mb-sp-3">{error}</p>}
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? "Verifying…" : "Sign in"}
        </Button>
      </form>
    );
  }

  if (mode === "sign-up") {
    return (
      <form onSubmit={handleSignUp} className="max-w-sm">
        <Field label="Full name">
          <Input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        </Field>
        <Field label="Email">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </Field>
        <Field label="Password">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
        </Field>
        {error && <p className="text-[13px] text-red-600 font-semibold mb-sp-3">{error}</p>}
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? "Creating account…" : "Create account"}
        </Button>
        <button
          type="button"
          onClick={() => setMode("sign-in")}
          className="mt-sp-3 text-[13px] font-semibold text-text-tertiary hover:text-accent"
        >
          Already have an account? Sign in
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSignIn} className="max-w-sm">
      <Field label="Email">
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus
        />
      </Field>
      <Field label="Password">
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </Field>
      {error && <p className="text-[13px] text-red-600 font-semibold mb-sp-3">{error}</p>}
      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? "Signing in…" : "Sign in"}
      </Button>
      <div className="flex flex-col gap-2 mt-sp-3">
        <button
          type="button"
          onClick={() => setMode("reset-request")}
          className="text-[13px] font-semibold text-text-tertiary hover:text-accent text-left"
        >
          Forgot your password?
        </button>
        <button
          type="button"
          onClick={() => setMode("otp-request")}
          className="text-[13px] font-semibold text-text-tertiary hover:text-accent text-left"
        >
          Email me a sign-in code instead
        </button>
        <button
          type="button"
          onClick={() => setMode("sign-up")}
          className="text-[13px] font-semibold text-text-tertiary hover:text-accent text-left"
        >
          New here? Create an account
        </button>
      </div>
    </form>
  );
}
