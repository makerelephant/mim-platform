import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hides the corner dev badge / “N issues” count during design work.
  // Real errors still show via the error overlay and the terminal.
  devIndicators: false,
};

export default nextConfig;
