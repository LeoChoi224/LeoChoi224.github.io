---
layout: single
title: "FastAPI 기초 정리 3 - 스트리밍 응답, 인증(Basic·JWT·세션), 동기와 비동기"
categories: [coding, FastAPI]
tag: [study-log, FastAPI, StreamingResponse, JWT, session, authentication, async, asyncio]
toc: true
author_profile: false
sidebar:
    nav: "docs"
search: true
---
<hr/>

오늘은 FastAPI 진도의 마지막 날이었다. 응답을 조각내서 보내는 `StreamingResponse`, 로그인을 처리하는 인증 방식 세 가지(Basic, JWT, 세션), 그리고 그동안 별생각 없이 섞어 쓰던 `def`와 `async def`의 차이를 배웠다. 오후에는 SQLAlchemy ORM으로 게시판 API를 만들었는데, 그건 다음 글에 따로 정리한다.

## StreamingResponse - 만들면서 보내기
지금까지의 응답은 데이터를 전부 만든 다음 한 번에 보냈다. 데이터가 500MB라면 서버 메모리에 500MB를 통째로 올려둬야 하고, 사용자는 그게 다 만들어질 때까지 빈 화면을 본다. 스트리밍은 데이터를 만드는 대로 조각조각 보낸다.

이삿짐에 비유하면, 트럭에 전부 싣고 한 번에 가는 게 일반 응답이고 상자를 채우는 대로 계속 나르는 게 스트리밍이다.

```python
from fastapi.responses import StreamingResponse

def data_generator():
    for i in range(100):
        yield f"data chunk {i}\n"       # 한 조각씩 내보낸다

@app.get("/stream")
def stream_data():
    return StreamingResponse(data_generator(), media_type="text/plain")
```

`StreamingResponse`의 첫 인자는 **제너레이터**다. `return` 대신 `yield`를 쓴 함수인데, 호출해도 바로 실행되지 않고 값을 하나 달라고 할 때마다 `yield` 한 줄까지 실행하고 멈춘다. 그래서 100개를 한꺼번에 메모리에 올리지 않는다. 대신 제너레이터는 일회용이라 한 번 끝까지 돌면 다시 쓸 수 없어서, 엔드포인트 안에서 요청마다 새로 만들어야 한다.

### CSV를 조각내서 다운로드시키기
```python
import csv, io

def csv_streamer():
    data = [["name", "age"], ["alice", 32], ["bob", 29]]
    output = io.StringIO()          # 메모리 위의 가짜 파일
    writer = csv.writer(output)

    for row in data:
        writer.writerow(row)        # 가짜 파일에 한 줄 쓰고
        yield output.getvalue()     # 그 내용을 조각으로 내보낸다
        output.truncate(0)          # 내용 지우기
        output.seek(0)              # 커서를 맨 앞으로

@app.get("/csv")
def get_csv():
    return StreamingResponse(
        csv_streamer(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=sample.csv"},
    )
```

- `io.StringIO`는 디스크에 쓰지 않고 메모리에서 문자열을 파일처럼 다루게 해주는 가짜 파일이다.
- `truncate(0)`과 `seek(0)`을 빼먹으면 `StringIO`에 쓴 내용이 계속 쌓여서, 두 번째 조각에 첫 줄이 또 딸려 나간다.
- `Content-Disposition: attachment; filename=...` 헤더가 있으면 브라우저가 화면에 펼치지 않고 그 이름으로 파일을 저장한다.

디스크에 이미 있는 파일을 보낼 때는 `FileResponse("report.pdf", filename="보고서.pdf")`를 쓰면 된다. **만들면서 보내야 하면 `StreamingResponse`, 이미 있는 걸 보내면 `FileResponse`**다.

스트리밍의 진짜 쓸모는 파일 다운로드보다 실시간 전송에 있다고 했다. `media_type="text/event-stream"`으로 보내는 SSE(Server-Sent Events)가 ChatGPT에서 글자가 타이핑되듯 나오는 방식이고, 나중에 LangChain에서 AI 응답을 흘려보낼 때 오늘 배운 `yield`가 그대로 쓰인다고 한다.

한 가지 주의할 점은, 스트리밍은 보내기 시작하는 순간 상태 코드 200이 이미 나간다는 것이다. 중간에 에러가 나면 "200인데 내용이 끊긴 응답"이 된다. 그래서 검증은 스트리밍을 시작하기 전에 다 끝내둬야 한다.

## 인증 - 매 요청마다 "너 누구냐"
HTTP는 상태가 없는(stateless) 프로토콜이다. 서버는 방금 로그인한 사람을 기억하지 못한다.

```
요청 1: POST /login    {"id": "alice", "pw": "1234"}   → "환영합니다"
요청 2: GET /users/me                                   → "누구세요?"
```

그래서 매 요청마다 신분을 증명할 무언가를 같이 보내야 하고, 그걸 무엇으로 하느냐가 오늘 배운 세 가지 방식이다.

| 방식 | 매번 보내는 것 | 서버가 기억하나 |
|---|---|---|
| Basic | 아이디 + 비밀번호 | 안 한다 |
| JWT | 서명된 토큰 | 안 한다 (토큰 자체가 증거) |
| 세션 | 세션 ID (쿠키) | 한다 |

인증(Authentication)은 "너 누구냐", 인가(Authorization)는 "그걸 할 자격이 있냐"다. 지난 시간에 배운 401이 인증 실패, 403이 인가 실패다.

### Basic 인증
```python
from fastapi.security import HTTPBasic, HTTPBasicCredentials

security = HTTPBasic()

def get_current_username(credentials: HTTPBasicCredentials = Depends(security)):
    if credentials.username != "alice" or credentials.password != "1234":
        raise HTTPException(status_code=401, detail="Unauthorized")
    return credentials.username

@app.get("/users/me")
def read_current_user(username: str = Depends(get_current_username)):
    return {"username": username}
```

실제로 오가는 건 `Authorization: Basic YWxpY2U6MTIzNA==` 헤더 한 줄이다. 저 문자열을 Base64로 되돌리면 그냥 `alice:1234`가 나온다. **Base64는 암호화가 아니라 인코딩이다.** 비밀로 만들려는 게 아니라 깨지지 않게 옮기려는 것이라서, HTTPS 없이 쓰면 비밀번호를 그냥 보내는 것과 같다.

`Depends(security)`가 그 헤더를 읽어서 `username`과 `password`로 쪼개준다. 지난 시간에 배운 의존성 주입이 그대로 쓰였다.

### JWT - 서명된 신분증
놀이공원 손목띠 같은 것이다. 입구에서 한 번 확인하고 띠를 채워주면 안에서는 띠만 보여주면 되고, 띠에 위조 방지 무늬가 있어서 직접 만들 수 없다.

```
eyJhbGciOiJIUzI1NiJ9  .  eyJ1c2VybmFtZSI6ImFsaWNlIn0  .  SflKxwRJSMeKKF2QT4
      header                     payload                     signature
   어떤 알고리즘?             누구인지, 언제까지              위조 방지 도장
```

```python
import jwt
import datetime

SECRET_KEY = "my_secret_key"

def create_jwt_token(data: dict):
    data["exp"] = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=1)
    return jwt.encode(payload=data, key=SECRET_KEY, algorithm="HS256")

def verify_jwt_token(token: str):
    try:
        return jwt.decode(jwt=token, key=SECRET_KEY, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="토큰이 만료되었습니다")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="유효하지 않은 토큰입니다")

@app.get("/protected")
def read_protected_route(token: str = Header(None)):
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return {"decoded": verify_jwt_token(token)}
```

`Header(None)`은 `Query`나 `Body`처럼 "이 값은 HTTP 헤더에서 찾아라"는 표시다.

JWT의 핵심은 **서버가 아무것도 저장하지 않는다**는 것이다. 토큰을 받으면 서명만 검증해서 "내가 발급한 게 맞다"를 확인하고, 그 안에 적힌 `username`을 믿는다. 그래서 서버를 여러 대로 늘리기 쉽다. 대신 한 번 발급한 토큰을 취소할 수 없다는 게 단점이라서, 만료 시간을 짧게 잡는다.

- **만료 시간(`exp`)이 없는 토큰은 만들지 않는다.** 한 번 새면 영원히 유효하기 때문이다. 실무에서는 15분짜리 액세스 토큰과 2주짜리 리프레시 토큰을 같이 쓰는 방식이 흔하다고 한다.
- 비밀키는 `secrets.token_hex(32)`로 만든다. `random` 모듈은 시드만 알면 다음 값이 예측되지만, `secrets`는 암호학적으로 안전한 난수를 쓴다.
- **JWT의 payload도 암호화가 아니다.** 가운데 조각을 Base64로 되돌리면 비밀키 없이도 내용이 그대로 읽힌다. 서명은 위조를 막을 뿐 내용을 가리지 않는다. 그래서 payload에는 비밀번호나 개인정보를 넣으면 안 되고, 사용자 ID나 권한처럼 "공개돼도 괜찮지만 위조되면 곤란한 것"만 넣는다.

### 세션 - 서버가 기억하는 쪽
```python
from starlette.middleware.sessions import SessionMiddleware

app = FastAPI()
app.add_middleware(SessionMiddleware, secret_key="your-secret-key")

class LoginForm(BaseModel):
    username: str
    password: str

@app.post("/login/")
def login(request: Request, form: LoginForm):
    if form.username == "john" and form.password == "1234":
        request.session["username"] = form.username     # 세션에 저장
        return {"message": "Successfully logged in"}
    raise HTTPException(status_code=401, detail="Invalid credentials")

@app.get("/dashboard/")
def dashboard(request: Request):
    username = request.session.get("username")          # 세션에서 꺼내기
    if not username:
        raise HTTPException(status_code=401, detail="Not authorized")
    return {"message": f"Welcome to the dashboard!!, {username}"}
```

`request.session`은 딕셔너리처럼 쓴다. 브라우저가 쿠키를 자동으로 들고 다니기 때문에 클라이언트는 아무것도 안 해도 로그인이 유지된다.

여기서 Starlette도 처음 소개됐다. "FastAPI는 Starlette이라는 강력한 엔진 위에 얹힌 세련된 디자인의 자동차"라는 비유였다. 라우팅, 쿠키, 세션 같은 웹 서버의 기본기는 Starlette이 하고, FastAPI는 그 위에 Pydantic 검증과 자동 문서, 의존성 주입을 얹은 것이다.

| | Basic | JWT | 세션 |
|---|---|---|---|
| 서버 저장 | 없음 | 없음 | 있음 |
| 강제 로그아웃 | | 어렵다 | 쉽다 |
| 서버 여러 대 | 문제없음 | 문제없음 | 세션 공유가 필요하다 |
| 쓰는 곳 | 내부 도구 | 모바일 앱, SPA | 전통적인 웹사이트 |

## 동기와 비동기 - def와 async def
지금까지 `def`와 `async def`를 별생각 없이 섞어 썼는데, 오늘 그 차이를 배웠다.

서버가 하는 일의 대부분은 계산이 아니라 기다림이다. DB 조회, 외부 API 호출, 파일 읽기를 기다리는 동안 CPU는 놀고 있다. 그 시간에 다른 요청을 처리할 수 있으면 같은 서버로 훨씬 많은 사람을 받을 수 있다. 그게 비동기의 전부라고 했다.

```python
import time, asyncio

@app.get("/sync")
def read_item():
    time.sleep(1)                     # 그냥 멈춰 있는다
    return {"type": "sync"}

@app.get("/async")
async def read_async_item():
    await asyncio.sleep(1)            # 기다리는 동안 자리를 비켜준다
    return {"type": "async"}
```

은행 창구로 비유했다. `time.sleep(1)`은 직원이 서류를 들고 1초 동안 멍하니 있는 것이고, `await asyncio.sleep(1)`은 "1초 뒤에 다시 부를게요" 하고 다음 손님을 받는 것이다. `await`가 "여기서 멈출 테니 그동안 다른 걸 하세요"라고 이벤트 루프에 알리는 표시다.

### def를 써도 서버가 멈추지는 않는다

| 함수 | 어디서 실행되나 | 다른 요청은 |
|---|---|---|
| `async def` | 이벤트 루프 (한 개) | `await` 자리에서 양보하면 처리된다 |
| `def` | 스레드풀 (여러 개) | 다른 스레드에서 처리된다 |

FastAPI는 `def`로 쓴 함수를 알아서 별도 스레드에서 돌린다. 그래서 `/sync`가 `time.sleep`으로 멈춰 있어도 다른 요청은 처리된다. 정말 위험한 건 이 조합이다.

```python
@app.get("/danger")
async def danger():
    time.sleep(5)      # async 인데 await 없는 sleep
```

`async def`는 스레드풀로 안 보내고 이벤트 루프에서 직접 실행하기 때문에, 여기서 `time.sleep(5)`를 하면 이벤트 루프 전체가 5초 멈추고 **모든 요청**이 밀린다. 그래서 규칙은 단순했다.

```
안에서 await 를 쓸 일이 있다          → async def
평범한 코드다 (requests, 동기 DB 등)  → def
애매하면                             → def
```

`requests`는 동기 라이브러리라서 `async def` 안에서 쓰면 `time.sleep`과 똑같이 이벤트 루프를 막는다. 비동기 쪽에는 `aiohttp`, `httpx`, `aiofiles`처럼 짝이 되는 라이브러리가 따로 있다.

### 측정 결과를 오해하지 않기
`020_test.py`로 두 엔드포인트에 요청을 10번씩 보내서 시간을 쟀다. 서버에서 5초씩 기다리게 하니 차이가 크게 벌어졌다.

```python
def sync_call(url, times):
    for _ in range(times):
        requests.get(url)               # 하나 끝나야 다음 것

async def async_call(url, times):
    async with aiohttp.ClientSession() as session:
        tasks = [session.get(url) for _ in range(times)]   # 아직 실행 안 함
        await asyncio.gather(*tasks)    # 10개를 한꺼번에 던지고 전부 끝날 때까지

sync_call("http://127.0.0.1:8000/sync", 10)                 # 약 50초
asyncio.run(async_call("http://127.0.0.1:8000/async", 10))  # 약 5초
```

결과만 보면 "async 서버가 빠르구나" 싶은데, 코드를 보면 두 가지가 동시에 바뀌었다. 서버 엔드포인트도 바뀌었지만 **클라이언트가 순차 요청에서 동시 요청으로 바뀌었다.** 시간 차이를 만든 건 클라이언트 쪽이다. `async_call`을 `/sync`로 향하게 해도 FastAPI가 `def` 엔드포인트를 스레드풀에서 병렬로 처리하기 때문에 비슷하게 빠르게 나온다고 했다. 서버 쪽 async의 차이는 동시 접속이 10개가 아니라 수천 개일 때 벌어진다.

`async def` 함수는 그냥 부르면 실행되지 않고 코루틴 객체만 만들어진다. `await`하거나 `asyncio.run()`에 넣어야 실제로 돈다. 위 코드에서 `session.get(url)`을 만들어두기만 하고 `gather`에서 한꺼번에 실행할 수 있는 이유다.

그리고 비동기는 코드를 빨리 실행하는 게 아니라 **기다리는 동안 다른 일을 하는 것**이다. 그래서 계산이 오래 걸리는 일(CPU 바운드)에는 도움이 안 되고, 기다림이 많은 일(I/O 바운드)에 쓴다.

## 헷갈리기 쉬운 부분
- 실습 파일의 JWT 코드에 `import datetime` 후 `datetime.now(...)`라고 쓴 줄이 있었는데, 그대로 실행하면 `AttributeError`가 난다. `import datetime`은 모듈을 가져온 것이라 `datetime.datetime.now(...)`처럼 한 단계 더 들어가야 한다. `from datetime import datetime, timezone, timedelta`로 가져오면 헷갈릴 일이 줄어든다.
- 토큰 검증을 `except:`로 통째로 잡으면 만료된 건지 위조된 건지 구분이 안 된다. 만료는 다시 로그인하면 되지만 위조는 공격일 수 있어서, `ExpiredSignatureError`와 `InvalidTokenError`를 나눠서 잡는다.
- 세션 실습의 로그인 함수가 `username: str, password: str`로 값을 받고 있었다. 단순 타입이라 쿼리 매개변수가 되어서, POST인데도 `POST /login/?password=1234`처럼 비밀번호가 주소에 실린다. 주소는 서버 로그와 브라우저 기록에 남으니 비밀번호는 Pydantic 모델로 바디에 받아야 한다. 위 코드는 그렇게 고친 모양이다.
- `SessionMiddleware`의 세션도 사실 서명된 쿠키에 담겨서 브라우저에 저장된다. 바꿀 수는 없지만 내용은 읽을 수 있어서 JWT처럼 민감한 정보는 넣지 않는다.
- `secret_key="your-secret-key"` 같은 예제 값을 코드에 그대로 두면, 그 키를 아는 사람은 아무 세션이나 토큰을 위조할 수 있다. 비밀키는 `.env`에 넣고 `os.getenv()`로 읽는다.
- 실제로 비밀번호를 저장할 때는 원문이 아니라 `bcrypt` 같은 해시값을 저장하고, 비밀번호나 토큰을 비교할 때는 `!=` 대신 `secrets.compare_digest()`를 쓴다고 한다.

## 오늘 배운 내용 정리
오늘은 스트리밍 응답과 인증, 동기와 비동기를 배웠다.

```
StreamingResponse: 첫 인자는 제너레이터(yield). 만들면서 조각조각 보낸다.
StringIO: 메모리 위의 가짜 파일. 매번 truncate(0) + seek(0) 으로 비운다.
다운로드: Content-Disposition: attachment; filename=... 이미 있는 파일은 FileResponse.
stateless: 서버는 로그인한 사람을 기억하지 못한다. 매 요청마다 증명이 필요하다.
Basic: 아이디:비밀번호를 Base64 로. Base64 는 암호화가 아니다.
JWT: header.payload.signature. 서버는 저장하지 않고 서명만 검증한다.
JWT 주의: exp 는 반드시. payload 는 누구나 읽으니 비밀번호 금지. 비밀키는 secrets + .env.
세션: SessionMiddleware + request.session. 강제 로그아웃이 쉽다.
async def: 이벤트 루프에서 실행. 안에서는 await 가 붙는 것만 쓴다.
def: FastAPI 가 스레드풀에서 실행. 애매하면 def.
비동기: 빠른 게 아니라 기다리는 동안 다른 일을 하는 것. I/O 바운드에 쓴다.
```

인증 세 가지를 비교해보니 결국 "누구냐"는 증거를 어디에 두느냐의 차이였다. Base64도, JWT의 payload도 암호화가 아니라는 점은 꼭 기억해둬야겠다.

비동기는 "빠른 것"으로 오해하기 쉬운데, 측정 결과의 차이가 클라이언트 쪽에서 나온 것이라는 설명 덕분에 "기다리는 동안 다른 일을 하는 것"이라는 정의가 확실히 남았다.

---
