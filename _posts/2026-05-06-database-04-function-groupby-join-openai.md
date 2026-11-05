---
layout: single
title: "Database 기초 정리 4 - 단일행 함수, GROUP BY, JOIN과 OpenAI API"
categories: [coding, Database]
tag: [study-log, Database, MySQL, IFNULL, GROUP-BY, HAVING, JOIN, OUTER-JOIN, OpenAI, prompt]
toc: true
author_profile: false
sidebar:
    nav: "docs"
search: true
---
<hr/>

오늘은 지난주에 낸 도서관리 과제 리뷰로 시작해서, SQL 함수(단일행 함수와 그룹 함수), 흩어진 표를 이어 붙이는 **JOIN**을 배웠다. 그리고 마지막에는 파이썬으로 **OpenAI API**를 호출해서 GPT와 대화하는 방법까지 배웠다.

SQL만 세 덩어리에 API까지 나와서 양이 많았는데, 오늘 배운 내용을 기준으로 큰 흐름을 정리해보려고 한다.

## 단일행 함수와 그룹 함수
SQL 함수는 크게 둘로 나뉜다.

| | 단일행 함수 | 그룹 함수 |
|---|---|---|
| 입력 | 행 하나 | 행 여러 개 |
| 결과 행 수 | 입력과 같다 | 줄어든다 |
| 예 | `SUBSTR`, `IFNULL`, `ROUND` | `COUNT`, `SUM`, `AVG` |

20명짜리 표에 `SUBSTR(name, 2)`를 걸면 결과도 20줄이고, `AVG(pay)`를 걸면 1줄이 된다. 단일행 함수는 각 줄에 도장을 찍는 것이고, 그룹 함수는 여러 줄을 한 장으로 접어서 요약을 적는 것이라고 이해했다.

## 문자열 자르고 찾기
```sql
SELECT name,
    substr(name, 2),       -- 2번째 문자부터 끝까지
    substr(jumin, 1, 6)    -- 1번째부터 6글자 (생년월일)
FROM t_student;
```

여기서 가장 헷갈린 부분은 **시작 위치가 1부터**라는 것이다. 파이썬은 `s[0]`이 첫 글자인데 SQL은 `SUBSTR(s, 1)`이 첫 글자다.

`INSTR`로 위치를 찾고 `SUBSTR`로 자르면 "괄호 앞까지만" 같은 자르기를 할 수 있다.

```sql
-- (02)123-4567 → (02
SELECT name, tel, substr(tel, 1, instr(tel, ')') - 1) 지역번호
FROM t_student;
```

`INSTR`로 가위질할 자리를 찾고, `SUBSTR`로 자른다. 파이썬의 `tel[:tel.index(')')]`와 같다. 다만 `INSTR`은 못 찾으면 에러가 아니라 0을 돌려줘서 빈 문자열이 나온다.

## NULL 처리 IFNULL
지난주에 보너스가 NULL인 교수는 연봉 계산이 통째로 NULL이 나왔는데, 그 해결책이 `IFNULL`이다.

```sql
SELECT name, pay,
    ifnull(bonus, 0) as BONUS,
    pay * 12 + ifnull(bonus, 0) as 연봉
FROM t_professor;
```

## 숫자와 날짜 꾸미기
```sql
SELECT format(1234567, 0);                         -- 1,234,567
SELECT date_format(now(), '%Y-%m-%d %H:%i:%s');    -- 2026-05-06 14:30:05
SELECT date_add(now(), INTERVAL 1 MONTH) "한달뒤";
```

`DATE_FORMAT`에서 **분은 `%i`**다. `%m`은 이미 월이 쓰고 있기 때문이다. 그리고 `FORMAT()`의 결과는 숫자가 아니라 문자열이라서, 계산을 다 끝낸 뒤 마지막에 씌워야 한다.

날짜를 직접 더하지 않고 `DATE_ADD`를 쓰는 이유는 달마다 일수가 다르고 윤년이 있어서, "한 달 뒤"를 30일로 계산하면 틀리기 때문이다.

## 그룹 함수와 NULL
```sql
SELECT count(*), count(pay), sum(pay), avg(pay), min(pay), max(pay) FROM t_professor;
```

그룹 함수에서는 **NULL이 집계에서 빠진다.** 그래서 이런 차이가 생긴다.

```sql
SELECT avg(bonus), avg(ifnull(bonus, 0)) FROM t_professor;
```

교수 20명 중 12명만 보너스가 있다면, `AVG(bonus)`는 분모가 12라서 "보너스 받는 사람들의 평균"이고, `AVG(IFNULL(bonus, 0))`는 분모가 20이라서 "전체 교수 1인당 평균"이다. **둘 다 맞는 값이고, 무엇을 묻는 질문이냐에 따라 골라야 한다.** 평균이 이상할 때는 분모가 몇이어야 하는지부터 정해야 할 것 같다.

`COUNT(*)`는 행 개수, `COUNT(컬럼)`은 그 컬럼이 NULL이 아닌 개수라서 값이 다를 수 있다.

## GROUP BY와 HAVING
```sql
-- 에러: 그룹 함수와 일반 컬럼을 같이 쓸 수 없다
-- SELECT deptno, avg(pay) FROM t_professor;
```

`avg(pay)`는 전체를 접어서 한 줄을 만드는데, `deptno`는 20줄마다 값이 다르다. 그 한 줄에 어떤 학과번호를 써야 할지 정할 수 없어서 에러가 난다. 그래서 "학과별로 접어라"라고 `GROUP BY`를 알려준다.

```sql
SELECT deptno, avg(pay) FROM t_professor
WHERE  position = '정교수'   -- 묶기 전: 개별 행을 거른다
GROUP BY deptno              -- 학과별로 접는다
HAVING avg(pay) > 300        -- 묶은 뒤: 묶음을 거른다
ORDER BY deptno;
```

SELECT에 쓴 일반 컬럼은 전부 GROUP BY에 들어가야 한다.

`WHERE avg(pay) > 300`이 안 되는 이유는 SQL의 처리 순서 때문이다.

```
FROM      표를 연다
WHERE     ← 아직 행 하나하나만 있다. 평균이라는 게 없다
GROUP BY  묶는다
HAVING    ← 이제 묶음의 평균이 있으니 조건을 걸 수 있다
SELECT    출력할 칸을 고른다
ORDER BY  정렬한다
```

`WHERE`는 입장 심사이고 `HAVING`은 단체 심사라는 비유가 와닿았다. "키 170 이상만 입장"은 한 명씩 보면 되지만, "평균 키 170 이상인 팀만"은 팀이 짜인 뒤에야 잴 수 있다.

연습문제에서는 근속일 평균을 구할 때 `avg(now() - hiredate)`로 쓴 초안이 있었는데, 날짜끼리 빼면 MySQL이 숫자로 바꿔서 엉뚱한 값이 나온다. 두 날짜의 차이는 `DATEDIFF(now(), hiredate)`로 구해야 한다.

## 표가 나뉘어 있는 이유
학생 표에 학과 이름을 직접 넣으면, 학생이 300명일 때 같은 학과 이름이 300번 저장된다. 학과 이름이 바뀌면 300줄을 다 고쳐야 하고, 하나라도 빠뜨리면 데이터가 어긋난다.

그래서 이름은 학과 표에 한 번만 두고 학생 표에는 번호만 둔다. 대신 둘을 같이 보고 싶을 때 쓰는 것이 JOIN이다.

## JOIN의 출발점은 모든 조합
```sql
-- 20 x 12 = 240 행
SELECT s.studno, s.name, d.dname
FROM t_student s, t_department d;
```

조건 없이 두 표를 붙이면 학생 20명 각각에 학과 12개를 전부 짝지은 240줄이 나온다. 이걸 **카티션곱**이라고 한다. JOIN 조건은 이 240줄 중에서 말이 되는 것만 골라내는 필터다.

```sql
-- 예전 구문
SELECT s.name, d.dname
FROM t_student s, t_department d
WHERE s.deptno1 = d.deptno;

-- ANSI 표준 구문
SELECT s.name, d.dname
FROM t_student s JOIN t_department d ON s.deptno1 = d.deptno;
```

ANSI 구문을 쓰면 JOIN 조건과 검색 조건이 섞이지 않고, `ON`을 빼먹으면 바로 문법 오류가 나서 티가 난다. 예전 구문은 `WHERE`를 빼먹어도 에러 없이 240줄이 나온다.

표가 N개면 JOIN 조건은 보통 N-1개가 필요하다.

## NULL은 JOIN에 참여하지 않는다
```sql
-- 제2전공
SELECT s.name, s.deptno2, d.dname
FROM t_student s JOIN t_department d ON s.deptno2 = d.deptno;
```

제2전공이 없는 학생은 `deptno2`가 NULL이라서 결과에서 통째로 사라진다. 지난주에 배운 "NULL은 비교가 안 된다"가 여기서 실제로 데이터가 빠지는 문제로 나타났다.

## 비등가 조인
JOIN 조건이 꼭 `=`일 필요는 없다.

```sql
-- 마일리지 포인트로 받을 수 있는 상품
SELECT c.c_name "고객명", c.c_point "POINT", g.g_name "상품명"
FROM t_customer c JOIN t_gift g ON c.c_point BETWEEN g.g_start AND g.g_end;
```

`t_gift`는 "포인트 몇 점부터 몇 점까지는 이 상품"이라는 구간표다. 성적을 학점으로 바꾸는 것도 같은 구조다. 등가 조인은 번호가 같은 것끼리, 비등가 조인은 범위에 들어가는 것끼리 잇는 것이라고 정리했다.

## OUTER JOIN과 셀프 조인
지금까지의 JOIN은 양쪽에 다 있어야 결과에 나오는 INNER JOIN이다.

```sql
-- 왼쪽(t_student)은 다 남긴다. 짝이 없으면 오른쪽이 NULL
SELECT s.name, p.name
FROM t_student s LEFT OUTER JOIN t_professor p ON s.profno = p.profno;
```

`LEFT OUTER JOIN`은 왼쪽 표는 한 명도 빠뜨리지 말라는 뜻이다. MySQL에는 `FULL OUTER JOIN`이 없어서 LEFT와 RIGHT를 `UNION`으로 붙인다.

같은 표를 별칭만 다르게 두 번 쓰면 한 표 안의 관계를 풀어낼 수 있다.

```sql
-- 부서명과 상위부서명
SELECT d1.dname "부서명", d2.dname "상위부서명"
FROM t_dept2 d1 JOIN t_dept2 d2 ON d1.pdept = d2.dcode;
```

연습문제의 마지막 문제가 이걸 전부 합친 것이었다.

```sql
-- 교수별로 자신보다 먼저 입사한 사람 수
SELECT p1.profno "교수번호", p1.name "교수명", p1.hiredate "입사일",
    count(p2.name) "빠른사람"
FROM t_professor p1
    LEFT OUTER JOIN t_professor p2 ON p1.hiredate > p2.hiredate
GROUP BY 교수번호, 교수명, 입사일
ORDER BY p1.hiredate ASC;
```

셀프 조인으로 나(p1)와 남(p2)을 비교하고, `>`로 먼저 입사한 사람만 붙인다. 가장 먼저 입사한 교수는 붙을 p2가 없으니 INNER였다면 사라지는데, LEFT라서 남는다.

그리고 여기서 `COUNT(*)`가 아니라 `COUNT(p2.name)`을 써야 한다. `COUNT(*)`는 NULL로 채워진 줄도 1로 세서, 0이어야 할 사람이 1이 된다. 그룹 함수에서 배운 내용이 바로 쓰였다.

## OpenAI API
마지막 시간에는 파이썬으로 GPT를 호출했다. API 키는 비밀번호와 같아서 지난주에 배운 `.env`에 넣었다.

```
# .env
OPENAI_API_KEY="sk-proj-****"
```

```python
from openai import OpenAI
from dotenv import load_dotenv
load_dotenv()

client = OpenAI()   # 인자 없이 만들면 OPENAI_API_KEY 환경변수를 알아서 찾는다

response = client.chat.completions.create(
    model="gpt-4o",
    temperature=0.1,
    messages=[
        {'role': 'system', 'content': 'You are a helpful assistant.'},
        {'role': 'user',   'content': '2022년 월드컵 우승팀은 어디야?'},
    ],
)
print(response.choices[0].message.content)
```

| role | 누구의 말 |
|---|---|
| `system` | 개발자가 미리 깔아두는 지시 ("너는 누구고 어떻게 답해라") |
| `user` | 사용자의 질문 |
| `assistant` | GPT의 답변 (또는 우리가 넣어주는 예시 답변) |

`temperature`는 답변의 무작위성이다. 0에 가까울수록 일관되고, 1에 가까울수록 창의적이다.

같은 질문에 `system`만 "너는 배트맨에 나오는 조커야"로 바꿔도 답변의 성격이 완전히 달라졌다. 모델을 바꾸지 않고 프롬프트만으로 행동을 바꾸는 것을 **프롬프트 엔지니어링**이라고 한다.

## 원샷, 퓨샷 프롬프팅
"오리"라고만 물으면 GPT는 오리에 대해 설명한다. 우리가 원한 건 "꽥꽥"이었다. 그럴 때는 설명 대신 예시를 준다.

```python
messages = [
    {"role": "system",    "content": "너는 유치원 학생이야, 유치원생처럼 답변해줘."},
    {"role": "user",      "content": "참새"},
    {"role": "assistant", "content": "짹짹"},     # 우리가 넣어주는 모범답안
    {"role": "user",      "content": "말"},
    {"role": "assistant", "content": "히이잉"},
    {"role": "user",      "content": "오리"},     # 진짜 질문
]
```

`assistant` 자리에 들어간 건 GPT가 실제로 한 말이 아니라 우리가 지어낸 모범답안이다. 예시가 하나면 원샷, 여러 개면 퓨샷, 없으면 제로샷 프롬프팅이라고 한다.

## GPT는 대화를 기억하지 않는다
오늘 가장 중요하다고 느낀 부분이다. 질문만 보내는 코드로 대화를 해보면 이렇게 된다.

```
사용자: 두바이는 더운 도시야?
GPT: 두바이는 연중 기온이 높아 매우 더운 도시입니다.
사용자: 그럼 미네소타는?
GPT: (무슨 이야기인지 모른다)
```

API는 `messages`에 들어 있는 내용만으로 응답을 만들고, 서버가 지난 대화를 보관해주지 않는다. 그래서 대화 기록을 직접 쌓아서 매번 같이 보내야 한다.

```python
messages = [{"role": "system", "content": "너는 사용자를 도와주는 상담사야."}]

while True:
    user_input = input("사용자:")
    if user_input == "exit": break

    messages.append({'role': 'user', 'content': user_input})       # 내 말 기록
    response = client.chat.completions.create(
        model="gpt-4o", temperature=0.9, messages=messages)
    ai_response = response.choices[0].message.content
    messages.append({'role': 'assistant', 'content': ai_response})  # AI 답도 기록
    print('AI:' + ai_response)
```

ChatGPT 화면이 대화를 기억하는 것처럼 보이는 것도 뒤에서 이 일을 대신 해주기 때문이라고 한다. 다만 대화가 길어질수록 매번 보내는 양이 늘어나고, 요금은 보낸 토큰 수에 비례한다. 그래서 실무에서는 오래된 대화를 자르거나 요약해서 넣는데, 나중에 배울 LangChain의 Memory가 그 일을 한다고 한다.

## 스트리밍
```python
stream = client.chat.completions.create(
    model="gpt-4o", messages=messages,
    stream=True,      # 스트리밍 활성화
)

for chunk in stream:
    content = chunk.choices[0].delta.content
    if content is not None:
        print(content, end="", flush=True)
```

`stream=True`를 주면 답이 완성되기를 기다리지 않고 토큰이 생기는 대로 받는다. 첫 chunk와 마지막 chunk에는 내용이 없을 수 있어서 `None` 검사가 필요하고, `flush=True`를 빼면 받아놓고도 한꺼번에 툭 튀어나온다.

전체 응답 시간이 줄어드는 건 아니고, **첫 글자가 보이기까지의 시간**이 짧아져서 사용자가 빠르다고 느끼는 것이다.

## 오늘 배운 내용 정리
오늘은 SQL 함수, JOIN, 그리고 OpenAI API를 배웠다.

```
단일행 함수: 행 수가 그대로. SUBSTR 은 1부터. IFNULL 로 NULL 처리. 분은 %i.
그룹 함수: 행을 접는다. NULL 은 집계에서 빠진다 → AVG(bonus) ≠ AVG(IFNULL(bonus, 0)).
GROUP BY: SELECT 의 일반 컬럼은 GROUP BY 에도 있어야 한다.
WHERE vs HAVING: 접기 전 / 접은 뒤.
절 순서: SELECT → FROM → WHERE → GROUP BY → HAVING → ORDER BY.
JOIN: 모든 조합에서 조건으로 거른다. ANSI 구문(JOIN ... ON)을 쓴다.
NULL: JOIN 조건에 참여하지 않는다. 남기려면 LEFT OUTER JOIN.
비등가 조인: 구간표는 BETWEEN 으로 잇는다.
OpenAI API: messages(system / user / assistant). 키는 .env 에.
대화 기억: 서버는 기억하지 않는다. messages 에 직접 쌓아서 보낸다.
```

SQL은 `COUNT(*)`와 `COUNT(컬럼)`의 차이처럼 작은 차이가 결과를 바꾸는 경우가 많아서, 결과 행 수를 항상 확인하는 습관이 필요할 것 같다.

그리고 GPT가 대화를 기억하지 않는다는 건 꽤 의외였다. ChatGPT를 쓰면서 당연하게 여겼던 기능이 사실은 대화 기록을 매번 다시 보내는 방식이었다는 걸 알게 됐다.

---
