---
layout: single
title: "Python 기초 정리 9 - 정규표현식, 스코프와 클로저"
categories: [coding, Python]
tag: [study-log, Python, regex, re, scope, LEGB, global, nonlocal, closure]
toc: true
author_profile: false
sidebar:
    nav: "docs"
search: true
---
<hr/>

오늘은 문자열을 "패턴"으로 다루는 **정규표현식**과, 변수 이름이 어디까지 통하는지를 다루는 **스코프**, 그리고 함수가 자기가 만들어질 때의 변수를 기억하는 **클로저**를 배웠다.

정규표현식은 기호가 많아서 처음엔 암호처럼 보였고, 클로저는 "함수를 리턴한다"는 개념이 낯설었다. 오늘 배운 내용을 기준으로 정리해보려고 한다.

## 정규표현식이란
정규표현식은 "글자가 정확히 같은가"가 아니라 **"이런 모양인가"**를 검사하는 문법이다.

파이썬만의 문법이 아니라 거의 모든 언어와 에디터가 공유하는 별도의 작은 언어라서, 한 번 배우면 JavaScript에서도, VSCode 찾기에서도 그대로 쓸 수 있다고 한다. 코딩량이 확 줄어드는 대신, 처음 배우기 어렵고 코드 가독성을 떨어뜨린다는 단점이 있다.

주민등록번호, 이메일, 비밀번호, 날짜 형식, 전화번호 같은 **사용자 입력 유효성 검사**에 많이 쓴다.

## re 모듈 사용 흐름
```
패턴 문자열 ──re.compile()──→ Pattern 객체
                                 ↓ .search(입력 문자열)
                             Match 객체 (또는 None)
                                 ↓ .group() .span()
                             매치된 내용
```

```python
import re

pat = re.compile('My....')     # My + 아무 글자 4개
match = pat.search("-My1234-")
print(match)        # <re.Match object; span=(1, 7), match='My1234'>
print(match.group())  # 'My1234'
print(match.span())   # (1, 7)

print(pat.search("hello"))  # 못 찾으면 None
```

검색 메소드는 네 가지다.

```python
pat.search(s)    # 어디든 첫 번째 매치 → Match 객체
pat.match(s)     # 문자열 '처음부터' 매치되는지
pat.findall(s)   # 매치된 문자열들의 list
pat.finditer(s)  # Match 객체들의 iterable
```

`match`와 `search`의 차이가 중요하다.

```python
p = re.compile('(My)(....)')
p.match("-My1234-")   # None  '-' 로 시작하니까
p.search("-My1234-")  # 찾는다
```

`match`는 처음부터 맞아야 해서 유효성 검사에 쓴다.

## 그룹
패턴 안에서 `( )`로 묶으면 그룹이 되고, 따로 꺼낼 수 있다.

```python
m = re.compile('(My)(....)').search("-My1234-")
m.group()   # 'My1234'  전체 (= group(0))
m.group(1)  # 'My'
m.group(2)  # '1234'
```

그룹은 1번부터 번호가 붙고, 0번은 전체다.

## 패턴에는 항상 r-string
```python
p = re.compile(r'(\d+)/(\d+)/(\d+)')    # raw string
p = re.compile('(\\d+)/(\\d+)/(\\d+)')  # 같은 뜻인데 역슬래시를 두 번씩
```

정규식에는 `\d`, `\s`, `\w`가 계속 나오는데, `r` 없이 쓰면 파이썬이 이스케이프를 먼저 해석해버린다. 출력 포맷팅을 배울 때 "나중에 정규표현식에서 거의 필수로 쓰인다"고 했던 게 이것이었다.

## 자주 쓰는 문법

| 기호 | 뜻 |
|---|---|
| `^` / `$` | 문자열 시작 / 끝 |
| `.` | 아무 문자 한 개 |
| `*` / `+` / `?` | 앞 문자가 0개 이상 / 1개 이상 / 0개 또는 1개 |
| `[]` | 문자 집합. `[a-z]`처럼 범위, 안의 `^`는 not |
| `{n}` `{n,}` `{n,m}` | 개수 지정 |
| `()` / `\|` | 그룹 / OR |
| `\d` `\D` | 숫자 / 숫자 아닌 것 |
| `\s` `\S` | 공백 / 공백 아닌 것 |
| `\w` `\W` | 알파벳·숫자·`_` / 그 외 |

```python
r"^The"         # The 로 시작
r"Man$"         # Man 으로 끝
r"^SuperMan$"   # 정확히 SuperMan 만
r"x.z"          # x + 아무 글자 1개 + z
r"ab*"          # a + b가 0개 이상 → "a" 도 매치
r"ab+"          # a + b가 1개 이상 → "a" 는 매치 안 됨
r"[^0-9]+"      # 숫자가 아닌 것
r"ab{3,5}"      # b가 3~5개
```

헷갈리기 쉬운 부분은 두 가지였다. `*`는 0개도 허용해서 예상보다 많이 잡히고, **대괄호 안의 `^`는 not, 밖의 `^`는 문자열 시작**이라 뜻이 정반대다. 그리고 `.` 자체를 찾으려면 `\.`나 `[.]`로 써야 한다.

## 치환 sub()
```python
a = "123456-1234567"
re.sub("-", "", a)      # '1234561234567'
re.sub(r'\d', '*', a)   # '******-*******'
re.sub(r'\D', '*', a)   # '123456*1234567'
```

그룹을 활용하면 일부만 살리고 치환할 수 있다.

```python
data = """
park 800905-1049118
kim  700905-1059119
"""
print(re.sub(r"(\d{6})[-]\d{7}", r'\g<1>-*******', data))
# park 800905-*******
# kim  700905-*******
```

`\g<1>`은 1번 그룹에서 매치된 내용을 그대로 쓰라는 뜻이다. 앞 6자리는 살리고 뒤 7자리만 가리는 개인정보 마스킹의 정석이라고 한다.

## 정규표현식 연습
```python
string = '정가 14,500원'
int(re.sub(r'\D', '', string))  # 14500
```

문자열 메소드를 배울 때 `replace`를 두 번 써서 했던 걸 한 줄로 끝냈다.

쿠폰 번호 검증 실습도 했다. 형식은 **알파벳 2자리 - 숫자 4자리 - 숫자 3자리 - 알파벳 3자리**이고, 대소문자는 상관없고 숫자는 0으로 시작하면 안 된다.

```python
regex = r'^[a-z]{2}[-][1-9]\d{3}[-][1-9]\d{2}[-][a-z]{3}$'

while True:
    coupon = input().lower()   # 소문자로 맞춰서 대소문자 무관하게
    if coupon == 'quit': break
    print("valid" if re.match(regex, coupon) else "invalid")
```

"0으로 시작하면 안 된다"는 조건을 `[1-9]` 하나로 표현한 부분이 요령이었다. 그리고 `^`와 `$`가 없으면 `"xxxAb-7890-786-zuyyy"`처럼 앞뒤에 뭔가 붙어도 통과해버린다. 유효성 검사에서는 반드시 붙여야 한다.

정규식은 외우기보다 regexr.com 같은 사이트에서 실시간으로 맞춰보면서 만드는 게 정석이라고 하셨다. VSCode 찾기에서 `.*` 아이콘을 켜면 정규식으로 검색·치환도 할 수 있다.

## 스코프
오후에는 스코프를 배웠다. 스코프는 **변수 이름이 사용될 수 있는 범위**다.

파이썬은 이름을 만나면 네 군데를 순서대로 찾는다. 앞글자를 따서 **LEGB**라고 한다.

| 약자 | 이름 | 어디 |
|---|---|---|
| L | Local | 지금 이 함수 안 |
| E | Enclosing | 나를 감싼 바깥 함수 |
| G | Global | 이 파일 전체 |
| B | Built-in | 파이썬 기본 제공 (`print`, `len`, `sum`...) |

함수를 배울 때 `sum = 10 + 20`을 하면 내장 `sum()`을 못 쓰게 되는 이유가 이 순서 때문이었다. 전역(G)에 `sum`이 생기면 내장(B)까지 가기 전에 그걸 찾아버린다.

## 전역변수는 읽기만 된다
```python
x = 10
def foo():
    print(x)  # 읽기는 된다
foo()

z = 10
def foo2():
    z = 20    # 전역 z를 바꾼 게 아니라 지역변수 z를 새로 만든 것
    print(z)  # 20
foo2()
print(z)      # 10  전역은 그대로
```

함수 안에서 어떤 이름에 **대입**하면, 파이썬은 그 이름을 그 함수의 지역변수로 결정한다. 그것도 함수 전체에 대해 첫 줄부터 정해진다.

그래서 이런 에러가 난다.

```python
a = 1
def vartest():
    a = a + 1  # UnboundLocalError
```

함수 안에 `a = ...`이 있으니 `a`는 지역변수로 정해지고, `a + 1`을 계산하려는데 지역변수 `a`는 아직 값이 없다. 전역에 `a = 1`이 있어도 쳐다보지도 않는다. 에러 메시지의 "referenced before assignment"가 정확히 그 뜻이었다.

## 함수로 전역변수를 바꾸려면
```python
# 방법 1: return (추천)
a = 1
def vartest(a):
    a = a + 1
    return a

a = vartest(a)
print(a)  # 2

# 방법 2: global (비추천)
def vartest2():
    global a
    a = a + 1
```

`global`도 동작은 하지만, 수업에서는 유지보수 측면에서 매우 안 좋아서 가급적 쓰지 말라고 하셨다. 여러 함수가 전역변수를 고치면 값이 이상할 때 **어느 함수가 바꿨는지 추적할 수 없기** 때문이다. `return`을 쓰면 누가 바꿨는지 호출한 줄에 그대로 보인다.

다만 list나 dict를 넘기면 함수 안에서 내용을 고친 게 밖에도 반영된다. 이름은 못 바꿔도 내용은 바꿀 수 있다는 점은 따로 기억해야 할 것 같다.

`locals()`를 찍어보면 그 스코프의 **네임스페이스**(이름 → 값의 dict)를 볼 수 있다.

## 파이썬은 블록 스코프가 없다
```python
for i in range(3):
    pass
print(i)  # 2  루프 변수가 밖에 남아 있다
```

새 스코프를 만드는 것은 `def`, `lambda`, `class` 세 가지뿐이고, `if`, `for`, `while`은 스코프를 만들지 않는다. 조건문을 배울 때 예고했던 내용이 여기서 정리됐다.

## inner function
LEGB 중 E(Enclosing)는 함수 안에 함수가 있을 때 생긴다.

```python
def print_hello():
    hello = 'Hello, world!'

    def print_message():
        print(hello)  # 바깥 함수의 지역변수를 읽는다

    print_message()

print_hello()
```

## 함수를 리턴하는 함수
lambda와 map을 배울 때는 함수를 인자로 넘겼는데, 이번에는 함수를 **리턴**한다.

```python
def multiplexer(x):
    def something(n):
        return x * n
    return something       # 호출이 아니라 함수 자체를 리턴

triple = multiplexer(3)    # x=3 을 기억하는 함수
double = multiplexer(2)    # x=2 를 기억하는 함수

print(triple(100), triple(10))  # 300 30
print(double(100), double(10))  # 200 20
```

`return something`에 괄호가 없다는 게 핵심이다. 괄호를 붙이면 실행 결과를 리턴하게 된다. `multiplexer`는 곱하는 함수를 찍어내는 **함수 공장** 같은 것이라고 이해했다.

바깥 함수의 변수를 바꾸려고 하면 스코프에서 본 것과 똑같은 문제가 생긴다. 이때는 `return`을 쓰거나, 바깥 함수의 변수를 가리키는 `nonlocal`을 쓴다. `global`이 파일 전체를 가리킨다면 `nonlocal`은 나를 감싼 함수를 가리킨다.

## 클로저
보통 함수가 끝나면 그 지역변수는 사라진다. 그런데 안쪽 함수가 그 변수를 쓰고 있고, 그 안쪽 함수가 밖으로 리턴되어 살아 있다면 파이썬은 그 변수를 지우지 않는다.

```python
def calc():
    a = 3
    b = 5
    def inner(x):
        return a * x + b
    return inner

c = calc()                # calc() 는 이미 끝났는데
print(c(1), c(2), c(3))   # 8 11 14  a, b 가 살아 있다
```

이렇게 **자기가 만들어질 때의 환경을 기억하는 함수**를 클로저라고 한다.

```
클로저가 되는 3가지 조건
1. 함수 안에 함수가 있다 (중첩 함수)
2. 안쪽 함수가 바깥 함수의 변수를 쓴다
3. 바깥 함수가 끝난 뒤에도 안쪽 함수가 살아 있다 (리턴되어 어딘가에 담긴다)
```

## 클로저로 호출 횟수 세기
전역변수로 호출 횟수를 세면 다른 코드가 `cnt = 100`처럼 아무나 값을 바꿀 수 있다. 클로저로 만들면 `cnt`가 함수 안에 숨는다.

```python
def counter():
    cnt = 0
    def inner():
        nonlocal cnt
        cnt += 1
        return cnt
    return inner

c = counter()
for i in range(10):
    print(c(), end=' ')  # 1 2 3 ... 10

d = counter()            # 새로 만들면 cnt 가 따로다
print(d())               # 1
```

`c`와 `d`가 각자의 `cnt`를 갖고, 밖에서는 `cnt`에 접근할 방법이 없다.

수업에서 정리한 클로저를 쓰는 이유는 세 가지였다.

```
1. 전역변수에 의존하지 않으니 값 변경에 대한 책임과 권한이 명확해진다.
2. 전역변수를 쓸 때 생기는 충돌 문제에서 자유롭다.
3. 사용 환경에 맞게 내부 구조를 조정할 수 있다.
```

함수가 내부 상태를 갖는 것처럼 동작하고 밖에서는 못 건드리게 한다는 점이 객체와 비슷하게 느껴졌는데, 내일 배울 클래스가 바로 그런 것이라고 한다. 그리고 데코레이터도 결국 클로저라고 하셨다.

## 오늘 배운 내용 정리
오늘은 정규표현식, 스코프, 클로저를 배웠다.

```
정규표현식: "이런 모양인가"를 검사한다. 패턴에는 항상 r"..." 를 쓴다.
match vs search: 처음부터 맞아야 함 / 어디든 찾음.
유효성 검사: ^ 와 $ 를 반드시 붙인다.
re.sub(r'\D', '', s): 숫자만 남기기. \g<1> 로 그룹을 살린 치환.
LEGB: Local → Enclosing → Global → Built-in 순서로 이름을 찾는다.
지역변수: 함수 안에서 대입하는 순간 그 이름은 지역변수가 된다 → UnboundLocalError.
global / nonlocal: 동작은 하지만 가급적 return 으로 대체한다.
클로저: 바깥 함수가 끝나도 그 변수를 기억하는 함수. return inner 에 괄호를 붙이지 않는다.
```

UnboundLocalError는 그냥 보면 이해가 안 되는 에러였는데, "대입하는 순간 지역변수로 정해진다"는 규칙을 알고 나니 이해가 됐다.

내일 데코레이터를 배운다고 하니, 오늘 `multiplexer`와 `counter`를 손으로 다시 짜보면서 클로저 구조에 익숙해지려고 한다.

---
