# WineCellar 배포 가이드

이 폴더는 **파일명 수정 완료 + 취향 비교/시음 타임라인 패치 완료** 상태입니다.
압축 해제 후 아래 순서대로 진행하세요. (로컬 = 본인 PC)

## 0. 준비
- Node.js 18+ 설치되어 있어야 함 (`node -v`로 확인)
- 압축을 풀면 구조는 이미 정상입니다:
  ```
  index.html  package.json  vite.config.js  vercel.json  .gitignore
  src/  → App.jsx  main.jsx  storage.js
  wine-cellar-import.json
  ```
  ※ `.gitignore`는 점(.)으로 시작 — 일부 OS에서 숨김 처리될 수 있음(정상)

## 1. 로컬 검증
```bash
npm install
npm run dev        # http://localhost:5173 자동 열림
```
- 앱이 뜨면 ⚙️ 설정 → Gemini API 키 입력
- 셀러 탭 → JSON 불러오기 → wine-cellar-import.json (135병) 임포트
- 📊 통계 탭 스크롤 → «💑 취향 비교», «📜 시음 타임라인» 확인
- ⚠️ 임포트 데이터엔 시음노트가 0개라, 두 섹션은 처음엔 안내 문구만 나옴(정상).
  시음노트를 몇 개 추가하면 채워집니다.

## 2. 프로덕션 빌드 확인
```bash
npm run build      # dist/ 생성, 에러 없어야 함
npm run preview    # 배포본과 동일하게 로컬 미리보기
```

## 3. GitHub 푸시
```bash
git init
git add .
git commit -m "WineCellar: 취향 비교 + 시음 타임라인"
git remote add origin https://github.com/<본인계정>/wine-cellar.git
git branch -M main
git push -u origin main
```

## 4. Vercel 배포
1. vercel.com 로그인(GitHub 연동) → New Project → repo Import
2. 자동 감지 확인: Framework = Vite · Build = `npm run build` · Output = `dist`
3. 환경변수 불필요 (Gemini 키는 배포 후 앱 설정에서 입력)
4. Deploy → 1~2분 후 https://....vercel.app 생성

## 5. 배포 후
- 배포 URL 접속 → ⚙️ 설정에 Gemini 키 입력
- JSON 다시 불러오기 (localStorage는 도메인별이라 로컬 데이터는 안 따라옴)
- 모바일에서도 같은 URL로 확인

## 이후 작업 루프
로컬 수정 → `npm run dev` 확인 → `git push` → Vercel 자동 재배포

## 남은 과제 (배포 후)
- AI 라벨 스캐너 마무리 (callGeminiVision + «라벨 스캔» 진입점) — 실제 Gemini로 검증
- Firebase 동기화 (PC↔모바일 실시간)
