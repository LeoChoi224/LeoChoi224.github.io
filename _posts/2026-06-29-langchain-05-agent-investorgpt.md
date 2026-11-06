---
layout: single
title: "LangChain 기초 정리 5 - Agent와 Tool, InvestorGPT 만들기"
categories: [coding, LangChain]
tag: [study-log, LangChain, Agent, Tool, create_agent, yfinance, SQLDatabaseToolkit, Streamlit]
toc: true
author_profile: false
sidebar:
    nav: "docs"
search: true
---
<hr/>

오늘은 **Agent**를 배웠다. Function Calling을 배울 때 "`function_call="auto"`로 두면 모델이 함수를 쓸지 스스로 판단하는데, 이게 Agent의 출발점"이라고 했던 바로 그 내용이다. 오전에는 덧셈 도구 하나로 Agent가 어떻게 도는지 뜯어봤고, 오후에는 웹 검색과 주가 조회 도구를 만들어 회사 이름만 넣으면 투자 의견을 주는 **InvestorGPT**를 만들었다.

## LLM은 덧셈을 틀린다
수업은 아주 단순한 질문으로 시작했다.

```python
llm = ChatOpenAI(temperature=0.1)
llm.invoke("Cost of $355.39 + $924.87 + $721.2 + $1940.29 + $573.63 + $65.72 + $35.00 + $552.00 + $76.16 + $29.12")
# AIMessage(content='= $4923.38')
```

정답은 **5273.38**인데 LLM은 4923.38이라고 답했다. LLM은 계산을 한 게 아니라 다음에 올 토큰을 통계적으로 고른 것이라, 어디에서도 덧셈이 일어나지 않았다. 중요한 건 틀렸다는 사실보다 **틀린 티가 안 난다**는 점이었다. `= $4923.38`은 자신 있고 깔끔해서 검산하지 않으면 그냥 믿게 된다.

LLM이 못 하는 건 계산만이 아니다. 학습 이후의 실시간 데이터(오늘 주가, 지금 날씨)와 본 적 없는 로컬 데이터(내 DB, 내 파일)도 모른다. 그래서 해법은 LLM을 더 똑똑하게 만드는 게 아니라 **LLM에게 계산기를 쥐여주는 것**이다. 계산·검색·조회는 함수(Tool)로 만들어주고, LLM에게는 어떤 도구를 언제 쓸지 고르는 일만 시킨다. 이 구조가 Agent다.

| | Function Calling (지난주) | Agent (오늘) |
|---|---|---|
| 모델이 하는 일 | "이 함수를 부르세요" 요청 | 같다 |
| 함수 실행 | 내가 직접 | 에이전트가 자동으로 |
| 결과 돌려주기 | 내가 직접 | 자동으로 다시 모델에 전달 |
| 반복 | 없음 (1회) | 끝날 때까지 루프 |

## create_agent - 도구 호출 루프
```python
from langchain.agents import create_agent
from langchain_core.tools.structured import StructuredTool

def plus(a, b):
    return a + b

agent = create_agent(
    model=ChatOpenAI(temperature=0.0, model="gpt-4o"),
    tools=[
        StructuredTool.from_function(
            func=plus,
            name="SumCalculator",      # 공백 불가
            description="Use this to perform sum of two numbers. This tool take two arguments, both should be numbers.",
        ),
    ],
)

result = agent.invoke({"messages": [{"role": "user", "content": "Cost of $355.39 + ..."}]})
print(result["messages"][-1].content)
```

챗봇은 모델을 한 번 부르고 끝나지만, Agent는 "모델을 부른다 → 모델이 도구를 요청하면 실행한다 → 결과를 모델에 돌려준다"를 **모델이 다 됐다고 할 때까지** 반복한다. 차이는 이 루프 하나다.

`create_agent()`가 돌려주는 건 체인이 아니라 LangGraph의 `CompiledStateGraph`였다. 지금까지의 체인(`prompt | llm | parser`)은 한 방향으로 흐르는 파이프라 되돌아갈 수 없는데, Agent는 도구를 실행한 뒤 다시 모델로 돌아가야 해서 그래프가 필요하다. 그래도 Runnable이라 `.invoke()`로 똑같이 부른다.

`StructuredTool.from_function`은 평범한 함수에 이름표와 사용설명서를 붙이는 작업이다. 함수의 시그니처를 들여다보고 인자 스키마를 자동으로 만들어주는데, 지난주에 손으로 적었던 JSON 스키마를 이제 함수에서 자동으로 만드는 셈이다.

| 칸 | 누가 읽나 | 틀리면 |
|---|---|---|
| `func` | 파이썬이 실행 | 실행 에러 |
| `name` | 모델이 무엇을 부를지 지목할 때 | 호출 실패. 공백이 들어가면 안 된다 |
| `description` | 모델이 언제 쓸지 판단할 때 | 도구가 있어도 안 쓰거나 엉뚱할 때 쓴다 |

`name`은 사람이 읽으라고 있는 게 아니라 API가 함수를 지목하는 식별자라서 영문, 숫자, `_`, `-`만 쓸 수 있다. 모델은 코드를 읽지 않고 **설명문만 읽고 언제 쓸지 고른다.** 그래서 도구가 안 불리면 설명부터 고치라고 했다.

### 결과를 열어보면 루프가 다 들어 있다
입력도 `messages`, 출력도 `messages`인데, 출력에는 에이전트가 도는 동안 오간 대화가 전부 쌓여 있다. 이번 실행에서는 메시지가 14개 나왔다.

| 번호 | 종류 | 내용 |
|---|---|---|
| `[0]` | HumanMessage | 내 질문 |
| `[1]` | AIMessage | `content=''`, 도구 호출 5개 |
| `[2]~[6]` | ToolMessage ×5 | `1280.26`, `2661.49`, `639.35`, `587.0`, `105.28` |
| `[7]` | AIMessage | `content=''`, 도구 호출 3개 |
| `[8]~[10]` | ToolMessage ×3 | `3941.75`, `1226.35`, `105.28` |
| `[11]` | AIMessage | `content=''`, 도구 호출 1개 |
| `[12]` | ToolMessage | `5168.1` |
| `[13]` | AIMessage | `'The total cost is $5168.10.'` ← 끝 |

도구가 인자를 두 개만 받으니까, 모델이 숫자 10개를 2개씩 5쌍으로 스스로 쪼개서 "덧셈 도구를 다섯 번 불러달라"는 주문서를 냈다. 아무도 시키지 않았는데 계획을 세운 것이다. 서로 관계없는 계산이라 다섯 번을 한 번에 요청해서 병렬로 처리됐다.

루프가 멈추는 기준은 각 AIMessage의 `finish_reason`이다. `'tool_calls'`면 도구를 실행하고 다시 모델을 부르고, `'stop'`이면 루프를 끝낸다. 중간 AIMessage들의 `content`가 비어 있는 건 실패가 아니라 지금은 답할 차례가 아니라서다. 실제 내용은 `tool_calls`에 들어 있어서 항상 두 칸을 같이 봐야 한다.

### 에이전트도 틀렸다
여기가 오늘 가장 중요한 장면이었다. 최종 답이 5168.10인데, 정답은 5273.38이다.

```
1라운드: 1280.26  2661.49  639.35  587.00  105.28   ← 열 개를 다섯 쌍으로, 완벽
2라운드: 1280.26+2661.49=3941.75   639.35+587.00=1226.35   105.28+0=105.28
3라운드: 3941.75+1226.35 = 5168.10   ← 105.28 을 안 더했다
```

`SumCalculator` 호출 하나하나는 전부 정확했다. 틀린 건 **어떤 중간 결과들을 다음에 합칠지 고르는 부분**이었고, 그건 도구가 아니라 모델의 일이다. 도구를 붙이면 **계산 오류는 사라지지만 조립 오류는 남는다.**

이걸 줄이는 방법으로는 도구를 더 크게 만드는 게 있었다. `plus(a, b)` 대신 `sum_all(numbers: list[float])`이었다면 한 번 호출로 끝나고 틀릴 여지가 없다. 도구를 잘게 쪼갤수록 LLM이 조립을 더 많이 하고, 그만큼 더 자주 틀린다. 그리고 메일 발송이나 결제처럼 되돌릴 수 없는 도구에는 실행 전에 사람의 승인을 받는 옵션(`interrupt_before`)을 거는 게 중요하다고 했다.

### 타입힌트와 기본값으로 스키마 다듬기
```python
def plus(a: float, b: float = 0) -> float:
    """두 수를 더한다. b가 없으면 0으로 처리한다."""
    return a + b
```

2라운드에서 모델이 `{'a': 105.28, 'b': 0}`처럼 더할 게 없는데 억지로 0을 만들어 짝을 맞춘 장면이 있었다. 기본값을 주면 스키마에서 `b`가 필수가 아니게 되어 그런 억지가 필요 없다. 타입힌트가 없으면 스키마의 타입이 모호해져서 모델이 숫자 대신 문자열 `"355.39"`를 넘기는 사고가 날 수 있다. 원본 함수를 고칠 수 없으면 래퍼 함수를 하나 씌워서 넘기면 된다. LLM에게 보여줄 얼굴과 실제 함수를 분리하는 것이다.

## InvestorGPT - 진짜 도구를 붙이기
`plus`는 동작은 확인했지만 쓸모는 없다. 에이전트가 값어치가 있으려면 LLM이 절대 알 수 없는 것을 가져와야 한다. 회사의 주식 티커(심볼), 작년 매출과 순이익, 최근 주가 같은 것들이다. 목표는 회사 이름을 넣으면 투자 적격 여부를 판단해서 알려주는 앱이었다.

### Tool을 만드는 세 가지 방법
```python
# (a) @tool 데코레이터
class StockMarketSymbolSearchToolArgsSchema(BaseModel):
    query: str = Field(description="The query you will search for. Example query: Stock Market Symbol for Apple Company")

@tool(
    name_or_callable="StockMarketSymbolSearchTool",
    description="Use this tool to find the stock market symbol for a company. It takes a query as an argument.",
    args_schema=StockMarketSymbolSearchToolArgsSchema,
)
def search_stock_symbol(query):
    return DuckDuckGoSearchAPIWrapper().run(query)


# (b) BaseTool 상속
class CompanySymbolArgsSchema(BaseModel):
    symbol: str = Field(description="Stock symbol of the company.Example: AAPL,TSLA")

class CompanyIncomeStatementTool(BaseTool):
    name: str = "CompanyIncomeStatement"
    description: str = "Use this to get the income statement of a company. You should enter a stock symbol."
    args_schema: Type[BaseModel] = CompanySymbolArgsSchema

    def _run(self, symbol):
        ...                                  # yfinance 로 손익계산서 조회
```

| 방식 | 언제 쓰나 | 에이전트에 넘길 때 |
|---|---|---|
| `@tool` | 새로 만드는 간단한 도구 | `search_stock_symbol` (괄호 없음) |
| `BaseTool` 상속 | 상태를 갖거나 복잡한 도구 | `CompanyIncomeStatementTool()` (괄호 있음) |
| `StructuredTool.from_function` | 이미 있는 함수를 감쌀 때 | `StructuredTool.from_function(...)` |

문법만 다르고 셋 다 결국 **이름 + 설명 + 인자 스키마**를 만드는 일이다. `@tool`은 원래 함수의 docstring을 설명으로 쓰는데, `description=`을 직접 넘기면 그쪽이 이긴다.

`args_schema`의 `Field(description=...)`이 특히 중요했다. `symbol: str`만 있으면 모델은 심볼이 뭔지 몰라서 `symbol="Apple"`을 넘길 수 있는데, `Example: AAPL,TSLA` 한 줄이 그걸 막는다. 프롬프트 엔지니어링은 프롬프트 문자열에만 있는 게 아니라 **도구 설명과 인자 설명이 전부 프롬프트**라고 했다.

### 도구 셋과 실행 순서

| 도구 | 데이터 출처 | 가져오는 것 |
|---|---|---|
| `StockMarketSymbolSearchTool` | DuckDuckGo 웹 검색 | 회사 이름 → 티커 (Cloudflare → `NET`) |
| `CompanyIncomeStatementTool` | yfinance | 연간 손익계산서 |
| `CompanyStockPerformanceTool` | yfinance | 최근 12주 주봉 |

사용자는 "Cloudflare"라고 입력하는데 재무 데이터는 `NET`이라는 티커를 요구한다. 그 사이를 잇는 게 검색 도구다. 순서를 아무도 알려주지 않았는데, 에이전트가 각 도구의 설명을 읽고 "심볼이 필요하니 심볼 찾는 도구부터"를 스스로 판단했다.

원래는 Alpha Vantage API로 회사 개요와 재무 정보를 가져왔는데, 무료 플랜이 하루 25번이라 에이전트가 질문 하나에 도구를 3~5번 부르면 금방 끝난다. 그래서 무료인 yfinance로 바꿨다.

### 도구를 짜기 전에 데이터부터 길들이기
도구 코드는 먼저 노트북에서 yfinance 데이터를 손으로 확인해본 다음에 옮긴 것이었다.

```python
import yfinance as yf

ticker = yf.Ticker("TSLA")
df_t = ticker.income_stmt.T                  # 행=연도가 되도록 뒤집기
df_t.index = df_t.index.astype(str)          # Timestamp → 문자열 (JSON 으로 바꿀 수 있게)

if value is None or (isinstance(value, float) and value != value):   # NaN 이면
    record[str(key)] = None

hist = ticker.history(period="6mo", interval="1wk", auto_adjust=False)
hist = hist.tail(12)                         # 최근 12주만 (토큰 절약)
```

- pandas의 날짜 인덱스는 `Timestamp` 객체라 그대로 JSON으로 바꾸면 `not JSON serializable` 에러가 난다. LLM에게 넘기려면 결국 문자열이어야 한다.
- `value != value`는 처음 보면 말이 안 되는 조건이다. NaN은 "모르는 값"이라 자기 자신과 비교해도 같다고 할 수 없어서, `x != x`가 참이면 그건 NaN뿐이다. 요즘은 `pd.isna(value)`처럼 읽기 쉬운 함수를 쓴다.
- 도구 결과는 전부 프롬프트에 실려 모델에게 들어가서, 자르지 않으면 그대로 요금이 된다. 6개월치 주봉 26주 중 12주만 남겼다.
- 등락률(`period_change_pct`)은 파이썬이 미리 계산해서 `summary`에 담아줬다. 오전에 본 것처럼 LLM에게 계산을 시키면 틀리니까, 좋은 도구는 데이터만 배달하지 않고 판단에 필요한 요약까지 만들어준다.

### SQLDatabaseToolkit - LLM이 SQL을 직접 짠다
```python
db = SQLDatabase.from_uri(f"sqlite:///{db_path}")       # movies.sqlite
toolkit = SQLDatabaseToolkit(db=db, llm=llm)
agent = create_sql_agent(llm=llm, toolkit=toolkit, agent_type="tool-calling", verbose=True)

agent.invoke("Give me the movies that have the highest votes but the lowest budgets and give me the name of their directors.")
```

이미 만들어진 도구 묶음(Toolkit)을 붙이면 DB 파일을 통째로 에이전트에게 맡기고 말로 조회할 수 있다. Toolkit은 테이블 목록 보기, 스키마 보기, 쿼리 문법 검사, 쿼리 실행 네 가지 도구를 준다. 에이전트는 스키마를 모르니 먼저 물어보고, 컬럼 이름을 확인한 다음 SQL을 작성해서 실행한다. `verbose=True`를 켜면 모델이 짠 SQL이 그대로 찍혀서 결과가 이상할 때 바로 확인할 수 있다. 그리고 모델이 `DELETE`를 짤 가능성이 0은 아니라서 읽기 전용 계정으로만 붙여야 한다고 했다.

### Streamlit 화면
```python
from Tools import agent

company = st.text_input("Write the name of the company you are interested on.")

if company:
    result = agent.invoke({
        "messages": [
            SystemMessage(content="""
                You are a hedge fund manager.
                You evaluate a company and provide your opinion and reasons why the stock is a buy or not.
                Consider the performance of a stock, the company overview and the company income statement.
                Be assertive in your judgement and recommend the stock or advise the user against it.
            """),
            HumanMessage(content=company),
        ],
    })
    st.write(result["messages"][-1].content)
```

`SystemMessage`로 역할을 준다. 특히 `Be assertive`가 없으면 LLM은 "투자에는 위험이 따르니 전문가와 상담하세요"만 반복한다고 했다.

`Tools.py`에서 만든 에이전트를 임포트해서 쓰는데, 파이썬은 임포트할 때 모듈 최상단 코드를 전부 실행한다. 그래서 `Tools.py`의 테스트 실행 코드는 `if __name__ == "__main__":` 아래에 넣어뒀다. 이 한 줄이 없으면 앱을 켜자마자 테스트 조사가 자동으로 돌아서, 임포트만 했는데 API 요금이 나간다.

## 헷갈리기 쉬운 부분
- 도구 안에서 `print`한 것은 터미널에만 나오고 `return`한 것만 LLM에게 간다. `return`을 빠뜨리면 도구가 조용히 `None`을 돌려주고 모델은 "결과가 없네요"라고 답한다.
- 도구 안에서 예외를 `raise`하지 않고 에러 메시지를 문자열로 돌려주는 코드가 있었다. `raise`하면 에이전트 루프 전체가 죽지만, 문자열로 돌려주면 모델이 그걸 읽고 "심볼이 틀렸나 보다, 다시 검색해보자"고 스스로 복구할 수 있다.
- 터미널 로그에 `\033[31m` 같은 ANSI 코드로 색을 칠해서 어떤 도구가 어떤 순서로 불리는지 눈으로 확인했다. 끝에 `\033[0m`(RESET)을 안 붙이면 그다음 출력이 전부 같은 색으로 나온다.
- `print(f'... {time.strftime('%Y-%m-%d')}')`처럼 f-string 안에 같은 따옴표를 또 쓰는 건 Python 3.12부터 허용된 문법이라, 3.11 이하에서는 실행도 전에 에러가 난다.
- 실습 코드의 시스템 프롬프트는 "company overview"를 고려하라고 하는데, 개요 도구는 Alpha Vantage 한도 때문에 목록에서 빠져 있었다. 도구 없이 개요를 요구받은 모델이 지어낼 위험이 있다.
- 실습 코드에서 `BaseTool`의 속성을 `name: Type[str]`처럼 적은 부분이 있었는데, `Type[str]`은 "문자열"이 아니라 "str 클래스 자체"라는 뜻이라 타입힌트가 맞지 않는다. 위 코드처럼 `name: str`으로 쓰는 게 맞다.
- 도구 설명은 매 호출마다 프롬프트에 실린다. 도구가 많아질수록 비용이 늘고 모델이 고르기 어려워져서, 실무에서는 10개 안쪽으로 유지한다고 한다.

## 오늘 배운 내용 정리
오늘은 Agent와 Tool을 배우고 InvestorGPT를 만들었다.

```
LLM 의 한계: 계산·실시간·로컬 데이터를 못 한다. 틀려도 티가 안 난다.
Agent: 모델 호출 → 도구 실행 → 결과를 다시 모델로. finish_reason 이 stop 일 때까지 반복.
create_agent(model, tools): 반환값은 LangGraph 그래프. Runnable 이라 invoke 로 부른다.
Tool = 이름 + 설명 + 인자 스키마. 모델은 description 만 읽고 언제 쓸지 고른다.
결과 messages: content='' 인 AIMessage 는 실패가 아니라 tool_calls 차례.
계산 오류는 사라지고 조립 오류는 남는다. 도구를 잘게 쪼갤수록 더 자주 틀린다.
Tool 만드는 법: @tool / BaseTool 상속 / StructuredTool.from_function.
도구 결과는 전부 프롬프트: tail(12) 로 자르고, 계산은 파이썬이 미리 해서 넘긴다.
SQLDatabaseToolkit: LLM 이 SQL 을 짜서 조회. verbose=True, 읽기 전용 계정.
if __name__ == "__main__": 이 없으면 임포트만 해도 API 가 돈다.
```

지난주에 Function Calling에서 모델이 "이 함수를 불러달라"고만 하고 실행은 내가 했는데, 오늘은 그 실행과 반복을 에이전트가 맡았다.

그리고 도구를 붙인 에이전트도 105.28을 빠뜨려서 최종 답을 틀린 장면이 오늘 가장 크게 남았다. 도구를 붙인다고 끝이 아니라, 도구를 어떻게 설계하느냐가 결과를 정한다는 걸 직접 확인했다.

---
