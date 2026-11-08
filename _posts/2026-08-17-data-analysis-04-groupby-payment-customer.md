---
layout: single
title: "데이터 분석 기초 정리 4 - 결제 데이터로 groupby 실전 (agg, transform, filter, apply)"
categories: [coding, DataAnalysis]
tag: [study-log, DataAnalysis, pandas, groupby, merge, named-aggregation, Sakila]
toc: true
author_profile: false
sidebar:
    nav: "docs"
search: true
---
<hr/>

오늘은 지난 시간에 배운 groupby를 실제 DB 데이터에 써보는 실습을 했다. 예제가 작을 때는 `agg`, `transform`, `filter`, `apply` 중 언제 무엇을 쓰는지가 잘 안 잡혔는데, 16,044건짜리 결제 데이터로 8가지 질문에 답해보니 질문마다 답의 모양이 달라서 도구가 자연스럽게 갈렸다. 문제 풀이는 다음 날 이어서 맞춰봤는데 여기에 같이 정리했다.

## 데이터 - 고객 표와 결제 표
지난 시간에 `read_sql`로 떠 둔 CSV를 썼다. MySQL의 공식 예제 DB인 Sakila에서 뽑은 것으로, DVD 대여점 시나리오다.

| 파일 | 크기 | 내용 |
|---|---|---|
| `customer.csv` | 599행 × 9열 | 고객 명단. `customer_id`, 이름, `email`, 가입일 |
| `payment.csv` | 16,044행 × 7열 | 결제 내역. `payment_id`, `customer_id`, `amount`, `payment_date` |

```
customer (599명)  ──1:N──▶  payment (16,044건)
   customer_id                 customer_id
```

고객 한 명이 결제를 여러 번 하니 `payment`에는 같은 `customer_id`가 여러 번 나온다. 한 표에 다 넣으면 결제할 때마다 이름, 이메일, 주소를 통째로 복사해야 하고 이메일 하나 고치려면 수천 곳을 고쳐야 해서, DB에서는 바뀌지 않는 것과 쌓이는 것을 나눠 저장하고 필요할 때 `customer_id`로 이어 붙인다. DB 수업에서 배운 정규화이고, 이어 붙이는 게 지난 시간에 배운 merge다. 실무 데이터는 거의 항상 이렇게 흩어져 있다.

그리고 CSV로 읽었기 때문에 `payment_date`는 날짜처럼 생겼지만 문자열이다. `2005-05-25 11:30:37`처럼 자릿수가 고정된 형식이라 문자열을 잘라 써도 월을 뽑을 수 있었다.

## 결과가 몇 줄이어야 하는가
질문마다 결과의 행 수가 다르고, 그 행 수가 도구를 정한다. 이게 오늘 실습의 핵심이었다.

| 질문 | 결과 행 수 | 도구 |
|---|---|---|
| 고객별 결제 총액은? | 599 (고객당 1줄) | `agg` |
| 결제 30번 이상인 고객의 모든 결제 내역은? | 원본의 일부 | `filter` |
| 각 결제가 그 고객 평균보다 얼마나 큰가? | 16,044 (원본 그대로) | `transform` |
| 고객별 최근 3건은? | 고객당 3줄 | `apply` |

사과 상자 하나를 주고 `agg`는 "무게를 재서 숫자 하나만 알려줘", `transform`은 "사과 개수는 그대로 두고 각 사과에 상자 평균 무게를 써 붙여줘", `filter`는 "5kg 넘는 상자는 통째로 남기고 나머지는 버려", `apply`는 "알아서 해줘"라고 하는 것과 같다.

```python
group = payment_df.groupby("customer_id")   # 실습 내내 재사용

group.size()          # 고객별 결제 건수 (599개 그룹)
group.get_group(1)    # 1번 고객의 결제 내역만 꺼내 보기
```

`groupby()`는 아직 계산을 하지 않은 상태라 변수에 담아두고 계속 썼다. `get_group(1)`로 한 그룹만 꺼내보는 건 전체에 적용하기 전에 한 그룹으로 확인해볼 수 있어서 디버깅할 때 유용하다.

## 문제 1 - 고객별 결제 횟수와 합계 (agg)

```python
revenue_per_user_df = group.agg(
    sum   = ("amount", "sum"),
    count = ("amount", "count"),
)
#              sum  count
# customer_id
# 1         118.68     32
# 2         128.73     27
```

`새 컬럼 이름 = ("어느 컬럼", "무슨 계산")` 형태의 named aggregation이다. 결과 컬럼 이름을 바로 정할 수 있어서, `group.agg({'amount': ['sum', 'count']})`처럼 컬럼이 2단으로 쌓이는 일이 없다.

다만 `sum`, `count`를 컬럼 이름으로 쓰면 헷갈린다. `df.sum`은 컬럼이 아니라 함수를 가리키기 때문이다. 수업 코드는 뒤에서 `rename`으로 이름을 다시 바꿨는데, 처음부터 `total_amount`, `payment_count`처럼 뜻이 있는 이름으로 만들면 한 단계가 줄어든다.

## 문제 2 - 상위 10명에 이메일 붙이기 (merge)
결제 정보는 `payment`에, 이메일은 `customer`에 있으니 합쳐야 답할 수 있다.

```python
merged_df = pd.merge(
    customer_df,           # 왼쪽: customer_id가 '컬럼'
    revenue_per_user_df,   # 오른쪽: customer_id가 'index'
    left_on='customer_id',
    right_index=True,
)
```

여기가 이 문제의 핵심이다. groupby 결과는 그룹 키가 index로 올라간다. 그래서 한쪽은 컬럼, 한쪽은 index라 `on=` 하나로는 안 되고 `left_on=`과 `right_index=True`를 짝지어 써야 한다.

```python
result = (
    merged_df[['customer_id', 'email', 'sum', 'count']]
    .rename(columns={"sum": "결제 금액", "count": "결제 횟수"})
    .sort_values(by="결제 횟수", ascending=False)
    .head(10)
)
# customer_id                            email  결제 금액  결제 횟수
#         148  ELEANOR.HUNT@sakilacustomer.org   216.54     46
#         526    KARL.SEAL@sakilacustomer.org    221.55     45
```

필요한 열 고르기 → 이름 바꾸기 → 정렬 → 상위 10개로 한 단계씩 이어 붙였다. 수업 코드는 줄 끝에 `\`를 붙여서 줄을 나눴는데, `\` 뒤에 공백이 하나라도 있으면 에러가 나고 눈에 잘 안 보여서 위처럼 바깥을 괄호로 감싸는 편이 안전하다.

`left_on`과 `right_index` 조합이 헷갈리면 집계 결과의 index를 먼저 컬럼으로 내려놓고 평범하게 merge해도 된다.

```python
revenue = group.agg(...).reset_index()          # customer_id가 컬럼이 된다
pd.merge(customer_df, revenue, on='customer_id')
```

## 문제 3 - 결제 30회 이상 고객의 모든 결제 내역 (filter)
판정은 그룹 단위, 결과는 행 단위인 문제다. 30회 이상인 고객을 찾되 출력은 그 고객들의 결제 내역 전부여야 한다.

```python
group.filter(lambda x: x.shape[0] >= 30)
```

`filter`에 넘기는 함수는 그룹 하나(DataFrame)를 받아서 True/False를 돌려준다. `x.shape[0]`이 그룹의 행 수, 즉 그 고객의 결제 횟수다. True인 그룹은 행이 통째로 남고, False인 그룹은 통째로 빠진다.

수업에서는 결과를 보기 좋게 다듬는 코드도 붙였다.

```python
(
    group.filter(lambda x: x.shape[0] >= 30)
    .sort_values('customer_id')
    .set_index('customer_id', append=True)   # 기존 index를 남기고 customer_id를 '추가'
    .swaplevel()                             # 두 레벨의 순서를 뒤집는다
)
```

`set_index`는 보통 기존 index를 버리는데 `append=True`를 주면 기존 index 위에 한 겹 더 쌓는다. 그래서 멀티 인덱스가 되고, `swaplevel()`로 `customer_id`를 바깥으로 보낸다.

같은 일을 `apply`로도 할 수 있다.

```python
def get_all_or_none(df):
    if df.shape[0] >= 30:
        return df
    return df.head(0)     # 컬럼 구조는 그대로인 0행짜리 표

group.apply(get_all_or_none)
```

조건에 맞으면 그룹을 그대로 돌려주고, 아니면 빈 표를 돌려주니 결과적으로 `filter`와 같아진다. 자료에 적힌 "apply만 알면 나머지도 구현할 수 있다"의 실제 예다. 그래도 `filter`라는 이름이 의도를 바로 알려주고, `apply` 결과는 index에 그룹 키가 한 겹 더 붙어서 모양이 달라지고, 전용 함수 쪽이 대체로 빠르다. "apply로도 된다"는 이해용이고 실제로는 뜻이 분명한 전용 함수를 고른다.

## 문제 4, 5 - 고객별 첫 구매와 최근 3건 (apply)

```python
group.apply(lambda cust_df: cust_df.head(1))   # 고객별 첫 결제 → 599행
group.apply(lambda cust_df: cust_df.tail(3))   # 고객별 최근 3건
```

결과가 그룹당 1줄도 N줄도 아닌 3줄이라 `agg`도 `transform`도 못 쓰고, 여기가 `apply`가 꼭 필요한 자리다.

다만 이 코드가 맞는 건 `payment.csv`가 이미 `payment_date` 순으로 정렬돼 있어서다. 그래서 `head(1)`이 첫 구매, `tail(3)`이 최근 3건이 된다. 데이터를 다시 받거나 다른 파일로 바꾸면 에러 없이 조용히 틀린 답이 나올 수 있으니, 정렬 기준을 코드에 직접 적는 편이 안전하다. `payment_date`가 `YYYY-MM-DD HH:MM:SS` 형식의 문자열이라 문자열 정렬이 곧 시간 순서다.

```python
group.apply(lambda d: d.sort_values('payment_date').head(1))   # 첫 구매
group.apply(lambda d: d.sort_values('payment_date').tail(3))   # 최근 3건
```

`apply`가 얼마나 자유로운지 보여주는 실험도 했다.

```python
group.apply(lambda cust_df: pd.Series([100, 200, 300, cust_df.amount.sum()]))
# Series를 돌려주면 → 가로로 펼쳐져 DataFrame이 된다
```

돌려주는 것의 모양이 결과의 모양을 정한다. 값 하나면 Series, Series면 DataFrame, DataFrame이면 세로로 이어 붙는다.

## 문제 6 - 첫 구매일과 마지막 구매일 (agg와 apply)

```python
group.agg(
    count=('amount', 'count'),
    sum=('amount', 'sum'),
    first=('payment_date', lambda x: x.values[0]),   # 그룹 안 첫 값
    last=('payment_date', lambda x: x.values[-1]),   # 그룹 안 마지막 값
).rename(columns={"count": "결제 횟수", "sum": "결제 금액",
                  "first": "첫 구매일", "last": "마지막 구매일"})
```

`agg`의 함수 자리에는 `'sum'` 같은 문자열뿐 아니라 직접 만든 함수(lambda)도 넣을 수 있다. 여기서 `x`는 그 그룹의 해당 컬럼(Series)이고, `.values[0]`으로 첫 값을 꺼낸다.

`apply`로 쓰면 이렇다.

```python
def get_data_from_customer_df(cust_df):
    return pd.Series(
        [cust_df.amount.sum(), cust_df.amount.count(),
         cust_df.payment_date.values[0], cust_df.payment_date.values[-1]],
        index=["결제 금액", "결제 횟수", "첫 구매일", "마지막 구매일"],
    )

group.apply(get_data_from_customer_df)
```

`pd.Series`에 `index=`로 이름을 붙여 돌려주면 그게 결과의 컬럼 이름이 돼서 `rename`이 필요 없다. 그리고 `agg`는 컬럼 하나씩 계산하기 때문에 "가장 비싼 결제의 날짜"처럼 `amount`와 `payment_date`를 같이 봐야 하는 계산은 `apply`로만 된다.

## 문제 7 - 유저별 × 월별 집계 (그룹 기준을 만들어 쓰기)
자료에 "DB로 해도 좀 어려울 수 있다"고 적힌 문제였고, 실제로 오늘의 산이었다. 월별로 묶고 싶은데 '월'이라는 컬럼이 없다. `payment_date`에 날짜와 시간이 통째로 들어 있을 뿐이다.

```python
payment_df.payment_date.apply(lambda x: str(x)[:7])   # '2005-05-25 11:30:37' → '2005-05'
```

앞 7글자를 자르면 `YYYY-MM`이 되고, 이 Series를 그대로 `groupby`에 넘긴다.

```python
payment_df.groupby([
    "customer_id",                                          # ① 컬럼 이름으로
    payment_df.payment_date.apply(lambda x: str(x)[:7]),    # ② 만들어낸 Series로
]).size()
# customer_id  payment_date
# 1            2005-05          2
#              2005-06          7
#              2005-07         12
```

groupby는 컬럼 이름만 받는 게 아니라 "각 행이 어느 그룹인지 적힌 목록"이면 뭐든 받는다. 원본과 길이와 index가 같은 16,044개짜리 Series라 행마다 짝이 맞기 때문이다. 그래서 컬럼을 새로 만들지 않고도 임시 기준으로 묶을 수 있다. 그 위에 문제 6의 `agg`를 그대로 얹으면 유저별 × 월별 결제 금액, 횟수, 첫 구매일, 마지막 구매일이 나온다.

```python
payment_df.groupby([
    "customer_id",
    payment_df.payment_date.apply(lambda x: str(x)[:7]),
]).agg(
    sum   = ("amount", "sum"),
    count = ("amount", "count"),
    first = ("payment_date", lambda x: x.values[0]),
    last  = ("payment_date", lambda x: x.values[-1]),
)
# customer_id payment_date    sum  count                first
# 1           2005-05        3.98      2  2005-05-25 11:30:37
#             2005-06       31.93      7  2005-06-15 00:54:12
```

기준을 두 개 줬으니 결과 index가 (customer_id, 월) 2단이 됐다. Series를 배울 때 본 멀티 인덱스가 여기서 저절로 나왔다.

같은 결과를 컬럼으로 만들어서 얻을 수도 있다.

```python
payment_df['month'] = payment_df.payment_date.str[:7]     # apply보다 빠르다
payment_df.groupby(['customer_id', 'month']).agg(...)
```

여러 번 쓸 기준이면 컬럼으로 만들어두고, 한 번만 쓸 거면 Series를 바로 넘기는 게 깔끔하다. `.str[:7]`은 문자열 전용 도구라 `apply(lambda x: str(x)[:7])`보다 훨씬 빠르다.

SQL로 쓰면 `GROUP BY customer_id, LEFT(payment_date, 7)`이다. GROUP BY에 함수 결과를 넣는 것이 groupby에 Series를 넘기는 것과 같은 발상이다. 어려운 건 문법이 아니라 그룹 기준을 데이터에서 만들어낸다는 발상 자체였다.

## 문제 8 - 각 결제가 그 고객 평균보다 얼마나 큰가 (transform)
결과가 원본과 같은 16,044행이어야 하는 문제다. `agg`로는 599행이 나오니 안 된다.

```python
group['amount'].agg("mean")         # 599행. 고객당 하나
group['amount'].transform("mean")   # 16,044행. 각 행에 그 고객의 평균이 채워진다

payment_df['diff'] = payment_df['amount'] - group['amount'].transform("mean")
```

`agg`는 요약표를 만들고, `transform`은 요약값을 원본 줄마다 도장 찍어준다. 그래서 그대로 빼기가 된다.

`apply`로도 할 수 있지만 뒤처리가 필요하다.

```python
group.apply(lambda x: x['amount'] - x['amount'].mean()).droplevel(0)
```

`apply` 결과는 index에 `customer_id`가 한 겹 더 붙어서 원본과 모양이 달라진다. 그 레벨을 `droplevel(0)`으로 떼어내야 원본에 컬럼으로 붙일 수 있다. `transform`은 원본과 index가 그대로라 바로 붙고, 이게 `transform`이 따로 있는 이유다.

"원본 각 행에 그룹 통계를 붙이는" 계산은 실무에서도 자주 쓰인다. "이 고객치고 유난히 큰 결제"를 찾는 이상치 탐지, `(x - 그룹평균) / 그룹표준편차`로 그룹 간 차이를 없애는 정규화, `x / 그룹합계`로 그 결제가 고객 총액에서 차지하는 비중을 구하는 것이 전부 이 모양이다.

## 헷갈리기 쉬운 부분
- groupby 결과는 그룹 키가 index로 올라간다. 다른 표에 붙일 때는 `left_on='컬럼', right_index=True`를 쓰거나 먼저 `reset_index()`를 한다.
- 도구는 결과가 몇 줄이어야 하는지로 고른다. 그룹당 1줄이면 `agg`, 원본과 같으면 `transform`, 원본의 일부면 `filter`, 그 외는 `apply`다.
- `apply` 결과는 index에 그룹 키가 한 겹 더 붙는다. 원본에 붙이려면 `droplevel(0)`이 필요하다.
- `head(1)`, `tail(3)`은 원본이 정렬돼 있다는 가정 위에서만 맞다. `sort_values`로 기준을 적어두는 게 안전하다.
- `sum`, `count`를 컬럼 이름으로 쓰면 `df.sum`이 컬럼이 아니라 함수를 가리켜서 헷갈린다.
- `set_index(..., append=True)`는 기존 index 위에 쌓고, 그냥 `set_index()`는 갈아 끼운다.
- 줄 끝 `\` 뒤에 공백이 있으면 에러가 난다. 바깥을 괄호로 감싸는 편이 낫다.
- groupby에 넘기는 Series는 원본과 길이와 index가 같아야 한다.

## 오늘 배운 내용 정리
오늘은 고객 표와 결제 표로 8가지 질문에 답하면서 groupby의 네 가지 도구를 실제로 골라 썼다.

```
group = payment_df.groupby("customer_id")   한 번 만들어두고 재사용.
agg:       group.agg(합계=("amount", "sum"), 횟수=("amount", "count"))   그룹당 1줄.
merge:     pd.merge(customer_df, 집계결과, left_on='customer_id', right_index=True)
filter:    group.filter(lambda x: x.shape[0] >= 30)   조건 맞는 그룹의 행 전부.
apply:     group.apply(lambda d: d.sort_values('payment_date').tail(3))   그룹당 M줄.
transform: df.amount - group['amount'].transform('mean')   원본 행마다 그룹 통계.
기준 만들기: groupby(['customer_id', df.payment_date.str[:7]])   길이와 index만 맞으면 된다.
```

같은 데이터인데 질문에 따라 결과가 599줄, 16,044줄, 고객당 3줄로 달라지고, 그 행 수만 보고 도구를 고를 수 있다는 게 가장 크게 남았다. 특히 월 컬럼이 없어도 날짜를 잘라 만든 Series를 groupby에 바로 넘겨서 유저별 × 월별로 묶을 수 있다는 건 SQL로 생각할 때보다 오히려 간단하게 느껴졌다.

---
