"use client";

import { useUser } from "@clerk/nextjs";
import { useEffect, useMemo, useState } from "react";
import { useSupabaseBrowserClient } from "~/lib/supabase/browser";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { toast } from "sonner";
import { Check, KeyRound, Loader2, Upload } from "lucide-react";

import { SectionCard } from "~/components/app-primitives";
import { useData } from "~/components/data-provider";
import { getPublicAvatarUrl, isAvatarPathOwnedByUser, PROFILE_AVATAR_BUCKET } from "~/lib/avatar";
import { getPlannerPreferences } from "~/lib/planning";
import { getBrowserTimeZone, isValidTimeZone } from "~/lib/task-deadlines";

interface ProfileUpdatePayload {
    id: string;
    username: string;
    full_name: string | null;
}

interface AvatarUpdatePayload {
    id: string;
    avatar_url: string;
}

interface StudyGoalUpdatePayload {
    id: string;
    daily_focus_goal_minutes: number;
    timezone: string;
    default_block_minutes: number;
    week_starts_on: number;
    planner_day_start_hour: number;
    planner_day_end_hour: number;
}

interface UsernameLookupRow {
    id: string;
}

const MAX_AVATAR_BYTES = 3 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const USERNAME_PATTERN = /^[a-z0-9_]+$/;
const BLOCK_DURATION_OPTIONS = [15, 30, 45, 60, 90, 120];
const WEEK_START_OPTIONS = [
    { label: "Monday", value: "1" },
    { label: "Sunday", value: "0" },
] as const;
const PLANNER_DAY_START_OPTIONS = Array.from({ length: 24 }, (_, index) => String(index));
const PLANNER_DAY_END_OPTIONS = Array.from({ length: 24 }, (_, index) => String(index + 1));

function normalizeUsername(value: string) {
    return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function splitDisplayName(value: string) {
    const parts = value.trim().split(/\s+/).filter(Boolean);

    if (parts.length === 0) {
        return { firstName: null, lastName: null };
    }

    const [firstName, ...rest] = parts;
    return {
        firstName: firstName ?? null,
        lastName: rest.length > 0 ? rest.join(" ") : null,
    };
}

function getClerkErrorMessage(error: unknown) {
    if (!error || typeof error !== "object") {
        return "Unknown Error";
    }

    const errorList = "errors" in error ? error.errors : null;
    if (Array.isArray(errorList)) {
        const firstError: unknown = errorList[0];
        if (firstError && typeof firstError === "object") {
            const longMessage = "longMessage" in firstError ? firstError.longMessage : null;
            if (typeof longMessage === "string") return longMessage;

            const message = "message" in firstError ? firstError.message : null;
            if (typeof message === "string") return message;
        }
    }

    return error instanceof Error ? error.message : "Unknown Error";
}

function isAdditionalVerificationError(error: unknown) {
    const message = getClerkErrorMessage(error).toLowerCase();
    if (message.includes("additional verification") || message.includes("reverification")) {
        return true;
    }

    if (!error || typeof error !== "object" || !("errors" in error) || !Array.isArray(error.errors)) {
        return false;
    }

    return error.errors.some((clerkError: unknown) => {
        if (!clerkError || typeof clerkError !== "object") return false;

        const code = "code" in clerkError ? clerkError.code : null;
        if (typeof code === "string" && (code.includes("verification") || code.includes("reauth"))) {
            return true;
        }

        const message = "message" in clerkError ? clerkError.message : null;
        return typeof message === "string" && message.toLowerCase().includes("additional verification");
    });
}

function inferAvatarExtension(file: File) {
    if (file.type === "image/png") return "png";
    if (file.type === "image/webp") return "webp";
    if (file.type === "image/jpeg") return "jpg";

    const extension = file.name.split(".").pop()?.toLowerCase();
    if (extension === "jpeg") return "jpg";
    if (extension === "png" || extension === "webp" || extension === "jpg") return extension;
    return "jpg";
}

function formatHourOptionLabel(hour: number) {
    if (hour === 24) return "12:00 AM next day";

    const normalizedHour = ((hour % 24) + 24) % 24;
    const meridiem = normalizedHour >= 12 ? "PM" : "AM";
    const twelveHour = normalizedHour % 12 || 12;
    return `${twelveHour}:00 ${meridiem}`;
}

function getPasswordValidationError(currentPassword: string, newPassword: string, confirmPassword: string) {
    if (!currentPassword || !newPassword || !confirmPassword) {
        return "All password fields are required.";
    }
    if (newPassword !== confirmPassword) {
        return "New password and confirmation do not match.";
    }
    if (newPassword === currentPassword) {
        return "New password must be different from your current password.";
    }
    if (newPassword.length < 8) {
        return "New password must be at least 8 characters.";
    }
    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/\d/.test(newPassword)) {
        return "New password must include uppercase, lowercase, and a number.";
    }
    return null;
}

export function ProfileForm({ userId }: { userId: string }) {
    const { profile, loading, refreshData } = useData();
    const { user: clerkUser } = useUser();
    const supabase = useSupabaseBrowserClient();

    const [profileSaving, setProfileSaving] = useState(false);
    const [studyGoalSaving, setStudyGoalSaving] = useState(false);
    const [avatarUploading, setAvatarUploading] = useState(false);
    const [passwordSaving, setPasswordSaving] = useState(false);

    const [username, setUsername] = useState("");
    const [fullName, setFullName] = useState("");
    const [avatarPath, setAvatarPath] = useState<string | null>(null);
    const [dailyGoal, setDailyGoal] = useState("120");
    const [timeZone, setTimeZone] = useState(getBrowserTimeZone());
    const [defaultBlockMinutes, setDefaultBlockMinutes] = useState("60");
    const [weekStartsOn, setWeekStartsOn] = useState("1");
    const [plannerDayStartHour, setPlannerDayStartHour] = useState("7");
    const [plannerDayEndHour, setPlannerDayEndHour] = useState("22");

    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    useEffect(() => {
        setUsername(profile?.username ?? "");
        setFullName(profile?.full_name ?? "");
        setAvatarPath(profile?.avatar_url ?? null);
        setDailyGoal(String(profile?.daily_focus_goal_minutes ?? 120));
        setTimeZone(profile?.timezone ?? getBrowserTimeZone());
        const plannerPreferences = getPlannerPreferences(profile);
        setDefaultBlockMinutes(String(plannerPreferences.defaultBlockMinutes));
        setWeekStartsOn(String(plannerPreferences.weekStartsOn));
        setPlannerDayStartHour(String(plannerPreferences.dayStartHour));
        setPlannerDayEndHour(String(plannerPreferences.dayEndHour));
    }, [profile]);

    useEffect(() => {
        const startHour = Number.parseInt(plannerDayStartHour, 10);
        const endHour = Number.parseInt(plannerDayEndHour, 10);

        if (!Number.isFinite(startHour) || !Number.isFinite(endHour)) return;
        if (endHour > startHour) return;

        setPlannerDayEndHour(String(Math.min(startHour + 1, 24)));
    }, [plannerDayEndHour, plannerDayStartHour]);

    useEffect(() => {
        const startHour = Number.parseInt(plannerDayStartHour, 10);
        const endHour = Number.parseInt(plannerDayEndHour, 10);
        const currentDefaultBlockMinutes = Number.parseInt(defaultBlockMinutes, 10);

        if (!Number.isFinite(startHour) || !Number.isFinite(endHour) || !Number.isFinite(currentDefaultBlockMinutes)) return;

        const plannerDayMinutes = (endHour - startHour) * 60;
        if (currentDefaultBlockMinutes <= plannerDayMinutes) return;

        const nextDefaultBlockMinutes = BLOCK_DURATION_OPTIONS
            .filter((minutes) => minutes <= plannerDayMinutes)
            .at(-1);

        if (!nextDefaultBlockMinutes) return;
        setDefaultBlockMinutes(String(nextDefaultBlockMinutes));
    }, [defaultBlockMinutes, plannerDayEndHour, plannerDayStartHour]);

    const avatarPreviewUrl = useMemo(
        () => getPublicAvatarUrl(supabase, avatarPath),
        [supabase, avatarPath],
    );

    const avatarFallbackText = useMemo(() => {
        const source = fullName.trim() || username.trim();
        if (!source) return "U";

        const initials = source
            .split(/\s+/)
            .filter(Boolean)
            .map((part) => part[0] ?? "")
            .join("")
            .slice(0, 2)
            .toUpperCase();

        return initials || "U";
    }, [fullName, username]);

    async function updateProfile(e: React.FormEvent) {
        e.preventDefault();

        const normalizedUsername = normalizeUsername(username);

        if (normalizedUsername.length < 3) {
            toast.error("Username must be at least 3 characters");
            return;
        }
        if (!USERNAME_PATTERN.test(normalizedUsername)) {
            toast.error("Username can only contain letters, numbers, and underscores.");
            return;
        }
        if (!clerkUser) {
            toast.error("Unable to verify account. Please refresh and try again.");
            return;
        }

        try {
            setProfileSaving(true);
            const normalizedFullName = fullName.trim();

            const { data: usernameMatch, error: usernameLookupError } = await supabase
                .from("profiles")
                .select("id")
                .eq("username", normalizedUsername)
                .neq("id", userId)
                .maybeSingle();

            if (usernameLookupError) {
                throw usernameLookupError;
            }

            if ((usernameMatch as UsernameLookupRow | null)?.id) {
                toast.error("Username is already taken!");
                return;
            }

            const { firstName, lastName } = splitDisplayName(normalizedFullName);

            const profileUpdate: ProfileUpdatePayload = {
                id: userId,
                username: normalizedUsername,
                full_name: normalizedFullName ? normalizedFullName : null,
            };

            let clerkUpdateNeedsVerification = false;
            try {
                await clerkUser.update({
                    username: normalizedUsername,
                    firstName,
                    lastName,
                });
            } catch (error: unknown) {
                if (!isAdditionalVerificationError(error)) {
                    throw error;
                }

                clerkUpdateNeedsVerification = true;
            }

            const { error } = await supabase.from("profiles").upsert(profileUpdate, { onConflict: "id" });
            if (error) {
                console.error("Supabase UPSERT Error:", {
                    code: error.code,
                    message: error.message,
                    details: error.details,
                    hint: error.hint,
                });

                if (error.code === "23505") {
                    toast.error("Username is already taken!");
                } else {
                    throw error;
                }
            } else {
                toast.success(
                    clerkUpdateNeedsVerification
                        ? "Profile saved in Stride. Clerk needs additional verification before updating account details."
                        : "Profile updated successfully!",
                );
                void refreshData();
            }
        } catch (error: unknown) {
            const message = getClerkErrorMessage(error);
            toast.error(`Update Error: ${message}`);
        } finally {
            setProfileSaving(false);
        }
    }

    async function uploadAvatar(file: File) {
        try {
            setAvatarUploading(true);

            const previousAvatarPath = avatarPath;
            const extension = inferAvatarExtension(file);
            const objectPath = `${userId}/${crypto.randomUUID()}.${extension}`;

            const { error: uploadError } = await supabase.storage
                .from(PROFILE_AVATAR_BUCKET)
                .upload(objectPath, file, {
                    upsert: false,
                    contentType: file.type,
                    cacheControl: "3600",
                });

            if (uploadError) {
                throw uploadError;
            }

            const avatarUpdatePayload: AvatarUpdatePayload = {
                id: userId,
                avatar_url: objectPath,
            };

            const { error: profileUpdateError } = await supabase
                .from("profiles")
                .upsert(avatarUpdatePayload, { onConflict: "id" });

            if (profileUpdateError) {
                await supabase.storage.from(PROFILE_AVATAR_BUCKET).remove([objectPath]);
                throw profileUpdateError;
            }

            setAvatarPath(objectPath);
            toast.success("Profile picture updated!");
            void refreshData();

            if (
                previousAvatarPath
                && previousAvatarPath !== objectPath
                && isAvatarPathOwnedByUser(previousAvatarPath, userId)
            ) {
                const { error: cleanupError } = await supabase.storage
                    .from(PROFILE_AVATAR_BUCKET)
                    .remove([previousAvatarPath]);

                if (cleanupError) {
                    console.warn("Could not clean up previous avatar object:", cleanupError.message);
                }
            }
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Unknown avatar upload error";
            console.error("Avatar upload failed:", { message, userId });
            toast.error(`Avatar upload failed: ${message}`);
        } finally {
            setAvatarUploading(false);
        }
    }

    async function updateStudyGoal(e: React.FormEvent) {
        e.preventDefault();

        const nextGoal = Number.parseInt(dailyGoal, 10);
        const normalizedTimeZone = timeZone.trim();
        const nextDefaultBlockMinutes = Number.parseInt(defaultBlockMinutes, 10);
        const nextWeekStartsOn = Number.parseInt(weekStartsOn, 10);
        const nextPlannerDayStartHour = Number.parseInt(plannerDayStartHour, 10);
        const nextPlannerDayEndHour = Number.parseInt(plannerDayEndHour, 10);
        if (!Number.isFinite(nextGoal) || nextGoal <= 0) {
            toast.error("Daily study goal must be a positive number of minutes.");
            return;
        }
        if (!isValidTimeZone(normalizedTimeZone)) {
            toast.error("Use a valid IANA timezone like Asia/Singapore.");
            return;
        }
        if (!Number.isFinite(nextDefaultBlockMinutes) || nextDefaultBlockMinutes < 15) {
            toast.error("Choose a valid default block length.");
            return;
        }
        if (nextWeekStartsOn !== 0 && nextWeekStartsOn !== 1) {
            toast.error("Choose whether your week starts on Sunday or Monday.");
            return;
        }
        if (!Number.isFinite(nextPlannerDayStartHour) || !Number.isFinite(nextPlannerDayEndHour)) {
            toast.error("Choose valid planner hours.");
            return;
        }
        if (nextPlannerDayEndHour <= nextPlannerDayStartHour) {
            toast.error("Planner day end must be after the start hour.");
            return;
        }

        const plannerPreferences = getPlannerPreferences({
            default_block_minutes: nextDefaultBlockMinutes,
            week_starts_on: nextWeekStartsOn,
            planner_day_start_hour: nextPlannerDayStartHour,
            planner_day_end_hour: nextPlannerDayEndHour,
        });

        try {
            setStudyGoalSaving(true);

            const studyGoalPayload: StudyGoalUpdatePayload = {
                id: userId,
                daily_focus_goal_minutes: nextGoal,
                timezone: normalizedTimeZone,
                default_block_minutes: plannerPreferences.defaultBlockMinutes,
                week_starts_on: plannerPreferences.weekStartsOn,
                planner_day_start_hour: plannerPreferences.dayStartHour,
                planner_day_end_hour: plannerPreferences.dayEndHour,
            };

            const { error } = await supabase.from("profiles").upsert(studyGoalPayload, { onConflict: "id" });
            if (error) {
                throw error;
            }

            toast.success("Planner preferences updated.");
            void refreshData();
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Unknown study goal update error";
            console.error("Study goal update failed:", { message, userId });
            toast.error(`Study goal update failed: ${message}`);
        } finally {
            setStudyGoalSaving(false);
        }
    }

    async function handleAvatarFileChange(event: React.ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        event.target.value = "";

        if (!file) return;

        if (!ALLOWED_AVATAR_TYPES.has(file.type)) {
            toast.error("Only JPG, PNG, and WEBP images are allowed.");
            return;
        }

        if (file.size > MAX_AVATAR_BYTES) {
            toast.error("Image must be 3MB or smaller.");
            return;
        }

        await uploadAvatar(file);
    }

    async function updatePassword(e: React.FormEvent) {
        e.preventDefault();

        const passwordValidationError = getPasswordValidationError(currentPassword, newPassword, confirmPassword);
        if (passwordValidationError) {
            toast.error(passwordValidationError);
            return;
        }

        if (!clerkUser) {
            toast.error("Unable to verify account. Please refresh and try again.");
            return;
        }

        try {
            setPasswordSaving(true);

            await clerkUser.updatePassword({
                currentPassword,
                newPassword,
            });

            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
            toast.success("Password changed successfully.");
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Unknown password update error";
            console.error("Password update failed:", { message, userId });
            toast.error(`Password update failed: ${message}`);
        } finally {
            setPasswordSaving(false);
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <SectionCard title="Account" dense>
                <form onSubmit={updateProfile} className="space-y-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <Avatar className="h-14 w-14 shrink-0 border border-border/70">
                            <AvatarImage src={avatarPreviewUrl ?? ""} alt="Profile picture preview" />
                            <AvatarFallback className="bg-primary/10 text-primary text-base font-semibold">
                                {avatarFallbackText}
                            </AvatarFallback>
                        </Avatar>
                        <div className="space-y-2">
                            <p className="text-xs leading-5 text-muted-foreground">JPG, PNG, or WEBP, up to 3 MB.</p>
                            <Button type="button" variant="outline" size="sm" disabled={avatarUploading} asChild>
                                <label className={avatarUploading ? "cursor-not-allowed" : "cursor-pointer"}>
                                    {avatarUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                                    {avatarUploading ? "Uploading..." : "Upload picture"}
                                    <input
                                        type="file"
                                        accept="image/jpeg,image/png,image/webp"
                                        className="hidden"
                                        disabled={avatarUploading}
                                        onChange={(event) => {
                                            void handleAvatarFileChange(event);
                                        }}
                                    />
                                </label>
                            </Button>
                        </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="username" className="text-sm font-medium text-foreground">
                                Username
                            </Label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">@</span>
                                <Input
                                    id="username"
                                    placeholder="your_handle"
                                    value={username}
                                    onChange={(event) => setUsername(event.target.value)}
                                    className="h-9 rounded-xl border-border/60 bg-background/70 pl-8"
                                    required
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="fullName" className="text-sm font-medium text-foreground">
                                Full name
                            </Label>
                            <Input
                                id="fullName"
                                placeholder="Display name"
                                value={fullName}
                                onChange={(event) => setFullName(event.target.value)}
                                className="h-9 rounded-xl border-border/60 bg-background/70"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end">
                        <Button type="submit" disabled={profileSaving} size="sm" className="gap-2 rounded-xl px-4">
                            {profileSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                            {profileSaving ? "Saving..." : "Save profile"}
                        </Button>
                    </div>
                </form>
            </SectionCard>

            <SectionCard title="Planner defaults" dense>
                <form onSubmit={updateStudyGoal} className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="dailyGoal" className="text-sm font-medium text-foreground">
                                Daily focus goal
                            </Label>
                            <div className="relative">
                                <Input
                                    id="dailyGoal"
                                    type="number"
                                    min="1"
                                    step="1"
                                    inputMode="numeric"
                                    value={dailyGoal}
                                    onChange={(event) => setDailyGoal(event.target.value)}
                                    className="h-9 rounded-xl border-border/60 bg-background/70 pr-20"
                                    required
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">
                                    minutes
                                </span>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="defaultBlockMinutes" className="text-sm font-medium text-foreground">
                                Default block length
                            </Label>
                            <Select value={defaultBlockMinutes} onValueChange={setDefaultBlockMinutes}>
                                <SelectTrigger id="defaultBlockMinutes" className="h-9 rounded-xl border-border/60 bg-background/70 font-medium">
                                    <SelectValue placeholder="Block length" />
                                </SelectTrigger>
                                <SelectContent>
                                    {BLOCK_DURATION_OPTIONS
                                        .filter((minutes) => minutes <= (Number.parseInt(plannerDayEndHour, 10) - Number.parseInt(plannerDayStartHour, 10)) * 60)
                                        .map((minutes) => (
                                            <SelectItem key={minutes} value={String(minutes)}>
                                                {minutes} minutes
                                            </SelectItem>
                                        ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="plannerTimeZone" className="text-sm font-medium text-foreground">
                            Timezone
                        </Label>
                        <Input
                            id="plannerTimeZone"
                            value={timeZone}
                            onChange={(event) => setTimeZone(event.target.value)}
                            placeholder="Asia/Singapore"
                            className="h-9 rounded-xl border-border/60 bg-background/70"
                            required
                        />
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="weekStartsOn" className="text-sm font-medium text-foreground">
                                Week starts
                            </Label>
                            <Select value={weekStartsOn} onValueChange={setWeekStartsOn}>
                                <SelectTrigger id="weekStartsOn" className="h-9 rounded-xl border-border/60 bg-background/70 font-medium">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {WEEK_START_OPTIONS.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="plannerDayStartHour" className="text-sm font-medium text-foreground">
                                Day starts
                            </Label>
                            <Select value={plannerDayStartHour} onValueChange={setPlannerDayStartHour}>
                                <SelectTrigger id="plannerDayStartHour" className="h-9 rounded-xl border-border/60 bg-background/70 font-medium">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {PLANNER_DAY_START_OPTIONS.map((value) => (
                                        <SelectItem key={value} value={value}>
                                            {formatHourOptionLabel(Number.parseInt(value, 10))}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="plannerDayEndHour" className="text-sm font-medium text-foreground">
                                Day ends
                            </Label>
                            <Select value={plannerDayEndHour} onValueChange={setPlannerDayEndHour}>
                                <SelectTrigger id="plannerDayEndHour" className="h-9 rounded-xl border-border/60 bg-background/70 font-medium">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {PLANNER_DAY_END_OPTIONS
                                        .filter((value) => Number.parseInt(value, 10) > Number.parseInt(plannerDayStartHour, 10))
                                        .map((value) => (
                                            <SelectItem key={value} value={value}>
                                                {formatHourOptionLabel(Number.parseInt(value, 10))}
                                            </SelectItem>
                                        ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="flex justify-end">
                        <Button type="submit" disabled={studyGoalSaving} size="sm" className="gap-2 rounded-xl px-4">
                            {studyGoalSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                            {studyGoalSaving ? "Saving..." : "Save planner"}
                        </Button>
                    </div>
                </form>
            </SectionCard>

            <SectionCard title="Security" dense>
                <form onSubmit={updatePassword} className="space-y-4">
                    <div className="grid max-w-md gap-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="currentPassword" className="text-sm font-medium text-foreground">
                                Current password
                            </Label>
                            <Input
                                id="currentPassword"
                                type="password"
                                value={currentPassword}
                                onChange={(event) => setCurrentPassword(event.target.value)}
                                className="h-9 rounded-xl border-border/60 bg-background/70"
                                autoComplete="current-password"
                                required
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="newPassword" className="text-sm font-medium text-foreground">
                                New password
                            </Label>
                            <Input
                                id="newPassword"
                                type="password"
                                value={newPassword}
                                onChange={(event) => setNewPassword(event.target.value)}
                                className="h-9 rounded-xl border-border/60 bg-background/70"
                                autoComplete="new-password"
                                required
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="confirmPassword" className="text-sm font-medium text-foreground">
                                Confirm new password
                            </Label>
                            <Input
                                id="confirmPassword"
                                type="password"
                                value={confirmPassword}
                                onChange={(event) => setConfirmPassword(event.target.value)}
                                className="h-9 rounded-xl border-border/60 bg-background/70"
                                autoComplete="new-password"
                                required
                            />
                        </div>
                        <p className="text-sm leading-6 text-muted-foreground">
                            Minimum 8 characters with uppercase, lowercase, and a number.
                        </p>
                    </div>

                    <div className="flex justify-end">
                        <Button type="submit" disabled={passwordSaving} size="sm" className="gap-2 rounded-xl px-4">
                            {passwordSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                            {passwordSaving ? "Updating..." : "Change password"}
                        </Button>
                    </div>
                </form>
            </SectionCard>
        </div>
    );
}
