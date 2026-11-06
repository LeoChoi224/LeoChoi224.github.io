---
layout: single
title: "LangChain 기초 정리 4 - SiteGPT와 MeetingGPT (Map-Rerank와 Refine)"
categories: [coding, LangChain]
tag: [study-log, LangChain, RAG, SitemapLoader, MapRerank, Whisper, ffmpeg, Refine, Streamlit]
toc: true
author_profile: false
sidebar:
    nav: "docs"
search: true
---
<hr/>

어제부터 만들기 시작한 **SiteGPT**를 오늘 마무리하고, 이어서 **MeetingGPT**를 만들었다. SiteGPT는 웹사이트 전체를 긁어와서 질문에 답하고 출처까지 밝혀주는 앱이고, MeetingGPT는 회의 영상에서 텍스트를 뽑아 요약하고 질문할 수 있게 하는 앱이다.

RAG 체인을 배울 때 표로만 봤던 **Map-Rerank**와 **Refine** 방식이 오늘 두 앱에서 실제 코드가 됐다.

## SiteGPT - 파일 대신 웹사이트를 재료로
DocumentGPT는 사용자가 파일을 올려야 했다. 그런데 실제로 답을 찾고 싶은 곳은 보통 웹사이트다.

| | DocumentGPT | SiteGPT |
|---|---|---|
| 재료 | 업로드한 파일 1개 | 사이트의 여러 페이지 |
| 얻는 법 | `st.file_uploader` | 크롤링 |
| 답 고르기 | Stuff (다 넣고 한 번) | Map-Rerank (점수로 고르기) |
| 출처 | 없음 | URL 과 날짜를 밝힌다 |

웹에서 긁어온 정보는 오래된 것과 최신 것이 섞여 있어서, "이 답이 어느 페이지의 언제 것인지"를 같이 보여줘야 사용자가 믿을 수 있다.

### 사이트맵으로 크롤링하기
```python
from langchain_community.document_loaders.sitemap import SitemapLoader

loader = SitemapLoader(url, parsing_function=parse_page)
loader.max_depth = 1                                  # 수업에서는 1 (기본값 10)
loader.headers = {"User-Agent": "Mozilla/5.0 ..."}
docs = loader.load_and_split(text_splitter=splitter)
```

사이트맵은 사이트가 검색엔진에게 주려고 만들어둔 페이지 목록이다. 보통 `example.com/sitemap.xml`에 있고, 모든 페이지의 URL과 마지막 수정 날짜가 들어 있다.

```xml
<url>
  <loc>https://example.com/news/article-1</loc>
  <lastmod>2026-06-20</lastmod>
</url>
```

크롤러를 직접 짜면 링크를 어디까지 따라갈지 고민해야 하는데, 사이트맵을 쓰면 그 목록이 이미 있어서 앱은 URL 하나만 받으면 된다. 그래서 입력한 주소에 `.xml`이 없으면 에러를 띄우게 했다.

- 크롤링 수업 때 배운 것처럼 많은 사이트가 봇으로 보이는 요청을 막아서 `User-Agent`를 넣었다.
- `max_depth`의 기본값 10으로 두면 사이트 전체를 긁어온다. 페이지가 수백 개면 그만큼 임베딩 비용과 시간이 나가서 수업에서는 일부러 1로 낮췄다.
- `filter_urls=[r"^(.*\/news-updates\/).*"]`처럼 필요한 경로만 골라 긁을 수도 있다. 비용에도 상대 서버에도 그게 낫고, 실제 서비스라면 `robots.txt`를 확인하고 요청 사이에 간격을 두는 게 기본 예의다.

### parse_page - 넣기 전에 청소하기
```python
def parse_page(soup):
    header = soup.find("header")
    footer = soup.find("footer")
    if header: header.decompose()
    if footer: footer.decompose()
    return soup.get_text().replace("\n", " ")
```

`parsing_function`으로 넘기면 페이지마다 이 함수를 거쳐서 Document가 된다. 웹페이지에는 상단 메뉴나 하단 저작권 표시처럼 모든 페이지에 똑같이 들어 있는 부분이 있는데, 이걸 그대로 두면 어느 페이지를 검색해도 같은 메뉴 텍스트가 딸려 오고 임베딩이 흐려진다. 크롤링 수업에서 방해되는 태그를 지울 때 쓴 `decompose()`가 여기서 다시 나왔다. **넣기 전에 청소하는 것이 RAG 품질의 큰 부분**이라고 했다.

### Map-Rerank 직접 만들기 ① - 문서마다 답과 점수
```python
answers_prompt = ChatPromptTemplate.from_template("""
    Using ONLY the following context answer the user's question.
    If you can't just say you don't know, don't make anything up.

    Then, give a score to the answer between 0 and 5.
    If the answer answers the user question the score should be high, else it should be low.
    Make sure to always include the answer's score even if it's 0.

    Context: {context}

    Examples:
    Question: How far away is the moon?
    Answer: The moon is 384,400 km away.
    Score: 5

    Question: How far away is the sun?
    Answer: I don't know
    Score: 0

    Your turn!
    Question: {question}
""")
```

"점수를 매겨라"라고 설명만 하면 형식이 흔들리니까, 만점 예시와 0점 예시를 퓨샷으로 같이 보여준다.

```python
def get_answers(inputs):
    docs = inputs["docs"]
    question = inputs["question"]
    answers_chain = answers_prompt | llm
    return {
        "question": question,
        "answers": [
            {
                "answer": answers_chain.invoke(
                    {"question": question, "context": doc.page_content}
                ).content,
                "source": doc.metadata["source"],     # 페이지 URL
                "date": doc.metadata["lastmod"],      # 사이트맵의 수정 날짜
            }
            for doc in docs
        ],
    }
```

`for doc in docs`가 Map 단계다. 문서마다 따로 LLM을 부른다. 그리고 답과 함께 `metadata`의 출처와 날짜를 계속 들고 다닌다. Document가 `page_content`와 `metadata`로 이루어져 있다고 배웠는데, metadata가 실제로 쓸모를 보여준 첫 사례였다. 사이트맵을 쓴 덕분에 날짜까지 공짜로 얻었다.

### Map-Rerank ② - 점수로 고르고 출처 붙이기
```python
choose_prompt = ChatPromptTemplate.from_messages([
    ("system", """
        Use ONLY the following pre-existing answers to answer the user's question.
        Choose one answer that have the highest score (more helpful) and favor the most recent ones.
        Cite sources and return the sources as it is. Do not change them. Keep is as a link

        Answers: {answers}
    """),
    ("human", "{question}"),
])

def choose_answer(inputs):
    condensed = "\n\n".join(
        f"{answer['answer']}\nSource:{answer['source']}\nDate:{answer['date']}\n"
        for answer in inputs["answers"]
    )
    return (choose_prompt | llm).invoke({"question": inputs["question"], "answers": condensed})
```

수업 코드의 Map-Rerank는 표로 배웠던 설명과 조금 달랐다.

| | 처음 배운 Map-Rerank | SiteGPT 구현 |
|---|---|---|
| 최고점을 고르는 쪽 | 코드가 고른다 | LLM 에게 고르게 한다 |
| 마지막 LLM 호출 | 없다 | 한 번 더 있다 |

점수를 파싱해서 `max()`로 고르는 대신 "점수 높고 최신인 걸 골라줘"라고 모델에게 시킨 것이다. 점수가 같을 때 최신 것을 고르는 판단까지 같이 시킬 수 있다는 게 장점이고, 호출이 한 번 늘고 모델이 지시를 안 지킬 수도 있다는 게 단점이다. "Do not change them"이라는 문장은 모델이 URL을 마음대로 고치는 일이 실제로 있어서 못 박아둔 것이라고 한다. 요즘 AI 검색 서비스들이 답 아래에 출처 링크를 붙여주는 게 이런 구조다.

### 평범한 함수를 체인에 끼우기
```python
chain = {
    "docs": retriever,
    "question": RunnablePassthrough(),
} | RunnableLambda(get_answers) | RunnableLambda(choose_answer)

result = chain.invoke(query)
st.markdown(result.content)
```

```
"질문"
  ├─ retriever ──────────→ docs: [Document, ...]
  └─ RunnablePassthrough → question: "질문"
        ↓
   get_answers    ← 문서마다 LLM 호출 (Map)
        ↓  {"question": ..., "answers": [{answer, source, date}, ...]}
   choose_answer  ← 그중 하나 고르기 (Rerank)
```

`get_answers`와 `choose_answer`는 그냥 파이썬 함수라서 `|`로 이으려면 `RunnableLambda`로 감싸야 한다. 함수가 dict를 받아 dict를 돌려주니 그대로 이어진다. LangChain의 체인은 결국 "앞의 출력이 뒤의 입력"이라는 규칙 하나로 굴러간다. Map 단계에서 LLM을 여러 번 부르기 때문에 이 앱은 글자를 흘려 쓰지 않고, 다 나온 뒤 한 번에 그린다.

맨 위에는 `os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"`라는 줄이 있었다. macOS에서 FAISS와 다른 라이브러리가 같은 병렬 처리 라이브러리(OpenMP)를 각자 들고 있어서 충돌하는 `OMP: Error #15`를 피하는 임시방편이다.

## MeetingGPT - 영상을 텍스트로 만드는 것부터
지금까지 다룬 재료는 파일이든 웹페이지든 이미 텍스트였다. 회의 영상은 텍스트가 아니라서 LLM이 읽을 수 없다. 그래서 RAG 앞에 단계가 하나 더 붙는다.

```
[영상 mp4] → 오디오 추출 → 조각내기 → 받아쓰기 → [텍스트] → 이제부터 아는 이야기
              ffmpeg        pydub       Whisper
```

앞의 세 단계는 LLM과 상관없는 순수 파일 처리다. "AI 앱"이라고 하면 프롬프트만 생각하기 쉬운데 실제로는 이런 준비 작업이 절반이라고 했다.

### 영상에서 소리만 뽑기 - ffmpeg
```python
command = ["ffmpeg", "-i", video_path, "-vn", audio_path, "-y"]
subprocess.run(command)
```

| 옵션 | 뜻 |
|---|---|
| `-i video_path` | 입력 파일 |
| `-vn` | 영상 트랙을 버린다 (video none) |
| `-y` | 파일이 이미 있으면 묻지 말고 덮어쓴다 |

`subprocess.run()`은 파이썬 밖의 프로그램을 부른다. ffmpeg은 파이썬 라이브러리가 아니라 `brew install ffmpeg`으로 따로 설치하는 프로그램이라 `pip install`로는 안 깔린다. `-y`를 빼면 ffmpeg이 "덮어쓸까요?"라고 묻고 입력을 기다리는데, Streamlit 앱에서는 그 질문이 보이지도 않아서 영원히 멈춘 것처럼 보인다.

### 오디오를 10분씩 자르기 - pydub
```python
track = AudioSegment.from_mp3(audio_path)
chunk_len = chunk_size * 60 * 1000              # 분 → 밀리초
chunks = math.ceil(len(track) / chunk_len)      # 올림해서 조각 개수

for i in range(chunks):
    chunk = track[i * chunk_len : (i + 1) * chunk_len]
    chunk.export(os.path.join(chunks_folder, f"chunk_{i}.mp3"), format="mp3")
```

`AudioSegment`는 오디오를 리스트처럼 슬라이싱으로 자를 수 있게 해준다. 단위는 밀리초다. 25분짜리를 10분씩 자르면 2.5개인데 남은 5분도 살려야 하니 `math.ceil`로 올림해서 3개를 만든다.

굳이 자르는 이유는 Whisper API가 한 번에 받을 수 있는 파일 크기에 한도(25MB)가 있기 때문이다. RAG에서 문서를 쪼갤 때의 `chunk_size`와 이름은 같지만, 저기는 검색 정확도 때문이고 여기는 API 제한 때문이라 이유가 완전히 다르다.

### 받아쓰기 - Whisper
```python
files = glob.glob(os.path.join(chunk_folder, "chunk*.mp3"))
files.sort()                                    # 순서가 중요하다

for file in files:
    with open(file, "rb") as audio_file, open(destination, "a") as text_file:
        transcript = openai.audio.transcriptions.create(
            model="whisper-1", file=audio_file, language="en",
        )
        text_file.write(transcript.text)
```

- `glob`은 순서를 보장하지 않아서 `files.sort()`를 빼면 회의 내용이 뒤죽박죽이 된다.
- `"a"`는 이어 쓰기다. `"w"`로 쓰면 조각마다 파일을 덮어써서 마지막 것만 남는다.
- Whisper는 LangChain이 아니라 `openai` SDK를 직접 불렀다. 받아쓰기에는 프롬프트도 파서도 없어서 체인에 넣을 이유가 없다. LangChain이 모든 걸 감싸야 하는 건 아니고, 필요하면 SDK를 직접 부르면 된다.
- 영어 회의라 `language="en"`을 줬다. 지정하지 않으면 조각마다 언어를 다르게 감지할 수도 있어서 명시하는 게 안전하다.

### 다시 하지 않기 위한 가드
세 함수 모두 첫 줄에 `if has_transcript: return`이 있다. 녹취록 파일이 이미 있으면 아무것도 하지 말라는 뜻이다.

| 단계 | 비용 |
|---|---|
| ffmpeg 추출 | 시간 (몇십 초) |
| 조각내기 | 시간 |
| Whisper 받아쓰기 | 돈 + 시간 (몇 분) |

Streamlit은 위젯을 건드릴 때마다 전부 다시 실행하는데, Whisper는 분 단위로 과금된다. 탭을 바꿀 때마다 다시 받아쓰면 큰일이라 `@st.cache_resource`와 이 가드로 두 겹 방어를 했다. 캐시는 앱이 켜져 있는 동안, 가드는 껐다 켜도 결과 파일이 있으면 막아준다.

몇 분씩 걸리는 작업이라 `st.status`로 지금 어느 단계인지 보여줬다.

```python
with st.status("Loading video...") as status:
    status.update(label="Extracting audio...")
    extract_audio_from_video(video_path)
    status.update(label="Cutting audio segments...")
    cut_audio_in_chunks(audio_path, 10, chunks_folder)
    status.update(label="Transcribing Audio...")
    transcribe_chunks(chunks_folder, transcript_path)
```

이게 없으면 사용자는 멈춘 화면을 보고 고장 난 줄 알고 새로고침을 하고, 그러면 전부 처음부터 다시 시작된다.

### Refine으로 요약하기
```python
# 첫 번째 조각으로 초안
summary = (first_summary_prompt | llm | StrOutputParser()).invoke(
    {"text": docs[0].page_content}
)

# 나머지 조각으로 다듬기
refine_chain = refine_prompt | llm | StrOutputParser()
for doc in docs[1:]:
    summary = refine_chain.invoke({
        "existing_summary": summary,      # 직전 결과가 다시 입력으로
        "context": doc.page_content,
    })
```

`summary` 변수가 계속 자기 자신으로 갱신되는 게 Refine의 전부였다. 앞의 결과가 나와야 다음을 시작할 수 있으니 병렬로 못 돌리고 `for`문일 수밖에 없다. 그래서 가장 느린 방식이다.

Refine 프롬프트에는 두 문장이 꼭 필요하다고 했다.

```
If the additional context does not require any changes, return the existing summary exactly as it is.
Do NOT explain your decision. Just output the final summary.
```

관련 없는 조각을 만나면 요약을 망치지 말고 그대로 두라는 것과, "이번엔 바꿀 게 없었습니다" 같은 설명을 붙이지 말라는 것이다. 두 번째 문장이 없으면 그 설명이 요약에 섞여서 다음 회차의 입력을 오염시킨다.

회의는 앞뒤 맥락이 이어지는 하나의 흐름이라, 조각을 따로 요약해서 붙이는 Map-Reduce로 하면 "누가 무엇에 반대했는지" 같은 흐름이 끊긴다. 그래서 느려도 Refine을 골랐다.

### 탭으로 세 기능 묶기
```python
transcript_tab, summary_tab, qa_tab = st.tabs(["Transcript", "Summary", "Q&A"])
```

받아쓴 원문을 보는 탭, Refine 요약 탭, 녹취록에 질문하는 Q&A 탭이다. 요약은 LLM을 여러 번 부르니 탭을 열 때마다 자동으로 돌면 안 돼서 `st.button`을 눌렀을 때만 실행하게 했다. Q&A 탭은 녹취록 텍스트 파일을 임베딩해서 retriever를 만드는 구조라 DocumentGPT를 재사용한 것이다. 같은 재료(녹취록)로 세 가지 기능을 붙이는 설계였다.

## 헷갈리기 쉬운 부분
- SiteGPT에는 사이트맵 URL(`.xml`)을 넣어야 한다. 일반 페이지 주소를 넣으면 안 된다.
- 사이트맵에 `lastmod`가 없는 사이트면 `doc.metadata["lastmod"]`에서 `KeyError`가 난다.
- Map 단계는 문서 수만큼 LLM을 부른다. 크롤링하는 페이지가 많으면 그만큼 비용이 크다.
- SiteGPT 코드 주석에는 "사이트맵마다 캐시를 따로 만들어야 한다"고 적혀 있었는데, 실제 코드에는 임베딩 캐시 없이 `OpenAIEmbeddings()`를 바로 쓰고 있었다. 그래서 앱을 껐다 켜면 다시 임베딩 비용이 나간다.
- MeetingGPT의 가드가 확인하는 녹취록 파일 이름은 `podcast.txt`로 고정돼 있는데, 실제 녹취록 이름은 업로드한 영상 이름을 따라간다. 실습 영상이 `podcast.mp4`라서 맞아떨어졌지만, 다른 영상을 올리면 가드가 안 걸릴 수 있다.
- Q&A 탭은 아직 질문이 코드에 고정돼 있고 검색 결과를 그대로 출력하는 단계까지만 되어 있었다.

## 오늘 배운 내용 정리
오늘은 SiteGPT와 MeetingGPT를 만들면서 Map-Rerank와 Refine을 코드로 구현했다.

```
SitemapLoader: 사이트맵 XML 하나로 여러 페이지를 긁는다. max_depth 는 곧 비용.
parse_page: 헤더·푸터를 decompose 로 지우고 넣는다. 넣기 전에 청소.
Map-Rerank: 문서마다 답 + 0~5점(퓨샷 예시) → 점수 높고 최신인 답을 고른다.
출처: metadata 의 source, lastmod 를 답과 함께 들고 다니다가 같이 내보낸다.
RunnableLambda: 평범한 함수를 체인에 끼운다. 앞의 출력이 뒤의 입력.
MeetingGPT 준비: ffmpeg(-vn, -y) → pydub 10분 조각 → Whisper(정렬, "a" 이어 쓰기).
조각내는 이유: Whisper 파일 크기 한도. RAG 의 chunk 와는 이유가 다르다.
가드: @st.cache_resource + if has_transcript: return. Whisper 는 분 단위 과금.
Refine: summary = refine_chain.invoke({"existing_summary": summary, ...}). 병렬 불가.
Refine 프롬프트: 바꿀 게 없으면 그대로, 설명은 붙이지 말 것.
```

RAG 체인 네 가지를 배울 때는 표로만 비교했는데, 오늘 두 앱을 만들면서 왜 SiteGPT는 Map-Rerank이고 MeetingGPT는 Refine인지가 이해됐다. 정답이 특정 페이지 하나에 있으면 Map-Rerank, 흐름을 이어서 정리해야 하면 Refine이다.

그리고 MeetingGPT에서는 LLM을 부르기 전의 준비 작업(ffmpeg, pydub, Whisper)이 코드의 절반이었다. 어디서 시간이 걸리고 어디서 돈이 나가는지가 코드에 그대로 드러났다.

---
