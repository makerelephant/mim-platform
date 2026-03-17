"use client";

/* eslint-disable @next/next/no-img-element */

/**
 * Me Page — Personal profile and settings
 * Placeholder until full design is ready.
 */

export default function MePage() {
  return (
    <div
      className="min-h-full"
      style={{
        backgroundImage: "url('/icons/background.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="mx-auto py-6 flex flex-col gap-[24px] items-center" style={{ width: "499px" }}>
        {/* Header card matching Motion/Clearing pattern */}
        <div
          className="flex flex-col gap-[12px] items-start p-[12px] rounded-[12px] shadow-[0px_0px_60px_0px_rgba(0,0,0,0.12)] w-full"
          style={{ backgroundColor: "rgba(255,244,224,0.2)" }}
        >
          <div className="flex gap-[6px] items-end pr-[6px] w-full">
            <img
              src="/icons/mark-avatar.png"
              alt="Mark Slater"
              className="w-[34px] h-[34px] rounded-full object-cover shrink-0"
            />
            <span
              className="text-[18px] font-medium text-[#9ca5a9] leading-[20px] text-center whitespace-nowrap"
              style={{
                fontFamily: "var(--font-geist-sans), 'Geist', sans-serif",
                letterSpacing: "-0.36px",
              }}
            >
              Mark Slater, CEO
            </span>
          </div>
          <span
            className="text-[18px] font-semibold text-[#1e252a] leading-[20px] whitespace-nowrap"
            style={{
              fontFamily: "var(--font-geist-sans), 'Geist', sans-serif",
              letterSpacing: "-0.36px",
            }}
          >
            Profile & Settings
          </span>
        </div>

        {/* Coming soon placeholder */}
        <div
          className="flex flex-col items-center justify-center p-[24px] rounded-[12px] shadow-[0px_0px_60px_0px_rgba(0,0,0,0.12)] w-full bg-white"
          style={{ minHeight: "200px" }}
        >
          <img
            src="/icons/MiMbrain Icon.png"
            alt="MiMBrain"
            className="opacity-20 mb-4"
            style={{ width: "48px", height: "34px" }}
          />
          <p
            className="text-[14px] text-[#9ca5a9] leading-[20px] text-center"
            style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}
          >
            Profile and settings coming soon.
          </p>
        </div>
      </div>
    </div>
  );
}
