// Decorative blurred glow blobs behind the game view.
export default function AmbientBackground() {
  const GlowBlob = ({ top, right, bottom, left, width, height, backgroundColor, opacity }) => (
    <div
      className={
        `absolute ${
          top !== undefined ? `top-[${top}%]` : ''
        } ${
          right !== undefined ? `right-[${right}%]` : ''
        } ${
          bottom !== undefined ? `bottom-[${bottom}%]` : ''
        } ${
          left !== undefined ? `left-[${left}%]` : ''
        } w-[${width}%] h-[${height}%] bg-[${backgroundColor}] blur-[120px] rounded-full opacity-[${opacity}]`
      }
    />
  );

  return (
    <div className="fixed inset-0 pointer-events-none">
      <GlowBlob top={10} right={10} width={30} height={30} backgroundColor="var(--c)" opacity={0.04} />
      <GlowBlob bottom={10} left={10} width={30} height={30} backgroundColor="#783cdc" opacity={0.03} />
    </div>
  );
}