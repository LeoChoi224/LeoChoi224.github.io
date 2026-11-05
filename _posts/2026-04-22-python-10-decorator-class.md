---
layout: single
title: "Python 기초 정리 10 - Jupyter, 데코레이터와 클래스"
categories: [coding, Python]
tag: [study-log, Python, jupyter, markdown, decorator, class, self, classmethod, staticmethod]
toc: true
author_profile: false
sidebar:
    nav: "docs"
search: true
---
<hr/>

오늘은 셀 단위로 코드를 실행하는 **Jupyter Notebook**과 **마크다운** 문법을 배우고, 어제 배운 클로저를 응용한 **데코레이터**, 그리고 객체 지향의 시작인 **클래스**까지 배웠다.

어제 "클로저는 가벼운 객체이고, 데코레이터도 결국 클로저"라는 말이 있었는데, 오늘 그 말이 무슨 뜻인지 알게 됐다.

## Jupyter Notebook
`.py` 파일은 위에서 아래로 통째로 실행돼서, 중간 결과를 보려면 매번 전체를 다시 돌려야 한다. 불러오는 데 30초 걸리는 데이터를 다룬다면 꽤 고통스러울 것이다.

Jupyter는 **셀 단위로 나눠 실행하고, 그 결과(변수)를 메모리에 남겨둔다.** 데이터를 한 번 불러놓고 아래 셀들을 고쳐가며 실험할 수 있어서, 앞으로 데이터 분석과 머신러닝 수업은 거의 `.ipynb`로 진행된다고 한다.

Jupyter에는 두 가지 모드가 있고 모드마다 단축키가 다르다.

| 모드 | 상태 | 들어가는 법 |
|---|---|---|
| Edit mode | 셀 안에 커서, 코드 작성 | 셀 클릭 또는 `ENTER` |
| Command mode | 셀 추가·삭제·변환 | `ESC` |

```
SHIFT + ENTER   실행하고 다음 셀로
CTRL + ENTER    해당 셀만 실행
ESC → M / Y     마크다운 셀 / 코드 셀로
ESC → A / B     위 / 아래에 셀 추가
ESC → X / Z     셀 삭제 / 삭제 취소
SHIFT + TAB     함수 도움말(docstring) 보기
```

코드 셀은 **마지막 줄의 값**이 `print` 없이도 자동으로 출력된다. 그리고 `!pip install pandas`처럼 앞에 `!`를 붙이면 터미널 명령도 실행할 수 있다.

가장 큰 함정은 **실행 순서가 위에서 아래가 아닐 수 있다**는 점이다. 셀을 여기저기 눌러 실행하다 보면 번호가 뒤죽박죽이 되고, "코드는 맞는데 결과가 이상한" 상황이 생긴다. 작업을 마치면 Kernel → Restart & Run All로 처음부터 다시 돌려보는 습관을 들이라고 하셨다.

## 마크다운
마크다운은 확장자가 `.md`인 가벼운 문서 형식이다. Jupyter 설명 셀, GitHub README, 블로그에서 쓴다. 지금 이 블로그 글도 마크다운으로 쓰고 있다.

```markdown
# 제목 1 ~ ###### 제목 6
**굵게**  *이탤릭*  ~~취소선~~  `코드`
- 순서 없는 목록
1. 순서 있는 목록
[링크 텍스트](https://google.com)
![대체 텍스트](이미지주소)
> 인용문
---
```

코드 블록은 백틱 3개로 감싸고 뒤에 언어 이름을 적으면 문법 강조가 된다. 표는 `|`와 `---`로 만들고, 수식은 `$x = y^2$`처럼 `$`로 감싸면 된다.

## 데코레이터가 필요한 이유
크롤링 함수가 끝나면 SMS를 보내고 싶다고 해보자. 가장 쉬운 방법은 함수 안에 한 줄 넣는 것이다.

```python
def crawling():
    print("크롤링 합니다.")
    print('SMS 를 보냅니다')  # 추가
    return "크롤링 결과"
```

하지만 이러면 크롤링 함수가 두 가지 일을 하게 되고, 전처리 함수에도 SMS를 붙이려면 또 복사해야 한다. 남이 만든 라이브러리 함수라면 아예 고칠 수도 없다.

**원본을 고치지 않고 밖에서 감싸자**는 것이 데코레이터다.

## 첫 번째 데코레이터
```python
def send_sms(func):            # func 이 감쌀 대상 함수
    def inner_func():
        result = func()        # 1. 대상 함수 호출
        print('SMS 를 보냅니다')  # 2. 덧붙인 동작
        return result          # 3. 대상 함수의 리턴값을 그대로 돌려준다
    return inner_func          # 함수를 리턴 (괄호 없음)

@send_sms
def crawling():
    print("크롤링 합니다.")
    return "크롤링 결과"

result = crawling()
print('result:', result)  # 크롤링 결과
```

`@send_sms`가 하는 일은 딱 이 한 줄이다.

```python
crawling = send_sms(crawling)
```

그래서 `crawling()`을 부르면 실제로는 데코레이터가 리턴한 `inner_func()`이 실행되고, 그 안에서 원본 `crawling`이 호출된다.

어제 배운 클로저와 비교해보면 구조가 똑같다. 어제는 **값**을 받아서 그 값을 기억하는 함수를 리턴했고, 오늘은 **함수**를 받아서 그 함수를 기억하는 함수를 리턴한다.

여기서 `return result`를 빼먹으면 데코레이터를 붙이는 순간 리턴값이 `None`이 된다. 원본 함수는 멀쩡한데 값이 `None`이면 여기를 의심해야 할 것 같다.

## 아무 함수에나 붙는 데코레이터
wrapper의 매개변수를 대상 함수에 맞춰야 하는데, 그러면 특정 개수의 매개변수를 가진 함수에만 붙일 수 있다. 여기서 함수를 배울 때의 packing / unpacking이 결정적으로 쓰인다.

```python
def trace(func):
    def wrapper(*args, **kwargs):     # 뭐가 오든 다 모아서 받고
        r = func(*args, **kwargs)     # 그대로 풀어서 넘긴다
        print(f"{func.__name__}(args={args}, kwargs={kwargs}) -> {r}")
        return r
    return wrapper

@trace
def get_max(*args):
    return max(args)

@trace
def get_min(**kwargs):
    return min(kwargs.values())

print(get_max(10, 15, 20))        # 20
print(get_min(x=10, y=20, z=30))  # 10
```

`def wrapper(*args, **kwargs): return func(*args, **kwargs)`가 데코레이터의 표준 뼈대다. 함수를 배울 때 봤던 `log(*args, **kwargs)` 예제가 이걸 위한 준비였던 것 같다.

`func.__name__`은 함수의 이름 문자열이라 로그를 찍을 때 유용하다.

## 경과 시간 측정 데코레이터
과제로 대상 함수를 수정하지 않고 실행 시간을 재는 데코레이터를 만들었다.

```python
import time

def laptime(func):
    def print_time(loop, delay):
        print(f"{func.__name__}() 측정시작")
        start_time = time.time()
        func(loop, delay)
        end_time = time.time()
        print("측정종료", end_time - start_time)
    return print_time

@laptime
def countDown(loop, delay):   # 이 함수는 수정하지 않는다
    for i in range(loop, 0, -1):
        print(i)
        time.sleep(delay)

countDown(3, 2)
```

다만 이 코드는 매개변수가 `(loop, delay)`로 고정돼 있고 리턴값도 돌려주지 않는다. 위의 `*args, **kwargs` 뼈대로 바꾸면 아무 함수에나 붙일 수 있다.

로깅, 실행 시간 측정, 로그인 확인, 캐싱처럼 **본래 기능과는 상관없지만 여러 함수에 공통으로 필요한 일**에 데코레이터를 쓴다고 한다. Flask의 `@app.route("/")`도 데코레이터다.

## 클래스와 객체 지향
지금까지의 프로그래밍은 함수 중심이었다.

```python
goto("이길자", "집(논현동 188)")
```

동작이 주인공이고, 데이터는 동작에 넘기는 재료였다. 그런데 사람이 인식하는 세상은 "이길자라는 사람이 있고, 그 사람이 집에 간다"처럼 객체 중심이다.

```python
lee = Person("이길자", "논현동 188")
lee.goHome()
```

프로그래밍의 중심이 함수가 아니라 각각의 객체가 되는 것을 **객체 지향 프로그래밍(OOP)**이라고 한다.

수업에서는 붕어빵 비유를 들었다. **클래스는 붕어빵 틀(설계도)**이고, 그 틀로 찍어낸 **붕어빵이 객체(인스턴스)**다.

```python
class Cookie:
    pass

a = Cookie()  # 객체 생성
b = Cookie()
print(type(a))  # <class '__main__.Cookie'>
print(a is b)   # False  타입만 같을 뿐 다른 인스턴스
```

클래스를 정의하면 `int`, `str`, `list` 옆에 새로운 타입이 하나 생기는 셈이다. 클래스 이름은 관례적으로 첫 글자를 대문자로 쓴다.

## 생성자와 객체변수
```python
class Rectangle:
    def __init__(self, width=0, height=0):  # 생성자
        self.width = width                  # 객체변수
        self.height = height

    def get_area(self):                     # 메소드
        return self.width * self.height

    def get_perimeter(self):
        return (self.width + self.height) * 2

r1 = Rectangle()                       # 디폴트 0, 0
r2 = Rectangle(30, 20)
r3 = Rectangle(**{'width': 33, 'height': 44})  # dict unpacking 도 된다

print(r2.get_area())       # 600
print(r2.get_perimeter())  # 100
```

`__init__`은 객체가 만들어질 때 **자동으로 호출되는** 생성자이고, 여기서 객체변수를 정의하고 초기값을 넣는다. 생성자도 결국 함수라서 디폴트 인자, 키워드 인자, unpacking이 전부 그대로 쓰인다.

객체변수는 **인스턴스마다 각자** 갖는다. `r1.width`를 바꿔도 `r2.width`는 그대로다.

주의할 점은 속성을 나중에 아무렇게나 추가할 수 있다는 것이다. 수업 노트북에도 `r3.heigth = 20`처럼 오타를 낸 줄이 있었는데, 에러 없이 `heigth`라는 새 속성이 생기고 `get_area()`는 `height`를 찾아서 0이 나왔다. 찾기 어려운 버그의 전형이라고 한다.

## self의 정체
모든 메소드의 첫 매개변수는 `self`인데, 호출할 때는 넘기지 않는다.

```python
r3.get_area()           # 인자를 안 넘겼는데?
Rectangle.get_area(r3)  # 이게 진짜 모습. 위와 완전히 같다
```

**`객체.메소드()`는 `클래스.메소드(객체)`의 줄임말**이라서 `self`에 그 객체가 자동으로 들어간다.

문자열 메소드를 배울 때 `'car'.upper()`가 `str.upper('car')`와 같았던 이유가 오늘 밝혀졌다. `str`도 클래스이고, `"car"`는 그 인스턴스였던 것이다.

`self`를 빼먹고 `def get_area():`라고 쓰면 호출할 때 "0개를 받는데 1개를 넘겼다"는 `TypeError`가 난다. 그 1개가 바로 `self`다. 그리고 메소드 안에서 `self.`를 빼먹으면 그냥 지역변수가 된다.

## 객체를 매개변수로 받기
```python
import math

class Point2D:
    def __init__(self, x=0, y=0):
        self.x = x
        self.y = y

    def get_distance(self):              # 원점에서의 거리
        return math.sqrt(self.x ** 2 + self.y ** 2)

    def get_distance_from(self, other):  # 다른 점까지의 거리
        return math.sqrt((self.x - other.x) ** 2 + (self.y - other.y) ** 2)

p2, p3 = Point2D(0, 2), Point2D(0, -1)
print(p2.get_distance_from(p3))  # 3.0
```

`self`는 나, `other`는 상대다. 같은 클래스의 객체를 매개변수로 받아서 두 객체를 계산하는 형태다.

```python
p1 = Point2D(1, 2)
p2 = Point2D(1, 2)
print(p1 == p2)    # False  값이 같은데도 False
print(p1.__dict__) # {'x': 1, 'y': 2}
```

list는 "값이 같으면 같다"는 규칙이 미리 정의돼 있지만, 내가 만든 클래스에는 그런 규칙이 없어서 같은 객체일 때만 같다고 본다. 값으로 비교하려면 `__eq__`를 정의해야 한다고 한다.

`__dict__`를 찍어보면 객체변수가 결국 dict에 저장된다는 걸 볼 수 있다.

## 클래스 변수와 인스턴스 변수
"모든 객체가 공통으로 쓰는 값"도 있다. 지금까지 만들어진 계좌가 총 몇 개인지 같은 것이다.

```python
class Account:
    num_accounts = 0                # 클래스 변수 (모두가 공유)

    def __init__(self, name):
        self.name = name            # 인스턴스 변수 (각자)
        Account.num_accounts += 1   # 클래스 이름으로 접근

acc1 = Account('회사')
acc2 = Account('개인')
print(Account.num_accounts)  # 2

print(acc1.__dict__)  # {'name': '회사'}  num_accounts 가 없다
```

`acc1.num_accounts`로도 읽을 수는 있다. 파이썬은 인스턴스 네임스페이스에 없으면 클래스 네임스페이스까지 올라가서 찾기 때문이다.

그런데 인스턴스로 값을 바꾸면 문제가 생긴다.

```python
acc1.num_accounts += 1
print(Account.num_accounts, acc1.num_accounts, acc2.num_accounts)  # 2 3 2
print(acc1.__dict__)  # {'name': '회사', 'num_accounts': 3}  새로 생겼다
```

`acc1.num_accounts += 1`은 `acc1.num_accounts = acc1.num_accounts + 1`이다. 읽기(오른쪽)는 클래스에서 찾지만, **쓰기(왼쪽)는 인스턴스 네임스페이스에 새로 만든다.** 그래서 공유가 깨진다.

어제 배운 "함수 안에서 전역변수에 대입하면 지역변수가 새로 생긴다"와 완전히 같은 구조였다. **읽기는 위로 올라가고, 쓰기는 제자리에 한다.** 그래서 클래스 변수는 언제나 `클래스이름.변수이름`으로 쓰기로 했다.

## 메소드 세 종류
```python
class MyClass:
    class_var = "I am a class variable"

    def __init__(self, value):
        self.value = value

    def instance_method(self):      # 인스턴스 메소드
        return f"self.value = {self.value}"

    @classmethod
    def class_method(cls):          # 클래스 메소드
        return f"cls.class_var = {cls.class_var}"

    @staticmethod
    def static_method(x, y):        # 정적 메소드
        return f"{x} + {y} = {x + y}"
```

| 종류 | 첫 인자 | 쓸 때 |
|---|---|---|
| 인스턴스 메소드 | `self` | 객체의 상태를 다룰 때 |
| 클래스 메소드 | `cls` | 클래스 레벨 데이터를 다룰 때 |
| 정적 메소드 | 없음 | 객체와 무관한 도우미 기능을 클래스에 묶을 때 |

`@classmethod`, `@staticmethod`도 오늘 배운 데코레이터다. 파이썬이 기본으로 제공하는 데코레이터라서 원리를 알고 쓰니 덜 낯설었다.

데코레이터 없이 `self`도 없는 메소드를 `obj.method(3, 5)`로 부르면 `MyClass.method(obj, 3, 5)`가 되어서 인자가 3개라는 에러가 난다. `@staticmethod`는 이 자동 전달을 막아주는 장치다.

## PartTimer 과제
모든 직원에게 공통인 시급과 전체 직원 수는 클래스 변수로, 직원별 별칭·근무지·급여총액은 인스턴스 변수로 설계하는 과제였다.

```python
class PartTimer:
    hourly_wage = 34400 // 4    # 공통 시급
    total_part_timers = 0       # 전체 직원 수

    def __init__(self, nickname, workplace="113동", total_wage=0):
        self.nickname = nickname
        self.workplace = workplace
        self.total_wage = total_wage
        PartTimer.total_part_timers += 1

    def calculate_wage(self, hour, bonus=0):
        r = (PartTimer.hourly_wage * hour) + bonus
        self.total_wage += r
        return r

ryan = PartTimer('라이언')
neo = PartTimer('네오', '127-1동')
print(PartTimer.total_part_timers)  # 2
print(neo.calculate_wage(3, 15000)) # 40800
```

클래스 변수에 클래스 이름으로 접근하고, 근무지와 상여금에 디폴트 인자를 준 부분은 잘한 것 같다.

다시 보니 고칠 점도 있었다. `34400 // 4`는 결과는 8600으로 맞지만, 읽는 사람은 왜 4로 나누는지 알 수 없다. `hourly_wage = 8600`처럼 값의 의미를 남기는 게 더 좋은 코드일 것 같다. 그리고 급여총액은 밖에서 정할 값이 아니라서 매개변수로 받기보다 `self.total_wage = 0`으로 고정하는 게 설계 의도에 맞다.

또 노트북에서 `ryan.total_wage`가 기대값의 두 배로 나왔는데, `calculate_wage(4)` 셀을 두 번 실행해서 누적된 것이었다. 오전에 배운 Jupyter의 함정을 바로 겪은 셈이다.

## 오늘 배운 내용 정리
오늘은 Jupyter와 마크다운, 데코레이터, 클래스를 배웠다.

```
Jupyter: 셀 단위 실행. ESC(Command) / ENTER(Edit). 이상하면 Restart & Run All.
마크다운: # 제목, ** 굵게, ``` 코드 블록, | 표 |.
데코레이터: 함수를 받아 감싼 함수를 돌려주는 함수. @deco 는 func = deco(func).
뼈대: def wrapper(*args, **kwargs): r = func(*args, **kwargs); return r
클래스: 설계도(붕어빵 틀). 인스턴스는 찍어낸 붕어빵.
__init__: 객체가 생길 때 자동으로 불리는 생성자.
self: obj.method() 는 Class.method(obj). 객체변수에는 반드시 self. 를 붙인다.
클래스 변수: 모두가 공유. 항상 클래스이름.변수이름 으로 쓴다.
메소드 세 종류: 인스턴스(self) / 클래스(@classmethod, cls) / 정적(@staticmethod).
```

이것으로 Python 기초 진도가 끝났다. 2주 동안 정말 많은 내용을 배웠는데, 앞에서 배운 내용들이 뒤에서 계속 다시 쓰이는 게 신기했다. SCE가 reduce에서, 함수의 packing이 데코레이터에서, 스코프가 클래스 변수에서 다시 나왔다.

특히 오늘 클래스를 배우면서 문자열 메소드가 왜 그렇게 동작했는지 이해가 돼서, 따로따로 외웠던 내용들이 하나로 이어지는 느낌이 들었다.

---
