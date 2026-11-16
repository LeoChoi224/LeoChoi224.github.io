---
layout: single
title: "MCP 기초 정리 2 - FastMCP로 서버 만들기, tool·resource·prompt, 날씨 MCP, DART MCP"
categories: [coding, MCP]
tag: [study-log, MCP, FastMCP, tool, resource, prompt, OpenDART, inspector]
toc: true
author_profile: false
sidebar:
    nav: "docs"
search: true
---
<hr/>

어제는 남이 만든 MCP 서버를 붙여 썼고, 오늘부터는 서버를 직접 만들었다. FastMCP로 파이썬 함수 위에 데코레이터 한 줄을 얹어 AI가 부르는 도구로 만들고, 서버에 올릴 수 있는 세 가지(tool, resource, prompt)를 코드로 등록해봤다. 오후에는 바깥 API를 부르는 날씨 MCP를 만들고, 전자공시 API를 감싼 DART MCP를 노트북에서 검증한 다음 서버로 옮겼는데, 옮기는 순간 노트북에서는 안 보이던 실행 환경 문제가 터졌다.

## FastMCP로 첫 MCP 서버 만들기
파이썬으로 현재 시각을 돌려주는 함수를 만드는 건 3초면 된다. 문제는 그걸 클로드가 쓰게 하는 것이다. 지금까지는 LangChain 안에서 도구를 정의하고 에이전트를 짜서 그 앱 안에서만 쓸 수 있었다. MCP 서버로 빼내면 그 함수가 프로그램 밖으로 나와서 클로드 데스크탑도 쓰고 클로드 코드도 쓰고 커서도 쓴다. 규격이 같으니 한 번 만들어 여러 군데 붙인다.

그리고 오늘 코드에는 AI에게 물어보는 코드가 한 줄도 없다. LLM을 부르는 건 호스트 쪽 일이고, 서버는 "이런 기능이 있다"고 목록을 내놓고 불러주면 실행해서 결과를 돌려주기만 한다. 그래서 OpenAI 키도 안 나온다.

```python
from fastmcp import FastMCP
from datetime import datetime

mcp = FastMCP(name="Datetime-MCP")   # 서버의 이름 지정

@mcp.tool()
def get_current_datetime() -> str:
    """현재 날짜와 시간을 반환합니다"""
    now = datetime.now()
    return now.strftime("%Y-%m-%d %H:%M:%S")

@mcp.tool()
def add(a: int, b: int) -> int:
    """Add two integer numbers together"""
    return a + b

@mcp.tool()
def greet_user(name: str, is_morning: bool = False) -> str:
    """Greet the user with a personalized message."""
    greeting = "Good morning" if is_morning else "Hello"
    return f"{greeting}, {name}!"

if __name__ == "__main__":
    mcp.run()
```

`FastMCP`는 MCP 공식 파이썬 SDK 위에 얹힌 편의 라이브러리다. 원래는 JSON-RPC 메시지를 주고받는 코드를 손으로 써야 하는데 데코레이터 한 줄로 줄여준다. FastAPI가 웹 서버에 해준 일을 MCP에 해준다고 보면 되고, 이름이 비슷한 것도 의도된 것이다. 서버 객체는 도구를 담을 바구니이고, `@mcp.tool()`이 붙은 함수만 바구니에 들어간다. 이때 FastMCP가 함수를 들여다보고 이름, 인자 개수와 타입, 하는 일을 담은 도구 명세서를 만들어둔다. 이름을 따로 안 주면 함수 이름이 그대로 도구 이름이 된다.

### docstring과 타입 힌트
평소 파이썬에서는 없어도 잘 돌아가는 둘이 여기서는 필수다. 수업 코드에도 굳이 "(중요)"라고 적혀 있었다. docstring은 사람이 아니라 AI가 읽는 사용설명서다. 클로드가 "지금 이 도구를 써야 하나?"를 판단할 때 볼 수 있는 건 도구 이름과 docstring뿐이라, 설명이 비어 있으면 서버에 등록은 돼 있는데 영영 안 불리는 상태가 된다. 에러도 안 나고 그냥 안 쓴다. LangGraph ToolNode에서 배운 것과 같은 이야기였다.

타입 힌트는 LLM에게 인자 형식을 알려주는 동시에, 들어온 값이 그 타입이 맞는지 함수에 닿기 전에 자동으로 검증한다. LLM은 인자를 글자로 지어내서 보내기 때문에 `a: int` 자리에 `"세 개"` 같은 게 실제로 들어오는데, 타입 힌트가 있으면 본문에 닿기 전에 거절되고 LLM은 형식이 틀렸다는 답을 받아 다시 시도한다. `is_morning: bool = False`처럼 기본값을 주면 선택 인자가 돼서 LLM이 필요할 때만 채운다.

```python
@mcp.tool(
    name="greet_special",              # LLM에 노출되는 도구 이름
    description="Generates a personalized greeting for the user",   # 도구 설명
    tags={"greeting", "user"}          # 도구 분류 태그
)
def 도구_메타데이터():
    """docstring 보다 description 이 우선함"""
    return

from typing import Annotated
from pydantic import Field

def 메타데이터(
    name: Annotated[str, Field(description="Name of the user to greet", min_length=2, max_length=20)],
    image_url: Annotated[str, Field(description="URL of the image to process")],
    limit: int = Field(10, description="Maximum number of results", ge=1, le=100),
    query: str = Field("", description="Search query string")
):
    ...
```

데코레이터에 이름, 설명, 태그를 직접 줄 수도 있는데, `description`이 있으면 docstring은 무시된다. 정성껏 쓴 docstring이 버려지니 둘 중 하나만 채우는 게 낫다. `name=`을 주는 순간 도구 이름과 함수 이름이 갈라져서 에러를 검색할 때 함수 이름으로 찾으면 안 나온다.

인자 하나하나에 설명을 붙일 때는 `Annotated`와 pydantic `Field`를 쓴다. `min_length`, `max_length`, `ge`(이상), `le`(이하)는 값의 범위 제한이라 타입이 맞아도 범위를 벗어나면 함수까지 못 간다. `Annotated[str, Field(...)]`는 타입 자리에, `limit: int = Field(10, ...)`은 기본값 자리에 쓰는 같은 기능인데, 기본값 자리를 `Field`가 차지하면 기본값이 뭔지 한눈에 안 보여서 pydantic v2와 FastMCP 문서는 `Annotated` 쪽을 권한다. 수업 코드에 둘이 같이 나온 건 둘 다 된다는 걸 보여주려는 것이다.

### transport와 인스펙터
`mcp.run()`의 기본 transport는 `stdio`, 표준 입출력이다. 클라이언트가 이 파이썬 파일을 자식 프로세스로 띄워서 stdin으로 요청을 넣고 stdout으로 답을 받는다. 네트워크도 포트도 안 써서 내 PC 안에서만 쓰는 서버에 맞다. 수업 주석에 `mcp.run(transport="stdio", host="127.0.0.1", port=8000, path="/mcp")`처럼 나란히 적혀 있었는데, `host`, `port`, `path`는 `transport="http"`일 때만 쓰이는 값이고 stdio에서는 무시된다.

```python
mcp = FastMCP(name="HelloWorld")

@mcp.tool()
def hello_world(name: str):
    """Greets the provided name."""
    return f"Hello {name}"
```

```bash
npx @modelcontextprotocol/inspector      # Node.js 가 있으면 한 줄로
fastmcp dev inspector server.py          # FastMCP 로 서버까지 같이 띄우기
```

인스펙터는 MCP 서버 전용 테스트 화면이다. 브라우저에서 도구 목록을 보고 인자를 손으로 넣어 실행해서 돌아온 값을 확인한다. 이 컴퓨터의 fastmcp는 4.0.3이라 `fastmcp dev inspector server.py`가 맞고, 인터넷 예제에 흔한 `fastmcp dev server.py`는 2.x 시절 형태라 안 먹는다. 막히면 `fastmcp dev --help`로 확인하는 게 빠르다. 클로드 데스크탑에 먼저 등록해버리면 도구가 안 보일 때 서버 코드, 설정 파일, 재시작 안 함 중 어디가 문제인지 갈린다. 인스펙터로 서버가 멀쩡한 걸 먼저 확인해두면 원인이 반으로 준다.

```json
{
  "mcpServers": {
    "Datetime-MCP": {
      "command": "/opt/miniconda3/envs/KDT-py/bin/python",
      "args": ["/…/03_MCP/101_HelloMCP/server.py"]
    }
  }
}
```

등록할 때는 `command`와 스크립트 경로를 둘 다 절대 경로로 쓴다. `"command": "python"`이라고만 적으면 클로드 데스크탑은 내 셸 설정(conda 활성화 같은 것)을 거치지 않고 프로그램을 띄워서, conda 환경이 안 잡힌 엉뚱한 파이썬이 걸리고 `ModuleNotFoundError: fastmcp`가 난다. 앱의 작업 디렉터리도 내 프로젝트 폴더가 아니다. 이 문제가 오후에 더 크게 터졌다. 클로드 코드 쪽은 `.claude/settings.local.json`에 `mcp__Datetime-MCP__get_current_datetime`처럼 물어보지 않고 쓸 도구를 적어뒀는데, 이름 규칙이 `mcp__{서버이름}__{도구이름}`이다. 클로드 데스크탑은 설정 파일을 시작할 때 한 번만 읽어서, 고쳤으면 완전히 종료하고 다시 켜야 한다.

## tool, resource, prompt
어제 이름만 보고 지나갔던 서버의 세 요소를 코드로 등록해봤다. 나누는 기준은 누가 꺼내느냐다. tool은 AI가 필요하다고 판단해서 인자를 채워 호출하고, resource는 클라이언트가 URI를 지목해서 읽어가고, prompt는 사용자가 골라서 쓰는 미리 짜둔 질문 틀이다.

도구 하나만 있어도 웬만한 건 된다. 앱 설정값을 `get_settings()` 도구로 만들면 그만일 것 같지만, 설정값은 언제나 같은 자리에 있는 데이터라 AI가 써야 할지 말지 판단할 거리가 아니고, 날씨는 부를 때마다 결과가 달라지고 "지금 날씨 어때?"를 듣고 AI가 스스로 써야겠다고 판단해야 한다. 전부 도구로 만들면 AI에게 보여줄 목록이 길어지고, 목록이 길수록 엉뚱한 걸 고를 확률이 올라간다. 성격에 맞는 자리에 두는 게 곧 정확도다.

### resource - 주소를 붙인 데이터

```python
@mcp.resource(uri="resource://greeting")
def get_greeting() -> str:
    """간단한 인사말을 제공합니다"""
    return "안녕하세요~ FastMCP 리소스입니다"

@mcp.resource(
    uri="data://app-settings",
    name="AppSettings",
    description="애플리케이션 설정 정보를 JSON으로 제공합니다.",
    mime_type="application/json",
    tags={"settings", "config", "public"},
)
def load_app_settings() -> dict:
    """내부 함수 설명 (위의 'description'이 우선합니다)."""
    return {"theme": "light", "version": "1.2.1",
            "options": ["tools", "resources", "notifications"]}
```

서버 안에 파일 하나를 올려두고 웹페이지처럼 주소를 붙이는 것이다. 클라이언트가 URI를 요청하면 FastMCP가 그 리소스를 찾아 함수를 실행하고 결과를 돌려준다. 요청이 올 때 함수가 도는 거라 값이 고정일 필요는 없다. 띄워서 목록을 뽑아보니 `name=`을 안 준 리소스는 함수 이름이 이름이 되고, `mime_type`을 안 주면 `text/plain`이 되고, `dict`를 돌려주면 `application/json`에 맞춰 JSON 문자열로 바뀌어 나갔다. URI 앞부분(`resource://`, `data://`)은 정해진 규격이 아니라 폴더 이름처럼 내가 정하는 분류다.

### prompt - 미리 짜둔 질문 틀

```python
@mcp.prompt(
    name="analyze_data_request",
    description="Generates a data analysis request with user-specified options.",
    tags={"analysis", "data"}
)
def data_analysis_prompt(
    data_uri: str = Field(description="Resource URI containing the target dataset."),
    analysis_type: str = Field(default="summary", description="Desired analysis type.")
) -> str:
    """이 docstring은 description이 있을때 무시됨"""
    return f"Analyze the dataset at {data_uri} using the '{analysis_type}' method."
```

프롬프트는 실행 결과도 데이터도 아니고 LLM에게 보낼 문장을 돌려준다. 그 문장을 실제로 보내는 건 호스트 쪽 일이다. 인자 이름이 `data_uri`인 게 재밌었는데, 리소스의 주소를 받아서 그 데이터를 분석하라는 문장을 만든다. 리소스가 데이터를 담고, 프롬프트가 그걸 가리키는 질문을 만들고, 실제 분석은 도구가 하는 그림이다. 클로드 데스크탑에서는 채팅창의 `+` 버튼을 누르면 프롬프트 목록이 뜨고 내가 눌러서 꺼내 쓴다. 클로드가 알아서 고르는 게 아니라서 "프롬프트를 등록했는데 클로드가 안 쓴다"는 고장이 아니다.

`103_디버깅/server.py`는 셋을 하나씩 담은 최소 서버라 인스펙터에 띄우면 Tools, Resources, Prompts 탭에 하나씩 뜬다. 여기서는 `@mcp.resource("resource://user-info")`처럼 URI를 키워드 없이 첫 번째 인자로 넘겼는데 이것도 된다. 그리고 `FastMCP()`에 이름을 안 준 `102_구성요소/server.py`는 띄워보니 서버 이름이 `FastMCP-3f79` 같은 무작위 이름이었다. 클라이언트 목록에서 어느 서버인지 알아볼 수 없으니 `name=`은 습관으로 붙여야겠다. `description`이 docstring을 이기는 규칙은 셋 모두에 똑같이 적용된다.

## 외부 API를 붙인 날씨 MCP
지금까지 만든 도구는 전부 내 컴퓨터 안에서 끝났다. LLM은 학습 시점 이후의 세상을 모르니 "지금 서울 날씨 어때?"에 혼자 답할 수 없는데, 도구가 바깥 API를 다녀오면 그 구멍이 메워진다. 이 서버의 Open-Meteo와 ipinfo.io는 키 없이 쓰는 무료 API라 키도 안 나온다.

```python
# 현재 IP 주소 기반 위치정보 추출
def get_lat_lon_from_ip():
    try:
        res = requests.get('https://ipinfo.io/json')
        data = res.json()
        loc = data.get('loc', '37.5665,126.9780')   # 기본값: 서울
        latitude, longitude = map(float, loc.split(','))
        return latitude, longitude
    except Exception as e:
        print("위치 정보를 가져올 수 없습니다. 기본값(서울) 사용. 오류: {e}")
        return 37.5665, 126.9780

@mcp.tool(
    name="get_weather",
    description="Get current weather information using Open-Meteo API based on your IP."
)
def get_weather():
    latitude, longitude = get_lat_lon_from_ip()
    url = (f'https://api.open-meteo.com/v1/forecast?latitude={latitude}&longitude={longitude}'
           f'&hourly=temperature_2m,relative_humidity_2m,dew_point_2m,weather_code'
           f'&timezone=GMT&forecast_days=1')
    try:
        response = requests.get(url)
        return response.json()
    except Exception as e:
        print("날씨 정보 요청 오류:", e)
        return None
```

`get_lat_lon_from_ip`에는 일부러 `@mcp.tool`을 안 붙였다. 사용자는 "날씨 알려줘"라고 하지 "내 IP의 위도를 구한 다음 그걸로 날씨를 조회해줘"라고 하지 않는다. 안쪽 단계를 도구로 내놓으면 AI가 고를 것만 늘어난다. LangGraph 하위 그래프에서 `get_coordinates`를 바인딩하지 않았던 것과 같은 원칙으로, 사용자의 말 단위만 도구로 낸다. IP 위치는 GPS가 아니라 통신사 기준 위치라 동네 단위로 어긋나고 VPN을 쓰면 엉뚱한 도시가 나와서, 실패하면 서울 좌표로 떨어지게 해뒀다.

`get_weather`는 인자가 하나도 없다. 위치를 IP에서 알아서 구하니 AI가 채울 게 없고, 틀릴 여지가 없어서 LLM 입장에서 제일 부르기 쉬운 도구다. `temperature_2m`의 2m는 지면에서 2미터 높이라는 기상 관측 표준이고, `weather_code`는 WMO 표준 날씨 코드다. 클로드가 이 코드 표를 알고 있어서 숫자만 줘도 "약한 비"로 풀어주니 원본 JSON을 그대로 돌려줘도 된다.

```json
{
    "name": "MyServer",
    "source": { "path": "weather.py", "entrypoint": "mcp" },
    "environment": { "dependencies": ["requests"] }
}
```

실행은 `python weather.py`, `fastmcp run weather.py`, 그리고 인자 없이 `fastmcp run`이 있는데, 마지막은 현재 폴더의 `fastmcp.json`을 찾아 실행한다. `source.path`는 파일, `entrypoint`는 그 파일 안의 서버 객체 변수 이름, `dependencies`는 필요한 패키지다. 클로드 데스크탑에는 `MyServer`라는 이름으로 등록해서 허용 목록 이름도 `mcp__MyServer__get_weather`가 됐다.

### stdio 서버에서 print()는 위험하다
이 코드에서 제일 위험한 곳은 `print()`였다. stdio는 stdout으로 JSON 메시지를 주고받는 통로인데, 같은 통로에 `print()`로 아무 글자나 흘리면 클라이언트가 그걸 메시지로 읽으려다 깨진다. MCP 스펙에도 서버는 stdout에 유효한 MCP 메시지가 아닌 것을 쓰면 안 되고 로그는 stderr로 쓰라고 명시돼 있다. 인스펙터나 `python weather.py`로 돌릴 때는 티가 안 나다가 클로드 데스크탑에 붙였을 때만 연결이 끊기는 형태로 나타나서 원인을 찾기 특히 어렵다고 한다. 로그는 `print("오류:", e, file=sys.stderr)`로 보낸다. 게다가 위치 함수의 `print`는 `f`가 빠져서 오류 내용 대신 `{e}`라는 글자가 그대로 찍힌다.

그 밖에 본 것들이다.

- `timezone=GMT`라 돌려받는 시각이 한국과 9시간 어긋난다. "14시 기온"이 실제로는 밤 11시 기온이다. `timezone=Asia/Seoul`로 바꾸는 게 깔끔하다. 바깥에서 들어온 시각은 일단 시간대를 의심해야 한다.
- 응답이 통째로 LLM에 간다. 시간별 4개 항목 × 24시간이면 숫자가 100개 가까이 되고, `forecast_days=7`이면 7배가 돼서 토큰을 잡아먹는다. 도구는 필요한 만큼만 추려서 돌려주는 게 원칙이다.
- 예외를 삼키고 `None`을 돌려주면 클로드가 엉뚱한 말을 지어낼 수 있다. `{"error": "날씨 API 호출 실패"}`처럼 실패 이유를 돌려주는 게 낫다. `requests.get(url, timeout=5)`처럼 타임아웃도 줘야 응답 없는 API에 서버가 멎지 않는다.

## DART MCP - 노트북에서 검증하고 도구로 옮기기
DART는 금융감독원이 운영하는 전자공시시스템이고, OpenDART는 그 정보를 프로그램으로 가져다 쓰는 API(키 필요), OpenDartReader는 그 API를 파이썬에서 쉽게 쓰게 감싼 라이브러리다. 오늘의 진짜 주제는 DART가 아니라 남이 만든 파이썬 라이브러리를 AI가 쓸 수 있는 도구로 바꾸는 절차였다.

아침의 도구들은 한 줄짜리였는데, `dart.finstate('삼성전자', 2021)` 한 번이면 28줄짜리 표가 나온다. 이걸 통째로 클로드에게 던지면 토큰만 잡아먹고 정확도는 떨어진다. 그래서 어디까지 걸러서 돌려줄지를 노트북에서 눈으로 보면서 정하고, 확정된 것만 도구로 내보냈다. MCP 서버는 클라이언트가 띄워서 stdio로 말을 거는 구조라 중간에 `print`를 찍을 수도 없고 결과를 보기가 불편하다. 돌려보며 정할 건 노트북에서 끝내는 게 맞다.

```python
import OpenDartReader
from dotenv import load_dotenv
load_dotenv()
DART_API_KEY = os.getenv('DART_API_KEY')
dart = OpenDartReader(DART_API_KEY)

import pandas as pd
pd.set_option('display.max_columns', None)   # 컬럼 수 제한 해제
```

노트북은 설명 셀, 그냥 호출, 출력 확인, 함수로 감싸기, 감싼 걸로 다시 호출하는 순서가 다섯 번 반복됐다. `find_corp_code`, `company`, `finstate`, `report`, `event` 다섯 개가 이 순서를 밟고, 감싼 다섯 함수가 그대로 서버의 다섯 도구가 됐다. `OpenDartReader(키)`는 처음 만들 때 전체 기업 고유번호 목록(11MB)을 내려받아 `docs_cache/` 폴더에 저장하는데, 이 폴더를 만든다는 동작이 오후에 사고를 쳤다.

### 다섯 가지 조회

```python
dart.find_corp_code('005930')     # 종목코드로도
dart.find_corp_code('삼성전자')    # 이름으로도 → '00126380'
dart.company('005930')            # 기업 개황 (회사명, 대표, 주소, 종목코드 ...)
df = dart.finstate('삼성전자', 2021)          # 재무제표 28행
dart.report('005930', '미등기임원보수', 2021)  # 사업보고서 안의 특정 항목
dart.event('풀무원', '전환사채발행')            # 주요사항보고서, 연도 빼면 전체 이력
```

회사에는 번호가 두 종류 있다. DART가 준 8자리 `corp_code`(삼성전자 `00126380`)와 한국거래소가 준 6자리 `stock_code`(`005930`)다. 비상장사는 종목코드가 없어서 DART가 자기 번호를 따로 쓴다. `company()`는 어느 번호를 넣어도 OpenDartReader가 알아서 변환해준다. `report()`의 항목은 정해진 28개 중 하나여야 하고, 회사에 사건이 생겼을 때 즉시 내는 `event()`의 항목은 36개다.

재무제표 28행은 두 기준으로 갈리는 네 덩어리가 섞인 것이었다. `fs_div`는 자회사까지 합친 연결재무제표(`CFS`)냐 그 회사 하나만의 별도재무제표(`OFS`)냐이고, `sj_div`는 어느 시점의 재산을 보는 재무상태표(`BS`)냐 한 기간 동안 벌고 쓴 걸 보는 손익계산서(`IS`)냐다. 그래서 `CFS×BS` 9행, `CFS×IS` 5행, `OFS×BS` 9행, `OFS×IS` 5행이다. 컬럼의 `thstrm_`은 당기, `frmtrm_`은 전기, `bfefrmtrm_`은 전전기로 DART는 늘 3개년을 같이 주는데, 쓰는 건 `thstrm_amount` 하나다.

### 감싸서 도구로 승격

```python
@mcp.tool(
    name="get_financial_statement",
    description="Fetch the company's main financial statement items (Balance Sheet or Income Statement)."
)
def get_financial_statement(
    corp_code: Annotated[str, Field(description="Corporate code of the company.")],
    date:      Annotated[str, Field(description="Year in 'yyyy' format.")],
    report_code: Annotated[str, Field(description="Report code: '11012' for Semi-Annual, '11014' for Q3, '11013' for Q1.")],
    sj_div:    Annotated[Literal['BS', 'IS'], Field(description="Statement type: 'BS' for Balance Sheet, 'IS' for Income Statement.")]
):
    df = dart.finstate(corp_code, date, report_code)
    # 우선 연결재무제표에서 찾고
    filtered_df = df[(df['fs_div'] == 'CFS') & (df['sj_div'] == sj_div)]
    if filtered_df.empty:
        # 없으면 별도재무제표에서
        filtered_df = df[(df['fs_div'] == 'OFS') & (df['sj_div'] == sj_div)]
    filtered_df = filtered_df[["corp_code", "bsns_year", "reprt_code",
                               "account_nm", "thstrm_amount"]]
    return filtered_df
```

다섯 중 재무제표 함수에만 로직이 들어갔다. 자회사가 없는 회사는 `CFS`가 아예 없어서 빈 표 대신 `OFS`로 떨어지게 했고, 20개가 넘는 컬럼 중 5개만 남겨서 AI에게 보낼 양을 사람이 미리 줄였다. 이 한 줄이 도구의 품질을 정한다. 노트북 함수에서 도구로 옮길 때 바뀐 건 데코레이터와 인자마다 붙은 타입·설명뿐이고 본문은 한 글자도 안 바뀌었다.

`Literal['BS', 'IS']`는 이 둘 중 하나만 허용한다는 뜻이다. `str`이면 AI가 `'balance'` 같은 걸 넣을 수 있는데, `Literal`은 목록이 명세서에 실려 나가고 다른 값은 함수에 닿기 전에 거절된다. 목록이 긴 경우는 `Field(description=f"Report code. Must be one of: {REPORT_CODES}")`처럼 28개 목록을 설명에 통째로 박고, 본문에서 `if report_code not in REPORT_CODES: return {"error": f"report_code must be one of: {REPORT_CODES}"}`로 한 번 더 막는다. 설명은 예방이고 `if`는 방어인데, 에러가 허용 목록을 되돌려줘서 LLM이 그걸 읽고 골라 다시 부를 수 있다. 에러 메시지가 다음 시도의 힌트가 되는 구조다. 빈 결과도 `{"message": "No data found for the given parameters."}`처럼 말로 돌려준다.

### 옮기니까 터진 작업 디렉터리 문제

```python
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
os.chdir(BASE_DIR)
load_dotenv(os.path.join(BASE_DIR, "..", "..", "..", ".env"))
```

`dartmcp.py` 맨 위의 이 세 줄이 오늘 오후의 진짜 수확이었다. 클로드 데스크탑이 서버를 띄우면 그 프로세스의 작업 디렉터리가 `/`로 잡힌다. 그런데 `OpenDartReader(키)`는 초기화하면서 상대 경로로 `docs_cache` 폴더를 만들려고 하고, macOS의 루트는 읽기 전용이라 `Errno 30 (Read-only file system)`이 난다. 지금 있는 폴더에 캐시 폴더를 파겠다고 했는데 하필 서 있는 자리가 파면 안 되는 자리였던 것이다. `load_dotenv()`도 현재 폴더부터 위로 올라가며 `.env`를 찾는데 현재 폴더가 `/`면 찾을 데가 없다. 그래서 초기화 전에 내 파일이 있는 폴더로 옮기고, `.env`는 절대 경로로 넘겼다.

노트북에서 안 보였던 건 노트북이 그 파일이 있는 폴더에서 실행돼서 상대 경로가 다 맞아떨어졌기 때문이다. 아침에 설정 파일에 절대 경로를 쓰던 이유와 뿌리가 같다. 내가 띄우는 게 아니라 클라이언트가 띄우는 프로그램은 내 작업 환경을 하나도 물려받지 않는다. 이렇게 고치고 나서 클로드에게 "삼성전자 2025년 1분기 재무상태표 보여줘"라고 하면 클로드가 스스로 `get_corp_code`, `get_financial_statement` 순서로 두 번 호출했다.

### 그 밖에 만나본 것들
- 노트북에서 1분기를 뽑으려고 `reprt_code='11813'`(1을 8로 오타)을 넣었는데 에러 없이 표가 나왔다. 그 표는 1분기가 아니라 바로 위에서 조회한 연간 사업보고서와 같은 것이었다. 접수번호 `rcept_no`가 똑같았다. 게다가 `reprt_code` 컬럼에는 내가 넣은 `11813`이 그대로 찍혀 있어서 표만 보면 1분기인 줄 안다. 정확한 코드는 `11011` 사업보고서, `11012` 반기, `11013` 1분기, `11014` 3분기다. 에러 없이 통과하는 잘못이 제일 위험하다.
- `corp_code` 인자에 회사 이름을 넣어도 OpenDartReader가 변환해줘서 돈다. 그런데 AI에게 준 설명이 "Corporate code"라 클로드는 이름을 넣어도 되는 걸 모르고 `get_corp_code`를 먼저 부른다. 설명을 "코드 또는 회사 이름"으로 적으면 호출이 한 번 준다.
- 도구가 DataFrame을 반환하면 클라이언트에는 표를 출력한 모습 그대로 문자열 하나로 도착한다. 판다스는 넓은 표를 출력할 때 가운데 컬럼을 `...`로 자르는데, 노트북에서 풀어둔 `display.max_columns` 설정이 서버에는 없다. 통째로 돌려주는 `report`, `event` 도구는 잘릴 수 있어서 `df.to_dict('records')`로 바꿔 돌려주는 게 낫다.
- 도구에 `-> object` 같은 애매한 반환 타입을 적으면 FastMCP가 그걸로 출력 스키마를 만들고, 실제 반환값이 안 맞아 `Tool … has an output schema but did not return structured content`로 실패한다. 반환 타입은 확실할 때만 적는다.
- `import OpenDartReader`할 때 `SyntaxWarning: invalid escape sequence '\s'`가 우수수 뜨는데, 라이브러리 안쪽 정규식이 `r'...'` 없이 쓰여서 나는 경고라 동작에는 지장이 없다. stderr로 나가서 stdio 서버도 안 깨뜨린다.

## 헷갈리기 쉬운 부분
- 서버는 LLM을 부르지 않는다. 기능 목록을 내놓고 불러주면 실행할 뿐이다.
- docstring은 AI가 읽는 설명서다. 비어 있으면 등록돼 있어도 안 불리고 에러도 안 난다. `description`을 주면 docstring은 무시된다.
- 타입 힌트는 설명이자 방패다. `Annotated[타입, Field(...)]`로 설명과 범위 제한을 붙이고, 선택지는 `Literal`로 못 박는다.
- 기본 transport는 stdio라 `host`/`port`는 무시된다.
- 등록 전에 `fastmcp dev inspector server.py`로 확인한다. 등록할 때는 파이썬과 스크립트를 절대 경로로 쓰고, 고친 뒤에는 클로드를 완전히 재시작한다.
- tool은 LLM이, resource는 클라이언트가, prompt는 사용자가 꺼낸다. 동작이면 tool, 고정된 데이터면 resource다.
- `FastMCP()`에 이름을 안 주면 무작위 이름이 붙는다.
- 사용자의 말 단위만 도구로 내고, 안쪽 단계는 평범한 함수로 둔다.
- stdio 서버에서 `print()`는 통신 통로를 깨뜨린다. 로그는 stderr로 보낸다.
- 바깥에서 들어온 시각은 시간대를 의심하고, 도구는 필요한 만큼만 추려서, 실패는 이유를 담아 돌려준다.
- 돌려보며 정할 건 노트북에서 끝내고, 서버에는 확정된 것만 옮긴다.
- 클라이언트가 띄우는 서버는 작업 디렉터리가 `/`일 수 있다. 상대 경로를 쓰는 라이브러리가 있으면 `os.chdir(BASE_DIR)`하고 `.env`는 절대 경로로 읽는다.
- 없는 코드를 넣어도 에러 없이 다른 결과를 주는 API가 있다. 의심스러우면 식별자(`rcept_no`)를 본다.

## 오늘 배운 내용 정리
오늘은 FastMCP로 MCP 서버를 직접 만들고, 세 요소를 등록하고, 바깥 API를 부르는 날씨 서버와 DART 서버를 만들었다.

```
FastMCP: mcp = FastMCP(name=...) → @mcp.tool() + docstring + 타입 힌트 → mcp.run() (기본 stdio).
         Annotated[str, Field(description, min_length, ge, le)]. description > docstring.
         확인: fastmcp dev inspector server.py → 등록: claude_desktop_config.json (절대 경로) → 재시작.
3요소: @mcp.tool(동작, LLM이 호출) / @mcp.resource(uri, 클라이언트가 읽음) / @mcp.prompt(질문 틀, 사용자가 고름).
날씨 MCP: 도우미 함수(IP → 좌표)는 도구 아님. 인자 없는 get_weather. fastmcp.json(source, entrypoint, dependencies).
          stdio에서 print 금지(stderr로). timezone=GMT 9시간 차이. 응답은 추려서.
DART MCP: 노트북에서 find_corp_code / company / finstate / report / event 확인 → 감싸기 → @mcp.tool.
          CFS 우선 OFS 대체, 컬럼 5개만. Literal['BS','IS'], 목록은 설명에 + if 검사로 error 반환.
          작업 디렉터리 '/' → Errno 30 → os.chdir(BASE_DIR) + .env 절대 경로.
```

어제는 남이 만든 서버를 붙이기만 해서 MCP가 꽤 거창해 보였는데, 직접 만들어보니 파이썬 함수에 데코레이터를 붙이고 설명을 잘 쓰는 게 거의 전부였다. 대신 그 설명과 타입 힌트가 AI가 도구를 고르고 인자를 채우는 유일한 근거라서, 코드보다 설명을 더 신경 써야 한다는 게 LangGraph에서 배운 것과 그대로 이어졌다. 가장 기억에 남은 건 노트북에서 멀쩡하던 DART 코드가 서버로 옮기자 `/`에 폴더를 만들려다 터진 부분이다. 남이 띄우는 프로그램은 내 작업 환경을 하나도 물려받지 않는다는 문장 하나가 오늘 오후를 요약했다.

---
