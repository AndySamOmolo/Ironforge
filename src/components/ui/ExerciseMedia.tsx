'use client';

import { useEffect, useMemo, useState } from 'react';
import { getExerciseImageFrames } from '@/lib/utils/exerciseMedia';

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
};

export default function ExerciseMedia({
  gifUrl,
  imageUrls,
  images,
  alt,
  className,
  style,
  loading = 'lazy',
  frameIntervalMs = 950,
  onExhausted,
}: ExerciseMediaProps) {
  const groups = useMemo(() => {
    const normalizedGif = (gifUrl || '').trim();
    const frames = getExerciseImageFrames({ gifUrl: '', imageUrls: imageUrls || [], images: images || [] });

    const next: string[][] = [];
    if (normalizedGif.length > 0) {
      next.push([normalizedGif]);
    }
    if (frames.length > 0) {
      next.push(frames);
    }

    return next;
  }, [gifUrl, imageUrls, images]);

  const [groupIndex, setGroupIndex] = useState(0);
  const [frameIndex, setFrameIndex] = useState(0);
  const [isExhausted, setIsExhausted] = useState(groups.length === 0);

  useEffect(() => {
    setGroupIndex(0);
    setFrameIndex(0);
    setIsExhausted(groups.length === 0);
  }, [groups]);

  const currentGroup = groups[groupIndex] || [];

  useEffect(() => {
    if (isExhausted || currentGroup.length <= 1) {
      return;
    }

    const timer = setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % currentGroup.length);
    }, frameIntervalMs);

    return () => clearInterval(timer);
  }, [currentGroup, frameIntervalMs, isExhausted]);

  const src = currentGroup[frameIndex];

  const handleError = () => {
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
      src={src}
      alt={alt}
      className={className}
      style={style}
      loading={loading}
      onError={handleError}
    />
  );
}
