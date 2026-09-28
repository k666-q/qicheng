import { NextRequest, NextResponse } from "next/server";
import { rateLimitGuard, POLICIES } from "@/lib/api/rate-limit";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";

export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_TEXT_LENGTH = 4000;

function getExtension(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() || "";
}

async function parseFile(buffer: Buffer, filename: string, mimeType: string): Promise<string> {
  const ext = getExtension(filename);

  if (ext === "md" || ext === "txt" || mimeType === "text/plain" || mimeType === "text/markdown") {
    return buffer.toString("utf-8");
  }

  if (ext === "pdf" || mimeType === "application/pdf") {
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    const result = await parser.getText();
    await parser.destroy();
    return result.text;
  }

  if (ext === "docx" || mimeType.includes("wordprocessingml")) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  throw new Error(`不支持的文件格式: .${ext}`);
}

export async function POST(req: NextRequest) {
  const limited = rateLimitGuard(req, "upload-doc", POLICIES.heavy);
  if (limited) return limited;
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: "未收到文件" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ success: false, error: "文件过大，最多支持 5MB" }, { status: 400 });
    }

    const ext = getExtension(file.name);
    if (!["md", "txt", "pdf", "docx"].includes(ext)) {
      return NextResponse.json(
        { success: false, error: "支持的格式：.md .txt .pdf .docx" },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const fullText = await parseFile(buffer, file.name, file.type);
    const trimmedText = fullText.slice(0, MAX_TEXT_LENGTH);
    const wasTruncated = fullText.length > MAX_TEXT_LENGTH;

    return NextResponse.json({
      success: true,
      filename: file.name,
      textContent: trimmedText,
      charCount: fullText.length,
      wasTruncated,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "解析失败" },
      { status: 500 }
    );
  }
}
