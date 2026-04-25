import { SignIn } from "@clerk/nextjs";

const benefits = [
    {
        title: "Keep work connected",
        description: "Tasks, planner blocks, and weekly review stay in one calmer workspace.",
    },
    {
        title: "Protect focus time",
        description: "Turn deadlines into realistic sessions instead of scattered reminders.",
    },
    {
        title: "Review with context",
        description: "Progress stays tied to the projects and commitments that shaped the week.",
    },
] as const;

const StrideLogo = () => (
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
);

const SignInFallback = () => (
    <div className="w-full max-w-[440px] rounded-[1.25rem] border border-border/60 bg-card/55 px-8 py-10 text-center shadow-none backdrop-blur-sm">
        <div className="mx-auto h-10 w-10 animate-pulse rounded-2xl bg-primary/15" />
        <p className="mt-5 text-sm font-semibold text-foreground">Loading sign in...</p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Clerk is loading the secure authentication form.
        </p>
    </div>
);

export function SignInScreen() {
    return (
        <main className="auth-page relative isolate min-h-screen overflow-hidden bg-background px-4 py-10 text-foreground selection:bg-primary/30 sm:px-6 lg:px-8">
            <div className="pointer-events-none absolute inset-0">
                <div className="absolute inset-0" style={{ background: "var(--auth-shell-backdrop)" }} />
                <div
                    className="absolute left-[-14%] top-[7%] h-[270px] w-[430px] -rotate-6 rounded-[3rem] border border-primary/15 bg-primary/10 sm:h-[320px] sm:w-[540px]"
                    style={{ boxShadow: "0 0 140px color-mix(in oklab, var(--primary) 18%, transparent)" }}
                />
                <div className="absolute right-[8%] top-[12%] h-44 w-44 rounded-full border border-primary/15 bg-primary/5 sm:h-64 sm:w-64" />
                <div className="absolute bottom-[-14%] right-[-8%] h-[250px] w-[240px] rotate-[16deg] rounded-[2.75rem] border border-foreground/15 bg-card/35 sm:h-[320px] sm:w-[300px]" />
                <div className="absolute left-[8%] top-[60%] h-px w-28 bg-gradient-to-r from-transparent via-primary/40 to-transparent sm:w-40" />
                <div className="absolute right-[7%] top-[38%] h-24 w-px bg-gradient-to-b from-transparent via-primary/30 to-transparent sm:h-32" />
            </div>

            <div className="relative mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-[1420px] items-center">
                <div className="grid w-full items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(430px,500px)] lg:gap-16 xl:gap-24">
                    <section className="relative hidden min-h-[620px] flex-col justify-between py-8 lg:flex">
                        <StrideLogo />
                        <div className="max-w-[36rem] space-y-6 pb-8">
                            <p className="text-xs font-medium uppercase tracking-[0.28em] text-muted-foreground">
                                Student planning workspace
                            </p>
                            <h1 className="text-balance text-[3.7rem] font-semibold leading-[0.98] tracking-[-0.07em] text-foreground xl:text-[4.8rem]">
                                Keep schoolwork calm and moving.
                            </h1>
                            <p className="max-w-xl text-lg leading-8 text-muted-foreground">
                                Stride brings tasks, planning, and focus into one quieter desktop workspace so deadlines stay visible without adding more noise.
                            </p>
                        </div>
                        <div className="grid max-w-[44rem] gap-3 xl:grid-cols-3">
                            {benefits.map((benefit) => (
                                <div
                                    key={benefit.title}
                                    className="rounded-[1.25rem] border border-border/60 bg-card/55 px-4 py-4 backdrop-blur-sm"
                                >
                                    <p className="text-sm font-semibold tracking-[-0.02em] text-foreground">{benefit.title}</p>
                                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{benefit.description}</p>
                                </div>
                            ))}
                        </div>
                    </section>

                    <div className="relative flex w-full justify-center lg:justify-end">
                        <div className="pointer-events-none absolute -left-8 top-1/2 hidden h-[58vh] w-px -translate-y-1/2 bg-gradient-to-b from-transparent via-border/50 to-transparent lg:block" />
                        <SignIn
                            path="/login"
                            routing="path"
                            signUpUrl="/sign-up"
                            fallbackRedirectUrl="/tasks"
                            forceRedirectUrl="/tasks"
                            fallback={<SignInFallback />}
                            appearance={{
                                variables: {
                                    colorPrimary: "hsl(var(--primary))",
                                    colorBackground: "hsl(var(--card))",
                                    colorText: "hsl(var(--foreground))",
                                    colorTextSecondary: "hsl(var(--muted-foreground))",
                                    colorInputBackground: "hsl(var(--background))",
                                    colorInputText: "hsl(var(--foreground))",
                                    borderRadius: "1.15rem",
                                    fontFamily: "var(--font-manrope), sans-serif",
                                },
                                elements: {
                                    cardBox: "shadow-none border border-border/60 bg-card/55 backdrop-blur-sm",
                                    card: "border-0 bg-transparent shadow-none",
                                    headerTitle: "text-foreground font-bold tracking-[-0.04em]",
                                    headerSubtitle: "text-muted-foreground",
                                    formButtonPrimary:
                                        "bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100 disabled:shadow-none font-semibold transition-[transform,opacity] hover:-translate-y-px disabled:hover:translate-y-0",
                                    footerActionLink: "text-primary hover:text-primary/80",
                                },
                            }}
                        />
                    </div>
                </div>
            </div>
        </main>
    );
}
