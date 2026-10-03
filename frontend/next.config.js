/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: {
    appIsrStatus: false,
    buildActivity: false,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
};

module.exports = nextConfig;
