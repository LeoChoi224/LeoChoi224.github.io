---
layout: single
title: "Python 기초 정리 3 - input()과 list, tuple, set, dict"
categories: [coding, Python]
tag: [study-log, Python, input, list, slicing, tuple, unpacking, set, dict]
toc: true
author_profile: false
sidebar:
    nav: "docs"
search: true
---
<hr/>

오늘은 사용자에게 값을 입력받는 `input()`과, 값을 여러 개 담는 집합 자료형 네 가지(list, tuple, set, dict)를 하루에 전부 배웠다.

진도가 꽤 빨라서 처음에는 네 가지가 다 비슷해 보였는데, 정리하면서 보니 **순서가 있는지, 중복을 허용하는지, 값을 바꿀 수 있는지**로 구분하면 된다는 것을 알게 됐다.

## input()은 무조건 문자열을 준다
지금까지는 `a = 10`처럼 값을 코드에 직접 써넣었다. 그러면 다른 값으로 실행해보려면 코드를 고쳐야 한다.

실행할 때마다 다른 값을 받으려면 `input()`을 쓴다.

```python
a = input()
print('입력하신 값은', a)
print(int(a) + 100)  # 계산하려면 int() 가 필요하다
```

여기서 중요한 점은 **`input()`은 사용자가 무엇을 입력하든 문자열로 돌려준다**는 것이다. 키보드는 글자만 보내기 때문에 `100`을 입력해도 파이썬이 받는 값은 `"100"`이다.

```python
a = input()   # 5 입력
print(a + 5)  # TypeError
print(a * 3)  # "555"  에러 없이 엉뚱하게 동작한다
```

두 번째 경우가 더 위험하다고 느꼈다. 에러가 나지 않고 틀린 결과가 그대로 나오기 때문이다.

그래서 숫자로 쓸 값은 **받자마자 바로 변환**하는 습관을 들이는 게 좋다.

```python
num1 = int(input())
height = float(input("키를 입력하세요 cm : "))  # 괄호 안 글자는 입력 커서 앞에 찍힌다
print(f"입력한 키는 {height / 100:.1f}m")
```

한 번에 여러 개를 받으려면 `.split()`으로 쪼갠다.

```python
a, b, c = input("3개 입력하세요").split()
print(f"a={a}, b={b}, c={c}")
```

`.split()`은 공백을 기준으로 문자열을 잘라 리스트를 만든다. 입력한 개수와 변수 개수가 다르면 `ValueError`가 난다.

## 집합 자료형 한눈에 보기
네 가지를 먼저 표로 정리해두면 헷갈리지 않는다.

| 타입 | 순서 | 중복 | 값 변경 | 만드는 법 |
|---|---|---|---|---|
| list | 있음 | 허용 | 가능 (mutable) | `[ ]` |
| tuple | 있음 | 허용 | 불가 (immutable) | `( )` 또는 콤마 |
| set | 없음 | 불가 | 가능 | `{ }` 또는 `set()` |
| dict | 넣은 순서 유지 | key 중복 불가 | 가능 | `{key: value}` |

**mutable / immutable**은 만든 뒤에 내용을 바꿀 수 있는지를 뜻한다.

## list
list는 **순서가 있고 바꿀 수 있는** 값들의 묶음이다.

```python
animals = ['dog', 'cat', 'bird', 'fish']
print(animals[0])    # dog   인덱스는 0부터
print(animals[-1])   # fish  음수는 뒤에서부터
# print(animals[4])  # IndexError

animals[2] = 'mouse'  # 값을 바꿀 수 있다
print(len(animals))   # 4
```

인덱스가 0부터 시작하는 이유는 "첫 원소로부터 얼마나 떨어져 있는가(offset)"를 뜻하기 때문이라고 한다. 첫 원소는 0칸 떨어져 있다.

### 슬라이싱
`[시작:끝:step]`으로 일부를 잘라낸다. 여기서 **끝은 포함되지 않는다.**

```python
animals[0:3]    # 0번부터 3번 '전'까지
animals[:2]     # 처음부터
animals[2:]     # 2부터 끝까지
animals[-2:]    # 뒤에서 2개
animals[:]      # 전체 (복사본)
animals[0:100]  # 범위를 넘어가도 에러가 안 난다

my_list = [0,1,2,3,4,5,6,7,8,9,10]
my_list[1:7:2]  # [1, 3, 5]
my_list[::-1]   # 뒤집기
```

인덱스를 칸이 아니라 **칸 사이의 틈**이라고 생각하면 이해가 쉬웠다. `0:3`이면 0번 틈부터 3번 틈까지라서 3개가 나온다. `끝 - 시작`이 곧 개수가 된다.

슬라이싱한 자리에 다른 값을 통째로 넣을 수도 있다.

```python
a = [1,2,3,4,5]
a[1:4] = [20,30,40]       # 치환  → [1,20,30,40,5]
a[2:2] = ['루비','이브']    # 삽입 (빈 구간에 끼워 넣기)
a[1:4] = []               # 삭제
```

### 추가, 삭제, 정렬
```python
animals.append('tiger')     # 뒤에 추가
animals.insert(2, 'eagle')  # 2번 자리에 끼워 넣기
animals.remove('bird')      # 값으로 삭제
del(animals[1])             # 위치로 삭제
animals.sort()              # 오름차순, 원본 변경
```

오늘 가장 헷갈렸던 부분은 `sort()`와 `sorted()`의 차이다.

```python
a = ["b","g","a","d"]
print(a.sort())   # None
print(sorted(a))  # ['a','b','d','g']  정렬된 새 리스트
```

`list.sort()`는 **원본을 바꾸고 `None`을 돌려준다.** 반면 `sorted()`는 원본은 그대로 두고 **정렬된 새 리스트**를 돌려준다.

파이썬에는 "원본을 바꾸는 메소드는 `None`을 돌려준다"는 암묵적인 규칙이 있다고 한다. `append()`, `insert()`, `remove()`도 전부 `None`이다.

### 다차원 리스트
```python
data = [
    [1, 2, 3],
    [10, 20, 30],
]
print(data[0])     # [1, 2, 3]
print(data[0][1])  # 2
```

**인덱싱을 하면 차원이 하나 줄어들고, 슬라이싱은 차원이 줄지 않는다**는 규칙을 기억하면 된다.

### 문자열도 같은 방식으로 동작한다
문자열도 순서 있는 묶음이라서 인덱싱과 슬라이싱이 똑같이 된다. 다만 **str은 immutable이라 값을 바꿀 수는 없다.**

```python
dd = "2026-04-10"
year, month, day = dd[:4], dd[5:7], dd[8:]
# dd[0] = '3'  # TypeError

result = "-".join(['dog', 'cat'])  # list → str  'dog-cat'
result.split("-")                  # str → list
```

`join`은 **구분자가 앞에 온다**는 점이 처음에 어색했다. `"구분자".join(리스트)` 순서다.

## tuple
tuple은 **못 바꾸는 묶음**이다. 그리고 tuple을 만드는 것은 괄호가 아니라 **콤마**다.

```python
student = "이민재", "최홍묵", "문태형", 3   # 괄호 없어도 tuple
print(type(student))  # <class 'tuple'>

animals = ("dog")    # 이건 그냥 str
animals = ("dog",)   # 콤마가 있어야 tuple
```

원소가 하나인 tuple은 콤마를 꼭 붙여야 한다는 점이 함정이었다.

```python
student[0]        # 읽기는 된다
# student[0] = 'x'  # TypeError
```

변경되면 안 되는 데이터를 담거나, **여러 값을 묶어서 전달**할 때 쓴다.

### unpacking
묶여 있는 값을 풀어서 여러 변수에 한 번에 담는 것을 unpacking이라고 한다.

```python
a, b, c, d = 1, 2, 3, 4
width, height = [100, 200]
a, b = b, a                    # 어제 배운 swap도 사실 이것이었다
(a1, a2), (b1, b2) = ((10, 20), (30, 40))
```

개수가 안 맞으면 `*`를 붙인 변수가 나머지를 리스트로 받는다.

```python
a, *b, c = [1, 2, 3, 4, 5, 6]
print(a, b, c)  # 1 [2, 3, 4, 5] 6

_, a, _, b = [1, 2, 3, 4]  # 안 쓸 값은 관례적으로 _ 로 받는다
```

## set
set은 **중복이 저절로 사라지는 순서 없는 묶음**이다.

```python
animals = {"dog", "dog", "cat", "bird"}
print(animals)  # {'bird', 'cat', 'dog'}  dog 하나만, 순서도 없다
# animals[0]    # TypeError: 순서가 없어서 인덱싱이 안 된다
```

빈 set을 만들 때 주의해야 한다.

```python
a = {}      # 이건 dict 다
a = set()   # 빈 set은 이렇게 만든다

a.add("박세정")
a.add("박세정")     # 이미 있으면 아무 일도 안 일어난다
a.remove("박세정")

print({1, 2, 3} | {3, 4, 5})  # 합집합 {1, 2, 3, 4, 5}
```

중복 제거는 `list(set(data))`로 많이 한다고 한다. 다만 이렇게 하면 순서는 보장되지 않는다.

## dict
list로 사람 정보를 담으면 `student[1]`이 이메일인지 나이인지 번호만 보고는 알 수 없다. 번호는 의미를 담지 못한다.

dict는 `key: value` 쌍으로 저장해서 **번호가 아니라 이름으로** 값을 꺼낸다.

```python
student = {"name": "최현진", "email": "choi@mail.com"}
print(student['name'])        # 최현진
print(student.get('name'))    # 최현진
```

꺼내는 두 방법의 차이가 중요하다.

```python
# print(student['age'])        # KeyError: 프로그램이 멈춘다
print(student.get('age'))      # None: 조용히 넘어간다
print(student.get('age', 20))  # 20: 없을 때 쓸 기본값
```

수정과 추가는 같은 문법이다.

```python
student['name'] = '이희본'     # 있는 key → 수정
student['address'] = '동탄시'  # 없는 key → 추가
student['nmae'] = '홍길동'     # 오타를 내도 에러 없이 새 key가 생긴다
del(student['email'])
```

오타가 에러 없이 새 key를 만든다는 점은 조심해야 할 것 같다.

key에는 str, int, tuple처럼 **바뀌지 않는(hashable) 값만** 쓸 수 있고, list는 쓸 수 없다. dict는 key를 해시값으로 바꿔 저장 위치를 정하는데, 내용이 바뀌는 list는 해시값도 달라져서 값을 다시 찾을 수 없기 때문이라고 한다.

```python
print(student.keys())    # key 목록
print(student.values())  # value 목록
print(student.items())   # (key, value) 튜플 목록

print("name" in student)  # True  in 은 key만 본다
```

## 비어 있으면 거짓
```python
print(bool([]), bool([1]))  # False True
```

`[]`, `""`, `()`, `{}`, `set()`처럼 **비어 있으면 거짓, 뭔가 들어 있으면 참**이다. 조건문에서 다시 나온다고 한다.

## 오늘 배운 내용 정리
오늘은 입력과 집합 자료형 네 가지를 배웠다.

```
input(): 무엇을 입력하든 문자열을 준다. 숫자로 쓸 값은 받자마자 변환한다.
list: 순서 O, 중복 O, 변경 O. 인덱싱·슬라이싱([시작:끝:step], 끝은 미포함).
sort() vs sorted(): 원본을 바꾸고 None / 원본 유지하고 새 리스트.
tuple: 콤마로 만드는 못 바꾸는 묶음. unpacking, *나머지.
set: 순서 X, 중복 X. 빈 set은 set(). {} 는 dict.
dict: key로 꺼낸다. d['key'] 는 KeyError, d.get('key', 기본값) 은 안전.
bool: 비어 있으면 False, 뭔가 있으면 True.
```

하루에 자료형을 네 개나 배워서 양이 많았지만, 표로 정리하고 나니 각자 왜 필요한지 조금 보이는 것 같다.

특히 슬라이싱과 dict는 앞으로 계속 쓰게 될 것 같아서 손에 익을 때까지 연습해야 할 것 같다.

---
