---
layout: single
title: "딥러닝 기초 정리 4 - 파이토치 DataLoader, CNN 학습 루프, 텍스트 토큰화와 정수 인코딩"
categories: [coding, DeepLearning]
tag: [study-log, DeepLearning, PyTorch, DataLoader, nn.Module, training-loop, NLP, tokenization, KoNLPy, stopwords]
toc: true
author_profile: false
sidebar:
    nav: "docs"
search: true
---
<hr/>

지난주에 파이토치 텐서와 Autograd를 따로따로 배웠다면, 오늘은 그걸 다 모아서 처음으로 파이토치 CNN을 처음부터 끝까지 만들었다. 데이터를 배치로 떠먹여 주는 `Dataset`과 `DataLoader`, `nn.Module`을 상속한 모델, 그리고 케라스 `fit()` 한 줄을 풀어 쓴 학습 루프까지 갔다. 오후에는 분야가 바뀌어서 텍스트 전처리를 시작했다. 문장을 토큰으로 자르고, 쓸모없는 단어를 버리고, 남은 단어에 번호를 매겨서 모델에 넣을 수 있는 숫자로 만드는 단계였다.

## Dataset과 DataLoader
케라스에서는 `model.fit(train_scaled, train_target, batch_size=32)`처럼 넘파이 배열을 통째로 주면 알아서 32개씩 잘라 썼다. 파이토치에는 `fit()`이 없어서 훈련 루프를 직접 써야 하고, 그 루프의 `for xb, yb in dataloader:` 자리를 채울 물건이 필요하다. 목적은 지난주의 `tf.data.Dataset`과 같다.

| 이름 | 하는 일 | 알아야 하는 것 |
|---|---|---|
| `Dataset` | 데이터 한 개를 꺼낸다 | "5번째 데이터 줘" |
| `DataLoader` | 여러 개를 묶고 섞는다 | "32개씩, 매번 섞어서" |

`Dataset`은 책장이고 `DataLoader`는 책을 뽑아 카트에 담아오는 사람이다. 책장은 몇 번째 칸에 뭐가 있는지만 알면 되고, 몇 권씩 나를지는 카트 담당이 정한다.

### transforms

```python
import torchvision.transforms as transforms

mnist_transform = transforms.Compose([
    transforms.ToTensor(),
    transforms.Normalize(mean=(0.5,), std=(1.0,))
])
```

`Compose`는 전처리를 순서대로 이어 붙인다. scikit-learn의 `Pipeline`과 같은 발상이다. `ToTensor()`는 한 줄인데 세 가지를 한다. `uint8`을 `float32`로 바꾸고, 차원 순서를 `(H, W, C)`에서 `(C, H, W)`로 바꾸고, 0~255를 0~1로 스케일링한다. 케라스에서 `reshape(-1, 28, 28, 1) / 255.0`으로 손으로 하던 일이 합쳐진 것이고, 파이토치가 채널을 먼저 쓴다는 것도 여기서 알아서 처리된다.

`Normalize`는 `x' = (x - mean) / std`다. `mean=0.5, std=1.0`이면 `x - 0.5`라서 0~1이 -0.5~0.5로 옮겨진다. 0 근처로 옮기면 가중치 업데이트가 균형 있게 일어나고 기울기 소실 위험도 줄어든다. 설명 셀에는 관례대로 `std=0.5`로 -1~1을 만드는 예가 있었는데, 실제 코드는 `std=1.0`이라 출력이 -0.5~0.5로 나왔다. 그리고 `mean=(0.5,)`의 끝 쉼표는 오타가 아니다. 채널마다 하나씩 주는 값이라 흑백이면 원소 1개짜리 튜플이고, 파이썬에서 `(0.5)`는 그냥 숫자다.

### 기본 제공 데이터셋

```python
from torchvision import datasets

trainset = datasets.MNIST(root='.', train=True, download=True, transform=mnist_transform)
testset = datasets.MNIST(root='.', train=False, download=True, transform=mnist_transform)

len(trainset), len(testset)                  # (60000, 10000)
trainset.data.shape                          # torch.Size([60000, 28, 28])
trainset.data.min(), trainset.data.max()     # tensor(0, dtype=torch.uint8) tensor(255, dtype=torch.uint8)
trainset.classes                             # ['0 - zero', '1 - one', ..., '9 - nine']
```

`train=True/False` 하나로 훈련과 테스트가 갈린다. `torchvision`은 이미지, `torchtext`는 텍스트, `torchaudio`는 오디오 데이터셋을 모아둔 패키지다. 레이블 이름까지 딸려 온다.

여기서 가장 중요한 관찰은 `transform`을 줬는데도 `trainset.data`가 여전히 `uint8`, 0~255라는 것이었다. transform은 저장할 때가 아니라 꺼낼 때 적용된다. 원본을 미리 다 변환해두면 6만 장 × float32만큼 메모리를 잡는데, 필요할 때만 변환하면 그 낭비가 없고 매번 다른 랜덤 변환(데이터 증강)도 할 수 있다. 그래서 `trainset.data[0]`은 원본이고, `trainset[0]`(`__getitem__` 호출)은 변환된 값이다. 디버깅할 때 `.data`를 보고 "왜 정규화가 안 됐지?" 하고 헤매기 쉬운 자리다.

### DataLoader로 배치 만들기

```python
train_loader = DataLoader(dataset=trainset, batch_size=32, shuffle=True, num_workers=2)
test_loader = DataLoader(dataset=testset, batch_size=32, shuffle=False)
len(train_loader), len(test_loader)     # (1875, 313)

images, labels = next(iter(train_loader))
print(images.shape, labels.shape)       # torch.Size([32, 1, 28, 28]) torch.Size([32])
images[0].min(), images[0].max()        # (tensor(-0.5000), tensor(0.5000))
```

훈련은 순서를 외우지 않게 매번 섞고, 평가는 섞을 이유가 없어서 `shuffle=False`다. `len()`은 데이터 개수가 아니라 배치 개수라 60000 / 32 = 1875다. `DataLoader`는 배치를 미리 만들어두지 않고 필요할 때 만들어서 `train_loader[0]` 같은 인덱싱이 안 되고, 한 배치만 보려면 `next(iter(...))`로 꺼낸다. 꺼낸 배치가 `(32, 1, 28, 28)`로 채널이 앞에 있고, 값이 -0.5~0.5로 변환돼 있었다. `num_workers`는 데이터 로딩에 쓸 프로세스 수인데, 데이터가 작으면 프로세스를 띄우는 비용 때문에 오히려 느려질 수 있고, Windows에서는 `if __name__ == '__main__':` 안에 넣어야 한다고 한다.

### 커스텀 Dataset

```python
x_train = torch.Tensor([1, 2, 3, 4, 5, 6]).view(6, 1)
y_train = torch.Tensor([3, 4, 5, 6, 7, 8]).view(6, 1)     # y = x + 2

class CustomDataset(Dataset):
    def __init__(self, x_train, y_train):
        self.x_train = x_train
        self.y_train = y_train

    def __getitem__(self, index):
        return self.x_train[index], self.y_train[index]

    def __len__(self):
        return self.x_train.shape[0]

dataset = CustomDataset(x_train, y_train)
len(dataset)      # 6
dataset[0]        # (tensor([1.]), tensor([3.]))

loader = DataLoader(dataset=dataset, batch_size=3, shuffle=True)
for x, y in loader:
    print(x, y)   # tensor([[1.], [2.], [5.]]) tensor([[3.], [4.], [7.]]) ...
```

내 데이터로 학습하려면 `__init__`, `__getitem__`, `__len__` 세 개만 구현하면 된다. `DataLoader`는 "몇 개 있어?"와 "3번째 거 줘" 두 가지만 물어본다. 데이터가 CSV에 있든 이미지 폴더에 있든 그 두 질문에 답할 수만 있으면 된다. `__getitem__`이 `(입력, 타깃)` 튜플을 돌려주면 `DataLoader`가 여러 개를 모아 자리별로 `stack`해서 `for x, y in loader:`로 받을 수 있게 해준다.

## 파이토치 CNN 모델 정의
케라스는 `Sequential([...])`에 층을 나열하기만 하면 크기 계산도 채널 연결도 알아서 했다. 파이토치는 `nn.Module`을 상속해서 클래스를 만드는 게 사실상 유일한 방법이라, 지난주에 배운 Subclassing 방식만 있다고 보면 된다. 대신 `forward()`가 그냥 파이썬 함수라 `if`나 `for`를 자유롭게 쓸 수 있다.

```python
DEVICE = torch.device("cuda") if torch.cuda.is_available() else torch.device("cpu")
generator = torch.Generator().manual_seed(42)
```

`torch.manual_seed(42)`는 전역을 고정하고, `Generator`는 독립된 난수 줄기를 만들어서 `random_split`이나 `DataLoader`에 넘기면 그것만 따로 재현된다.

### nn.Conv2d는 입력 채널을 직접 적는다

```python
keras.layers.Conv2D(filters=32, kernel_size=3)                 # 케라스
nn.Conv2d(in_channels=1, out_channels=32, kernel_size=3)       # 파이토치
```

케라스는 입력 채널을 알아서 알아냈는데 파이토치는 `in_channels`를 내가 적어야 한다. 그래서 층을 이어 붙일 때 앞 층의 `out_channels`를 다음 층의 `in_channels`로 손으로 물려줘야 하고, 틀리면 실행할 때 에러가 난다. 귀찮지만 크기 계산을 스스로 하게 만든다. `padding=1`은 3×3 커널에서 케라스의 `padding='same'`과 같다. `출력 = 입력 + 2×padding - 커널 + 1 = 28 + 2 - 3 + 1 = 28`이다.

### 데이터 준비 - random_split

```python
train_dataset = datasets.MNIST(root='MNIST_data/', train=True, download=True,
                               transform=transforms.ToTensor())
train_dataset_size = int(len(train_dataset) * 0.85)        # 51000
validation_dataset_size = int(len(train_dataset) * 0.15)   # 9000
train_dataset, validation_dataset = random_split(
    train_dataset, [train_dataset_size, validation_dataset_size], generator=generator)

BATCH_SIZE = 64
train_dataset_loader = DataLoader(dataset=train_dataset, batch_size=BATCH_SIZE,
                                  shuffle=True, generator=generator)
```

`random_split`이 `train_test_split` 자리를 대신하는데, 비율이 아니라 개수를 직접 적고 합이 전체와 정확히 맞아야 한다. 이번에는 51000 + 9000이 딱 맞았지만, `int()`로 잘려서 하나가 모자라면 `ValueError`가 난다. `val_size = len(train_dataset) - train_size`처럼 나머지를 계산해서 넣는 게 안전하다.

### __init__은 부품, forward는 순서

```python
class MyCNNModel(nn.Module):

    def __init__(self):
        super().__init__()
        self.conv1 = nn.Conv2d(in_channels=1, out_channels=32, kernel_size=3, padding=1)
        self.conv2 = nn.Conv2d(in_channels=32, out_channels=64, kernel_size=3, padding=1)
        self.pooling = nn.MaxPool2d(kernel_size=2, stride=2)
        self.fc1 = nn.Linear(in_features=7 * 7 * 64, out_features=256)
        self.fc2 = nn.Linear(in_features=256, out_features=10)
        self.dropout25 = nn.Dropout(p=0.25)
        self.dropout50 = nn.Dropout(p=0.5)

    def forward(self, data):
        data = self.conv1(data)
        data = torch.relu(data)
        data = self.pooling(data)
        data = self.dropout25(data)

        data = self.conv2(data)
        data = torch.relu(data)
        data = self.pooling(data)
        data = self.dropout25(data)

        data = data.view(-1, 7 * 7 * 64)

        data = self.fc1(data)
        data = torch.relu(data)
        data = self.dropout50(data)

        logits = self.fc2(data)
        return logits          # softmax 적용 전
```

`__init__`은 부품 상자이고 `forward`는 조립 설명서다. `__init__`은 딱 한 번 실행돼서 여기서 만든 층이 가중치를 갖고, `forward`는 배치마다 실행되니 여기서 층을 만들면 매번 새 가중치가 생겨 학습이 안 된다. 층은 반드시 `self.`로 저장해야 `nn.Module`이 "이게 내 파라미터다"라고 등록해서 옵티마이저가 찾을 수 있다. `super().__init__()`은 그 파라미터를 담아둘 내부 저장소를 만드는 줄이라, 빼먹으면 `cannot assign module before Module.__init__() call` 에러가 난다.

`nn.Linear`의 `in_features=7 * 7 * 64`는 직접 따라가서 계산해야 한다. (1, 28, 28)이 conv1(padding=1)로 (32, 28, 28), 풀링으로 (32, 14, 14), conv2로 (64, 14, 14), 풀링으로 (64, 7, 7)이 돼서 3,136이다. 케라스는 `Flatten()`이 알아서 계산했는데 파이토치는 `view(-1, 7 * 7 * 64)`에 숫자를 적어야 한다. `-1`은 배치 크기를 자동으로 계산해서, 51000 / 64의 마지막 배치처럼 64개가 안 되는 배치도 처리된다. 배치 크기를 64로 고정해서 적으면 마지막 배치에서 터진다.

ReLU는 배울 가중치가 없어서 `torch.relu()` 함수로 썼고, 드롭아웃은 `nn.Dropout` 층으로 만들었다. 드롭아웃은 훈련과 평가에서 동작이 달라야 해서 `model.train()`과 `model.eval()`이 켜고 끌 수 있는 층이어야 한다.

### 파라미터 확인

```python
model = MyCNNModel().to(DEVICE)

for name, child in model.named_children():
    print(name)
    total = 0
    for param_name, param in child.named_parameters():
        print('  ', param_name, param.numel(), param.data.shape)
        total += param.numel()
    total and print('  total:', f"{total:,}")
```

```
conv1  weight 288 torch.Size([32, 1, 3, 3])    bias 32     total: 320
conv2  weight 18432 torch.Size([64, 32, 3, 3])              total: 18,496
pooling                                                     (파라미터 없음)
fc1    weight 802816 torch.Size([256, 3136])                total: 803,072
fc2                                                         total: 2,570
```

모델도 `.to(DEVICE)`로 GPU에 올린다. 케라스 `summary()`를 직접 만든 셈인데, `total and print(...)`는 `total`이 0이면 뒤를 실행하지 않는 파이썬 `and`의 성질을 이용해서 파라미터가 없는 층에는 합계를 안 찍는 트릭이다. 숫자는 지난주에 배운 공식 그대로였다. 그런데 가중치 shape의 순서가 케라스와 반대였다. 케라스는 `(3, 3, 1, 32)`로 (커널 높이, 너비, 입력, 출력)인데 파이토치는 `[32, 1, 3, 3]`으로 출력이 먼저다. `nn.Linear`도 `(3136, 256)`으로 적지만 저장은 `[256, 3136]`이다.

### 손실 함수와 옵티마이저

```python
loss_function = nn.CrossEntropyLoss()
optimizer = torch.optim.Adam(model.parameters(), lr=1e-3)
```

`nn.CrossEntropyLoss` 안에 소프트맥스가 들어 있어서 모델은 로짓(소프트맥스 전의 값)을 돌려준다. 모델에서 소프트맥스를 또 하면 두 번 하는 셈이라 학습이 망가진다. 케라스에서 `Dense(10, activation='softmax')` + `sparse_categorical_crossentropy`를 쓰던 것과 정반대 관례라 처음에 헷갈렸다. 옵티마이저에 `model.parameters()`를 넘겨서 "이 파라미터들을 갱신해라"라고 명시하는 것도 케라스는 `compile()`이 알아서 하던 일이다.

## 학습 루프 - 케라스 fit()을 손으로 쓰기

```python
def model_train(dataloader, model, loss_function, optimizer):
    model.train()                                    # 드롭아웃 활성화

    train_loss_sum = train_correct = train_total = 0
    total_train_batch = len(dataloader)

    for images, labels in dataloader:
        x_train = images.to(DEVICE)                  # 데이터도 같은 장치로
        y_train = labels.to(DEVICE)

        outputs = model(x_train)                     # 순전파 (forward가 불린다)
        loss = loss_function(outputs, y_train)       # 손실 계산

        optimizer.zero_grad()                        # 기울기 초기화
        loss.backward()                              # 역전파
        optimizer.step()                             # 가중치 갱신

        train_loss_sum += loss.item()
        train_total += y_train.size(0)
        train_correct += (torch.argmax(outputs, dim=1) == y_train).sum().item()

    train_avg_loss = train_loss_sum / total_train_batch
    train_avg_accuracy = 100 * train_correct / train_total
    return train_avg_loss, train_avg_accuracy
```

지난주에 배운 것들이 전부 들어 있어서 새로 배우는 건 별로 없고 조립만 하는 셈이었다. 핵심은 `zero_grad() → backward() → step()` 순서다. 칠판을 지우고, 새로 계산해서 적고, 그 결과대로 움직인다. `zero_grad()`를 빼먹으면 기울기가 누적되고, `step()`을 `backward()` 앞에 두면 아직 계산 안 된 기울기로 움직인다. 수업 코드는 손실 계산 뒤에 `zero_grad()`를 뒀는데, 실무에서는 반복문 맨 앞에 두는 경우가 더 많다고 한다. `backward()` 전에만 있으면 되니 동작은 같다.

정확도 줄은 `torch.argmax(outputs, dim=1)`로 (64, 10)에서 샘플마다 예측 클래스를 뽑아 (64,)를 만들고, 정답과 비교한 True/False를 `.sum()`으로 세고, `.item()`으로 파이썬 정수로 꺼낸다. 케라스의 `metrics=['accuracy']`가 해주던 일이다.

평균을 낼 때 나누는 수가 둘인 것도 헷갈렸다. `loss.item()`은 이미 그 배치의 평균 손실이라(`CrossEntropyLoss`의 기본 `reduction='mean'`) 배치별 평균을 다시 평균 내려면 배치 개수로 나눈다. `train_correct`는 맞힌 개수를 누적한 것이라 전체 데이터 개수로 나눠야 비율이 된다.

### 평가 함수는 두 군데만 다르다

```python
def model_evaluate(dataloader, model, loss_function, optimizer):
    model.eval()                     # 드롭아웃 비활성화
    with torch.no_grad():            # 기울기 계산 비활성화
        for images, labels in dataloader:
            ...
            outputs = model(x_val)
            loss = loss_function(outputs, y_val)
            # zero_grad / backward / step이 없다
            ...
```

| 구분 | 훈련 | 평가 |
|---|---|---|
| 모드 | `model.train()` | `model.eval()` |
| 기울기 | 추적한다 | `with torch.no_grad():` |
| 갱신 | `zero_grad / backward / step` | 없음 |

`model.eval()`은 드롭아웃을 끄고 `torch.no_grad()`는 기울기 추적을 꺼서 하는 일이 다르다. `eval()`을 빼먹으면 같은 이미지를 두 번 예측해도 결과가 다르게 나오는데 에러가 안 나서 찾기 어렵다. 훈련 함수 첫 줄에 `model.train()`을 넣어둬서 평가 뒤에 다시 훈련 모드로 돌아가는 것도 자동으로 해결된다. 평가 함수가 쓰지도 않는 `optimizer`를 받는 건 훈련 함수와 인자를 맞추려고 한 것 같다.

### 에포크 루프와 결과

```python
def train(model, epochs, train_loader, validation_loader, loss_function, optimizer):
    train_loss_list, train_accuracy_list = [], []
    val_loss_list, val_accuracy_list = [], []
    start_time = datetime.now()

    for epoch in range(epochs):
        train_avg_loss, train_avg_accuracy = model_train(train_loader, model, loss_function, optimizer)
        val_avg_loss, val_avg_accuracy = model_evaluate(validation_loader, model, loss_function, optimizer)
        train_loss_list.append(train_avg_loss)
        ...
        print('epochs:', '%02d' % (epoch + 1), 'train loss =', ...)

    print('elapsed time => ', datetime.now() - start_time)
    return train_loss_list, train_accuracy_list, val_loss_list, val_accuracy_list
```

이 함수가 케라스 `fit()`의 정체였다. 에포크마다 훈련 한 번, 평가 한 번을 하고, 결과를 리스트에 쌓고(케라스의 `history`), 진행 상황을 출력한다.

```
epochs: 01 train loss = 0.3025 train acc = 90.4314 val loss = 0.0708 val acc = 97.8333
epochs: 08 train loss = 0.0426 train acc = 98.6490 val loss = 0.0320 val acc = 99.1000
epochs: 13 train loss = 0.0295 train acc = 99.0706 val loss = 0.0280 val acc = 99.2556  ← val loss 최저
epochs: 20 train loss = 0.0208 train acc = 99.3314 val loss = 0.0326 val acc = 99.2111
elapsed time =>  0:03:32.049311
```

훈련 손실은 계속 내려가는데 검증 손실은 13번째에서 바닥을 찍고 올라갔다. 지난주에 본 과대적합 그림 그대로다. 그런데 파이토치에는 콜백 개념이 없어서 조기 종료 없이 20번을 다 돌았다. 직접 하려면 `best_val_loss`를 들고 있다가 좋아지면 `torch.save()`로 저장하고, 안 좋아지면 카운터를 올려서 `patience`를 넘으면 `break`하는 코드를 써야 한다. 케라스 콜백 두 개가 얼마나 많은 걸 대신해줬는지 알 것 같았다.

### 저장과 복원

```python
torch.save(model.state_dict(), save_path)       # 가중치만 저장

model = MyCNNModel().to(DEVICE)                  # 껍데기를 먼저 만들고
model.load_state_dict(torch.load(save_path))     # 숫자를 붓는다
# <All keys matched successfully>

model_test(test_dataset_loader, model)           # accuracy: 99.29
```

`state_dict()`는 가중치만 담은 딕셔너리라 구조는 안 들어 있다. 케라스의 `save_weights()`에 해당하는데, 파이토치에서는 이쪽이 표준이다. 그래서 모델 클래스가 코드에 있어야만 불러올 수 있다. `All keys matched successfully`는 저장된 키와 모델의 층 이름이 전부 맞았다는 뜻이다. 최신 파이토치는 `torch.load`에 `weights_only=False` 경고를 내는데, pickle 보안 문제 때문이라 `weights_only=True`를 붙이면 된다. 확장자 `.pth`와 `.pt`는 아무 차이 없는 관례다. 테스트 99.29%로 FashionMNIST(0.92)보다 MNIST가 훨씬 쉽다는 것도 보였다.

### 실제 이미지 예측

```python
def predict(file_path):
    img = Image.open(file_path)
    mono8img = img.convert('L')
    invImg = ops.invert(mono8img)

    transform = transforms.Compose([
        transforms.Resize((28, 28)),
        transforms.ToTensor(),
    ])
    img_tensor = transform(invImg).unsqueeze(0)      # (1, 1, 28, 28)

    model.to(DEVICE)
    img_tensor = img_tensor.to(DEVICE)

    with torch.no_grad():
        logits = model(img_tensor)
        probs = torch.softmax(logits, dim=1)         # 확률은 여기서
        predicted_class = torch.argmax(probs, dim=1).item()
    print(f"예측된 숫자: {predicted_class} - {classes[predicted_class]}")
```

MNIST도 검은 배경에 흰 숫자라 FashionMNIST처럼 반전이 필요하다. `ToTensor()`가 스케일링과 차원 변환을 대신하고, `unsqueeze(0)`로 배치 차원을 붙인다. 모델이 로짓을 돌려주니까 확률이 보고 싶으면 예측할 때 직접 소프트맥스를 씌운다. 손글씨 3장을 넣어서 3장 다 맞혔다. 훈련 때 `Normalize`를 안 썼으니 예측할 때도 안 쓴 게 맞다. 한쪽만 켜면 조용히 틀린다. 다만 이 함수는 출력만 하고 값을 `return`하지 않아서, 웹 서비스에 붙이려면 반환값이 필요하다.

| 케라스 | 파이토치 |
|---|---|
| `Sequential([...])` | `class Model(nn.Module)` + `__init__` + `forward` |
| `Dense(10, activation='softmax')` + `sparse_categorical_crossentropy` | 로짓 출력 + `nn.CrossEntropyLoss()` |
| `compile(optimizer='adam')` | `torch.optim.Adam(model.parameters())` |
| `fit()` | `zero_grad → forward → loss → backward → step` 루프 |
| `history` | 직접 만든 리스트 |
| `EarlyStopping` | 직접 구현 |
| `save_weights()` | `torch.save(model.state_dict())` |

## 텍스트 전처리 - 토큰화
지금까지 다룬 데이터는 전부 숫자였다. 글자는 모델에 못 넣는다. 지난주 외국어 판별에서는 알파벳 26개의 빈도를 세는 것으로 우회했는데, 이제 제대로 다룬다. 텍스트를 숫자로 바꾸는 첫 단계가 **토큰화**다.

```
"Don't be fooled..."  →  ['Do', "n't", 'be', 'fooled', ...]  →  [12, 87, 3, 451, ...]
                          토큰화                                정수 인코딩
```

사람의 말을 컴퓨터가 다루게 하는 분야가 NLP(자연어 처리)이고, 분석하려고 모아둔 텍스트 덩어리를 코퍼스(말뭉치)라고 한다. 데이터셋의 텍스트 버전이다.

### 같은 문장, 다른 답

```python
sentence = "Don't be fooled by the dark sounding name, Mr. Jone's Orphanage is as cheery as cheery goes for a pastry shop."

word_tokenize(sentence)
# ['Do', "n't", 'be', ..., 'Mr.', 'Jone', "'s", 'Orphanage', ...]
WordPunctTokenizer().tokenize(sentence)
# ['Don', "'", 't', 'be', ..., 'Mr', '.', 'Jone', "'", 's', ...]
text_to_word_sequence(sentence)          # 케라스
# ["don't", 'be', ..., 'mr', "jone's", 'orphanage', ...]
```

| 도구 | `Don't` | `Mr.` | `Jone's` |
|---|---|---|---|
| `word_tokenize` | Do + n't | Mr. 유지 | Jone + 's |
| `WordPunctTokenizer` | Don + ' + t | Mr + . | Jone + ' + s |
| `text_to_word_sequence` | don't 유지 | mr | jone's 유지 |

`Don't`를 어떻게 자를지가 문제의 전부였다. `WordPunctTokenizer`는 이름 그대로 단어와 구두점을 무조건 분리하고, 케라스의 `text_to_word_sequence`는 소문자화, 구두점 제거, 공백 기준 분리를 한다. 아포스트로피는 구두점 목록에 없어서 `don't`가 살아남는다.

케라스와 비슷하게 정규식으로 직접 만들어봤는데 `name,`과 `mr.`에 구두점이 남았다. 정규식 문자 클래스 `[...+,-./...]` 안에서 `-`가 `,`부터 `.`까지의 범위로 해석돼서 정작 `,`, `-`, `.`를 제대로 못 지운 것이다. `-`는 맨 앞이나 맨 뒤에 두거나 `\-`로 이스케이프해야 한다. 직접 만들면 이런 함정이 있어서 검증된 도구를 쓴다.

```python
from transformers import AutoTokenizer
tokenizer = AutoTokenizer.from_pretrained("bert-base-uncased")
tokenizer.tokenize(sentence)
# ['don', "'", 't', ..., 'jon', '##e', "'", 's', 'orphanage', 'is', 'as',
#  'cheer', '##y', 'as', 'cheer', '##y', 'goes', ...]
```

BERT 토크나이저는 `cheery`를 `cheer` + `##y`로 쪼갰다. `##`은 앞 조각에 붙는다는 표시다. 단어를 통째로 외우는 대신 자주 나오는 조각으로 쪼개는 **서브워드 토큰화**라서, 사전에 없는 단어도 아는 조각으로 표현할 수 있고 사전 크기도 줄어든다. 요즘 LLM이 "토큰 몇 개"라고 셀 때 그 토큰이 이것이다. `uncased`는 대소문자를 구분하지 않는다는 뜻이라 결과가 전부 소문자다.

### 토큰화가 어려운 이유
`m.p.h`, `Ph.D`, `AT&T`처럼 단어 자체에 구두점이 있거나, `$45.55`, `01/02/06`처럼 특수문자가 의미를 갖는 경우가 있어서 구두점을 함부로 못 지운다. `we're`는 we are로 풀어야 하고, `New York`이나 `rock 'n' roll`은 띄어쓰기가 있어도 한 단어다. 표준 규칙인 Penn Treebank는 하이픈으로 된 단어는 하나로 유지하고, `doesn't`처럼 아포스트로피로 붙은 건 분리한다. `TreebankWordTokenizer`로 해보니 `home-based`는 붙어 있고 `doesn't`는 `does` + `n't`로 갈렸다.

문장 단위로 자를 때는 마침표가 문제다. `!`와 `?`는 명확한 경계인데, 마침표는 IP 주소(192.168.56.31), 이메일, `Ph.D.`에도 들어간다.

```python
from nltk.tokenize import sent_tokenize
sent_tokenize("I am actively looking for Ph.D. students. and you are a Ph.D student.")
# ['I am actively looking for Ph.D. students.', 'and you are a Ph.D student.']
```

`Ph.D.`의 마침표는 넘어가고 `students.`에서만 잘랐다. NLTK는 코드와 데이터가 분리돼 있어서 `nltk.download('punkt')`처럼 규칙과 모델 파일을 따로 받아야 하고, 안 받으면 `LookupError: Resource punkt not found`가 난다. 영어 품사 태깅에는 최신 버전에서 `averaged_perceptron_tagger_eng`처럼 `_eng`가 붙은 걸 받아야 한다.

### 품사 태깅

```python
from nltk.tag import pos_tag
pos_tag(word_tokenize("I am actively looking for Ph.D. students."))
# [('I', 'PRP'), ('am', 'VBP'), ('actively', 'RB'), ('looking', 'VBG'),
#  ('for', 'IN'), ('Ph.D.', 'NNP'), ('students', 'NNS'), ...]
```

'fly'가 명사면 파리, 동사면 날다이고, '못'이 명사면 못 박는 못, 부사면 못 한다의 못이다. 글자만 봐서는 뜻을 알 수 없어서 품사를 붙인다. Penn Treebank 태그를 다 외울 필요는 없고 `NN`으로 시작하면 명사, `VB`로 시작하면 동사 정도면 읽힌다.

### 한국어는 형태소 단위로
한국어는 조사와 어미를 붙여서 말을 만드는 교착어다. 영어의 'he'가 he/him 정도인데 한국어는 '그가', '그에게', '그를', '그는'처럼 다양한 조사가 붙는다. 띄어쓰기로 자르면 이것들이 전부 다른 단어가 돼서 사전이 커지고 모델은 셋이 관계있다는 걸 모른다. 그래서 뜻을 가진 가장 작은 단위인 **형태소**로 쪼갠다. "에디가 책을 읽었다"는 띄어쓰기로는 `['에디가', '책을', '읽었다']`이지만, 형태소로는 자립 형태소 '에디', '책'과 의존 형태소 '-가', '-을', '읽-', '-었', '-다'로 나뉜다. 그리고 한국어는 "제가이렇게띄어쓰기를전혀하지않고글을썼다고하더라도" 붙여 써도 읽혀서 띄어쓰기가 잘 안 지켜지는 편이라 단서로 의존하기도 어렵다.

```python
from konlpy.tag import Okt, Kkma
okt = Okt()
kkma = Kkma()

okt.morphs(text)    # 형태소로 쪼갠다
okt.pos(text)       # 쪼개고 품사를 붙인다
okt.nouns(text)     # 명사만 뽑는다
```

KoNLPy는 Okt, Mecab, Komoran, Hannanum, Kkma 다섯 가지 분석기를 제공한다. 사람 이름과 '화이팅'이 들어간 문장을 Okt와 Kkma로 나눠봤더니 결과가 달랐다. 사전에 없는 사람 이름을 Okt는 이름 + 조사 '이'로 그럴듯하게 잘랐는데, Kkma는 이름을 한 글자와 나머지로 쪼갰다. '화이팅'도 Okt는 한 단어로 뒀고 Kkma는 '화이' + '팅'으로 나눴다. Kkma는 애매할 때 후보를 여러 개 내는 성향이라 `nouns()`에 조각들을 전부 넣었다. 형태소 분석기도 사전에 없는 말에서 특히 답이 갈린다. 실전에서는 조사와 어미를 버리고 의미를 담은 명사만 남기는 `.nouns()`를 키워드 추출이나 문서 분류에 많이 쓴다고 한다.

KoNLPy 분석기들은 자바로 만들어져 있어서 `JPype1`로 연결하고, 로컬에서는 JDK와 `JAVA_HOME` 설정이 필요하다. Colab에는 이미 깔려 있다. 속도가 필요하면 Okt나 Mecab, 정확도가 필요하면 Kkma나 Komoran이고, Kkma는 객체를 만드는 데만 몇 초가 걸렸다.

결국 토큰화에는 정답이 없다. 검색 엔진이라면 `don't`를 do + not으로 풀어야 검색이 잘 되고, 감성 분석이라면 통째로 두는 게 부정 표현을 잡기 좋고, LLM은 서브워드로 잘게 쪼개야 사전이 작아진다. 하려는 일이 도구를 정한다.

## 정제, 불용어, 정수 인코딩
토큰으로 쪼갠 뒤에도 아직 두 가지가 남았다. `is`, `an`, `.` 같은 쓸모없는 토큰이 섞여 있고, 여전히 글자다.

### 정규화와 불용어
USA와 US, uh-huh와 uhhuh처럼 표기는 달라도 뜻이 같으면 모델은 다른 단어로 본다. 그래서 하나로 합치는데, 대소문자 통합이 가장 흔하다. Ferrari와 ferrari는 같은 검색 결과를 보여줘야 하니 합치는 게 맞지만, US(미국)와 us(우리)는 구분해야 하고 회사 이름이나 사람 이름은 대문자를 유지하기도 한다. BERT에 `uncased`와 `cased`가 따로 있는 이유다.

**불용어(stopword)**는 I, my, me 같은 단어처럼 자주 등장하지만 의미 분석에는 거의 기여하지 않는 단어다. "the, a, is"를 지워도 무슨 얘긴지 알 수 있고, 오히려 너무 자주 나와서 중요한 단어를 가린다. NLTK에는 영어 불용어 198개가 정의돼 있다.

```python
example = "Family is not an important thing. It's everything."
stop_words = set(stopwords.words('english'))
word_tokens = word_tokenize(example)
result = [word for word in word_tokens if word not in stop_words]
# 제거 전: ['Family', 'is', 'not', 'an', 'important', 'thing', '.', 'It', "'s", 'everything', '.']
# 제거 후: ['Family', 'important', 'thing', '.', 'It', "'s", 'everything', '.']
```

`is`, `not`, `an`은 지워졌는데 `It`이 남았다. 불용어 목록에는 소문자 `it`만 있어서 대문자 `It`은 안 걸린다. 소문자화를 먼저 해야 한다. 목록을 `set()`으로 감싼 건 리스트에서 `in`을 하면 198개를 처음부터 훑지만 `set`은 한 번에 찾기 때문이다.

한국어는 NLTK 같은 표준 목록이 없어서 직접 만들었다.

```python
example = "고기를 아무렇게나 구우려고 하면 안 돼. 고기라고 다 같은 게 아니거든. ..."
stop_words = set("를 아무렇게나 구 우려 고 안 돼 같은 게 구울 때 는".split())
result = [word for word in okt.morphs(example) if not word in stop_words]
# ['고기', '하면', '.', '고기', '라고', '다', '아니거든', '.', '예컨대', '삼겹살', '을', '중요한', '있지', '.']
```

목록을 보면 '구우려고'를 Okt가 '구' / '우려' / '고'로 쪼갠 것에 맞춰 적었다. 그래서 불용어 목록은 분석기에 종속되고, Kkma로 바꾸면 안 맞는다. 목록에 안 넣은 '을', '다', '라고'는 여전히 남아서 절대적인 기준은 아니다. 불용어가 많으면 txt나 csv 파일로 정리해서 불러 쓴다고 한다.

### 전처리 파이프라인

```python
raw_text = "A barber is a person. a barber is good person. ..."
sentences = sent_tokenize(raw_text)

vocab = {}
preprocessed_sentences = []
stop_words = set(stopwords.words('english'))

for sentence in sentences:
    result = []
    for word in word_tokenize(sentence):
        word = word.lower()                   # 소문자화
        if word not in stop_words:            # 불용어 제거
            if len(word) > 2:                 # 길이 2 이하 제거
                result.append(word)
                vocab[word] = vocab.get(word, 0) + 1
    preprocessed_sentences.append(result)

# [['barber', 'person'], ['barber', 'good', 'person'], ...,
#  ['keeping', 'keeping', 'huge', 'secret', 'driving', 'barber', 'crazy'], ...]
# vocab: {'barber': 8, 'person': 3, 'good': 1, 'huge': 5, 'secret': 6, 'kept': 4, ...}
```

세 조건이 순서대로 겹쳐 있다. 소문자화를 먼저 해서 `It`도 불용어로 걸리고, 길이 조건이 `.` 같은 구두점까지 같이 걸러낸다. 불용어 목록에는 구두점이 없으니 길이 조건이 그 역할을 겸한다. 다만 길이 조건은 US, AI 같은 두 글자 약어도 같이 날려서 거친 방법이다. 예제 문장이 같은 단어를 반복하는 어색한 문장인 건 빈도 차이가 뚜렷해야 빈도순 정렬을 보여줄 수 있기 때문이다.

### 정수 인코딩

```python
vocab_sorted = sorted(vocab.items(), key=lambda x: x[1], reverse=True)
# [('barber', 8), ('secret', 6), ('huge', 5), ('kept', 4), ('person', 3), ...]

word_to_index = {}
idx = 0
for word, freq in vocab_sorted:
    if freq > 1:              # 빈도 1인 단어는 제외
        idx += 1
        word_to_index[word] = idx
# {'barber': 1, 'secret': 2, 'huge': 3, 'kept': 4, 'person': 5, 'word': 6, 'keeping': 7}

vocab_size = 5
word_to_index = dict(list(word_to_index.items())[:vocab_size])
# {'barber': 1, 'secret': 2, 'huge': 3, 'kept': 4, 'person': 5}
```

`key=lambda x: x[1]`은 (단어, 빈도) 튜플의 빈도를 기준으로 정렬하라는 뜻이다. 빈도가 높은 단어에 낮은 번호를 주는 이유는 다음 단계에서 보였다. 앞에서 5개만 잘라 쓰면 자동으로 자주 쓰는 단어만 남는다. 실무 사전은 수만 개라 상위 N개만 쓰는 게 표준이고, 그러려면 빈도순 정렬이 필수다. 딕셔너리는 슬라이싱이 안 돼서 리스트로 바꿔 자른 다음 다시 딕셔너리로 만들었고, 파이썬 3.7부터 딕셔너리가 입력 순서를 유지해서 가능한 방법이다. 빈도 1인 단어를 버린 건 한 번 보고 배울 게 없고 오타나 고유명사인 경우가 많아서인데, 짧은 문서에서는 `good`, `knew`, `crazy`까지 사라져서 가혹할 수 있다.

번호를 1부터 주는 건 0을 비워두기 위해서다. 0은 문장 길이를 맞추려고 채우는 패딩에 쓴다.

### OOV - 사전에 없는 단어

```python
word_to_index['OOV'] = len(word_to_index) + 1   # 6

encoded_sentences = []
for sentence in preprocessed_sentences:
    encoded_sentence = []
    for word in sentence:
        try:
            encoded_sentence.append(word_to_index[word])
        except KeyError:
            encoded_sentence.append(word_to_index['OOV'])
    encoded_sentences.append(encoded_sentence)
```

```
[1, 5]                   A barber is a person.
[1, 6, 5]                a barber is good person.          ← good이 OOV
[6, 2]                   he Knew A Secret!                 ← knew가 OOV
[2, 4, 3, 2]             The Secret He Kept is huge secret.
[6, 6, 3, 2, 6, 1, 6]    But keeping and keeping such a huge secret ... crazy.
```

사전을 5개로 자르니 사전 밖 단어(OOV, Out-Of-Vocabulary)가 생겼다. 모르는 단어를 전부 6번 하나로 몰아넣었더니, 마지막 문장은 7개 토큰 중 5개가 6이 돼서 `keeping`, `driving`, `crazy`의 구분이 사라졌다. 사전을 작게 자를수록 정보를 많이 잃으니 `vocab_size`도 거래가 걸린 하이퍼파라미터다. 그리고 결과를 보면 문장마다 길이가 2개, 7개로 제각각이다. 모델은 길이가 같은 입력을 원하니 다음 단계가 패딩이다.

## 헷갈리기 쉬운 부분
- `transform`은 꺼낼 때 적용된다. `trainset.data`는 원본, `trainset[0]`은 변환된 값이다.
- `ToTensor()`는 float32 변환, (H, W, C) → (C, H, W), 0~255 → 0~1을 한 번에 한다.
- 커스텀 Dataset은 `__getitem__`(입력, 타깃 튜플)과 `__len__`만 있으면 된다.
- `len(loader)`는 배치 개수다. `DataLoader`는 인덱싱이 안 돼서 `next(iter(loader))`로 꺼낸다.
- `random_split`은 개수의 합이 전체와 정확히 맞아야 한다.
- 파이토치 `nn.Conv2d`는 `in_channels`, `nn.Linear`는 `in_features`를 직접 적는다. `padding=1`이 3×3의 same이다.
- 층은 `__init__`에서 `self.`로 만들고 `forward`에서 연결한다. `super().__init__()`을 먼저 부른다.
- 파이토치 가중치 shape은 출력이 먼저다. `[32, 1, 3, 3]`, `[256, 3136]`.
- 모델은 로짓을 돌려준다. `nn.CrossEntropyLoss`에 소프트맥스가 들어 있다.
- 훈련 루프는 `zero_grad → forward → loss → backward → step`이다. 평가는 `model.eval()` + `torch.no_grad()`.
- 손실은 배치 개수로, 정확도는 데이터 개수로 나눠 평균 낸다.
- `state_dict()`는 가중치만 저장한다. 불러오려면 모델 클래스가 필요하다.
- 토큰화에는 정답이 없다. 하려는 일이 도구를 정한다.
- 한국어는 띄어쓰기가 아니라 형태소로 자른다. 분석기마다 결과가 다르다.
- 소문자화가 불용어 제거보다 먼저다. 한국어 불용어 목록은 분석기에 종속된다.
- 정수 인코딩은 빈도 높은 단어에 낮은 번호를 1부터 준다. 0은 패딩 자리다. 사전을 자르면 OOV가 생긴다.

## 오늘 배운 내용 정리
오늘은 파이토치로 CNN을 처음부터 끝까지 만들고, 텍스트를 숫자로 바꾸는 전처리를 시작했다.

```
Dataset / DataLoader: transforms.Compose([ToTensor(), Normalize()]) → datasets.MNIST → DataLoader(batch, shuffle).
커스텀 Dataset: __init__, __getitem__ → (x, y), __len__.
모델: nn.Module 상속. __init__(부품, self.) + forward(순서). in_channels, in_features 직접. 로짓 출력.
학습: CrossEntropyLoss + Adam(model.parameters()). zero_grad → forward → loss → backward → step.
평가: model.eval() + no_grad(). 조기 종료는 직접 구현. 저장은 state_dict(). 테스트 99.29%.
토큰화: word_tokenize / WordPunctTokenizer / text_to_word_sequence / BERT 서브워드. sent_tokenize.
한국어: 교착어 → 형태소. KoNLPy Okt(morphs, pos, nouns), Kkma.
정제: 소문자화 → 불용어 제거 → 짧은 단어 제거 → 빈도 세기.
정수 인코딩: 빈도순 정렬 → 1부터 번호 → 상위 N개 → 나머지는 OOV.
```

케라스의 `fit()` 한 줄이 파이토치에서는 함수 세 개로 흩어지는 걸 직접 써보니, 지금까지 케라스가 얼마나 많은 걸 대신해줬는지 알게 됐다. 모드 전환, 기울기 초기화, 평균 계산, 조기 종료까지 다 내 손으로 챙겨야 했다. 그리고 같은 문장을 도구 다섯 개로 잘랐더니 결과가 다섯 개로 나온 게 기억에 남는다. 지금까지는 점수가 높으면 좋은 거였는데, 텍스트에서는 무엇을 하려는지부터 정해야 도구를 고를 수 있었다.

---
