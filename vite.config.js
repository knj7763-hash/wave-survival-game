import { defineConfig } from 'vite';

export default defineConfig({
  // 상대 경로로 빌드해서 GitHub Pages 같은 하위 경로 배포에서도 동작하게 한다.
  base: './',
  // PNG/는 원본 에셋 팩 (게임은 public/assets의 복사본을 씀). 감시하지 않아야 파일 복사 중 서버가 죽지 않는다.
  server: { open: true, watch: { ignored: ['**/PNG/**'] } },
});
