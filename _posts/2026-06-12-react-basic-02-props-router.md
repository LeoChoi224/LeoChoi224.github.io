---
layout: single
title: "React 기초 정리 2 - props, useCallback, Router, CRUD"
categories: [coding, React]
tag: [study-log, React, props, useCallback, router, bootstrap, crud]
toc: true
author_profile: false
sidebar:
    nav: "docs"
search: true
---
<hr/>

어제는 React의 기본 구조, JSX, Hooks의 기본 개념을 배웠고, 오늘은 조금 더 실제 화면 구성에 가까운 내용들을 배웠다.

오늘 배운 내용은 `props`, `useCallback`, `react-router-dom`, `react-bootstrap`, 그리고 간단한 CRUD 구현이다.


## props

`props`는 `properties`의 줄임말로, 부모 컨포넌트가 자식 컴포넌트에게 데이터를 전달할 때 사용한다.

예를 들어 `HomePage`에서 게시글 목록, 숫자 상태, 사용자 정보를 만들고 `Home` 컴포넌트로 전달한다.

나는 이를 함수의 매개변수(parameter)와 비슷한 개념으로 이해했다. 특히 여러 값을 하나의 객체로 전달받는 방식은 Python의 `**kwargs`와 유사하다고 느꼈다.

```jsx
<Home
  boards={boards}
  id={1}
  setBorads={setBoards}
  number={number}
  setNumber={setNumber}
/>
```

자식 컴포넌트에서는 전달받은 props를 사용할 수 있다.

```jsx
const Home = (props) => {
  const { boards, setBoards, id } = props;
  const { number, setNumber } = props;

  return (
    <div>
      <h1>홈페이지</h1>
      <button onClick={() => setBoards([])}>전체삭제</button>

      {boards.map((board) => (
        <h4 key={board.id}>
        제목: {board.title} 내용: {board.content}
        </h4>
      ))}

      <h2>number {number} </h2>
      <button onClick={() => setNumber(number + 1)}>증가</button>
    </div>
  );
}
```

props를 사용하면 부모가 가진 상태나 함수를 자식 컴포넌트에서 사용할 수 있다.

오늘 코드에서는 부모의 `boards`, `number`, `setBoards`, `setNumber`를 자식에게 넘겨서 화면 출력과 상태 변경을 처리했다.


## useCallback

`useCallback`은 함수를 메모이제이션할때 사용하는 Hook이다.

컴포넌트가 다시 렌더링되면 내부에 선언된 함수도 다시 만들어진다. 이때 함수가 props로 자식 컴포넌트에 전달되고 있다면, 자식 컴포넌트 입장에서는 매번 새로운 함수가 전달된 것으로 인식할 수 있다.

```jsx
const createBoxStyle = () => {
  return {
    backgroundColor: "pink",
    width: `${size}px`,
    height: `${size}px`,
  };
}
```

이 함수는 부모가 컴포넌트가 렌더링될 때마다 새로 만들어진다.

그래서  `useCallback`을 사용하면 특정 값이 바뀔 때만 함수를 다시 만들 수 있다.

```jsx
const createBoxStyle2 = useCallback(() => {
  return {
    backgroundColor: "pink",
    width: `${size}px`,
    height: `${size}px`,
  }
}, [size]);
```

위 코드는 `size`가 변경될 때만 `createBoxStyle2` 함수가 다시 생성된다.

`useCallback`은 `useMemo`와 비슷하지만 차이가 있다.

```
useMemo     : 함수가 실행된 결과값을 기억한다.
useCallback : 함수 자체를 기억한다.
```

오늘 예제에서는 박스 크기를 변경하는 함수가 불필요하게 다시 생성되는 것을 줄이기 위해 `useCallback`을 사용했다.


## react-router-dom

`react-router-dom`은 React에서 페이지 이동을 처리할 때 사용하는 라이브러리이다.

React는 기본적으로 SPA(Single Page Application)방식으로 동작하기 때문에, 페이지를 새로 요청하는 대신 URL에 따라 보여줄 컴포넌트를 바꿔주는 방식으로 라우팅을 처리한다.

```jsx
import { Route, Routes } from "react-router-dom";

<Routes>
  <Route path="/" Component={HomePage} />
  <Route path="/login" Component={LoginPage} />
  <Route path="/login/:id" Component={LoginPage} />
</Routes>
```

`/` 경로로 접속하면 `HomePage`가 보이고, `/login` 경로로 접속하면 `LoginPage`가 보인다.

`/login/:id`처럼 작성하면 URL 경로의 일부를 변수(경로 변수, Path Variable)처럼 받아 사용할 수 있다.


## useParams

`useParams`는 현재 URL에 포함된 경로 변수(Path Variable)를 가져오는 React Router의 Hook이다.

예를 들어 URL이 /login/10이라면 :id 부분에 해당하는 값 "10"을 읽어올 수 있다.

```jsx
import { useParams } from "react-router-dom";

const LoginPage = () => {
  const params = useParams();

  return (
    <>
      {params.id}
      <Login />
    </>
  );
};
```

예를 들어 `/login/10`으로 접속하면 `params.id` 값은 `"10"`이 된다.

또한 객체 비구조화 할당을 사용하면 다음과 같이 작성할 수도 있다.

```jsx
const { id } = useParams();

console.log(id); // "10"
```

페이지 이동에는 일반 `<a>` 태그 대신 `Link`를 사용한다.

```jsx
<Link to="/">홈</Link>
<Link to="/login">로그인</Link>
<Link to="/login/10">로그인/10</Link>
```

`a` 태그는 페이지 **전체를 새로 요청**하지만, `Link`는 React Router를 통해 **화면만 전환**한다.

## react-bootstrap

`react-bootstrap`은 Bootstrap 컴포넌트를 React 방식으로 사용할 수 있게 해주는 라이브러리이다.
오늘은 `Navbar`, `Container`, `Nav`를 사용해서 상단 메뉴를 만들어봤다.

```jsx
import { Container, Nav, Navbar } from "react-bootstrap";
import { Link } from "react-router-dom";

<Navbar bg="primary" data-bs-theme="dark">
  <Container>
    <Navbar.Brand href="#home">Navbar</Navbar.Brand>
    <Nav className="me-auto">
      <Link className="nav-link" to="/">Home</Link>
      <Link className="nav-link" to="/login/80">/login/80</Link>
    </Nav>
  </Container>
</Navbar>
```

`react-bootstrap`을 사용하면 Bootstrap의 스타일을 React 컴포넌드 형태로 사용할 수 있다.

그리고 `main.jsx`에서 Bootstrap CSS를 import 해야 스타일이 적용된다.

```jsx
import "bootstrap/dist/css/bootstrap.min.css";
```

## CRUD

마지막으로 간단한 CRUD 구조를 배웠다.

CRUD는 데이터를 다루는 기본 기능을 의미한다.

```
Create : 생성
Read   : 조회
Update : 수정
Delete : 삭제
```

오늘 예제에서는 게시글 목록을 `useState`로 관리했다.

```jsx
const [posts, setPosts] = useState([
  { id: 1, title: "제목1", content: "내용1" },
  { id: 2, title: "제목2", content: "내용2" },
  { id: 3, title: "제목3", content: "내용3" },
]);
```

입력 폼의 데이터도 상태로 관리했다.

```jsx
const [post, setPost] = useState({
  id: "",
  title: "",
  content: "",
});
```

input 값이 변경될 때는 `name` 속성을 이용해서 하나의 함수로 처리했다.

```jsx
const handleForm = (e) => {
  setPost({
    ...post,
    [e.target.name]: e.target.value,
  });
};
```

`[e.target.name]`을 사용하면 input의 name 값에 따라 `id`, `title`, `content` 중 필요한 값만 변경할 수 있다.

글쓰기 버튼을 누르면 기존 게시글 배열에 새 게시글을 추가한다.

```jsx
const handleWrite = () => {
  setPosts([
    ...posts,
    {
      id: post.id,
      title: post.title,
      content: post.content,
    },
  ]);
};
```

배열 상태를 변경할 때는 기존 배열을 직접 수정하지 않고, spread 문법으로 새로운 배열을 만들어서 상태를 변경한다.

```jsx
setPosts([...posts, newPost]);
```

게시글 목록은 `map()`으로 출력했다.

```jsx
{posts.map((post) => (
  <div key={post.id}>
    번호: {post.id} 제목: {post.title} 내용: {post.content}
  </div>
))}
```

오늘 코드에서는 글쓰기와 목록 출력 구조를 중심으로 CRUD의 기본 흐름을 연습했다. 삭제와 수정 기능은 앞으로 `filter`, `map` 등을 사용해서 더 완성할 수 있을 것 같다.

## 오늘 배운 내용 정리

오늘은 React에서 컴포넌트 간 데이터 전달, 함수 최적화, 페이지 이동, Bootstrap UI, CRUD 구조를 배웠다.

```
props
부모 컴포넌트에서 자식 컴포넌트로 데이터나 함수를 전달한다.

useCallback
함수 자체를 메모이제이션해서 불필요한 함수 재생성을 줄인다.

react-router-dom
URL 경로에 따라 다른 컴포넌트를 보여준다.

react-bootstrap
Bootstrap UI를 React 컴포넌트 형태로 사용할 수 있다.

CRUD
데이터의 생성, 조회, 수정, 삭제 흐름을 React 상태로 관리한다.
```

오늘 내용부터는 단순히 문법을 배우는 것보다 실제 화면과 기능을 구성하는 느낌이 강했다.

특히 `props`를 통해 부모와 자식 컴포넌트가 데이터를 주고받는 방식, `router`를 통해 페이지를 나누는 방식, 그리고 `useState`로 게시글 목록을 관리하는 CRUD 흐름이 중요하게 느껴졌다.

아직 CRUD 기능을 완전히 구현한 것은 아니지만, React에서 데이터를 상태로 관리하고 화면에 출력하는 기본 흐름을 이해하는 데 도움이 되었다.
