---
layout: single
title: "LangChain 기초 정리 3 - DocumentGPT, QuizGPT와 Function Calling"
categories: [coding, LangChain]
tag: [study-log, LangChain, RAG, Streamlit, cache_resource, callback, FunctionCalling, OpenAI]
toc: true
author_profile: false
sidebar:
    nav: "docs"
search: true
---
<hr/>

오늘은 지금까지 따로 배운 RAG, Streamlit, 콜백을 하나로 합쳐서 첫 번째 앱인 **DocumentGPT**를 만들었다. 업로드한 문서에 대해 질문하면 그 문서 내용으로 답해주는 앱이다. 이어서 문서로 퀴즈를 만들어주는 **QuizGPT**를 만들고, 오후에는 모델에게 정해진 형식으로 답을 받아내는 **Function Calling**을 배웠다.

## DocumentGPT - 매번 다시 실행되는 Streamlit의 함정
지금까지는 문서를 쪼개고 임베딩해서 검색하는 건 주피터 노트북에서, 채팅 화면은 Streamlit에서 따로 해봤다. 오늘 이걸 합치는 순간 새로운 문제가 생겼다.

Streamlit은 **위젯을 건드릴 때마다 파일 전체가 다시 실행된다.** 질문을 한 번 할 때마다 문서를 다시 읽고, 다시 쪼개고, 다시 임베딩한다는 뜻이다. 임베딩은 API 비용이 드니까 이대로면 앱이 아니라 요금 폭탄이다.

### @st.cache_resource - 이 앱을 성립시키는 한 줄
```python
@st.cache_resource(show_spinner="Embedding file...")
def embed_file(file):
    print("embed_file 호출", file.name)    # 처음 한 번만 찍힌다
    ...
    return retriever
```

함수 위에 붙이는 "같은 입력이면 다시 계산하지 마"라는 표시다. Streamlit이 매개변수 `file`을 해시해서 기억해뒀다가, 같은 파일이면 함수를 다시 실행하지 않고 저장해둔 리턴값을 그대로 준다. `print`가 처음 한 번만 찍히는 걸로 확인할 수 있었다. `show_spinner`는 실제로 계산하는 동안 로딩 표시를 띄워서, 사용자가 멈춘 화면을 보고 당황하지 않게 해준다.

이름이 비슷한 `cache_data`와는 다르다.

| | 무엇을 캐시하나 | 어떻게 |
|---|---|---|
| `@st.cache_data` | 데이터 (DataFrame, 숫자, 문자열) | 복사본을 만들어준다 |
| `@st.cache_resource` | 연결, 객체 (DB 연결, 모델, retriever) | 원본을 그대로 공유한다 |

retriever는 복사하면 안 되는 무거운 객체라 `cache_resource`가 맞다. 복사해도 되는 값이면 `cache_data`, 공유해야 하는 물건이면 `cache_resource`라고 기억하면 된다.

### 업로드한 파일을 retriever로
```python
def embed_file(file):
    # ① 업로드된 파일을 디스크에 저장
    file_path = os.path.join(upload_dir, file.name)
    with open(file_path, "wb") as f:
        f.write(file.read())

    # ② 불러와서 쪼개기
    splitter = CharacterTextSplitter.from_tiktoken_encoder(
        separator="\n", chunk_size=600, chunk_overlap=100)
    docs = UnstructuredFileLoader(file_path).load_and_split(text_splitter=splitter)

    # ③ 임베딩 + 캐시 + 벡터스토어
    cache_dir = LocalFileStore(os.path.join(embedding_dir, file.name))   # 파일별로!
    cached_embeddings = CacheBackedEmbeddings.from_bytes_store(OpenAIEmbeddings(), cache_dir)
    vectorstore = FAISS.from_documents(docs, cached_embeddings)
    return vectorstore.as_retriever()
```

- `st.file_uploader`가 주는 건 메모리 위의 파일 객체인데 로더는 파일 경로를 받아서, 한 번 디스크에 저장해야 한다.
- 임베딩 캐시 폴더를 파일 이름별로 나눴다. 한 폴더에 다 넣으면 어느 벡터가 어느 파일 것인지 섞인다.
- 지난 시간에는 Chroma를 썼는데 여기서는 FAISS를 썼다. FAISS는 메모리에만 있어서 빠르고 앱이 꺼지면 사라지는데, 업로드할 때마다 만들고 버리는 이 앱에는 그쪽이 깔끔하다. 인터페이스가 같아서 클래스 이름만 바꾸면 되는 게 LangChain의 장점이다.

캐시가 두 겹이라는 것도 정리했다. `@st.cache_resource`는 앱이 켜져 있는 동안 같은 파일이면 `embed_file` 자체를 안 부르고, `CacheBackedEmbeddings`는 부르더라도 이미 임베딩한 조각은 API를 안 부른다. 앱을 껐다 켜면 위쪽은 사라지지만 아래쪽은 파일로 남는다.

### 질문 하나를 두 갈래로 보내는 체인
```python
chain = (
    {
        "context": retriever | RunnableLambda(format_docs),
        "question": RunnablePassthrough(),
    }
    | prompt
    | llm
)

chain.invoke(message)      # 입력이 dict 가 아니라 그냥 문자열이다
```

오늘 가장 밀도 높은 부분이었다. retriever도 Runnable이라 `|`로 이어 붙일 수 있고, 질문 문자열을 받아 관련 Document 목록을 돌려준다.

```
          "무슨 색인가요?"
         ╱                ╲
retriever | format_docs   RunnablePassthrough()
         ↓                    ↓
   context="문서1\n\n문서2"   question="무슨 색인가요?"
         ╲                ╱
          → prompt → llm
```

dict의 두 갈래가 같은 문자열을 각각 받아서, 하나는 검색에 쓰고 하나는 그대로 쓴다. 그래서 `invoke`에 문자열을 그냥 넣는다. `RunnablePassthrough()`는 인자 없이 쓰면 입력을 그대로 통과시키는 것이고, 메모리를 배울 때 쓴 `RunnablePassthrough.assign(x=f)`는 입력을 통과시키면서 항목을 추가하는 것이라 다르다.

프롬프트에는 지난 시간에 배운 대로 "주어진 context만으로 답하고, 모르면 모른다고 하고, 지어내지 마라"는 문장을 넣었다.

### 콜백으로 글자가 타자 치듯 나오게
`StreamingStdOutCallbackHandler`는 터미널에 찍기 때문에, 화면에 흘려 쓰려면 콜백 핸들러를 직접 만들어야 한다.

```python
class ChatCallbackHandler(BaseCallbackHandler):
    def on_llm_start(self, *args, **kwargs):
        self.message = ""
        self.message_box = st.empty()              # 화면에 빈 자리 하나 잡기

    def on_llm_new_token(self, token, *args, **kwargs):
        self.message += token
        self.message_box.markdown(self.message)    # 그 자리를 계속 덮어쓴다

    def on_llm_end(self, *args, **kwargs):
        save_message(self.message, "ai")           # 다 끝나면 기록에 저장

llm = ChatOpenAI(temperature=0.1, streaming=True, callbacks=[ChatCallbackHandler()])

with st.chat_message("ai"):
    chain.invoke(message)                          # 리턴값을 안 받는다
```

`st.empty()`로 빈 칸을 하나 잡아두고, 토큰이 올 때마다 그 칸을 통째로 다시 쓴다. "안" → "안녕" → "안녕하"가 빠르게 반복되니 타자 치는 것처럼 보인다. 화면에 그리는 일은 콜백이 이미 다 했기 때문에 `invoke`의 리턴값은 받지 않는다. 그리고 스트리밍 중에는 답이 완성되지 않았으니 저장은 `on_llm_end`에서 한 번만 한다.

| 함수 | 언제 불리나 |
|---|---|
| `on_llm_start` | LLM 이 작업을 시작할 때 |
| `on_llm_new_token` | 토큰이 하나 생길 때마다 |
| `on_llm_end` | 작업이 끝났을 때 |

화면 흐름에서는 파일이 없거나 바뀌면 `st.session_state["messages"] = []`로 대화를 비우는 `else` 절이 있었다. A 문서에 대한 대화가 B 문서 화면에 남으면 혼란스럽기 때문이다. "준비되었습니다" 같은 인사말은 매번 다시 그려지는 것이라 `save=False`로 저장하지 않는다. 저장하면 실행할 때마다 하나씩 늘어난다.

참고로 이 앱은 화면에 지난 대화가 보이지만 체인에는 대화 기록이 들어가지 않는다. 그래서 "방금 그거 더 자세히"라고 물으면 "그거"가 뭔지 모른다. RAG와 메모리를 한꺼번에 붙이면 어디가 문제인지 알기 어려워서 단계를 나눈 것으로 보인다.

## QuizGPT - 코드가 읽을 수 있는 답이 필요하다
DocumentGPT는 답이 그냥 글이라 화면에 뿌리면 끝이었다. 퀴즈 앱은 다르다. 문제 목록을 돌면서 라디오 버튼을 만들고 정답을 확인하려면 답이 줄글이 아니라 **구조**여야 한다. 지금까지는 모델의 답을 사람이 읽었는데, 이제부터는 코드가 읽어야 한다.

### 이번에는 RAG가 아니다
```python
@st.cache_resource(show_spinner="Loading file...")
def split_file(file):
    ...
    return loader.load_and_split(text_splitter=splitter)    # 쪼갠 Document 목록만
```

RAG는 "이 질문에 관련된 부분을 찾아라"일 때 필요하다. 퀴즈는 문서 전체로 문제를 내는 것이라 찾을 게 없어서, 임베딩도 벡터스토어도 없이 쪼갠 문서를 그냥 넘긴다. **LLM 앱이라고 다 RAG는 아니다.** 검색이 필요 없으면 임베딩 비용도 안 든다.

### 체인 두 개 - 만들고, 형식 맞추고
한 번에 JSON을 만들라고 하면 잘 안 돼서 두 단계로 나눴다.

```python
quiz_chain = {"context": format_docs} | quiz_prompt | llm        # ① 문제 만들기
formatting_chain = formatting_prompt | llm                        # ② JSON 으로 바꾸기
chain = {"context": quiz_chain} | formatting_chain | output_parser
```

①의 프롬프트는 퓨샷 예시로 자체 형식을 보여준다.

```
Question: What is the color of the ocean?
Answers: Red|Yellow|Green|Blue(o)
```

보기는 `|`로 구분하고 정답에 `(o)`를 붙이는 형식이다. JSON보다 모델이 지키기 쉽다. ②가 이걸 JSON으로 번역한다. 문제를 만드는 일과 형식을 맞추는 일을 다른 사람에게 시킨 셈이다. 대신 LLM을 두 번 부른다.

{% raw %}
### 프롬프트 안의 중괄호는 두 번
②의 프롬프트에 JSON 예시를 통째로 넣는데, 중괄호가 두 개씩이었다.

```python
formatting_prompt = ChatPromptTemplate.from_messages([("system", """
    {{ "questions": [
            {{
                "question": "What is the color of the ocean?",
                "answers": [
                        {{ "answer": "Red", "correct": false }},
                        ...
""")])
```

프롬프트 템플릿에서 `{context}`는 채울 자리다. JSON 예시의 `{`를 그대로 두면 LangChain이 변수 이름으로 착각해서 `KeyError`를 낸다. `{{`와 `}}`는 "이건 진짜 중괄호다"라는 표시로, 파이썬 f-string과 같은 규칙이다. JSON이나 코드 예시를 프롬프트에 넣을 때 반드시 걸리는 함정이라고 했다.
{% endraw %}

### 마크다운 울타리를 걷어내는 파서
모델은 JSON을 마크다운 코드 블록(백틱 세 개와 `json`)으로 감싸서 준다. `json.loads()`는 그 백틱을 이해하지 못하니 먼저 지운다.

~~~python
class JsonOutputParser(BaseOutputParser):
    def parse(self, text):
        text = text.replace("```json", "").replace("```", "")
        return json.loads(text)
~~~

다만 모델이 JSON 앞에 "Here is the quiz:" 같은 말을 한 줄만 붙여도 `json.loads`가 실패한다. 프롬프트로 아무리 단속해도 가끔 어긴다. 그래서 오늘 직접 만든 파서는 원리를 보려는 것이고, 실무에서는 아래 Function Calling을 쓴다고 했다.

### st.form으로 묶은 퀴즈 화면
```python
with st.form(key="questions_form"):
    for key, question in enumerate(response["questions"]):
        st.write(question["question"])
        value = st.radio(
            label="Select an option",
            options=[answer["answer"] for answer in question["answers"]],
            key=key,         # 같은 위젯이 10개라 구분자가 필요하다
            index=None,      # 처음엔 아무것도 안 고른 상태
        )
        if {"answer": value, "correct": True} in question["answers"]:
            st.success("Correct!")
        elif value is not None:
            st.error("Wrong!")
    st.form_submit_button()
```

- `key=`가 없으면 같은 `st.radio`가 10개라 Streamlit이 구분하지 못해서 에러가 난다.
- `index=None`이 없으면 첫 보기가 미리 골라져 있어서 열자마자 채점된다.
- 정답 확인은 내가 고른 답으로 "정답인 척하는 dict"를 만들어보고, 그게 실제 보기 목록 안에 있는지 보는 방식이었다.
- `st.form`으로 감싸지 않으면 라디오 하나 고를 때마다 전체가 다시 실행된다.

## Function Calling - 형식을 강제하는 방법
오후에 배운 내용이다. 출발점은 날씨 질문이었다.

```python
chain.invoke({"city": "rome"})
# "I'm sorry, I am not able to provide real-time weather updates."
```

모델은 실시간 정보를 모른다. 그런데 우리에게는 위도와 경도로 날씨를 가져오는 함수가 있다. 문제는 모델이 "로마의 위도·경도"를 우리 함수에 넣어줘야 한다는 것이다. 그래서 함수의 사용법을 스키마로 알려준다.

```python
def get_weather(lon, lat):
    url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current_weather=true"
    return httpx.get(url).json()

function_schema = {
    "name": "get_weather",
    "description": "function that takes longitude and latitude to find the weather of a place",
    "parameters": {
        "type": "object",
        "properties": {
            "lon": {"type": "number", "description": "The longitude coordinate"},
            "lat": {"type": "number", "description": "The latitude coordinate"},
        },
        "required": ["lon", "lat"],
    },
}

llm = ChatOpenAI(temperature=0.1).bind(functions=[function_schema])
```

```python
response.additional_kwargs["function_call"]
# {'arguments': '{"lon":12.4964,"lat":41.9028}', 'name': 'get_weather'}

args = json.loads(response.additional_kwargs["function_call"]["arguments"])
get_weather(**args)       # 실제 함수는 우리 코드가 부른다
```

응답의 `content`는 비어 있고, 대신 "`get_weather`를 이 인자로 불러달라"는 요청이 들어 있었다. 로마의 위도·경도는 모델이 자기 지식에서 채워 넣은 것이다. 중요한 건 **모델이 함수를 직접 실행하지 않는다**는 점이다. 무엇을 어떤 인자로 부를지 알려줄 뿐이고, 실행은 우리 코드가 한다.

### 존재하지 않는 함수로 형식 강제하기
두 번째 용도가 오늘의 본론이었다.

```python
function_schema = {
    "name": "create_quiz",          # 실제로는 존재하지 않는 함수다
    "description": "function that takes a list of questions and answers and returns a quiz",
    "parameters": { ... },          # questions / answers 의 JSON 구조
}

llm = ChatOpenAI(temperature=0.1).bind(
    functions=[function_schema],
    function_call={"name": "create_quiz"},    # 반드시 이 함수 형식으로 답하라
)
```

`create_quiz`는 실제로 없는 함수다. 함수를 부르게 하려는 게 아니라 "이 모양으로 인자를 만들어라"는 명령서로 스키마를 쓴 것이다. 결과는 반드시 그 구조의 JSON이고, 마크다운 울타리도 군말도 없다.

| | 프롬프트로 부탁 (QuizGPT) | Function Calling |
|---|---|---|
| 형식 보장 | 모델이 잘 지켜주길 바랄 뿐 | 스키마가 강제한다 |
| LLM 호출 | 2번 (만들기 + 형식) | 1번 |
| 실패하면 | `JSONDecodeError` 로 앱이 죽는다 | 거의 안 깨진다 |

`function_call="auto"`로 두면 모델이 함수를 쓸지 말지 스스로 판단하는데, 이게 다음 주에 배울 에이전트(Agent)의 출발점이라고 한다. `.bind()`는 "이 모델을 부를 때 항상 이 인자를 같이 보내라"고 설정해둔 새 Runnable을 만드는 것이다. 요즘은 이 기능이 `tools`라는 이름으로 확장됐고, LangChain에는 파이썬 함수를 넘기면 스키마를 자동으로 만들어주는 `bind_tools()`나 Pydantic 모델로 받는 `with_structured_output()`도 있다고 했다.

## 헷갈리기 쉬운 부분
- `@st.cache_resource`를 빼면 질문할 때마다 임베딩해서 돈과 시간이 그대로 나간다. Streamlit과 LLM 조합의 1번 함정이다.
- `st.file_uploader`의 결과는 경로가 아니라 메모리 객체라, 디스크에 한 번 써야 로더가 읽는다.
- 콜백은 `with st.chat_message("ai"):` 안에서 실행해야 말풍선 안에 글자가 찍힌다.
- Function Calling 응답의 `arguments`는 딕셔너리가 아니라 문자열이라 `json.loads()`가 한 번 더 필요하다.
- QuizGPT의 위키피디아 검색 함수는 이름이 `wiki_search`인데 실제로는 DuckDuckGo 검색을 쓰고 있었고, `WikipediaRetriever`를 쓰는 코드는 주석 처리돼 있었다.
- 업로드 파일과 임베딩 캐시가 쌓이는 `.cache/` 폴더는 git에 올리지 않는다.

## 오늘 배운 내용 정리
오늘은 DocumentGPT와 QuizGPT를 만들고 Function Calling을 배웠다.

```
@st.cache_resource: 같은 입력이면 다시 실행하지 않는다. 없으면 질문마다 임베딩 비용.
cache_data vs cache_resource: 복사해도 되는 값 / 공유해야 하는 물건.
DocumentGPT 체인: {"context": retriever | format_docs, "question": RunnablePassthrough()} | prompt | llm
RunnablePassthrough(): 입력을 그대로 통과. assign() 은 항목 추가.
스트리밍 화면: 콜백 + st.empty(). 토큰마다 덮어쓰고 저장은 on_llm_end 에서.
QuizGPT: 검색이 없으니 임베딩도 없다. LLM 앱이라고 다 RAG 는 아니다.
프롬프트 속 JSON: 중괄호는 두 번 써서 진짜 중괄호로.
Function Calling: 스키마를 주면 모델이 "이 함수를 이 인자로" 라고 답한다. 실행은 내 코드.
형식 강제: 없는 함수 이름 + function_call={"name": ...}. 호출 1번, 거의 안 깨진다.
```

따로 배울 때는 각각의 기능이었던 RAG, Streamlit, 콜백이 오늘 처음으로 하나의 앱이 됐다. 그리고 그 앱을 실제로 쓸 수 있게 만든 건 `@st.cache_resource` 한 줄이었다.

모델의 답을 사람이 아니라 코드가 읽어야 할 때는 프롬프트로 부탁하는 것보다 스키마로 강제하는 게 맞다는 걸, 같은 퀴즈를 두 방법으로 만들어보면서 확인했다.

---
