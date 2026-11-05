---
layout: single
title: "Web 기초 정리 4 - Truthy·Falsy, 화살표 함수, 배열 고차함수와 JSON"
categories: [coding, Web]
tag: [study-log, Web, JavaScript, truthy-falsy, SCE, arrow-function, for-of, map, filter, reduce, sort, JSON]
toc: true
author_profile: false
sidebar:
    nav: "docs"
search: true
---
<hr/>

어제 JavaScript의 변수, 함수, 객체, 배열 기본을 배웠고, 오늘은 조건문과 반복문, 참/거짓 판정과 단축 평가, 화살표 함수, 여러 가지 순회 방법, 그리고 `map`, `filter`, `reduce` 같은 배열 고차함수와 정렬, JSON과 정규표현식까지 배웠다.

Python에서 배운 개념들이 이름만 바꿔서 거의 다 나왔다. 그래서 오늘은 **Python과 같은 것은 빠르게, 다른 것은 자세히** 정리해보려고 한다.

## 조건문과 반복문
문법은 C나 Java와 거의 같다.

```javascript
if (point >= 4.0)      { console.log("A학점"); }
else if (point >= 3.0) { console.log("B학점"); }
else                   { console.log("F 입니다"); }

for (let i = 0; i < 5; i++) { console.log(i); }

switch (n) {
    case 1:
        console.log('하나');
        break;       // 없으면 아래 case 로 계속 흘러간다
    default:
        console.log('기타');
}
```

`for (초기식; 조건식; 증감식)`의 실행 순서는 초기식 → 조건식 → 본문 → 증감식 → 조건식... 이다.

JS에서 조심해야 할 실수가 하나 있었다.

```javascript
if (n % 2 == 0);           // 여기 세미콜론!
    console.log("짝수");    // 조건과 상관없이 항상 실행된다
```

`if (조건);`은 "조건이 참이면 아무것도 안 한다"는 완결된 문장이 돼버린다. 에러가 안 나서 더 위험하다. 그래서 **한 줄이어도 중괄호를 쓰는 게** 실무 원칙이라고 한다.

## Falsy는 딱 6개
JS의 `if`도 Python처럼 모든 값을 참/거짓으로 판정한다. **Falsy는 딱 6개**만 외우면 된다.

```
false, 0, '', null, undefined, NaN
```

나머지는 전부 Truthy다. 그런데 여기서 Python과 다른 점이 있었다.

```javascript
if ([]) { }   // 참!  Python 에서는 빈 리스트가 거짓이었다
if ({}) { }   // 참!  Python 에서는 빈 dict 가 거짓이었다
if (' ') { }  // 참   공백 한 칸도 글자다
```

**JS에서는 빈 배열과 빈 객체가 참이다.** Python을 먼저 배워서 반드시 걸릴 것 같은 부분이다. 그릇 자체는 비어 있어도 존재하니까 참이라고 이해했다. 그래서 배열이 비었는지는 `if (arr.length > 0)`으로 확인해야 한다.

## 단축 평가와 ?? ?.
Python에서 배운 SCE가 JS에서도 똑같이 동작한다. `&&`와 `||`는 true/false가 아니라 판단에 쓰인 값 자체를 돌려준다.

```javascript
console.log(true && 'hello');     // 'hello'
console.log(0 && 'hello');        // 0
console.log(null || '기본값');     // '기본값'
```

`&&`는 "앞이 있어야 뒤를 본다"(안전 검사용), `||`는 "앞이 없으면 뒤를 쓴다"(기본값용)로 읽으면 된다.

그런데 `||`로 기본값을 주면 문제가 있다. `0`이나 `''`도 falsy라서, 값이 0인데도 기본값으로 바뀌어버린다. 그래서 나온 게 `??`(nullish 병합)다.

```javascript
const count = 0;
console.log(count || 10);   // 10  ← 0 인데 기본값으로 바뀐다
console.log(count ?? 10);   // 0   ← null / undefined 일 때만 기본값
```

`?.`(옵셔널 체이닝)은 중간에 값이 없어도 에러 없이 `undefined`를 돌려준다.

```javascript
const name = user?.profile?.name ?? '이름 없음';
```

`user`가 없으면 `user.profile`에서 에러가 났을 텐데, `?.`가 앞이 없으면 거기서 멈춰준다. Python 함수를 배울 때 `animal and animal.get('name')`으로 했던 검증을 한 줄로 하는 셈이다.

## 화살표 함수
```javascript
// 기존 함수 표현식
add = function(a, b) { return a + b; }

// function 을 지우고 => 를 붙인다
add = (a, b) => { return a + b; }

// 본문이 return 한 줄뿐이면 중괄호와 return 을 뺀다
add = (a, b) => a + b;

const hello = name => console.log(`hello: ${name}!`);  // 매개변수가 하나면 괄호 생략 가능
const f = () => console.log('hi');                      // 없으면 () 필수
```

Python의 `lambda a, b: a + b`에 해당한다. 중괄호를 쓰면 `return`을 직접 써야 하고, 안 쓰면 자동으로 리턴된다.

객체를 리턴할 때는 함정이 있다.

```javascript
const makeUser = (name) => { name: name };     // undefined 를 리턴한다
const makeUser = (name) => ({ name: name });   // 소괄호로 감싼다
```

`{`를 만나면 JS가 함수 본문 블록으로 읽어버리기 때문이다.

그리고 화살표 함수의 진짜 차이는 짧게 쓰는 것보다 **`this`를 자기 것으로 만들지 않는다**는 점이라고 한다. 그래서 객체의 메서드로는 쓰지 않는 게 좋다. 이건 내일 자세히 배운다고 하셨다.

## 순회 방법 정리
노트에 "JS는 for가 복잡하게 많다"고 적혀 있었다. Python은 `for x in y:` 하나로 다 돌았는데, JS는 대상에 따라 쓸 수 있는 게 다르다.

```javascript
const fruits = ["Banana", "Orange", "Apple"];
const person = { name: 'John', age: 15 };

for (const item of fruits) { }                        // 배열 → 값
for (const key in person) { console.log(person[key]); } // 객체 → key
for (const [k, v] of Object.entries(person)) { }      // 객체 → key 와 값
fruits.forEach((value, index) => console.log(index, value));
```

| | 무엇을 주나 | 어디에 |
|---|---|---|
| `for~in` | key(속성 이름) | 객체 |
| `for~of` | value(값) | 배열, 문자열 |
| `forEach` | (값, 인덱스, 배열) | 배열 |

`for~in`을 배열에 쓰면 인덱스가 문자열(`"0"`, `"1"`)로 나오고, 배열에 추가된 다른 속성까지 딸려 나와서 쓰지 말라고 하셨다. 그리고 객체에는 `for~of`를 쓸 수 없어서 `Object.entries()`로 바꿔서 돌린다.

결론은 **배열에는 `for~of`, 객체에는 `Object.entries()` + `for~of`**다.

## 배열 고차함수
함수를 인자로 받는 함수를 **고차함수**라고 한다. 빈 배열을 만들고 돌면서 push하는 코드는 항상 같은 모양이라 한 줄로 줄일 수 있다.

```
map    : n개 → n개    (개수 그대로, 값만 바뀜)
filter : n개 → n개 이하 (고른 것만 남음)
reduce : n개 → 1개    (하나로 합쳐짐)
```

```javascript
const arr = [11, 12, 13, 14, 15];
arr.map(e => e * 2);                       // [22, 24, 26, 28, 30]
arr.filter(e => e % 3 === 0);              // [12, 15]
arr.reduce((prev, cur) => prev + cur, 0);  // 65
```

Python에서 배운 map, filter, reduce와 같은 개념이다. 다만 Python은 `map(함수, 리스트)`처럼 함수에 리스트를 넘겼는데, JS는 `arr.map(함수)`처럼 **배열의 메서드**로 쓴다. 그리고 Python의 map은 map 객체를 돌려줬는데, JS는 바로 새 배열을 돌려준다. 셋 다 원본은 그대로 둔다.

객체 배열에서 조건으로 찾을 때는 `find`와 `findIndex`를 쓴다.

```javascript
const todos = [
  { id: 1, text: "자바스크립트 입문", done: true },
  { id: 3, text: "객체와 배열 배우기", done: true },
];
todos.find(todo => todo.id === 3);        // 원소 자체 (못 찾으면 undefined)
todos.findIndex(todo => todo.id === 3);   // 인덱스 (못 찾으면 -1)
```

`every`는 전부 참인지, `some`은 하나라도 참인지 확인한다. 둘 다 결과가 정해지는 순간 멈춰서, `every`는 `&&`, `some`은 `||`를 배열로 확장한 것과 같다. Python의 `all()`, `any()`와 같은 역할이다.

## sort는 기본이 문자열 정렬
```javascript
let arr1 = [40, 100, 1, 5, 25, 10];
arr1.sort();
console.log(arr1);   // [1, 10, 100, 25, 40, 5]
```

정렬이 안 된 것처럼 보이는데 버그가 아니라 설계가 그렇다. **`sort()`는 매개변수가 없으면 각 요소를 문자열로 바꿔서 비교**한다. `"25"`는 첫 글자가 `2`라서 `"100"`(첫 글자 `1`)보다 뒤에 온다.

숫자는 비교 함수를 넘겨야 한다.

```javascript
arr1.sort((a, b) => a - b);        // 오름차순
arr1.sort((a, b) => b - a);        // 내림차순
people.sort((a, b) => a.age - b.age);  // 객체 배열: 나이 오름차순
```

비교 함수가 음수를 돌려주면 a가 앞, 양수면 b가 앞, 0이면 그대로다. 그래서 `a - b`가 오름차순이 된다. Python의 `key=lambda x: x['age']`는 "비교할 값을 꺼내는 함수"였는데, JS는 "두 개를 비교하는 함수"라서 방식이 달랐다.

그리고 `sort()`는 원본을 바꾸고 그 원본을 돌려준다.

## JSON
서버와 데이터를 주고받으려면 글자로 바꿔야 한다. JS 객체를 문자열로 바꿨다가 받아서 다시 객체로 되돌리는 규칙이 JSON이다.

```javascript
JSON.stringify({ name: "John", age: 31 });   // '{"name":"John","age":31}'
JSON.parse('{"name":"John","age":31}');      // { name: 'John', age: 31 }
```

Python의 `json.dumps()`, `json.loads()`와 이름만 다르다.

JSON은 JS 객체보다 문법이 엄격하다. **키는 반드시 큰따옴표**여야 하고, 문자열도 큰따옴표만 되고, 마지막 콤마와 주석은 안 된다. 그리고 함수와 `undefined`는 담을 수 없어서 `stringify`하면 에러 없이 조용히 사라진다. `Date`는 문자열로 바뀌어서 돌아온다.

정규표현식은 Python에서 배운 문법이 그대로 쓰인다. JS는 `/패턴/플래그` 형태로 쓴다.

```javascript
/^\d{3}-\d{4}$/.test("123-4567");   // true
```

플래그는 `i`(대소문자 무시), `g`(전체), `m`(여러 줄)이 있다.

## 유사 배열과 Array.from()
```javascript
const str = "Hello";
str.forEach(ch => console.log(ch));   // 에러: 문자열에는 forEach 가 없다
```

JS에는 배열처럼 생겼는데 배열 메서드가 없는 것이 꽤 있다. 숫자 인덱스와 `length`가 있으면 **유사 배열(array-like)**, `for~of`를 쓸 수 있으면 **iterable**이라고 한다. 둘 다 배열은 아니고, `Array.from()`으로 진짜 배열로 바꿀 수 있다.

```javascript
Array.from("Hello").forEach(ch => console.log(ch));
```

모레 배울 DOM에서 `document.querySelectorAll()` 결과가 딱 이 유사 배열이라서, 그때 `map`을 쓰려면 이게 필요하다고 한다.

## 오늘 배운 내용 정리
오늘은 JavaScript의 제어문, 함수, 배열 처리를 배웠다.

```
if: 한 줄이어도 중괄호를 쓴다. if (조건); 처럼 세미콜론을 붙이지 않는다.
switch: case 마다 break 가 필요하다.
Falsy: false, 0, '', null, undefined, NaN. [] 와 {} 는 Truthy (Python 과 다르다).
단축 평가: && 는 안전 검사, || 는 기본값. 0 도 살리려면 ??.
?.: 중간 값이 없으면 에러 대신 undefined.
화살표 함수: (a, b) => a + b. 객체를 리턴하려면 ({ ... }).
순회: 배열은 for~of, 객체는 Object.entries() + for~of. for~in 은 배열에 쓰지 않는다.
고차함수: map(n→n), filter(n→n이하), reduce(n→1), find / findIndex, every / some.
sort: 기본이 문자열 정렬. 숫자는 (a, b) => a - b.
JSON: stringify / parse. 키는 큰따옴표. 함수와 undefined 는 사라진다.
Array.from(): 유사 배열과 iterable 을 진짜 배열로.
```

Python에서 배운 개념이 거의 다 나와서 이해는 빨랐는데, 빈 배열이 참이라는 것이나 sort가 문자열 정렬이라는 것처럼 **비슷해 보여서 더 헷갈리는** 부분들이 있었다. 이런 차이점들은 따로 표시해두고 계속 확인해야 할 것 같다.

---
