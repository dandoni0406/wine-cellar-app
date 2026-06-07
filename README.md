# 🍷 WineCellar — 내 와인 셀러

개인 와인 컬렉션 관리 앱. 셀러 관리, AI 와인 정보 조회, 시음 노트, 통계 대시보드, 음용 적기 알림, 가성비 분석을 제공합니다.

## 로컬 실행

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:5173` 가 자동으로 열립니다.

## 빌드

```bash
npm run build      # dist/ 폴더에 정적 파일 생성
npm run preview    # 빌드 결과 미리보기
```

## 배포 (Vercel)

1. 이 폴더를 GitHub 저장소로 push
2. [vercel.com](https://vercel.com) → New Project → 저장소 선택
3. Framework Preset: **Vite** 자동 인식 → Deploy
4. `vercel.json` 이 SPA 라우팅을 처리합니다

또는 CLI로:

```bash
npm i -g vercel
vercel
```

## AI 기능 설정 (Gemini)

배포된 앱에서 AI 기능(와인 정보 자동 조회, 상세 정보 채우기, 추천)을 쓰려면 무료 Gemini API 키가 필요합니다.

1. [aistudio.google.com/apikey](https://aistudio.google.com/apikey) 에서 키 발급 (무료, 하루 1,500회)
2. 앱 우측 상단 **⚙️ 설정** → AI 제공자 **Gemini Flash** 선택 → 키 붙여넣기

> 참고: Claude 직접 호출은 Claude.ai 아티팩트 환경에서만 작동하므로, 배포 버전은 Gemini를 사용합니다.

## 데이터 저장

현재는 브라우저 `localStorage` 에 저장됩니다 (`src/storage.js`).

- 기기/브라우저별로 데이터가 분리됩니다
- 헤더의 **📤 내보내기 / 📥 불러오기** 로 JSON 백업·이전 가능

### 실시간 동기화로 전환 (Firebase)

PC ↔ 모바일 실시간 동기화가 필요하면 `src/storage.js` 한 파일만 Firebase Firestore 구현으로 교체하면 됩니다. 앱 코드는 `window.storage.get/set/list` 인터페이스만 쓰므로 나머지는 그대로 둡니다.

## 데이터 임포트

`wine-cellar-import.json` (Google Sheets에서 변환한 135병 데이터) 을 헤더 **📥 불러오기** 로 가져올 수 있습니다.

## 기술 스택

- React 18 + Vite
- 의존성 없는 단일 컴포넌트 구조 (`src/App.jsx`)
- localStorage 추상화 (`src/storage.js`)
