---
layout: single
title: "LangChain 기초 정리 6 - 서버 디버깅과 Agent 스트리밍 (FastAPI + React)"
categories: [coding, LangChain]
tag: [study-log, LangChain, FastAPI, React, SSE, astream_events, debugging, VSCode, CORS]
toc: true
author_profile: false
sidebar:
    nav: "docs"
search: true
---
<hr/>

오늘은 두 가지를 했다. 오전에는 `print()` 대신 VS Code 디버거로 **실행 중인 FastAPI 서버를 멈춰 세우고** 변수를 들여다보는 법을 배웠다. 오후에는 지난번에 만든 InvestorGPT 에이전트를 **FastAPI 서버 뒤에 두고**, 에이전트가 만들어내는 글자와 도구 호출 상황을 **SSE로 흘려보내** React 화면에 실시간으로 찍었다.

## 서버 디버깅 - print의 한계
지금까지 값을 확인하는 방법은 `print(f"name={name}, age={age}")` 하나였다. 작은 코드에서는 충분한데 서버가 커지면 금방 막힌다.

```
값을 하나 더 보고 싶으면 코드를 고치고 서버를 다시 켜야 한다.
찍고 나면 지워야 한다. 안 지우면 운영 로그에 섞여 나온다.
"여기까지 왔나?"는 알아도 "여기서 무슨 일이 일어나는지"는 못 본다.
"age 가 100 보다 클 때만" 같은 조건부 확인이 어렵다.
```

디버거는 코드를 한 글자도 안 고치고, 원하는 줄에 중단점만 찍으면 이걸 전부 해결해준다.

실습 코드는 일부러 값이 바뀌는 줄을 두 개 넣어둔 단순한 엔드포인트였다.

```python
@app.get("/")
def read_users(
    name: str = Query(default=None, max_length=50),
    age: int = Query(default=1)
):
    age += 2                    # ← 여기에 중단점
    name = f"[{name}]"
    return {"name": name, "age": age}
```

`age += 2` 줄에 중단점을 걸면 바뀌기 전 값이 보이고, 한 줄 넘기면 바뀐 값이 보인다. 그 변화를 눈으로 확인하는 게 목표였다.

### launch.json - 디버거에게 실행 방법 알려주기
VS Code는 파이썬 파일을 그냥 실행할 줄만 아는데, 서버는 `python main.py`가 아니라 `uvicorn main:app`으로 켠다. 이 차이를 알려주는 설정 파일이 `.vscode/launch.json`이다.

```json
{
  "name": "FastAPI (uvicorn)",
  "type": "debugpy",
  "request": "launch",
  "module": "uvicorn",
  "args": ["main:app", "--host", "0.0.0.0", "--port", "8000"],
  "justMyCode": true,
  "cwd": "${workspaceFolder}",
  "env": { "PYTHONPATH": "${workspaceFolder}" },
  "console": "integratedTerminal"
}
```

`"module": "uvicorn"`은 터미널에서 `python -m uvicorn main:app --host 0.0.0.0 --port 8000`을 치는 것과 같고, `args`가 그 뒤에 붙는 조각들이다. 수업 파일에는 `"program": "server.py"`처럼 파일을 직접 실행하는 방식도 있었다.

| | `program` 방식 | `module` 방식 |
|---|---|---|
| 대응하는 명령 | `python server.py` | `python -m uvicorn ...` |
| 파일에 필요한 것 | `if __name__ == "__main__":` 안에서 `uvicorn.run(...)` | 없어도 된다 |
| 포트를 바꾸려면 | 파이썬 코드를 고친다 | `args` 만 고친다 |

| 옵션 | 뜻 |
|---|---|
| `"request": "launch"` | 디버거가 새로 띄운다 (`attach` 는 이미 도는 프로세스에 붙는다) |
| `"justMyCode": true` | 내 코드에서만 멈춘다. 끄면 FastAPI 내부까지 들어간다 |
| `"cwd"`, `"env"` | 작업 폴더와 import 경로를 지금 열어둔 폴더로 맞춘다 |
| `"console": "integratedTerminal"` | VS Code 아래 터미널에 출력한다 |

`${workspaceFolder}`는 VS Code가 지금 열어둔 폴더의 절대 경로로 바꿔주는 변수라, 사람마다 다른 경로를 코드에 박지 않아도 된다.

`.vscode/settings.json`에는 이 프로젝트에서 쓸 파이썬(가상환경의 파이썬)을 지정했다. `pip install fastapi`는 `.venv`에 설치됐는데 VS Code가 다른 파이썬으로 실행하면 `ModuleNotFoundError: No module named 'fastapi'`가 난다. 초보자가 가장 자주 만나는 에러이고 원인은 거의 항상 이것이라고 했다.

### 실제로 디버깅하는 순서
```
1. age += 2 줄의 왼쪽 여백을 클릭해서 빨간 점(중단점)을 찍는다.
2. F5 로 "FastAPI (uvicorn)" 구성을 실행한다.
3. 브라우저에서 http://localhost:8000/?name=홍길동&age=20 을 연다.
4. 브라우저가 계속 로딩 중이다. 정상이다.
5. VS Code 변수 창에 name='홍길동', age=20 이 보인다.
6. F10(스텝 오버)으로 한 줄 넘기면 age 가 22 로 바뀌는 게 보인다.
7. F5(계속)를 누르면 나머지가 실행되고 브라우저에 결과가 뜬다.
```

중단점에 걸린 동안 서버가 그 요청을 붙잡고 있어서 브라우저 로딩이 안 끝나는 건 고장이 아니다. F11(스텝 인투)은 함수 안으로 들어가고, 호출 스택은 지금 이 함수가 누구에게 불려서 왔는지를 보여준다. 중단점을 우클릭하면 `age > 100` 같은 조건도 걸 수 있다.

- **디버깅할 때는 `--reload`를 끈다.** reload는 uvicorn이 자식 프로세스를 따로 띄워서 실제 서버를 돌리는데, 디버거는 부모 프로세스에 붙어서 중단점이 조용히 무시된다. 평소 개발할 때는 켜고, 디버깅할 때만 끈다.
- 터미널에서 uvicorn을 켜둔 채로 디버거를 시작하면 `Address already in use`가 난다. 8000번 포트는 하나만 쓸 수 있다.
- `127.0.0.1`은 이 컴퓨터에서만 접속되고, `0.0.0.0`은 같은 와이파이의 다른 기기에서도 접속된다.
- `launch.json`은 팀원이 같은 방식으로 디버깅할 수 있게 커밋하지만, `settings.json`에는 내 컴퓨터에만 있는 절대 경로가 들어 있어서 커밋하면 곤란하다. 지난번에 배운 `.gitignore`의 `!`로 `.vscode/*`는 무시하고 `launch.json`만 예외로 포함할 수 있다.

디버거는 내가 지켜보고 있을 때만 쓸 수 있어서, 새벽에 난 에러는 못 잡는다. 그래서 실무에서는 개발 중에는 디버거, 운영 중에는 `logging` 모듈로 남기는 로그를 같이 쓴다고 했다.

## Agent 스트리밍 - 30초 침묵을 깨기
지난번 InvestorGPT는 Streamlit에서 결과를 `st.write`로 한 번에 그렸다. 문제는 에이전트가 느리다는 것이다. 회사 이름 하나에 도구를 3~5번 부르고 그때마다 웹 검색과 API 호출이 들어가서, 30초쯤 아무 말이 없다가 긴 글이 갑자기 나타난다. 사용자는 멈춘 줄 알고 새로고침을 누른다.

게다가 에이전트는 글자만 만드는 게 아니라 도구도 부른다. "StockMarketSymbolSearchTool 도구를 사용 중입니다..." 같은 상황까지 보여줘야 기다릴 마음이 생긴다. 그래서 글자(토큰)만 흘리는 게 아니라 **이벤트**를 흘려야 했다.

### 에이전트에서 결과를 꺼내는 방법
먼저 `test1.py`에서 도구 없는 빈 에이전트로 방법들을 비교해봤다.

| 메서드 | 무엇을 주나 | 언제 쓰나 |
|---|---|---|
| `invoke()` | 최종 결과만 (동기) | 노트북 실험 |
| `ainvoke()` | 위의 비동기 버전 | FastAPI `async` 라우터 |
| `stream(stream_mode=...)` | 스텝 단위 | 터미널에서 진행 상황 보기 |
| `astream_events(version="v2")` | 안에서 벌어지는 모든 이벤트 | 오늘 쓸 것 |

`stream_mode="messages"`는 "글자만 흘려줘"이고, `astream_events`는 "안에서 벌어지는 일 전부 알려줘"다. 도구가 언제 시작하고 끝나는지 알아야 해서 `astream_events`를 골랐다.

```python
async def run_astream():
    async for event in agent.astream_events(inputs, version="v2"):
        if event.get("event") == "on_chat_model_stream":
            content = event["data"]["chunk"].content
            if content:
                print(content, end="", flush=True)

asyncio.run(run_astream())
```

이벤트는 딕셔너리이고 `event["event"]` 문자열 하나로 종류를 구분한다. 쓸 건 셋뿐이었다.

| 이벤트 이름 | 언제 |
|---|---|
| `on_chat_model_stream` | LLM 이 토큰을 하나 만들 때마다 |
| `on_tool_start` | 도구를 부르기 시작할 때 |
| `on_tool_end` | 도구가 끝났을 때 |

`print(..., end="", flush=True)`에서 `end=""`는 줄바꿈을 안 넣는 것이고, `flush=True`는 버퍼에 모으지 말고 바로 화면에 뿌리라는 뜻이다. 이게 없으면 파이썬이 출력을 모았다가 한 번에 내보내서 스트리밍처럼 안 보인다. 그리고 `async def` 함수는 부르기만 해서는 실행되지 않아서 `asyncio.run()`이 필요한데, FastAPI 안에서는 이미 이벤트 루프가 돌고 있어서 쓰지 않는다.

### SSE - 스트리밍을 위한 단순한 텍스트 규약
SSE(Server-Sent Events)는 서버가 브라우저에게 조금씩 나눠서 계속 보내는 방법인데, 놀랄 만큼 단순했다.

```
event: token
data: {"content": "안녕"}

event: token
data: {"content": "하세요"}

event: done
data: {}

```

`event:`로 시작하는 줄이 이벤트 이름, `data:`로 시작하는 줄이 내용이고, 빈 줄(`\n\n`)이 메시지 하나의 끝이다.

```python
def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"
```

`ensure_ascii=False`가 없으면 한글이 `안` 같은 유니코드 이스케이프로 나가서 전송량이 불어난다. LLM 응답은 서버가 일방적으로 보내는 것이라 양방향인 WebSocket이 필요 없고, ChatGPT 웹도 SSE를 쓴다고 한다.

### FastAPI 쪽
```python
app = FastAPI(title="LangChain Agent Streaming API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class CompanyAnalysisRequest(BaseModel):
    company_name: str = Field(..., min_length=1, description="분석할 회사명. 예: Apple, Tesla")

@app.post("/api/analyze")
async def analyze_company(payload: CompanyAnalysisRequest, request: Request):
    return StreamingResponse(
        stream_company_analysis(payload.company_name, request),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
```

- `StreamingResponse`의 첫 인자로 비동기 제너레이터를 넘기면, FastAPI가 `yield`되는 대로 바로 클라이언트에 보낸다. FastAPI 시간에 CSV를 조각내서 보낼 때 쓴 그 방식이다.
- React 개발 서버는 5173번, FastAPI는 8000번 포트라 브라우저는 다른 사이트로 보고 요청을 막는다(CORS). 서버가 "5173에서 오는 건 괜찮다"고 `allow_origins`로 알려줘야 통과한다. 막는 건 서버가 아니라 브라우저라서, 서버 로그에는 200이 찍히는데 프런트에서는 에러가 나는 헷갈리는 상황이 생긴다.
- `allow_origins=["*"]`로 다 열어두면서 `allow_credentials=True`를 켜면 브라우저가 거부한다. 수업 코드처럼 주소를 명시하는 게 맞다.
- `X-Accel-Buffering: no`는 nginx 같은 프록시가 응답을 모았다가 한 번에 보내는 걸 막는다. 이게 없으면 애써 만든 스트리밍이 끝에서 다시 한 덩어리가 된다.

### 이벤트를 SSE로 번역하기
```python
async def stream_company_analysis(company_name: str, request: Request) -> AsyncGenerator[str, None]:
    user_message = f"{company_name} 회사를 분석해줘. 투자할만한 가치가 있는지 평가해줘."
    try:
        async for event in agent.astream_events(
            {"messages": [{"role": "user", "content": user_message}]}, version="v2"
        ):
            if await request.is_disconnected():      # 사용자가 나갔으면 멈춘다
                break

            kind = event.get("event")
            if kind == "on_chat_model_stream":
                text = _extract_text(event["data"]["chunk"].content)
                if text:
                    yield _sse("token", {"content": text})
            elif kind == "on_tool_start":
                yield _sse("tool_start", {"tool": event.get("name")})
            elif kind == "on_tool_end":
                yield _sse("tool_end", {"tool": event.get("name")})
        else:
            yield _sse("done", {})        # break 없이 끝까지 돌았을 때만
            return

        yield _sse("cancelled", {})       # break 로 빠져나왔을 때

    except Exception as e:
        yield _sse("error", {"message": str(e)})
```

- 사용자가 탭을 닫아도 에이전트는 계속 돌면서 도구를 부르고 토큰 요금을 쓴다. 그래서 이벤트가 올 때마다 `request.is_disconnected()`로 연결을 확인하고, 끊겼으면 `break`로 빠져나온다.
- `for ... else`의 `else`는 "`break` 없이 끝까지 돌았으면"이라는 뜻이다. 이 덕분에 정상 종료(`done`)와 취소(`cancelled`)를 플래그 변수 없이 나눴다. `if/else`의 `else`와 헷갈리기 쉬운 문법이었다.
- `chunk.content`는 보통 문자열이지만 상황에 따라 리스트나 `None`일 수 있어서, `_extract_text()`로 모르는 모양은 빈 문자열로 넘기게 방어했다. 초당 수십 번 도는 스트리밍 코드에서 예외가 나면 스트림 전체가 죽기 때문이다.

에이전트(`Tools.py`)는 지난번 것을 그대로 가져왔는데, 시스템 프롬프트를 매번 넣지 않고 `create_agent(..., system_prompt=...)`로 고정했고 마지막에 `Answer in Korean, and format your answer in Markdown.`을 추가했다. React 쪽에서 `react-markdown`으로 렌더링하기 때문에, 프롬프트 한 줄과 프런트 라이브러리가 짝을 이룬다.

### React 쪽 - 조각 맞추기
네트워크는 서버가 보낸 메시지를 경계에 맞춰 보내주지 않고 아무 데서나 잘라서 보낸다.

```
1번째 조각: "event: token\ndata: {\"cont"
2번째 조각: "ent\": \"안녕\"}\n\nevent: token\ndata: ..."
```

그래서 미완성 조각을 남겨뒀다가 다음 조각과 이어 붙여야 한다.

```js
const parseSseBuffer = (buffer) => {
  const messages = buffer.split("\n\n");
  const leftover = messages.pop() ?? "";     // 마지막은 아직 미완성일 수 있다

  const events = [];
  for (const raw of messages) {
    if (!raw.trim()) continue;
    let eventType = "message";
    let dataStr = "";
    for (const line of raw.split("\n")) {
      if (line.startsWith("event:")) eventType = line.slice(6).trim();
      else if (line.startsWith("data:")) dataStr += line.slice(5).trim();
    }
    events.push({ event: eventType, data: dataStr });
  }
  return { events, leftover };
};
```

`\n\n`으로 자른 조각 중 마지막 것은 항상 의심해서 남겨둔다는 게 핵심이었다.

axios는 내부적으로 XHR을 쓰는데, XHR에는 "새로 온 조각만 달라"는 기능이 없고 `xhr.responseText`가 지금까지 받은 전체 텍스트를 들고 있다. 그래서 지난번까지 읽은 길이를 기억해뒀다가 그만큼 잘라내고 나머지만 새 조각으로 썼다.

```js
onDownloadProgress: (progressEvent) => {
  const xhr = progressEvent.event?.target;
  if (!xhr) return;
  const fullText = xhr.responseText || "";
  const newChunk = fullText.slice(readLengthRef.current);   // 새로 늘어난 부분만
  readLengthRef.current = fullText.length;
  if (newChunk) handleSseChunk(newChunk);
}
```

- 미완성 텍스트, 읽은 길이, 취소 컨트롤러는 `useRef`에 담았다. 값이 바뀌어도 화면을 다시 그릴 필요가 없고, `useState`와 달리 즉시 반영돼서 연달아 오는 조각을 누적하는 데 맞다. 화면에 보여야 하는 결과 텍스트, 로딩 상태, 도구 상태 문구는 `useState`다.
- 토큰이 오면 `setContent((prev) => prev + payload.content)`처럼 함수형으로 갱신한다. 토큰이 아주 빠르게 연달아 오는데 `setContent(content + text)`로 쓰면 옛 `content`를 붙잡아서 글자가 사라진다.
- 취소 버튼은 `AbortController`의 `abort()`를 부른다. 브라우저가 연결을 끊으면 서버의 `is_disconnected()`가 `True`가 되고, 루프를 빠져나와 에이전트가 멈춘다. 프런트의 버튼 하나가 서버의 API 요금을 멈추는 구조다.
- `content`가 바뀔 때마다 `useEffect`로 스크롤을 맨 아래로 내려서 글이 화면 밖으로 자라지 않게 했다.

## 헷갈리기 쉬운 부분
- 내 실습 파일의 `controllers.py`는 그대로는 돌지 않는 상태로 남아 있었다. `astream_events`를 `astream_event`로 쳤고, 예외 처리에서 `_sse`를 `_see`로 쳤고, `{"content": text}`를 `{"content", text}`로 쳤다. 위 코드는 고친 모양이다.
- 특히 `{"content", text}`는 콜론이 아니라 쉼표라서 딕셔너리가 아니라 **집합**이다. 문법 에러가 안 나서 눈으로 잘 안 보이는데, `json.dumps()`가 집합을 처리하지 못해 에러가 나고 그게 `except`에 잡혀서 엉뚱한 에러 이벤트로 조용히 넘어간다. FastAPI 첫 시간에 본 `return {"skip", "limit"}`과 같은 실수다.
- 예외 처리 블록 안의 오타(`_see`)는 평소에 실행되지 않아서 놓치기 쉽다. 정상 경로는 매번 테스트되지만 예외 경로는 거의 안 돌아보기 때문에, 일부러 에러를 내보는 테스트가 필요하다고 했다.
- 프런트는 `tool_end`, `done`, `cancelled` 이벤트를 받지만 따로 쓰지 않아서, 도구가 끝나도 "도구 사용 중" 문구가 첫 토큰이 올 때까지 남아 있다.
- 배포하면 nginx나 CloudFront 같은 중간 프록시가 응답을 모아서 보내는 경우가 많아서, "로컬에서는 스트리밍이 되는데 배포하면 한 번에 나온다"는 문제가 생긴다고 한다. 그리고 에이전트가 1분을 넘기면 프록시의 기본 타임아웃에 걸릴 수 있어서, 주기적으로 빈 줄을 보내 연결을 살려두는 방법도 있다고 했다.

## 오늘 배운 내용 정리
오늘은 서버 디버깅과 에이전트 스트리밍을 배웠다.

```
디버거: 중단점에서 멈추고 변수를 본다. F10 스텝 오버, F11 스텝 인투, F5 계속.
launch.json: "module": "uvicorn" + args ["main:app", ...]. 서버 디버깅의 표준.
--reload 는 끈다: 자식 프로세스에서 돌아서 중단점이 무시된다.
ModuleNotFoundError: 패키지가 없는 게 아니라 다른 파이썬으로 도는 경우가 대부분.
astream_events(version="v2"): 토큰(on_chat_model_stream)과 도구(on_tool_start/end) 이벤트.
SSE: "event: 이름\ndata: JSON\n\n". StreamingResponse + text/event-stream.
CORS: 포트가 다르면 브라우저가 막는다. allow_origins 에 프런트 주소를 적는다.
끊김 처리: 서버는 request.is_disconnected(), 브라우저는 AbortController.
for ... else: break 없이 끝나면 else. done 과 cancelled 를 깔끔하게 나눈다.
React: \n\n 으로 자르고 마지막 조각은 남겨둔다. 누적은 useRef, 화면은 useState.
```

LangChain 단원을 마무리하면서 지금까지 배운 FastAPI, React, LangChain이 하나의 화면으로 이어졌다. 사용자가 취소 버튼을 누르면 브라우저 → FastAPI → 에이전트 순서로 신호가 전달돼서 API 요금까지 멈춘다는 흐름이 가장 크게 남았다.

---
