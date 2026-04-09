import type { TodoImageRow } from "~/lib/types";

const IMAGE_EXTENSIONS = new Set([
    "apng",
    "avif",
    "bmp",
    "gif",
    "heic",
    "heif",
    "ico",
    "jpeg",
    "jpg",
    "png",
    "svg",
    "tif",
    "tiff",
    "webp",
]);

const INVALID_FILE_NAME_CHARACTERS = /[<>:"/\\|?*\u0000-\u001F]/g;

export function sanitizeAttachmentFileName(fileName: string) {
    const sanitized = fileName
        .trim()
        .replace(INVALID_FILE_NAME_CHARACTERS, "-")
        .replace(/\s+/g, "-");

    return sanitized || "attachment";
}

export function getAttachmentDisplayName(attachment: Pick<TodoImageRow, "path" | "original_name">) {
    return attachment.original_name?.trim() ?? attachment.path.split("/").pop() ?? "attachment";
}

export function getAttachmentExtension(fileName: string) {
    const lastDotIndex = fileName.lastIndexOf(".");
    if (lastDotIndex === -1 || lastDotIndex === fileName.length - 1) {
        return "";
    }

    return fileName.slice(lastDotIndex + 1).toLowerCase();
}

export function isImageAttachment(attachment: Pick<TodoImageRow, "path" | "original_name" | "mime_type">) {
    if (attachment.mime_type) {
        return attachment.mime_type.startsWith("image/");
    }

    return IMAGE_EXTENSIONS.has(getAttachmentExtension(getAttachmentDisplayName(attachment)));
}

export function formatAttachmentSize(sizeBytes: number | string | null | undefined) {
    const normalizedBytes = typeof sizeBytes === "string" ? Number.parseInt(sizeBytes, 10) : sizeBytes;

    if (normalizedBytes == null || Number.isNaN(normalizedBytes)) {
        return null;
    }

    if (normalizedBytes < 1024) {
        return `${normalizedBytes} B`;
    }

    const units = ["KB", "MB", "GB", "TB"];
    let value = normalizedBytes / 1024;

    for (const unit of units) {
        if (value < 1024 || unit === units[units.length - 1]) {
            return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${unit}`;
        }
        value /= 1024;
    }

    return null;
}
