import FocusClient from "./page-client";

import { requireUser } from "~/lib/require-user";

export const metadata = {
    title: "Focus | Stride",
};

export default async function FocusPage() {
    await requireUser();
    return <FocusClient />;
}
