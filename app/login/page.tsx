"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        setLoading(false);
        return;
      }
      router.push(data.role === "executive" ? "/dashboard" : "/action-center");
      router.refresh();
    } catch {
      setError("Could not reach the server.");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-900 text-lg font-semibold text-white">
            N
          </div>
          <h1 className="text-xl font-semibold text-zinc-900">Nate OS</h1>
          <p className="mt-1 text-sm text-zinc-500">Executive command center</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
        >
          <div className="mb-4">
            <label className="mb-1.5 block text-sm font-medium text-zinc-700" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
              placeholder="you@example.com"
            />
          </div>
          <div className="mb-5">
            <label className="mb-1.5 block text-sm font-medium text-zinc-700" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-zinc-900 px-3 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-60"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-zinc-400">
          Seeded demo accounts — see README for credentials.
        </p>
      </div>
    </div>
  );
}
