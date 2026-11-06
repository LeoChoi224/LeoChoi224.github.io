---
layout: single
title: "FastAPI 기초 정리 2 - 응답 모델, 예외 처리, APIRouter와 백그라운드 작업"
categories: [coding, FastAPI]
tag: [study-log, FastAPI, Pydantic, response_model, HTTPException, APIRouter, Depends, BackgroundTasks]
toc: true
author_profile: false
sidebar:
    nav: "docs"
search: true
---
<hr/>

지난 시간에는 들어오는 데이터를 검증하는 법을 배웠고, 오늘은 **나가는 데이터**를 다뤘다. 응답에 규격을 씌우는 `response_model`, 응답 형식을 정하는 `response_class`, 실패를 실패답게 돌려주는 `HTTPException`을 배우고, 코드를 파일 단위로 나누는 `APIRouter`와 응답 뒤에 일을 처리하는 `BackgroundTasks`까지 나갔다.

## 모델 안에 모델 넣기
Pydantic 모델의 타입 자리에 다른 모델을 넣을 수 있다.

```python
class Image(BaseModel):
    url: str
    name: str

class Profile(BaseModel):
    name: str
    description: str
    image: Image          # 타입 자리에 모델이 들어간다

@app.post("/profiles/")
def create_profile(profile: Profile):
    return {"profile": profile.model_dump(), "image": profile.image.model_dump()}
```

```json
{
  "name": "홍묵",
  "description": "소개글",
  "image": { "url": "http://.../a.png", "name": "프로필사진" }
}
```

중첩된 안쪽까지 검증되고, `profile.image`는 딕셔너리가 아니라 `Image` 객체라서 `.url`로 꺼낼 수 있다. `List[str]`이면 배열의 항목 하나하나까지, `Union[int, str]`이면 둘 중 하나면 통과한다.

제네릭도 잠깐 배웠다. 붕어빵 틀은 하나인데 안에 넣을 재료를 나중에 정하는 것처럼, 타입을 나중에 정하는 모델이다.

```python
from typing import TypeVar, Generic

T = TypeVar("T")

class GenericItem(BaseModel, Generic[T]):
    name: str
    content: T              # GenericItem[int] 라고 쓰면 content: int 가 된다
```

사실 `List[int]`, `Optional[str]`도 전부 제네릭이라 이미 매일 쓰고 있었던 것이다. 실습 파일 하나에 `from pydantic.generics import GenericModel`이 있었는데, 이건 Pydantic v1 문법이라 v2에서는 import부터 실패한다. v2에서는 위처럼 `BaseModel, Generic[T]`를 같이 상속하면 된다.

## response_model - 나가는 데이터의 규격
실무 사고는 들어오는 쪽보다 나가는 쪽에서 더 자주 난다고 했다.

```python
def get_item_from_db(id):
    return {
        "name": f"Simple Item:{id}",
        "description": "A simple item description",
        "price": 51.0,
        "dis_price": 45.0      # 원가. 손님에게 보여주면 안 되는 값
    }

class Item(BaseModel):
    name: str
    description: str = None
    price: float

@app.get("/items/{item_id}", response_model=Item)
def read_item(item_id: int):
    return get_item_from_db(item_id)     # dis_price 는 응답에서 잘려 나간다
```

DB에서 꺼낸 데이터를 그대로 `return`하면 `dis_price`까지 나간다. 매번 손으로 걸러내면 언젠가는 빠뜨린다. `response_model=Item` 한 줄이면 **모델에 적힌 필드만 나간다.** 검증과 문서도 따라오지만, 이 기능의 핵심은 보안이었다.

다만 **빼는 건 알아서 해주지만 채워주지는 않는다.** 모델에 있는 필수 필드가 데이터에 없으면 500 에러가 난다.

```
422 = 요청이 잘못됐다 (보낸 쪽 잘못)
500 = 서버가 응답을 못 만들었다 (내 코드 잘못)
```

`response_model` 때문에 나는 에러는 항상 500 쪽이다. `Union[Cat, Dog]`로 응답 모델을 정해놓고 둘 다 아닌 모양을 반환하는 코드가 실습에 있었는데, 요청은 멀쩡한데 응답을 만들다가 500이 났다.

실무에서는 입력 모델과 출력 모델을 보통 나눈다고 한다. 같은 "사용자"라도 받을 때는 비밀번호가 있어야 하고, 보낼 때는 있으면 안 되기 때문이다.

```python
class UserCreate(BaseModel):     # 받을 때
    email: str
    password: str

class UserResponse(BaseModel):   # 보낼 때
    id: int
    email: str

@app.post("/users/", response_model=UserResponse)
def create_user(user: UserCreate): ...
```

## response_class - 응답의 형식
`response_model`이 응답의 **내용**을 정한다면, `response_class`는 응답의 **형식(Content-Type)**을 정한다.

```python
from fastapi.responses import PlainTextResponse, HTMLResponse, RedirectResponse

@app.get("/text", response_class=PlainTextResponse)
def read_text():
    return "<div>This is <u>Plain</u> Text</div>"

@app.get("/html", response_class=HTMLResponse)
def read_html():
    return "<div>This is <u>Plain</u> Text</div>"
```

반환값이 완전히 똑같은데 화면이 달랐다. `/text`는 태그가 글자 그대로 보이고, `/html`은 밑줄이 그어진 화면으로 렌더링된다. 브라우저는 `Content-Type` 헤더를 보고 렌더링할지, 글자로 보여줄지, 파일로 저장할지를 정하기 때문이다.

| 클래스 | Content-Type | 쓸 때 |
|---|---|---|
| `JSONResponse` | `application/json` | 기본값. API 응답 |
| `HTMLResponse` | `text/html` | 웹페이지 |
| `PlainTextResponse` | `text/plain` | 로그, 간단한 메시지 |
| `RedirectResponse` | | 다른 주소로 보내기 |

리다이렉트는 폼과 이어서 연습했다.

```python
@app.get("/input_age/", response_class=HTMLResponse)
def input_age():
    return """
    <form action="/age_check/">
        당신의 나이를 입력하세요<br/>
        <input type="text" name="age" size=4/>
        <input type="submit" value="전송"/>
    </form>
    """

@app.get("/age_check/")
def age_check(age: int):
    if age < 19:
        return RedirectResponse(url="/under_age/")
    return RedirectResponse(url="/adult/")
```

```
1. /input_age/        → HTML 폼을 받는다
2. [전송]             → form 에 method 가 없으니 기본값 GET
3. /age_check/?age=15 → input 의 name 이 그대로 쿼리 매개변수 이름이 된다
4. RedirectResponse   → 브라우저에게 "/under_age/ 로 다시 가"
```

Web 시간에 배운 폼 전송과 지난 시간의 타입 힌트(`age: int`)가 여기서 이어졌다.

## Query()와 HTTP 요청의 구조
`Query()`로 쿼리 매개변수에 조건과 설명을 달 수 있다.

```python
from fastapi import Query

@app.get("/users/")
def read_users(q: str = Query(default=None, max_length=5)):
    return {"q": q}

@app.get("/items/")
def read_items(internal_query: str = Query(None, alias="search")):
    return {"query_handled": internal_query}      # URL 은 ?search=, 파이썬 안에서는 internal_query

@app.get("/comments/")
def read_comments(comment_id: int = Query(...)):  # ... 이면 필수
    return {"comment_id": comment_id}
```

HTTP 요청은 Method, URL, Headers, Body 네 조각으로 이루어져 있다. 그리고 **GET 요청에는 바디가 없다.** 바디는 주로 POST, PUT, PATCH에서 쓴다. 그래서 GET으로 데이터를 보내려면 쿼리 매개변수뿐이고, 그 값이 URL에 그대로 드러난다. 비밀번호를 GET으로 보내면 안 되는 이유다.

## HTTPException - 실패는 raise로
`return {"error": "없음"}`이라고 보내면 상태 코드가 200이라서 받는 쪽은 "성공했는데 내용이 error네?"라고 읽는다. 실패는 `raise`로 돌려준다.

```python
from fastapi import HTTPException

@app.get("/items/{item_id}")
def read_item(item_id: int):
    if item_id < 0:
        raise HTTPException(status_code=400, detail="음수는 허용되지 않습니다")
    return {"item_id": item_id}
```

FastAPI가 이 예외를 잡아서 지정한 상태 코드와 `{"detail": "..."}` 모양의 JSON으로 바꿔준다. `headers=`로 헤더도 실어 보낼 수 있는데, HTTP 헤더 값에는 한글을 넣을 수 없다. `detail`은 본문이라 한글이 자유롭다.

| 코드 | 뜻 | 언제 |
|---|---|---|
| 200 / 201 | OK / Created | 성공 / 생성 성공 |
| 400 | Bad Request | 요청이 말이 안 된다 |
| 401 | Unauthorized | 로그인이 필요하다 |
| 403 | Forbidden | 로그인은 했는데 권한이 없다 |
| 404 | Not Found | 그런 리소스가 없다 |
| 500 | Internal Server Error | 서버 코드가 터졌다 |

401과 403이 헷갈리기 쉬운데, 401은 "너 누구야?"(신분증을 안 냈다)이고 403은 "너인 건 알겠는데 안 돼"(권한 부족)다. 로그인 안 한 사용자는 401, 일반 회원이 관리자 페이지에 들어오면 403이다.

## 정적 파일과 템플릿
HTML을 돌려주기 시작하면 CSS, JS, 이미지가 필요해지는데, 파일마다 엔드포인트를 만들 수는 없다. 이런 정적 파일은 폴더째 연결한다.

```python
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

templates = Jinja2Templates(directory="templates")

app = FastAPI()
app.mount(path="/static", app=StaticFiles(directory="static"), name="static")

@app.get("/")
def read_root(request: Request):
    return templates.TemplateResponse(request, "index_static1.html")
```

```
URL  /static/CSS/main.css   →  디스크  ./static/CSS/main.css
URL  /static/face01.png     →  디스크  ./static/face01.png
```

"URL의 `/static` 아래는 전부 이 폴더에서 꺼내줘"라고 통째로 맡기는 것이다. `mount`는 라우트 등록이 아니라 다른 앱을 통째로 붙이는 것이라서, 파일이 아무리 많아도 `/docs`에는 하나도 안 나온다.

서버는 HTML 하나만 보냈는데 화면이 완성되는 건, 브라우저가 HTML 안의 `<link>`, `<img>`, `<script>`를 보고 나머지 파일을 알아서 더 요청하기 때문이다. 실습에서는 요청이 네 번 일어났다.

HTML에서 `./static/CSS/main.css`처럼 `./`로 시작하는 상대 경로를 쓰면 지금 페이지 주소를 기준으로 하기 때문에, 페이지가 `/board/view`일 때는 `/board/static/...`을 찾다가 404가 난다. `/static/...`처럼 슬래시로 시작하거나, `mount`에 준 이름으로 주소를 만드는 게 안전하다.

{% raw %}
```html
<link rel="stylesheet" href="{{ url_for('static', path='/CSS/main.css') }}">
```
{% endraw %}

`TemplateResponse`는 `TemplateResponse(request, "파일이름.html")` 순서로 쓴다. 실습 코드는 딕셔너리를 앞에 두고 있었는데, 지금 방식으로 고쳐 쓰는 게 안전하다고 했다.

## APIRouter - 라우트를 파일별로 나누기
게시판 20개, 회원 15개, 상품 30개 엔드포인트가 `main.py` 한 파일에 있으면 둘이 동시에 수정할 수도 없고 뭐가 어디 있는지 찾을 수도 없다. `APIRouter`는 라우트를 담는 상자다.

```python
from fastapi import APIRouter

router1 = APIRouter()

@router1.get("/items/")          # @app.get 이 @router1.get 으로 바뀐 것뿐
def read_items():
    return {"Hello": "World"}

app = FastAPI()
app.include_router(router1, prefix="/api", tags=["items"])        # → /api/items/
app.include_router(router1, prefix="/webtoon", tags=["webtoon"])  # → /webtoon/items/
```

라우터는 틀이고, 붙일 때 주소가 정해진다. 같은 라우터를 두 번 붙이면 주소도 두 개 생긴다. `tags`는 `/docs`에서 그룹 제목이 되는데, 안 붙이면 전부 "default"로 몰려서 문서가 뒤죽박죽이 된다.

실제로는 파일을 나눠서 쓴다.

```python
# board_controller.py
from fastapi import APIRouter, Request

router = APIRouter(prefix="/board")

@router.get("/write")
def write(request: Request):
    return f"{request.method}, {request.url} 요청"
```

```python
# 010_APIRouter.py
import board_controller
app.include_router(board_controller.router)
```

게시판은 `board_controller.py`, 회원은 `user_controller.py`에 두고 `main.py`는 그것들을 모아 붙이기만 한다. 라우터들을 모듈별로 분리하면 분업과 유지보수에 유리하다는 게 이 파일의 마지막 줄이었다.

## Depends - 엔드포인트 전에 끼어드는 함수
```python
from fastapi import Depends

def check_token(token: str):
    if token != "my-secret-token":
        raise HTTPException(status_code=401, detail="Unauthorized")
    return token

router_depends_api = APIRouter(dependencies=[Depends(check_token)])

@router_depends_api.get("/items/")
def get_items():
    return {"message": "Access granted, you can view the items"}

app.include_router(router_depends_api, prefix="/depends/api")
```

```
/depends/api/items/                         → 422 (token 이 없다)
/depends/api/items/?token=wrong             → 401
/depends/api/items/?token=my-secret-token   → 200
```

사무실 문 앞의 경비원 같은 역할이다. 이 라우터의 모든 엔드포인트가 `check_token`을 먼저 통과해야 하고, 실패하면 `get_items`는 실행되지 않는다.

놓치기 쉬운 건 `check_token(token: str)`의 `token`이 어디서 오느냐였다. 의존성 함수의 매개변수도 FastAPI가 채워준다. `token: str`은 기본값이 없는 단순 타입이니 필수 쿼리 매개변수가 되고, 이 의존성을 거는 순간 모든 엔드포인트에 `?token=`이 필수로 생긴다. 지난 시간에 배운 규칙이 그대로 적용된 것이다.

`Depends`는 쓰는 자리에 따라 목적이 다르다.

```python
APIRouter(dependencies=[Depends(check_token)])              # ① 관문: 통과 여부만 본다
def read_child_item(session: str = Depends(child_dependency))  # ② 재료: 반환값을 받아 쓴다
```

②번이 다음 시간에 배울 DB 세션 주입(`db: Session = Depends(get_db)`)으로 이어진다고 한다. 상위 라우터에 건 의존성과 prefix, tags는 하위 라우터로 그대로 내려와서, "로그인한 사람만"을 최상위에 한 번 걸면 그 아래 전부에 적용된다.

## 경로 매개변수 심화 - 404와 422
경로 매개변수의 타입을 어디에 쓰느냐에 따라 에러가 달라졌다.

```python
@app.get("/users/{user_id}")
def read_user(user_id: int): ...          # /users/abc → 422

@app.get("/members/{member_id:int}")
def read_member_with_type(member_id): ... # /members/abc → 404
```

```
{id:int}  →  문 앞에서 "너는 여기 사람 아니야"  (404, 라우팅에서 안 맞음)
id: int   →  문은 열어주고 "신분증이 이상해"    (422, 검증에서 걸림)
```

보통은 왜 거절됐는지 알려줄 수 있는 함수 쪽 타입 힌트(422)가 낫다고 했다. 404는 "없는 페이지"와 구분이 안 되기 때문이다.

그리고 기본 경로 매개변수는 슬래시를 못 받는다. `/files/2026/06/a.txt`처럼 슬래시가 들어간 경로를 통째로 받으려면 `{sub_path:path}`라고 써야 한다. 실습 파일에는 `:path` 설명만 있고 코드에는 빠져 있어서 `/files/2026/06/a.txt`가 404가 났다.

경로와 쿼리를 나누는 기준도 정리했다. **그 값이 없으면 무엇을 달라는 건지 알 수 없으면 경로, 없어도 되는 옵션이면 쿼리**다.

```
/posts/42                  ← 42 가 없으면 어느 글인지 모른다 → 경로
/posts/?page=2&sort=new    ← 없어도 목록은 나온다          → 쿼리
```

## BackgroundTasks - 응답 먼저, 일은 나중에
회원가입을 하면 환영 이메일을 보내야 하는데, 이메일은 시간이 걸린다. 회원가입은 이미 끝났으니 사용자가 이메일이 나가는 걸 화면 앞에서 기다릴 이유가 없다.

```python
import time
from fastapi import BackgroundTasks

def write_log(message: str):
    time.sleep(3)                      # 오래 걸리는 일을 흉내
    with open("log.txt", "a") as f:
        f.write(f"{message}\n")

@app.get("/")
def read_root():
    write_log("root endpoint was accessed")        # 여기서 3초 멈춘다
    return {"message": "Hello World"}

@app.get("/background/")
def background(background_tasks: BackgroundTasks):
    background_tasks.add_task(write_log, "root endpoint was accessed")
    return {"message": "Hello World"}              # 바로 나간다
```

`/`는 화면이 뜨기까지 3초가 걸리고, `/background/`는 화면이 즉시 뜬다. `log.txt`에 기록되는 시점은 둘 다 같고, 달라진 건 **사용자가 기다리는 시간**뿐이다.

`add_task`에는 함수를 호출하지 말고 이름만 넘겨야 한다.

```python
background_tasks.add_task(write_log("hello"))   # 지금 실행해버린다
background_tasks.add_task(write_log, "hello")   # 나중에 실행하라고 맡긴다
```

`BackgroundTasks`는 응답을 보낸 직후 같은 서버 프로세스 안에서 실행된다. 그래서 서버가 죽으면 작업도 사라지고, 실패해도 사용자는 모른다. 로그나 알림 메일 같은 가벼운 뒷정리에 쓰고, 결제처럼 절대 잃으면 안 되는 일에는 Celery 같은 전용 작업 큐를 쓴다고 한다.

## 헷갈리기 쉬운 부분
- 실습 코드의 예외 처리 함수에 `return`이 빠져 있어서, 정상 요청(`/items/5`)에 200과 함께 본문 `null`이 나갔다. 에러도 성공도 아닌 응답이라 가장 찾기 어려운 버그다.
- 내가 던진 예외를 바로 `try/except`로 받아서 `HTTPException`으로 바꾸는 코드가 있었는데, 그럴 거면 처음부터 `raise HTTPException(...)` 한 줄이면 된다. `try/except`는 `int(user_input)`처럼 내가 통제 못 하는 곳에서 나는 에러를 다룰 때 쓴다.
- `RedirectResponse(url="/adult")`로 보내는데 라우트는 `/adult/`였다. FastAPI가 슬래시를 붙인 주소로 한 번 더 리다이렉트해줘서 동작은 하지만, 주소는 정확히 맞춰 쓰는 게 낫다.
- 주석에는 `/api/items/{id}`라고 적혀 있는데 코드는 `/item/{id}`라서 실제 주소는 `/api/item/5`였다. `/docs`를 열어서 실제로 등록된 경로를 확인하는 습관이 이런 걸 잡아준다.
- `import board_controller`는 같은 폴더에서 uvicorn을 실행해야 찾는다. 다른 폴더에서 실행하면 `ModuleNotFoundError`가 난다.
- 실행할 때마다 늘어나는 `log.txt` 같은 파일은 `.gitignore`에 넣는다. DB 파일, `.env`, `__pycache__`도 같은 부류다.

## 오늘 배운 내용 정리
오늘은 FastAPI에서 나가는 데이터와 코드 구조를 다뤘다.

```
중첩 모델: 타입 자리에 모델. 안쪽까지 검증된다.
제네릭: class GenericItem(BaseModel, Generic[T]). GenericModel 은 v1 문법.
response_model: 모델에 없는 필드는 잘라낸다(보안). 모자란 필수 필드는 못 채운다(500).
422 vs 500: 요청이 잘못됨 vs 서버가 응답을 못 만듦.
response_class: 응답 형식. HTML / PlainText / Redirect. 같은 문자열도 다르게 보인다.
Query(): 조건, alias, Query(...) 은 필수. GET 에는 바디가 없다.
HTTPException: 실패는 raise. 401 은 로그인 필요, 403 은 권한 없음.
정적 파일: app.mount("/static", StaticFiles(directory="static"), name="static").
APIRouter: 라우트 상자. include_router(router, prefix=..., tags=[...]). 파일별로 나눈다.
Depends: dependencies=[Depends(f)] 는 관문, x = Depends(f) 는 재료.
경로 변환기: {id:int} 는 404, id: int 는 422. 슬래시까지 받으려면 {sub_path:path}.
BackgroundTasks: add_task(함수, 인자). 응답은 즉시, 일은 나중에.
```

지난 시간이 "무엇을 받을지"였다면 오늘은 "무엇을 어떻게 돌려줄지"와 "코드를 어떻게 나눌지"를 배운 날이었다.

특히 `response_model`이 문서보다 보안 장치라는 설명이 기억에 남는다. DB에서 꺼낸 데이터를 그대로 돌려줘도 모델에 없는 값은 나가지 않는다.

---
