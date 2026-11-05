---
layout: single
title: "Web 기초 정리 5 - this, 비구조화 할당·spread와 form 유효성 검사"
categories: [coding, Web]
tag: [study-log, Web, JavaScript, ES6, this, destructuring, spread, rest, script, form, validation]
toc: true
author_profile: false
sidebar:
    nav: "docs"
search: true
---
<hr/>

오늘 오전에는 모던 자바스크립트(ES6) 문법인 메서드 단축 구문과 `this`, 기본 파라미터, 비구조화 할당, spread와 rest를 배웠다. 오후에는 드디어 JS를 HTML에 붙여서 브라우저에서 실행해보고, form 값을 읽고 쓰고, 제출 전에 유효성 검사를 하는 방법까지 배웠다.

어제까지는 Node에서 터미널로만 JS를 돌렸는데, 오늘 처음으로 버튼을 누르면 화면이 바뀌는 걸 직접 만들어봐서 재밌었다.

## 메서드 단축 구문
```javascript
const dog = {
    name: "멍멍이",
    sound: "멍멍!",

    say2: function() { console.log(`say2: ${this.sound}`); },  // 익명 함수
    say3() { console.log(`say3: ${this.sound}`); },            // ES6 단축 구문
    say4: () => { console.log(`say4: ${this.sound}`); },       // 화살표 함수
};

dog.say2();   // "say2: 멍멍!"
dog.say3();   // "say3: 멍멍!"
dog.say4();   // "say4: undefined"
```

`: function`을 통째로 생략하는 `say3`이 요즘 표준이다. 그리고 어제 예고했던 대로 화살표 함수로 만든 `say4`는 `undefined`가 나왔다.

`function`으로 만든 함수는 `this`라는 context를 만들어서 자기가 속한 객체를 가리키는데, **화살표 함수는 this context를 만들지 않는다.** 화살표 함수 안에서 `this`를 쓰면 바깥의 `this`를 그대로 가져다 쓴다. 그래서 **객체 메서드에는 화살표 함수를 쓰지 않는다.**

## this는 호출한 방식으로 정해진다
오늘 가장 중요했던 실험이다.

```javascript
const cat = { name: "야옹이", sound: "야용~" };
cat.say2 = dog.say2;   // dog 의 함수를 cat 에 복사

dog.say2();   // "say2: 멍멍!"  ← this 는 dog
cat.say2();   // "say2: 야용~"  ← this 는 cat

const catSay = cat.say2;
catSay();     // "say2: undefined"  ← this 가 끊어졌다
```

함수는 하나인데 결과가 다르다. `this`가 함수를 어디에 썼냐가 아니라 **어떻게 불렀냐**로 정해지기 때문이다. 규칙은 **"점(`.`) 앞에 있는 것이 `this`"**다.

함수를 변수에 담는 순간 누구의 메서드였는지는 사라진다. Python의 `self`는 `obj.method()`가 `Class.method(obj)`로 바뀌면서 자동으로 들어갔는데, JS의 `this`는 호출할 때마다 새로 정해진다는 점이 달랐다. 내일 배울 이벤트 핸들러와 콜백에서 이것 때문에 막히기 쉽다고 하셨다.

## 기본 파라미터와 단축 속성명
JS 함수는 인자가 모자라면 `undefined`가 들어가서 `NaN`이 나왔다. 어제 배운 `||`로 기본값을 줄 수도 있지만, 그러면 0도 기본값으로 바뀐다.

```javascript
const circleArea = (r = 1) => Math.PI * r ** 2;

circleArea(4);   // 50.26...
circleArea();    // 3.14...  r = 1
circleArea(0);   // 0        0 을 살려준다
```

기본 파라미터는 인자가 `undefined`일 때만 발동해서 `||`보다 정확하다. Python의 기본값과 같은데, Python은 기본값에 list를 쓰면 안 된다는 함정이 있었던 반면 JS는 호출할 때마다 새로 계산된다고 한다.

변수 이름과 property 이름이 같으면 줄여 쓸 수 있고, 대괄호를 쓰면 변수의 값을 키로 쓸 수 있다.

```javascript
const a = 1, b = 2;
const obj = { a, b };             // { a: a, b: b }

const name1 = "alpha";
const obj2 = { [name1]: "값" };   // { alpha: "값" }
```

## 비구조화 할당
```javascript
const ironMan = { name: "스타크", actor: "로다주", alias: "아이언맨" };

const { actor, name } = ironMan;        // 객체: property 이름으로
const [one, two] = [10, 20];            // 배열: 순서대로
const { name: nickname } = ironMan;     // 이름 바꾸기
const { c, d = 333 } = { c: 111 };      // 기본값
```

`ironMan.actor`, `ironMan.name`처럼 계속 반복되던 코드가 한 줄로 끝난다. Python의 unpacking과 비슷한데, 객체는 순서가 아니라 **property 이름**으로 찾는다는 점이 다르다. 없는 이름을 적으면 에러가 아니라 `undefined`다.

이름 바꾸기 `{ 원래이름: 새이름 }`은 객체를 만들 때와 방향이 반대라서 헷갈렸다. 꺼낼 때는 왼쪽이 찾을 property 이름, 오른쪽이 만들 변수 이름이다.

함수 매개변수에서도 분해할 수 있다.

```javascript
function print({ name, actor }) {
    console.log(`${name} - ${actor}`);
}
print(ironMan);
```

React 코드가 이 문법 없이는 못 굴러갈 정도로 많이 쓴다고 해서 잘 익혀둬야 할 것 같다.

## spread와 rest
같은 `...`인데 위치에 따라 뜻이 정반대다. **값 자리(오른쪽)에 있으면 spread(펼치기), 받는 자리(왼쪽)에 있으면 rest(모으기)**다.

```javascript
// spread: 펼치기
const slime = { name: "슬라임" };
const cuteSlime = { ...slime, style: "cute" };   // 복사 + 추가
const copyArr = [...arr];                        // 배열 복사
Math.max(...numbers);                            // 배열을 인자로 풀기

// rest: 모으기
const { name, ...rest } = cuteSlime;   // name 빼고 나머지
function sum(...nums) {                 // 인자를 전부 배열로 받기
    return nums.reduce((a, b) => a + b, 0);
}
```

Python에서 `*args`와 `**kwargs`가 정의에서는 모으고 호출에서는 풀었던 것과 같은 개념이었다.

spread로 만든 객체는 **새 객체**다.

```javascript
const smallSlime = { ...slime };   // 새 객체
const megaSlime = slime;           // 같은 객체
console.log(slime == megaSlime);   // true
console.log(slime == smallSlime);  // false
```

Python에서 배운 "대입은 주소를 복사한다"는 문제를 이걸로 피할 수 있다. 다만 **얕은 복사**라서 안에 든 객체는 여전히 공유된다.

그리고 순서가 중요하다. **나중에 쓴 것이 이긴다.**

```javascript
{ ...purpleSlime, color: "Green" }   // color 는 Green
{ color: "Green", ...purpleSlime }   // color 는 purple (spread 가 덮어쓴다)
```

## JS를 HTML에 붙이기
CSS 때와 똑같이 세 가지 방법이 있다.

```html
<!-- inline -->
<button onclick="document.getElementById('demo1').innerHTML = Date()">클릭</button>

<!-- internal -->
<script>
    function showRandom() { ... }
</script>

<!-- external (실무 표준) -->
<script src="JS/myScript.js"></script>
```

결과를 내보내는 방법은 네 가지인데, 실무에서는 대부분 `innerHTML`로 요소의 내용을 바꾸고 개발할 때는 `console.log()`를 쓴다.

```javascript
document.getElementById('demo').innerHTML = '내용';   // 요소에 출력
console.log('메시지');                                // 콘솔
alert('메시지');                                      // 팝업
// document.write('내용');                           // 쓰지 말 것
```

## script의 위치가 중요하다
오늘 오후에 가장 중요했던 부분이다.

```html
<body>
<script>
    // 이 시점에 id='demo' 요소는 아직 없다
    document.getElementById('demo').innerHTML = '될까요?';   // 에러
</script>

<p id="demo">1~10까지 난수</p>

<script>
    document.getElementById('demo').innerHTML = '이제는 됩니다';   // 동작
</script>
</body>
```

브라우저는 HTML을 위에서 아래로 읽으면서 화면을 조립하고, `<script>`를 만나면 그 자리에서 멈추고 JS를 실행한다. 그래서 **아직 안 만들어진 요소는 잡을 수 없다.**

해결 방법은 세 가지다. `<script>`를 `</body>` 바로 앞에 두거나, `window.onload`로 감싸거나, `<script src="app.js" defer>`처럼 `defer`를 붙이면 HTML을 다 읽은 뒤에 실행된다.

수업 자료에 "무엇을 실행시키는 건가 주목!"이라는 질문이 있었는데, `<script>` 안의 코드는 읽는 즉시 실행되지만 `function` 선언은 함수를 정의하는 것만 실행되고 본문은 안 돈다. `getElementById`처럼 바로 요소를 찾는 코드가 문제였다. **지금 실행되는 것과 나중에 실행될 것을 구분**하는 게 핵심이라고 이해했다.

## form 값 읽고 쓰기
```javascript
const frm = document.forms['myform1'];   // name='myform1' 인 form
frm['username'].value;                   // 읽기
frm['username'].value = '문태현';         // 쓰기
frm['drive'].checked;                    // 체크박스 체크 여부
```

폼 안의 필드는 `name`으로 찾는다. `name`이 서버 전송용이면서 JS 접근용이기도 했다.

그리고 노트에 별표를 쳐둔 부분이다.

> form 에서 읽어온 값은 무조건 string 이다!

```javascript
const age = frm['age'].value;   // "20"
age + 1;                        // "201"
Number(age) + 1;                // 21
```

그저께 예고했던 그 함정이 바로 여기서 나왔다. `type="number"`여도 `.value`는 항상 문자열이라서 계산할 값은 반드시 `Number()`로 바꿔야 한다.

체크박스는 체크를 안 해도 `.value`에 값이 있어서, 반드시 `.checked`를 먼저 확인해야 한다.

```javascript
const hobby = [];
frm['drive'].checked && hobby.push(frm['drive'].value);
frm['music'].checked && hobby.push(frm['music'].value);
```

어제 배운 단축 평가로 `if` 없이 썼다.

## 유효성 검사
빈 폼을 그대로 서버로 보내면 서버가 에러를 내고, 뒤로 가면 입력한 게 다 사라진다. 보내기 전에 브라우저에서 한 번 거르면 사용자가 그 자리에서 바로 고칠 수 있다.

```html
<form name="form2" action="..." onsubmit="return chkSubmit2()">
```

```javascript
function chkSubmit2() {
    const frm = document.forms['form2'];

    if (frm['firstname'].value.trim() == "") {
        alert('First name 은 필수입니다!');
        frm['firstname'].focus();   // 문제가 있는 칸에 커서를 보낸다
        return false;               // 제출 취소
    }
    return true;                    // 제출 진행
}
```

`onsubmit`이 `false`를 받으면 제출이 취소된다. 여기서 **`onsubmit="return chkSubmit2()"`처럼 `return`을 반드시 써야** 한다. `return`을 빠뜨리면 함수가 false를 돌려줘도 폼에 전달되지 않아서 항상 제출된다.

`.trim()`을 붙이는 이유는 사용자가 스페이스만 눌렀을 수도 있기 때문이고, `focus()`는 alert를 닫았을 때 고쳐야 할 칸에 커서가 가 있게 해주는 작은 배려라고 한다.

숫자 검사는 `isNaN()`으로 했는데 주의할 점이 있었다.

```javascript
let age = frm.age.value.trim();
if (isNaN(age) || age < 1 || age > 130) {
    alert(`${age} 는 유효한 값이 아닙니다\n1~130 사이 숫자 입력`);
    frm.age.focus();
    return false;
}
```

`isNaN("")`은 빈 문자열을 0으로 봐서 `false`가 나온다. 이 코드는 `age < 1` 조건이 빈칸을 잡아줘서 우연히 동작하는 것이라, 빈칸 검사는 따로 두는 게 낫다고 한다.

## 오늘 배운 내용 정리
오늘은 모던 JS 문법과 브라우저에서 JS를 다루는 방법을 배웠다.

```
메서드: say() { } 단축 구문이 표준. 객체 메서드에 화살표 함수는 쓰지 않는다.
this: 점(.) 앞에 있는 것이 this. 함수를 변수에 담으면 this 가 끊어진다.
기본 파라미터: f(r = 1). undefined 일 때만 발동해서 0 을 살려준다.
단축 속성명: { a, b }. 계산된 속성명: { [key]: v }.
비구조화 할당: const { name, age } = person; const [a, b] = arr;
spread / rest: 값 자리의 ... 는 펼치기, 받는 자리의 ... 는 모으기. 나중에 쓴 것이 이긴다.
script 위치: 아직 안 그려진 요소는 못 잡는다. </body> 직전 또는 defer.
form 값: 무조건 문자열. 계산하려면 Number(). 체크박스는 .checked 먼저.
유효성 검사: onsubmit="return 함수()". false 면 제출 취소. trim() 과 focus().
```

화면에 직접 결과가 나오니까 JS가 왜 웹의 "동작"을 담당하는지 실감이 났다. 그리고 this는 아직 완전히 감이 오지 않아서, 내일 이벤트 핸들러를 배우면서 "점 앞에 있는 것이 this"를 계속 확인해보려고 한다.

---
