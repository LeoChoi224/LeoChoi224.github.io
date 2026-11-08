---
layout: single
title: "데이터 분석 기초 정리 5 - Matplotlib과 seaborn, 심부전증 데이터 EDA"
categories: [coding, DataAnalysis]
tag: [study-log, DataAnalysis, Matplotlib, seaborn, EDA, histplot, boxplot, outlier]
toc: true
author_profile: false
sidebar:
    nav: "docs"
search: true
---
<hr/>

오늘은 시각화를 배우고, 그걸로 첫 EDA(탐색적 데이터 분석)를 했다. 지금까지는 분석 결과를 표와 숫자로만 봤는데 숫자는 눈에 잘 안 들어온다. 타이타닉 `Fare`의 평균이 32인데 중앙값이 14라는 것도, 히스토그램 하나 그리면 왼쪽에 몰려 있고 오른쪽에 꼬리가 길다는 게 바로 보인다.

그리고 시각화는 분석의 마지막 단계가 아니라 도중에 계속 쓰는 도구였다. 오후 EDA 실습에서는 그래프를 그리면서 "이 컬럼이 쓸모 있나?"를 판단했다.

## Matplotlib의 구조 - Figure와 Axes

```
Figure  ─ 도화지 한 장 (전체 그림, 기본 640×480)
  └ Axes ─ 도화지 위에 그린 그림칸 하나 (subplot이라고도 부른다)
       └ 선, 막대, 축, 제목, 범례 …
```

Figure는 종이이고 Axes는 그 종이에 그린 그래프 하나다. 종이 한 장에 그래프를 4개 그릴 수도 있다. `Axes`는 축(axis)의 복수형처럼 생겼지만 축이 아니라 그림칸 전체를 뜻하고, 진짜 축은 `Axis`(단수)다. 그래서 코드에 자주 나오는 `ax` 변수는 그림칸 하나라고 읽으면 된다.

## Line plot

```python
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

arr = np.array([10, 30, 14, 20])
plt.plot(arr)        # 값만 주면 index가 x축, 값이 y축
plt.show()

x = np.arange(0, 1, 0.01)
plt.plot(x, x ** 2)  # x를 따로 주면 y = x² 곡선
```

2차원 배열을 주면 열마다 선이 하나씩 그려진다. 이게 DataFrame을 그릴 때 그대로 통한다.

```python
plt.plot(s)       # Series의 index가 x축
s.plot()          # 같은 결과. pandas가 대신 그려준다
df.plot()         # 컬럼마다 선 하나씩, 범례까지 자동
```

노트북에서는 `plt.show()`가 없어도 그림이 나오지만 `<Axes: >` 같은 객체 정보 한 줄이 같이 찍힌다. `plt.show()`를 쓰거나 줄 끝에 `;`를 붙이면 그림만 나온다. `.py` 스크립트에서는 `plt.show()`가 없으면 창이 아예 안 뜬다.

## Bar, Histogram, Scatter

```python
s2.plot(kind='bar')                   # 세로 막대
s2.plot(kind='barh')                  # 가로 막대 (h = horizontal)
df2.plot(kind='bar')                  # 컬럼마다 막대를 나란히
df2.plot(kind='barh', stacked=True)   # 쌓아 올리기
```

`kind=`만 바꾸면 종류가 바뀐다. `stacked=True`는 각 항목이 전체에서 차지하는 비중을 볼 때 쓰고, 항목끼리 크기를 비교하려면 쌓지 않는 편이 낫다.

히스토그램은 값의 분포를 본다. 값들을 구간별 바구니에 나눠 담고 바구니 높이를 보는 것으로, NumPy 실습에서 `np.unique(return_counts=True)`로 손으로 세던 게 이것이다.

```python
s3 = pd.Series(np.random.normal(0, 1, size=200))
s3.hist()             # 가로축 = 값의 구간, 세로축 = 그 구간의 개수
s3.hist(bins=50)      # 구간을 50개로 잘게
```

`bins=`가 결과를 크게 바꾼다. 너무 적으면 뭉뚱그려지고, 너무 많으면 들쭉날쭉해서 흐름이 안 보인다.

산점도(`plt.scatter(x1, x2)`)는 두 변수의 관계를 본다. 점이 오른쪽 위로 몰려 있으면 양의 상관, 흩어져 있으면 관계가 약하다. `corr()`로 본 숫자를 눈으로 확인하는 방법이다.

| 무엇을 보고 싶나 | 그래프 |
|---|---|
| 시간이나 순서에 따른 변화 | line |
| 항목 간 크기 비교 | bar |
| 값 하나의 분포 | histogram |
| 두 값의 관계 | scatter |

## 한글 깨짐

```python
s4 = pd.Series(np.random.rand(10), index=list("가나다라마바사아자차"))
s4.plot()
# UserWarning: Glyph 44032 (\N{HANGUL SYLLABLE GA}) missing from font(s) DejaVu Sans.
```

한글이 전부 네모(□)로 나온다. matplotlib의 기본 폰트(DejaVu Sans)에 한글 글자 모양이 아예 없어서, 없는 글자 대신 네모를 찍는 것이다. 해결은 폰트를 바꿔주는 것이다.

```python
import matplotlib
from matplotlib import font_manager, rc
import platform

try:
    if platform.system() == 'Windows':
        font_name = font_manager.FontProperties(fname="c:/Windows/Fonts/malgun.ttf").get_name()
        rc('font', family=font_name)      # 맑은 고딕
    else:
        rc('font', family='AppleGothic')  # 맥은 애플고딕
except:
    pass

matplotlib.rcParams['axes.unicode_minus'] = False
```

마지막 줄이 함정이다. `axes.unicode_minus = False`는 축의 음수 기호를 유니코드 마이너스(−) 대신 평범한 하이픈(-)으로 쓰라는 뜻이다. 한글 폰트에 유니코드 마이너스가 없는 경우가 많아서, 이걸 빼면 한글은 고쳤는데 음수 부호가 네모로 깨진다. 그리고 폰트 설정은 런타임을 재시작하면 초기화되니 세션마다 다시 해야 한다.

Colab은 리눅스라 맑은 고딕도 애플고딕도 없어서 위 코드는 `except: pass`에 걸려 조용히 넘어간다. Colab에서는 나눔고딕을 먼저 설치한다.

```python
!apt-get install -y fonts-nanum > /dev/null
import matplotlib.font_manager as fm
fm.fontManager.addfont('/usr/share/fonts/truetype/nanum/NanumGothic.ttf')
plt.rc('font', family='NanumGothic')
plt.rcParams['axes.unicode_minus'] = False
```

`except: pass`는 편하지만 왜 안 되는지 알 수 없게 만든다. 직접 쓸 때는 `except Exception as e: print('폰트 설정 실패:', e)` 정도로 남겨두면 "한글이 깨지는데 이유를 모르겠다"에 시간을 안 뺏긴다.

## Figure와 Subplot - 한 장에 여러 그래프

```python
# 옛날 방식
fig = plt.figure()               # 빈 도화지
ax1 = fig.add_subplot(2, 2, 1)   # 2×2로 나눠서 1번 칸

# 요즘 권하는 방식
fig, (ax1, ax2, ax3) = plt.subplots(1, 3)            # 가로로 3칸
fig, ((ax1, ax2), (ax3, ax4)) = plt.subplots(2, 2)   # 2×2는 두 겹으로 받는다
fig, ax = plt.subplots(1, 1)                          # 한 칸
```

`plt.subplots()`는 Figure와 Axes들을 한 번에 돌려줘서 좌변에서 바로 풀어 받는다. 받은 다음에는 칸마다 따로 그린다.

```python
ax1.hist(np.random.randn(100), bins=20)
ax2.plot(np.random.randn(50).cumsum())
ax3.scatter(np.arange(30), np.arange(30) + 3 * np.random.randn(30))
ax1.set_title('1st graph')
```

pandas 그래프를 특정 칸에 그리려면 `ax=`를 준다.

```python
fig, axes = plt.subplots(2, 1)
data.plot(kind='bar',  color='k', alpha=0.7, ax=axes[0])
data.plot(kind='barh', color='g', alpha=0.3, ax=axes[1])
```

`plt.subplots()`(복수형)와 `plt.subplot()`(단수형)은 철자가 한 글자 차이인데 다른 함수다. 복수형이 도화지와 칸을 한 번에 다 만들어주는 요즘 방식이다.

### 그리는 방법 세 가지

| 방법 | 코드 | 장점 | 단점 |
|---|---|---|---|
| ① pyplot | `plt.plot(s)` | 가장 짧다 | 복잡한 그림에 한계 |
| ② Figure/Axes | `fig, ax = plt.subplots(); ax.plot(s)` | 뭐든 다 된다 | 코드가 길다 |
| ③ pandas | `s.plot()`, `df.plot()` | 데이터에서 바로 | 다듬으려면 결국 ② |

셋은 경쟁 관계가 아니다. ③은 속으로 ②를 부르고, ①도 결국 Figure와 Axes를 만든다. 평소엔 ③으로 빠르게 그리고 다듬어야 할 때 ②로 내려가면 된다. ①의 `plt.plot()`은 "지금 활성화된 그림칸"에 그리기 때문에 칸이 여러 개면 어디에 그려질지 헷갈린다. 그림이 두 개 이상이면 ②가 안전하다.

## 꾸미기

```python
plt.plot(np.random.randn(50), color='g', marker='o', linestyle='--')
plt.plot(np.random.randn(30), 'k.-')      # 축약형: 검정(k) + 점(.) + 실선(-)
```

| 옵션 | 자주 쓰는 값 |
|---|---|
| `color` | `'b'` 파랑, `'g'` 초록, `'r'` 빨강, `'k'` 검정 |
| `marker` | `'.'` 점, `'o'` 원, `'^'` 세모, `'s'` 네모, `'*'` 별 |
| `linestyle` | `'-'` 실선, `'--'` 파선, `'-.'` 일점쇄선, `':'` 점선 |
| `alpha` | 0(투명) ~ 1(불투명). 점이 겹칠 때 유용 |

```python
fig, ax = plt.subplots(1, 1, figsize=(8, 8))     # 도화지 크기 (인치)

for i in range(3):
    ax.plot(np.random.randn(1000).cumsum(), label=f'{i} value')   # label → 범례

ax.set_xticks([0, 250, 500, 750, 1000])                            # 눈금 위치
ax.set_xticklabels(['one', 'two', '셋', '넷', '다섯'], rotation=30)  # 눈금 글자
ax.set_title('random walk plot')
ax.set_xlabel('Stages')
ax.set_ylabel('Value')
ax.grid(True)
ax.legend()        # 범례. label을 준 것만 나온다
```

`label=`만 주고 `ax.legend()`를 안 부르면 범례가 안 나온다. `figsize`의 단위는 인치이고 실제 픽셀 크기는 `figsize × dpi`로 정해진다. 기본 dpi가 100이라 `(8, 8)`은 800×800 픽셀이다. 발표 자료에 넣을 그림이 흐리면 dpi를 올린다.

## 이미지로 저장하기

```python
plt.savefig('figimage1.png')
plt.savefig('figimage2.png', dpi=200)   # 해상도 올리기
plt.savefig('figimage3.svg')            # 벡터. 확대해도 안 깨진다
plt.savefig('figimage4.pdf')            # 벡터
```

PNG와 JPG는 점을 찍어 만든 그림이라 확대하면 뭉개지고, SVG와 PDF는 선을 그리는 방법을 적어둔 것이라 아무리 키워도 선명하다. 그리고 `savefig`는 `show()`보다 먼저 써야 한다. `show()`를 부르고 나면 그림이 비워져서 그 뒤에 저장하면 빈 파일이 나온다.

## 이미지도 결국 배열이다

```python
arr = plt.imread(img_path)
arr.shape      # (1200, 1600, 3)   (높이, 너비, 색 채널)
```

사진은 숫자가 빽빽하게 든 3차원 표다. 여기서 축 순서에 주의해야 한다. axis 0이 높이(y), axis 1이 너비(x)라서, 우리가 "1600×1200 사진"이라고 말하는 것과 순서가 반대다. 채널은 JPG가 R, G, B 3개이고, PNG는 투명도(Alpha)까지 4개인 경우가 많다.

픽셀 접근과 편집은 NumPy에서 배운 슬라이싱 그대로다.

```python
arr[0, 5]                          # 0행 5열 픽셀의 [R, G, B]
plt.imshow(arr[180:820, 200:900])  # 잘라내기 (crop)
plt.imshow(arr[:, ::-1, :])        # 좌우 반전 (x축을 거꾸로)
plt.imshow(arr[::-1, ::-1, :])     # 상하좌우 반전 (180도 회전)
plt.axis('off')                    # 축 눈금 숨기기
```

`::-1` 하나로 좌우 반전이 된다. 색 채널 하나만 뽑으면 2차원이 되는데, 그대로 `imshow`하면 이상한 색이 나온다.

```python
r = arr[:, :, 0]               # Red 채널만 → (1200, 1600)
plt.imshow(r)                  # 보라~노랑 색으로 나온다
plt.imshow(r, cmap='gray')     # 흑백으로
plt.imshow(r, cmap='hot')      # 열화상 느낌
```

채널이 하나뿐이면 matplotlib은 이걸 색이 아니라 숫자 값으로 보고 기본 컬러맵(viridis)을 씌워 크기를 색으로 표현한다. 그래서 빨강 채널을 뽑았는데 초록빛으로 나온다. 흑백으로 보려면 `cmap='gray'`를 명시해야 한다. 딥러닝에서 이미지를 자르고, 뒤집고, 0~255를 0~1로 나누는 전처리도 전부 이런 배열 연산이다.

## EDA - 모델을 돌리기 전에 데이터를 실컷 들여다보기
EDA(Exploratory Data Analysis, 탐색적 데이터 분석)는 벨연구소의 존 튜키가 만든 개념이다. 가설을 먼저 세우고 검증하는 게 아니라, 데이터를 보면서 가설을 찾아나가는 태도다. 수업 자료에는 EDA가 하는 일로 각 컬럼과 행의 의미와 연관성 이해하기, 결측치 처리와 필터링, 시각화 세 가지가 꼽혀 있었다.

지금까지 배운 건 도구였다. 그런데 실제 데이터 앞에 서면 "컬럼이 12개인데 뭐부터 봐야 하지?"라는 질문이 생긴다. 오늘 실습이 그 순서를 보여줬다.

### 데이터 - 심부전증 환자 299명
심장병 환자 299명의 진료 기록이고 목표는 하나다. **어떤 요인이 심장병 환자를 사망에 이르게 하는가?** `DEATH_EVENT`(사망 여부)를 타깃으로 놓고, 나머지 12개 컬럼 중 무엇이 이걸 가르는지 찾는다.

| 컬럼 | 뜻 | 종류 |
|---|---|---|
| `age` | 나이 | 수치형 |
| `anaemia` | 빈혈 여부 (0/1) | 범주형 |
| `creatinine_phosphokinase` | 크레아틴키나제 검사 결과 | 수치형 |
| `diabetes` | 당뇨 여부 (0/1) | 범주형 |
| `ejection_fraction` | 박출계수(%). 심장이 한 번 뛸 때 내보내는 피의 비율 | 수치형 |
| `high_blood_pressure` | 고혈압 여부 (0/1) | 범주형 |
| `platelets` | 혈소판 수 | 수치형 |
| `serum_creatinine` | 혈중 크레아티닌 | 수치형 |
| `serum_sodium` | 혈중 나트륨 | 수치형 |
| `sex` | 성별 (0 = 여, 1 = 남) | 범주형 |
| `smoking` | 흡연 여부 (0/1) | 범주형 |
| `time` | 관찰 기간(일) | 수치형 |
| `DEATH_EVENT` | 사망 여부 (0/1) | 범주형 (타깃) |

시각화는 seaborn을 썼다. matplotlib 위에 얹혀서 통계 그래프를 짧게 그리게 해주는 라이브러리다. `sns.histplot(x='age', data=df, hue='DEATH_EVENT', kde=True)` 한 줄에 히스토그램, 사망 여부별 색 구분, 밀도 곡선이 다 들어간다. 다만 제목, 크기, 저장은 여전히 matplotlib으로 한다.

### 눈으로 훑기

```python
df.shape       # (299, 13)
df.info()      # 전부 299 non-null → 결측치가 하나도 없다
df.describe()
```

`info()`에서 두 가지를 얻었다. 299행 전부 non-null이라 아주 깨끗한 데이터셋이라 결측치 처리를 건너뛸 수 있다는 것, 그리고 dtype이 int여도 `DEATH_EVENT`, `smoking`, `sex`, `anaemia`, `diabetes`, `high_blood_pressure`는 범주형이라는 것이다. 타이타닉의 `Pclass`와 같은 이야기로, dtype이 아니라 의미로 판단한다. `age`가 정수가 아니라 float으로 읽힌 것도 자료에 "확인 필요"로 메모되어 있었는데, 실제로 `60.667` 같은 값이 몇 개 섞여 있다. 왜 이렇게 생겼는지 넘어가지 않고 메모해두는 게 EDA의 태도다.

### describe()로 균형과 이상치 읽기
0과 1만 있는 컬럼의 평균은 곧 1의 비율이다.

```
anaemia      mean 0.431
diabetes     mean 0.418
DEATH_EVENT  mean 0.321
```

`DEATH_EVENT`가 0.321이니 약 1/3이 사망, 2/3이 생존이다. 심하게 치우친(imbalanced) 데이터는 아니라고 판단했다. 균형을 먼저 보는 이유는, 예를 들어 99%가 생존이면 "전부 생존"이라고 찍기만 해도 정확도가 99%가 나와서 숫자만 보고는 판단할 수 없기 때문이다.

이상치는 min, 중앙값, max의 간격을 본다.

```
creatinine_phosphokinase   min 23 · 25% 116.5 · 50% 250 · 75% 582 · max 7861
```

25% → 50% → 75%가 완만하게 올라가다가 max에서 확 튄다. 자료의 판단은 "상당한 outlier에 해당하고 상위 몇 개는 배제해볼 필요가 있다"였다. 이상치의 통계적 기준은 박스플롯의 울타리다.

```
Q1 = 1분위수(25%),  Q3 = 3분위수(75%),  IQR = Q3 - Q1

아래 울타리 : Q1 - 1.5 × IQR
위 울타리   : Q3 + 1.5 × IQR
```

가운데 절반(Q1~Q3)이 차지하는 폭을 재고, 그 1.5배만큼 위아래로 더 나간 지점에 울타리를 친다. 울타리 밖이 이상치다. 다루는 방법은 울타리 밖을 지우는 제거(데이터가 버려진다)와 log 변환 등으로 분포를 눌러주는 변형(값의 뜻이 바뀐다)이 있다. 통계분석은 귀납법이라 이상치 같은 특수 케이스가 규칙을 만드는 데 방해가 된다는 설명이었다.

다만 이상치를 항상 지워야 하는 건 아니다. 사기 거래 탐지나 장비 고장 예측처럼 이상치 자체가 찾아야 할 답인 분석도 있다. 그래서 지우기 전에 "이게 오류인가, 드물지만 진짜인가"를 먼저 판단한다. 나이가 200살이면 오류지만 크레아틴키나제 7861은 실제로 심하게 아픈 환자일 수 있다.

컬럼마다 남긴 메모도 EDA 기록의 좋은 예였다. `serum_sodium`은 범위가 113~148로 좁고 표준편차가 4.4밖에 안 되고, `time`은 최소 4일, 최대 285일인데 "사망하면 관찰이 멈출 테니 `DEATH_EVENT`와 상당히 연관되어 있을 것"이라고 적혀 있었다.

### 수치형 분석 - 두 집단을 겹쳐 그리기

```python
import seaborn as sns

sns.histplot(x='age', data=df, hue='DEATH_EVENT', kde=True)
```

| 옵션 | 하는 일 |
|---|---|
| `hue='DEATH_EVENT'` | 그 컬럼 값으로 색을 나눠 겹쳐 그린다 |
| `kde=True` | 막대 위에 부드러운 밀도 곡선을 덧그린다 |
| `bins=13` | 구간 개수 |

생존자 분포와 사망자 분포를 같은 그림에 겹쳐 놓고 갈라지는지 본다. 판정 기준은 이 한 문장이다. **두 색이 겹쳐 있으면 쓸모없는 컬럼, 두 색이 갈라져 있으면 쓸모 있는 컬럼.**

나이(`age`)는 범위와 추세가 많이 겹쳐서 `DEATH_EVENT`를 가르는 데 크게 유용하지 않다는 판정이 나왔다.

크레아틴키나제는 이상치가 너무 많아 히스토그램이 왼쪽에 뭉쳐버렸다. 이상치를 걷어내고 다시 그려도 통계적인 특징이 잘 드러나지 않아서 유용하지 않을 가능성이 크다고 판정했다.

```python
sns.histplot(x='creatinine_phosphokinase',
             data=df.loc[df['creatinine_phosphokinase'] < 3000])   # 원본은 그대로 두고 그림만 다시
```

박출계수(`ejection_fraction`)가 쓸모 있는 컬럼이었다. `bins`를 기본 → 10 → 13으로 바꿔가며 합리적인 모양이 나오는 지점을 찾았다.

```python
sns.histplot(x='ejection_fraction', data=df, bins=13, hue='DEATH_EVENT', kde=True)
```

박출계수가 낮은 사람들이 사망을 많이 했고, 높은 사람들은 상대적으로 덜 사망했다. 다만 사망자 수 자체는 20~50 구간에 상당히 분포해 있어서, 사망을 맞히는 것보다 생존자를 걸러내는 데 도움이 될 것 같다는 판단이었다. "사망을 맞히는 것"과 "생존을 걸러내는 것"이 다른 일이라는 점이 인상적이었다. 박출계수는 심장이 피를 얼마나 제대로 뿜어내는지를 나타내는 심부전의 핵심 지표라고 해서, 데이터가 알려준 결론이 도메인 지식과도 맞아떨어졌다.

혈소판(`platelets`)은 분포 자체는 적절해 보이지만 `DEATH_EVENT`와는 거의 상관이 없어 보였다.

두 컬럼을 동시에 볼 때는 `jointplot`을 썼다. 가운데 산점도에 위와 오른쪽으로 각각의 히스토그램을 붙여준다.

```python
sns.jointplot(x='platelets', y='creatinine_phosphokinase',
              data=df, hue='DEATH_EVENT', alpha=0.3)
```

점이 뭉쳐 있어서 이 두 특징으로도 사망을 가르기는 어렵다는 결론이었다. `alpha=0.3`으로 반투명하게 하면 점이 몰린 곳이 진하게 보인다. 이번엔 아니었지만, 하나씩 보면 안 갈리는데 둘을 같이 보면 갈리는 경우도 있어서(키나 몸무게만으로는 안 되는데 키 대비 몸무게로 보면 갈리는 것처럼) "따로따로 쓸모없다"가 "같이도 쓸모없다"는 뜻은 아니다.

### 범주형 분석 - 박스플롯
범주형은 값이 0과 1뿐이라 히스토그램으로 분포를 겹쳐 볼 수가 없다. 그래서 범주별로 따로 통계를 내서 나란히 놓는데, 그게 박스플롯이다.

```python
sns.boxplot(x='DEATH_EVENT', y='ejection_fraction', data=df, hue='DEATH_EVENT')
```

```
    ○  ← 울타리 밖의 점 = 이상치
    │
  ┌─┴─┐  ← Q3 (75%)
  │───│  ← 중앙값 (50%)
  └─┬─┘  ← Q1 (25%)
    │
```

생존 그룹과 사망 그룹의 박출계수를 상자 두 개로 나란히 놓으니 평균과 전체 범위에 차이가 있었고, 박출계수가 사망에 영향을 주는 것 같다는 결론이 다시 한번 확인됐다. 박스플롯은 이상치를 점으로 따로 빼주고, 두 범주의 통계를 한눈에 비교할 수 있고, 겹쳐 보이는 히스토그램보다 일목요연해서 발표할 때도 많이 쓴다고 했다.

```python
sns.violinplot(x='DEATH_EVENT', y='ejection_fraction', data=df, hue='DEATH_EVENT')
sns.swarmplot(x='DEATH_EVENT', y='ejection_fraction', data=df, hue='DEATH_EVENT')
sns.countplot(x='DEATH_EVENT', data=df, hue='DEATH_EVENT')   # 범주별 개수
```

| 그래프 | 보여주는 것 |
|---|---|
| `boxplot` | 요약된 통계 (사분위수, 이상치) |
| `violinplot` | 박스플롯 + 분포 모양 (어디에 몰려 있는지) |
| `swarmplot` | 점을 하나도 빼지 않고 다 찍는다 (겹치지 않게 옆으로 밀어서) |

`hue`를 다른 컬럼으로 주면 x축, y축, 색으로 세 변수의 관계를 한 그림에서 볼 수 있다.

```python
sns.boxplot(x='smoking', y='ejection_fraction', data=df, hue='DEATH_EVENT')
```

`swarmplot`을 실행하면 "10.3% of the points cannot be placed" 같은 경고가 떴다. 점을 겹치지 않게 밀어 놓다 보니 자리가 모자라 일부를 못 그렸다는 뜻이라, 그림에 없는 점이 생긴다. 점 크기를 줄이거나(`size=3`) 겹침을 허용하는 `stripplot`을 쓰면 된다. 데이터가 수백 개를 넘으면 `swarmplot`은 대체로 맞지 않는다.

수업 코드에 `x='DEATH_EVENT', hue='DEATH_EVENT'`처럼 같은 컬럼을 두 번 준 건 색을 나누려는 것이다. 예전 seaborn은 x축 범주마다 색이 자동으로 갈렸는데, 최신 버전은 `hue`를 줘야 색이 갈린다.

### 결론 - 컬럼별 판정표
오늘 EDA의 결과물은 그래프가 아니라 판정표였다.

| 컬럼 | 판정 | 근거 |
|---|---|---|
| `ejection_fraction` | 쓸모 있음 | 두 집단의 분포와 박스플롯이 확실히 갈린다 |
| `age` | 애매함 | 범위와 추세가 많이 겹친다 |
| `creatinine_phosphokinase` | 쓸모없음 | 이상치를 빼도 특징이 안 드러난다 |
| `platelets` | 쓸모없음 | 두 집단 분포가 거의 같다 |

"쓸모없다"는 결론도 결과다. 12개 컬럼을 다 넣는 것보다 쓸모 있는 2~3개를 골라내는 게 결과도 좋고 설명도 쉽다.

`time` 컬럼은 따로 생각해볼 만했다. 사망하면 관찰이 멈추니 `DEATH_EVENT`와 연관이 클 거라고 메모했는데, `time`은 결과가 나온 뒤에야 정해지는 값이다. 이런 값을 예측에 쓰면 정확도는 확 올라가지만 실제로는 아무것도 예측하지 못한다. 이미 결과를 아는 값을 넣은 셈이라 데이터 누수(data leakage)라고 부른다. 새 환자가 왔을 때 나이나 박출계수는 바로 알 수 있지만 "며칠 관찰할 것인가"는 알 수 없다. "이 값을 예측 시점에 알 수 있나?"를 기준으로, 알 수 없는 값은 빼야 한다.

## 롤 데이터로 다음 EDA 시작
마지막 시간에는 리그 오브 레전드 다이아몬드 랭크 게임 9,879판의 10분 시점 기록으로 두 번째 EDA를 시작했다. 목표는 "10분까지의 상황만 보고 승패를 맞힐 수 있는가, 무엇이 승패를 가르는가"다. 컬럼이 40개라 심부전증 때처럼 하나씩 그려볼 수가 없다.

```python
pd.set_option('display.max_columns', None)   # 가운데 컬럼이 ...로 생략되지 않게
df = pd.read_csv('high_diamond_ranked_10min.csv')
df.shape     # (9879, 40)
```

pandas는 기본으로 화면을 아끼려고 가운데 컬럼을 `...`로 생략해서, `display.max_columns`를 `None`(제한 없음)으로 켜야 40개가 다 보인다. 표시 방식만 바꾸는 것이라 데이터는 안 바뀐다.

컬럼은 `blueKills`, `redKills`처럼 블루팀과 레드팀이 짝을 이루고 있어서 40개처럼 보여도 실제 종류는 20개 정도다. 타깃은 `blueWins`(블루팀 승리 여부)이고 평균이 0.499로 거의 정확히 반반이었다. 한 판에 승자가 하나면 반대편은 패자니까 당연한 결과이고, 균형이 잡혀 있으니 결과 해석도 단순하다. `gameId`는 45억쯤 되는 식별 번호라 `describe()`에 통계가 나와도 아무 뜻이 없어서 분석에서 뺀다. 오늘은 `sns.histplot(x='blueGoldPerMin', data=df, hue='blueWins')`로 분당 골드를 승패로 갈라 그려보는 데까지 했고, 나머지는 다음 시간에 이어서 했다.

## 헷갈리기 쉬운 부분
- 한글은 폰트 지정과 `axes.unicode_minus = False`가 한 세트다. 런타임을 재시작하면 다시 해야 한다.
- `plt.subplots()`와 `plt.subplot()`은 다른 함수다. 2×2 subplots는 두 겹으로 받는다.
- `ax.legend()`를 안 부르면 범례가 안 나온다.
- `savefig`는 `show()` 앞에 둔다. 뒤에 두면 빈 이미지가 저장된다.
- `imread` 결과는 (높이, 너비, 채널) 순서다.
- 2차원 배열을 `imshow`하면 컬러맵이 씌워진다. 흑백은 `cmap='gray'`를 명시한다.
- `bins`를 바꾸면 히스토그램의 인상이 크게 달라진다. 한 번 그려보고 판단하지 않는다.
- `hue=`를 안 주면 두 집단이 안 갈려서 쓸모 있는지 판정할 수 없다.
- `swarmplot` 경고를 무시하면 그림에 없는 데이터가 생긴다.
- 예측 시점에 알 수 없는 값(`time`)은 데이터 누수다.

## 오늘 배운 내용 정리
오늘은 Matplotlib과 seaborn으로 그래프를 그리고, 그걸로 심부전증 데이터의 EDA를 했다.

```
구조: Figure(도화지) 안에 Axes(그림칸). ax는 그림칸 하나.
그리기: 평소엔 df.plot(kind=...), 다듬을 땐 fig, ax = plt.subplots().
종류: 변화는 line, 비교는 bar, 분포는 hist, 관계는 scatter.
한글: 폰트 지정 + axes.unicode_minus = False. Colab은 나눔고딕 설치부터.
저장: savefig는 show() 전에. 확대해도 선명한 건 svg, pdf.
이미지: (높이, 너비, 채널) 배열. arr[:, ::-1, :] 이 좌우 반전.
EDA 순서: shape → info(결측치, dtype) → describe(0/1 평균 = 균형, min·중앙값·max = 이상치).
수치형: sns.histplot(x=컬럼, hue=타깃, kde=True). 겹치면 쓸모없음, 갈라지면 쓸모 있음.
범주형 비교: sns.boxplot(x=타깃, y=컬럼). 이상치는 IQR 울타리 밖의 점.
결론: 판정표. 쓸모없다는 것도 결과. 예측 시점에 모르는 값은 데이터 누수.
```

지금까지는 도구를 배웠다면 오늘은 그 도구로 처음 판단을 해봤다. 12개 컬럼을 하나씩 그려서 "두 색이 겹치느냐 갈라지느냐"로 판정해 나가니, 결국 쓸 만한 건 박출계수 하나였다는 결론이 오히려 기억에 남았다. 그리고 `time` 컬럼처럼 상관이 높아 보여도 결과가 나온 뒤에야 알 수 있는 값은 빼야 한다는 점도 꼭 기억해둬야겠다.

---
