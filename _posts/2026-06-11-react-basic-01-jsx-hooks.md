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

<!-- 여기부터 학원 컴퓨터 -->
`useEffect`는 두 번째 인자인 배열에 따라 실행되는 시점이 달라진다.

```jsx
useEffect(() => {
  console.log('처음 한 번만 실행')
}, []);
```

두 번째 인자에 빈 배열`[]`을 넣으면 처음 렌더링될 떄 한 번만 실행된다.

```jsx
useEffect(() => {
  console.log('ㅊㄴㅇDSDSㄴㅇㄴㄴㅇㄴDSDSD 실행')
}, [count]);
```

배열 안에 값을 넣으면 그 값이 변경될 때마다 실행된다.

```jsx
useEffect(() => {
  console.log('처음 한 번만 실행')
});
```

두 번째 인자를 생략하면 렌더링될 때마다 실행된다.
오늘 배운 내용 기준으로 `useEffect`는 화면이 렌더링된 후 실행해야 하는 작업을 처리하는 Hook이라고 이해했다.

## import와 export
React에서는 파일을 나누어 컴포넌트를 작성하기 때문에 `import`와 `export`를 자주 사용한다.

예를 들어 `header.jsx` 파일에서 컴포넌트를 만들고 내보낼 수 있다.

```jsx
function Header() {
  return <h1>Header</h1>;
}

export default Header;
```

```jsx
import Header from './Header';

function App() {
  return (
    <div>
      <Header />
    </div>
  );
}

export default App;
```

`export`는 다른 차일에서 사용할 수 있도록 내보내는 것이고, `import`는 다른 파일에서 내보낸 것을 가져오는 것이다.

컴포넌트 단위로 파일을 나누려면 꼭 필요한 문법이다.

## useMemo
`useMemo`는 계산된 값을 기억해두는 Hook이다.

컴포넌트가 다시 렌더링될 때마다 불필요한 계산이 반복되는 것을 줄ㅇ기 위해 사용한다.

```jsx
import { useMemo, useState } from 'react';

function App() {
  const [count, setCount] = useState(0);
  const [text, setText] = useState('');

  const doubleCount = useMemo(() => {
   console.log('계산 실행') ;
   return count * 2;
  }, [count]);

  return (
    <div>
      <p>count: {coumt}</p>
      <p>double: {coumt}</p>

      <button onClick={() => setCount(count + 1)}>
        증가
      </button>

      <input value={text} onChange={(e) => setText(e.target.value)} />
    </div>
    );
}
```

위 코드에서 `doubleCount`는 `count`가 변경될 때만 다시 계산된다.

`text`가 바뀌어도 `count`가 바뀌지 않았다면 기존 계산 결과를 재 사용한다.

다만 모든 곳에 `useMemo`를 사용하는 것은 좋지 않다.

간단한 계산에는 굳이 사용할 필요가 없고, 계산 비용이 크거나 최적화가 필요한 경우에 사용하는 것이 좋다고 이해했다.

## useRef
`useRef`는 렌더링과 상관없이 값을 저장하거나, DOM 요소에 직접 접근할 때 사용하는 Hook이다.

대표적으로 input에 포커스를 줄 때 사용할 수 있다.

```jsx
import { useRef } from 'react'

function App() {
  const inputRef = useRef(null);

  const handleFocus = () => {
    inputRef.current.focus();
  };

  return (
    <div>
      <input ref={inputRef} />
      <button onClick={handleFocus}>포커스</button>
    </div>
  );
}
```

`inputRef.current`에는 실제 input 요소가 들어간다.

`useRef`는 값이 바뀌어도 화면이 다시 렌더링되지 않는다는 특징이 있다.

```
useState: 값이 바뀌면 리렌더링된다.
useRef: 값이 바뀌어도 리렌더링되지 않는다.
```
<!-- 위 아래 둘중 하나만 선택-->
**useState: 값이 바뀌면 리렌더링된다.**

**useRef: 값이 바뀌어도 리렌더링되지 않는다.**

그래서 화면에 바로 보여줘야 하는 값은 `useState`, 렌더링과 상관없이 기억만 하면 되는 값은 `useRef`를 사용할 수 있다.

## styled-components
마지막으로 `styled-components`도 배웠다.

`styled=components`는 JavaScript 파일 안에서 CSS를 작성할 수 있게 해주는 라이브러리이다.

```jsx
import styled from 'styled-component';

const Title = styled.h1`
  color: blue;
  font-size: 32px;
`;

const Button = styled.button`
  background-color: black;
  color: white;
  padding: 10px 16px;
  border: none;
  border-radius: 6px;
`;

function App() {
  return (
    <div>
      <Title>React 공부</Title>
      <button>버튼</button>
    </div>
  );
}

export default App;
```

기존 CSS 파일처럼 따로 스타일을 작성하는 것이 아니라, 스타일이 적용된 컴포넌트를 만들어서 사용하는 방식이다.

예를 들어 `Title`은 `h1` 태그에 스타일으 적용한 컴포넌트이고, `Butto`은 `button` 태그에 스타일을 적용한 컴포넌트이다.

컴포넌트와 스타일을 함께 관리할 수 있다는 점이 styled-components의 특징이라고 이해했다

## 오늘 배운 내용 정리
오늘은 React의 기본 구조와 JSX, 그리고 여러 Hooks에 대해 배웠다.

정리하면 다음과 같다.

```
React 앱 구조: main.jsx와 App.jsx를 중심으로 앱이 실행된다.
JSX: JavaScript 안에서 HTML처럼 UI를 작성하는 문법이다.
Hooks: 함수형 컴포넌트에서 React 기능을 사용할 수 있게 해준다.
useState: 상태를 관리하고, 값이 바뀌면 화면을 다시 렌더링한다.
useEffect: 렌더링 이후 실행할 작업을 처리한다.
import/export: 컴포넌트를 파일 단위로 나누고 가져오기 위해 사용한다.
useMemo: 계산된 값을 기억해서 불필요한 재계산을 줄인다.
useRef: DOM에 접근하거나 렌더링 없이 값을 저장한다.
useCallback: 함수를 기억해서 불필요한 함수 생성을 줄인다.
styled-components: CSS를 컴포넌트 형태로 작성할 수 있게 해준다.
```

오늘 배운 내용 중 Hooks는 앞으로 React를 공부하면서 계속 사용하게 될 중요한 개념인 것 같다.

특히 `useState`와 `useEffect`는 가장 기본이 되는 Hook이라서 예제 코드를 많이 작성해보면서 익숙해져야 할 것 같다.

아직은 각 Hook을 언제 정확히 사용해야 하는지 헷갈리는 부분도 있지만, 오늘은 전체적인 역할과 흐름을 이해하는 데 집중했다.

앞으로 수업에서 작성한 코드와 함께 다시 정리하면서 조금씩 내 것으로 만들어가려고 한다.

---
