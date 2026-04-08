import React, { useState, useRef, useCallback } from "react";
import { GripVertical } from "lucide-react";

/**
 * DraggableList - Drag-to-reorder list using pointer events
 * No external dependencies. Works on touch and mouse.
 */
const DraggableList = ({ items, onReorder, renderItem, keyExtractor, className = "", disabled = false }) => {
  const [dragIndex, setDragIndex] = useState(null);
  const [overIndex, setOverIndex] = useState(null);
  const containerRef = useRef(null);
  const dragItem = useRef(null);
  const startY = useRef(0);
  const itemRects = useRef([]);

  const captureRects = useCallback(() => {
    if (!containerRef.current) return;
    const children = containerRef.current.querySelectorAll("[data-drag-item]");
    itemRects.current = Array.from(children).map((el) => {
      const rect = el.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom, mid: rect.top + rect.height / 2 };
    });
  }, []);

  const handleDragStart = useCallback((index, e) => {
    if (disabled) return;
    e.preventDefault();
    setDragIndex(index);
    setOverIndex(index);
    dragItem.current = index;
    startY.current = e.clientY;
    captureRects();

    const onMove = (moveEvent) => {
      const y = moveEvent.clientY;
      let newOver = dragItem.current;
      for (let i = 0; i < itemRects.current.length; i++) {
        if (y < itemRects.current[i].mid) {
          newOver = i;
          break;
        }
        newOver = i;
      }
      setOverIndex(newOver);
    };

    const onEnd = () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onEnd);

      const from = dragItem.current;
      const to = overIndex;
      setDragIndex(null);
      setOverIndex(null);

      if (from !== null && to !== null && from !== to) {
        const newItems = [...items];
        const [moved] = newItems.splice(from, 1);
        newItems.splice(to, 0, moved);
        onReorder(newItems);
      }
    };

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onEnd);
  }, [disabled, items, onReorder, captureRects, overIndex]);

  // Build display order
  const getDisplayItems = () => {
    if (dragIndex === null || overIndex === null) return items.map((item, i) => ({ item, originalIndex: i }));
    
    const display = items.map((item, i) => ({ item, originalIndex: i }));
    const [moved] = display.splice(dragIndex, 1);
    display.splice(overIndex, 0, moved);
    return display;
  };

  const displayItems = getDisplayItems();

  return (
    <div ref={containerRef} className={className}>
      {displayItems.map(({ item, originalIndex }, displayIdx) => (
        <div
          key={keyExtractor(item)}
          data-drag-item
          className={`relative transition-transform duration-150 ${
            originalIndex === dragIndex ? "opacity-50 scale-95" : ""
          }`}
        >
          <div className="flex items-center gap-1">
            {!disabled && (
              <div
                className="cursor-grab active:cursor-grabbing touch-none p-1 rounded-md hover:bg-muted/50 transition-colors"
                onPointerDown={(e) => handleDragStart(originalIndex, e)}
                data-testid={`drag-handle-${keyExtractor(item)}`}
              >
                <GripVertical className="w-4 h-4 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              {renderItem(item, originalIndex)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default DraggableList;
