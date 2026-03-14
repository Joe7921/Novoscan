'use client';

import React, { useRef, useState, useCallback } from 'react';
import { Paperclip, X, FileText, Image, Loader2, AlertCircle } from 'lucide-react';
import type { AttachedFile } from '@/types';

// ==================== 文件附件组件 ====================
// 搜索框区域的文件上传入口：回形针按钮 + 文件预览标签
// 支持点击上传和拖拽上传

interface FileAttachmentProps {
  attachments: AttachedFile[];
  onAttachmentsChange: (files: AttachedFile[]) => void;
  maxFiles?: number;
  language?: 'zh' | 'en';
}

/** 允许的文件扩展名 */
const ACCEPTED_EXTENSIONS = '.pdf,.txt,.md,.docx,.png,.jpg,.jpeg,.webp';

/** 文件大小上限 */
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const FileAttachment: React.FC<FileAttachmentProps> = ({
  attachments,
  onAttachmentsChange,
  maxFiles = 3,
  language = 'zh',
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const isZh = language === 'zh';

  /** 处理文件上传 */
  const handleUpload = useCallback(async (files: FileList | File[]) => {
    setError(null);

    const fileArray = Array.from(files);
    if (attachments.length + fileArray.length > maxFiles) {
      setError(isZh ? `最多上传 ${maxFiles} 个文件` : `Max ${maxFiles} files allowed`);
      return;
    }

    setIsUploading(true);

    try {
      const results: AttachedFile[] = [];

      for (const file of fileArray) {
        // 前端文件大小校验
        if (file.size > MAX_FILE_SIZE) {
          setError(isZh ? `${file.name} 过大（最大 10MB）` : `${file.name} is too large (max 10MB)`);
          continue;
        }

        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();
        if (!data.success) {
          setError(data.error || (isZh ? '上传失败' : 'Upload failed'));
          continue;
        }

        results.push(data.file as AttachedFile);
      }

      if (results.length > 0) {
        onAttachmentsChange([...attachments, ...results]);
      }
    } catch (err: unknown) {
      setError((err instanceof Error ? err.message : String(err)) || (isZh ? '上传失败' : 'Upload failed'));
    } finally {
      setIsUploading(false);
      // 重置 input 以允许重复上传同一文件
      if (inputRef.current) inputRef.current.value = '';
    }
  }, [attachments, onAttachmentsChange, maxFiles, isZh]);

  /** 删除附件 */
  const handleRemove = useCallback((index: number) => {
    onAttachmentsChange(attachments.filter((_, i) => i !== index));
  }, [attachments, onAttachmentsChange]);

  /** 拖拽处理 */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleUpload(e.dataTransfer.files);
    }
  }, [handleUpload]);

  return (
    <div className="flex flex-col gap-1.5">
      {/* 附件按钮行 */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* 回形针上传按钮 */}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isUploading || attachments.length >= maxFiles}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full
            transition-all duration-200 cursor-pointer
            ${isDragOver
              ? 'bg-blue-100 dark:bg-blue-500/20 border-blue-400 dark:border-blue-500 text-blue-600 dark:text-blue-400 border-dashed border-2'
              : 'text-gray-500 dark:text-slate-400 bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-dark-elevated hover:text-gray-700 dark:hover:text-slate-200'
            }
            ${isUploading ? 'opacity-60 cursor-wait' : ''}
            ${attachments.length >= maxFiles ? 'opacity-40 cursor-not-allowed' : ''}
          `}
          title={isZh ? '上传文档或图像' : 'Upload document or image'}
        >
          {isUploading
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <Paperclip className="w-3.5 h-3.5" />
          }
          <span>{isZh ? '附件' : 'Attach'}</span>
        </button>

        {/* 已附加文件标签 */}
        {attachments.map((file, index) => (
          <div
            key={`${file.name}-${index}`}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full
              bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300
              border border-blue-200/60 dark:border-blue-500/20
              animate-fade-in"
          >
            {file.fileType === 'document'
              ? <FileText className="w-3 h-3 flex-shrink-0" />
              : <Image className="w-3 h-3 flex-shrink-0" />
            }
            <span className="max-w-[120px] truncate">{file.name}</span>
            {file.fileType === 'document' && file.charCount > 0 && (
              <span className="text-blue-400 dark:text-blue-400/60 text-[10px]">
                {file.charCount > 1000 ? `${(file.charCount / 1000).toFixed(1)}k` : file.charCount}字
              </span>
            )}
            <button
              type="button"
              onClick={() => handleRemove(index)}
              className="ml-0.5 p-0.5 rounded-full hover:bg-blue-200 dark:hover:bg-blue-500/20 transition-colors"
              title={isZh ? '移除' : 'Remove'}
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}

        {/* 隐藏的 file input */}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS}
          multiple
          onChange={(e) => e.target.files && handleUpload(e.target.files)}
          className="hidden"
        />
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="flex items-center gap-1.5 text-xs text-red-500 dark:text-red-400 animate-fade-in">
          <AlertCircle className="w-3 h-3 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

export default React.memo(FileAttachment);
