---
layout: single
title: "Web 기초 정리 3 - JavaScript 시작, 변수와 형 변환, 함수·객체·배열"
categories: [coding, Web]
tag: [study-log, Web, JavaScript, Node.js, let, const, type-coercion, function, object, this, array]
toc: true
author_profile: false
sidebar:
    nav: "docs"
search: true
---
<hr/>

HTML과 CSS로 화면의 뼈대와 모양을 만들었으니, 오늘부터는 동작을 담당하는 **JavaScript**를 배우기 시작했다.

문법을 연습할 때마다 HTML 파일을 만들고 브라우저를 켜는 건 번거로워서, 오늘은 Node.js를 설치해서 `.js` 파일만으로 실행하는 환경을 만들었다. 그리고 변수, 연산자, 자료형, 함수, 객체, 문자열, 배열까지 기본 문법을 쭉 배웠다.

Python을 먼저 배워서 비슷한 부분이 많았는데, 오히려 **비슷해 보이는데 다르게 동작하는 부분**이 더 기억에 남았다. 그 차이를 중심으로 정리해보려고 한다.

## Node.js
브라우저 안에는 JS를 읽고 실행하는 부품이 들어 있는데, 크롬의 그 부품 이름이 V8 엔진이다. 이 V8만 꺼내서 단독 프로그램으로 만든 것이 Node.js라고 한다.

```bash
node --version     # 설치 확인
node a01_Hello.js  # 실행
```

```javascript
console.log('Hello JavaScript');   // 파이썬의 print()
```

VS Code의 Code Runner 확장을 설치하면 `Ctrl+Alt+N`으로 바로 실행할 수 있다.

Node에서는 `document`, `window`, `alert()`처럼 브라우저에만 있는 것은 쓸 수 없고, 반대로 파일 읽기나 서버 열기처럼 Node에만 있는 것은 브라우저에서 못 쓴다. 변수, 함수, 배열, 객체, `console.log()`는 양쪽 다 되는데, 오늘 배우는 게 전부 이쪽이다.

그리고 **JavaScript는 Java와 관련이 없다.** 1995년에 만들 때 원래 이름은 LiveScript였는데, 당시 Java가 인기여서 마케팅 목적으로 이름을 바꿨다고 한다. ES6(2015)에서 문법이 크게 바뀌었고, "모던 자바스크립트"는 ES6 이후 문법을 말한다.

## let, const, var
파이썬은 `x = 10`이면 끝인데, JS는 앞에 키워드를 붙인다.

```javascript
const PI = 3.14;     // 값 변경 X, 선언할 때 반드시 초기화
let count = 0;       // 값 변경 O
var k = 10;          // 옛 방식, 쓰지 말 것
myValue = 200;       // 키워드 없음 → 전역 변수가 된다. 절대 하지 말 것
```

| | 재할당 | 재선언 | 스코프 |
|---|---|---|---|
| const | X | X | 블록 |
| let | O | X | 블록 |
| var | O | **O** | 함수 |

`var`를 안 쓰는 이유는 같은 이름을 두 번 선언해도 에러 없이 조용히 덮어쓰기 때문이다. `let`과 `const`는 여기서 에러를 내준다. **에러가 나는 게 좋은 것**이라는 말이 와닿았다.

규칙은 **`const`를 기본으로 쓰고, 바뀌어야 할 때만 `let`**이다.

그런데 `const`인데 값이 바뀌는 경우가 있었다.

```javascript
const person = { firstName: "John", age: 50 };
person.firstName = 'Jane';   // 된다
person = { name: 'hello' };  // 에러
```

`const`는 "값을 못 바꾼다"가 아니라 **"이 이름이 다른 것을 가리키지 못한다"**는 뜻이다. 이사는 못 가지만 집 안의 가구는 바꿀 수 있는 것과 같다. 그래서 객체와 배열은 거의 항상 `const`로 선언한다.

그리고 `let`과 `const`는 **블록 스코프**라서 `{ }` 안에서 선언하면 밖에서 못 쓴다. Python에서는 if나 for 블록이 스코프를 만들지 않았는데, JS는 반대였다.

## == 대신 ===
```javascript
console.log(10 == "10");   // true   ← 타입을 맞춰서 값만 비교
console.log(10 === "10");  // false  ← 값 그리고 타입까지 비교
```

`==`는 타입을 멋대로 바꿔서 비교한다. `0 == "0"`은 true, `0 == []`도 true인데 `"0" == []`는 false다. 이 규칙을 다 외우는 사람은 없어서, 업계 전체가 **"`===`만 쓴다"**로 합의했다고 한다.

증감 연산자는 앞뒤 위치에 따라 결과가 다르다.

```javascript
num4 = 100;
num5 = ++num4;   // 먼저 증가시키고 대입 → num5 = 101
num4 = 100;
num5 = num4++;   // 먼저 대입하고 증가 → num5 = 100
```

`++`가 앞에 있으면 먼저 올리고, 뒤에 있으면 나중에 올린다. 다만 실무에서는 다른 연산과 섞어 쓰지 않는다고 한다.

삼항 연산자는 `조건 ? 참일때 : 거짓일때`이다. 파이썬의 `A if 조건 else B`와 순서가 다르다.

```javascript
const diff = (a > b) ? (a - b) : (b - a);
```

## 자료형과 암묵적 형 변환
타입은 `number`, `string`, `boolean`, `object`, `function`과 값이 없는 `undefined`, `null`이 있다. `undefined`는 시스템이 "아직 안 들어왔다"고 표시한 것이고, `null`은 개발자가 "비었다"고 일부러 넣은 것이다.

오늘 가장 놀란 부분이다.

```javascript
"10" + 10   // "1010"  문자열 연결
"10" * 10   // 100     숫자
"10" - 10   // 0       숫자
"10" > 2    // true    숫자로 바꿔서 비교
"10" > "2"  // false   둘 다 문자열이면 사전 순 비교
"a" * 10    // NaN
```

JS는 타입이 안 맞으면 에러를 내지 않고 알아서 바꿔버린다. 규칙은 하나만 기억하면 된다. **`+`만 특별하다.** 한쪽이 문자열이면 다른 쪽도 문자열로 바꿔서 이어 붙이고, 나머지 `- * / %`는 양쪽을 숫자로 바꿔서 계산한다.

Python에서 `"55" + 31`은 바로 에러가 났는데, JS는 `"5531"`이 나와버린다. 폼 입력값은 항상 문자열이라서 `age + 1`이 `"201"`이 되는 버그가 생긴다고 하니, 숫자로 쓸 값은 `Number()`로 꼭 바꿔야 할 것 같다.

`undefined`, `NaN`, `null`, `Infinity`가 화면에 출력되고 있다면 무언가 잘못 만들어졌다는 신호라는 말도 기억해두려고 한다. 에러 메시지 대신 나오는 조용한 경고다.

문자열 조립은 템플릿 리터럴을 쓴다. 따옴표가 아니라 **백틱**이다.

```javascript
console.log(`Hello, ${name}!`);   // 파이썬의 f-string
```

## 배열과 객체의 차이
```javascript
x = [10, 20, 30];
console.log(x[3]);    // undefined  범위를 벗어나도 에러가 아니다
console.log(x[-1]);   // undefined  음수 인덱싱이 안 된다
```

파이썬에서 온 사람이 가장 많이 당하는 두 가지라고 한다. 파이썬은 `x[5]`가 `IndexError`, `x[-1]`이 마지막 원소인데, JS는 둘 다 `undefined`다. 마지막 원소는 `x[x.length - 1]`이나 `x.at(-1)`로 꺼낸다.

## 함수는 데이터다
```javascript
function sayName(name) {
    console.log(`제 이름은 ${name} 입니다`);
}

sayName();                       // "제 이름은 undefined 입니다"
sayName('준준이', '서울 강남구');   // 두 번째 인자는 그냥 무시
```

JS 함수는 **인자 개수가 안 맞아도 에러가 안 난다.** 모자라면 `undefined`, 남으면 무시한다. 파이썬이라면 둘 다 `TypeError`다. 화면에 undefined가 찍히는 원인이 대부분 이것이라고 한다.

`return`은 값 하나만 돌려줄 수 있어서, 여러 개가 필요하면 배열이나 객체로 묶는다.

그리고 Python에서도 배웠듯이 JS에서도 함수는 값이다.

```javascript
console.log(typeof sayAnthem);   // "function"
console.log(sayAnthem.toString()); // 함수의 소스 코드가 문자열로 나온다

const bbb = function(a, b) { return a + b; };   // 함수 표현식: 함수를 변수에 담는다
(function(){ console.log('즉시 실행'); })();     // 즉시 실행 함수
```

함수의 소스 코드를 문자열로 꺼낼 수 있다는 게 신기했다.

## 객체와 this
```javascript
const person = {
    firstName: "John",
    lastName: "Doe",
    age: 50,
};

console.log(person.firstName);     // 점 표기법
console.log(person["firstName"]);  // 대괄호 표기법

const key = "firstName";
console.log(person[key]);          // 변수로 property 이름을 정할 때는 대괄호
```

객체는 파이썬의 dict와 비슷하다. 없는 property에 대입하면 그냥 만들어지고, 없는 것을 읽으면 `undefined`다. 그래서 `person.firstNmae = 'Jane'`처럼 오타를 내면 에러 없이 새 property가 생긴다. dict에서도 봤던 함정이다.

값이 함수인 property는 **메서드**가 되고, 그 안의 `this`는 자기 객체를 가리킨다.

```javascript
const x = {
    score: [94, 35, 79],
    getTotal: function() { return this.score[0] + this.score[1] + this.score[2]; },
    getAvg:   function() { return this.getTotal() / this.score.length; },
};
```

Python 클래스의 `self`와 비슷한데, JS의 `this`는 호출되는 방식에 따라 달라진다고 한다. 이건 모레 다시 배운다고 하셨다.

## number와 string
JS의 숫자 타입은 `number` 하나뿐이다. 정수와 실수 구분이 없어서 `123 === 123.0`이 true다. 그래서 `7 / 3`은 소수가 나오고, 파이썬의 `//` 같은 정수 나눗셈이 없어서 `Math.floor(7/3)`을 쓴다.

```javascript
console.log(0.1 + 0.2 === 0.3);   // false
console.log(0.1 + 0.2);           // 0.30000000000000004
```

Python 첫날 배운 실수 오차가 JS에서도 똑같이 나왔다. JS만의 문제가 아니라 다들 같은 표준(IEEE 754)을 쓰기 때문이다. 돈 계산은 원 단위 정수로 다루는 게 실무 정석이라고 한다.

`NaN`은 자기 자신과도 같지 않아서 `NaN === NaN`이 false다. 그래서 `isNaN()`이나 `Number.isNaN()`으로 확인해야 한다.

숫자 변환 방법은 여러 개이고 결과가 다르다.

```javascript
Number("10")          // 10   전체가 숫자여야 한다
Number("10년")         // NaN
parseInt("10년")       // 10   앞에서부터 읽을 수 있는 만큼
(3.141592).toFixed(2) // "3.14"  결과가 문자열이다
```

문자열은 Python처럼 불변이라서 `str[0] = 'Y'`를 해도 에러도 안 나고 아무 일도 안 일어난다. 문자열 뒤집기는 이렇게 한다.

```javascript
str.split("").reverse().join("")
```

## 배열 메서드
```javascript
const fruits = ["Banana", "Orange"];
fruits.push("Grape");            // 끝에 추가 → 새 length 리턴
fruits.pop();                    // 끝에서 빼기 → 뺀 값 리턴
fruits.unshift("Kiwi");          // 앞에 추가
fruits.shift();                  // 앞에서 빼기
fruits.splice(2, 0, "Kiwi");     // 2번 자리에 0개 지우고 삽입
const part = fruits.slice(1, 3); // 원본은 그대로, 잘라낸 복사본
```

배열 메서드는 **원본을 바꾸는 것과 안 바꾸는 것**으로 나뉜다.

```
원본을 바꾸는 것: push, pop, shift, unshift, splice, sort, reverse
안 바꾸는 것: concat, slice, join, indexOf, includes
```

Python의 `sort()`와 `sorted()` 차이처럼, 이걸 헷갈리면 찾기 힘든 버그가 난다.

그리고 배열도 `typeof`를 하면 `"object"`가 나와서, 배열인지 확인하려면 `Array.isArray()`를 써야 한다. `new Array(3)`은 원소 3이 아니라 길이 3짜리 빈 배열을 만들어서, 배열은 `[ ]` 리터럴로 만드는 게 좋다. `fruits[10] = "김정준"`처럼 인덱스로 멀리 대입하면 중간이 전부 빈 구멍이 되니 `push`를 쓰는 게 안전하다.

## 오늘 배운 내용 정리
오늘은 JavaScript의 기본 문법을 배웠다.

```
Node.js: 브라우저의 JS 엔진(V8)만 떼어낸 실행기. node 파일.js
변수: const 를 기본으로, 바뀌어야 하면 let. var 는 쓰지 않는다. let / const 는 블록 스코프.
const: 이름이 다른 것을 못 가리킬 뿐, 객체의 내용은 바꿀 수 있다.
비교: 항상 === 를 쓴다.
형 변환: + 만 문자열 연결, 나머지는 숫자로 바꿔서 계산. "10" + 10 = "1010".
템플릿 리터럴: `Hello, ${name}` (백틱).
배열 인덱스: 범위를 넘거나 음수면 undefined (에러가 아니다).
함수: 인자 개수가 안 맞아도 에러가 안 난다. 함수도 값이다.
객체: obj.key / obj["key"]. 값이 함수면 메서드, 그 안의 this 는 자기 객체.
number: 하나뿐. 0.1 + 0.2 !== 0.3. NaN 은 isNaN() 으로 확인.
배열: 원본을 바꾸는 메서드(push, splice, sort)와 안 바꾸는 메서드(slice, concat)를 구분한다.
```

Python과 JS를 비교해보면, Python은 이상한 상황에서 에러를 내는 편이고 JS는 어떻게든 실행을 이어가는 편인 것 같다. 그래서 JS는 `undefined`나 `NaN`이 보이면 바로 의심하는 습관이 필요할 것 같다.

---
