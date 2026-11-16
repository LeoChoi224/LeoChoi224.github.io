---
layout: single
title: "MCP 기초 정리 4 - astream_events 스트리밍, 브라우저에서 스트림 받기, 배포 준비"
categories: [coding, MCP]
tag: [study-log, MCP, astream_events, StreamingResponse, fetch, TextDecoder, deploy, env]
toc: true
author_profile: false
sidebar:
    nav: "docs"
search: true
---
<hr/>

MCP 단원의 마지막 날이었다. 어제 서버의 `/chat`은 빈 문자열을 돌려주고, 브라우저의 `streamBotReponse()`는 내가 친 말을 그대로 찍는 상태로 양쪽에 구멍만 파두고 끝났다. 오늘은 그 구멍을 채웠다. 서버는 에이전트 안에서 벌어지는 일을 이벤트로 중계받아 글자가 만들어지는 대로 흘려보내고, 브라우저는 그걸 다 기다리지 않고 조각으로 읽어서 말풍선에 그렸다. 마지막에는 내 노트북 밖으로 내보내려고 코드에 박아둔 주소와 포트를 환경변수로 빼냈는데, 그러자 로컬에서는 안 보이던 문제가 드러났다.

## 에이전트 응답을 스트리밍으로 흘려보내기
`/chat`에 평범하게 `agent_executor.invoke(...)`를 넣으면 코드는 짧아지지만, "오늘 브리핑 해줘"라고 하면 흰 화면으로 20초 넘게 있다가 답이 한꺼번에 툭 뜬다. `brief_today`가 지시문 도구라서 에이전트가 날씨, 뉴스, KBO, 일정, 명언까지 도구를 다섯 번 부르기 때문이다. 그동안 사용자는 서버가 죽었는지 일하는 중인지 알 수 없다. ChatGPT의 글자가 또르르 나오는 건 디자인 취향이 아니라 "지금 일하는 중"이라는 신호이고, 첫 글자까지 걸리는 시간을 확 줄이는 장치다.

### astream_events - 에이전트 안을 중계한다

```python
async def stream_agent_response(agent_executor, message: str, session_id: str):
    if agent_executor is None:
        yield "에이전트가 아직 준비되지 않았습니다. 잠시 후 다시 시도해주세요."
        return

    ...   # session_id 로 config(thread_id) 와 input_message 를 준비
    try:
        async for event in agent_executor.astream_events(
            {"messages": [input_message]},
            config=config,
            version="v2",
        ):
            kind = event['event']
            if kind == "on_chat_model_stream":
                content = event['data']['chunk'].content
                if content:
                    yield content
            elif kind == "on_tool_start":
                print(f"Tool start: {event['name']}")
            ...
            else:
                print(event)
    except Exception as e:
        print(f"스트리밍 중 오류 발생: {e}")
        yield f"오류가 발생했습니다: {e}"
```

`.invoke()`가 "요리 다 되면 부를게요" 하고 주방 문을 닫는 거라면, `astream_events()`는 주방 벽을 유리로 바꾸는 것이다. 에이전트가 도는 동안 LLM이 토큰 한 조각을 만들 때마다, 도구가 시작하고 끝날 때마다, 노드가 바뀔 때마다 사건을 딕셔너리 하나씩으로 내보내는 비동기 반복자라 한 번 질문에 이벤트가 수백 개 나온다. `async for`라서 다음 이벤트를 기다리는 동안 서버는 다른 요청을 처리한다. `version="v2"`는 설치된 `langchain-core`에서 이미 기본값이지만, 라이브러리가 기본값을 바꿔도 코드가 안 흔들리게 명시해둔다. `thread_id`에 어제 브라우저가 만든 세션 ID를 실어 보내서 `InMemorySaver`가 그 대화의 기록을 찾는다.

이벤트는 택배 상자처럼 겉의 송장(`event['event']`)을 보고 열지 말지 정하고, 열면 안에 물건(`event['data']`)이 들어 있다. 그 밖에 `name`(누가 냈는지), `run_id`, `parent_ids`, `tags`, `metadata`가 있다.

| `event['event']` | 언제 나오나 | `data` 안에 든 것 |
|---|---|---|
| `on_chat_model_stream` | LLM이 토큰 한 조각 만들 때마다 | `data['chunk']` (`AIMessageChunk`) |
| `on_tool_start` | 도구 실행이 시작될 때 | `data['input']` (도구에 넘긴 인자) |
| `on_tool_end` | 도구 실행이 끝났을 때 | `data['output']` (도구가 돌려준 값) |

도구 이름은 `data`가 아니라 `event['name']`에 있다. `else`에서 이벤트를 통째로 찍는 건 `on_chain_start` 같은 다른 종류가 언제 오는지 눈으로 익히려는 학습용이다.

`if content:`가 조용히 지나가는 함정이었다. `on_chat_model_stream`인데도 `content`가 빈 청크가 섞여 온다. 모델이 도구를 부르기로 한 순간 만들어내는 건 사람이 읽을 글자가 아니라 `{"city_name": "서울"}` 같은 도구 호출 인자이고, 이건 `.content`가 아니라 `.tool_call_chunks`에 담기기 때문이다. 이 줄을 빼면 빈 문자열이 계속 `yield`돼서 브라우저가 0바이트 청크로 화면을 헛되이 다시 그린다. LangGraph에서 스트리밍할 때 `if chunk.content:`를 붙였던 것과 같은 이유다.

### 비동기 제네레이터와 StreamingResponse

```python
@app.post("/chat")
async def chat(request: Request, message: str = Form(...), session_id: str = Form(...)):
    agent_executor = request.app.state.agent_executor
    return StreamingResponse(
        stream_agent_response(agent_executor, message, session_id),
        media_type="text/event-stream",
    )
```

`return`은 "여기 다 됐어" 하고 함수를 끝내고, `yield`는 "일단 이거 받아, 나 여기 서 있을게" 하고 받은 쪽이 다음 걸 달라고 하면 멈춘 자리에서 이어서 실행된다. `async def` 안에 `yield`가 하나라도 있으면 호출해도 실행되지 않고 비동기 제네레이터 객체를 돌려준다. 그래서 이 함수 안의 `return`은 값을 돌려주는 게 아니라 스트림 끝 신호일 뿐이고, 돌려줄 것은 전부 `yield`로 보낸다.

`StreamingResponse`가 그 제네레이터를 하나씩 당겨서 HTTP 본문에 청크 단위로 밀어 넣는다. 보통 응답이 편지 한 통을 다 써서 보내는 거라면 스트리밍은 전화를 걸어놓고 생각나는 대로 말하는 것이다. 제네레이터 함수 자체가 아니라 호출한 결과를 넘겨야 하고, 에이전트는 어제 `lifespan`에서 `app.state`에 올려둔 것을 꺼내 쓴다.

에러가 났을 때 `raise`가 아니라 `yield`로 메시지를 보내는 이유는 이미 200 OK를 보낸 뒤이기 때문이다. `StreamingResponse`는 첫 청크를 내보내는 순간 헤더를 확정해서, 그다음에 에러가 나도 상태코드를 500으로 되돌릴 수 없다. 에러 메시지를 본문에 섞어 보내는 게 유일한 수단이다. 빨리 시작하는 대신 시작한 뒤에는 무를 수 없다는 게 스트리밍의 구조적 대가였다.

### 헷갈렸던 것들
`media_type="text/event-stream"` 옆에 SSE 방식이라고 주석까지 있는데, 실제로 흘려보내는 건 SSE 형식이 아니다. 진짜 SSE라면 `data: 안녕하세요\n\n`처럼 `data:` 접두어와 빈 줄로 감싸야 브라우저의 `EventSource`가 알아듣는데, 코드는 글자만 보낸다. 그래도 동작하는 건 브라우저가 `EventSource`가 아니라 `fetch`로 바이트를 날것 그대로 읽기 때문이다. 지금 `media_type`은 형식이라기보다 이름표인데, 그래도 중간의 프록시나 Nginx가 응답을 모아뒀다 한꺼번에 보내는 일을 덜 한다고 한다. 나중에 `EventSource`로 바꾸려면 서버에서 `f"data: {content}\n\n"`로 감싸는 게 먼저다.

`daily_quote` 도구 안의 LLM이 명언을 만드는 과정은 화면에 또르르 나오지 않았다. 그 LLM은 MCP 서버(8000번) 프로세스에 있고, 클라이언트(8001번)는 MCP로 결과만 받아오기 때문이다. `astream_events()`가 볼 수 있는 건 자기 프로세스 안의 에이전트뿐이다. 남의 집 주방은 유리벽을 세워도 안 보인다.

## 브라우저에서 스트림을 받아 그리기
서버가 조각조각 흘려보내기 시작해도 브라우저가 `botMessageElement.innerHTML = await response.text();`로 받으면 헛수고다. `response.text()`는 스트림이 다 끝날 때까지 기다렸다가 문자열 하나로 뭉쳐 돌려준다. 스트리밍은 양쪽이 다 스트리밍이어야 성립한다. 이 줄은 코드에 "확인용" 주석으로 남아 있었는데, 스트리밍이 안 될 때 먼저 이걸로 바꿔서 서버가 글자를 보내긴 하는지 확인하는 용도다. 화면에 한 번에 다 뜨면 서버는 멀쩡하고 프론트 읽기가 문제라는 뜻이다.

```javascript
async streamBotReponse(message, botMessageElement){
    try {
        const response = await fetch("/chat", {
            method: "POST",
            headers: {"Content-Type": "application/x-www-form-urlencoded"},
            body: new URLSearchParams({
                message: message,
                session_id: this.sessionId,
            }),
        });

        if(!response.ok){
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let content = "";
        while(true){
            const { value, done } = await reader.read();
            if (done) break;
            content += decoder.decode(value, { stream: true });
            botMessageElement.innerHTML = marked.parse(content);
            this.scrollToBottom();
        }
    } catch(error) {
        botMessageElement.innerHTML = "죄송합니다. 메시지 처리중 오류가 발생했습니다";
    }
},
```

### 폼 형식과 response.ok
서버가 `message: str = Form(...)`으로 받으니 폼 인코딩으로 보내야 하고, JSON으로 보내면 422 에러가 난다. 서버의 `Form(...)`, 헤더의 `application/x-www-form-urlencoded`, 본문의 `URLSearchParams` 셋이 한 짝으로 움직인다. 하나를 JSON으로 바꾸면 나머지 둘도 바꿔야 한다. FastAPI가 폼을 파싱하려면 `python-multipart`가 필요해서 `requirements.txt`에 들어 있었다.

`fetch`는 404든 500이든 예외를 던지지 않고 응답을 받아오는 데 성공하면 성공으로 쳐서, 상태코드를 `response.ok`로 직접 확인해야 한다. 다만 여기서 걸리는 건 시작부터 실패한 경우뿐이다. 서버가 200을 보내고 글자를 흘리다 중간에 터지면 `response.ok`는 이미 `true`라서, 서버가 에러를 본문에 섞어 보내는 것과 같은 이야기의 반대편이다.

### getReader와 TextDecoder
`response.body`는 `ReadableStream`이라는 수도관이고 `getReader()`는 그 끝의 손잡이다. `read()`를 부를 때마다 `{ value, done }`이 오는데, `value`는 문자열이 아니라 `Uint8Array` 바이트 배열이고 `done`이 `true`면 스트림 끝이다. `while(true)`는 무한 루프가 아니라 서버가 제네레이터를 끝내면 오는 `done`이 탈출구다. 한 번 `getReader()`를 부르면 스트림이 잠겨서 같은 응답에 `response.text()`를 또 부를 수 없다. 확인용 줄과 `getReader()` 줄 중 하나만 살아 있어야 하고, 둘 다 켜면 `TypeError: body stream already read`가 난다.

오늘 프론트에서 제일 중요한 한 줄은 `decoder.decode(value, { stream: true })`였다. 네트워크는 글자를 모르고 바이트만 아는데, 한글 한 글자는 UTF-8에서 3바이트다. 조각이 하필 한 글자 한가운데서 끊기면 각 조각을 따로 문자로 바꿀 때 `�`가 뜨고 그 글자는 영영 사라진다. `{ stream: true }`를 주면 디코더가 남는 바이트를 들고 있다가 다음 호출 때 앞에 붙여 해석한다. 그래서 디코더는 루프 밖에서 한 번만 만들어야 한다. 매번 새로 만들면 들고 있던 바이트도 같이 버려진다. 영어는 1바이트라 이 버그가 절대 안 나타나고 한글과 이모지에서만 터진다. 영어 예제를 따라 만들면 모르고 지나갔다가 물음표로 마주치게 된다.

그리고 원칙대로라면 루프를 빠져나온 뒤 `content += decoder.decode();`로 들고 있던 바이트를 한 번 비워줘야 하는데 이 줄이 없다. 서버가 `yield`하는 단위가 온전한 문자열이라 마지막이 글자 중간에서 끊길 일이 드물어서 티가 안 나지만, 답변 맨 끝 한 글자가 가끔 사라진다면 원인은 여기다.

### 누적본을 매번 다시 파싱한다
조각만 파싱해서 뒤에 붙이면 될 것 같은데 매번 처음부터 다시 파싱하는 건 마크다운이 끝까지 봐야 뜻이 정해지기 때문이다. "오늘은 **"이 먼저 오고 "맑음**"이 나중에 오면, 첫 조각만 파싱했을 때 `**`는 짝이 없는 별 두 개다. 여기서 HTML을 확정하면 둘째 조각이 와도 영영 굵어지지 않는다. 누적본을 매번 다시 파싱하면 처음엔 "오늘은 \*\*"로 보이다가 짝이 닿는 순간 "오늘은 **맑음**"으로 스스로 맞아 든다. `[뉴스](htt`까지는 글자로 보이다가 `)`가 닿으면 링크로 바뀌고, 어제 만든 새 탭 링크 렌더러도 그때 적용된다. 같은 이유로 `innerHTML`도 덧붙이지 않고 통째로 갈아 끼운다.

조각 수만큼 전체 파싱이 반복되니 O(n²)이지만 채팅 한 통 분량에서는 사람이 못 느낀다. 정확함을 사고 성능을 판 거래이고, 이 규모에서는 맞는 거래다.

### 주의할 것
- `catch`는 네트워크 끊김, 위에서 던진 HTTP 에러, 스트림 읽기 실패만 잡는다. 서버가 200으로 시작한 뒤 내부에서 터지면 그건 오류 메시지라는 정상 글자로 흘러들어와 말풍선에 찍힌다. 그리고 `catch`가 `innerHTML`을 통째로 덮어서 그때까지 받아둔 답변이 사과 문구로 바뀐다.
- `marked.parse()`의 결과를 `innerHTML`에 넣는다는 건 LLM이 만든 글자가 HTML로 해석된다는 뜻이다. `scrape_page_text`로 남의 웹페이지를 긁어온 내용이 답에 섞일 수 있는 구조라, 실무에서는 `DOMPurify`로 한 번 거른다. `marked` 자체는 살균을 해주지 않는다.
- `console.log(`value =`, value)`는 조각이 진짜 여러 번 나뉘어 오는지 보는 학습용이다. 개발자 도구에 `Uint8Array(37)` 같은 줄이 주르륵 찍히면 스트리밍이 되는 것이고, 한 줄만 찍히고 끝나면 한 번에 온 것이니 서버를 의심한다.

## 내 노트북 밖으로 내보내기
지금까지는 터미널 1에서 MCP 서버(8000), 터미널 2에서 채팅 서버(8001)를 띄우고 브라우저로 `127.0.0.1:8001`에 접속하는, 전부 내 노트북 안의 일이었다. 노트북을 닫으면 끝나고 남에게 보여줄 수도 없다. 그런데 인터넷에 올리려니 `url = "http://localhost:8000/mcp"`와 `port=8001` 두 군데가 발목을 잡았다. `localhost`는 "이 컴퓨터"라는 뜻이라, 배포된 클라이언트가 `localhost:8000`을 부르면 자기 자신 안에서 MCP 서버를 찾는데 거기엔 아무것도 없다. 오늘 바뀐 건 전부 같은 작업, 박아둔 값을 밖으로 빼는 것이었다.

```python
# chat_agent.py
# MCP_SERVER_URL 환경변수로 MCP 서버 주소를 설정합니다.
# - 로컬 개발: 지정하지 않으면 기본값(http://localhost:8000/mcp) 사용
# - Render 배포(production)된 엔드포인트 로 설정
mcp_server_url = os.getenv("MCP_SERVER_URL", "http://localhost:8000/mcp")
...
port = int(os.getenv("PORT", 8001))
uvicorn.run('chat_agent:app', host='0.0.0.0', port=port)

# mcp_server.py
host = os.environ.get("HOST", "0.0.0.0")
port = int(os.environ.get("PORT", 8000))
mcp.run(transport="streamable-http", host=host, port=port, path="/mcp")
```

### 환경변수와 기본값
`os.getenv("이름", 기본값)`은 여기 값은 밖에서 정해주고 안 주면 이걸로 하겠다고 써두는 것이다. 전기 제품을 붙박이로 박지 않고 플러그를 다는 것과 같다. 로컬에서는 아무것도 안 해도 기본값으로 굴러가고, 배포할 때만 대시보드에 운영 주소를 넣는다. 기본값을 로컬 주소로 두는 게 관례인데, 반대로 하면 환경변수를 깜빡했을 때 개발 중인 코드가 진짜 운영 서버를 건드리기 때문이다. 실수했을 때 덜 위험한 쪽을 기본값으로 둔다. 그래서 `.env`에 `MCP_SERVER_URL`이 없는 것도 빠뜨린 게 아니라 기본값에 기대고 있는 것이다. 값을 찾는 순서는 실제 환경변수, `.env`, 코드의 기본값이다.

`os.getenv`와 `os.environ.get`은 완전히 같고, `getenv`가 `environ.get`을 부르는 얇은 껍데기다. 반면 `os.environ["X"]`는 없으면 바로 에러라서 반드시 있어야 하는 값에 일부러 쓴다. 그리고 환경변수는 무슨 값이든 문자열로 오니까 포트는 `int()`로 감싸야 한다.

### 포트는 배포지가 정한다
내 노트북에서는 내가 집주인이라 8001호를 쓰겠다고 정할 수 있지만, 배포지에서는 세입자라 관리실이 정해준 방으로 가야 한다. Render 같은 PaaS는 서버 한 대에서 앱을 여러 개 굴려서, 플랫폼이 빈 포트를 골라 `PORT` 환경변수로 넣어주고 앱은 그 포트에 붙어야 바깥 요청이 닿는다. 배포되면 주소가 `https://...`가 되고 포트는 443으로 숨어서, 8000과 8001은 내 노트북에서 두 프로세스가 안 부딪히게 정한 번호일 뿐이다.

`127.0.0.1`은 같은 컴퓨터 안에서 건 전화만 받는 집 안 인터폰이고, `0.0.0.0`은 어느 회선이든 다 받겠다는 뜻이다. 배포되면 요청이 컨테이너 바깥에서 들어오니 `127.0.0.1`로 묶어두면 앱은 멀쩡히 도는데 접속만 안 되는 고약한 상태가 된다. 그래서 배포용 코드는 `0.0.0.0`이고, 로컬에서도 `0.0.0.0`으로 띄우고 `127.0.0.1:8001`로 접속하면 된다.

### .gitignore에 .env
두 프로젝트의 `.gitignore`는 `.env` 한 줄뿐이었다. `.env`에는 `OPENAI_API_KEY`가 들어 있어서 깃허브 공개 저장소에 올라가면 그 순간 키가 공개된다. 공개 저장소를 훑으며 키를 수집하는 봇이 있어서 올라간 지 몇 분 만에 남의 요금으로 API가 돌아가는 일이 실제로 일어난다고 한다. 그래서 배포지에는 키를 파일이 아니라 대시보드로 넣는다.

| Key | Value | 비고 |
| --- | --- | --- |
| `OPENAI_API_KEY` | `sk-...` | OpenAI API 키 |
| `MCP_SERVER_URL` | `https://******.fastmcp.app/***` | 운영 MCP 서버 주소 |

`PORT`가 표에 없는 건 Render가 알아서 넣어주기 때문이다. 한 번 커밋된 키는 나중에 `.gitignore`를 추가하거나 파일을 지워도 깃 기록에 남아 있다. 키가 올라갔으면 파일을 지울 게 아니라 키를 폐기하고 새로 발급받아야 한다. `.gitignore`는 첫 커밋 전에 만들어두는 게 전부다. `.env`에는 예전 실습에서 통째로 복사해 온 안 쓰는 키들도 있었는데, 동작에는 지장 없지만 배포할 때는 필요한 것만 대시보드에 넣는다. 폴더마다 있는 크기 0짜리 `Icon` 파일과 `.DS_Store`도 드롭박스와 맥이 만드는 거라 `.gitignore`에 넣어두는 게 좋다.

### 서비스가 둘이라 배포도 둘
MCP 서버는 fastmcp.app 같은 MCP 전용 호스팅에, 채팅 클라이언트는 Render Web Service에 따로 배포하고, 클라이언트가 `MCP_SERVER_URL`로 서버를 찾아간다는 점만 연결돼 있다. 도구만 고쳤을 때 도구 쪽만 재배포하면 되고, 도구가 쓰는 키와 에이전트가 쓰는 키를 나눌 수 있고, 다른 사람의 에이전트도 내 MCP 서버에 붙을 수 있다. 어제 MCP로 도구를 분리하는 이유로 배운 그대로였다.

```
Build Command : pip install -r requirements.txt
Start Command : python chat_agent.py
```

Render 설정은 이 두 줄뿐이다. `python chat_agent.py`로 시작할 수 있는 건 파일 맨 아래 `if __name__ == "__main__":` 블록이 `uvicorn.run()`을 부르기 때문이고, 없으면 `uvicorn chat_agent:app --host 0.0.0.0 --port $PORT`를 직접 써야 한다.

### 배포하면 대화 기록이 사라진다
오늘 배포 이야기에서 가장 중요한 지점이었다. `InMemorySaver`는 이름 그대로 메모리에 저장해서 프로세스가 죽으면 같이 사라진다. 로컬에서는 내가 껐다 켜니 당연하게 느껴지는데, 배포지에서는 새 버전을 배포하거나 서버가 알아서 재시작할 때마다 모든 대화 기록이 증발한다. 인스턴스를 두 개로 늘리면 요청이 A로 갔다 B로 갔다 해서 같은 세션인데 기억이 갈린다. 게다가 세션 ID는 새로고침마다 새로 발급되니 지금 구조에서 대화는 브라우저 탭 하나의 수명만큼만 산다. 제대로 하려면 `langgraph-checkpoint-postgres`처럼 바깥 저장소에 기록을 남기는 체크포인터로 바꿔야 한다. `InMemorySaver`는 배우기용이다.

## 헷갈리기 쉬운 부분
- `.invoke()`는 다 끝나면 한 번에, `astream_events()`는 되는 대로 계속 준다. 쓰는 이벤트는 `on_chat_model_stream`, `on_tool_start`, `on_tool_end`이고 도구 이름은 `event['name']`에 있다.
- 도구를 부를 때 `chunk.content`는 빈 문자열로 온다. `if content:`로 거른다.
- `async def` 안에 `yield`가 있으면 비동기 제네레이터가 되고, 그 안의 `return`은 스트림 끝 신호일 뿐이다.
- `StreamingResponse`에는 제네레이터를 호출한 결과를 넘긴다. 첫 청크가 나가면 상태코드는 확정돼서 중간 에러는 본문에 실어 보낸다.
- `text/event-stream`이라고 써도 `data:`로 감싸지 않으면 SSE가 아니다.
- 다른 프로세스(MCP 서버) 안의 LLM 토큰은 `astream_events()`로 안 보인다.
- `response.text()`를 부르는 순간 스트리밍은 끝난다. `response.body.getReader()`로 직접 읽는다.
- 서버 `Form(...)`, 헤더 `application/x-www-form-urlencoded`, 본문 `URLSearchParams`는 한 짝이다.
- `fetch`는 HTTP 에러에 예외를 안 던진다. `response.ok`로 확인한다.
- `TextDecoder`는 루프 밖에서 만들고 `{ stream: true }`를 준다. 한글 한 글자는 3바이트라 조각 경계에서 잘린다.
- 마크다운은 조각이 아니라 누적본을 매번 다시 파싱하고 `innerHTML`을 통째로 바꾼다.
- 배포의 8할은 주소, 포트, 키처럼 환경마다 달라지는 값을 환경변수로 빼는 일이다. 기본값은 로컬 쪽, 숫자는 `int()`, 바인딩은 `0.0.0.0`이다.
- `.env`는 첫 커밋 전에 `.gitignore`에 넣고, 올라간 키는 폐기하고 새로 발급한다.
- `InMemorySaver`는 재시작 한 번에 대화가 사라지고 인스턴스가 둘이면 기억이 갈린다.

## 오늘 배운 내용 정리
오늘은 에이전트 응답을 서버에서 스트리밍으로 흘려보내고, 브라우저에서 그걸 조각으로 받아 그리고, 배포를 위해 박아둔 값을 환경변수로 빼냈다.

```
서버: async for event in agent.astream_events({"messages": [msg]}, config, version="v2")
      → on_chat_model_stream → chunk.content → if content: yield. 도구 이벤트는 print.
      StreamingResponse(제네레이터(), media_type="text/event-stream"). 중간 에러는 yield로 본문에.
브라우저: fetch("/chat", form + URLSearchParams) → response.ok → response.body.getReader()
         → TextDecoder(루프 밖) + decode(value, {stream: true}) → content 누적 → marked.parse(content) 통째 교체.
배포: MCP_SERVER_URL / PORT / HOST를 os.getenv(이름, 로컬 기본값)로. int(PORT). host 0.0.0.0.
      .gitignore에 .env. MCP 서버(fastmcp.app)와 채팅 클라이언트(Render) 따로 배포.
      InMemorySaver는 배포하면 재시작마다 기록 증발 → 바깥 저장소 체크포인터로.
```

어제 양쪽에 파둔 구멍이 오늘 채워지면서 브리핑이 20초 동안 흰 화면으로 있다가 한꺼번에 뜨던 게 글자가 또르르 흘러나오는 화면으로 바뀌었다. 서버의 `yield`와 브라우저의 `reader.read()`가 짝을 이뤄야 스트리밍이 된다는 걸 직접 맞춰보니, 한쪽만 스트리밍이면 아무 소용이 없다는 게 확실히 와닿았다. 가장 기억에 남은 건 `{ stream: true }` 한 줄이 한글 한 글자가 3바이트라서 필요하다는 부분과, 배포 이야기 끝에 `InMemorySaver`가 다시 등장한 부분이다. LangGraph 첫날 "개발할 때는 메모리, 배포할 때는 Postgres"라고 지나가듯 들었던 말이 2주 만에 실제 문제로 돌아왔다.

---
