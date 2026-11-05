---
layout: single
title: "Web 기초 정리 7 - AJAX와 fetch, XML과 JSON 데이터 다루기"
categories: [coding, Web]
tag: [study-log, Web, JavaScript, AJAX, fetch, Promise, XML, JSON, DOMParser, CORS]
toc: true
author_profile: false
sidebar:
    nav: "docs"
search: true
---
<hr/>

지난주 마지막 날에 비동기를 맛보기로 배웠고, 오늘은 그걸 이용해서 **서버에서 데이터를 받아오는 방법**을 배웠다.

페이지를 새로고침하지 않고 데이터만 받아오는 AJAX의 개념과 역사, 지금 표준으로 쓰는 `fetch`, 그리고 받아온 XML과 JSON 데이터를 화면에 표로 그리는 실습까지 했다.

## AJAX 이전과 이후
AJAX 이전의 웹은 이랬다.

```
[검색어 입력] → [제출] → 서버가 페이지 전체를 새로 만들어 보냄 → 화면이 하얗게 깜빡 → 새 페이지
```

바뀐 건 검색 결과 목록 하나뿐인데 헤더, 메뉴, 이미지, CSS까지 전부 다시 받아서 느리고 깜빡였다.

```
[검색어 입력] → 뒤에서 조용히 데이터만 요청 → 결과 목록 부분만 바꿔 그림
```

AJAX 이후에는 페이지는 그대로 있고 필요한 데이터만 오간다. 구글 지도, 검색어 자동완성, 무한 스크롤, 아이디 중복 체크가 전부 이걸로 가능해졌다고 한다. 우리가 매일 쓰는 웹의 대부분이 AJAX 위에 있는 셈이다.

AJAX는 Asynchronous JavaScript And XML의 약자인데, 노트에 "근시안적 작명의 오류"라고 적혀 있었다. 이름이 붙은 2005년에는 XML이 표준이었지만 지금은 거의 다 JSON을 쓴다. 그리고 AJAX는 새로운 언어나 문법이 아니라 **JS로 서버와 비동기 통신하는 방식을 부르는 이름**일 뿐이다.

## 작동 절차
```
1. 웹페이지에서 이벤트 발생 (클릭, 입력…)
2. 요청 객체 생성
3. 서버에 request
4. 서버가 처리
5. 서버가 response 를 보냄
6. 웹페이지에서 response 를 읽음
7. 읽은 내용으로 DOM 을 업데이트
```

7번은 지난주에 배운 DOM 조작이다. 받아온 데이터를 화면에 그리는 건 결국 DOM을 바꾸는 일이었다.

## XMLHttpRequest에서 fetch로
초창기에는 `XMLHttpRequest`를 썼다.

```javascript
const xhr = new XMLHttpRequest();
xhr.onreadystatechange = function() {
    if (this.readyState == 4 && this.status == 200) {
        document.getElementById("info").innerHTML = this.responseText;
    }
};
xhr.open("GET", "JS/ajax_info.txt", true);
xhr.send();
```

`readyState`가 4이고 `status`가 200일 때만 처리하는 코드를 매번 써야 해서 복잡하다. 그다음에 jQuery나 axios 같은 라이브러리가 나왔는데, 편하지만 JS 파일 크기가 커지는 단점이 있었다.

지금 표준은 브라우저에 내장된 `fetch`다.

```javascript
fetch(url).then(r => r.text()).then(text => info.innerHTML = text);
```

세 줄로 끝나고, 아무것도 설치할 필요가 없다. 그리고 지난주에 배운 콜백 지옥이 생기지 않는 Promise 기반이라고 한다.

## fetch 기본형
```javascript
fetch(url)
    .then(response => response.json())
    .then(data => { /* 화면 그리기 */ })
    .catch(err => console.error(err));
```

`fetch(url)`은 Promise를 돌려주고, `.then()`을 이어 붙여서 결과를 받는다. 실패하면 `.catch()`로 간다. Promise 자체는 내일 자세히 배운다고 하셨다.

## .then이 두 번인 이유
처음 배울 때 가장 헷갈렸던 부분이다. 왜 `.then`이 두 번이나 필요할까?

```
① 서버가 응답 헤더를 보낸다 → 상태 코드(200), 타입 등
   여기서 첫 번째 Promise 가 완료된다 → Response 객체를 준다
   하지만 본문(body)은 아직 다 안 왔다!

② 본문이 다 도착한다
   .text() / .json() 이 그걸 기다렸다가 → 두 번째 Promise
```

응답이 두 단계로 오기 때문이었다. 큰 파일이면 헤더는 바로 오고 본문은 몇 초 걸릴 수 있어서, **"헤더는 왔다"와 "본문을 다 읽었다"가 다른 사건**이라 Promise가 두 개다.

중간에 `response`를 찍어보면 본문은 안 보이고 상태 정보만 보인다.

```javascript
.then(response => console.log(response.status, response.statusText))   // 200 'OK'
```

| 속성 / 메서드 | 뜻 |
|---|---|
| `response.status` | 상태 코드 (200, 404, 500…) |
| `response.ok` | 200~299 면 true |
| `response.text()` | 본문을 글자로 |
| `response.json()` | 본문을 JSON 파싱해서 객체로 |

`.json()`은 지난주에 배운 `JSON.parse()`까지 대신해준다.

## JSON 받아서 그리기
```javascript
function loadPet() {
    fetch(url)
        .then(response => response.json())
        .then(myObj => {
            document.getElementById('name').innerHTML = myObj.name;
            document.getElementById('age').innerHTML = myObj.age;

            const result = [];
            for (const p of myObj.pets) {
                result.push(`${p.animal} : ${p.name}`);
            }
            document.getElementById('pets').innerHTML = result.join('<br>');
        });
}
```

`.json()`을 거치면 그냥 JS 객체라서 `myObj.name`, `myObj.pets`처럼 평소대로 쓰면 된다. 그리고 HTML을 배열에 모았다가 `join()`으로 한 번에 넣는 패턴이 계속 나왔다. `innerHTML`을 여러 번 바꾸는 것보다 한 번에 넣는 게 낫다고 한다.

## XML과 JSON 비교
같은 데이터를 두 형식으로 받아서 비교해봤다.

```xml
<CATALOG>
  <CD>
    <TITLE>Empire Burlesque</TITLE>
    <ARTIST>Bob Dylan</ARTIST>
  </CD>
</CATALOG>
```

```json
{
  "catalog": [
    { "title": "Empire Burlesque", "artist": "Bob Dylan" }
  ]
}
```

| | XML | JSON |
|---|---|---|
| 크기 | 태그를 두 번 써서 크다 | 작다 |
| JS에서 | 파싱이 필요하다 | `.json()` 한 번 |
| 요즘 | 공공기관·레거시 | 사실상 표준 |

JS에게는 JSON이 압도적으로 편하다. 이름부터 JavaScript Object Notation이다.

## XML 파싱 DOMParser
XML은 `.text()`로 받은 다음 `DOMParser`로 DOM 나무로 바꿔서 쓴다.

```javascript
fetch(url1)
    .then(response => response.text())     // XML 은 text() 로 받는다
    .then(text => {
        const xmlDom = new DOMParser().parseFromString(text, 'text/xml');
        myFunction(xmlDom);
    });

function myFunction(xmlDOM) {
    const table = ["<tr><th>Artist</th><th>Title</th></tr>"];
    for (const x of xmlDOM.getElementsByTagName("CD")) {
        table.push(`
            <tr>
              <td>${x.getElementsByTagName('ARTIST')[0].firstChild.nodeValue}</td>
              <td>${x.getElementsByTagName('TITLE')[0].firstChild.nodeValue}</td>
            </tr>
        `);
    }
    document.getElementById('demo').innerHTML = table.join('\n');
}
```

브라우저가 HTML을 읽어서 DOM을 만드는 것과 같은 일을 XML에 대해 해주는 것이라서, 지난주에 배운 DOM 메서드를 그대로 쓸 수 있었다.

여기서 `.firstChild.nodeValue`가 필요한 이유가 지난주에 배운 **"Element node가 text를 갖고 있는 게 아니다"**였다. `<ARTIST>Bob Dylan</ARTIST>`에서 글자는 ARTIST의 자식 텍스트 node라서 `firstChild`로 꺼내야 한다. 그리고 `getElementsByTagName`은 컬렉션을 돌려주니 하나뿐이어도 `[0]`으로 꺼내야 했다.

`querySelector`를 쓰면 훨씬 짧게 쓸 수 있다.

```javascript
row.querySelector('BLDN_NM').textContent
```

실습에서는 공공 API가 주는 XML 데이터도 이 방식으로 표로 그려봤다. 공공기관 API는 아직 XML로 주는 경우가 많다고 한다.

## CORS
다른 출처(도메인, 포트)의 서버에 요청하면 브라우저가 기본적으로 막는다. 이걸 **CORS** 정책이라고 하고, 서버가 허용해줘야 요청할 수 있다. 첫날 `file://`로 열면 fetch가 막힌다고 해서 Live Server로 여는 습관을 들였는데, 그 이유가 여기서 이어졌다.

## 오늘 배운 내용 정리
오늘은 서버에서 데이터를 받아오는 방법을 배웠다.

```
AJAX: 페이지 새로고침 없이 데이터만 받아오는 방식. 새 언어가 아니라 방식의 이름.
역사: XMLHttpRequest → jQuery / axios → fetch (지금 표준, 브라우저 내장).
fetch: fetch(url).then(r => r.json()).then(data => ...).catch(err => ...)
.then 이 두 번: 헤더가 먼저 오고 본문은 나중에 다 오기 때문.
Response: status, ok, text(), json().
JSON: .json() 한 번이면 그냥 JS 객체.
XML: .text() → DOMParser → getElementsByTagName / querySelector. 글자는 firstChild.nodeValue.
화면 그리기: 배열에 모아서 join() 으로 한 번에.
CORS: 다른 출처의 서버는 브라우저가 막는다. 서버가 허용해야 한다.
```

지금까지 배운 것들이 오늘 다 모였다. 비동기로 데이터를 받고, JSON으로 파싱하고, DOM으로 화면에 그렸다.

그리고 `.then`을 이어 붙이는 게 왜 콜백 지옥보다 나은지는 아직 완전히 와닿지 않아서, 내일 Promise를 배우면서 정리해보려고 한다.

---
