---
layout: single
title: "데이터 분석 기초 정리 2 - pandas Series와 DataFrame, 타이타닉 데이터 탐색과 전처리"
categories: [coding, DataAnalysis]
tag: [study-log, DataAnalysis, pandas, Series, DataFrame, loc, iloc, missing-value, one-hot-encoding]
toc: true
author_profile: false
sidebar:
    nav: "docs"
search: true
---
<hr/>

오늘은 pandas를 배웠다. 어제 NumPy 실습에서 가장 답답했던 게 `arr_rating[:, 0]`이 유저인지 영화인지 코드만 봐서는 모른다는 점이었다. 숫자 위치로만 접근하니 코드를 읽어도 뜻을 알 수 없고, 열 순서가 바뀌면 코드가 조용히 망가진다. pandas는 값마다 이름표(index)를 붙여서 이 문제를 없앤다.

먼저 1차원인 Series를 보고, 그다음 2차원 표인 DataFrame으로 타이타닉 데이터를 탐색하고 전처리했다.

## pandas와 정형 데이터
pandas는 행과 열로 된 정형 데이터, 그러니까 엑셀 시트나 DB 테이블 같은 데이터를 다룬다. 대표 객체는 두 개다.

| 객체 | 차원 | 비유 |
|---|---|---|
| Series | 1차원 | 엑셀의 한 열 |
| DataFrame | 2차원 | 엑셀의 시트 전체 |

DataFrame은 Series를 옆으로 여러 개 붙여놓은 것이라 Series를 이해하면 절반은 끝난다. 그리고 Series는 NumPy 배열을 속에 품고 겉에 index를 씌운 것이다.

```python
s.values   # array([10, 20, 30])   ← 속은 진짜 ndarray다
s.index    # RangeIndex(start=0, stop=3, step=1)
```

그래서 어제 배운 shape, dtype, boolean mask, 브로드캐스팅이 대부분 그대로 통하고, 새로 배우는 건 "index가 붙으면 뭐가 달라지는가"뿐이다.

## Series - 값에 이름표를 붙인 1차원 배열
### 만들기

```python
import numpy as np
import pandas as pd

s1 = pd.Series([10, 20, 30])
# 0    10
# 1    20
# 2    30
# dtype: int64
```

왼쪽이 index, 오른쪽이 value, 맨 아래가 dtype이다. index를 안 주면 0부터 붙는다. index는 직접 줄 수 있고 정수가 아니어도 된다.

```python
pd.Series(data=[1, 2, 3], index=[100, 200, 300])
pd.Series([1, 2, 3], ['철수', '영희', '민수'])        # 문자열 index
pd.Series({'철수': 35000, '영희': 67000})              # dict → key가 index
```

dict와 리스트의 중간이라고 보면 된다. dict처럼 이름으로 찾을 수 있고, 리스트처럼 순서와 계산이 있다.

### index가 배열과 다른 세 가지
첫째, index는 중복될 수 있다.

```python
s6 = pd.Series([1, 2, 3], ['john', 'john', 'charlie'])
s6['john']
# john    1
# john    2       ← 값 하나가 아니라 Series가 돌아온다
```

반에 동명이인이 있으면 "john 불러와" 했을 때 두 명이 다 오는 것과 같다. 그래서 인덱싱 결과가 값 하나일지 Series일지 미리 알 수 없고, 이게 나중에 버그의 원인이 된다.

둘째, 없던 index에 대입하면 새로 생긴다.

```python
s7[105]        # KeyError! 읽기는 안 된다
s7[105] = 90   # 쓰기는 된다. 없던 자리가 새로 생긴다
```

NumPy 배열은 크기가 고정이라 없는 자리에 대입하면 에러인데, Series는 dict처럼 늘어난다. 그래서 오타로 `s['nmae'] = 1`을 쓰면 에러 없이 이상한 항목이 하나 늘어난다.

셋째, 대괄호 개수가 결과 타입을 바꾼다. 어제 NumPy의 `x[0]`과 `x[[0]]`과 같은 규칙이다.

```python
s7[102]           # np.int64(2)   ← 값 하나
s7[[102, 104]]    # Series        ← 대괄호 두 겹이면 Series
```

### 이름이냐 순서냐 - loc과 iloc
대괄호 하나만 쓰면 pandas는 이름(label)으로 먼저 찾는다. index가 `[100, 200, 300]`인 Series에서 `s[0]`은 "0번째"가 아니라 "이름이 0인 것"을 찾고, 없으니 `KeyError`가 난다. 이 모호함 때문에 pandas는 이름으로 찾는 `.loc[]`과 순서로 찾는 `.iloc[]`을 따로 두었다.

```python
s.loc[100]    # 이름이 100인 값
s.iloc[0]     # 맨 앞 값
```

문자열 index에서 `s[0]`처럼 대괄호에 정수를 넣어 위치로 쓰는 방식도 최신 pandas에서는 경고가 뜬다. 헷갈릴 일이 없게 `.loc`과 `.iloc`을 쓰는 편이 안전하다.

### 요약 함수 - NaN을 어떻게 대하나

```python
s1 = pd.Series([1, 1, 2, 1, 2, 2, 2, 1, 1, 3, 3, 4, 5, 5, 7, np.nan])   # 16개, 마지막은 NaN

s1.size            # 16    NaN을 포함한 전체 칸 수
len(s1)            # 16
s1.count()         # 15    NaN을 뺀, 값이 실제로 있는 개수
s1.unique()        # [1. 2. 3. 4. 5. 7. nan]   unique는 NaN도 종류로 센다
s1.value_counts()  # 값별 개수 (NaN 제외, 많은 순으로 정렬)
```

`size`는 자리 수, `count()`는 알맹이 수다. 둘의 차이가 곧 결측치 개수다.

그리고 어제 예고됐던 차이가 여기서 나온다.

```python
a1 = np.array([2, 2, 2, 2, np.nan])
a1.mean()               # nan    ← NumPy: 하나라도 없으면 답도 없다
pd.Series(a1).mean()    # 2.0    ← pandas: 없는 건 빼고 계산한다
```

NumPy는 "모르는 게 섞였으니 답도 모름", pandas는 "있는 걸로 일단 계산"이다. pandas 쪽이 편하지만 더 위험하다. 조용히 NaN을 빼고 계산하니 평균을 봐도 그게 몇 명의 평균인지 화면에 안 나온다. 그래서 `mean()`을 쓰기 전에 `count()`를 먼저 찍어보는 습관이 필요하다. 아래 타이타닉 실습에서 정확히 이 함정이 나온다.

참고로 NumPy 2.0부터 대문자 별칭 `np.NaN`이 없어지고 소문자 `np.nan`만 남았다. 인터넷 예제에 `np.NaN`이 보이면 NumPy 1.x 시절 코드라서 `np.nan`으로 바꿔 쓰면 된다.

### Series끼리 연산은 index로 짝을 맞춘다
Series가 배열과 갈라지는 가장 큰 지점이다.

```python
s1 = pd.Series([1, 2, 3, 4], ['a', 'b', 'c', 'd'])
s2 = pd.Series([6, 3, 2, 1], ['d', 'c', 'b', 'a'])    # index 순서가 거꾸로다

s1 + s2
# a     2      1 + 1   ← 'a'끼리
# b     4      2 + 2
# c     6      3 + 3
# d    10      4 + 6
```

두 반의 성적표를 더할 때 줄 순서가 아니라 이름을 보고 같은 사람끼리 더하는 것이다. NumPy였다면 순서대로 `1+6, 2+3, 3+2, 4+1`이 됐을 테니 완전히 다른 결과다.

짝이 없으면 NaN이 된다.

```python
s1['k'] = 7      # s1에만 있는 index
s2['e'] = 9      # s2에만 있는 index
s1 + s2
# a, b, c, d 는 정상
# e    NaN      ← s1에 'e'가 없다
# k    NaN      ← s2에 'k'가 없다
```

정렬을 신경 안 써도 되니 편하지만, index가 살짝 다르면 결과가 조용히 NaN으로 채워진다. 두 Series를 더했는데 NaN이 잔뜩 나오면 값이 틀린 게 아니라 거의 항상 index가 안 맞는 것이다. `s1.index.difference(s2.index)`로 어긋난 index를 찾아볼 수 있다. 스칼라와의 연산(`s1 ** 2`)은 어제처럼 모든 원소에 적용된다.

### Boolean selection

```python
s = pd.Series(np.arange(10), np.arange(10) + 1)

s > 5          # True/False로 된 Series (mask)
s[s > 5]       # True인 것만 남은 Series
s[s % 2 == 0]  # 짝수만
```

어제 NumPy와 문법도 규칙도 같다. 조건 결합에 `&`를 쓰고 괄호를 치는 것도 같다. 다른 점은 결과에 index가 딸려 와서 걸러진 값이 원래 몇 번이었는지가 남는다는 것뿐이다.

### drop과 inplace - 원본은 안 바뀐다

```python
s.drop('k')     # 'k'가 빠진 새 Series를 돌려준다
s               # 원본에는 그대로 'k'가 있다
```

수업에서 중요하다고 표시한 부분이다. NumPy와 pandas를 비롯한 데이터 라이브러리 대부분은 원본을 건드리지 않고 사본을 만들어 돌려준다. 정말 바꾸고 싶으면 두 가지 방법이 있다.

```python
s = s.drop('k')              # ① 결과를 다시 받는다
s.drop('k', inplace=True)    # ② inplace=True (돌려주는 값이 None이다)
```

둘을 같이 써서 `s = s.drop('k', inplace=True)`라고 하면 `s`가 `None`이 돼버린다. 그리고 `inplace=True`는 요즘 권장되지 않는 추세다. 생각만큼 메모리를 아끼지 못하고, 돌려주는 값이 `None`이라 `.head()`처럼 이어 쓸 수 없고, 어떤 변수가 언제 바뀌었는지 추적하기 어렵다. 그래서 ①처럼 결과를 다시 받는 방식이 더 많이 쓰인다.

### Multi-level index

```python
s4 = pd.Series(
    np.arange(100, 106),
    index=[
        ['a', 'a', 'b', 'b', 'c', 'c'],   # level 0
        [ 1,   2,   1,   2,   1,   2 ],   # level 1
    ],
)
# a  1    100
#    2    101
# b  1    102
# ...
```

주소를 "시 → 구"처럼 두 단계로 쓰는 것과 같다.

```python
s4['a', 1]     # 100    두 레벨을 다 지정
s4['a']        # level 0만 지정 → 남은 레벨로 된 Series
```

레벨을 골라 자를 때는 `xs()`(cross-section)를 쓴다.

```python
s4.xs(('a', 1))                # s4['a', 1]과 같다. 튜플 괄호 필수
s4.xs(2, level=1)              # level 1이 2인 것들 → a, b, c 각각의 2번
s4.xs((2, 'b'))                # KeyError! 튜플은 항상 (level 0, level 1) 순서다
s4.xs((2, 'b'), level=(1, 0))  # 순서를 바꿔 쓰려면 level을 명시한다
```

지금은 굳이 이걸 왜 쓰나 싶지만, groupby로 두 가지 기준을 묶으면 결과가 자동으로 이 모양이 된다. "지역별 × 요일별 평균"을 구하면 index가 (지역, 요일) 2단계가 되는 식이다. 일부러 만든다기보다 계산하다 보면 생기는 것이라 미리 봐둔 것이다.

### apply - 값마다 함수를 적용한다

```python
s = pd.Series([1, 2, 3, 4, 5])

s.apply(lambda x: x ** 2)              # 각 값을 제곱
s.apply(multiply, args=(10,))          # 추가 인자는 args= 튜플로
s2.apply(lambda x: x.strip().lower())  # 문자열 처리도 된다
```

값을 하나씩 꺼내 함수에 넣고, 나온 결과로 새 Series를 만든다. `args=(10,)`에서 콤마를 빠뜨리면 `(10)`은 튜플이 아니라 그냥 숫자 10이 된다.

`apply`는 값을 하나씩 파이썬으로 꺼내 처리해서 느리다. 산술 계산은 `s ** 2`, 문자열 처리는 `s2.str.strip().str.lower()`처럼 통째로 계산하는 방식(벡터화)이 훨씬 빠르다. `.str`은 Series의 문자열 전용 도구 모음이다. `apply`는 `if`가 들어가는 변환처럼 벡터화로 쓰기 어려운 로직에 쓰는 게 맞다.

## DataFrame - 엑셀 시트를 코드로 다루기
### 같은 것을 부르는 여러 이름
수업 자료에 "컬럼 = feature(특성) = 속성 = 변수 = 필드 = 차원"이라고 적혀 있었다. 말이 바뀌어도 같은 걸 가리킨다.

| 방향 | 부르는 이름 | 뜻 |
|---|---|---|
| 가로줄 (row) | 행, 레코드, 관측치, 샘플 | 개별 데이터 하나. 승객 한 명 |
| 세로줄 (column) | 열, 컬럼, 변수, feature | 하나의 속성. 나이, 성별 |

실습은 타이타닉 승객 데이터로 했다.

| 컬럼 | 뜻 |
|---|---|
| `Survived` | 생존 여부 (0 = 사망, 1 = 생존) |
| `Pclass` | 객실 등급 (1, 2, 3등급) |
| `SibSp` | 함께 탄 형제자매·배우자 수 |
| `Parch` | 함께 탄 부모·자녀 수 |
| `Fare` | 요금 |
| `Embarked` | 탑승 항구 (C = 셰르부르, Q = 퀸스타운, S = 사우샘프턴) |
| `Cabin` | 객실 번호 |

### 읽고 훑기 - shape, head, info, describe

```python
df = pd.read_csv(filepath)
```

어제 `np.loadtxt`로 하던 일이 한 줄로 끝난다. 컬럼 이름을 알아서 읽고, 열마다 타입을 정하고, 빈칸은 NaN으로 채운다. 열마다 다른 dtype을 가질 수 있어서, 어제처럼 유저 아이디까지 `1.0`이 되는 일도 없다.

새 데이터를 받으면 항상 이 순서로 본다.

```python
df.shape       # (891, 12)    크기
df.head()      # 앞 5줄       생김새 (head(10)처럼 개수 지정 가능)
df.tail()      # 뒤 5줄
df.info()      # 열별 타입과 비어 있지 않은 개수  ← 결측치를 여기서 발견한다
df.describe()  # 숫자 열의 통계 요약
```

`info()` 결과에서 결측치가 보인다.

```
 5   Age          714 non-null    float64    ← 891개 중 714개만 있다. 177개가 비었다
 10  Cabin        204 non-null    object     ← 거의 다 비었다
```

`describe()`는 숫자 열의 기술통계량을 준다.

| 항목 | 뜻 |
|---|---|
| count | 값이 있는 개수 |
| mean, std | 평균, 표준편차(값들이 평균에서 얼마나 흩어져 있나) |
| min, max | 최소, 최대 |
| 25% / 50% / 75% | 사분위수. 크기순으로 줄 세웠을 때 1/4, 절반, 3/4 지점의 값 |

50%(중앙값)와 평균을 같이 보면 좋다. 타이타닉 `Fare`는 평균이 32.2인데 중앙값은 14.45다. 대부분 싼 표를 샀는데 몇 명이 아주 비싼 표를 사서 평균을 끌어올린 것이다. 이럴 때 "평균 요금 32달러"라고 하면 승객 대부분의 경험과 동떨어진 말이 된다. `describe()`는 기본으로 숫자 열만 보여주고, `include='all'`을 주면 문자열 열의 고유값 개수와 최빈값까지 나온다.

### DataFrame 만들기

```python
pd.DataFrame([[1, 2, 3],       # 리스트 하나가 '행'
              [4, 5, 6]])

pd.DataFrame({'a': [100, 200, 300],           # dict의 key가 '열 이름'
              'b': ['cat', 'dog', 'bird']})   # value 리스트가 그 열의 값
```

리스트로 만들면 행 단위, dict로 만들면 열 단위다. 크기를 볼 때 하나 다른 점이 있다.

```python
len(df)    # 행 개수
df.shape   # (행, 열)
df.size    # 행 × 열 = 전체 칸 수
df.dtype   # AttributeError! DataFrame에는 없다
df.dtypes  # 열마다 타입이 다르니 복수형. 결과는 Series
```

### index와 columns 바꾸기

```python
df2.columns = ['국어', '영어', '수학', '과학']   # 통째로 교체
df2.index = ['철수', '영희', '민수']

df2.rename(columns={'국어': 'kor'}, index={'민수': '지영'})   # 일부만 교체 (원본은 그대로)
```

열과 index를 서로 옮기는 일도 자주 나온다.

```python
df2.set_index('국어')          # '국어' 열을 index로 (기존 index는 사라진다)
df2.reset_index()             # index를 열로 올리고 0부터 새 index
df2.reset_index(drop=True)    # 기존 index를 버리고 0부터 다시

df2.reset_index().set_index('국어')   # 수업 퀴즈: index와 '국어' 열을 맞바꾸기
```

`set_index`는 "이 열을 대표 이름으로 삼아라", `reset_index`는 "이름표를 떼고 평범한 열로 돌려라"다. 필터링을 하고 나면 index가 `0, 3, 6, 11, ...`처럼 뒤죽박죽 남는데, 마무리로 `reset_index(drop=True)`를 붙여 번호를 다시 매기면 깔끔하다.

### 열 고르기 - []는 항상 열이다

```python
df['Survived']                    # Series (1차원)
df.Survived                       # 같은 결과. 점 표기법
df[['Survived']]                  # DataFrame (2차원) ← 대괄호 두 겹
df[['Survived', 'Age', 'Name']]   # 여러 열

df[0]    # 에러! 0번째 '행'이 아니라 이름이 0인 '열'을 찾는다
```

DataFrame의 `[]`는 열을 고르도록 만들어져 있다. 대괄호 개수가 결과 차원을 정하는 건 어제와 같은 규칙이다.

점 표기법(`df.Survived`)은 짧아서 편하지만 안 되는 경우가 있다. 컬럼 이름에 공백이나 특수문자가 있을 때, `df.count`처럼 이름이 pandas 기능과 겹칠 때(열이 아니라 `count()` 함수를 가리킨다), 그리고 `df.NewCol = ...`처럼 새 열을 만들 때(열이 생기지 않고 경고만 뜬다)다. 읽을 때는 편한 쪽을 써도 되지만 만들 때는 반드시 대괄호로 쓴다.

### 행 고르기 - .loc과 .iloc

```python
df.index += 100    # 예제를 위해 index를 100~990으로 바꾼 상태

df.loc[986]        # 이름(index)이 986인 행     → Series
df.loc[[986]]      # 같은 행이지만 DataFrame
df.iloc[0]         # 0번째 행 (이름과 무관)      → Series
df.loc[0]          # 에러! 0이라는 index가 없다
```

| 방법 | 기준 | 비유 |
|---|---|---|
| `.loc[]` | 이름(label) | "986번 승객 데이터 가져와" |
| `.iloc[]` | 순서(0부터) | "맨 앞에서 세 번째 줄 가져와" |

행과 열을 콤마로 동시에 고를 수 있는 것도 NumPy와 같다.

```python
df.loc[986, 'Survived']        # 이름으로 [행, 열]
df.iloc[-5, -3]                # 순서로 [행, 열] (뒤에서 5번째 행, 뒤에서 3번째 열)
df.loc[[102, 986, 100], ['Name', 'Survived', 'Age']]   # 여러 개씩
```

같은 값을 얻는 길이 여러 개인데, `df.loc[102, 'Name']`처럼 한 번에 쓰는 걸 권한다. `df['Name'][102]`나 `df.loc[102]['Name']`도 읽을 때는 같은 결과지만, 중간에 임시 객체를 한 번 만들기 때문에 값을 바꿀 때 문제가 된다.

```python
df['Age'][102] = 30        # 경고가 뜨고, 원본이 안 바뀔 수 있다
df.loc[102, 'Age'] = 30    # 이게 확실하다
```

임시 사본을 고치고 버리는 셈이 될 수 있어서 `SettingWithCopyWarning` 같은 경고가 뜬다. pandas가 앞으로 기본으로 바꾸는 Copy-on-Write 방식에서는 이렇게 이어서 대입하면 아예 원본이 바뀌지 않는다. 값을 대입할 때는 반드시 `.loc[행, 열]`로 한 번에 쓴다.

### 조건으로 행 고르기

```python
pclass_mask = df['Pclass'] == 1           # True/False로 된 Series
df[pclass_mask]                           # True인 행만

age_mask = (df.Age >= 30) & (df.Age < 40)
df[age_mask & pclass_mask]                       # 조건 결합 (괄호 필수)
df[age_mask & pclass_mask][['Pclass', 'Age']]    # 행을 거르고 → 열 고르기

df.Pclass.unique()        # array([3, 1, 2])
df.Pclass.value_counts()  # 3등급 491, 1등급 216, 2등급 184
```

도전 문제가 두 개 있었다.

```python
# 3등급 객실의 생존자 수는?
df[df['Pclass'] == 3][['Survived']].sum()      # 119

# 남녀 생존률은?
df[df['Sex'] == 'male'][['Survived']].mean()   # 0.1889
df[df['Sex'] != 'male'][['Survived']].mean()   # 0.7420
```

`Survived`가 0과 1뿐이라 더하면 곧 생존자 수이고, 평균이 곧 비율이다. 남성은 18.9%, 여성은 74.2%가 살아남았다. 값이 0 아니면 1인 열은 `sum()`이 개수, `mean()`이 비율이라 "몇 명?"과 "몇 %?"를 함수만 바꿔서 얻을 수 있다. 생존 여부, 클릭 여부 같은 데이터를 일부러 0/1로 저장하는 이유다.

### 열과 행 추가, 삭제
없는 열 이름에 대입하면 열이 생긴다. 이렇게 기존 열로 만든 새 열을 **파생변수**라고 한다.

```python
df['Age_Double'] = df['Age'] * 2            # 맨 뒤에 새 열
df.insert(3, 'Fare10', df['Fare'] / 10)      # 위치를 정해서 넣기
```

삭제는 `drop`인데 `axis=`를 꼭 줘야 한다. 기본이 `axis=0`(행)이라서 열 이름만 넣으면 "그런 행이 없다"는 에러가 난다.

```python
df.drop('Age_Double')            # 에러! 행 이름에서 찾는다
df.drop('Age_Double', axis=1)    # 열 삭제
```

| axis | 대상 |
|---|---|
| `axis=0` (기본) | 행 |
| `axis=1` | 열 |

행 추가는 `.loc`에 새 이름을 주면 된다.

```python
df2.loc['수진'] = [100, 200, 300, 400]   # 리스트로
df2.drop(['수진'])                        # 행 삭제 (axis=0 기본)
```

행을 중간에 끼워 넣는 정식 방법은 없어서 수업에서 우회법 두 가지를 봤다.

```python
# 방법 1: 잘라서 다시 붙이기
pd.concat([df2.iloc[:2],
           pd.DataFrame({'a': 10, 'b': 20, 'c': 30, 'd': 40}, index=['현우']),
           df2.iloc[2:]])

# 방법 2: 뒤집어서 열로 넣고 다시 뒤집기
df_t = df2.T
df_t.insert(2, '현우', [10, 20, 30, 40])
df_t.T
```

DataFrame은 속으로 열 단위로 저장되어 있어서 열 하나를 끼우는 건 쉽지만, 행 하나를 끼우려면 모든 열을 쪼개서 다시 만들어야 한다. 그래서 `insert()`는 열만 지원한다. 행 순서가 중요하면 나중에 `sort_values()`로 정렬하는 편이 보통 낫다.

### 상관관계 - 두 열이 같이 움직이는가

```python
df.corr(numeric_only=True)
```

"A가 오르면 B도 오르나?"를 −1에서 +1 사이 숫자 하나로 답한 것이다. +1에 가까우면 같이 오르고 내리고, −1에 가까우면 하나가 오를 때 다른 하나는 내리고, 0에 가까우면 별 관계가 없다. 부호는 방향일 뿐이라 절댓값이 클수록 관계가 강하다.

| 짝 | 계수 | 읽는 법 |
|---|---|---|
| Fare ↔ Pclass | −0.55 | 등급 숫자가 작을수록(1등급) 요금이 비싸다 |
| Survived ↔ Pclass | −0.34 | 등급이 좋을수록 더 살아남았다 |
| Survived ↔ Fare | +0.26 | 비싼 표일수록 더 살아남았다 |
| Age ↔ Pclass | −0.37 | 나이가 많을수록 좋은 등급에 탔다 |

수업에서 못 박은 말이 있다. **상관관계는 인과관계가 아니다.** 아이스크림 판매량과 익사 사고 수는 강한 양의 상관을 보이지만, 아이스크림이 익사를 일으키는 게 아니라 둘 다 여름에 늘어날 뿐이다.

`numeric_only=True`는 숫자 열만 골라서 계산하라는 뜻이다. `Name`, `Sex` 같은 문자열 열은 상관계수를 계산할 수 없는데, 예전 pandas는 알아서 빼줬지만 지금은 직접 지정하지 않으면 에러가 난다. 기본 방식은 피어슨 상관계수이고, 직선 관계만 잡아낸다는 한계가 있다. U자 모양처럼 확실한 관계가 있어도 계수는 0에 가깝게 나올 수 있다.

`plt.matshow(df.corr(numeric_only=True))`와 `plt.colorbar()`로 색깔 표로 그려볼 수도 있다.

### 결측치 처리
**NaN은 0이 아니다. 값이 "없다"는 뜻이다.** 나이가 0살인 것과 나이를 모르는 것은 다르다.

```python
df.info()               # 열별 non-null 개수
df.isna()               # 칸마다 True/False
df[df['Age'].isna()]    # 나이가 비어 있는 행만 보기
```

지울 때는 `dropna()`를 쓴다.

```python
df.dropna()                          # 891 → 183행! 하나라도 NaN이면 그 행을 지운다
df.dropna(subset=['Age'])            # 891 → 714행. Age가 NaN인 행만 지운다
df.dropna(subset=['Age', 'Cabin'])   # 둘 중 하나라도 NaN이면 지운다
df.dropna(axis=1)                    # NaN이 있는 '열'을 통째로 지운다
```

`df.dropna()` 한 줄에 데이터의 80%가 날아간다. `Cabin`이 거의 다 비어 있어서다. 그래서 `subset=`으로 기준 열을 정하는 게 거의 필수다.

채울 때는 `fillna()`를 쓴다.

```python
df['Age'].mean()      # 29.699    ← NaN을 뺀 714명의 평균이다
df['Age'].count()     # 714
df['Age'] = df['Age'].fillna(df['Age'].mean())   # 빈 자리를 평균으로
```

도전 문제는 전체 평균 하나로 다 채우지 말고, 생존자와 사망자의 평균으로 나눠서 채우는 것이었다. 비슷한 집단끼리 나눠 채우는 게 더 낫다는 발상이다.

```python
live = df[df['Survived'] == 1]['Age'].mean()
dead = df[df['Survived'] == 0]['Age'].mean()

df.loc[df['Survived'] == 1, 'Age'] = df[df['Survived'] == 1]['Age'].fillna(live)
df.loc[df['Survived'] == 0, 'Age'] = df[df['Survived'] == 0]['Age'].fillna(dead)
```

여기서도 대입은 `df.loc[조건, 'Age'] = ...`로 했다. `df[df['Survived'] == 1]['Age'].fillna(값, inplace=True)`처럼 쓰면 `df[조건]`이 이미 사본을 만들었기 때문에 그 사본을 고쳐봐야 원본에는 반영되지 않는다. 위의 `.loc` 이야기와 같은 문제다.

지울지 채울지에 정답은 없고 결측이 왜 생겼는지에 달렸다. 몇 개 안 되고 무작위로 빠졌으면 지우고, 데이터를 잃으면 안 되고 채울 근거(평균, 중앙값, 그룹별 평균)가 있으면 채우고, `Cabin`처럼 77%가 비었으면 열째로 버리는 걸 생각한다. 다만 평균으로 채우면 177명이 전부 같은 나이가 돼서 분포가 가운데로 몰린다는 부작용도 있다.

### 수치형과 범주형 - dtype 이야기가 아니다
수업에서 "dtype에 대한 이야기가 아니다!"라고 강조한 부분이다.

| 종류 | 뜻 | 대소 비교·평균이 의미 있나 | 예 |
|---|---|---|---|
| 수치형 | 양을 나타내는 값 | 있다 | Age, Fare |
| 범주형 | 구분하기 위한 값 | 없다 | Sex, Embarked, Pclass, Survived |

`Pclass`는 dtype이 `int64`지만 범주형이다. 3등급이 1등급의 3배인 것도 아니고, 승객 평균 등급 2.31은 아무 뜻이 없고, 1.7등급 같은 중간값도 없다. 우편번호도 마찬가지다. 숫자로 쓰여 있다고 "이 동네 우편번호는 저 동네의 10배"라고 말하는 건 의미가 없다.

범주형 안에서도 성별이나 탑승 항구처럼 순서 자체가 없는 것(명목형)과, `Pclass`처럼 1등급 > 2등급 > 3등급이라는 순서는 있지만 간격에는 뜻이 없는 것(순서형)으로 나뉜다. 순서는 쓰되 산술연산은 하지 않는다.

### 연령대로 묶기 - apply
결측치를 채운 나이를 10살 단위 연령대로 묶었다.

```python
import math

def age_categorize(age):
    if math.isnan(age):
        return -1
    return int(age / 10) * 10      # 23 → 2.3 → 2 → 20

df['Age_span'] = df['Age'].apply(age_categorize)   # 파생변수로 추가
df['Age_span'].value_counts()                      # 30대 292명, 20대 272명, ...
```

22세와 23세를 굳이 구분할 필요가 없을 때 쓴다. NaN을 그냥 `int()`에 넣으면 에러가 나서 `math.isnan`으로 먼저 걸렀다. 구간을 직접 정해서 자르는 `pd.cut`, 개수가 같게 자르는 `pd.qcut`이라는 전용 함수도 있다.

### One-hot encoding - 범주형을 계산할 수 있게

```python
pd.get_dummies(df, columns=['Pclass', 'Sex', 'Embarked'], dtype=int)
```

색깔 열 하나를 "빨강인가? / 초록인가? / 파랑인가?" 세 개의 예/아니오 열로 쪼개는 것이다.

```
Color          Red  Green  Blue
Red      →      1     0      0
Green    →      0     1      0
Blue     →      0     0      1
```

이름 그대로 1이 딱 하나(one hot)만 켜진다.

| 옵션 | 하는 일 |
|---|---|
| `columns=[...]` | 변환할 열 지정 (안 주면 문자열 열이 전부 변환된다) |
| `dtype=int` | True/False 대신 1/0으로 |
| `drop_first=True` | 범주마다 첫 번째 열을 뺀다 |

이렇게 하는 이유는 머신러닝 모델이 결국 계산으로 답하기 때문이다. "이 승객은 남자입니까?"에 모델은 `[0.98, 0.003]` 같은 숫자 뭉치로 답하고, 그게 `[1, 0]`(남자)에 가까운지 `[0, 1]`(여자)에 가까운지 판단하는 것도 계산이다. 그래서 범주형도 계산할 수 있는 숫자 형태로 바꿔둔다.

`drop_first=True`가 있는 건 열 하나를 빼도 정보가 사라지지 않아서다. `Sex_female`이 0이면 남자인 게 확실하니 `Sex_male`은 없어도 된다. 그리고 `Name`이나 `Ticket`처럼 값 종류가 수백 개인 열에 쓰면 열이 수백 개로 늘어나니, 아무 인자 없이 `pd.get_dummies(df)`를 돌리지 말고 `columns=`로 대상을 정해준다.

## 헷갈리기 쉬운 부분
- `s.count()`는 NaN을 뺀 개수, `s.size`는 자리 수다. 둘의 차이가 결측치 개수다.
- pandas의 `mean()`, `sum()`, `max()`는 NaN을 빼고 계산한다. NumPy와 반대다.
- `unique()`는 NaN도 종류로 세지만 `count()`와 `value_counts()`는 NaN을 뺀다.
- index가 중복되면 인덱싱 결과가 값이 아니라 Series가 된다.
- Series끼리 연산은 index 기준이다. 짝이 없으면 NaN이다.
- `drop()`, `rename()`, `fillna()`는 원본을 안 바꾼다. 결과를 다시 받는다. `s = s.drop('k', inplace=True)`는 `s`를 `None`으로 만든다.
- `df[0]`은 첫 행이 아니다. `[]`는 열을 고르고, 행은 `.loc`과 `.iloc`으로 고른다.
- `df.dtype`은 없고 `df.dtypes`다.
- `df.drop('열이름')`은 에러다. 열을 지울 때는 `axis=1`이다.
- `df.dropna()` 한 줄에 891행이 183행이 된다. 거의 항상 `subset=`을 준다.
- `df[조건]['열'] = 값`은 원본을 안 바꿀 수 있다. `df.loc[조건, '열'] = 값`으로 한 번에 쓴다.
- `Pclass`는 int지만 범주형이다. 타입이 아니라 의미로 판단한다.
- `corr()`에는 `numeric_only=True`를 준다. 그리고 상관관계는 인과관계가 아니다.

## 오늘 배운 내용 정리
오늘은 pandas의 Series와 DataFrame을 배우고, 타이타닉 데이터를 탐색하고 전처리했다.

```
Series: NumPy 배열 + index(이름표). 중복 가능, 없는 index에 대입하면 새로 생긴다.
loc / iloc: 이름으로 / 순서로. 모호할 때는 이쪽을 쓴다.
NaN: size(자리 수) - count(값 개수) = 결측치. 집계는 NaN을 빼고 계산한다.
연산: Series끼리는 순서가 아니라 index로 짝을 맞춘다. 짝이 없으면 NaN.
원본 유지: drop, rename, fillna, apply 는 새 객체를 돌려준다. 결과를 다시 받는다.
DataFrame: index를 공유하는 Series의 묶음. 열마다 dtype이 다를 수 있다.
탐색: shape → head() → info()(결측치) → describe()(통계, 평균과 중앙값 비교).
선택: df['열'], df[['열']], df.loc[행, 열], df.iloc[행, 열], df[(조건1) & (조건2)].
대입: df.loc[조건, '열'] = 값 으로 한 번에.
0/1 열: sum() 은 개수, mean() 은 비율.
결측치: dropna(subset=[...]), fillna(평균 또는 그룹별 평균).
범주형: dtype이 아니라 의미로 판단. get_dummies(columns=[...], dtype=int)로 0/1 열로 펼친다.
상관계수: df.corr(numeric_only=True). 상관관계는 인과관계가 아니다.
```

어제는 열 번호를 외워가면서 데이터를 다뤘는데, 오늘은 `df['Age']`처럼 이름으로 쓰니 코드가 훨씬 읽기 쉬워졌다. 특히 Series끼리 더할 때 순서가 아니라 index로 짝을 맞춰준다는 점과, pandas는 NaN을 조용히 빼고 계산하니 `count()`를 먼저 확인해야 한다는 점이 가장 기억에 남았다.

---
