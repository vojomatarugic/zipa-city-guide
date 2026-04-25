import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import { Upload, Check, X } from 'lucide-react';
import { useT } from '../hooks/useT';

interface BannerUploadCropperProps {
  bannerType: 'horizontal' | 'square';
  onCropComplete: (croppedImage: string) => void;
  onCancel: () => void;
}

// Helper function to create cropped image
const createCroppedImage = async (
  imageSrc: string,
  pixelCrop: Area,
  targetWidth: number,
  targetHeight: number
): Promise<string> => {
  const image = await new Promise<HTMLImageElement>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.src = imageSrc;
  });

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');

  if (!ctx) throw new Error('Could not get canvas context');

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    targetWidth,
    targetHeight
  );

  return canvas.toDataURL('image/jpeg', 0.95);
};

export function BannerUploadCropper({
  bannerType,
  onCropComplete,
  onCancel
}: BannerUploadCropperProps) {
  const { t } = useT();
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const aspectRatio = bannerType === 'horizontal' ? 10 / 1 : 1 / 1;
  const targetDimensions = bannerType === 'horizontal' 
    ? { width: 1200, height: 120 }
    : { width: 300, height: 300 };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);

    // Validate file type
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setUploadError(t('invalidImageType'));
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setUploadError(t('fileTooLargeUpload'));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setUploadedImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const onCropChange = useCallback((location: { x: number; y: number }) => {
    setCrop(location);
  }, []);

  const onCropAreaChange = useCallback((croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleSaveCrop = async () => {
    if (!uploadedImage || !croppedAreaPixels) return;

    try {
      const croppedImage = await createCroppedImage(
        uploadedImage,
        croppedAreaPixels,
        targetDimensions.width,
        targetDimensions.height
      );
      onCropComplete(croppedImage);
    } catch (error) {
      console.error('Error cropping image:', error);
      setUploadError(t('failedToCropImage'));
    }
  };

  const handleCancel = () => {
    setUploadedImage(null);
    onCancel();
  };

  if (!uploadedImage) {
    return (
      <div className="flex flex-col gap-3">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileChange}
          className="hidden"
          id="banner-file-upload"
          name="banner-file-upload"
        />
        <label
          htmlFor="banner-file-upload"
          className="flex items-center justify-center gap-2 px-4 py-6 rounded-lg border-2 border-dashed border-gray-300 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all"
        >
          <Upload className="w-6 h-6" style={{ color: 'var(--blue-primary)' }} />
          <div className="text-center">
            <div className="text-[14px] font-medium" style={{ color: 'var(--text-primary)' }}>
              {t('uploadAnyImage')}
            </div>
            <div className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
              {t('willBeCroppedTo')} {targetDimensions.width}x{targetDimensions.height}px ({bannerType === 'horizontal' ? '10:1' : '1:1'} {t('ratio')})
            </div>
          </div>
        </label>
        {uploadError && (
          <div className="px-3 py-2 rounded bg-red-50 border border-red-200 text-[13px] text-red-700">
            {uploadError}
          </div>
        )}
        <div className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
          {t('supportedFormats')}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Cropper */}
      <div 
        className="relative rounded-lg overflow-hidden bg-black"
        style={{
          height: bannerType === 'horizontal' ? '300px' : '400px'
        }}
      >
        <Cropper
          image={uploadedImage}
          crop={crop}
          zoom={zoom}
          aspect={aspectRatio}
          onCropChange={onCropChange}
          onCropComplete={onCropAreaChange}
          onZoomChange={setZoom}
        />
      </div>

      {/* Zoom Control */}
      <div className="flex items-center gap-3">
        <label htmlFor="banner-crop-zoom" className="text-[13px]" style={{ color: 'var(--text-muted)' }}>{t('zoom')}:</label>
        <input
          id="banner-crop-zoom"
          name="banner-crop-zoom"
          type="range"
          min={1}
          max={3}
          step={0.1}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="flex-1"
        />
        <span className="text-[13px] font-mono" style={{ color: 'var(--text-muted)' }}>
          {zoom.toFixed(1)}x
        </span>
      </div>

      {/* Instructions */}
      <div className="px-3 py-2 rounded bg-blue-50 border border-blue-200 text-[13px]" style={{ color: 'var(--blue-primary)' }}>
        <strong>{t('instructions')}:</strong> {t('cropInstructions')} {bannerType === 'horizontal' ? '10:1' : '1:1'} {t('ratio')}.
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleSaveCrop}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-0 cursor-pointer transition-all"
          style={{
            background: 'var(--blue-primary)',
            color: 'white'
          }}
        >
          <Check className="w-4 h-4" />
          {t('saveContinue')}
        </button>
        <button
          onClick={handleCancel}
          className="px-4 py-3 rounded-lg border border-gray-300 bg-white cursor-pointer transition-all hover:bg-gray-50"
          style={{ color: 'var(--text-primary)' }}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}