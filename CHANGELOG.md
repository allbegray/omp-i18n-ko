# 변경 기록 (Changelog)

[Keep a Changelog](https://keepachangelog.com/ko/1.1.0/) 형식을 따르며, [유의적 버전](https://semver.org/lang/ko/)을 사용합니다.

## [0.1.0] — 2026-10-16

첫 공개 릴리즈. 기준: **omp v18.11.1**.

### 추가

- **슬래시 커맨드(`/`) 메뉴 한국어화** — 커맨드 설명·인자 자동완성·동적 상태 문자열과 작업 표시문(`생각 중…`)까지 번역 (exact 224 / labels 27 / state 42 / statePatterns 9 / textPatterns 3).
- **설정 패널 한국어화** — 내장 `SettingsSelectorComponent`를 공식 `ui.custom` 오버레이로 띄워 제목·탭·섹션명·푸터·검색 배너와 전 탭 설정 라벨·설명·옵션 412개를 한국어로 표시. `/settings` 입력 시 자동으로 한국어 패널이 열립니다.
- **`/ko` 커맨드** — `toggle` / `on` / `off` / `status` / `reload` / `settings` (기본값 켜짐).
- **한 줄 설치** — omp 공식 `omp install`(플러그인 링크) 지원: `git clone … && omp install …`.
- **문서** — README 한국어/영어, 스크린샷(실제 omp TUI 캡처), DECISIONS.md, CHANGELOG.md, SECURITY.md.

### 안전

- 모든 확장 경로(로드·핸들러·번역 함수)를 `try/catch`로 격리 — 실패 시 영어 원문 폴백, **CLI는 영향받지 않음**.
- `translations.json`·`ko-data` 로드 실패 시 이전 번역 유지, 재시작 시 영어 폴백.
- 확장 제거(`omp plugin uninstall omp-i18n-ko`) 시 흔적 없음.
- 실행 식별자(커맨드명·모델 id·MCP/SSH/LSP 등)는 항상 영어 유지.
