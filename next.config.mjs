// next.config.mjs

/** @type {import('next').NextConfig} */
const nextConfig = {
  // 1. Otimizações de Imagem
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60 * 60 * 24, // 24 horas de cache
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    
    // Padrões de URLs remotas permitidas
    remotePatterns: [
      // Supabase Storage (permite qualquer projeto seu)
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
      // Provedores populares / CDNs (Unsplash, GitHub, Google, Cloudinary)
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        pathname: '/**',
      },
      // Permite localhost/desenvolvimento local se servir imagens de API local
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3000',
        pathname: '/**',
      },
    ],
  },

  // 2. Recursos Experimentais & Compilador
  experimental: {
    reactCompiler: true, // Habilita o React Compiler
    serverActions: {
      bodySizeLimit: '10mb', // Útil para upload direto de imagens/arquivos
    },
  },

  // 3. Performance & Otimização de Produção
  reactStrictMode: true,
  compress: true,
  poweredByHeader: false, // Remove o header 'X-Powered-By: Next.js' por segurança

  // 4. Headers de Segurança Recomendados
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ]
  },
};

export default nextConfig;