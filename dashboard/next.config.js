const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5005';

const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${API_URL}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
