'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { getExerciseGifUrl, getExerciseImageFrames } from '@/lib/utils/exerciseMedia';

type ExerciseMediaProps = {
  gifUrl?: string;
  imageUrls?: string[];
  images?: string[];
  alt: string;
  className?: string;
  style?: React.CSSProperties;
  loading?: 'eager' | 'lazy';
  frameIntervalMs?: number;
  onExhausted?: () => void;
  onMediaModeChange?: (mode: 'gif' | 'animated-images' | 'static-image' | 'none') => void;
};

export default function ExerciseMedia({
  gifUrl,
  imageUrls,
  images,
  alt,
  className,
  style,
  loading = 'lazy',
  frameIntervalMs = 750,
  onExhausted,
  onMediaModeChange,
}: ExerciseMediaProps) {
  // Stable value key so parent timer re-renders never reset active group/frame state
  const mediaKey = `${(gifUrl || '').trim()}|${(imageUrls || []).join(',')}|${(images || []).join(',')}`;

  const groups = useMemo(() => {
    const primaryGif = getExerciseGifUrl({
      gifUrl,
      imageUrls: imageUrls || [],
      images: images || [],
    });
    const backupFrames = getExerciseImageFrames({
      gifUrl,
      imageUrls: imageUrls || [],
      images: images || [],
    });

    const next: { type: 'gif' | 'frames'; urls: string[] }[] = [];
    // 1. GIF is always the primary display method
    if (primaryGif) {
      next.push({ type: 'gif', urls: [primaryGif] });
    }
    // 2. Static image frames are strictly the backup in case there is no GIF or the GIF fails to load
    if (backupFrames.length > 0) {
      next.push({ type: 'frames', urls: backupFrames });
    }

    return next;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaKey]);

  const [groupIndex, setGroupIndex] = useState(0);
  const [frameIndex, setFrameIndex] = useState(0);
  const [isExhausted, setIsExhausted] = useState(groups.length === 0);
  const failedUrlsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    failedUrlsRef.current.clear();
    setGroupIndex(0);
    setFrameIndex(0);
    setIsExhausted(groups.length === 0);
  }, [mediaKey, groups.length]);

  const currentGroup = groups[groupIndex];
  const currentUrls = useMemo(() => {
    if (!currentGroup) return [];
    return currentGroup.urls;
  }, [currentGroup]);

  // Preload backup frames when active so frame-by-frame animation never flickers
  useEffect(() => {
    if (typeof window === 'undefined' || currentUrls.length <= 1) return;
    currentUrls.forEach((url) => {
      const img = new window.Image();
      img.src = url;
    });
  }, [currentUrls]);

  // Animate multi-frame backup images smoothly
  useEffect(() => {
    if (isExhausted || currentUrls.length <= 1) {
      return;
    }

    const timer = setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % currentUrls.length);
    }, frameIntervalMs);

    return () => clearInterval(timer);
  }, [currentUrls, frameIntervalMs, isExhausted]);

  // Report current media mode to parent if requested
  useEffect(() => {
    if (!onMediaModeChange) return;
    if (isExhausted || !currentGroup || currentUrls.length === 0) {
      onMediaModeChange('none');
    } else if (currentGroup.type === 'gif') {
      onMediaModeChange('gif');
    } else if (currentUrls.length > 1) {
      onMediaModeChange('animated-images');
    } else {
      onMediaModeChange('static-image');
    }
  }, [currentGroup, currentUrls.length, isExhausted, onMediaModeChange]);

  const safeFrameIndex = currentUrls.length > 0 ? frameIndex % currentUrls.length : 0;
  const src = currentUrls[safeFrameIndex];

  const handleError = () => {
    if (src) {
      failedUrlsRef.current.add(src);
    }

    // If in a multi-frame group and other frames are still valid, skip the broken frame
    if (currentUrls.length > 1) {
      const remainingValid = currentUrls.filter((u) => !failedUrlsRef.current.has(u));
      if (remainingValid.length > 0) {
        setFrameIndex((prev) => (prev + 1) % currentUrls.length);
        return;
      }
    }

    // Otherwise fall back to the next media group (e.g. from missing GIF -> backup images)
    if (groupIndex < groups.length - 1) {
      setGroupIndex((prev) => prev + 1);
      setFrameIndex(0);
      return;
    }

    setIsExhausted(true);
    onExhausted?.();
  };

  if (!src || isExhausted) {
    return null;
  }

  return (
    <img
      key={`${groupIndex}-${src}`}
      src={src}
      alt={alt}
      className={className}
      style={style}
      loading={loading}
      decoding="async"
      onError={handleError}
    />
  );
}
