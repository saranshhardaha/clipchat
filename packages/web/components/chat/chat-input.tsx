'use client';

import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import { Send, Paperclip, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import type { FileRecord } from '@/lib/engine-client';

interface ChatInputProps {
  onSend: (text: string, fileId?: string) => Promise<void>;
  isStreaming: boolean;
  onFileUploaded?: (fileId: string) => void;
}

export function ChatInput({ onSend, isStreaming, onFileUploaded }: ChatInputProps) {
  const [text, setText] = useState('');
  const [pendingFileId, setPendingFileId] = useState<string | null>(null);
  const [pendingFileName, setPendingFileName] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Listen for "Use" clicks from the files library panel
  useEffect(() => {
    function onSelectFile(e: Event) {
      const { fileId, fileName } = (e as CustomEvent<{ fileId: string; fileName: string }>).detail;
      setPendingFileId(fileId);
      setPendingFileName(fileName);
    }
    window.addEventListener('clipchat:select-file', onSelectFile);
    return () => window.removeEventListener('clipchat:select-file', onSelectFile);
  }, []);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setIsUploading(true);
    setUploadProgress(0);

    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('file', file);

    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) {
        setUploadProgress(Math.round((ev.loaded / ev.total) * 100));
      }
    };

    xhr.onload = () => {
      setUploadProgress(null);
      setIsUploading(false);
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const record = JSON.parse(xhr.responseText) as FileRecord;
          setPendingFileId(record.id);
          setPendingFileName(file.name);
          onFileUploaded?.(record.id);
        } catch {
          setUploadError('Upload failed — invalid response');
        }
      } else {
        setUploadError('Upload failed — please try again');
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };

    xhr.onerror = () => {
      setUploadProgress(null);
      setIsUploading(false);
      setUploadError('Upload failed — please try again');
      if (fileInputRef.current) fileInputRef.current.value = '';
    };

    xhr.open('POST', '/api/files/upload');
    xhr.send(formData);
  }

  async function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;

    setText('');
    const fileId = pendingFileId ?? undefined;
    setPendingFileId(null);
    setPendingFileName(null);
    await onSend(trimmed, fileId);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="border-t border-border bg-background px-4 py-3 space-y-2">
      {/* Pending file badge */}
      {pendingFileName && (
        <div className="flex items-center gap-2 rounded-md bg-secondary px-2 py-1 text-xs w-fit">
          <Paperclip className="h-3 w-3" />
          <span className="truncate max-w-[200px]">{pendingFileName}</span>
          <button
            onClick={() => { setPendingFileId(null); setPendingFileName(null); }}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {uploadProgress !== null && (
        <div className="space-y-1">
          <Progress value={uploadProgress} className="h-1.5" />
          <p className="text-xs text-muted-foreground px-1">Uploading… {uploadProgress}%</p>
        </div>
      )}

      {uploadError && (
        <p role="alert" className="text-xs text-destructive px-1">{uploadError}</p>
      )}

      <div className="flex items-end gap-2">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*,audio/*"
          className="hidden"
          onChange={handleFileSelect}
        />

        {/* Upload button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={() => fileInputRef.current?.click()}
          disabled={isStreaming || isUploading}
          aria-label="Upload video or audio"
        >
          {isUploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Paperclip className="h-4 w-4" />
          )}
        </Button>

        {/* Text input */}
        <Textarea
          value={text}
          onChange={(e) => { setText(e.target.value); if (uploadError) setUploadError(null); }}
          onKeyDown={handleKeyDown}
          placeholder="Ask Claude to edit your video… (Cmd+Enter to send)"
          className="min-h-[40px] max-h-[120px] resize-none flex-1 py-2"
          rows={1}
          disabled={isStreaming}
        />

        {/* Send button */}
        <Button
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={handleSend}
          disabled={!text.trim() || isStreaming}
          aria-label="Send message"
        >
          {isStreaming ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
