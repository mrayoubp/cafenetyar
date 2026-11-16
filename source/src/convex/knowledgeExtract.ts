"use node";

import { v } from "convex/values";
import mammoth from "mammoth";
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";
import { fail } from "./lib/validation";

function extensionOf(fileName: string) {
  const index = fileName.lastIndexOf(".");
  return index >= 0 ? fileName.slice(index + 1).toLowerCase() : "";
}

/**
 * Extracts text from an uploaded guide so it can enter the RAG index.
 * Binary files stay private; only the extracted text is returned to the admin.
 */
export const extractTextFromFile = action({
  args: {
    fileId: v.id("_storage"),
    fileName: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.runQuery(internal.knowledgeAdmin.assertAdmin, {});
    const blob = await ctx.storage.get(args.fileId);
    if (!blob) fail("not_found", "فایل آپلودشده پیدا نشد.");
    if (blob.size > 8 * 1024 * 1024) {
      fail("validation", "حجم فایل راهنما نباید بیشتر از ۸ مگابایت باشد.");
    }
    const buffer = Buffer.from(await blob.arrayBuffer());
    const extension = extensionOf(args.fileName);
    let text = "";
    if (extension === "pdf") {
      try {
        const result = await pdfParse(buffer);
        text = result.text;
      } catch {
        fail(
          "validation",
          "متن این PDF قابل استخراج نیست. اگر فایل اسکن‌شده است، متن راهنما را دستی وارد کنید.",
        );
      }
    } else if (extension === "docx") {
      try {
        const result = await mammoth.extractRawText({ buffer });
        text = result.value;
      } catch {
        fail(
          "validation",
          "متن این فایل Word قابل استخراج نیست. فایل را با فرمت docx ذخیره کنید یا متن را دستی وارد کنید.",
        );
      }
    } else if (["txt", "md", "csv"].includes(extension)) {
      text = buffer.toString("utf8");
    } else if (extension === "doc" || extension === "rtf") {
      fail(
        "validation",
        "فرمت قدیمی Word پشتیبانی نمی‌شود؛ فایل را با فرمت docx یا PDF آپلود کنید.",
      );
    } else {
      fail(
        "validation",
        "استخراج خودکار فقط برای PDF، docx و فایل متنی پشتیبانی می‌شود.",
      );
    }
    const clean = text.split("\u0000").join("").trim();
    if (clean.length < 20) {
      fail(
        "validation",
        "متنی از فایل استخراج نشد. احتمالاً فایل تصویری یا اسکن‌شده است؛ متن را دستی وارد کنید.",
      );
    }
    return {
      text: clean.slice(0, 40000),
      truncated: clean.length > 40000,
    };
  },
});
