import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export async function requireUser() {
    const { userId } = await auth();

    if (!userId) {
        redirect("/login");
    }

    return { id: userId };
}
