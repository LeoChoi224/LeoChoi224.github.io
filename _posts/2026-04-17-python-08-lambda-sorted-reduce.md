---
layout: single
title: "Python 기초 정리 8 - lambda, map, filter, sorted, reduce"
categories: [coding, Python]
tag: [study-log, Python, lambda, map, filter, sorted, reduce, callback, generator-expression]
toc: true
author_profile: false
sidebar:
    nav: "docs"
search: true
---
<hr/>

함수를 배울 때 "함수도 값이다"라는 말이 나왔는데, 오늘은 그 성질을 이용해서 **함수를 다른 함수에 넘기는** 방법을 배웠다.

이름 없는 함수 `lambda`, 묶음 전체에 같은 일을 적용하는 `map`과 `filter`, 정렬 기준을 바꾸는 `sorted`의 `key=`, 그리고 여러 개를 하나로 접는 `reduce`까지 배웠고, 그저께 for문으로 풀었던 문자열 문제를 reduce로 다시 풀었다.

## 함수는 값이다
```python
uuu = say_anthem          # 괄호 없이 = 함수 자체를 대입
uuu()                     # 실행
print(type(say_anthem))   # <class 'function'>
```

변수에 담을 수 있고, 다른 함수에 인자로 넘길 수 있고, 함수가 돌려줄 수도 있는 것을 **일급 객체(first-class object)**라고 한다. 파이썬의 함수가 바로 그렇다.

## 콜백
리스트의 각 원소를 제곱하는 함수와 절댓값으로 바꾸는 함수를 따로 만들면, 나머지는 전부 같고 딱 한 줄만 다르다.

```python
def get_square_list(numbers):
    result = []
    for number in numbers:
        result.append(number ** 2)   # 이 한 줄만 다르다
    return result
```

달라지는 부분이 **동작 자체**라면, 그 동작을 함수로 넘기면 된다.

```python
def square(x):   return x ** 2
def absolute(x): return x if x >= 0 else -x

def apply_func_to_list(numbers, func):   # func 은 함수를 받는 매개변수
    return [func(number) for number in numbers]

print(apply_func_to_list([3, -2, 7], square))    # 괄호 없이 함수 자체를 넘긴다
print(apply_func_to_list([3, -2, 7], absolute))
```

이렇게 매개변수로 받아서 안에서 호출하는 함수를 **콜백(callback)**이라고 한다. `square`는 함수 자체이고, `square()`는 지금 실행한 결과라는 차이가 여기서 중요하다.

## lambda
한 번 쓰고 말 함수인데 매번 `def`로 이름까지 붙이기는 번거롭다. 그럴 때 이름 없는 함수 `lambda`를 쓴다.

```python
f1 = lambda x: x * 2
print(f1(2), f1(3))                   # 4 6

print((lambda x: x * 10)(100))        # 만들자마자 호출
print((lambda x, y: x + y)(23, 400))  # 423

apply_func_to_list([3, -2, 7], lambda x: x ** 2)
```

`lambda 매개변수: 식` 형태이고, `return`을 쓰지 않는다. `:` 뒤의 **식 하나가 곧 리턴값**이라서 여러 문장을 쓸 수는 없다. 여러 줄이 필요하면 그냥 `def`를 쓰면 된다.

## map
`map(함수, iterable)`은 모든 원소에 함수를 적용한다. 개수는 그대로다(N개 → N개).

```python
m = map(square, [1, 2, 3])
print(m)        # <map object at 0x...>  리스트가 아니다
print(list(m))  # [1, 4, 9]

list(map(str.upper, "apple"))            # 메소드도 함수다
list(map(float, "1.2 2.5 3.7".split()))  # 내장 함수도 그대로 넘긴다
```

`map()`의 결과는 리스트가 아니라 map 객체라서 `list()`로 감싸야 눈으로 볼 수 있다. 그리고 map 객체는 **한 번 쓰면 소진된다.** 두 번째로 `list(m)`을 하면 빈 리스트가 나온다.

드디어 입력을 여러 개 받아서 한 번에 숫자로 바꾸는 형태를 이해했다.

```python
a, b, c = map(int, input().split())
```

공백이 섞인 데이터를 가공할 때는 `strip()`을 먼저 해야 한다. `" 200 ".isdigit()`은 공백 때문에 `False`가 나오기 때문이다.

```python
data2 = "  200 , 400  , 700, hello"
list(map(
    lambda x: int(x) if x.strip().isdigit() else x.strip(),
    data2.split(",")
))  # [200, 400, 700, 'hello']
```

## filter
`filter(함수, iterable)`는 함수의 결과가 참인 것만 남긴다. 개수가 줄어든다(N개 → N'개).

```python
data = [3, 7, 9, 8]
list(filter(lambda x: x % 3 == 0, data))  # [3, 9]
```

map과 나란히 보면 차이가 확실하다.

```python
data = [1, -2, 3, -4, 5]
list(filter(lambda x: x > 0, data))  # [1, 3, 5]  걸러낸다
list(map(lambda x: x > 0, data))     # [True, False, True, False, True]  변환한다
```

## 같은 일을 세 가지 방법으로
"양수만 제곱하기"를 세 가지로 해봤다.

```python
data = [1, -2, 3, -4, 5]

# 1. for 문
result = []
for d in data:
    if d > 0: result.append(d ** 2)

# 2. filter + map
list(map(lambda x: x ** 2, filter(lambda x: x > 0, data)))

# 3. list comprehension
[x ** 2 for x in data if x > 0]
```

셋 다 `[1, 9, 25]`다. 파이썬에서는 3번이 가장 권장된다고 한다. map과 filter는 다른 사람의 코드나 데이터 처리 코드에 자주 나오니 읽을 줄 알아야 한다.

## all()과 any(), generator expression
```python
any([False, False, True])  # True   하나라도 참이면
all([True, True, {}])      # False  전부 참이어야 (빈 dict 는 거짓)

numbers = [1, -2, 4, -4, 5]
all(map(lambda n: n % 2 == 0, numbers))  # 전부 짝수인가 → False
any(n % 2 == 0 for n in numbers)         # 하나라도 짝수인가 → True
```

마지막 줄처럼 `sum()`, `max()`, `any()`, `join()` 같은 함수에는 comprehension의 대괄호를 생략할 수 있다. 이걸 **generator expression**이라고 한다.

```python
orders = [{"item": "Laptop", "price": 1200}, {"item": "Mouse", "price": 25}]
sum(order['price'] for order in orders)
" | ".join(order['item'] for order in orders)
```

`[...]`는 리스트를 통째로 만들어서 넘기지만, generator expression은 값을 하나씩 만들어서 흘려보내서 메모리를 거의 안 쓴다고 한다.

## sorted와 key=
```python
dataset = [5, 4, 2, 8, 1]
print(dataset.sort())   # None  원본이 바뀐다
print(sorted(dataset))  # 새 리스트, 원본은 그대로
```

숫자나 글자는 크기 비교가 당연하지만, dict끼리는 누가 더 큰지 정의가 없어서 `sorted(data)`를 하면 `TypeError`가 난다. 이름순인지 나이순인지는 사람이 정해야 하는데, 그걸 정하는 방법이 `key=`다.

**`key`에 넘기는 함수는 원소 하나를 받아서 비교에 쓸 값 하나를 돌려주는 함수**다.

```python
dataset = [('c', 400), ('a', 300), ('b', 100)]
dataset.sort()                                        # 첫 원소 기준
dataset.sort(key=lambda item: item[1])                # 두 번째 원소 기준
dataset.sort(key=lambda item: item[1], reverse=True)  # 내림차순
```

정렬에 쓰이는 건 key 함수의 결과지만, 결과 리스트에 담기는 건 원래 원소다.

dict는 `items()`로 꺼내서 정렬한다.

```python
a_dict = {"b": 5, "c": 3, "a": 2}
sorted(a_dict)                                               # ['a', 'b', 'c'] key 만
sorted(a_dict.items(), key=lambda x: x[1], reverse=True)    # value 큰 순
```

dict 리스트는 원하는 필드를 기준으로 정렬할 수 있고, key 함수 안에서 계산을 해도 된다.

```python
data = [
    {'name': 'James', 'age': 34, 'score': [100, 89, 88]},
    {'name': 'Amy',   'age': 41, 'score': [56, 13, 97]},
]
sorted(data, key=lambda x: x['age'])                              # 나이순
sorted(data, key=lambda x: sum(x['score']) / len(x['score']))    # 평균순
```

데이터에 평균이라는 값이 없어도, 그 자리에서 계산해서 정렬 기준으로 쓸 수 있다는 점이 편했다.

참고로 `sorted(iterable, /, *, key=None, reverse=False)`에서 `*` 뒤는 keyword-only라서 `key=`를 꼭 써야 한다. `sorted(data, lambda x: x[1])`은 에러다.

## reduce

| 함수 | 개수 변화 | 하는 일 |
|---|---|---|
| map | N → N | 전부 변환 |
| filter | N → N' | 참인 것만 남김 |
| reduce | N → 1 | 집계 (합계, 최댓값, 누적) |

`reduce`는 map, filter와 달리 내장 함수가 아니라서 `functools`에서 가져와야 한다.

```python
from functools import reduce

reduce(lambda x, y: x + y, [1, 2, 3, 4, 5])  # 15
```

```
[ 1,  2,  3,  4,  5 ]
 add(1, 2)  → 3
 add(3, 3)  → 6
 add(6, 4)  → 10
 add(10, 5) → 15
```

앞에서 나온 결과와 다음 원소를 계속 합쳐서 하나만 남을 때까지 줄인다. 넘기는 함수는 **매개변수가 2개(누적값, 다음 원소)**여야 한다.

## initializer와 or 관용구
세 번째 인자로 초기값을 주면 그게 첫 누적값이 되고, **결과의 타입을 바꿀 수 있다.**

```python
reduce(lambda x, y: x + y, [1, 2, 3, 4, 5], 100)  # 115

def func(a, b):     # a: 누적 리스트, b: 다음 숫자
    a.append(b ** 2)
    return a

reduce(func, [1, 2, 3], [])  # [1, 4, 9]
```

초기값을 주지 않으면 첫 원소인 `1`이 누적값이 돼서 `1.append(...)`가 되고 `AttributeError`가 난다.

이걸 lambda로 쓰려면 문제가 있다. `a.append()`는 `None`을 돌려주기 때문이다. 여기서 지난주에 배운 SCE가 나온다.

```python
reduce(lambda a, b: a.append(b ** 2) or a, [1, 2, 3], [])  # [1, 4, 9]
```

`a.append(...)`가 `None`(거짓)이라 `or`가 오른쪽의 `a`를 돌려준다. **`X or a`는 X를 실행하고 a를 돌려준다**는 관용구다. SCE를 배울 때 "나중에 계속 나온다"고 했던 게 이것이었다.

개수 세기도 reduce로 할 수 있다.

```python
dataset = ["dog", "dog", "dog", "cat", "cat", "bird"]
reduce(
    lambda r, e: r.update({e: r.get(e, 0) + 1}) or r,
    dataset,
    {}       # 초기값이 dict → 결과도 dict
)  # {'dog': 3, 'cat': 2, 'bird': 1}
```

`get()` 기본값, `update()`가 `None`을 돌려주는 것, SCE, 초기값까지 지금까지 배운 것이 한 줄에 다 들어 있다.

## 문자열 연습 과제를 reduce로
그저께 for문으로 풀었던 문제를 reduce로 다시 풀었다.

```python
# 가장 긴 단어
def longestWord(sentence):
    return reduce(
        lambda a, b: a if len(a) > len(b) else b,
        sentence.strip().split(),
    )

# 연속 중복 제거
def uniqueInOrder(sentence):
    return reduce(
        lambda lst, ch: lst if lst and lst[-1] == ch else (lst.append(ch) or lst),
        sentence,
        []
    )
```

`uniqueInOrder`에서 `lst and lst[-1] == ch`는 리스트가 비어 있으면 뒤를 보지 않는다. 그렇지 않으면 첫 글자에서 `lst[-1]`이 `IndexError`를 낸다. SCE를 안전장치로 쓴 경우다.

다만 실무에서는 합계는 `sum()`, 최댓값은 `max()`, 개수 세기는 `collections.Counter`가 있어서 reduce를 쓸 일이 많지 않다고 한다. `... or a` 관용구도 읽기 어렵기 때문에, 이번 과제는 SCE와 reduce를 이해했는지 확인하는 연습이라고 받아들였다.

그래도 "앞의 결과에 다음 것을 합친다"는 개념은 대용량 데이터 처리의 MapReduce나, LangChain에서 AI의 답과 새 내용을 합쳐서 다시 질문하는 패턴과 같은 모양이라고 해서 기억해두려고 한다.

## 오늘 배운 내용 정리
오늘은 함수를 값처럼 주고받는 방법들을 배웠다.

```
일급 객체: 함수는 변수에 담고, 인자로 넘기고, 리턴할 수 있다.
콜백: 매개변수로 받아서 안에서 호출하는 함수. 넘길 때 괄호를 붙이지 않는다.
lambda: lambda 매개변수: 식. return 없이 식 하나가 리턴값.
map: N → N 변환. 결과는 map 객체이고 한 번 쓰면 소진된다.
filter: 참인 것만 남긴다.
generator expression: sum(x for x in data) 처럼 대괄호 없이.
sorted(key=): 원소에서 비교할 값을 꺼내는 함수. key= 를 꼭 써야 한다.
reduce: N → 1. from functools import reduce. 초기값이 결과 타입을 정한다.
X or a: append / update 처럼 None 을 돌려주는 동작을 하고 a 를 돌려받는 관용구.
```

같은 문제를 for문, comprehension, map/filter, reduce로 여러 번 풀어보니 각자 어떤 상황에 맞는지 조금 보이는 것 같다.

특히 `sorted(d.items(), key=lambda x: x[1], reverse=True)`는 자주 쓸 것 같아서 손에 익혀두려고 한다.

---
