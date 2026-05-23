import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
    buildDayOverviewPrompt,
    DAY_OVERVIEW_LABEL_LIMIT,
    DAY_OVERVIEW_MAX_REQUEST_CHARS,
    DAY_OVERVIEW_PLANNED_BLOCK_LIMIT,
    DAY_OVERVIEW_TASK_LIMIT,
    sanitizeDayOverviewSummary,
} from "~/lib/day-overview";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const dayOverviewTaskSchema = z.object({
    title: z.string().min(1).max(140),
    timing: z.enum(["overdue", "due_today"]),
    description: z.string().max(320).nullable().optional(),
    projectName: z.string().max(90).nullable().optional(),
    priority: z.enum(["high", "medium", "low"]).nullable().optional(),
    dueLabel: z.string().max(60).nullable().optional(),
    labels: z.array(z.string().min(1).max(36)).max(DAY_OVERVIEW_LABEL_LIMIT).optional(),
    estimatedMinutes: z.number().int().min(0).max(24 * 60).nullable().optional(),
    plannedMinutes: z.number().int().min(0).max(24 * 60).optional(),
    remainingEstimatedMinutes: z.number().int().min(0).max(24 * 60).nullable().optional(),
    planningStatus: z.enum(["unplanned", "partially_planned", "fully_planned", "overplanned"]).optional(),
}).strict();

const dayOverviewPlannedBlockSchema = z.object({
    title: z.string().min(1).max(120),
    projectName: z.string().max(90).nullable().optional(),
    taskTitle: z.string().max(140).nullable().optional(),
    timeRange: z.string().min(1).max(80),
    durationMinutes: z.number().int().min(0).max(24 * 60),
}).strict();

const dayOverviewPayloadSchema = z.object({
    todayDate: z.string().min(1).max(20),
    timezone: z.string().max(64).nullable().optional(),
    counts: z.object({
        overdue: z.number().int().min(0).max(999),
        dueToday: z.number().int().min(0).max(999),
        totalVisible: z.number().int().min(0).max(999),
    }).strict(),
    focus: z.object({
        todayMinutes: z.number().int().min(0).max(24 * 60),
        dailyGoalMinutes: z.number().int().min(0).max(24 * 60),
        streak: z.number().int().min(0).max(3650),
        averageSession: z.string().max(32).nullable().optional(),
    }).strict(),
    tasks: z.array(dayOverviewTaskSchema).max(DAY_OVERVIEW_TASK_LIMIT),
    plannedBlocks: z.array(dayOverviewPlannedBlockSchema).max(DAY_OVERVIEW_PLANNED_BLOCK_LIMIT),
}).strict();

interface OpenAIResponsesApiResponse {
    output_text?: string;
    output?: Array<{
        content?: Array<{
            text?: string;
            type?: string;
        }>;
    }>;
    error?: {
        code?: string;
        message?: string;
        type?: string;
    };
}

const DEFAULT_DAY_OVERVIEW_MODEL = "gpt-5.5";

function getDayOverviewModel() {
    const model = process.env.OPENAI_DAY_OVERVIEW_MODEL?.trim();
    if (model === "" || model == null) return DEFAULT_DAY_OVERVIEW_MODEL;
    return model;
}

function getOpenAIResponseText(response: OpenAIResponsesApiResponse) {
    if (typeof response.output_text === "string" && response.output_text.trim()) {
        return response.output_text.trim();
    }

    return response.output
        ?.flatMap((item) => item.content
            ?.flatMap((content) => typeof content.text === "string" ? [content.text] : []) ?? [])
        .join("\n")
        .trim() ?? "";
}

function getOpenAIErrorMessage(response: OpenAIResponsesApiResponse, fallbackText: string) {
    return response.error?.message
        ?? response.error?.code
        ?? fallbackText.slice(0, 300);
}

interface OpenAIRequestBody {
    input: Array<{
        content: string;
        role: "developer" | "user";
    }>;
    max_output_tokens: number;
    model: string;
    reasoning: {
        effort: "low";
    };
    text: {
        verbosity: "low";
    };
}

function buildOpenAIRequestBody(prompt: string): OpenAIRequestBody {
    return {
        model: getDayOverviewModel(),
        input: [
            {
                role: "developer",
                content: "Generate a concise daily planning overview for the authenticated user. Use only the provided app data and avoid generic motivation.",
            },
            {
                role: "user",
                content: prompt,
            },
        ],
        max_output_tokens: 240,
        reasoning: {
            effort: "low",
        },
        text: {
            verbosity: "low",
        },
    };
}

function noStoreJson(body: { error: string } | { summary: string }, init?: ResponseInit) {
    const headers = new Headers(init?.headers);
    headers.set("Cache-Control", "no-store");

    return NextResponse.json(body, {
        ...init,
        headers,
    });
}

async function parseRequestJson(request: Request) {
    const rawBody = await request.text();

    if (rawBody.length > DAY_OVERVIEW_MAX_REQUEST_CHARS) {
        return { ok: false as const, error: "Day overview payload is too large.", status: 413 };
    }

    try {
        return { ok: true as const, data: JSON.parse(rawBody) as unknown };
    } catch {
        return { ok: false as const, error: "Invalid JSON payload.", status: 400 };
    }
}

export async function POST(request: Request) {
    const { userId } = await auth();

    if (!userId) {
        return noStoreJson({ error: "Unauthorized." }, { status: 401 });
    }

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
        return noStoreJson({ error: "AI overview is not configured yet." }, { status: 503 });
    }

    const parsedJson = await parseRequestJson(request);
    if (!parsedJson.ok) {
        return noStoreJson({ error: parsedJson.error }, { status: parsedJson.status });
    }

    const parsedPayload = dayOverviewPayloadSchema.safeParse(parsedJson.data);
    if (!parsedPayload.success) {
        return noStoreJson({ error: "Invalid day overview payload." }, { status: 400 });
    }

    try {
        const openAIResponse = await fetch("https://api.openai.com/v1/responses", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(buildOpenAIRequestBody(buildDayOverviewPrompt(parsedPayload.data))),
        });

        const responseText = await openAIResponse.text();
        let responseJson: OpenAIResponsesApiResponse = {};

        try {
            responseJson = JSON.parse(responseText) as OpenAIResponsesApiResponse;
        } catch {
            responseJson = {};
        }

        if (!openAIResponse.ok) {
            console.error("OpenAI day overview request failed.", {
                status: openAIResponse.status,
                message: getOpenAIErrorMessage(responseJson, responseText),
            });
            return noStoreJson({ error: "Unable to generate the day overview right now." }, { status: 502 });
        }

        const summary = sanitizeDayOverviewSummary(getOpenAIResponseText(responseJson));
        if (!summary) {
            return noStoreJson({ error: "OpenAI returned an empty day overview." }, { status: 502 });
        }

        return noStoreJson({ summary });
    } catch (error) {
        console.error("OpenAI day overview request errored.", error);
        return noStoreJson({ error: "Unable to generate the day overview right now." }, { status: 502 });
    }
}
