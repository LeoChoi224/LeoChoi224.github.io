---
layout: single
title: "React 기초 정리 1 - JSX와 Hooks"
categories: [coding, React]
tag: [study-log, React, JSX, Component, Hooks, useState, useEffect, useMemo, useRef, styled-components]
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
React에서는 특정 상태가 변경될 때 컴포넌트 **전체가 다시 렌더링되는** 문제가 발생할 수 있습니다. 불필요한 전체 렌더링을 방지하고 애플리케이션의 성능을 방어하기 위해서는 기능과 역할을 기준으로 컴포넌트를 **쪼개어 독립적으로 그려야 한다.**




## Hooks
Hooks는 React의 상태관리등 다양한 기능을 활용할수 있도록 제공되는 함수(기능)이다.

오늘 배운 Hook은 `useState`, `useEffect`, `useMemo`, `useRef`이다.

Hooks는 보통 이름이 `use`로 시작하고, Hooks를 사용하면 함수형 컴포넌트 안에서도 상태 관리, 렌더링 이후 작업 처리, 값 저장, 성능 최적화 등을 할 수 있다.

## useState()
`useState`는 컴포넌트에서 상태(State)를 관리할 때 사용하는 Hook이다.

```jsx
import { useState } from 'react';

function Counter() {
  let number = 1;

  const add = () => {
    number++;
  }

  return (
    <div>
      <p>숫자: {number}</p>
      <button onClick={(add)}>
        증가
      </button>
    </div>
  );
}
```
위 코드를 보면 number에 1을 더하는 add() 함수를 만들고, [증가] 버튼을 클릭했을 때 이 함수가 호출되도록 구현했다.

실제로 버튼을 클릭할 때마다 add() 함수 자체는 정상적으로 실행되지만, 화면에 표시되는 number 값은 바뀌지 않는다.
그 이유는 **React가 '상태(State)' 값이 변경될 때만 컴포넌트를 리렌더링(다시 그리기)**하기 때문이다.

일반 변수는 값이 바뀌어도 React가 이를 감지하지 못하므로, useState를 활용해 상태값으로 설정해 주어야 한다.
```jsx
import { useState } from 'react';

function Counter() {
  const [number, setNumber] = useState(0);

  return (
    <div>
      <p>숫자: {number}</p>
      <button onClick={() => setNumber(number + 1)}>
        증가
      </button>
    </div>
  );
}
```
`useState(0)`에서 0은 초기값이고, `number`은 현재 상태값, `setNumber`은 상태를 변경하는 함수이다.

React에서는 상태값을 직접 바꾸지 않고, 반드시 setter 함수를 사용해서 변경해야 한다.
Setter 함수를 통해 상태가 변경되어야만 React가 이를 감지하고 화면을 다시 렌더링하기 때문이다.

결론적으로, 화면에 동적으로 반영되어야 하는 변수들은 반드시 useState로 관리해야 한다는 점이 중요하다.

## useEffect()
`useEffect`는 컴포넌트가 렌더링된 후 특정 작업을 실행할 때 사용하는 Hook이다.
```jsx
import { useEffect } from 'react';

function App() {
  useEffect(() => {
    console.log('컴포넌트 렌더링 완료');
  }, []);

  return <h1>Hello React</h1>;
}
```
