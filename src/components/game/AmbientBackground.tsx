// Decorative blurred glow blobs behind the game view.
export default function AmbientBackground() {
  const Blob = ({ className, style }) => (
    <div className={className} style={style} />
  );

  return (
    <div className="fixed inset-0 pointer-events-none">
      <Blob
        className="absolute top-[10%] right-[10%] rounded-full"
        style={{
          width: '30%',
          height: '30%',
          backgroundColor: 'var(--c)',
          filter: 'blur(120px)',
          opacity: 0.04,
        }}
      />
      <Blob
        className="absolute bottom-[10%] left-[10%] rounded-full"
        style={{
          width: '30%',
          height: '30%',
          backgroundColor: '#783cdc',
          filter: 'blur(120px)',
          opacity: 0.03,
        }}
      />
    </div>
  );
}