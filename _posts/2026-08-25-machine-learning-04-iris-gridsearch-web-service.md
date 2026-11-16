---
layout: single
title: "머신러닝 기초 정리 4 - 붓꽃 분류를 처음부터 끝까지, 모델과 스케일러를 웹 서비스로"
categories: [coding, MachineLearning]
tag: [study-log, MachineLearning, scikit-learn, iris, SVM, GridSearchCV, joblib, FastAPI, pydantic]
toc: true
author_profile: false
sidebar:
    nav: "docs"
search: true
---
<hr/>

오늘은 머신러닝 단원의 마지막 날이었다. 지난주에 따로따로 배운 데이터 분리, 표준화, 그리드 서치, 평가, 저장, 웹 서비스를 붓꽃 데이터로 처음부터 끝까지 직접 이어 붙였다.

지금까지의 노트북은 코드가 다 적혀 있고 실행하면서 따라가는 형태였는데, 오늘 노트북은 셀에 단계 제목과 변수 이름만 적혀 있었다.

```
② 데이터 읽어오기              CSV -> DataFrame (변수명 df)
④ train, test 세트 분리        - 8:2로 분류
                              - 클래스별로 균등하게 분류되게 하고
⑥ 최적의 하이퍼 파라미터 찾기   GridSearchCV 사용
⑩ 모델 & 스케일러 저장하기
```

현장에서 누가 코드를 주면서 표준화하라고 하지는 않을 테니 이게 실제 일하는 모습에 더 가까울 것 같다. "클래스별로 균등하게"라는 말을 보고 `stratify=target`을 떠올려야 하는 식이었다. 그리고 마지막 단계는 노트북 안에서 점수를 보고 끝나는 게 아니라, 모델을 노트북 밖으로 꺼내서 다른 프로그램이 쓰게 만드는 것이었다.

## 데이터와 분리

```python
df = pd.read_csv(os.path.join('.', 'iris.csv'))
df.shape          # (150, 5)
df.Name.unique()  # ['Iris-setosa', 'Iris-versicolor', 'Iris-virginica']
```

꽃받침(Sepal) 길이와 너비, 꽃잎(Petal) 길이와 너비 4개 특성으로 품종 3개를 맞힌다. iris는 1936년 통계학자 피셔가 쓴 데이터라 머신러닝의 Hello World 같은 존재라고 한다. `df.describe()`를 보면 꽃받침 길이는 4.3~7.9, 꽃잎 너비는 0.1~2.5로 특성마다 범위가 달라서 표준화가 필요하다.

```python
data = df[['SepalLength', 'SepalWidth', 'PetalLength', 'PetalWidth']]
target = df['Name']

X_train, X_test, y_train, y_test = train_test_split(
    data, target, test_size=0.2, stratify=target, random_state=42)
# ((120, 4), (30, 4), (120,), (30,))

y_train.value_counts()   # setosa 40, virginica 40, versicolor 40
y_test.value_counts()    # setosa 10, virginica 10, versicolor 10
```

iris.csv는 품종 순서대로 정렬돼 있다. `train_test_split`이 섞어주긴 하지만 비율까지 보장하지는 않아서, 운이 나쁘면 테스트 30개에 setosa가 15개, virginica가 5개 들어갈 수도 있다. `stratify=target`을 주면 원래 비율을 그대로 유지해서 나눠준다. 결과를 보니 훈련은 품종마다 40개, 테스트는 10개씩 정확히 나뉘었다. 첫날 생선 데이터를 안 섞고 잘랐다가 정확도 0.0이 나왔던 게 "섞지 않아서"였다면, `stratify`는 거기서 한 단계 더 나아가 "비율까지 맞춰서"다.

## 표준화

```python
scaler = StandardScaler()
scaler.fit(X_train)                        # 훈련 세트에만 fit
X_train_scaled = scaler.transform(X_train)
X_test_scaled = scaler.transform(X_test)   # 같은 자로 변환만
```

변환 결과를 찍어보니 평균이 `-1.37e-16`, 표준편차가 `1.0042`처럼 나왔다. 평균이 정확히 0이 아닌 건 컴퓨터가 소수를 2진수로 저장하면서 생기는 미세한 오차라 `0.1 + 0.2 != 0.3`과 같은 현상이다. 표준편차가 1.0042인 건 다른 이유인데, `StandardScaler`는 `n`으로 나누고 `describe()`는 `n-1`로 나누기 때문이다. 120개면 `sqrt(120/119)`가 약 1.0042다.

SVM은 점과 점 사이의 거리로 경계를 긋기 때문에 표준화가 필수다. 꽃받침 길이와 꽃잎 너비를 그대로 쓰면 숫자가 큰 특성이 거리를 독차지한다.

## GridSearchCV - 40개 조합

```python
param_grid = {
    'C':      [0.1, 1, 10, 100],
    'gamma':  [0.001, 0.1, 1, 10, 100],
    'kernel': ['linear', 'rbf'],
}
gs = GridSearchCV(svm.SVC(random_state=42), param_grid, n_jobs=-1, cv=5)
gs.fit(X_train_scaled, y_train)

print(gs.best_score_)    # 0.9833333333333332
print(gs.best_params_)   # {'C': 1, 'gamma': 0.1, 'kernel': 'rbf'}
```

4 × 5 × 2 = 40개 조합을 만들고 조합마다 5-폴드 교차 검증을 해서 총 200번 학습한다. `best_score_` 0.9833은 테스트 점수가 아니라 가장 좋았던 조합의 교차 검증 평균이다. SVM의 `C`는 로지스틱 회귀처럼 작을수록 규제가 강하고, `gamma`는 한 데이터 점이 주변에 미치는 영향 범위다. 작으면 넓고 부드럽게, 크면 좁고 뾰족하게 퍼진다.

### 결과 배열이 이상했다

```python
print(gs.cv_results_['mean_test_score'])
```

```
C=0.1 → [0.975  0.8667 | 0.975  0.875  | 0.975  0.925  | 0.975  0.7417 | 0.975  0.3583]
C=1   → [0.975  0.8667 | 0.975  0.9833 | 0.975  0.9583 | 0.975  0.875  | 0.975  0.4583]
C=10  → [0.9583 0.9    | 0.9583 0.9667 | 0.9583 0.95   | 0.9583 0.875  | 0.9583 0.475 ]
C=100 → [0.9667 0.975  | 0.9667 0.9667 | 0.9667 0.95   | 0.9667 0.875  | 0.9667 0.475 ]
          linear  rbf     linear  rbf      ...
        gamma=0.001     gamma=0.1        gamma=1      gamma=10      gamma=100
```

`linear` 자리를 보면 한 줄 안에서 다섯 번 모두 똑같다. C=0.1이면 0.975가 다섯 번, C=10이면 0.9583이 다섯 번이다. `gamma`는 `rbf` 커널에서만 쓰는 값이고 `linear` 커널은 그냥 무시하기 때문이다. 그러니까 linear 20칸 중 16칸은 똑같은 계산을 반복한 것이고, 200번 학습 중 80번이 낭비였다.

이 낭비는 `param_grid`를 딕셔너리 하나가 아니라 리스트로 주면 없앨 수 있다. scikit-learn은 리스트를 받으면 각 딕셔너리를 따로 펼친다.

```python
param_grid = [
    {'kernel': ['linear'], 'C': [0.1, 1, 10, 100]},                                    # 4칸
    {'kernel': ['rbf'],    'C': [0.1, 1, 10, 100], 'gamma': [0.001, 0.1, 1, 10, 100]},  # 20칸
]
```

40칸이 24칸으로 준다. 붓꽃은 150줄이라 몇 초면 끝나지만 데이터가 커지면 이 차이가 커진다. 그리드 서치는 돌리기만 하는 게 아니라 탐색 공간을 설계하는 일이라는 걸 알게 됐다.

그리고 `gamma=100`에서 0.3583이 나왔다. 3개 품종을 찍기만 해도 0.33이니 사실상 아무것도 못 맞힌 것이다. `gamma`가 커지면 각 훈련 샘플이 자기 바로 옆만 자기 편으로 만들어서, 훈련 데이터는 통째로 외우지만 처음 보는 점은 전부 모른다. 극단적인 과대적합이 교차 검증 점수에 그대로 드러났다.

## 평가 - 30개 중 하나 틀렸다

```python
clf = gs.best_estimator_      # SVC(C=1, gamma=0.1, random_state=42)
print(clf.score(X_train_scaled, y_train))   # 0.9833333333333333
print(clf.score(X_test_scaled, y_test))     # 0.9666666666666667
```

```
                 precision    recall  f1-score   support
    Iris-setosa       1.00      1.00      1.00        10
Iris-versicolor       1.00      0.90      0.95        10
 Iris-virginica       0.91      1.00      0.95        10
       accuracy                           0.97        30
```

리포트를 거꾸로 읽으면 어떤 실수를 했는지도 알 수 있다. setosa는 꽃잎만 봐도 완벽히 갈라지는 품종이라 전부 1.00이다. versicolor의 재현율 0.90은 실제 versicolor 10개 중 9개만 찾았다는 뜻이고, virginica의 정밀도 0.91은 virginica라고 답한 11개 중 10개만 맞았다는 뜻이다. 이 두 숫자는 같은 사건이다. versicolor 하나를 virginica로 착각한 것, 딱 그거 하나뿐이다.

테스트가 30개라 하나 틀리면 3.3%p가 움직인다. 0.9667과 1.0의 차이는 "모델이 3% 부족하다"가 아니라 "하나 틀렸다"일 뿐이다. 데이터가 적을 때 소수점 아래로 모델을 비교하면 안 되는 이유이고, 그래서 교차 검증이 필요하다. 참고로 `SVC`의 `random_state`는 `probability=True`일 때 확률 추정용으로 데이터를 섞을 때만 쓰여서 지금은 아무 일도 안 한다. 결과가 매번 같은 건 SVC 자체가 결정론적이기 때문이다.

## 저장 - 두 개를 저장한다

```python
joblib.dump(clf, './iris_model.pkl')
joblib.dump(scaler, './iris_scaler.pkl')
```

오늘의 핵심이었다. 모델만 저장하면 안 된다. 모델은 "cm 단위로 재서 판정하는 법"이 아니라 "표준화된 자로 재서 판정하는 법"을 배웠다. 그 자를 같이 넘겨주지 않으면 웹에서 5.4cm를 그대로 넣었을 때 모델은 그걸 "평균보다 표준편차 5.4개만큼 큰 값"으로 읽는다.

무서운 건 그래도 에러가 안 난다는 것이다. 숫자 4개를 넣었으니 형태는 맞고, 모델은 태연하게 아무 품종이나 답한다. 빨간 에러 메시지가 없으니 한참 뒤에나 발견되는 종류의 버그다. 어제 외국어 판별에서는 정규화를 판정 함수 안에서 직접 계산해서 스케일러를 저장할 필요가 없었는데, 오늘은 `StandardScaler`를 썼으니 같이 저장해야 했다.

`.pkl`이 두 개인 게 처음엔 이상했는데, 스케일러도 데이터에서 무언가를 배운 물건이라고 생각하면 이해가 된다. 스케일러가 배운 건 훈련 세트 4개 특성의 평균과 표준편차, 숫자 8개다. 모델이 배운 건 결정 경계다. 둘 중 하나라도 없으면 예측이 성립하지 않는다. 이게 첫날 배운 `Pipeline`이 있는 이유이기도 하다.

```python
from sklearn.pipeline import make_pipeline
pipe = make_pipeline(StandardScaler(), svm.SVC(C=1, gamma=0.1))
pipe.fit(X_train, y_train)
joblib.dump(pipe, 'iris_pipeline.pkl')   # 파일 하나로 끝
```

파이프라인으로 묶으면 저장 파일이 하나가 되고 스케일러를 빼먹는 사고가 원천적으로 사라진다. 오늘은 두 개로 나눠 저장해봤으니 왜 하나로 묶는지가 몸에 남았다.

`.pkl`은 파이썬 객체를 그대로 굳힌 것이라 파이썬에서만 읽히고, scikit-learn 버전이 다르면 깨질 수 있다. 그리고 불러오면서 코드를 실행할 수 있어서 남이 준 `.pkl`을 그냥 `load`하는 건 남이 준 `.py`를 실행하는 것과 같다. 언어를 가리지 않고 쓰려면 ONNX 같은 공용 형식으로 내보낸다고 한다.

## 웹 서비스 - 노트북 밖으로
웹 서비스는 세 조각으로 나눴다. 먼저 예측만 담당하는 `model/iris_model.py`다.

```python
clf = joblib.load(r'./model/iris_model.pkl')
scaler = joblib.load(r'./model/iris_scaler.pkl')

def predict_iris(sepal_length, sepal_width, petal_length, petal_width) -> str:
    iris = pd.DataFrame(
        [[sepal_length, sepal_width, petal_length, petal_width]],
        columns=['SepalLength', 'SepalWidth', 'PetalLength', 'PetalWidth'],
    )
    X_scaled = scaler.transform(iris)
    return clf.predict(X_scaled)[0]
```

`joblib.load`를 함수 밖 최상단에 둬서 이 파일을 처음 import할 때 한 번만 읽고, 이후 요청은 이미 메모리에 있는 객체를 쓴다. `columns=`를 굳이 붙인 건 `scaler.fit(X_train)`을 DataFrame으로 했기 때문이다. scikit-learn이 그때 열 이름을 `feature_names_in_`에 기억해둬서 이름이 다른 데이터를 넣으면 경고가 난다. 어느 쪽이든 순서는 학습 때와 같아야 하는데, 이름을 붙여두면 순서 실수까지 막아준다.

다음은 문을 열어주는 `main.py`다.

```python
class InputData(BaseModel):
    sepal_length: float
    petal_width: float
    sepal_width: float
    petal_length: float

@app.get("/")
def read_root(request: Request):
    return templates.TemplateResponse(request, "irisform.html")

@app.post("/predict_iris")
def class_iris(body: InputData):
    result = predict_iris(
        body.sepal_length, body.sepal_width, body.petal_length, body.petal_width)
    return {"result": result}
```

마지막으로 브라우저에서 값을 보내는 `static/irisform.js`다.

```javascript
fetch("/predict_iris", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(values)
})
.then(response => response.json())
.then(obj => { resultElem.textContent = obj.result; });
```

### 만들면서 걸렸던 것들
`InputData`의 필드 순서가 뒤섞여 있는데도 잘 동작했다. pydantic은 이름으로 맞추니까 순서는 상관없다. 그런데 바로 아래 `predict_iris()` 호출은 이름이 아니라 자리로 넘긴다. 여기서 두 번째와 세 번째를 바꿔 쓰면 아무 에러 없이 꽃받침 너비를 꽃잎 길이 자리에 넣고 예측한다. 클래스 정의 순서를 보고 따라 쓰면 그대로 틀린다. 같은 타입(float) 인자가 네 개 나란히 있는 함수는 `sepal_length=body.sepal_length`처럼 키워드 인자로 넘기는 게 안전하다.

JS에서 `input.value.trim()`으로 읽은 값은 문자열이라 서버가 받는 건 `{"sepal_length": "5.4", ...}`인데, `float`로 선언한 pydantic이 아무 불평 없이 받았다. pydantic v2는 기본 모드에서 숫자로 읽히는 문자열을 `float`로 자동 변환해준다. 편하지만 타입 선언이 잡아줄 거라 믿었던 실수를 안 잡아준다는 뜻이기도 하다. 처음부터 `parseFloat(input)`로 숫자를 보내는 게 맞고, 엄격하게 검사하려면 `Field(strict=True)`를 쓴다.

처음에는 fetch URL을 `http://127.0.0.1:8000/predict_iris`로 박아뒀는데, 브라우저에게 `localhost`와 `127.0.0.1`은 같은 컴퓨터를 가리키는데도 서로 다른 출처다. 주소창에 `127.0.0.1:8000`으로 열면 같은 출처라 동작하지만, `localhost:8000`으로 열면 다른 출처라 CORS에 막힌다. 포트를 바꿔서 띄워도 실패한다. 프런트엔드와 백엔드가 같은 서버에 있으면 `/predict_iris`처럼 상대 경로를 쓰면 된다. 지금 페이지를 준 서버로 알아서 보내니까 포트나 도메인이 바뀌어도 따라간다.

`./model/iris_model.pkl`의 `.`은 파일이 있는 폴더가 아니라 명령을 실행한 폴더라서, 프로젝트 폴더에서 `uvicorn main:app --reload`를 하면 되지만 상위 폴더에서 `uvicorn proj_iris.main:app`으로 띄우면 import하는 순간 `FileNotFoundError`가 난다. `Path(__file__).parent`로 파일 자신의 위치를 기준으로 잡으면 실행 위치와 무관해진다.

`TemplateResponse`는 예전에는 `TemplateResponse("irisform.html", {"request": request})`처럼 썼는데 이 방식은 deprecated라 최신 Starlette에서는 경고가 뜬다. 지금은 `request`를 첫 인자로 받고, 템플릿에 넘길 값이 있으면 세 번째에 딕셔너리로 준다.

이 프로젝트도 어제처럼 CSR과 SSR이 섞여 있다. 첫 화면은 Jinja2 템플릿으로 서버가 그려주고(SSR), 판정 결과만 fetch로 받아서 자바스크립트가 바꿔 넣는다(CSR). 6월에 했던 React + FastAPI 구조는 첫 화면부터 전부 CSR이었다.

## 헷갈리기 쉬운 부분
- "클래스별로 균등하게"는 `stratify=target`이다. 섞기만 하는 것과 비율까지 맞추는 건 다르다.
- 스케일러는 훈련 세트에만 `fit`한다.
- `best_score_`는 교차 검증 평균이지 테스트 점수가 아니다.
- `gamma`는 `rbf` 전용이라 `linear` 커널은 무시한다. 조합이 겹치면 `param_grid`를 리스트로 나눠준다.
- `gamma`가 너무 크면 훈련 데이터를 외워서 처음 보는 점을 못 맞힌다.
- 테스트가 30개면 하나 틀릴 때마다 3.3%p가 움직인다. 소수점 차이로 모델을 비교하지 않는다.
- 모델과 스케일러는 한 쌍이다. 스케일러를 빼먹으면 에러 없이 조용히 틀린다.
- 모델 로드는 모듈 최상단에서 한 번만 한다. 상대 경로는 실행 위치 기준이다.
- pydantic은 이름으로 맞추지만 함수 호출은 자리로 넘긴다. 같은 타입 인자가 많으면 키워드 인자를 쓴다.
- 같은 서버로 보내는 fetch는 상대 경로를 쓴다. `localhost`와 `127.0.0.1`은 다른 출처다.

## 오늘 배운 내용 정리
오늘은 붓꽃 품종 분류를 데이터 읽기부터 웹 서비스까지 혼자 이어 붙였다.

```
분리: train_test_split(..., test_size=0.2, stratify=target) → 품종마다 40 / 10.
표준화: scaler.fit(X_train) → 훈련·테스트 모두 transform.
튜닝: GridSearchCV(SVC, param_grid, cv=5). 40조합 × 5폴드 = 200번 학습.
      gamma는 rbf 전용 → 리스트로 나누면 24조합.
평가: 테스트 0.9667. versicolor 하나를 virginica로 착각 (recall 0.90 = precision 0.91의 같은 사건).
저장: iris_model.pkl + iris_scaler.pkl. 또는 Pipeline으로 하나.
서비스: iris_model.py(최상단에서 load, 예측 함수) → main.py(POST 엔드포인트) → irisform.js(fetch).
```

가장 기억에 남는 건 스케일러를 같이 저장하지 않으면 에러도 없이 틀린 답을 낸다는 것이었다. 노트북 안에서는 `scaler` 변수가 계속 살아 있어서 그런 걸 신경 쓸 일이 없었는데, 모델을 밖으로 꺼내보니 모델이 무엇을 배웠고 무엇과 함께 있어야 동작하는지를 정확히 알아야 했다. 그리고 그리드 서치 결과 배열에서 똑같은 숫자가 다섯 번 반복되는 걸 보고 낭비를 찾아낸 것처럼, 결과를 그냥 넘기지 않고 읽어보는 습관도 중요하다는 걸 느꼈다.

---
