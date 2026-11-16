---
layout: single
title: "딥러닝 기초 정리 7 - LSTM 주가 예측, Seq2Seq, 어텐션, 트랜스포머, BERT 전이학습"
categories: [coding, DeepLearning]
tag: [study-log, DeepLearning, PyTorch, LSTM, time-series, Seq2Seq, Attention, Transformer, BERT, transfer-learning]
toc: true
author_profile: false
sidebar:
    nav: "docs"
search: true
---
<hr/>

오늘은 하루에 너무 많은 게 지나갔다. 오전에는 파이토치 LSTM으로 삼성전자 주가를 예측하면서 표로 된 데이터를 시퀀스로 오려내는 법을 배웠다. 그다음부터는 거의 이론이었다. 길이가 다른 문장을 번역하는 Seq2Seq, 그 병목을 푼 어텐션, RNN을 아예 버리고 어텐션만으로 지은 트랜스포머까지 한 번에 갔고, 마지막에 트랜스포머의 인코더만 쌓은 한국어 BERT를 내려받아 영화 리뷰 분류기로 미세조정했다. 지금 쓰는 LLM이 어디서 왔는지가 오늘 하루에 다 들어 있었다.

## LSTM으로 주가 예측하기
지금까지 다룬 IMDB 리뷰나 NER 데이터는 처음부터 문장 단위로 나뉘어 있어서 한 줄이 한 샘플이었다. 그런데 주가 데이터는 1,225줄짜리 표 하나다. 한 줄을 한 샘플로 보면 하루치 정보만 보고 다음 날을 맞추라는 뜻이라 RNN을 쓸 이유가 없다. 그래서 오늘의 진짜 주제는 LSTM이 아니라 연속된 표에서 샘플을 어떻게 오려내느냐였다.

"지난 5일치를 보고 다음 날 종가를 맞춘다"를 데이터로 만들려면 창문을 한 칸씩 밀면서 오려낸다. 1~5일이 입력이고 6일 종가가 정답, 한 칸 밀어서 2~6일이 입력이고 7일 종가가 정답인 식이다. 이걸 **슬라이딩 윈도우**라고 한다.

### 데이터와 분리

```python
import FinanceDataReader as fdr
df = fdr.DataReader('005930', '2021-01-01', '2025-12-31')   # 삼성전자
df = df[['Open', 'High', 'Low', 'Volume', 'Close']]

SPLIT = int(len(df) * 0.7)
train_df = df[:SPLIT]   # 2021-01-04 ~ 2024-06-25 (857일)
test_df = df[SPLIT:]    # 2024-06-26 ~ 2025-12-30 (368일)
```

`Close`를 일부러 맨 뒤로 보냈다. 뒤에 나올 함수가 맨 뒤 컬럼을 정답, 나머지를 입력으로 쓰기 때문이다. 그리고 `train_test_split`으로 섞지 않고 날짜 순서대로 앞뒤로 잘랐다. 2025년 데이터로 훈련하고 2022년을 맞추라고 하면 시험 문제를 미리 보여준 셈이다. 우리가 원하는 건 과거만 보고 미래를 맞추는 능력이라 시험지도 미래여야 한다.

### 스케일러를 두 개 만드는 이유

```python
scaler_x = MinMaxScaler()
train_x_scaled = scaler_x.fit_transform(train_df[feature_cols])   # Open, High, Low, Volume
test_x_scaled = scaler_x.transform(test_df[feature_cols])

scaler_y = MinMaxScaler()
train_y_scaled = scaler_y.fit_transform(train_df[[label_col]])    # Close
test_y_scaled = scaler_y.transform(test_df[[label_col]])
```

모델이 내놓는 예측은 0.63 같은 스케일된 숫자라서 사람이 보려면 원 단위로 되돌려야 한다. 스케일러 하나로 5개 컬럼을 한꺼번에 변환했다면 `inverse_transform`이 5개 컬럼짜리 입력을 요구하는데 예측값은 종가 1개뿐이다. 그래서 정답 컬럼만 기억하는 자를 따로 둔다. 테스트에는 당연히 `transform`만 쓴다.

`test_df`를 스케일링한 결과를 보니 최솟값 -0.055, 최댓값 1.765로 0~1을 벗어났다. 버그가 아니다. 스케일러는 훈련 기간의 최고가와 최저가만 외웠고 테스트 기간에 주가가 그보다 더 올랐으니 1을 넘는 게 당연하다. 오히려 0~1 안에 딱 들어왔다면 테스트 데이터로 `fit`을 한 거라 그게 진짜 버그다.

### 시퀀스로 오려내기

```python
def make_sequence_data(data, seq_length):
    x_seq_list, y_seq_list = [], []
    for i in range(len(data) - seq_length):
        x_seq_list.append(data[i:i + seq_length, :-1])   # i일부터 5일치, 맨 뒤 컬럼 빼고
        y_seq_list.append(data[i + seq_length, [-1]])    # 그다음 날의 종가
    return np.array(x_seq_list), np.array(y_seq_list)

x_train_data, y_train_data = make_sequence_data(train_data, SEQ_LENGTH)
print(x_train_data.shape, y_train_data.shape)   # (852, 5, 4) (852, 1)
```

`i`를 창문의 왼쪽 끝이라고 보면 읽힌다. `range(len(data) - seq_length)`에서 빼는 이유는 마지막 창문의 정답 자리가 표 밖으로 나가지 않게 하려는 것이라, 샘플 수는 항상 `857 - 5 = 852`처럼 줄 수보다 5개 적다. (852, 5, 4)는 샘플 852개, 각각 5일치, 하루에 숫자 4개로 RNN이 요구하는 `(batch, seq_len, features)` 모양이다.

`[-1]`에 대괄호를 씌운 게 중요했다. `data[i+5, -1]`이면 스칼라가 나와서 `y`가 (852,)가 되고, `[-1]`이면 (852, 1)이 된다. 모델 출력이 (batch, 1)인데 정답이 (852,)면 파이토치가 브로드캐스팅을 해버려서 에러 없이 엉뚱한 손실이 계산된다. 가장 잡기 어려운 종류의 버그라고 한다.

```python
x_train_tensor = torch.FloatTensor(x_train_data).to(DEVICE)
y_train_tensor = torch.FloatTensor(y_train_data).to(DEVICE)
train_dataset = TensorDataset(x_train_tensor, y_train_tensor)
train_loader = DataLoader(dataset=train_dataset, batch_size=BATCH_SIZE, shuffle=False)
```

`TensorDataset`은 지난주에 직접 만든 커스텀 Dataset을 미리 만들어둔 것이라, 텐서 두 개를 주면 `__len__`과 `__getitem__`을 알아서 구현해준다. 넘파이 기본이 `float64`라 `FloatTensor`로 바꿔야 `expected Float but found Double` 에러가 안 난다.

### 모델

```python
class MyLSTMModel(nn.Module):
    def __init__(self, input_size, hidden_size, num_layers):
        super().__init__()
        self.num_layers = num_layers
        self.hidden_size = hidden_size
        self.lstm = nn.LSTM(input_size, hidden_size, num_layers, batch_first=True)
        self.fc = nn.Linear(hidden_size, 1)

    def forward(self, data):
        h0 = torch.zeros(self.num_layers, data.size(0), self.hidden_size).to(DEVICE)
        c0 = torch.zeros(self.num_layers, data.size(0), self.hidden_size).to(DEVICE)
        outputs, _ = self.lstm(data, (h0, c0))     # (batch, 5, hidden)
        last_hs = outputs[:, -1, :]                # (batch, hidden) 마지막 날만
        return self.fc(last_hs)                    # (batch, 1)
```

`batch_first=True`를 반드시 챙겨야 한다. 파이토치 `nn.LSTM`의 기본값은 `False`라 입력을 `(seq_len, batch, features)`로 기대하는데, 빠뜨리면 에러 없이 배치 축과 시간 축이 뒤바뀐 채 학습된다. 케라스에는 없던 함정이다.

LSTM은 하루씩 읽으면서 은닉 상태를 갱신해서, 5일째의 은닉 상태가 1~5일을 다 읽은 뒤의 요약이다. 그래서 `outputs[:, -1, :]`로 마지막 것만 꺼낸다. 어제 케라스에서 `return_sequences=False`가 마지막 것만 골라줬다면, 파이토치는 항상 전부 주고 내가 직접 골라낸다. 골라내는 코드가 곧 그 옵션이다. `h0`, `c0`는 생략하면 파이토치가 알아서 0으로 채우는데, 무슨 일이 일어나는지 보이게 명시한 것이다. 명시할 때 `data.size(0)`으로 배치 크기를 매번 읽는 건 마지막 배치 크기가 다를 수 있어서다. 파라미터를 세어보니 LSTM 160개, Linear 5개로 전부 합쳐 165개뿐이었다.

### 훈련과 예측

```python
model = MyLSTMModel(FEATURE_NUMS, HIDDEN_SIZE, NUM_LAYERS).to(DEVICE)
loss_function = nn.MSELoss()
optimizer = torch.optim.Adam(model.parameters(), lr=LEARNING_RATE)
# epoch:   0 , train loss: 0.3686
# epoch:  20 , train loss: 0.0025
# epoch: 120 , train loss: 0.0013

test_pred_numpy = model(x_test_tensor).cpu().detach().numpy()
pred_inverse = scaler_y.inverse_transform(test_pred_numpy)    # 0.63 → 원 단위
```

지금까지는 전부 분류였는데 이번은 정답이 연속된 숫자인 회귀라 MSE를 쓰고, 마지막에 sigmoid나 softmax도 안 붙였다. 손실 0.0013은 0~1로 줄인 값 기준이라 원 단위 오차가 아니고, 줄어드는 추세를 보는 용도다. 예측 결과에는 계산 그래프가 붙어 있어서 `detach()`로 떼어내야 넘파이로 바꿀 수 있다.

"섞으면 안 된다"가 두 군데 나왔는데 무게가 달랐다. train/test를 날짜순으로 자른 건 반드시 지켜야 한다. 반면 훈련용 `DataLoader`의 `shuffle=False`는 사정이 다르다. 창문으로 이미 샘플을 완결시켜놨고 `h0`를 매번 0으로 시작해서 배치 사이에 상태가 이어지지도 않으니, 852개 샘플의 순서를 섞어도 미래 정보가 새지 않는다. 진짜로 섞으면 안 되는 곳은 train/test 분리 한 군데다.

## Seq2Seq - 길이가 다른 시퀀스 변환
지금까지 만든 RNN 모델들은 출력 길이가 미리 정해져 있었다. IMDB 분류와 주가 예측은 출력이 1개(many-to-one)였고, NER은 입력과 같은 개수(many-to-many)였다. 그런데 번역은 "나는 학생입니다"(3어절)가 "I am a student"(4단어)가 되고 문장마다 비율이 다르다. 요약, 음성 인식, 챗봇도 같은 모양이다.

해결 아이디어는 읽는 일과 쓰는 일을 분리하는 것이다. RNN 하나가 읽으면서 동시에 쓰려니 길이를 못 맞추니까, 읽기 전담 RNN과 쓰기 전담 RNN을 따로 둔다. 통역사가 상대 말을 끝까지 다 듣고, 머릿속에 뜻을 담아둔 다음, 그 뜻을 보고 우리말로 새로 말하는 것과 같다.

```
[인코더] I am a student  →  ● 컨텍스트 벡터
                             ↓
[디코더] <sos> → je → suis → étudiant → <eos>
```

**인코더**는 평범한 LSTM이다. 입력 단어를 하나씩 넣고 다 읽은 뒤의 마지막 은닉 상태 하나를 꺼내는데, 이게 **컨텍스트 벡터**다. 책 한 권을 읽고 머릿속에 남은 요지 같은 것이다. 주가 예측에서 `outputs[:, -1, :]`로 마지막 것만 꺼낸 것과 같은 동작이다.

**디코더**도 RNN인데, 첫 은닉 상태가 0이 아니라 인코더가 준 컨텍스트 벡터이고, 첫 입력은 `<sos>`(문장 시작) 토큰이다. 그다음부터 자기가 낸 단어를 다음 입력으로 받아 `<eos>`(문장 끝)가 예측될 때까지 한 단어씩 만든다. 그래서 출력 길이를 미리 정하지 않아도 된다. 각 시점의 출력은 사전 전체에 대한 소프트맥스 확률 분포라 사전이 1만 단어면 1만 개짜리 벡터다.

### 교사 강요
가장 헷갈리면서 중요한 부분이었다. 훈련 초기의 모델은 첫 단어부터 틀리는데, 틀린 단어를 다음 입력으로 받으면 연쇄적으로 무너져서 어디서부터 잘못됐는지 배울 수가 없다. 그래서 훈련 중에는 모델이 뭘 예측했든 다음 입력으로 정답을 넣어준다. 옆에서 "아니야, 여기는 je야" 하고 짚어주면서 가르치는 것이라 **교사 강요(teacher forcing)**라고 한다.

| 데이터 | 예 |
|---|---|
| 인코더 입력 | I am a student |
| 디코더 입력 | `<sos>` je suis étudiant |
| 디코더 정답 | je suis étudiant `<eos>` |

그래서 훈련 데이터가 세 벌 필요하고, 디코더 입력과 정답은 한 칸씩 어긋나 있다. "이걸 봤으면 다음에는 저걸 내놔라"를 데이터로 표현한 모양이다. 예측할 때는 정답이 없으니 자기 출력을 다시 넣는다. 모델 구조와 가중치는 같고 디코더에 무엇을 넣느냐만 다르다. 훈련 내내 정답만 받다가 실전에서 갑자기 자기 출력을 받으면 한 번 삐끗했을 때 회복을 못 하는데, 이걸 노출 편향이라고 한다.

그런데 컨텍스트 벡터는 크기가 고정이다. 4단어짜리 문장이든 30단어짜리 문장이든 같은 크기의 그릇에 담아야 한다. 이 한 줄이 어텐션이 나온 이유였다.

## 어텐션 - 필요한 곳을 다시 들여다보기
고정 크기 컨텍스트 벡터에는 문제가 두 개 겹쳐 있다. 문장이 길어도 그릇이 그대로라 넘치는 정보는 버려지는 정보 병목, 그리고 앞쪽 단어 정보가 은닉 상태를 수십 번 거치면서 희미해지는 기울기 소실이다. 실제로 기계번역에서 입력 문장이 길어질수록 번역 품질이 떨어졌다.

아이디어는 디코더가 단어 하나를 낼 때마다 입력 문장 전체를 다시 보는 것이다. 그런데 그냥 다시 보면 평균 내는 것과 다를 게 없으니, 지금 만들려는 단어와 관련 있는 입력 단어에 더 무게를 준다. 번역할 때 원문을 손가락으로 짚어가며 하는 것과 같다. "je"를 쓸 때는 I를 짚고, "étudiant"를 쓸 때는 student를 짚는다. 그 짚는 정도를 숫자로 만들어 모델이 스스로 배우게 한 게 어텐션이다.

### Q, K, V
어텐션은 `Attention(Q, K, V)`로 표현한다. 도서관에서 책을 찾는 일로 비유하면 Query는 내가 찾는 주제, Key는 책등의 색인표, Value는 책의 실제 내용이다. Q를 모든 K와 비교해서 얼마나 맞는지 점수를 매기고, 그 점수를 가중치 삼아 V를 섞는다. Seq2Seq + 어텐션에서는 Q가 지금 시점 디코더의 은닉 상태이고, K와 V는 둘 다 모든 시점 인코더의 은닉 상태들이다. K와 V가 같은 건데 이름을 나눈 이유는 트랜스포머에서 둘이 실제로 달라지기 때문이다.

### 세 걸음

```
score = s_t · h_i          ① 지금 상태와 각 입력 단어의 내적 (유사도)
α     = softmax(score)     ② 합이 1인 가중치로
a_t   = Σ α_i · h_i        ③ 가중합 = 어텐션 값
```

첫째, 디코더 은닉 상태와 인코더 은닉 상태들을 내적한다. 방향이 비슷할수록 큰 값이 나오고, 입력 단어가 n개면 점수도 n개다. 둘째, 소프트맥스로 합이 1인 확률 분포로 만든다. 예를 들어 `[0.1, 0.4, 0.1, 0.4]`면 am과 student를 집중해서 보고 있다는 뜻이다. 셋째, 그 가중치로 인코더 은닉 상태들을 섞는다. 학점 수로 가중치를 주는 성적 평균처럼 중요한 것이 더 반영된다.

이 결과 `a_t`도 컨텍스트 벡터라고 부르는데 Seq2Seq의 것과 다르다. Seq2Seq의 컨텍스트 벡터는 인코더의 마지막 은닉 상태로 문장당 하나이고, 어텐션의 컨텍스트 벡터는 은닉 상태들의 가중합으로 디코더 시점마다 새로 만들어진다. 이렇게 구한 `a_t`를 디코더의 현재 은닉 상태 옆에 이어 붙여서 다음 단어를 예측하는데, 원문 정보가 직접 붙어 들어온다는 게 핵심이다.

어텐션 종류는 dot, scaled dot, general, concat 등 여러 가지인데 전부 첫 걸음(점수 계산)만 다르고 소프트맥스와 가중합은 같다. 이 중 scaled dot(Vaswani 2017)이 바로 트랜스포머가 쓰는 방식이다. 어텐션 가중치는 누가 손으로 정하는 게 아니라 학습되고, 별도의 정답 라벨도 없다. 번역이 잘 되는 방향으로 학습하다 보면 je를 낼 때 I를 보는 패턴이 저절로 생긴다. 그리고 여기까지의 어텐션은 여전히 LSTM 위에 얹은 보조 장치였다.

## 트랜스포머 - 어텐션만으로 짓기
RNN의 근본 문제는 성능이 아니라 구조다. 단어2를 계산하려면 단어1이 끝나야 해서 100단어 문장은 100번을 차례로 기다려야 한다. GPU는 계산을 한꺼번에 잔뜩 하는 장치라 줄을 세워놓으면 놀게 된다. 반면 어텐션의 `QKᵀ`는 행렬 곱 한 번으로 모든 단어 쌍의 관계를 동시에 계산한다. 트랜스포머가 이긴 진짜 이유는 정확도가 조금 높아서가 아니라 훨씬 큰 모델을 훨씬 빨리 훈련할 수 있어서였다. LLM이 수천억 파라미터까지 커진 게 이 병렬성 덕분이라고 한다. 2017년 논문 제목이 "Attention is all you need"다.

논문 기준 하이퍼파라미터는 모델 전체를 관통하는 벡터 차원 `d_model = 512`, 인코더와 디코더를 각각 쌓은 층 수 6, 어텐션을 나누는 헤드 수 8, 내부 피드포워드 은닉층 크기 2048이다. `d_model`은 입력도 512, 서브층 출력도 512, 인코더 출력도 512로 어디를 잘라도 유지돼서 같은 블록을 그대로 쌓을 수 있다.

### 포지셔널 인코딩
RNN은 단어를 순서대로 넣으니 위치 정보가 공짜로 따라왔다. 트랜스포머는 문장을 한 번에 넣어서 "나는 너를 좋아해"와 "너를 나는 좋아해"를 구분하지 못한다. 그래서 임베딩 벡터에 몇 번째 자리인지를 나타내는 값을 더한다.

```
PE(pos, 2i)   = sin(pos / 10000^(2i / d_model))
PE(pos, 2i+1) = cos(pos / 10000^(2i / d_model))
```

`pos`는 문장에서 몇 번째 단어인지, `i`는 벡터 안의 몇 번째 칸인지이고, 짝수 칸은 sin, 홀수 칸은 cos다. 문장 행렬과 같은 크기의 위치 행렬을 만들어서 그냥 더한다. 좌석마다 다른 무늬의 도장을 찍는 것이다. 0, 1, 2를 그냥 더하면 문장이 길어질수록 값이 커져서 임베딩을 압도하는데, sin과 cos은 항상 -1~1 사이이고 칸마다 주파수가 달라 위치마다 고유한 무늬가 나온다.

### 셀프 어텐션과 Scaled Dot-Product
트랜스포머에는 어텐션이 세 종류 있고, Q, K, V가 어디서 오느냐로 구분한다.

| 어텐션 | 위치 | Q | K, V |
|---|---|---|---|
| 인코더 셀프 어텐션 | 인코더 | 입력 문장 | 입력 문장 |
| 마스크드 디코더 셀프 어텐션 | 디코더 1번 서브층 | 출력 문장 | 출력 문장 |
| 인코더-디코더 어텐션 | 디코더 2번 서브층 | 디코더 | 인코더 |

셀프는 Q, K, V의 출처가 같다는 뜻이지 값이 같다는 게 아니다. 같은 문장 행렬에서 출발하지만 각각 다른 가중치 행렬 `W^Q`, `W^K`, `W^V`를 곱하니 값은 다르다. 세 번째는 Q만 디코더라 셀프가 아니고, 오전에 배운 어텐션과 정확히 같은 것이다. 셀프 어텐션은 문장 안의 단어들끼리 "너 나랑 관련 있니?"를 묻는 것이다. "The animal didn't cross the street, because it was too tired"에서 it을 Q로 두면 animal 쪽 가중치가 높게 나온다.

```
Attention(Q, K, V) = softmax( QKᵀ / √d_k ) V
```

`Q (seq_len, 64) × Kᵀ (64, seq_len)`이면 `(seq_len, seq_len)` 행렬이 나오고, 각 칸이 한 단어가 다른 단어를 보는 정도다. for 문 없이 행렬 곱 하나로 모든 쌍이 계산된다. `√d_k`로 나누는 건 차원이 커지면 내적값의 편차가 커져서 소프트맥스가 0 아니면 1로 극단화되고, 그러면 기울기가 거의 0이 돼 학습이 멈추기 때문이다. `d_k = 64`라 8로 나눈다.

### 멀티 헤드 어텐션
512차원으로 어텐션 한 번을 하는 대신 64차원으로 8번 한다(`d_k = d_model / num_heads = 512 / 8`). 어텐션 한 번은 관점이 하나인데, 8개로 나누면 헤드마다 it ↔ animal(무엇을 가리키나), it ↔ tired(무엇을 하고 있나)처럼 서로 다른 관계를 잡아낸다. 각 헤드는 가중치 행렬을 따로 갖고, 8개 결과를 이어 붙이면 다시 512가 되고 `W^O`를 곱해 512로 내보낸다. 늘리는 게 아니라 쪼개는 것이라 계산량은 거의 그대로이고, 공짜로 관점을 8개 얻는 셈이다.

### 마스크 두 가지
배치로 묶으려고 넣은 `<PAD>`에 어텐션이 걸리면 안 된다. 그 자리를 0으로 곱해서 지우면 될 것 같지만 안 된다. 소프트맥스는 `e^x`를 써서 입력이 0이면 `e^0 = 1`로 오히려 큰 값이 된다. 그래서 소프트맥스 전에 그 자리에 -10억 같은 아주 작은 음수를 더해서 `e^(-∞) = 0`이 되게 한다. 이게 **패딩 마스크**다. "가린다 = 음의 무한대를 더한다"가 트랜스포머 전체의 관용구다.

디코더는 교사 강요로 정답 문장을 한 번에 입력받는데, 그러면 suis를 예측해야 할 시점에 이미 suis와 étudiant가 입력에 들어 있다. 답을 보고 답을 쓰는 셈이다. RNN은 순차적이라 원천적으로 불가능했는데 병렬성을 얻은 대가로 생긴 문제다. 그래서 스코어 행렬에서 자기보다 뒤에 있는 단어(오른쪽 위 삼각형)를 같은 방식으로 가린다. 이게 **룩-어헤드 마스크**이고 디코더 첫 서브층에만 있다.

```
        <sos>  je   suis  étud
<sos>    ✓     ✗     ✗     ✗
je       ✓     ✓     ✗     ✗
suis     ✓     ✓     ✓     ✗
étud     ✓     ✓     ✓     ✓
```

### FFNN과 Add & Norm
각 층에는 어텐션 뒤에 `Dense(2048, relu) → Dense(512)` 두 층짜리 평범한 신경망이 있다. 단어 자리마다 같은 가중치를 써서 포지션-와이즈 FFNN이라고 부른다. 그리고 서브층마다 뒤에 **잔차 연결**과 **층 정규화**가 붙는다. 잔차 연결은 `x + Sublayer(x)`처럼 서브층의 입력을 출력에 그냥 더하는 우회로라서, 서브층이 도움이 안 되더라도 원래 정보가 통과하고 층을 깊게 쌓아도 신호와 기울기가 살아 지나간다. 더하려면 크기가 같아야 해서 `d_model`이 계속 유지돼야 한다. 층 정규화는 한 샘플 안에서 평균 0, 분산 1로 맞춘다. 배치 정규화는 배치 방향으로 평균을 내는데, 문장은 길이가 제각각이고 PAD가 섞여 있어서 자연어에서는 층 정규화를 쓴다.

### 트랜스포머 가계도와 프롬프트

| 구조 | 잘하는 일 | 대표 모델 |
|---|---|---|
| 인코더만 | 이해 (분류, NER, 문장 유사도) | BERT |
| 인코더-디코더 | 변환 (번역, 요약) | T5, BART |
| 디코더만 | 생성 (대화, 글쓰기) | GPT |

인코더는 셀프 어텐션이 문장 전체를 양방향으로 봐서 각 토큰 벡터에 문맥이 다 담기니 이해에 강하다. 디코더는 룩-어헤드 마스크 때문에 항상 지금까지 본 것만으로 다음을 예측하는 훈련을 받으니 그게 곧 글쓰기다.

수업에서 던진 질문이 좋았다. 인코더 없이 디코더만으로 생성이 되나? 디코더는 이전까지 생성한 텍스트를 받아 다음 토큰을 예측하는데, 맨 처음에는 생성한 게 없다. 그러면 마치 이전에 생성한 것처럼 텍스트를 넣어주면 된다. 그 초기 텍스트가 바로 **프롬프트**다. ChatGPT에 질문을 입력하면 모델은 그걸 질문으로 이해하는 게 아니라 "내가 방금 여기까지 썼다"고 받아들이고 이어서 쓴다. LangChain 수업 때 프롬프트를 열심히 다뤘는데 그게 구조적으로 무슨 뜻이었는지 여기서 처음 이해됐다.

오픈소스 LLM이 공개하는 건 모델 구조와 대규모 데이터로 학습된 파라미터이고, 이걸 새 작업에 재사용하거나 조금 고쳐 쓰는 게 **전이학습**이다. 한 번 크게 훈련해두면 남들이 조금씩 고쳐 쓸 수 있다는 게 트랜스포머가 지배적이 된 이유이기도 하다.

## BERT 전이학습 - 영화 리뷰 분류
BERT는 Bidirectional Encoder Representations from Transformers, 이름 그대로 트랜스포머의 인코더만 쌓은 양방향 모델이다. 지금까지 만든 감정 분류기는 전부 백지에서 시작해서 "영화"라는 단어의 뜻조차 그 데이터 안에서 처음 배웠다. 데이터가 15만 개 있어도 언어 자체를 배우기엔 턱없이 적다. 전이학습은 언어를 이해하는 부분은 남이 대량의 텍스트로 미리 배워둔 걸 가져다 쓰고, 우리는 긍정이냐 부정이냐만 가르치자는 발상이다. 이번 실습은 텐서플로로 돌아왔는데, Hugging Face가 같은 모델을 두 프레임워크로 다 제공해서 파이토치 가중치를 내려받아 텐서플로로 변환해 쓴다(`from_pt=True`).

### 데이터

```python
train_data = pd.read_table('ratings_train.txt')   # 네이버 영화 리뷰 15만 개
train_data['document'].value_counts().head()
# 굿 181 / good 92 / 최고 85 / 쓰레기 79 / 별로 66
train_data.drop_duplicates(subset=['document'], inplace=True)
train_data.dropna(how='any', inplace=True)
len(train_data)   # 146182
```

label은 0이 부정, 1이 긍정이다. "굿"이 181번 들어 있으면 그 패턴만 과하게 학습하고, 훈련과 테스트 양쪽에 같은 문장이 있으면 점수가 부풀려져서 중복을 지웠다. 결측치는 5개뿐이었지만 `NaN`을 토크나이저에 넣으면 그냥 죽는다.

### 입력 세 벌

```python
tokenizer = BertTokenizer.from_pretrained('klue/bert-base')
tokenizer.tokenize("보는 내내 그대로 들어맞는 예측 카리스마 없는 악역")
# ['보', '##는', '내내', '그대로', '들어맞', '##는', '예측', '카리스마', '없', '##는', '악역']

tokenizer.decode(tokenizer.encode(sentence))
# '[CLS] 보는 내내 그대로 들어맞는 예측 카리스마 없는 악역 [SEP]'
print(tokenizer.cls_token_id, tokenizer.sep_token_id, tokenizer.pad_token_id)   # 2 3 0
```

서브워드로 쪼개서 사전에 없는 단어도 조각으로 표현하니, 전에 OOV 한 칸으로 뭉개지던 문제가 거의 없다. 이 쪼개는 규칙은 사전훈련 때 정해진 거라 바꾸면 안 되고, 그래서 모델과 토크나이저가 한 세트다. `[CLS]`는 문장 맨 앞에 붙는 자리로 나중에 문장 전체의 요약이 되고, `[SEP]`은 문장 끝, `[PAD]`는 빈칸이다. 영어 `bert-base-uncased`에서는 `[CLS]`가 101이었는데 여기서는 2다. 모델이 바뀌면 번호도 바뀌니 숫자를 박지 말고 `tokenizer.cls_token_id`처럼 물어봐야 한다.

```python
def convert_examples_to_features(examples, labels, max_seq_len, tokenizer):
    input_ids, attention_masks, token_type_ids, data_labels = [], [], [], []
    for example, label in tqdm(zip(examples, labels), total=len(examples)):
        input_id = tokenizer.encode(example, padding='max_length',
                                    max_length=max_seq_len, truncation=True)
        padding_count = input_id.count(tokenizer.pad_token_id)
        attention_mask = [1] * (max_seq_len - padding_count) + [0] * padding_count
        token_type_id = [0] * max_seq_len
        assert len(input_id) == max_seq_len
        ...
    input_ids = np.array(input_ids, dtype=int)
    ...
    return (input_ids, attention_masks, token_type_ids), data_labels
```

BERT는 세 가지를 같이 받는다. 정수 인코딩은 `encode`가 패딩과 자르기까지 해준다. 어텐션 마스크는 진짜 단어 자리 1, 패딩 자리 0인데, 트랜스포머에서 배운 패딩 마스크가 바로 이것이다. -10억을 더하는 계산은 BERT 내부가 알아서 하고 우리는 1/0만 알려주면 된다. 세그먼트 인코딩은 BERT가 원래 문장 두 개를 받을 수 있게 설계돼서 앞 문장 0, 뒤 문장 1로 표시하는 자리인데, 리뷰 하나만 넣으니 전부 0이다. 안 쓰는 기능이지만 자리는 채워야 한다. 세 개의 길이가 어긋나면 모델 안에서 알아보기 힘든 에러로 터지니 `assert`로 만드는 자리에서 바로 잡는다. 리스트 말고 numpy로 넘겨야 하는 것도 주의할 점이었다. 요즘은 `tokenizer(text, padding=..., truncation=True)`처럼 함수로 부르면 세 개를 딕셔너리로 한 번에 주는데, 수업은 셋이 각각 무엇인지 보여주려고 손으로 만들었다.

### 사전훈련 모델과 출력 두 가지

```python
model = TFBertModel.from_pretrained('klue/bert-base', from_pt=True)
model.count_params()     # 110617344

outputs = model([input_ids_layer, attention_masks_layer, token_type_ids_layer])
outputs[0]   # (None, 128, 768)  토큰마다
outputs[1]   # (None, 768)       [CLS] 자리
```

오전의 주가 예측 LSTM이 165개였는데 여기는 1억 1천만 개이고, 그중 우리가 만든 건 0개다. 445MB짜리 파일을 내려받았다. 로드할 때 "Some weights of the PyTorch model were not used"라는 경고가 뜨는데, 사전훈련 때 쓰던 빈칸 맞히기(MLM)와 다음 문장 예측(NSP) 머리를 안 가져왔다는 정상 안내다. 우리는 몸통만 필요하고 머리는 새로 붙인다. 노트북 제목은 KoBERT였지만 코드가 실제로 쓰는 건 KLUE의 한국어 BERT였고, 둘은 사전과 토크나이저가 달라서 바꿔 쓸 수 없다.

출력이 두 가지인 게 핵심이었다. `outputs[0]`은 토큰마다 벡터가 하나씩 나와서 NER처럼 many-to-many에 쓰고, `outputs[1]`은 `[CLS]` 자리의 벡터 하나라 분류처럼 many-to-one에 쓴다. `[CLS]`는 아무 뜻도 없는 토큰인데 셀프 어텐션을 12층 통과하면서 문장의 모든 단어를 참조한다. 뜻이 없기 때문에 오히려 문장 전체 정보를 담기 좋은 빈 그릇이 된다. 회의록 맨 앞에 "요약:"이라고 써두고 회의를 다 들은 뒤 그 자리를 채우게 한 것이다. 768은 트랜스포머의 `d_model`인데 `bert-base`는 12층, 12헤드, 768차원을 쓴다.

### 모델과 미세조정

```python
class TFBertForSequenceClassification(tf.keras.Model):
    def __init__(self, model_name):
        super().__init__()
        self.bert = TFBertModel.from_pretrained(model_name, from_pt=True)
        self.classifier = tf.keras.layers.Dense(
            1, kernel_initializer=tf.keras.initializers.TruncatedNormal(stddev=0.02),
            activation='sigmoid', name='classifier')

    def call(self, inputs):
        input_ids, attention_mask, token_type_ids = inputs
        outputs = self.bert(input_ids=input_ids, attention_mask=attention_mask,
                            token_type_ids=token_type_ids)
        cls_token = outputs[1]
        return self.classifier(cls_token)

model = TFBertForSequenceClassification("klue/bert-base")
optimizer = tf.keras.optimizers.Adam(learning_rate=5e-5)
model.compile(optimizer=optimizer, loss=tf.keras.losses.BinaryCrossentropy(), metrics=['accuracy'])
model.fit(train_X, train_y, epochs=2, batch_size=64, validation_split=0.2)
```

지난주에 배운 Subclassing 방식이다. 우리가 새로 만든 층은 `Dense(1)` 하나, `768 × 1 + 1 = 769`개다. 1억 1천만 개 위에 769개를 얹었다. `stddev=0.02` 초기화는 BERT 논문 관례를 따라 초기 출력이 튀지 않게 한 것이다.

학습률이 지금까지 쓰던 Adam 기본값 0.001보다 20배 작은 5e-5인 게 가장 놓치기 쉬운 대목이었다. `self.bert`를 얼리는 코드가 어디에도 없어서 역전파가 `Dense(1)`을 지나 BERT 1억 1천만 개 전부로 흘러들어가 전부 갱신된다. 이미 잘 배워둔 사람을 세게 다시 가르치면 원래 알던 것까지 잊어버리니 아주 살살 건드린다. 사전훈련 부분을 얼리고 새 층만 학습하면 특성 추출, 전부를 조금씩 갱신하면 미세조정(fine-tuning)인데 이 실습은 미세조정이었다. 그래서 "Dense만 학습했다"는 틀린 답이다.

```
Epoch 1/2
1828/1828 [====] - 3197s 2s/step
    loss: 0.2820 - accuracy: 0.8808 - val_loss: 0.2492 - val_accuracy: 0.8987
```

1에포크에 3,197초, 약 53분이 걸렸다. 데이터가 늘어난 게 아니라 모델이 커진 것이다. 1828은 `146,182 × 0.8 ÷ 64`를 올림한 스텝 수다. 1에포크 만에 검증 정확도 89.87%가 나왔다. 처음부터 만든 모델들과 비교하면 전이학습의 값어치가 바로 보인다. 수업 시간 안에 2에포크가 다 끝나지 못해서 테스트 점수까지는 못 봤다.

```python
def sentiment_predict(new_sentence):
    input_id = tokenizer.encode(new_sentence, padding='max_length',
                                max_length=max_seq_len, truncation=True)
    padding_count = input_id.count(tokenizer.pad_token_id)
    attention_mask = [1] * (max_seq_len - padding_count) + [0] * padding_count
    token_type_id = [0] * max_seq_len

    input_ids = np.array([input_id])          # (1, 128) 배치로 감싼다
    attention_masks = np.array([attention_mask])
    token_type_ids = np.array([token_type_id])
    score = model.predict([input_ids, attention_masks, token_type_ids])[0][0]

    if score > 0.5:
        print("{:.2f}% 확률로 긍정 리뷰입니다.".format(score * 100))
    else:
        print("{:.2f}% 확률로 부정 리뷰입니다.".format((1 - score) * 100))
```

예측할 때도 같은 토크나이저와 같은 `max_seq_len`으로 세 벌을 똑같이 만든다. 문장 하나여도 1개짜리 배치로 감싸야 `(1, 128)`이 되고, `[0][0]`은 배치의 첫 샘플의 유일한 출력이다.

## 헷갈리기 쉬운 부분
- 시계열에서 섞으면 안 되는 곳은 train/test 분리다. 창문으로 완결된 샘플은 섞어도 미래가 새지 않는다.
- 정답 컬럼을 맨 오른쪽에 두고 창문으로 오려내면 샘플 수는 `len(data) - seq_length`다. `[-1]`에 대괄호를 씌워 정답을 (n, 1)로 만든다.
- 스케일러는 입력용과 정답용 두 개를 둬야 예측을 원 단위로 되돌릴 수 있다. 테스트 스케일이 1을 넘는 건 정상이다.
- 파이토치 LSTM은 `batch_first=True`와 `outputs[:, -1, :]`가 한 세트다.
- 회귀는 MSELoss이고 출력층에 활성화 함수가 없다.
- Seq2Seq은 읽는 RNN과 쓰는 RNN을 분리해서 길이를 자유롭게 한다. 디코더 입력은 훈련 때 정답(교사 강요), 예측 때 자기 출력이다.
- 컨텍스트 벡터는 Seq2Seq에서는 인코더의 마지막 은닉 상태, 어텐션에서는 시점마다 새로 만드는 가중합이다.
- 어텐션은 내적 → 소프트맥스 → 가중합이고, 가중치는 학습된다.
- 셀프 어텐션의 Q, K, V는 출처가 같을 뿐 값은 다르다.
- 트랜스포머는 `QKᵀ` 행렬 곱 한 번으로 병렬 계산한다. 순서는 포지셔널 인코딩으로 더해준다.
- 가린다는 건 0을 곱하는 게 아니라 소프트맥스 전에 아주 작은 음수를 더하는 것이다. 패딩 마스크와 룩-어헤드 마스크.
- 멀티 헤드는 512를 64 × 8로 쪼개는 것이다.
- 인코더만 쓰면 BERT(이해), 디코더만 쓰면 GPT(생성). 프롬프트는 디코더에게 "이전에 생성한 텍스트"를 넣어주는 것이다.
- BERT 입력은 정수 인코딩, 어텐션 마스크, 세그먼트 인코딩 세 벌이고, 출력은 `outputs[0]`(토큰마다)과 `outputs[1]`(`[CLS]`) 두 가지다.
- 토크나이저와 모델은 같은 이름으로 쓰고, 특수 토큰 번호는 물어본다.
- 동결하지 않으면 BERT 전체가 미세조정된다. 그래서 학습률이 5e-5로 작다.

## 오늘 배운 내용 정리
오늘은 LSTM으로 주가를 예측하고, Seq2Seq에서 어텐션, 트랜스포머를 거쳐 BERT 전이학습까지 갔다.

```
주가 예측: 날짜순 분리 → 스케일러 x/y 따로 → 슬라이딩 윈도우 (852, 5, 4) → TensorDataset.
          nn.LSTM(batch_first=True) → outputs[:, -1, :] → Linear(1). MSELoss. detach → inverse_transform.
Seq2Seq: 인코더(마지막 은닉 상태 = 컨텍스트 벡터) → 디코더(<sos> ~ <eos>). 훈련은 교사 강요.
어텐션: Q(디코더) · K(인코더) → softmax → V 가중합. 시점마다 원문을 다시 본다.
트랜스포머: softmax(QKᵀ/√d_k)V. 포지셔널 인코딩, 멀티 헤드(64 × 8), 패딩 / 룩-어헤드 마스크,
           FFNN, 잔차 연결 + 층 정규화. 인코더만 = BERT, 디코더만 = GPT.
BERT: klue/bert-base. 입력 세 벌(input_ids, attention_mask, token_type_ids).
      outputs[1]([CLS], 768) → Dense(1, sigmoid). 전체 미세조정, lr 5e-5. 1에포크 검증 0.8987.
```

프롬프트가 "디코더가 이전에 생성한 것처럼 넣어주는 텍스트"라는 설명이 가장 기억에 남았다. LangChain 수업 때 프롬프트를 이것저것 바꿔가며 써봤는데, 모델은 그걸 질문으로 이해하는 게 아니라 자기가 여기까지 썼다고 받아들이고 이어 쓴다는 걸 이제야 알았다. 그리고 오전에 165개짜리 LSTM을 직접 만들다가 오후에 1억 1천만 개짜리 BERT 위에 769개를 얹어서 1에포크 만에 90%가 나오는 걸 보니, 왜 요즘은 전부 사전훈련된 모델을 가져다 쓰는지 실감이 났다.

---
