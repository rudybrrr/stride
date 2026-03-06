import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "~/lib/supabase/server";
import StudyHallClient from "./study-hall-client";

export const metadata = {
    title: "Global Study Hall | Study Sprint",
};

export default async function StudyHallPage() {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    return <StudyHallClient />;
}
