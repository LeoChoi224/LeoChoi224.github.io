---
layout: single
title: "딥러닝 기초 정리 1 - 인공신경망, 심층 신경망, 손실 곡선과 콜백, CNN"
categories: [coding, DeepLearning]
tag: [study-log, DeepLearning, Keras, TensorFlow, Dense, ReLU, Adam, Dropout, EarlyStopping, CNN, FashionMNIST]
toc: true
author_profile: false
sidebar:
    nav: "docs"
search: true
---
<hr/>

딥러닝 수업이 시작됐다. 어제 붓꽃 프로젝트를 끝내고 마지막 시간에 인공신경망을 맛보기로 시작했고, 오늘은 그 신경망에 층을 쌓아 심층 신경망을 만들고, 손실 곡선을 보면서 언제 훈련을 멈출지 정하고, 마지막에 합성곱 신경망(CNN)으로 이미지를 분류했다.

"딥러닝"이라는 말 때문에 완전히 다른 세계로 넘어간 것처럼 느껴졌는데 실제로는 그렇지 않았다. 지난주에 `SGDClassifier(loss='log_loss')`로 손실 함수를 정하고, 가중치를 조금씩 고치면서, 여러 번 반복해서 학습하는 걸 이미 배웠다. 신경망도 정확히 같은 일을 한다. 달라진 건 그 구조를 "층(layer)"이라는 부품으로 조립한다는 것이고, 부품이 되니 층을 더 쌓을 수 있다는 것이었다.

## 인공신경망 - 로지스틱 회귀를 층으로 다시 그리기

### FashionMNIST

```python
(train_input, train_target), (test_input, test_target) = \
    keras.datasets.fashion_mnist.load_data()
print(train_input.shape, train_target.shape)   # (60000, 28, 28) (60000,)
print(test_input.shape, test_target.shape)     # (10000, 28, 28) (10000,)
```

28×28 흑백 옷 이미지 7만 장이고, 클래스는 티셔츠, 바지, 스웨터, 드레스, 코트, 샌달, 셔츠, 스니커즈, 가방, 앵클부츠 10개다. `np.unique(train_target, return_counts=True)`로 보면 클래스마다 정확히 6,000장씩이다. 일부러 균형 있게 만든 학습용 데이터셋이라 정확도만 봐도 충분하다. 그저께 심부전증 데이터에서 정확도가 거짓말을 했던 것과 정반대 상황인데, 실제 데이터는 거의 항상 심부전증 쪽에 가깝다고 한다.

```python
train_scaled = train_input / 255.0                   # 0~255 → 0~1
train_scaled = train_scaled.reshape(-1, 28 * 28)     # (60000, 28, 28) → (60000, 784)
```

지금까지는 항상 `StandardScaler`로 표준화했는데 여기서는 그냥 255로 나눈다. 표준화는 cm와 kg처럼 단위가 다른 특성을 같은 자로 맞추는 작업인데, 이미지의 784개 특성은 전부 "픽셀 밝기 0~255"라는 같은 단위라 맞출 게 없다. 게다가 가장자리 픽셀은 거의 항상 0이라 표준편차가 0에 가까워서, 표준화하면 의미 없는 미세한 차이가 크게 부풀려진다. 최솟값 0과 최댓값 255가 이미 정해져 있으니 데이터에서 배울 게 없고, 그래서 이미지 전처리에는 저장할 스케일러가 없다. 어제 붓꽃에서 스케일러를 따로 저장해야 했던 것과 대조된다.

`reshape(-1, 784)`는 밀집층이 1차원 숫자 목록만 받기 때문에 하는 것이다. 이 과정에서 위아래, 좌우 위치 정보가 사라진다. 신경망 입장에서 784개 픽셀은 그냥 순서 있는 숫자 목록일 뿐이다. 이 한계를 푸는 게 오후에 배운 CNN이었다.

```python
train_scaled, val_scaled, train_target, val_target = train_test_split(
    train_scaled, train_target, test_size=0.2, random_state=42)
# (48000, 784) / (12000, 784)
```

딥러닝에서는 교차 검증 대신 검증 세트를 하나 떼어 쓴다. 데이터가 이미 충분히 커서 검증 점수가 안정적이고, 교차 검증을 하기에는 훈련 시간이 너무 오래 걸리기 때문이다. 검증 세트가 12,000개면 나누는 방법에 따라 점수가 출렁일 일이 거의 없는데 5-폴드를 하면 시간이 5배가 된다.

이 셀에 "★한번만 실행하세요"라고 적혀 있었는데, 결과를 자기 자신(`train_scaled`)에 다시 담기 때문이다. 두 번 실행하면 48,000개가 다시 38,400 / 9,600으로 쪼개진다. 에러도 안 나고 데이터만 조용히 줄어든다. `X_train`, `X_val`처럼 이름을 다르게 쓰면 몇 번을 실행해도 안전하다.

### 밀집층 하나 = 로지스틱 회귀

```python
inputs = keras.Input(shape=(784,))
dense = keras.layers.Dense(units=10, activation='softmax')
model = keras.Sequential(layers=[inputs, dense])
```

**밀집층(Dense)**은 왼쪽에 784개 점, 오른쪽에 10개 점을 두고 모든 왼쪽 점을 모든 오른쪽 점에 선으로 연결한 것이다. 선이 빽빽해서 밀집층, 모두 연결돼 있어서 완전 연결층(Fully Connected Layer)이라고도 한다. 선 하나하나가 가중치 하나라서 가중치는 `(784 + 1) × 10 = 7850`개이고, `+1`은 절편(bias)이다. 이 7,850개 숫자를 찾는 게 학습의 전부다. `activation='softmax'`는 지난주 다중 분류 로지스틱 회귀에서 배운 소프트맥스 그대로다. 노트북에도 "사실 인공신경망은 확률적 경사 하강법을 사용하는 로지스틱 회귀와 같다"고 적혀 있었다.

`shape=(784,)`에 48,000이 없는 게 처음엔 이상했다. 케라스에서 `shape`는 항상 샘플 하나의 모양이고, 맨 앞의 배치 차원은 쓰지 않는다. 샘플이 몇 개 들어올지는 훈련할 때 정해지니까 모델을 만들 때는 알 필요가 없다. 그리고 수업은 케라스 3 기준이라 `keras.Input`을 첫 원소로 넣는데, 예전 케라스 2 예제는 `Dense(10, input_shape=(784,))`처럼 층에 붙여 썼다. 검색한 예제가 안 돌아가면 버전 차이를 먼저 의심하면 된다.

### compile, fit, evaluate

```python
model.compile(loss='sparse_categorical_crossentropy', metrics=['accuracy'])
model.fit(train_scaled, train_target, epochs=5)
model.evaluate(val_scaled, val_target)   # [0.4363766014575958, 0.8496666550636292]
```

scikit-learn의 `fit` / `score` 두 단계가 케라스에서는 만들기(Sequential) → 설정(compile) → 훈련(fit) → 평가(evaluate) 네 단계로 쪼개졌다. `compile()`은 시험 전에 채점 기준을 정하는 단계다. `loss`는 모델이 스스로를 고치는 데 쓰는 기준이라 필수이고, `metrics`는 사람이 보려고 찍는 숫자라 선택이다.

손실 함수는 타깃의 생김새를 보고 고른다. 이진 분류는 `binary_crossentropy`, 다중 분류인데 타깃이 원-핫이면 `categorical_crossentropy`, 정수면 `sparse_categorical_crossentropy`다. FashionMNIST 타깃은 `[7 3 5 8 6 ...]`처럼 정수라 `sparse_`를 붙였다. 원-핫은 정답 7을 `[0,0,0,0,0,0,0,1,0,0]`처럼 자리 하나만 1로 표시한 것인데, `sparse_`는 "그렇게 안 바꿔도 내가 알아서 할 테니 그냥 7로 달라"는 뜻이다. 0으로 가득 찬 희소한 배열을 6만 개 만드느니 정수 하나로 두는 게 낫다는 현실적인 이유다. `optimizer`는 안 줬는데 기본값 `'rmsprop'`이 쓰인다.

```
Epoch 1/5   1500/1500 ━━━━━ 3s 1ms/step - accuracy: 0.7929 - loss: 0.6082
...
Epoch 5/5   1500/1500 ━━━━━ 2s 1ms/step - accuracy: 0.8551 - loss: 0.4286
```

`1500`이라는 숫자는 훈련 데이터 48,000개를 배치 크기 32로 나눈 값이다. 케라스는 데이터를 통째로 넣지 않고 32개씩 잘라서 넣는다(`batch_size` 기본값 32).

| 용어 | 뜻 | 이번 경우 |
|---|---|---|
| 배치(batch) | 한 번에 넣는 샘플 묶음 | 32개 |
| 스텝(step) | 배치 하나로 순전파 → 역전파 → 가중치 갱신 1회 | 에포크당 1,500번 |
| 에포크(epoch) | 훈련 데이터 전체를 한 바퀴 | 5바퀴 |

가중치는 1,500 × 5 = 7,500번 갱신됐다. `SGDClassifier`는 진짜 샘플 하나씩 봤는데, 케라스는 기본이 미니배치다. `evaluate()`는 점수 하나가 아니라 `[손실, metrics에 적은 것]` 리스트를 준다.

훈련 0.8551, 검증 0.8497로 거의 차이가 없었다. 과대적합이 아니라는 뜻이지만 좋은 소식만은 아니다. 훈련 점수조차 0.85에서 멈췄다는 건 모델이 데이터를 외우지도 못할 만큼 단순하다는 뜻이다. 밀집층 하나는 결국 `가중치 × 입력 + 절편`이라는 선형 계산이라, 셔츠와 티셔츠처럼 비슷하게 생긴 옷을 직선 하나로 못 가른다.

## 심층 신경망 - 층을 쌓고 ReLU를 끼우기
해법은 입력층과 출력층 사이에 층을 하나 더 끼우는 것이다. 그 사이의 층을 **은닉층(hidden layer)**이라고 한다.

```python
model = keras.Sequential([
    keras.layers.Input(shape=(784,)),
    keras.layers.Dense(100, activation='sigmoid', name='hidden'),
    keras.layers.Dense(10, activation='softmax', name='output')
], name='Fashion MNIST DNN')
model.summary()
```

```
┃ Layer (type)      ┃ Output Shape  ┃  Param # ┃
│ hidden (Dense)    │ (None, 100)   │   78,500 │
│ output (Dense)    │ (None, 10)    │    1,010 │
 Total params: 79,510
```

은닉층 뉴런 개수는 경험과 실험으로 정해야 하는데, 출력층보다는 많아야 한다. 은닉층은 정보가 지나가는 통로라 출력이 10개인데 5개로 좁히면 병목에서 정보가 버려진다. 활성화 함수는 출력층은 정해져 있고(이진 분류 sigmoid, 다중 분류 softmax, 회귀는 없음) 은닉층은 선택지가 넓다. 회귀에 활성화 함수를 안 쓰는 이유는 출력이 임의의 숫자라 0~1로 눌러버리면 안 되기 때문이다.

`summary()`의 Output Shape `(None, 100)`에서 `None`은 배치 차원이다. Param #은 그 층이 학습할 숫자 개수인데, 손으로 계산할 수 있어야 한다.

```
hidden: (입력 784 + bias 1) × 100 = 78,500
output: (입력 100 + bias 1) ×  10 =  1,010
                                 합계 79,510
```

절편이 층마다 하나가 아니라 뉴런마다 하나라는 게 헷갈렸다. 뉴런 하나가 자기만의 가중치 784개와 절편 1개를 가지고, 그런 뉴런이 100개 있다. 모델은 리스트로 한 번에 만들 수도 있고 `model.add()`로 하나씩 쌓을 수도 있는데, 결과는 같다. `add()`는 조건에 따라 층을 넣었다 뺐다 할 수 있어서 실무에서 흔하다고 한다. 층 하나를 더 넣었더니 5 에포크 정확도가 0.8556에서 0.8770으로 오르고, 에포크당 시간은 두 배가 됐다. 계산량을 지불하고 성능을 산 것이다.

### 활성화 함수가 없으면 층을 쌓아도 직선
은닉층에 왜 활성화 함수가 반드시 필요한지가 중요했다. 활성화 함수가 없으면 두 층은 `w₂ × (w₁ × x + b₁) + b₂`이고, 정리하면 `(w₂w₁) × x + (w₂b₁ + b₂)`로 결국 또 하나의 직선이다. 층을 100개 쌓아도 직선 하나와 똑같다. 사이에 "굽은 것"이 있어야 층을 쌓는 의미가 생긴다.

### 기울기 소실과 ReLU
시그모이드는 입력이 크거나 작으면 곡선이 누워버려서, 입력이 변해도 출력이 거의 안 변한다. 그 구간에서는 역전파로 돌아오는 신호가 계속 작아지고, 층이 깊어지면 앞쪽 층까지 신호가 도달하지 못한다. 이게 **기울기 소실(vanishing gradient)**이다. ReLU는 `max(0, x)`, 음수면 0이고 양수면 그대로라 양수 구간의 기울기가 항상 1이다. 신호가 줄지 않고 전달된다. 단순해 보여도 0에서 꺾이는 그 한 번이 비선형성을 만든다.

순전파는 입력층 → 은닉층 → 출력층으로 "예측해보는 것"이고, 역전파는 출력층 → 은닉층 → 입력층으로 "틀린 만큼 가중치를 되짚어 고치는 것"이다. `fit()` 안에서 매 스텝마다 이 둘이 한 번씩 일어난다.

### Flatten - 펴는 일을 층에 맡기기

```python
model = keras.Sequential()
model.add(keras.layers.Input(shape=(28, 28)))
model.add(keras.layers.Flatten())                        # (28, 28) → (784,)
model.add(keras.layers.Dense(100, activation='relu'))
model.add(keras.layers.Dense(10, activation='softmax'))
```

아까는 `reshape`로 손으로 폈는데, `Flatten` 층이 그 일을 대신한다. `Flatten`은 파라미터가 0개라 배우는 게 없고 모양만 바꾼다. 그래서 이 모델을 "깊이 3"이라고 부르지 않는다. 층은 파라미터가 있는 것만 세서 깊이 2다. 전처리를 모델 안에 넣었으니 나중에 서비스에 붙일 때 입력을 펴는 걸 깜빡하는 사고도 없어진다. ReLU로 바꾸니 훈련 0.8847, 검증 0.8661로 시그모이드보다 좋아졌다.

수업 중에 `Flatten`을 처음 소개하는 셀에서 출력층이 `Dense(100, activation='softmax')`로 돼 있었는데, 에러 없이 훈련이 됐다. `sparse_categorical_crossentropy`는 정답을 "몇 번째 출력이 정답인지"의 인덱스로 받아서, 레이블이 0~9인데 출력이 100개면 10~99번 출력이 그냥 정답이 될 일 없는 뉴런일 뿐 계산은 성립한다. `summary()` 마지막 줄이 `(None, 클래스 개수)`인지 매번 눈으로 확인하는 습관이 이런 실수를 잡아준다.

### 옵티마이저
학습 전에 사람이 정해야 하는 하이퍼파라미터가 신경망에서는 엄청 많아졌다. 은닉층 개수, 뉴런 개수, 활성화 함수, 층의 종류, 배치 크기, 에포크, 옵티마이저와 학습률. 조합이 너무 많고 한 번 훈련이 오래 걸려서 지난주의 `GridSearchCV`가 통하지 않는다.

옵티마이저는 계보로 정리하면 기억하기 쉬웠다.

```
기본 경사 하강법     [SGD] ──momentum>0──→ [모멘텀] ──nesterov=True──→ [네스테로프 모멘텀]
                                              │
적응적 학습률     [Adagrad]                    ↓
                  [RMSprop] ────────────────→ [Adam]
```

| 이름 | 아이디어 |
|---|---|
| SGD | 기울기 방향으로 `learning_rate`만큼 간다 (기본 0.01) |
| 모멘텀 | 이전에 가던 방향의 관성을 더한다. 보통 0.9 이상 |
| 네스테로프 | 관성으로 한 발 먼저 가본 뒤 기울기를 잰다 |
| Adagrad, RMSprop | 최적점에 가까워질수록 보폭을 줄인다 |
| Adam | 모멘텀 + RMSprop. 기본 학습률 0.001 |

SGD가 안개 낀 산을 한 걸음씩 더듬어 내려가는 거라면, 모멘텀은 굴러가던 속도를 살리는 것, 적응적 학습률은 바닥이 가까워지면 보폭을 줄이는 것, Adam은 둘을 동시에 하는 것이다. `optimizer='sgd'`처럼 문자열로 주면 기본값으로 객체를 만들고, 학습률 같은 옵션을 바꾸려면 `keras.optimizers.SGD(learning_rate=0.1)`처럼 객체를 직접 만든다. 학습률이 너무 크면 골짜기를 넘어가버려 손실이 진동하고, 너무 작으면 제자리걸음이다. 애매하면 Adam을 쓰면 된다. 케라스의 기본값은 역사적인 이유로 RMSprop이라 실무에서는 `optimizer='adam'`을 명시한다고 한다.

```python
set_seed(42)
model = keras.Sequential()
model.add(keras.layers.Input(shape=(28, 28)))
model.add(keras.layers.Flatten())
model.add(keras.layers.Dense(100, activation='relu'))
model.add(keras.layers.Dense(10, activation='softmax'))
model.compile(optimizer='adam', loss='sparse_categorical_crossentropy', metrics=['accuracy'])
model.fit(train_scaled, train_target, epochs=5)
model.evaluate(val_scaled, val_target)   # accuracy: 0.8715
```

`set_seed()`는 `tf.keras.utils.set_random_seed(seed)`와 `tf.config.experimental.enable_op_determinism()`으로 랜덤을 고정하는 함수다. 신경망은 가중치를 랜덤하게 시작하고 데이터도 섞어서 넣어서 같은 코드도 결과가 매번 다르다. 옵티마이저를 비교하려면 시드 고정이 필수다. 안 그러면 Adam이 좋아서 오른 건지 초기값 운이 좋았던 건지 구분할 수 없다. 대신 GPU에서는 결정론 설정을 켜면 명백히 느려진다.

| 모델 | 훈련 정확도 | 검증 정확도 |
|---|---|---|
| 층 1개 | 0.8551 | 0.8497 |
| + 은닉층, sigmoid | 0.8770 | - |
| + ReLU, Flatten | 0.8847 | 0.8661 |
| + Adam | 0.8900 | 0.8715 |

## 손실 곡선과 드롭아웃 - 언제까지 훈련해야 하나
지금까지 `epochs=5`로 훈련했는데 왜 하필 5일까. 늘리면 더 좋아질까. 훈련 손실만 보면 계속 예쁘게 내려가지만, 모델이 훈련 데이터를 외우기 시작해도 훈련 손실은 내려간다. 강사님 PPT의 비유가 재미있었다. 신경망에게 고양이를 열심히 가르쳤더니 "뚱뚱하니까 고양이 아님, 갈색이니까 고양이 아님, 귀가 쳐졌으니까 고양이 아님"이 됐다. 융통성이 하나도 없어진 것, 그게 과대적합이다. 이걸 알아채려면 본 적 없는 데이터로 채점해야 한다.

### History 객체

```python
history = model.fit(train_scaled, train_target, epochs=20, verbose=0,
                    validation_data=(val_scaled, val_target))
history.history.keys()
# dict_keys(['accuracy', 'loss', 'val_accuracy', 'val_loss'])

plt.plot(history.history['loss'])
plt.plot(history.history['val_loss'])
plt.legend(['train', 'val'])
```

지금까지 버리던 `fit()`의 반환값에 에포크별 지표가 딕셔너리로 쌓여 있었다. `validation_data=`로 검증 세트를 튜플로 주면 `val_`이 붙은 키가 생긴다. `verbose=0`이면 아무것도 안 찍고, 2면 진행 막대 없이 지표만 찍는다. 검증 세트는 가중치를 고치는 데 전혀 쓰이지 않고 매 에포크 끝에 채점만 한다.

| 지표 | 1 에포크 | 20 에포크 | 방향 |
|---|---|---|---|
| loss (훈련) | 0.5311 | 0.2132 | 계속 내려감 |
| val_loss (검증) | 0.4327 | 0.5025 | 내려가다 올라감 |
| accuracy | 0.8112 | 0.9293 | 계속 오름 |
| val_accuracy | 0.8457 | 0.8692 | 거의 제자리 |

훈련 손실은 반으로 줄었는데 검증 손실은 오히려 늘었다. 두 곡선이 벌어지기 시작하는 지점이 "여기서 멈췄어야 하는 곳"이다. 손실 곡선의 모양은 네 가지로 정리됐다. 둘 다 감소 후 안정이면 정상, 훈련은 계속 감소하는데 검증이 어느 순간 증가하면 과대적합, 둘 다 높은 채로 안 내려가면 과소적합, 진동하거나 튀면 학습률이 크거나 전처리 문제다.

1 에포크에서 검증 손실이 훈련 손실보다 낮은 게 이상했는데, 훈련 손실은 에포크 도중 1,500개 배치의 평균이고 검증 손실은 에포크가 끝난 뒤 한 번에 채점한 값이기 때문이다. 앞쪽 배치에서는 모델이 아직 서툴러서 평균이 손해를 본다.

### 최적화 대상은 정확도가 아니라 손실
노트북에 "신경망 모델에서 최적화 대상은 정확도가 아니라 손실 함수다"라고 적혀 있었다. 위 표에서 `val_accuracy`는 올랐는데 `val_loss`도 같이 올랐다. 정확도는 맞았나 틀렸나만 세지만, 손실은 얼마나 확신했는지까지 본다. 정답 클래스 확률이 0.95로 맞힌 모델과 0.35로 겨우 맞힌 모델은 정확도가 둘 다 1이지만 손실은 `-log(0.95) = 0.05`와 `-log(0.35) = 1.05`로 20배 차이다. 점점 아슬아슬하게 맞히면 정확도는 그대로인데 손실이 오른다. 그래서 조기 종료의 기준도 `val_loss`다.

옵티마이저를 Adam으로 바꾸니 20 에포크 검증 손실이 0.5025에서 0.3903으로 크게 좋아졌다. Adam은 최적점 근처에서 보폭을 줄여서 훈련 데이터에만 맞는 뾰족한 골짜기보다 완만한 골짜기에 머무는 경향이 있다고 한다. 명시적인 규제항을 넣은 건 아니지만 규제와 비슷한 효과가 난다.

### 드롭아웃

```python
def model_fn(a_layer=None):
    set_seed(42)
    model = keras.Sequential()
    model.add(keras.layers.Input(shape=(28, 28)))
    model.add(keras.layers.Flatten())
    model.add(keras.layers.Dense(100, activation='relu'))
    if a_layer:
        model.add(a_layer)          # 여기에 층을 끼워 넣을 수 있다
    model.add(keras.layers.Dense(10, activation='softmax'))
    return model

model = model_fn(keras.layers.Dropout(rate=0.3))
```

**드롭아웃**은 훈련 과정에서 층에 있는 뉴런 일부를 랜덤하게 꺼서(출력을 0으로 만들어서) 과대적합을 억제한다. 축구팀에서 매 훈련마다 선수 3명을 무작위로 빼고 연습시키면, 특정 에이스 한 명에게 몰빵하는 전술을 못 짜고 팀 전체가 골고루 는다. 매번 조금씩 다른 신경망을 훈련하는 셈이라 지난주 랜덤 포레스트처럼 앙상블과 비슷하게 동작한다.

드롭아웃은 파라미터가 0개이고, 입력과 출력의 크기가 같고, 훈련할 때만 동작하고 평가나 예측할 때는 동작하지 않는다. 훈련 때 30%를 끄고 예측 때 100%를 쓰면 출력이 갑자기 커질 것 같은데, 케라스가 훈련 중 살아남은 뉴런의 출력을 `1/(1-rate)`배 키워둬서 평균적인 크기가 같아진다. `rate`는 끄는 비율이고, 0.2~0.3이 무난한 시작점이다.

| 지표 | Adam만 | Adam + Dropout 0.3 |
|---|---|---|
| 20 에포크 훈련 loss | 0.1745 | 0.2761 (일부러 나빠짐) |
| 20 에포크 val_loss | 0.3903 | 0.3300 (좋아짐) |
| 20 에포크 val_accuracy | 0.8813 | 0.8853 |

훈련 손실이 오히려 나빠졌는데 검증 손실은 좋아졌다. 훈련 성적을 일부러 포기하고 실전 성적을 얻는 것, 지난주에 규제에서 배운 그 거래다. `model_fn()` 안에서 매번 `set_seed(42)`를 하고 새 모델을 만들어 반환하는 것도 중요했다. 바꾸는 것 하나만 빼고 전부 같아야 드롭아웃 효과인지 운인지 구분할 수 있다.

## 모델 저장과 콜백
그런데 여기서 문제가 생긴다. 20 에포크를 돌려서 손실 곡선을 보고, 10번째쯤이 제일 좋았으니 `epochs=10`으로 다시 훈련한다면 모델을 두 번 학습하는 셈이다. FashionMNIST는 2분이면 끝나지만 실제 모델은 몇 시간에서 며칠이 걸린다. 훈련하면서 동시에 최적점을 잡아두면 되고, 그게 콜백이다. 그 전에 모델을 파일로 저장하는 법부터 배웠다.

### 저장 방법 두 가지

```python
model.save_weights('model.weights.h5')   # 가중치만
model.save('model-whole.keras')          # 통째로
```

| 구분 | `save_weights()` | `save()` |
|---|---|---|
| 저장하는 것 | 가중치 숫자만 | 구조 + 가중치 + 옵티마이저 상태 |
| 확장자 | `.weights.h5` | `.keras` |
| 복원할 때 | 같은 구조를 먼저 만들어야 한다 | 파일 하나로 끝 |
| 복원 후 `evaluate()` | `compile()`이 필요하다 | 바로 된다 |

`save_weights`는 답안지만 저장한 것이고 `save`는 시험지 양식까지 통째로 저장한 것이다. 케라스 3부터는 확장자 규칙이 엄격해져서 `.weights.h5`와 `.keras` 두 개만 기억하면 된다.

```python
new_model = model_fn(keras.layers.Dropout(0.3))    # 같은 구조를 먼저 만든다
new_model.load_weights('model.weights.h5')
new_model.evaluate(val_scaled, val_target)
# ValueError: You must call `compile()` before using the model.

val_labels = np.argmax(new_model.predict(val_scaled), axis=-1)
print(np.mean(val_labels == val_target))   # 0.8835833333333334
```

가중치만 불러오면 "무엇으로 채점할지"를 모르니 `evaluate()`가 터진다. 정확도만 필요하면 `predict()`로 직접 계산하면 된다. 케라스의 `predict()`는 scikit-learn과 달리 클래스가 아니라 샘플마다 10개 클래스의 확률을 돌려준다. `np.argmax(..., axis=-1)`로 가장 큰 값의 인덱스를 고르고, 정답과 같은지 비교한 True/False의 평균이 정확도다. `axis=-1`은 마지막 축이라 차원 수가 바뀌어도 항상 클래스 축을 가리킨다.

```python
new_model = keras.models.load_model('model-whole.keras')
new_model.evaluate(val_scaled, val_target)   # [0.3285, 0.8836]  compile 없이 바로 된다
```

### ModelCheckpoint와 EarlyStopping
콜백은 훈련 중간에 어떤 작업을 할 수 있게 하는 객체이고, `fit(callbacks=[...])`에 리스트로 넘긴다. 매 에포크가 끝날 때마다 코치가 상황을 보고 저장하거나 멈추는 것이다.

```python
checkpoint_cb = keras.callbacks.ModelCheckpoint('best-model.keras', save_best_only=True)
early_stopping_cb = keras.callbacks.EarlyStopping(patience=2, restore_best_weights=True)

history = model.fit(train_scaled, train_target, epochs=20,
                    validation_data=(val_scaled, val_target),
                    callbacks=[checkpoint_cb, early_stopping_cb])
```

`ModelCheckpoint`에 `save_best_only=True`를 주면 검증 점수가 최고를 갱신했을 때만 저장한다. 그런데 이것만 쓰면 여전히 20번을 다 돈다. `EarlyStopping`은 `patience=2`면 검증 점수가 안 좋아져도 2번은 참아보고 멈추고, `restore_best_weights=True`면 가장 좋았던 가중치로 되돌린다.

```
Epoch  8/20  val_loss: 0.3303
Epoch  9/20  val_loss: 0.3319   ← 나빠짐 (1번째 인내)
Epoch 10/20  val_loss: 0.3202   ← 최저, 카운터 초기화
Epoch 11/20  val_loss: 0.3250   ← 나빠짐 (1번째 인내)
Epoch 12/20  val_loss: 0.3212   ← 여전히 0.3202보다 나쁨 (2번째 인내) → 중지
```

`early_stopping_cb.stopped_epoch`은 11인데 0부터 센 번호라 12번째 에포크에서 멈춘 것이다. 20번 예약했는데 12번만 돌아서 8번을 아꼈다. 멈춘 뒤 `evaluate()`를 해보니 `val_loss`가 0.3202로, 12번째의 0.3212가 아니라 10번째 최저점과 정확히 같았다. 되돌리기가 잘 된 증거다. 노트북 주석에 "최상의 모델은 9번째 epoch"라고 적혀 있는 것도 0부터 센 번호라 로그로는 `Epoch 10/20`이다. 두 숫자 체계가 섞여 있어서, 최종 `evaluate()` 값이 어느 에포크의 `val_loss`와 같은지 찾아보는 게 확실하다.

`patience=0`이면 한 번만 나빠져도 멈추는데 손실 곡선은 원래 조금씩 요동친다. 실제 로그도 9번째에 한 번 나빠졌다가 10번째에 최저를 찍었으니 0이었으면 최저점을 놓쳤을 것이다. 그리고 두 콜백의 기준(`monitor`) 기본값은 `val_loss`라서 `validation_data`를 안 주면 훈련 손실을 보게 되는데, 훈련 손실은 계속 내려가서 조기 종료가 영원히 안 걸린다. 콜백과 검증 데이터는 항상 세트다.

이제 `epochs=20`은 "20번 돌린다"가 아니라 "최대 20번까지 허용한다"는 뜻이 됐다. 안심하고 크게 주고 조기 종료에 맡기면 된다. 조기 종료도 모델이 훈련 데이터를 외울 시간을 아예 안 주는 규제 방법이다. 릿지와 라쏘는 가중치 크기로, 드롭아웃은 뉴런 의존도로, 조기 종료는 훈련 시간으로 과대적합을 억제한다.

## 합성곱 신경망(CNN)
DNN은 검증 0.8715에서 멈췄다. 이미지를 `reshape(-1, 784)`로 펴는 순간 "이 픽셀이 저 픽셀 바로 위에 있다"는 정보가 사라지기 때문이다. 좌표를 무작위로 섞어도 같은 성능이 나온다. 그런데 이미지의 의미는 이웃한 픽셀들에 있다. 옆으로 이어진 밝은 점들의 줄이 모서리이고, 모서리가 모여 소매가 된다. 합성곱은 이웃한 픽셀을 묶어서 본다.

### 필터를 옮겨 가며 재사용하기
밀집층의 뉴런은 입력 10개 전부에 가중치를 곱해서 출력 1개를 만든다. 합성곱은 가중치 3개짜리 필터를 한 칸씩 옮기면서 `x1 x2 x3`, `x2 x3 x4`, ... 로 출력 8개를 만든다. 결정적인 점은 8번의 계산에 같은 가중치 3개를 계속 쓴다는 것이다. 도장 하나를 들고 종이 위를 옮겨 다니며 계속 찍는 것과 같다. 이걸 가중치 공유라고 하는데, 파라미터가 확 줄고, 화면 왼쪽 위의 모서리든 오른쪽 아래의 모서리든 같은 도장으로 잡힌다. 고양이가 사진 왼쪽에 있든 오른쪽에 있든 고양이로 알아보는 이유다.

CNN에서는 뉴런이 이동하면서 출력을 만들어서 뉴런을 필터(filter) 또는 커널(kernel)이라고 부른다. 뉴런 = 필터 = 커널이라고 봐도 되고, 굳이 나누면 개수를 말할 때는 필터, 가중치를 말할 때는 커널이라고 한다. 그래서 `Conv2D(filters=32, kernel_size=3)`은 "3×3짜리 도장을 32개 쓴다"로 읽힌다.

### 특성 맵, 패딩, 스트라이드
입력이 2차원이면 필터도 2차원이고, 출력도 필터가 있던 위치에 맞춰 2차원으로 배치돼서 "어디였는지"가 남는다. 이 출력을 **특성 맵(feature map)**이라고 한다. 정확히는 활성화 함수까지 적용한 후의 결과다. 패딩 없이 한 칸씩 옮기면 `출력 = 입력 - 커널 + 1`이라 (4,4)에 (3,3) 필터면 (2,2), (5,5)면 (3,3)이 된다. 필터를 3개 쓰면 특성 맵이 차곡차곡 쌓여 (2,2,3)이 된다. 가로줄 찾는 도장, 세로줄 찾는 도장, 곡선 찾는 도장처럼 필터마다 다른 특징을 잡는다.

입력과 출력의 크기를 같게 하려면 입력 주위를 0으로 둘러싸서 더 큰 입력인 척하면 된다. 이게 **패딩**이다. `padding='same'`은 입력과 출력 크기를 같게, `'valid'`(기본값)는 패딩 없이 순수 입력만 쓴다. 패딩이 없으면 모서리 픽셀은 필터에 딱 한 번만 걸리고 가운데 픽셀은 아홉 번쯤 걸려서 가장자리 정보가 무시된다. 그리고 크기가 안 줄어야 층을 여러 개 쌓을 수 있다. `valid`로만 쌓으면 28 → 26 → 24로 금방 바닥난다. 그래서 일반적인 CNN에서는 `same`을 많이 쓴다.

**스트라이드**는 필터를 몇 칸씩 옮길지다. 두 칸씩 옮기면 특성 맵이 작아지는데, 크기를 줄이는 일은 풀링에 맡기는 게 관례라 거의 항상 기본값 1을 쓴다. 강사님이 강조하신 건 입력 크기, 패딩, 스트라이드, 커널 크기가 주어졌을 때 출력 크기를 예측할 수 있어야 한다는 것이었다.

### 풀링
**풀링**은 특성 맵의 가로세로 크기를 줄여서 중요한 것만 추출한다. 그런데 특성 맵의 개수는 줄이지 않는다. (2,2,3)을 (2,2) 풀링하면 (1,1,3)이 된다. 최댓값을 고르는 `MaxPooling2D`와 평균을 내는 `AveragePooling2D`가 있는데 대부분 최대 풀링을 쓴다. 특성 맵의 값은 "여기에 그 특징이 얼마나 강하게 있나"인데, 2×2 구역에 강한 신호 하나와 0 세 개가 있으면 최대는 "있다"고 말하고 평균은 "1/4쯤 있다"고 말해서 신호를 희석한다. 풀링도 가중치가 없고, 보통 `pool_size=2`로 가로세로를 절반으로 만든다. 최댓값이 구역 안 어디에 있든 결과가 같아서 픽셀 한두 칸의 위치 변화도 무시하게 해준다.

### 채널
컬러 이미지는 RGB 채널이 있어서 (4,4,3)처럼 3차원이고, 입력에 채널이 있으면 필터도 (3,3,3)처럼 채널을 가진다. 필터의 깊이는 항상 입력의 채널 수와 같다.

```
입력 (10, 10, 3)  필터 (3, 3, 3) × 5개   → (8, 8, 5)
입력 ( 8,  8, 5)  필터 (3, 3, 5) × 10개  → (6, 6, 10)
```

두 번째 줄이 이해의 분수령이었다. 첫 합성곱이 채널을 5개로 만들었으니 다음 필터의 깊이는 5여야 하고, 그 필터를 10개 쓰면 출력 채널이 10이 된다. 출력 채널 수는 내가 정하는 필터 개수이고, 필터 깊이는 입력 채널 수로 자동으로 정해진다. 흑백 이미지도 (28, 28)을 (28, 28, 1)로 바꿔서 채널 차원을 만들어줘야 한다. 컬러 이미지도 `Conv2D`인데, 이름의 2D는 공간 차원 수라서 채널은 세지 않는다.

### FashionMNIST를 CNN으로

```python
train_scaled = train_input.reshape(-1, 28, 28, 1) / 255.0   # 채널 차원 추가
test_scaled = test_input.reshape(-1, 28, 28, 1) / 255.0
train_scaled, val_scaled, train_target, val_target = train_test_split(
    train_scaled, train_target, test_size=0.2, random_state=42)
```

DNN과 딱 한 글자 차이다. CNN 입력은 항상 `(batch, height, width, channel)` 4차원이다.

```python
set_seed(42)
model = keras.Sequential()
# 특징 추출
model.add(keras.layers.Input(shape=(28, 28, 1)))
model.add(keras.layers.Conv2D(filters=32, kernel_size=3, activation='relu', padding='same'))
model.add(keras.layers.MaxPooling2D(pool_size=2))
model.add(keras.layers.Conv2D(64, 3, activation='relu', padding='same'))
model.add(keras.layers.MaxPooling2D(2))
# 분류
model.add(keras.layers.Flatten())
model.add(keras.layers.Dense(100, activation='relu'))
model.add(keras.layers.Dropout(0.4))
model.add(keras.layers.Dense(10, activation='softmax'))
```

CNN은 합성곱과 풀링으로 이미지에서 특징을 뽑는 앞부분과, 그 특징으로 분류하는 뒷부분으로 나뉜다. 뒷부분은 오전에 만든 DNN 그대로다. `Conv2D`의 `activation` 기본값은 `None`이라 이미지 분류에서는 `'relu'`를 명시한다. `summary()`를 손으로 따라가봤다.

| 층 | 출력 크기 | 파라미터 | 계산 |
|---|---|---|---|
| Conv2D(32, 3, same) | 28×28×32 | 320 | (3×3×1 + 1) × 32 |
| MaxPooling2D(2) | 14×14×32 | 0 | |
| Conv2D(64, 3, same) | 14×14×64 | 18,496 | (3×3×32 + 1) × 64 |
| MaxPooling2D(2) | 7×7×64 | 0 | |
| Flatten | 3136 | 0 | 7×7×64 |
| Dense(100) | 100 | 313,700 | (3136 + 1) × 100 |
| Dropout(0.4) | 100 | 0 | |
| Dense(10) | 10 | 1,010 | (100 + 1) × 10 |

두 번째 합성곱의 `3×3×32`가 핵심이다. 첫 층이 채널을 32개로 만들었으니 다음 필터의 깊이가 32다. 가로세로는 28 → 14 → 7로 줄고 채널은 1 → 32 → 64로 늘어난다. 처음에는 직선, 곡선 같은 기본 특징을 찾고 층이 깊어질수록 더 다양하고 구체적인 특징을 찾도록 필터를 늘리는 게 관례다. "어디에 있나"를 버리고 "무엇이 있나"를 얻어가는 셈이다. 그리고 파라미터 333,526개 중 94%가 `Dense(100)` 하나에 몰려 있다. 합성곱은 파라미터가 놀랍도록 적다. 밀집층으로 784개를 32개 출력으로 보내면 25,120개가 필요한데 `Conv2D(32, 3)`은 320개로 훨씬 풍부한 출력(28×28×32)을 만든다. `keras.utils.plot_model(model, show_shapes=True)`로 그리면 층마다 입출력 크기가 화살표에 적혀 나와서 검산하기 좋다.

```python
model.compile(optimizer='adam', loss='sparse_categorical_crossentropy', metrics=['accuracy'])
checkpoint_cb = keras.callbacks.ModelCheckpoint('best-cnn-model.keras', save_best_only=True)
early_stopping_cb = keras.callbacks.EarlyStopping(patience=2, restore_best_weights=True)
history = model.fit(train_scaled, train_target, epochs=20,
                    validation_data=(val_scaled, val_target),
                    callbacks=[checkpoint_cb, early_stopping_cb])
```

모델 구조가 완전히 달라졌는데 `compile`, `fit`, 콜백 코드는 글자 하나 안 바뀌었다. 모델의 종류나 구성 방식에 상관없이 컴파일과 훈련 과정이 같다는 게 케라스의 장점이다.

```
Epoch 7/20  accuracy: 0.9242 - loss: 0.2038 - val_accuracy: 0.9191 - val_loss: 0.2255  ← 최저
Epoch 8/20  accuracy: 0.9306 - loss: 0.1845 - val_accuracy: 0.9199 - val_loss: 0.2315
Epoch 9/20  accuracy: 0.9349 - loss: 0.1725 - val_accuracy: 0.9177 - val_loss: 0.2325
```

7번째에서 최저를 찍고 9번째에 멈췄다. 8번째를 보면 `val_accuracy`는 0.9199로 올랐는데 `val_loss`는 0.2315로 올랐다. 오전에 배운 "정확도와 손실은 언제나 반비례가 아니다"가 실제로 일어났고, 조기 종료가 손실을 기준으로 7번째를 골랐다.

```python
model.evaluate(val_scaled, val_target)     # [0.2255, 0.9191]
model.evaluate(test_scaled, test_target)   # [0.2488, 0.9160]
```

드디어 테스트 세트를 썼다. DNN의 0.8715에서 0.9191로 올라서, 틀리는 비율이 13%에서 8%로 줄었다. 검증과 테스트의 차이가 0.003이라 믿을 만한 모델이다.

### 예측과 진짜 사진

```python
preds = model.predict(val_scaled[0:1])   # [0]이 아니라 [0:1]
classes = ['T-shirt/top', 'Trouser', 'Pullover', 'Dress', 'Coat',
           'Sandal', 'Shirt', 'Sneaker', 'Bag', 'Ankle boot']
print(classes[np.argmax(preds)])         # Bag
```

`fit()`, `predict()`, `evaluate()`는 모두 첫 번째 차원이 배치여야 해서 한 장도 `(1, 28, 28, 1)`이어야 한다. `val_scaled[0]`은 차원을 하나 없애서 `(28, 28, 1)`이고, `val_scaled[0:1]`은 차원을 유지한다. 클래스 이름을 영어로 둔 건 Colab에 한글 폰트가 없어서 그래프 제목이 깨지기 때문이다.

마지막으로 Colab은 세션이 끝나면 파일이 사라져서 구글 드라이브에 모델을 저장하고, 인터넷에서 받은 옷 사진 5장을 넣어봤다.

```python
def predict(file_path):
    img = Image.open(file_path)
    mono8img = img.convert('L')                              # 흑백으로
    invImg = ops.invert(mono8img)                            # 반전
    resizeImg = invImg.resize((28, 28))                      # 28×28로
    data_arr = np.array(resizeImg).reshape(1, 28, 28, 1)     # 4차원으로
    data_scaled = data_arr / 255.                            # 0~1로
    preds = model.predict(data_scaled)
    return classes[np.argmax(preds)]
```

다섯 단계가 전부 필요하고, 특히 반전을 빠뜨리면 안 된다. 인터넷 사진은 흰 배경에 어두운 옷인데 FashionMNIST는 검은 배경(0)에 밝은 옷(255)이라 정반대다. 반전을 안 하면 모델이 배운 적 없는 그림을 넣는 셈이다. 머신러닝 첫날부터 나온 "훈련할 때 한 전처리를 예측할 때도 똑같이"가 여기서도 그대로였다. 정규화 후 최댓값이 0.83(원본 최댓값 211)이었는데 정상이다. `/255`는 이미지마다 최댓값을 1로 맞추는 게 아니라 0~255를 0~1로 옮기는 것이고, 훈련 때와 같은 규칙으로 나누는 게 중요하다.

5장 중 셔츠 사진은 티셔츠로 틀렸다. 셔츠와 티셔츠는 FashionMNIST에서 가장 어려운 짝이라, 28×28 흑백으로 줄이면 소매 길이와 옷깃 정도만 남는다. 전체 정확도 0.92만 보면 어디서 틀리는지를 놓친다. 그리고 500×500 컬러 사진을 28×28 흑백으로 줄이면 정보의 99.7%가 버려지고, 배경이나 비율, 각도도 학습 데이터와 다르다. "검증 0.92인데 내 사진은 왜 틀리지?"의 답은 대개 모델이 아니라 입력 쪽에 있다.

## 헷갈리기 쉬운 부분
- 밀집층 하나짜리 신경망은 로지스틱 회귀와 같다. 층을 쌓을 수 있다는 게 차이다.
- 케라스의 `shape=`에는 배치 차원을 쓰지 않는다. `summary()`의 `None`이 배치 차원이다.
- 타깃이 정수면 `sparse_categorical_crossentropy`, 원-핫이면 `categorical_crossentropy`다.
- `1500/1500`은 48,000 ÷ 배치 크기 32다.
- 파라미터 수는 `(입력 + 1) × 뉴런 수`, 합성곱은 `(커널 높이 × 너비 × 입력 채널 + 1) × 필터 수`다.
- 층은 파라미터가 있는 것만 센다. `Input`, `Flatten`, `Dropout`, 풀링은 안 센다.
- 활성화 함수가 없으면 층을 쌓아도 직선 하나다. 은닉층은 ReLU, 다중 분류 출력층은 softmax.
- 케라스의 기본 옵티마이저는 RMSprop이다. Adam을 쓰려면 명시한다.
- 최적화 대상은 정확도가 아니라 손실이다. 조기 종료의 기준도 `val_loss`다.
- 드롭아웃은 훈련 때만 동작하고 파라미터가 없다. 훈련 손실이 나빠지고 검증 손실이 좋아지는 게 정상이다.
- `save_weights()`로 복원하면 같은 구조를 먼저 만들고 `evaluate()` 전에 `compile()`이 필요하다.
- `EarlyStopping`은 `restore_best_weights=True`를 켜야 최저점으로 되돌아간다. 콜백은 `validation_data`와 세트다.
- CNN 입력은 `(batch, height, width, channel)`이다. 흑백도 채널 1을 붙이고, 한 장 예측도 `[0:1]`로 배치 차원을 남긴다.
- 풀링은 가로세로만 줄이고 채널 수는 그대로다.
- 진짜 사진을 넣을 때는 흑백 → 반전 → 28×28 → /255를 훈련 데이터와 똑같이 맞춘다.

## 오늘 배운 내용 정리
오늘은 인공신경망에서 시작해 심층 신경망, 손실 곡선과 드롭아웃, 모델 저장과 콜백, CNN까지 배웠다.

```
인공신경망: Dense(10, softmax) 하나 = 로지스틱 회귀. 가중치 (784+1)×10 = 7850개.
케라스 4단계: Sequential → compile(loss, metrics) → fit(epochs) → evaluate.
배치/스텝/에포크: 32개씩, 에포크당 1500스텝.
심층 신경망: 은닉층 + 비선형 활성화 함수. 시그모이드 → ReLU (기울기 소실 해결). Flatten.
옵티마이저: SGD → 모멘텀 → 네스테로프 / Adagrad, RMSprop → Adam. 애매하면 Adam.
손실 곡선: history.history의 loss와 val_loss를 겹쳐 그린다. 벌어지는 지점에서 멈춘다.
드롭아웃: 훈련 때만 뉴런을 랜덤하게 끈다. 파라미터 0개.
저장: save_weights(가중치만) / save(.keras, 통째로) → load_model.
콜백: ModelCheckpoint(save_best_only) + EarlyStopping(patience, restore_best_weights).
CNN: 필터를 옮기며 재사용. same 패딩으로 크기 유지, 최대 풀링으로 절반.
     Conv → Pool → Conv → Pool → Flatten → Dense → Dropout → Dense. 테스트 0.9160.
```

딥러닝이라고 해서 완전히 새로운 걸 배운다고 생각했는데, 첫 모델이 지난주에 배운 로지스틱 회귀를 다시 그린 것이라는 게 가장 기억에 남았다. 손실 함수, 경사 하강법, 에포크, 규제, 조기 종료가 전부 이름만 조금 바뀌어서 다시 나왔다. 그리고 CNN의 파라미터가 생각보다 적다는 것, 같은 필터 하나를 이미지 전체에 옮겨 찍는 가중치 공유 덕분에 적은 숫자로 더 많은 걸 본다는 것도 신기했다.

---
