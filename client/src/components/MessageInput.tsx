import React, { useState, useRef } from 'react';
import { useChat } from '../context/ChatContext';
import { useAuth } from '../context/AuthContext';
import { Send, Image as ImageIcon, X, Loader2 } from 'lucide-react';

export const MessageInput: React.FC = () => {
  const { activeRoom, sendMessage, startTyping, stopTyping } = useChat();
  const { token } = useAuth();

  const [text, setText] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    if (e.target.value.trim()) {
      startTyping();
    } else {
      stopTyping();
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadError('Please select a valid image file (JPEG, PNG, GIF, WEBP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Image size exceeds the 5MB limit.');
      return;
    }

    setSelectedImage(file);
    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const clearImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSend = async () => {
    if ((!text.trim() && !selectedImage) || isUploading) return;

    let uploadedImageUrl: string | null = null;

    if (selectedImage && token) {
      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append('image', selectedImage);

        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to upload image.');
        }
        uploadedImageUrl = data.imageUrl;
      } catch (err: any) {
        setUploadError(err.message || 'Image upload failed.');
        setIsUploading(false);
        return;
      } finally {
        setIsUploading(false);
      }
    }

    await sendMessage(text, uploadedImageUrl);

    setText('');
    clearImage();
    stopTyping();
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!activeRoom) {
    return null;
  }

  return (
    <div className="p-3 md:p-4 bg-slate-900 border-t border-slate-800">
      {/* Upload error banner */}
      {uploadError && (
        <div className="mb-2 p-2 bg-red-900/60 border border-red-700/60 text-red-200 text-xs rounded-md flex justify-between items-center">
          <span>{uploadError}</span>
          <button onClick={() => setUploadError(null)} className="text-red-300 hover:text-white cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Selected Image Preview Pill */}
      {imagePreview && (
        <div className="mb-2 relative inline-block">
          <div className="relative group rounded-lg overflow-hidden border border-indigo-500/60 shadow-md">
            <img src={imagePreview} alt="Preview" className="h-20 w-auto object-cover" />
            <button
              onClick={clearImage}
              className="absolute top-1 right-1 p-1 bg-slate-900/80 hover:bg-red-600 text-white rounded-full transition cursor-pointer"
              title="Remove image"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Input container */}
      <div className="flex items-end gap-2 bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 transition shadow-inner">
        {/* Image Attachment Button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-700/50 rounded-lg transition cursor-pointer"
          title="Attach image (JPEG, PNG, GIF, WEBP up to 5MB)"
        >
          <ImageIcon className="w-5 h-5" />
        </button>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleImageSelect}
          accept="image/jpeg,image/png,image/gif,image/webp"
          className="hidden"
        />

        {/* Text input area */}
        <textarea
          ref={inputRef}
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          placeholder={`Message #${activeRoom.displayName}...`}
          rows={1}
          className="flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-400 focus:outline-none resize-none max-h-32 py-1 leading-relaxed"
        />

        {/* Send Button */}
        <button
          type="button"
          onClick={handleSend}
          disabled={(!text.trim() && !selectedImage) || isUploading}
          className="p-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white rounded-lg transition flex items-center justify-center cursor-pointer shadow-md"
          title="Send message (Enter)"
        >
          {isUploading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </div>

      <div className="flex justify-between items-center px-1 mt-1.5 text-[11px] text-slate-400">
        <span>Shift + Enter for new line</span>
        <span>Images up to 5MB supported</span>
      </div>
    </div>
  );
};
