import TasksClient from "./page-client";

import { requireUser } from "~/lib/require-user";

export const metadata = {
    title: "Today | Stride",
};

function getSingleSearchParam(value: string | string[] | undefined) {
    if (Array.isArray(value)) {
        return value[0] ?? null;
    }
    return value ?? null;
}

export default async function TasksPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    await requireUser();
    const resolvedSearchParams = await searchParams;

    return (
        <TasksClient
            initialView={getSingleSearchParam(resolvedSearchParams.view)}
            initialTaskId={getSingleSearchParam(resolvedSearchParams.taskId)}
        />
    );
}
