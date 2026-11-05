---
layout: single
title: "Python 기초 정리 7 - 표준 라이브러리, 가위바위보 과제와 문자열 메소드"
categories: [coding, Python]
tag: [study-log, Python, random, math, time, datetime, timedelta, string-method]
toc: true
author_profile: false
sidebar:
    nav: "docs"
search: true
---
<hr/>

오늘은 파이썬을 설치하면 같이 따라오는 **표준 라이브러리**(random, math, time, datetime)를 배웠고, 지금까지 배운 문법을 모아서 **가위바위보 프로그램**을 과제로 만들었다. 오후에는 **문자열 메소드**를 배우고 문자열 연습 문제도 풀었다.

문법 하나에 예제 하나씩 하던 것에서 처음으로 "프로그램다운 프로그램"을 만들어본 날이라 의미가 있었다.

## 표준 라이브러리와 import
라이브러리는 남이 만들어둔 코드 묶음이고, 그중 **표준 라이브러리**는 파이썬을 설치하면 같이 깔리는 것이다. 따로 `pip install`을 할 필요가 없다.

```python
import random          # random 모듈을 가져온다
random.randint(1, 5)   # 모듈이름.함수이름 으로 쓴다

from datetime import timedelta  # 모듈 안에서 하나만 꺼내온다
timedelta(seconds=45632)        # 이러면 모듈 이름을 안 붙여도 된다
```

## random
```python
import random

random.random()        # 0.0 이상 1.0 미만의 실수
random.randint(1, 5)   # 1 이상 5 이하 정수 (5를 포함한다)
random.choice(data)    # 리스트에서 하나 뽑기
random.shuffle(data)   # 리스트를 섞는다 (원본 변경)
```

`randint`는 **끝값을 포함한다.** `range(1, 5)`는 4까지인데 `randint(1, 5)`는 5까지라서, 파이썬에서 드물게 끝을 포함하는 경우다.

`seed()`로 난수 결과를 고정할 수도 있다.

```python
random.seed(43)     # 매번 같은 난수 순서가 나온다
random.seed(None)   # 해제
```

난수가 들어간 프로그램은 돌릴 때마다 결과가 달라서 디버깅이 어려운데, 시드를 고정하면 결과를 재현할 수 있다. 머신러닝에서 특히 많이 쓴다고 한다.

중복 없이 n개를 뽑을 때는 `shuffle`과 슬라이싱을 같이 쓴다.

```python
data = [i + 1 for i in range(45)]  # 로또 번호 1~45
random.shuffle(data)
print(data[:6])
```

## math와 round()
```python
import math

math.pi        # 3.141592...
math.sqrt(4)   # 2.0
math.ceil(1.2)    # 2   올림
math.floor(1.7)   # 1   내림
math.trunc(-1.7)  # -1  0 쪽으로 버림
```

음수에서 `floor`와 `trunc`가 갈린다. `floor(-1.2)`는 -2이고 `trunc(-1.2)`는 -1이다. `floor`는 수직선에서 왼쪽, `trunc`는 0 쪽으로 자르기라고 기억하면 된다.

그리고 오늘 정말 의외였던 부분이 `round()`다.

```python
round(2.5)  # 2  3이 아니다
round(3.5)  # 4
```

파이썬의 `round()`는 딱 0.5일 때 **가장 가까운 짝수로** 반올림한다(오사오입). 항상 위로 올리면 평균이 조금씩 커지는 통계적 편향이 생기기 때문에, 반은 올리고 반은 내리게 만든 것이라고 한다. 코딩 테스트에서 이것 때문에 틀리는 일이 꽤 있다고 하니 기억해둬야겠다.

## time
```python
import time

time.time()       # 1970-01-01 00:00:00(UTC)부터 흐른 초 → 타임스탬프
time.localtime()  # 현재 년/월/일/시/분/초
time.sleep(1)     # 1초 멈춤

time.strftime('%Y-%m-%d %H:%M:%S')       # 2026-04-16 09:23:09
time.strftime('%Y년%m월%d일 %p %I시%M분')  # 오전/오후 12시간제
```

`time.localtime(0)`을 찍으면 0시가 아니라 9시가 나오는데, 한국이 UTC보다 9시간 빠르기 때문이다.

`strftime` 서식에서는 `%m`(월)과 `%M`(분)의 대소문자를 헷갈리기 쉽다.

`time.sleep()`은 그 시간 동안 프로그램이 아무것도 못 하는 **blocking** 동작이다. 이 문제를 푸는 게 나중에 배울 비동기라고 한다.

## datetime과 timedelta
`time`은 기계 쪽 시간(초)을 다루고, `datetime`은 사람 쪽 시간(년월일)을 객체로 다룬다.

```python
import datetime

dt = datetime.datetime(year=2021, month=10, day=20)

# 문자열 → datetime
dt1 = datetime.datetime.strptime('2018-07-23 18:59:09', '%Y-%m-%d %H:%M:%S')

# 타임스탬프 → datetime
dt3 = datetime.datetime.fromtimestamp(1463460958000 / 1000)

dt1 > dt3  # datetime 끼리는 비교가 된다
```

`strftime`은 format(내보내기), `strptime`은 parse(읽어들이기)라고 외우면 헷갈리지 않는다.

`timedelta`는 시간의 **차이**를 다룬다.

```python
start_time = time.time()
# ... 작업 ...
elapsed_time = time.time() - start_time   # 경과 시간(초)

from datetime import timedelta
tb = timedelta(seconds=106401)
tb.days             # 1
tb.seconds          # 20001   하루를 뺀 나머지 초
tb.total_seconds()  # 106401  전체 초
```

`seconds`는 전체 초가 아니라 **하루를 뺀 나머지**라서, 전체 초가 필요하면 반드시 `total_seconds()`를 써야 한다.

## 가위바위보 과제
강사님이 맨 아래 메인 루프를 주시고 "아래 코드는 건드리지 마세요"라고 하셨다. 메인 흐름은 정해져 있고, 각 함수를 채워 넣으면 완성되는 구조였다.

```python
while True:
    show_menu()
    user_choice = input_choice()
    if user_choice == 0:
        break
    computer_choice = computer_select()
    display_choice(user_choice, computer_choice)
    compute_result(user_choice, computer_choice)
```

메인 루프만 읽어도 프로그램이 무엇을 하는지 다 보인다. 이게 **기능 하나를 함수 하나로** 나눈 효과라고 이해했다.

숫자와 이름의 대응은 dict로 잡았다.

```python
data = {1: "가위", 2: "바위", 3: "보"}

def show_menu():
    print("\n" + "=" * 20)
    for i in data:
        print(f"[{i}] : {data[i]}")
    print("[0] : 종료")
    print("=" * 20)
```

이렇게 해두면 `data`에 항목을 추가했을 때 메뉴도 자동으로 늘어난다.

잘못된 입력은 `while`로 다시 물어보게 했다. 몇 번 물어볼지 모르니 `for`가 아니라 `while`이다.

```python
def input_choice():
    num = int(input("선택 : "))
    while num < 0 or num > 3:
        num = int(input("\n0 ~ 3 까지의 정수를 다시 입력해주세요 : "))
    return num

def computer_select():
    return random.randint(1, 3)  # 3 포함
```

승패 판정은 먼저 무승부를 걸러내고, 남은 경우만 `match`로 갈랐다.

```python
def compute_result(user_choice, computer_choice):
    if computer_choice == user_choice:
        print("무승부")
    else:
        match user_choice:
            case 1:  # 가위는 보(3)를 이긴다
                print("유저가 이겼습니다.") if computer_choice == 3 else print("유저가 졌습니다.")
            case 2:  # 바위는 가위(1)를 이긴다
                print("유저가 이겼습니다.") if computer_choice == 1 else print("유저가 졌습니다.")
            case 3:  # 보는 바위(2)를 이긴다
                print("유저가 이겼습니다.") if computer_choice == 2 else print("유저가 졌습니다.")
```

이 판정은 `(user_choice - computer_choice) % 3`의 값(0이면 무승부, 1이면 승, 2면 패)으로 한 줄에 끝낼 수도 있다고 한다. 다만 지금 단계에서는 `match`로 명시적으로 쓴 코드가 더 읽기 쉽다.

그리고 숫자가 아닌 값을 입력하면 `int()`에서 바로 에러가 난다. 이건 나중에 예외 처리(`try ~ except`)를 배우면 막을 수 있다고 한다.

과제 제출 규칙에 이런 문장이 있었다.

> 구글링·AI·토의 좋습니다. 그러나 본인이 설명할 수 있는 코드만 제출하세요.

블로그를 쓰는 이유와도 연결되는 말이라 기억에 남았다.

## 문자열 메소드
메소드는 **특정 객체에 붙어서만 동작하는 함수**다. `len("abc")`는 함수이고, `"abc".upper()`는 문자열에만 있는 메소드다.

그리고 str은 immutable이라서 **문자열 메소드는 원본을 바꾸지 않고 새 문자열을 돌려준다.**

```python
str1 = "Apple"
str1.upper()          # 'APPLE' 이 만들어지지만
print(str1)           # 'Apple' 원본은 그대로

str1 = str1.upper()   # 받아야 바뀐다
```

list의 `sort()`가 원본을 바꾸는 것과 정반대라서 헷갈리기 쉽다.

신기했던 점은 `a.upper()`가 사실 `str.upper(a)`라는 것이다. 메소드는 첫 번째 인자로 자기 자신을 받는 함수였다.

```python
'car'.upper()     # 'CAR'
str.upper('car')  # 'CAR'  같은 일
```

## 자주 쓰는 문자열 메소드
```python
a = "   Hello, World!    "
a.strip()            # 좌우 공백 제거
a.strip().upper()    # 체이닝: 리턴값에 다시 메소드를 부른다

"Car".upper() == "car".upper()  # 대소문자 무시하고 비교

price = "  21,300원  "
int(price.strip().replace(',', '').replace('원', ''))  # 21300
```

웹이나 앱에서 받은 입력은 무조건 `strip()`하는 습관을 들이라고 하셨다. 공백 하나 때문에 로그인이 안 되는 사고가 흔하다고 한다.

```python
"-".join(['야옹이', '먼지', '두부'])   # list → str
"야옹이-먼지-두부".split("-")           # str → list

"  강아지   고양이  ".split()     # ['강아지', '고양이']
"  강아지   고양이  ".split(" ")  # 빈 문자열이 섞여 나온다
```

인자 없는 `split()`이 대부분 정답이다.

```python
a = "hello python"
a.find('lo')    # 3
a.find('x')     # -1  못 찾으면 -1
# a.index('x')  # ValueError

"aaabbbabab".count("a")
url.startswith('http')
url.endswith('.html')

"1".zfill(4)         # '0001'
"1".rjust(5, '*')    # '****1'

ord('a'), chr(97)    # 97, 'a'
```

`find`는 못 찾으면 -1, `index`는 에러다. dict의 `get()`과 `[]`의 관계와 비슷하다.

## 글자 세기를 네 가지 방법으로
`"Alice in wonderland"`에서 알파벳별 등장 횟수를 dict로 만드는 문제를 여러 방법으로 풀어봤다.

```python
word = "Alice in wonderland"

# get() 기본값 활용 (가장 깔끔한 방법)
result = {}
for ch in word.lower():
    if ch.isalpha():
        result[ch] = result.get(ch, 0) + 1

# dict comprehension + count()
{ch: word.lower().count(ch) for ch in word.lower() if ch.isalpha()}
```

결과는 같지만, `count()`를 쓰는 방법은 글자마다 문자열 전체를 다시 훑기 때문에 글자 수가 많아지면 크게 느려진다. **결과가 같아도 하는 일의 양은 다를 수 있다**는 걸 알게 됐다.

## 문자열 연습 과제
```python
# 중복 글자가 없는 단어인가
def isIsogram(word):
    return len(word.lower()) == len(set(word.lower()))

# 몇 칸 돌렸는지 찾기
def shiftedDiff(words):
    first, second = words
    return (second * 2).find(first)
```

`isIsogram`은 set으로 중복을 없앴는데 길이가 같으면 원래 중복이 없었다는 뜻이다.

`shiftedDiff`는 `"ohell" * 2 = "ohellohell"` 안에서 `"hello"`를 찾으면 그 위치가 곧 돌린 칸 수가 된다. 못 찾으면 `find`가 -1을 주는데, 문제의 정답도 -1이라 그대로 맞는다.

그리고 과제 코드를 다시 보니 `max = " "`처럼 내장 함수 이름을 변수로 쓴 부분이 있었다. 이러면 그 함수 안에서 `max()`를 쓸 수 없게 된다. `longest` 같은 이름으로 바꾸는 게 맞을 것 같다.

## 오늘 배운 내용 정리
오늘은 표준 라이브러리, 가위바위보 과제, 문자열 메소드를 배웠다.

```
import: import 모듈 / from 모듈 import 이름.
random: randint 는 끝값 포함. shuffle + 슬라이싱으로 중복 없이 뽑기. seed 로 고정.
math / round: ceil, floor, trunc. round(2.5) 는 2 (오사오입).
time / datetime: 기계 시간과 사람 시간. strftime(내보내기), strptime(읽어들이기).
timedelta: 시간 차이. 전체 초는 total_seconds().
가위바위보: 기능 하나 = 함수 하나. while True + break 메인 루프.
문자열 메소드: 원본은 그대로, 새 문자열을 돌려준다. s = s.strip() 처럼 받아야 한다.
개수 세기: d[ch] = d.get(ch, 0) + 1
중복 여부: len(s) == len(set(s))
```

가위바위보 과제를 하면서 바로 코드를 치기보다, 먼저 무엇을 보여주고 무엇을 받고 어떻게 판정할지 기능부터 나누는 게 중요하다는 걸 느꼈다.

코드를 보지 않고 세 함수를 다시 짜보면서 정말 설명할 수 있는지 확인해보려고 한다.

---
