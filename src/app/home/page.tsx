import { redirect } from "next/navigation";

import { requireUser } from "~/lib/require-user";

export default async function LegacyHomeRedirectPage() {
    await requireUser();
    redirect("/tasks");
}
