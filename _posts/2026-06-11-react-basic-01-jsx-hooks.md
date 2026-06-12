---
layout: single
title: "React 기초 정리 1 - JSX와 Hooks"
categories: [coding, React]
tag: [study-log, React]
toc: true
author_profile: false
sidebar:
    nav: "docs"
search: true
---
<hr/>

오늘부터 React 진도를 본격적으로 나가기 시작했다.

어제는 React를 사용하기 위한 환경설정을 진행했고, 오늘은 React 앱의 기본 구조부터 JSX, Hooks 그리고 styled-components까지 전반적인 개념을 배웠다.

아직 모든 내용을 완벽하게 이해했다고 말하기는 어렵지만, 오늘 배운 내용을 기준으로 React가 어떤 방식으로 화면을 구성하고 상태를 관리하는지 큰 흐름을 정리해보려고 한다.

## React 앱 구조
React 프로젝트는 여러 파일과 컴포넌트로 구성된다.

기본적으로 ```main.jsx```에서 React 앱을 실행하고, ```App.jsx```가 화면의 중심이 되는 컴포너트 역할을 한다.

```jsx
import React from 'react';
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <>
    <App />
  </>,
);
```

`main.jsx`는 HTML의 특정 요소에 React 앱을 연결하는 시작점이다.

그리고 `App.jsx`는 실제 화면에 보여줄 컴포너느들을 조립하는 역할을 한다.

React에서는 화면을 하나의 큰 파일에 전부 작성한다기보다는, 여러 컴포넌트로 나누너 관리한다. 이렇게 나누면 코드가 길어졌을 때도 구조를 파악하기 쉽고, 필요한 컴포넌트를 재사용할 수 있다.


## JSX
JSX는 JavaScript 안에서 HTML처럼 UI를 작성할 수 있게 해준는 문법이다.`jsx<App />`이러한 문법을 JSX 문법이라고 하고 XML, HTML을 직접 작성하므로 직관적이고 사용하기 간편하다.
```jsx
function App() {
  const name = 'React';

  return (
    <>
      <h1>Hello {name}</h1>
    </>
  );
}
```

겉보기에는 HTML과 비슷하지만, 실제로는 JavaScript 문법 안에서 동작한다.

그래서 JavaScript 값을 화면에 출력할 때는 `{}`를 사용한다.


```jsx
const title = 'React 공부';
<h1>{title}</h1>
```

JSX를 사용할 때 HTML과 다른 부분도 있었다.

예를 들어 HTML에서는 `class`를 사용하지만, JSX에서는 `className`을 사용한다.
그 이유는 JavaScript에는 이미 클래스 기반 객체 지향 프로그래밍을 위해 사용하는 `class`**라는 예약어(Reserved Word)** 가 선점되어 있기 때문이다.

```jsx
<div className="content">내용</div>
```

JSX는 한개의 **element만** 리턴하기에 이와 같이 한개의 element 안에 담아서 리턴한다.

```jsx
return (
  <>
    <h1>제목</h1>
    <div>내용</div>
  </>
);
```
## Component 분리
특정 부분을 변경해도 '전체가' 렌더링 된다. 다시 모든 것을 다 렌더링 하지 않으려면  '쪼개어서 그려야 한다'




## Hooks
Hooks는 React의 상태관리등 다양한 기능을 활용할수 있도록 제공되는 함수(기는)이다.

오늘 배운 Hook은 `useState`, `useEffect`, `useMemo`, `useRef`이다.

Hooks는 보통 이름이 `use`로 시작한다.