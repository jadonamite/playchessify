export default function AmbientBackground() {
  const blobStyles = (top: string, right: string, color: string, opacity: string) => ({
    position: 'absolute',
    top,
    right,
    width: '30%',
    height: '30%',
    backgroundColor: color,
    blur: '120px',
    borderRadius: '50%',
    opacity
  });

  return (
    <div className="fixed inset-0 pointer-events-none">
      <div style={blobStyles('10%', '10%', 'var(--c)', '0.04')} className="rounded-full" />
      <div style={blobStyles('10%', undefined, '#783cdc', '0.03')} className="bottom-[10%] left-[10%] rounded-full" />
    </div>
  );
}