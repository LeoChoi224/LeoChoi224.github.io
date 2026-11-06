---
layout: single
title: "FastAPI 기초 정리 1 - 라우팅, 경로·쿼리 매개변수와 Pydantic"
categories: [coding, FastAPI]
tag: [study-log, FastAPI, Python, Pydantic, uvicorn, REST-API, Swagger]
toc: true
author_profile: false
sidebar:
    nav: "docs"
search: true
---
<hr/>

오늘부터 FastAPI를 배웠다. 지금까지 만든 파이썬 코드는 내 컴퓨터에서 내가 실행하는 것이었다. 크롤링으로 데이터를 모아도 그 결과를 쓸 수 있는 건 나뿐이었다.

웹 서버는 그 함수를 인터넷에서 부를 수 있게 만들어준다. `read_item(5)`를 내가 직접 부르는 대신, 누군가 브라우저에서 `/items/5`를 열면 그 함수가 대신 불리는 것이다.

FastAPI는 이걸 아주 짧게 해결한다. **함수에 데코레이터를 붙이면 그게 API가 되고, 매개변수에 타입 힌트를 쓰면 그게 입력 검증 규칙이 된다.** 오늘은 라우팅과 매개변수, 그리고 요청 데이터를 클래스로 받는 Pydantic까지 배웠다.

## 서버 띄우기
```python
from fastapi import FastAPI

app = FastAPI()

@app.get("/")
def read_root():
    return {"message": "Hello FastAPI!"}
```

```bash
uvicorn 001_Hello:app --reload
```

| 조각 | 뜻 |
|---|---|
| `001_Hello` | 파일 이름 (`.py` 를 뗀 것) |
| `app` | 그 파일 안의 FastAPI 객체 변수 이름 |
| `--reload` | 코드를 고치면 서버가 자동으로 다시 시작된다 (개발용) |

"001_Hello.py 파일을 열어서 그 안의 app을 서버로 돌려라"는 뜻이다. 변수 이름을 `myapp`으로 바꿨다면 명령도 `001_Hello:myapp`이 된다.

`uvicorn`은 FastAPI가 아니라 별도의 서버 프로그램이다. FastAPI는 "요청이 오면 무엇을 할지"만 정하고, 실제로 포트를 열고 접속을 받는 건 uvicorn이 한다. 그래서 `python 001_Hello.py`로는 서버가 안 뜬다. 파일 안에 서버를 띄우는 코드가 없기 때문이다.

## 경로 매개변수와 쿼리 매개변수
URL로 값을 받는 통로는 두 가지다.

```python
# 경로 매개변수 — URL 안에 값을 심는다
@app.get("/items/{item_id}")
def read_item(item_id):
    return {"item_id": item_id}

# 쿼리 매개변수 — ? 뒤에 붙인다
@app.get("/posts/")
def get_posts(limit=0, rows=10):
    return {"limit": limit, "rows": rows}
```

경로의 `{}` 안 이름과 함수 매개변수 이름이 같아야 짝이 맞는다. FastAPI는 **경로에 `{}`로 선언한 이름은 경로 매개변수, 나머지는 쿼리 매개변수**로 알아서 나눈다.

그리고 이 규칙 하나가 422 에러의 절반을 설명한다고 했다. **기본값이 있으면 선택, 없으면 필수다.**

```
@app.get("/items/") def read_item_with_limit(skip, limit)

/items/?skip=5&limit=8    → 200 OK
/items/?skip=5            → 422   ← limit 에 기본값이 없어서 필수다

@app.get("/posts/") def get_posts(limit=0, rows=10)

/posts/?limit=5           → 200 OK  ← rows 는 기본값 10
```

## 타입 힌트가 검증 규칙이 된다
```python
@app.get("/items/{item_id}")
def read_item(item_id: int):
    return {"item_id": item_id}
```

```
/items/500     → 200 OK   {"item_id": 500}
/items/john    → 422
```

`: int` 하나를 붙이면 세 가지가 한꺼번에 일어난다.

```
검증: 정수로 못 바꾸면 422 를 돌려주고 함수는 아예 실행되지 않는다.
변환: URL 은 항상 문자열인데 함수 안에서는 int 로 들어온다.
문서: 자동 문서(/docs)에 "int 를 받는다"고 표시된다.
```

`: int`와 `-> dict` 같은 타입 힌트는 파이썬 3.5부터 있던 표준 문법이고, 파이썬 자체는 이걸 검사하지 않는다. FastAPI가 그동안 아무도 안 쓰던 이 표시를 읽어서 검증에 써먹은 것이다.

기본값과 조합하면 선택 매개변수가 된다.

```python
@app.get("/getage/")
def read_age(age: float = 23.4):
    return {"age": age}

# /getage/?age=31.6  → 200   /getage/?age=kim → 422   /getage/ → 23.4
```

### 리스트는 Query()가 필요하다
```python
from typing import List
from fastapi import Query

@app.get("/details/")
def read_details(q: List[int] = Query([])):
    return {"q": q}

# /details/?q=1&q=2&q=3  → {"q": [1, 2, 3]}
```

`q: List[int] = []`라고만 쓰면 FastAPI는 이걸 쿼리가 아니라 요청 바디로 해석해버린다. FastAPI의 기본 규칙이 **단순 타입(int, str, float, bool)은 쿼리, 복합 타입(list, dict, 모델)은 바디**이기 때문이다. `Query()`로 "이건 쿼리야"라고 명시해줘야 한다.

## HTTP 메서드
같은 `/items/`라도 메서드가 다르면 다른 엔드포인트다.

```python
@app.get("/items/")                 # 조회
def read_items(skip: int = 0, limit: int = 10): ...

@app.post("/items/")                # 생성
def create_item(item: dict): ...

@app.put("/items/{item_id}")        # 전체 수정
def update_item(item_id: int, item: dict): ...

@app.delete("/items/{item_id}")     # 삭제
def delete_item(item_id: int): ...
```

| 메서드 | 하는 일 | 바디 |
|---|---|---|
| GET | 조회 | 없음 |
| POST | 생성 | 있음 |
| PUT | 전체 교체 | 있음 |
| PATCH | 일부 수정 | 있음 |
| DELETE | 삭제 | 보통 없음 |

브라우저 주소창으로는 GET만 보낼 수 있어서, POST나 PUT, DELETE를 테스트하려면 Postman이나 자동 문서가 필요하다. FastAPI와 React를 하는 동안은 Postman을 항상 켜두라는 공지가 있었다.

## /docs - 공짜로 따라오는 문서
서버를 띄우고 `http://127.0.0.1:8000/docs`를 열면 Swagger UI라는 문서 화면이 나온다. 타입 힌트만 써두면 문서가 저절로 만들어지고, 그 화면에서 바로 요청을 보내볼 수도 있다.

```
/docs          Swagger UI (요청 실행까지 가능)
/redoc         ReDoc (읽기 좋은 문서)
/openapi.json  위 두 화면의 원본 데이터
```

코드를 고치면 문서도 같이 바뀌니 문서가 낡을 일이 없다. FastAPI가 인기 있는 가장 큰 이유 중 하나라고 한다.

용어도 정리했다. 공식 문서에서는 `@app.get(...)`을 Path Operation Decorator, 그 아래 함수를 Path Operation Function이라고 부르는데, 현장에서는 URL 하나하나를 **엔드포인트**, 요청을 처리하는 함수를 **핸들러**, 어떤 URL을 어떤 함수로 보낼지 정하는 일을 **라우팅**이라고 부른다. 다 같은 이야기다.

## Pydantic - 요청 데이터를 클래스로 받기
POST로 데이터를 받을 때 `dict`로 받으면 아무 딕셔너리나 다 통과한다.

```python
@app.post("/items/")
def create_item(item: dict):     # name 이 없어도, price 에 글자가 들어와도 통과
    return {"item": item}
```

함수 안에서 `item["price"] * 2`를 하는 순간에야 문제가 터진다. Pydantic 모델을 쓰면 문 앞에서 막힌다.

```python
from pydantic import BaseModel

class Item(BaseModel):
    name: str                 # 필수
    price: float              # 필수
    is_offer: bool = None     # 선택 (기본값이 있다)

@app.post("/items/")
def create_item(item: Item):
    return {"item": item.model_dump()}
```

```
{"name": "Bread", "price": 3.5,    "is_offer": true}  → 200 OK
{"name": "Bread", "price": "박지원", "is_offer": true}  → 422
```

`BaseModel`을 상속한 클래스 본문이 그대로 입력 규격서가 된다. 함수 매개변수 타입이 Pydantic 모델이면 FastAPI는 요청 바디에서 값을 찾는다. 앞에서 배운 "단순 타입은 쿼리, 복합 타입은 바디" 규칙 그대로다. `model_dump()`는 모델을 딕셔너리로 바꾸는 메서드다.

### 검증과 직렬화
두 단어가 계속 같이 나오는데 하는 일이 다르다.

| | 검증 (validation) | 직렬화 (serialization) |
|---|---|---|
| 언제 | 데이터가 들어올 때 | 데이터가 나갈 때 |
| 하는 일 | 형식과 값이 올바른지 확인 | 파이썬 객체 → JSON |
| 실패하면 | 422 로 거절 | 응답을 못 만든다 |

검증은 입국심사, 직렬화는 짐을 부치기 좋게 포장하는 것이라고 비유했다. Pydantic은 이 둘을 모델 클래스 하나로 동시에 해준다.

### Optional과 기본값은 다른 이야기
```python
from typing import Optional

class Book(BaseModel):
    name: str                          # 필수
    description: Optional[str] = None  # 선택, 기본값 None
    price: float                       # 필수
    tax: float = 0.1                   # 선택, 기본값 0.1
```

`Optional[str]`은 "str이거나 None"이라는 뜻이다. 그런데 `Optional`을 붙였다고 선택 필드가 되는 건 아니다. 선택으로 만드는 건 `= None`이라는 기본값 쪽이다. `description: Optional[str]`처럼 기본값 없이 쓰면 "None도 허용하는 필수 필드"가 되어, 아예 안 보내면 422가 난다. `Optional`은 값의 종류, 기본값은 있어도 되는지를 정한다.

### Field()로 더 촘촘하게
타입만으로는 "2자 이상 50자 이하"나 "0보다 커야 함"을 표현할 수 없다.

```python
from pydantic import Field

class Pet(BaseModel):
    name: str = Field(..., title="Pet Name", min_length=2, max_length=50)
    description: Optional[str] = Field(None, max_length=300)
    price: float = Field(..., gt=0, description="Price must be greater than zero")
    tag: List[str] = Field(default=[], alias="pet-tags")
```

| 옵션 | 뜻 |
|---|---|
| `min_length` / `max_length` | 문자열 길이 |
| `gt` / `lt` / `ge` / `le` | 숫자 크기 (`>`, `<`, `>=`, `<=`) |
| `alias` | JSON 쪽 이름을 파이썬 변수 이름과 다르게 |
| `title` / `description` | 자동 문서에 표시되는 설명 |

`Field(...)`의 `...`은 파이썬의 진짜 값 `Ellipsis`인데, 여기서는 "기본값 없음 = 필수"라는 표시로 쓴다. `Field(None)`은 "기본값이 None인 선택 필드"라서, 기본값이 아예 없다는 것과 구분할 표시가 필요해서 `...`을 쓴다고 한다.

### alias를 걸면 JSON은 alias 이름만 받는다
파이썬 변수 이름에는 하이픈을 쓸 수 없는데, JSON API에서는 `pet-tags` 같은 이름이 흔하다. `alias`가 그 간극을 메운다. 파이썬에서는 `pet.tag`, JSON에서는 `"pet-tags"`다.

```
{"name": "coco", "price": 1000, "tag": ["dog"]}        → tag 가 조용히 무시된다
{"name": "coco", "price": 1000, "pet-tags": ["dog"]}   → 들어간다
```

파이썬 이름으로 보내면 에러 없이 무시되고 기본값 `[]`이 들어간다. Postman으로 테스트할 때 드러나는 함정이었다.

### 422 응답은 읽으면 답이 있다
422는 서버가 고장 난 게 아니라 "네 요청이 잘못됐다"는 뜻이다. 응답 본문을 열어보면 어디가 왜 틀렸는지 적혀 있다.

```json
{"detail": [{
    "type": "float_parsing",
    "loc": ["body", "price"],
    "msg": "Input should be a valid number, unable to parse string as a number",
    "input": "박지원"
}]}
```

`loc`이 `["body", "price"]`라고 위치를 정확히 찍어준다. `body`, `query`, `path` 중 어디인지부터 보면 원인을 바로 찾을 수 있다.

## 헷갈리기 쉬운 부분
- 실습 코드에 `return {"skip", "limit"}`가 있었는데, 콜론이 아니라 쉼표라서 딕셔너리가 아니라 **집합(set)**이다. 게다가 변수가 아니라 문자열을 담고 있다. 에러가 안 나고 `["skip","limit"]` 같은 응답이 나가서 더 눈치채기 어렵다. 의도한 건 `{"skip": skip, "limit": limit}`이다.
- 같은 경로를 두 번 등록해도 FastAPI는 에러를 내지 않는다. 위에서부터 먼저 맞는 것을 쓰기 때문에 아래쪽 함수는 영원히 실행되지 않는다. 코드를 고쳤는데 응답이 안 바뀌면 위쪽에 같은 경로가 있는지부터 본다.
- 함수 이름이 같아도 두 라우트가 모두 동작한다. 데코레이터가 먼저 실행되면서 함수 객체를 이미 등록해뒀기 때문이다. 대신 `/docs`에 같은 이름으로 표시돼서 헷갈리니 이름은 다르게 짓는다.
- `def`와 `async def`를 섞어 써도 된다. 차이는 다음 주에 비동기를 배울 때 다룬다고 했고, 지금은 `def`를 쓰면 된다.
- Pydantic은 2023년에 v2로 바뀌면서 `.dict()`가 `.model_dump()`로, `.parse_obj()`가 `.model_validate()`로 이름이 바뀌었다. 인터넷 예제가 안 돌아가면 버전 차이를 먼저 의심한다.

## 오늘 배운 내용 정리
오늘은 FastAPI의 라우팅과 매개변수, Pydantic 모델을 배웠다.

```
실행: uvicorn 파일이름:변수이름 --reload. uvicorn 이 실제 서버다.
경로 매개변수: /items/{item_id}. 이름으로 짝을 맞춘다.
쿼리 매개변수: 경로에 없는 나머지 매개변수. 기본값이 있으면 선택, 없으면 필수.
타입 힌트: 검증 + 변환 + 문서. 틀리면 함수 실행 전에 422.
리스트 쿼리: List[int] = Query([]). 안 붙이면 바디로 해석된다.
메서드: GET 조회 / POST 생성 / PUT 전체 수정 / PATCH 일부 수정 / DELETE 삭제.
/docs: 타입 힌트만으로 만들어지는 문서. 여기서 바로 요청을 보낼 수 있다.
Pydantic: BaseModel 상속 클래스 = 요청 바디 규격서. model_dump() 로 딕셔너리.
Optional vs 기본값: Optional 은 None 허용, 선택 여부는 = None 이 정한다.
Field(...): ... 은 필수. min_length, gt 같은 조건과 alias.
422: 응답 본문의 loc 부터 본다.
```

SQLAlchemy 실습 때 "이 함수들이 FastAPI 라우터의 본문이 된다"고 했는데, 오늘 데코레이터 한 줄로 평범한 함수가 API가 되는 걸 보니 무슨 말인지 알 것 같았다.

타입 힌트를 붙이는 것만으로 검증과 문서가 같이 따라온다는 게 FastAPI의 핵심인 것 같다.

---
