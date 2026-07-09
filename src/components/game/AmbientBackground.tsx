import React from 'react';

const useGlowBlobStyles = (top: boolean, left: boolean, color: string, opacity: string) => ({
  position: 'absolute',
  width: '30%',
  height: '30%',
  backgroundColor: color,
  blur: '120px',
  borderRadius: '50%',
  opacity: opacity,
  ...((top && { top: '10%' }) || { bottom: '10%' }),
  ...((left && { left: '10%' }) || { right: '10%' }),
});

export default function AmbientBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none">
      <div style={useGlowBlobStyles(true, false, 'var(--c)', '0.04')} className="rounded-full" />
      <div style={useGlowBlobStyles(false, true, '#783cdc', '0.03')} className="rounded-full" />
    </div>
  );
}