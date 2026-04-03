import { X } from 'lucide-react';

interface NotificationDialogProps {
  isOpen: boolean;
  title?: string;
  message: string;
  onClose: () => void;
}

export function NotificationDialog({ isOpen, title = 'Figma', message, onClose }: NotificationDialogProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-[9999]"
      style={{ background: 'rgba(0, 0, 0, 0.4)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-2xl relative"
        style={{
          width: '400px',
          maxWidth: '90vw',
          padding: '20px 24px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1 hover:bg-gray-100 rounded transition-colors"
          style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}
        >
          <X size={18} style={{ color: '#666' }} />
        </button>

        {/* Title */}
        <h3
          className="text-[14px] font-semibold mb-4"
          style={{ color: '#1a1a1a', marginTop: '4px' }}
        >
          {title}
        </h3>

        {/* Message */}
        <p
          className="text-[14px] mb-6"
          style={{ color: '#333', lineHeight: '1.5' }}
        >
          {message}
        </p>

        {/* OK Button */}
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded text-[13px] font-medium cursor-pointer transition-all hover:opacity-90"
            style={{
              background: '#0E3DC5',
              color: 'white',
              border: 'none',
            }}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
