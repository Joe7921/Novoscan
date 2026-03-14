export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

// ==================== 文件上传处理 ====================
// 支持文档（PDF/TXT/MD/DOCX）和图像（PNG/JPG/WEBP）
// 文档：服务端提取文本，作为增强上下文注入 Agent Prompt
// 图像：转为 base64 data URL，供视觉模型使用

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_TEXT_CHARS = 50000;            // 文本提取上限

/** 允许的文件类型 */
const ALLOWED_TYPES: Record<string, 'document' | 'image'> = {
  'application/pdf': 'document',
  'text/plain': 'document',
  'text/markdown': 'document',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document',
  'image/png': 'image',
  'image/jpeg': 'image',
  'image/webp': 'image',
};

/** 通过文件扩展名推断类型（浏览器 MIME 不可靠时的兜底） */
const EXT_MAP: Record<string, 'document' | 'image'> = {
  '.pdf': 'document',
  '.txt': 'document',
  '.md': 'document',
  '.docx': 'document',
  '.png': 'image',
  '.jpg': 'image',
  '.jpeg': 'image',
  '.webp': 'image',
};

/** 从 PDF Buffer 提取文本 */
async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    const pdfParse = (await import('pdf-parse')).default;
    const data = await pdfParse(buffer);
    return data.text || '';
  } catch (err: any) {
    console.warn('[Upload] PDF 解析失败:', err.message);
    return '[PDF 内容提取失败]';
  }
}

/** 从 DOCX Buffer 提取文本 */
async function extractDocxText(buffer: Buffer): Promise<string> {
  try {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    return result.value || '';
  } catch (err: any) {
    console.warn('[Upload] DOCX 解析失败:', err.message);
    return '[DOCX 内容提取失败]';
  }
}

/** 将 Buffer 转为 base64 data URL */
function bufferToBase64Url(buffer: Buffer, mimeType: string): string {
  const base64 = buffer.toString('base64');
  return `data:${mimeType};base64,${base64}`;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: '未选择文件' },
        { status: 400 }
      );
    }

    // 1. 文件大小校验
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: `文件过大，最大允许 ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    // 2. 文件类型校验（MIME + 扩展名双重检查）
    const ext = '.' + (file.name.split('.').pop()?.toLowerCase() || '');
    const fileCategory = ALLOWED_TYPES[file.type] || EXT_MAP[ext];

    if (!fileCategory) {
      return NextResponse.json(
        { success: false, error: `不支持的文件类型: ${file.type || ext}。支持: PDF, TXT, MD, DOCX, PNG, JPG, WEBP` },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type || 'application/octet-stream';

    let textContent: string | undefined;
    let base64Url: string | undefined;

    // 3. 按类型处理
    if (fileCategory === 'document') {
      // 文档处理：提取文本
      if (ext === '.pdf' || mimeType === 'application/pdf') {
        textContent = await extractPdfText(buffer);
      } else if (ext === '.docx' || mimeType.includes('wordprocessingml')) {
        textContent = await extractDocxText(buffer);
      } else {
        // TXT / MD：直接读取
        textContent = buffer.toString('utf-8');
      }

      // 截断过长文本
      if (textContent && textContent.length > MAX_TEXT_CHARS) {
        console.warn(`[Upload] 文本过长 (${textContent.length} chars)，截断至 ${MAX_TEXT_CHARS}`);
        textContent = textContent.slice(0, MAX_TEXT_CHARS) + '\n\n[... 内容已截断 ...]';
      }

      console.log(`[Upload] 文档处理完成: ${file.name}, 提取 ${textContent?.length || 0} 字符`);
    } else {
      // 图像处理：转为 base64 data URL
      base64Url = bufferToBase64Url(buffer, mimeType);

      console.log(`[Upload] 图像处理完成: ${file.name}, base64 长度 ${base64Url.length}`);
    }

    return NextResponse.json({
      success: true,
      file: {
        name: file.name,
        fileType: fileCategory,
        textContent,
        base64Url,
        charCount: textContent?.length || 0,
      },
    });
  } catch (error: any) {
    console.error('[Upload] 处理失败:', error);
    return NextResponse.json(
      { success: false, error: error.message || '文件处理失败' },
      { status: 500 }
    );
  }
}
