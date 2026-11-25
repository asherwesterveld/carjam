import React, { useMemo } from 'react';
import QRCode from 'qrcode';

interface QrCodeSvgProps {
  value: string;
  size?: number;
  className?: string;
}

/**
 * Synchronous, offline vector SVG QR code (prints razor-sharp at any DPI).
 */
export const QrCodeSvg: React.FC<QrCodeSvgProps> = ({
  value,
  size,
  className,
}) => {
  const qr = useMemo(() => {
    try {
      const data = QRCode.create(value, { errorCorrectionLevel: 'M' });
      const count = data.modules.size;
      const parts: string[] = [];
      for (let r = 0; r < count; r++) {
        for (let c = 0; c < count; c++) {
          if (data.modules.get(r, c)) {
            parts.push(`M${c},${r}h1v1h-1z`);
          }
        }
      }
      return { count, path: parts.join('') };
    } catch {
      return null;
    }
  }, [value]);

  if (!qr) return null;

  const quiet = 2;
  const viewSize = qr.count + quiet * 2;

  return (
    <svg
      viewBox={`${-quiet} ${-quiet} ${viewSize} ${viewSize}`}
      width={size}
      height={size}
      className={className}
      shapeRendering="crispEdges"
      role="img"
      aria-label={`QR code for ${value}`}
    >
      <rect
        x={-quiet}
        y={-quiet}
        width={viewSize}
        height={viewSize}
        fill="#FFFFFF"
      />
      <path d={qr.path} fill="#0F172A" />
    </svg>
  );
};
