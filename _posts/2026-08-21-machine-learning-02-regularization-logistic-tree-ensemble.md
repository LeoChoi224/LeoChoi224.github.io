---
layout: single
title: "머신러닝 기초 정리 2 - 규제, 로지스틱 회귀, SGD, 결정 트리, 교차 검증, 앙상블"
categories: [coding, MachineLearning]
tag: [study-log, MachineLearning, scikit-learn, Ridge, Lasso, LogisticRegression, SGD, DecisionTree, GridSearchCV, RandomForest, GradientBoosting]
toc: true
author_profile: false
sidebar:
    nav: "docs"
search: true
---
<hr/>

오늘은 진도가 정말 많이 나갔다. 어제 끝낸 회귀를 특성 여러 개로 늘렸다가 망가뜨리고 규제로 붙잡았고, 분류로 넘어가 로지스틱 회귀와 확률적 경사 하강법을 배웠다. 오후에는 와인 데이터로 결정 트리를 만들고, 교차 검증과 그리드 서치로 하이퍼파라미터를 고르고, 마지막에 트리를 여러 개 묶는 앙상블까지 갔다.

하루 동안 나온 모델이 많은데 이야기 하나로 이어져 있었다. 어떤 모델을 만들고, 그 모델의 약점이 보이면, 그 약점을 해결하는 다음 모델로 넘어가는 식이었다.

## 다중회귀 - 특성을 늘리다 망가뜨리기
어제 마지막에 농어 데이터에 길이 말고도 높이(Height)와 두께(Width)가 있다는 이야기로 끝났다. 물고기 무게는 대충 길이 × 높이 × 두께에 비례할 텐데 길이 하나만 썼으니, 오늘은 여러 특성을 쓰는 선형 회귀인 **다중회귀(multiple regression)**로 시작했다.

특성이 하나면 선형 회귀는 직선을 학습하고, 둘이면 평면을, 셋 이상이면 그림으로 그릴 수 없는 초평면을 학습한다. 차원이 늘어도 "계수를 곱해서 다 더한다"는 계산은 똑같아서 상상할 필요는 없다. 그리고 선형 회귀를 직선이나 평면이라 단순한 모델이라고 생각하면 안 된다. 어제 제곱항 하나를 넣었더니 곡선이 됐던 것처럼, 특성을 어떻게 만들어주느냐에 따라 얼마든지 복잡해진다.

```python
perch_df = fish_df[fish_df.Species == 'Perch'][['Length', 'Height', 'Width']]
perch_full = perch_df.to_numpy()

train_input, test_input, train_target, test_target = \
    train_test_split(perch_full, perch_weight, random_state=42)
print(train_input.shape, test_input.shape)   # (42, 3) (14, 3)
```

특성이 3개라 처음부터 2차원이어서 어제처럼 `reshape(-1, 1)`을 할 필요가 없었다.

### 특성공학과 PolynomialFeatures
기존 특성을 조합해서 새로운 특성을 만드는 일을 **특성공학(feature engineering)**이라고 한다. 각 특성을 제곱한 항뿐 아니라 특성끼리 곱한 항도 만드는데, 무게가 부피에 비례하고 부피가 길이 × 높이 × 두께이기 때문이다. 선형 회귀는 계수를 곱해서 더할 뿐이라 곱셈을 스스로 못 한다. "길이와 높이를 곱해 보라"는 아이디어는 사람이 넣어줘야 하고, 그게 특성공학이다.

어제는 `np.column_stack`으로 제곱항을 직접 만들었는데 특성이 3개가 되면 손으로는 못 한다. scikit-learn의 `PolynomialFeatures`가 자동으로 만들어준다.

```python
from sklearn.preprocessing import PolynomialFeatures

poly = PolynomialFeatures()
poly.fit([[2, 3]])
print(poly.transform([[2, 3]]))   # [[1. 2. 3. 4. 6. 9.]]
```

특성 2개짜리 샘플이 6개가 됐다. 2와 3, 각각의 제곱인 4와 9, 둘을 곱한 6이다. 맨 앞의 1이 이상했는데, 절편을 "값이 항상 1인 특성과 곱해지는 계수"로 볼 수 있기 때문이다.

```
무게 = a·길이 + b·높이 + c·두께 + d
     = a·길이 + b·높이 + c·두께 + d·1
                                    ↑ 항상 1인 특성
```

이렇게 보면 절편도 계수 하나로 통일된다. 나중에 신경망에서 bias(편향)라는 이름으로 다시 만난다고 한다. 그런데 scikit-learn의 선형 모델은 절편을 알아서 추가하니까 `include_bias=False`로 1을 빼고 썼다.

```python
poly = PolynomialFeatures(include_bias=False)
poly.fit(train_input)
train_poly = poly.transform(train_input)
test_poly = poly.transform(test_input)     # 테스트는 transform만
print(train_poly.shape)                    # (42, 9)
poly.get_feature_names_out()
# ['x0', 'x1', 'x2', 'x0^2', 'x0 x1', 'x0 x2', 'x1^2', 'x1 x2', 'x2^2']
```

`get_feature_names_out()`으로 각 특성이 어떻게 만들어졌는지 볼 수 있다. 원래 특성 3개, 제곱 3개, 곱셈 3개다. 사실 `PolynomialFeatures`는 평균 같은 통계값을 쓰지 않아서 테스트 세트를 따로 `fit`해도 결과가 같다. 하지만 `StandardScaler`는 결과가 달라지니까 항상 훈련 세트로 `fit`한 변환기로 테스트 세트를 변환하는 습관을 들이는 게 좋다.

이렇게 `fit()`과 `transform()`을 가진 전처리 클래스를 **transformer(변환기)**라고 부른다. 어제 배운 구분이 여기서 이름을 얻었다. `predict`가 있으면 모델(estimator), `transform`이 있으면 전처리기(transformer)다.

```python
lr = LinearRegression()
lr.fit(train_poly, train_target)
print(lr.score(train_poly, train_target))   # 0.9903557670312702
print(lr.score(test_poly, test_target))     # 0.9712376207461857
```

특성 9개로 훈련 0.990, 테스트 0.971이 나왔다. 여기까지는 순조로웠다.

### degree=5 - 테스트 R²가 -129
그러면 특성을 더 많이 만들면 더 좋아질까 싶어서 5제곱까지 만들어봤다.

```python
poly = PolynomialFeatures(degree=5, include_bias=False)
poly.fit(train_input)
train_poly = poly.transform(train_input)
test_poly = poly.transform(test_input)
print(train_poly.shape)                     # (42, 55)

lr.fit(train_poly, train_target)
print(lr.score(train_poly, train_target))   # 0.9999999999996642
print(lr.score(test_poly, test_target))     # -129.88151246056472
```

특성이 55개가 됐고, 훈련 R²는 거의 정확히 1.0인데 테스트 R²가 -129.88이었다. 어제 배운 대로 R²가 음수면 평균으로 찍는 것보다 못하다는 뜻이니 완전히 망가진 것이다.

수업 자료의 비유가 기억에 남는다. 참새 42마리를 새총 한 발로 맞혀야 한다면 참새떼가 밀집한 중앙을 겨냥해야 한다. 그런데 총알이 55발이면 한 발에 한 마리씩 모든 참새를 맞힐 수 있다. 샘플이 42개인데 계수가 55개면 42개 점을 전부 정확히 지나는 식을 만들 수 있다. 시험 문제 42개의 답을 외워버린 것이라 처음 보는 문제는 하나도 못 푼다. 과대적합의 극단적인 모습이고, "특성이 많을수록 좋다"가 무조건 참이 아니라는 반례다. 실무에서는 샘플이 특성의 최소 10배는 있어야 안심한다고 한다.

## 규제 - 계수를 억눌러서 붙잡기
**규제(regularization)**는 모델이 훈련 세트를 너무 과도하게 학습하지 못하도록 훼방하는 것이다. 선형 회귀에서는 특성에 곱해지는 계수의 크기를 작게 만드는 일이다. 학습할 때 "오차를 줄여라"에 더해 "계수도 작게 유지해라"라는 조건을 하나 더 주면, 두 목표가 서로 당기면서 적당한 지점을 찾는다. 계수가 크다는 건 특성이 조금만 변해도 예측이 크게 출렁인다는 뜻이라 훈련 데이터의 잡음까지 따라간다. 계수를 억누르면 곡선이 부드러워진다.

규제를 하기 전에는 반드시 스케일링을 해야 한다. 규제는 계수의 크기를 보고 벌점을 주는데, 특성의 단위가 다르면 계수의 크기도 제각각이다. 길이 특성의 계수가 39이고 길이⁵ 특성의 계수가 0.00001이면, 둘을 같은 기준으로 벌주는 건 불공평하다.

```python
from sklearn.preprocessing import StandardScaler

ss = StandardScaler()
ss.fit(train_poly)
train_scaled = ss.transform(train_poly)
test_scaled = ss.transform(test_poly)
ss.mean_, ss.scale_   # 특성 55개의 평균과 표준편차
```

어제 손으로 만들던 `mean`, `std`를 객체가 `mean_`, `scale_`로 대신 들고 있다. 뒤 밑줄은 `fit()` 이후에 생긴 값이라는 표시다.

### 릿지 회귀
릿지는 계수를 제곱한 값을 기준으로, 라쏘는 계수의 절댓값을 기준으로 규제한다. 둘 다 계수를 줄이는데 라쏘는 아예 0으로 만들 수도 있다. 일반적으로는 릿지를 더 많이 쓴다고 한다.

```python
from sklearn.linear_model import Ridge

ridge = Ridge()
ridge.fit(train_scaled, train_target)
print(ridge.score(train_scaled, train_target))   # 0.9896217956447125
print(ridge.score(test_scaled, test_target))     # 0.9788853860988027
```

특성은 그대로 55개인데 -129.88이 0.9789로 되살아났다. 훈련 점수가 1.0에서 0.9896으로 떨어진 게 오히려 좋은 신호다. 일부러 덜 맞추게 만든 것이니까. 규제의 본질은 훈련 점수를 희생해서 테스트 점수를 사는 것이다.

규제의 세기는 `alpha`로 정한다. 크면 규제가 강해져서 과소적합 쪽으로, 작으면 규제 없는 선형 회귀에 가까워져서 과대적합 쪽으로 간다. 이렇게 사람이 미리 정해줘야 하는 값이 하이퍼파라미터다. 적절한 `alpha`를 찾으려고 값을 바꿔가며 R²를 그려봤다.

```python
train_score, test_score = [], []
alpha_list = [0.001, 0.01, 0.1, 1, 10, 100]

for alpha in alpha_list:
    ridge = Ridge(alpha=alpha)
    ridge.fit(train_scaled, train_target)
    train_score.append(ridge.score(train_scaled, train_target))
    test_score.append(ridge.score(test_scaled, test_target))

plt.plot(np.log10(alpha_list), train_score)
plt.plot(np.log10(alpha_list), test_score)
```

`alpha`가 10배씩 커지는 값이라 그대로 그리면 왼쪽 다섯 개가 0 근처에 뭉친다. `np.log10()`을 씌우면 -3부터 2까지 고르게 퍼진다. 그래프의 왼쪽은 훈련과 테스트 점수 차이가 큰 과대적합, 오른쪽은 둘 다 낮아지는 과소적합이었고, 두 선이 가장 가깝고 테스트 점수가 가장 높은 지점은 -1, 즉 0.1이었다. 그래프 하나에 과대적합과 과소적합이 좌우로 펼쳐져 있는 게 신기했다.

```python
ridge = Ridge(alpha=0.1)
ridge.fit(train_scaled, train_target)
print(ridge.score(train_scaled, train_target))   # 0.990404845594141
print(ridge.score(test_scaled, test_target))     # 0.9826465162736733
```

### 라쏘 회귀 - 계수를 0으로 만든다

```python
from sklearn.linear_model import Lasso

lasso = Lasso(alpha=10)
lasso.fit(train_scaled, train_target)
print(lasso.score(train_scaled, train_target))   # 0.988820885788649
print(lasso.score(test_scaled, test_target))     # 0.9823020708550176
print(np.sum(lasso.coef_ == 0))                  # 40
```

사용법은 릿지와 같고 클래스 이름만 다르다. 같은 방법으로 찾은 최적 `alpha`는 10이라 릿지(0.1)와 범위가 꽤 달랐다. 라쏘를 학습할 때 `ConvergenceWarning`이 뜰 수 있는데, 릿지는 수식으로 한 번에 풀리지만 라쏘는 절댓값 때문에 반복 계산으로 근사해야 해서 반복 횟수가 부족하면 나오는 경고다. 에러가 아니라 알림이라 `max_iter=10000`처럼 반복 횟수를 늘려주면 된다.

라쏘의 진짜 특징은 마지막 줄이다. 55개 계수 중 40개가 정확히 0이다. 그 특성들은 예측에 전혀 안 쓰인다는 뜻이고, 나머지 15개가 유용한 특성이라는 것을 알려준다. 릿지는 모든 재료를 조금씩 쓰고, 라쏘는 필요 없는 재료를 아예 빼버린다.

| 구분 | 릿지 (Ridge) | 라쏘 (Lasso) |
|---|---|---|
| 벌점 기준 | 계수의 제곱 (L2) | 계수의 절댓값 (L1) |
| 계수를 0으로 | 작게만 만든다 | 0으로 만든다 |
| 쓰임 | 일반적으로 선호 | 특성 선택 |
| 계산 | 수식으로 한 번에 | 반복 계산 (`max_iter`) |

정리하면 하루의 첫 이야기는 이렇게 흘러갔다.

```
특성 1개 (다항회귀)         → 훈련 0.971 / 테스트 0.978   (어제)
특성 3개 → 9개 (degree=2)   → 훈련 0.990 / 테스트 0.971
특성 3개 → 55개 (degree=5)  → 훈련 1.000 / 테스트 -129.88
+ 릿지 (alpha=0.1)          → 훈련 0.990 / 테스트 0.983
+ 라쏘 (alpha=10)           → 훈련 0.989 / 테스트 0.982  (특성 15개만 사용)
```

그런데 여기에는 문제가 하나 숨어 있었다. `alpha`를 고를 때 테스트 세트 점수를 여러 번 보고 골랐다. 그러면 그 테스트 점수는 더 이상 "처음 보는 데이터에 대한 점수"가 아니다. 이건 오후에 교차 검증에서 정식으로 짚었다.

## 로지스틱 회귀 - 이름은 회귀인데 분류다
다음 문제는 생선 7종 전체를 길이, 높이, 두께, 대각선, 무게 5개 특성으로 분류하되, "도미다"가 아니라 "도미일 확률 84%"처럼 확률로 답하는 것이었다. 실무에서는 예/아니오보다 얼마나 확실한지가 중요할 때가 많다. 스팸 필터라면 확률이 높으면 삭제하고 애매하면 스팸함으로 보낼 수 있고, 확률이 있어야 어제 배운 임계값 조절도 할 수 있다.

```python
fish_input = fish_df[['Weight','Length','Diagonal','Height','Width']].to_numpy()
fish_target = fish_df['Species'].to_numpy()
```

어제는 도미=1, 빙어=0으로 직접 숫자를 만들었는데, scikit-learn은 문자열 타깃을 그대로 받아준다. 다만 클래스 순서가 자동으로 알파벳순으로 정렬된다.

```python
pd.unique(fish_df['Species'])
# ['Bream' 'Roach' 'Whitefish' 'Parkki' 'Perch' 'Pike' 'Smelt']  ← 원본 순서
kn.classes_
# ['Bream' 'Parkki' 'Perch' 'Pike' 'Roach' 'Smelt' 'Whitefish']  ← 알파벳순
```

이걸 모르면 `predict_proba()`의 열이 무슨 클래스인지 잘못 읽는다. 확률을 볼 때는 항상 `classes_`를 같이 출력하는 습관이 필요하다. 타깃에 클래스가 셋 이상인 이런 문제를 **다중 분류**라고 한다.

### KNN의 확률은 계단이다
먼저 KNN으로 해봤다. 다중 분류도 코드 변경 없이 그냥 된다.

```python
kn = KNeighborsClassifier(n_neighbors=3)
kn.fit(train_scaled, train_target)
proba = kn.predict_proba(test_scaled[:5])
print(np.round(proba, decimals=4))
# [[0.     0.     1.     0.     0.     0.     0.    ]
#  ...
#  [0.     0.     0.6667 0.     0.3333 0.     0.    ]   ← 네 번째 샘플
#  ...]

distances, indexes = kn.kneighbors(test_scaled[3:4])
print(train_target[indexes])   # [['Roach' 'Perch' 'Perch']]
```

네 번째 샘플의 이웃이 Roach 1개, Perch 2개라서 확률이 1/3, 2/3으로 나왔다. KNN의 확률은 이웃의 비율일 뿐이다. 그래서 이웃이 3개면 나올 수 있는 확률이 0, 1/3, 2/3, 1 넷뿐이다. "87% 확률로 도미" 같은 답은 절대 못 낸다. 이걸 확률이라고 할 수 있나 싶었고, 이게 로지스틱 회귀로 넘어가는 이유였다. 참고로 `test_scaled[3]`은 1차원이고 `test_scaled[3:4]`는 샘플 1개짜리 2차원이라, scikit-learn에 넣을 때는 슬라이싱을 써야 한다.

### 시그모이드 - 0과 1 사이로 찌그러뜨리기
로지스틱 회귀는 선형 회귀처럼 선형 방정식을 학습한다.

```
z = a × Weight + b × Length + c × Diagonal + d × Height + e × Width + f
```

`z`는 어떤 값이든 될 수 있는데 확률이 되려면 0~1 사이여야 한다. 그래서 `z`를 **시그모이드 함수(로지스틱 함수)**에 통과시킨다.

```
φ = 1 / (1 + e^(-z))
```

`z`가 큰 음수면 0에 가까워지고, 큰 양수면 1에 가까워지고, 0이면 정확히 0.5가 된다. 어떤 값을 넣어도 0~1 사이를 벗어나지 않는다. 그래프가 S자 모양이라 시그모이드라는 이름이 붙었다. 선형 회귀와 똑같이 계산해놓고 마지막에 0~1로 눌러 담는 깔때기를 하나 단 셈이다. "선형 계산 → 비선형 변환"이라는 구조는 나중에 신경망에서 활성화 함수로 또 나온다고 한다.

### 이진 분류 - 방정식 하나
먼저 도미와 빙어만 골라서 이진 분류를 해봤다. 데이터 분석 시간에 배운 불리언 인덱싱을 썼고, numpy 배열이라 `or`가 아니라 `|`를 써야 한다.

```python
bream_smelt_indexes = (train_target == 'Bream') | (train_target == 'Smelt')
train_bream_smelt = train_scaled[bream_smelt_indexes]
target_bream_smelt = train_target[bream_smelt_indexes]

lr = LogisticRegression()
lr.fit(train_bream_smelt, target_bream_smelt)
print(lr.classes_)                              # ['Bream' 'Smelt']
print(lr.predict_proba(train_bream_smelt[:5]))
# [[0.99759855 0.00240145]
#  [0.02735183 0.97264817]   ← 두 번째 샘플만 빙어
#  ...]
print(lr.coef_, lr.intercept_)
# [[-0.40451732 -0.57582787 -0.66248158 -1.01329614 -0.73123131]] [-2.16172774]
```

알파벳순이라 Bream이 음성(0), Smelt가 양성(1)이 됐다. 내가 정한 게 아니라 알파벳이 정했다. 확률이 0.9976처럼 연속적인 값으로 나와서 KNN과 확연히 달랐다.

`decision_function()`은 시그모이드를 통과하기 전의 `z` 값을 준다. 이걸 scipy의 `expit()`(시그모이드 함수)에 넣으면 `predict_proba()`의 두 번째 열과 똑같은 값이 나온다.

```python
decisions = lr.decision_function(train_bream_smelt[:5])
print(decisions)          # [-6.02991358  3.57043428 -5.26630496 -4.24382314 -6.06135688]

from scipy.special import expit
print(expit(decisions))   # [0.00239993 0.97262675 0.00513614 0.01414953 0.00232581]
```

이진 분류에서는 양성 클래스에 대한 방정식 하나만 계산하고, 음성 확률은 `1 - 양성 확률`로 얻는다. `expit`은 `np.exp()`로 직접 분수를 계산하는 것보다 편하고, `z`가 아주 클 때 생기는 오버플로도 알아서 처리해줘서 안전하다.

### 다중 분류 - 방정식 7개와 소프트맥스

```python
lr = LogisticRegression(C=20, max_iter=1000)
lr.fit(train_scaled, train_target)
print(lr.score(train_scaled, train_target))   # 0.9327731092436975
print(lr.score(test_scaled, test_target))     # 0.925
```

KNN(0.891 / 0.85)보다 좋아졌다. `LogisticRegression`은 반복 알고리즘이라 `max_iter`로 반복 횟수를 정하고(기본 100), 릿지처럼 계수의 제곱을 규제하는 L2 규제가 기본으로 켜져 있다. 아무 설정을 안 해도 이미 규제가 걸려 있다는 게 포인트다. 규제 세기는 `C`로 정하는데, 여기서 정말 헷갈리는 게 나온다.

| 매개변수 | 규제 세기 |
|---|---|
| `alpha` (Ridge, Lasso) | 크면 규제가 강하다 |
| `C` (LogisticRegression, SVM) | 작으면 규제가 강하다 |

`C`는 `1/alpha`에 해당해서 방향이 반대다. `C=20`은 기본값 1보다 규제를 20배 푼 것이고, 규제를 풀면 수렴이 더뎌지니 `max_iter`도 1000으로 늘렸다. 반복이 부족하면 라쏘 때처럼 `ConvergenceWarning`이 뜬다.

```python
proba = lr.predict_proba(test_scaled[:5])
print(np.round(proba, decimals=3))
# [[0.    0.014 0.842 0.    0.135 0.007 0.003]
#  [0.    0.003 0.044 0.    0.007 0.946 0.   ]
#  [0.    0.    0.034 0.934 0.015 0.016 0.   ]
#  [0.011 0.034 0.305 0.006 0.567 0.    0.076]
#  [0.    0.    0.904 0.002 0.089 0.002 0.003]]
print(lr.coef_.shape, lr.intercept_.shape)   # (7, 5) (7,)
```

첫 번째 샘플은 Perch일 확률이 84.2%다. 네 번째 샘플은 Perch 30.5%, Roach 56.7%로, 애매하다는 걸 확률이 말해준다. KNN이었다면 그냥 2/3이었을 것이다.

`coef_`의 모양이 `(7, 5)`인 이유는 다중 분류에서는 클래스마다 `z`를 하나씩 계산하기 때문이다. 심사위원 7명이 각자 "나일 확률" 점수를 매기고, 가장 높은 점수를 준 클래스가 답이 된다. 이 7개의 `z`를 확률로 바꾸는 게 **소프트맥스 함수**다.

```
e_sum = e^z1 + e^z2 + ... + e^z7
s1 = e^z1 / e_sum,  s2 = e^z2 / e_sum,  ...,  s7 = e^z7 / e_sum
→ s1부터 s7까지 더하면 1
```

7개 점수를 비율로 나누는데, 그냥 나누지 않고 지수함수를 먼저 씌운다. `z`가 음수여도 `e^z`는 항상 양수라 확률이 음수가 되지 않고, 차이도 벌어져서 확실한 것을 더 확실하게 만든다. 그래서 정규화된 지수함수라고도 부른다.

```python
decision = lr.decision_function(test_scaled[:5])
from scipy.special import softmax
proba = softmax(decision, axis=1)   # 행(샘플)마다 합이 1
```

`axis=1`로 줘야 샘플마다 합이 1이 된다. 첫 번째 샘플의 `z`는 Perch가 5.17로 가장 높고 Roach가 3.34로 두 번째였는데, 소프트맥스를 통과하니 0.842와 0.135가 됐다. `z`의 순서가 확률의 순서 그대로다.

| 구분 | 이진 분류 | 다중 분류 |
|---|---|---|
| 방정식 개수 | 1개 (양성 클래스) | 클래스 개수만큼 |
| 변환 함수 | 시그모이드 | 소프트맥스 |
| scipy 함수 | `expit()` | `softmax()` |

## 확률적 경사 하강법 - 조금씩 이어서 학습하기
실무에서는 훈련 데이터가 한 번에 준비되는 경우가 거의 없다. 생선이 매일 새로 잡혀 온다면 모델을 어떻게 갱신할까. 매일 새 데이터를 기존 데이터에 더해서 처음부터 다시 훈련하면 데이터가 계속 커져서 시간과 자원이 감당이 안 되고, 기존 데이터를 버리고 새 데이터로만 학습하면 중요한 데이터를 잃는다. 세 번째 길이 **점진적 학습**이다. 기존에 훈련한 모델을 버리지 않고 새 데이터로 조금씩 더 훈련한다. 어제 공부한 위에 오늘 것을 얹는 것이다. 데이터가 너무 커서 메모리에 한 번에 못 올리는 경우에도 이렇게 나눠서 학습해야 한다.

### 이름 뜯어보기와 에포크
Stochastic(확률적)은 무작위로, Gradient(경사)는 기울기, Descent(하강법)는 경사를 따라 내려가는 방법이다. 안개 낀 산에서 발밑의 기울기만 보고 가장 가파르게 내려가는 방향으로 한 걸음씩 가면 결국 골짜기에 도착한다. 훈련 세트에서 샘플을 무작위로 하나씩 골라서 내려가기 때문에 "확률적"이 붙었다. 그리고 한 번에 조금씩 움직여야 한다. 크게 뛰면 골짜기를 지나쳐 반대편 산으로 올라가버린다. 이 보폭이 학습률이다.

훈련 세트를 한 번 다 쓰고도 골짜기에 못 내려왔으면 처음부터 다시 돈다. 훈련 세트를 한 번 모두 사용하는 과정을 **에포크(epoch)**라고 한다. 문제집 한 바퀴가 1 에포크다. 딥러닝에서도 계속 쓰는 용어다.

| 방식 | 한 걸음에 쓰는 샘플 | 특징 |
|---|---|---|
| 확률적 경사 하강법 | 1개 | 빠르지만 튀는 데이터에 비틀거린다 |
| 미니배치 경사 하강법 | 몇 개~수백 개 | 실전에서 가장 많이 쓴다 |
| 배치 경사 하강법 | 전부 | 안정적이지만 자원을 많이 쓴다 |

신경망도 이 방식으로 학습한다. 다만 scikit-learn의 `SGDClassifier`는 이름 그대로 샘플을 하나씩 꺼내는 순수한 확률적 경사 하강법만 하고 미니배치는 지원하지 않는다.

### 손실 함수 - 그런데 무엇을 내려가나
"경사를 내려간다"에서 내려가는 대상이 **손실 함수(loss function)**다. 모델의 예측과 정답 사이의 오차를 재는 함수로, 얼마나 잘 맞히느냐가 아니라 얼마나 못 맞히느냐를 나타낸다. 그래서 작을수록 좋다. 정확도나 R²는 높을수록 좋은데 손실은 낮을수록 좋아서 방향이 반대다. 샘플 하나의 손실을 손실 함수, 전체 샘플의 손실 합을 비용 함수라고 구분하기도 하지만 보통은 섞어서 쓴다.

오늘 가장 중요한 대목은 "왜 정확도를 손실 함수로 쓸 수 없나"였다. 샘플이 4개면 정확도는 0, 0.25, 0.5, 0.75, 1 다섯 가지 값밖에 없다. 경사 하강법은 아주 조금씩 내려와야 하는데, 정확도는 계단이라 "어느 쪽으로 조금 움직이면 조금 나아진다"를 알 수 없다. 평평한 데서는 아무 정보가 없고 모서리에서는 뚝 떨어진다. 기울기를 구하려면 미분이 되어야 하고, 미분이 되려면 매끄러운 연속 함수여야 한다.

해법은 방금 배운 로지스틱 회귀의 확률을 쓰는 것이다. 확률은 0.87, 0.8701, 0.8702처럼 연속적이라 계수를 조금 바꾸면 확률도 조금 바뀌고, 그래서 기울기를 잴 수 있다. 수업에서는 예측 확률이 0.9, 0.3, 0.2, 0.8인 샘플 4개로 설명했다.

```
양성 샘플(정답 1): 예측 확률 × 1에 음수를 붙인다
    0.9 → -0.9   손실이 작다 (좋다)
    0.3 → -0.3   손실이 크다 (나쁘다)

음성 샘플(정답 0): 양성처럼 바꿔서 계산한다
    예측 0.2 → 음성일 확률 1 - 0.2 = 0.8 → -0.8
```

확률이 높을수록 좋은데 손실은 작을수록 좋아야 하니 음수로 뒤집었다. 음성 샘플은 0.2를 그대로 곱하면 무조건 0이 되니까 "음성일 확률"로 바꿔서 같은 방식으로 다룬다. 이게 **로지스틱 손실 함수**, 다른 이름으로 이진 크로스 엔트로피(BCE)다. 실제로는 여기에 로그를 씌워서 확신을 갖고 틀린 예측에 아주 큰 벌점을 준다. 다중 분류는 크로스 엔트로피, 회귀는 어제 배운 MAE나 MSE를 손실 함수로 쓴다. 손실 함수를 직접 만들 일은 거의 없고, 이름과 언제 쓰는지만 알면 된다.

### SGDClassifier와 partial_fit

```python
from sklearn.linear_model import SGDClassifier

sc = SGDClassifier(loss='log_loss', max_iter=10, random_state=42)
sc.fit(train_scaled, train_target)
print(sc.score(train_scaled, train_target))   # 0.773109243697479
print(sc.score(test_scaled, test_target))     # 0.775

sc.partial_fit(train_scaled, train_target)    # 1 에포크 더
print(sc.score(train_scaled, train_target))   # 0.8487394957983193
print(sc.score(test_scaled, test_target))     # 0.9
```

`loss='log_loss'`가 로지스틱 손실 함수다. 기본값은 `'hinge'`라 그냥 두면 로지스틱 회귀가 아니다. 옛 자료(scikit-learn 1.1 이하)에는 `'log'`로 나온다. 10 에포크로는 둘 다 0.77로 과소적합이었는데, `partial_fit()`으로 1 에포크만 더 돌렸더니 0.849, 0.9로 확 올랐다. `fit()`을 다시 부르면 지금까지 배운 걸 버리고 처음부터 하지만, `partial_fit()`은 기존 학습을 유지한 채 1 에포크씩 이어서 한다. 점진적 학습을 하려면 반드시 `partial_fit()`이다.

### 에포크와 조기 종료
에포크도 하이퍼파라미터다. 너무 적으면 과소적합, 너무 많으면 과대적합이다. 300 에포크 동안 점수를 기록해서 그려봤다.

```python
sc = SGDClassifier(loss='log_loss', random_state=42)
classes = np.unique(train_target)
train_score, test_score = [], []

for _ in range(0, 300):
    sc.partial_fit(train_scaled, train_target, classes=classes)
    train_score.append(sc.score(train_scaled, train_target))
    test_score.append(sc.score(test_scaled, test_target))
```

`partial_fit()`만 쓸 때는 모델이 전체 클래스 목록을 모르니 `classes=`로 미리 알려줘야 한다. 그래프에서 훈련 점수는 계속 오르는데 테스트 점수는 어느 순간 꺾이기 시작했다. 그 지점이 과대적합이 시작되는 곳이고, 그 전에 훈련을 멈추는 것을 **조기 종료(early stopping)**라고 한다. 오전에 본 릿지의 `alpha` 그래프와 모양이 똑같았다. 하이퍼파라미터를 한쪽으로 밀면 과대적합, 반대로 밀면 과소적합이라는 패턴이 계속 반복된다.

```python
sc = SGDClassifier(loss='log_loss', max_iter=100, tol=None, random_state=42)
sc.fit(train_scaled, train_target)
print(sc.score(train_scaled, train_target))   # 0.957983193277311
print(sc.score(test_scaled, test_target))     # 0.925
```

`SGDClassifier`는 일정 에포크 동안 성능이 `tol`만큼도 안 좋아지면 알아서 멈추는데, `tol=None`으로 끄면 `max_iter`만큼 무조건 돈다. 100 에포크로 로지스틱 회귀와 거의 같은 성능이 나왔다. `loss='hinge'`로 바꾸면 서포트 벡터 머신의 손실 함수가 되는데 결과는 0.950 / 0.925로 비슷했다. `SGDClassifier`는 알고리즘이라기보다 "경사 하강법으로 학습하는 틀"이고, `loss`가 어떤 모델이 될지 정한다. 데이터가 작으면 `LogisticRegression`, 크거나 계속 들어오면 `SGDClassifier`를 쓰면 된다. 경사 하강법은 스케일에 아주 민감해서 스케일링은 사실상 필수다.

## 결정 트리 - 왜 그렇게 예측했는지 설명하기
오후에는 와인 데이터로 바뀌었다. 알코올 도수, 당도, pH로 레드 와인(0)과 화이트 와인(1)을 구분하는 이진 분류다. 샘플이 6,497개로 생선보다 훨씬 크고, 화이트 4,898개 대 레드 1,599개로 불균형하다.

먼저 배운 대로 로지스틱 회귀를 해봤더니 0.781 / 0.778로 과소적합이었다. 그런데 진짜 문제는 다른 데 있었다.

```python
print(lr.coef_, lr.intercept_)
# [[ 0.51268071  1.67335441 -0.68775646]] [1.81773456]
```

`z = 0.513 × 알코올 + 1.673 × 당도 - 0.688 × pH + 1.818`이 0보다 크면 화이트 와인이다. 그런데 "당도 계수가 1.673이라서 화이트 와인입니다"라고 하면 아무도 못 알아듣는다. 다항 특성까지 추가하면 더 설명하기 어려워진다. 대출 거절이나 의료 진단처럼 설명해야 하는 분야에서는 "왜"에 답하지 못하는 모델을 쓰기 어렵다.

### 스무고개처럼 질문하기
**결정 트리**는 스무고개처럼 질문을 하나씩 던져서 정답을 맞혀간다. 결과가 순서도라 누구나 읽을 수 있다.

```python
from sklearn.tree import DecisionTreeClassifier, plot_tree

dt = DecisionTreeClassifier(random_state=42)
dt.fit(train_scaled, train_target)
print(dt.score(train_scaled, train_target))   # 0.996921300750433
print(dt.score(test_scaled, test_target))     # 0.8592307692307692

plt.figure(figsize=(10, 7))
plot_tree(dt, max_depth=1, filled=True, feature_names=['alcohol', 'sugar', 'pH'])
```

테스트 점수가 로지스틱 회귀보다 훨씬 높았지만 훈련과 차이가 커서 과대적합이었다. 트리를 다 그리면 너무 커서 `plot_tree`의 `max_depth=1`로 루트와 그 자식만 봤다. 여기서 `max_depth`는 그림에 그릴 깊이이지 모델의 깊이가 아니다. `filled=True`는 클래스에 맞게 색을 칠해준다.

맨 위 노드가 루트 노드, 맨 아래 끝이 리프 노드다. 노드에는 테스트 조건, 불순도(gini), 총 샘플 수(samples), 클래스별 샘플 수(value)가 적혀 있다. `value = [1258, 3939]`는 레드 1,258개, 화이트 3,939개라는 뜻이지 왼쪽 가지와 오른쪽 가지로 간 개수가 아니다. 처음에 이걸 헷갈렸다. 예측은 분류에서는 리프 노드에서 가장 많은 클래스, 회귀(`DecisionTreeRegressor`)에서는 리프 노드에 도달한 샘플들의 타깃 평균이다.

### 불순도와 정보 이득
트리는 데이터를 잘 나누는 질문을 **불순도(impurity)**로 고른다. 기본값인 지니 불순도는 클래스 비율을 제곱해서 더한 다음 1에서 뺀다.

```
지니 불순도 = 1 - (음성 클래스 비율² + 양성 클래스 비율²)

루트 노드:      1 - ((1258/5197)² + (3939/5197)²) = 0.367
반반 섞이면:    1 - ((50/100)² + (50/100)²)       = 0.5  ← 최악
한 종류만 있으면: 1 - ((100/100)² + (0/100)²)     = 0    ← 순수 노드
```

한 상자에 여러 종류가 섞인 정도라고 보면 된다. 트리는 부모 노드와 자식 노드의 불순도 차이가 가능한 크도록 자란다. 이 차이가 **정보 이득(information gain)**이다.

```
정보 이득 = 부모의 불순도
          - (왼쪽 샘플 수 / 부모 샘플 수) × 왼쪽 불순도
          - (오른쪽 샘플 수 / 부모 샘플 수) × 오른쪽 불순도
        = 0.367 - (2922/5197) × 0.481 - (2275/5197) × 0.069 = 0.066
```

"이 질문을 했더니 얼마나 깔끔해졌나"를 재는 것이다. 자식 노드를 샘플 수로 가중하는 이유는 샘플 5개짜리 노드보다 5,000개짜리 노드가 훨씬 중요하기 때문이다. 트리는 가능한 모든 질문(특성 × 임계값)을 다 시험해보고 정보 이득이 가장 큰 것을 고르고, 자식 노드에서 또 반복한다. 이게 학습의 전부다. `criterion='entropy'`로 바꾸면 제곱 대신 밑이 2인 로그를 쓰는 엔트로피 불순도를 쓰는데 결과는 대개 비슷하다.

### 가지치기
제한 없이 키운 트리는 모든 리프가 순수해질 때까지, 결국 샘플 하나짜리 리프까지 자란다. 그게 통째로 외우는 것이다. 그래서 트리의 최대 깊이를 정해서 가지를 친다.

```python
dt = DecisionTreeClassifier(max_depth=3, random_state=42)
dt.fit(train_scaled, train_target)
print(dt.score(train_scaled, train_target))   # 0.8454877814123533
print(dt.score(test_scaled, test_target))     # 0.8415384615384616
```

훈련 점수는 0.997에서 0.845로 떨어졌지만 두 점수가 거의 붙었다. 규제와 같은 이야기다. `max_depth` 외에도 `min_samples_split`, `min_samples_leaf`, `min_impurity_decrease`, `max_features` 같은 가지치기 매개변수가 있다.

이제 트리를 읽어서 "당도가 -0.239보다 작고 -0.802보다 크고, 알코올 도수가 0.454보다 작으면 레드 와인"이라고 설명할 수 있게 됐다. 그런데 당도가 음수라니 말이 안 된다. 표준화를 했기 때문이다.

### 결정 트리는 전처리가 필요 없다
결정 트리는 특성값이 아니라 클래스별 비율로 불순도를 계산하고, "이 값보다 큰가 작은가"만 본다. 단위가 cm든 km든 순서만 같으면 결과가 같아서 스케일링이 영향을 주지 않는다. 원본 데이터로 다시 학습해봤다.

```python
dt = DecisionTreeClassifier(max_depth=3, random_state=42)
dt.fit(train_input, train_target)             # 전처리 안 한 원본
print(dt.score(train_input, train_target))    # 0.8454877814123533
print(dt.score(test_input, test_target))      # 0.8415384615384616
```

점수가 소수점까지 똑같았다. 그리고 이제 트리가 진짜 와인 이야기를 한다. "당도가 1.625보다 크고 4.325보다 작은 와인 중에 알코올 도수가 11.025 이하인 것이 레드 와인이고, 그 외는 모두 화이트 와인이다." 어제 "모든 알고리즘이 거리 기반은 아니다"라고 했던 게 여기서 실물로 확인됐다. 트리에서는 스케일링을 안 하는 게 오히려 낫다. 트리를 읽을 수 있으니까.

| 스케일링 필요 | 스케일링 불필요 |
|---|---|
| KNN, SVM (거리 기반) | 결정 트리 |
| 선형 회귀, 로지스틱 회귀, SGD (경사 하강법, 규제) | 랜덤 포레스트, 부스팅 (트리 계열) |

### 특성 중요도

```python
print(dt.feature_importances_)
# [0.12345626 0.86862934 0.0079144 ]   alcohol, sugar, pH
```

각 노드의 정보 이득에 샘플 비율을 곱해서 특성별로 더한 값이고, 모두 더하면 1이다. 당도가 86.9%로 가장 높았는데, 루트 노드부터 당도로 나누고 있었으니 당연하다. pH는 거의 안 쓰였다. 라쏘가 계수를 0으로 만들어 특성을 골라준 것처럼 특성 선택에 활용할 수 있다. 다만 중요도는 상관관계일 뿐이라 "당도가 와인 색을 결정한다"는 인과관계로 읽으면 안 된다.

## 교차 검증과 그리드 서치
오전부터 찜찜했던 문제를 여기서 풀었다. 릿지의 `alpha`도, 트리의 `max_depth=3`도 테스트 세트 점수를 보면서 골랐다. 그러면 테스트 세트에만 잘 맞는 모델이 만들어질 가능성이 커진다. 모의고사 문제집을 답 보면서 스무 번 풀고 90점이라고 하는 것과 같다. 그래서 테스트 세트는 마지막에 딱 한 번만 써야 한다.

### 검증 세트
테스트 세트 대신 훈련 세트를 또 나눠서 **검증 세트(validation set)**를 만든다.

```
전체 데이터
├── 훈련 세트 (80%)
│   ├── 훈련 세트 (64%)   ← 모델 학습
│   └── 검증 세트 (16%)   ← 하이퍼파라미터 고르기
└── 테스트 세트 (20%)      ← 마지막에 딱 한 번
```

순서는 훈련 세트로 학습 → 검증 세트로 평가하면서 하이퍼파라미터를 바꿔가며 최적값 찾기 → 훈련 세트와 검증 세트를 합쳐서 다시 학습 → 테스트 세트로 최종 평가다. 하이퍼파라미터를 정했으면 검증 세트도 다시 합쳐서 최종 모델을 만든다. 데이터를 버릴 이유가 없으니까. 마지막 테스트 점수가 "실전에서 이 정도 나올 것"이라는 유일하게 믿을 만한 숫자다.

```python
train_input, test_input, train_target, test_target = train_test_split(
    data, target, test_size=0.2, random_state=42)
sub_input, val_input, sub_target, val_target = train_test_split(
    train_input, train_target, test_size=0.2, random_state=42)
print(sub_input.shape, val_input.shape, test_input.shape)
# (4157, 3) (1040, 3) (1300, 3)

dt = DecisionTreeClassifier(random_state=42)
dt.fit(sub_input, sub_target)
print(dt.score(sub_input, sub_target))   # 0.9971133028626413
print(dt.score(val_input, val_target))   # 0.864423076923077
```

`train_test_split`을 두 번 불러서 나눴다. 이제 테스트 세트를 안 건드리고 하이퍼파라미터를 조정할 수 있다.

### k-폴드 교차 검증
그런데 검증 세트를 떼니 훈련 데이터가 줄었고, 그렇다고 검증 세트를 줄이면 검증 점수가 들쑥날쑥해진다. 이 딜레마를 푸는 게 **교차 검증(cross validation)**이다. 훈련 세트를 k등분해서 한 조각씩 돌아가며 검증 세트 역할을 맡기고, 그 점수들을 평균 낸다.

```
1회: [검증][훈련][훈련][훈련][훈련]
2회: [훈련][검증][훈련][훈련][훈련]
3회: [훈련][훈련][검증][훈련][훈련]
4회: [훈련][훈련][훈련][검증][훈련]
5회: [훈련][훈련][훈련][훈련][검증]
        → 5개 점수의 평균
```

모든 데이터가 한 번씩 검증에 쓰이고, 매번 4/5는 훈련에도 쓰인다. 보통 5-폴드나 10-폴드를 많이 쓴다.

```python
from sklearn.model_selection import cross_validate

scores = cross_validate(dt, train_input, train_target)
# {'fit_time': array([...]), 'score_time': array([...]),
#  'test_score': array([0.86923077, 0.84615385, 0.87680462, 0.84889317, 0.83541867])}
print(np.mean(scores['test_score']))   # 0.855300214703487
```

검증 세트를 떼기 전의 훈련 세트 전체(`train_input`)를 넘겨야 한다. 나누는 건 `cross_validate`가 알아서 한다. 결과의 `test_score`는 이름과 달리 테스트 세트가 아니라 검증 폴드의 점수라서 헷갈렸다. 다섯 개 점수 중 하나만 봤으면 0.835나 0.877로 판단이 갈렸을 텐데, 평균 0.855가 훨씬 안정적이다.

주의할 점이 있다. `cross_validate()`는 폴드를 나눌 때 데이터를 섞지 않는다. 섞으려면 분할기를 지정해야 하고, 기본적으로 회귀는 `KFold`, 분류는 클래스 비율을 유지하는 `StratifiedKFold`를 쓴다.

```python
from sklearn.model_selection import StratifiedKFold
splitter = StratifiedKFold(n_splits=10, shuffle=True, random_state=42)
scores = cross_validate(dt, train_input, train_target, cv=splitter)
print(np.mean(scores['test_score']))   # 0.8574181117533719
```

### 하이퍼파라미터는 같이 골라야 한다
`max_depth`의 최적값을 먼저 찾고, 그걸 고정한 채 `min_samples_split`의 최적값을 찾으면 될까. 아니다. `max_depth`의 최적값은 `min_samples_split`이 바뀌면 같이 바뀐다. 라면을 끓일 때 물의 양을 먼저 정하고 불 세기를 나중에 정하면 안 되는 것과 같다. 서로 얽혀 있어서 모든 조합을 동시에 시험해야 하는데, 이걸 사람이 하기는 불가능하다. 사람 개입 없이 하이퍼파라미터 튜닝을 자동으로 하는 기술을 AutoML이라고 하고, 그 원시적인 형태가 그리드 서치다.

### GridSearchCV

```python
from sklearn.model_selection import GridSearchCV

params = {'min_impurity_decrease': [0.0001, 0.0002, 0.0003, 0.0004, 0.0005]}
gs = GridSearchCV(DecisionTreeClassifier(random_state=42), params, n_jobs=-1, cv=5)
gs.fit(train_input, train_target)
print(gs.best_params_)   # {'min_impurity_decrease': 0.0001}
print(gs.best_score_)    # 0.8681929740134745

dt = gs.best_estimator_
print(dt.score(train_input, train_target))   # 0.9615162593804117
```

`GridSearchCV`는 하이퍼파라미터 탐색과 교차 검증을 한 번에 한다. 값 5개 × 5-폴드라 모델 25개를 훈련하고, `n_jobs=-1`로 CPU 코어를 전부 써서 병렬로 돌린다. 그리고 최적 조합을 찾은 뒤 전체 훈련 세트로 다시 학습한 모델을 `best_estimator_`에 넣어둔다. 아까 검증 세트 순서의 세 번째 단계를 자동으로 해주는 것이라 따로 `fit()`할 필요가 없다.

`pd.DataFrame(gs.cv_results_)`로 보면 각 조합의 폴드별 점수와 평균(`mean_test_score`)이 다 나온다. `np.argmax`로 평균이 가장 큰 인덱스를 찾아 `params`에서 꺼내보니 `best_params_`와 같았다. 표로 보니 0.8682와 0.8645가 큰 차이가 아니라는 것도 보였다. "최적"이 압도적으로 좋은 게 아닐 수도 있다.

여러 매개변수를 동시에 탐색할 수도 있다.

```python
params = {
    'min_impurity_decrease': np.arange(0.0001, 0.001, 0.0001),  # 9개
    'max_depth': range(5, 20, 1),                                # 15개
    'min_samples_split': range(2, 100, 10),                      # 10개
}
gs = GridSearchCV(DecisionTreeClassifier(random_state=42), params, n_jobs=-1)
gs.fit(train_input, train_target)
print(gs.best_params_)
# {'max_depth': 14, 'min_impurity_decrease': 0.0004, 'min_samples_split': 12}
print(gs.best_score_)   # 0.8683865773302731
```

9 × 15 × 10 = 1,350개 조합에 5-폴드라 모델을 6,750개 만든다. 실수 범위는 `np.arange`, 정수는 `range`로 만들었다. `max_depth`가 14로 나왔는데 아까 손으로 고른 3보다 훨씬 크다. 다른 매개변수와 같이 조절하니 깊어도 괜찮아진 것이라 "동시에 봐야 한다"를 실제로 확인했다.

### RandomizedSearchCV
매개변수가 수치면 범위나 간격을 미리 정하기 어렵고, 조합이 많으면 그리드 서치가 너무 오래 걸린다. 랜덤 서치는 값의 목록 대신 확률 분포 객체를 받아서 범위 안에서 무작위로 뽑아 시험한다.

```python
from scipy.stats import uniform, randint
from sklearn.model_selection import RandomizedSearchCV

params = {
    'min_impurity_decrease': uniform(0.0001, 0.001),   # 실수 균등분포
    'max_depth': randint(20, 50),                       # 정수 균등분포
    'min_samples_split': randint(2, 25),
    'min_samples_leaf': randint(1, 25),
}
gs = RandomizedSearchCV(DecisionTreeClassifier(random_state=42), params,
                        n_iter=100, n_jobs=-1, random_state=42, cv=5)
gs.fit(train_input, train_target)
print(np.max(gs.cv_results_['mean_test_score']))   # 0.8695428296438884

dt = gs.best_estimator_
print(dt.score(test_input, test_target))   # 0.86
```

조합을 100개만 뽑았는데 그리드 서치 1,350개보다 점수가 조금 더 좋았다. 대부분의 매개변수는 성능에 별 영향이 없는데 격자 탐색은 그런 것까지 꼬박꼬박 다 시험하고, 무작위로 던지면 중요한 매개변수의 다양한 값을 더 많이 보게 되기 때문이다. `min_impurity_decrease`도 0.000341처럼 격자에 없던 값이 나왔다.

그리고 드디어 테스트 세트를 딱 한 번 썼다. 0.86이 이 모델의 진짜 실력이다. 검증 점수 0.8695보다 살짝 낮은데, 검증 점수는 여러 번 들여다보며 고른 것이라 조금 낙관적이기 마련이라 정상이다.

## 트리의 앙상블 - 나무 한 그루보다 숲
열심히 튜닝해도 결정 트리 하나로는 0.87 언저리가 한계였다. 제한을 안 하면 과대적합이고, 제한하면 성능이 안 나온다.

가장 좋은 알고리즘이라는 게 있을까. 답은 데이터 종류에 따라 다르다는 것이다. CSV나 데이터베이스처럼 행과 열로 된 정형 데이터에서는 **앙상블 학습**이 가장 뛰어나고, 텍스트나 사진, 음악 같은 비정형 데이터는 규칙성을 찾기 어려워서 신경망을 쓴다. JSON이나 XML처럼 고정된 틀은 없지만 구조가 있는 건 반정형 데이터라고 부른다. 캐글에서도 정형 데이터 문제는 대부분 부스팅 계열이 우승한다고 한다.

앙상블은 여러 모델을 훈련해서 그 예측을 합치는 방법이고, 대부분 결정 트리 기반이다. 전문가 한 명에게 묻는 대신 여러 명에게 묻고 다수결을 하는 것이다. 각 모델이 서로 다른 실수를 하면 합쳤을 때 실수가 상쇄된다. 그래서 핵심 조건은 모델들이 서로 달라야 한다는 것이고, 일부러 다르게 만드는 방법이 알고리즘마다 다르다.

### 랜덤 포레스트
랜덤 포레스트는 결정 트리를 랜덤하게 만들어 숲을 만든다. 트리를 서로 다르게 만드는 방법이 두 가지다.

첫째는 **부트스트랩 샘플**이다. 훈련 세트에서 중복을 허용해서 훈련 세트와 같은 크기만큼 뽑는다. 공 1,000개가 든 가방에서 하나 뽑고 다시 넣기를 1,000번 반복하면, 어떤 공은 세 번 뽑히고 어떤 공은 한 번도 안 뽑힌다. 그래서 트리마다 조금씩 다른 데이터로 학습한다.

둘째는 노드를 나눌 때마다 전체 특성 중 일부만 무작위로 골라서 그중 최선의 분할을 찾는 것이다. `RandomForestClassifier`는 전체 특성 개수의 제곱근만큼 쓴다. 이렇게 일부러 제약을 거는 이유는, 안 그러면 모든 트리가 가장 좋은 특성(와인에서는 당도)을 계속 골라서 다 비슷해지기 때문이다.

기본으로 트리 100개를 만들고, 분류는 각 트리의 클래스별 확률을 평균해서 가장 높은 클래스를, 회귀는 각 트리의 예측을 평균해서 답한다.

```python
from sklearn.ensemble import RandomForestClassifier

rf = RandomForestClassifier(n_jobs=-1, random_state=42)
scores = cross_validate(rf, train_input, train_target,
                        return_train_score=True, n_jobs=-1)
print(np.mean(scores['train_score']), np.mean(scores['test_score']))
# 0.9973541965122431 0.8905151032797809
```

아무 설정 없이 검증 0.8905가 나와서 열심히 튜닝한 결정 트리(0.870)를 넘어섰다. `return_train_score=True`로 훈련 점수도 같이 받으면 과대적합 여부를 바로 비교할 수 있다. 훈련 0.997이라 차이는 여전히 크지만 검증 점수가 훨씬 높다.

```python
rf.fit(train_input, train_target)
print(rf.feature_importances_)
# [0.23167441 0.50039841 0.26792718]   ← RandomForest
# [0.12345626 0.86862934 0.0079144 ]   ← DecisionTree
```

결정 트리는 당도에 86.9%를 몰아줬는데 랜덤 포레스트는 50%로 낮췄다. 당도를 못 보는 트리도 있으니 다른 특성으로라도 나눠야 했고, 그 과정에서 알코올과 pH의 쓸모가 드러났다. 하나의 특성에 과도하게 집중하지 않아서 일반화 성능이 올라간다.

부트스트랩으로 뽑을 때 한 번도 안 뽑힌 샘플을 **OOB(out of bag)** 샘플이라고 한다. 평균적으로 37%쯤이고, 그 트리에게는 처음 보는 데이터다. 이걸 모아서 검증에 쓸 수 있다.

```python
rf = RandomForestClassifier(oob_score=True, n_jobs=-1, random_state=42)
rf.fit(train_input, train_target)
print(rf.oob_score_)   # 0.8934000384837406
```

교차 검증 없이도 비슷한 점수가 나왔다. 공짜로 검증 세트가 하나 생기는 셈이다.

### 엑스트라 트리
엑스트라 트리는 랜덤 포레스트와 비슷하게 트리 100개를 만들고 노드마다 특성 일부를 무작위로 고르는데, 부트스트랩을 안 쓰고 전체 훈련 세트를 쓴다. 대신 노드를 나눌 때 최선의 분할을 찾지 않고 무작위로 분할한다. 트리 하나였다면 성능이 떨어지겠지만, 많이 묶으면 다양성이 커져서 과대적합이 억제된다. 개별 트리는 나빠지는데 합치면 좋아진다는 게 신기했다.

```python
from sklearn.ensemble import ExtraTreesClassifier
et = ExtraTreesClassifier(n_jobs=-1, random_state=42)
scores = cross_validate(et, train_input, train_target, return_train_score=True, n_jobs=-1)
print(np.mean(scores['train_score']), np.mean(scores['test_score']))
# 0.9974503966084433 0.8887848893166506
```

랜덤 포레스트와 거의 같은 점수다. 무작위성이 더 커서 보통 트리를 더 많이 만들어야 하지만, 가장 무거운 계산인 최선의 분할 찾기를 건너뛰어서 속도는 빠르다.

### 그레이디언트 부스팅
여기서 방식이 근본적으로 바뀐다. 랜덤 포레스트와 엑스트라 트리는 트리를 동시에, 독립적으로 만드는 배깅이다. 그레이디언트 부스팅은 깊이 3짜리 얕은 트리를 순서대로 하나씩 추가하면서, 이전 트리들이 틀린 부분을 보완한다. 첫 트리가 대충 맞히면 두 번째 트리는 첫 트리가 틀린 부분에 집중하고, 세 번째는 둘이 합쳐도 남은 오차를 배운다. 오답노트를 쌓아가는 것이다. 오전에 SGD에서 계수를 조금씩 움직여 손실을 내려갔던 것처럼, 여기서는 트리를 하나씩 추가해서 손실을 내려간다.

| 구분 | 배깅 (랜덤 포레스트, 엑스트라 트리) | 부스팅 (그레이디언트 부스팅) |
|---|---|---|
| 트리를 만드는 방식 | 동시에, 독립적으로 | 순서대로, 앞 트리를 보고 |
| 각 트리 | 깊고 강하다 | 얕고 약하다 (깊이 3) |
| 병렬 처리 | `n_jobs`로 가능 | 불가능 |

```python
from sklearn.ensemble import GradientBoostingClassifier

gb = GradientBoostingClassifier(random_state=42)   # n_jobs가 없다
scores = cross_validate(gb, train_input, train_target, return_train_score=True, n_jobs=-1)
print(np.mean(scores['train_score']), np.mean(scores['test_score']))
# 0.8881086892152563 0.8720430147331015

gb = GradientBoostingClassifier(n_estimators=500, learning_rate=0.2, random_state=42)
# 0.9464595437171814 0.8780082549788999
```

검증 점수는 랜덤 포레스트보다 낮았지만 훈련과 검증의 차이가 0.016밖에 안 났다. 랜덤 포레스트는 0.107이었다. 트리를 5배로 늘리고 학습률도 0.2로 올렸는데도 과대적합을 잘 억제하면서 검증 점수가 0.878로 올랐다. `learning_rate`는 트리 하나가 결과에 얼마나 기여할지를 정하는데, 낮추면 트리를 더 많이 넣어야 해서 `n_estimators`와 반대로 움직인다. 특성 중요도는 당도 0.68로, 특성을 무작위로 제한하지 않는 부스팅이 랜덤 포레스트보다 좋은 특성에 더 집중했다. `subsample`을 1.0보다 작게 주면 트리마다 훈련 세트의 일부만 써서 미니배치 경사 하강법과 비슷해진다.

단점은 느리다는 것이다. 두 번째 트리는 첫 번째가 끝나야 만들 수 있어서 원리상 병렬화가 안 되고, 그래서 `n_jobs` 매개변수 자체가 없다.

### 히스토그램 기반 그레이디언트 부스팅
이 속도 문제를 푼 게 히스토그램 기반 그레이디언트 부스팅이다. 입력 특성을 미리 256개 구간으로 나눠둔다. 원래는 노드를 나눌 때 가능한 모든 임계값을 시험해야 해서 샘플이 5,000개면 후보가 5,000개인데, 구간으로 나누면 후보가 256개로 줄어서 최적의 분할을 매우 빠르게 찾는다. 256개 구간 중 하나는 누락된 값용으로 떼어놔서 결측치가 있어도 그냥 학습된다.

```python
from sklearn.ensemble import HistGradientBoostingClassifier

hgb = HistGradientBoostingClassifier(random_state=42)
scores = cross_validate(hgb, train_input, train_target, return_train_score=True, n_jobs=-1)
print(np.mean(scores['train_score']), np.mean(scores['test_score']))
# 0.9321723946453317 0.8801241948619236
```

과대적합을 잘 억제하면서 그레이디언트 부스팅보다 조금 더 높은 성능이 나왔다. 트리 개수는 `n_estimators`가 아니라 `max_iter`로 정한다. 요즘 정형 데이터에서 가장 먼저 시도해볼 알고리즘이라고 한다.

특성 중요도는 `permutation_importance()`로 계산했다. 특성 하나의 값을 일부러 뒤죽박죽 섞어놓고 성능이 얼마나 떨어지는지 보는 방식이라, 많이 떨어지면 중요한 특성이다.

```python
from sklearn.inspection import permutation_importance

hgb.fit(train_input, train_target)
result = permutation_importance(hgb, test_input, test_target,
                                n_repeats=10, random_state=42, n_jobs=-1)
print(result.importances_mean)          # [0.05969231 0.20238462 0.049     ]
hgb.score(test_input, test_target)      # 0.8723076923076923
```

학습 과정의 불순도 감소로 계산하는 `feature_importances_`와 달리, 학습이 끝난 뒤 성능 변화로 재니까 어떤 모델에든 쓸 수 있고 테스트 세트로도 잴 수 있다. "실전에서 어떤 특성이 실제로 도움이 되는가"를 볼 수 있다는 게 장점이다.

### XGBoost와 LightGBM
scikit-learn 밖에도 강력한 부스팅 라이브러리가 있다. Colab에는 이미 설치돼 있다.

```python
from xgboost import XGBClassifier
xgb = XGBClassifier(tree_method='hist', random_state=42)
# 0.9572351925731766 0.8781988968682904

from lightgbm import LGBMClassifier
lgb = LGBMClassifier(random_state=42)
# 0.935828414851749 0.8801251203079884
```

XGBoost는 `tree_method='hist'`로 히스토그램 기반이 되고, `HistGradientBoostingClassifier`는 LightGBM에서 영감을 받아 만들어졌다고 한다. 와인 데이터가 특성 3개로 작아서 결과가 0.878~0.880으로 다 비슷했다.

| 알고리즘 | 훈련 | 검증 |
|---|---|---|
| 결정 트리 (랜덤 서치 튜닝) | - | 0.870 |
| 랜덤 포레스트 | 0.997 | 0.891 |
| 엑스트라 트리 | 0.997 | 0.889 |
| 그레이디언트 부스팅 | 0.888 | 0.872 |
| 히스토그램 기반 GB | 0.932 | 0.880 |
| XGBoost | 0.957 | 0.878 |
| LightGBM | 0.936 | 0.880 |

검증 점수 1위는 랜덤 포레스트였지만 훈련과의 차이도 가장 컸다. 결국 "가장 좋은 알고리즘"은 없고 여러 개를 시험해보고 고르는 수밖에 없다. 전부 트리 기반이라 이 노트북에서는 `StandardScaler`를 한 번도 안 썼고, 덕분에 코드가 확 짧아졌다. 대신 앙상블은 느리고, 모델 파일이 크고, 결정 트리의 최대 장점이었던 "순서도로 설명하기"가 사라진다는 단점이 있다.

수업 마지막에 정리해주신 게 기억에 남는다. 정형 데이터는 일반 머신러닝, 실시간 이미지나 컴퓨터 비전은 딥러닝, 자연어 활용과 생성형 AI는 LLM이다. 6~7월에 LangChain으로 LLM을 배웠으니 다 LLM으로 풀면 되지 않나 싶지만, 와인 6,500개를 분류하는 데 LLM을 쓰면 느리고 비싸고 정확도도 낮다. 도구를 문제에 맞게 골라야 한다.

## 헷갈리기 쉬운 부분
- 특성 수가 샘플 수에 가까워지면 모델이 훈련 세트를 통째로 외운다. 42개 샘플에 55개 특성이면 테스트 R²가 -129까지 떨어진다.
- 릿지, 라쏘, 로지스틱 회귀처럼 규제가 있는 모델은 반드시 스케일링부터 한다. 계수 크기로 벌점을 주기 때문이다.
- `alpha`는 클수록 규제가 강하고, `C`는 작을수록 규제가 강하다. 방향이 반대다.
- `LogisticRegression`은 기본으로 L2 규제가 켜져 있다.
- 문자열 타깃의 `classes_`는 알파벳순이다. `predict_proba()`를 볼 때 같이 출력한다.
- 정확도는 계단처럼 끊겨서 미분이 안 되므로 손실 함수로 못 쓴다. 손실은 낮을수록 좋다.
- `fit()`은 처음부터 다시, `partial_fit()`은 이어서 1 에포크다. 처음 `partial_fit()`을 부를 때는 `classes=`를 준다.
- `plot_tree(max_depth=)`는 그림만 자르고, `DecisionTreeClassifier(max_depth=)`는 모델을 자른다.
- 노드의 `value`는 클래스별 샘플 수이지 가지별 샘플 수가 아니다.
- 결정 트리와 트리 앙상블은 스케일링이 필요 없다.
- 테스트 세트로 하이퍼파라미터를 고르면 안 된다. 검증 세트나 교차 검증으로 고르고, 테스트 세트는 마지막에 한 번만 쓴다.
- `cross_validate()` 결과의 `test_score`는 검증 폴드 점수다. 그리고 `train_input` 전체를 넘긴다.
- `best_estimator_`는 이미 전체 훈련 세트로 다시 학습돼 있다.
- 그레이디언트 부스팅에는 `n_jobs`가 없고, 히스토그램 기반 부스팅은 트리 개수를 `max_iter`로 정한다.

## 오늘 배운 내용 정리
오늘은 다중회귀와 규제, 로지스틱 회귀, 확률적 경사 하강법, 결정 트리, 교차 검증과 그리드 서치, 트리의 앙상블까지 배웠다.

```
다중회귀: 특성 여러 개. PolynomialFeatures로 제곱항·곱셈항을 만든다 (특성공학).
과대적합: 특성이 샘플 수에 가까워지면 훈련 R² 1.0, 테스트 R² -129.
규제: 계수를 작게. 릿지(L2, 제곱) / 라쏘(L1, 절댓값, 계수를 0으로). 스케일링 필수. alpha.
로지스틱 회귀: 선형 방정식 z → 시그모이드(이진) / 소프트맥스(다중) → 확률. C는 작을수록 규제 강함.
SGD: 샘플을 하나씩 뽑아 손실 함수를 조금씩 내려간다. partial_fit()으로 이어서 학습.
손실 함수: 얼마나 못 맞히나. 미분 가능해야 해서 정확도 대신 로지스틱 손실(BCE).
에포크: 적으면 과소적합, 많으면 과대적합. 테스트 점수가 꺾이기 전에 멈춘다 (조기 종료).
결정 트리: 불순도(gini)가 가장 많이 줄어드는 질문을 고른다. 설명 가능, 스케일링 불필요. max_depth로 가지치기.
검증: 테스트 세트는 마지막에 한 번. 검증 세트 → k-폴드 교차 검증 (cross_validate).
튜닝: GridSearchCV(조합 전부) / RandomizedSearchCV(분포에서 무작위). best_estimator_는 재학습돼 있다.
앙상블: 랜덤 포레스트(부트스트랩 + 특성 무작위), 엑스트라 트리(무작위 분할),
        그레이디언트 부스팅(얕은 트리를 순서대로), 히스토그램 기반 부스팅(256구간, 빠르다).
```

하루 종일 같은 그림이 반복됐다는 게 가장 기억에 남았다. 릿지의 `alpha`를 바꿨을 때도, SGD의 에포크를 늘렸을 때도, 트리의 깊이를 정할 때도 한쪽으로 밀면 과대적합, 반대로 밀면 과소적합이었고, 그 사이 어딘가에 적당한 지점이 있었다. 그리고 그 지점을 테스트 세트로 찾으면 안 된다는 것, 일부러 무작위로 나쁘게 만든 트리 100개를 합치면 오히려 더 좋아진다는 것도 같이 남았다.

---
