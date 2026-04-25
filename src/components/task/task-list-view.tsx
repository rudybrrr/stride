"use client";

import { useMemo, type ReactNode } from "react";

import { TaskRow } from "~/components/task/task-row";
import { useData } from "~/components/data-provider";
import { useTaskDataset } from "~/hooks/use-task-dataset";
import type { TaskDatasetRecord } from "~/hooks/use-task-dataset";
import type { ProjectMemberProfile, TodoList } from "~/lib/types";
import { cn } from "~/lib/utils";

interface TaskListViewProps {
    tasks: TaskDatasetRecord[];
    lists: TodoList[];
    selectedTaskId?: string | null;
    selectedTaskIds?: Set<string>;
    selectionMode?: boolean;
    onSelect: (task: TaskDatasetRecord, options?: { shiftKey?: boolean }) => void;
    onToggle: (task: TaskDatasetRecord, nextIsDone: boolean) => void;
    onSelectionToggle?: (task: TaskDatasetRecord, options?: { shiftKey?: boolean }) => void;
    showProject?: boolean;
    emptyMessage?: string;
    renderInlineDetail?: (task: TaskDatasetRecord) => ReactNode;
}

function buildAssigneeDirectory(
    membersByListId: Record<string, ProjectMemberProfile[]>,
) {
    const directory = new Map<string, ProjectMemberProfile>();
    Object.entries(membersByListId).forEach(([listId, members]) => {
        members.forEach((member) => {
            directory.set(`${listId}:${member.user_id}`, member);
        });
    });
    return directory;
}

export function TaskListView({
    tasks,
    lists,
    selectedTaskId,
    selectedTaskIds,
    selectionMode = false,
    onSelect,
    onToggle,
    onSelectionToggle,
    showProject = false,
    emptyMessage = "No tasks here yet.",
    renderInlineDetail,
}: TaskListViewProps) {
    const { profile } = useData();
    const { membersByListId } = useTaskDataset();
    const projectById = useMemo(
        () => new Map(lists.map((list) => [list.id, list])),
        [lists],
    );
    const assigneeDirectory = useMemo(
        () => buildAssigneeDirectory(membersByListId),
        [membersByListId],
    );
    const timeZone = profile?.timezone ?? null;

    if (tasks.length === 0) {
        return (
            <div className="surface-empty-state flex items-center justify-center px-4 py-12 text-center">
                <p className="max-w-sm text-[13.5px] leading-6 text-muted-foreground/70">
                    {emptyMessage}
                </p>
            </div>
        );
    }

    return (
        <div className={cn("flex flex-col gap-px list-paint-skip")}>
            {tasks.map((task) => {
                const assignee = task.assignee_user_id
                    ? assigneeDirectory.get(`${task.list_id}:${task.assignee_user_id}`) ?? null
                    : null;
                const isSelected = task.id === selectedTaskId;
                const inlineDetail = isSelected && renderInlineDetail ? renderInlineDetail(task) : null;

                return (
                    <TaskRow
                        key={task.id}
                        task={task}
                        project={projectById.get(task.list_id) ?? null}
                        assignee={assignee}
                        timeZone={timeZone}
                        selected={isSelected}
                        bulkSelected={selectedTaskIds?.has(task.id) ?? false}
                        selectionMode={selectionMode}
                        showProject={showProject}
                        onSelect={onSelect}
                        onToggle={onToggle}
                        onSelectionToggle={onSelectionToggle}
                        inlineDetail={inlineDetail}
                    />
                );
            })}
        </div>
    );
}
