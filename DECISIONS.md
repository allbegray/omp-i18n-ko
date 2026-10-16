# omp-ko — 결정 기록

omp(oh-my-pi) 한국어 언어팩 프로젝트. 그릴링 완료 (2026-10-16). 프론티어 소진, 구현 진행.

## 확정된 결정

- **D1. 성격**: 개인용 우선, 공개 가능한 구조. repo 초기화·MIT·README를 처음부터 공개 대비로 잡아, 나중에 공개/비공개를 결정 하나로 전환.
- **D2. 메커니즘**: omp 공식 확장 API만 사용. dist 패치·포크 금지.
  - 이유: omp 업데이트가 잦다. 언어팩 때문에 CLI가 깨지면 안 된다.
  - → 설계 제약으로 승격: **"절대 CLI를 깨뜨리지 않는다"**
    - 확장 로드/핸들러의 예외는 격리 (전파 금지)
    - 번역 데이터가 이상하면 기존 번역 유지 (또는 영어 폴백)
    - 확장 제거 시 흔적 없이 원상복구
- **D3. 토글 UX**: `/ko`(토글 / `off` / `status` / `reload`). **기본 ON**.
- **D4. 번역 톤**: 간결체/명사형 전면. ("설정(settings) 메뉴 열기", "계획(plan): 꺼짐")
- **D5. 용어 정책**: 실행 식별자·고유명사(커맨드명, 모델 id, MCP·SSH·LSP 등)는 영어 유지. 일반 UI 용어는 한국어. 애매한 것만 첫 노출 병기.
- **D6. 구현 기반**: 자체 구현. omp 공식 문서·소스(v18.11.1 릴리즈 기준)만 참고. 서드파티 확장(BAISD007 등)은 참고·차용하지 않음 (사용자 지시). v1 유지보수 = 수동 번역 테이블 + `/ko reload`. 영어 스냅샷/드리프트 도구는 v2 후보.
- **D7. 셋업/이름**: 공식 이름 **omp-i18n-ko**. `omp-ko/`를 git repo(MIT)로, `~/.omp/agent/extensions/omp-i18n-ko` 심링크로 실사용. README 한국어 중심 + 공개 대비 영어 절. 확장 라벨 "한국어".

## v1 구현·검증 (2026-10-16)

- 번역 테이블: **exact 224 / labels 27 / state 42 / statePatterns 9 / textPatterns 3** (+ suffix 1). 로컬 18.11.1 `builtin-*.ts`의 TUI `description` 리터럴 **213개 전수 커버(누락 0)**. 나머지 11개는 다른 모듈의 런타임 문구: `/effort` 8개(pi-tui `thinking.ts`), `/compact` 하위 3개(`session/compact-modes.ts`).
- 중요 발견: 커맨드 정의에 `description`(TUI)과 `acpDescription`(RPC/ACP 클라이언트 목록)이 별도로 존재. 우리 범위는 TUI만. `acpDescription`은 번역하지 않음 (`omp --mode rpc --no-ui` 실측으로 교차 확인).
- `/switch`·`/effort`·`/loop` 상세 설명은 테마 키 글리프(⌥P, ⇧⇥ 등)가 포함된 동적 문자열 → `textPatterns`(전체문자열 정규식, 캡처 보존)로 커버.
- 스모크: 스텁 `pi`로 factory 캡처 → 가짜 아이템의 `description`/`nativeDetail`/`state` 번역 확인, `/ko off` 시 영어 원문 복원, `/ko reload` 재로드(224개), 심링크 경로(`tmp/linktest`)에서도 translations.json 로드 확인. 실제 omp는 RPC 모드 부팅 스모크(`ready` + `available_commands` 정상)로 확인. 대화형 `/` 메뉴 최종 확인은 사용자 육안.
- 알려진 미커버(기술 제약): 커맨드 이름, 팁 라인, 웰컴, 내장 상태줄, 호스트 알림, headless(RPC/ACP) 경로, 사용자 커스텀 커맨드·스킬 설명. (설정 패널은 D11에서 공식 API만으로 해결.)

## 팩트

- omp **18.11.1**, bun 설치(`~/.bun/bin/omp`), `~/.omp/agent/` 존재.
- 코어에 네이티브 i18n 없음. 서드파티 선례(중국어)는 존재하나 참고하지 않음 (사용자 지시, 2026-10-16).
- 기준 버전: **omp v18.11.1** (최신 릴리즈, 2026-10-15). 로컬 설치본이 정확히 이 버전.
- 확장 슬롯: `~/.omp/agent/extensions/`, npm(`omp.extensions`), `/marketplace`, `omp -e`.

## 업스트림 트랙 (조사 완료 — 별도 트랙, v1 이후 판단)

- 기술적으로는 S~M (UI 텍스트 전부 TS 인라인, Rust는 UI 무관. `crates/pi-builtins/locale.rs`는 셸 빌트인 로케일용).
- 정치적으로 risky: i18n PR 7건 전부 close(정책 거부는 아니었음: vouch 시대/스테일 정리/자체 철회), 현재 open 2건(#6401 160파일, #7293 95파일, 둘 다 zh). 관문: "in-tree localization에 대한 메인테이너 의사 확인" (리뷰봇 roboomp, #6401).
- 경로: Discord에서 의사 확인 → #6401 인프라에 ko 로케일 기여(작음) 또는 확장용 문자열 override 훅 제안.
- 우리 번역 데이터(용어집+문자열)는 이 트랙에 재활용 가능한 자산.

## 조사 완료 (확장 API + 한글 렌더링)

- 한글 렌더링: 문제 없음. 한글 음절은 UAX#11 기준 폭 2로 정확히 계산 (Bun.stringWidth + 네이티브 xutf, 한글 코퍼스 패리티 테스트 존재). 유일한 변수는 IME 조합 중 호환 자모 폭(터미널별: Ghostty/Orca 2, Warp 1)인데 omp가 터미널 능력 감지 + 오버라이드로 이미 처리 → 추가 대응 불필요. 결정 항목 아님.
- **커버 가능(확장 API):** 슬래시 메뉴 설명, 인자 자동완성, 선택 설명(nativeDetail), 인라인 힌트, 동적 상태문구. + 옵션: `setWorkingMessage`(작업 표시문), `setTitle`, `setStatus`(추가만).
- **커버 불가(기술 제약):** 커맨드 이름 자체, 팁 라인(tips.txt 빌드 타임 번들), 웰컴/설정 마법사, 설정 패널, 내장 상태줄 세그먼트, 호스트 알림 가로채기. 소스로 확인됨.
- 참고: zh 확장이 쓰는 `ctx.ui.requestRender`는 main에 없음(no-op). 토글 반영은 다음 자연 렌더/슬래시-명령 리프레시 시점. 우리 구현도 이 전제로.
- 자체 설계: `exact` / `labels` / `state` 3층 + `statePatterns`·suffix 규칙 (우리 문자열 인벤토리에서 도출). reload는 파일 재읽기(모듈 캐시 우회). package.json에 `"omp": {"extensions": ["./src/index.ts"]}` 매니페스트.
- omp 최신 릴리스 v18.11.1 (2026-10-15). 우리 설치와 동일.

- **D8. 커버리지 확정**: 코어는 슬래시 메뉴 설명, 인자 자동완성, 선택 설명(nativeDetail), 인라인 힌트, 동적 상태문구. 추가: 작업 표시문(`setWorkingMessage`) → "생각 중…". 제외(v2 후보): `setTitle`, `setStatus`. 불가(기술 제약): 커맨드 이름, 팁, 웰컴, 설정 패널, 상태줄 내장, 호스트 알림.
- **D9. 용어집 코어**: 라운드 3 표 그대로. 톤 사례: "설정(settings) 메뉴 열기" / "계획(plan): 꺼짐" / "도구(tools): 12개 활성 / 20개 사용 가능" / "자동 재개" / "생각 중…".
- **D10. 병기 규칙** (사용자 지시, 2026-10-16). 번역문에서 명령/기능을 가리키는 영어 키워드 W를 한국어 K로 옮길 때 **K(W)**로 병기한다. 예: settings → 설정(settings), plan → 계획(plan), goal → 목표(goal), model → 모델(model).
  - 이유: `/` 메뉴에서 한국어 설명만 보고는 원래 어떤 영어 커맨드를 입력해야 하는지 알기 어렵다. 키보드 타이핑 편의.
  - 범위: 기능/명령 키워드(모드·주요 엔티티)에 적용. 일반 동작 낱말(복사·공유·제거 등)과 이미 영어인 식별자(MCP·SSH·OAuth 등)는 병기 대상 아님.
  - 번역문 안에서 첫 등장 1회만 병기. 한 문자열에 서로 다른 명령 키워드가 주제로 나오면 각각 병기 가능.
  - 커맨드 이름 자체(`/settings`)는 omp가 항상 영어로 표시. 우리가 건드리지 않음(추가 정보 병기일 뿐).

- **D11. 설정 패널 한글화** (사용자 지시: "세팅쪽이 가장 중요", 2026-10-16). 호스트의 실제 `SettingsSelectorComponent`(pi-tui)를 공식 확장 API의 `ui.custom` 오버레이로 그대로 띄우고 (a) 레지스트리 설정 데이터(라벨·설명·옵션 라벨)를 한국어로 바꿔 주입, (b) 렌더 결과의 크롬(제목·탭·섹션명·푸터·검색 배너)을 ANSI 인식·폭보존 라인 번역기로 치환한다.
  - 경로: `ui.custom`에서 `SettingsRuntimeContext`를 구현. 레지스트리 `lookup()/all()` + `orderedSettings()` + CONDITIONS(settings-ui.ts 재현) + theme/model 조회. `pi.pi.settings` 스코프 핸들(`layered()` 읽기 / `set()` 쓰기)로 저장·즉시 반영.
  - 재구현·포크 아님: 컴포넌트 클래스는 호스트 모듈 그대로(`@oh-my-pi/pi-tui/overlays/settings-selector`를 동적 import. omp 로더가 호스트 인스턴스로 해석). 어떤 단계든 실패하면 조용히 내장 영어 `/settings`가 동작.
  - native describe 경로 숨김: Proxy로 `describe`/`describeScreen`/`describeSurface`를 가려 ANSI 렌더 경로를 강제 → 라인 번역기가 개입할 여지 확보.
  - `/settings` 리다이렉트: `registerCommand`는 내장 커맨드를 못 덮으므로 공식 `input` 이벤트에서 `text.trim() === "/settings"`이고 (활성 · 모듈 로드 성공 · `mode === "tui"`)일 때만 `{ text: "/ko settings" }`로 재작성. 그 외엔 내장 영문판 그대로.
  - 번역 데이터: `src/ko-data/*.json`의 탭별 412개 설정 + `chrome.json`(제목·탭·섹션명·힌트·패턴). `_` 접두 키는 무시. `/ko reload`가 재읽기(핫 반복).
  - 폭 제약: 한글은 2셀. 치환은 표시 폭을 보존(좁으면 패딩, 넓으면 뒤 공백 흡수, 불가 시 스킵). 설정 라벨·설명에는 `한국어(english)` 병기를 하지 않음(D10 예외: 폭·가독성; 영어 원문은 설정 id로 복구 가능). 옵션 값 라벨은 예외(아래).
  - 옵션 원값 병기 (사용자 지시, 2026-10-16): 상세 선택 메뉴 라벨과 목록 행의 값 셀을 슬래시 메뉴와 같은 `한국어(원값)` 형식으로 병기(예: `로컬(local)`, `끔(off)`). 설정 파일·문서에 쓰는 원값 확인 용도. 라벨이 원값과 같으면 생략(대소문자 무시), `)`로 끝나는 라벨은 한 칸 띄움. 행 값은 렌더 경계에서 행 라벨 + 원값 토큰을 정확 매칭해 치환(폭 보존, 설명문 오탐 방지). 호스트 옵션 설명 343개도 한국어화(`b8aaaa2`).
  - 검증: 실렌더 라인 기반 51 테스트 + omp 내부 E2E 프로브(`tmp/panel-probe.ts`). 제목·탭(11개)·사이드바·리스트 그룹 헤더·푸터(기본/검색/섹션 모드)·검색 배너(`N건`)까지 한국어, 영문판과 표시 폭 동일(110/110). 탭이 좁은 폭에서 아이콘만 남는 것은 영문판과 동일한 컴포넌트 반응형 동작.
  - 기준 v18.11.1. 업스트림 업데이트로 모듈 경로·시그니처가 바뀌면 이 기능만 비활성(영어 폴백). CLI는 불변.

- **D12. 배포·설치 방식** (사용자 지시: "한줄 설치 가이드", 2026-10-16). 1차 설치 경로를 omp 공식 `omp install`(플러그인 링크)로 승격. README 한 줄: `git clone https://github.com/allbegray/omp-i18n-ko.git ~/omp-i18n-ko && omp install ~/omp-i18n-ko`.
  - 근거: `omp install <path>`는 `~/.omp/plugins/node_modules/<name>` 심링크 + `omp-plugins.lock.json` 등록을 만들고 확장 로더(`extensions/loader.ts`)가 `getAllPluginExtensionPaths`로 플러그인 `omp.extensions` 매니페스트를 로드한다. 공식 경로, 관리(`omp plugin list/uninstall/enable/disable`)까지 붙는다.
  - 검증: 임시 HOME 3중 부팅(설치=로드됨 · 무설치=미로드 · 기존 심링크=로드됨), `ready`+`available_commands` 카탈로그에 `/ko` 표시, `extension_error` 0, stderr 0줄. 실사용 환경도 심링크 → 플러그인 링크로 마이그레이션 완료.
  - 수동 심링크는 대안으로 문서 유지(구버전 omp용). 동시 사용 금지(중복 로드).
  - npm 배포는 D13에서 진행 (2026-10-16).
  - 문서 자산: README 스크린샷은 실제 omp v18.11.1 TUI를 **VHS**(`brew install vhs`, 테이프 `tmp/shots/*.tape`, 로컬 전용)로 캡처해 `assets/`에 저장. CHANGELOG(Keep a Changelog ko)·SECURITY.md 추가.

- **D13. npm 배포·릴리스 자동화** (사용자 지시: "npmjs 같은곳에 배포", "github workflow로 배포", 2026-10-16). 1차 설치 경로를 npm으로 승격: README 한 줄 `omp install omp-i18n-ko`. 이후 모든 릴리스는 **`v*` 태그 푸시 → GitHub Actions가 npm Trusted Publishing(OIDC)으로 자동 게시**(provenance 자동 생성, 토큰 없음).
  - npm 제약 실측·확인: (a) 계정 2FA 없이는 레지스트리가 게시를 거부(`npm profile get` → `two-factor auth: disabled`, 게시 시 403 "Two-factor authentication ... is required"), (b) 신규 패키지의 OIDC 첫 게시는 미지원(npm/cli#8544 open: "package must exist"), `npm trust`도 동일 전제 + 계정 2FA 필수. → 첫 버전 0.1.0만 수동 게시로 이름을 선점하고 `npm trust github omp-i18n-ko --file publish.yml --repo allbegray/omp-i18n-ko --allow-publish`로 신뢰 관계 등록(등록 후 2일 내 실제 게시로 검증. 0.1.1 태그로 즉시 검증), 0.1.1부터 전부 CI 자동 게시.
  - 워크플로(`.github/workflows/publish.yml`): 태그 = package.json 버전 검증, 이미 게시된 버전은 스킵(멱등, 과거 태그 재푸시 안전), `permissions: id-token: write` + `npm publish --access public`. npm CLI는 `npm@latest`로 최신화(11.15+ 필요). 테스트 CI(`test.yml`)는 push/PR마다 `bun test`.
  - npm 패키지 내용: `src/**`(테스트 제외)·README·CHANGELOG·LICENSE. `npm pack --dry-run` 20개 파일/60.6kB 확인. `prepublishOnly: bun test` 게이트로 로컬 게시 사고 방지.
  - 부트스트랩 실측 (2026-10-16): npmjs TOTP 단종 → 패스키 2FA 활성화(`npm profile get` → `auth-and-writes`). `npm publish`는 브라우저 인증 흐름(`Authenticate your account at: https://www.npmjs.com/auth/cli/…`, ENTER로 브라우저 열고 승인)으로 0.1.0 게시. 신규 패키지는 npm이 `0.0.0-stage` 자리표시자를 자동 생성한 뒤 0.1.0을 공개. 2026-10-02부터 신규 패키지 게시가 스테이징 체계로 바뀌어 자리표시자 버전이 versions 목록에 남는다(무해, latest=0.1.0). `npm trust github omp-i18n-ko --file publish.yml --repo allbegray/omp-i18n-ko --allow-publish -y`로 신뢰 관계 등록(id `e7bc451c…`, permissions: `publish, stage publish`). 등록 후 2일(48시간) 내 OIDC 실제 게시로 검증해야 하므로 v0.1.1 태그로 즉시 검증.
  - 검증 완료 (2026-10-16): v0.1.1 태그 → Publish 워크플로 성공 → `omp-i18n-ko@0.1.1` 공개, `dist.attestations.provenance` = SLSA Provenance v1 첨부 확인. 첫 OIDC 게시가 그 자리에서 2일 검증 창을 충족. v0.1.0 태그 런은 "이미 게시된 버전" 가드로 스킵(멱등 확인). 격리 HOME에서 `omp install omp-i18n-ko` → `Installed omp-i18n-ko@0.1.1`, RPC 부팅 `ready` 1 · 카탈로그 `ko`(한국어 설명) · `extension_error` 0 · stderr 0줄. npm 경로의 실설치·로드 검증.
  - 실사용 환경은 로컬 소스 링크 설치 유지 (사용자 결정, 2026-10-16): 로컬 번역 수정이 즉시 반영되는 개발 환경으로 사용. npm 패키지는 배포·신규 설치용. `omp plugin upgrade`로 갱신되는 경로와 로컬 링크 경로를 의도적으로 분리 운영.

- **D14. README 단일 언어** (사용자 결정, 2026-10-16). D7의 "공개 대비 영어 절"을 개정: 영어 절을 제거하고 README는 한국어 단일로 유지. 대상 독자는 한국어 사용자이고 npm README도 같은 내용으로 렌더된다.
  - 적용 확장: SECURITY.md의 영어 절도 제거해 한국어 단일로 통일 (`d0f7293`).

- **D15. 한국어 문체·표기 통일** (사용자 지시, 2026-10-16). im-not-ai humanize 스킬로 문서 5종(README·AGENTS·SECURITY·CHANGELOG·DECISIONS)을 윤문한 기준(`4435890`)을 코드·로케일 문자열로 확장(`66d9be0`). 적용 범위: 문서, `translations.json`, `ko-data/*.json`, 코드 내 사용자 문구.
  - 문체: D4 유지. 알림·검증 문구까지 전면 명사형/간결체. 합쇼체·해요체 금지. 예: "…를 찾을 수 없습니다" → "… 없음", "…여야 합니다" → "…만 허용", "…열 수 있습니다" → "…전용".
  - 구두점: em-dash(—) 금지(문서 제목은 기존 표기 유지), 문맥에 따라 `;` `:` `()` `→`로 대체. 숫자 범위의 en-dash(–)는 허용. 연결어미 앞 쉼표(`~하고,` 형태) 금지.
  - 용어: provider = **제공자**(공급자 금지). 슬래시 메뉴와 설정 패널 표기가 같아야 한다. 설정 패널 Memory 탭은 **메모리**(기억 금지). 그 밖의 용어집은 D9.
  - 정리 결과: 제공자 47곳·em-dash 30곳(ko-data 21)·합쇼체 6곳·연결어미 쉼표 1곳·번역투 4종 수정. 잔여 패턴 스캔 0건, `bun test` 51개 통과.

## 그릴링 종료 (2026-10-16)

프론티어 소진. 모든 결정 확정. 구현 시작.
