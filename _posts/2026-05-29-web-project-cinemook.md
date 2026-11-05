---
layout: single
title: "Web 미니 프로젝트 - AI 영화 추천 웹 씨네묵(CineMook) 만들기"
categories: [coding, Web]
tag: [study-log, project, JavaScript, fetch, Gemini, OpenAI, TMDB, prompt, Promise.all, SPA, localStorage]
toc: true
author_profile: false
sidebar:
    nav: "docs"
search: true
---
<hr/>

5월 8일부터 19일까지 배운 HTML, CSS, JavaScript를 하나로 엮어서 첫 웹 프로젝트를 만들었다. 5월 20일부터 28일까지 만들었고, 오늘 발표를 했다.

만든 건 **씨네묵(CineMook)**이라는 AI 영화 추천 웹이다. 사용자가 MBTI, 성별, 나이, 지금 기분을 입력하면 AI가 분석해서 영화 3편을 추천해준다.

수업 노트가 "이 문법은 이렇게 쓴다"였다면, 이번 프로젝트는 "실제로 만들면 이렇게 조합된다"를 배운 시간이었다. 무엇을 왜 그렇게 만들었는지, 그리고 다시 보니 아쉬운 점은 무엇인지 정리해보려고 한다.

## 전체 흐름
```
[정보 입력]  MBTI, 성별, 나이, 지금 기분
     ↓
[AI 1차]    사용자 분석 문구 + 장르 2개 + 키워드 4개(한/영) 추출
     ↓
[TMDB]      영어 키워드 → 키워드 ID 조회
            장르 ID + 키워드 ID 로 후보 검색 (명작군 / 최신군)
     ↓
[AI 2차]    후보 목록 중에서 이 사람에게 맞는 3편과 이유 선정
     ↓
[TMDB]      선정된 3편의 상세 정보 (감독, 배우, 예고편)
     ↓
[화면]      추천 카드 → 상세 페이지 → 트레일러 → 북마크
```

## AI를 두 번 부른 이유
가장 고민했던 부분이다. AI에게 "영화 추천해줘"라고만 하면 **없는 영화를 지어내거나** 오래된 정보를 줄 수 있다.

그래서 역할을 나눴다.

```
AI   → 이 사람이 "어떤 종류의 영화"를 좋아할지 판단만 한다 (장르, 키워드)
TMDB → 실제 영화 목록은 진짜 영화 DB 에서 가져온다
AI   → 그 후보 안에서만 3편을 고른다
```

AI는 판단을 하고, 사실은 DB에서 가져오는 구조다. 이렇게 하면 AI가 고른 영화는 반드시 TMDB에 실제로 있는 영화가 된다. 나중에 알고 보니 이게 RAG(검색 증강 생성)의 기본 발상과 같다고 한다.

## AI에게 글이 아니라 데이터를 받기
AI에게 그냥 물으면 "안녕하세요! 당신에게 어울리는 영화를 추천드릴게요. 1. 인터스텔라..." 같은 글을 준다. 사람은 읽기 좋지만 프로그램은 쓸 수가 없다. 그래서 JSON으로 받아야 했다.

프롬프트는 다섯 덩어리로 썼다.

```
너는 ... 데이터 분석가야.             ← 1. 역할
[사용자 정보] MBTI, 성별 및 나이, 기분  ← 2. 입력 데이터
[임무] 위 정보를 바탕으로 ...           ← 3. 할 일
[중요 규칙]                            ← 4. 규칙
  - TMDB 기준 추천 장르 2개
  - 나이는 그대로 말하지 말고 연령대로
  - 반드시 JSON 만 출력, 설명 금지, markdown 금지
[출력 예시] { "analysis": "...", ... }  ← 5. 정확한 형식
```

설명을 열 줄 쓰는 것보다 출력 예시 하나가 훨씬 잘 먹혔다. AI는 예시의 구조를 그대로 따라 한다.

키워드는 한국어와 영어를 같이 만들게 했다.

```json
"keywords": [{ "en": "spy", "ko": "첩보" }]
```

영어는 TMDB 검색용, 한국어는 화면에 보여줄 용도다. 한 번의 호출로 두 가지를 다 얻을 수 있었다.

## 그래도 붙어오는 코드펜스
"markdown 금지"라고 세 번이나 써도 AI는 응답 앞뒤에 ` ```json `을 붙여서 보낼 때가 있었다. 이걸 그대로 `JSON.parse`하면 `SyntaxError`가 난다. 그래서 응답을 파싱하기 전에 코드펜스를 정규식으로 벗겨냈다.

```javascript
function parseAiJson(rawText) {
    if (!rawText || typeof rawText !== "string") {
        throw new Error("AI 응답이 비어 있습니다.");
    }
    let text = rawText.trim();

    // ```json ... ``` 또는 ``` ... ``` 제거
    const fenced = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    if (fenced) {
        text = fenced[1].trim();
    } else {
        text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    }
    return JSON.parse(text);
}
```

여기서 `.` 대신 `[\s\S]`를 쓴 이유는 `.`이 줄바꿈을 잡지 못하기 때문이다. JSON은 여러 줄이라서 "공백이거나 공백이 아닌 것", 즉 전부를 잡아야 했다. 4월에 Python으로 배운 정규표현식을 여기서 제대로 써먹었다.

## OpenAI와 Gemini를 설정 하나로 바꾸기
두 AI를 둘 다 연결했는데, **"프롬프트 문자열 → 응답 텍스트"라는 같은 모양의 함수**로 감싸서 설정 한 줄로 바꿀 수 있게 했다.

```javascript
const data = CONFIG.AI_PROVIDER == "openai"
    ? await callOpenAi(promptInput)
    : await callGemini(promptInput);
```

| | Gemini | OpenAI |
|---|---|---|
| 키 위치 | URL 쿼리 `?key=...` | 헤더 `Authorization: Bearer ...` |
| 요청 구조 | `contents[].parts[].text` | `messages[].content` |
| 응답 경로 | `candidates[0].content.parts[0].text` | `choices[0].message.content` |

응답 경로가 서로 달라서 `??`로 이어 붙여 둘 중 값이 있는 쪽을 쓰게 했다.

```javascript
function extractAiText(data) {
    if (typeof data === "string") return data;
    return data?.candidates?.[0]?.content?.parts?.[0]?.text   // Gemini
        ?? data?.choices?.[0]?.message?.content                // OpenAI
        ?? null;
}
```

## 기다리는 시간 줄이기
이 프로젝트는 API 호출이 많았다. AI 1차, 키워드 ID 조회 4번, TMDB 후보 검색 2번, AI 2차, 영화 상세 3번까지 합치면 11번이다. 전부 순서대로 하면 20초가 넘어서 사용자가 그전에 나가버린다.

그래서 **앞의 결과가 뒤에 필요한가?**를 기준으로 나눴다.

```
앞의 결과가 뒤에 필요하다 → await 로 순차
필요 없다                → Promise.all 로 병렬
```

명작군 검색과 최신군 검색은 서로 상관없어서 동시에 돌렸다.

```javascript
const [classicCandidates, recentCandidates] = await Promise.all([
    getCandidatesFromTMDB(aiTagsObject, classicUrl),
    getCandidatesFromTMDB(aiTagsObject, recentUrl),
]);
```

그리고 가장 효과가 컸던 건 **타이핑 애니메이션과 API 호출을 겹친 것**이었다.

```javascript
const typingPromise = typeText(loadingContainer, displayText, 30);   // 시작만
const recommendationsPromise = (async () => {
    const { classicCandidates, recentCandidates } = await fetchMovieCandidates(aiTagsObject);
    return await pickFinalMovies(userInfo, aiTagsObject, classicCandidates, recentCandidates);
})();

const [, recommendations] = await Promise.all([typingPromise, recommendationsPromise]);
```

```
타이핑    [■■■3초■■■]
API 호출  [■■■■■■■7초■■■■■■■]
                            ↑ 둘 다 끝나는 시점 = 7초
```

AI 1차 분석 결과를 타이핑으로 보여주는 3초 동안 뒤에서 TMDB 검색과 AI 2차 호출이 같이 돈다. 사용자는 글자가 타이핑되는 걸 보고 있으니 그 시간이 그냥 기다리는 시간이 아니게 된다.

여기서 배운 건 **함수를 호출하는 순간 이미 실행이 시작된다**는 점이었다. `await`를 바로 붙이지 않고 나중에 붙이는 게 병렬 처리의 요령이었다.

## 페이지 이동 없이 화면 바꾸기
메인, 정보 입력, 결과, 상세, 트레일러, 북마크까지 화면이 여섯 개 필요했다. HTML 파일을 여섯 개로 나누면 헤더를 매번 복사해야 하고, 이동할 때마다 화면이 깜빡이고, JS 변수가 초기화돼서 추천 결과를 들고 다닐 수 없다.

그래서 한 페이지 안에 섹션을 다 넣고 `hidden` 클래스로 보였다 숨겼다 했다(SPA).

```javascript
document.getElementById("main").classList.add("hidden");
document.getElementById("result-section").classList.remove("hidden");
```

메뉴 클릭은 `document` 하나에 이벤트를 등록하고 `closest()`로 구분했다(이벤트 위임).

```javascript
document.addEventListener("click", (e) => {
    const link = e.target.closest("[data-nav]");
    if (!link) return;
    const target = link.dataset.nav;
    // target 에 따라 화면 전환
});
```

메뉴 안의 아이콘을 클릭하면 `e.target`이 `<a>`가 아니라 `<i>`가 된다. `closest()`는 자기부터 위로 올라가며 조건에 맞는 조상을 찾아줘서 이 문제를 해결할 수 있었다.

## localStorage 북마크
북마크는 새로고침해도 남아 있어야 하는데, 서버 없이 프론트엔드만으로 만든 프로젝트라 `localStorage`를 썼다. `localStorage`는 문자열만 저장되기 때문에 객체를 그냥 넣으면 `"[object Object]"`가 저장된다. 그래서 JSON으로 왕복시켰다.

```javascript
getAll() {
    const data = localStorage.getItem(BOOKMARK_KEY);
    try {
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
}
```

저장된 값이 없거나 깨져 있어도 항상 배열을 돌려주게 만들어서, 쓰는 쪽에서는 따로 검사할 필요가 없게 했다. 북마크 관련 함수는 `BookmarkManager` 객체 하나에 모아서 전역 함수 이름이 겹치지 않게 했다.

## 구조 분리가 전환점이었다
처음에는 파일 하나에 다 있었는데, 5월 25일에 폴더를 나눴다.

```
js/
├── config/      API 키, 엔드포인트, 모델명
├── constants/   TMDB 장르 ID 표
├── prompts/     AI 프롬프트 템플릿
├── utils/       validator, formatter, mapper
├── api/         tmdb / gemini / openai: 순수 호출만
├── services/    recommendation.service: 전체 흐름 제어
├── ui/          화면 그리기
└── app.js       이벤트 등록, 라우팅
```

`app.js`(이벤트) → `services`(흐름) → `api`(호출) → `utils`(가공) → `ui`(그리기) 순서로 역할이 나뉘었다. Database 수업에서 재고관리 과제 리뷰 때 배운 계층 분리를 웹에도 그대로 적용한 셈이다. 구조를 나누고 나니 OpenAI 추가, 상세 페이지, 북마크 같은 기능을 붙이기가 훨씬 쉬워졌다.

그리고 API 응답을 미리 저장해둔 `testJson/` 폴더를 만들어서, 개발 중에 API를 매번 호출하지 않고도 응답 구조를 보면서 코드를 짤 수 있게 했다.

## 다시 보니 아쉬운 점
노트를 정리하면서 다시 보니 고쳐야 할 부분이 꽤 보였다.

**API 키가 브라우저 코드에 있다.** 5월 19일에 배운 그 문제를 그대로 안고 있다. 실제 키가 든 `config.js`는 커밋에서 빼고 예시 파일만 올렸지만, 실행되는 페이지에서는 F12만 눌러도 키가 보인다. 실제 서비스라면 서버를 하나 두고 거기서 API를 호출해야 한다. 이게 이 프로젝트에서 가장 큰 개선점이다.

**아직 순차로 호출하는 곳이 두 군데 있다.** 키워드 ID 조회 4번과 영화 상세 정보 3번을 `for` 안에서 하나씩 `await`하고 있다. 서로 상관없는 호출이라 `Promise.all`로 바꾸면 눈에 띄게 빨라질 것 같다.

**남아 있는 죽은 코드가 있다.** 북마크를 `BookmarkManager`로 옮기면서 `utils/storage.js`가 빈 껍데기로 남았고, `mapper.js`의 `buildUserInfo()`도 다른 함수로 옮겨가면서 남은 코드였다. 호출되지 않아 에러는 안 나지만 정리하는 게 맞다.

**전역 함수 방식이다.** 모든 파일이 전역에 함수를 두고 `<script>` 순서로 의존성을 맞추고 있어서, 파일이 더 늘어나면 관리가 어려워질 것 같다. 다음에는 ES 모듈(`import` / `export`)로 바꿔보고 싶다.

## 프로젝트를 마치며
2주 동안 배운 문법이 실제로 어디에 쓰이는지 하나씩 짝이 맞춰지는 경험이었다. `fetch`와 `async/await`는 API 호출에, `Promise.all`은 속도 개선에, `classList`는 화면 전환에, 정규표현식은 AI 응답 파싱에, `JSON.stringify/parse`는 북마크 저장에 쓰였다.

가장 기억에 남는 건 "AI에게 판단만 시키고, 사실은 DB에서 가져온다"는 구조를 고민한 부분이다. AI를 그냥 부르는 것과 AI를 시스템의 한 부품으로 쓰는 것은 다르다는 걸 처음 느꼈다.

코드는 [GitHub](https://github.com/LeoChoi224/PyWork/tree/main/03_Web/myweb)에 올려두었다.

---
