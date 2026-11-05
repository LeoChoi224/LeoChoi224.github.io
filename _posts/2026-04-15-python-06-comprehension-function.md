---
layout: single
title: "Python 기초 정리 6 - comprehension과 함수"
categories: [coding, Python]
tag: [study-log, Python, comprehension, function, return, args, kwargs, packing, unpacking, recursion]
toc: true
author_profile: false
sidebar:
    nav: "docs"
search: true
---
<hr/>

어제 `for`를 배우면서 "빈 리스트 만들기 → 돌면서 → append" 패턴을 봤는데, 오늘은 그걸 한 줄로 줄이는 **comprehension**과, 반복되는 코드를 묶어 이름을 붙이는 **함수**를 배웠다.

함수는 처음엔 간단해 보였는데, 매개변수를 주고받는 방식이 생각보다 여러 가지라서 양이 꽤 많았다. 오늘 배운 내용을 기준으로 정리해보려고 한다.

## comprehension
어제 봤던 코드다.

```python
result = []
for num in a:
    result.append(num * 3)
```

세 줄이지만 하는 일은 "a의 각 원소를 3배 해서 새 리스트로" 하나다. comprehension은 이걸 그대로 한 줄로 적는 문법이다.

```python
a = [1, 2, 3, 4]
result = [num * 3 for num in a]  # [3, 6, 9, 12]
```

읽는 순서는 가운데에서 왼쪽이다. `for num in a`(어디서 꺼낼지)를 먼저 읽고, `num * 3`(무엇을 만들지)을 읽는다.

## if 위치에 따라 뜻이 달라진다
오늘 comprehension에서 가장 헷갈렸던 부분이다.

```python
# if 가 for 뒤: 거르기
[num * 3 for num in a if num % 2 == 0]           # [6, 12]

# if ~ else 가 for 앞: 골라서 바꾸기
[num * 3 if num % 2 == 0 else num for num in a]  # [1, 6, 3, 12]
```

| 위치 | 하는 일 | 결과 개수 |
|---|---|---|
| `for` 뒤 `if` | 조건에 맞는 것만 남긴다 | 줄어든다 |
| `for` 앞 `if ~ else` | 값을 골라서 바꾼다 | 그대로 |

앞에 오는 것은 지난번에 배운 **삼항 연산자**라서 `else`가 반드시 있어야 한다. 값을 만들어야 하니까 참일 때 값과 거짓일 때 값이 둘 다 필요하기 때문이다. 뒤에 오는 `if`는 필터 조건이라 `else`가 없다.

"`else`가 필요하면 앞, 필요 없으면 뒤"라고 기억하기로 했다.

길어지면 줄을 나눠 쓰는 게 읽기 좋다.

```python
dataset = [1, -2, 3, -4, 5]
result = [
    num ** 2
    for num in dataset
    if (num ** 2) > 10
]  # [16, 25]
```

for를 두 개 쓰면 중첩 for와 순서가 같다. 왼쪽이 바깥, 오른쪽이 안쪽이다.

```python
[f"{i} x {j} = {i * j}" for i in range(2, 10) for j in range(1, 10)]
```

## set과 dict comprehension
괄호만 바꾸면 set과 dict도 만들 수 있다.

```python
[num % 3 for num in range(10)]       # list [0,1,2,0,1,2,...]
{num % 3 for num in range(10)}       # set  {0, 1, 2}  중복 제거
{num: num % 3 for num in range(10)}  # dict {0:0, 1:1, 2:2, 3:0, ...}
```

dict를 조건으로 거르는 형태는 자주 쓴다고 한다.

```python
fruits = {"apple": "red", "banana": "yellow", "peach": "pink"}

{k: v for k, v in fruits.items() if k != 'banana'}  # key 조건
{k: v for k, v in fruits.items() if v != 'red'}     # value 조건
```

참고로 `( )`로 감싸면 tuple이 아니라 **제너레이터 표현식**이라는 다른 것이 된다. tuple comprehension은 없다.

## 함수
같은 코드가 이름만 바꿔서 반복된다면, 반복되는 부분을 묶어 이름을 붙이고 달라지는 부분만 넘기면 된다. 그게 함수다.

```python
# 정의
def say_name(name):     # name = 매개변수(parameter)
    print(f"제 이름은 {name}입니다.")

# 호출
say_name('박수연')       # '박수연' = 인자(argument)
```

`def`를 만났을 때는 "이런 함수가 있구나" 하고 기억만 하고, 실제로 실행되는 건 호출했을 때다.

함수도 데이터 타입이라는 점이 신기했다.

```python
print(type(say_name))  # <class 'function'>
uuu = say_name         # 괄호 없이 = 함수 자체를 대입
uuu('최홍묵')           # 같은 함수가 실행된다
```

**괄호가 있으면 실행, 없으면 그 함수 자체**라는 구분이 앞으로 중요하다고 한다.

## positional과 keyword argument
```python
def say_hello(name, age):
    ...

say_hello("박지원", 30)           # positional: 정의된 순서대로
say_hello(age=28, name='김정준')  # keyword: 이름을 쓰면 순서를 바꿔도 된다
say_hello('이희본', age=39)       # 섞어 쓰기: positional 이 먼저

say_hello(28, '김정준')           # 에러는 안 나지만 name=28 이 된다
```

마지막처럼 순서를 착각해도 에러가 안 나는 게 더 무섭다. 인자가 많아지면 keyword로 넘기는 게 안전할 것 같다.

## return
`return`을 만나면 거기서 함수가 끝난다. 이 성질을 조건에 걸리면 바로 빠져나오는 데 쓸 수 있다.

```python
stopword_list = ['바보', '멍충이']

def register_comment(comment):
    for stopword in stopword_list:
        if stopword in comment:
            print('등록 불가 댓글')
            return             # 더 볼 필요 없이 종료
    print('댓글 등록 진행 합니다')
```

`return`이 없으면 `None`을 돌려준다. 지난번에 본 "`append()`가 `None`을 돌려준다"가 바로 이것이었다.

## 리턴값은 하나다
```python
def sum_and_mul(a, b):
    return a + b, a * b      # 콤마 → tuple 하나

result = sum_and_mul(4, 3)
print(result, type(result))  # (7, 12) <class 'tuple'>

s, m = sum_and_mul(30, 40)   # unpacking 으로 받기
```

리턴값이 여러 개처럼 보이지만, 실제로는 **tuple 하나를 돌려주는 것**이다. "콤마가 tuple을 만든다"는 게 여기서 다시 쓰였다.

## 매개변수 검증과 기본값
```python
def get_name(animal):
    name = animal and animal.get('name')  # animal 이 None 이면 뒤를 안 본다
    return name or '이름이 없는 동물'        # 없으면 기본값
```

그저께 배운 SCE로 `None`이 들어왔을 때 에러가 나는 것을 막을 수 있다.

기본값이 있는 매개변수는 생략할 수 있고, 뒤쪽에 몰아서 써야 한다.

```python
def say_myself(name, old, gender='M'):
    print({'M': '남자입니다', 'F': "여자입니다"}[gender])

say_myself('홍길동', 25)  # gender 생략 → 'M'
```

기본값으로 list나 dict를 쓰면 안 된다고 한다. 기본값은 함수를 정의할 때 딱 한 번만 만들어져서, 호출할 때마다 같은 리스트를 계속 공유하기 때문이다. 이럴 때는 `def f(items=None):`으로 두고 함수 안에서 새로 만든다.

## *args와 **kwargs (packing)
몇 개가 올지 모르는 인자를 모아서 받을 수 있다.

```python
def var_args(*args):        # 위치 인자들을 tuple로 모은다
    print(type(args), args)

var_args(10, 20, 30)        # <class 'tuple'> (10, 20, 30)

def func_kwargs(**kwargs):  # 키워드 인자들을 dict로 모은다
    print(type(kwargs), kwargs)

func_kwargs(name='John', age=32)  # <class 'dict'> {'name': 'John', 'age': 32}
```

둘 다 쓸 때는 `*args`가 먼저, `**kwargs`가 나중이다. 이름은 관례일 뿐이고 진짜 문법은 `*`와 `**`다.

## unpacking으로 넘기기
호출할 때 `*`, `**`를 붙이면 반대로 **풀어서** 넘긴다.

```python
def print_val(kor, eng, math): ...

score = [11, 22, 33]
print_val(*score)    # print_val(11, 22, 33) 과 같다

student = {"name": "Sam", "email": "sam@mail.com"}
def print_dict(name, email): ...
print_dict(**student)  # print_dict(name="Sam", email="sam@mail.com")
```

**정의에서의 `*`는 모으기, 호출에서의 `*`는 풀기**라서 방향이 반대다.

둘을 합치면 받은 인자를 그대로 전달하는 함수를 만들 수 있다.

```python
def log(*args, **kwargs):   # 모아서 받고
    print(*args, **kwargs)  # 그대로 풀어서 넘긴다

log(1, 2, 4, end=' ', sep='🐹')
```

이 형태가 나중에 데코레이터를 배울 때 핵심 도구가 된다고 한다.

## keyword-only argument
정의에 `*`만 홀로 쓰면, 그 뒤 매개변수는 반드시 이름을 붙여서 넘겨야 한다.

```python
def print_dict(idx, *, name, email):
    print(idx, name, email)

print_dict(10, name="hone", email="hhh@mail.com")  # 된다
# print_dict(10, "hone", "hhh@mail.com")           # 에러
```

위의 `say_hello(28, '김정준')` 같은 순서 착각을 문법으로 막기 위한 장치라고 이해했다.

## 재귀호출
함수가 자기 자신을 부르는 것을 재귀호출이라고 한다.

```python
def factorial(n):
    if n == 0: return 1           # 종료 조건 (base case)
    return n * factorial(n - 1)   # 자기 자신 호출
```

```
factorial(4)
  → 4 × factorial(3)
        → 3 × factorial(2)
              → 2 × factorial(1)
                    → 1 × factorial(0)
                          → 1   ← 종료 조건에서 멈춘다
```

`n! = n × (n-1)!`이라는 수학 정의를 그대로 코드로 옮긴 셈이다. 종료 조건이 없으면 끝없이 자기를 불러서 `RecursionError`가 난다. 그래서 재귀는 **종료 조건부터 쓰는** 습관을 들여야 할 것 같다.

디버거의 호출 스택(call stack)을 보면 재귀 호출이 쌓였다가 풀리는 것을 눈으로 볼 수 있다.

## 내장 함수
`abs()`, `min()`, `max()`, `sum()`, `divmod()`, `len()`, `sorted()`처럼 `import` 없이 바로 쓰는 함수들이다.

```python
quotient, remainder = divmod(10, 3)  # (3, 1)

sum = 10 + 20          # 내장 sum 을 변수로 덮어쓰면
# print(sum([10, 20])) # TypeError: 'int' object is not callable
```

`list`, `str`, `dict`, `max`, `min`, `type` 같은 이름은 변수 이름으로 쓰지 말아야 한다.

## 함수 연습
마지막에는 원 둘레, 원 면적, 사각형 넓이, 직각삼각형 빗변을 구하는 함수를 직접 만들어봤다.

```python
import math

def circle_circumference(radius):
    return radius * 2 * math.pi

def circle_area(radius):
    return (radius ** 2) * math.pi

def quadrangle_hypotenuse(bottom, height):
    return math.sqrt((bottom ** 2) + (height ** 2))

def circle_circumference_area(radius):   # 둘레와 면적을 한 번에
    return circle_circumference(radius), circle_area(radius)
```

마지막 함수는 함수 안에서 다른 함수를 호출하고, tuple로 두 값을 리턴한다. 오늘 배운 두 가지가 한 줄에 들어 있다.

## 오늘 배운 내용 정리
오늘은 comprehension과 함수를 배웠다.

```
comprehension: [표현식 for 항목 in iterable if 조건]
if 위치: for 뒤는 거르기, for 앞(if~else)은 값 고르기.
set / dict comprehension: { } 로 감싸면 set, {k: v ...} 면 dict.
함수: def 로 정의하고, 호출해야 실행된다. 괄호가 없으면 함수 자체.
return: 만나면 함수 종료. 없으면 None. 여러 값은 tuple 하나.
기본값: 뒤쪽에 둔다. list / dict 를 기본값으로 쓰지 않는다.
*args / **kwargs: 정의에서는 모으기(packing), 호출에서는 풀기(unpacking).
재귀: 종료 조건부터 쓴다.
```

같은 일을 for문과 comprehension 두 가지로 써봤는데, comprehension이 의도가 한 줄에 드러나서 읽기 편했다.

`*`가 정의에서는 모으고 호출에서는 푼다는 부분이 아직 헷갈려서, 직접 함수를 몇 개 만들어보면서 익숙해져야 할 것 같다.

---
