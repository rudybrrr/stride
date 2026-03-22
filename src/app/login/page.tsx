"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { createSupabaseBrowserClient } from "~/lib/supabase/browser";

export default function LoginPage() {
  const supabase = createSupabaseBrowserClient();
  const router = useRouter();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const isLogin = mode === "login";

  const submit = async () => {
    setLoading(true);

    const { error } =
      isLogin
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(isLogin ? "Welcome back!" : "Account created!");
    router.push("/tasks");
    router.refresh();
  };

  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-background px-4 py-10 text-foreground selection:bg-primary/30 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(124,167,255,0.14),_transparent_32%),linear-gradient(180deg,_rgba(15,23,42,0.06)_0%,_transparent_40%,_rgba(15,23,42,0.12)_100%)] dark:bg-[radial-gradient(circle_at_top,_rgba(124,167,255,0.18),_transparent_28%),linear-gradient(180deg,_rgba(2,6,23,0.32)_0%,_transparent_36%,_rgba(2,6,23,0.46)_100%)]" />
        <div className="absolute left-[-14%] top-[7%] h-[270px] w-[430px] -rotate-6 rounded-[3rem] border border-primary/15 bg-primary/10 shadow-[0_0_140px_rgba(47,106,224,0.12)] sm:h-[320px] sm:w-[540px] dark:bg-primary/8" />
        <div className="absolute right-[8%] top-[12%] h-44 w-44 rounded-full border border-primary/15 bg-primary/5 sm:h-64 sm:w-64" />
        <div className="absolute bottom-[-14%] right-[-8%] h-[250px] w-[240px] rotate-[16deg] rounded-[2.75rem] border border-foreground/15 bg-card/35 sm:h-[320px] sm:w-[300px] dark:bg-card/20" />
        <div className="absolute left-[8%] top-[60%] h-px w-28 bg-gradient-to-r from-transparent via-primary/40 to-transparent sm:w-40" />
        <div className="absolute right-[7%] top-[38%] h-24 w-px bg-gradient-to-b from-transparent via-primary/30 to-transparent sm:h-32" />
      </div>

      <div className="relative mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-[1420px] items-center">
        <div className="grid w-full items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(430px,500px)] lg:gap-16 xl:gap-24">
          <section className="relative hidden min-h-[620px] flex-col justify-between py-8 lg:flex">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.25"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5"
                >
                  <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
              </div>
              <span className="text-[1.65rem] font-bold tracking-[-0.05em]">
                Stride<span className="text-primary">.</span>
              </span>
            </div>

            <div className="max-w-[36rem] space-y-6 pb-8">
              <p className="text-xs font-medium uppercase tracking-[0.28em] text-muted-foreground">
                Student productivity
              </p>
              <h1 className="text-balance text-6xl font-extrabold leading-[0.96] tracking-[-0.07em] text-foreground xl:text-[5.5rem]">
                Turn plans into progress.
              </h1>
              <p className="max-w-xl text-xl leading-9 text-muted-foreground">
                Stride helps students organize tasks, protect focus, and keep momentum across classes and deadlines.
              </p>
            </div>
          </section>

          <div className="relative w-full max-w-[460px] justify-self-center lg:justify-self-end">
            <div className="pointer-events-none absolute -left-8 top-1/2 hidden h-[58vh] w-px -translate-y-1/2 bg-gradient-to-b from-transparent via-border/50 to-transparent lg:block" />
            <div className="absolute inset-4 rounded-[2.4rem] bg-primary/12 blur-3xl dark:bg-primary/14" />

            <section className="relative overflow-hidden rounded-[2.2rem] border border-border/60 bg-card/88 p-6 shadow-[0_24px_90px_rgba(15,23,42,0.18)] backdrop-blur-xl dark:shadow-[0_32px_100px_rgba(2,6,23,0.55)] sm:p-8">
              <div className="absolute inset-0 bg-[linear-gradient(180deg,_rgba(255,255,255,0.16)_0%,_transparent_18%,_transparent_84%,_rgba(124,167,255,0.08)_100%)] dark:bg-[linear-gradient(180deg,_rgba(255,255,255,0.05)_0%,_transparent_16%,_transparent_84%,_rgba(124,167,255,0.10)_100%)]" />
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent dark:via-white/20" />

              <div className="relative space-y-8">
                <div className="space-y-6">
                  <div className="flex items-center gap-3 lg:hidden">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.25"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-5 w-5"
                      >
                        <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
                        <path d="m9 12 2 2 4-4" />
                      </svg>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xl font-bold tracking-[-0.05em]">
                        Stride<span className="text-primary">.</span>
                      </p>
                      <p className="text-xs font-medium uppercase tracking-[0.28em] text-muted-foreground">
                        Student productivity
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="hidden text-xs font-medium uppercase tracking-[0.28em] text-muted-foreground lg:block">
                      Account access
                    </p>
                    <h1 className="text-balance text-4xl font-extrabold tracking-[-0.06em] text-foreground sm:text-[2.7rem]">
                      {isLogin ? "Log in" : "Create account"}
                    </h1>
                    <p className="max-w-sm text-[15px] leading-6 text-muted-foreground">
                      {isLogin
                        ? "Enter your details to continue, pick up your tasks, and get back into flow."
                        : "Create your account to organize tasks, focus blocks, and deadlines in one calm workspace."}
                    </p>
                  </div>
                </div>

                <form
                  className="space-y-5"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void submit();
                  }}
                >
                  <div className="space-y-2.5">
                    <label className="ml-1 text-sm font-medium text-foreground/88">Email</label>
                    <Input
                      autoComplete="email"
                      className="h-14 rounded-2xl border-border/70 bg-background/40 px-4 text-base shadow-none backdrop-blur-sm transition-all hover:border-border/90 focus-visible:border-primary/70 focus-visible:ring-primary/15 dark:bg-background/20"
                      placeholder="you@example.com"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2.5">
                    <label className="ml-1 text-sm font-medium text-foreground/88">Password</label>
                    <Input
                      autoComplete={isLogin ? "current-password" : "new-password"}
                      className="h-14 rounded-2xl border-border/70 bg-background/40 px-4 text-base shadow-none backdrop-blur-sm transition-all hover:border-border/90 focus-visible:border-primary/70 focus-visible:ring-primary/15 dark:bg-background/20"
                      placeholder="Enter your password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>

                  <Button
                    className="mt-2 h-14 w-full rounded-2xl text-base font-semibold shadow-[0_18px_40px_rgba(47,106,224,0.28)] hover:shadow-[0_22px_48px_rgba(47,106,224,0.34)] dark:shadow-[0_20px_44px_rgba(124,167,255,0.30)] dark:hover:shadow-[0_24px_52px_rgba(124,167,255,0.36)]"
                    disabled={loading || !email || !password}
                    type="submit"
                  >
                    {loading ? (
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                    ) : isLogin ? (
                      "Log in"
                    ) : (
                      "Create account"
                    )}
                  </Button>
                </form>

                <div className="text-center text-sm text-muted-foreground">
                  {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
                  <button
                    className="font-semibold text-foreground transition-colors hover:text-primary"
                    onClick={() => setMode(isLogin ? "register" : "login")}
                    type="button"
                  >
                    {isLogin ? "Sign up" : "Sign in"}
                  </button>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
