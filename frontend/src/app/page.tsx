"use client";

import { useCallback, useEffect, useState } from "react";

type User = {
  id: number;
  email: string;
  name: string | null;
  createdAt: string;
};

export default function Home() {
  const [users, setUsers] = useState<User[]>([]);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/users");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setUsers(await res.json());
    } catch (err) {
      setError(
        err instanceof Error
          ? `Could not reach backend: ${err.message}`
          : "Could not reach backend",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name: name || undefined }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setEmail("");
      setName("");
      await loadUsers();
    } catch (err) {
      setError(
        err instanceof Error ? `Create failed: ${err.message}` : "Create failed",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="w-full max-w-2xl px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          Users
        </h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Fetched from Express + Prisma via the{" "}
          <code className="rounded bg-black/[.06] px-1.5 py-0.5 font-mono text-[0.9em] dark:bg-white/[.08]">
            /api
          </code>{" "}
          rewrite proxy.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-8 flex flex-col gap-3 rounded-xl border border-black/[.08] bg-white p-5 dark:border-white/[.145] dark:bg-black"
        >
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="email"
              required
              placeholder="email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 flex-1 rounded-lg border border-black/[.08] bg-transparent px-3 text-sm text-zinc-950 outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-950 dark:border-white/[.145] dark:text-zinc-50 dark:focus:ring-zinc-50"
            />
            <input
              type="text"
              placeholder="Name (optional)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-11 flex-1 rounded-lg border border-black/[.08] bg-transparent px-3 text-sm text-zinc-950 outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-950 dark:border-white/[.145] dark:text-zinc-50 dark:focus:ring-zinc-50"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="h-11 rounded-full bg-zinc-950 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-300"
          >
            {submitting ? "Adding…" : "Add user"}
          </button>
        </form>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
            {error} — is the backend running on port 3001?
          </p>
        )}

        <div className="mt-8">
          {loading ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Loading…
            </p>
          ) : users.length === 0 ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              No users yet. Add one above.
            </p>
          ) : (
            <ul className="divide-y divide-black/[.08] rounded-xl border border-black/[.08] bg-white dark:divide-white/[.145] dark:border-white/[.145] dark:bg-black">
              {users.map((user) => (
                <li
                  key={user.id}
                  className="flex items-center justify-between px-5 py-4"
                >
                  <div>
                    <p className="text-sm font-medium text-zinc-950 dark:text-zinc-50">
                      {user.name ?? "—"}
                    </p>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      {user.email}
                    </p>
                  </div>
                  <span className="text-xs text-zinc-500 dark:text-zinc-500">
                    #{user.id}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
