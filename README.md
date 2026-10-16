# omp-i18n-ko

omp(oh-my-pi) 코딩 에이전트를 위한 **한국어 UI 언어팩** 확장입니다. omp **공식 확장 API만** 사용하며, 국가별 패치·포크·dist 수정을 하지 않습니다.

핵심 원칙:

- **CLI를 절대 깨뜨리지 않습니다.** 모든 경로가 예외 격리 + 영어 폴백이라, 언어팩 데이터가 잘못돼도 omp는 평소처럼 동작합니다.
- **실행 식별자는 번역하지 않습니다.** 커맨드 이름(`/settings`, `/model`), 모델 id, MCP·SSH·LSP 같은 식별자는 항상 영어 그대로라 그대로 입력할 수 있습니다.
- **명령/기능 키워드는 병기합니다.** 번역문 속 기능 키워드는 `한국어(english)` 형식입니다 — 예: `설정(settings) 메뉴 열기`. `/` 메뉴에서 한국어로 읽으면서도 원래 커맨드가 무엇인지 바로 알 수 있어 타이핑이 편합니다.

## 설치

### 개인 사용 (심링크, 권장)

```bash
git clone <this-repo> ~/dev/omp-ko

mkdir -p ~/.omp/agent/extensions
ln -sfn ~/dev/omp-ko/src/index.ts ~/.omp/agent/extensions/omp-i18n-ko.ts
```

omp를 재시작하면 `/` 메뉴가 한국어로 표시됩니다. 기본값은 **켜짐**입니다.

### 일회성 로드

```bash
omp -e /path/to/omp-ko/src/index.ts
```

## 사용법

| 명령 | 동작 |
| --- | --- |
| `/ko` · `/ko toggle` | 켜기 ↔ 끄기 |
| `/ko on` | 켜기 |
| `/ko off` | 끄기 (영어 원문 표시) |
| `/ko status` | 현재 상태 · 로드된 번역 항목 수 |
| `/ko reload` | `translations.json` 다시 로드 (편집 후 즉시 반영) |

토글 직후에는 이미 그려진 메뉴가 그대로 남을 수 있고, **다음 슬래시 메뉴 렌더부터** 반영됩니다(omp 확장 API에 강제 리페인트 훅이 없음).

## 커버리지

커버 (공식 확장 API, omp v18.11.1 기준):

- 슬래시 커맨드 설명과 인자 자동완성 설명
- 선택 항목 상세(`nativeDetail`)와 동적 상태(`state`) — 예: `Plan: off` → `계획(plan): 꺼짐`
- 상태 문자열 패턴 — 예: `Tools: 12 active / 20 available` → `도구(tools): 12개 활성 / 20개 사용 가능`
- 작업 표시문 — `생각 중…` (`setWorkingMessage`)

커버 불가 (omp 내부 제약, 소스 확인):

- 커맨드 이름 자체, 팁 라인, 웰컴/설정 마법사, 설정 패널, 내장 상태줄 세그먼트, 호스트 알림

## 안전 설계

- 확장 로드·핸들러·번역 함수 전체가 `try/catch`로 격리됩니다. 실패하면 영어 원문이 그대로 보일 뿐입니다.
- `translations.json`이 깨져도 **이전 번역을 유지**하고, 재시작 시에는 영어로 폴백합니다.
- 확장을 제거하면(심링크 삭제 + omp 재시작) 흔적이 남지 않습니다.
- omp가 업데이트되어 문구가 바뀌면 해당 항목만 자동으로 영어 폴백됩니다 — CLI는 영향받지 않습니다.

## 번역 수정

`src/translations.json`을 편집한 뒤 omp에서 `/ko reload`를 실행하세요.

구조 (전부 **전체 문자열 매칭**, 부분 치환 없음):

| 키 | 용도 |
| --- | --- |
| `exact` | 정적 설명문 전체 매칭 |
| `labels` | 동적 `Label: state` 문자열의 라벨 |
| `state` / `statePatterns` | 상태값 (고정값 / 정규식) |
| `suffixes` | 문자열 끝 접미사 — 예: ` (current)` → ` (현재)` |

기준 버전: **omp v18.11.1** (2026-10-15). 개발 중 검사:

```bash
bun test
```

## License

MIT. 이 프로젝트는 omp(oh-my-pi)와 별개의 독립 확장이며, omp 팀과 무관합니다.

---

## English

Korean UI localization for the [omp (oh-my-pi)](https://github.com/can1357/oh-my-pi) coding agent, implemented strictly with the official extension API.

- **Never breaks the CLI**: every failure path is isolated and falls back to the original English string. Removing the extension leaves no trace.
- **Identifiers stay English**: command names, model ids, MCP/SSH/LSP names remain typeable.
- **Command keywords are annotated** as `한국어(english)` (e.g. `설정(settings) 메뉴 열기`) so you can read Korean and still recognize the original command.
- Install by symlinking `src/index.ts` into `~/.omp/agent/extensions/`, then use `/ko` (`toggle` / `on` / `off` / `status` / `reload`; default ON).
- Baseline: omp v18.11.1 (2026-10-15). Translated strings that omp later changes simply fall back to English.
