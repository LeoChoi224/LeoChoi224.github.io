---
layout: single
title: "머신러닝 기초 정리 3 - 심부전증 모델링, SVM과 다중 분류 평가, 외국어 판별 웹 서비스"
categories: [coding, MachineLearning]
tag: [study-log, MachineLearning, scikit-learn, classification_report, XGBoost, SVM, ROC, OvR, joblib, FastAPI]
toc: true
author_profile: false
sidebar:
    nav: "docs"
search: true
---
<hr/>

지난주에 이론을 몰아서 배웠다면 오늘은 그걸 실제로 써먹는 날이었다. 데이터 분석 때 EDA만 했던 심부전증 데이터에 모델을 붙여서 평가했고, BMI 데이터를 직접 만들어 SVM으로 3분류를 하면서 다중 분류의 평가지표를 읽는 법을 배웠다. 마지막에는 텍스트를 숫자로 바꿔 어느 나라 말인지 맞히는 모델을 만들고, 그 모델을 FastAPI 웹 서비스로 띄워봤다.

## 심부전증 EDA에 모델 붙이기
데이터 분석 수업 때 이 데이터로 EDA를 하면서 심박출계수(`ejection_fraction`)와 혈청 크레아티닌(`serum_creatinine`)이 사망(`DEATH_EVENT`)과 관련 있어 보인다는 것까지 눈으로 확인했었다. 그런데 "관련 있어 보인다"에서 멈췄다. 새 환자가 왔을 때 위험한지 예측하려면 모델이 필요하다. EDA는 데이터를 이해하는 단계이고, 모델링은 그 이해를 예측으로 바꾸는 단계다. 어떤 열을 쓸지, 스케일링이 필요한지, 클래스가 불균형한지는 전부 EDA에서 이미 봤던 것들이라 그대로 이어졌다.

### 수치형만 스케일링하기

```python
X_num = df[['age', 'creatinine_phosphokinase', 'ejection_fraction',
            'platelets', 'serum_creatinine', 'serum_sodium']]
X_cat = df[['anaemia', 'diabetes', 'high_blood_pressure', 'sex', 'smoking']]
y = df['DEATH_EVENT']
```

이 노트북에서 가장 중요한 판단은 수치형과 범주형을 나눈 것이었다. 범주형 데이터는 이미 0과 1로 인코딩돼 있어서 수치형만 스케일링한다. `smoking`은 0(비흡연)과 1(흡연)인데 여기에 표준화를 걸면 -0.7과 1.4 같은 값이 된다. 계산은 되지만 "흡연 여부가 -0.7"이라는 건 뜻이 없다. 게다가 범주형은 이미 0~1 범위라 스케일을 맞출 필요도 없다.

```python
scaler = StandardScaler()
scaler.fit(X_num)
X_scaled = scaler.transform(X_num)

X_scaled = pd.DataFrame(data=X_scaled, index=X_num.index, columns=X_num.columns)
X = pd.concat([X_scaled, X_cat], axis=1)

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, random_state=42)
X_train.shape, X_test.shape   # ((209, 11), (90, 11))
```

`StandardScaler`는 numpy 배열을 돌려주니까 `DataFrame`으로 다시 감싸고 `pd.concat`으로 범주형과 옆으로 붙였다. 이때 `index=X_num.index`를 맞춰줘야 `concat`할 때 행이 어긋나지 않는다.

다만 여기서는 스케일러를 전체 데이터로 `fit`한 다음에 나눴다. 지난주에 계속 강조한 데이터 누수 문제라, 원래는 먼저 나누고 훈련 세트로만 `fit`하는 게 맞다. 평균과 표준편차만 쓰는 거라 영향은 크지 않겠지만 습관으로는 위험하다. 열마다 다른 전처리를 하는 `ColumnTransformer`를 `Pipeline`과 같이 쓰면 이런 실수를 할 여지가 없어진다고 한다. 그리고 전체가 299명뿐이라 테스트 90명이면 정확도 1%가 환자 한 명이다. 점수를 소수점 셋째 자리까지 따질 의미가 없는 규모다.

### 정확도 0.68 뒤에 숨은 재현율 0.35

```python
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report

model_lr = LogisticRegression()
model_lr.fit(X_train, y_train)
pred = model_lr.predict(X_test)
print(classification_report(y_test, pred))
```

```
              precision    recall  f1-score   support

           0       0.67      0.91      0.77        53
           1       0.72      0.35      0.47        37

    accuracy                           0.68        90
   macro avg       0.69      0.63      0.62        90
weighted avg       0.69      0.68      0.65        90
```

`classification_report`는 클래스별 정밀도, 재현율, F1을 한 번에 보여준다. 이 표를 제대로 읽는 게 오늘의 핵심이었다. 정확도 0.68만 보면 그럭저럭인데, 클래스 1(사망) 줄의 재현율이 0.35다. 실제로 사망한 37명 중 13명만 맞히고 24명을 놓쳤다는 뜻이다. 생존자는 91%를 찾아내는데 정작 찾아야 할 사망자는 3명 중 1명만 찾는다.

지난주에 재현율이 중요한 경우로 암 진단과 금융 사기 적발을 배웠는데, 심부전증 사망 예측이 정확히 그 경우다. 위험한 환자를 괜찮다고 하면 사람이 죽는다. 재현율 0.35는 실전에서 못 쓰는 수준인데 "정확도 68%"라는 한 줄이 이걸 완전히 가리고 있었다.

| 항목 | 뜻 |
|---|---|
| support | 그 클래스의 실제 개수 (53명 / 37명) |
| macro avg | 클래스별 점수의 단순 평균. 작은 클래스도 똑같이 취급한다 |
| weighted avg | support로 가중평균. 큰 클래스가 더 반영된다 |

불균형 데이터에서는 `macro avg`를 봐야 한다. `weighted avg`는 다수 클래스에 끌려가서 좋아 보인다. 여기서도 재현율이 macro는 0.63, weighted는 0.68이라 macro 쪽이 더 정직하다. 그리고 클래스가 53:37로 불균형한데 `train_test_split`에 `stratify=y`를 주지 않았는데, 데이터가 작고 불균형할 때는 꼭 주는 게 좋다.

### XGBoost와 비교

```python
from xgboost import XGBClassifier
model_xgb = XGBClassifier()
model_xgb.fit(X_train, y_train);
pred = model_xgb.predict(X_test)
print(classification_report(y_test, pred))
```

```
              precision    recall  f1-score   support

           0       0.68      0.81      0.74        53
           1       0.63      0.46      0.53        37

    accuracy                           0.67        90
```

`fit()` 끝의 세미콜론은 주피터에서 모델 객체가 셀 아래 길게 출력되는 걸 막는 관용구다. 정확도는 0.68에서 0.67로 오히려 조금 내려갔는데 사망 재현율은 0.35에서 0.46으로 올랐다.

| 지표 | 로지스틱 회귀 | XGBoost |
|---|---|---|
| 정확도 | 0.68 | 0.67 |
| 사망 재현율 | 0.35 | 0.46 |
| 사망 F1 | 0.47 | 0.53 |

어느 쪽이 좋은 모델일까. 정확도만 보면 로지스틱 회귀, 사망자를 놓치지 않는다는 목적으로 보면 XGBoost다. 업무 특성이 지표를 정한다는 말의 실물이었다. 지난주에 앙상블이 정형 데이터에서 가장 강하다고 배웠는데 여기서 압도적이지 않은 이유는 데이터가 299개뿐이라서다. 부스팅은 데이터가 많을 때 진가를 발휘하고, 테스트가 90개면 우연의 영향도 크다. 이 정도 차이로 우열을 단정하기보다는 교차 검증으로 여러 번 재보는 게 맞다. XGBoost는 트리 기반이라 사실 스케일링이 필요 없는데, 두 모델을 같은 데이터로 비교하려고 통일한 것이다.

### 특성 중요도와 ROC 비교

```python
model_xgb.feature_importances_
# [0.1133, 0.0754, 0.1297, 0.0593, 0.2165, 0.0620,
#  0.0337, 0.0665, 0.0641, 0.1233, 0.0562]
plt.bar(X.columns, model_xgb.feature_importances_)
plt.xticks(rotation=90)
```

열 순서는 `pd.concat` 순서 그대로라 가장 높은 0.2165가 `serum_creatinine`, 그다음이 `ejection_fraction`(0.1297)과 `sex`(0.1233)였다. 데이터 분석 시간에 눈으로 짚었던 두 특성이 모델에서도 상위로 나와서, EDA의 직관과 모델의 판단이 맞아떨어진 게 반가웠다. `sns.jointplot(x='ejection_fraction', y='serum_creatinine', data=df, hue='DEATH_EVENT')`로 두 특성을 축으로 놓고 사망 여부를 색칠해서 다시 확인했다. 다만 특성 중요도는 인과관계가 아니고, 데이터가 이렇게 작으면 `sex`가 세 번째로 나온 것도 우연일 수 있다.

마지막으로 두 모델의 ROC 곡선을 한 그래프에 겹쳐 그렸다.

```python
fig = plt.figure()
ax = fig.gca()   # get current axes

proba_lr = model_lr.predict_proba(X_test)[:, 1]
proba_xgb = model_xgb.predict_proba(X_test)[:, 1]

fprs, tprs, thresholds = roc_curve(y_test, proba_lr)
ax.plot(fprs, tprs, label='Logistic Regression')
fprs, tprs, thresholds = roc_curve(y_test, proba_xgb)
ax.plot(fprs, tprs, label='XGBoost')
fig.legend()
```

`predict_proba(X_test)[:, 1]`이 양성 클래스(사망) 확률이고, `ax` 하나에 `plot`을 두 번 하면 겹쳐 그려진다. `RocCurveDisplay`를 쓰면 더 간단하고 AUC까지 범례에 자동으로 나온다.

```python
from sklearn.metrics import RocCurveDisplay
fig = plt.figure()
ax = fig.gca()
RocCurveDisplay.from_estimator(model_lr, X_test, y_test, ax=ax)
RocCurveDisplay.from_estimator(model_xgb, X_test, y_test, ax=ax)
```

`classification_report`는 임계값 0.5 하나만 본 결과이고, ROC는 모든 임계값을 종합한다. 재현율이 낮은 게 문제라면 임계값을 낮추면 된다. `(proba > 0.3).astype(int)`처럼 "조금이라도 위험하면 위험하다고 하라"고 하면 정밀도는 떨어지지만 놓치는 환자가 줄어든다. `LogisticRegression(class_weight='balanced')`처럼 소수 클래스를 틀렸을 때 벌을 더 크게 주는 방법도 있다.

정리하면 데이터 불러오기 → EDA → 전처리(수치형/범주형 구분, 스케일링, 분리) → 모델 학습 → 평가(classification_report, 특성 중요도, ROC)가 정형 데이터 프로젝트의 기본 골격이다. 데이터 분석 수업 때 앞의 두 단계를 했고 오늘 나머지를 붙였다.

## BMI - SVM으로 비만도 3분류
지금까지는 생선, 와인, 환자처럼 남이 만든 데이터를 썼는데, 이번에는 데이터를 직접 만들었다. 무작위로 2만 명의 키와 몸무게를 만들고 BMI 공식으로 저체중, 정상, 비만 레이블을 붙인 다음, SVM이 그 규칙을 찾아내는지 확인한다. 정답 규칙을 내가 아는 데이터로 실험하는 셈이다. 클래스가 셋이라 지난주에 배운 평가지표가 다중 분류에서 어떻게 확장되는지도 볼 수 있었다.

### SVM - 마진을 최대화하는 경계선
SVM(서포트 벡터 머신)은 두 무리 사이에 선을 긋되, 양쪽에서 가장 가까운 점까지의 거리(마진)가 가장 넓어지도록 긋는다. 선을 그을 수 있는 방법은 무수히 많고 로지스틱 회귀도 선을 긋는데, SVM은 가장 여유 있는 선을 고른다는 게 다르다.

```
       ●  ●          |     ○  ○
     ●   ●     ←마진→|←마진→   ○   ○
       ●    ●        |        ○
                  경계선
```

경계선에 가장 가까이 있는 점들을 서포트 벡터라고 하고, 이 점들만 경계선을 결정하고 나머지는 아무 영향이 없다. 마진이 넓으면 새 데이터가 조금 튀어도 경계를 넘어갈 여유가 있어서 일반화 성능이 좋아진다. SVM은 원래 이진 선형 분류 모델인데, scikit-learn의 `SVC`는 클래스가 셋 이상이면 알아서 여러 개의 이진 분류기를 만들어 처리하고, 기본 커널인 `rbf`를 쓰면 휘어진 경계도 그린다.

### 데이터 직접 만들기

```python
def calc_bmi(h, w):
    bmi = w / (h / 100) ** 2
    if bmi < 18.5: return "thin"
    if bmi < 25: return "normal"
    return "fat"

with open(file_path, "w", encoding="utf-8-sig") as fp:
    fp.write('height,weight,label\n')
    cnt = {"thin": 0, "normal": 0, "fat": 0}
    random.seed(42)
    for i in range(20000):
        h = random.randint(120, 200)
        w = random.randint(35, 80)
        label = calc_bmi(h, w)
        cnt[label] += 1
        fp.write(f"{h},{w},{label}\n")
    print(cnt)   # {'thin': 6347, 'normal': 5991, 'fat': 7662}
```

BMI는 몸무게(kg)를 키(m)의 제곱으로 나눈 값이라 `h / 100`으로 cm를 m로 바꿨다. 2만 개를 CSV로 저장했고, 클래스 분포가 꽤 균형 잡혀 나왔다. `encoding="utf-8-sig"`는 파일 앞에 BOM을 붙여서 엑셀에서 열 때 한글이 안 깨지게 한다.

```python
data = df[['height', 'weight']]
label = df['label'].apply(lambda x: {'thin': 0, 'normal': 1, 'fat': 2}[x])
X_train, X_test, y_train, y_test = train_test_split(data, label, random_state=42)
# ((15000, 2), (5000, 2), (15000,), (5000,))
```

지난주에 문자열 타깃도 그대로 쓸 수 있다고 배웠는데 여기서는 숫자로 바꿨다. 뒤에서 ROC를 그릴 때 숫자가 편하고, thin < normal < fat이라는 순서에 의미가 있기 때문이다. 문자열 그대로면 알파벳순으로 fat, normal, thin이 돼서 순서가 뒤죽박죽이 된다. `train_test_split`에는 DataFrame을 그대로 넘길 수 있고, 열 이름이 살아 있어서 나중에 편하다.

### MinMaxScaler와 SVM 학습

```python
from sklearn.preprocessing import MinMaxScaler

scaler = MinMaxScaler()
scaler.fit(X_train)
X_train_scaled = scaler.transform(X_train)
X_test_scaled = scaler.transform(X_test)
```

지금까지는 `StandardScaler`만 썼는데 처음으로 `MinMaxScaler`를 썼다. `(x - 최솟값) / (최댓값 - 최솟값)`으로 0~1 범위에 맞춘다. 키(120~200)와 몸무게(35~80)는 범위가 명확하고 이상치가 없어서 잘 맞는다. `MinMaxScaler`는 극단값이 하나만 있어도 나머지가 전부 0 근처로 뭉치기 때문에 이상치가 없다고 확신할 때 쓴다. SVM은 거리와 마진을 계산해서 스케일링이 필수다. 안 하면 KNN의 수상한 도미처럼 키가 계산을 지배한다.

```python
sklearn.set_config(display='text')

clf = svm.SVC()
clf.fit(X_train_scaled, y_train)
print(clf.score(X_train_scaled, y_train))   # 0.9939333333333333
print(clf.score(X_test_scaled, y_test))     # 0.9926
```

`set_config(display='text')`는 주피터에서 모델 객체를 HTML 다이어그램으로 보여주는 기능이 Windows에서 인코딩 문제로 깨져서 텍스트 출력으로 되돌린 것이다. 결과는 훈련 0.9939, 테스트 0.9926으로 거의 완벽하고 과대적합도 없었다.

그런데 이 99%를 자랑하면 안 된다. 키와 몸무게만 알면 라벨이 100% 정해지는 결정적인 데이터라 잡음도 예외도 측정 오차도 없다. "SVM이 대단하다"가 아니라 "규칙이 있는 데이터니 찾아냈다"로 읽어야 한다. 오전의 심부전증 데이터에서 0.68이 나온 것과 비교하면 확실하다. 다만 BMI 공식이 `w / h²`라 경계가 곡선인데, SVM이 `rbf` 커널로 그걸 잘 근사했다는 건 의미가 있다.

### 예측 함수

```python
scaler.feature_names_in_   # array(['height', 'weight'], dtype=object)

def predict_bmi(h, w):
    pred = clf.predict(scaler.transform(
        pd.DataFrame([[h, w]], columns=scaler.feature_names_in_)))
    return pred

print(predict_bmi(162, 89), predict_bmi(182, 52), predict_bmi(173, 70))
# [2] [0] [1]   → fat, thin, normal
```

`fit()`에 DataFrame을 넣으면 scikit-learn이 열 이름을 `feature_names_in_`에 기억한다. 그다음 `transform()`에 열 이름이 없거나 다른 데이터를 넣으면 `UserWarning: X has feature names...` 경고가 뜬다. 그래서 예측할 때도 같은 열 이름으로 만들어 넣었다. 162cm 89kg은 BMI 33.9로 fat, 182cm 52kg은 15.7로 thin, 173cm 70kg은 23.4로 normal이라 셋 다 맞았다.

### 다중 분류 평가지표는 값이 세 개씩

```python
predict = clf.predict(X_test_scaled)
print('accuracy', accuracy_score(y_test, predict))
print('precision', precision_score(y_test, predict, average=None))
print('recall', recall_score(y_test, predict, average=None))
print('f1-score', f1_score(y_test, predict, average=None))
```

```
accuracy 0.9926
precision [0.98989261 0.9870801  0.99946495]
recall    [0.99618563 0.98899676 0.99256111]
f1-score  [0.99302915 0.9880375  0.99600107]
```

정확도는 하나인데 나머지는 세 개씩 나왔다. 정밀도와 재현율은 "양성 클래스"를 기준으로 정의되는데, 클래스가 셋이면 무엇을 양성으로 볼지가 셋이다. `average=None`을 주면 thin, normal, fat을 각각 양성으로 봤을 때의 값을 따로 계산해준다.

| `average` | 결과 |
|---|---|
| `None` | 클래스별로 배열 |
| `'macro'` | 클래스별 값의 단순 평균 |
| `'weighted'` | support로 가중평균 |
| `'micro'` | 전체를 합쳐서 하나로 |

normal이 가장 낮게 나온 게 재미있었다. thin과 fat 사이에 끼어 있어서 경계가 양쪽에 다 있기 때문이다. 양 끝 클래스는 한쪽 경계만 신경 쓰면 된다. 이 네 함수는 `classification_report` 한 줄로 대체할 수 있다.

```python
cl_report = metrics.classification_report(
    y_test, predict, target_names=['thin', 'normal', 'fat'])
```

```
              precision    recall  f1-score   support

        thin       0.99      1.00      0.99      1573
      normal       0.99      0.99      0.99      1545
         fat       1.00      0.99      1.00      1882

    accuracy                           0.99      5000
```

`target_names=`를 주면 0/1/2 대신 이름이 나와서 훨씬 읽기 좋다.

### 다중 분류 ROC - OvR
ROC는 원래 "양성이냐 음성이냐"의 임계값을 움직이며 그리는 이진 분류용 곡선이다. 클래스가 셋이면 "하나 vs 나머지"로 쪼개서 클래스마다 하나씩 그린다. thin vs (normal + fat), normal vs (thin + fat), fat vs (thin + normal)로 곡선 세 개가 나온다. 이걸 OvR(One-vs-Rest) 방식이라고 한다.

```python
from sklearn.preprocessing import label_binarize

clf = svm.SVC(probability=True, random_state=42)
clf.fit(X_train_scaled, y_train)
y_score = clf.predict_proba(X_test_scaled)

classes = [0, 1, 2]
y_test_bin = label_binarize(y_test, classes=classes)
# [0, 2, 1, ...] → [[1,0,0], [0,0,1], [0,1,0], ...]

fpr, tpr, roc_auc = {}, {}, {}
for i in range(len(classes)):
    fpr[i], tpr[i], _ = metrics.roc_curve(y_test_bin[:, i], y_score[:, i])
    roc_auc[i] = metrics.auc(fpr[i], tpr[i])
```

핵심은 두 가지였다. 첫째, `SVC`는 기본적으로 확률을 주지 않아서 `probability=True`로 다시 학습해야 한다. 안 그러면 `predict_proba`가 없다. SVM은 원래 경계선의 어느 쪽인지만 판단하는 알고리즘이라 확률을 내려면 내부적으로 보정을 해야 하고, 그래서 학습이 몇 배 느려진다. 2만 개라 실제로 시간이 꽤 걸렸다. 둘째, `roc_curve`는 "이 샘플이 양성이냐"를 0/1로 요구하니까 `label_binarize`로 정답을 클래스별 0/1로 펼친다. `y_test_bin[:, i]`가 "i번 클래스인가", `y_score[:, i]`가 "i번 클래스일 확률"이다. `metrics.auc()`는 곡선 아래 면적을 직접 계산한다.

### 데이터 분포 보기

```python
df2 = pd.read_csv(file_path, index_col=2, encoding='utf-8-sig')   # label을 인덱스로
fig, ax = plt.subplots(1, 1)

def scatter(lbl, color):
    b = df2.loc[lbl]
    ax.scatter(b['weight'], b['height'], c=color, label=lbl)

scatter('fat', 'red')
scatter('normal', 'yellow')
scatter('thin', 'purple')
```

`index_col=2`로 라벨을 인덱스로 만들면 `df2.loc['fat']`으로 그 클래스만 뽑을 수 있다. 그림을 보니 세 영역이 곡선으로 나뉘어 있었다. 직선으로는 못 나누는 모양이라 휘어진 경계를 그리는 커널이 필요했던 이유가 눈에 보였다.

`SVC` 말고도 `NuSVC`, `LinearSVC`가 있는데, `LinearSVC`는 선형 전용이라 정답률은 조금 떨어지지만 실행 시간이 훨씬 짧다고 한다. SVM은 샘플 수가 늘면 급격히 느려져서 큰 데이터에는 `LinearSVC`나 `SGDClassifier(loss='hinge')`를 쓴다. 참고로 `SVC`의 C는 Classification의 C다.

## 외국어 판별 - 텍스트를 숫자로 바꾸기
마지막 프로젝트는 문장을 읽고 어느 나라 말인지 맞히는 것이었다. 웹에서 데이터를 모으다 보면 한국어가 아닌 경우가 많은데, 알파벳을 쓴다고 다 영어는 아니다. 영어, 프랑스어, 인도네시아어, 타갈로그어 네 언어를 구분한다.

그런데 지금까지 다룬 데이터는 전부 숫자였다. 텍스트는 숫자가 아니라서 그대로 모델에 넣을 수 없다. 어떻게 숫자로 바꾸느냐가 오늘의 진짜 주제였다.

### 알파벳 26개의 출현 빈도
언어학적으로 언어가 다르면 알파벳의 출현 빈도가 다르다고 알려져 있다. 언어마다 자주 쓰는 표현과 단어가 다르기 때문이다. 그래서 문장을 통째로 보지 않고 'a'부터 'z'까지 각 알파벳이 몇 %씩 나오는지, 숫자 26개로 요약해서 특성으로 쓴다. 영어는 e, t, a가 많고, 프랑스어는 e가 압도적이고, 인도네시아어는 a가 유난히 많다.

이 아이디어 하나가 프로젝트의 거의 전부였다. 모델은 SVM 기본값 하나뿐이다. 지난주에 `PolynomialFeatures`로 특성을 자동으로 만들었다면 이번에는 사람이 아이디어를 낸 특성공학이다. 특성을 잘 만들면 모델은 단순해도 된다. 이 표현은 단어 순서를 완전히 버려서 "The cat sat"과 "sat cat The"가 같은 벡터가 되는데, 어느 언어인지는 글자 분포만으로 알 수 있으니 충분하다.

```
lang
  ├ test     테스트 데이터 8개
  └ train    학습 데이터 20개
en 영어 / fr 프랑스어 / id 인도네시아어 / tl 타갈로그어
```

파일 이름이 `en-1.txt`, `fr-2.txt`처럼 앞 두 글자가 언어 코드라서 파일 이름이 곧 정답이다. 라벨을 따로 관리할 필요가 없게 폴더를 만들어둔 것이다.

```python
def check_freq(fname):
    name = os.path.basename(fname)
    lang = re.match(r'^[a-z]{2,}', name).group()   # 파일 앞 글자 추출
    with open(fname, "r", encoding='utf-8') as f:
        text = f.read().lower()

    cnt = []
    for i in range(26):
        ch = chr(i + ord('a'))
        cnt.append(text.count(ch))

    total = sum(cnt)
    freq = list(map(lambda n: n / total, cnt))   # 정규화
    return (freq, lang)
```

`.lower()`로 소문자로 바꿔야 A와 a를 같은 글자로 센다. `ord('a')`는 97이고 `chr(97)`은 'a'라서 `i`를 0~25로 돌리면 a부터 z까지 나온다. 언어 코드는 `name[:2]`로 잘라도 되는데, 정규식 `^[a-z]{2,}`는 "앞에서부터 소문자 2개 이상"이라 세 글자 코드에도 대응된다. 리턴이 `(특성, 라벨)` 튜플이라 머신러닝의 `(X, y)` 모양 그대로다.

### 정규화가 없으면 망한다
마지막의 `n / total`이 중요하다. 문서 길이가 제각각이라, 짧은 영어 글에서 a가 50번 나오고 긴 영어 글에서 500번 나오면 같은 언어인데 벡터가 10배 차이 난다. 모델은 이 둘을 완전히 다른 것으로 본다. 횟수를 전체 대비 비율로 바꾸면 둘 다 a가 7.6%로 같아져서 길이와 무관해진다. 지난주 스케일링과 목적이 같은데, 여기서는 문제에 맞는 정규화를 직접 만든 것이다. 모든 특성이 이미 0~1 범위의 비율이라 스케일러는 따로 쓰지 않았다.

```python
def load_files(path):
    freqs, labels = [], []
    for fname in glob.glob(path):
        r = check_freq(fname)
        freqs.append(r[0])
        labels.append(r[1])
    return {"freqs": freqs, "labels": labels}

data = load_files(os.path.join(base_path, r'lang/train/*.txt'))
test = load_files(os.path.join(base_path, r'lang/test/*.txt'))
```

`glob.glob()`은 `*.txt` 같은 와일드카드로 파일 목록을 가져온다.

### 학습과 평가

```python
clf = svm.SVC()
clf.fit(data["freqs"], data["labels"])
predict = clf.predict(test['freqs'])
print(predict)          # ['tl' 'en' 'en' 'fr' 'id' 'id' 'fr' 'tl']
print(test['labels'])   # ['tl', 'en', 'en', 'fr', 'id', 'id', 'fr', 'tl']
print(metrics.accuracy_score(test['labels'], predict))   # 1.0
```

8개 전부 맞혀서 정답률 100%가 나왔다. 하지만 테스트가 8개, 클래스당 2개뿐이라 하나만 틀려도 87.5%로 떨어진다. 훈련도 20개라 "일단 되는구나"를 확인한 정도로 봐야 한다. 라벨이 문자열 그대로인 것도 scikit-learn이 알아서 받아준다.

언어별로 빈도를 평균 내서 `df.plot(kind='bar', subplots=True, ylim=(0, 0.15))`로 그려보니 막대 모양이 언어마다 확연히 달랐다. 왜 이 방법이 통하는지 눈으로 볼 수 있었다. 다만 그 코드는 `(기존 평균 + 새 값) / 2`로 둘씩 평균을 내서, 뒤에 온 파일일수록 비중이 커진다. A, B, C 순서면 `A/4 + B/4 + C/2`가 된다. 파일마다 같은 가중치로 보려면 다 더해서 개수로 나눠야 한다.

### 판정 함수와 모델 저장

```python
joblib.dump(clf, './freq.pkl')

def detect_lang(text):
    text = text.lower()
    cnt = []
    for i in range(26):
        ch = chr(i + ord('a'))
        cnt.append(text.count(ch))

    total = sum(cnt)
    if total == 0: return "입력이 없습니다."

    freq = list(map(lambda n: n / total, cnt))
    res = clf.predict([freq])
    lang_dic = {"en": "영어", "fr": "프랑스어", "id": "인도네시아어", "tl": "타갈로그어"}
    return lang_dic[res[0]]
```

첫 머신러닝 수업 때 배운 `joblib.dump()`가 오늘은 실제 목적이 생겼다. 웹 서버가 이 파일을 읽어서 쓴다. 판정 함수에서 가장 중요한 건 학습 때와 똑같은 방식으로 특성을 만든다는 것이다. 소문자 변환 → 26개 세기 → 비율로. 학습 때의 전처리와 예측 때의 전처리가 한 글자라도 다르면 엉뚱한 결과가 나온다. 한글만 넣으면 알파벳이 0개라 0으로 나누기 에러가 나서 `total == 0`을 먼저 막았다. 샘플 하나도 2차원으로 넣어야 해서 `[freq]`처럼 대괄호를 씌웠다.

창세기 1장을 네 언어로 넣어봤더니 전부 맞혔다. 같은 내용의 서로 다른 번역이라 오직 언어 차이만 측정된다는 게 영리한 테스트였다.

```python
detect_lang("In the beginning God created heaven, and earth...")   # '영어'
detect_lang("u commencement, Dieu créa les cieux et la terre...")   # '프랑스어'
detect_lang("ada mulanya Allah menciptakan langit dan bumi...")     # '인도네시아어'
detect_lang("ang pasimula ay nilikha ng Dios ang langit...")        # '타갈로그어'
```

### FastAPI로 웹 서비스 만들기

```python
# main.py
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
import joblib

clf = joblib.load(r'./model/freq.pkl')   # 서버 시작 시 한 번만

def detect_lang(text):
    ...   # 노트북과 동일한 함수

app = FastAPI()
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

@app.get("/lang")
def form(request: Request):
    return templates.TemplateResponse(request, "langform.html", {})

class InputText(BaseModel):
    text: str

@app.post("/detect_lang")
def class_lang(body: InputText):
    return {"result": detect_lang(body.text)}
```

6월에 배운 FastAPI 구조가 그대로 나왔다. 여기서 중요한 건 `joblib.load()`를 함수 밖, 모듈 최상단에 둔 것이다. 요청마다 파일을 읽으면 느리니까 서버가 뜰 때 한 번만 읽고 메모리에 들고 있는다. 엔드포인트는 HTML 화면을 주는 `GET /lang`과 JSON으로 예측 결과를 주는 `POST /detect_lang`으로 나눴고, 화면을 받은 뒤 fetch로 API를 부른다.

```javascript
// static/langform.js
detectBtn.addEventListener("click", () => {
    fetch("http://127.0.0.1:8000/detect_lang", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: textInput.value })
    })
    .then(response => response.json())
    .then(obj => { resultElem.textContent = obj.result; })
    .catch(error => { console.error("Error:", error); });
});
```

`JSON.stringify({ text: ... })`의 키 이름 `text`가 서버의 `InputText.text`와 정확히 맞아야 한다. 다르면 422 에러가 난다. 6월 React 프로젝트에서는 CORS 설정이 필수였는데 여기는 필요 없다. HTML도 FastAPI가 직접 서빙해서 화면과 API가 같은 8000번 포트, 같은 출처이기 때문이다.

수업 중에 CSR과 SSR 이야기도 나왔다. CSR(Client-Side Rendering)은 서버 부하를 줄이지만 응답한 HTML에 실제 내용이 없어서 검색엔진 최적화에 불리하고, SSR(Server-Side Rendering)은 서버가 화면을 만들어서 서버 부하가 크다. 이 프로젝트는 HTML 골격은 Jinja2가 서버에서 만들고 결과 표시는 fetch로 채워서 둘이 섞여 있다.

### 이 방식의 한계와 주의할 점
- 짧은 문장에 약하다. "Hello"는 알파벳 5개뿐이라 빈도 통계가 성립하지 않는다.
- 한국어, 일본어처럼 알파벳을 안 쓰는 언어는 아예 못 한다.
- 스페인어와 포르투갈어처럼 빈도가 비슷한 언어끼리는 어렵다.
- 한 글자씩만 세서 "th", "ing" 같은 조합 정보가 사라진다. 실무에서는 `CountVectorizer(analyzer='char', ngram_range=(1, 3))`처럼 글자 조합(n-gram) 빈도를 쓴다고 한다.
- `./model/freq.pkl` 같은 상대 경로는 서버를 실행한 폴더 기준이라, 다른 폴더에서 실행하면 파일을 못 찾는다. `os.path.dirname(os.path.abspath(__file__))`로 절대 경로를 만드는 게 안전하다.
- `.pkl` 파일은 로드할 때 임의의 코드가 실행될 수 있어서 출처를 모르는 파일은 로드하면 안 된다.
- `detect_lang()`이 노트북과 `main.py`에 두 벌 있어서, 한쪽만 고치면 학습과 예측의 전처리가 달라진다. 모듈로 빼서 같이 임포트하거나, 전처리까지 파이프라인으로 묶어 통째로 저장하는 게 낫다.

배포의 최소 골격은 노트북에서 학습 → `joblib.dump()`로 `.pkl` 저장 → FastAPI에서 서버 시작 시 `load()` → 예측 함수를 엔드포인트로 → HTML/JS 화면에서 fetch였다. 모델을 만드는 일과 모델을 쓰는 일이 완전히 분리된다. 학습은 노트북에서 오래 걸려도 되고, 서비스는 바로 답해야 한다.

## 헷갈리기 쉬운 부분
- 정확도만 보면 속는다. 내가 잡아야 할 클래스의 재현율을 클래스별로 읽는다. 불균형 데이터면 `macro avg`를 본다.
- 이미 0/1로 인코딩된 범주형 열에는 스케일링을 하지 않는다. 수치형만 스케일링해서 `pd.concat`으로 다시 붙이고, 이때 인덱스를 맞춘다.
- 스케일러는 나눈 다음 훈련 세트로만 `fit`한다.
- `classification_report`는 임계값 0.5 하나만 본 결과다. 모델 비교는 ROC를 겹쳐 그리고, 재현율이 낮으면 임계값을 낮추는 방법도 있다.
- 다중 분류에서 정밀도, 재현율, F1은 `average=None`이면 클래스별로 나온다.
- `SVC`에서 `predict_proba`를 쓰려면 `probability=True`로 학습해야 하고, 학습이 느려진다.
- 다중 분류 ROC는 OvR로 클래스마다 하나씩 그리고, 정답은 `label_binarize`로 펼친다.
- DataFrame으로 `fit`한 스케일러에는 같은 열 이름의 DataFrame을 넣어야 경고가 안 뜬다.
- 결정적인 규칙으로 만든 인공 데이터의 99%는 데이터가 쉬웠다는 뜻이다.
- 텍스트 빈도 특성은 반드시 비율로 정규화한다. 안 하면 문서 길이가 특성이 된다.
- 학습 때와 예측 때의 전처리는 똑같아야 한다.
- 모델은 서버 시작 시 한 번만 로드한다.

## 오늘 배운 내용 정리
오늘은 심부전증 데이터에 모델을 붙여 평가하고, SVM으로 다중 분류를 하면서 평가지표를 읽고, 텍스트 분류 모델을 웹 서비스로 띄웠다.

```
EDA → 모델링: 수치형만 스케일링 + 범주형 그대로 → 분리 → 학습 → 평가.
classification_report: 클래스별 precision / recall / f1 / support. 불균형이면 macro avg.
심부전증: 정확도 0.68인데 사망 재현율 0.35. 목적이 지표를 정한다.
ROC 비교: RocCurveDisplay.from_estimator(model, X_test, y_test, ax=ax)로 겹쳐 그린다.
SVM: 마진이 가장 넓은 경계선. 서포트 벡터만 경계를 정한다. rbf 커널로 곡선 경계. 스케일링 필수.
MinMaxScaler: 0~1로. 이상치가 없을 때.
다중 분류 지표: average=None이면 클래스별. ROC는 OvR + label_binarize + probability=True.
특성 설계: 텍스트 → 알파벳 26개 빈도 → 비율로 정규화.
배포: joblib.dump → FastAPI 최상단에서 load → POST 엔드포인트 → fetch.
```

정확도 68%인 모델이 사망 환자를 3명 중 1명만 찾는다는 게 가장 기억에 남았다. 지난주에 "정확도 99.5%인데 암 환자를 한 명도 못 찾는 모델" 이야기를 들었을 때는 극단적인 예시라고 생각했는데, 실제 데이터에 모델을 붙여보니 바로 그 모습이 나왔다. 그리고 문장이 숫자 26개가 되는 순간 SVM 기본값 하나로 언어를 맞히는 걸 보면서, 모델보다 특성을 어떻게 만드느냐가 더 중요할 때가 있다는 것도 알게 됐다.

---
