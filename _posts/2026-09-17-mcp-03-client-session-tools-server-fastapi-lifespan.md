---
layout: single
title: "MCP 기초 정리 3 - MCP 클라이언트, 도구 7개 MCP 서버, FastAPI lifespan, 채팅 화면과 세션 ID"
categories: [coding, MCP]
tag: [study-log, MCP, ClientSession, langchain-mcp-adapters, FastAPI, lifespan, create_agent, JavaScript]
toc: true
author_profile: false
sidebar:
    nav: "docs"
search: true
---
<hr/>

어제까지는 도구를 내놓는 쪽인 서버를 만들었고, 그 서버에 접속해서 도구를 꺼내 쓰는 일은 클로드 데스크탑이나 인스펙터가 대신 해줬다. 오늘은 그 자리에 내 파이썬 코드를 넣었다. 클라이언트 코드를 직접 짜서 MCP 도구를 LangChain 도구로 번역하고, 도구 7개를 모은 MCP 서버를 만들고, FastAPI 채팅 서버가 그 서버에 붙어서 에이전트를 돌리게 했다. 마지막에는 브라우저 채팅 화면과 세션 ID를 만들어서, 다음 시간에 스트리밍을 넣을 자리를 파뒀다.

클로드 데스크탑이 MCP 서버를 이미 잘 쓰는데 왜 클라이언트를 직접 짜냐면, 내 서비스에 붙이려면 그 자리를 내가 채워야 하기 때문이다. 오늘 최종 목표인 브라우저 채팅 화면의 사용자는 클로드 데스크탑을 깔 이유가 없으니, 서버 접속부터 도구 목록 받기, LLM에게 넘기기, 호출 결과 받기까지 전부 내 코드가 해야 한다.

## MCP 클라이언트 선행학습
이 과정이 전부 비동기라서 MCP 클라이언트 코드를 열면 `async with`가 두세 겹 겹쳐 나온다. 그래서 선행학습 파일 세 개부터 봤다.

### @asynccontextmanager - 뒷정리를 미리 예약하기

```python
@asynccontextmanager
async def my_resource():
    print('1. 진입:리소스 준비')
    yield "2. 리소스"
    print('3. 종료:리소스 정리')   # with 블럭 끝난뒤 실행

async def test():
    async with my_resource() as r:
        print('4. with 시작 --------')
        print(r)
        print('5. with 종료---------')

asyncio.run(test())
```

```
1. 진입:리소스 준비
4. with 시작 --------
2. 리소스
5. with 종료---------
3. 종료:리소스 정리
```

회의실을 빌려서 문 열고, 쓰고, 나올 때 불 끄고 문 잠그는 것과 같다. `with`는 나올 때 할 일을 미리 적어두는 문법이고, 중간에 오류가 나도 정리는 반드시 실행된다. `yield` 한 줄이 경계선이라 위가 진입할 때, 아래가 빠져나올 때 실행되고, `yield`가 내보낸 값이 `as r`에 담긴다. 수업 파일 끝에 "화면에 찍히는 순서?"라는 질문이 있었는데, 번호는 소스에 적힌 순서일 뿐이고 실제 순서는 1, 4, 2, 5, 3이다. `async def` 함수는 그냥 부르면 코루틴 객체만 돌려주고, `asyncio.run()`이 비동기 세계로 들어가는 정문 역할을 한다. 서버와의 연결은 열었으면 반드시 닫아야 하는 자원이라, `async with`로 감싸두면 예외가 나든 정상 종료든 알아서 닫힌다.

### ClientSession - 서버와 말을 주고받는 창구

```python
http_client = httpx.AsyncClient(timeout=30.0)   # http 비동기 요청 클라이언트

async with streamable_http_client(
    url = url,
    http_client=http_client,
) as (read_stream, write_stream, get_session_id):
    async with ClientSession(read_stream, write_stream) as session:
        await session.initialize()

        tools_result = await session.list_tools()
        call_tool_result = await session.call_tool(
            name='scrape_page_text',
            arguments={'url': 'https://www.yes24.com/Product/Goods/196258878'}
        )
        print(len(call_tool_result.content), '개 result')
        print(call_tool_result.content[0].text[:30])   # content[0] 는 TextContent
```

전화 통화로 치면 `streamable_http_client`가 전화선을 깔고 `ClientSession`이 그 선으로 통화를 한다. 전송 계층 함수는 읽기 스트림, 쓰기 스트림, 세션 ID 가져오는 함수 세 개를 튜플로 내놓고, `ClientSession`은 앞의 둘을 받아 대화를 담당한다. 메서드는 어제 배운 3요소와 그대로 짝이 맞는다. `initialize()`가 첫 인사(핸드셰이크)이고, `list_tools()`/`call_tool()`, `list_resources()`/`read_resource()`, `list_prompts()`/`get_prompt()`가 각각 tool, resource, prompt를 다룬다. FastMCP의 `Context`는 도구 함수 안에서 쓰는 서버 쪽 물건이고 `ClientSession`은 클라이언트 쪽 물건이라 다르다.

`list_tools()`가 돌려주는 건 리스트가 아니라 pydantic 모델인 `ListToolsResult`라서, 수업 코드처럼 `for`로 돌리면 항목이 아니라 `('meta', None)`, `('nextCursor', None)`, `('tools', [...])` 같은 (필드 이름, 값) 짝이 나온다. 그래서 `if tool_result[0] == 'tools'`로 골라낸 건데, 실제로 쓸 때는 `tools_result.tools`면 끝난다. 수업 코드는 객체 안이 어떻게 생겼는지 보려고 돌아간 것이다. `call_tool()` 결과의 `content`가 리스트인 건 도구 하나가 텍스트, 이미지, 파일을 여러 조각으로 돌려줄 수 있기 때문이다.

HTTP 클라이언트는 연결 풀을 들고 있어서 호출마다 새로 만들면 매번 TCP 연결을 새로 트고 버린다. 모듈 맨 위에서 한 번 만들어 재사용하는 게 정석이다. 세 번째 값 `get_session_id`는 서버가 발급한 MCP 세션 ID를 꺼내는 디버깅용이라 보통 `_`로 버리는데, 뒤에 나오는 채팅 화면의 `session_id`와는 이름만 같은 완전히 다른 물건이다.

### 전송 방식 세 가지

| 전송 방식 | 어떤 상황 | 서버 쪽 설정 |
|---|---|---|
| `stdio` | 서버가 내 PC의 다른 프로세스. 클로드 데스크탑 방식 | `mcp.run()` (기본값) |
| `streamable-http` | 서버가 URL 뒤에 있음. 오늘 쓰는 방식 | `mcp.run(transport="streamable-http")` |
| `sse` | HTTP 기반 옛 방식 | `mcp.run(transport="sse")` |

오늘 `streamable-http`를 쓰는 건 MCP 서버(8000)와 채팅 서버(8001)가 서로 다른 프로세스로 따로 돌아서 표준 입출력으로 붙일 관계가 아니기 때문이다. MCP 명세에서 원격 연결의 표준 전송은 Streamable HTTP이고 SSE는 하위 호환용이라, 새로 만들면 `streamable-http`를 고르면 된다.

헷갈린 게 하나 있었는데, 설명에는 `streamablehttp_client`, 코드에는 `streamable_http_client`가 쓰여 있었다. 오타가 아니라 둘 다 있는 다른 함수다. 설치된 `mcp` 1.30.0 기준으로 옛 `streamablehttp_client`는 `headers`, `timeout`, `auth`를 인자로 하나씩 받는 deprecated 함수이고, 새 `streamable_http_client`는 그걸 다 빼고 `httpx.AsyncClient`를 통째로 받는다. httpx가 이미 잘 하는 걸 그대로 쓰라는 뜻이다. 인터넷 예제에서 `streamablehttp_client(url, timeout=30)`을 보면 옛 이름이구나 하면 된다.

### load_mcp_tools - 번역기 한 줄

```python
tools = await load_mcp_tools(session)   # -> list[BaseTool] 리턴

for tool in tools:
    print(type(tool), tool.name, tool.description, tool.args_schema)

agent = create_agent("gpt-5-mini", tools)
result = await agent.ainvoke({"messages": "오늘의 스케쥴을 알려줘"})
print(result['messages'][-1].content)
```

MCP 서버는 자기 프로토콜로 도구 목록과 스키마를 내놓고, LangChain 에이전트는 `BaseTool` 모양을 기대한다. `load_mcp_tools()`가 그 사이의 어댑터라 패키지 이름도 `langchain_mcp_adapters`다. `tool.name`, `tool.description`, `tool.args_schema`를 찍어보는 건 어제 서버에 적은 docstring과 타입 힌트가 그대로 넘어왔는지 확인하려는 것이다. 서버에 적은 docstring이 클라이언트의 `tool.description`에 그대로 도착해 있었다. 그리고 `async with` 블록 안에 있으니 동기 `invoke()`가 아니라 끝까지 `ainvoke`, `astream`처럼 `a`가 붙은 메서드를 써야 한다.

## 도구 7개를 모은 MCP 서버
어제 서버들은 인사만, 날씨만, 공시만 하는 예제였다면, 오늘 `mcp_server.py`는 실제 채팅 에이전트가 붙을 서버 하나였다. 에이전트에게 도구를 주는 방법은 같은 파일에 `@tool`로 정의하거나 MCP 서버에 올리고 클라이언트로 꺼내 쓰는 것인데, 앞이 훨씬 간단한데도 MCP를 쓰는 건 도구와 에이전트를 떼어놓을 수 있어서다. 도구를 고쳐도 채팅 서버를 재시작할 필요가 없고, 같은 도구 묶음을 내 채팅앱도 클로드 데스크탑도 같이 쓰고, 도구가 크롤링, RSS, 지오코딩 같은 무거운 라이브러리를 끌고 와도 채팅 서버는 그중 아무것도 import하지 않아도 된다.

| 도구 | 하는 일 | 성격 |
|---|---|---|
| `scrape_page_text(url)` | 웹페이지 본문 텍스트 긁기 | 인자 받는 도구 |
| `get_weather(city_name)` | 도시명 → 좌표 → 날씨 | 인자 받는 도구 |
| `get_news_headlines()` | 구글 RSS 헤드라인 | 인자 없는 도구 |
| `get_kbo_rank()` | 프로야구 순위 | 인자 없는 도구 |
| `today_schedule()` | 하드코딩된 일정 | 가짜 데이터 |
| `daily_quote()` | LLM이 지어낸 명언 | 안에서 LLM을 부름 |
| `brief_today()` | 위 도구들을 묶는 지시문 | 데이터가 아니라 지시문 |

### scrape_page_text와 get_weather

```python
@mcp.tool()
def scrape_page_text(url: str) -> str:
    """웹페이지의 텍스트 콘텐츠를 스크랩합니다."""
    resp = httpx.get(url)
    if resp.status_code != 200:
        return f"Failed to fetch {url}"
    soup = BeautifulSoup(resp.text, "html.parser")
    if soup.body:
        text = soup.body.get_text(separator=" ", strip=True)
        return " ".join(text.split())  # 연속된 공백 제거
    return ""

def get_coordinates(city_name: str) -> tuple[float, float]:   # ← 데코레이터가 없다
    """도시 이름을 받아 위도와 경도를 반환합니다."""
    geolocator = Nominatim(user_agent="weather_app_langgraph")
    location = geolocator.geocode(city_name)
    if location:
        return location.latitude, location.longitude
    raise ValueError(f"좌표를 찾을 수 없습니다: {city_name}")

@mcp.tool()
def get_weather(city_name: str) -> str:
    """도시 이름을 받아 해당 도시의 현재 날씨 정보를 반환합니다."""
    latitude, longitude = get_coordinates(city_name)
    url = f"https://api.open-meteo.com/v1/forecast?latitude={latitude}&longitude={longitude}&current_weather=true"
    response = httpx.get(url)
    return json.dumps(response.json())
```

스크랩은 `soup.body`로 `<head>`의 스크립트와 스타일을 빼고, `get_text(separator=" ", strip=True)`로 태그 자리에 공백을 넣어 단어가 안 붙게 하고, `" ".join(text.split())`로 남은 연속 공백을 한 칸으로 누른다. 마지막 줄은 미관이 아니라 돈 문제다. 스크랩 결과가 통째로 LLM 입력 토큰이 되고 공백과 줄바꿈도 토큰을 먹는다. `get_coordinates`를 도구로 안 만든 건 LangGraph 때부터 계속 나온 원칙으로, AI가 판단할 필요가 없는 중간 단계는 함수 안에 숨긴다.

반환 타입이 전부 `str`인 건 LLM이 결국 글자만 읽기 때문이다. 그래도 `json.dumps`로 바꾸면 구조를 남긴 채 문자열이 돼서 `"temperature": 24.1` 같은 걸 더 정확히 읽는다. 파이썬 `str(dict)`는 작은따옴표를 써서 JSON이 아니게 된다. RSS 쪽에서는 `getattr(entry, "title", "제목 없슴")` 뒤에 `if not title or title == "None":`으로 한 번 더 걸렀는데, `getattr`은 속성이 아예 없을 때만 기본값을 줘서 값이 빈 문자열이거나 문자열 `"None"`인 항목은 못 거르기 때문이다. 남이 주는 데이터를 다룰 때 흔한 방어다.

### daily_quote - 도구 안에서 LLM을 다시 부른다

```python
@mcp.tool()
def daily_quote() -> str:
    """사용자에게 영감을 주는 명언을 출력합니다"""
    chat_model = ChatOpenAI(model="gpt-5-mini")
    prompt = ChatPromptTemplate.from_messages([
        ("system", "당신은 오늘 하루의 명언을 알려주는 도우미입니다. 사용자의 명언 요청이 있을시 명언만 출력합니다."),
        ("human", "오늘의 명언을 출력해주세요. "),
    ])
    chain = prompt | chat_model
    response = chain.invoke({})
    return response.content
```

바깥의 에이전트(`gpt-4o`)가 명언을 달라니 `daily_quote`를 부르고, 그 도구 안에서 또 다른 LLM(`gpt-5-mini`)이 명언을 짓는다. LLM이 두 번 돌고 요금도 두 번 나간다. 그래도 이 구조를 쓰는 건 역할과 모델을 나눌 수 있어서다. 명언 짓기는 싸고 빠른 모델로 충분하고 대화를 이끄는 건 좋은 모델에 맡기고, 명언 말투를 바꿀 때 채팅 서버 프롬프트를 안 건드리고 이 도구만 고치면 된다. 프롬프트에 `{변수}`가 없어도 `invoke()`는 인자를 요구해서 빈 딕셔너리를 넘긴다.

### brief_today - 지시문을 돌려주는 도구

```python
@mcp.tool()
def brief_today() -> str:
    """사용자의 하루 시작을 돕기 위해 날씨, 뉴스, 일정 등을 종합하여 전달합니다."""
    return """
다음을 순서대로 실행하고, 실행한 결과를 사용자에게 알려주세요.
첫째로 사용자가 위치한 도시를 파악하세요. 위치를 모른다면, 사용자에게 질문하세요.
둘째로 사용자의 위치를 기반으로 get_weather 도구를 호출하여 날씨 정보를 찾아서 제공합니다.
셋째로 get_news_headlines 도구를 사용하여 오늘의 주요 뉴스를 출력합니다.
...
출력은 다음과 같이 해주세요.
## 사용자님을 위한 맞춤 요약
### 오늘의 날씨
[get_weather 의 결과]
...
"""
```

오늘의 핵심이었다. 이 도구는 일을 하지 않고 작업 지시서 한 장을 뽑아줄 뿐이다. 실제 일은 그 지시서를 받아 든 LLM이 한다.

```
사용자: "오늘 브리핑 좀"
  → LLM: brief_today() 호출        (결과 = 지시문 텍스트)
  → LLM: 지시문을 읽음
  → LLM: get_weather("서울") → get_news_headlines() → get_kbo_rank() → today_schedule() → daily_quote()
  → LLM: 지시문에 적힌 마크다운 틀에 맞춰 최종 답 작성
```

도구 호출이 여섯 번 일어나는데, 첫 번째만 사람의 말 때문이고 나머지 다섯은 도구가 돌려준 글을 읽고 LLM이 스스로 부른 것이다. 성격으로 보면 어제 배운 `@mcp.prompt`가 맞는데 일부러 tool로 만들었다. prompt는 사용자가 골라 꺼내는 것이고 tool은 LLM이 알아서 꺼내는 것이라, 사용자가 "브리핑"이라고 말하면 LLM이 알아서 이 흐름을 타게 하려면 tool이어야 한다. 여러 도구를 정해진 순서로 묶되 그 시작을 LLM이 판단하게 하고 싶으면 지시문을 반환하는 tool이 답이다. 지시문 첫 줄의 "위치를 모른다면 사용자에게 질문하세요"도 좋았다. 파이썬 함수로 짰다면 도시를 모를 때 예외를 던지고 끝났을 텐데, 지시문으로 넘기니 되묻는 처리가 한 줄로 된다.

서버 곳곳의 `print()`는 서버를 띄운 터미널에만 찍히는 디버깅용이다. 채팅창에서 브리핑을 시켰을 때 서버 터미널에 `날씨 조회: 서울`이 뜨면 LLM이 진짜 호출했다는 걸 알 수 있다. 어제 stdio에서는 `print`가 통신 채널을 깨뜨린다고 배웠는데, 오늘은 `streamable-http`라 표준출력이 통신에 안 쓰여서 안전하다. 맨 아래 `mcp.run(transport="streamable-http")`에서 포트 8000과 경로 `/mcp`는 FastMCP 기본값이라, 클라이언트가 `http://localhost:8000/mcp`로 붙는다.

## FastAPI lifespan으로 에이전트 띄우기
선행학습의 `03_load_mcp_tools.py`는 질문 하나 던지고 블록을 나오면서 연결을 닫고 끝났다. 스크립트로는 맞지만 웹 서버는 켜두고 몇 시간이고 요청을 기다리고, 메시지마다 도구를 써야 하니 MCP 연결이 계속 살아 있어야 한다. `/chat` 안에서 요청마다 접속하면 돌아가긴 하는데, 메시지 한 줄마다 접속, 핸드셰이크, 도구 목록 받기, 에이전트 생성, 끊기를 반복한다. 느린 것보다 더 큰 문제는 에이전트를 매번 새로 만들면 `checkpointer`에 쌓아둔 대화 기록이 통째로 사라져서 매 요청이 첫 대화가 된다는 것이다. LangGraph 마지막 날 스트림릿에서 그래프를 캐시해야 했던 것과 같은 문제다. 그래서 서버가 뜰 때 한 번 준비하고 내려갈 때 정리하는 `lifespan`을 썼다.

```python
http_client = httpx.AsyncClient(timeout=30.0)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """FastAPI 애플리케이션의 생명주기 동안 MCP 연결 및 에이전트 설정을 관리합니다."""
    print("애플리케이션 시작: MCP 서버에 연결하고 에이전트를 설정합니다...")

    async with streamable_http_client(
        url = "http://localhost:8000/mcp",
        http_client=http_client,
    ) as (read, write, _):
        async with ClientSession(read, write) as session:
            await session.initialize()
            tools = await load_mcp_tools(session)

            app.state.agent_executor = build_agent_executor(tools)
            print("에이전트 설정 완료. 애플리케이션이 준비 되었습니다")
            yield                        # ← 서버가 사는 시간 전체가 여기

    print('애플리케이션 종료')
    app.state.agent_executor = None

app = FastAPI(lifespan=lifespan)
```

가게 문을 여는 것처럼 아침에 불 켜고 재료 준비하고, 하루 종일 장사하고(`yield`), 저녁에 정리하고 잠근다. 손님 한 명 올 때마다 불을 켰다 끄지 않는다. 선행학습의 `@asynccontextmanager`가 여기서 진가를 발휘하는데, `yield`를 `async with` 안쪽 깊숙이 두면 FastAPI가 거기서 멈춰 서버를 돌리고, 그동안 바깥 `async with` 블록들은 안 끝난 채로 열려 있어서 MCP 연결이 살아 있다. 실행하면 시작 메시지 두 줄, `Uvicorn running on http://0.0.0.0:8001`, 그리고 Ctrl+C를 누르면 종료 메시지가 찍힌다.

`yield`의 들여쓰기가 이 파일에서 가장 중요한 한 칸이다. 한 단계만 바깥으로 빼면 블록이 즉시 닫혀서 연결이 끊긴다. 서버는 정상으로 뜨고 채팅창도 열리는데 메시지를 보내는 순간 세션이 닫혔다는 오류가 나서, 뜨는 것까지 멀쩡해 원인 찾기가 고약하다. 예전의 `@app.on_event("startup")`/`("shutdown")`은 deprecated이고, 시작과 종료가 다른 함수라 시작 때 연 것을 종료 때 닫는 자원을 다루기 어색했다. `lifespan`은 한 함수 안에서 `yield`로 나뉘어 `async with`를 그대로 걸칠 수 있다.

준비한 에이전트는 `app.state`에 둔다. 라우트 함수에서 `request.app.state.agent_executor`로 꺼낸다. `app.state`는 속성을 자유롭게 붙였다 뗐다 하는 빈 네임스페이스 객체라 전역 변수와 기능상 큰 차이는 없지만, 앱과 수명이 같다는 게 코드에 드러나고 테스트에서 앱을 여러 개 띄워도 안 섞인다.

### 시스템 프롬프트와 create_agent

```python
def create_prompt_template(tools) -> str:
    """에이전트를 위한 시스템 프롬프트(문자열)를 생성합니다."""
    tool_descriptions = "\n".join(f"- {t.name}: {t.description}" for t in tools)

    system_prompt = f"""
당신은 친절하고 도움이 되는 AI 어시스턴트 "금토깽"입니다.

다음과 같은 도구들을 활용하여 사용자를 도와드릴 수 있습니다:

사용 가능한 도구:
{tool_descriptions}

사용자가 위치한 곳을 안다면 바로 brief_today() 도구의 지침을 따르면 됩니다. ...
"""
    return system_prompt

def build_agent_executor(tools):
    """주어진 도구들을 사용하여 에이전트를 생성"""
    memory = InMemorySaver()                    # 체크포인터 사용
    prompt = create_prompt_template(tools)      # 반드시 str 이어야 함
    llm = ChatOpenAI(model='gpt-4o')

    agent_executor = create_agent(
        model=llm,
        tools=tools,
        system_prompt=prompt,
        checkpointer=memory,
    )
    return agent_executor
```

`create_agent(tools=tools)`로 넘기면 LangChain이 알아서 도구 목록을 모델에게 알려주니까 프롬프트에 또 적는 건 중복이다. 그래도 실무에서 흔한 중복이라고 한다. 도구 스펙은 기계적인 목록이고 프롬프트에 적은 건 "당신은 금토깽이고 이런 걸 할 수 있다"는 대화 맥락 안에 놓여서 모델이 더 적극적으로 쓰고, `f"- {t.name}: {t.description}"`으로 자동 생성하니 서버에 도구를 추가하면 프롬프트도 저절로 늘어난다. 공짜로 유지되는 중복이다. 서버 함수에 적은 docstring 한 줄이 클라이언트 프롬프트에까지 자동으로 실린다.

`create_agent`의 네 인자는 판단하는 두뇌(`model`), MCP에서 받아온 손발(`tools`), 역할과 말투(`system_prompt`), 대화 기록 저장소(`checkpointer`)다. `checkpointer`가 없으면 매번 첫 대화가 된다. `InMemorySaver`는 서버를 재시작하면 대화가 다 날아가니까 실서비스라면 `SqliteSaver`나 `PostgresSaver`로 한 줄만 갈아 끼운다.

주석에는 `create_agent()`의 `prompt=`에 넘긴다고 적혀 있었는데 코드는 `system_prompt=`였다. 설치된 `langchain` 1.3.11의 파라미터를 확인하면 `prompt`라는 이름은 아예 없고 `system_prompt`만 있다. 예전 이름이 주석에 남은 것이라 `prompt=`로 쓰면 `TypeError`다. 그리고 반드시 str이라고 두 번이나 적혀 있던 건 그동안 프롬프트라 하면 `ChatPromptTemplate` 객체였기 때문이다. `system_prompt`는 그냥 문자열을 받고, `MessagesPlaceholder("history")`도 필요 없다. 대화 기록은 `checkpointer`가 알아서 넣어준다.

### 그 밖에 만나본 것들
- 터미널이 두 개 필요하다. MCP 서버(8000)를 먼저 띄우고 채팅 서버(8001)를 띄운다. `lifespan`이 뜨자마자 8000번에 접속하니 MCP 서버가 없으면 채팅 서버가 아예 안 뜬다.

```bash
/opt/miniconda3/envs/KDT-py/bin/python mcp_server.py
```

```bash
/opt/miniconda3/envs/KDT-py/bin/python chat_agent.py
```

- 정적 파일과 템플릿 경로는 `Path(__file__).resolve().parent / "static"`처럼 소스 파일 기준으로 계산했다. 상대 경로는 터미널의 현재 위치 기준이라 프로젝트 폴더 밖에서 실행하면 폴더를 못 찾는다. 어제 DART 서버의 작업 디렉터리 문제와 같은 이야기다.
- 맨 위의 `sys.stdout.reconfigure(encoding="utf-8", errors="replace")`는 윈도우 콘솔 기본 인코딩이 `cp949`라 이모지를 찍다 죽는 걸 막는 방어 코드다. 맥에서는 아무 일도 안 한다.

## 채팅 화면과 세션 ID
에이전트의 답은 일반 챗봇보다 까다롭다. `brief_today` 하나에 도구가 여섯 번 불려서 오래 걸리니 스트리밍이 필요하고, 뉴스가 `1. [제목](링크)` 마크다운으로 오니 렌더러가 필요하고, "서울이야"가 바로 앞의 "어느 도시에 계신가요?"와 이어져야 하니 세션 ID가 필요하다. 이 셋이 오늘 프론트엔드 코드의 전부였다.

```html
<div id="chat-box"></div>

<form id="chat-form">
    <input type="text" id="chat-input" placeholder="메시지를 입력하세요..." autocomplete="off">
    <button id="send-button">전송</button>
</form>

<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
```

뼈대는 대화가 쌓이는 `chat-box`, 입력창 `chat-input`, 전송 `chat-form` 셋뿐이다. `autocomplete="off"`가 없으면 입력창을 누를 때마다 브라우저가 예전에 보낸 메시지를 드롭다운으로 띄워서 대화를 가린다. `marked.js`는 마크다운을 HTML로 바꿔주는 라이브러리로 CDN으로 불러왔다.

### 세션 ID

```javascript
const generateSessionId = () => {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 9);
  return `session_${timestamp}_${randomString}`;
};
// 예: "session_1735689600000_a1b2c3d"
```

대화방 번호표다. `Date.now()`는 언제 만들어진 방인지를, `Math.random().toString(36).substring(2, 9)`는 0~1 난수를 36진법 문자열로 바꿔 앞의 `"0."`을 떼고 7자만 써서 같은 밀리초에 여러 명이 접속해도 안 겹치게 한다. 이 값이 `/chat`의 `session_id: str = Form(...)`으로 들어가 최종적으로 `checkpointer`의 `thread_id`가 된다. 브라우저에서 시작해서 LangGraph 대화 기록까지 한 줄로 이어지는 값이다. 페이지 로드 때 한 번 만들어져서 새로고침하면 새 대화가 되는데, 버그가 아니라 지금 구조가 그렇다. 이어지게 하려면 `localStorage`에 저장해두면 된다. `crypto.randomUUID()`로 한 줄에 끝낼 수도 있지만 타임스탬프가 보이면 로그에서 언제 만들어진 세션인지 바로 알 수 있다.

### ChatApp과 빈 말풍선

```javascript
const ChatApp = {
    elements: { chatForm: null, chatInput: null, chatBox: null },
    sessionId: null,

    init(){
        this.elements.chatForm  = document.getElementById("chat-form");
        this.elements.chatInput = document.getElementById("chat-input");
        this.elements.chatBox   = document.getElementById("chat-box");

        this.sessionId = generateSessionId();
        this.elements.chatForm.addEventListener("submit", this.handleFormSubmit.bind(this));
    },

    async handleFormSubmit(e){
        e.preventDefault();
        const message = this.elements.chatInput.value.trim();
        if (!message) { return; }

        this.appendMessage("user", message);          // 내 말은 바로 완성해서 표시
        this.elements.chatInput.value = "";

        const botMessageElement = this.createMessageElement("bot");   // ← 빈 상자만
        await this.streamBotReponse(message, botMessageElement);      // ← 나중에 채움
    },

    createMessageElement(sender){
        const messageElement = document.createElement("div");
        messageElement.classList.add("message", `${sender}-message`);
        this.elements.chatBox.appendChild(messageElement);
        this.scrollToBottom();
        return messageElement;          // ← 이 반환값이 손잡이
    },

    appendMessage(sender, text){
        const messageElement = this.createMessageElement(sender);
        messageElement.innerHTML = marked.parse(text);
    },
};

document.addEventListener("DOMContentLoaded", () => { ChatApp.init(); });
```

흩어진 변수와 함수를 상자 하나에 담았고, 채팅창이 하나면 되니 `class` 대신 객체 하나로 썼다. `.bind(this)`가 없으면 이벤트 리스너로 넘긴 함수가 실행될 때 `this`가 함수를 부른 `<form>` 요소로 바뀌어서 `this.elements`가 `undefined`가 된다. 파이썬은 바운드 메서드가 `self`를 자동으로 채워주는데 자바스크립트는 손으로 묶어줘야 한다. LangGraph 프로젝트 구조에서 바운드 메서드를 배웠던 게 여기서 반대 모습으로 나왔다.

여기서 가장 중요한 건 사용자 메시지와 봇 메시지의 처리 방식이 다르다는 점이었다. 사용자 메시지는 내용을 이미 다 아니까 `appendMessage()`로 상자와 내용을 한 번에 만들고, 봇 메시지는 내용이 아직 없고 조금씩 오니까 `createMessageElement()`로 상자만 만들고 참조를 돌려받는다. 택배 상자를 먼저 자리에 놓고 물건이 도착하는 대로 넣는 것이다. 상자를 돌려받아야 나중에 그 자리에 글자를 계속 밀어 넣을 수 있다. `scrollToBottom()`은 `scrollTop`에 `scrollHeight`를 넣어 항상 맨 아래로 보내는데, 스트리밍이 들어오면 조각이 올 때마다 불러야 한다.

### 링크는 새 탭으로

```javascript
const renderer = {
    link(href, title, text){
        const link = marked.Renderer.prototype.link.call(this, href, title, text);
        return link.replace("<a", "<a target='_blank' rel='noreferrer'")
    },
};
marked.use({ renderer });
```

기본 렌더러로 `<a href="...">` 문자열을 받아와서 `target='_blank'`와 `rel='noreferrer'`만 끼워 넣었다. 뉴스 링크를 눌렀는데 채팅 화면이 그 기사로 바뀌면 돌아왔을 때 세션 ID가 새로 만들어져 대화가 통째로 사라지기 때문이다. `rel='noreferrer'`는 새 탭 페이지가 `window.opener`로 원래 페이지를 조작하는 통로를 끊는 보안 습관이다. `appendMessage`는 사용자 메시지도 `marked.parse()`로 `innerHTML`에 넣어서 사용자 입력이 그대로 HTML로 들어가는데, 실서비스라면 `DOMPurify` 같은 걸 한 겹 더 씌우는 게 정석이라고 한다.

### 아직 비어 있는 자리

```javascript
async streamBotReponse(message, botMessageElement){
    // 임시
    botMessageElement.innerHTML = "메세지:" + message
},
```

지금은 서버에 보내지도 않고 내가 친 말을 봇 말풍선에 그대로 찍는다. 서버 쪽 `/chat`도 아직 빈 문자열을 돌려주는 TODO 상태라 정확히 짝을 이루는 자리다. 오늘은 양쪽에 구멍을 파두고 끝났다. 빈 말풍선, 세션 ID, 마크다운 렌더러까지 준비는 다 돼 있어서, 다음 시간에 서버는 조각을 흘려보내고 프론트는 그걸 받아 이어 붙이면 된다. 함수 이름이 `Response`가 아니라 `Reponse`로 오타지만, 부르는 쪽도 같은 철자라서 잘 돌아간다. 한쪽만 고치면 깨진다.

## 헷갈리기 쉬운 부분
- `async with`는 뒷정리를 미리 예약하는 문법이다. `yield` 위가 진입, 아래가 정리이고 예외가 나도 정리는 돈다.
- 클라이언트는 전송선 깔기(`streamable_http_client`) → 통화하기(`ClientSession`) → 첫 인사(`initialize()`) 순서다.
- `streamablehttp_client`는 옛 이름이고 `streamable_http_client`가 지금 쓰는 것이다. 새 쪽은 `http_client=httpx.AsyncClient(...)`를 받는다.
- `ListToolsResult`는 pydantic 모델이라 `for`로 돌리면 (필드, 값) 짝이 나온다. 그냥 `.tools`로 꺼낸다.
- `load_mcp_tools(session)` 한 줄이 MCP 도구를 `list[BaseTool]`로 바꾼다. 비동기 블록 안에서는 `ainvoke`를 쓴다.
- MCP로 도구를 분리하면 도구를 고쳐도 채팅 서버를 안 내리고, 여러 에이전트가 같이 쓴다.
- 도구는 데이터뿐 아니라 다른 도구를 부르라는 지시문도 돌려줄 수 있다. LLM이 시작을 판단하게 하려면 prompt가 아니라 tool이다.
- 도구 안에서 LLM을 또 부를 수 있고, 요금도 두 번 나간다.
- `lifespan`에서 `yield`를 `async with` 안쪽에 둬야 서버가 사는 동안 연결이 안 닫힌다.
- 에이전트는 요청마다 만들지 말고 한 번 만들어 `app.state`에 둔다. 매번 만들면 대화 기록이 사라진다.
- `create_agent`는 `system_prompt=`에 문자열을 받는다. 기록은 `checkpointer`가 맡는다.
- 채팅 화면의 세션 ID가 서버에서 `thread_id`가 된다. MCP 세션 ID와는 다른 물건이다.
- 봇 메시지는 빈 말풍선을 먼저 만들고 나중에 채운다. 이벤트 리스너로 넘기는 메서드에는 `.bind(this)`를 붙인다.

## 오늘 배운 내용 정리
오늘은 MCP 클라이언트를 직접 짜고, 도구 7개짜리 서버를 만들고, FastAPI 채팅 서버가 그 서버에 붙어 에이전트를 돌리게 하고, 채팅 화면의 뼈대를 만들었다.

```
클라이언트: @asynccontextmanager(yield 위 진입 / 아래 정리) + asyncio.run.
           streamable_http_client(url, http_client) → (read, write, _) → ClientSession → initialize().
           list_tools / call_tool / read_resource / get_prompt. load_mcp_tools(session) → list[BaseTool].
MCP 서버: scrape_page_text / get_weather(get_coordinates는 함수) / get_news_headlines / get_kbo_rank /
          today_schedule / daily_quote(안에서 LLM) / brief_today(지시문 반환 → 도구 5번 연쇄 호출).
          mcp.run(transport="streamable-http") → localhost:8000/mcp.
채팅 서버: lifespan에서 async with 안쪽에 yield → MCP 연결 유지. app.state.agent_executor.
          create_agent(model, tools, system_prompt=str, checkpointer=InMemorySaver). 포트 8001.
프론트: generateSessionId → thread_id. ChatApp + bind(this). 빈 말풍선 먼저, 나중에 채움.
        marked.js 렌더러로 링크 새 탭. streamBotReponse와 /chat은 다음 시간에 채울 자리.
```

어제 만든 서버에 적은 docstring 한 줄이 오늘 클라이언트에서 `tool.description`으로 도착하고, 그게 다시 시스템 프롬프트의 도구 목록으로 자동으로 실리는 걸 보니 서버와 클라이언트가 한 줄로 이어지는 느낌이었다. 가장 인상적이었던 건 `brief_today`였다. 아무 일도 안 하고 지시문 한 장만 돌려주는 도구가 LLM을 시켜 다른 도구 다섯 개를 순서대로 부르게 만드니, 도구가 꼭 데이터를 만들어야 한다는 생각이 깨졌다. 그리고 `lifespan`의 `yield` 한 칸 들여쓰기가 서버 전체를 살리고 죽인다는 것도 오래 기억날 것 같다.

---
