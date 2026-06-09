/**
 * BannerCarousel — auto-rotating image carousel for Bruno card banners.
 *
 *  Builds a slide list from `banner_url` + `gallery_photos[]`.
 *  - Auto-advances every 4.5s (pausable on user touch)
 *  - Manual swipe (touch) and dot navigation
 *  - Single image renders as a static <img> with zero overhead
 *
 *  Props:
 *    images: string[]  — list of URLs (already deduplicated)
 *    className, imgClassName — passthrough Tailwind classes
 *    overlay: ReactNode — fixed gradient/element on top (e.g. dark gradient)
 *    height: string    — Tailwind h-* utility (default: "h-full")
 */
import React, { useEffect, useRef, useState, useCallback } from "react";

const ROTATE_MS = 4500;
const SWIPE_THRESHOLD = 40;

export default function BannerCarousel({
  images = [],
  className = "",
  imgClassName = "w-full h-full object-cover",
  overlay = null,
  height = "h-full",
  testIdPrefix = "banner-carousel",
}) {
  const slides = images.filter(Boolean);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStart = useRef(null);

  const goTo = useCallback((i) => {
    if (slides.length === 0) return;
    setIndex(((i % slides.length) + slides.length) % slides.length);
  }, [slides.length]);

  // Auto-rotate
  useEffect(() => {
    if (slides.length <= 1 || paused) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % slides.length), ROTATE_MS);
    return () => clearInterval(t);
  }, [slides.length, paused]);

  const handleTouchStart = (e) => {
    touchStart.current = e.touches[0].clientX;
    setPaused(true);
  };
  const handleTouchEnd = (e) => {
    if (touchStart.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStart.current;
    if (dx > SWIPE_THRESHOLD) goTo(index - 1);
    else if (dx < -SWIPE_THRESHOLD) goTo(index + 1);
    touchStart.current = null;
    setTimeout(() => setPaused(false), 2500);
  };

  if (slides.length === 0) return null;

  // Single image — render plainly so we don't pay layout/animation cost
  if (slides.length === 1) {
    return (
      <div className={`relative ${height} ${className}`} data-testid={`${testIdPrefix}-single`}>
        <img src={slides[0]} alt="" className={imgClassName} />
        {overlay}
      </div>
    );
  }

  return (
    <div
      className={`relative ${height} ${className}`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      data-testid={testIdPrefix}
    >
      {slides.map((src, i) => (
        <img
          key={src + i}
          src={src}
          alt=""
          className={`${imgClassName} absolute inset-0 transition-opacity duration-700 ease-in-out ${i === index ? "opacity-100" : "opacity-0"}`}
          data-testid={`${testIdPrefix}-slide-${i}`}
        />
      ))}
      {overlay}

      {/* Dot indicators */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 z-20">
        {slides.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={(e) => { e.stopPropagation(); goTo(i); }}
            aria-label={`Imagen ${i + 1}`}
            data-testid={`${testIdPrefix}-dot-${i}`}
            className={`h-1.5 rounded-full transition-all ${i === index ? "w-5 bg-white" : "w-1.5 bg-white/45"}`}
          />
        ))}
      </div>
    </div>
  );
}
