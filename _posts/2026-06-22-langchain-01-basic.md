---
layout: single
title: "LangChain 기초 모델 입출력(Model I/O), 메모리 관리 및 Streamlit 기본 출력"
categories: [coding, LangChain]
tag: [study-log, LangChain, OpenAI, LLM, ChatModel, FewShot, Caching, Memory, Streamlit]
toc: true
author_profile: false
sidebar:
    nav: "docs"
search: true
---
<hr/>

오늘부터 본격적으로 대규모 언어 모델(LLM)을 조율하는 AI 프레임워크인 **LangChain** 진도를 나가기 시작했다.

이전에는 단순 API 호출에 그쳤던 LLM 개발을 넘어, 프롬프트 템플릿(PromptTemplate), Few-Shot Prompting, 응답 캐싱(Caching) 및 대화 문맥 유지(Memory) 등의 고급 제어 방식을 학습했다. 더불어 Python만으로 웹 UI 프로토타입을 빠르게 빌드하게 돕는 Streamlit의 기초적인 출력 방법도 정리해보려고 한다.

## LangChain이란?

`LangChain`은 대규모 언어 모델(LLM)을 더 효율적이고 유연하게 활용할 수 있도록 설계된 프레임워크로 LLM(예: OpenAI의 GPT)과 함꼐 데이터를 조각하거나, 워크플로우를 설계하고 애플리케이션을 구축하는데 도움을 준다.

LangChain은 특히 체인(Chain)이라는 개념을 중심으로 작동하며, LLM을 호출하는 과정을 여러 단계로 구성하여 복잡한 작업을 수행할 수 있고, 이를 통해 대화형 AI, 검색 시스템, 데이터 분석등 다양한 애플리케이션을 쉽게 개발할 수 있다.

## LLM vs ChatModel

LangChain에서 언어 모델을 호출하는 방식은 크게 두 가지로 분류된다.

1. **LLM (Large Language Model)**: 단순 **텍스트** 입력을 받아 텍스트 출력으로 답하는 전통적인 완성형 모델 (`langchain_openai.OpenAI`)

2. **ChatModel**: 구조화된 대화형 **메세지(Message)** 목록을 받아 대화형 메세지로 답하는 최신 채팅 최적화 모델 (`angchain_openai.ChatOpenAI`)


```python
from langchain_openai import OpenAI, ChatOpenAI
from langchain.messages import SystemMessage, HumanMessage, AIMessage

# LLM 호출
# 데이터 흐름: 문자열(str) -> 모델 -> 문자열(str)
llm = OpenAI()

result = llm.invoke("How many planets are there?")
print(result)

# ChatModel 호출
# 데이터 흐름: 메시지 객체 리스트(list[Message]) -> 모델 -> AI 메시지 객체(AIMessage)
chat = ChatOpenAI(temperature=0.1)

messages = [
    SystemMessage(content = "You are a geography expert. And your only reply in Korean",
    ),
    AIMessage(
        content = "안녕, 내 이름은 ChatModel 이야.",
    ),
    HumanMessage(
        content = """What is the distance between Mexico and Thailand.
          Also, what is your name?""",        
    )
]
result = chat.invoke(messages)
print(result, result.content)  # 결과 AIMessage 반환
```

IT에서 invoke는 무언가를 '실행하다' 또는 '호출하다'라는 뜻이라 한다.

LangChain에서 invoke는 **LLM(대형 언어 모델)이나 체인(Chain)에 입력값을 체계적으로 전달하여 실행하는 표준 메서드(함수)**다.

대화(Conversation) 흐름을 원활하게 관리하기 위해, 사람이 쓰는 HumanMessage, 시스템 설정을 잡는 SystemMessage, 그리고 AI의 반환값인 AIMessage 클래스의 역할을 명확히 이해하고 활용했다.

**단일 작업이나 간단한 텍스트 생성**에는 `LLM`을 사용하는것이 적합하고, **대화 기반 애플리케이션이나 문맥을 유지해야 하는 작업**에는 `ChatModel`을 사용하는것이 더 적합하다.

