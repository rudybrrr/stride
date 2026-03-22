import TasksClient from "./page-client";

import { requireUser } from "~/lib/require-user";

export const metadata = {
    title: "Today | Stride",
};

export default async function TasksPage() {
    await requireUser();
    return <TasksClient />;
}
