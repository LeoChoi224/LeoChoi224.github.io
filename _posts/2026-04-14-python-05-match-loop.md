---
layout: single
title: "Python 기초 정리 5 - match~case, while, for"
categories: [coding, Python]
tag: [study-log, Python, match-case, while, for, range, enumerate, zip, break, continue]
toc: true
author_profile: false
sidebar:
    nav: "docs"
search: true
---
<hr/>

어제는 흐름을 갈라놓는 조건문 `if`를 배웠고, 오늘은 조건문의 또 다른 형태인 `match~case`와, 같은 일을 되풀이하는 순환문 `while`, `for`를 배웠다.

특히 파이썬의 `for`가 C나 Java의 `for`와 생각보다 많이 다르다는 점이 인상 깊었다. 오늘 배운 내용을 기준으로 정리해보려고 한다.

## match~case
`match~case`는 값 하나를 여러 경우와 맞춰보는 문법이다. 파이썬 3.10부터 생긴 문법이라서, 검색하면 "파이썬에는 switch가 없다"는 오래된 글이 많이 나온다고 한다.

```python
n = 2
match n:
    case 1: print('월요일')
    case 2: print('화요일')   # 여기가 실행되고 match 종료
    case 3: print('수요일')
    case _: print('기타 요일') # 무엇이든 매칭 (else 역할)
```

위에서부터 차례로 맞춰보고, **처음 맞는 블록 하나만** 실행한다. 아무것도 맞지 않으면 에러 없이 그냥 지나간다.

`case _:`는 와일드카드로, 마지막 case에만 쓸 수 있다. 중간에 쓰면 그 뒤의 case가 영영 실행되지 않기 때문이다.

여러 값은 `|`로 묶을 수 있다.

```python
match command:
    case "start" | "run": print("시작합니다")
    case "stop" | "end":  print("종료합니다")
    case _:               print("알 수 없는 명령")
```

## 구조적 패턴 매칭
`match~case`의 공식 이름은 **구조적 패턴 매칭(Structural Pattern Matching)**이다. 값만 비교하는 게 아니라 **데이터의 모양**까지 맞춰볼 수 있다.

```python
point = (-4, 10)

match point:
    case (0, 0): print('원점')
    case (0, y): print(f'y축 위 (y={y})')
    case (x, 0): print(f'x축 위 (x={x})')
    case (x, y): print(f'좌표: ({x}, {y})')
```

여기서 처음에 가장 헷갈렸던 부분은 `case (0, y)`의 `y`였다. 이건 "y와 같은지 비교"하는 게 아니라 **"그 자리의 값을 y라는 이름으로 받아라"**는 뜻이다.

```
0 처럼 값을 쓰면       → 비교
y 처럼 변수 이름을 쓰면 → 담기(binding)
```

그 전에 배운 tuple의 unpacking이 조건 분기와 합쳐진 것이라고 이해했다.

`case`에 `if`를 붙여서 추가 조건(가드)을 걸 수도 있고, dict의 구조도 맞춰볼 수 있다.

```python
match number:
    case n if n % 2 == 0: print(n, "짝수")
    case n if n % 2 == 1: print(n, "홀수")

user = {"id": 1, "name": "Alice"}
match user:
    case {"id": 1, "name": name}:
        print(f'id 1:{name} 유저 발견!')
    case {"id": user_id, "name": _}:
        print(f'id={user_id} 인 다른 유저')
```

조건이 서로 다른 성격이면 `if~elif`, 한 값을 여러 경우와 맞춰보거나 데이터 모양에 따라 갈라져야 하면 `match`를 쓰는 것이 좋다고 한다.

## while
`while`은 조건이 **참인 동안** 블록을 되풀이한다.

```python
num = 0
while num < 5:
    print(num)  # 0 1 2 3 4
    num += 1    # 이게 없으면 무한 루프
print('종료 num =', num)  # 5
```

조건을 거짓으로 만드는 코드를 블록 안에 넣지 않으면 영원히 돈다. 무한 루프가 되면 터미널에서 `Ctrl + C`로 강제 종료할 수 있다.

### 순환문을 볼 때 확인할 세 가지
강사님이 강조하신 점검표다.

```
1. 몇 번 순환하는가?                  → 5번
2. 순환하는 동안 변수 값의 범위는?      → num 이 0부터 4까지
3. 순환문이 끝났을 때 변수 값은?        → num 은 5
```

3번이 특히 중요하다고 하셨다. 루프가 끝난 뒤의 `num`은 마지막으로 출력한 4가 아니라 **조건을 깬 값인 5**다.

### 중첩 while과 구구단
```python
i = 1
while i <= 9:
    j = 1          # 단이 바뀔 때마다 j 를 다시 1로
    while j <= 9:
        print(f'{i} x {j} = {i * j}')
        j += 1
    print()
    i += 1
```

안쪽 변수 `j = 1`을 바깥 루프 **안에** 둬야 한다. 밖에 두면 첫 단만 돌고 끝난다.

### break와 continue
```python
n = 1
while True:            # 일단 무한히 돌리고
    print(n, end=" ")
    if n == 100: break  # 안에서 끝낸다
    n += 1
```

`break`는 자기를 감싼 가장 가까운 순환문 하나만 종료한다. `while True:` 안에서 `break`로 끝내는 패턴은 입력을 계속 받다가 특정 값이 오면 끝내는 프로그램에 많이 쓴다고 한다.

`continue`는 이번 회차만 건너뛰고 순환문 맨 위로 돌아간다.

```python
num = 1
while num <= 10:
    num += 1           # 증가를 먼저!
    if num % 2 == 1:
        continue       # 홀수면 아래를 건너뛴다
    print(num)
```

여기서 증가 코드가 `continue` 아래에 있으면, 값이 늘어나지 않은 채로 계속 같은 자리를 돌아서 무한 루프가 된다. 수업 코드에도 이 실수를 주석으로 남겨두셨다.

## for
파이썬의 `for`는 숫자를 세는 문법이 아니라 **iterable에서 하나씩 꺼내는** 문법이다. iterable은 list, tuple, str, set, dict, range처럼 하나씩 꺼낼 수 있는 것을 말한다.

`while`로 리스트를 돌면 인덱스 변수를 만들고, 범위를 재고, 증가시키는 코드가 정작 하고 싶은 일보다 더 많아진다. `for`를 쓰면 그 부분이 전부 사라진다.

```python
animals = ["dog", "cat", "bird"]
for animal in animals:
    print('I love', animal)

for ch in "Hello":
    print(ch, end=',')
```

### range()
숫자를 세고 싶으면 숫자가 든 묶음인 `range()`를 만들어서 꺼낸다.

```python
for i in range(3):          # 0, 1, 2
for i in range(5, 8):       # 5, 6, 7
for i in range(4, 15, 3):   # 4, 7, 10, 13
for i in range(10, 0, -2):  # 10, 8, 6, 4, 2
```

슬라이싱처럼 **끝은 포함되지 않는다.** 그래서 `range(n)`은 정확히 n번 돈다.

`range()`는 리스트를 미리 만들지 않고 다음 숫자를 그때그때 계산해서 준다. `range(100000000)`을 리스트로 만들면 메모리가 터지기 때문이라고 한다.

```python
for i in range(2, 10):
    for j in range(1, 10):
        print(f'{i} x {j} = {i * j}')
    print()
```

`while` 버전의 구구단과 비교해보면 `j = 1` 초기화와 `j += 1` 증가가 통째로 사라졌다.

### 새 리스트 만들기
```python
data = [11, 22, 33, 44]

result = []
for d in data:
    if d % 2 == 0:
        result.append(d)
print(result)  # [22, 44]
```

**빈 리스트 만들기 → 돌면서 → append** 세 단계가 기본형이다. 내일 배울 comprehension은 이걸 한 줄로 줄인 것이라고 한다.

### dict 순회
```python
my_dict = {'name': 'hong', 'age': 24, 'grade': 4}

for key in my_dict:            # key 만 나온다
    print(key, ':', my_dict[key])

for key, value in my_dict.items():  # (key, value) 를 unpacking
    print(key, ':', value)
```

`for x in dict:`는 **key만** 준다는 점을 기억해야 한다. `items()`가 (key, value) 튜플을 주기 때문에 unpacking으로 받는 것이 정석이다.

### enumerate()와 zip()
몇 번째인지도 알아야 할 때는 `range(len(...))` 대신 `enumerate()`를 쓴다.

```python
for i in range(len(animals)):        # 이렇게 하지 말고
    print(i, animals[i])

for i, animal in enumerate(animals):  # 이렇게
    print(i, animal)
```

`zip()`은 여러 묶음의 같은 자리끼리 짝지어준다.

```python
for x in zip([10,20,30], ['a','b','c'], "김수림"):
    print(x)  # (10,'a','김') (20,'b','수') (30,'c','림')
```

길이가 다르면 짧은 쪽에 맞춰서 끝난다.

## 헷갈리기 쉬운 부분
- `case x:`는 x와 같은지 비교하는 게 아니라 x에 담는 것이라서 항상 매칭된다.
- 중첩 for에서 안팎의 변수 이름을 똑같이 쓰면 바깥 변수가 덮어써진다. `i`, `j`로 나누자.
- 순회 중에 리스트를 고치면 항목을 건너뛴다. 고쳐야 하면 새 리스트를 만든다.
- `while ~ else`, `for ~ else`는 문법은 있지만, 뜻이 "break 없이 끝났을 때 실행"이라 헷갈려서 수업에서는 쓰지 말라고 하셨다.

## 오늘 배운 내용 정리
오늘은 `match~case`와 순환문 `while`, `for`를 배웠다.

```
match~case: 값 하나를 여러 경우와 맞춘다. case _ 는 마지막에만.
구조적 매칭: case (0, y) 의 y 는 비교가 아니라 담기.
while: 조건이 참인 동안 반복. 조건을 거짓으로 만드는 코드가 꼭 필요하다.
순환문 3문답: 몇 번 도는가 / 변수 값의 범위 / 끝났을 때 값.
break / continue: 탈출 / 이번 회차만 건너뛰기. continue 쓸 때 증가 코드 위치 주의.
for: iterable 에서 하나씩 꺼낸다. range(a, b) 는 b 미포함.
dict 순회: for k, v in d.items():
enumerate / zip: 번호와 값을 같이 / 여러 묶음을 짝지어서.
```

반복 횟수를 미리 알 수 있으면 `for`, 언제 끝날지 모르면 `while`을 쓴다고 정리했다.

"순환문 3문답"은 앞으로 반복문을 쓸 때마다 습관처럼 확인해보려고 한다.

---
