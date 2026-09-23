import { defineConfig } from 'vite';

export default defineConfig({
  // 상대 경로로 빌드해서 GitHub Pages 같은 하위 경로 배포에서도 동작하게 한다.
  base: './',
  server: { open: true },
});
