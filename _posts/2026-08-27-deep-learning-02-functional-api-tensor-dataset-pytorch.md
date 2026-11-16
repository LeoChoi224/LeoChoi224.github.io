---
layout: single
title: "딥러닝 기초 정리 2 - Functional API, 텐서 다루기, tf.data, 파이토치 텐서, 이미지 업로드 서비스"
categories: [coding, DeepLearning]
tag: [study-log, DeepLearning, Keras, FunctionalAPI, tf.Tensor, tf.data, PyTorch, FastAPI, UploadFile]
toc: true
author_profile: false
sidebar:
    nav: "docs"
search: true
---
<hr/>

어제 CNN까지 만들고 나니 오늘은 그 밑바닥을 들여다보는 날이었다. `Sequential`로는 못 만드는 모델을 Functional API로 만들어보고, 텐서의 차원을 늘리고 줄이는 도구를 배우고, CNN 층을 모델 없이 하나씩 통과시켜보고, 데이터를 흘려보내는 `tf.data.Dataset`을 배웠다. 오후에는 파이토치를 처음 열었고, 마지막에 어제 만든 CNN 모델을 FastAPI에 얹어서 사진을 올리면 옷 종류를 맞혀주는 웹 서비스를 만들었다.

## 케라스로 모델 만드는 세 가지 방법
어제까지 만든 모델은 전부 `Sequential`에 `add()`로 위에서 아래로 한 줄로만 쌓았다. 이름 그대로 차례대로다. 그런데 실제 모델 중에는 입력이 여러 개이거나(제목 + 본문 + 태그), 출력이 여러 개이거나(우선순위와 담당 부서를 동시에 예측), 길이 갈라졌다 합쳐지는 구조가 있다. 한 줄로만 쌓이는 `add()`로는 이런 걸 표현할 수 없다.

### Sequential에서 shape에 None 넣기

```python
model = keras.Sequential([
    keras.Input(shape=(None, None, 3)),
    keras.layers.Conv2D(filters=32, kernel_size=3),
])
# conv2d (Conv2D)  (None, None, None, 32)  896
```

높이와 너비 자리에 `None`을 넣었다. 합성곱은 필터가 훑고 지나가는 방식이라 이미지가 28×28이든 500×500이든 상관없어서, "채널이 3개인 컬러 이미지"라는 것만 알려주면 된다. 파라미터는 `(3 × 3 × 3 + 1) × 32 = 896`이다. 어제 `(28, 28, 1)`처럼 크기를 정확히 줬던 건 `Flatten` 뒤의 `Dense`가 입력 개수를 알아야 가중치 개수를 정할 수 있기 때문이다.

### Functional API - 층을 함수처럼 부른다

```python
inputs = keras.Input(shape=(37,))
x = keras.layers.Dense(32, activation='relu')(inputs)
outputs = keras.layers.Dense(5, activation='softmax')(x)
model = keras.Model(inputs=inputs, outputs=outputs)
```

`Dense(32, activation='relu')(inputs)`처럼 괄호가 두 번 열리는 게 처음엔 낯설었다. 층 객체를 만들고(`layer = Dense(32)`), 그 층에 입력을 넣는(`x = layer(inputs)`) 두 단계를 한 줄로 붙인 것이다. 파이썬에서는 클래스에 `__call__`이 정의돼 있으면 객체를 함수처럼 부를 수 있고, 케라스의 모든 층이 그렇게 만들어져 있다. `inputs → x → outputs`로 이어지는 변수 이름이 데이터가 흐르는 길이고, 이름을 여러 개 두면 길을 갈라놓을 수 있다. `keras.Model()`에는 시작과 끝만 알려주면 케라스가 `outputs`에서 거꾸로 따라가며 전체 그래프를 복원한다.

```python
title_input = keras.Input(shape=(None,), name="title")
body_input = keras.Input(shape=(None,), name="body")
tags_input = keras.Input(shape=(num_tags,), name="tags")
...
x = keras.layers.concatenate([title_features, body_features, tags_input])
priority_pred = keras.layers.Dense(1, name="priority")(x)
department_pred = keras.layers.Dense(num_departments, name="department")(x)

model = keras.Model(
    inputs=[title_input, body_input, tags_input],
    outputs={"priority": priority_pred, "department": department_pred},
)
```

문의 글 하나에서 얼마나 급한지와 어느 부서 일인지를 동시에 예측하는 예제였다. 입력 세 개를 `concatenate`로 옆으로 이어 붙이고 출력 두 개로 갈라진다. 이런 구조에서는 `summary()`에 `Connected to` 칸이 생겨서 어느 층이 어느 층에서 왔는지 보여준다. 중간의 `Embedding`과 `LSTM`은 아직 안 배운 층이라 구조만 봤다.

같은 입력을 `Conv2D` 세 갈래로 처리하고 다시 `concatenate`로 합치는 CNN도 만들어봤다. (13, 13, 128) 세 개가 합쳐지면 (13, 13, 384)가 된다. 합칠 때는 채널만 더해지고 높이와 너비는 같아야 한다. 이 예제에서는 `concat` 뒤에 `Flatten` 없이 바로 `Dense`를 붙였는데, 그러면 출력이 (None, 13, 13, 128)처럼 4차원 그대로 나온다. `Dense`는 마지막 축에만 작용하기 때문이다. 13×13 위치마다 같은 `Dense`가 재사용되고, 파라미터도 마지막 축 기준으로 `(384 + 1) × 128`이다. 진짜 분류 모델이 되려면 `Flatten`을 먼저 넣어야 한다.

### Subclassing

```python
class MyModel(keras.Model):
    def __init__(self, num_classes=10):
        super(MyModel, self).__init__(name='my_model')
        self.dense_1 = keras.layers.Dense(32, activation='relu')
        self.dense_2 = keras.layers.Dense(num_classes, activation='sigmoid')

    def call(self, inputs):
        x = self.dense_1(inputs)
        return self.dense_2(x)

model = MyModel()
model.summary()   # dense_6 (Dense)  ?  0 (unbuilt)
```

`keras.Model`을 상속해서 `__init__`에서 층을 만들고 `call()`에서 연결한다. 그런데 `summary()`를 찍으니 Output Shape이 `?`이고 파라미터가 0개로 나왔다. 고장이 아니다. `Dense(32)`는 출력이 32개라는 것만 알고 입력 개수를 모르니 가중치를 만들 수가 없다. 데이터가 한 번 지나가야 크기가 정해진다. `outputs = model(keras.layers.Input(shape=(32,)))`처럼 입력을 한 번 통과시키거나 `model.build(input_shape=(None, 32))`를 부르면 된다. 그리고 `call()`은 정의만 하고 직접 부르지 않는다. `model(inputs)`로 부르면 케라스가 `__call__` 안에서 층을 만들고 훈련/추론 모드를 설정한 다음 `call()`을 부른다.

| 방식 | 장점 | 단점 |
|---|---|---|
| Sequential | 층을 쌓기만 하면 돼서 쉽다 | 다중 입출력, 합치기 연산이 있는 모델에 부적합 |
| Functional | 갈라지고 합쳐지는 복잡한 모델 가능 | `Input` 층을 앞에 정의해야 한다 |
| Subclassing | Functional로도 안 되는 모델까지 가능 | 객체 지향에 익숙해야 하고 가장 까다롭다 |

Functional API는 모델을 DAG(방향이 있고 순환하지 않는 그래프)로 취급해서 만드는 시점에 그래프를 다 그려놓는다. 그래서 입력에 따라 층을 몇 번 반복할지가 달라지는 모델은 표현할 수 없고, 그럴 때 `call()`이 그냥 파이썬 함수인 Subclassing을 쓴다. 일자로 쌓이면 Sequential, 갈라지거나 합쳐지면 Functional, 루프나 조건 분기가 필요하면 Subclassing이다. 참고로 `activation=tf.nn.relu`와 `activation='relu'`는 같은 것이다.

## tf.Tensor 다루기
어제 `reshape(-1, 28, 28, 1)`로 차원을 맞추고 `val_scaled[0:1]`처럼 슬라이싱으로 차원을 유지했는데, 둘 다 아슬아슬한 방법이었다. 오늘은 모델이 아니라 모델에 넣을 데이터를 만드는 도구를 배웠다.

```python
tf.constant([1, 2, 3])                    # shape=(3,), dtype=int32
tf.constant(np.arange(1, 5))              # shape=(4,), dtype=int64  ← 넘파이 타입을 물려받는다
tf.constant([11, 22, 33], dtype=tf.float32)
```

`tf.constant()`는 dtype을 알아서 정해주는데 그게 함정이 된다. 넘파이 배열을 넣으면 `int64`나 `float64`가 되기 쉽고, 타입이 다르면 에러가 나고 디버깅도 어려워진다. 그래서 처음부터 dtype을 정의하고 가는 게 좋다. 딥러닝의 표준은 `float32`다. `float64`는 메모리를 두 배로 쓰고 GPU가 `float32`에 최적화돼 있다. 타입은 `tf.cast(tensor, dtype=tf.uint8)`로 바꾸고, 원본은 그대로 두고 새 텐서를 돌려준다. 넘파이로 꺼낼 때는 `tensor.numpy()`나 `np.array(tensor)`를 쓴다. 넘파이와 달리 `.size`가 없고 원소 개수는 `tf.size(tensor)`로 구한다.

### ...(ellipsis)

```python
tensor = tf.reshape(tf.range(24), (2, 3, 4))
tensor[0, ...]      # tensor[0, :, :]와 같다
tensor[..., 0]      # tensor[:, :, 0]과 같다
```

`...`는 "나머지 차원 전부"라는 뜻이다. `:`를 몇 개 써야 할지 세지 않아도 돼서 차원이 3개든 6개든 `tensor[..., 0]`은 그대로 마지막 축의 0번을 뽑는다. 어제 `np.argmax(..., axis=-1)`의 `-1`과 같은 발상이다.

### 차원 늘리고 줄이고 뒤집기

```python
x = tf.constant([1, 2, 3, 4])          # (4,)
tf.expand_dims(x, axis=0)              # (1, 4)
tf.expand_dims(x, axis=-1)             # (4, 1)
x[tf.newaxis, ..., tf.newaxis]         # (1, 4, 1)  앞뒤에 동시에

image = train_x[0]                          # (28, 28)
image = image[tf.newaxis, ..., tf.newaxis]  # (1, 28, 28, 1)
```

마지막 줄이 오늘의 핵심 표현이었다. 숫자를 하나도 안 적어서 이미지가 28이든 500이든 그대로 동작한다. `reshape`는 결과가 어떤 모양이어야 하는지를 적는 것이고, `expand_dims`와 `newaxis`는 어디에 차원을 하나 끼울지를 적는 것이다. 의도를 코드에 남기는 쪽이 나중에 안 깨진다. `tf.newaxis`, `np.newaxis`는 둘 다 그냥 `None`이라 넘파이 배열에 `tf.newaxis`를 써도 된다.

`tf.squeeze()`는 크기가 1인 차원을 전부 없앤다. 예측 결과 (1, 10)을 (10,)으로 만들 때 쓰는데, 축을 지정하지 않으면 배치 크기가 1일 때 배치 차원까지 사라질 수 있다. `tf.transpose(x, perm=[1, 0, 2])`는 축 순서를 바꾸는데, `perm`은 "새 0번 자리에 원래 1번을 가져와라"는 뜻이라 (2, 3, 4)가 (3, 2, 4)가 된다. 텐서플로는 `(batch, height, width, channel)`, 파이토치는 `(batch, channel, height, width)`라서 두 프레임워크 사이에서 이미지를 옮길 때 꼭 필요하다.

### KerasTensor는 값이 없다

```python
keras.layers.Input(shape=(32,))
# <KerasTensor shape=(None, 32), dtype=float32, ...>
```

`tf.Tensor`와 달리 `numpy=array(...)` 부분이 아예 없다. `KerasTensor`는 "여기에 32개짜리 숫자가 들어올 예정"이라는 설계도이고, `tf.Tensor`는 실제 숫자가 담긴 실물이다. Functional API에서 쓴 `inputs`, `x`, `outputs`가 전부 `KerasTensor`였다. 그래서 모델을 짜다가 중간값을 보려고 `x.numpy()`를 하면 터진다. 중간값이 보고 싶으면 그 지점까지의 모델을 `keras.Model(inputs=inputs, outputs=x)`로 따로 만들어 실제 데이터를 넣어야 한다.

## CNN 층을 모델 없이 직접 통과시키기
어제는 `summary()` 표로만 shape을 확인했는데, 합성곱을 지난 이미지가 어떻게 생겼는지, ReLU가 정말 음수를 0으로 만드는지는 표 뒤에 숨어 있었다. 오늘은 모델도 컴파일도 없이 층 하나에 이미지를 직접 넣어봤다.

```python
image = train_x[0]                            # (28, 28), uint8
image = image[tf.newaxis, ..., tf.newaxis]    # (1, 28, 28, 1)
image = tf.cast(image, dtype=tf.float32)      # int 타입으로 넣으면 에러

conv_layer = tf.keras.layers.Conv2D(5, 3, 1, padding='VALID')   # filters, kernel_size, strides
conv_layer                       # <Conv2D name=conv2d, built=False>
conv_output = conv_layer(image)  # 이 순간 만들어진다
conv_output.shape                # (1, 26, 26, 5)
```

층 안의 가중치가 `float32`라 `uint8` 입력과 곱하려면 타입을 맞춰야 한다. 텐서플로는 타입이 다른 텐서끼리 자동 변환을 안 해준다. 처음에 `built=False`인 건 Subclassing에서 본 `unbuilt`와 같은 상태다. `padding='SAME'`이면 (1, 28, 28, 5), `'VALID'`면 `28 - 3 + 1 = 26`으로 어제 배운 공식 그대로 나왔다. 대소문자는 가리지 않는다.

`plt.imshow(conv_output[0, ..., 0], 'gray')`로 그려보면 원본과 다른 모양이 나오는데, 실행할 때마다 결과가 달랐다. 훈련을 안 해서 필터 가중치가 랜덤이기 때문이다. `imshow`는 2차원만 받아서 배치 0번과 채널 0번을 골라내야 한다.

```python
np.min(image), np.max(image)              # (0.0, 255.0)
np.min(conv_output), np.max(conv_output)  # (-252.07, 194.67)

weights = conv_layer.get_weights()
print(weights[0].shape, weights[1].shape)   # (3, 3, 1, 5) (5,)
```

원본은 0~255인데 합성곱 후에 음수가 나왔다. 필터 가중치에 음수가 섞여 있어서 `픽셀 × 가중치` 9개를 더하면 음수가 될 수 있다. `get_weights()`로 꺼낸 가중치의 모양은 (커널 높이, 커널 너비, 입력 채널, 필터 개수)이고, 어제 배운 "필터 깊이 = 입력 채널 수"가 세 번째 자리에 그대로 있다. `3×3×1×5 + 5 = 50`으로 손 계산 `(3×3×1+1)×5`와 같다. 절편은 처음에 전부 0으로 시작한다.

```python
act_output = tf.keras.layers.ReLU()(conv_output)      # (1, 26, 26, 5), 0 ~ 194.67
pool_output = tf.keras.layers.MaxPool2D(2)(act_output) # (1, 13, 13, 5)
flat_output = tf.keras.layers.Flatten()(pool_output)   # (1, 845)
```

```
image      (1, 28, 28, 1)   0 ~ 255
 → Conv2D  (1, 26, 26, 5)   -252 ~ 194   크기 줄고 채널 늘고, 음수 생김
 → ReLU    (1, 26, 26, 5)      0 ~ 194   크기 그대로, 음수만 0으로
 → MaxPool (1, 13, 13, 5)      0 ~ 194   절반, 채널 그대로
 → Flatten (1, 845)                       13 × 13 × 5
```

ReLU는 최댓값은 그대로 두고 음수만 0으로 바꾸고 모양은 안 건드린다. `Conv2D(activation='relu')`와 `Conv2D()` 뒤에 `ReLU()`를 따로 두는 건 결과가 같은데, 오늘처럼 중간 결과를 꺼내보고 싶으면 나눠 쓰는 게 낫다. 층을 혼자 쓸 수 있다는 건 디버깅에도 유용하다. `fit()`에서 shape 에러가 나면 어느 층이 문제인지 찾기 어려운데, 층을 하나씩 통과시키면 어디서 어긋났는지 바로 보인다. 여기서는 관찰이 목적이라 `/255`를 안 했지만, 실제로 훈련할 때는 반드시 정규화해야 한다.

## tf.data.Dataset - 데이터를 흘려보내기
FashionMNIST는 6만 장이 180MB 정도라 메모리에 다 올라가지만, 500×500 컬러 사진 10만 장이면 75GB라 애초에 안 들어간다. `tf.data.Dataset`은 필요한 배치만 그때그때 꺼내주는 컨베이어 벨트다.

```python
from tensorflow.data import Dataset

ds = Dataset.from_tensor_slices([[1, 2], [3, 4]])
ds                                 # <_TensorSliceDataset element_spec=TensorSpec(shape=(2,), ...)>
list(ds.as_numpy_iterator())       # [array([1, 2]), array([3, 4])]

ds = Dataset.from_tensor_slices((features, labels))
# [(array([1, 3]), b'A'), (array([2, 1]), b'B'), ...]
```

`from_tensor_slices`는 이름 그대로 텐서를 첫 번째 축을 따라 조각낸다. Dataset은 그냥 출력하면 "안에 이런 모양이 들어 있다"는 명세만 보여주고, 값을 보려면 `as_numpy_iterator()`로 꺼내야 한다. `(입력, 정답)` 튜플로 주면 짝이 유지된 채로 잘린다. 따로 만든 두 Dataset은 `Dataset.zip()`으로 합칠 수 있다.

Dataset은 게으르다. `map`을 붙여도 아무것도 실행되지 않고 설계도만 쌓아뒀다가 꺼낼 때 계산한다. 6만 장짜리에 `list()`를 쓰면 메모리에 다 올라가서 Dataset을 쓰는 이유가 사라지니, `ds.take(3)`처럼 잘라서 봐야 한다.

```python
Dataset.range(10).skip(4).take(3)                 # [4, 5, 6]
Dataset.range(8).batch(3)                         # [0,1,2] [3,4,5] [6,7]
Dataset.range(8).batch(3, drop_remainder=True)    # [0,1,2] [3,4,5]
Dataset.range(7).window(3, shift=1, drop_remainder=True)
# [0,1,2] [1,2,3] [2,3,4] [3,4,5] [4,5,6]
Dataset.range(1, 6).map(lambda x: x + 10)         # [11, 12, 13, 14, 15]
```

메서드를 점으로 이어 붙이는 게 Dataset의 문법이다. `window()`는 시계열 데이터에서 "지난 30일로 내일 예측" 같은 창을 만들 때 쓰는데, 결과가 Dataset의 Dataset이라 `flat_map`으로 한 겹 벗겨야 한다. `shuffle(buffer_size)`는 카드를 전부 섞는 게 아니라 손에 몇 장 들고 그 안에서 섞는 방식이라, 데이터가 정렬돼 있으면 버퍼를 크게 잡아야 한다. `reshuffle_each_iteration`의 기본값은 `True`라 한 바퀴 돌 때마다 다시 섞는다.

### 실전 파이프라인

```python
def preprocess(image, label):
    image = tf.cast(image, tf.float32) / 255.0
    image = tf.expand_dims(image, axis=-1)      # (28, 28) → (28, 28, 1)
    return image, label

train_ds = Dataset.from_tensor_slices((train_images, train_labels))
train_ds = train_ds.map(preprocess, num_parallel_calls=tf.data.AUTOTUNE)
train_ds = train_ds.shuffle(buffer_size=num_samples, seed=42)
val_ds = train_ds.take(val_size).batch(64).prefetch(tf.data.AUTOTUNE)
train_ds = train_ds.skip(val_size).batch(64).prefetch(tf.data.AUTOTUNE)

model.fit(train_ds, epochs=5, validation_data=val_ds)
```

어제의 `/255`와 `reshape`가 `map(preprocess)`로, `train_test_split`이 `shuffle → take / skip`으로, `fit(batch_size=32)`가 `batch(64)`로 바뀌었다. `AUTOTUNE`은 텐서플로가 CPU와 메모리 상황을 보고 병렬 처리 수를 알아서 정하게 하는 상수다. `prefetch`가 새로 생긴 건데, GPU가 학습하는 동안 CPU가 다음 배치를 미리 준비해둬서 GPU가 데이터를 기다리며 놀지 않게 한다. 관례상 파이프라인 맨 끝에 붙인다.

`fit()`에는 입력과 타깃을 따로 안 주고 `batch_size`도 안 준다. 이미 Dataset 안에 짝지어져 있고 배치도 정해져 있으니까. 스텝 수는 48,000 ÷ 64 = 750이었다. 배치 크기가 크면 스텝이 줄고 한 에포크가 빨라지지만 가중치 갱신 횟수가 줄고 메모리를 많이 쓴다. GPU 메모리가 허락하는 선에서 32~256 사이를 많이 쓴다고 한다.

그런데 이 파이프라인에는 문제가 있었다. `shuffle`의 `reshuffle_each_iteration`이 기본값 `True`라서, 그 뒤에 `take`와 `skip`으로 나누면 `val_ds`와 `train_ds`가 같은 셔플을 각자 다시 실행한다. 1 에포크에서 검증에 쓰인 샘플이 2 에포크에서는 훈련에 들어가 있을 수 있다. 실제로 결과도 검증 정확도 0.9210이 테스트 정확도 0.9044보다 1.7%p 높게 나왔다. 나누기 전 셔플은 `reshuffle_each_iteration=False`로 고정하고, 나눈 뒤 훈련 쪽에만 다시 `shuffle`을 걸어야 한다. 나누는 일은 딱 한 번이어야 한다.

소규모 실험이나 빠른 프로토타이핑에는 `train_test_split`, 대규모 데이터와 실제 학습 환경 최적화에는 `tf.data.Dataset`을 쓴다. Dataset은 `train_scaled[0]`처럼 아무 샘플이나 바로 꺼내볼 수 없어서 디버깅이 조금 불편하다. 그리고 진짜 값어치는 `image_dataset_from_directory()`처럼 메모리에 없는 데이터를 디스크에서 그때그때 읽어올 때 나온다. 폴더 구조(`cat/`, `dog/`)가 그대로 레이블이 된다.

## 파이토치 텐서 기초
오후에는 파이토치를 처음 열었다. 요즘 주요 학회 논문의 80% 이상이 파이토치로 구현되고, Hugging Face 같은 최신 라이브러리도 파이토치를 우선 지원해서, 최신 모델을 가져다 쓰려면 파이토치를 읽을 줄 알아야 한다. 다행히 개념은 지금까지 배운 것 그대로이고 함수 이름과 문법만 달라서, 오늘은 번역 사전을 만드는 시간에 가까웠다.

| 파이토치 | 케라스 |
|---|---|
| `torch.nn` | `keras.layers` |
| `torch.optim` | `keras.optimizers` |
| `torch.utils.data` | `tf.data.Dataset` |
| `torch.autograd` | (케라스가 자동으로 처리) |

`torch.__version__`이 `'2.11.0+cu128'`처럼 나오면 CUDA 12.8을 지원하는 버전이라 GPU를 쓸 수 있고, `+cpu`면 CPU 전용이다. 설치할 때부터 갈린다.

```python
x = torch.tensor([1, 2, 3, 4, 5])
x                  # tensor([1, 2, 3, 4, 5])
x.shape, x.size()  # torch.Size([5]) torch.Size([5])
x.ndim, x.dtype    # 1 torch.int64
y.numel()          # 원소 개수
```

출력이 `tensor([1, 2, 3, 4, 5])`로 텐서플로보다 훨씬 간결하다. 가장 헷갈린 건 `size`라는 이름이었다. 넘파이의 `arr.size`는 원소 개수인데, 파이토치의 `x.size()`는 괄호가 붙는 함수이고 `shape`과 같은 모양을 돌려준다. 넘파이 감각으로 `x.size`라고 쓰면 함수 객체가 나온다. 파이토치에서 원소 개수는 `numel()`이다.

```python
torch.zeros(4, 2)             # 모양을 인자 여러 개로
torch.full((2, 4), 55)        # 이건 튜플
torch.rand(4, 2)              # [0, 1) 균등분포
torch.randn(4, 2)             # 정규분포 (n = normal)
torch.randint(0, 10, (3, 3))  # 정수, 모양은 튜플
torch.manual_seed(42)
x.item()                      # 원소가 하나일 때 파이썬 숫자로
```

모양을 넘파이는 튜플, 텐서플로는 리스트, 파이토치는 그냥 인자 여러 개로 주는데 파이토치도 튜플을 받는 함수가 섞여 있다. `torch.empty()`는 메모리를 잡기만 하고 청소를 안 해서 이전 값이 그대로 남아 있다. 수업에서 찍었을 때는 0이 나왔다가 다음 셀에서는 8.4855가 나왔다. `item()`은 손실 값을 출력할 때 `loss.item()`으로 많이 쓴다고 한다. 타입 변환은 `x.long()`, `x.float()`, `x.double()`처럼 메서드 이름으로 되어 있어서 `tf.cast`보다 짧다. `long`은 int64, `double`은 float64, `half`는 float16의 별명이다.

시드 고정은 파이썬, 넘파이, 파이토치 CPU와 GPU, cuDNN 결정적 모드까지 여덟 줄이나 됐다. 케라스는 `set_random_seed(42)` 한 줄이었다. 그리고 `torch.use_deterministic_algorithms(True)`는 주피터에서 한 번 켜면 커널을 재시작할 때까지 계속 적용된다.

### .to(device) - CPU와 GPU 사이를 옮기기

```python
device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

x = torch.randn(1)                          # CPU에 생긴다
y = torch.ones_like(x, device=device)       # tensor([1.], device='cuda:0')
# x + y → RuntimeError: Expected all tensors to be on the same device

x = x.to(device)
z = x + y                                   # tensor([1.5567], device='cuda:0')
z.to('cpu', torch.double)                   # 장치와 타입을 동시에
```

오늘 배운 것 중 파이토치가 텐서플로와 가장 크게 다른 부분이었다. 첫 줄은 GPU가 있으면 쓰고 없으면 CPU로 같은 코드가 두 환경에서 돌게 하는 관용구다. 다른 장치에 있는 텐서끼리는 연산이 안 된다. 케라스에서는 `fit()`만 부르면 알아서 GPU를 썼는데 파이토치는 텐서와 모델을 직접 GPU로 올려야 한다. 불편해 보이지만 어느 텐서가 어디 있는지 코드에 드러나서 모델 일부만 GPU에 올리거나 여러 GPU에 나눠 담는 조작이 자유롭다. 대신 모델은 GPU에 올렸는데 데이터를 안 올려서 나는 에러가 파이토치 입문자의 1번 에러라고 한다. 그리고 넘파이는 CPU 메모리만 알아서 GPU 텐서는 `x.cpu().numpy()`로 먼저 옮겨야 한다.

| 하는 일 | 텐서플로 | 파이토치 |
|---|---|---|
| 텐서 만들기 | `tf.constant([1,2,3])` | `torch.tensor([1,2,3])` |
| 0으로 채우기 | `tf.zeros([4,2])` | `torch.zeros(4, 2)` |
| 순차 생성 | `tf.range(12)` | `torch.arange(12)` |
| 타입 바꾸기 | `tf.cast(x, tf.float32)` | `x.float()` |
| 정규분포 난수 | `tf.random.normal([4,2])` | `torch.randn(4, 2)` |
| 시드 | `tf.random.set_seed(42)` | `torch.manual_seed(42)` |
| GPU로 | 자동 | `x.to(device)` |

차원별로 데이터를 정리한 표도 있었다. 2D는 (샘플, 특성)인 일반적인 표 데이터, 3D는 (샘플, 타임스텝, 특성)인 시계열, 4D는 (샘플, 높이, 너비, 채널)인 이미지, 5D는 프레임이 하나 더 붙은 비디오다.

## 이미지 업로드로 CNN 모델 써먹기
마지막은 어제 저장한 `best-cnn-model.keras`를 FastAPI에 얹는 프로젝트였다. 모델은 노트북 밖으로 나와야 쓸모가 생긴다. 붓꽃 프로젝트와 구조는 같은데 입력이 숫자 4개에서 이미지 파일로 바뀌었다. 파일은 JSON에 담을 수 없어서 6월에 배운 `multipart/form-data`가 다시 나왔다.

```
proj_fashionmnist/
├── main.py
├── model/
│   ├── best-cnn-model.keras
│   └── fashionmnist.py      예측 함수
├── templates/index.html
└── uploads/                 올린 파일이 쌓이는 곳
```

```python
# model/fashionmnist.py
classes = ['티셔츠', '바지', '스웨터', '드레스', '코트',
           '샌달', '셔츠', '스니커즈', '가방', '앵클 부츠']
model = tf.keras.models.load_model(r'./model/best-cnn-model.keras')   # import할 때 한 번만

def predict(file_path):
    img = Image.open(file_path)
    mono8img = img.convert('L')
    invImg = ops.invert(mono8img)
    resizeImg = invImg.resize((28, 28))
    data_arr = np.array(resizeImg).reshape(1, 28, 28, 1)
    data_scaled = data_arr / 255.
    preds = model.predict(data_scaled)
    return classes[np.argmax(preds)]
```

어제 노트북의 `predict()` 함수를 그대로 옮겼다. 노트북에서는 Colab 한글 폰트 문제로 클래스 이름을 영어로 뒀는데, 브라우저는 한글을 잘 그리니까 한글로 바꿨다. 순서만 같으면 결과는 같다. 모델 로드는 함수 밖에 둬서 import할 때 한 번만 읽고, 전처리 다섯 단계는 서비스 쪽에서도 훈련 때와 똑같이 해야 한다.

```python
UPLOAD_DIR = "uploads"
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)
app.mount("/static", StaticFiles(directory=UPLOAD_DIR), name="static")

@app.post("/upload")
async def upload_image(fashionfile: UploadFile = File(...)):
    file_path = os.path.join(UPLOAD_DIR, fashionfile.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(fashionfile.file, buffer)
    pred = predict(file_path)
    return {"filename": fashionfile.filename,
            "url": f"/static/{fashionfile.filename}",
            "message": "이미지 업로드 성공!",
            "pred": pred}
```

`UploadFile`의 `.filename`은 원래 파일 이름, `.file`은 내용에 접근하는 파일 객체, `.content_type`은 MIME 타입이다. `File(...)`의 `...`은 필수라는 뜻이다. `shutil.copyfileobj()`는 파일을 조금씩 나눠 복사해서, 통째로 `read()`하는 것보다 큰 파일에서 메모리를 아낀다. `uploads/` 폴더를 `/static`으로 `mount`해서 방금 올린 사진을 `<img src="/static/...">`로 다시 보여줄 수 있게 했다. 업로드 폴더와 서빙 폴더를 같게 둔 게 요령이다.

```javascript
async function uploadImage() {
    const input = document.getElementById("imageInput");
    if (input.files.length == 0) { alert("이미지를 선택하세요!"); return; }

    const formData = new FormData();
    formData.append("fashionfile", input.files[0]);   // 서버 매개변수 이름과 같아야 한다

    const response = await fetch("/upload", { method: "POST", body: formData });
    const result = await response.json();
    document.getElementById("preview").src = result.url;
    document.getElementById("predClass").innerHTML = result.pred;
}
```

붓꽃 때와 두 가지가 다르다. 몸통이 `JSON.stringify()`가 아니라 `formData`이고, `Content-Type` 헤더를 직접 적지 않는다. `multipart/form-data`에는 브라우저가 자동으로 만드는 구분자(boundary)가 붙어야 해서, 직접 적으면 구분자가 빠져 서버가 파싱을 못 한다. `formData.append("fashionfile", ...)`의 이름은 서버 함수의 매개변수 이름과 같아야 하고, 하나만 오타가 나도 422가 뜬다.

### 다시 보면서 고칠 것들
- 처음 코드에는 HTML은 `id="predClass"`, JS는 `getElementById('presClass')`로 한 글자가 달랐다. `getElementById`는 못 찾으면 `null`을 돌려줘서 다음 줄에서 터지는데, 전체가 `try/catch`로 감싸여 있으면 콘솔에만 찍힌다. "이미지는 뜨는데 예측 결과만 안 나온다"는 증상이 되고, 화면에 아무 반응이 없으면 F12 콘솔부터 봐야 한다.
- 응답 URL을 `http://127.0.0.1:8000/static/...`처럼 절대 경로로 박으면 붓꽃 때처럼 `localhost`로 접속하거나 포트가 바뀔 때 깨진다. `/static/...` 상대 경로를 쓴다.
- 원래 파일 이름으로 저장하면 두 사람이 같은 `photo.jpg`를 올렸을 때 덮어써진다. 6월에 배운 대로 `uuid.uuid4()`로 이름을 바꿔 저장하면 파일 이름에 `../`를 넣는 경로 조작 공격도 같이 막힌다.
- 타입 검사가 없어서 이미지가 아닌 파일을 올리면 `Image.open()`에서 500 에러가 난다. HTML의 `accept="image/*"`는 선택 창만 걸러줄 뿐이라 `content_type`을 서버에서 검사해야 한다.
- `from model.fashionmnist import *`는 `model`, `np` 같은 이름까지 다 쏟아붓는다. `main.py`에서 `model` 변수를 만들면 케라스 모델이 덮어써지니 `from model.fashionmnist import predict`처럼 필요한 것만 가져오는 게 안전하다.

붓꽃(SVM, 숫자 4개, JSON), 외국어 판별(SVM, 문장, JSON), FashionMNIST(CNN, 이미지 파일, form-data)까지 세 프로젝트를 나란히 놓으니 뼈대가 완전히 같았다. 저장된 모델을 최상단에서 한 번 로드하고, `predict()` 함수 하나를 만들고, FastAPI 엔드포인트로 노출한다. 다른 건 전처리를 어디에 두느냐였다. 붓꽃은 스케일러를 `.pkl` 파일로 옮겨야 했고, FashionMNIST는 흑백 → 반전 → 리사이즈 → /255라는 코드를 옮겨야 했다. 어느 쪽이든 빠뜨리면 에러 없이 조용히 틀린다. `keras.layers.Rescaling(1./255)`처럼 전처리를 아예 모델 안에 층으로 넣으면 `.keras` 파일 하나에 전처리까지 담을 수 있다.

## 헷갈리기 쉬운 부분
- Functional API의 `Dense(32)(inputs)`는 층을 만들고 바로 입력을 넣는 두 단계다. `keras.Model()`에는 시작과 끝만 준다.
- `Dense`는 마지막 축에만 작용한다. 4차원에 붙이면 4차원이 그대로 나온다.
- Subclassing 모델의 `summary()`가 `?`, 0개로 나오는 건 정상이다. 입력을 한 번 통과시켜야 가중치가 생긴다. `call()`은 직접 부르지 않고 `model(x)`로 부른다.
- dtype은 처음부터 정한다. 이미지 `uint8`을 층에 그대로 넣으면 에러가 나서 `tf.cast`로 `float32`로 바꾼다.
- `x[tf.newaxis, ..., tf.newaxis]`로 앞뒤에 동시에 차원을 끼운다. `...`는 나머지 차원 전부다.
- `KerasTensor`에는 값이 없어서 `.numpy()`가 안 된다.
- `get_weights()[0]`의 모양은 (커널 높이, 커널 너비, 입력 채널, 필터 개수)다.
- Dataset은 게을러서 꺼낼 때 계산된다. 큰 데이터는 `take()`로 잘라서 본다.
- `prefetch(tf.data.AUTOTUNE)`는 파이프라인 맨 끝에 붙인다.
- 기본값 셔플 뒤에 `take`와 `skip`으로 나누면 에포크마다 경계가 달라져 검증 세트가 샌다.
- 파이토치의 `x.size()`는 모양이고 원소 개수는 `x.numel()`이다.
- 파이토치는 다른 장치에 있는 텐서끼리 연산이 안 된다. 모델도 데이터도 `.to(device)`로 옮기고, GPU 텐서를 넘파이로 바꿀 때는 `.cpu().numpy()`다.
- 파일 업로드는 `FormData`로 보내고 `Content-Type`을 직접 적지 않는다. append 이름과 서버 매개변수 이름을 맞춘다.

## 오늘 배운 내용 정리
오늘은 케라스 모델을 만드는 세 가지 방법, 텐서 다루기, CNN 층 관찰, tf.data, 파이토치 텐서를 배우고 CNN 모델을 이미지 업로드 웹 서비스로 만들었다.

```
모델 만들기: Sequential(일자) / Functional(층(입력), keras.Model(inputs, outputs)) / Subclassing(__init__ + call).
텐서: tf.constant(dtype 명시), tf.cast, ...(나머지 전부), expand_dims / newaxis / squeeze / transpose.
KerasTensor: 구조만 있는 껍데기. tf.Tensor(EagerTensor)는 값이 있다.
층 관찰: conv_layer(image) → get_weights() (3,3,1,5) → ReLU(음수만 0) → MaxPool(절반) → Flatten(845).
tf.data: from_tensor_slices((X, y)) → map(preprocess) → shuffle → batch → prefetch(AUTOTUNE) → fit(ds).
파이토치: torch.tensor, size()=shape, numel(), rand/randn, manual_seed, x.to(device), .cpu().numpy().
업로드 서비스: UploadFile + shutil.copyfileobj → uploads/를 /static으로 mount → FormData로 fetch.
```

CNN 층을 하나씩 직접 통과시켜본 게 가장 기억에 남았다. 어제는 `summary()` 표의 숫자로만 알던 `(1, 28, 28, 1) → (1, 26, 26, 5) → (1, 13, 13, 5)`가, 오늘은 그림과 -252 ~ 194 같은 실제 값으로 보였다. 그리고 파이토치는 이름만 다를 뿐 같은 이야기라고 생각했는데, `.to(device)`처럼 케라스가 알아서 해주던 걸 내가 직접 챙겨야 하는 부분이 생기기 시작했다.

---
