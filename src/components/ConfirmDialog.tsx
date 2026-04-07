import { X, AlertTriangle, Trash2, Info } from 'lucide-react';
import { useT } from '../hooks/useT';
import { useEffect } from 'react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  showCancel?: boolean;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText,
  cancelText,
  variant = 'warning',
  showCancel = true,
}: ConfirmDialogProps) {
  const { t } = useT();

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onCancel]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const variantConfig = {
    danger: {
      icon: Trash2,
      iconColor: '#DC2626',
      iconBg: 'rgba(220, 38, 38, 0.1)',
      iconRing: 'rgba(220, 38, 38, 0.08)',
      confirmBg: '#DC2626',
      confirmHoverBg: '#B91C1C',
    },
    warning: {
      icon: AlertTriangle,
      iconColor: '#D97706',
      iconBg: 'rgba(217, 119, 6, 0.1)',
      iconRing: 'rgba(217, 119, 6, 0.08)',
      confirmBg: '#D97706',
      confirmHoverBg: '#B45309',
    },
    info: {
      icon: Info,
      iconColor: '#2563EB',
      iconBg: 'rgba(37, 99, 235, 0.1)',
      iconRing: 'rgba(37, 99, 235, 0.08)',
      confirmBg: '#2563EB',
      confirmHoverBg: '#1D4ED8',
    },
  };

  const config = variantConfig[variant];
  const IconComponent = config.icon;

  return (
    <>
      {/* Backdrop with blur */}
      <div
        className="fixed inset-0 z-[9999]"
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(4px)',
          animation: 'confirmBackdropIn 0.2s ease-out',
        }}
        onClick={onCancel}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-white rounded-2xl shadow-2xl max-w-[420px] w-full pointer-events-auto relative overflow-hidden"
          onClick={(e) => e.stopPropagation()}
          style={{ animation: 'confirmModalIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
        >
          {/* Top accent bar */}
          <div
            className="h-1 w-full"
            style={{ backgroundColor: config.iconColor }}
          />

          <div className="p-6">
            {/* Close button */}
            <button
              onClick={onCancel}
              className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
              style={{ color: '#9CA3AF', border: 'none', background: 'none' }}
            >
              <X className="w-4 h-4" />
            </button>

            {/* Icon with ring effect */}
            <div className="flex justify-center mb-5">
              <div
                className="relative w-16 h-16 rounded-full flex items-center justify-center"
                style={{ backgroundColor: config.iconBg }}
              >
                <div
                  className="absolute inset-[-6px] rounded-full"
                  style={{ backgroundColor: config.iconRing }}
                />
                <IconComponent
                  className="w-7 h-7 relative z-10"
                  style={{ color: config.iconColor }}
                  strokeWidth={2}
                />
              </div>
            </div>

            {/* Title */}
            <h3 className="text-center text-[18px] font-bold mb-2 text-gray-900">
              {title}
            </h3>

            {/* Message */}
            <p className="text-center text-[14px] leading-relaxed mb-6 text-gray-500 px-2">
              {message}
            </p>

            {/* Actions */}
            <div className="flex gap-3">
              {showCancel && (
                <button
                  onClick={onCancel}
                  className="flex-1 px-5 py-2.5 rounded-xl text-[14px] font-semibold transition-all cursor-pointer"
                  style={{
                    border: '1.5px solid #E5E7EB',
                    background: '#FAFAFA',
                    color: '#374151',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#F3F4F6';
                    e.currentTarget.style.borderColor = '#D1D5DB';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#FAFAFA';
                    e.currentTarget.style.borderColor = '#E5E7EB';
                  }}
                >
                  {cancelText || t('cancel')}
                </button>
              )}
              <button
                onClick={onConfirm}
                className={`${showCancel ? 'flex-1' : 'w-full'} px-5 py-2.5 rounded-xl text-white text-[14px] font-semibold transition-all cursor-pointer border-0`}
                style={{
                  backgroundColor: config.confirmBg,
                  boxShadow: `0 2px 8px ${config.iconBg}`,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = config.confirmHoverBg;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = config.confirmBg;
                }}
              >
                {confirmText || t('confirm')}
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes confirmBackdropIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes confirmModalIn {
          from {
            opacity: 0;
            transform: scale(0.9) translateY(10px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
      `}</style>
    </>
  );
}
