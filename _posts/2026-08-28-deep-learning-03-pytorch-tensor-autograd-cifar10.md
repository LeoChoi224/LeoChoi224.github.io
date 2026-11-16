---
layout: single
title: "딥러닝 기초 정리 3 - 파이토치 텐서 연산과 조작, Autograd, CIFAR-10 깊은 CNN"
categories: [coding, DeepLearning]
tag: [study-log, DeepLearning, PyTorch, tensor, Autograd, backward, CNN, CIFAR-10, FastAPI]
toc: true
author_profile: false
sidebar:
    nav: "docs"
search: true
---
<hr/>

어제 파이토치로 텐서를 만드는 법까지 배웠다면, 오늘은 그 안의 숫자를 계산하고, 모양을 바꾸고, 미분하는 법을 배웠다. 케라스가 `fit()` 안에 감춰뒀던 역전파를 파이토치에서는 `backward()` 한 줄로 직접 부른다. 오후에는 다시 케라스로 돌아가 합성곱을 여섯 겹 쌓은 깊은 CNN으로 컬러 사진 CIFAR-10을 분류하고, 여러 장을 한꺼번에 올려 예측하는 웹 서비스를 만들었다.

## 파이토치 텐서의 연산
대부분은 넘파이와 똑같아서 새로 배울 게 없었다. 대신 파이토치만의 규칙이 두 가지 있었다. 함수형과 메서드형이 둘 다 있다는 것, 그리고 이름 뒤에 밑줄이 붙으면 원본을 바꾼다는 것이다.

### 함수와 메서드

```python
a = torch.tensor([-2.7, -1.2, 0.3, 1.2, 2.7])
print(a * 2 - 1)    # tensor([-6.4000, -3.4000, -0.4000,  1.4000,  4.4000])

print(torch.abs(a), torch.ceil(a), torch.floor(a), torch.round(a))
print(a.abs(), a.ceil(), a.floor(), a.round())   # 같은 결과
```

`torch.함수(텐서)`와 `텐서.메서드()`는 같은 것이다. 이어 붙일 때는 `torch.mean(torch.abs(a))`보다 `a.abs().mean()`이 왼쪽에서 오른쪽으로 읽혀서 편하다. `ceil(-2.7)`이 -3이 아니라 -2인 게 헷갈렸는데, 올림은 수직선에서 큰 쪽으로 가는 거라 -2가 맞다.

```python
torch.clamp(a, -0.5, 0.5)   # tensor([-0.5000, -0.5000,  0.3000,  0.5000,  0.5000])
print(torch.mean(a), torch.sum(a), torch.std(a), torch.prod(a))
print(torch.min(a), torch.max(a), torch.argmax(a), torch.argmin(a))
```

`clamp`는 범위를 벗어난 값을 경계값으로 찝어버린다. 기울기가 너무 커지는 걸 막을 때(gradient clipping)도 쓴다고 한다. `prod`는 모든 원소를 곱한 총곱이고, `argmax`는 값이 아니라 위치다. `torch.std()`는 넘파이와 값이 다르게 나왔는데, 파이토치는 기본이 `n-1`로 나누고 넘파이는 `n`으로 나누기 때문이다. 붓꽃 때 `StandardScaler`와 `describe()`의 표준편차가 달랐던 것과 같은 이야기다.

### dim= 은 없앨 축

```python
x = torch.randint(0, 10, (4, 2))
# tensor([[2, 7],
#         [6, 4],
#         [6, 5],
#         [0, 4]])
x.sum()          # tensor(34)
x.sum(dim=0)     # tensor([14, 20])        결과 (2,)
x.sum(dim=1)     # tensor([9, 10, 11, 4])  결과 (4,)
```

오늘 가장 헷갈린 부분이었다. 세로로 더하는데 왜 `dim=0`일까. `dim=`은 방향이 아니라 "이 축을 없앤다"는 뜻이다. (4, 2)에서 `dim=0`이면 크기 4인 축이 사라져서 (2,)가 되고, `dim=1`이면 크기 2인 축이 사라져서 (4,)가 된다. 방향으로 외우지 말고 결과 shape으로 판단하면 안 틀린다. 케라스의 `axis=`와 이름만 다른 같은 개념이다.

`x.max(dim=1)`처럼 `dim`을 주면 `values=tensor([7, 6, 6, 4])`, `indices=tensor([1, 0, 0, 1])`로 값과 인덱스가 같이 나온다. `dim`이 없으면 값 하나만 나와서 반환 형태가 달라진다. 분류 모델에서 예측 클래스를 뽑을 때는 `preds.argmax(dim=1)`을 많이 쓴다.

### 사칙연산, out=, 그리고 밑줄

```python
print(x + y, x - y, x * y, x / y)
print(torch.add(x, y), torch.sub(x, y), torch.mul(x, y), torch.div(x, y))   # 같다

result = torch.empty(2, 2)
torch.add(x, y, out=result)     # 결과를 미리 만든 텐서에 담는다
```

`*`는 같은 자리끼리 곱하는 원소별 곱이고, 정수끼리 나누면 실수가 된다. `out=result`는 이미 있는 메모리에 결과를 써 넣어서, 대입 연산처럼 새 객체를 만들지 않아 빠르다. 어차피 덮어쓸 자리라서 초기화를 안 하는 `torch.empty()`가 여기서 쓸모를 찾는다. 이번에 찍어본 `empty` 결과는 `-1.7014e+38` 같은 쓰레기 값이었다.

```python
y = torch.tensor([[-4, -5], [-10, -6]])
print(y.add(x))   # tensor([[-2, 2], [-4, -2]])
print(y)          # tensor([[-4, -5], [-10, -6]])   원본 그대로

y.add_(x)         # 밑줄
print(y)          # tensor([[-2, 2], [-4, -2]])     바뀌었다
```

함수 이름 뒤의 밑줄 하나가 "원본을 고친다(in-place)"는 표시다. `add_()`, `mul_()`, `clamp_()`, `zero_()`처럼 파이토치의 모든 연산에 적용된다. 모델 가중치는 수백만 개라 매 스텝 `w = w - lr * grad`로 새 텐서를 만들면 메모리가 계속 새로 잡히는데, 제자리에서 고치면 그 낭비가 없다. 옵티마이저 내부가 이런 연산으로 되어 있다고 한다. 대신 위험해서, 학습 중인 텐서에 밑줄 연산을 쓰면 뒤에서 배울 Autograd와 충돌한다.

### 행렬곱

```python
print(torch.matmul(x, y))
print(torch.mm(x, y))
# tensor([[-32, -10],
#         [-28,   4]])
```

`*`와 완전히 다른 연산이다. 검산해보려고 원래 `y`로 계산했더니 -78이 나와서 이상했는데, 바로 앞 셀에서 `y.add_(x)`로 `y`가 이미 바뀌어 있었다. 바뀐 `y`로 계산하면 `2×(-2) + 7×(-4) = -32`가 맞다. in-place 연산의 부작용을 직접 겪은 셈이다. `torch.mm`은 2차원 행렬만, `torch.matmul`은 배치 행렬곱까지 받아서 딥러닝에서는 `matmul`이나 `@` 연산자를 쓴다. 밀집층이 하는 일이 바로 `입력 @ 가중치 + 절편`이다. 정사각 행렬끼리는 `*`로 잘못 써도 에러 없이 다른 값이 나와서 더 위험하다.

## 파이토치 텐서의 조작
딥러닝에서 에러의 절반은 shape이 안 맞아서 난다. 모델은 `(batch, channel, height, width)`를 기대하는데 내 데이터는 `(height, width, channel)`이고, 한 장만 넣으려는데 배치 차원이 없는 식이다. 어제 텐서플로로 배운 것과 개념은 같고 파이토치 이름을 익히는 시간이었다.

```python
x = torch.Tensor([[1, 2, 3, 4],
                  [5, 6, 7, 8],
                  [9, 10, 11, 12]])
x[:, 0]           # tensor([1., 5., 9.])
x[..., 0]         # 같은 것
x[1:, 1:3]        # tensor([[6., 7.], [10., 11.]])
```

인덱싱과 슬라이싱, `...`까지 넘파이, 텐서플로와 똑같다. 그런데 출력에 소수점이 붙었다. 대문자 `torch.Tensor()`는 무조건 `float32`로 만들고, 소문자 `torch.tensor()`는 입력에 맞춰 `int64`로 만든다. 소문자 쪽이 의도가 명확해서 권장된다고 한다.

### view와 reshape

```python
x.view(2, 2, 3)     # (3, 4) → (2, 2, 3)
x.view(3, -1)       # -1은 자동 계산 → (3, 4)
x.view(-1)          # 전부 펴기
x.view(5, -1)       # RuntimeError: 12는 5로 안 나눠떨어진다
```

텐서의 숫자들은 메모리에 한 줄로 저장돼 있고, shape은 그걸 어떻게 끊어 읽을지의 규칙일 뿐이다. `view`는 읽는 규칙만 바꿔서 복사가 없어 빠르지만, 메모리가 한 줄로 이어져 있어야만 된다. `permute`를 한 다음에는 그 연속성이 깨져서 `view`가 에러를 내는데, 에러 메시지가 친절하게 `reshape`을 쓰라고 알려준다. `reshape`은 필요하면 복사해서라도 거의 항상 성공하니 애매하면 `reshape`을 쓰면 된다.

### squeeze, unsqueeze, permute

```python
torch.rand(1, 3, 3).squeeze()        # (1, 3, 3) → (3, 3)
torch.rand(3, 3).unsqueeze(dim=0)    # (3, 3) → (1, 3, 3)
torch.rand(3, 3).unsqueeze(dim=-1)   # (3, 3) → (3, 3, 1)

img = torch.randn(2, 3, 4)           # (H, W, C)
img.permute(2, 0, 1).shape           # torch.Size([4, 2, 3])  (C, H, W)
```

`unsqueeze`는 텐서플로의 `expand_dims`에 해당하고, 한 장을 예측할 때 배치 차원 1을 붙이는 게 가장 흔한 용도다. `permute(2, 0, 1)`은 새 0번 자리에 원래 2번을, 새 1번에 원래 0번을, 새 2번에 원래 1번을 가져온다. 케라스는 채널이 마지막이고 파이토치는 채널이 먼저라서, 케라스에서 쓰던 `(N, 28, 28, 1)`을 파이토치로 가져가려면 `x.permute(0, 3, 1, 2)`로 `(N, 1, 28, 28)`을 만들어야 한다.

여기서 조심할 게 있었다. `img.view(4, 2, 3)`도 shape은 `permute(2, 0, 1)`과 같은 (4, 2, 3)이지만 내용이 완전히 다르다. `permute`는 숫자의 위치를 실제로 재배치하고, `view`는 같은 숫자 나열을 다르게 끊어 읽을 뿐이다. 채널 순서를 `view`로 바꾸면 에러 없이 픽셀이 섞여 이미지가 깨진다.

### stack과 cat

```python
x = torch.FloatTensor([1, 4])
y = torch.FloatTensor([2, 5])
z = torch.FloatTensor([3, 6])
torch.stack([x, y, z])          # (3, 2)  차원이 늘었다

x = torch.randn(1, 3, 3)
y = torch.randn(1, 3, 3)
torch.cat((x, y), dim=0)        # (2, 3, 3)
torch.cat((x, y), dim=1)        # (1, 6, 3)
torch.cat((x, y), dim=2)        # (1, 3, 6)
```

`stack`은 새 축을 만들어 쌓아서 차원이 늘고, `cat`은 기존 축에 이어 붙여서 차원이 그대로다. `stack`은 종이를 겹쳐 책으로 만드는 것이고, `cat`은 종이를 옆으로 이어 붙여 더 큰 종이를 만드는 것이다. `cat`의 `dim=`은 어느 방향으로 이어 붙일지를 정하고, 그 축만 커지고 나머지 축은 크기가 같아야 한다. 이미지 여러 장을 배치로 묶을 때는 `stack`, 이미 배치인 것끼리 합칠 때는 `cat`이다.

### chunk와 split

```python
x = torch.arange(1, 19).reshape(3, 6)
torch.chunk(x, 3, dim=1)    # 3조각으로 → (3, 2) × 3
torch.split(x, 3, dim=1)    # 3개씩     → (3, 3) × 2
torch.chunk(x, 4, dim=0)    # (1, 6) × 3  ← 4개가 아니라 3개
```

같은 3인데 `chunk`는 조각 개수, `split`은 조각 크기라 뜻이 반대다. 그리고 `chunk`는 요청한 개수를 보장하지 않아서 크기 3인 축을 4조각 내면 3개만 나온다. `t1, t2, t3, t4 = torch.chunk(...)`로 받으면 언패킹 에러가 난다.

### 넘파이와 메모리를 공유한다

```python
x = torch.arange(7)
arr = x.numpy()
x.add_(10)
print(arr)          # [10 11 12 13 14 15 16]  배열도 바뀌었다

arr = np.arange(10)
x = torch.from_numpy(arr)
np.add(arr, 10, out=arr)
print(x)            # tensor([10, 11, ..., 19])  텐서도 바뀌었다
```

CPU에 있는 텐서와 넘파이 배열은 메모리를 공유해서 한쪽이 바뀌면 다른 쪽도 바뀐다. 복사가 아니라 같은 집에 문패를 두 개 단 것이다. 6만 장짜리 이미지를 바꿀 때마다 복사하면 메모리가 두 배로 드니까 공유하는 건데, 원본 배열을 실수로 건드리면 학습 데이터가 오염된다. 복사가 필요하면 `torch.tensor(arr)`나 `x.numpy().copy()`를 쓴다. GPU 텐서는 공유가 불가능해서 어제 배운 `.cpu()`가 필요했고, 그 `.cpu()`는 복사다.

## Autograd - 케라스가 숨겨둔 미분
신경망을 배우면서 역전파라는 말이 나왔지만 직접 해본 적은 없었다. `model.fit()` 한 줄이면 알아서 됐다. 케라스는 그 과정을 통째로 감춰서 편하지만 뭔가 이상할 때 손댈 데가 없다. 파이토치는 그걸 밖으로 꺼내놓아서 훈련 코드를 직접 써야 하지만, 대신 중간에 끼어들어 뭐든 할 수 있다.

### requires_grad와 grad_fn

```python
x = torch.ones(3, 3, requires_grad=True)
x.grad_fn          # None

y = x + 5
print(y)           # tensor([[6., 6., 6.], ...], grad_fn=<AddBackward0>)
z = y * y          # grad_fn=<MulBackward0>
out = z.mean()     # grad_fn=<MeanBackward0>
```

`requires_grad`는 기본이 `False`라 모든 텐서를 추적하지는 않는다. `True`로 켜면 "이 숫자는 나중에 미분할 대상이니 기록해둬"라는 표시가 되고, 파이토치가 연산 그래프를 만들기 시작한다. 연산을 할 때마다 결과에 `grad_fn`이 붙어서 무슨 연산으로 만들어졌는지가 딸려 온다. 케이크를 만들 때 밀가루 → 반죽 → 구움을 영수증처럼 적어두는 것과 같다. 나중에 "설탕을 조금 더 넣었으면 맛이 얼마나 달라졌을까"를 되짚으려면 그 기록이 필요하다. `x`는 내가 직접 만들어서 부모가 없으니 `grad_fn`이 `None`이다.

### backward()

```python
x = torch.ones(3, 3, requires_grad=True)
y = x + 5
z = y * y
out = z.mean()
print(out)         # tensor(36., grad_fn=<MeanBackward0>)

out.backward()
print(x.grad)
# tensor([[1.3333, 1.3333, 1.3333],
#         [1.3333, 1.3333, 1.3333],
#         [1.3333, 1.3333, 1.3333]])
```

`backward()` 한 줄로 `x.grad`가 채워졌다. 1.3333이 어디서 나왔는지 손으로 계산해봤다. `out`은 `z` 9개의 평균이고, `z = y²`, `y = x + 5`다.

```
∂out/∂x = (1/9) × 2y × 1     (연쇄법칙)
        = (1/9) × 2 × 6      (x=1이라 y=6)
        = 12/9 = 1.3333
```

`1/9`는 평균에서, `2y`는 `y²`의 미분에서, `× 1`은 `x + 5`의 미분에서 나왔다. 연쇄법칙을 파이토치가 대신 해준 것이다.

결과가 스칼라가 아니라 벡터면 `backward()`에 인자가 필요하다. 미분은 "결과가 얼마나 변하나"를 재는 건데 결과가 여러 개면 어느 것을 기준으로 할지 정해지지 않으니, `y.backward(v)`처럼 가중치 벡터를 준다. 실전에서는 손실이 항상 스칼라 하나라서 `loss.backward()`로 인자 없이 부른다. `.data`로 추적을 벗겨낸 값만 꺼낼 수도 있는데 오래된 방식이라 요즘은 `detach()`나 `no_grad()`를 권장한다.

### no_grad()와 detach()

```python
x.requires_grad              # True
(x ** 2).requires_grad       # True

with torch.no_grad():
    print((x ** 2).requires_grad)   # False

w = x.detach()               # 값은 같고 추적은 안 하는 새 텐서
x is w                       # False
x.eq(w).all()                # tensor(True)
```

추론할 때는 미분이 필요 없는데 추적을 켜두면 연산 그래프를 계속 만들어서 메모리를 먹고 느려진다. `no_grad()`는 블록 전체에서 추적을 끄고, `detach()`는 텐서 하나를 그래프에서 뗀다. 어제 나온 `preds.detach().cpu().numpy()`가 여기서 완성된다. 그래프에서 떼고, CPU로 옮기고, 넘파이로 바꾸는 것이다. `is`는 같은 객체인지, `eq`는 값이 같은지를 본다.

노트북에는 `no_grad()`를 쓰면 배치 정규화와 드롭아웃이 작동하지 않는다고 적혀 있었는데, 정확히는 드롭아웃을 끄는 건 `model.eval()`이고 `no_grad()`는 기울기 추적만 끈다. 하는 일이 달라서 추론할 때는 둘을 같이 쓴다.

```python
model.eval()
with torch.no_grad():
    preds = model(test_data)
```

케라스에서는 `predict()`가 이 둘을 알아서 처리해줬는데 파이토치는 직접 켜고 꺼야 한다.

### 걸리기 쉬운 것들
- `x.grad`가 `None`이면 아직 `backward()`를 안 부른 것이다. `grad_fn`은 연산할 때 자동으로 붙지만 `.grad`는 `backward()`를 불러야 채워진다.
- `a → b → c → out`에서 `backward()`를 하면 `a.grad`만 채워지고 `b.grad`, `c.grad`는 `None`이다. 사용자가 직접 만든 leaf 텐서의 기울기만 저장하고 중간 텐서 것은 버린다. 실제로 필요한 건 모델 파라미터의 기울기뿐이고 그건 전부 leaf다.
- `backward()`를 두 번 부르면 에러다. 한 번 역전파하면 그래프가 지워진다. 훈련 루프에서는 매 스텝 순전파를 다시 하니 문제없다.
- `.grad`는 덮어쓰기가 아니라 누적이다. 다시 순전파하고 `backward()`하면 1.3333이 2.6666이 된다. 그래서 훈련 루프 매 스텝에 `optimizer.zero_grad()`가 꼭 들어간다. 케라스에는 이 개념 자체가 없어서 파이토치 입문자가 가장 많이 놓친다고 한다.
- `requires_grad=True`인 leaf 텐서에 `x.add_(1)`처럼 밑줄 연산을 하면 `RuntimeError`가 난다. 값을 직접 바꿔야 한다면 `no_grad()` 안에서 한다.

```python
# 케라스
model.fit(X, y, epochs=5)

# 파이토치
for epoch in range(5):
    for xb, yb in dataloader:
        optimizer.zero_grad()       # 기울기 초기화
        pred = model(xb)            # 순전파
        loss = criterion(pred, yb)  # 손실 계산
        loss.backward()             # 역전파 ← 오늘 배운 것
        optimizer.step()            # 가중치 갱신
```

케라스의 `fit()` 한 줄 안에 이 다섯 줄이 들어 있었다. 텐서플로 1.x는 설계도를 다 그린 뒤 실행하는 Define and Run 방식이었고, 파이토치는 실행하면서 설계도가 그려지는 Define by Run 방식이다. 파이썬 코드가 곧 그래프라 `for`나 `if`를 자유롭게 쓰고, 중간에 `print(x.shape)`을 넣으면 그대로 찍힌다. 어제 본 "Functional API로 안 되는 모델"이 파이토치에서는 그냥 된다.

## CIFAR-10 - 깊은 CNN으로 컬러 사진 분류
어제 FashionMNIST 서비스는 흑백 28×28이라 너무 쉬웠고(0.92), 한 장씩만 올릴 수 있었다. CIFAR-10은 32×32 컬러 자연 사진이라 각도도 배경도 제각각이다. 입력 값이 784개에서 3,072개(32×32×3)로 늘었다.

```python
(train_input, train_target), (test_input, test_target) = datasets.cifar10.load_data()
print(train_input.shape)     # (50000, 32, 32, 3)
print(train_target.shape)    # (50000, 1)
class_names = ['airplane', 'automobile', 'bird', 'cat', 'deer',
               'dog', 'frog', 'horse', 'ship', 'truck']

train_scaled = train_input / 255.0
test_scaled = test_input / 255.0
train_scaled, val_scaled, train_target, val_target = train_test_split(
    train_scaled, train_target, test_size=0.2, random_state=42)
```

이미 채널이 있는 4차원이라 `reshape`할 필요가 없다. 타깃이 (50000, 1)로 2차원인데 `sparse_categorical_crossentropy`는 둘 다 받아준다. 클래스당 5,000장씩 균형이 맞고, cat과 dog, automobile과 truck처럼 헷갈리기 쉬운 짝이 있다. 5만 장도 아직 메모리에 올라가서 어제 배운 Dataset 대신 `train_test_split`을 썼다.

### Conv-Conv-Pool을 세 번

```python
model = keras.Sequential([
    keras.layers.Input(shape=(32, 32, 3)),

    keras.layers.Conv2D(32, 3, activation='relu', padding='same'),
    keras.layers.Conv2D(32, 3, activation='relu'),
    keras.layers.MaxPooling2D(2),
    keras.layers.Dropout(0.25),

    keras.layers.Conv2D(64, 3, activation='relu', padding='same'),
    keras.layers.Conv2D(64, 3, activation='relu'),
    keras.layers.MaxPooling2D(2),
    keras.layers.Dropout(0.25),

    keras.layers.Conv2D(128, 3, activation='relu', padding='same'),
    keras.layers.Conv2D(128, 3, activation='relu'),
    keras.layers.MaxPooling2D(2),
    keras.layers.Dropout(0.25),

    keras.layers.Flatten(),
    keras.layers.Dense(512, activation='relu'),
    keras.layers.Dropout(0.5),
    keras.layers.Dense(10, activation='softmax'),
])
```

| 구분 | FashionMNIST | CIFAR-10 |
|---|---|---|
| 합성곱 층 | 2개 | 6개 (2개씩 3묶음) |
| 필터 개수 | 32 → 64 | 32 → 64 → 128 |
| 드롭아웃 | 1개 (0.4) | 4개 (0.25 × 3 + 0.5) |
| 밀집층 | 100 | 512 |
| 파라미터 | 333,526 | 554,794 |

풀링으로 줄이기 전에 합성곱을 두 번 하고, 필터는 두 배씩 늘리고, 풀링마다 드롭아웃을 넣는다. 3×3 합성곱을 두 번 하면 5×5 한 번과 같은 범위를 보는데 파라미터는 더 적고(25,600 대 18,432), 중간에 ReLU가 한 번 더 들어가서 표현력도 좋다. VGG라는 모델이 널리 퍼뜨린 방식이라 지금은 거의 표준이라고 한다.

한 묶음에서 `padding`을 하나만 준 것도 이유가 있다. `same`으로 32×32를 유지하고 `valid`에서만 30×30으로 줄인 다음 풀링으로 15×15를 만든다. 둘 다 `valid`였으면 너무 빨리 작아진다.

```
32×32×3 → 32×32×32 → 30×30×32 → 15×15×32
        → 15×15×64 → 13×13×64 → 6×6×64
        → 6×6×128  → 4×4×128  → 2×2×128
        → Flatten → 512
```

첫 층 파라미터가 `(3 × 3 × 3 + 1) × 32 = 896`인데 마지막 3이 RGB 채널이다. 어제는 흑백이라 1이었다. 그리고 `Flatten` 결과가 `2 × 2 × 128 = 512`라 바로 다음 `Dense(512)`와 숫자가 같은데, 두 512는 아무 관계가 없다. 앞은 계산된 결과이고 뒤는 사람이 정한 뉴런 수다. 입력이 64×64였다면 앞의 숫자만 4,608로 바뀐다.

### 훈련과 평가

```python
checkpoint_cb = keras.callbacks.ModelCheckpoint(model_path, save_best_only=True)
early_stopping_cb = keras.callbacks.EarlyStopping(patience=2, restore_best_weights=True)
history = model.fit(train_scaled, train_target, epochs=100,
                    validation_data=(val_scaled, val_target),
                    callbacks=[checkpoint_cb, early_stopping_cb])
```

```
Epoch  9/100  accuracy: 0.7095 - loss: 0.8322 - val_accuracy: 0.7369 - val_loss: 0.7482  ← 최저
Epoch 10/100  accuracy: 0.7221 - loss: 0.8004 - val_accuracy: 0.7363 - val_loss: 0.7641
Epoch 11/100  accuracy: 0.7249 - loss: 0.7880 - val_accuracy: 0.7315 - val_loss: 0.7816
```

`epochs=100`을 줬지만 9번째에 최저를 찍고 2번 연속 올라가서 11번 만에 끝났다. 평가해보니 검증 점수가 정확히 9번째 에포크의 0.7369 / 0.7482와 일치해서 `restore_best_weights=True`가 최적 시점을 복원했다는 걸 확인했다. 11번째 가중치였다면 0.7315 / 0.7816이 나왔을 것이다.

```python
print(model.evaluate(val_scaled, val_target))    # [0.7482, 0.7369]
print(model.evaluate(test_scaled, test_target))  # [0.7873, 0.7282]
```

같은 10종 분류인데 0.92에서 0.73으로 떨어졌다. 색과 배경이 있는 자연 사진이 그만큼 어렵다. 그래도 이 크기의 간단한 CNN으로는 무난한 결과라고 한다(사람이 약 0.94). 다만 `patience=2`는 조금 성급했던 것 같다. 손실 곡선은 원래 요동치니까 이렇게 어려운 데이터에는 5~10 정도로 늘리면 더 학습할 여지가 있어 보인다. 데이터 증강(`RandomFlip`, `RandomRotation`)을 넣으면 5~10%p는 오른다고 한다. 개 사진은 좌우로 뒤집어도 개라서 공짜로 데이터가 두 배가 된다.

`model.predict(val_scaled[0:1])`로 한 장을 예측해보니 dog 0.531, cat 0.395로 아슬아슬하게 개를 골랐다. FashionMNIST에서 확률이 1.0이었던 것과 대조적이다.

### 실제 사진 예측

```python
def predict(file_path):
    img = Image.open(file_path)
    rgb_img = img.convert('RGB')
    resize_img = rgb_img.resize((32, 32))
    data_arr = np.array(resize_img).reshape(1, 32, 32, 3)
    data_scaled = data_arr / 255.0
    preds = model.predict(data_scaled)
    return class_names[np.argmax(preds)]
```

어제와 달리 반전이 없다. FashionMNIST는 검은 배경에 흰 옷이라는 특수한 형태라 반전이 필요했고, CIFAR-10은 평범한 컬러 사진이라 그대로 쓰면 된다. 인터넷에서 받은 사진 10장 중 9장을 맞혔고, 개를 사슴으로 틀렸다. 네발 동물끼리의 혼동이다.

`.convert('RGB')`가 형식적인 줄이 아니라는 것도 알게 됐다. 사진 하나가 `mode=CMYK`였는데, 인쇄용 색공간이라 채널이 4개다. 모델은 채널 3개를 기대해서 그대로 넣으면 에러가 난다. PNG 파일은 투명도가 있는 `RGBA`(4채널)인 경우가 많은데, 그것도 이 줄 덕분에 문제없이 처리됐다. 그리고 `resize((32, 32))`는 2066×1399 같은 직사각형 사진을 억지로 정사각형으로 눌러서 찌그러뜨린다. 학습 데이터는 처음부터 정사각형이라 이런 왜곡이 정확도를 떨어뜨린다.

### 여러 장을 한 번에

```python
def predict_images(file_paths):
    data_list = []
    for file_path in file_paths:
        img = Image.open(file_path)
        rgb_img = img.convert('RGB')
        resize_img = rgb_img.resize((32, 32))
        data_list.append(np.array(resize_img))

    data_arr = np.array(data_list)          # (N, 32, 32, 3)
    data_scaled = data_arr / 255.0
    preds = model.predict(data_scaled)      # 한 번만 호출
    return [class_names[i] for i in np.argmax(preds, axis=1)]
```

노트북에 "함수 안에서 predict()가 단 한 번만 호출되도록 합니다"라고 강조돼 있었다. `predict()`는 매번 GPU로 데이터를 보내고 결과를 받아오는 준비 작업을 하는데, 한 장이든 100장이든 그 비용이 비슷하다. 10장이면 `for` 문 안에서 10번 부르지 말고 묶어서 한 번 불러야 한다. 리스트에 모아서 `np.array()`로 만들면 `stack`처럼 (N, 32, 32, 3)이 되고, 배치 차원 문제도 자연스럽게 해결된다. `np.argmax(preds, axis=1)`의 `axis=1`은 (N, 10)에서 샘플마다 최댓값 인덱스를 뽑는다.

```python
from typing import List

app.mount("/static", StaticFiles(directory="static"), name="static")    # JS, CSS
app.mount("/files", StaticFiles(directory=UPLOAD_DIR), name="files")    # 업로드 이미지

@app.post("/upload")
async def upload_image(imagefiles: List[UploadFile] = File(...)):
    file_paths, urls = [], []
    for imagefile in imagefiles:
        filename = os.path.basename(imagefile.filename)   # 경로 제거
        file_path = os.path.join(UPLOAD_DIR, filename)
        with open(file_path, "wb") as f:
            shutil.copyfileobj(imagefile.file, f)
        file_paths.append(file_path)
        urls.append(f"/files/{filename}")                 # 상대 경로

    labels = predict_images(file_paths)                   # 한 번에 예측
    return {"results": [{"url": u, "label": l} for u, l in zip(urls, labels)]}
```

`List[UploadFile]` 한 줄로 여러 파일을 받는다. HTML은 `<input type="file" multiple>`이고, JS에서는 `formData.append("imagefiles", file)`를 같은 이름으로 여러 번 하면 서버가 리스트로 받는다. 6월에 `q: List[int] = Query([])`로 `?q=1&q=2`를 받던 것과 같은 원리다.

어제 프로젝트에서 아쉬웠던 것들이 오늘은 많이 고쳐졌다. URL은 `/files/{filename}` 상대 경로로 바뀌었고, `os.path.basename()`으로 `../../etc/passwd` 같은 경로가 들어와도 `passwd`만 남게 했다. 정적 자원(`/static`)과 사용자 업로드(`/files`)도 분리해서 JS 파일과 업로드 이미지가 섞이지 않는다. 결과 표시도 템플릿 문자열로 만들어서 id 오타가 날 일이 없어졌다.

설치 안내에 `python-multipart`가 있었는데, 파일 업로드를 쓰는 순간 반드시 필요한 라이브러리다. 없으면 `Form data requires "python-multipart" to be installed`라는 에러가 난다. `tensorflow==2.19.0`처럼 버전을 고정한 것도 `.pkl`처럼 `.keras` 파일도 저장할 때와 불러올 때 버전이 다르면 깨질 수 있기 때문이다.

## 헷갈리기 쉬운 부분
- `torch.함수(x)`와 `x.함수()`는 같다.
- 밑줄이 붙으면 원본을 바꾼다. `y.add(x)`는 새 텐서, `y.add_(x)`는 `y`가 바뀐다.
- `dim=`은 없앨 축이다. (4, 2)에서 `dim=0`이면 결과가 (2,)다.
- `max(dim=)`은 값과 인덱스를 같이 돌려준다.
- `*`는 원소별 곱, `@`와 `matmul`이 행렬곱이다.
- 파이토치 `std()`는 `n-1`, 넘파이는 `n`으로 나눈다.
- 대문자 `torch.Tensor()`는 항상 float32, 소문자 `torch.tensor()`는 입력에 맞춘다.
- `view`는 메모리가 연속이어야 하고, 애매하면 `reshape`을 쓴다.
- 채널 순서는 `permute`로 바꾼다. `view`로 바꾸면 에러 없이 픽셀이 섞인다.
- `stack`은 차원을 늘리고 `cat`은 안 늘린다. `chunk`는 개수, `split`은 크기다.
- CPU 텐서의 `.numpy()`와 `torch.from_numpy()`는 메모리를 공유한다.
- `.grad`는 `backward()`를 불러야 채워지고, leaf 텐서에만 저장되고, 누적된다. 매 스텝 `zero_grad()`.
- 추론할 때는 `model.eval()`과 `torch.no_grad()`를 같이 쓴다.
- 3×3 합성곱 두 번이 5×5 한 번보다 파라미터가 적다. `Conv-Conv-Pool`이 기본형이다.
- `predict()`는 여러 장을 묶어서 한 번만 부른다.
- 실제 사진은 CMYK나 RGBA일 수 있어서 `.convert('RGB')`가 필요하다.
- 업로드 파일 이름은 `os.path.basename()`으로 경로를 떼고 쓴다.

## 오늘 배운 내용 정리
오늘은 파이토치의 텐서 연산과 조작, Autograd를 배우고 케라스로 CIFAR-10 깊은 CNN과 여러 장 업로드 서비스를 만들었다.

```
연산: torch.mean(a) == a.mean(). clamp, prod, argmax. dim=은 없앨 축. max(dim=)은 values + indices.
in-place: add_(), mul_() 처럼 밑줄이면 원본을 바꾼다. out=으로 결과를 기존 텐서에.
행렬곱: matmul / mm / @. *는 원소별 곱.
조작: view(연속일 때) / reshape, squeeze / unsqueeze, permute(채널 순서), stack / cat, chunk / split.
넘파이 공유: .numpy(), from_numpy()는 메모리 공유. 복사는 torch.tensor(arr).
Autograd: requires_grad=True → grad_fn 기록 → backward() → leaf.grad. 기울기는 누적 → zero_grad().
추론: model.eval() + torch.no_grad(). detach().cpu().numpy().
CIFAR-10: Conv-Conv-Pool × 3, 필터 32 → 64 → 128, Dropout. 테스트 0.7282.
서비스: List[UploadFile] + multiple + 같은 이름 append. predict()는 배치로 한 번.
```

손으로 계산한 1.3333이 `x.grad`에 그대로 찍혀 있던 게 가장 기억에 남았다. 지금까지 `fit()` 안에서 일어난다고만 들었던 역전파가 결국 연쇄법칙으로 미분값을 구하는 일이었고, 파이토치는 그걸 기록해뒀다가 `backward()` 한 번에 계산해준다. 그리고 `y.add_(x)` 하나 때문에 그 뒤 행렬곱 결과가 달라진 걸 보면서, 원본을 바꾸는 연산은 편한 만큼 조심해야 한다는 것도 알게 됐다.

---
