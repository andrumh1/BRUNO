import React, { useRef, useState } from "react";

// Horizontal photo carousel inside a reel. Owns its touch events so the
// parent's swipe-left/right (profile / back) gestures don't fire.
export default function ReelCarousel({ reel, images }) {
  const [index, setIndex] = useState(0);
  const [drag, setDrag] = useState(0);
  const start = useRef(null);

  const onTouchStart = (e) => { e.stopPropagation(); const t = e.touches[0]; start.current = { x: t.clientX, y: t.clientY, t: Date.now(), moved: false }; };
  const onTouchMove = (e) => {
    if (!start.current) return;
    const dx = e.touches[0].clientX - start.current.x, dy = e.touches[0].clientY - start.current.y;
    if (!start.current.moved && Math.abs(dx) < 8) return;
    if (Math.abs(dx) < Math.abs(dy) * 1.2 && !start.current.moved) return; // vertical → let the feed scroll
    start.current.moved = true;
    e.stopPropagation();
    setDrag(dx);
  };
  const onTouchEnd = (e) => {
    if (!start.current) return;
    const dx = e.changedTouches[0].clientX - start.current.x;
    const moved = start.current.moved;
    start.current = null;
    setDrag(0);
    if (!moved) return; // plain tap → bubbles to ReelItem (play/like handling)
    e.stopPropagation();
    if (dx < -40) setIndex((i) => Math.min(images.length - 1, i + 1));
    else if (dx > 40) setIndex((i) => Math.max(0, i - 1));
  };

  return (
    <div className="absolute inset-0" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} data-testid={`reel-carousel-${reel.id}`}>
      <div className="absolute inset-0 bg-center bg-cover scale-110 opacity-50 transition-[background-image] duration-300" style={{ backgroundImage: `url(${images[index]})`, filter: "blur(30px)" }} />
      <div className="absolute inset-0 flex" style={{ transform: `translateX(calc(${-index * 100}% + ${drag}px))`, transition: drag ? "none" : "transform 320ms cubic-bezier(.22,.61,.36,1)" }}>
        {images.map((src, i) => (
          <img key={src + i} src={src} alt="" draggable={false} className="h-full w-full shrink-0 object-contain" data-testid={i === 0 ? `reel-image-${reel.id}` : undefined} />
        ))}
      </div>
      {images.length > 1 && (
        <>
          <span className="absolute right-3 z-10 rounded-full bg-black/45 px-2 py-0.5 text-[11px] text-white" style={{ top: "calc(env(safe-area-inset-top, 0px) + 100px)" }} data-testid="reel-carousel-counter">{index + 1}/{images.length}</span>
          <div className="absolute inset-x-0 z-10 flex justify-center gap-1.5" style={{ bottom: "calc(var(--nav-reserve, 64px) + 8px)" }} data-testid="reel-carousel-dots">
            {images.map((_, i) => <span key={i} className={`h-1.5 rounded-full transition-all ${i === index ? "w-4 bg-white" : "w-1.5 bg-white/45"}`} />)}
          </div>
          {index > 0 && <button onClick={(e) => { e.stopPropagation(); setIndex((i) => i - 1); }} className="hidden sm:grid absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 text-white place-items-center" data-testid="reel-carousel-prev">‹</button>}
          {index < images.length - 1 && <button onClick={(e) => { e.stopPropagation(); setIndex((i) => i + 1); }} className="hidden sm:grid absolute right-16 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 text-white place-items-center" data-testid="reel-carousel-next">›</button>}
        </>
      )}
    </div>
  );
}
