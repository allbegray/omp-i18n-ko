# AGENTS.md

omp(oh-my-pi)용 한국어 UI 언어팩 확장(`omp-i18n-ko`). omp 공식 확장 API만 사용한다. 최우선 불변식: CLI를 절대 깨뜨리지 않는다. 모든 실패 경로는 영어 원문으로 폴백한다.

## 명령

```bash
bun test                                  # 전체 스위트 (의존성 0, 설치 단계 불필요)
bun test src/ko/line-translate.test.ts    # 단일 파일
bun test -t "displayWidth"                # 이름 필터
```

lint·typecheck·빌드 단계 없음. TypeScript를 bun/omp가 직접 실행한다. 새로 추가하지 않는다.

동작 확인: 실제 omp 세션에서 `/ko status`. 화면 없이 확장 로드만 확인하려면 `omp --mode rpc --no-ui` 부팅 후 카탈로그에 `"name":"ko"` 포함 + `extension_error` 0을 확인한다. 설정 패널은 대화형 TUI에서만 동작한다(`ctx.mode === "tui"`).

## 구조

- `src/index.ts`: 확장 진입점(`package.json` → `omp.extensions`). `/ko`(toggle|on|off|status|reload|settings, 기본 ON)를 등록하고 입력된 `/settings`를 `/ko settings`로 리라우팅한다(내장 커맨드는 `registerCommand`로 덮을 수 없어 공식 `input` 이벤트에서 재작성).
- `src/translations.json` + `src/translate.ts`: 슬래시 메뉴 번역 테이블. 매칭: `exact` / `labels` / `state`·`statePatterns` / `suffixes`. 전부 전체 문자열 매칭, 부분 치환 없음.
- `src/ko-data/*.json`: 설정 패널 번역(탭별 파일 + `chrome.json`). 옵션 값은 문자열(라벨) 또는 `{ "label", "description" }` 객체. `_` 접두 키는 무시(주석용).
- `src/ko/line-translate.ts`: ANSI 인식 라인 번역기. 치환 시 **표시 폭 보존**: 패딩 → 뒤 공백 흡수 → 불가능하면 스킵.
- `src/ko/settings-panel.ts`: 호스트 pi-tui `SettingsSelectorComponent`를 `ui.custom` 오버레이로 재사용. 어느 단계든 실패하면 조용히 영어 `/settings`로 폴백.

`translations.json`·`ko-data/*.json`을 수정한 뒤 omp에서 `/ko reload`: translator와 ko-data를 디스크에서 다시 읽는다(파싱 실패 시 이전 번역 유지). 리빌드 없음.

## 자주 틀리는 규칙

- 문체: 간결체/명사형 전면. 해요체 금지.
- 슬래시 메뉴에서 명령·기능 키워드는 `한국어(english)`로 병기. 예외: 설정 패널 라벨·설명과 샘플링 파라미터(Temperature, Top P 등)는 병기하지 않거나 영어 유지 (DECISIONS.md D10).
- 식별자는 절대 번역하지 않는다: 커맨드명, 모델 id, MCP/SSH/LSP 이름, 경로.
- 한글은 2셀. 모든 치환은 원래 표시 폭을 보존해야 한다. 이모지(어스트랄) 오프셋 처리와 폭 규칙은 테스트로 고정돼 있다. 리그레션 금지.
- `/ko off`는 영어 원문을 정확히 복원해야 한다.
- RPC/ACP 카탈로그의 `acpDescription`은 의도적 미번역. 범위는 TUI뿐이다.
- 새 코드 경로도 예외 격리한다: 데이터·설정 오류는 영어 폴백이지, 호스트로 throw하지 않는다.

## 참조 소스

- 공식 확장 API만 사용. dist 패치·포크·호스트 내부 몽키패치 금지.
- 기준 설치: omp 18.11.1(`~/.bun/bin/omp`). 호스트 소스는 `~/.bun/install/global/node_modules/@oh-my-pi/pi-coding-agent`(+ `pi-tui` 등). API 형태는 여기서 확인한다.
- `DECISIONS.md`가 결정 기록: 설계를 바꾸기 전에 읽고 새 결정은 항목으로 추가한다.
- 문서(README·CHANGELOG·DECISIONS)는 한국어로 쓴다.

## 릴리스

```bash
# package.json 버전 범프 + CHANGELOG 항목 추가 → 커밋 후:
git tag v0.1.2 && git push origin main v0.1.2
```

`v*` 태그 푸시 → `.github/workflows/publish.yml`이 npm **OIDC trusted publishing**으로 자동 게시(토큰 없음, provenance 자동). 태그 = package.json 버전이어야 하고 이미 게시된 버전은 스킵된다(멱등). 최초 0.1.0만 수동 게시였다(npm이 신규 패키지의 OIDC 첫 게시를 차단). 과거 버전 재게시 금지.

npm 타르볼에는 `src/**`(`*.test.ts` 제외)와 README·CHANGELOG·LICENSE만 들어간다(`files` 허용목록). 런타임 자산은 반드시 `src/` 아래에 둔다.

사용자 설치 경로: `omp install omp-i18n-ko`(npm). 개발 환경은 이 체크아웃을 플러그인 링크로 로드한다(수정 즉시 반영).

## 스크래치

`tmp/`는 gitignored: 프로브, RPC 부팅 로그, 샌드박스 HOME, VHS 스크린샷 테이프. 일회용 산출물은 여기에 두고 커밋하지 않는다.
