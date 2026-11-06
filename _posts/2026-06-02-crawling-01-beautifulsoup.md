---
layout: single
title: "크롤링 기초 정리 1 - BeautifulSoup으로 HTML에서 값 꺼내기"
categories: [coding, Crawling]
tag: [study-log, Crawling, BeautifulSoup, Python, CSS-selector, pandas]
toc: true
author_profile: false
sidebar:
    nav: "docs"
search: true
---
<hr/>

오늘부터 크롤링을 배웠다. 첫날은 네트워크 없이 로컬 HTML 파일(`simple.html`) 하나를 가지고 **BeautifulSoup**으로 원하는 값만 골라내는 연습을 했다.

수업 첫 셀에서 강사님이 짚은 게 있는데, 우리가 하는 건 엄밀히 말하면 크롤링이 아니라 **파싱(parsing)**이라고 한다. 크롤링은 원래 검색엔진처럼 링크를 따라다니며 사이트 전체를 긁는 것이고, 우리는 특정 페이지의 특정 위치만 가져오는 것이다. 다만 헷갈리지 않게 수업에서는 그냥 크롤링이라고 부르기로 했다.

## 정적 사이트와 동적 사이트
이 단원 전체의 뼈대가 되는 구분이다.

| | 정적 사이트 | 동적 사이트 |
|---|---|---|
| 내용이 오는 시점 | 처음 받은 HTML 에 이미 들어 있다 | 나중에 JavaScript 가 채운다 |
| 확인 방법 | 브라우저 **소스 보기**에 그 글자가 보인다 | 소스 보기엔 없고 개발자 도구에만 보인다 |
| 도구 | `requests` + BeautifulSoup | 데이터가 오는 주소를 찾거나 Selenium |

개발자 도구의 Elements 탭은 JavaScript가 다 돌아간 **뒤의** 모습이라, 거기 보인다고 해서 `requests`로 받아지는 게 아니다. 그래서 소스 보기(`Cmd + Option + U`)에서 찾으려는 글자를 검색해보는 게 가장 확실한 판별법이라고 했다.

수업은 정적 사이트 → 동적 사이트 → 브라우저 제어(Selenium) 순서로 진행되고, 오늘은 그 준비운동이었다.

## HTML 문자열을 트리로 바꾸기
HTML은 그냥 긴 문자열이다. 여기서 가격만 뽑겠다고 문자열을 자르면 태그가 조금만 바뀌어도 다 깨진다. BeautifulSoup은 이 문자열을 태그의 부모-자식 트리(DOM)로 바꿔준다.

```python
from bs4 import BeautifulSoup

with open("./data/simple.html", "r", encoding="utf-8") as f:
    html = f.read()

soup = BeautifulSoup(html, "html.parser")
```

두 번째 인자는 파서다. `"html.parser"`는 파이썬에 내장돼 있어서 설치가 필요 없고, `"lxml"`은 따로 설치해야 하지만 더 빠르다고 한다.

파일에서 읽든 인터넷에서 받아오든 BeautifulSoup 입장에서는 똑같이 HTML 문자열이다. 오늘 파일로 연습한 코드를 나중에 `response.text`로 바꾸기만 하면 실제 사이트에서도 그대로 동작한다.

## select와 select_one
CSS에서 스타일을 입힐 때 쓰던 선택자를 값을 꺼낼 때 그대로 쓴다. 이 두 개만 알면 된다.

```python
soup.select_one("h1")      # <h1>header</h1>   ← 첫 번째 하나
soup.select_one("li")      # 여러 개여도 첫 번째만
soup.select_one("xxx")     # None              ← 없으면 None

soup.select(".fruit")      # [<li class="fruit">apple  </li>, <li class="fruit">ba<b>nana</b></li>]
soup.select(".xxx")        # []                ← 없으면 빈 리스트
```

| | 결과 | 못 찾으면 |
|---|---|---|
| `select_one()` | 태그 하나 | `None` |
| `select()` | 리스트 | `[]` |

이 차이가 실전에서 가장 중요하다고 했다. `select_one()`이 `None`을 준 걸 모르고 `.text`를 부르면 `'NoneType' object has no attribute 'text'` 에러가 난다. 크롤링에서 가장 자주 보는 에러라고 한다.

선택자 문법은 Web 시간에 배운 CSS 그대로다.

```
"h1"                   태그
".fruit"               class
"#cat"                 id
"ul .animal"           ul 안의 .animal (자손)
"#books > tbody > tr"  바로 아래 자식
"td:nth-child(2)"      두 번째 칸
```

## 값은 .text 아니면 .attrs에 있다
태그 **사이**에 있는 글자냐, 태그 **안**에 적힌 속성이냐의 차이다.

```html
<a href="https://www.naver.com" title="최고포탈">네이버</a>
```

```python
el = soup.select_one("ol li a")
el.text                  # '네이버'
el.attrs                 # {'href': 'https://www.naver.com', 'title': '최고포탈'}
el.attrs['href']         # 없으면 KeyError
el.attrs.get('href')     # 없으면 None
```

링크 주소나 이미지 주소는 거의 항상 `.attrs` 쪽에 있다.

`.text`에는 `.strip()`을 거의 항상 붙인다. HTML의 줄바꿈과 들여쓰기가 그대로 딸려오기 때문이다.

```python
soup.select(".fruit")[0].text            # 'apple  '  ← 뒤에 공백
soup.select(".fruit")[0].text.strip()    # 'apple'
```

그리고 `.text`는 자식 태그를 뚫고 글자만 모은다. `ba<b>nana</b>`는 `'banana'`가 되고, `<ul>`처럼 자식이 여러 개인 태그에 `.text`를 쓰면 전부 한 덩어리로 붙어버린다. 목록은 `select()`로 하나씩 꺼낸 뒤 각각 `.text`를 불러야 한다.

## 크롤링의 기본 문형
리스트 컴프리헨션으로 꺼내는 게 기본 모양이다.

```python
[el.text.strip() for el in soup.select(".fruit")]       # ['apple', 'banana']

[
    {
        "url":  item.attrs.get("href").strip(),
        "link": item.text.strip(),
    }
    for item in soup.select("ol li a")
]
# [{'url': 'https://www.naver.com', 'link': '네이버'}, {'url': 'https://www.daum.net', 'link': 'daum'}]
```

꺼낸 태그에서 다시 `select()`를 부를 수 있다는 게 표를 다룰 때 결정적이었다. **바깥에서 행을 고르고, 각 행 안에서 칸을 고르는** 두 겹 구조가 표 크롤링의 정석이다.

```python
[
    {
        "제목": row.select_one("td:first-child").text.strip(),
        "가격": row.select_one("td:nth-child(2)").text.strip(),
    }
    for row in soup.select("#books > tbody > tr")
]
```

선택자를 고칠 때는 `len(soup.select(...))`부터 찍어보라고 했다. 24개가 나와야 하는데 0이면 선택자가 틀린 것이고, 25개면 헤더 행이 섞인 것이다. `len()` → 첫 항목 출력 → 전체 반복 순서로 확인하면 헤매지 않는다.

HTML 소스에 `<tbody>`를 안 썼어도 브라우저와 파서가 자동으로 넣어준다는 것도 처음 알았다. 개발자 도구에서 복사한 선택자에 `tbody`가 들어 있는 이유가 이것이다.

## decompose로 방해되는 태그 지우기
`<td><b>[도서]</b> 19,200원</td>`에서 가격만 필요한데 `.text`를 쓰면 `[도서] 19,200원`이 나온다. 이럴 때는 방해되는 태그를 트리에서 통째로 지운다.

```python
price_el = row.select_one("td:nth-child(2)")
price_el.select_one("b").decompose()      # <b> 를 트리에서 제거
print(price_el)                           # <td> 19,200원</td>
```

`decompose()`는 soup 트리 자체를 바꾸고 되돌릴 수 없다. 같은 셀을 두 번 실행하면 이미 지워진 `<b>`를 또 지우려다 에러가 난다. 그래서 수업 코드는 매번 `BeautifulSoup(html, "html.parser")`로 다시 파싱하고 시작했다.

## 숫자로 바꾸기
```python
import re
price = int(re.sub(r"\D", "", price_el.text.strip()))    # ' 19,200원' → 19200
```

`\D`는 숫자가 아닌 모든 문자다. 전부 빈 문자열로 바꾸면 숫자만 남는다. Python 시간에 배운 정규식이 여기서 쓰였다.

숫자로 바꾸는 이유는 문자열끼리 비교하면 사전순이 되기 때문이다. `'19,200'`과 `'6,500'`을 비교하면 `'1'`이 `'6'`보다 앞이라 `'19,200'`이 더 작다고 나온다. 정렬이나 합계를 하려면 반드시 정수로 바꿔야 한다.

## DataFrame으로 저장
크롤링 결과를 딕셔너리 리스트로 모으는 이유가 마지막에 드러났다. pandas의 `DataFrame()`에 그대로 넣으면 키가 컬럼 이름이 되어 표가 완성된다.

```python
import re
import pandas as pd
from bs4 import BeautifulSoup

soup = BeautifulSoup(html, "html.parser")

result = []
for row in soup.select("#books tbody tr"):        # ① 행을 고른다
    if not row.select_one("td"):                  # ② 헤더 행(th 만 있는 행) 건너뛰기
        continue

    price_el = row.select_one("td:nth-child(2)")  # ③ 칸을 고른다
    price_el.select_one("b").decompose()          # ④ 방해 태그 제거

    result.append({
        "제목": row.select_one("td:first-child").text.strip(),
        "가격": int(re.sub(r"\D", "", price_el.text.strip())),   # ⑤ 숫자로
    })

df = pd.DataFrame(result)
df.to_excel("./data/out.xlsx")
```

## 헷갈리기 쉬운 부분
- `select()`는 못 찾으면 `None`이 아니라 `[]`다. 그래서 `if items is None:`은 절대 참이 되지 않고, `if not items:`로 확인해야 한다.
- `.strip()`을 빼먹으면 `'apple  '`처럼 공백이 붙어서 비교가 실패한다.
- `<ul>`에 `.text`를 쓰면 자식 글자가 전부 붙어서 나온다.
- `decompose()`는 트리를 실제로 바꾸기 때문에 셀을 다시 돌릴 거면 파싱부터 다시 한다.
- `find()`, `find_all()`도 있지만 개발자 도구에서 복사한 CSS 선택자를 바로 쓸 수 있는 `select()`가 배우기 쉬워서 수업은 `select()`만 썼다.
- 개발자 도구에서 복사한 선택자는 `#yesSchList > li:nth-child(1) > div.item_img > ...`처럼 길고 깨지기 쉽다. class 하나를 잡고 그 안에서 태그로 좁히는 짧은 선택자가 오래 간다고 한다.

## 오늘 배운 내용 정리
오늘은 BeautifulSoup으로 HTML에서 원하는 값을 꺼내는 방법을 배웠다.

```
정적 / 동적: 소스 보기에 글자가 있으면 정적. 없으면 JavaScript 가 채우는 동적 사이트.
파싱: BeautifulSoup(html, "html.parser") 로 HTML 문자열을 트리로 바꾼다.
select_one(): 하나. 없으면 None → 바로 .text 를 부르면 에러.
select(): 리스트. 없으면 [].
값: 태그 사이 글자는 .text (+ .strip()), 속성은 .attrs.get("href").
표: 바깥에서 행을 고르고, 행 안에서 칸을 고른다. len() 부터 찍어본다.
decompose(): 방해되는 태그를 트리에서 지운다. 되돌릴 수 없다.
숫자: int(re.sub(r"\D", "", text)). 문자열 그대로 두면 사전순 비교가 된다.
저장: 딕셔너리 리스트 → pd.DataFrame() → to_excel().
```

Web 시간에 배운 CSS 선택자와 Python 시간에 배운 리스트 컴프리헨션, 정규식이 한꺼번에 쓰여서 그동안 배운 게 이어지는 느낌이었다.

오늘은 로컬 파일이었지만, 다음 시간에는 `requests`로 실제 사이트의 HTML을 받아와서 같은 방법을 써본다고 한다.

---
