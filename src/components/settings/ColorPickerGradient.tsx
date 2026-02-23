import { useState, useRef, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";

interface ColorPickerGradientProps {
  value: string;
  onChange: (color: string) => void;
  label: string;
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function hexToHSL(hex: string): { h: number; s: number; l: number } {
  hex = hex.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0,
    s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

export function ColorPickerGradient({ value, onChange, label }: ColorPickerGradientProps) {
  const [isOpen, setIsOpen] = useState(false);
  const hsl = hexToHSL(value);
  const [hue, setHue] = useState(hsl.h);
  const [saturation, setSaturation] = useState(hsl.s);
  const [lightness, setLightness] = useState(hsl.l);

  const satLightRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<"sl" | "hue" | null>(null);

  // Sync state when value prop changes externally
  useEffect(() => {
    const newHsl = hexToHSL(value);
    setHue(newHsl.h);
    setSaturation(newHsl.s);
    setLightness(newHsl.l);
  }, [value]);

  const emitColor = useCallback(
    (h: number, s: number, l: number) => {
      onChange(hslToHex(h, s, l));
    },
    [onChange]
  );

  const handleSLInteraction = useCallback(
    (clientX: number, clientY: number) => {
      const rect = satLightRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
      const s = Math.round(x * 100);
      const l = Math.round((1 - y) * 100);
      setSaturation(s);
      setLightness(l);
      emitColor(hue, s, l);
    },
    [hue, emitColor]
  );

  const handleHueInteraction = useCallback(
    (clientX: number) => {
      const rect = hueRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const h = Math.round(x * 360);
      setHue(h);
      emitColor(h, saturation, lightness);
    },
    [saturation, lightness, emitColor]
  );

  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!dragging.current) return;
      e.preventDefault();
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      if (dragging.current === "sl") handleSLInteraction(clientX, clientY);
      if (dragging.current === "hue") handleHueInteraction(clientX);
    };
    const handleUp = () => {
      dragging.current = null;
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    window.addEventListener("touchmove", handleMove, { passive: false });
    window.addEventListener("touchend", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleUp);
    };
  }, [handleSLInteraction, handleHueInteraction]);

  return (
    <div className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 group"
      >
        <div
          className="w-10 h-10 rounded-xl border-2 border-border shadow-sm transition-transform group-hover:scale-105 group-active:scale-95"
          style={{ backgroundColor: value }}
        />
        <div className="text-left">
          <span className="text-xs text-muted-foreground block">{label}</span>
          <span className="text-xs font-mono text-foreground/70 uppercase">{value}</span>
        </div>
      </button>

      {/* Picker Panel */}
      {isOpen && (
        <div className="absolute z-50 mt-2 left-0 right-0 sm:left-auto sm:right-auto sm:w-[260px] bg-card border border-border rounded-2xl shadow-xl p-4 space-y-3 animate-in fade-in-0 zoom-in-95 duration-200">
          {/* Saturation/Lightness area */}
          <div
            ref={satLightRef}
            className="relative w-full h-40 rounded-xl cursor-crosshair touch-none overflow-hidden"
            style={{
              background: `
                linear-gradient(to top, #000, transparent),
                linear-gradient(to right, #fff, hsl(${hue}, 100%, 50%))
              `,
            }}
            onMouseDown={(e) => {
              dragging.current = "sl";
              handleSLInteraction(e.clientX, e.clientY);
            }}
            onTouchStart={(e) => {
              dragging.current = "sl";
              handleSLInteraction(e.touches[0].clientX, e.touches[0].clientY);
            }}
          >
            {/* Cursor */}
            <div
              className="absolute w-5 h-5 rounded-full border-[3px] border-white shadow-md pointer-events-none -translate-x-1/2 -translate-y-1/2"
              style={{
                left: `${saturation}%`,
                top: `${100 - lightness}%`,
                backgroundColor: value,
              }}
            />
          </div>

          {/* Hue slider */}
          <div
            ref={hueRef}
            className="relative w-full h-4 rounded-full cursor-pointer touch-none"
            style={{
              background:
                "linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)",
            }}
            onMouseDown={(e) => {
              dragging.current = "hue";
              handleHueInteraction(e.clientX);
            }}
            onTouchStart={(e) => {
              dragging.current = "hue";
              handleHueInteraction(e.touches[0].clientX);
            }}
          >
            <div
              className="absolute w-5 h-5 rounded-full border-[3px] border-white shadow-md pointer-events-none -translate-x-1/2 top-1/2 -translate-y-1/2"
              style={{
                left: `${(hue / 360) * 100}%`,
                backgroundColor: `hsl(${hue}, 100%, 50%)`,
              }}
            />
          </div>

          {/* Preview + hex input */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div
                className="w-8 h-8 rounded-lg border border-border shrink-0"
                style={{ backgroundColor: value }}
              />
              <input
                type="text"
                value={value}
                onChange={(e) => {
                  let v = e.target.value;
                  if (!v.startsWith("#")) v = "#" + v;
                  if (/^#[0-9a-fA-F]{0,6}$/.test(v)) {
                    if (v.length === 7) {
                      onChange(v);
                    }
                  }
                }}
                maxLength={7}
                className="w-[5.5rem] text-xs font-mono uppercase bg-muted/50 border border-border rounded-lg px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="#000000"
              />
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-xs font-medium text-primary hover:underline shrink-0"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
