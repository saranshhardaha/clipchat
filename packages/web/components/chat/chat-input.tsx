'use client';

import { useState, useRef, type KeyboardEvent } from 'react';
import { Send, Paperclip, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { uploadFile } from '@/lib/engine-client';

interface ChatInputProps {
  onSend: (text: string, fileId?: string) => Promise<void>;
  isStreaming: boolean;
}

export function ChatInput({ onSend, isStreaming }: ChatInputProps) {
  const [text, setText] = useState('');
  const [pendingFileId, setPendingFileId] = useState<string | null>(null);
  const [pendingFileName, setPendingFileName] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const record = await uploadFile(formData);
      setPendingFileId(record.id);
      setPendingFileName(file.name);
    } catch (err) {
      console.error('Upload failed:', err);
      setUploadError('Upload failed — please try again');
    } finally {
      setIsUploading(false);
      // Reset input so same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
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
          title="Upload video"
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
          title="Send message"
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
