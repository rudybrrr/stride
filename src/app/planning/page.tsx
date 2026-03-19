import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "~/lib/supabase/server";

import PlanningClient from "./planning-client";

export const metadata = {
    title: "Planning Hub | Study Sprint",
};

export default async function PlanningPage() {
    const supabase = await createSupabaseServerClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    return <PlanningClient />;
}
