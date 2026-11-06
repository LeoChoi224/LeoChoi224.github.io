---
layout: single
title: "React 기초 정리 0 - React를 위한 JS 문법, axios와 Vite 환경 세팅"
categories: [coding, React]
tag: [study-log, React, JavaScript, spread, destructuring, class, Promise, axios, Vite]
toc: true
author_profile: false
sidebar:
    nav: "docs"
search: true
---
<hr/>

오늘부터 React 단원이 시작됐다. 바로 React 코드를 치기 전에, React에서 매일 쓰게 될 JavaScript 문법을 먼저 정리했다. 불변 함수와 객체 문법, class, Promise와 async/await를 다시 보고, 서버와 통신하는 **axios**를 배운 뒤 **Vite**로 React 개발 환경을 세팅했다.

Web 시간에 JavaScript 기초와 Promise를 배우긴 했지만, 오늘은 "React에서 왜 이렇게 써야 하는가"라는 관점으로 다시 본 날이었다.

## React는 "다른 객체인가"로 변화를 판단한다
파이썬에서는 리스트에 `append`하고 원소를 직접 고쳤다. JavaScript에서도 `push`와 `users[1].name = ...`이 다 된다. 그런데 React에서 이렇게 하면 **화면이 안 바뀐다.**

React는 상태가 바뀌었는지 확인할 때 `이전값 === 새값` 하나만 본다. 객체와 배열에서 `===`는 내용이 아니라 "같은 객체를 가리키나"를 비교한다. `push`로 내용을 바꿔도 배열 자체는 그대로 같은 배열이라 `===`가 `true`가 되고, React는 안 바뀌었다고 보고 화면을 다시 그리지 않는다.

그래서 오늘 배운 문법은 결국 전부 **새 객체를 만들기 위한 것**이었다.

## spread - 펼쳐서 새로 담기
```js
const slime = { name: "슬라임" };
const cuteSlime = { ...slime, style: "cute" };        // 펼치고 추가

const smallSlime = { ...slime };   // 새 객체
const megaSlime  = slime;          // 같은 객체

console.log(slime == megaSlime);   // true
console.log(slime == smallSlime);  // false  ← 내용은 같은데도!
```

내용이 똑같아도 `false`가 나온다. React는 바로 이 `false`를 보고 "바뀌었구나" 하고 화면을 다시 그린다. `=`는 복사가 아니라 같은 상자에 이름표를 하나 더 붙이는 것이라는 점은 파이썬의 리스트 대입과 같은 이야기다.

값을 덮어쓸 때는 순서가 중요하다. **뒤에 쓴 것이 이긴다.**

```js
{ ...purpleSlime, color: "Green" }   // color: "Green"
{ color: "Green", ...purpleSlime }   // color: "purple"  ← spread 가 나중이라 덮어쓴다
```

## 불변 함수 - 원본을 안 건드리고 새것을 돌려준다
배열 메서드를 이 기준으로 두 줄로 나누는 게 오늘 가장 실용적인 부분이었다.

| 새 배열을 준다 (불변 함수) | 원본을 바꾼다 |
|---|---|
| `concat`, `filter`, `map`, `slice`, `...` | `push`, `pop`, `splice`, `sort`, `reverse` |

`slice`와 `splice`는 한 글자 차이인데 정반대다. `slice`는 잘라서 새 배열을 주고, `splice`는 원본을 직접 도려낸다. React 상태에 `splice`를 쓰면 에러 없이 화면만 안 바뀐다.

React에서 쓰는 패턴은 이렇게 정리됐다.

```js
const next = [...list, newItem];                                   // 추가 → spread (또는 concat)
const next = list.filter(x => x.id !== id);                        // 삭제 → filter
const next = list.map(u => u.id === dto.id ? { ...u, ...dto } : u); // 수정 → map + spread
const next = [...a.slice(0, 2), 4, ...a.slice(2)];                 // 중간 삽입 → slice
```

수정 예제의 결과를 하나씩 비교해보니 이 방식이 왜 좋은지 보였다.

```js
const users = [
  { id: 1, name: "John",  phone: "111-1111" },
  { id: 2, name: "Susan", phone: "222-2222" },
  { id: 3, name: "Kelly", phone: "333-3333" },
];
const updateUserDto = { id: 2, name: "홍길동" };

const newUsers = users.map(user =>
  user.id === updateUserDto.id ? { ...user, ...updateUserDto } : user
);

users == newUsers          // false  ← 배열은 새것
users[0] == newUsers[0]    // true   ← 안 바뀐 항목은 그대로 재사용
users[1] == newUsers[1]    // false  ← 바뀐 항목만 새것
```

아파트 한 채를 리모델링할 때 바뀐 집만 새로 짓고 나머지는 그대로 두는 것과 같다. React는 목록을 다시 그릴 때 `users[0] === newUsers[0]`이면 그 항목은 건드리지 않는다. 그래서 1,000개짜리 목록에서 하나만 바뀌면 하나만 다시 그린다. `{ ...user, ...updateUserDto }`는 두 객체를 겹쳐서 뒤엣것이 이기니, `name`만 새 값으로 덮이고 `phone`은 그대로 남는다.

다만 spread는 **한 겹만** 새로 만드는 얕은 복사다. 안쪽 객체까지 바꾸려면 `{ ...orig, address: { ...orig.address, city: "부산" } }`처럼 안쪽도 펼쳐야 한다. React는 얕은 복사로 비교하기 때문에 보통은 이걸로 충분하고, 그래서 상태를 너무 깊게 만들지 않는 게 좋다고 했다.

그리고 `const`는 불변이 아니다. `const a = [1, 2, 3]; a.push(4);`는 된다. `const`는 이름표를 다른 곳에 못 붙인다는 뜻일 뿐, 상자 안은 얼마든지 바뀐다.

## 비구조화 할당과 rest
```js
const ironMan = { name: "스타크", actor: "로다주", alias: "아이언맨" };
let { actor, name } = ironMan;           // 객체는 이름으로 꺼낸다
let { name: nickname } = ironMan;        // 이름을 바꿔서 꺼내기

const [one, two] = [1, 2];               // 배열은 순서로 꺼낸다
[a, b] = [b, a];                         // 값 맞바꾸기

const print = ({ a, b = 2 }) => console.log(a, b);   // 함수 파라미터에서도, 기본값까지
```

`{`가 왼쪽에 오면 분해, 오른쪽에 오면 생성이다. 이름이 틀리면 에러가 아니라 조용히 `undefined`가 들어와서, 오타 하나로 화면이 비는 사고가 난다고 했다.

내일 배울 `const [count, setCount] = useState(0)`이 바로 배열 비구조화다. `useState`가 `[값, 바꾸는 함수]` 두 칸짜리 배열을 돌려주고 그걸 순서대로 받는 것이라, 이름은 마음대로 지어도 된다.

`...`은 위치에 따라 뜻이 정반대가 된다.

| 위치 | 이름 | 역할 |
|---|---|---|
| 오른쪽 (값을 만드는 쪽) | spread | 펼친다 |
| 왼쪽 (값을 받는 쪽) | rest | 나머지를 모은다 |

```js
const { color, ...rest } = purpleSlime;     // color 를 뺀 나머지가 rest 로
const sum = (...nums) => nums.reduce((a, c) => a + c, 0);
sum(...[1, 2, 3]);                           // 배열을 펼쳐서 인자로
```

rest는 "나머지를 다 가져가는 것"이라 반드시 마지막에 와야 한다. 파이썬과 비교하면 모으기는 `*args`, 펼치기는 `f(*arr)`, 딕셔너리는 `{**d}`인데, JavaScript는 배열이든 객체든 `...` 하나로 다 한다.

## class - 파이썬과 닮았지만 속은 다르다
JavaScript에는 원래 클래스가 없었고 **프로토타입**이라는 방식으로 상속을 했다. "이 객체가 모르면 저 객체한테 물어봐라"라는 연결선을 걸어두는 방식이다. ES6의 `class`는 그 위에 씌운 읽기 쉬운 겉옷이다.

요즘 React는 함수형 컴포넌트를 써서 클래스를 직접 쓸 일은 거의 없지만, 옛날 React 코드(`class App extends React.Component`)와 라이브러리 안쪽 코드를 읽으려면 알아야 한다.

```js
class Theta {
  name;                                   // 필드 (이 클래스가 갖는 것)
  age;

  constructor(name = "이민재", age = 26) { // 파이썬의 __init__
    this.name = name;
    this.age = age;
  }
}
new Theta();               // Theta { name: '이민재', age: 26 }
```

인자를 안 줘도 에러가 아니라 `undefined`가 들어간다. 파이썬이라면 `TypeError`가 났을 자리다. 브라우저에서 스크립트 하나가 멈추면 페이지 전체가 죽으니 최대한 굴러가게 만든 설계라서, 편한 대신 버그가 조용히 숨는다.

### getter와 setter
```js
class Alpha {
  _name = "no name";
  get name() { return this._name; }
  set name(value) { this._name = value; }
}

const a = new Alpha();
a.name = "김정준";       // 대입처럼 보이지만 setter 가 실행된다
console.log(a.name);    // 속성을 읽는 것처럼 보이지만 getter 가 실행된다
```

괄호 없이 도는 함수다. 내부 값을 `_name`으로 짓는 이유는, setter 안에서 `this.name = value`라고 쓰면 setter가 자기 자신을 다시 부르는 무한 재귀가 되기 때문이다. setter를 안 만들면 읽기 전용이 되는데, 일반 스크립트에서는 값을 넣어도 에러 없이 조용히 무시된다(`import`/`export`를 쓰는 모듈에서는 에러가 난다).

- `static`은 `new` 없이 클래스 이름으로 쓰는 것이다. `static` 함수 안의 `this`는 인스턴스가 아니라 클래스 자신이라 인스턴스 필드는 `undefined`로 나온다.
- `extends`로 상속하고, 자식 클래스에 `constructor`를 직접 쓰면 첫 줄에 `super()`를 반드시 불러야 한다. 파이썬은 안 불러도 되지만 JavaScript는 강제다.
- JavaScript의 `this`는 파이썬의 `self`처럼 고정된 게 아니라 "어떻게 불렸는지"에 따라 바뀐다. 이 변덕 때문에 요즘 코드가 `this`를 고정해주는 화살표 함수 천지라고 한다.

## Promise와 async/await 다시 보기
JavaScript는 기다리지 않고 다음 줄로 넘어간다. 서버 응답을 기다리느라 멈추면 버튼도 안 눌리고 화면이 얼어붙기 때문이다. 그래서 "끝나면 이걸 해라"를 적는 방법이 콜백 → Promise → async/await 순서로 발전해왔다.

Web 시간에 배운 내용에 더해 새로 정리한 것들이다.

```js
const p = new Promise((resolve) => {
  console.log("p1");                      // 만드는 순간 바로 실행된다
  setTimeout(() => { console.log("p2"); resolve(); }, 1000);
});
p.then(() => console.log("p3"));
console.log("p4");
// 출력: p1 → p4 → p2 → p3
```

- `new Promise(...)`에 넘기는 함수(executor)는 비동기가 아니다. 만드는 즉시 실행되고, 비동기인 건 그 안의 `setTimeout`이다.
- `.then()` 안에서 Promise를 **리턴해야** 다음 `.then()`이 기다린다. `.then(() => { c(); })`처럼 중괄호 안에 `return`이 없으면 안 기다리고 바로 넘어간다. 에러 없이 순서만 뒤엉킨다.
- `Promise.all([p1, p2, p3])`는 셋을 동시에 출발시켜서 가장 늦은 것 기준으로 끝난다. 결과 배열은 끝난 순서가 아니라 넣은 순서다. 하나라도 실패하면 전부 실패라서, 성공한 것만이라도 받고 싶으면 `Promise.allSettled()`를 쓴다.
- 서로 관계없는 요청을 `await`로 줄줄이 세우면 3초 + 3초 = 6초지만, `await Promise.all([...])`로 묶으면 3초다.
- `forEach(async ...)` 안의 `await`는 기다려주지 않는다. 순서대로 처리하려면 `for...of` 안에서 `await`한다.
- 파일 최상단에서 `await`를 쓰려고 `(async function() { ... })();`처럼 감싸서 바로 실행하는 문법(IIFE)도 봤다.

## axios - Promise를 돌려주는 HTTP 통신
파이썬의 `requests`처럼 서버와 통신하는 라이브러리다. 브라우저에도 `fetch`가 있지만 axios가 몇 가지 더 편하다.

| | fetch | axios |
|---|---|---|
| JSON 파싱 | `res.json()` 을 한 번 더 | 자동 |
| 404, 500 응답 | 성공으로 취급한다 | `.catch()` 로 간다 |
| 기본 설정 재사용 | 직접 만들어야 한다 | `axios.create()` |
| 실행 환경 | 브라우저 | 브라우저 + Node.js |

`fetch`는 서버가 404를 줘도 "요청 자체는 성공"으로 보고 `.then()`으로 가서 매번 `res.ok`를 확인해야 하는데, axios는 알아서 `.catch()`로 보낸다.

```js
const { data } = await axios.get(url);    // 응답 본문은 response.data 에 있다
```

`response`에는 상태 코드, 헤더 같은 정보가 잔뜩 들어 있고 서버가 보낸 실제 데이터는 `response.data`다. 비구조화 할당으로 바로 꺼내면 깔끔하다.

### get과 post는 두 번째 인자가 다르다
```js
axios.get(url, { params: { page: 1 } });          // 2번째 = 설정 (params 는 ?page=1 로 붙는다)
axios.post(url, { name: "홍길동" });               // 2번째 = 보낼 데이터 (body)
axios.post(url, { name: "홍길동" }, { headers });  // 3번째가 설정

axios.get(url, { name: "홍길동" });                // 아무것도 안 보내진다
```

GET에는 body가 없어서 데이터를 URL 뒤에 붙이고, POST는 본문에 담기 때문에 자리 개수가 다르다. 마지막 줄처럼 쓰면 에러 없이 아무것도 안 보내져서 한참 찾게 된다.

실습은 서울시 지하철 승하차 인원 공공 API로 했다.

```js
url = `http://openapi.seoul.go.kr:8088/${api_key}/json/CardSubwayStatsNew/1/5/${date}`;
axios.get(url).then(response => printResult(response.data));
console.log("언제 찍힐까?");     // 이게 먼저 찍힌다
```

같은 API를 XML로도 받아봤는데, axios가 XML은 자동으로 풀어주지 않아서 문자열을 직접 파싱해야 했고 값 하나 꺼내는 코드가 `row.getElementsByTagName("SBWY_STNS_NM")[0].childNodes[0].nodeValue`처럼 길었다. JSON에서는 `row.SBWY_STNS_NM` 한 마디다. 요즘 API가 대부분 JSON인 이유를 체감하는 예제였다.

### axios.create() - 앞으로 계속 쓸 패턴
```js
// src/api.js
import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:8000",
  headers: { "Content-Type": "application/json" },
  timeout: 10000,
});

export default api;
```

매번 같은 주소와 헤더를 적지 않게 미리 도장을 파두는 것이다. 서버 주소가 바뀌면 이 파일 한 줄만 고치면 된다. `timeout`은 기본값이 무제한이라, 서버가 응답을 안 주면 스피너가 영원히 돈다. 나중에 JWT 인증을 할 때는 이 인스턴스에 인터셉터를 달아서 모든 요청에 토큰을 자동으로 붙인다고 한다.

## Vite로 React 환경 세팅
```bash
npm create vite@latest
npm install
npm run dev
```

Vite는 React 개발 서버 겸 빌드 도구다. 예전에는 `create-react-app`을 썼는데 너무 느려서 요즘은 대부분 Vite를 쓴다고 한다.

파일이 이어지는 순서가 가장 중요했다.

```
index.html  →  src/main.jsx  →  src/App.jsx
```

```html
<!-- index.html -->
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.jsx"></script>
</body>
```

```jsx
// main.jsx
import { createRoot } from "react-dom/client";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(<App />);
```

HTML 파일은 `index.html` 딱 하나뿐이다. 화면이 여러 개처럼 보여도 실제 HTML은 하나라서 SPA(Single Page Application)라고 부른다. "`root`라는 div를 찾아서 거기에 `<App />`을 그려라"는 한 줄이 React 앱의 전부이고, 내가 만드는 화면은 `App.jsx`부터다.

- `StrictMode`는 개발 중에만 켜지는 검사 모드라서 컴포넌트를 일부러 두 번 실행한다. `console.log`가 두 번 찍혀도 버그가 아니다.
- `package.json`의 `dependencies`는 배포된 앱에도 들어가는 것(react, axios), `devDependencies`는 개발할 때만 쓰는 것(vite, eslint)이다.
- 버전 앞의 `^1.17.0`은 "1.x.x 안에서는 최신으로 받아도 좋다"는 뜻이다. 팀원마다 설치된 버전이 미세하게 달라질 수 있어서, 정확히 맞춰주는 `package-lock.json`은 git에 꼭 올린다.
- `node_modules`는 절대 git에 올리지 않는다. 파일이 수만 개인데 `package.json`만 있으면 `npm install`로 언제든 다시 만들 수 있다.

## 헷갈리기 쉬운 부분
- `1 == "1"`은 `true`, `1 === "1"`은 `false`다. 서버에서 온 id가 숫자인지 문자열인지 확실하지 않을 때 `==`를 쓰면 "가끔만 나는 버그"가 되니, 습관적으로 `===`를 쓴다.
- `for...of`는 값을, `for...in`은 키(인덱스)를 꺼낸다. 배열에 `for...in`을 쓰면 인덱스가 문자열로 나온다.
- `c.hello`처럼 괄호를 빼면 함수를 실행하지 않고 가리키기만 한다. React에서 `onClick={handleClick}`은 함수를 넘기는 것이고, `onClick={handleClick()}`은 지금 당장 실행해서 그 결과를 넘기는 것이다.
- `class`는 일반 `function`과 달리 정의하기 전에 쓸 수 없다.
- API 키를 프론트 코드에 넣으면 안 된다. React는 브라우저에서 도는 코드라 빌드해도 개발자 도구로 소스가 다 보인다. 키가 필요한 요청은 FastAPI 서버를 거쳐서 보내고, 키는 서버의 `.env`에만 둔다.
- 에러를 `console.log(error)`로 통째로 찍으면 수백 줄이 쏟아진다. 보통 필요한 건 `error.response?.status`, `error.response?.data`, `error.message` 셋이다. `?.`는 있으면 꺼내고 없으면 `undefined`를 주는데, 네트워크가 아예 안 되면 `error.response` 자체가 없어서 `?.` 없이 쓰면 에러 처리 중에 또 에러가 난다.
- 내일부터 React(5173번 포트)에서 FastAPI(8000번 포트)를 부르면 CORS 에러를 만나게 된다. 막는 건 서버가 아니라 브라우저이고, 서버 쪽에서 허용할 주소를 적어줘야 풀린다고 미리 들었다.

## 오늘 배운 내용 정리
오늘은 React를 시작하기 전에 필요한 JavaScript 문법과 axios, Vite 환경 세팅을 배웠다.

```
React 의 변화 감지: 이전값 === 새값. 객체·배열은 "같은 객체인가"를 본다.
spread: {...obj} 는 내용이 같아도 다른 객체. 뒤에 쓴 값이 이긴다.
불변 함수: concat, filter, map, slice 는 새 배열. push, splice, sort 는 원본 변경.
React 패턴: 추가는 spread, 삭제는 filter, 수정은 map + spread.
비구조화 할당: 객체는 이름으로, 배열은 순서로 꺼낸다. useState 가 배열 비구조화.
rest: 왼쪽의 ... 은 나머지를 모은다. 항상 마지막.
class: 프로토타입 위의 겉옷. getter/setter 는 괄호 없이 도는 함수. 자식 constructor 는 super() 필수.
Promise: executor 는 즉시 실행. then 안에서는 return. 관계없는 요청은 Promise.all.
axios: 응답은 response.data. get 은 params, post 는 두 번째 인자가 body.
axios.create(): baseURL 과 헤더를 한 곳에. 서버 주소가 바뀌면 한 줄만 고친다.
Vite: index.html → main.jsx → App.jsx. HTML 은 하나뿐(SPA).
```

React를 배우기 전에 JavaScript 문법을 하루 더 본 이유가 "React는 `===`로 변화를 판단한다"는 한 문장에 다 들어 있었다. 오늘 정리한 spread와 `map`, `filter`가 내일부터 상태를 바꿀 때마다 쓰일 것 같다.

---
