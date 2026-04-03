import { useState, useRef, useCallback } from 'react';
import { Upload, X, Image as ImageIcon, Loader2 } from 'lucide-react';
import { useT } from '../hooks/useT';
import { projectId, publicAnonKey } from '../utils/supabase/info';

interface ImageUploadProps {
  value: string; // current image URL
  onChange: (url: string) => void;
  required?: boolean;
}

export function ImageUpload({ value, onChange, required }: ImageUploadProps) {
  const { t } = useT();
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(value || '');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync preview with value
  if (value && value !== preview && !uploading) {
    setPreview(value);
  }

  const uploadFile = async (file: File) => {
    setError('');

    // Validate type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      setError(t('invalidFileType') || 'Only PNG, JPEG, WEBP, and GIF are allowed.');
      return;
    }

    // Validate size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError(t('fileTooLarge') || 'File too large. Maximum size is 10MB.');
      return;
    }

    // Show local preview immediately
    const localPreview = URL.createObjectURL(file);
    setPreview(localPreview);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-a0e1e9cb/upload/venue-image`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const data = await response.json();
      console.log('✅ Venue image uploaded:', data.url);

      setPreview(data.url);
      onChange(data.url);
    } catch (err) {
      console.error('❌ Image upload error:', err);
      setError(err instanceof Error ? err.message : 'Upload failed');
      setPreview('');
      onChange('');
    } finally {
      setUploading(false);
      URL.revokeObjectURL(localPreview);
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      uploadFile(files[0]);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadFile(file);
    }
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const handleRemove = () => {
    setPreview('');
    onChange('');
    setError('');
  };

  return (
    <div>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
        onChange={handleFileSelect}
        className="hidden"
      />

      {preview ? (
        /* ===== IMAGE PREVIEW ===== */
        <div className="relative rounded-lg overflow-hidden border" style={{ borderColor: '#E5E9F0' }}>
          <img
            src={preview}
            alt="Preview"
            className="w-full h-48 object-cover"
          />
          {/* Remove button */}
          {!uploading && (
            <button
              type="button"
              onClick={handleRemove}
              className="absolute top-2 right-2 w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-all shadow-lg cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          {/* Replace button */}
          {!uploading && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-2 right-2 px-3 py-1.5 rounded-lg bg-black/60 text-white text-xs font-medium hover:bg-black/80 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Upload className="w-3 h-3" />
              {t('replaceImage') || 'Zamijeni'}
            </button>
          )}
          {/* Upload spinner overlay */}
          {uploading && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-8 h-8 text-white animate-spin" />
                <span className="text-white text-sm font-medium">
                  {t('uploading') || 'Uploadovanje...'}
                </span>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ===== DROP ZONE ===== */
        <div
          onClick={() => !uploading && fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className="w-full rounded-lg border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center py-10 px-4"
          style={{
            borderColor: isDragging ? '#0E3DC5' : '#D1D5DB',
            backgroundColor: isDragging ? '#EEF1FB' : '#FAFAFA',
          }}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#0E3DC5' }} />
              <span className="text-sm font-medium" style={{ color: '#0E3DC5' }}>
                {t('uploading') || 'Uploadovanje...'}
              </span>
            </div>
          ) : (
            <>
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
                style={{ backgroundColor: '#EEF1FB' }}
              >
                <ImageIcon className="w-6 h-6" style={{ color: '#0E3DC5' }} />
              </div>
              <p className="text-sm font-medium m-0 mb-1" style={{ color: 'var(--text-primary)' }}>
                {t('dragDropImage') || 'Prevucite sliku ovdje'}
              </p>
              <p className="text-xs m-0 mb-3" style={{ color: '#9CA3AF' }}>
                {t('orClickToUpload') || 'ili kliknite za upload'}
              </p>
              <span
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #60A5FA 0%, #0E3DC5 100%)' }}
              >
                <Upload className="w-4 h-4" />
                {t('chooseFile') || 'Izaberite fajl'}
              </span>
              <p className="text-[11px] m-0 mt-3" style={{ color: '#9CA3AF' }}>
                PNG, JPG, WEBP, GIF — max 10MB
              </p>
            </>
          )}
        </div>
      )}

      {/* Error message */}
      {error && (
        <p className="text-sm mt-2 m-0" style={{ color: '#DC2626' }}>
          {error}
        </p>
      )}

      {/* Hidden required input for form validation */}
      {required && (
        <input
          type="text"
          value={value}
          required
          onChange={() => {}}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
        />
      )}
    </div>
  );
}