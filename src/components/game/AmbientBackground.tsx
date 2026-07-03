export const blobStyles = (color: string, opacity: string) => ({
  position: 'absolute',
  width: '30%',
  height: '30%',
  backgroundColor: color,
  blur: '120px',
  borderRadius: '50%',
  opacity: opacity
});

export default function AmbientBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none">
      <div className="top-[10%] right-[10%]" style={blobStyles('var(--c)', '0.04')} />
      <div className="bottom-[10%] left-[10%]" style={blobStyles('#783cdc', '0.03')} />
    </div>
  );
}