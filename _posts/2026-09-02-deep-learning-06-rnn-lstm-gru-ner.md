---
layout: single
title: "딥러닝 기초 정리 6 - SimpleRNN, LSTM과 GRU, 양방향 LSTM, 개체명 인식(NER)"
categories: [coding, DeepLearning]
tag: [study-log, DeepLearning, RNN, SimpleRNN, LSTM, GRU, Bidirectional, TimeDistributed, NER, BIO, seqeval]
toc: true
author_profile: false
sidebar:
    nav: "docs"
search: true
---
<hr/>

어제까지 문장을 `Conv1D`로 분류했다면, 오늘은 문장을 한 단어씩 순서대로 읽는 순환 신경망(RNN)을 배웠다. IMDB 영화 리뷰로 SimpleRNN을 붙여보고, 긴 문장의 앞부분을 잊어버리는 문제를 해결한 LSTM, GRU, 양방향 LSTM을 차례로 바꿔 끼워봤다. 마지막에는 "내일 부산 날씨 알려줘"에서 내일은 날짜, 부산은 지역이라고 찾아내는 개체명 인식(NER)을 만들었다. 문장 하나에 답 하나가 아니라 토큰마다 답을 내는 첫 모델이었다.

## SimpleRNN으로 IMDB 리뷰 분류

### 왜 순환층이 필요했나
합성곱은 정해진 크기의 창(예: 3단어) 안의 패턴만 본다. "좋다", "별로다" 같은 표현이 창 안에 잡히면 잘 맞지만 창 밖의 순서 정보는 버린다. 그런데 리뷰는 11단어짜리부터 1,854단어짜리까지 길이가 제각각이고, "처음엔 별로였는데 끝에 가서 완전히 뒤집혔다"처럼 순서 자체가 뜻을 만든다. 그래서 읽은 것을 기억하면서 순서대로 읽는 층이 필요했다.

순환층이 한 번 읽는 단위를 **타임스텝**이라고 하는데, 여기서는 토큰 1개가 타임스텝 1개다. 100개 토큰짜리 문장을 넣으면 순환층은 100번 돈다. **은닉상태(hidden state)**는 지금까지 읽은 내용을 요약해 들고 다니는 메모지다. 한 단어를 읽을 때마다 `새 메모지 = tanh(이번 단어 × W + 지난 메모지 × U + b)`로 고쳐 쓰고, 문장이 끝나면 마지막 메모지 하나만 다음 층으로 넘긴다. `SimpleRNN(8)`의 8은 이 메모지의 칸 수다. 그래서 순환층은 층을 100개 쌓은 게 아니라 같은 층 하나를 100번 재사용하는 것이고, 파라미터 개수가 문장 길이와 무관하다.

### 데이터

```python
from keras.datasets import imdb
(train_input, train_target), (test_input, test_target) = imdb.load_data(num_words=10000)
train_input.shape     # (25000,)

lengths = np.array([len(x) for x in train_input])
print(np.min(lengths), np.max(lengths), np.mean(lengths), np.median(lengths))
# 11  1854  239.00925  178.0
```

IMDB는 케라스가 이미 토큰화와 정수 인코딩을 해서 배포해서 `Tokenizer`를 쓰지 않는다. 넘파이 배열인데 shape이 `(25000,)`이고 `dtype('O')`, 원소가 파이썬 리스트다. 리뷰마다 길이가 달라서 가장 긴 리뷰에 맞춰 2차원 배열을 만들면 메모리가 낭비되니 리뷰마다 따로 리스트로 들고 있는 것이다. 평균(239)이 중간값(178)보다 커서 오른쪽으로 긴 꼬리가 있고, 히스토그램을 보면 대부분 300 미만이라 100이면 대다수 리뷰를 담는다고 판단했다.

오늘 가장 헷갈린 건 인덱스 오프셋 3이었다. IMDB 데이터는 0번(패딩), 1번(문장 시작), 2번(사전에 없는 단어)을 예약해둬서 실제 단어는 3번부터 시작한다. 그런데 `imdb.get_word_index()`가 주는 사전은 1부터 시작하는 원래 번호다. 그래서 문장 속 토큰을 단어로 읽을 때는 3을 빼고, 단어를 토큰으로 넣을 때는 3을 더해야 한다. 데이터셋의 토큰 4가 사전의 1번 'the'였다.

```python
word_index = imdb.get_word_index()
reverse_word_index = {v: k for k, v in word_index.items()}
decoded = ' '.join(reverse_word_index.get(i - 3, '?') for i in train_input[0])
```

### 패딩 - 앞을 자르고 앞을 채운다

```python
from keras.preprocessing.sequence import pad_sequences
train_seq = pad_sequences(train_input, maxlen=100)    # (20000, 100)
```

기본값이 `padding='pre'`, `truncating='pre'`라 둘 다 앞쪽을 건드린다. 100보다 긴 리뷰는 앞을 버리고 뒤 100개만 남기고, 짧은 리뷰는 앞에 0을 채운다. 리뷰는 끝에 가서 결론을 말할 가능성이 높아서 뒷부분이 더 유용하다. 앞에 0을 채우는 것도 순환층이 마지막 은닉상태만 넘기기 때문이다. 뒤에 0을 잔뜩 붙이면 마지막에 읽은 게 전부 패딩이라 기억이 희석되고, 앞에 채우면 마지막에 읽는 게 진짜 단어다. 어제 CNN은 `'post'`를 썼는데 목적이 다르면 방향도 달라진다.

### one-hot + SimpleRNN

```python
train_oh = keras.utils.to_categorical(train_seq)     # (20000, 100) → (20000, 100, 500)

model = keras.Sequential()
model.add(keras.layers.Input(shape=(100, 500)))
model.add(keras.layers.SimpleRNN(units=8))
model.add(keras.layers.Dense(1, activation='sigmoid'))
```

단어 번호는 크기 비교에 뜻이 없는 분류형 값이라 먼저 원-핫으로 펼쳐봤다(수업에서는 사전을 500개로 줄여놓은 상태). `summary()`의 SimpleRNN 파라미터는 4,072개였는데, 입력 → 은닉 500 × 8 = 4,000, 은닉 → 은닉 8 × 8 = 64, 편향 8을 더한 값이다. SimpleRNN 파라미터는 `units × (inputs + units + 1)`이다.

검증 정확도는 0.785 정도로 나쁘지 않았다. 문제는 메모리였다. `train_seq.nbytes`는 20000 × 100 × 4byte = 8MB인데 `train_oh.nbytes`는 20000 × 100 × 500 × 8byte = 8GB다. 1,000배이고 그것도 사전을 500개로 줄여놓은 상태다. 그 8GB의 99.8%가 0이다.

### Embedding으로 바꾸기

```python
model2 = keras.Sequential(name="Embedding_RNN")
model2.add(keras.layers.Input(shape=(100,)))               # 정수 시퀀스 그대로
model2.add(keras.layers.Embedding(input_dim=10003, output_dim=16))
model2.add(keras.layers.SimpleRNN(8))
model2.add(keras.layers.Dense(1, activation='sigmoid'))
```

| 층 | 출력 shape | 파라미터 | 계산 |
|---|---|---|---|
| Embedding | (None, 100, 16) | 160,048 | 10,003 × 16 |
| SimpleRNN | (None, 8) | 200 | 8 × (16 + 8 + 1) |
| Dense | (None, 1) | 9 | (8 + 1) × 1 |

임베딩은 정수를 그대로 받아서 그 줄을 꺼내 쓰는 표라, 원-핫이 (100, 500)으로 부풀린 걸 (100, 16)짜리 학습되는 실수 벡터로 바꾼다. 순환층 파라미터가 4,072에서 200으로 줄었고, 입력 데이터가 8GB에서 8MB가 됐다. 사전도 500에서 10,000으로 늘렸고 정확도도 0.785에서 0.8076으로 올랐다.

```
Epoch 3/100  accuracy: 0.8702 - val_accuracy: 0.8076 - val_loss: 0.4514   ← best
Test Accuracy: 0.8076
```

`early_stopping_cb.best_epoch`이 2였는데 0부터 세서 3번째 에포크다. 그 뒤로는 훈련 정확도만 오르고 검증 손실은 계속 나빠지는 전형적인 과대적합이었다. `input_dim=10003`의 `+3`은 특수 토큰 자리를 확보하려는 의도인데, 사실 `imdb.load_data(num_words=N)`은 오프셋을 이미 적용하고 N 이상인 값을 전부 2로 바꿔서 `input_dim=N`이면 충분하다. 넉넉히 잡으면 안 쓰는 행만 남고 조용하고, 모자라면 에러가 난다.

### 설정도 같이 저장하기

```python
model_config = {'max_len': max_len, 'num_words': num_words, 'word_index': word_index}
with open(config_path, 'w', encoding='utf-8') as f:
    json.dump(model_config, f, ensure_ascii=False, indent=4)
```

`.keras` 파일에는 가중치와 구조만 들어 있다. 나중에 문장 하나를 예측하려면 어떤 사전으로 정수화했는지, 길이를 몇으로 맞췄는지를 똑같이 재현해야 해서 설정을 JSON으로 같이 저장했다.

직접 쓴 긴 부정 리뷰를 넣었더니 95.39% 확률로 긍정이라고 틀렸다. 이 리뷰는 161단어라 `maxlen=100`, `truncating='pre'`에 걸려 앞 62단어가 통째로 잘렸다. 남은 뒤 100단어는 가족과 아이 이야기가 이어지는 대목이라 오히려 동정적으로 읽혔다. 모델이 틀렸다기보다 모델이 본 적 없는 앞부분에 정답이 있었다. 예측이 이상하면 내 입력이 잘리지 않았나부터 의심해야 한다.

## LSTM, GRU, 양방향 LSTM
SimpleRNN은 긴 문장을 학습하기 어렵다. 100단어 리뷰라면 첫 단어의 정보가 은닉상태를 99번 더 통과하는 동안 계속 덮어쓰여서, 멀리 떨어진 단어끼리의 관계를 못 잡는다. "처음엔 기대했는데 ... 결국 실망했다" 같은 문장이 그렇다.

이걸 해결하려고 **게이트(gate)**를 단다. 게이트는 시그모이드로 만든 0~1 값을 곱해서 정보를 얼마나 통과시킬지 조절하는 수도꼭지다. 학습되는 건 언제 잠그고 언제 열지다. LSTM에는 은닉상태와 별개로 **셀 상태(cell state)**라는 두 번째 메모지가 하나 더 있다. SimpleRNN은 스텝마다 메모지를 `tanh(...)`로 통째로 새로 쓰는데, 셀 상태는 `새 셀 = 포겟게이트 × 지난 셀 + 입력게이트 × 새 정보`처럼 곱하고 더하기만 한다. 포겟게이트가 1에 가까우면 지난 정보가 거의 그대로 통과한다. 이게 "단기 기억을 오래(Long Short-Term Memory)"라는 이름의 뜻이다.

### LSTM - 클래스 이름만 바꾸면 된다

```python
model = keras.Sequential(name="LSTM_model")
model.add(keras.layers.Input(shape=(100,)))
model.add(keras.layers.Embedding(500, 16))
model.add(keras.layers.LSTM(units=8))         # SimpleRNN을 LSTM으로만 바꿈
model.add(keras.layers.Dense(1, activation='sigmoid'))
```

코드는 한 단어 바뀌었는데 순환층 파라미터가 200에서 800이 됐다. LSTM 셀 안에는 SimpleRNN과 똑같이 생긴 계산이 입력 게이트, 출력 게이트, 포겟 게이트, 셀 상태 후보 4벌 들어 있어서 정확히 4배다. LSTM 파라미터는 `4 × units × (units + inputs + 1)` = `4 × 8 × (8 + 16 + 1) = 800`이다. SimpleRNN 공식에 4만 곱하면 된다.

### 순환층의 드롭아웃

```python
model.add(keras.layers.LSTM(8, dropout=0.3))             # 셀에 들어오는 입력에
# model.add(keras.layers.LSTM(8, recurrent_dropout=0.3)) # 스텝 사이를 도는 은닉상태에
```

Dense나 CNN에서는 `Dropout` 층을 따로 끼웠는데, 순환층은 자체 매개변수로 제공한다. 밖에서 `Dropout`을 붙이면 매 스텝 다른 뉴런이 꺼져서 기억이 계속 끊기는데, 내부의 `dropout=`은 한 문장 안에서는 같은 마스크를 유지해서 기억을 망가뜨리지 않는다. `recurrent_dropout`은 켜면 GPU 가속(cuDNN) 경로를 못 써서 훈련이 몇 배 느려지기 때문에 수업에서는 `dropout=`만 썼다.

### 순환층 2개 쌓기

```python
model.add(keras.layers.LSTM(8, dropout=0.3, return_sequences=True))  # (None, 100, 8)
model.add(keras.layers.LSTM(8, dropout=0.3))                         # (None, 8)
```

순환층의 기본 출력은 마지막 타임스텝의 은닉상태 하나 `(batch, units)`뿐이다. 그런데 순환층은 입력이 순차 데이터여야 해서, 위에 층을 하나 더 올리려면 아래층이 100개 타임스텝의 은닉상태를 전부 내놔야 한다. 첫 번째 층이 읽은 소감을 매 단어마다 하나씩 내놔야 두 번째 층이 읽을 게 생긴다. 그래서 마지막을 뺀 모든 순환층에 `return_sequences=True`를 준다. 빼먹으면 2층이 2차원 입력을 받아 에러가 나고, 반대로 마지막 층에 남겨두면 출력이 3차원이 돼서 타깃과 shape이 안 맞는다.

| 층 | 출력 shape | 파라미터 | 계산 |
|---|---|---|---|
| LSTM (1층) | (None, 100, 8) | 800 | 4 × 8 × (8 + 16 + 1) |
| LSTM (2층) | (None, 8) | 544 | 4 × 8 × (8 + 8 + 1) |

2층의 입력은 1층의 출력이라 inputs가 16이 아니라 8이다. 파라미터를 손으로 계산할 때 가장 많이 틀리는 곳이다.

### GRU
GRU는 셀 상태를 따로 두지 않고 은닉상태 하나로 처리하는 간소화판이고, 게이트가 3개다. 그러면 `3 × 200 = 600`이어야 하는데 실제로는 624가 나왔다. 텐서플로 GRU의 기본값 `reset_after=True`가 입력 쪽 편향과 은닉 쪽 편향을 따로 둬서, 게이트 3개 × 유닛 8개 = 24개가 더 붙는다. cuDNN GPU 커널과 호환되는 방식이라 기본값이 됐고, `reset_after=False`로 두면 600이 나온다고 한다.

### 양방향 LSTM
문장을 왼쪽에서 오른쪽으로 한 번, 오른쪽에서 왼쪽으로 한 번 두 번 읽고 합친다. 수업 예문이 좋았다. "ios 앱 [  ]은 맥북이 필요합니다"의 빈칸에 "개발"이 들어간다는 걸 사람은 아는데, 앞에서부터만 읽는 RNN은 "ios", "앱" 두 단어만 보고 맞혀야 한다. 정답의 근거는 뒤쪽에 있다.

```python
model.add(Embedding(input_dim=500, output_dim=16))
model.add(Bidirectional(LSTM(8, dropout=0.3, return_sequences=True)))  # (None, 100, 16)
model.add(TimeDistributed(Dense(1, activation='sigmoid')))             # (None, 100, 1)
model.add(Flatten())                                                   # (None, 100)
model.add(Dense(1, activation='sigmoid'))                              # (None, 1)
```

`Bidirectional`은 감싼 층을 복제해서 뒤에서부터 읽게 하고 두 결과를 이어 붙이는 래퍼다. 그래서 units 8인데 출력 폭이 16이고 파라미터도 정방향 800 + 역방향 800 = 1,600이다. `TimeDistributed`도 래퍼인데, 감싼 층을 타임스텝마다 똑같이 적용한다. 100개 스텝에 `Dense(1)`을 붙이는데 파라미터가 (16 + 1) × 1 = 17개뿐인 건 한 벌을 100번 재사용하기 때문이다. 사실 `Bidirectional(LSTM(8))`만 써도 정방향과 역방향의 마지막 상태를 이어 붙인 `(None, 16)`이 나오는데, 여기서 `return_sequences=True`가 필요한 건 뒤에 `TimeDistributed`를 붙였기 때문이다. 이 구조를 이진 분류에 쓴 건 오후의 NER 예고편이었다.

### 다섯 모델 비교
사전 500단어, 길이 100, RMSprop(lr=1e-4), 배치 64, patience 3으로 조건을 맞췄다.

| 모델 | 총 파라미터 | best_epoch | 최저 val_loss | val_accuracy |
|---|---|---|---|---|
| LSTM(8) | 8,809 | 48 | 0.4368 | 0.7940 |
| LSTM(8, dropout=0.3) | 8,809 | 39 | 0.4353 | 0.7948 |
| LSTM 2층 | 9,353 | 24 | 0.4475 | 0.7934 |
| GRU(8) | 8,633 | 99 | 0.4303 | 0.8004 |
| bi-LSTM | 9,718 | 46 | 0.4390 | 0.8002 |

GRU가 가장 좋았는데 `best_epoch`이 99, 즉 마지막 에포크였다. 100번을 다 쓸 때까지 검증 손실이 계속 떨어지고 있어서 조기 종료가 한 번도 안 걸렸고, 더 훈련했으면 더 좋아졌을 것이다. 2층 LSTM이 오히려 가장 나빴다. 층을 쌓는다고 항상 좋아지지 않고, 500단어짜리 작은 문제에는 과했다. 드롭아웃 효과도 거의 없었는데 파라미터가 8천 개뿐이라 애초에 과대적합이 심하지 않았다. 2층 LSTM 모델로 테스트하니 0.7931이었다.

참고로 오전의 임베딩 SimpleRNN(0.8076)과 나란히 놓고 LSTM이 못하다고 하면 안 된다. 오전은 사전이 10,000단어였고 여기는 500단어다.

## 개체명 인식(NER)
챗봇이 "내일 부산 날씨 알려줘"를 받으면 두 가지를 알아내야 한다. 의도는 "날씨 요청"이고, 개체명은 "내일 = 날짜", "부산 = 지역"이다. 의도만 알면 날씨 API를 못 부른다. 사전을 만들어서 찾을 수도 있고 실무에서도 많이 쓰지만, 신조어나 사전에 없는 말은 처리를 못 하고, 사람이 계속 관리해야 하고, "애플 주가"와 "애플 파이"처럼 문맥에 따라 뜻이 바뀌면 못 잡는다. 그래서 문장 구조가 복잡해지면 딥러닝 모델을 쓴다.

| 구분 | 감정 분류 | 개체명 인식 |
|---|---|---|
| 답의 개수 | 문장당 1개 | 토큰당 1개 |
| 라벨 shape | (2844,) | (2844, 40, 8) |
| 마지막 순환층 | `return_sequences=False` | `True` |
| 손실 함수 | `binary_crossentropy` | `categorical_crossentropy` |

### BIO 표기법
"오늘부터 샤닐 길동은 삼성 전자에 근무합니다"를 태깅하면 이렇다.

| 토큰 | 태그 | 뜻 |
|---|---|---|
| 오늘 | B-Date | 날짜 시작 |
| 부터 | O | 개체명 아님 |
| 샤닐 | B-Person | 인물 시작 |
| 길동 | I-Person | 앞 인물에 이어짐 |
| 삼성 | B-Company | 회사 시작 |
| 전자 | I-Company | 앞 회사에 이어짐 |

개체명의 첫 토큰에만 `B`로 깃발을 꽂고, 이어지는 부분은 `I`, 나머지는 전부 `O`다. B와 I를 나누는 건 "삼성 전자" 한 회사와 "삼성" + "전자" 두 회사를 구별하기 위해서다.

### 말뭉치 읽기
영어는 NER 데이터셋이 흔한데 한국어는 구하기 어려워서 공개된 KoreanNERCorpus의 `train.txt`를 썼다.

```
; 한편, AFC챔피언스리그 E조에 속한 포항 역시 대회 8강 진출이 불투명하다 .
$한편, AFC챔피언스리그 <E조:OG>에 속한 포항 역시 ...
1	한편	NNG	O
1	,	SP	O
2	AFC	SL	O
3	E	SL	B_OG
3	조	NNG	I
...
```

`;`로 시작하는 줄이 원본 문장, `$`로 시작하는 줄이 NER 처리 결과, 그다음 줄들이 토큰 번호, 단어, 품사 태그, BIO 태그이고, 빈 줄이 문장 끝이다. `read_file()`이 `;` 다음 줄이 `$`면 새 문장을 시작하고, `$` 줄은 건너뛰고, 빈 줄에서 문장을 저장하는 식으로 문장별 튜플 리스트를 만든다. 여기서 쓰는 건 단어와 BIO 태그 둘뿐이다. 문장 3,555개, 최대 길이 168토큰, 평균 34토큰이었다. 이 말뭉치는 `속하 / ㄴ`, `불투명 / 하 / 다`처럼 형태소 단위로 쪼개져 있는데, 이게 나중에 예측이 안 되는 이유가 됐다.

### 토크나이저 두 개와 패딩

```python
sent_tokenizer = preprocessing.text.Tokenizer(oov_token='OOV')
sent_tokenizer.fit_on_texts(sentences)
tag_tokenizer = preprocessing.text.Tokenizer(lower=False)
tag_tokenizer.fit_on_texts(tags)

vocab_size = len(sent_tokenizer.word_index) + 1    # 13834
tag_size = len(tag_tokenizer.word_index) + 1       # 8
index_to_ner = tag_tokenizer.index_word
index_to_ner[0] = 'PAD'
```

입력 단어와 출력 태그가 각각 다른 사전을 쓴다. 태그 사전은 0 PAD, 1 O, 2 I, 3 B_OG(조직), 4 B_PS(인물), 5 B_DT(날짜), 6 B_LC(지역), 7 B_TI(시간)였다. `Tokenizer`는 기본으로 소문자화해서 그대로 두면 `B_OG`가 `b_og`가 되니 태그 쪽에는 `lower=False`를 준다. 그리고 `Tokenizer`의 기본 `filters`에 구두점이 들어 있는데 사전에 `.`과 `,`가 멀쩡히 살아 있었다. `fit_on_texts()`는 문자열을 받으면 자르고 거르지만, 리스트를 받으면 이미 토큰화된 것으로 보고 소문자화만 하기 때문이다.

```python
max_len = 40
x_train = preprocessing.sequence.pad_sequences(x_train, padding='post', maxlen=max_len)
y_train = preprocessing.sequence.pad_sequences(y_train, padding='post', maxlen=max_len)
```

오전에는 앞에 채웠는데 여기서는 뒤에 채운다. 감정 분류는 마지막 은닉상태 하나만 쓰니 마지막에 읽는 게 진짜 단어여야 했지만, NER은 토큰 위치와 답 위치가 1:1로 맞아야 한다. 앞에 0을 채우면 첫 단어가 뒤로 밀려서 예측 결과를 원래 단어와 짝지을 수 없다. 입력과 라벨을 같은 방식으로 패딩하는 것도 그래서다.

```python
x_train, x_test, y_train, y_test = train_test_split(x_train, y_train, test_size=.2, random_state=0)
y_train = tf.keras.utils.to_categorical(y_train, num_classes=tag_size)   # (2844, 40, 8)
y_test = tf.keras.utils.to_categorical(y_test, num_classes=tag_size)     # (711, 40, 8)
```

라벨이 문장 2,844개 × 토큰 40개 × 8지선다 원-핫으로 3차원이 됐다. 토큰마다 8개 태그 중 하나를 고르는 다중 분류라 손실은 `categorical_crossentropy`다. 원-핫을 안 만들고 정수 라벨 그대로 `sparse_categorical_crossentropy`를 써도 된다.

### 모델

```python
model = Sequential()
model.add(Input(shape=(max_len,)))                                       # (40,)
model.add(Embedding(input_dim=vocab_size, output_dim=30))                # (40, 30)
model.add(Bidirectional(LSTM(200, return_sequences=True, dropout=0.5)))  # (40, 400)
model.add(TimeDistributed(Dense(tag_size, activation='softmax')))        # (40, 8)
model.compile(loss='categorical_crossentropy', optimizer=Adam(0.01), metrics=['accuracy'])

model.fit(x_train, y_train, batch_size=128, epochs=10)
model.evaluate(x_test, y_test)[1]    # 훈련 0.9862 → 테스트 0.9572
```

오전에 이진 분류에서 써본 구조가 여기서 진짜로 필요해졌다. 개체명은 뒤 문맥이 결정하는 경우가 많아서("포항이 이겼다"는 팀, "포항에 갔다"는 지역) 양방향으로 읽고, 토큰마다 답을 내려고 `return_sequences=True`로 40개 은닉상태를 전부 내놓고, `TimeDistributed`로 같은 Dense 한 벌을 모든 토큰에 적용한다. 파라미터를 손으로 계산해보면 임베딩 13,834 × 30 = 415,020, 양방향 LSTM 2 × 4 × 200 × (200 + 30 + 1) = 369,600, TimeDistributed 400 × 8 + 8 = 3,208이다. LSTM 공식에 양방향이라 2를 곱했을 뿐이다.

### 정확도 95.7%에 속으면 안 된다
노트북에 직접 경고가 적혀 있었다. BIO 태그는 의미 있는 B, I보다 의미 없는 O가 대부분이라, 원하는 성능과 무관하게 높은 점수가 나온다. 40칸 중 35칸이 O면 모델이 전부 O라고만 찍어도 87%다. 정작 찾아야 할 개체명은 하나도 못 맞혔는데. 그래서 NER은 F1으로 평가하고, 태그 시퀀스를 채점해주는 `seqeval`을 쓴다.

```python
from seqeval.metrics import f1_score, classification_report

def sequences_to_tag(sequences):       # (batch, 40, 8)
    result = []
    for sequence in sequences:
        temp = []
        for pred in sequence:          # (8,)
            pred_index = np.argmax(pred)
            temp.append(index_to_ner[pred_index].replace("PAD", "O"))
        result.append(temp)
    return result
```

```
              precision    recall  f1-score   support
           _       0.69      0.59      0.63       657
         _DT       0.92      0.90      0.91       335
         _LC       0.70      0.56      0.62       312
         _OG       0.76      0.49      0.60       481
         _PS       0.50      0.70      0.58       374
         _TI       0.85      0.70      0.77        66
   micro avg       0.69      0.64      0.66      2225

F1-score: 66.2%
```

정확도 95.7%의 진짜 실력은 F1 66.2%였다. 날짜는 "2003년", "오늘"처럼 형태가 뻔해서 0.91로 잘했고, 조직은 재현율 0.49로 실제 조직명의 절반을 놓쳤고, 인물은 정밀도 0.50으로 인물이라고 한 것 중 절반이 틀렸다. 시간은 표본이 66개뿐이라 숫자를 믿기 어렵다. 심부전증 때 정확도 뒤에 재현율이 숨어 있었던 것과 같은 이야기다.

### 예측이 안 되는 이유

```python
pred_ner('오늘 10시에 잠실야구장에서 LG와 두산 맞대결한다')
# 입력 시퀀스: [286, 1, 1, 1, 430, 1]   ← 1은 전부 OOV
```

오늘 가장 중요한 함정이었다. `pred_ner()`는 `sentence.split()`으로 띄어쓰기 단위로 자르는데, 말뭉치는 형태소 단위다. 사전에는 `10`, `시`, `에`가 따로 있지 `10시에`라는 항목이 없어서 통째로 OOV가 된다. '오늘'과 '두산'은 우연히 형태소 하나와 모양이 같아서 맞았을 뿐이다. 제대로 하려면 예측할 때도 훈련과 같은 형태소 분석기로 잘라야 한다. 훈련 전처리와 예측 전처리는 한 몸이다. 결과에 `PAD`가 그대로 나온 단어도 있었는데, `pred_ner()`에는 PAD를 O로 바꾸는 처리가 없고 그 단어가 OOV라 모델이 패딩과 구별을 못 한 것이다.

그리고 이 학습에는 검증 세트도 콜백도 없어서 훈련 0.9862와 테스트 0.9572가 이미 벌어져 있는데 언제부터 과대적합이 시작됐는지 알 방법이 없었다. 지난주에 배운 손실 곡선과 조기 종료를 붙여보면 좋은 연습이 될 것 같다.

## 헷갈리기 쉬운 부분
- 순환층은 층을 쌓는 게 아니라 한 층을 타임스텝마다 반복해서 통과시킨다. 파라미터 수가 문장 길이와 무관하다.
- SimpleRNN 파라미터 = `units × (inputs + units + 1)`, LSTM은 그 4배, GRU는 3배에 편향 한 벌(3 × units)이 더 붙는다.
- IMDB 데이터는 0, 1, 2번이 예약돼 있어서 사전 번호와 3만큼 어긋난다.
- `pad_sequences`는 기본이 앞을 자르고 앞을 채운다. 분류(마지막 은닉상태)는 `'pre'`, 토큰마다 답을 내는 NER은 `'post'`.
- one-hot은 메모리에서 진다. 8MB가 8GB가 된다.
- 모델 파일 외에 사전과 `max_len` 같은 설정도 같이 저장한다.
- LSTM은 셀 상태를 덮어쓰지 않고 곱하고 더하기만 해서 기억을 오래 유지한다.
- 순환층의 드롭아웃은 층의 `dropout=` 인자로 준다. `recurrent_dropout`은 GPU 가속을 못 쓴다.
- 순환층을 쌓으면 마지막을 뺀 전부에 `return_sequences=True`. 2층의 inputs는 1층의 units다.
- `Bidirectional`은 출력 폭이 2배가 된다. `TimeDistributed`는 한 층을 모든 타임스텝에 공유한다.
- 층을 쌓는다고 좋아지지 않는다. 2층 LSTM이 다섯 모델 중 가장 나빴다.
- `best_epoch`은 0부터 센다.
- NER은 BIO로 태깅하고, 태그 토크나이저는 `lower=False`다. 라벨이 (문장, 토큰, 태그) 3차원이다.
- O가 대부분이라 NER의 정확도는 부풀려진다. F1(`seqeval`)로 본다.
- 예측할 때도 훈련 때와 같은 단위(형태소)로 잘라야 한다.

## 오늘 배운 내용 정리
오늘은 순환 신경망으로 리뷰를 분류하고, 게이트를 단 순환층을 비교하고, 토큰마다 답을 내는 개체명 인식을 만들었다.

```
SimpleRNN: 같은 층을 타임스텝마다 반복. 은닉상태 = 메모지. units × (inputs + units + 1).
IMDB: 이미 정수화, 오프셋 3. pad_sequences(maxlen=100)는 앞을 자르고 앞을 채운다.
one-hot → Embedding: 8GB → 8MB, 정확도 0.785 → 0.808.
LSTM: 셀 상태 + 게이트 4개 → 파라미터 4배. dropout=은 층 인자로.
쌓기: 마지막을 뺀 순환층에 return_sequences=True.
GRU: 게이트 3개, 3배 + 편향 한 벌. bi-LSTM: 양방향, 출력 폭 2배.
NER: BIO 태깅. Embedding → Bidirectional(LSTM, return_sequences=True) → TimeDistributed(Dense(softmax)).
평가: 정확도 95.7% vs F1 66.2%. 예측 전처리는 훈련과 같은 형태소 단위로.
```

순환층이 층을 100개 쌓은 게 아니라 같은 층 하나를 100번 돌리는 거라는 게 가장 기억에 남았다. 그래서 파라미터가 문장 길이와 상관없고, LSTM으로 바꾸면 그 안의 계산이 4벌이라 정확히 4배가 된다. 공식 하나로 SimpleRNN, LSTM, GRU, 양방향까지 다 설명되는 게 신기했다. 그리고 NER에서 정확도 95.7%가 F1 66%로 떨어지는 걸 보면서, 클래스가 쏠린 문제에서는 정확도를 의심해야 한다는 걸 또 한 번 확인했다.

---
