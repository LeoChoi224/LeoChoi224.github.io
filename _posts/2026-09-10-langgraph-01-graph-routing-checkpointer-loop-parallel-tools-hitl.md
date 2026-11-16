---
layout: single
title: "LangGraph 기초 정리 1 - 그래프, 조건부 라우팅, 체크포인터, 루프, 병렬, ToolNode, Human in the Loop"
categories: [coding, LangGraph]
tag: [study-log, LangGraph, LangChain, StateGraph, checkpointer, ToolNode, agent, human-in-the-loop]
toc: true
author_profile: false
sidebar:
    nav: "docs"
search: true
---
<hr/>

오늘부터 에이전트 단원이 시작됐고 첫 도구는 LangGraph였다. 지금까지 LangChain으로 `prompt | llm | parser`처럼 파이프로 이어 붙인 체인을 만들었는데, 이건 왼쪽에서 오른쪽으로 한 방향으로만 흐른다. "화났으면 A로, 아니면 B로" 같은 갈림길, "맞을 때까지 다시" 같은 되돌아가기, "이 셋은 동시에" 같은 갈라졌다 합치기, "여기서 사람 확인 받고 진행" 같은 멈췄다 재개하기는 파이프 기호로 표현할 수 없다. 오늘은 노트북 일곱 개를 따라가면서 이 넷을 하나씩 그래프로 그려봤다.

## 그래프와 State
그래프는 점과 선으로 관계를 그린 그림이고, 점을 노드, 선을 에지라고 부른다. 지하철 노선도에서 역이 노드, 역 사이 구간이 에지다. 그래프는 방향이 있느냐, 순환이 있느냐로 나뉘는데 LangGraph는 방향 그래프이고 순환도 허용한다. Airflow 같은 기존 워크플로 도구는 무한 반복을 막으려고 DAG(비순환)만 다루는데, LangGraph가 그 금지를 푼 건 에이전트가 원래 "생각한다 → 도구를 쓴다 → 결과를 보고 다시 생각한다"는 반복이기 때문이다. 오늘 뒤쪽 노트북 세 개가 전부 이 되돌아가는 화살표 이야기였다.

LangGraph는 LangChain을 대체하는 게 아니라 위에 얹는 것이다. 노드 안에서는 여전히 `ChatOpenAI`나 `prompt | llm`을 쓰고, LangGraph는 그 노드들을 어떤 순서로 실행할지만 맡는다.

### State - 노드들이 같이 쓰는 화이트보드

```python
class GraphState(BaseModel):
    name: str = Field(default="", description="사용자 이름")
    greeting: str = Field(default="", description="생성된 인사말")
    processed_message: str = Field(default="", description="처리된 최종 메세지")
```

State는 이 워크플로에서 오갈 데이터의 모양을 미리 정해둔 클래스다. 회의실 화이트보드처럼 노드가 하나씩 나와서 자기 칸을 채우고 들어가면, 다음 노드는 그걸 보고 시작한다. 수업에서는 Pydantic 모델로 만들었다. `description`은 지금 예제에서는 기능이 없고 사람이 읽는 주석 역할이다.

### 노드 - 바뀐 것만 돌려주는 함수

```python
def generate_greeting(state: GraphState) -> Dict[str, Any]:
    name = state.name or "손님"
    greeting = f"안녕하세요, {name}님!"
    return {"greeting": greeting}  # <- state 에서 "greeting" 값을 업데이트 하게 된다.

def process_message(state: GraphState) -> Dict[str, Any]:
    greeting = state.greeting                      # 앞 노드가 채운 값
    processed_message = f"{greeting} LangGraph 에 오신 것을 환영합니다!"
    return {"processed_message": processed_message}
```

노드는 `state` 하나만 받는 평범한 함수이고, 첫 예제는 구조만 보려고 LLM을 아예 안 썼다. 처음에 헷갈렸던 건 상태에는 필드가 셋인데 반환값에는 `greeting` 하나뿐이라는 점이었다. 나머지 둘은 그대로 남는다. LangGraph가 반환된 딕셔너리를 기존 상태에 병합해주는데, 딕셔너리의 `update()`와 같은 동작이다. 전체 상태를 다시 만들어 반환해도 되긴 하지만, 안 바뀐 필드까지 매번 적어야 해서 바꿀 것만 반환하는 게 표준이다.

### 에지와 compile()

```python
class WorkflowStep:
    GREETING = 'GREETING'
    PROCESSING = 'PROCESSING'

workflow = StateGraph(GraphState)
workflow.add_node(WorkflowStep.GREETING, generate_greeting)
workflow.add_node(WorkflowStep.PROCESSING, process_message)
workflow.add_edge(START, WorkflowStep.GREETING)
workflow.add_edge(WorkflowStep.GREETING, WorkflowStep.PROCESSING)
workflow.add_edge(WorkflowStep.PROCESSING, END)
app = workflow.compile()

final_state = app.invoke(initial_state)        # initial_state = GraphState(name=...)
print(f"\n결과 메세지: {final_state['processed_message']}")
```

`START`와 `END`는 입구와 출구를 표시하는 가상의 노드인데, 내부적으로는 `"__start__"`, `"__end__"`라는 문자열이다. 노드 이름도 결국 문자열이라 `add_edge("GREETING", "PROCESSING")`처럼 써도 똑같이 동작한다. `WorkflowStep` 클래스를 만든 건 오타 방지용이다. `"GREETNG"`라고 쳐도 문자열은 아무 경고를 안 주지만 `WorkflowStep.GREETNG`는 바로 에러가 난다.

`compile()` 전까지 `workflow`는 설계도일 뿐이라 실행할 수 없다. `compile()`은 도달할 수 없는 노드나 없는 노드를 가리키는 에지가 없는지 검증하고, 실행 가능한 `CompiledStateGraph`를 만든다. 이게 LangChain의 Runnable이기도 해서 `invoke()`, `stream()`, `batch()`를 그대로 쓴다.

그리고 넣을 때는 `GraphState(...)` 객체를 넣었는데 돌려받는 건 딕셔너리였다. 결과는 `final_state['processed_message']`처럼 대괄호로 꺼내야 하고, `final_state.processed_message`로 쓰면 `AttributeError`다.

그래프 그림은 `app.get_graph().draw_mermaid_png()`로 뽑는데, 이건 mermaid.ink라는 외부 서비스에 요청하는 방식이라 인터넷이 없으면 에러가 난다. 그래프 로직 문제가 아니다.

## 조건부 라우팅 - 감정에 따라 갈림길 고르기
01의 `add_edge`는 "무조건 다음은 여기"만 표현할 수 있다. 같은 그래프인데 입력에 따라 다른 길로 가려면 `add_conditional_edges`가 필요하다. 예제는 사용자 메시지의 감정을 분석해서 긍정, 부정, 중립 응답 노드 중 하나로 보내는 챗봇이었다.

```
START → analyze_emotion → ┬→ positive_response ─┐
                          ├→ negative_response ─┼→ END
                          └→ neutral_response ──┘
```

### 감정 분석 노드 - 한 단어만 시키기

```python
llm = ChatOpenAI(model="gpt-4o", max_tokens=10)

def analyze_emotion(state: EmotionBotState) -> Dict[str, Any]:
    message = state.user_message
    messages = [
        SystemMessage(content="당신은 감정 분석 전문가입니다. ... 'positive', 'negative', 'neutral' 중 하나로 감정을 분류해주세요. 답변은 반드시 하나의 단어만 출력하세요."),
        HumanMessage(content=f"다음 메시지의 감정을 분석해주세요: '{message}'"),
    ]
    response = llm.invoke(messages)
    emotion = response.content.strip().lower()

    # 유효성 검사
    if emotion not in ["positive", "negative", "neutral"]:
        emotion = "neutral"   # 기본값

    return {"emotion": emotion}
```

`max_tokens=10`은 단어 하나면 되는 분류라서 길게 답할 여지 자체를 없앤 것이다. 마지막 유효성 검사가 핵심인데, 프롬프트로 한 단어만 시켜도 모델은 `"Positive."`나 `"긍정적입니다"`처럼 답할 수 있다. 그런 값이 라우팅 함수로 흘러가면 갈 곳이 없어서 그래프가 멈추니, 예상 밖의 값은 전부 `neutral`로 떨어뜨린다. 실무에서는 `Literal["positive", "negative", "neutral"]` 필드를 가진 Pydantic 모델을 `with_structured_output`에 넘겨서 애초에 다른 답을 못 하게 막는 방법을 많이 쓴다고 한다.

### 라우팅 함수는 노드가 아니다

```python
def route_by_emotion(
    state: EmotionBotState
) -> Literal["positive_response", "negative_response", "neutral_response"]:
    emotion = state.emotion
    if emotion == "positive":
        return "positive_response"
    elif emotion == "negative":
        return "negative_response"
    else:
        return "neutral_response"

workflow.add_conditional_edges(
    "analyze_emotion",   # ① 출발 노드 이름
    route_by_emotion,    # ② 라우팅 함수
    {                    # ③ 라우팅 함수 결과 -> 분기 목적지 노드 매핑
        "positive_response": "positive_response",
        "negative_response": "negative_response",
        "neutral_response": "neutral_response",
    }
)
workflow.add_edge("positive_response", END)
workflow.add_edge("negative_response", END)
workflow.add_edge("neutral_response", END)
```

라우팅 함수는 노드와 생김새가 똑같아서(둘 다 `state` 하나를 받는다) 헷갈리기 쉬운데, 노드는 바꿀 상태를 `dict`로 돌려주고 라우팅 함수는 다음 노드 이름을 `str`로 돌려준다. 상태는 읽기만 하고 바꾸지 않는다. 그래서 `add_node()`로 등록하는 게 아니라 `add_conditional_edges`의 두 번째 인자로만 들어간다.

`Literal`은 반환값이 "문자열"이라는 데서 한 걸음 더 들어가 "이 세 문자열 중 하나"라고 값 자체를 못 박는다. 노드 이름은 전부 문자열이라 오타가 나도 실행 전까지 모르는데, 편집기가 빨간 줄로 잡아준다. 반환 타입에 `Literal`을 제대로 붙여두면 LangGraph가 그 힌트로 분기 후보를 알아내서 세 번째 인자를 생략해도 된다.

세 번째 인자인 매핑은 `{라우팅 함수가 반환한 값: 실제로 갈 노드 이름}`이다. 이번엔 양쪽이 똑같아서 왜 두 번 쓰는지 이해가 안 됐는데, 바로 다음 루프 예제에서 둘이 달라졌다. 응답 노드 셋은 LLM 없이 `random.choice`로 미리 적어둔 문장 하나를 고를 뿐이었다. 이번 주제가 라우팅이라 나머지를 일부러 단순하게 만든 것이다.

## 체크포인터 - 대화를 기억시키기
LLM은 아무것도 기억하지 않는다. "내 이름은 감귤이야"라고 말한 다음 "내 이름이 뭐였지?"라고 물으면 매 호출이 처음인 상태라 모른다. 기억하는 것처럼 보이는 챗봇은 누군가가 지난 대화를 매번 다시 실어 보내고 있는 것이다. LangChain 시절에는 그걸 직접 저장하고 불러오고 끼워 넣어야 했는데, LangGraph는 `compile()` 인자 하나로 끝낸다.

```python
from langgraph.checkpoint.memory import InMemorySaver

app = workflow.compile(checkpointer=InMemorySaver())       # ① 체크포인터 연결
config = {"configurable": {"thread_id": "orange_123"}}     # ② 세션 식별자
result = app.invoke({"user_message": "안녕"}, config)       # ③ 매번 config 전달
```

체크포인터는 게임의 세이브 포인트다. 노드가 끝날 때마다(정확히는 super-step마다) 그 시점의 상태 전체를 스냅샷으로 저장하고, 같은 대화가 이어지면 마지막 스냅샷 위에 새 입력을 얹는다. 덕분에 대화 이력 관리 코드를 안 써도 되고, 중간에 터져도 마지막 체크포인트부터 다시 시작할 수 있다.

| 클래스 | 저장 위치 | 언제 쓰나 |
|---|---|---|
| `InMemorySaver` | 프로그램 메모리 | 개발·테스트 (끝나면 사라짐) |
| `SqliteSaver` | SQLite 파일 | 1인용·소규모 |
| `PostgresSaver` | PostgreSQL | 실서비스 |

셋 다 `BaseCheckpointSaver`라는 같은 규격을 따라서, 개발할 때는 메모리로 하다가 배포할 때 Postgres로 바꿔 끼워도 나머지 코드는 안 고쳐도 된다.

`thread_id`는 카톡 대화방 번호 같은 것이다. 체크포인터가 내부적으로 `thread_id`를 키로 쓰는 저장소를 갖고 있어서, 같은 `thread_id`면 같은 대화, 다르면 남남이다. `config`는 `"configurable"`로 한 번 더 감싸야 하고, 그래프에 한 번 붙여두는 게 아니라 `invoke()`할 때마다 넘겨야 한다. 서버 하나가 사용자 천 명을 상대한다고 생각하면 당연한 설계다. `thread_id` 자리에 로그인한 사용자의 세션 ID를 넣으면 된다.

같은 `thread_id`로 여섯 번 이어서 말을 걸어봤다.

```python
conversations = [
    "안녕하세요!",
    "내 이름은 감귤이야",
    "김치찜을 좋아해",
    "해삼은 싫어해",
    "내 이름이 뭐였지?",
    "내가 좋아하는 것과 싫어하는 것은?",
]
for message in conversations:
    config = {"configurable": {"thread_id": "orange_123"}}
    result = app.invoke({"user_message": message}, config)
```

```
[5] 사용자: 내 이름이 뭐였지?
[5] 챗봇: 당신의 이름은 감귤입니다.
메모리: 이름=감귤, 호불호: {'likes': ['김치찜'], 'dislikes': ['해삼']}

[6] 사용자: 내가 좋아하는 것과 싫어하는 것은?
[6] 챗봇: 감귤님은 김치찜을 좋아하시고 해삼을 싫어하신다고 하셨어요.
```

저장 코드를 한 줄도 안 썼는데 기억이 이어졌다. 다만 기억이 완성되려면 하나가 더 필요했다. 노드가 지금까지 아는 이름과 호불호를 시스템 프롬프트에 적어주고, LLM에게 `response`, `new_name`, `new_likes`, `new_dislikes`를 JSON으로 답하게 시켜서 새로 알게 된 정보를 상태에 넣는다. 체크포인터가 상태를 실어 나르고 LLM이 그 상태를 갱신하는 짝이다. 이 예제는 대화 문장 전체가 아니라 뽑아낸 이름과 호불호만 기억한다.

```python
class MemoryBotState(BaseModel):
    user_message: str = Field(default="")
    user_name: str = Field(default="")
    user_preferences: Dict[str, Any] = Field(default_factory=dict)   # likes / dislikes
    response: str = Field(default="")

# 노드 안
preferences = state.user_preferences.copy()   # 사본!
...
return {"user_preferences": preferences}      # dict 사본을 세팅해야 상태 업데이트 됨! (마치 React!)
```

딕셔너리를 제자리에서 고치면 주소가 그대로라 LangGraph 입장에서는 바뀐 게 없어 보인다. 새 사본을 만들어 반환해야 이 필드가 바뀌었다고 인식한다. React에서 `push()` 대신 새 배열을 만들어 `setState`하는 것과 같은 이유다. `default_factory=dict`도 같은 맥락인데, `Field(default={})`로 쓰면 딕셔너리 하나를 모든 인스턴스가 나눠 쓰는 파이썬 함정에 빠져서 인스턴스마다 새로 만들어주도록 함수로 지정한 것이다.

노드 안에 `result.get('new_name') and (user_name := result['new_name'])`라는 줄이 있었는데, `and`의 단축 평가와 왈러스 연산자로 `if result.get('new_name'): user_name = result['new_name']`을 한 줄로 쓴 것이다. 호불호는 `setdefault("likes", []).extend(...)`로 키가 있든 없든 한 줄로 덧붙였다. 짧지만 읽기는 어려워서 남이 읽을 코드에는 `if`가 낫겠다.

그 밖에 주의할 것들이다.

- 체크포인터를 붙여놓고 `config`를 빠뜨리면 에러 대신 매번 새 대화로 동작한다. 에러가 안 나서 더 찾기 어렵다.
- `SqliteSaver.from_conn_string()`은 context manager를 돌려주므로 `with SqliteSaver.from_conn_string("checkpoints.sqlite") as checkpointer:`처럼 받아서 그 블록 안에서 써야 한다.
- `json.loads(response.content)`는 모델이 답을 마크다운 코드 블록으로 감싸서 주면 바로 실패한다. 오늘은 순수 JSON이 와서 괜찮았지만, `with_structured_output`이나 `JsonOutputParser`가 더 안전하다.

## 루프 - 될 때까지 되돌아가기
LangGraph에서 반복을 만드는 방법은 조건부 에지의 목적지를 이미 지나온 노드로 지정하는 것 하나뿐이다. 새 문법이 없다. 예제는 1~50 사이 숫자를 최대 5번 안에 맞히는 게임이었다.

```
START → setup → guess → check ─(playing)─→ guess (되돌아감)
                          └───(won/lost)──→ END
```

```python
class GuessGameState(BaseModel):
    target_number: int = Field(default=0, description="맞춰야 할 숫자")
    user_guess: int = Field(default=0, description="사용자 추측")
    attempts: int = Field(default=0, description="시도 횟수")
    max_attempts: int = Field(default=5, description="최대 시도 횟수")
    game_status: str = Field(default="playing", description="게임 상태")
    response: str = Field(default="", description="응답 메시지")
```

보통이라면 `while game_status == "playing" and attempts < max_attempts:`로 쓸 조건을, LangGraph에서는 상태에 저장해두고 라우팅 함수가 그걸 읽어서 판단한다. 반복문이 상태와 라우팅 함수로 나뉘어 흩어진 셈이다.

```python
def game_setup(state: GuessGameState) -> Dict[str, Any]:
    target = random.randint(1, 50)
    return {"target_number": target, "game_status": "playing", "attempts": 0,
            "response": f"1~50 사이의 숫자를 맞춰보세요! (최대 {state.max_attempts}회)"}

def user_guess(state: GuessGameState) -> Dict[str, Any]:
    guess = input("입력 :")
    return {"user_guess": int(guess), "attempts": state.attempts + 1}

def check_guess(state: GuessGameState) -> Dict[str, Any]:
    target, guess, attempts = state.target_number, state.user_guess, state.attempts
    if guess == target:
        return {"game_status": "won",  "response": f"정답! {guess}를 {attempts}번 만에 맞췄습니다!"}
    elif attempts >= state.max_attempts:
        return {"game_status": "lost", "response": f"게임 종료! 정답은 {target}이었습니다."}
    else:
        hint = "더 큰 수" if guess < target else "더 작은 수"
        remaining = state.max_attempts - attempts
        return {"game_status": "playing",
                "response": f"{guess}는 틀렸습니다. '{hint}'를 시도해보세요! (남은 기회: {remaining}회)"}

def route_game(state: GuessGameState) -> Literal["continue", "end"]:
    if state.game_status == "playing":
        return "continue"
    else:
        return "end"
```

`setup`은 루프에 들어가기 전에 딱 한 번 실행돼서 정답을 뽑고 시도 횟수를 0으로 만든다. 이게 루프 안에 있으면 매번 정답이 바뀌어 게임이 성립하지 않는다. 루프 전에 할 일과 매번 할 일을 나누는 게 루프 설계의 첫걸음이었다. `check_guess`는 세 갈래로 판정하지만 상태에 적는 건 `game_status` 하나고, `route_game`은 `won`과 `lost`를 똑같이 "끝"으로 묶어 두 갈래로 줄인다. 누가 이겼냐가 아니라 다음에 어디로 가냐만 판단한다.

```python
workflow.add_edge(START, "setup")
workflow.add_edge("setup", "guess")
workflow.add_edge("guess", "check")

workflow.add_conditional_edges(
    "check",
    route_game,
    {
        "continue": "guess",  # 게임 계속 -> 다시 추측 (루프!)
        "end":  END,          # 종료
    }
)
```

`"continue": "guess"` 한 줄이 루프의 전부다. 그리고 02에서 왜 두 번 쓰는지 몰랐던 매핑의 의미가 여기서 보였다. 라우팅 함수는 "계속할까 말까"라는 의미만 말하고, 그 의미를 어느 노드로 번역할지는 그래프를 조립할 때 정한다. 나중에 `guess` 노드 이름을 바꿔도 라우팅 함수는 안 고쳐도 된다.

```
입력 : 25  →  계속 진행: 더 큰 수      →  라우팅 체크: 상태=playing, 시도=1
입력 : 40  →  계속 진행: 더 작은 수    →  라우팅 체크: 상태=playing, 시도=2
입력 : 32  →  계속 진행: 더 큰 수      →  라우팅 체크: 상태=playing, 시도=3
입력 : 36  →  계속 진행: 더 작은 수    →  라우팅 체크: 상태=playing, 시도=4
입력 : 34  →  시도 횟수 초과!          →  라우팅 체크: 상태=lost, 시도=5

최종 결과: 게임 종료! 정답은 35이었습니다.
```

34와 36 사이로 좁혀놓고 5번을 다 써서 졌다. 한 번만 더 있었으면 맞혔을 것이다. 라우팅 체크가 `check`가 끝날 때마다 찍히고, 다섯 번째에 `lost`가 되자 비로소 `"end"`로 빠졌다.

`game_status`를 절대 `"playing"`이 아닌 값으로 안 바꾸면 그래프는 영원히 돈다. LangGraph가 기본 25번(`recursion_limit`)을 넘으면 `GraphRecursionError`를 내고 멈춰주긴 하지만, 그건 사고 방지용이지 설계가 아니다. 이 에러를 보면 탈출 조건이 잘못됐다고 읽으면 되고, 정말 더 돌아야 하면 `app.invoke(state, {"recursion_limit": 100})`처럼 늘린다. 그리고 `input()`이 노드 안에 들어 있어서 노트북에서는 되지만 웹 서버에서는 쓸 수 없다. 이 문제는 마지막 Human in the Loop에서 다시 만났다.

## 병렬 처리 - 갈랐다가 다시 모으기
에이전트가 느린 이유는 대부분 기다리는 시간이다. LLM 호출 몇 초, 외부 API 몇백 밀리초에서 몇 초. 날씨 2초, 뉴스 2.5초, 주식 3초를 순서대로 하면 7.5초인데, 이 셋은 서로 아무 상관이 없다. 서로 의존하지 않는 작업을 동시에 하면 시간은 더해지는 게 아니라 가장 느린 것 하나로 수렴한다.

```
                  ┌→ weather ─┐
START → coordinator → news ────→ aggregator → END
                  └→ stock ───┘
```

```python
workflow.add_edge("coordinator", "weather")   # ┐
workflow.add_edge("coordinator", "news")      # ├ 세 개가 동시에 실행 (팬아웃)
workflow.add_edge("coordinator", "stock")     # ┘
workflow.add_edge("weather", "aggregator")    # ┐
workflow.add_edge("news", "aggregator")       # ├ 셋 다 끝나야 실행 (팬인)
workflow.add_edge("stock", "aggregator")      # ┘
```

병렬을 켜는 문법은 따로 없다. 같은 출발점에서 `add_edge`를 여러 개 그으면 그게 병렬이다. 조건부 에지는 셋 중 하나만 고르는 갈림길이고, 일반 에지 여러 개는 셋 다 가는 갈래다. 팬인 쪽은 `aggregator`로 향하는 에지가 셋인데도 세 번 실행되지 않고, 세 노드가 전부 끝날 때까지 기다렸다가 한 번만 실행된다. 직접 짰다면 스레드 세 개를 만들고 `join()`으로 기다렸어야 할 동기화를 LangGraph가 해준다.

이건 super-step이라는 개념으로 설명된다. LangGraph는 그래프를 한 걸음씩 진행하는데, 한 걸음 안에서 실행 가능한 노드는 전부 동시에 실행되고, 다음 걸음은 이번 걸음이 완전히 끝나야 시작한다.

```
super-step 1 : coordinator
super-step 2 : weather, news, stock      ← 한 걸음 안에 셋이 같이 들어 있다
super-step 3 : aggregator
```

```python
class DashboardState(BaseModel):
    user_location: str = "서울"
    weather_data: Dict[str, Any] = {}    # ← weather_checker 가 쓴다
    news_data: Dict[str, Any] = {}       # ← news_fetcher 가 쓴다
    stock_data: Dict[str, Any] = {}      # ← stock_analyzer 가 쓴다
    dashboard_report: str = ""
    start_time: float = 0.0

def coordinator(state):
    return {"start_time": time.time()}       # 출발 시각 기록

def weather_checker(state):
    time.sleep(random.uniform(1.0, 2.0))     # 느린 API 흉내
    return {"weather_data": {...}}

def aggregator(state):
    elapsed_time = time.time() - state.start_time
    ...
    return {"dashboard_report": report}
```

`coordinator`는 하는 일이 거의 없지만 팬아웃의 출발점이자 시작 시각을 적을 자리로 둔 노드다. 뉴스는 1.5~2.5초, 주식은 2~3초를 `sleep`한다.

```
대시보드 생성 시작 - 위치: 부산
뉴스 수집 중...
주식 분석 중...
날씨 확인 중...          ← 셋이 거의 동시에 시작
날씨: 맑음 22°C
뉴스 2개 수집 완료
주식 분석 완료           ← 각자 끝나는 시간이 다르다
리포트 생성 중...        ← 셋 다 끝난 뒤에야 시작
대시보드 완료 (3.0초)
```

순서대로였다면 최소 4.5초, 최대 7.5초였을 일이 가장 느린 주식 노드 시간인 3.0초에 끝났다. 파이썬은 GIL 때문에 스레드를 늘려도 계산이 동시에 안 된다고 배웠는데, `time.sleep()`이나 네트워크 요청, 파일 읽기는 기다리는 동안 GIL을 놓아서 실제로 빨라진다. 에이전트가 하는 일은 대부분 기다리는 일이라 이 병렬화가 잘 먹힌다. 위치를 부산으로 넣었는데 날씨가 그대로인 건 오늘 주제가 구조라서 데이터를 하드코딩해둔 것이다.

필드가 셋으로 예쁘게 나뉜 건 우연이 아니다. 동시에 실행되는 노드가 같은 필드에 쓰면 이런 에러가 난다.

```
langgraph.errors.InvalidUpdateError: At key 'results':
Can receive only one value per step. Use an Annotated key to handle multiple values.
```

기본 동작이 덮어쓰기인데 셋이 동시에 덮어쓰려 하니 누구 값을 남길지 정할 수 없는 것이다. 해결은 수업처럼 필드를 나누거나, 합치는 규칙인 리듀서를 필드에 다는 것이다.

```python
from typing import Annotated
import operator

class State(TypedDict):
    results: Annotated[list, operator.add]   # "덮어쓰지 말고 이어 붙여라"
```

01에서 "덮어쓰기가 기본"이라고 했던 데의 예외가 이 리듀서다. 그리고 전체 시간은 가장 느린 노드가 정하니까, 최적화는 느린 노드부터 해야 한다. 예제에는 예외 처리가 없어서 노드 하나가 터지면 그래프 전체가 죽는데, 실무에서는 노드 안을 `try/except`로 감싸서 실패해도 `{"weather_data": {"error": str(e)}}`처럼 빈 결과를 돌려주고 나머지는 살린다고 한다.

## ToolNode - LLM에게 도구를 쥐여 주기
이 노트북에서 가장 중요한 문장은 "LLM은 도구를 실행하지 않는다"였다. LLM이 할 수 있는 건 글자를 만드는 것뿐이라 계산도 인터넷 접속도 못 한다. 도구 호출은 역할이 나뉘어 있다. LLM은 "`calculator`를 `expression="100 * 200"`으로 불러주세요"라는 주문서(JSON)를 쓰고, 우리 코드인 `ToolNode`가 그걸 읽어서 진짜 함수를 실행하고, LLM은 그 결과를 받아 사람이 읽을 문장으로 정리한다.

구조는 04의 루프와 똑같다. 사람이 `input()`으로 넣던 자리에 LLM의 판단이 들어간 것이다.

```
04:  guess(사람이 입력) → check(정답인가?)          → 다시 guess
06:  call_model(LLM)   → should_continue(도구 필요?) → tools → 다시 call_model
```

### MessagesState

```python
from langgraph.graph import MessagesState

# 이것과 같다
class State(TypedDict):
    messages: Annotated[list, add_messages]
```

대화형 에이전트는 필드를 하나하나 정의하는 대신 메시지 목록 하나를 쌓는다. `MessagesState`는 05에서 본 리듀서를 미리 달아둔 것이다. `add_messages`는 노드가 `{"messages": [...]}`를 반환하면 덮어쓰지 않고 뒤에 붙이고, 같은 `id`의 메시지는 치환하고, `{"role": "user", ...}` 같은 딕셔너리는 `HumanMessage`로 바꿔준다. 필드를 더 붙이고 싶으면 `class AgentState(MessagesState):`로 상속하면 된다.

이건 Pydantic이 아니라 `TypedDict`라서 `state.messages`가 아니라 `state['messages'][-1]`처럼 대괄호로 읽는다. 노트북 사이를 오갈 때 가장 자주 나는 에러였다. 또 메시지 하나여도 `return {"messages": [response]}`처럼 리스트로 감싸야 한다.

### 도구는 그냥 함수다

```python
def calculator(expression: str) -> str:
    """수학 계산을 수행합니다."""
    try:
        expression = expression.replace("sqrt", "math.sqrt")
        expression = expression.replace("sin", "math.sin")
        expression = expression.replace("cos", "math.cos")
        result = eval(expression, {"__builtins__": {}, "math": math})
        return f"계산 결과: {result}"
    except Exception as e:
        return f"계산 오류: {str(e)}"

def get_weather(city_name: str) -> dict:
    """도시 이름을 받아 해당 도시의 현재 날씨 정보를 반환합니다."""
    latitude, longitude = get_coordinates(city_name)     # geopy 로 좌표 변환
    url = f"https://api.open-meteo.com/v1/forecast?latitude={latitude}&longitude={longitude}&current_weather=true"
    response = httpx.get(url)
    response.raise_for_status()
    return response.json()

def currency_converter(amount: float, from_currency: str, to_currency: str) -> str:
    """통화 간 환율을 계산합니다"""
    df = fdr.DataReader(f'{from_currency.upper()}/{to_currency.upper()}', start=today)
    rate = df.tail(1)['Close'].item()
    return f"{amount} {from_currency} = {amount * rate:.2f} {to_currency}"
```

데코레이터도 상속도 없는 평범한 함수인데, docstring과 타입힌트가 필수다. LLM은 함수 몸통을 볼 수 없고 이름, docstring, 매개변수 타입만 보고 언제 이 도구를 쓸지 판단한다. 수업 주석에도 docstring은 LLM에게 이 도구가 언제 왜 어떻게 쓰여야 하는지 알려주는 역할이라고 적혀 있었다. 함수를 아무리 잘 짜도 설명이 부실하면 도구를 안 쓰거나 엉뚱하게 쓴다. `@tool` 없이도 되는 건 `bind_tools`와 `ToolNode`가 평범한 함수를 받으면 이 셋으로 알아서 도구로 감싸주기 때문이라, 타입힌트 없는 도구 함수는 만들면 안 된다.

`eval()`은 문자열을 파이썬 코드로 실행해서 그냥 두면 LLM이 만든 문자열로 파일을 지울 수도 있다. 두 번째 인자로 쓸 수 있는 이름을 `math` 하나로 제한하고 `__builtins__`를 비워서 `open`이나 `__import__`도 못 쓰게 막았다. geopy는 도시 이름을 위도·경도로 바꾸고, httpx는 `requests`와 거의 같은데 비동기도 되고, FinanceDataReader는 환율 데이터를 가져온다. 셋 다 도구의 내용물일 뿐이다.

### bind_tools, ToolNode, should_continue

```python
tools = [calculator, get_weather, currency_converter]
model = init_chat_model("gpt-4o", model_provider="openai")
model_with_tools = model.bind_tools(tools)
tool_node = ToolNode(tools)

def should_continue(state: MessagesState):
    last_message = state['messages'][-1]
    if last_message.tool_calls:
        return "tools"
    else:
        return END
```

`bind_tools`는 함수들을 JSON 스키마로 바꿔 모델에게 알려준다. 그러면 모델은 평범한 답변(`content`에 문장, `tool_calls`는 빈 목록)이나 도구 호출 요청 중 하나를 낸다.

```python
[{'name': 'calculator',
  'args': {'expression': '100 * 200'},
  'id': 'call_u6lF...',
  'type': 'tool_call'}]
```

이건 실행 결과가 아니라 주문서다. `ToolNode(tools)`는 마지막 메시지에서 `tool_calls`를 읽고, 이름이 맞는 함수를 찾아 `args`를 풀어 호출하고, 결과를 호출 `id`와 짝지은 `ToolMessage`로 `messages`에 붙인다. 호출이 여러 개면 전부 실행한다. 직접 짰으면 `if name == "calculator": ... elif ...`로 길어졌을 부분이다.

`should_continue`는 마지막 메시지에 `tool_calls`가 있으면 도구로, 없으면 끝으로 보낸다. 감정 분석처럼 LLM에게 또 물어볼 필요가 없는 게 모델이 이미 `tool_calls` 유무로 의사를 밝혔기 때문이다. 라우팅 함수가 문자열 대신 `END`를 직접 돌려줄 수 있다는 것도 여기서 처음 봤다. `init_chat_model`은 `ChatOpenAI`와 똑같이 동작하는데, 제공자를 문자열로 바꿔 끼울 수 있어서 모델을 코드가 아니라 설정으로 정하고 싶을 때 쓴다.

### 클로저로 노드 만들기와 ReAct 루프

```python
def create_call_model_function(model_with_tools):   # 매개변수가 State 가 아니다!
    def call_model(state: MessagesState):           # ← 이게 진짜 노드. state 하나만 받는다
        response = model_with_tools.invoke(state['messages'])
        return {"messages": [response]}   # State 업데이트, append 된다! <- add_messages 가 동작
    return call_model

def create_graph(model_with_tools, tool_node):
    workflow = StateGraph(MessagesState)
    workflow.add_node("call_model", create_call_model_function(model_with_tools))
    workflow.add_node("tools", tool_node)          # ToolNode 를 노드로 그냥 넣는다

    workflow.add_edge(START, "call_model")
    workflow.add_conditional_edges("call_model", should_continue, ["tools", END])
    workflow.add_edge("tools", "call_model")       # 도구 호출후 다시 모델 호출.
    return workflow.compile()
```

노드 함수는 `state` 하나만 받아야 하는데 `call_model`은 모델 객체도 필요하다. 수업 주석대로 다른 함수로 한 번 감싸서 노드 함수를 리턴하게 했다. 바깥 함수는 노드가 아니라 노드 공장이고, 안쪽 `call_model`이 `model_with_tools`를 기억한 채(클로저) 만들어져서 `add_node`에 넘어간다. 조건부 에지의 세 번째 인자는 이번엔 리스트였는데, 반환값과 목적지가 같으면 이렇게 줄여 쓸 수 있다.

마지막 `tools → call_model` 화살표가 이 수업의 핵심이다. 모델에게 묻고, 도구가 필요하면 실행하고, 결과를 갖고 다시 모델에게 묻는 걸 최종 답이 나올 때까지 반복하는 ReAct 루프다. 04에서 배운 루프와 똑같은 모양이었다.

### 의존 관계가 있는 작업을 한꺼번에 시키면
실행 결과에서 재밌는 함정을 만났다. "100 * 200을 계산해주고, 이 결과를 달러에서 원화로 바꿔줘"라고 했더니 모델이 두 도구를 한꺼번에 불렀다.

```
[{'name': 'calculator',          'args': {'expression': '100 * 200'}},
 {'name': 'currency_converter',  'args': {'amount': 1, 'from_currency': 'USD', 'to_currency': 'KRW'}}]
```

계산 결과를 아직 모르는 상태라 금액을 `1`로 넣고 1달러가 몇 원인지만 물어본 것이다. 최종 답변은 "20,000달러를 원화로 바꾸면 약 26,805,600원"이었는데, 이 마지막 곱셈은 도구가 아니라 LLM이 암산한 것이다. 20000 × 1340.28이 맞긴 한데 운이 좋았던 것이고, 자릿수가 더 컸으면 틀렸을 것이다. 해결은 프롬프트로 앞 단계 결과가 필요하면 하나씩 호출하라고 지시하거나, `bind_tools(tools, parallel_tool_calls=False)`로 동시 호출을 끄거나, 도구를 하나로 합치는 것이다. 05의 병렬 노드가 서로 상관없는 일이어야 했던 것과 같은 원칙이다.

그리고 환율 도구의 `except:`가 너무 넓어서 네트워크 오류든 데이터 없음이든 전부 `"(동일 통화)"`로 답한다. 100 USD를 100 KRW라고 성공처럼 돌려주는 셈이라 LLM은 오류인 줄 모르고 그대로 답에 싣는다. 실패는 실패라고 말해주는 게 낫다.

## Human in the Loop - 사람의 대답도 노드가 된다
에이전트에게 "블로그 글 써줘"라고만 하면 무엇을 쓸지 알 수 없다. 사람이라면 "어떤 주제로요?" 하고 되물을 텐데, 지금까지 만든 그래프는 `invoke()`하면 끝까지 달릴 뿐이었다. 중간에 멈춰서 사람을 기다리는 구조를 Human-in-the-Loop라고 하고, 수업 주석은 이걸 4단계로 정리했다.

| 단계 | 하는 일 | 이번 예제에서는 |
|---|---|---|
| 중단점 | AI가 사람이 필요하다고 인식 | LLM이 물음표로 끝나는 질문을 만든다 |
| 컨텍스트 제공 | 사람이 판단할 정보를 준다 | LLM의 질문을 화면에 출력 |
| 피드백 수집 | 입력을 받는다 | `get_details` 노드의 `input()` |
| 재개 | 그 결정으로 계속 | `get_details → get_llm_response` 에지 |

```
START → get_llm_response ─(물음표로 끝남)─→ get_details ─┐
              ↑                                          │
              └──────────────────────────────────────────┘
              └─(물음표 아님 = 최종 보고서)─→ END
```

모양이 04의 루프와 똑같다. `guess` 자리에 사람이 들어간 것뿐이다.

```python
class AgentState(BaseModel):
    user_message: str = Field(default="", description="사용자 입력 작업")
    task_details: str = Field(default="", description="작업 상세 정보")
    response: str = Field(default="", description="응답 결과")

def get_llm_response_node(state: AgentState, llm):
    details = state.task_details
    if details:
        prompt = f"다음 요청에 따라 보고서를 작성해주세요: {details}"
    else:
        task = state.user_message
        prompt = f"""
            '{task}' 작업을 수행하려고 합니다. 어떤 종류의 보고서가 필요한지, 구체적인 주제는 무엇인지 질문해주세요.
            추가 정보가 필요하면, 반드시 응답의 마지막을 물음표('?')로 끝내주세요.
        """
    response = llm.invoke(prompt).content
    return {"response": response, "task_details": ""}

def check_llm_response(state: AgentState) -> Literal["get_details", "end"]:
    if state.response.strip().endswith("?"):
        return "get_details"      # 질문했다 → 사람에게 물어보러 간다
    return "end"

def get_task_details_node(state: AgentState) -> AgentState:
    """LLM의 질문에 대한 사용자 답변을 입력받는 노드"""
    user_input = input("답변: ")
    return {"task_details": user_input}
```

`task_details`가 비었는지 하나로 노드가 지금 단계를 판단한다. 비었으면 되묻고, 있으면 보고서를 쓴다. 접수 창구 직원 한 명이 둘 다 하는 구조다.

가장 중요한 설계는 프롬프트 마지막의 "반드시 응답의 마지막을 물음표로 끝내주세요"였다. LLM의 답변은 자유로운 문장이라 프로그램 입장에서는 그게 질문인지 최종 결과물인지 알 방법이 없어서, 약속된 표시를 남기게 시킨 것이다. 02에서 "한 단어만 출력하세요"라고 한 것과 같은 목적이다. LLM의 자유로운 출력을 프로그램이 판정할 수 있는 형태로 바꾸는 게 프롬프트 엔지니어링이 실제로 하는 일이라는 걸 여기서 느꼈다.

사람의 답을 받는 `get_task_details_node`에는 특별한 게 하나도 없다. 사람에게 묻는 것도 LLM 노드, 계산 노드와 똑같은 자격의 그냥 노드다. `get_llm_response_node`는 매개변수가 둘이라 `def get_llm_response_with_llm(state): return get_llm_response_node(state, llm)`처럼 한 겹 감싸서 등록했다. 06의 노드 공장과 방법은 달라도 state 하나만 받는 규격을 맞추려는 같은 목적이다.

```python
workflow.add_edge(START, "get_llm_response")
workflow.add_conditional_edges(
    "get_llm_response",
    check_llm_response,
    {"get_details": "get_details", "end": END}
)
workflow.add_edge("get_details", "get_llm_response")   # 답을 받으면 다시 LLM에게
```

```
작업 실행: '블로그 글 작성' 작업을 수행합니다...
--- LLM 응답 ---
블로그 글 작성을 위한 ... 목표는 무엇인가요? ... 추가 정보가 필요하시다면 알려주세요?
LLM이 추가 정보를 요청했습니다. 사용자 입력을 받습니다.
답변:  서울의 맛집 블로그
--- LLM 응답 ---
서울은 다양한 맛집들이 모여 있는 미식의 도시로 ... (긴 보고서)
최종 보고서가 생성되었습니다. 워크플로우를 종료합니다.
```

의도대로 첫 응답은 물음표로 끝나 사람에게 갔고, 두 번째는 보고서라 종료됐다. 하지만 물음표 판정은 깨지기 쉽다. "알려주세요."처럼 마침표로 끝나면 되묻지 못하고 끝나고, 최종 보고서가 "어떠신가요?"로 끝나면 끝났는데 또 묻는다. 뒤에 공백이 붙는 경우를 막으려고 `.strip()`이 있다. 실무에서는 문장 끝을 보는 대신 `needs_more_info: bool` 필드를 가진 모델을 `with_structured_output`으로 받아서 참/거짓으로 분기한다고 한다.

또 노드가 항상 `task_details: ""`를 반환해서 사람이 준 답이 한 번 쓰이고 바로 지워진다. 루프를 한 번 더 돌면 다시 질문부터 시작하는 구조라, 여러 번 되묻는 대화를 만들려면 답을 누적해야 한다. 이번엔 한 번에 끝나서 티가 안 났다.

그리고 `input()`은 노트북과 터미널 전용이다. 웹 서버에서 이 노드를 실행하면 서버가 `input()` 앞에서 멈추고 아무도 답을 넣어줄 수 없다. HTTP 요청은 한 번 답하고 끊어지는 구조라 붙잡고 기다리기가 애초에 안 맞는다. 진짜 해법은 멈추고 저장했다가 나중에 이어서 하는 것이고, 그게 `interrupt()`와 체크포인터다. `interrupt()`로 재개하면 그 노드가 처음부터 다시 돌기 때문에, 그 앞에 메일 발송 같은 코드를 두면 두 번 실행된다. 그래서 `interrupt()`는 노드 맨 앞에 둔다.

## 헷갈리기 쉬운 부분
- 체인은 일직선, 그래프는 갈림길·되돌아가기·동시 실행·중간에 멈추기가 된다.
- 노드는 바뀐 필드만 딕셔너리로 반환한다. 나머지는 병합으로 유지된다.
- `compile()` 전까지는 설계도다. 넣을 땐 Pydantic 객체, 받을 땐 딕셔너리다.
- 라우팅 함수는 상태를 안 바꾸고 다음 노드 이름(`str`)을 반환한다. `add_node`가 아니라 `add_conditional_edges`에 들어간다.
- 매핑의 키는 노드 이름이 아니라 라우팅 함수의 반환값이다. `{"continue": "guess"}`처럼 다를 수 있다. 딕셔너리, 리스트, 생략 세 형태가 다 된다.
- LLM 답을 분기에 쓸 땐 기본값을 깔아두거나 `with_structured_output`으로 막는다.
- 체크포인터는 `compile(checkpointer=...)`, 대화 구분은 `{"configurable": {"thread_id": ...}}`를 매 `invoke`마다 넘긴다. 빠뜨리면 조용히 기억을 잃는다.
- 상태 안의 딕셔너리는 `.copy()`해서 바꾸고, 기본값은 `default_factory=dict`다.
- 루프는 조건부 에지가 앞 노드를 가리키는 것이다. 멈추는 조건은 상태에 넣어 직접 관리하고, `recursion_limit` 25는 사고 방지용이다.
- 병렬은 `add_edge`를 여러 개 긋는 것이고, 팬인 노드는 한 번만 실행된다. 같은 필드에 동시에 쓰면 `InvalidUpdateError`라 필드를 나누거나 리듀서를 단다.
- LLM은 도구를 실행하지 않고 주문서(`tool_calls`)만 쓴다. 실행은 `ToolNode`가 한다.
- 도구의 docstring과 타입힌트가 LLM이 읽는 사용설명서다.
- `MessagesState`는 `TypedDict`라 `state['messages']`로 읽고, 반환할 때는 리스트로 감싼다.
- 의존 관계가 있는 도구 호출은 한꺼번에 시키면 안 된다.
- 노드는 state 하나만 받아야 해서 추가 인자는 클로저나 감싸는 함수로 해결한다.
- `input()`은 노트북 전용이다. 서버에서는 `interrupt()`와 체크포인터를 쓴다.

## 오늘 배운 내용 정리
오늘은 LangGraph로 일직선 그래프부터 갈림길, 기억, 루프, 병렬, 도구 사용 에이전트, 사람에게 되묻는 루프까지 하나씩 만들어봤다.

```
01 기본: StateGraph(State) → add_node / add_edge(START, ..., END) → compile() → invoke.
         노드는 바뀐 필드만 반환(update 병합). 입력은 객체, 출력은 dict.
02 라우팅: add_conditional_edges(출발, 라우팅함수, {반환값: 노드}). 라우팅 함수는 str 반환, 상태 안 바꿈.
           Literal 반환 타입. max_tokens=10 + 유효성 검사로 neutral 기본값.
03 체크포인터: compile(checkpointer=InMemorySaver()) + {"configurable": {"thread_id": ...}} 매번 전달.
             super-step마다 스냅샷. dict는 .copy(). SqliteSaver는 with.
04 루프: {"continue": "guess", "end": END}. 상태에 attempts/max_attempts/game_status. recursion_limit 25.
05 병렬: add_edge 여러 개 = 팬아웃, 한 곳으로 모으기 = 팬인(자동 대기). 7.5초 → 3.0초.
         같은 필드 동시 쓰기 → InvalidUpdateError → 필드 분리 또는 Annotated[list, operator.add].
06 ToolNode: MessagesState(add_messages) + bind_tools(tools) + ToolNode(tools) + should_continue.
             tools → call_model 되돌아가기 = ReAct 루프. 의존 작업 동시 호출 주의(amount=1).
07 HITL: 사람의 답도 노드. 물음표로 끝내라 → endswith("?") 분기. input()은 노트북 전용 → interrupt().
```

처음에는 노드와 에지를 일일이 등록하는 게 체인보다 번거로워 보였는데, 노트북을 넘길수록 새로 배우는 문법이 거의 없다는 게 신기했다. 04의 숫자 게임, 06의 도구 에이전트, 07의 되묻는 봇이 전부 "조건부 에지가 앞 노드를 가리킨다"는 같은 모양이었고, 그 자리에 사람이 들어가느냐 LLM이 들어가느냐만 달랐다. 가장 기억에 남은 건 환율 변환에서 모델이 `amount=1`로 도구를 부르고 마지막 곱셈을 암산해버린 장면이다. 계산기를 쥐여줬는데도 순서를 몰라서 안 쓴 셈이라, 도구를 주는 것만큼 언제 어떤 순서로 쓰게 할지 정해주는 게 중요하다는 걸 알게 됐다.

---
