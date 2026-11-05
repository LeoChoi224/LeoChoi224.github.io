---
layout: single
title: "Web 기초 정리 8 - Promise, async/await와 Gemini API·Chart.js"
categories: [coding, Web]
tag: [study-log, Web, JavaScript, Promise, async, await, Promise.all, Gemini, Google-Maps, Chart.js]
toc: true
author_profile: false
sidebar:
    nav: "docs"
search: true
---
<hr/>

지난주에 콜백 지옥을 봤고 어제 `fetch`로 `.then`을 이어 붙였는데, 오늘은 그 정체인 **Promise**와, 비동기 코드를 동기 코드처럼 쓰게 해주는 **async/await**, 여러 비동기 작업을 동시에 돌리는 **Promise.all**을 배웠다.

그리고 배운 걸 바로 써먹어서 fetch로 **Gemini API**를 호출해보고, **Google Maps**와 **Chart.js** 같은 외부 라이브러리도 붙여봤다. 웹 진도의 마지막 날이라 지금까지 배운 게 전부 모인 느낌이었다.

## Promise
지난주에 본 콜백 지옥은 코드가 아래로 가지 않고 안으로 깊어졌다.

```javascript
increaseAndPrint(0, n => {
    increaseAndPrint(n, n => {
        increaseAndPrint(n, n => { ... });
    });
});
```

Promise는 이걸 평평하게 편다.

Promise는 비동기 작업이 맞이할 미래의 완료 또는 실패의 결과를 나타내는 객체다. 수업에서는 식당의 **진동벨** 비유를 들었다. 주문하면 진동벨을 받고, 음식은 아직 없지만 "받을 권리"는 손에 있다. 그동안 다른 일을 하다가 벨이 울리면 음식을 받는다. 진동벨이 Promise이고, 결과 자체가 아니라 **결과를 나중에 준다는 약속**이다.

```
        pending (대기)        ← new Promise() 하는 순간
       /             \
 resolve()         reject()
     ↓                 ↓
fulfilled (이행)   rejected (거부)
```

한 번 이행되거나 거부되면 다시는 바뀌지 않는다. 진동벨이 한 번 울리면 끝인 것과 같다.

```javascript
const p = new Promise((resolve, reject) => {
    console.log('p1] Promise 생성: pending 상태');
    setTimeout(() => {
        console.log("p2] fulfilled 상태로 전환");
        resolve();
    }, 1000);
});

p.then(() => console.log('p3] 1000ms 후에 fulfilled 됨.'));
console.log('p4] 언제 찍힐까?');

// 출력: p1 → p4 → p2 → p3
```

여기서 헷갈리기 쉬운 부분이 있었다. `new Promise(...)` 안의 함수(executor)는 **즉시 실행**되고, `.then`의 콜백만 나중에 실행된다. `.then(callback)`은 "이행되면 이 함수를 불러줘"라고 등록하는 것이라서, 지난주의 `addEventListener`와 같은 발상이었다.

## 체이닝
`.then`에서 Promise를 리턴하면 다음 `.then`으로 이어진다.

```javascript
increase(0)
    .then(n => increase(n))
    .then(n => increase(n))
    .then(n => increase(n))
    .catch(err => console.log('에러:', err));
```

콜백 지옥이 **안이 아니라 아래로** 이어지게 바뀌었다. 그리고 에러 처리도 단계마다 하지 않고 맨 끝의 `.catch` 하나로 한다. 어제 `fetch(url).then(r => r.json()).then(...)`이 이 체이닝이었다.

## async / await
Promise 체이닝도 아직 불편한 점이 있다. 중간 결과를 다음 단계에서 쓰려면 계속 흘려보내야 한다.

```javascript
async function main() {
    try {
        const res = await fetch(url);
        const data = await res.json();
        const res2 = await fetch(url2 + data.id);
        const data2 = await res2.json();
    } catch (error) {
        console.log(error.message);
    }
}
```

`await`를 쓰면 위에서 아래로 읽힌다. 평범한 동기 코드와 똑같이 생겼다.

```javascript
function p(ms) {
    return new Promise(resolve => setTimeout(() => resolve(ms), ms));
}

p(1000).then(ms => console.log(ms));   // Promise 방식: 콜백 안에서만 쓸 수 있다
const ms = await p(1000);               // await 방식: 변수에 바로 담긴다
```

`await`는 Promise가 끝날 때까지 기다렸다가 `resolve(값)`의 그 값을 꺼내준다. 그리고 규칙이 두 가지 있다.

```
1. await 는 반드시 async 함수 안에서만 쓸 수 있다.
2. async 함수는 항상 Promise 를 리턴한다.
```

에러 처리도 `.catch` 대신 평소 쓰던 `try ~ catch`를 쓸 수 있어서 읽기 편했다. ES2017 문법이지만 매우 중요하다고 강조하셨다.

## Promise.all
```javascript
const a = await f1();   // 3초
const b = await f2();   // 3초
const c = await f3();   // 3초
// 총 9초
```

세 작업이 서로 상관없다면 하나씩 기다릴 이유가 없다.

```javascript
const start = Date.now();
await Promise.all([p1(1000), p1(2000), p1(3000)]);
console.log(Date.now() - start);   // 약 3000ms  6초가 아니라 3초
```

```
순차 실행: [■1초■][■■2초■■][■■■3초■■■]  → 6초
동시 실행: [■1초■]
          [■■2초■■]
          [■■■3초■■■]                  → 3초 (가장 긴 것)
```

`Promise.all`은 걸리는 시간이 합계가 아니라 **가장 오래 걸린 것**이 된다. 배열을 만드는 순간 세 함수가 이미 다 호출됐고, `Promise.all`은 그 셋이 다 끝나기를 기다릴 뿐이라고 한다.

```javascript
const [a, b, c] = await Promise.all([fetch(url1), fetch(url2), fetch(url3)]);
```

결과는 끝난 순서가 아니라 **넣은 순서대로** 배열로 돌아와서 비구조화 할당으로 바로 받을 수 있다. 다만 **하나라도 실패하면 전체가 실패**한다. 상품 정보, 리뷰, 추천 목록을 각각 다른 API에서 받아오는 경우처럼 실무에서 흔하게 쓴다고 한다.

## Gemini API
AI API라고 해서 특별한 문법이 있는 게 아니었다. **POST로 JSON을 보내고 JSON을 받는 fetch** 하나다.

```javascript
const MODEL_NAME = "gemini-2.5-flash";
const API_ENDPOINT =
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${API_KEY}`;

async function generateContent() {
    const prompt = promptInput.value.trim();
    if (!prompt) { alert("프롬프트를 입력해주세요."); return; }

    try {
        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        });

        if (!response.ok) {
            const errorJson = await response.json();
            outputElement.textContent = `API 요청 실패: ${errorJson.error.message}`;
            return;
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text
            || "응답에서 텍스트를 찾을 수 없습니다.";
        outputElement.innerHTML = marked.parse(text);
    } catch (error) {
        console.error("Fetch 또는 JSON 처리 중 오류 발생:", error);
    }
}
```

API 문서를 읽을 때는 **엔드포인트(어디로) → request body(무엇을 보내나) → response body(무엇이 오나)** 순서로 보면 된다고 하셨다. 이 셋만 알면 어떤 API든 쓸 수 있다.

POST로 보낼 때는 `method`, `headers`, `body` 세 가지를 꼭 챙기고, body는 객체를 그냥 넣으면 안 되고 `JSON.stringify()`로 바꿔야 한다.

`fetch`는 400이나 500 에러에서도 `catch`로 가지 않아서 `response.ok`를 반드시 확인해야 한다. 그리고 AI 응답은 안전 필터에 걸리면 `candidates`가 비어 있을 수도 있어서, 그저께 배운 `?.`로 안전하게 꺼냈다. `?.` 없이 쓰면 중간에 하나만 없어도 TypeError로 페이지가 죽는다.

Database 수업 때 Python으로 OpenAI API를 호출했는데, JS에서도 결국 같은 구조였다.

그런데 여기서 가장 중요한 주의점이 있었다. **API 키를 브라우저 코드에 두면 누구나 볼 수 있다.** 개발자도구만 열면 키가 그대로 보인다. 실제 서비스에서는 키를 서버에 두고 브라우저는 내 서버에 요청하는 구조로 만들어야 한다고 한다. 오늘은 연습이라 이렇게 했다.

## Google Maps와 Chart.js
지도나 차트를 직접 만들려면 몇 달이 걸린다. 라이브러리는 그걸 이미 만들어둔 것이고, 우리는 어떻게 쓰는지만 배우면 된다. 그리고 그 방법이 라이브러리마다 놀랍도록 비슷했다.

```
1. <script> 로 라이브러리를 불러온다
2. 그릴 자리(div / canvas)를 만든다
3. 설정 객체를 넘긴다
```

```html
<div id="googleMap" style="width:100%;height:400px;"></div>

<script>
function myMap() {
    const [lat, lng] = [37.499553, 127.035888];   // 역삼역
    const map = new google.maps.Map(document.getElementById('googleMap'), {
        center: new google.maps.LatLng(lat, lng),
        zoom: 17,
    });
    new google.maps.Marker({ position: new google.maps.LatLng(lat, lng), map: map, title: '역삼역' });
}
</script>
<script src="https://maps.googleapis.com/maps/api/js?key=API키&callback=myMap"></script>
```

지도가 그려질 `div`에 높이를 꼭 줘야 한다. div는 기본 높이가 0이라서 안 주면 지도가 안 보인다. 그리고 `callback=myMap`은 라이브러리를 다 받으면 `myMap()`을 불러달라는 약속이다. 다 받기 전에 `google.maps`를 쓰면 `google is not defined` 에러가 난다.

```javascript
new Chart(document.getElementById('myChart'), {
    type: 'bar',
    data: {
        labels: ['월', '화', '수'],
        datasets: [{ label: '방문자', data: [12, 19, 3] }],
    },
});
```

Chart.js도 `canvas`를 만들고 `new Chart(요소, 설정)`을 하는 같은 패턴이었다. **설정 객체를 읽는 법**만 알면 어떤 라이브러리든 쓸 수 있다는 말이 와닿았다.

## 오늘 배운 내용 정리
오늘은 비동기의 마무리와 외부 API, 라이브러리를 배웠다.

```
Promise: 나중에 나올 결과를 담을 진동벨. pending → fulfilled / rejected.
executor: new Promise 안의 함수는 즉시 실행되고, .then 의 콜백만 나중에 실행된다.
체이닝: .then 에서 Promise 를 리턴하면 안이 아니라 아래로 이어진다. 에러는 .catch 하나로.
async / await: await 는 Promise 의 결과값을 바로 꺼내준다. async 함수 안에서만.
에러 처리: try ~ catch.
Promise.all: 동시에 시작해서 전부 끝날 때까지. 시간은 가장 긴 것. 결과는 넣은 순서.
Gemini API: POST + headers + body(JSON.stringify). response.ok 확인. ?. 로 안전하게 꺼낸다.
API 키: 브라우저 코드에 두면 누구나 본다. 서버에 둬야 한다.
라이브러리: script 로 불러오고 → 그릴 자리를 만들고 → 설정 객체를 넘긴다.
```

2주 동안 HTML, CSS, JavaScript를 배우면서, 처음에는 태그 하나 쓰는 것부터 시작했는데 마지막에는 AI API를 호출해서 화면에 답을 그리는 데까지 왔다.

오늘부터 배운 걸 모아서 웹 프로젝트를 만들기 시작하는데, 콜백 → Promise → async/await로 이어지는 흐름을 프로젝트에서 직접 써보면서 확실히 익혀야 할 것 같다.

---
