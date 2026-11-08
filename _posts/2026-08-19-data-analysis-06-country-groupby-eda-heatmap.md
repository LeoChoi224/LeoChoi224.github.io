---
layout: single
title: "데이터 분석 기초 정리 6 - 국가 데이터 groupby, 학생 성적 EDA, 상관계수 히트맵"
categories: [coding, DataAnalysis]
tag: [study-log, DataAnalysis, pandas, groupby, transform, EDA, seaborn, heatmap, multicollinearity]
toc: true
author_profile: false
sidebar:
    nav: "docs"
search: true
---
<hr/>

오늘은 데이터 분석 단원의 마지막 날이었다. 오전에는 국가 데이터로 조건 필터와 대륙별 groupby를 연습했고, 학생 성적 데이터로 평가 EDA를 했고, 어제 시작한 롤 데이터 EDA를 상관계수 히트맵으로 마무리했다. 지금까지 배운 도구가 하루에 다 나왔다.

## 국가 데이터 - 거르고, 정렬하고, 파일로 남기기
`country.csv`는 MySQL 공식 예제 DB인 World 데이터베이스의 `country` 테이블을 그대로 내려받은 것이다. 239개국 × 15개 컬럼이다.

| 컬럼 | 뜻 |
|---|---|
| `Code` | 3글자 국가 코드 (`KOR`). Primary Key |
| `Name` | 국가명 (`South Korea`) |
| `Continent` | 대륙. Asia, Europe, North America, Africa, Oceania, Antarctica, South America 중 하나 |
| `Region` | 세부 지역 (`Eastern Asia`) |
| `SurfaceArea` | 면적 (㎢) |
| `Population` | 인구수 |
| `GNP` | 국민총생산 (백만 달러) |
| `IndepYear` | 독립 연도 |
| `Capital` | 수도 도시 ID. `city` 테이블을 가리키는 Foreign Key |

CSV로 받아도 DB 용어가 쓸모 있다. Primary Key인 `Code`는 절대 중복되지 않으니 `set_index('Code')`로 index 삼기 좋고, Foreign Key인 `Capital`은 다른 표를 가리키는 번호라 수도 이름을 알려면 `city` 표와 merge해야 한다는 신호다.

`info()`를 보면 `IndepYear`가 192개만 있어서 47개국이 비어 있다. 자료의 컬럼 설명에 "독립하지 않았거나 정보가 없는 경우"라고 적혀 있다. 아직 자치령인 곳은 독립 연도가 없는 게 맞으니, 여기를 평균으로 채우면 오히려 거짓말이 된다. 결측치를 보면 왜 비었는지부터 묻는 습관이 필요하다.

### 기준값을 먼저 꺼낸다

```python
len(df[df.Continent == 'Africa'])                        # 58
df[df.Continent == "Africa"].Population.mean().item()    # 13525431.03
```

"아시아에서 한국보다 인구가 많은 나라"를 구하려면 한국 인구가 숫자 하나로 있어야 한다. 먼저 이 표에서 한국을 뭐라고 부르는지 확인했다. 이름을 정확히 모르면 조건이 에러 없이 아무것도 안 걸러낸다.

```python
list(filter(lambda x: "KOREA" in x.upper(), df.Name))     # ['South Korea', 'North Korea']
df[df.Name.str.contains('Korea', case=False)]             # pandas 방식. 표로 나와서 인구까지 보인다

kor_population = df[df.Name == 'South Korea'].Population.item()
```

`df[조건].Population`은 행이 하나뿐이어도 Series라서, 그대로 비교에 쓰면 index로 짝을 맞추려 들어서 엉뚱해진다. `.item()`은 "값이 딱 하나이니 그것만 꺼내라"는 뜻이다. 값을 하나 꺼내는 방법은 여러 개인데 성격이 다르다.

| 방법 | 값이 2개 이상이면 |
|---|---|
| `.item()` | 에러가 난다 |
| `.iloc[0]` | 조용히 첫 번째 것을 준다 |
| `.values[0]` | 조용히 첫 번째 것을 준다 |

`.item()`이 에러를 내는 게 오히려 장점이다. "하나일 줄 알았는데 둘이었다"를 그 자리에서 알려준다.

### 걸러서 → 열 고르고 → 정렬하고 → 번호 매기기

```python
df_asia = df[df.Continent == 'Asia']

df_result = df_asia[df_asia.Population > kor_population][['Name', 'Population']]
df_result.sort_values('Population', ascending=False, inplace=True)
df_result.reset_index(inplace=True, drop=True)
df_result.index += 1
```

| 줄 | 하는 일 | 이 시점의 index |
|---|---|---|
| `df_asia[조건][['Name', 'Population']]` | 행 거르고 열 고르기 | 원본 번호 (41, 77, ...) |
| `sort_values(..., ascending=False)` | 인구 많은 순 정렬 | 원본 번호가 따라다닌다 |
| `reset_index(drop=True)` | 번호를 0부터 다시 | 0, 1, 2, ... |
| `df.index += 1` | 전체에 1 더하기 | 1, 2, 3, ... |

`df.index += 1`이 처음 나왔다. index도 배열이라 브로드캐스팅이 그대로 통한다. 프로그래머는 0부터 세지만 보고서를 받는 사람은 1부터 세니, 그 간극을 마지막에 메우는 것이다. `reset_index()`에서 `drop=True`를 빼면 원본 번호가 `index`라는 새 열로 남는다.

수업 코드가 세 줄로 나뉜 이유도 있다. `inplace=True`는 `None`을 돌려주기 때문에 `df.sort_values(..., inplace=True).reset_index()`처럼 이어 쓰면 그 순간 에러가 난다. 결과를 다시 받는 방식으로 쓰면 한 덩어리로 이어 쓸 수 있다.

```python
df_result = (df_asia[df_asia.Population > kor_population][['Name', 'Population']]
             .sort_values('Population', ascending=False)
             .reset_index(drop=True))
df_result.index += 1
```

조건이 길어지면 `query()`로 쓰면 읽기 쉽다. `df.query("Continent == 'Asia' and Population > @kor_population")`처럼 `@변수명`으로 바깥 변수를 참조하고, boolean mask와 달리 `and`, `or`를 그대로 쓸 수 있다.

### 기준이 "그룹 안 평균"일 때

```python
df_south = df[df.Continent == 'South America']
df_south[df_south.SurfaceArea < df_south.SurfaceArea.mean()][['Name', 'SurfaceArea']]
```

이 실습에서 제일 틀리기 쉬운 지점이었다. "남미 국가 중 남미 평균보다 작은 나라"라서 `df_south.SurfaceArea.mean()`이어야 하고, `df.SurfaceArea.mean()`(전 세계 평균)을 쓰면 답이 달라진다. 필터의 기준값이 전체인지 그룹 안인지를 항상 확인해야 한다. 이걸 모든 대륙에 대해 한꺼번에 하는 방법이 아래의 `transform`이다.

### CSV로 저장하기

```python
import os
os.makedirs('out', exist_ok=True)                     # 폴더가 없으면 만들고, 있으면 넘어간다
df_result.to_csv('./out/country_3.csv', index=False)  # 왼쪽 번호 열은 빼고 저장
```

없는 폴더에 저장하면 `FileNotFoundError`가 난다. 그리고 index를 저장한 CSV를 다시 읽으면 그 번호가 `Unnamed: 0`이라는 열로 따라온다. 저장할 때 `index=False`를 주거나 읽을 때 `index_col=0`을 주면 된다.

## 대륙별로 묶어서 답하기 - groupby 실전
"남미에서 남미 평균보다 작은 나라"를 7개 대륙 전부에 대해 하려면 대륙마다 두 줄을 복사할 수는 없다. "OO별로"라는 말이 붙으면 groupby다.

### 대륙별 인구수와 국가수 - agg

```python
df.groupby('Continent').agg(
    인구수=('Population', 'sum'),
    국가수=('Name', 'count'),
).sort_values('인구수', ascending=False)
```

```
                      인구수  국가수
Continent
Asia           3705025700   51
Africa          784475000   58
Europe          730074600   46
North America   482993000   37
South America   345780000   14
Oceania          30401150   28
Antarctica              0    5
```

named aggregation이라 한글 컬럼 이름을 그대로 쓸 수 있어서 보고서 만들 때 편하다. 아프리카는 국가 수가 가장 많은데 인구는 아시아의 1/5 정도이고, 남극은 국가 5개에 인구가 0이다. 평균이나 비율을 낼 때 0으로 나누기가 생기거나 그래프가 찌그러질 수 있어서, "이 행이 진짜 분석 대상인가"를 묻는 것도 전처리의 일부다.

`count`는 NaN을 뺀 개수라서, `Name`처럼 결측이 없는 컬럼이면 행 수와 같지만 결측이 있는 컬럼으로 세면 더 작게 나온다. 순수하게 행 수를 세려면 `size()`를 쓴다.

| 함수 | 세는 것 | NaN |
|---|---|---|
| `size()` | 행 수 | 포함 |
| `count()` | 값이 있는 개수 | 제외 |

### 컬럼이 아닌 기준으로 묶기 - 이름 첫 글자별 국가 수

```python
df.groupby(df.Name.apply(lambda x: x[0].upper())).size()
# Name
# A    15
# B    20
# C    22
# ...
```

"이름 첫 글자"라는 열은 표에 없다. 그 자리에서 만들어서 groupby에 바로 넘긴 것이다. 결제 데이터에서 날짜를 잘라 월로 묶었던 것과 같은 발상으로, 길이와 index가 원본과 같으면 groupby는 그걸 그룹 라벨로 받아들인다. 결과 index 이름이 `Name`으로 나오는 건 만든 Series가 원래 이름을 물려받아서라, `df.Name.str[0].str.upper().rename('첫글자')`처럼 이름을 붙여주면 덜 헷갈린다. `.str`을 쓰는 쪽이 `apply`보다 빠르기도 하다.

### 대륙별 인구 1위 국가 - apply

```python
df.groupby('Continent').apply(
    lambda cont_df: cont_df.sort_values('Population', ascending=False).head(1)
)[['Name', 'Population']]
```

```
                                    Name  Population
Continent
Africa        155              Nigeria    111506000
Asia          41                 China   1277558000
Europe        181   Russian Federation    146934000
North America 223        United States    278357000
Oceania       14             Australia     18886000
South America 30                Brazil    170115000
...
```

`agg`로는 안 되는 문제다. `agg`는 컬럼별로 값 하나씩만 만들 수 있어서 `Population`의 최댓값은 구해도 그게 어느 나라인지는 알 수 없다. `apply`에는 그룹 하나가 통째로 DataFrame으로 들어오니 그 안에서 정렬하고 첫 줄을 뽑을 수 있다. `head(1)` 앞에 정렬이 없으면 1위가 아니라 그냥 첫 번째 나라가 나온다. 결과 index가 (대륙, 원본 번호) 두 겹이 된 건 `apply`가 그룹 키를 한 겹 더 씌우기 때문이다.

같은 결과를 더 짧게 얻는 방법도 있다.

```python
idx = df.groupby('Continent')['Population'].idxmax()    # 각 그룹 최댓값의 행 번호
df.loc[idx, ['Continent', 'Name', 'Population']]

df.sort_values('Population', ascending=False).groupby('Continent').head(1)
```

### 여러 컬럼에 다른 집계 - dict 방식

```python
df.groupby('Continent').agg({
    'Population': ['sum', 'mean'],
    'SurfaceArea': 'sum',
})
#               Population               SurfaceArea
#                      sum          mean         sum
```

컬럼 하나에 계산을 여러 개 걸 때 쓰는데, 결과 컬럼이 2단이 되어 나중에 `df['Population']['sum']`처럼 두 번 파고들어야 한다. 계속 쓸 결과라면 `인구합계=('Population', 'sum'), 인구평균=('Population', 'mean')`처럼 named aggregation으로 쓰면 처음부터 1단으로 나온다. 같은 컬럼을 여러 번 써도 된다.

### 대륙 평균보다 GNP가 높은 나라 - transform
오늘 groupby의 핵심이고, 남미 문제를 모든 대륙에 대해 푼 것이다.

```python
df['GNP_mean'] = df.groupby('Continent')['GNP'].transform('mean')

df[['Continent', 'Name', 'GNP', 'GNP_mean']].head()
#        Continent         Name     GNP       GNP_mean
# 0  North America        Aruba   828.0  261854.789189
# 1           Asia  Afghanistan  5976.0  150105.725490
# 2         Africa       Angola  6648.0   10006.465517
```

각 나라 옆에 자기 대륙의 평균 GNP를 도장 찍어준 것이다. `agg` 결과는 7행이라 239행짜리 원본에 붙지 않지만, `transform`은 원본과 같은 239행, 같은 index로 돌려줘서 그대로 컬럼이 된다. 붙이고 나면 비교는 평범한 boolean selection이다.

```python
(df.loc[df.GNP > df.GNP_mean, ['Continent', 'Name', 'GNP', 'GNP_mean']]
   .sort_values(['Continent', 'GNP'], ascending=[True, False]))
#      Continent           Name       GNP      GNP_mean
# 236     Africa   South Africa  116729.0  10006.465517
# 63      Africa          Egypt   82710.0  10006.465517
```

정렬 기준이 둘이고 방향이 달라서 `ascending=[True, False]`로 대륙명은 오름차순, GNP는 내림차순으로 줬다. 대륙 안 비중(`df.GNP / 그룹 합계`)이나 대륙 안 순위(`df.groupby('Continent')['GNP'].rank(ascending=False)`)도 같은 모양의 계산이다.

| 질문 | 결과 행 수 | 도구 |
|---|---|---|
| 대륙별 인구, 국가 수 | 7 (그룹당 1) | `agg` |
| 첫 글자별 국가 수 | 그룹당 1 | `size` |
| 대륙별 1위 국가 | 그룹당 1이지만 행 전체 | `apply` |
| 대륙 평균보다 높은 나라 | 원본과 같은 239 → 걸러서 일부 | `transform` + boolean |

결과가 몇 행이어야 하는지를 먼저 정하면 도구가 정해진다는 원칙이 오늘도 그대로였다.

## 학생 성적 EDA - "우리 애는 머리는 좋은데, 공부를 안 해서 그래요"
평가로 학생 성적 데이터 EDA를 했다. 제목이 그대로 가설이다. 부모들이 흔히 하는 말이 맞는지 데이터로 확인해보는 것이다. "머리"는 데이터에 없지만 손 들기, 자료 보기, 공지 확인, 토론 참여 같은 공부하는 행동은 있다.

xAPI-Edu-Data는 학습관리시스템(LMS)에 쌓인 학생 480명의 행동 기록이고 컬럼이 17개다.

| 종류 | 컬럼 | 뜻 |
|---|---|---|
| 행동 (수치형) | `raisedhands` | 수업 중 손 든 횟수 |
| | `VisITedResources` | 강의 자료를 열어본 횟수 |
| | `AnnouncementsView` | 공지를 확인한 횟수 |
| | `Discussion` | 토론 그룹에 참여한 횟수 |
| 배경 (범주형) | `gender`, `NationalITy`, `Topic` 등 | 성별, 국적, 과목, 학년, 반, 학기 |
| 보호자 (범주형) | `Relation`, `ParentAnsweringSurvey` | 주 보호자, 부모가 학교 설문에 응답했는지 |
| 타깃 | `Class` | 성적 등급 L(낮음) / M(보통) / H(높음) |

`NationalITy`, `VisITedResources`처럼 `IT`가 대문자로 튀어 있는데 오타가 아니라 실제 컬럼 이름이다. `df.Nationality`로 치면 에러가 나니 `df.columns`를 찍어서 복사해 쓰는 게 안전하다.

심부전증과 구조는 같은데 타깃이 0/1 두 종류가 아니라 L/M/H 세 종류라 판정이 한 단계 세밀해진다. "갈리나 안 갈리나"가 아니라 "어느 쌍이 갈리나(L과 H는? M과 H는?)"를 봐야 한다.

### 기초 통계
480행 전부 non-null이라 결측치가 없었다. 연구용 데이터는 잘 정리되어 있다. 수치형은 행동 4개뿐이고 나머지 13개는 문자열이다. 심부전증 때는 "int인데 범주형인 것"을 골라내야 했는데, 이번에는 int인 컬럼이 전부 진짜 수치형이었다. 수치형 4개는 min이 0 근처, max가 100 근처이고 사분위수가 고르게 벌어져서 특별한 이상치가 없었다.

범주형은 `value_counts()`로 본다.

```python
df['gender'].value_counts()       # M 305, F 175
df['NationalITy'].value_counts()  # KW 179, Jordan 172, ... venzuela 1
df['Class'].value_counts()        # M 211, H 142, L 127
```

쿠웨이트 179명, 요르단 172명인데 베네수엘라는 1명이다. 1명짜리 범주로는 결론을 낼 수 없다. 그 학생이 우연히 H면 "베네수엘라 학생은 100% 성적이 좋다"가 돼버린다. 그래서 그래프를 그리기 전에 `value_counts()`로 믿을 수 있는 범주인지 먼저 확인하고, 표본이 적은 범주는 묶거나 뺀다.

### 수치형 - hue_order로 순서를 못 박기

```python
sns.histplot(x='raisedhands', data=df, hue='Class', hue_order=['L', 'M', 'H'], kde=True)
```

`hue_order`가 새로 나왔다. 안 주면 seaborn이 데이터에 나온 순서대로 색을 배치해서 범례가 `H, L, M`처럼 뒤섞이고 "낮음 → 보통 → 높음"의 흐름이 안 보인다. `Class`는 L < M < H로 순서가 있는 범주라 순서를 직접 정해줘야 그림이 읽힌다.

컬럼마다 관찰한 결과는 이랬다.

- `raisedhands`(손 든 횟수): L은 낮은 쪽, H는 높은 쪽에 몰려 있고 M은 중간에 걸쳐 있다. L과 H는 확실히 가를 수 있지만 M은 애매하다.
- `VisITedResources`(자료 열람): L은 확실히 적고 M과 H는 둘 다 많이 본다. L을 가르는 데는 유용하지만 M과 H를 가르기에는 부족하다.
- `AnnouncementsView`(공지 확인): L은 전부 저조하고, M과 H는 추세가 비슷하다. 성적이 좋은 학생이라도 공지에 관심 없는 경우가 꽤 있지만, 공지에 관심이 많은 학생은 최소한 성적이 나쁘지는 않았다.
- `Discussion`(토론 참여): 예상이 빗나간 컬럼이다. L인 학생들의 참여 비율이 다른 지표에 비해 높고, H인 학생 중에도 참여 안 하는 경우가 제법 있었다. 토론에 참여하면 성적이 좋을 거라는 예상과 달리 사실은 그렇지 않았다.

마지막이 오늘 EDA에서 가장 값진 발견이었다. 예상대로 나온 손 들기는 새로 알게 된 게 없지만, "토론에 많이 참여하면 성적이 좋을 것"이라는 상식이 데이터에서는 아니었다는 게 진짜 정보다. 토론 참여 분포는 봉우리가 두 개인 쌍봉 모양이었는데, 적극적으로 참여하는 부류와 거의 안 하는 부류로 갈리고 그 갈림이 성적과는 맞아떨어지지 않는다는 뜻이다.

### 두 컬럼을 동시에 - jointplot과 pairplot

```python
sns.jointplot(x='VisITedResources', y='raisedhands', data=df,
              hue='Class', hue_order=['L', 'M', 'H'])
sns.pairplot(df, hue='Class', hue_order=['L', 'M', 'H'])
```

2차원으로 보니 H와 L은 확실히 구분되고 L과 M도 비교적 잘 구분됐지만, H와 M은 여기서도 구분하기 어려웠다(오른쪽 위 영역). `pairplot`은 수치형 컬럼의 모든 조합을 격자로 한 번에 그려준다. 4개 컬럼이면 4×4칸에 대각선은 각 컬럼의 분포, 나머지는 두 컬럼의 산점도다. 컬럼이 n개면 n²개를 그리니 컬럼이 많으면 `vars=['a', 'b']`로 추려서 쓴다.

자료에 붙어 있던 주석이 오늘 가장 중요한 한 문장이었다. **무조건 상관이 높다고 좋은 게 아니라, 분석하는 대상(타깃)과 상관이 높은 게 좋은 것이다.**

| 무엇과 무엇 | 상관이 높으면 |
|---|---|
| 컬럼 ↔ 타깃 | 좋다. 예측에 쓸모가 있다 |
| 컬럼 ↔ 컬럼 | 나쁘다. 같은 정보를 중복해 담고 있다 |

feature끼리는 상관이 낮아야 서로 다른 측면을 봐준다. 손 들기와 자료 열람이 어느 정도 독립적이니 둘을 같이 쓰면 도움이 된다는 뜻이다.

### 범주형 - countplot

```python
plt.figure(figsize=(10, 5))
sns.countplot(x='NationalITy', data=df, hue='Class', hue_order=['L', 'M', 'H'])
plt.xticks(rotation=90)      # 범주 이름이 길면 축 글자를 세로로
plt.show()
```

- `gender`: 남학생은 L 쪽으로, 여학생은 H 쪽으로 분포했다. 남학생 수가 더 많아서 막대 높이만 보면 헷갈리지만, 비율로 따지면 여학생이 훨씬 성적이 좋았다.
- `ParentAnsweringSurvey`: 부모가 설문에 응답한 경우는 L이 거의 없고, 응답하지 않은 경우는 L이 많았다. 부모가 얼마나 관심을 갖느냐가 성적과 상당한 상관이 있다고 볼 수 있다.
- `Topic`: IT 과목을 선택한 학생들의 성적이 낮은 비율이 높았고 Biology는 높게 나왔다. 학생들이 어떤 과목을 어려워하는지도 들여다볼 수 있다.

`countplot`의 막대는 개수이지 비율이 아니라서, 남 305명과 여 175명처럼 표본이 다르면 눈으로 비교하면 안 된다. 비율은 `pd.crosstab(df.gender, df.Class, normalize='index')`로 확인할 수 있다.

제목의 가설에 대한 답은 학생의 행동만큼이나 부모의 관여가 성적을 잘 갈랐다는 것이었다. 다만 상관을 인과로 읽으면 안 된다. 부모가 설문에 응답한다고 성적이 오르는 게 아니라, 설문 응답은 부모의 관심을 드러내는 신호일 뿐이다. "IT 과목이 성적을 떨어뜨린다"도 아니라 어떤 학생들이 IT를 고르는지가 섞여 있을 수 있다.

### 범주를 수치로 바꿔서 평균 내기 - map

```python
df['Class_value'] = df['Class'].map(dict(L=-1, M=0, H=1))

gb = df.groupby('Topic')['Class_value'].mean().sort_values()
plt.barh(gb.index, gb)
```

`map`은 dict를 사전 삼아 값을 바꿔치기한다. `apply(lambda x: 사전[x])`와 같은 일인데 pandas가 통째로 처리해서 빠르다. 차이가 하나 있는데, `apply` 쪽은 사전에 없는 값이 오면 `KeyError`로 멈추고 `map`은 조용히 NaN을 넣는다. 변환 후 `isna().sum()`을 한 번 찍어보면 확인된다.

숫자로 바꾼 건 평균을 내기 위해서다. 문자열일 때는 "IT 과목 학생들의 성적"을 숫자 하나로 말할 수 없는데, L은 -1, M은 0, H는 1로 바꾸면 평균이 곧 그 집단의 성적 수준이 된다. 0/1 열의 평균이 비율이었던 것을 3단계로 넓힌 셈이다. `-1, 0, 1`로 정하면 0이 "보통"이라는 기준선이 되어 막대가 좌우로 갈려서 그래프가 그 자체로 해석을 담는다. 과목 이름이 길어서 가로 막대(`barh`)가 읽기 좋다. 다만 L과 M의 차이와 M과 H의 차이가 같다고 가정한 것이라는 한계는 알아둬야 한다.

평가 문제마다 "시각화 코드 작성"과 "관찰 결과와 인사이트를 별도 셀에 주석으로 작성하기"가 같이 적혀 있었다. 그래프를 그리는 건 절반이고, 나머지 절반은 읽어서 "L과 H는 확실하나 M과 H는 어렵다", "예측과 달리 그렇지 않다", "IT가 난이도가 높은 것일 수도 있다"처럼 문장으로 쓰는 것이었다.

## 롤 필승전략 EDA 마무리 - 상관계수 히트맵으로 40개 컬럼 좁히기
어제 데이터를 훑는 데서 멈춘 롤 데이터를 이어서 마무리했다. 심부전증처럼 컬럼마다 그려서 판정하는 방식은 13개일 때는 통했지만, 40개면 그림이 40장이고 그중 쓸모 있는 건 몇 개뿐이다. 그래서 그리기 전에 후보를 줄였다.

### describe() 다시 읽기
어제 찍어만 둔 `describe()`를 해석했다. `blueDragons`와 `blueHeralds`는 min이 0, max가 1이었다. 실제 게임에서는 드래곤을 여러 마리 잡을 수 있지만 10분 안에는 많아야 한 마리라 0/1만 나온다. dtype은 int지만 범주형으로 다뤄야 한다.

그리고 드래곤 평균이 블루보다 레드가 살짝 높았다. 수업에서는 여기서 "맵이 정확히 대칭이 아니라서 드래곤이 레드 쪽에 치우쳐 있는 것 아닐까"라는 추측을 세웠다. 숫자의 미세한 불균형에서 가설을 세운 것이고, 아래 countplot에서 다시 확인했다.

### 타깃 열만 뽑아서 히트맵

```python
fig = plt.figure(figsize=(10, 10))
sns.heatmap(df.corr())        # 40×40 = 1,600칸. 키워도 잘 안 읽힌다
plt.show()
```

전체 히트맵은 밝은 쪽이 +1, 어두운 쪽이 −1이다. 크기를 키워도 보기 힘들었고, `gameId`의 가로줄과 세로줄이 통째로 중간색이라 무엇과도 상관이 없다는 것(식별 번호라 당연하다)과 대각선이 1이라는 것 정도만 보였다. 전체 히트맵은 값을 읽는 용도가 아니라 어디를 볼지 정하는 용도다.

그래서 타깃 열 하나만 뽑았다. 오늘의 핵심 한 줄이다.

```python
fig = plt.figure(figsize=(4, 10))
sns.heatmap(df.corr()[['blueWins']], annot=True)
plt.show()
```

| 코드 | 결과 |
|---|---|
| `df.corr()` | 40 × 40. 못 읽는다 |
| `df.corr()['blueWins']` | Series (1차원). 히트맵에 못 넣는다 |
| `df.corr()[['blueWins']]` | 40 × 1 DataFrame. 세로로 긴 히트맵 |

궁금한 건 승패와의 관계뿐이니 나머지 39개 열은 볼 필요가 없다. `heatmap`은 2차원을 받아서 대괄호를 두 겹 써야 했다. "대괄호 개수가 결과 차원을 정한다"가 실제로 필요한 자리였다. `annot=True`는 칸마다 숫자를 찍어줘서 색으로 짐작할 필요 없이 값을 바로 읽을 수 있다.

| 컬럼 | 상관계수 |
|---|---|
| `blueGoldDiff` | 0.51 |
| `blueTotalGold` | 0.42 |
| `blueGoldPerMin` | 0.42 |
| `blueTotalExperience` | 0.40 |
| `blueDeaths` | −0.34 |
| `blueKills` | 0.34 |
| `blueDragons` | 0.21 |
| `blueFirstBlood` | 0.20 |
| `blueWardsPlaced` | 0.00009 |

골드 차이가 0.51로 가장 컸다. 레드팀이 골드를 못 먹게 하고 블루가 골드를 더 먹는 게 승패에 가장 큰 영향을 준다는 뜻이다. `blueKills`와 `blueDeaths`는 0.34와 −0.34로 거의 같은 세기로 반대 방향의 영향을 줬다. 부호는 방향이고 절댓값이 세기라서, −0.34를 "관련 없다"로 읽으면 안 된다. 후보를 고를 때는 `df.corr()['blueWins'].abs().sort_values(ascending=False)`처럼 절댓값으로 정렬하면 편하다.

와드 설치 수가 사실상 0인 것도 의미 있는 결과였다. 승자나 패자나 와드는 비슷하게 설치한다는 것이고, 와드는 몇 개를 박았느냐보다 어디에 언제 박았느냐가 중요할 텐데 그 정보는 이 데이터에 없다.

### 다중공선성 - 같은 정보가 두 번 들어 있다

```python
df.corr()[['blueExperienceDiff', 'redExperienceDiff']]
#             blueExperienceDiff  redExperienceDiff
# blueWins              0.489558          -0.489558
# blueKills             0.583730          -0.583730
# blueDeaths           -0.577613           0.577613
```

두 열의 값이 부호만 다르고 완전히 같다. `blueKills`와 `redDeaths`가 같고, `blueDeaths`와 `redKills`가 같고, `blueGoldDiff`와 `redGoldDiff`는 부호만 반대다. 블루가 5킬을 했다는 말과 레드가 5데스를 했다는 말은 같은 사실을 두 번 적은 것이다.

이 상태로 선형회귀나 로지스틱 회귀 같은 모델을 학습하면 다중공선성(multicollinearity)이 생긴다. 같은 정보가 두 열에 들어 있으면 모델이 중요도를 두 열에 나눠 배분해서 "둘 다 별로 안 중요하다"는 엉뚱한 답을 낼 수 있고, 어느 쪽이 진짜인지도 알 수 없게 된다. 해결은 하나를 버리는 것이다. `blue` 쪽 컬럼만 남기거나 차이값 컬럼만 쓴다. One-hot encoding에서 `drop_first=True`로 열 하나를 빼던 것과 같은 이유다. 학생 성적 EDA에서 본 "feature끼리 상관이 높으면 나쁘다"가 이것이다.

### 후보만 그래프로 확인하기

```python
sns.histplot(x='blueGoldDiff', data=df, hue='blueWins', kde=True, palette='RdBu')
sns.histplot(x='blueKills', data=df, hue='blueWins', kde=True, palette='RdBu', bins=8)
```

골드 차이는 이긴 판은 양수 쪽에, 진 판은 음수 쪽에 뭉쳐서 두 봉우리가 좌우로 뚜렷하게 갈렸다. 수업에서 "매우 교과서적인 데이터"라고 했을 만큼 깨끗했다. 어제 심부전증에서 정리한 "두 색이 갈라지면 쓸모 있다"의 가장 좋은 예였다. `palette='RdBu'`는 빨강-파랑 색상표라 팀 색과 맞아떨어져 직관적이다. 킬 수는 정수이고 범위가 좁아서 `bins=8`로 줄였다.

```python
sns.jointplot(x='blueKills', y='blueGoldDiff', data=df, hue='blueWins')
```

산점도 모양으로 두 컬럼의 관계를 읽을 수 있다. 좁은 대각선이면 상관이 매우 높아서 같은 정보이니 하나만 써도 되고, 퍼진 타원이면 관련은 있지만 각자 다른 면도 보니 둘 다 쓰면 좋고, 둥근 구름이면 상관이 없다. 킬과 골드 차이는 어느 정도 상관이 있으면서 옆으로도 퍼져서 두 feature를 같이 쓰면 좋을 상황이었다.

### 범주형 - 드래곤과 퍼스트 블러드

```python
df.blueDragons.value_counts()      # 0: 6303, 1: 3576
sns.countplot(x='blueDragons', data=df, hue='blueWins', palette='RdBu')
sns.countplot(x='redDragons',  data=df, hue='blueWins', palette='RdBu')
```

10분 안에 블루가 드래곤을 잡은 판은 약 36%였다. 두 countplot을 비교하니, 레드가 드래곤을 잡았을 때와 못 잡았을 때의 승패 차이가 블루의 경우보다 훨씬 작았다. 블루가 드래곤을 잡는 것과 레드가 잡는 것의 효과가 데이터상 비대칭이었다. `describe()`의 숫자에서 이상한 점을 발견하고 → 가설을 세우고 → 그래프로 확인하는 흐름이 그대로 나왔다.

`blueFirstBlood`의 countplot은 드래곤과 달리 좌우가 고르게 나왔다. 다만 상관계수는 0.20으로 와드(0.00009)와는 확연히 다르니, 퍼스트 블러드가 승패와 무관하다고 보기는 어렵다.

## 헷갈리기 쉬운 부분
- 행이 하나뿐이어도 `df[조건].컬럼`은 Series다. 비교 기준으로 쓸 값은 `.item()`으로 꺼낸다.
- `sort_values` 후에도 원본 번호가 따라다닌다. 보고서용 번호는 `reset_index(drop=True)` 후 `df.index += 1`이다.
- `inplace=True`는 `None`을 돌려줘서 이어 쓸 수 없다.
- 필터 기준이 전체 평균인지 그룹 안 평균인지 먼저 확인한다.
- `size()`는 행 수, `count()`는 NaN을 뺀 개수다.
- "OO별 평균보다 큰 것"은 `transform` 문제다. `agg` 결과를 원본에 대입하면 전부 NaN이 된다.
- 행 전체가 필요하면 `apply`나 `idxmax`, 값 하나면 `agg`다.
- 순서 있는 범주에는 `hue_order`를 준다.
- `countplot`의 막대는 개수다. 표본 크기가 다르면 비율로 다시 본다.
- 표본이 1~2개인 범주로는 결론을 낼 수 없다.
- `map`은 사전에 없는 값을 조용히 NaN으로 만든다.
- `df.corr()['타깃']`은 Series라 히트맵에 못 넣는다. `[['타깃']]`로 쓴다.
- 음수 상관도 같은 세기다. 순위는 `.abs()`로 본다.
- 부호만 반대이거나 값이 같은 열은 하나를 버린다(다중공선성).

## 오늘 배운 내용 정리
오늘은 국가 데이터로 필터와 groupby를 연습하고, 학생 성적 EDA와 롤 EDA로 컬럼을 판정하고 좁히는 법을 배웠다.

```
기준값: kor = df[df.Name == 'South Korea'].Population.item()   둘 이상이면 에러가 나서 안전하다.
보고서: 거르기 → 열 고르기 → sort_values → reset_index(drop=True) → index += 1 → to_csv(index=False).
groupby 고르기: 그룹당 1줄 agg, 행 전체 apply(또는 idxmax), 원본에 붙이기 transform.
그룹 기준 만들기: df.groupby(df.Name.str[0]).size()
그룹 평균과 비교: df['GNP_mean'] = df.groupby('Continent')['GNP'].transform('mean')
EDA 순서: 훑기(info, describe, value_counts) → 좁히기(corr()[['타깃']] 히트맵) → 확인하기(histplot, jointplot, countplot) → 정리하기(중복 열 제거, 판정 문장).
seaborn: hue_order로 순서 지정, pairplot으로 모든 조합, palette='RdBu'.
범주 → 숫자: df['Class'].map(dict(L=-1, M=0, H=1)) 로 평균을 낼 수 있게.
상관: 타깃과 높으면 좋고, feature끼리 높으면 나쁘다(다중공선성).
```

8/12부터 오늘까지 NumPy로 배열을 다루고, pandas로 표를 만들고, CSV와 DB와 주가 API에서 데이터를 가져오고, groupby와 merge로 묶고 합치고, Matplotlib과 seaborn으로 그려서, 마지막에 EDA로 판단하는 데까지 왔다. 기법은 이미 배운 것들인데 EDA가 어렵게 느껴졌던 건 "판단"을 처음 해봐서인 것 같다. 특히 토론 참여가 성적과 무관하게 나온 것처럼 예상이 빗나간 지점이 진짜 정보라는 것과, 컬럼이 많을 때는 그리기 전에 `corr()[['타깃']]`으로 먼저 좁힌다는 순서가 가장 크게 남았다.

---
