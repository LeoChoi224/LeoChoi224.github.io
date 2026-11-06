---
layout: single
title: "Web 기초 정리 1 - HTML 기본 구조, CSS 적용 방식과 표"
categories: [coding, Web]
tag: [study-log, Web, HTML, CSS, element, attribute, div, span, color, table]
toc: true
author_profile: false
sidebar:
    nav: "docs"
search: true
---
<hr/>

오늘부터 웹 진도를 나가기 시작했다.

Python과 Database에서는 결과가 검은 터미널에 글자로 나왔는데, 웹은 색이 있고 버튼이 있고 누르면 반응하는 화면을 만든다. 오늘은 웹이 어떻게 동작하는지부터 시작해서 HTML 기본 태그, CSS를 붙이는 방법과 색상, 링크와 이미지, 그리고 표(table)까지 배웠다.

## 웹은 요청과 응답이다
브라우저 주소창에 주소를 치면 이런 일이 일어난다.

```
브라우저 ──── "naver.com 첫 페이지 주세요" (HTTP 요청) ────▶ 서버
브라우저 ◀─── index.html 이라는 텍스트 덩어리 (HTTP 응답) ───── 서버
브라우저: 받은 텍스트를 해석해서 화면으로 그린다 (렌더링)
```

핵심은 **서버가 보내는 건 그림이 아니라 글자**라는 점이다. 화면을 실제로 그리는 건 내 브라우저다. 웹은 내 컴퓨터가 아니라 남의 컴퓨터(브라우저)에서 실행되기 때문에 실행 결과를 보내는 게 아니라 "이렇게 그려라"라는 설명서를 보내는데, 그 설명서가 HTML이라고 이해했다.

크롬에서 `Ctrl+U`(맥은 `Cmd+Option+U`)를 누르면 서버가 실제로 보낸 원본 HTML을 볼 수 있다.

## HTML, CSS, JavaScript의 역할

| | 담당 | 비유 |
|---|---|---|
| HTML | 구조·내용 | 건물 뼈대와 벽 |
| CSS | 모양·배치 | 페인트와 인테리어 |
| JavaScript | 동작 | 전기 배선과 스위치 |

뼈대가 없으면 칠할 곳이 없고, 칠할 곳이 없으면 스위치를 달 데도 없다. 그래서 수업도 HTML → CSS → JavaScript 순서로 간다고 한다.

## 개발 환경 VS Code + Live Server
HTML 파일을 고칠 때마다 새로고침하는 게 귀찮아서, 파일이 바뀌면 알아서 새로고침해주는 Live Server 확장을 설치했다. 열면 `http://127.0.0.1:5500/...` 주소로 뜬다.

- `127.0.0.1`은 내 컴퓨터 자신을 가리키는 주소다(별명은 `localhost`).
- `5500`은 Live Server가 쓰는 포트 번호로, 한 컴퓨터에서 여러 서버를 구분하는 번호표다.

HTML 파일을 그냥 더블클릭해서 `file://`로 열어도 화면은 나오지만, 나중에 배울 fetch는 `file://`에서 브라우저가 막아버린다고 해서 처음부터 Live Server로 여는 습관을 들이기로 했다.

## 첫 HTML 파일
```html
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Document</title>
</head>
<body>
    <h1>안녕하세요 HTML</h1>
    <h2>hyper text markup language</h2>
    <p>점심 맛있쪙</p>
    <!-- 이것이 주석이다 -->
</body>
</html>
```

VS Code에서 빈 `.html` 파일에 `!`를 치고 `Tab`을 누르면 이 뼈대가 통째로 나온다.

HTML은 HyperText Markup Language의 약자다. 글에 "이건 제목", "이건 문단" 하고 **표시(mark)를 붙인다**는 뜻이라서, HTML은 계산이나 조건 분기가 없는 프로그래밍 언어가 아니다.

`head`와 `body`의 차이는 한 문장으로 정리됐다. **`head`는 브라우저에게 하는 말, `body`는 사람에게 보여줄 것.** 탭 이름(`title`), 글자 규칙(`charset`), 모바일 화면 설정(`viewport`)은 화면에 안 보이니까 head에 쓴다. `<meta charset="UTF-8">`을 빼면 한글이 깨진다.

## element와 attribute
```
<p title="툴팁이당">문단 내용</p>
└┬┘ └──────┬─────┘ └───┬──┘ └┬┘
 │         │            │      └ 끝 태그
 │         │            └────── content (상자 안 내용물)
 │         └─────────────────── attribute (상자에 붙인 스티커)
 └───────────────────────────── 시작 태그

이 줄 전체 = element
```

attribute는 시작 태그에만 쓰고, 값은 따옴표로 감싼다. `<br>`, `<hr>`, `<img>`처럼 담을 내용이 없어서 끝 태그가 없는 태그도 있다.

수업에서 일부러 HTML에 없는 태그를 써봤다.

```html
<aaa style="color:red; background-color: yellow;" title="툴팁이당">이것이 aaa 다</aaa>
```

`aaa` 같은 태그는 없는데도 노란 배경에 빨간 글씨로 잘 나왔다. 브라우저는 모르는 태그를 만나도 에러를 내지 않고 어떻게든 보여주도록 만들어졌기 때문이다. 편한 대신 **오타를 내도 조용히 넘어간다**는 뜻이라서, 화면이 이상한데 에러가 없으면 태그 오타나 닫는 태그 누락을 의심해야 한다.

## 글의 기본 태그
```html
<h1>제목 1단계</h1>   <!-- 가장 큼 -->
<h6>제목 6단계</h6>   <!-- 가장 작음 -->
<p>문단</p>
<p>줄바꿈은<br><br>이렇게</p>
<hr>                  <!-- 가로 구분선 -->
```

HTML에서 공백과 줄바꿈은 아무리 많아도 **한 칸으로 취급된다.** 엔터를 백 번 쳐도 소용없어서 줄을 바꾸려면 `<br>`, 문단을 나누려면 `<p>`를 써야 한다.

`h1`~`h6`은 글자 크기가 아니라 **문서의 목차 단계**다. 크기만 원하면 CSS를 쓰고, 검색 엔진과 스크린 리더가 이 단계를 읽는다고 한다.

`<`를 글자로 보여주고 싶으면 엔티티를 쓴다.

```
&nbsp;  공백 (줄이지 않는 공백)
&lt;    <
&gt;    >
&amp;   &
&quot;  "
```

스페이스를 다섯 번 쳐도 한 칸으로 줄어드는데, `&nbsp;`는 줄이지 말라는 표시가 붙은 공백이라 친 만큼 다 나온다.

## div와 span
둘 다 아무 의미 없는 빈 상자이고, 내용을 묶어두려고 쓴다. 차이는 줄을 차지하는 방식 하나뿐이다.

| | 기본 display | 폭 | 줄바꿈 |
|---|---|---|---|
| `div` | block | 부모의 폭을 전부 차지 | 앞뒤로 줄이 바뀐다 |
| `span` | inline | 내용만큼만 | 옆으로 이어 붙는다 |

```html
<div style="border: 3px solid green">div3
    <div style="border: 2px dotted red">hello</div>
    <p>div 안의 p</p>
</div>
<span style="border:2px solid blue">인라인 상자</span><span>— 옆으로 붙는다</span>
```

테두리를 그려보면 폭 차이가 눈에 보인다. **div 안에 div가 들어가는 중첩이 웹 레이아웃의 전부**라고 한다. 큰 상자 안에 작은 상자를 넣고, 그 안에 또 넣어서 화면을 나눈다.

## CSS 문법과 적용 방식
태그마다 `style="color:red"`를 직접 쓰면, 문단이 100개인 페이지에서 색을 바꿀 때 100군데를 고쳐야 한다. CSS는 "어디에 적용할지"와 "무엇을 적용할지"를 분리해서 이 문제를 푼다.

```css
선택자 { 속성: 값; 속성: 값; }

body { background-color: powderblue; }
h1   { color: blue; }
p    { color: red; }
```

CSS 문법은 이것 하나뿐이다. 그리고 CSS도 오류를 알려주지 않는다. 세미콜론 하나를 빠뜨리면 그 줄과 다음 줄이 통째로 무시된다.

CSS를 HTML에 붙이는 방법은 세 가지다.

| 방식 | 어떻게 | 언제 |
|---|---|---|
| Inline | `<p style="color:orange">` | 딱 하나만 예외로 줄 때 |
| Internal | `<head>` 안에 `<style>` | 이 페이지에서만 쓰는 스타일 |
| External | `.css` 파일 + `<link>` | 실무 표준. 여러 페이지가 공유 |

```html
<head>
  <link rel="stylesheet" href="CSS/styles.css">   <!-- External -->
  <style>
    p { color: red; }                             /* Internal */
  </style>
</head>
<body>
  <p style="color: orange;">This is a paragraph2</p>   <!-- Inline -->
</body>
```

셋이 겹치면 Inline이 가장 강하다. 그래서 `p { color: red }`를 줬는데도 paragraph2만 주황색으로 나왔다. 실무에서 External을 쓰는 이유는 고치기 쉬운 것도 있지만, 브라우저가 한 번 받은 `.css` 파일을 캐시해서 다른 페이지에서 재사용하기 때문에 빠르다는 이유도 있었다.

선택자 맛보기로 `#`은 id(페이지에 하나), `.`은 class(여러 개에 붙일 수 있음)라는 것도 배웠다.

```css
#p01   { background-color: antiquewhite; }  /* id="p01" 하나 */
.error { background-color: darkorange; }    /* class="error" 전부 */
```

## 색상
같은 빨강을 네 가지로 쓸 수 있다.

```css
color: Tomato;             /* 이름 */
color: rgb(255, 0, 0);     /* 빛의 삼원색, 각 0~255 */
color: #ff0000;            /* 16진수. #f00 으로 줄여도 같다 */
color: hsl(0, 100%, 50%);  /* 색상·채도·밝기 */
```

`rgb`를 이해하는 열쇠는 **물감이 아니라 빛**이라는 것이다. 물감은 다 섞으면 검정이 되지만 빛은 다 섞으면 흰색이다. 그래서 `rgb(0,0,0)`은 검정, `rgb(255,255,255)`는 흰색이고, 세 값이 같으면 회색이 된다. `#ff0000`은 `rgb(255, 0, 0)`을 16진수로 두 자리씩 쓴 것뿐이다.

뒤에 `a`(alpha)를 붙이면 투명도가 생긴다. `rgba(255, 99, 71, 0.6)`은 60% 불투명이다. 수업에서 체크무늬 배경 위에 겹쳐본 이유는, 배경이 흰색이면 투명한 건지 하얀 건지 구분이 안 되기 때문이었다.

## 링크와 이미지
```html
<a href="https://www.naver.com/">네이버</a>
<a href="https://www.daum.net" target="_blank">다음</a>   <!-- 새 탭에서 -->
```

링크는 상태에 따라 CSS를 다르게 줄 수 있다.

```css
a          { text-decoration: none; }  /* 기본 밑줄 제거 */
a:link     { color: green; }   /* 안 가본 링크 */
a:visited  { color: pink; }    /* 가본 링크 */
a:hover    { color: red; }     /* 마우스를 올린 순간 */
a:active   { color: blue; }    /* 누르고 있는 순간 */
```

이 순서(link → visited → hover → active)대로 써야 다 제대로 먹는다. 앞 글자만 따서 **LoVe-HAte**로 외운다고 한다.

```html
<img src="../img/pulpitrock.jpg" alt="Mountain View" width="500" height="377">
```

경로에서 `.`은 현재 폴더, `..`은 한 단계 위 폴더다. `alt`는 이미지가 안 뜰 때 대신 보이는 글이자 시각장애인용 스크린 리더가 읽어주는 유일한 정보라서 빠뜨리면 안 된다. `width`와 `height`를 안 주면 이미지가 도착하는 순간 화면이 아래로 밀려서, 누르려던 버튼이 도망가는 원인이 된다고 한다.

## 표 table
표는 **가로줄(`tr`)을 먼저 만들고 그 안에 칸(`td`)을 채우는** 구조다. 세로 열을 만드는 태그는 없고, 한 줄의 칸 개수가 곧 열 수가 된다.

```html
<table>
  <thead>
    <tr><th>1</th><th>2</th><th>3</th></tr>
  </thead>
  <tbody>
    <tr><td>4</td><td>5</td><td>6</td></tr>
  </tbody>
</table>
```

```css
table, th, td {
    border: 1px solid black;
    border-collapse: collapse;   /* 이게 없으면 선이 두 줄 */
}
```

`table`과 `td`에 각각 테두리를 줬으니 선이 두 겹으로 보인다. `border-collapse: collapse`는 맞닿은 선을 하나로 합치라는 뜻이다.

## 셀 병합
```html
<tr>
    <td rowspan="3">4</td>   <!-- 아래 2줄까지 먹는다 -->
    <td colspan="2">5</td>   <!-- 옆으로 2칸 먹는다 -->
    <!-- <td>6</td> -->       ← colspan 에 먹혀서 삭제
</tr>
<tr>
    <!-- <td>7</td> -->       ← rowspan 에 먹혀서 삭제
    <td>8</td>
    <td>9</td>
</tr>
```

```
┌────┬─────────────┐
│    │      5      │
│    ├──────┬──────┤
│ 4  │  8   │  9   │
│    ├──────┼──────┤
│    │  11  │  12  │
└────┴──────┴──────┘
```

핵심 규칙은 **어떤 칸이 자리를 더 먹으면, 먹힌 자리의 `td`는 지워야 한다**는 것이다. 지울 개수는 지정한 숫자 − 1이다. `colspan="2"`면 그 줄에서 1개, `rowspan="3"`이면 아래 줄마다 1개씩 지운다. 수업 자료가 지운 칸을 주석으로 남겨둬서 눈으로 대조하기 좋았다.

표가 삐뚤어지면 **모든 줄의 칸 수 합이 같은지** 세어보면 된다. 그게 표를 검산하는 방법이었다.

그리고 예전에는 화면 배치 자체를 table로 짰지만, 지금은 배치는 CSS로 하고 **table은 진짜 표 데이터에만** 쓴다고 한다.

## 오늘 배운 내용 정리
오늘은 웹의 기본과 HTML, CSS, 표를 배웠다.

```
웹: 서버는 글자(HTML)를 보내고, 화면은 브라우저가 그린다.
HTML / CSS / JS: 구조 / 모양 / 동작.
head vs body: 브라우저에게 하는 말 / 사람에게 보여줄 것.
element: 시작 태그 + content + 끝 태그. attribute 는 시작 태그에만.
공백: HTML 에서 공백과 줄바꿈은 한 칸. <br>, <p>, &nbsp; 를 쓴다.
div / span: block(한 줄 차지) / inline(내용만큼).
CSS: 선택자 { 속성: 값; }. Inline > Internal / External. 실무는 External.
색: 이름, rgb(빛), #rrggbb, hsl. 뒤에 a 를 붙이면 투명도.
img: alt 와 width / height 를 항상 붙인다.
table: tr 안에 td. 병합하면 (숫자 - 1)개의 td 를 지운다.
```

웹은 브라우저가 오류를 조용히 넘어간다는 점이 Python과 가장 다르게 느껴졌다. 에러 메시지가 없으니 결과 화면을 보면서 직접 원인을 찾아야 할 것 같다.

---
