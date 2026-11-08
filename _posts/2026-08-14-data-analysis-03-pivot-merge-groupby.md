---
layout: single
title: "데이터 분석 기초 정리 3 - 정렬, 피벗, 병합과 groupby로 집계하기"
categories: [coding, DataAnalysis]
tag: [study-log, DataAnalysis, pandas, pivot_table, merge, groupby, read_sql, FinanceDataReader]
toc: true
author_profile: false
sidebar:
    nav: "docs"
search: true
---
<hr/>

오늘은 표를 다루는 범위가 넓어졌다. 어제까지는 표 하나에서 행과 열을 고르고 고치는 데서 끝났는데, 실제 데이터는 그렇지 않다. 고객 정보와 주문 내역은 서로 다른 테이블에 있고, 세로로 쌓인 기록을 격자표로 보고 싶을 때가 있고, "고객별 결제 횟수"처럼 그룹으로 나눠 계산해야 하는 일이 대부분이다.

그래서 오늘은 표를 정렬하고, 모양을 바꾸고(pivot), 여러 표를 합치고(merge), 그룹으로 나눠 계산하는(groupby) 법을 배웠다. 중간에 주가 데이터를 받아오는 FinanceDataReader와 DB 테이블을 DataFrame으로 가져오는 `read_sql`도 다뤘다.

## 정렬 - sort_values와 sort_index

```python
df.sort_values(by='Pclass')                     # 값 기준 오름차순 (기본)
df.sort_values(by='Pclass', ascending=False)    # 내림차순
df.sort_values(by=['Pclass', 'Age'])            # 1순위 Pclass, 같으면 Age
df.sort_values(by=['Pclass', 'Age'], ascending=[True, False])   # 기준마다 방향을 따로
```

엑셀의 정렬 대화상자와 같다. `by=`에 리스트를 주면 앞쪽이 1순위이고 뒤쪽이 동점일 때의 기준이다. `ascending=`에도 리스트를 주면 기준마다 방향을 다르게 줄 수 있다.

```python
df.sort_index()           # index 오름차순
df.sort_index(axis=1)     # 컬럼 '이름'을 가나다순으로 정렬
```

`sort_index(axis=1)`은 행을 재배열하는 게 아니라 열 순서를 바꾸는 것이다. 컬럼이 많을 때 찾기 쉽게 정렬하는 용도다.

정렬하면 행이 움직이지만 index 번호는 그 행에 붙어 다닌다. 그래서 결과의 index가 `857, 862, 867, 52, ...`처럼 뒤죽박죽인 게 정상이다. 순위표처럼 번호를 다시 매기고 싶으면 `.reset_index(drop=True)`를 붙인다. 그리고 "가장 큰 5개"를 뽑을 때는 정렬 후 `head(5)` 대신 `df.nlargest(5, 'Fare')`를 쓰면 전체를 정렬하지 않고 상위 5개만 찾아서 더 빠르다.

## 표의 모양 바꾸기 - pivot과 pivot_table
### pivot - 긴 표를 격자표로
수업 예제 데이터는 한 줄이 (지역, 요일) 한 쌍인 모양이었다.

```
    지역   요일   강수량  강수확률
0   서울  월요일   100    80
1   서울  화요일    80    70
2   서울  수요일  1000    90
3   경기  월요일   200    10
...
```

이걸 지역별 × 요일별로 보고 싶을 때 `pivot`을 쓴다.

```python
df.pivot(index='지역', columns='요일', values='강수량')
```

세로로 길게 쌓인 기록을 가로세로 격자표로 펼치는 것이다. 엑셀의 피벗 테이블과 같은 개념이고, 세 인자가 결과의 한 축씩을 맡는다.

| 인자 | 결과에서 맡는 자리 |
|---|---|
| `index=` | 왼쪽 세로축 (행 이름) |
| `columns=` | 위쪽 가로축 (열 이름) |
| `values=` | 칸을 채울 값 |

`values=`를 생략하면 남은 열 전부(강수량, 강수확률)가 값으로 들어가서 컬럼이 2단이 된다. `index`와 `columns`를 바꾸면 축이 뒤집히니, 어느 쪽을 세로로 볼지는 보고 싶은 방향에 따라 정한다.

결과에서 부산 행에 NaN이 잔뜩 생기는 것도 눈여겨볼 지점이었다. 부산은 월·화 데이터만 있어서 나머지 요일 칸이 빈다. 없는 데이터가 사라지는 게 아니라 빈칸으로 드러나는 게 피벗의 유용한 부작용이다.

그런데 `pivot`에는 치명적인 제약이 있다. (지역, 요일) 짝이 중복되면 에러가 난다.

```python
# 경기-금요일 데이터를 하나 더 추가하면
df.pivot(index='지역', columns='요일')
# ValueError: Index contains duplicate entries, cannot reshape
```

한 칸에 값이 두 개인데 어느 걸 넣을지 알 수 없어서다.

### pivot_table - 중복은 집계로 해결

```python
df2.pivot_table(index='지역', columns='요일', aggfunc='mean')   # 중복은 평균으로
df2.pivot_table(index='지역', columns='요일', aggfunc='max')    # 최댓값으로
```

`pivot`은 "칸에 값이 두 개면 못 하겠다"고 손을 들고, `pivot_table`은 "그럼 평균 낼게"라고 답한다. 하는 일은 같고 중복이 있을 때만 다르다. `aggfunc=`의 기본값은 `'mean'`이고 `'sum'`, `'max'`, `'min'`, `'count'` 등을 쓸 수 있다. 서울-월요일 강수량이 100과 80 두 개일 때 `mean`이면 90, `max`면 100이 들어간다.

중복이 없다고 확신할 수 있는 경우가 드물어서 실무에서는 거의 `pivot_table`을 쓴다. 그리고 `pivot_table`은 groupby와 사실 같은 일이다.

```python
df.pivot_table(index='지역', columns='요일', values='강수량', aggfunc='mean')
df.groupby(['지역', '요일'])['강수량'].mean().unstack()      # 결과가 같다
```

차이는 결과의 모양뿐이다. groupby는 세로로 긴 결과, pivot_table은 격자표다.

### stack과 unstack - 컬럼과 index를 오르내리기

```python
new_df = df.set_index(['지역', '요일'])   # 2단 index를 만들고 시작
```

| 함수 | 방향 | 결과 |
|---|---|---|
| `unstack()` | index를 컬럼으로 올린다 | 표가 넓어진다 |
| `stack()` | 컬럼을 index로 내린다 | 표가 길어진다 |

```python
new_df.unstack()      # level=-1(기본) → 맨 안쪽 '요일'이 컬럼으로 올라간다
new_df.unstack(0)     # level=0 → '지역'이 컬럼으로 올라간다
df2.stack()           # 컬럼의 맨 안쪽 레벨이 index로 내려온다

new_df.unstack(0).stack(-1)   # 도전 문제: 두 index의 위치를 바꾸기
```

`level=0`은 가장 바깥(왼쪽), `level=-1`은 가장 안쪽(오른쪽)이다. 도전 문제는 지역을 컬럼으로 올려 보내서 index에 요일만 남긴 다음, 다시 맨 안쪽을 내려서 (요일, 지역) 순서로 만드는 것이었다.

`stack()`을 실행하면 `FutureWarning: The previous implementation of stack is deprecated`라는 경고가 떴다. pandas가 `stack()`의 내부 동작을 바꾸는 중이라 뜨는 안내라서 에러는 아니다. 다만 옛 방식은 결과의 NaN을 기본으로 버리고 새 방식은 남긴다는 차이가 있어서, 버전이 바뀌면 결과 행 수가 달라질 수 있다. `df.stack(future_stack=True)`로 새 방식을 미리 쓰면 경고가 사라진다.

이렇게 넓은 표(wide)와 긴 표(long)를 오가는 게 데이터 다루기의 큰 축이다. 한 줄이 관측 하나인 긴 표는 계산과 저장에 유리하고, 격자 모양의 넓은 표는 사람이 읽기 좋고 그래프 그리기 편하다. 그래서 보통 긴 표로 계산하고 넓은 표로 보여준다. `pivot`과 `unstack`이 긴 표를 넓게, `stack`과 `pd.melt()`가 넓은 표를 길게 만든다.

## 여러 표 합치기 - concat과 merge
### concat - 그냥 이어 붙이기

```python
pd.concat([df1, df2])            # axis=0 (기본) 위아래로 쌓기
pd.concat([df1, df2], axis=1)    # 좌우로 붙이기
```

종이 두 장을 위아래로 잇거나 옆으로 나란히 놓는 것이다. 내용을 맞춰보지 않는다. 그래서 조심할 게 두 가지 있다.

하나는 위아래로 붙이면 index가 0부터 다시 시작해서 중복된다는 것이다. `ignore_index=True`를 주면 0부터 새로 매긴다. 다른 하나는 컬럼 이름이 다르면 서로 다른 열로 취급해서 대각선 모양으로 NaN이 가득 찬 표가 된다는 것이다.

```python
df3 = pd.DataFrame({'key2': ..., 'value2': ...})   # 컬럼 이름이 다르다
pd.concat([df1, df3])
#    key1  value1  key2  value2
# 0   0.0  0.496   NaN     NaN
# ...
# 0   NaN     NaN   0.0   1.465     ← 서로 다른 열에 들어간다
```

결과의 절반이 NaN이라면 컬럼 이름 오타부터 의심한다.

### merge - 키를 맞춰 짝짓기
오늘의 핵심이다. SQL의 JOIN과 같다. 수업 예제는 두 표였다.

```python
customer   # customer_id 0~5, name, 나이
orders     # customer_id [1, 1, 2, 2, 2, 3, 3, 1, 4, 9], item, quantity
```

0번(철수)과 5번(동건) 고객은 주문이 없고, 주문에는 고객 표에 없는 9번이 있다. 양쪽이 딱 맞지 않는다.

```python
pd.merge(customer, orders, on='customer_id')     # how='inner' (기본)
```

두 표에서 `customer_id`가 같은 줄끼리 옆으로 붙인다. 고객 정보가 주문마다 복사되어 따라붙는다. `how=`는 어느 쪽 행을 남길지를 정한다.

| `how` | 남는 것 | 예제 결과 |
|---|---|---|
| `'inner'` (기본) | 양쪽에 다 있는 것만 | 9행. 철수, 동건, 9번이 전부 빠진다 |
| `'left'` | 왼쪽 표는 전부, 오른쪽은 맞는 것만 | 11행. 철수와 동건이 NaN을 달고 남는다 |
| `'right'` | 오른쪽 표는 전부 | 10행. 9번이 이름 NaN으로 남는다 |
| `'outer'` | 양쪽 다 (합집합) | 12행 |

```python
pd.merge(customer, orders, on='customer_id', how='left')
#    customer_id name  나이 item  quantity
# 0            0   철수  40  NaN       NaN      ← 주문이 없어서 NaN
# 1            1   영희  20   치약       1.0
# ...
# 10           5   동건  18  NaN       NaN
```

말로 바꿔보면 고르기 쉽다. "주문한 적 있는 고객의 주문 목록"이면 `inner`, "모든 고객 목록에 있으면 주문도 같이"(주문이 0건인 고객도 보고 싶을 때)면 `left`, "양쪽이 얼마나 안 맞는지 확인"이면 `outer`다. 실무에서는 기준 표는 그대로 두고 정보만 붙이는 일이 가장 흔해서 `left`를 많이 쓴다. 기본값인 `inner`를 무심코 쓰다가 행이 조용히 사라지는 사고가 자주 나니, merge 전후로 `len(df)`를 찍어보는 습관이 좋다.

결과가 원본보다 길어지는 데도 이유가 있다. 고객 6명과 주문 10건을 붙였는데 결과가 9~12행인 건 1:N 관계라서다. 영희(1번)는 주문이 3건이라 영희의 줄이 3번 복제된다. 양쪽 다 중복 키가 있으면 곱셈으로 늘어난다(3건 × 2건 = 6행). 관계가 예상과 다를 때 에러를 내주는 `validate='one_to_many'` 옵션도 있다. 그리고 두 표에 같은 이름의 열이 있으면 결과에 `name_x`, `name_y`처럼 `_x`, `_y`가 붙는데, `suffixes=('_고객', '_주문')`으로 이름을 정할 수 있다.

### index로 합치기와 join

```python
cust1 = customer.set_index('customer_id')
order1 = orders.set_index('customer_id')

pd.merge(cust1, order1, left_index=True, right_index=True)   # index 기준
cust1.join(order1)                                           # 기본이 index 기준 left join
cust1.join(order1, how='inner')
```

컬럼이 아니라 index로 맞출 때는 `left_index=`, `right_index=`를 쓴다. `join()`은 속으로 `merge`를 부르는데 기본값이 다르다.

| 함수 | 기본 기준 | 기본 how |
|---|---|---|
| `pd.merge()` | 같은 이름의 컬럼 | `inner` |
| `df.join()` | index | `left` |

이름만 보고 같은 걸로 생각하면 결과가 달라진다.

SQL을 배울 때 썼던 것과 그대로 대응된다.

| SQL | pandas |
|---|---|
| `ORDER BY` | `sort_values()` |
| `GROUP BY` | `groupby()` |
| `INNER JOIN` | `pd.merge(..., how='inner')` |
| `LEFT OUTER JOIN` | `pd.merge(..., how='left')` |
| `UNION ALL` | `pd.concat()` |

### 합쳐서 답하기 - 도전 문제

```python
# 가장 많이 팔린 아이템은?
orders.groupby('item')['quantity'].agg('sum').sort_values(ascending=False).head(1)
# 수건    5

# 영희가 가장 많이 산 아이템은?
result = pd.merge(customer, orders, on='customer_id')
result[result['name'] == '영희'].groupby('item')['quantity'].sum().sort_values(ascending=False).head(1)
# 치약    4
```

두 번째 문제가 오늘 배운 것의 종합이었다. 이름은 customer 표에, 구매 내역은 orders 표에 있으니 합치지 않으면 답할 수 없다. merge로 합치고 → 영희 행만 거르고 → item으로 묶어서 → quantity를 더하고 → 정렬해서 → 1등만 남긴다. 점 하나가 문장의 쉼표처럼 한 단계씩 좁혀가는 이 방식을 **메서드 체이닝**이라고 하고, pandas 코드는 대개 이 모양이다.

체인이 길어지면 바깥을 괄호로 감싸서 줄을 나눌 수 있다.

```python
top = (
    result[result['name'] == '영희']
    .groupby('item')['quantity']
    .sum()
    .sort_values(ascending=False)
    .head(1)
)
```

## FinanceDataReader - 주가 데이터를 코드로 받아오기
분석을 연습하려면 데이터가 필요한데, 주가를 웹에서 복사해 엑셀에 붙이는 건 매번 손이 간다. FinanceDataReader는 그걸 함수 하나로 해준다.

```python
import FinanceDataReader as fdr

fdr.DataReader('AAPL', '2026-08-01')                       # 미국 주식 (시작일부터 오늘까지)
fdr.DataReader('KRX:005930', '2026-07-01', '2026-08-01')   # 한국 주식 (삼성전자)
fdr.DataReader('KS11', '2026-07-01', '2026-07-31')         # 코스피 지수
fdr.DataReader('USD/KRW', '2026-07-01', '2026-07-31')      # 환율
```

심볼만 바꾸면 주식, 지수, 환율이 같은 함수로 나오고, 결과는 전부 날짜가 index인 DataFrame이라 지금까지 배운 pandas가 그대로 통한다. 다만 종류마다 컬럼이 조금씩 달라서(한국 주식에는 전일 대비 등락률 `Change`가 있다) 받아오면 `df.columns`부터 찍어보는 게 안전하다.

수업에서 `exchange='KRX'` 인자를 줬더니 "`exchange` 인자는 deprecated이니 `'KRX:005930'`처럼 심볼에 붙여 써라"는 안내가 떴다. 같은 숫자 코드가 시장마다 다른 대상을 가리킬 수 있어서 거래소를 심볼 앞에 붙이는 방식으로 바뀐 것이다. deprecated는 "아직 되지만 곧 없앨 예정"이라는 뜻이라 당장은 돌아가서 넘어가기 쉬운데, 다음 버전에서 갑자기 안 되는 코드는 대부분 이렇게 시작된다. 인터넷 예제를 따라 하다 이런 경고가 뜨면 그 예제가 옛날 것이라는 신호다.

```python
listing = fdr.StockListing('KRX')                   # 코스피·코스닥·코넥스 전 종목
listing[listing.Name == '삼성전자'].Code.iloc[0]      # '005930'
```

종목 목록에는 코드와 이름이 같이 들어 있어서 이름으로 코드를 찾을 때 쓴다. 그리고 심볼에 오타가 있거나 상장 전 기간을 요청하면 에러가 아니라 빈 DataFrame이 오니 `df.empty`나 `len(df)`로 확인한다.

## DB 테이블을 DataFrame으로 - read_sql
회사 데이터는 대부분 파일이 아니라 DB에 있다. 매번 DB 도구로 쿼리를 돌려 CSV로 내보내고 다시 읽는 건 번거로운데, `read_sql`이 그 중간 단계를 없앤다.

```python
from sqlalchemy import create_engine

engine = create_engine("mysql+pymysql://아이디:비밀번호@localhost/sakila?charset=utf8")
df_payment = pd.read_sql("SELECT * FROM payment", engine)
df_payment.info()
```

연결 문자열은 `DB종류+드라이버://아이디:비밀번호@주소/DB이름?옵션` 순서다. `charset=utf8`이 없으면 한글이 깨질 수 있다. 층이 셋이라는 것도 알아뒀다.

| 이름 | 하는 일 | 비유 |
|---|---|---|
| pandas | 받아온 결과를 표로 다룬다 | 손님 |
| SQLAlchemy | 연결을 만들고 관리한다 | 통역사 |
| pymysql | MySQL과 실제로 주고받는다 | 전화선 |

그래서 `pymysql`을 안 깔면 SQLAlchemy가 있어도 `ModuleNotFoundError: No module named 'pymysql'`이 난다. 그리고 `create_engine()`은 이름과 달리 이 시점에 접속하지 않고 접속 정보를 담은 객체만 만든다. 실제 연결은 첫 쿼리에서 열려서, 비밀번호를 틀려도 `create_engine` 줄이 아니라 `read_sql`에서 에러가 난다.

`read_sql`은 테이블 이름이 아니라 쿼리를 받아서 `SHOW TABLES` 같은 것도 DataFrame으로 받을 수 있다. `info()`를 찍어보면 `payment_date`가 날짜형(`datetime64`)으로 들어와 있다. DB가 컬럼 타입을 알려주기 때문이다. 같은 데이터를 CSV로 저장했다 다시 읽으면 CSV에는 타입 정보가 없어서 문자열이 된다.

수업에서는 테이블 전부를 CSV로 떠 뒀다. 다음 실습을 DB 서버 없이 돌리기 위해서다.

```python
table_names = pd.read_sql('SHOW TABLES', engine).iloc[:, 0]   # 첫 컬럼 = 테이블 이름들

for table_name in table_names:
    table_df = pd.read_sql(f"SELECT * FROM {table_name}", engine)
    table_df.to_csv(csv_path, index=False, encoding='utf8')

engine.dispose()   # 연결 반납
```

`SHOW TABLES` 결과의 컬럼 이름은 `Tables_in_sakila`처럼 DB 이름에 따라 달라져서 `.iloc[:, 0]`으로 위치로 집었다. `index=False`를 안 주면 0, 1, 2... index가 이름 없는 컬럼으로 저장돼서 다시 읽을 때 `Unnamed: 0`이 생긴다. `engine.dispose()`는 열어둔 연결을 반납한다.

f-string으로 쿼리를 조립한 건 테이블 이름 목록을 DB에서 직접 받아왔기 때문에 괜찮은 것이다. 사용자가 입력한 값을 이렇게 끼워 넣으면 SQL 인젝션이 되니, 값은 `params=`로 넘긴다. 큰 테이블은 `SELECT *`로 통째로 읽지 말고 필요한 컬럼과 기간을 SQL에서 먼저 걸러오는 게 좋다. 줄일 수 있는 건 최대한 SQL에서 줄인다. 그리고 비밀번호는 코드에 쓰지 말고 `.env`로 빼야 한다. 백엔드 수업에서 했던 것과 같다.

## groupby - Split, Apply, Combine
"일별 매출", "고객별 결제 횟수", "카테고리별 상위 3개"처럼 실무 요구사항은 대부분 "OO별 XX" 모양이다. 파이썬만으로 짜면 dict에 그룹별로 모은 다음 루프를 돌리게 되는데, 조건이 하나 늘 때마다 루프를 통째로 다시 짜야 한다. Hadley Wickham이 이 반복되는 모양을 Split(쪼개기) → Apply(계산하기) → Combine(합치기) 세 단계로 정리했고, pandas의 `groupby`가 그걸 그대로 옮겨놓은 것이다. 그저께 NumPy 실습에서 유저별 평균을 for 문으로 구하면서 느꼈던 불편함을 푸는 도구이기도 하다.

```python
df.groupby('user_id')['rating'].agg(['count', 'mean'])   # 그때 문제를 한 줄로, 데이터를 한 번만 훑는다
```

### Split - groupby()는 아직 아무것도 계산하지 않는다

```python
group = df.groupby('팀')     # 여기서는 계산이 일어나지 않는다

group.size()                 # A 3, B 2, C 3   그룹별 행 개수
group.get_group('A')         # A팀만 뽑은 DataFrame (안을 들여다보는 용도)
```

책상에 흩어진 카드를 팀별로 나눠 쌓아만 둔 상태다. 실제로는 `DataFrameGroupBy`라는 객체가 하나 만들어질 뿐이고, 계산은 뒤에 무엇을 붙이느냐에 따라 그때 일어난다. 그래서 `groupby()`만 찍어보면 아무것도 안 보이는 게 정상이고, 변수에 담아두고 여러 계산에 재사용할 수 있다.

대괄호 개수가 결과 모양을 정하는 것도 지금까지와 같다.

```python
group['점수']                       # SeriesGroupBy    → 결과가 Series
group[['점수']]                     # DataFrameGroupBy → 결과가 DataFrame
group['점수'].agg(['mean'])          # 집계 함수를 리스트로 주면 Series여도 DataFrame
group['점수'].agg(['mean', 'sum'])   # 컬럼 2개짜리 DataFrame
```

### Apply - 네 갈래는 "몇 행이 나오는가"로 갈린다
오늘 groupby에서 가장 중요한 표다.

| 함수 | 입력 N개 → 출력 | 언제 | 비유 |
|---|---|---|---|
| `agg()` | 1개 | 그룹당 한 줄로 요약 | 반별 평균 점수표 만들기 |
| `transform()` | N개 (그대로) | 원본 옆에 붙일 값 만들기 | 학생마다 자기 반 평균을 옆에 적기 |
| `filter()` | N개 이하 | 그룹을 통째로 남기거나 버리기 | 평균 50점 이상인 반만 남기기 |
| `apply()` | 아무거나 | 위로 안 되는 자유로운 계산 | 반별로 정렬해서 상위 3명 뽑기 |

`apply()` 하나로 넷 다 흉내낼 수 있지만, 전용 함수를 쓰면 읽는 사람이 결과 모양을 미리 알 수 있다. 속도도 문자열로 준 집계(`agg('mean')`)는 pandas 내부의 최적화된 코드로 돌고, `apply(lambda ...)`는 그룹마다 파이썬 함수를 호출해서 느리다. 되면 전용 함수, 안 되면 `apply` 순서로 고른다.

### agg - 이름 붙이기까지 한 세트

```python
group['점수'].agg('mean')                   # 함수 하나
group['점수'].agg(['mean', 'sum', 'max'])   # 여러 개
group[df.columns].agg({                     # 컬럼마다 다른 함수 (dict)
    '점수': ['sum', 'mean'],
    '어시스트': ['count'],
    '선수': lambda x: ','.join(x),
})
```

dict 방식을 쓰면 컬럼 제목이 두 층으로 쌓인다. 위층은 어느 컬럼에서 나왔는지, 아래층은 무슨 연산이었는지다. 수업에서는 `.rename(...)`으로 이름을 바꾸고 `.droplevel(0, axis=1)`로 위층을 떼어 평평하게 만들었다.

그런데 람다는 이름이 없어서 pandas가 `<lambda>`라는 임시 이름을 붙이고, 람다가 둘 이상이면 `<lambda_0>`, `<lambda_1>`로 번호가 붙는다. `rename`은 없는 키를 만나도 에러 없이 지나가서 이름이 안 바뀐 채 코드가 계속 돈다. 그래서 자료가 바로 권한 게 **named aggregation**이다.

```python
group.agg(
    점수합계=('점수', 'sum'),
    점수평균=('점수', 'mean'),
    선수들=('선수', lambda x: ','.join(x)),
)
```

왼쪽이 내가 원하는 결과 컬럼 이름, 오른쪽 튜플이 (어느 컬럼, 어떤 연산)이다. 2층 컬럼이 아예 안 생기니 `rename`도 `droplevel`도 필요 없다.

### transform - 원본에 붙일 수 있는 건 이것뿐

```python
group['점수'].agg('mean')        # 3행 (A, B, C)
group['점수'].transform('mean')  # 8행, 각 행에 자기 팀 평균이 채워진다

df['팀별_평균점수'] = group['점수'].transform('mean')
df['평균대비점수'] = df['점수'] - df['팀별_평균점수']
```

`agg`가 반별 평균표를 따로 만드는 것이라면, `transform`은 학생 명단 옆 칸에 자기 반 평균을 적어 넣는 것이다. 행 수가 원본과 같으니 바로 컬럼이 되고, 컬럼이 되면 "팀 평균보다 몇 점 높은가" 같은 행 단위 비교가 가능해진다. 결측값을 그룹 평균으로 채우는 것도 이 모양이다.

여기서 가장 조용한 버그가 나온다. `transform` 자리에 `agg`를 쓰면 에러 없이 전부 NaN이 된다. `agg` 결과는 index가 팀 이름(A, B, C)인 3행짜리인데 원본 index는 0~7이라 겹치는 게 없기 때문이다. 어제 배운 대로 pandas는 Series를 대입할 때 순서가 아니라 index로 짝을 맞춘다. 길이가 아니라 index가 맞아야 붙는다.

### filter - 판정은 그룹 단위, 결과는 행 단위

```python
group.filter(lambda x: x['점수'].mean() >= 15)
# A팀 3행 + B팀 2행이 통째로 남고, C팀(평균 10.0) 3행이 통째로 빠진다
```

조건은 그룹당 True/False 하나로 답해야 하고, 통과한 그룹은 집계값이 아니라 원본 행 전부가 남는다. "결제 30회 이상인 단골들의 결제 내역을 전부 뽑아라" 같은 요구가 정확히 이 모양이다.

`lambda x`의 `x`에 무엇이 들어오는지는 어디에 붙였느냐로 정해진다. `group.filter(lambda x: ...)`의 `x`는 그룹 하나의 DataFrame이고, `group['선수'].agg(lambda x: ...)`의 `x`는 그 그룹의 한 컬럼(Series)이다. 헷갈리면 `lambda x: type(x)`를 먼저 돌려보는 게 가장 빠르다. 수업에서도 여러 번 이 방법을 썼다.

### apply - 같은 이름, 붙는 곳마다 다른 동작
`apply`는 이름 하나에 동작이 여러 개라 가장 헷갈렸다.

| 어디에 붙였나 | 함수에 들어오는 것 | 결과 |
|---|---|---|
| `Series.apply()` | 원소 하나 (숫자, 문자) | 값 하나면 Series, 여러 개면 DataFrame |
| `DataFrame.apply(axis=0)` | 각 열(Series) | 열마다 결과 하나 |
| `DataFrame.apply(axis=1)` | 각 행(Series) | 행마다 결과 하나 |
| `GroupBy.apply()` | 그룹 하나 | 자유 |

```python
s.apply(lambda x: x ** 2)   # 원소당 값 1개 → Series
s.apply(lambda x: pd.Series([x, x**2, x**3], ['x', 'x^2', 'x^3']))
#    x  x^2  x^3   ← 원소당 여러 값이면 가로로 펼쳐져 DataFrame
```

하나를 돌려주면 세로로 쌓이고, 여러 개를 돌려주면 가로로 펼쳐진다. 한 번에 파생 컬럼 여러 개를 만들 때 쓴다.

`df.apply(np.sum, axis=1)`을 돌렸다가 `TypeError: can only concatenate str (not "int") to str`가 났다. `axis=1`은 한 행을 통째로 넘기는데 그 행에 문자열('팀', '선수')과 숫자가 섞여 있어서다. `df[['점수', '어시스트']].apply(np.sum, axis=1)`처럼 숫자 컬럼만 넘기면 된다.

수업 코드에서 `group.apply(...)` 대신 `group[df.columns].apply(...)`라고 쓴 곳이 여러 번 나왔다. 그룹을 나눈 기준 컬럼('팀')이 함수에 들어오는지는 pandas 버전에 따라 달라서, 그 컬럼까지 포함해서 넘겨달라고 명시한 것이다. 그리고 `agg` 결과는 그룹 키가 index로 올라가 있어서 이어서 필터링하거나 병합하기 불편할 때가 있는데, `df.groupby('팀', as_index=False)`나 결과에 `.reset_index()`를 붙이면 평범한 컬럼으로 돌아온다.

### 실습 - 월별 × 일별 매출
DB에서 떠 둔 `payment.csv`로 월별, 일별 결제 건수와 금액을 구했다. 날짜 문자열 `'2005-05-25 11:30:37'`을 잘라서 월(`[:7]`)과 일(`[:10]`)을 만들고 그 둘로 그룹을 나눴다.

```python
# ① 컬럼으로 만들어서 이름으로 묶기
df['month'] = df.payment_date.transform(lambda d: str(d)[:7])
df['date']  = df.payment_date.transform(lambda d: str(d)[:10])
df.groupby(['month', 'date'])['amount'].agg(['count', 'sum'])

# ② 컬럼을 안 만들고 Series를 그대로 넘기기
month = df.payment_date.apply(lambda d: str(d)[:7])
date  = df.payment_date.apply(lambda d: str(d)[:10])
df.groupby([month, date]).agg(count=('amount', 'count'), sum=('amount', 'sum'))
```

`groupby()`는 컬럼 이름만 받는 게 아니라 행마다 그룹 라벨이 담긴 Series도 받는다. ②는 원본을 건드리지 않아 깔끔하지만 결과 index 이름이 둘 다 `payment_date`로 나온다. 넘긴 Series의 이름을 그대로 쓰기 때문이라 `month.rename('월')`처럼 미리 이름을 붙이면 된다. Series에 직접 붙일 때는 `transform`과 `apply`가 둘 다 원소마다 함수를 돌려서 결과가 같았다. 둘의 차이는 `groupby()` 뒤에 붙을 때만 드러난다.

날짜를 문자열로 잘라 쓴 건 CSV로 읽어서 문자열이었기 때문이다. 날짜형으로 바꾸면 정렬이 시간 순서로 되고 요일이나 주차도 바로 뽑을 수 있다.

```python
df['payment_date'] = pd.to_datetime(df['payment_date'])
df.groupby([df.payment_date.dt.to_period('M'), df.payment_date.dt.date])
```

## 헷갈리기 쉬운 부분
- `pivot`은 (index, columns) 짝이 중복되면 `ValueError`가 난다. 중복이 있을 수 있으면 `pivot_table`을 쓴다.
- `stack`, `unstack`의 `level=`은 0이 가장 바깥, -1이 가장 안쪽(기본)이다.
- `concat`은 index를 다시 매기지 않는다. `ignore_index=True`를 준다.
- `merge`의 기본은 `inner`라서 한쪽에만 있는 행이 말없이 사라진다. 대개 원하는 건 `how='left'`다.
- merge하면 1:N 관계에서 행이 늘어난다. 전후로 `len(df)`를 확인한다.
- `join`은 index 기준 left, `merge`는 컬럼 기준 inner가 기본이다.
- FinanceDataReader의 `exchange=` 인자는 deprecated다. `'KRX:005930'`처럼 심볼에 붙인다.
- `create_engine()`이 통과했다고 연결된 게 아니다. 접속 오류는 첫 쿼리에서 드러난다.
- CSV로 저장했다 읽으면 날짜가 문자열이 된다. `pd.to_datetime()`이나 `parse_dates=`로 되돌린다.
- `groupby()`는 아직 계산하지 않은 상태다. 뒤에 `agg`, `transform`, `filter`, `apply`를 붙여야 결과가 나온다.
- `agg` 결과를 원본 컬럼에 대입하면 에러 없이 전부 NaN이 된다. 원본에 붙일 값은 `transform`으로 만든다.
- 람다가 여러 개면 `<lambda_0>`처럼 이름이 바뀌어 `rename`이 조용히 실패한다. named aggregation을 쓴다.

## 오늘 배운 내용 정리
오늘은 표를 정렬하고, 모양을 바꾸고, 합치고, 그룹으로 나눠 계산하는 법을 배웠다.

```
정렬: sort_values(by=[...], ascending=[...]), 상위 N개는 nlargest.
pivot: 긴 표 → 격자표. 중복이 있으면 에러. pivot_table은 aggfunc로 집계해서 채운다.
stack / unstack: 컬럼 → index (길게) / index → 컬럼 (넓게). 계산은 긴 표, 보여주기는 넓은 표.
concat: 그냥 이어 붙이기. ignore_index=True, 컬럼 이름이 다르면 NaN 대각선.
merge: 키로 짝짓기(SQL JOIN). how = inner(기본) / left / right / outer. 1:N이면 행이 늘어난다.
join: index 기준 left join.
FinanceDataReader: fdr.DataReader('KRX:005930', 시작일, 종료일). 날짜가 index인 DataFrame.
read_sql: create_engine("mysql+pymysql://...") + pd.read_sql(쿼리, engine). 접속은 첫 쿼리에서.
groupby: Split(나누기만) → Apply → Combine.
  agg       N → 1      그룹당 한 줄. named aggregation으로 이름까지.
  transform N → N      원본에 컬럼으로 붙일 수 있는 유일한 것.
  filter    N → N 이하 그룹을 통째로 남기거나 버린다.
  apply     N → 자유   나머지 전부.
```

그저께 for 문으로 유저마다 10만 줄을 다시 훑었던 계산이 `groupby` 한 줄로 끝나는 걸 보니, 왜 그때 "좋은 방법은 아니다"라고 했는지 알 것 같았다. 특히 `agg`와 `transform`의 차이를 "결과가 몇 행이어야 하는가"로 고른다는 기준과, `agg` 결과를 대입하면 index가 안 맞아서 조용히 NaN이 된다는 점이 가장 기억에 남았다.

---
