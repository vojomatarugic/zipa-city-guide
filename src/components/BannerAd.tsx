import { useState, useEffect } from 'react';
import { ExternalLink } from 'lucide-react';
import { useT } from '../hooks/useT';

export interface Banner {
  id: string;
  imageUrl: string;
  destinationUrl: string;
  type: 'horizontal' | 'square';
  clicks: number;
  createdAt: number;
  enabled: boolean;
  sortOrder?: number;
}

interface BannerAdProps {
  type: 'horizontal' | 'square';
  className?: string;
}

// Hook to check if banners exist for a given type
export function useBannerExists(type: 'horizontal' | 'square'): boolean {
  const [hasBanner, setHasBanner] = useState(false);

  useEffect(() => {
    const bannersJson = localStorage.getItem('blg-banners');
    if (bannersJson) {
      try {
        const allBannersData: Banner[] = JSON.parse(bannersJson);
        const typeBanners = allBannersData.filter(b => b.type === type && b.enabled);
        setHasBanner(typeBanners.length > 0);
      } catch (error) {
        setHasBanner(false);
      }
    } else {
      setHasBanner(false);
    }
  }, [type]);

  return hasBanner;
}

export function BannerAd({ type, className = '' }: BannerAdProps) {
  const { t } = useT();
  const [banner, setBanner] = useState<Banner | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [allBanners, setAllBanners] = useState<Banner[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Load all banners of this type
  useEffect(() => {
    loadBanners();
  }, [type]);

  // Auto-rotate every 10 seconds
  useEffect(() => {
    if (allBanners.length <= 1) return;

    const interval = setInterval(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentIndex(prev => (prev + 1) % allBanners.length);
        setIsTransitioning(false);
      }, 400);
    }, 10000);

    return () => clearInterval(interval);
  }, [allBanners]);

  // Update displayed banner when index changes
  useEffect(() => {
    if (allBanners.length > 0) {
      setBanner(allBanners[currentIndex]);
    }
  }, [currentIndex, allBanners]);

  const loadBanners = () => {
    const bannersJson = localStorage.getItem('blg-banners');
    if (bannersJson) {
      try {
        const allBannersData: Banner[] = JSON.parse(bannersJson);
        const typeBanners = allBannersData
          .filter(b => b.type === type && b.enabled)
          .sort((a, b) => (a.sortOrder ?? a.createdAt) - (b.sortOrder ?? b.createdAt));
        
        if (typeBanners.length > 0) {
          setAllBanners(typeBanners);
          setBanner(typeBanners[0]);
        }
      } catch (error) {
        console.error('Error loading banners:', error);
      }
    }
    setIsLoading(false);
  };

  const handleClick = () => {
    if (!banner) return;

    const bannersJson = localStorage.getItem('blg-banners');
    if (bannersJson) {
      try {
        const allBanners: Banner[] = JSON.parse(bannersJson);
        const updatedBanners = allBanners.map(b => 
          b.id === banner.id ? { ...b, clicks: b.clicks + 1 } : b
        );
        localStorage.setItem('blg-banners', JSON.stringify(updatedBanners));
        console.log('Banner click tracked:', banner.id);
      } catch (error) {
        console.error('Error tracking click:', error);
      }
    }

    window.open(banner.destinationUrl, '_blank', 'noopener,noreferrer');
  };

  // Graceful degradation - no banner available
  if (isLoading || !banner) {
    return null;
  }

  const dimensions = type === 'horizontal' 
    ? { maxWidth: '100%', aspectRatio: '10/1' }
    : { maxWidth: '300px', aspectRatio: '1/1' };

  return (
    <div
      key={banner.id}
      className={`relative group cursor-pointer rounded-xl overflow-hidden border border-gray-200 hover:border-gray-300 ${className}`}
      style={{
        maxWidth: dimensions.maxWidth,
        width: '100%',
        aspectRatio: dimensions.aspectRatio,
        marginLeft: 'auto',
        marginRight: 'auto',
        opacity: isTransitioning ? 0 : 1,
        transform: isTransitioning ? 'scale(0.95) translateY(-10px)' : 'scale(1) translateY(0)',
        transition: 'opacity 0.4s ease, transform 0.4s ease',
      }}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
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
        className="absolute inset-0 bg-black opacity-0 group-hover:opacity-10 transition-opacity flex items-center justify-center px-[0px] py-[50px]"
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
  );
}
