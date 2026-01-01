import { useRef, useState, useCallback } from 'react';

interface SwipeOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number;
  preventDefault?: boolean;
}

export const useSwipeGestures = (options: SwipeOptions = {}) => {
  const {
    onSwipeLeft,
    onSwipeRight,
    threshold = 50,
    preventDefault = true,
  } = options;

  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [currentX, setCurrentX] = useState(0);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  const elementRef = useRef<HTMLElement>(null);

  const handleStart = useCallback((clientX: number) => {
    setIsDragging(true);
    setStartX(clientX);
    setCurrentX(clientX);
    setSwipeDirection(null);
  }, []);

  const handleMove = useCallback((clientX: number) => {
    if (!isDragging) return;

    const deltaX = clientX - startX;
    setCurrentX(clientX);

    if (Math.abs(deltaX) > threshold) {
      if (deltaX > 0) {
        setSwipeDirection('right');
      } else {
        setSwipeDirection('left');
      }
    } else {
      setSwipeDirection(null);
    }
  }, [isDragging, startX, threshold]);

  const handleEnd = useCallback(() => {
    if (!isDragging) return;

    const deltaX = currentX - startX;

    if (Math.abs(deltaX) > threshold) {
      if (deltaX > 0 && onSwipeRight) {
        onSwipeRight();
      } else if (deltaX < 0 && onSwipeLeft) {
        onSwipeLeft();
      }
    }

    setIsDragging(false);
    setSwipeDirection(null);
  }, [isDragging, startX, currentX, threshold, onSwipeLeft, onSwipeRight]);

  const handleMouseDown = useCallback((e: MouseEvent) => {
    if (preventDefault) e.preventDefault();
    handleStart(e.clientX);
  }, [handleStart, preventDefault]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (preventDefault && isDragging) e.preventDefault();
    handleMove(e.clientX);
  }, [handleMove, preventDefault, isDragging]);

  const handleMouseUp = useCallback(() => {
    handleEnd();
  }, [handleEnd]);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (preventDefault) e.preventDefault();
    const touch = e.touches[0];
    handleStart(touch.clientX);
  }, [handleStart, preventDefault]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (preventDefault && isDragging) e.preventDefault();
    const touch = e.touches[0];
    handleMove(touch.clientX);
  }, [handleMove, preventDefault, isDragging]);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    if (preventDefault) e.preventDefault();
    handleEnd();
  }, [handleEnd, preventDefault]);

  const addEventListeners = useCallback(() => {
    const element = elementRef.current;
    if (!element) return;

    // Mouse events
    element.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    // Touch events
    element.addEventListener('touchstart', handleTouchStart, { passive: false });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd, { passive: false });
  }, [handleMouseDown, handleMouseMove, handleMouseUp, handleTouchStart, handleTouchMove, handleTouchEnd]);

  const removeEventListeners = useCallback(() => {
    const element = elementRef.current;
    if (!element) return;

    // Mouse events
    element.removeEventListener('mousedown', handleMouseDown);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);

    // Touch events
    element.removeEventListener('touchstart', handleTouchStart);
    element.removeEventListener('touchmove', handleTouchMove);
    element.removeEventListener('touchend', handleTouchEnd);
  }, [handleMouseDown, handleMouseMove, handleMouseUp, handleTouchStart, handleTouchMove, handleTouchEnd]);

  return {
    elementRef,
    isDragging,
    currentX,
    swipeDirection,
    deltaX: currentX - startX,
    addEventListeners,
    removeEventListeners,
  };
};