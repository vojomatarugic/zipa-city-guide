import { useState, useEffect } from 'react';
import { ExternalLink } from 'lucide-react';
import type { Banner } from './BannerAd';
import { useT } from '../hooks/useT';

interface SquareBannersGridProps {
  className?: string;
}

export function SquareBannersGrid({ className = '' }: SquareBannersGridProps) {
  const { t } = useT();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [currentIndices, setCurrentIndices] = useState<number[]>([0, 1, 2]);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    loadBanners();
  }, []);

  // Auto-rotate every 10 seconds - ONLY if there are more than 3 banners
  useEffect(() => {
    if (banners.length === 0) return;
    if (banners.length <= 3) return;

    const interval = setInterval(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentIndices(prev => prev.map(index => (index + 1) % banners.length));
        setIsTransitioning(false);
      }, 400);
    }, 10000);

    return () => clearInterval(interval);
  }, [banners]);

  const loadBanners = () => {
    const bannersJson = localStorage.getItem('blg-banners');
    if (bannersJson) {
      try {
        const allBanners: Banner[] = JSON.parse(bannersJson);
        const squareBanners = allBanners
          .filter(b => b.type === 'square' && b.enabled)
          .sort((a, b) => (a.sortOrder ?? a.createdAt) - (b.sortOrder ?? b.createdAt));
        setBanners(squareBanners);
      } catch (error) {
        console.error('Error loading banners:', error);
      }
    }
  };

  const handleClick = (banner: Banner) => {
    const bannersJson = localStorage.getItem('blg-banners');
    if (bannersJson) {
      try {
        const allBanners: Banner[] = JSON.parse(bannersJson);
        const updatedBanners = allBanners.map(b => 
          b.id === banner.id ? { ...b, clicks: b.clicks + 1 } : b
        );
        localStorage.setItem('blg-banners', JSON.stringify(updatedBanners));
      } catch (error) {
        console.error('Error tracking click:', error);
      }
    }

    window.open(banner.destinationUrl, '_blank', 'noopener,noreferrer');
  };

  // Don't render if no banners
  if (banners.length === 0) return null;

  // Get up to 3 unique banners to display
  const displayBanners: Banner[] = [];
  const seenIds = new Set<string>();
  
  for (let i = 0; i < Math.min(3, banners.length); i++) {
    const bannerIndex = currentIndices[i] % banners.length;
    const banner = banners[bannerIndex];
    
    if (banner && !seenIds.has(banner.id)) {
      displayBanners.push(banner);
      seenIds.add(banner.id);
    }
  }

  return (
    <div className={`flex flex-wrap justify-center gap-4 ${className}`}>
      {displayBanners.map((banner, idx) => (
        <div
          key={banner.id}
          className="relative group cursor-pointer rounded-xl overflow-hidden border border-gray-200 hover:border-gray-300"
          style={{
            maxWidth: '300px',
            width: '100%',
            aspectRatio: '1/1',
            marginLeft: 'auto',
            marginRight: 'auto',
            opacity: isTransitioning ? 0 : 1,
            transform: isTransitioning ? 'scale(0.9) translateY(10px)' : 'scale(1) translateY(0)',
            transition: `opacity 0.4s ease ${idx * 0.1}s, transform 0.4s ease ${idx * 0.1}s`,
          }}
          onClick={() => handleClick(banner)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleClick(banner);
            }
          }}
        >
          <img 
            src={banner.imageUrl} 
            alt={t('altAdvertisement')}
            className="w-full h-full object-cover"
            loading="lazy"
          />
          
          {/* Hover overlay */}
          <div 
            className="absolute inset-0 bg-black opacity-0 group-hover:opacity-10 transition-opacity flex items-center justify-center"
          >
            <ExternalLink className="text-white opacity-0 group-hover:opacity-80 w-8 h-8" />
          </div>

          {/* Ad label */}
          <div 
            className="absolute top-2 right-2 px-2 py-1 rounded text-[10px] font-medium"
            style={{
              background: 'rgba(0,0,0,0.5)',
              color: 'rgba(255,255,255,0.9)',
              backdropFilter: 'blur(4px)'
            }}
          >
            AD
          </div>
        </div>
      ))}
    </div>
  );
}
