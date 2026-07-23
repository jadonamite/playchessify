// Decorative blurred glow blobs behind the game view.
export default function AmbientBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none">
      <div className="absolute top-[10%] right-[10%] w-[30%] h-[30%] bg-[var(--c)] blur-[120px] rounded-full opacity-[0.04]" />
      <div className="absolute bottom-[10%] left-[10%] w-[30%] h-[30%] bg-[#783cdc] blur-[120px] rounded-full opacity-[0.03]" />
    </div>
  )
}
