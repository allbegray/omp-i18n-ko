# 변경 기록 (Changelog)

[Keep a Changelog](https://keepachangelog.com/ko/1.1.0/) 형식을 따르며 [유의적 버전](https://semver.org/lang/ko/)을 사용합니다.

## [0.1.3] — 2026-10-16

설정 패널 옵션 한국어 전수화 릴리즈. 기준: **omp v18.11.1**.

### 변경

- **옵션 설명 한국어화**: 설정 상세 메뉴의 옵션별 설명 전수 번역. 1차 343개(호스트 `ui.options`)에 이어, 상수 참조·동적 옵션(압축 방식 순서, 서비스 티어 5종, 사고 수준, 스폰별 최대 Effort, tiny 모델 장치·dtype, STT 제출 트리거, 이미지 URL 백엔드 50종)의 설명과 누락 라벨까지 마무리.
- **원값 병기**: 상세 메뉴 라벨과 목록 값 셀을 슬래시 메뉴와 같은 `한국어(원값)` 형식으로 표기(예: `로컬(local)`, `기본(default)`). 설정 파일·문서에 쓰는 원값을 화면에서 바로 확인 가능.
- **메뉴 안내 한국어화**: 멀티셀렉트·텍스트 입력 안내(클릭 토글·드래그 재정렬·저장·필드 비우면 해제 등) 번역 보강.

### 문서

- README 스크린샷(VHS) 최신 UI로 재캡처: 원값 병기, 제공자·메모리 용어 반영. DECISIONS D11 보완.

## [0.1.2] — 2026-10-16

한국어 문체·표기 전수 정리 릴리즈. 기준: **omp v18.11.1**.

### 변경

- **한국어 문체·용어 통일 (D15)**: 코드·로케일 문자열 전수 정리. provider 표기를 `제공자`로 통일(47곳), 합쇼체·해요체 제거(알림·검증 문구 6곳), em-dash 제거(30곳 → `;` `:` `()` `→`), 번역투 수정(계획 너지 → 계획 유도 등).
- **설정 패널 표기**: Memory 탭 `기억` → `메모리`, 서비스 티어 라벨을 `OpenAI 서비스 티어` 형태로, ask 타임아웃 `0` 옵션을 `끔`으로(설명과 일치).
- **문서 한국어 단일 (D14)**: README·SECURITY 영어 절 제거. 문서 5종 AI 티 윤문(em-dash·연결어미 쉼표·본문 볼드 정리).

### 추가

- **AGENTS.md**: 에이전트용 저장소 지침(명령·구조·번역 규칙·릴리스 절차).
- **DECISIONS.md**: D13 npm 검증·로컬 링크 유지, D14 한국어 단일, D15 문체·표기 기준 기록.

## [0.1.1] — 2026-10-16

첫 npm 배포 릴리즈. 기준: **omp v18.11.1**.

### 추가

- **npm 배포**: 한 줄 설치 `omp install omp-i18n-ko`. 신규 패키지의 OIDC 첫 게시는 npm이 지원하지 않아 0.1.0은 수동 게시로 이름을 선점했고 0.1.1부터는 전부 GitHub Actions가 자동 게시합니다.
- **GitHub Actions 릴리스 파이프라인**: `v*` 태그 푸시 → npm **Trusted Publishing(OIDC)** 게시 + provenance 자동 생성 (`.github/workflows/publish.yml`). 테스트 CI 워크플로(`.github/workflows/test.yml`) 추가.

### 변경

- README 설치 안내: npm 설치를 1차 경로로, git clone은 개발판 설치로 재정리.

## [0.1.0] — 2026-10-16

첫 공개 릴리즈. 기준: **omp v18.11.1**.

### 추가

- **슬래시 커맨드(`/`) 메뉴 한국어화**: 커맨드 설명·인자 자동완성·동적 상태 문자열과 작업 표시문(`생각 중…`)까지 번역 (exact 224 / labels 27 / state 42 / statePatterns 9 / textPatterns 3).
- **설정 패널 한국어화**: 내장 `SettingsSelectorComponent`를 공식 `ui.custom` 오버레이로 띄워 제목·탭·섹션명·푸터·검색 배너와 전 탭 설정 라벨·설명·옵션 412개를 한국어로 표시. `/settings` 입력 시 자동으로 한국어 패널이 열립니다.
- **`/ko` 커맨드**: `toggle` / `on` / `off` / `status` / `reload` / `settings` (기본값 켜짐).
- **한 줄 설치**: omp 공식 `omp install`(플러그인 링크) 지원: `git clone … && omp install …`.
- **문서**: README 한국어/영어, 스크린샷(실제 omp TUI 캡처), DECISIONS.md, CHANGELOG.md, SECURITY.md.

### 안전

- 모든 확장 경로(로드·핸들러·번역 함수)를 `try/catch`로 격리. 실패 시 영어 원문 폴백, CLI는 영향받지 않음.
- `translations.json`·`ko-data` 로드 실패 시 이전 번역 유지, 재시작 시 영어 폴백.
- 확장 제거(`omp plugin uninstall omp-i18n-ko`) 시 흔적 없음.
- 실행 식별자(커맨드명·모델 id·MCP/SSH/LSP 등)는 항상 영어 유지.
