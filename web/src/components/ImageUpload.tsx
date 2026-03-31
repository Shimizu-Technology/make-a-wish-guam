import React, { useState, useRef } from 'react';
import { Upload, X, Loader2, Image as ImageIcon } from 'lucide-react';

interface ImageUploadProps {
  label: string;
  value: string;           // Current URL
  onChange: (url: string) => void;
  getToken: () => Promise<string | null>;
  placeholder?: string;
  helpText?: string;
  accept?: string;
  maxSizeMB?: number;
}

export const ImageUpload: React.FC<ImageUploadProps> = ({
  label,
  value,
  onChange,
  getToken,
  placeholder = 'Upload an image or paste a URL',
  helpText,
  accept = 'image/jpeg,image/png,image/gif,image/svg+xml,image/webp',
  maxSizeMB = 5,
}) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    setError(null);

    // Validate size
    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`File too large. Maximum size is ${maxSizeMB}MB`);
      return;
    }

    // Validate type
    const allowedTypes = accept.split(',');
    if (!allowedTypes.includes(file.type)) {
      setError('Invalid file type');
      return;
    }

    setUploading(true);
    try {
      const token = await getToken();
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/admin/uploads`,
        {
          method: 'POST',
          headers: token ? { 'Authorization': `Bearer ${token}` } : {},
          body: formData,
        }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Upload failed');
      }

      const data = await response.json();
      onChange(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    // Reset input so same file can be re-selected
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const handleClear = () => {
    onChange('');
    setError(null);
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>

      {/* Preview */}
      {value && (
        <div className="relative mb-2 inline-block">
          <img
            src={value}
            alt={label}
            className="h-20 w-auto rounded-lg border border-gray-200 object-contain bg-gray-50"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          <button
            type="button"
            onClick={handleClear}
            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 shadow-sm"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Upload area */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`
          relative border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors
          ${dragOver 
            ? 'border-green-500 bg-green-50' 
            : 'border-gray-300 hover:border-gray-400 bg-white'
          }
          ${uploading ? 'pointer-events-none opacity-60' : ''}
        `}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={handleFileSelect}
          className="hidden"
        />

        {uploading ? (
          <div className="flex items-center justify-center gap-2 text-gray-500">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Uploading...</span>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 text-gray-500">
            <Upload className="w-5 h-5" />
            <span className="text-sm">{placeholder}</span>
          </div>
        )}
      </div>

      {/* URL input fallback */}
      <div className="mt-2 flex items-center gap-2">
        <ImageIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Or paste image URL directly"
          className="flex-1 text-sm border border-gray-300 rounded-md px-3 py-1.5 text-gray-700 placeholder-gray-400 focus:ring-1 focus:ring-green-500 focus:border-green-500"
        />
      </div>

      {/* Help text */}
      {helpText && (
        <p className="mt-1 text-xs text-gray-500">{helpText}</p>
      )}

      {/* Error */}
      {error && (
        <p className="mt-1 text-xs text-red-500">{error}</p>
      )}
    </div>
  );
};

export default ImageUpload;
