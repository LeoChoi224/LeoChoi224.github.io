---
layout: single
title: "LangGraph 기초 정리 2 - 토큰 스트리밍, @tool과 신문기사 챗봇, 하위 그래프, 에이전트 프로젝트 구조"
categories: [coding, LangGraph]
tag: [study-log, LangGraph, LangChain, streaming, tool, subgraph, agent, project-structure]
toc: true
author_profile: false
sidebar:
    nav: "docs"
search: true
---
<hr/>

어제 LangGraph의 기본 부품을 다 훑었다면, 오늘은 그 부품으로 조금 더 쓸 만한 것을 만드는 날이었다. 어제 체크포인터 노트북과 ToolNode 노트북의 뒷부분을 이어서 했는데, 기억하는 챗봇을 `messages` 하나로 훨씬 짧게 다시 짜고 글자가 하나씩 찍히는 스트리밍을 붙였다. 그다음 `@tool`로 웹 검색 도구를 만들어 몇 바퀴 돌지 모르는 기사 작성 에이전트를 돌렸고, 그래프를 통째로 다른 그래프의 노드로 꽂는 하위 그래프를 배웠다. 마지막에는 노트북을 벗어나 에이전트 프로젝트를 파일로 쪼개는 뼈대를 만들었다.

## 메시지 상태와 토큰 스트리밍
어제 만든 메모리 봇은 상태에 이름, 좋아하는 것, 싫어하는 것, 응답을 따로 선언하고, LLM에게 JSON을 뱉게 시킨 다음 `json.loads()`로 파싱해서 손으로 합쳤다. 잘 돌긴 했는데 실제 대화 내용은 어디에도 안 남아서 "아까 내가 뭐라고 물어봤지?"에는 답할 수 없었다. 그리고 `invoke()`는 LLM이 문장을 끝까지 만들고 나서야 결과를 돌려주니까 긴 답변이면 한참 동안 화면에 아무것도 안 떴다. 오늘 붙인 부분은 이 둘을 한꺼번에 해결했다.

### 상태를 messages 하나로

```python
class State(TypedDict):
    messages: Annotated[list[str], add_messages]

def create_graph():
    graph_builder = StateGraph(State)

    memory = InMemorySaver()
    model = ChatOpenAI(model="gpt-4o")

    def generate(state: State):
        return {"messages": [model.invoke(state['messages'])]}

    graph_builder.add_node("generate", generate)
    graph_builder.add_edge(START, "generate")
    graph_builder.add_edge("generate", END)

    return graph_builder.compile(checkpointer=memory)
```

필드를 여러 개 두고 챙기는 대신 대화 기록 공책 한 권만 두고 거기에 계속 덧붙이는 방식이다. 어제 배운 `MessagesState`가 정확히 이 두 줄을 미리 정의해둔 클래스이고, 오늘은 직접 써본 것이다. 노드가 한 줄로 줄었다. 프롬프트, JSON 파싱, 상태 병합이 전부 사라졌다.

`state['messages']`를 그대로 모델에 넘기는 이 한 줄이 기억의 정체다. 매 턴마다 지금까지의 대화 전부를 다시 보낸다. LLM은 여전히 아무것도 기억하지 않고, 체크포인터가 그 목록을 보관해줄 뿐이다.

`list[str]`이라고 적혀 있지만 실제로 담기는 건 `HumanMessage`, `AIMessage` 같은 객체다. 정확히 쓰면 `Annotated[list[AnyMessage], add_messages]`인데, LangGraph가 보는 건 두 번째 자리의 리듀서뿐이고 첫 자리 타입힌트는 실행할 때 검사하지 않아서 에러가 안 난다.

`InMemorySaver()`가 함수 안에 있다는 것도 주의할 점이었다. `create_graph()`를 두 번 부르면 저장소도 두 개가 돼서, 같은 `thread_id`를 줘도 새 그래프는 이전 대화를 못 찾는다. 열쇠는 같은데 사물함 건물이 달라진 셈이다. 그래서 `graph = create_graph()`는 채팅 루프 바깥에서 한 번만 부른다.

### stream_mode="messages"

```python
config = {"configurable": {"thread_id": "abcd"}}
graph = create_graph()

while True:
    user_input = input("You\t:")
    if user_input.lower() in ["exit", "quit", "q"]:
        break
    for chunk, _ in graph.stream({"messages": [HumanMessage(user_input)]},
                                 config,
                                 stream_mode="messages"):
        if chunk.content:
            print(chunk.content, end="", flush=True)
```

편지가 다 쓰이길 기다렸다 받는 대신 한 글자 쓸 때마다 어깨너머로 보는 것이다. OpenAI API가 원래 토큰을 하나씩 흘려보낼 수 있고 LangGraph가 그걸 그대로 전달해준다. 총 걸리는 시간은 같은데 첫 글자가 거의 바로 떠서 체감이 완전히 다르다.

| `stream_mode` | 한 번에 나오는 것 | 언제 쓰나 |
|---|---|---|
| `"values"` | 상태 전체 (노드 하나 끝날 때마다) | 상태가 어떻게 변하는지 볼 때 |
| `"updates"` | 그 노드가 바꾼 부분만 | 어느 노드가 무엇을 했는지 추적할 때 |
| `"messages"` | (메시지 조각, 메타데이터) 토큰 단위 | 화면에 글자를 흘려 보여줄 때 |

`messages` 모드는 `(chunk, metadata)` 튜플을 준다. `metadata`에는 이 조각이 어느 노드에서 나왔는지(`langgraph_node`) 같은 정보가 있어서, 노드가 여러 개일 때 `if metadata["langgraph_node"] == "generate":`처럼 거를 수 있다. 오늘은 노드가 하나라 `_`로 버렸다. `for chunk in ...`으로 언패킹을 빼먹으면 `'tuple' object has no attribute 'content'`가 난다.

`if chunk.content:`는 스트리밍 조각 중에 맨 첫 조각(역할만 알려줌), 맨 끝 조각(종료 신호)처럼 내용이 빈 것이 섞여 있어서 필요하다. `flush=True`도 빼면 안 된다. 파이썬은 출력을 모아뒀다 한꺼번에 내보내는데, `end=""`로 줄바꿈까지 없애면 내보낼 신호가 없어서 애써 토큰 단위로 받아놓고 화면에는 뭉텅이로 뜬다.

노트북에 주석으로 남아 있던 `stream_mode="values"`와 `event['messages'][-1].pretty_print()`는 다른 모드의 코드다. `values` 모드는 `for event in ...`으로 상태 딕셔너리가 하나씩 나와서 `event['messages'][-1]`로 꺼내고, `messages` 모드는 `for chunk, meta in ...`으로 메시지 조각이 나와서 `chunk.content`로 꺼낸다. 나오는 것 자체가 달라서 한 줄만 주석 풀어서 오갈 수는 없고 반복문 전체를 고쳐야 한다. 그리고 주피터에서 `input()` 루프는 `exit`를 쳐서 빠져나와야지, 셀 중단 버튼을 누르면 입력 대기가 애매하게 남아 커널 재시작이 제일 확실했다.

## @tool과 신문기사 챗봇
어제 계산기·날씨·환율 봇은 한 번 물으면 한 번 도구 쓰고 끝이었다. 루프는 만들어뒀지만 실제로는 거의 한 바퀴만 돌았다. 그런데 "서울월드컵경기장 잔디 문제로 심층 분석 기사를 써줘"는 한 번 검색해서 끝날 일이 아니다. 최근에 뭐가 있었는지 훑고, 주제를 고르고, 목차를 짜고, 목차를 채우려면 뭐가 더 필요한지 보고 다시 검색하고, 그래도 부족하면 검색어를 바꿔 또 검색해야 한다. 몇 번 검색해야 할지는 결과를 보고 나서야 정해진다. 오늘은 어제 만든 그래프 구조가 이걸 이미 할 수 있다는 걸 확인했다. 코드는 거의 안 바뀌고 프롬프트가 바뀐다.

### @tool은 함수를 객체로 만든다

```python
from langchain_core.tools import tool

@tool
def get_current_time(timezone: str, location: str) -> str:
    """현재 시간을 반환하는 함수"""
    tz = pytz.timezone(timezone)
    now = datetime.now(tz).strftime("%Y-%m-%d %H:%M:%S")
    return f'{timezone} ({location}) 현재시각 {now}'

get_current_time
# StructuredTool(name='get_current_time',
#                description='현재 시간을 반환하는 함수',
#                args_schema=<class '...get_current_time'>,
#                func=<function get_current_time at 0x...>)

get_current_time.invoke({"timezone": "Asia/Seoul", "location": "서울"})
# 'Asia/Seoul (서울) 현재시각 2026-09-11 11:14:10'
```

어제는 `@tool` 없이 그냥 함수를 넘겨도 LangChain이 안에서 감싸줬다. `@tool`을 붙이면 함수가 `StructuredTool` 객체가 되고, 원래 함수는 `func=` 안으로 들어간다. 그래서 `.name`(LLM이 주문서에 적을 이름), `.description`(docstring 그대로), `.args_schema`(타입힌트로 만든 Pydantic 모델), `.invoke()`가 생긴다. 이 중 제일 쓸모 있는 건 `.invoke()`로, 그래프 없이 도구만 따로 테스트할 수 있다. 나중에 도구 문제인지 LLM 문제인지 가리려면 도구를 혼자 돌려볼 수 있어야 한다.

대신 `get_current_time("Asia/Seoul", "서울")`처럼 예전처럼 부르면 안 되고 `.invoke()`에 딕셔너리 하나로 넘겨야 한다. LLM이 도구를 부를 때 주는 게 원래 JSON 객체라, LLM이 부르는 방식으로 직접 불러보는 셈이다.

### 웹 검색 도구

```python
@tool
def get_web_search(query: str, search_period: str = 'w') -> str:
    """웹 검색을 수행하는 함수. ... (기간: w=주, m=월, y=년, d=일)"""
    wrapper = DuckDuckGoSearchAPIWrapper(time=search_period)
    search = DuckDuckGoSearchResults(api_wrapper=wrapper, results_separator=';\n')
    result = search.invoke(query)
    ...
```

LangChain이 DuckDuckGo 검색을 감싸둔 걸 썼는데, API 키가 필요 없어서 수업용으로 좋다. `DuckDuckGoSearchAPIWrapper`는 기간, 지역 같은 검색 엔진 쪽 설정이고, `DuckDuckGoSearchResults`는 결과를 어떻게 이어 붙일지 정하는 LangChain 도구 껍데기다. `search_period`를 도구 인자로 뚫어놔서 LLM이 최근 이슈면 일주일, 배경이면 1년처럼 스스로 정해서 넘긴다.

두 도구의 docstring 설계가 정반대인 것도 눈여겨봤다. `get_current_time`은 한 줄인데 `get_web_search`는 `search_period`가 `w`/`m`/`y`/`d` 중 하나라고 일일이 적어놨다. 시간은 인자 뜻이 자명하지만, `search_period`는 안 적어주면 LLM이 `"week"`나 `"7days"`를 넣어 터뜨린다. docstring 길이는 인자가 얼마나 자명한지에 맞추면 된다. 그리고 DuckDuckGo는 무료라 짧은 시간에 여러 번 검색하면 `RatelimitException`이 잘 난다. 실무에서는 Tavily나 Serper 같은 유료 검색 API를 쓴다고 한다.

### 그래프 조립과 라벨

```python
def generate(state: State):
    return {"messages": model_with_tools.invoke(state['messages'])}   # 리스트 없음

graph.add_node("generate", generate)
graph.add_node("tools", tool_node)
graph.add_edge(START, "generate")
graph.add_conditional_edges(
    'generate',
    lambda s: "tool_node" if s['messages'][-1].tool_calls else END,
    {
        "tool_node": "tools",     # 라벨 "tool_node" → 실제 노드 "tools"
        END: END
    }
)
graph.add_edge("tools", "generate")
workflow = graph.compile()
```

어제 `should_continue`로 뺐던 판정을 람다 한 줄로 넣었다. 여기서 제일 헷갈렸던 건 람다가 `"tool_node"`를 반환하는데 실제 노드 이름은 `"tools"`라는 점이었다. 이름이 어긋났는데도 돌아가는 건 세 번째 인자 딕셔너리가 통역기이기 때문이다. 판정 함수가 반환하는 건 노드 이름이 아니라 라벨이고, 딕셔너리가 라벨을 노드에 연결한다. 딕셔너리를 지우면 반환한 문자열을 그대로 노드 이름으로 찾아서 `"tool_node"`라는 노드가 없다고 에러가 난다. 오늘 코드는 라벨과 노드를 분리한 쪽인데 이름이 비슷해서 오히려 헷갈리는 경우였다. `KeyError`나 node not found가 뜨면 람다 반환값, 딕셔너리 키, 실제 노드 이름 셋을 나란히 놓고 보면 된다.

노드가 `{"messages": model_with_tools.invoke(...)}`처럼 리스트로 안 감쌌는데도 된다. `add_messages`가 메시지 하나가 오면 알아서 리스트로 만들어 붙이기 때문이다. 둘 다 맞지만 메시지를 여러 개 붙일 때 결국 리스트가 필요하니까 감싸는 습관이 낫겠다.

`s['messages'][-1].tool_calls`는 오늘은 `generate` 다음에만 불려서 마지막이 항상 `AIMessage`라 괜찮지만, 다른 자리에 붙이면 `HumanMessage`가 걸려 `AttributeError`가 난다. 안전하게는 `getattr(s['messages'][-1], "tool_calls", None)`으로 쓴다.

### 스트리밍에서 LLM 토큰만 고르기

```python
from langchain_core.messages.ai import AIMessageChunk

gathered = None
for msg, metadata in workflow.stream({"messages": inputs}, stream_mode="messages"):
    if isinstance(msg, AIMessageChunk):
        print(msg.content, end='', flush=True)
        gathered = msg.content if gathered is None else gathered + msg.content
```

이 그래프에는 `tools` 노드가 있어서 도구 결과인 `ToolMessage`도 스트림에 섞여 나온다. 검색 결과 원문 수천 자가 그대로 쏟아지면 못 읽으니까, `AIMessageChunk`만 통과시켜서 LLM이 사람에게 하는 말만 남겼다. `gathered`는 흘러간 토큰을 다시 이어 붙여두는 것으로, 화면에는 흘려보내고 프로그램에는 완성된 문장을 남기는 패턴이다.

### 프롬프트가 루프를 돌린다

```python
inputs = [SystemMessage(content=f"""
너는 신문기자이다. 최근 {about}에 대해 비판하는 심층 분석 기사를 쓰려고 한다.

- 최근 어떤 이슈가 있는지 검색하고, 사람들이 제일 관심있어 할만한 주제를 선정하고, 왜 선정했는지 말해줘.
- 그 내용으로 원고를 작성하기 위한 목차를 만들고, 목차 내용을 채우기 위해 추가로 검색할 내용을 리스트로 정리해봐.
- 검색할 리스트를 토대로 재검색을 한다.
- 목차에 있는 내용을 작성하기 위해 더 검색이 필요한 정보가 있는지 확인하고, 있다면 추가로 검색해라.
- 검색된 결과에 원하는 정보를 찾지 못했다면 다른 검색어로 재검색해도 좋다.

더 이상 검색할 내용이 없다면, 신문 기사 형식으로 최종 기사를 작성하라.
제목, 부제, 리드문, 본문 의 구성으로 작성하라. ...
""")]
```

이 프롬프트가 오늘의 진짜 결과물이었다. 그래프 코드는 어제 것과 사실상 같은데, 이 지시문 하나로 같은 루프가 대여섯 바퀴 돌았다. 역할을 주면 어투와 판단 기준이 정해지고, 단계를 순서대로 나열하면 어제 환율 예제에서 봤던 "의존 관계가 있는 작업을 한꺼번에 시키는" 문제를 피한다. 검색 결과를 봐야 다음 검색어가 나오기 때문이다. 그리고 "더 이상 검색할 내용이 없다면"이라는 멈출 조건이 없으면 계속 검색만 하다 끝나거나 한 번 검색하고 바로 기사를 쓴다.

루프가 끝나는 순간은 LLM이 `tool_calls` 없는 메시지를 낼 때다. "그만 검색하겠다"는 판단을 LLM이 직접 하고, 나는 `while` 조건을 한 줄도 안 썼다. 검색을 몇 번 할지 정한 코드는 어디에도 없다. 다만 이 그래프는 `compile()`에 체크포인터를 안 넘겨서 `stream()` 한 번이 끝나면 대화가 사라진다. 이어서 "3번 문단 고쳐줘"를 하려면 체크포인터를 붙여야 한다. `temperature=0.01`로 둬도 검색 결과가 매일 바뀌어서 내일 돌리면 다른 기사가 나온다. 도구를 쓰는 순간 재현성은 바깥 세상이 정한다.

### 검색 결과가 하나만 넘어가는 버그

```python
result = search.invoke(query)

for i, result in enumerate(result.split(';\n')):    # 루프 변수가 result
    print(f'{i+1}. {result}')

return result        # ← 마지막 조각 하나만 남아 있다
```

복습하다가 찾은 건데, 루프 변수 `result`가 바깥 `result`를 덮어써서 루프가 끝나면 마지막 검색 결과 한 줄만 LLM에게 간다. 화면에는 1번부터 5번까지 다 찍혀서 눈으로는 멀쩡해 보이니까 놓치기 쉽다. 기사가 그럭저럭 써진 건 검색을 여러 번 해서 조각이 쌓였기 때문이다. 루프 변수 이름을 `item`으로 바꾸고 원래 `results`를 반환하면 고쳐진다.

## 하위 그래프 - 노드 자리에 그래프를 꽂기
지금까지 그래프는 노드가 전부 한 층이었다. 날씨 질문이면 좌표 찾고 API 부르고 정리하는 노드 몇 개, 주식 질문이면 또 몇 개를 한 층에 다 펴면 에지가 얽혀서 그림을 봐도 모르고, 날씨 부분만 따로 고치거나 테스트하거나 다른 프로젝트로 가져갈 수가 없다. 함수를 쪼개는 이유와 같은 이야기이고, LangGraph의 답은 그래프 하나를 통째로 노드 하나로 취급하는 것이다.

### 하위 그래프는 평범한 그래프다

```python
def create_weather_agent():
    """날씨 관련 질문을 처리하는 전문가 서브그래프를 생성합니다."""
    graph = StateGraph(MessagesState)

    model = init_chat_model('gpt-4o', model_provider='openai').bind_tools([get_weather])
    tool_node = ToolNode([get_weather])

    def call_model(state: MessagesState):
        return {"messages": [model.invoke(state['messages'])]}

    graph.add_node("call_model", call_model)
    graph.add_node("tool_node", tool_node)

    graph.add_edge(START, 'call_model')
    graph.add_conditional_edges('call_model',
        lambda s: 'tool_node' if s['messages'][-1].tool_calls else END,
        {"tool_node": "tool_node", END: END})
    graph.add_edge("tool_node", "call_model")

    return graph.compile()

app = create_weather_agent()
result = app.invoke({"messages": [HumanMessage("부산 날씨 어때?")]})
print(result['messages'][-1].content)
# 날씨 조회: Busan
# 부산의 현재 날씨는 ... 기온 22.9°C, 풍속 8.1 km/h ...
```

서브그래프용 문법은 하나도 없다. 어제 만든 ReAct 루프에서 도구가 `get_weather` 하나로 줄었을 뿐이다. 하위 그래프는 특별한 종류가 아니라 남이 부품으로 쓰는 그냥 그래프다. 그래서 혼자서도 돌고, 메인 그래프가 없어도 날씨 담당이 제대로 도는지 확인할 수 있다. 나중에 답이 이상하면 여기만 다시 돌려보면 돼서 라우팅이 틀렸는지 날씨 로직이 틀렸는지 헤매지 않는다. 이 독립 테스트가 이 설계의 값어치다.

### 도구 두 개 중 하나만 준다

```python
def get_coordinates(city_name: str) -> tuple[float, float]:
    """도시 이름을 받아 위도와 경도를 반환합니다."""
    geolocator = Nominatim(user_agent="weather_app_langgraph")
    location = geolocator.geocode(city_name)
    ...

def get_weather(city_name: str) -> str:
    """도시 이름을 받아 해당 도시의 현재 날씨 정보를 반환합니다."""
    latitude, longitude = get_coordinates(city_name)     # ← 안에서 부른다
    url = f"https://api.open-meteo.com/v1/forecast?latitude={latitude}&..."
    return json.dumps(httpx.get(url).json())
```

`bind_tools([get_weather])`에 `get_coordinates`는 안 줬다. 둘 다 주면 LLM이 좌표, 날씨 순으로 두 번 왕복해야 하고, 왕복마다 돈과 시간이 들고 중간에 좌표를 잘못 옮겨 적을 위험도 생긴다. 붙어 다닐 수밖에 없는 두 단계는 한 함수에 묶어 도구 하나로 내주는 게 낫다. LLM에게 주는 도구는 사람이 한 문장으로 시킬 수 있는 단위로 만든다는 원칙이다. `get_coordinates`는 docstring이 있어도 `bind_tools`에 안 넣었으니 LLM은 존재조차 모르는 도우미 함수다.

`Nominatim`은 OpenStreetMap의 무료 지오코딩이라 `user_agent`를 꼭 넣어야 하고 초당 1회 제한이 있다. 도시 이름도 영어로 잘 잡혀서 출력에 `Busan`, `Seongnam`처럼 영어로 찍혔다.

### 그래프를 노드로 꽂고 START에서 바로 분기

```python
def create_main_agent(weather_subgraph):          # 서브그래프를 인자로 받는다
    workflow = StateGraph(MessagesState)
    main_model = init_chat_model("gpt-4o", model_provider="openai")

    workflow.add_node("general_agent",
                      lambda s: {"messages": [main_model.invoke(s['messages'])]})
    workflow.add_node("weather_expert", weather_subgraph)   # 그래프가 노드가 된다

    workflow.add_conditional_edges(
        START,                # 노드가 아니라 시작점에서 분기
        router,
        {"weather_expert": "weather_expert", "general_agent": "general_agent"},
    )
    workflow.add_edge("general_agent", END)
    workflow.add_edge("weather_expert", END)
    return workflow.compile()
```

`add_node`의 두 번째 인자 자리에 함수 대신 그래프가 들어갔다. 이 한 줄이 오늘 수업의 전부였다. LangGraph가 노드에 요구하는 건 상태를 받아서 상태 변경분을 돌려주는 것 하나인데, 컴파일된 그래프도 `invoke(상태)`를 받아 상태를 돌려준다. 겉모습이 노드와 같으니 노드 자리에 들어갈 수 있어서 특별한 API가 필요 없었다.

조건이 하나 있는데, 상태 스키마가 같아야 한다. 오늘은 메인과 서브가 둘 다 `MessagesState`라 그대로 흘러 들어가고 나왔다. 스키마가 다르면 함수로 한 겹 감싸서 메인 상태를 서브 상태로, 서브 결과를 다시 메인 상태로 번역해줘야 한다. 부품을 끼우려면 단자 모양이 맞아야 하고, 안 맞으면 어댑터를 끼우는 것이다. 그리고 `create_main_agent`가 서브그래프를 안에서 만들지 않고 인자로 받아서, 나중에 가짜 날씨 그래프로 테스트하거나 다른 구현으로 갈아끼울 수 있다.

지금까지는 노드 하나를 실행한 뒤 갈림길을 만들었는데, 오늘은 `START`에서 아무것도 실행하기 전에 갈라졌다. 라우팅은 무엇을 할지 정하는 일이라 작업 앞에 오는 게 자연스럽고, 통과만 하는 껍데기 분류 노드가 하나 사라진다.

### LLM 없이 라우팅

```python
def router(state: MessagesState) -> Literal["weather_expert", "general_agent"]:
    query = state["messages"][-1].content.lower()
    if "날씨" in query or "기온" in query:
        print("라우팅 결정: 기상 전문가에게 위임")
        return "weather_expert"
    print("라우팅 결정: 일반 에이전트가 처리")
    return "general_agent"
```

`if`문 하나가 라우터다. LLM을 안 불러서 비용이 0원이고 즉시 끝나지만, 글자가 맞아야만 한다. "내일 우산 챙겨야 해?", "비 와?", "바깥 추워?"는 전부 일반 에이전트로 간다. 실무에서는 확실한 키워드는 `if`로 먼저 거르고 안 걸린 것만 LLM에게 물어보는 식으로 섞어 쓴다고 한다. 반환 타입의 `Literal`은 LangGraph가 어디로 갈 수 있는지 미리 파악하는 데 써서, 매핑 딕셔너리를 생략해도 그림이 제대로 그려진다.

### xray=True와 주의할 것

```python
display(Image(main_agent.get_graph().draw_mermaid_png()))              # 겉모습
display(Image(main_agent.get_graph(xray=True).draw_mermaid_png()))     # 속까지
```

기본 그림에서 `weather_expert`는 상자 하나로만 보이고, `xray=True`를 주면 상자를 열어 안쪽 `call_model`과 `tool_node` 루프까지 그려준다. 남에게 흐름을 설명할 때는 기본, 디버깅할 때는 xray가 맞다. 실행 중에 서브그래프 안쪽 이벤트까지 보려면 `stream(..., subgraphs=True)`를 준다. 메인 입장에서 서브그래프는 상자 하나라서 안에서 스무 번 돌아도 바깥에서는 아직 안 끝난 걸로만 보이기 때문이다.

- `compile()` 안 한 `StateGraph`는 설계도일 뿐이라 노드가 못 된다. 오늘은 `create_weather_agent()`가 컴파일해서 돌려줬다.
- 체크포인터는 메인 쪽에만 단다. 상위 그래프에 달면 하위 그래프도 같이 쓴다.
- `f"최종 답변: {result["messages"][-1].content}"`처럼 f-문자열 안팎 따옴표가 같은 코드는 파이썬 3.12부터 허용된 문법이다. 지금 conda 환경이 3.12라 돌았지만 3.11 이하에서는 `SyntaxError`라, 안쪽을 작은따옴표로 바꾸는 게 어디서나 안전하다.

## 에이전트 프로젝트 구조 - 노트북을 파일로 쪼개기
지금까지 노트북 여덟 개를 만들면서 위에 import, 그 아래 도구, 노드, 맨 아래에서 조립과 실행을 반복했다. 노트북 하나가 예제 하나일 때는 위에서 아래로 읽으면 돼서 편하다. 그런데 에이전트가 여러 개가 되면 셀이 100개를 넘어 스크롤로 찾게 되고, 도구를 고치면 아래 셀을 다 다시 돌려야 하고, `python main.py`로 못 돌리고, 실행 결과까지 파일에 박혀서 고친 게 없어도 diff가 생긴다. 그래서 실제 제품은 `.py` 파일로 간다. 오늘은 그 칸을 미리 만들어두는 날이라 안이 비어 있는 게 정상이었다.

```
AgentProject/
├── main.py          ← 진입점
├── config.py        ← 설정 (모델 이름, 환경변수)
├── state.py         ← 그래프가 주고받는 데이터 모양
├── tools.py         ← @tool 함수들
├── utils.py         ← 공용 함수
├── workflow.py      ← 노드·에지 조립
└── agents/          ← 에이전트 클래스 하나당 파일 하나
    ├── collector.py
    └── communicator.py
```

의존 방향이 `main → workflow → agents → state` 한쪽으로만 흐르는 게 중요하다. `state.py`는 아무것도 import하지 않고 `main.py`는 거의 전부를 import한다. `agents/collector.py`가 `workflow.py`를 import하는 순간 순환 참조로 터진다.

### 설정, 상태, 도구

```python
# config.py
class Config:
    """프로젝트 설정 관리 클래스"""
    MODEL_NAME: str = 'gpt-4o'

# state.py
class StateA(BaseModel):
    """그래프에서 사용하는 상태 관리 모델"""

# tools.py
@tool
def web_search(query: str):
    """
    주어진 query에 대해 웹검색을 하고, 결과를 반환한다.
    Args: query (str): 검색어
    Returns: dict: 검색 결과
    """
    return "검색결과"
```

모델 이름을 다섯 군데에 적어두면 바꿀 때 하나 빠뜨려서 일부 노드만 다른 모델로 도는 이상한 상태가 되니까 `Config` 한 군데에 모은다. 앞에서 본 `init_chat_model`처럼 모델을 설정으로 정하는 구조와 잘 맞는다. `StateA`는 아직 필드가 없다. 도구는 진짜 검색 대신 가짜 값을 돌려주는 스텁인데, 이 상태로도 그래프는 끝까지 돌아서 LLM이 도구를 제대로 부르는지 검색 비용 없이 확인할 수 있다. 스텁이어도 docstring은 제대로 쓴다. LLM에게 가는 유일한 설명서라서다.

상태를 `TypedDict`로 할지 `BaseModel`로 할지도 정리됐다. `TypedDict`는 `state['messages']`로 읽고 값 검사가 없고, Pydantic은 `state.messages`로 읽고 타입이 틀리면 에러를 내준다. 필드가 20개쯤 되는 프로젝트에서는 오타 하나로 조용히 틀리는 걸 막아주는 Pydantic이 유리하다. 노드가 딕셔너리를 반환하는 건 양쪽 같다.

### 에이전트를 클래스로 만드는 이유

```python
class CollectorAgent:
    """RSS 피드를 수집하는 에이전트"""

    def __init__(self, llm):
        self.llm = llm

    def functionA(self):
        """필요한 함수들"""

    # 노드로 사용할 함수. 나중에 workflow의 node로 사용
    def collect_rss(self, state: StateA) -> StateA:
        """RSS 피드를 수집하고 상태를 업데이트"""

class CommunicatorAgent:
    """AI팀의 진행상황을 사용자에게 보고하고, 사용자의 의견을 파악하는 에이전트"""

    def __init__(self, llm):
        self.llm = llm

    def communicate(self, state: StateA) -> StateA:
        print("\n\n====== COMMUNICATOR ======")
        return {}
```

오늘 제일 중요한 대목이었다. 노드 함수는 `state` 하나만 받아야 하는데 노드 안에서 LLM을 부르려면 `llm`도 필요하다. 어제는 이걸 바깥 함수가 `model`을 붙잡아두는 클로저로 풀었다. 클래스를 쓰면 같은 일이 저절로 된다. `collector = CollectorAgent(llm)`으로 만들면 `collector.collect_rss`는 이미 `self`가 끼워진 바운드 메서드라 남은 빈칸이 `state` 하나뿐이다. 파이썬이 `collector.collect_rss(state)`를 `CollectorAgent.collect_rss(collector, state)`로 바꿔 부르기 때문이다. LangGraph 눈에는 노드 함수와 똑같이 생겨서 `workflow.add_node("collector", collector.collect_rss)`로 그대로 들어간다.

클래스가 클로저보다 나은 점은 `llm` 말고도 여러 개를 들고 있을 수 있고, 노드 함수를 여러 개 가질 수 있고, 노드가 아닌 도우미 함수를 같은 파일에 자연스럽게 둘 수 있다는 것이다. 이름을 보면 뉴스 기사를 모아오는 에이전트와 사람에게 보고하고 의견을 묻는 에이전트라, 앞에서 만든 검색 에이전트와 사람 루프가 합쳐질 모양이다.

반환 타입힌트가 `-> StateA`인 건 사실 정확하지 않다. 노드는 상태 전체가 아니라 바꿀 부분만 딕셔너리로 반환하니까 `-> dict`가 맞다. `return {}`는 상태를 하나도 안 바꿨다는 뜻이고, docstring만 있는 메서드는 `None`을 반환해서 LangGraph가 바꿀 게 없다고 보고 넘어간다. 그래서 뼈대 상태로도 그래프가 돈다.

### workflow.py와 main.py

```python
# workflow.py
def create_workflow(llm: ChatOpenAI) -> StateGraph:
    communicator = CommunicatorAgent(llm)
    collectorAgent = CollectorAgent(llm)

    workflow = StateGraph(StateA)

    workflow.add_node("collector", collector.collect_rss)
    workflow.add_node("communicator", communicator.communicate)

    # edge 연결

    return workflow.compile()

# main.py
def main():
    llm = ChatOpenAI(model=Config.MODEL_NAME)
    graph = create_workflow(llm)

    initial_state = StateA()
    graph.invoke(initial_state)

if __name__ == "__main__":
    main()
```

`workflow.py`에는 무엇을 하는지가 없고 누가 무슨 순서로 도는지만 있다. 수집 로직을 고치려면 `agents/collector.py`만, 순서를 바꾸려면 여기만 열면 된다. `llm`을 인자로 받는 것도 하위 그래프를 인자로 받던 것과 같은 생각이다. 좋은 `main.py`는 짧아서 읽는 사람이 5초 만에 LLM 만들고 그래프 만들어서 돌린다는 걸 알 수 있어야 한다.

오늘 뼈대는 돌리면 바로 막히는 곳이 몇 군데 있었다.

- 변수는 `collectorAgent`인데 `collector.collect_rss`를 써서 `NameError`가 난다. `communicator`와 짝이 맞게 `collector = CollectorAgent(llm)`으로 이름을 맞춘다.
- `from agents import CollectorAgent, CommunicatorAgent`는 `agents/__init__.py`가 없어서 `ImportError`다. 주석 처리된 `from agents.collector import CollectorAgent`를 살리거나, `__init__.py`에 `from .collector import CollectorAgent`를 적어둔다. 에이전트가 늘어날 걸 생각하면 `__init__.py` 쪽이 깔끔하다.
- 에지가 하나도 없어서 `START`에서 갈 곳이 없으니 `compile()`이 거부한다. `START → collector → communicator → END`를 이어야 한다.
- `main.py`의 `from utils import *`는 이름이 전부 쏟아져 들어와서 나중에 충돌할 수 있다. 필요한 것만 이름을 적어 가져오는 게 무엇이 어디서 왔는지 알 수 있어서 낫다.

## 헷갈리기 쉬운 부분
- 기억의 정체는 `model.invoke(state['messages'])`로 매번 대화 전체를 다시 보내는 것이다. 체크포인터는 그 목록을 보관할 뿐이다.
- `create_graph()` 안에 `InMemorySaver()`가 있으면 부를 때마다 저장소가 새로 생긴다. 그래프는 루프 밖에서 한 번 만든다.
- `stream_mode="messages"`는 `(chunk, metadata)` 두 개를 내놓는다. `values`와는 나오는 것 자체가 달라서 반복문 전체를 고쳐야 오갈 수 있다.
- 스트리밍 출력은 `if chunk.content:`로 빈 조각을 거르고 `flush=True`를 붙인다. 도구가 있는 그래프는 `isinstance(msg, AIMessageChunk)`로 LLM 말만 고른다.
- `@tool`을 붙이면 `StructuredTool` 객체가 되고 `.invoke({"인자": 값})`로 부른다.
- 조건부 에지의 판정 함수가 반환하는 건 라벨이고, 매핑 딕셔너리가 실제 노드로 옮긴다. 딕셔너리를 생략하면 라벨이 곧 노드 이름이다.
- 몇 바퀴 돌지는 코드가 아니라 프롬프트가 정한다. 순서와 멈출 조건을 프롬프트에 적는다.
- 루프 변수로 바깥 변수를 덮어쓰면 화면은 멀쩡한데 반환값이 틀린다.
- 컴파일된 그래프는 그대로 노드가 된다. 조건은 상태 스키마가 같을 것이고, 다르면 함수로 감싸 번역한다.
- `START`에서 바로 분기할 수 있다. 키워드 라우팅은 공짜지만 글자가 맞아야만 한다.
- 붙어 다니는 단계는 도구 하나로 묶는다.
- 노드에 LLM을 넘기는 방법은 클로저와 클래스 두 가지이고, 클래스의 바운드 메서드는 `state` 하나만 받는 함수로 보인다.
- 프로젝트 의존은 `main → workflow → agents → state` 한쪽으로만 흐르게 한다.

## 오늘 배운 내용 정리
오늘은 메시지 상태로 짧아진 챗봇에 스트리밍을 붙이고, `@tool` 검색 도구로 기사 작성 에이전트를 돌리고, 하위 그래프와 에이전트 프로젝트 구조를 배웠다.

```
03b 메시지 상태: messages: Annotated[list, add_messages] → 노드 한 줄. InMemorySaver는 그래프 한 번만 생성.
               stream(..., stream_mode="messages") → (chunk, metadata). values/updates/messages 세 모드.
06b @tool: StructuredTool(.name, .description, .args_schema, .invoke). DuckDuckGo 검색 도구.
           lambda 판정 → {"tool_node": "tools", END: END} 라벨 매핑. AIMessageChunk만 출력.
           프롬프트가 루프 횟수를 정한다. 루프 변수 덮어쓰기 버그.
08 하위 그래프: add_node("weather_expert", 컴파일된 그래프). 상태 스키마 일치. 독립 테스트.
              add_conditional_edges(START, router, ...). 키워드 라우팅. get_graph(xray=True).
09 프로젝트 구조: config / state / tools / utils / workflow / main + agents/.
                에이전트 클래스의 바운드 메서드 = 노드. workflow.py는 조립만.
```

어제 노트북들은 새 문법을 하나씩 배우는 느낌이었다면, 오늘은 같은 부품을 다르게 쓰는 법을 배운 느낌이었다. 신문기사 챗봇은 그래프 코드가 어제와 거의 같은데 프롬프트 하나로 검색을 대여섯 번 돌았고, 하위 그래프는 새 API가 아니라 "컴파일된 그래프도 상태를 받아 상태를 돌려준다"는 사실 하나로 설명됐다. 가장 기억에 남은 건 어제 클로저로 어렵게 풀었던 "노드는 state 하나만 받아야 한다" 문제가 클래스로 만들면 바운드 메서드 덕분에 저절로 풀린다는 부분이다. 파이썬에서 늘 쓰던 `self`가 여기서 이렇게 쓰일 줄은 몰랐다.

---
