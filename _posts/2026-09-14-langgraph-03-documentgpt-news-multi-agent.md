---
layout: single
title: "LangGraph 기초 정리 3 - LangGraph로 다시 짠 DocumentGPT, 뉴스 멀티 에이전트 파이프라인"
categories: [coding, LangGraph]
tag: [study-log, LangGraph, Streamlit, RAG, checkpointer, multi-agent, asyncio, RSS]
toc: true
author_profile: false
sidebar:
    nav: "docs"
search: true
---
<hr/>

LangGraph 단원의 마지막 날이었다. 오전에는 예전에 스트림릿으로 만들었던 DocumentGPT를 LangGraph로 다시 짜서, 대화 기억을 손으로 관리하지 않고 체크포인터에 맡겼다. 오후에는 지난주에 빈 뼈대만 만들어둔 에이전트 프로젝트를 채워서, 구글 뉴스를 수집하고 요약하고 분류해서 마크다운 리포트로 뽑는 에이전트 네 개짜리 파이프라인을 실제로 돌렸다. 둘 다 새 문법은 거의 없었고, 그동안 배운 것을 실제 프로그램에 붙이면서 생기는 문제를 많이 만났다.

## LangGraph로 다시 짠 DocumentGPT
예전 DocumentGPT는 파일을 올리면 쪼개서 임베딩하고 FAISS에 넣어 `retriever`를 만들고, 질문이 오면 문서 조각을 찾아 프롬프트에 끼워 LLM이 답하는 구조였다. 여기에 지난 대화를 기억하게 하려면 대화 기록이 필요한데, LangChain v1으로 넘어오면서 `ConversationBufferMemory` 같은 Memory 객체가 대부분 사라졌다. 대화 기록 리스트를 직접 만들어 매 턴 `append`하고 프롬프트에 넣거나, 그래프에 체크포인터를 붙이고 맡기는 수밖에 없다. 앞의 방식은 한 번 빼먹으면 챗봇이 갑자기 기억을 잃고 어디서 빠졌는지 찾기도 어렵다. 오늘은 뒤의 방식으로 다시 짰다. DocumentGPT를 그래프로 만들 수 있으면 기억은 설정 한 줄로 딸려 온다.

### 스트림릿은 매번 처음부터 다시 실행한다
이걸 모르면 오늘 코드의 절반이 이해가 안 된다. 일반 웹 서버는 요청이 오면 함수 하나만 실행하는데, 스트림릿은 채팅창에 엔터를 누르거나 버튼을 누르거나 파일을 올릴 때마다 파일 전체를 1번 줄부터 다시 실행한다. 그러면 `checkpointer = InMemorySaver()`를 그냥 두면 매 턴 새 저장소가 생겨서 기억이 매번 백지가 된다. `InMemorySaver`는 이름 그대로 변수에 기록을 담으니까, 변수가 새로 만들어지면 기록도 같이 사라진다.

그래서 그래프를 만드는 함수를 `@st.cache_resource`로 감쌌다. 이 함수의 결과를 앱이 살아 있는 동안 한 번만 만들고 그 뒤로는 같은 것을 돌려주라는 뜻이다. 그래프, DB 연결, 모델처럼 한 번 만들어 계속 쓰는 무거운 것에 붙이고, 데이터프레임이나 API 응답 같은 값은 `@st.cache_data`로 캐시한다. `cache_data`는 복사본을 주고 `cache_resource`는 원본 그대로 줘서, 원본 하나를 공유해야 하는 그래프는 `cache_resource`가 맞다.

### 체인을 retrieve와 generate 두 노드로

```python
class GraphState(BaseModel):
    question: str = Field(default="", description="이번 턴의 사용자 질문")
    context: str = Field(default="", description="retriever 가 찾아온 문서 내용")
    answer: str = Field(default="", description="이번 턴의 최종 답변")
    messages: Annotated[list, add_messages] = Field(
        default_factory=list,
        description="누적되는 대화 내역 (= 메모리)",
    )

def retrieve(state: GraphState) -> Dict[str, Any]:
    """검색 노드 : 업로드한 파일에서 관련 문서 조각을 찾아 context를 업데이트"""
    retriever = st.session_state['retriever']
    docs = retriever.invoke(state.question)
    return {"context": format_docs(docs)}

def generate(state: GraphState) -> Dict[str, Any]:
    """답변 노드 : context + 대화 내역으로 LLM이 답변"""
    chain = prompt | llm
    response = chain.invoke({
        "context": state.context,
        "history": state.messages,               # ← 체크포인터가 채워준 기록
        "question": state.question,
    })
    return {
        "answer": response.content,
        "messages": [
            HumanMessage(content=state.question),
            AIMessage(content=response.content),
        ],
    }
```

한 덩어리였던 LCEL 체인이 재료 찾기와 조리하기 두 칸으로 나뉘었다. 노드는 바꿀 필드만 돌려줘서 `retrieve`가 `context`만 반환해도 `question`이나 `messages`는 그대로 남는다.

상태 안에서 `question`, `context`, `answer`는 이번 턴만 쓰는 작업대라 턴이 바뀌면 새 값으로 덮어써지고, `messages`는 `add_messages`가 뒤에 이어 붙이는 계속 쌓이는 기록이다. `add_messages`가 없으면 `messages`도 덮어써져서 새 대화 두 줄만 남는다.

`generate`가 `messages`에 질문과 답 두 개를 넣는 게 처음엔 이상했는데, 사용자 질문은 그래프 바깥에서 들어오기 때문이다. 스트림릿은 `app.invoke({"question": message}, config)`로 `question` 필드에만 값을 넣고 `messages`에는 아무도 안 넣어준다. 그래서 노드가 직접 질문과 답을 짝으로 넣어야 다음 턴에 "아까 내가 뭘 물어봤지"가 남는다.

### 그래프와 실행

```python
@st.cache_resource(show_spinner="Building graph...")
def create_graph():
    checkpointer = InMemorySaver()
    workflow = StateGraph(GraphState)

    workflow.add_node("retrieve", retrieve)
    workflow.add_node("generate", generate)

    workflow.add_edge(START, "retrieve")
    workflow.add_edge("retrieve", "generate")
    workflow.add_edge("generate", END)

    return workflow.compile(checkpointer=checkpointer)

app = create_graph()
config = {"configurable": {"thread_id": ...}}

if message:
    send_message(message, 'human')
    with st.chat_message('ai'):
        app.invoke({"question": message}, config)
```

`{"question": message}`만 넘겼는데 `generate` 안의 `state.messages`에 지난 대화가 들어 있다. 체크포인터가 `thread_id`로 지난 스냅샷을 찾아 합쳐놓은 뒤 노드를 부르기 때문이다. 그리고 `invoke()`의 반환값을 아무 데도 안 쓰는데 답이 화면에 나온다. `ChatCallbackHandler`가 LLM이 토큰을 뱉을 때마다 `on_llm_new_token`으로 `st.empty()` 자리에 글자를 이어 그려서, 답은 이미 스트리밍으로 그려진 상태다.

`@st.cache_resource`를 빼보면 질문에 답은 잘 하는데 "방금 내가 뭐라고 했지?"에는 모른다고 한다. 기억을 못 하는 챗봇을 보면 프롬프트보다 먼저 그래프가 매번 새로 만들어지고 있지 않은지 의심해야 한다.

### thread_id에 붙은 따옴표

```python
config = {"configurable": {"thread_id": "st.session_state['thread_id']"}}
```

복습하다가 찾은 건데, `st.session_state['thread_id']`가 따옴표 안에 들어가 있어서 값을 꺼내는 게 아니라 그 글자 그대로의 문자열이 `thread_id`로 쓰인다. 그런데 값이 무엇이든 매 턴 같은 값이기만 하면 같은 대화로 이어지니까, 챗봇은 멀쩡히 기억하는 것처럼 보인다. 그래서 눈치채기 어렵다.

실제로 망가진 건 대화를 갈아 끼우는 기능이다. 코드는 파일을 내리면 `st.session_state['thread_id'] = f'documentgpt-{time.time()}'`로 새 번호를 발급해서 새 대화로 시작하려고 했는데, `config`가 그 값을 안 쓰니 체크포인터는 계속 같은 칸을 본다. 화면에 보이는 대화(`st.session_state['messages']`)는 비워지는데 LLM이 받는 기록(체크포인터의 `messages`)은 안 비워져서, 새 파일을 올려도 이전 파일에 대한 대화를 기억한 채로 답한다. 따옴표를 지우면 의도대로 된다.

| 어디 | 무엇을 위한 것 | 누가 채우나 |
|---|---|---|
| `st.session_state['messages']` | 화면에 다시 그리기 (`paint_history`) | `save_message()`, 콜백 핸들러 |
| 체크포인터의 `state.messages` | LLM에게 넘기기 (`MessagesPlaceholder`) | `generate` 노드의 반환값 |

이 코드에는 대화 기록이 두 벌 있다는 걸 알아두면 이런 어긋남을 찾기 쉬워진다.

그 밖에 본 것들이다.

- `retrieve`가 아래쪽에 정의된 `format_docs`를 쓰는데 잘 돈다. 파이썬은 함수 몸통 안의 이름을 정의 시점이 아니라 호출 시점에 찾고, `retrieve`가 실제로 불릴 때는 이미 정의돼 있기 때문이다.
- `print(f'... {time.strftime('%Y-%m-%d %H:%M:%S')}')`처럼 f-문자열 안팎에 같은 따옴표를 쓴 줄은 3.12부터 허용된 문법이라, 3.11 서버에 올리면 실행조차 안 된다. 안쪽을 큰따옴표로 바꾸면 어디서나 돈다.

## 뉴스 멀티 에이전트 파이프라인
지난주에 만든 에이전트 프로젝트는 몸통이 빈 메서드와 필드 없는 `StateA`로 된 뼈대였다. 오늘은 그 칸을 실제 코드로 채워서 실제 구글 뉴스 29건을 수집, 요약, 분류해서 마크다운 리포트를 뽑았다.

수집은 웹을 긁고, 요약과 분류는 LLM을 부르고, 리포트는 문자열을 조립하는 성격이 전혀 다른 일들이다. 노드 함수 하나에 다 넣으면 400줄짜리 함수가 되고, 함수로만 쪼개면 누가 누구를 부르는지가 여기저기 흩어진다. 그래서 일하는 사람과 일 시키는 순서를 갈라놨다. 일은 `agents/` 안의 클래스 넷이 하고 순서는 `workflow.py`가 정한다.

### 비동기를 쓰는 이유
오늘 코드에는 `async`, `await`, `asyncio.gather`가 계속 나왔다. 라면 30개를 하나씩 끓여 먹고 다음 걸 끓이는 게 아니라 냄비 30개를 동시에 올려놓고 기다리는 것이다. 뉴스 하나를 처리하는 시간의 대부분이 네트워크 응답을 기다리는 시간이고 그동안 CPU는 논다. `await`는 여기서 기다려야 하니 그동안 다른 일을 하라는 양보 표시이고, `asyncio.gather(*tasks)`는 이 일들을 다 걸어놓고 전부 끝날 때까지 기다리라는 뜻이다. 동시에 걸면 가장 느린 하나만큼만 기다리면 된다. LangGraph 병렬 노드에서 본 것과 같은 원리다.

### 상태 - 네 에이전트가 공유하는 게시판

```python
class NewsState(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)

    messages: Annotated[list[BaseMessage], add_messages] = []
    raw_news: list[dict[str, Any]] = []                        # collector 가 채움
    summarized_news: list[dict[str, Any]] = []                 # summarizer 가 채움
    categorized_news: dict[str, list[dict[str, Any]]] = {}     # organizer 가 채움
    final_report: str = ""                                     # reporter 가 채움
    error_log: list[str] = []
```

| 노드 | 읽는 칸 | 쓰는 칸 |
|---|---|---|
| `collect` | (없음) | `raw_news` |
| `summarize` | `raw_news` | `summarized_news` |
| `organize` | `summarized_news` | `categorized_news` |
| `report` | `raw_news`, `categorized_news`, `error_log` | `final_report` |

네 에이전트는 서로를 부르지 않는다. `collector`는 `summarizer`가 있는지도 모르고, 각자 자기 칸에 결과를 적고 앞사람 칸을 읽을 뿐이다. 이 표가 이 프로젝트의 전부였다. 앞 노드가 쓴 칸을 뒷 노드가 읽는 사슬이 끊기면 그 뒤는 에러 없이 빈 채로 돌아서 조용히 빈 리포트가 나온다.

`arbitrary_types_allowed=True`는 Pydantic이 모르는 `BaseMessage` 같은 LangChain 타입도 필드로 받게 해주는 설정이다. 대신 그 필드는 값 검사를 안 한다. 그리고 `summarized_news`는 새 자료구조가 아니라 원본 딕셔너리에 `ai_summary` 키 하나를 더한 것이라, 리포트 단계에서도 `source`, `title`, `original_url` 같은 수집 단계 정보가 그대로 살아 있다.

```python
return {**news_item, "ai_summary": summary or content}   # 원본을 펼치고 키 하나를 더한다
```

### 수집 - 구글 뉴스의 숨겨진 주소

```python
self.rss_url = f"{GOOGLE_NEWS_BASE_URL}/rss?hl=ko&gl=KR&ceid=KR:ko"
self.feed = feedparser.parse(self.rss_url)
```

RSS 자체는 `feedparser`로 세 줄이면 읽히는데, RSS에 든 링크가 구글 뉴스의 중계 주소라는 게 문제였다. 그 주소로 들어가면 자바스크립트가 실제 언론사 주소로 넘겨주는데, `httpx` 같은 HTTP 클라이언트는 자바스크립트를 실행하지 않아서 진짜 주소를 못 얻는다. 그래서 `extract_article_url()`이 그 일을 파이썬으로 흉내 낸다. 중계 페이지에서 `c-wiz[data-p]` 안의 데이터를 꺼내고, 구글 내부 API(`batchexecute`)가 받는 모양으로 바꿔 브라우저인 척 요청을 보내고, 중첩된 배열 응답에서 `json.loads(response_data[0][2])[1]`로 주소를 꺼낸다. 이 숫자들은 구글이 문서화하지 않은 내부 형식이라 구글이 바꾸면 내일 안 돌아간다. 공식 API가 없으면 이런 걸 해야 하고, 그래서 깨지기 쉽다는 것만 알아두면 된다.

```python
downloaded = trafilatura.fetch_url(original_url)
content = trafilatura.extract(downloaded, include_comments=False,
                              include_images=False, include_links=False,
                              target_language="ko")
```

본문은 `trafilatura`가 헤더, 광고, 추천기사, 댓글을 걷어내고 기사 본문만 남겨준다. BeautifulSoup으로 직접 하려면 언론사마다 태그 구조가 달라서 규칙을 수십 개 써야 한다. 다만 조선일보는 리액트 기반 프레임워크라 본문이 HTML 태그가 아니라 `Fusion.globalContent`라는 자바스크립트 변수 안의 JSON에 들어 있어서 전용 함수를 따로 만들었다.

```python
tasks = [self.parse_entry(entry) for entry in self.feed.entries]
raw_news = await asyncio.gather(*tasks, return_exceptions=True)

state.raw_news = [r for r in raw_news if not isinstance(r, Exception)]
```

마지막으로 기사 30개를 한꺼번에 걸었다.

### 요약과 분류 - 묶음으로 나누어 보내기

```python
for i in range(0, total_news, batch_size):          # 10개씩 끊어서
    batch = raw_news[i: i + batch_size]

    batch_num = i // batch_size + 1
    total_batches = (total_news + batch_size - 1) // batch_size    # 올림 나눗셈
    print(f"  배치 {batch_num}/{total_batches} 처리 중...")

    tasks = [self.summarize_single_news(news) for news in batch]
    batch_results = await asyncio.gather(*tasks)    # 묶음 안은 동시에
    summarized_news.extend(batch_results)           # 묶음끼리는 순서대로
```

`summarizer`와 `organizer`가 똑같은 모양의 루프를 쓰는데, 이 패턴이 오늘의 핵심이었다. LLM API에는 분당 호출 제한이 있어서 30개를 동시에 던지면 `429 Too Many Requests`가 떨어지고 요약이 안 된 채로 다음 단계로 넘어간다. 그렇다고 하나씩 보내면 한 번에 2초씩 30개면 60초가 쌓인다. 그래서 10개씩 묶어서 묶음 안은 동시에, 묶음끼리는 순서대로 보낸다. 30개면 대략 세 번의 대기로 끝나면서 서버에도 한 번에 10개씩만 간다. `(total + size - 1) // size`는 올림 나눗셈 관용구로, 25개를 10씩 나누면 `(25 + 9) // 10 = 3`이다.

```python
if not content or len(content) < 50:
    return {**news_item, "ai_summary": content}      # 짧으면 LLM 을 부르지 않는다
```

본문이 50자도 안 되면 요약할 게 없으니 LLM을 안 부른다. LLM 호출은 돈과 시간이 드니까 부르기 전에 부를 가치가 있는지 먼저 본다.

```python
if category in Config.NEWS_CATEGORIES:
    categorized[category].append(news_item)
else:
    categorized['기타'].append(news_item)      # 목록 밖이면 여기로
```

분류는 프롬프트에 반드시 이 중 하나만 고르라고 적어도 LLM이 `"경제/금융"`이나 `"이 뉴스는 경제입니다"`처럼 답할 수 있어서, 받은 답을 목록과 대조한다. `Config.NEWS_CATEGORIES` 맨 끝의 `"기타"`는 카테고리가 하나 더 있는 게 아니라 어디로도 못 가는 것을 받아줄 칸이다. 감정 분석 라우팅에서 이상한 값을 `neutral`로 떨어뜨렸던 것과 같은 방어다. 더 강하게 막으려면 `Literal`로 정한 Pydantic 모델을 `with_structured_output`으로 묶는다. `categorized`는 `defaultdict(list)`라 처음 만지는 키도 `KeyError` 없이 빈 리스트가 생기고, 마지막에 `dict(categorized)`로 평범한 딕셔너리로 되돌려 상태에 넣는다.

### 리포트 - 여기엔 LLM이 없다

```python
reporter = ReportGeneratorAgent()      # llm 을 안 받는다

if news_list := state.categorized_news.get(category):
    ...
```

`ReportGeneratorAgent`는 LLM을 한 번도 안 부르고 생성자에서 `llm`도 안 받는다. 헤더, 통계 표, 카테고리별 기사 목록, 에러 로그, 푸터를 만들어 `"\n\n---\n\n"`로 이어 붙이는 문자열 조립뿐이다. 에이전트라는 이름이 붙었다고 전부 AI인 건 아니고, 여기서 에이전트는 상태의 한 칸을 책임지는 담당자라는 뜻이다. 형식이 정해진 일을 LLM에게 시키면 매번 결과가 달라져서 오히려 나쁘다. `:=`는 지난주 메모리 봇에서도 봤던 왈러스 연산자로, 값을 변수에 넣으면서 참/거짓 검사까지 한 줄로 한다.

### 조립과 실행

```python
workflow.add_node("collect", collector.collect_rss)      # 에이전트 메서드 = 노드
workflow.set_entry_point("collect")
workflow.add_edge("collect", "summarize")                # 순서는 여기에만 적는다
...
final_state = await graph.ainvoke(initial_state)
print(final_state["final_report"])
```

`set_entry_point("collect")`는 `add_edge(START, "collect")`와 같은 뜻이다. 에이전트가 상태로만 만나니까 순서를 바꾸거나 중간에 하나를 끼워 넣을 때 `workflow.py` 한 곳만 고치면 된다.

여기서 제일 헷갈렸던 건 `ainvoke()`의 결과가 `NewsState`가 아니라 dict라는 점이었다. `test.py`에서 에이전트 메서드를 직접 부를 때는 우리가 만든 `state` 객체가 그대로 남아서 `state.final_report`로 꺼냈는데, `main.py`에서 그래프로 돌리면 필드들을 딕셔너리로 펴서 돌려준다. 그래서 `final_state["final_report"]`, `final_state.get("summarized_news", [])`처럼 꺼내야 하고 점으로 쓰면 `AttributeError: 'dict' object has no attribute 'final_report'`가 난다. 첫날 배운 "넣을 땐 객체, 받을 땐 딕셔너리"가 그대로였다. 그래프 안에서는 `state.필드`, 그래프 밖에서는 `결과["필드"]`다.

### 기사 하나가 조용히 사라진 이유
두 번 돌린 리포트가 30건, 29건으로 달랐다. 범인은 `asyncio.gather(*tasks, return_exceptions=True)` 다음 줄이었다. `return_exceptions=True`는 하나가 터져도 전체를 멈추지 말고 예외 객체를 결과 자리에 담으라는 뜻인데, 그다음 줄이 그 예외들을 걸러내서 실패한 기사가 에러 메시지도 로그도 없이 사라진다. 이 옵션이 없으면 30개 중 1개 때문에 수집 전체가 끝나니까 있는 게 낫지만, "왜 29건이지?"에 답할 정보가 남지 않는다. 예외를 걸러낼 때 `state.error_log.append(f"parse_entry 실패: {r}")`로 흔적을 남기면, 리포터가 에러 로그를 리포트 맨 뒤에 찍어주니까 몇 건이 왜 빠졌는지 알 수 있다.

그리고 실제로 빠지는 기사가 있었던 이유도 찾았다.

```python
class RSSCollectorAgent:
    ...
    def extract_chosun_content(html_content):        # ← self 가 없다
        ...

content = self.extract_chosun_content(downloaded)
```

파이썬은 `self.`로 부른 메서드에 인스턴스를 첫 번째 인자로 자동으로 넣으니까, `html_content` 자리에 `self`가 들어가고 `downloaded`는 받을 자리가 없어서 `TypeError: ... takes 1 positional argument but 2 were given`이 난다. 즉 조선일보 기사는 반드시 실패하고, 그 실패는 `return_exceptions=True`에 먹혀서 조용히 사라진다. 두 함정이 겹쳐서 증상이 "기사 수가 가끔 하나씩 모자람"으로만 나타났다. 이 함수는 `self`를 안 쓰니까 `@staticmethod`를 붙이는 게 의도에 맞다. 지난주에 바운드 메서드가 `self`를 자동으로 채워줘서 노드가 된다고 배웠는데, 같은 성질이 여기서는 버그가 됐다.

### 그 밖에 만나본 것들
에이전트들은 `state.summarized_news = ...`로 고치고 `state.messages.append(AIMessage(...))`한 다음 `return state`로 통째로 돌려준다. `messages`에 `add_messages`가 붙어 있으니 이미 있던 목록에 통째로 돌려준 목록을 또 이어 붙여서 중복될 것 같았는데, 같은 구조로 확인해보니 메시지가 세 개로 겹치지 않았다. `add_messages`가 메시지마다 붙은 id를 보고 같은 것은 갈아끼우기 때문이다. 같은 실험에서 LangGraph가 노드에 상태의 복사본을 준다는 것도 확인했다. 노드가 `state`를 제자리에서 고쳐도 바깥 원본은 안 바뀌고, 값이 전달되는 건 반환값 덕분이다. 오전 DocumentGPT는 바꿀 필드만 담은 dict를, 오후 프로젝트는 `state` 통째로를 반환하는데 둘 다 돌아간다. 같은 프로젝트 안에서는 한쪽으로 통일하는 게 읽기 좋겠다.

- `load_dotenv()`는 `class Config`보다 위에 있어야 한다. `OPENAI_API_KEY = os.getenv(...)`는 클래스 몸통이라 import되는 순간 한 번만 실행되고, 그때 `.env`가 안 읽혔으면 빈 문자열이 영원히 박힌다. `.env`에 키가 분명히 있는데 `Config.validate()`가 없다고 하면 이걸 의심한다.
- 모듈들이 `from state import NewsState`처럼 패키지 이름 없이 서로를 부르는데, 이건 실행한 스크립트가 있는 폴더를 기준으로 찾기 때문에 된다. `python main.py`로는 되지만 `import AgentProject.main`처럼 바깥에서 부르면 `ModuleNotFoundError: No module named 'state'`가 난다. 지금은 프로젝트 폴더 안에서 `python main.py`로 실행한다는 것만 지키면 된다.

## 헷갈리기 쉬운 부분
- 스트림릿은 입력이 있을 때마다 스크립트 전체를 다시 실행한다. 체크포인터가 든 그래프는 `@st.cache_resource`로 한 번만 만든다.
- 기억을 못 하는 챗봇을 보면 프롬프트보다 먼저 그래프가 매번 새로 만들어지는지 의심한다.
- `invoke()`에 `messages`를 안 넘겨도 체크포인터가 `thread_id`로 지난 스냅샷을 합쳐서 노드에 준다.
- 그래프 밖에서 들어온 질문은 노드가 직접 `HumanMessage`로 넣어야 기록에 남는다. 질문과 답은 짝으로 넣는다.
- 상태 안에도 매 턴 덮어쓰는 칸과 `add_messages`로 쌓이는 칸이 따로 있다.
- 화면에 그리는 기록(`st.session_state`)과 LLM에게 넘기는 기억(체크포인터)은 다른 두 벌이다.
- `thread_id`가 매번 같은 값이기만 하면 기억은 돼 보인다. 대화를 바꾸는 기능이 망가졌는지는 따로 확인해야 한다.
- 에이전트는 서로를 부르지 않고 상태로만 만난다. 순서는 `workflow.py`에만 적는다.
- LLM 대량 호출은 묶음 안은 동시에, 묶음끼리는 순서대로 보낸다.
- LLM이 준 답은 목록과 대조하고, 어디로도 못 가는 값을 받을 `"기타"` 칸을 미리 둔다.
- 에이전트라고 다 LLM을 쓰는 건 아니다. 형식이 정해진 일은 코드로 한다.
- `ainvoke()` 결과는 dict다. 그래프 안은 객체, 밖은 딕셔너리다.
- `return_exceptions=True`로 걸러낸 예외는 로그를 남기지 않으면 조용히 사라진다.
- 클래스 안의 함수에 `self`를 빼먹으면 `self.`로 부를 때 인자가 하나 더 들어간다. 인스턴스가 필요 없으면 `@staticmethod`다.
- `load_dotenv()`는 `os.getenv()`를 쓰는 클래스보다 먼저 부른다.

## 오늘 배운 내용 정리
오늘은 DocumentGPT를 LangGraph로 다시 짜서 기억을 체크포인터에 맡기고, 뉴스를 수집·요약·분류·리포트하는 에이전트 네 개짜리 파이프라인을 완성했다.

```
DocumentGPT2: RAG 체인 → retrieve(context) → generate(answer, messages: Human + AI 짝).
              GraphState: question/context/answer(매 턴) + messages: Annotated[list, add_messages](누적).
              @st.cache_resource로 그래프 한 번만 생성. invoke({"question": q}, config).
              thread_id 따옴표 버그 → 화면 기록과 LLM 기억이 어긋남.
뉴스 파이프라인: NewsState(raw_news → summarized_news → categorized_news → final_report, error_log).
               collect(feedparser + 구글 중계 주소 풀기 + trafilatura) → summarize → organize → report(LLM 없음).
               asyncio.gather + 10개씩 배치. 50자 미만은 LLM 생략. 목록 밖 카테고리는 "기타".
               ainvoke 결과는 dict. return_exceptions=True + self 누락 → 기사 하나가 조용히 사라짐.
```

LangGraph를 배우는 나흘 동안 처음에는 노드와 에지를 손으로 등록하는 게 체인보다 번거로워 보였는데, 오늘 두 프로그램을 만들고 나니 그래프로 만드는 이유가 보였다. DocumentGPT는 그래프가 되자 기억이 `compile()` 한 줄로 딸려 왔고, 뉴스 파이프라인은 에이전트끼리 서로를 몰라도 되니까 하나를 고칠 때 나머지를 신경 쓸 필요가 없었다. 가장 기억에 남은 건 기사가 29건, 30건으로 달라지던 이유를 따라가다가 `self` 하나 빠진 버그와 예외를 조용히 삼키는 옵션이 겹쳐 있었다는 걸 찾은 부분이다. 에러 없이 조용히 틀리는 게 가장 찾기 어렵다는 걸 오늘 세 번은 느꼈다.

---
