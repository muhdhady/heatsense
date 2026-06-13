// Login page — the application entry point.
//
// Uses NextAuth's `signIn("credentials", ...)` to authenticate against the
// Supervisor table in the database (email + bcrypt-hashed password).
// On success, NextAuth creates a session cookie and the user is redirected
// to the dashboard. On failure, the error message from the server is surfaced
// via a toast notification.

'use client';

import { Flame, ArrowRight, Lock, Loader2, Eye } from 'lucide-react';
import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DEMO_EMAIL, DEMO_PASSWORD } from "@/lib/constants";

export default function Home() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  // Shared sign-in flow used by both the form and the demo button.
  // `redirect: false` lets us inspect the result and show a toast before
  // navigating manually.
  const authenticate = async (loginEmail: string, loginPassword: string) => {
    const result = await signIn("credentials", {
      redirect: false,
      email: loginEmail,
      password: loginPassword,
    });

    if (result?.ok) {
      toast.success("Access Granted. Initializing dashboard...");
      router.push("/dashboard");
      return true;
    }
    return false;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const ok = await authenticate(email, password);
      if (!ok) {
        toast.error("Invalid credentials. Please check your email and password.");
        setLoading(false);
      }
    } catch {
      // Catches network-level failures (offline, DNS error, etc.)
      toast.error("Network error. Please check your connection.");
      setLoading(false);
    }
  };

  // One-click entry into the public read-only demo account. Writes are blocked
  // server-side for this account (see app/api/workers/route.ts).
  const handleDemoLogin = async () => {
    setDemoLoading(true);
    try {
      const ok = await authenticate(DEMO_EMAIL, DEMO_PASSWORD);
      if (!ok) {
        toast.error("Demo is unavailable right now. Please try again shortly.");
        setDemoLoading(false);
      }
    } catch {
      toast.error("Network error. Please check your connection.");
      setDemoLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] flex flex-col items-center justify-center p-6 relative overflow-hidden">

      {/* Decorative background elements */}
      <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-orange-400 via-red-500 to-orange-400 opacity-80" />
      <div className="absolute -top-24 -right-24 w-64 h-64 bg-orange-200 rounded-full blur-3xl opacity-20" />
      <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-yellow-200 rounded-full blur-3xl opacity-20" />

      <div className="max-w-md w-full bg-white rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-stone-100 overflow-hidden relative z-10">

        <div className="bg-white p-8 pb-0 text-center">
          <div className="mx-auto bg-orange-50 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 border border-orange-100 shadow-sm transform rotate-3 hover:rotate-0 transition-transform duration-500">
            <Flame className="text-orange-500 w-8 h-8 fill-orange-500/20" />
          </div>
          <h1 className="text-3xl font-bold text-stone-800 tracking-tight">HeatSense</h1>
          <p className="text-stone-500 mt-2 text-sm font-medium">Industrial Safety Monitoring</p>
        </div>

        <div className="p-8">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-stone-500 uppercase tracking-wider ml-1">
                Supervisor Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="supervisor@heatsense.com"
                className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-lg text-stone-800 placeholder:text-stone-300 focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-400 transition-all font-mono text-sm"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-stone-500 uppercase tracking-wider ml-1">
                Access Key
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-lg text-stone-800 placeholder:text-stone-300 focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-400 transition-all font-mono text-sm"
                  required
                />
                <Lock className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-300 w-4 h-4" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="group w-full flex items-center justify-center gap-2 bg-stone-900 hover:bg-orange-600 text-white font-semibold py-3 rounded-lg transition-all duration-300 shadow-lg shadow-stone-200 hover:shadow-orange-200 mt-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Authenticating...
                </>
              ) : (
                <>
                  Access Dashboard
                  <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="h-px flex-1 bg-stone-100" />
            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">or</span>
            <div className="h-px flex-1 bg-stone-100" />
          </div>

          {/* One-click read-only demo for recruiters / visitors */}
          <button
            type="button"
            onClick={handleDemoLogin}
            disabled={demoLoading || loading}
            className="group w-full flex items-center justify-center gap-2 bg-white hover:bg-stone-50 text-stone-700 font-semibold py-3 rounded-lg border border-stone-200 transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {demoLoading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Entering demo...
              </>
            ) : (
              <>
                <Eye size={18} className="text-orange-500" />
                Explore read-only demo
              </>
            )}
          </button>
          <p className="text-center text-[11px] text-stone-400 mt-2">
            No account needed. Viewing only - changes are disabled.
          </p>
        </div>

        {/* Three-segment decorative stripe at the bottom of the card */}
        <div className="h-1.5 w-full bg-stone-100 flex">
          <div className="h-full w-1/3 bg-orange-400" />
          <div className="h-full w-1/3 bg-stone-200" />
          <div className="h-full w-1/3 bg-orange-600" />
        </div>
      </div>
    </div>
  );
}
