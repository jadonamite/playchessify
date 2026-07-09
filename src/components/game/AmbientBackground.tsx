import React from 'react';

// Decorative blurred glow blobs behind the game view.
const getGlowBlobClasses = (top: boolean, left: boolean, color: string, opacity: string) => {
  const position = top ? 'top' : 'bottom';
  const side = left ? 'left' : 'right';
  return `absolute ${position}-[10%] ${side}-[10%] w-[30%] h-[30%] bg-[${color}] blur-[120px] rounded-full opacity-[${opacity}]`;
};

export default function AmbientBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none">
      <div className={getGlowBlobClasses(true, false, 'var(--c)', '0.04')} />
      <div className={getGlowBlobClasses(false, true, '#783cdc', '0.03')} />
    </div>
  )
}