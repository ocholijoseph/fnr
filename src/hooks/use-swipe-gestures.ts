import { useRef, useState, useCallback } from 'react';

interface SwipeOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number;
}

export const useSwipeGestures = (options: SwipeOptions = {}) => {
  const {
    onSwipeLeft,
    onSwipeRight,
    threshold = 50,
  } = options;

  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startY, setStartY] = useState(0);
  const [currentX, setCurrentX] = useState(0);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  const isHorizontalSwipe = useRef(false);
  const elementRef = useRef<HTMLElement>(null);

  const handleStart = useCallback((clientX: number, clientY: number) => {
    setIsDragging(true);
    setStartX(clientX);
    setStartY(clientY);
    setCurrentX(clientX);
    setSwipeDirection(null);
    isHorizontalSwipe.current = false;
  }, []);

  const handleMove = useCallback((clientX: number, clientY: number) => {
    if (!isDragging) return;

    const deltaX = clientX - startX;
    const deltaY = clientY - startY;

    if (!isHorizontalSwipe.current) {
      if (Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) return;
      isHorizontalSwipe.current = Math.abs(deltaX) > Math.abs(deltaY);
      if (!isHorizontalSwipe.current) {
        setIsDragging(false);
        setSwipeDirection(null);
        return;
      }
    }

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
  }, [isDragging, startX, startY, threshold]);

  const handleEnd = useCallback(() => {
    if (!isDragging) return;

    const deltaX = currentX - startX;

    if (isHorizontalSwipe.current && Math.abs(deltaX) > threshold) {
      if (deltaX > 0 && onSwipeRight) {
        onSwipeRight();
      } else if (deltaX < 0 && onSwipeLeft) {
        onSwipeLeft();
      }
    }

    setIsDragging(false);
    setSwipeDirection(null);
    isHorizontalSwipe.current = false;
  }, [isDragging, startX, currentX, threshold, onSwipeLeft, onSwipeRight]);

  const handleMouseDown = useCallback((e: MouseEvent) => {
    // Only handle left click
    if (e.button !== 0) return;
    handleStart(e.clientX, e.clientY);
  }, [handleStart]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    handleMove(e.clientX, e.clientY);
  }, [handleMove, isDragging]);

  const handleMouseUp = useCallback(() => {
    handleEnd();
  }, [handleEnd]);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const touch = e.touches[0];
    handleStart(touch.clientX, touch.clientY);
  }, [handleStart]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isDragging) return;
    
    const touch = e.touches[0];
    const deltaX = touch.clientX - startX;
    const deltaY = touch.clientY - startY;

    // Determine direction if not already known
    if (!isHorizontalSwipe.current) {
      // Use a smaller threshold for initial movement detection (5px instead of 10px)
      if (Math.abs(deltaX) < 5 && Math.abs(deltaY) < 5) return;
      
      const horizontal = Math.abs(deltaX) > Math.abs(deltaY) * 2.0; // Stay even stricter for horizontal
      if (horizontal) {
        isHorizontalSwipe.current = true;
      } else {
        // It's a vertical scroll or ambiguous, stop tracking IMMEDIATELLY to let browser handle it
        setIsDragging(false);
        return;
      }
    }

    // If we're here, it's definitely a horizontal swipe
    if (isHorizontalSwipe.current) {
      // Prevent horizontal browser actions (like back/forward navigation)
      if (Math.abs(deltaX) > 5) {
        if (e.cancelable) e.preventDefault();
      }
      handleMove(touch.clientX, touch.clientY);
    }
  }, [handleMove, isDragging, startX, startY]);

  const handleTouchEnd = useCallback(() => {
    handleEnd();
  }, [handleEnd]);

  const addEventListeners = useCallback(() => {
    const element = elementRef.current;
    if (!element) return;

    element.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    // Use passive: true for start and end for better scroll performance
    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    // Use passive: false ONLY for touchmove because we might call preventDefault() for horizontal swipes
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });
  }, [handleMouseDown, handleMouseMove, handleMouseUp, handleTouchStart, handleTouchMove, handleTouchEnd]);

  const removeEventListeners = useCallback(() => {
    const element = elementRef.current;
    if (!element) return;

    element.removeEventListener('mousedown', handleMouseDown);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);

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