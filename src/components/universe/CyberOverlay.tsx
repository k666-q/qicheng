"use client";

/**
 * 赛博朋克全屏叠加层：扫描线纹理 + 青/品红氛围光。
 * 与 CosmicBackground 搭配使用，一行挂到页面根部即可。
 */
export function CyberOverlay() {
  return (
    <>
      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute left-1/2 top-[8%] h-[480px] w-[480px] -translate-x-1/2 rounded-full bg-cyan-500/[0.05] blur-[120px]" />
        <div className="absolute right-[10%] bottom-[15%] h-[360px] w-[360px] rounded-full bg-fuchsia-500/[0.04] blur-[120px]" />
      </div>
      <div className="cyber-scanlines fixed inset-0 z-30" />
    </>
  );
}
