# Node.js LTS 버전 사용
FROM node:20-alpine

# 작업 디렉토리 설정
WORKDIR /app

# 패키지 파일 복사 및 설치
# package.json이 아직 없다면 빌드 시 에러가 날 수 있으니
# 로컬에서 먼저 React 프로젝트를 초기화해야 합니다.
COPY package*.json ./

# 의존성 설치
# strict-ssl false: 로컬 네트워크 SSL 프록시 대응
# npm install: package-lock.json 자동 갱신 (dev 환경)
RUN npm config set strict-ssl false && npm install

# 소스 코드 복사
COPY . .

# 개발 서버 실행 (Vite)
CMD ["npm", "run", "dev", "--", "--host"]