import { useState, useRef } from 'react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { GripVertical, ExternalLink, Trash2, X } from 'lucide-react';
import { BannerUploadCropper } from './BannerUploadCropper';
import { ConfirmDialog } from './ConfirmDialog';
import { NotificationDialog } from './NotificationDialog';
import { useT } from '../hooks/useT';
import { formatDate as formatAppDate } from '../utils/dateFormat';

interface Banner {
  id: string;
  imageUrl: string;
  destinationUrl: string;
  type: 'horizontal' | 'square';
  clicks: number;
  createdAt: number;
  enabled: boolean;
  sortOrder: number; // Dodato: redoslijed prikaza
}

export function BannerAdminSection() {
  const { t, language } = useT();
  
  // Helper function za formatiranje datuma prema jeziku
  const formatDate = (timestamp: number) => {
    return formatAppDate(timestamp, language === 'en' ? 'en' : 'sr');
  };
  const [banners, setBanners] = useState<Banner[]>(() => {
    const saved = localStorage.getItem('blg-banners');
    return saved ? JSON.parse(saved) : [];
  });
  const [bannerType, setBannerType] = useState<'horizontal' | 'square'>('horizontal');
  const [destinationUrl, setDestinationUrl] = useState('');
  const [croppedImage, setCroppedImage] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [notificationDialog, setNotificationDialog] = useState<{ isOpen: boolean; message: string }>({
    isOpen: false,
    message: ''
  });

  const MAX_BANNERS = 20; // Maksimalno 20 bannera ukupno

  const handleCropComplete = (image: string) => {
    setCroppedImage(image);
  };

  const handleBannerSubmit = () => {
    if (!croppedImage || !destinationUrl) {
      setNotificationDialog({ isOpen: true, message: t('bannerUploadError') });
      return;
    }

    if (banners.length >= MAX_BANNERS) {
      setNotificationDialog({ 
        isOpen: true, 
        message: `${t('bannerLimitReached')} ${MAX_BANNERS} ${t('bannerLimitError')}` 
      });
      return;
    }

    const newBanner: Banner = {
      id: Date.now().toString(),
      imageUrl: croppedImage,
      destinationUrl,
      type: bannerType,
      clicks: 0,
      createdAt: Date.now(),
      enabled: true,
      sortOrder: banners.length // Dodato: inicijalno je banner uključen
    };

    const updatedBanners = [...banners, newBanner];
    setBanners(updatedBanners);
    localStorage.setItem('blg-banners', JSON.stringify(updatedBanners));

    // Reset form
    setCroppedImage(null);
    setDestinationUrl('');
    setNotificationDialog({ isOpen: true, message: t('bannerUploadSuccess') });
  };

  const handleReset = () => {
    setCroppedImage(null);
  };

  const handleToggleEnabled = (id: string) => {
    const updatedBanners = banners.map(b => 
      b.id === id ? { ...b, enabled: !b.enabled } : b
    );
    setBanners(updatedBanners);
    localStorage.setItem('blg-banners', JSON.stringify(updatedBanners));
  };

  const handleSortEnd = (dragIndex: number, hoverIndex: number) => {
    const updatedBanners = [...banners];
    const [draggedItem] = updatedBanners.splice(dragIndex, 1);
    updatedBanners.splice(hoverIndex, 0, draggedItem);

    // Ažuriraj redoslijed prikaza
    updatedBanners.forEach((banner, index) => {
      banner.sortOrder = index;
    });

    setBanners(updatedBanners);
    localStorage.setItem('blg-banners', JSON.stringify(updatedBanners));
  };

  const BannerItem = ({ banner, index }: { banner: Banner, index: number }) => {
    const ref = useRef<HTMLDivElement>(null);
    
    const [{ isDragging }, drag] = useDrag({
      type: 'banner',
      item: { id: banner.id, index },
      collect: (monitor) => ({
        isDragging: monitor.isDragging(),
      }),
    });

    const [{ handlerId }, drop] = useDrop({
      accept: 'banner',
      collect(monitor) {
        return {
          handlerId: monitor.getHandlerId(),
        };
      },
      hover(item: { id: string, index: number }, monitor) {
        if (!ref.current) {
          return;
        }
        const dragIndex = item.index;
        const hoverIndex = index;

        if (dragIndex === hoverIndex) {
          return;
        }

        const hoverBoundingRect = ref.current?.getBoundingClientRect();
        const hoverMiddleY =
          (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;

        const clientOffset = monitor.getClientOffset();

        const hoverClientY = (clientOffset as { x: number, y: number }).y - hoverBoundingRect.top;

        if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) {
          return;
        }

        if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) {
          return;
        }

        handleSortEnd(dragIndex, hoverIndex);

        item.index = hoverIndex;
      },
    });

    drag(drop(ref));

    return (
      <div
        ref={ref}
        className="border border-gray-100 rounded-xl p-4 hover:shadow-md transition-all"
        style={{ opacity: isDragging ? 0.5 : 1, cursor: 'move' }}
        data-handler-id={handlerId}
      >
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Drag Handle */}
          <div className="flex items-center">
            <GripVertical className="w-5 h-5 text-gray-400" />
          </div>
          
          {/* Thumbnail */}
          <div 
            className="flex-shrink-0 rounded-lg overflow-hidden border border-gray-200"
            style={{
              width: banner.type === 'horizontal' ? '240px' : '100px',
              height: banner.type === 'horizontal' ? '24px' : '100px'
            }}
          >
            <img 
              src={banner.imageUrl} 
              alt={t('altBanner')}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Info */}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-1 rounded text-[11px] font-medium uppercase" style={{
                background: banner.type === 'horizontal' ? 'var(--blue-light)' : '#e8f5e9',
                color: banner.type === 'horizontal' ? 'var(--blue-primary)' : '#2e7d32'
              }}>
                {t(banner.type)}
              </span>
              <span className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
                {banner.clicks} {t('clicks')}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[13px] mb-1" style={{ color: 'var(--text-secondary)' }}>
              <ExternalLink className="w-3 h-3" />
              <a 
                href={banner.destinationUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="hover:underline truncate"
              >
                {banner.destinationUrl}
              </a>
            </div>
            <div className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
              {t('created')}: {formatDate(banner.createdAt)}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Toggle Enable/Disable */}
            <button
              onClick={() => handleToggleEnabled(banner.id)}
              className={`px-4 py-2 rounded-lg border-0 cursor-pointer transition-all text-[13px] font-medium ${
                banner.enabled 
                  ? 'bg-green-50 hover:bg-green-100 text-green-700' 
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
              }`}
              title={banner.enabled ? t('clickToDisable') : t('clickToEnable')}
            >
              {banner.enabled ? t('aktivan') : t('neaktivan')}
            </button>
            
            {/* Delete Button */}
            <button
              onClick={() => setDeleteConfirmId(banner.id)}
              className="p-2 rounded-lg border-0 cursor-pointer bg-red-50 hover:bg-red-100 transition-colors"
              title={t('deleteBanner')}
            >
              <Trash2 className="w-4 h-4 text-red-600" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-5">
      <h2 className="mb-4 pb-3 border-b border-gray-100 font-bold" style={{ textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)' }}>
        {t('bannerAdManagement')}
      </h2>

      {/* Upload Form */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Left: Format + URL */}
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-[14px] mb-2 font-medium" style={{ color: 'var(--text-primary)' }}>
              1. {t('selectBannerFormat')}
            </label>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setBannerType('horizontal');
                  setCroppedImage(null);
                }}
                className={`flex-1 px-4 py-3 rounded-lg border text-[14px] cursor-pointer transition-all ${
                  bannerType === 'horizontal' ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-white hover:bg-gray-50'
                }`}
                style={{
                  color: bannerType === 'horizontal' ? 'var(--blue-primary)' : 'var(--text-secondary)'
                }}
              >
                <div className="font-medium">{t('horizontal')}</div>
                <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  1200×120px (10:1)
                </div>
              </button>
              <button
                onClick={() => {
                  setBannerType('square');
                  setCroppedImage(null);
                }}
                className={`flex-1 px-4 py-3 rounded-lg border text-[14px] cursor-pointer transition-all ${
                  bannerType === 'square' ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-white hover:bg-gray-50'
                }`}
                style={{
                  color: bannerType === 'square' ? 'var(--blue-primary)' : 'var(--text-secondary)'
                }}
              >
                <div className="font-medium">{t('square')}</div>
                <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  300×300px (1:1)
                </div>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[14px] mb-2 font-medium" style={{ color: 'var(--text-primary)' }}>
              2. {t('destinationUrl')}
            </label>
            <input
              type="url"
              value={destinationUrl}
              onChange={(e) => setDestinationUrl(e.target.value)}
              placeholder="https://example.com"
              className="w-full px-4 py-2 rounded-lg border border-gray-200 text-[14px] focus:border-blue-400 focus:outline-none"
              style={{ color: 'var(--text-primary)' }}
            />
            <div className="mt-1 text-[12px]" style={{ color: 'var(--text-muted)' }}>
              {t('bannerRedirectInfo')}
            </div>
          </div>

          {/* Debug info - pokazuje zašto je dugme disabled */}
          {(!croppedImage || !destinationUrl) && (
            <div className="px-3 py-2 rounded bg-yellow-50 border border-yellow-200 text-[13px] text-yellow-800">
              ⚠️ {t('beforeUploadComplete')}:
              {!croppedImage && <div>• {t('uploadAndCropImage')}</div>}
              {!destinationUrl && <div>• {t('enterDestinationUrlMsg')}</div>}
            </div>
          )}
          
          {banners.length >= MAX_BANNERS && (
            <div className="px-3 py-2 rounded bg-red-50 border border-red-200 text-[13px] text-red-700">
              ⛔ {t('bannerLimitReached')} {MAX_BANNERS} {t('bannerLimitError')}
            </div>
          )}

          <button
            onClick={handleBannerSubmit}
            disabled={!croppedImage || !destinationUrl || banners.length >= MAX_BANNERS}
            className="px-6 py-3 rounded-lg border-0 cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            style={{
              background: 'linear-gradient(135deg, #60A5FA 0%, #0E3DC5 100%)',
              color: 'white'
            }}
          >
            {t('uploadBanner')}
          </button>
        </div>

        {/* Right: Upload & Preview */}
        <div className="flex flex-col gap-3">
          <label className="block text-[14px] font-medium" style={{ color: 'var(--text-primary)' }}>
            {t('preview')}
          </label>

          {/* Ako JOŠ NEMA crop-ovane slike, prikaži cropper */}
          {!croppedImage ? (
            <BannerUploadCropper
              bannerType={bannerType}
              onCropComplete={handleCropComplete}
              onCancel={handleReset}
            />
          ) : (
            /* Ako IMA crop-ovanu sliku, prikaži preview */
            <div className="flex flex-col gap-3">
              <div 
                className="flex items-center justify-center rounded-lg border-2 border-gray-200 p-4"
                style={{ 
                  background: 'var(--bg-secondary)',
                  minHeight: bannerType === 'horizontal' ? '200px' : '320px'
                }}
              >
                <div className="w-full">
                  <div 
                    className="mx-auto border border-gray-300 rounded"
                    style={{
                      maxWidth: bannerType === 'horizontal' ? '100%' : '300px',
                      aspectRatio: bannerType === 'horizontal' ? '10/1' : '1/1'
                    }}
                  >
                    <img 
                      src={croppedImage} 
                      alt={t('altBannerPreview')}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="text-center mt-3 text-[12px]" style={{ color: 'var(--text-muted)' }}>
                    {t('finalSize')}: {bannerType === 'horizontal' ? '1200×120px' : '300×300px'}
                  </div>
                </div>
              </div>
              
              {/* Dugme za promjenu slike */}
              <button
                onClick={handleReset}
                className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white cursor-pointer transition-all hover:bg-gray-50"
                style={{ color: 'var(--text-primary)' }}
              >
                <X className="w-4 h-4" />
                {t('changeImage')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Existing Banners List */}
      <div>
        <h3 className="mb-3 pb-2 border-b border-gray-100">
          {t('activeBanners')} ({banners.length})
        </h3>
        
        {banners.length === 0 ? (
          <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
            {t('noBannersUploadedYet')}
          </div>
        ) : (
          <DndProvider backend={HTML5Backend}>
            <div className="grid grid-cols-1 gap-3">
              {banners.map((banner, index) => (
                <BannerItem key={banner.id} banner={banner} index={index} />
              ))}
            </div>
          </DndProvider>
        )}
      </div>

      {/* Confirm Delete Dialog */}
      {deleteConfirmId && (
        <ConfirmDialog
          isOpen={true}
          title={t('deleteBanner')}
          message={t('confirmDeleteBanner')}
          confirmText={t('delete')}
          variant="danger"
          onConfirm={() => {
            const updatedBanners = banners.filter(b => b.id !== deleteConfirmId);
            setBanners(updatedBanners);
            localStorage.setItem('blg-banners', JSON.stringify(updatedBanners));
            setDeleteConfirmId(null);
          }}
          onCancel={() => setDeleteConfirmId(null)}
        />
      )}

      {/* Notification Dialog */}
      {notificationDialog.isOpen && (
        <NotificationDialog
          isOpen={true}
          title={t('dialogNoticeTitle')}
          message={notificationDialog.message}
          onClose={() => setNotificationDialog({ isOpen: false, message: '' })}
        />
      )}
    </section>
  );
}