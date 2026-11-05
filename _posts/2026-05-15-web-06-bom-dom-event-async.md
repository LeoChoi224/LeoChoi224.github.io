---
layout: single
title: "Web 기초 정리 6 - BOM, DOM 조작, 이벤트 핸들러와 비동기 입문"
categories: [coding, Web]
tag: [study-log, Web, JavaScript, BOM, DOM, querySelector, addEventListener, classList, setInterval, async, callback]
toc: true
author_profile: false
sidebar:
    nav: "docs"
search: true
---
<hr/>

오늘 오전에는 어제 하던 폼 유효성 검사를 마무리하고, 브라우저 자체를 다루는 **BOM**으로 넘어갔다. 그다음 페이지 내용을 다루는 **DOM**에서 요소를 찾고, 이벤트를 붙이고, 요소를 새로 만들고 지우는 방법을 배웠다. 마지막에는 타이머로 애니메이션을 만들고, 다음 주 서버 통신을 위한 **비동기**를 맛보기로 배웠다.

어제까지가 JS 문법이었다면, 오늘은 그 문법으로 실제 화면을 움직이는 방법을 배운 날이었다.

## BOM
BOM(Browser Object Model)은 페이지 내용이 아니라 **브라우저 자체**를 다루는 창구다. "저장했습니다" 후에 목록 페이지로 이동하거나, 새로고침하거나, 뒤로 가는 일이 여기에 해당한다.

```
window                ← 최상위. 브라우저 창 자체
  ├─ document         ← 페이지 내용 (DOM)
  ├─ screen           ← 모니터 정보
  ├─ location         ← 현재 주소
  ├─ history          ← 방문 기록
  └─ navigator        ← 브라우저·OS 정보
```

`window`가 최상위 객체이고, **모든 전역 변수와 함수는 자동으로 `window`의 멤버**가 된다. 그저께 "키워드 없이 변수를 선언하면 전역 변수가 된다"고 배웠는데, 그 전역이 바로 `window`였다. `alert()`도 사실 `window.alert()`이다.

```javascript
location.href = 'https://www.daum.net';   // 페이지 이동 (새 요청을 보낸다)
location.reload();                         // 새로고침
history.back();                            // 뒤로 가기 (새 요청을 안 보낸다)
```

`navigator`로 브라우저 정보를 알 수 있지만 사용자가 바꿀 수 있어서 믿으면 안 된다고 한다. BOM은 공식 표준은 아닌데, 대부분의 브라우저가 같은 이름을 써서 표준처럼 쓰이는 것이라는 점도 처음 알았다.

## DOM과 요소 찾기
HTML 페이지가 로드되면 브라우저는 HTML 텍스트를 읽어서 **객체들의 나무(DOM)**를 만든다.

```
document
└── html
    ├── head
    │   └── title
    └── body
        ├── h1
        └── p
```

각 태그가 객체 하나가 되고 부모-자식 관계가 그대로 유지된다. DOM은 W3C 표준이라 JS 전용이 아니고, 나중에 배울 Python의 BeautifulSoup도 같은 발상이라고 한다.

```javascript
document.getElementById('demo1');          // 하나
document.getElementsByTagName('div');      // 여럿
document.getElementsByClassName("c3");     // 여럿
document.getElementsByName('name1');       // 여럿 (form 전용)

document.querySelector('div.intro');       // CSS 선택자로 첫 번째 하나
document.querySelectorAll('div.intro');    // CSS 선택자로 전부
```

`getElementById`는 `Element`가 단수라서 딱 하나를 돌려주고, 못 찾으면 `null`이다. `Cannot set properties of null` 에러가 뜨면 id 오타나 어제 배운 script 위치 문제를 의심하면 된다.

`querySelector`는 CSS 선택자를 그대로 쓸 수 있어서 이걸 쓰면 된다고 하셨다. 그저께 배운 선택자가 바로 여기서 다시 쓰였다.

여럿을 돌려주는 것들은 배열이 아니라 **컬렉션**(유사 배열)이다. 그저께 예고한 대로 `Array.from()`이 필요한 자리가 여기였다.

```javascript
Array.from(document.getElementsByTagName('div')).forEach((e, i) => {
    e.innerHTML = `div ${i} 입니다`;
});

for (const e of elements) e.style.backgroundColor = 'yellow';
```

## 이벤트 핸들러
지금까지는 HTML 태그 안에 `onclick="함수()"`를 직접 썼는데, 이러면 HTML과 JS가 뒤섞이고, 이벤트를 하나만 등록할 수 있고, 떼어내기도 어렵다. `addEventListener`가 이 문제를 다 푼다.

```javascript
const demoBox = document.getElementById('demoBox');

function clickHandler(event) {
    console.log(event.type, event.target);   // "click", 이벤트가 발생한 요소
    const bgcolor = this.style.background;   // this = demoBox
    this.style.background = (bgcolor != 'greenyellow') ? 'greenyellow' : 'yellow';
}

demoBox.addEventListener("click", clickHandler);       // 등록
demoBox.removeEventListener("click", clickHandler);    // 삭제
```

"이벤트가 일어나면 이 함수를 불러줘"라고 브라우저에 부탁하는 것이고, 우리가 직접 부르지 않고 **브라우저가 대신 불러주니까 콜백**이다.

삭제하려면 **같은 함수**를 넘겨야 해서, 익명 함수로 등록하면 지울 수 없다. 그래서 이름 있는 함수로 만들었다.

그리고 어제 배운 `this`가 여기서 바로 나왔다. 이벤트 핸들러 안에서 `this`는 **이벤트가 발생한 요소**다. 브라우저가 핸들러를 부를 때 `this`를 그 요소로 맞춰서 불러주기 때문이다. 그래서 **화살표 함수를 쓰면 this를 쓸 수 없다.** 어제 "점 앞에 있는 것이 this"를 계속 확인해보겠다고 했는데, 브라우저가 대신 부르는 경우에는 브라우저가 정해준다는 걸 알게 됐다.

`event.preventDefault()`로 링크 이동이나 폼 제출 같은 기본 동작을 막을 수도 있다.

## 요소 만들고 지우기
지금까지는 이미 있는 요소의 내용을 바꿨는데, 실제 웹 앱은 서버에서 목록을 받아서 `<li>`를 100개 만들거나 "추가" 버튼으로 항목을 늘리는 것처럼 없던 것을 만들어낸다.

노트에 명심하라고 적혀 있던 문장이 있다.

> Element node 가 text 를 갖고 있는 것이 아니다!!!

```
<h1 class="heading">W3Schools</h1>

Element node (h1)
├── Attribute node (class="heading")
└── Text node ("W3Schools")   ← 글자도 별개의 node 다
```

글자가 h1 안에 들어 있는 게 아니라 h1의 자식 node로 매달려 있다. 그래서 요소와 글자를 따로 만든다.

```javascript
const p = document.createElement('p');
p.appendChild(document.createTextNode('내용'));
parent.appendChild(p);         // 맨 뒤에 붙이기
parent.insertBefore(p, ref);   // ref 앞에 끼워 넣기
p.remove();                    // 지우기
```

node 사이를 이동할 때 함정이 있었다. `childNodes`, `firstChild`는 **텍스트 node까지 센다.** 줄바꿈이나 공백도 텍스트 node라서 생각보다 개수가 많이 나온다. 요소만 보려면 `children`, `firstElementChild`처럼 `Element`가 들어간 쪽을 쓴다.

스타일은 하나씩 바꾸기보다 `classList`로 class를 붙였다 뗐다 하는 게 좋다.

```javascript
el.classList.add('active');
el.classList.remove('active');
el.classList.toggle('active');   // 있으면 빼고 없으면 붙인다
```

CSS에 미리 `.active` 스타일을 만들어두고 JS는 class만 바꾸면, 모양은 CSS가 맡고 동작은 JS가 맡아서 역할이 깔끔하게 나뉜다.

## 타이머와 애니메이션
CSS로 애니메이션을 만들 수 있지만, 1초마다 시각을 갱신하거나 "350px 가면 정지" 같은 조건이 들어가면 JS가 필요하다.

```javascript
const id = setInterval(tick, 1000);   // 1초마다 계속
clearInterval(id);                     // 멈춤

const id2 = setTimeout(fn, 3000);     // 3초 뒤에 한 번
clearTimeout(id2);
```

둘 다 id를 돌려주고, **id를 안 받아두면 영원히 못 멈춘다.**

시계 시작/정지 버튼은 이렇게 만들었다.

```javascript
let clockAnimId = undefined;

function clock() {
    if (!clockAnimId) {
        clockAnimId = setInterval(tick, 1000);   // 시작
    } else {
        clearInterval(clockAnimId);              // 정지
        clockAnimId = undefined;                 // 초기화를 잊지 말 것
    }
}

function tick() {
    const d = new Date();
    document.getElementById("timeboard").innerHTML =
        d.getFullYear() + "/" + (d.getMonth() + 1) + "/" + d.getDate();   // 월은 0~11 이라 +1
}
```

`clockAnimId = undefined`를 빼먹으면 변수에 옛 id가 남아 있어서 다음에 눌러도 시작이 안 된다. 그리고 `getMonth()`가 0부터 시작해서 +1을 해야 한다는 것도 함정이었다.

상자를 움직이는 애니메이션은 20ms마다 위치를 조금씩 바꾸는 방식으로 만들었고, 위치를 옮기려면 지난주에 배운 대로 **부모는 relative, 자신은 absolute**여야 했다.

## 비동기 입문
다음 주에 서버에서 데이터를 받아오는데, 서버 응답은 0.5초가 걸릴 수도 3초가 걸릴 수도 있다. 그동안 브라우저가 멈춰 있으면 스크롤도 안 되고 버튼도 안 눌린다. JS는 하나의 흐름(싱글 스레드)으로 돌아서, 오래 걸리는 일은 **"나중에 해줘"라고 맡겨두고 먼저 넘어간다.** 그게 비동기다.

```javascript
console.log("[B1] 작업 시작!");
setTimeout(() => console.log("[B3] 작업 종료"), 0);   // 0ms 인데도
console.log("[B2] 다음 작업");

// 출력: B1 → B2 → B3
```

`setTimeout(fn, 0)`인데 맨 마지막에 실행됐다. "0초 뒤에 실행"이 아니라 **"0초 뒤에 실행하도록 줄을 세운다"**는 뜻이기 때문이다. JS 엔진은 지금 실행 중인 코드를 끝까지 다 실행한 다음에 예약된 것들을 꺼내 실행한다. 이 줄을 태스크 큐, 이 구조를 이벤트 루프라고 한다.

규칙은 하나다. **동기 코드가 전부 끝난 뒤에 비동기 코드가 실행된다.**

Python의 `time.sleep()`이 blocking이라서 그동안 아무것도 못 한다고 배웠는데, JS의 비동기가 그 문제를 푸는 방식이라는 걸 알게 됐다.

## 콜백 지옥
비동기 작업이 **끝난 뒤에** 무언가를 하려면 콜백을 넘겨야 한다.

```javascript
function work(callback) {
    setTimeout(() => {
        // ... 오래 걸리는 작업 ...
        callback(결과);     // 끝나고 나서 호출
    }, 0);
}

work((result) => {
    console.log("작업 결과:", result);
});
```

그런데 비동기 작업 여러 개를 순서대로 이어야 하면 콜백 안에 콜백, 그 안에 또 콜백이 들어간다.

```javascript
step1(function(r1) {
    step2(r1, function(r2) {
        step3(r2, function(r3) {
            step4(r3, function(r4) {
                // 점점 오른쪽으로 밀려난다
            });
        });
    });
});
```

이걸 **콜백 지옥**이라고 한다. 들여쓰기가 계속 깊어져서 읽기도 어렵고 에러 처리도 단계마다 따로 해야 한다. 다음 주에 배울 Promise와 async/await가 이 문제를 푸는 방법이라고 한다.

## 오늘 배운 내용 정리
오늘은 BOM, DOM, 이벤트, 타이머, 비동기를 배웠다.

```
BOM: window 가 최상위. 전역 변수와 함수는 전부 window 의 멤버. location, history.
DOM: HTML 을 객체 나무로 만든 것. 요소 찾기는 querySelector / querySelectorAll.
컬렉션: getElementsBy... 의 결과는 배열이 아니다. Array.from() 이나 for~of.
이벤트: addEventListener("click", 함수). 삭제하려면 같은 함수를 넘긴다.
핸들러의 this: 이벤트가 발생한 요소. 화살표 함수를 쓰면 this 를 못 쓴다.
요소 만들기: createElement + createTextNode + appendChild. 글자도 별개의 node.
classList: add / remove / toggle. 모양은 CSS, 동작은 JS.
타이머: setInterval / setTimeout 은 id 를 돌려준다. clear 하려면 id 가 필요하다.
비동기: 동기 코드가 다 끝난 뒤에 실행된다. setTimeout(fn, 0) 도 마지막.
콜백 지옥: 비동기를 순서대로 이으려고 콜백을 중첩하면 생긴다.
```

버튼을 누르면 요소가 생기고 사라지는 걸 직접 만들어보니 웹 페이지가 동작하는 원리가 조금 보이는 것 같다.

비동기는 아직 출력 순서가 머릿속으로 바로 그려지지 않아서, 다음 주 Promise를 배우기 전에 `setTimeout` 예제의 출력 순서를 손으로 예상해보는 연습을 해보려고 한다.

---
