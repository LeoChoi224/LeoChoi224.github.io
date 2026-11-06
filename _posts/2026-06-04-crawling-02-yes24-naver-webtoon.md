---
layout: single
title: "크롤링 기초 정리 2 - yes24, 네이버 연관 검색어, 네이버 웹툰 실전"
categories: [coding, Crawling]
tag: [study-log, Crawling, requests, BeautifulSoup, JSONP, Referer, lazy-loading]
toc: true
author_profile: false
sidebar:
    nav: "docs"
search: true
---
<hr/>

지난 시간에는 로컬 HTML 파일로 BeautifulSoup을 연습했고, 오늘은 드디어 실제 사이트에서 데이터를 가져왔다. yes24 도서 검색, 네이버 연관 검색어, 네이버 웹툰 세 곳을 긁어봤는데, 사이트마다 막히는 지점이 달라서 그걸 하나씩 푸는 수업이었다.

```
yes24        → 정적 페이지. 지연 로딩 이미지와 페이징을 처리한다.
연관 검색어   → HTML 에 없다. 브라우저가 따로 부르는 주소를 찾는다.
네이버 웹툰   → 이미지가 403 으로 거부된다. 그리고 결국 실패했다.
```

## requests는 브라우저가 아니다
`requests`는 주소로 요청을 보내고 돌아온 텍스트를 받을 뿐이다. JavaScript를 실행하지 않고, 이미지도 안 받고, 스크롤도 안 한다. 그래서 `response.text`는 브라우저의 **소스 보기**와 같은 내용이다.

```python
import requests

response = requests.get(url)
response.status_code     # 200
response.text            # HTML 문자열
```

| 상태 코드 | 뜻 |
|---|---|
| 200 | 정상 |
| 403 | 거부됨 (헤더가 부족하거나 차단) |
| 404 | 그런 주소 없음 |
| 5xx | 서버 쪽 문제 |

`requests`는 404가 나도 예외를 던지지 않고 조용히 진행한다. 그래서 상태 코드를 직접 확인하는 습관이 중요하다고 했다.

## yes24 - URL부터 관찰한다
크롤링의 진짜 첫 단계는 코드가 아니라 URL을 보는 것이었다. 브라우저에서 검색해보고 주소창을 보면 어떤 값이 무엇인지 알 수 있다.

```
https://www.yes24.com/product/search?domain=BOOK&query=파이썬&page=1&size=24
                                     └── 분야 ──┘ └ 검색어 ┘ └ 쪽 ┘ └개수┘
```

`?` 뒤가 쿼리스트링이고, f-string으로 검색어와 쪽 번호만 바꿔 끼우면 된다.

```python
from bs4 import BeautifulSoup

url = f"https://www.yes24.com/product/search?domain=BOOK&query={keyword}&page=1&size=24"
soup = BeautifulSoup(requests.get(url).text, "html.parser")

book_list = soup.select("#yesSchList > li")
len(book_list)       # 24
```

`size=24`로 요청했으니 24가 나와야 선택자가 맞은 것이다. 지난 시간에 배운 "`len()`부터 찍기"가 여기서 바로 쓰였다.

### 이미지 주소가 src에 없다
이미지를 꺼내보니 `src`에는 "이미지 없음" 그림 주소가 들어 있었다.

```html
<img class="lazy"
     data-original="https://image.yes24.com/goods/119293186/L"
     src="https://image.yes24.com/momo/Noimg_L.jpg"/>
```

진짜 주소는 `data-original`에 있다. 화면에 안 보이는 이미지까지 처음부터 다 받으면 페이지가 느려지니까, 진짜 주소는 숨겨두고 스크롤이 그 위치에 닿으면 JavaScript가 `src`로 옮겨주는 방식이다. 이걸 **지연 로딩(lazy loading)**이라고 하고, `class="lazy"`가 그 신호다.

사이트마다 `data-src`, `data-lazy-src`처럼 이름이 다르니 이미지가 안 나오면 `print(element)`로 태그를 통째로 찍어보는 게 가장 빠르다고 했다.

### 긴 선택자 줄이기
개발자 도구에서 "Copy selector"로 복사하면 `div.item_img > div.img_canvas > span > span > a > em > img`처럼 길게 나오는데, `div.item_img img`로 줄여도 결과가 같았다. `>`는 바로 아래 자식이고 공백은 몇 단계 아래든 상관없는 자손이다. 긴 선택자는 중간에 `<span>` 하나만 추가돼도 깨지니까, 고유한 class를 하나 잡고 그 안에서 태그로 좁히는 게 요령이다.

### 필요한 값 뽑기
```python
import re

img_src    = item.select_one("div.item_img img").attrs["data-original"].strip()
book_title = item.select_one("div.item_info a.gd_name").text.strip()
book_url   = "https://www.yes24.com" + item.select_one("div.item_info a.gd_name").attrs["href"].strip()
price      = int(re.sub("[^0-9]", "", item.select_one("div.info_price strong em").text.strip()))
```

`href`가 `/product/goods/119293186`처럼 `/`로 시작했다. 도메인이 빠진 **상대 경로**라서 브라우저는 알아서 현재 도메인을 붙이지만, 우리는 직접 붙여줘야 한다.

### 한 페이지 함수 + 바깥 반복문
크롤링 코드는 두 층으로 짠다. 함수는 딱 한 페이지만 책임지고, 반복은 바깥에서 한다.

```python
def crawl_yes24(query, page=1):
    url = f"https://www.yes24.com/product/search?domain=BOOK&query={query}&page={page}&size=24"
    response = requests.get(url)
    if response.status_code != 200:
        return

    dom = BeautifulSoup(response.text, "html.parser")
    result = []
    for item in dom.select("#yesSchList > li"):
        # ... 위에서 뽑은 값들
        result.append({"thumbnail_url": img_src, "book_title": book_title,
                       "book_url": book_url, "price": price})
    return result


result = []
for page in range(1, 4):
    page_result = crawl_yes24("파이썬", page)
    if not page_result:      # None 이거나 빈 리스트면 마지막 페이지
        break
    result += page_result
```

`if not page_result: break`가 페이징의 핵심이었다. 전체 쪽수를 미리 알 필요 없이 빈 결과가 나오면 멈춘다. `not`이 `None`과 `[]`를 둘 다 잡아줘서 한 줄로 끝난다.

결과는 `pd.DataFrame(result).to_csv(...)`로 저장했다. 경로는 운영체제마다 구분자가 달라서 `os.path.join()`으로 만들고, CSV를 엑셀로 열었을 때 한글이 깨지면 `encoding="utf-8-sig"`로 저장하면 된다고 했다.

실제 서비스라면 반복문 안에 `time.sleep(0.5)` 정도를 넣어서 요청 간격을 둬야 한다. 사람이 낼 수 없는 속도로 계속 요청하면 서버에 부담을 주고 IP가 차단될 수도 있다.

## 네이버 연관 검색어 - HTML에 없는 데이터
네이버 검색창에 글자를 치면 뜨는 연관 검색어 목록은 페이지 HTML을 아무리 뒤져도 안 나온다. 글자를 칠 때마다 브라우저가 **뒤에서 따로 요청을 보내서** 목록을 받아오기 때문이다. Web 시간에 배운 AJAX가 바로 이것이다.

그래서 HTML을 파싱하는 대신, 브라우저가 부르는 그 주소를 우리가 직접 부르면 된다. 찾는 방법은 이렇다.

```
개발자 도구 → Network 탭 → Fetch/XHR 필터 → 검색창에 글자 입력
→ 새로 뜨는 요청 클릭 → Headers 에서 Request URL 복사
```

| | HTML 파싱 | 데이터 주소 직접 호출 |
|---|---|---|
| 데이터 형태 | 태그에 묻혀 있다 | 이미 정리된 JSON |
| 디자인이 바뀌면 | 선택자가 깨진다 | 영향이 없다 |
| 속도 | HTML 전체를 받는다 | 필요한 데이터만 받는다 |

### JSONP - 순수 JSON이 아니다
찾은 주소로 요청하니 응답이 이렇게 왔다.

```
_jsonp_4({
"query" : ["저"],
"items" : [[["전주 날씨","1"],["lg전자","0"], ...]]
})
```

JSON이 함수 호출 모양으로 감싸져 있다. 이걸 **JSONP**라고 한다. 브라우저에는 다른 도메인의 데이터를 함부로 읽지 못하게 하는 동일 출처 정책이 있는데, `<script>`로 스크립트를 불러오는 건 예전부터 허용돼서 응답을 아예 실행 가능한 자바스크립트로 만들어 우회한 옛날 방법이라고 한다. 지금은 CORS라는 정식 방법이 있지만 오래된 API에는 아직 남아 있다.

그래서 `json.loads()`에 바로 넣으면 에러가 나고, 괄호 안쪽만 정규식으로 꺼내야 한다.

```python
import json, re

response_text = response.text.replace("\n", "")     # 줄바꿈 제거
match = re.search(r"\((.*)\)", response_text)        # 괄호 안쪽만
if match:
    data = json.loads(match.group(1))

data["items"]
# [[['전주 날씨', '1'], ['lg전자', '0'], ['삼성전자 주가', '1'], ...]]

keywords = [item[0] for item in data["items"][0]]
```

- `\(`와 `\)`는 괄호 문자 그대로고, 가운데 `(.*)`가 "여기를 꺼내라"는 그룹이다. `.group(1)`로 그 부분을 꺼낸다.
- 정규식의 `.`은 줄바꿈을 제외한 모든 문자라서, 줄바꿈이 남아 있으면 JSON이 첫 줄에서 잘린다. 그래서 먼저 줄바꿈을 지웠다. `re.DOTALL` 플래그를 줘도 된다.
- `json.loads()`로 파싱하면 그냥 파이썬 딕셔너리라서 BeautifulSoup이 필요 없다.
- `items`가 이중 리스트라 `[0]`으로 한 겹 더 들어가야 항목이 나온다.

응답이 순수 JSON이면 `response.json()` 한 줄로 끝난다. 데이터 주소를 찾으면 먼저 `.json()`을 시도해보는 게 맞다고 했다.

## 네이버 웹툰 - 403과 실패
웹툰 한 회차는 이미지가 100장 넘게 잘려 있어서 손으로 저장할 수가 없다. 이미지 주소를 모으는 데까지는 평범했다.

```python
url = "https://comic.naver.com/webtoon/detail?titleId=800770&no=193"
soup = BeautifulSoup(requests.get(url).text, "html.parser")     # 200

img_elements = soup.select("#comic_view_area > #sectionContWide > img")
len(img_elements)        # 105
img_urls = [el.attrs["src"] for el in img_elements]
```

`titleId`는 작품, `no`는 회차다. 여기는 yes24와 달리 이미지 주소가 `src`에 그대로 있었다.

### 페이지는 200인데 이미지는 403
그런데 이미지를 받으려고 하니 거부당했다.

```python
requests.get(img_urls[0])        # <Response [403]>
```

같은 사이트인데 페이지는 되고 이미지는 안 되는 이유는 이미지 서버가 **핫링크를 막고** 있기 때문이었다. 다른 사이트가 네이버 이미지를 자기 페이지에 직접 갖다 붙이면 트래픽 비용을 네이버가 내게 되니까, 이미지 서버는 "이 요청이 네이버 웹툰 페이지에서 온 것인가"를 확인한다. 그 확인에 쓰이는 게 `Referer` 헤더다.

HTTP 요청에는 주소 말고도 헤더라는 부가 정보가 같이 간다. `requests`는 기본으로 `User-Agent: python-requests/2.x`를 보내서, 사이트 입장에서는 "봇이 왔다"고 대놓고 말하는 셈이다.

```python
headers = {
    "Referer": url,        # 이 웹툰 페이지를 보다가 왔다고 알린다
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
}
response = requests.get(img_url, headers=headers)     # <Response [200]>
```

`Referer`가 핵심이고 `User-Agent`는 보험이다. 이미지나 동영상이 403이면 거의 항상 `Referer`를 먼저 의심하라고 했다. 참고로 `Referer`는 원래 `Referrer`의 오타인데 초기 HTTP 표준에 그대로 실려서 지금까지 오타 철자가 표준이다. r을 두 번 쓰면 동작하지 않는다.

### 이미지 저장은 wb와 content
```python
import os
import urllib.parse as urlparser
from os.path import basename

os.makedirs("out/webtoon", exist_ok=True)

filename = basename(urlparser.urlparse(img_url).path)      # 주소에서 파일 이름만
with open(os.path.join("out/webtoon", filename), "wb") as f:
    f.write(response.content)
```

| | 텍스트 | 이미지, PDF, 영상 |
|---|---|---|
| 파일 모드 | `'w'` | `'wb'` (바이너리 쓰기) |
| 응답에서 꺼낼 것 | `response.text` | `response.content` |

`.text`는 바이트를 글자로 해석한 것이라 이미지에 쓰면 파일이 깨진다. `.content`는 받은 바이트 그대로다.

파일 이름을 `split("/")[-1]`로 자르지 않고 `urlparse()`를 쓴 이유는, 주소 뒤에 `?v=123` 같은 쿼리스트링이 붙으면 파일 이름에 못 쓰는 글자가 들어가기 때문이다. `urlparse()`는 주소를 조각내서 경로 부분만 꺼내준다. 웹툰은 순서가 곧 내용이라 `"4".zfill(4)`처럼 앞을 0으로 채워서 `0004.jpg`로 이름을 맞추면 순서대로 정렬된다는 것도 배웠다.

### 그리고 다른 작품에서 실패했다
같은 함수를 다른 작품으로 돌리자 이렇게 됐다.

```
AttributeError: 'NoneType' object has no attribute 'text'
```

제목 선택자를 못 찾아서 `select_one()`이 `None`을 준 것이다. 선택자를 고치고 방어 코드를 넣어 다시 돌려도 결과는 이랬다.

```
화수: 36 | 제목: Episode_36 | 이미지 개수: 0개
모든 이미지 다운로드 완료
```

페이지는 200으로 잘 받았는데 이미지가 0개였다. 헤더 문제가 아니라 **애초에 HTML 안에 이미지 태그가 없는 것**이다. 네이버 웹툰의 새 뷰어는 서버가 빈 껍데기 HTML만 주고 내용은 브라우저에서 JavaScript가 그리는 방식이라고 한다. 지난 시간에 정리한 동적 사이트가 바로 이것이었다.

이럴 때 선택지는 두 가지다.

```
1. Network 탭에서 이미지 목록을 주는 데이터 주소를 찾는다. (연관 검색어에서 한 방법)
2. Selenium 으로 브라우저를 띄워서 다 그려진 화면을 긁는다. (다음 시간 주제)
```

그리고 위 로그에서 이미지가 0개인데도 "모든 이미지 다운로드 완료"가 찍힌 게 문제라고 했다. 성공한 것처럼 보이는 실패가 제일 나쁘다. 결과가 비어 있으면 예외를 던지거나 최소한 경고를 남기는 코드가 필요하다.

```python
if not img_urls:
    raise RuntimeError("이미지를 못 찾음 — 동적 렌더링일 가능성. Selenium 필요")
```

## 헷갈리기 쉬운 부분
- 개발자 도구의 Elements 탭은 JavaScript가 다 돌아간 뒤의 모습이다. 거기 보인다고 `requests`로 받아지는 게 아니다.
- 이미지가 자리표시자로 나오면 `src`가 아니라 `data-original` 같은 `data-*` 속성을 본다.
- `re.search()`도 `select_one()`처럼 못 찾으면 `None`이다. 바로 `.group()`을 부르면 에러가 난다.
- `json.loads()`에 JSONP 응답을 통째로 넣으면 `_jsonp_4(` 때문에 `JSONDecodeError`가 난다.
- 이미지를 `'w'` 모드로 저장하면 파일이 깨진다. `'wb'`와 `.content`를 쓴다.
- `os.makedirs()`에 `exist_ok=True`를 주면 폴더가 이미 있어도 에러가 나지 않는다.
- 학습용으로 몇 개 받아보는 것과 저작물을 대량으로 내려받아 배포하는 건 다른 문제다. 받은 이미지는 재배포하지 않고 요청 사이에 간격을 두는 게 최소한의 선이라고 했다.

## 오늘 배운 내용 정리
오늘은 실제 사이트 세 곳에서 데이터를 가져오면서 막히는 지점을 하나씩 풀었다.

```
URL 관찰: 쿼리스트링의 query, page 를 f-string 으로 바꿔 끼운다.
상태 코드: requests 는 404 에도 예외를 안 던진다. status_code 를 직접 확인한다.
지연 로딩: 이미지 주소가 src 대신 data-original 에 숨어 있다. 막히면 print(element).
페이징: 한 페이지 함수 + 바깥 반복문. 빈 결과면 break.
HTML 에 없는 데이터: Network 탭(Fetch/XHR)에서 데이터 주소를 찾아 직접 부른다.
JSONP: re.search(r"\((.*)\)", text) 로 괄호 안만 꺼내고 json.loads().
403: 이미지면 Referer 헤더부터. User-Agent 는 보험.
이미지 저장: open(path, "wb") + response.content.
200 인데 결과 0개: JavaScript 가 그리는 동적 페이지. 데이터 주소를 찾거나 Selenium.
```

같은 크롤링이라도 사이트마다 막히는 이유가 전부 달랐다. 정적 페이지인지, 데이터가 따로 오는지, 헤더를 확인하는지를 먼저 판단하는 게 코드보다 중요하다는 걸 알게 된 수업이었다.

마지막 웹툰에서 실패로 끝났는데, 그 실패가 다음 시간 Selenium의 출발점이라고 한다.

---
