---
layout: single
title: "Web 기초 정리 2 - 목록·form, 박스 모델, position·float과 CSS 선택자"
categories: [coding, Web]
tag: [study-log, Web, HTML, CSS, form, display, box-model, position, float, selector, transition]
toc: true
author_profile: false
sidebar:
    nav: "docs"
search: true
---
<hr/>

지난 시간에 HTML 기본 태그와 CSS를 붙이는 방법을 배웠고, 오늘은 HTML의 목록과 form을 마무리한 다음 본격적으로 CSS 배치를 배웠다.

목록으로 메뉴 만들기, block과 inline, id·class·name, form, Emmet, 박스 모델, position, float, CSS 선택자, transition까지 하루에 노트가 10개나 나왔다. 양이 정말 많았는데, 결국 오늘 배운 건 **"요소가 어떻게 자리를 차지하는가"**로 모이는 것 같아서 그 흐름으로 정리해보려고 한다.

## 목록으로 메뉴 만들기
```html
<ul>              <!-- 순서 없음 → 점 -->
    <li>Coffee</li>
    <li>Tea</li>
</ul>
<ol type="A">     <!-- 순서 있음 → A. B. C. -->
    <li>Coffee</li>
</ol>
```

`li`는 반드시 `ul`이나 `ol` 안에 있어야 한다. 그리고 웹사이트의 상단 메뉴는 거의 다 이 `ul` + `li`로 만든다고 해서 신기했다.

```css
ul {
    list-style-type: none;       /* 점 제거 */
    background-color: #333333;
    overflow: hidden;            /* float 뒷정리 */
}
li { float: left; }              /* 세로 → 가로로 눕히기 */
li a {
    color: white;
    text-decoration: none;
    padding: 16px;
    display: block;              /* 여기가 핵심 */
}
li a:hover { background-color: #111111; }
```

여기서 `display: block`이 왜 필요한지가 오늘의 첫 번째 교훈이었다. `<a>`는 기본이 inline이라서 위아래 padding이 자리를 차지하지 못한다. `display: block`으로 바꿔야 글자 주변 전체가 클릭 영역이 된다. 글자를 정확히 찍어야만 눌리는 메뉴가 바로 이걸 안 한 경우라고 한다.

## block, inline, inline-block
모든 요소는 `display` 값을 갖고 있고, 그게 자리를 차지하는 방식을 정한다.

| | 줄 | width / height |
|---|---|---|
| block | 새 줄에서 시작, 폭 전부 차지 | 적용됨 |
| inline | 옆으로 붙고 내용만큼만 | **무시됨** |
| inline-block | 옆으로 붙는다 | 적용됨 |

```html
<span style="background-color: yellow; width:100px; height:100px;">span</span>
<!-- width, height 를 줘도 아무 일도 안 일어난다 -->
```

inline은 문장 속에 섞여 흐르는 걸 전제로 만들어져서, 문장 중간 단어 하나가 갑자기 높이 200px이 되면 줄 간격이 다 무너지기 때문에 세로 방향을 막아둔 것이라고 한다. 버그가 아니라 설계였다.

기본이 inline인 건 `span`, `a`, `img`, `input`, `label`, `button` 정도이고 나머지는 대부분 block이다. 그리고 **태그가 성격을 정하는 게 아니라 `display` 값이 정한다.** `div`에 `display: inline`을 주면 내용만큼만 차지한다.

`inline-block`은 "줄 서기는 옆으로, 크기는 내 맘대로"라서 메뉴를 만들 때 많이 쓴다.

```css
.nav li { display: inline-block; padding: 20px; }
```

`display: none`은 자리까지 사라지고, `visibility: hidden`은 자리는 남기고 안 보이게만 한다는 차이도 있었다.

## id, class, name
| | 개수 | 주로 쓰는 곳 | CSS |
|---|---|---|---|
| id | 페이지에 하나 | CSS, JavaScript | `#` |
| class | 여러 개 가능 (요소당 여러 개도) | CSS, JavaScript | `.` |
| name | 중복 가능 | **form → 서버 전송** | `[name="x"]` |

```css
p.c1     { color: red; }
p.c2     { background-color: yellow; }
p.c1.c2  { border: 2px dashed limegreen; }   /* c1 과 c2 를 '둘 다' 가진 p */
```

```html
<p class="c1 c2">class="c1 c2"</p>   <!-- 세 규칙을 동시에 받는다 -->
```

id를 중복해서 쓰면 CSS는 둘 다 칠하지만, JavaScript의 `getElementById`는 첫 번째 것만 돌려준다. 화면은 멀쩡한데 JS만 이상하게 동작하는 찾기 어려운 버그가 생기니 id는 하나만 쓰는 게 약속이다.

그리고 `name`이 없으면 form 값이 서버로 **아예 안 넘어간다.** 브라우저가 `username=leo&password=1234`처럼 name을 항목 이름으로 써서 포장하기 때문에, 이름 없는 항목은 에러도 없이 조용히 빠진다.

## form
```html
<form action="https://www.w3schools.com/action_page.php" method="GET">
    First name: <input type="text" name="firstname" value="미키"><br>
    Last name: <input type="text" name="lastname" value="마우스"><br>
    <input type="submit">
</form>
```

`<form>`은 입력값을 모아서 서버로 보내는 봉투이고, `<form>` 안에 있는 것만 서버로 간다. `action`은 보낼 주소, `method`는 보내는 방식이다.

| | GET | POST |
|---|---|---|
| 값이 보이나 | 주소창에 다 보인다 | 안 보인다 (request body) |
| 용량 | 제한 있음 | 사실상 제한 없음 |
| 북마크 | 가능 | 불가 |
| 언제 | 검색, 목록 필터 | 로그인, 회원가입, 글쓰기 |

```
GET  → .../action_page.php?firstname=미키&lastname=마우스
POST → .../action_page.php   (값은 body 에 숨어서 간다)
```

GET은 엽서, POST는 봉투 편지라는 비유가 이해하기 쉬웠다. 다만 POST라고 해서 암호화되는 건 아니라서 개발자도구로 보면 값이 그대로 보인다. 진짜 보안은 `https`가 담당한다. 면접에서 자주 나오는 구분이라고 한다.

`<select>`는 화면에 보이는 글자와 서버로 가는 `value`가 다르고, `<textarea>`는 초기값을 `value`가 아니라 태그 사이에 넣는다는 점도 헷갈리기 쉬웠다.

## Emmet
```
header>ul>li*5>a   + Tab
```

이걸 치고 Tab을 누르면 태그 15개가 한 번에 나온다. `>`는 자식, `*`는 반복, `+`는 형제다. CSS 선택자와 기호가 같아서 선택자를 배우면 Emmet도 저절로 읽힌다.

## 박스 모델
오늘 CSS에서 가장 먼저 확실히 잡아야 하는 개념이었다. 모든 요소는 네 겹의 상자다.

```
┌──────────── margin (다른 상자와의 간격, 항상 투명) ────────────┐
│  ┌───────── border (테두리) ──────────────────────────────┐  │
│  │  ┌────── padding (내용과 테두리 사이, 배경색이 칠해짐) ─┐ │  │
│  │  │              content (글자·이미지)                  │ │  │
│  │  └────────────────────────────────────────────────────┘ │  │
│  └─────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

```css
div#demo1 {
    width: 300px;
    border: 25px solid green;
    padding: 25px;
    margin: 25px;
}
```

`width: 300px`이 가리키는 건 **content 하나뿐**이다. 그래서 실제 계산은 이렇다.

```
눈에 보이는 폭 = 300 + padding(25+25) + border(25+25) = 400px
차지하는 자리 = 400 + margin(25+25) = 450px
```

`width: 300px` 상자 두 개가 600px 자리에 안 들어가는 이유가 이것이었다. 실무에서는 `* { box-sizing: border-box; }` 한 줄로 width가 padding과 border를 포함하게 바꿔서 이 계산을 없앤다고 한다.

padding과 margin은 둘 다 여백이지만, padding은 상자 안쪽이라 배경색이 칠해지고 상자가 커지고, margin은 바깥이라 투명하고 상자 사이가 벌어진다.

`max-width`는 `width`보다 우선한다. 그래서 `img { max-width: 100%; }` 한 줄이면 큰 사진이 화면 밖으로 삐져나가지 않는데, 실무에서 가장 많이 쓰는 CSS 중 하나라고 한다.

단위는 `px`(고정), `%`(부모 기준), `em`(내 글자 크기 기준), `rem`(루트 글자 크기 기준)이 있다. `em`은 중첩되면 곱해져서 커지기 쉬워서 `rem`을 권장한다고 한다.

## position
지금까지는 요소가 쓴 순서대로 위에서 아래로 쌓였는데(문서 흐름), 상단 고정 메뉴나 사진 위의 글자처럼 흐름을 벗어나야 할 때 `position`을 쓴다.

| 값 | 기준 | 원래 자리 |
|---|---|---|
| static | 기본, 기준 없음 | - |
| relative | 자기 원래 자리 | 남는다 |
| fixed | 화면(viewport) | 사라진다 |
| absolute | 위치가 잡힌 조상 | 사라진다 |

`top`, `left` 같은 값은 `static`이 아닐 때만 동작한다.

오늘 가장 중요했던 건 `absolute`의 규칙이다. `absolute`는 위로 올라가면서 **position이 static이 아닌 조상**을 찾고, 못 찾으면 문서 전체를 기준으로 한다.

```html
<div class="relative">부모1-relative
    <div class="absolute">absolute1</div>   <!-- 부모 안에서 top: 40px -->
</div>
<div class="static">부모2-static
    <div class="absolute">absolute2</div>   <!-- 페이지 맨 위로 날아간다 -->
</div>
```

"absolute를 줬는데 엉뚱한 데로 간다"는 문제는 거의 이것이라서, 기준으로 삼고 싶은 부모에 `position: relative`를 주면 된다.

```css
.카드 { position: relative; }
.배지 { position: absolute; top: 10px; right: 10px; }   /* 카드 우상단에 붙는다 */
```

이미지 위 NEW 배지나 카드의 X 버튼이 이 두 줄로 만들어진다고 한다.

`overflow`는 내용이 상자를 넘칠 때 처리법이다. `visible`(기본), `hidden`(잘라냄), `scroll`(항상 스크롤), `auto`(넘칠 때만 스크롤)가 있다.

## float과 clear
`float`은 원래 신문처럼 **사진 옆으로 글이 흐르게** 하려고 만든 것인데, "흐름에서 빠져 옆으로 붙는다"는 성질 때문에 Flexbox가 나오기 전까지 10년 넘게 가로 배치 도구로 쓰였다고 한다.

```css
img { float: left; }     /* 이미지를 왼쪽에 붙이고 글이 오른쪽을 감싼다 */
```

float의 가장 큰 부작용은 **부모의 높이 계산에서 빠진다**는 것이다. 자식이 전부 float이면 부모 높이가 0이 돼서 부모 배경색이 안 보인다. 아까 메뉴에서 `ul { overflow: hidden; }`을 준 이유가 이것이었다.

```css
#clear { clear: both; }  /* 여기서부터는 float 옆에 서지 마라 */
```

`clear`를 준 요소는 float 옆에 끼지 않고 아래로 내려가서 새 줄에서 시작한다.

그리고 float된 요소 다음의 상자는 원래 자리에 그대로 있고 **안의 글자만 비켜난다**는 점도 처음엔 이해가 안 됐다. 배경색은 왼쪽 끝부터인데 글자만 오른쪽에서 시작하는 이유가 그것이었다.

## CSS 선택자
HTML에 class를 일일이 붙이지 않고 CSS만으로 원하는 요소를 골라내는 기술이다.

```css
div p     { }   /* div 안 어디든 있는 p (자손) */
div > p   { }   /* div 의 바로 아래 p (자식) */
div + p   { }   /* div 바로 다음 형제 p 하나 */
div ~ p   { }   /* div 다음의 모든 형제 p */
```

공백과 `>`의 차이는, `div` 안의 `span` 안에 있는 `p`가 자손(공백)에는 포함되지만 자식(`>`)에는 안 된다는 것이다. 그리고 CSS에는 "이전 형제" 선택자가 없어서 앞에 있는 형제는 고를 수 없다.

가장 조심해야 할 건 띄어쓰기였다.

```css
.c1.c2   { }   /* c1 과 c2 를 둘 다 가진 요소 하나 */
.c1 .c2  { }   /* c1 을 가진 요소 '안에 있는' c2 */
```

**CSS에서 공백은 장식이 아니라 문법**이다. CSS가 안 먹을 때 오타 다음으로 의심해야 할 곳이다.

가상 클래스로 상태를 고를 수도 있다.

```css
p#demo2           { display: none; }   /* 평소엔 숨김 */
div:hover p#demo2 { display: block; }  /* div 에 마우스가 올라가면 보임 */
tr:nth-child(even) { background: #f5f5f5; }   /* 짝수 줄 줄무늬 */
```

툴팁이나 드롭다운 메뉴가 JavaScript 없이 이 원리로 된다고 한다. 다만 `:nth-child(2)`는 "두 번째 p"가 아니라 "두 번째 자식인데 그게 p인 경우"라서, 두 번째 p를 원하면 `p:nth-of-type(2)`를 써야 한다.

## transition과 애니메이션
`:hover`로 색을 바꾸면 딸깍 하고 순식간에 바뀌는데, `transition`을 주면 스르륵 변한다.

```css
div#box1 {
    width: 100px; height: 100px;
    transition: width 2s, height 1s;   /* width 는 2초, height 는 1초에 걸쳐 */
}
div#box1:hover {
    width: 300px; height: 300px;
}
```

여기서 중요한 규칙은 **`transition`을 `:hover`가 아니라 원래 상태에 쓴다**는 것이다. `:hover` 안에만 쓰면 커질 때만 부드럽고 마우스를 떼면 딸깍 돌아온다.

`transform`으로 이동(`translate`), 회전(`rotate`), 크기(`scale`)를 바꿀 수 있다. `width`나 `margin`을 바꾸면 브라우저가 주변 요소 위치를 전부 다시 계산해야 하지만, `transform`은 이미 그린 그림을 옮기는 수준이라 훨씬 부드럽다고 한다. 그래서 움직임은 `transform`, 나타나고 사라지는 건 `opacity`로 만드는 게 실무 원칙이라고 한다.

`@keyframes`로 구간을 정하면 hover 없이 혼자 계속 움직이는 애니메이션도 만들 수 있다.

## 오늘 배운 내용 정리
오늘은 HTML 목록과 form, 그리고 CSS 배치를 배웠다.

```
메뉴: ul + li 에 list-style: none, li { float: left }, a { display: block }.
display: block(한 줄, 크기 O) / inline(옆으로, 크기 X) / inline-block(옆으로, 크기 O).
id / class / name: 하나 / 여러 개 / form 전송용. name 이 없으면 서버로 안 간다.
form: action(어디로), method(GET 은 주소창, POST 는 body).
박스 모델: content → padding → border → margin. width 는 content 만.
position: relative 는 원래 자리 기준, absolute 는 relative 부모 기준, fixed 는 화면 기준.
float: 흐름에서 빠져서 부모 높이가 0이 된다 → overflow: hidden, clear: both.
선택자: 공백(자손) / >(자식) / +(바로 다음) / ~(이후 전부). .c1.c2 와 .c1 .c2 는 다르다.
transition: 원래 상태에 쓴다. 움직임은 transform 으로.
```

오늘은 "왜 내 생각대로 배치가 안 되지?"의 이유를 많이 알게 된 날이었다. width가 content만 가리킨다는 것, inline은 크기를 무시한다는 것, absolute는 부모가 relative여야 한다는 것만 기억해도 배치 문제의 절반은 풀릴 것 같다.

---
