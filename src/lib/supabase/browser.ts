"use client";

import { useAuth } from "@clerk/nextjs";
import { createBrowserClient } from "@supabase/ssr";
import { useMemo } from "react";

export function useSupabaseBrowserClient() {
    const { getToken } = useAuth();

    return useMemo(
        () =>
            createBrowserClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
                {
                    accessToken: async () => {
                        if (typeof window === "undefined") return null;
                        return (await getToken()) ?? null;
                    },
                },
            ),
        [getToken],
    );
}
