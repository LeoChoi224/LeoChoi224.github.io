---
layout: single
title: "딥러닝 기초 정리 5 - 케라스 Tokenizer와 패딩, 원-핫과 임베딩, Conv1D 문장 감정 분류"
categories: [coding, DeepLearning]
tag: [study-log, DeepLearning, NLP, Tokenizer, pad_sequences, one-hot, Embedding, Conv1D, N-gram, HuggingFace]
toc: true
author_profile: false
sidebar:
    nav: "docs"
search: true
---
<hr/>

어제 정수 인코딩을 손으로 30줄쯤 짰는데, 오늘은 그걸 케라스 `Tokenizer` 세 줄로 줄이고 문장마다 다른 길이를 패딩으로 맞췄다. 그다음 단어 번호를 벡터로 바꾸는 원-핫 인코딩과 임베딩을 배웠고, 마지막에 이미지에 쓰던 합성곱을 문장에 눕혀서 챗봇 문장의 감정을 분류하는 모델을 만들었다.

## 케라스 Tokenizer

```python
from tensorflow.keras.preprocessing.text import Tokenizer

tokenizer = Tokenizer()
tokenizer.fit_on_texts(preprocessed_sentences)

tokenizer.word_index
# {'barber': 1, 'secret': 2, 'huge': 3, 'kept': 4, 'person': 5, 'word': 6,
#  'keeping': 7, 'good': 8, 'knew': 9, 'driving': 10, 'crazy': 11, 'went': 12, 'mountain': 13}
tokenizer.word_counts
# OrderedDict({'barber': 8, 'person': 3, 'good': 1, 'huge': 5, ...})
tokenizer.texts_to_sequences(preprocessed_sentences)
# [[1, 5], [1, 8, 5], [1, 3, 5], [9, 2], [2, 4, 3, 2], ...]
```

`fit_on_texts()`가 어제 짠 빈도 세기, 정렬, 번호 매기기를 대신한다. 결과도 빈도 높은 순으로 1번부터라 어제와 같은데, 어제처럼 빈도 1인 단어를 버리지 않고 전부 남긴다. `fit_on_texts()`로 사전을 한 번 만들고, `texts_to_sequences()`로 그 사전을 써서 글자를 숫자로 바꾼다. 머신러닝 첫 주에 배운 `fit` / `transform` 구조 그대로다.

### num_words는 꺼낼 때 적용된다

```python
vocab_size = 5
tokenizer = Tokenizer(num_words=vocab_size + 1)
tokenizer.fit_on_texts(preprocessed_sentences)

tokenizer.word_index                                # 13개 전부 나온다
tokenizer.texts_to_sequences(preprocessed_sentences)
# [[1, 5], [1, 5], [1, 3, 5], [2], [2, 4, 3, 2], ...]
```

`num_words`는 0부터 세서, 5를 주면 0~4번까지만 남아 실제 단어는 1~4번 4개뿐이다. 0번이 패딩용으로 예약돼 있어서 단어 5개를 쓰려면 `+1`을 한다. 그런데 상위 5개만 쓰라고 했는데 `word_index`에는 13개가 다 나와서 처음엔 안 먹힌 줄 알았다. `Tokenizer`는 사전을 전부 만들어두고 `texts_to_sequences()`로 꺼낼 때만 상위 N개로 제한한다. 그래서 `num_words`를 바꿔가며 실험할 때 `fit`을 다시 안 해도 된다.

두 번째 문장을 보면 문제가 있다. `['barber', 'good', 'person']`이 `[1, 5]`가 됐다. 사전 밖 단어 `good`이 통째로 빠져서 문장 길이까지 바뀌었다. 어제 직접 짠 코드는 모르는 단어를 OOV 번호로 바꿔서 `[1, 6, 5]`로 자리를 남겼는데, 이건 그냥 없앤다. 문장 구조를 살리려면 `oov_token`을 줘야 한다.

```python
tokenizer = Tokenizer(num_words=vocab_size + 2, oov_token='OOV')
tokenizer.fit_on_texts(preprocessed_sentences)
tokenizer.word_index
# {'OOV': 1, 'barber': 2, 'secret': 3, 'huge': 4, 'kept': 5, 'person': 6, ...}
tokenizer.texts_to_sequences(preprocessed_sentences)
# [[2, 6], [2, 1, 6], [2, 4, 6], [1, 3], [3, 5, 4, 3], ..., [1, 1, 4, 3, 1, 2, 1], ...]
```

OOV가 1번을 가져가고 나머지가 한 칸씩 밀린다. 0번은 패딩, 1번은 OOV라서 `+2`다. 이제 두 번째 문장이 `[2, 1, 6]`으로 세 개가 유지됐다. `word_index` 자체를 잘라내고 싶으면 `num_words` 없이 만든 다음 `dict(list(tokenizer.word_index.items())[:vocab_size])`처럼 어제 배운 패턴으로 직접 자르면 된다. 사전을 저장해서 서비스에 넘길 때 안 쓰는 단어까지 같이 저장되는 걸 막을 수 있다.

## 패딩

```python
from tensorflow.keras.preprocessing.sequence import pad_sequences

pad_sequences(encoded)
# [[ 0,  0,  0,  0,  0,  1,  5],      ← 앞에 0
#  [ 0,  0,  0,  0,  1,  8,  5], ...]
pad_sequences(encoded, padding='post')
# [[ 1,  5,  0,  0,  0,  0,  0],      ← 뒤에 0
#  [ 1,  8,  5,  0,  0,  0,  0], ...]
```

모델은 길이가 같은 입력만 받아서, 짧은 문장을 0으로 채워 길이를 맞춘다. 기본값이 앞쪽(`'pre'`)이라 처음엔 당황했다. RNN은 앞에서 뒤로 읽으면서 기억을 쌓아서 뒤에 0이 잔뜩 있으면 마지막 기억이 0으로 덮이니 앞쪽 패딩이 낫고, CNN은 위치를 훑으며 최댓값을 뽑으니 어디에 있든 상관이 적어서 오늘은 `'post'`를 썼다.

```python
pad_sequences(encoded, padding='post', maxlen=5)
# 원본 [7, 7, 3, 2, 10, 1, 11] → [3, 2, 10, 1, 11]     truncating='pre' (기본)
pad_sequences(encoded, padding='post', maxlen=5, truncating='post')
# 원본 [7, 7, 3, 2, 10, 1, 11] → [7, 7, 3, 2, 10]
```

`maxlen`을 주면 긴 문장이 잘리는데, 자르는 쪽을 정하는 `truncating`도 기본값이 `'pre'`라 앞이 잘린다. `padding`과 `truncating`은 별개 옵션이라 `padding='post'`만 주면 자르는 건 여전히 앞에서 한다. `value=`로 패딩값을 0이 아닌 다른 숫자로 바꿀 수도 있지만, 그만큼 사전 크기가 늘고 `Embedding(mask_zero=True)` 같은 옵션이 0을 패딩으로 가정하고 있어서 특별한 이유가 없으면 0을 쓴다.

### HuggingFace 토크나이저

```python
from transformers import AutoTokenizer
tokenizer = AutoTokenizer.from_pretrained("bert-base-uncased")

encodings = tokenizer(["I love Pytorch", "It is great"],
                      padding=True, truncation=True, return_tensors="pt")
encodings.input_ids
# tensor([[  101,  1045,  2293,  1052, 22123,  2953,  2818,   102],
#         [  101,  2009,  2003,  2307,   102,     0,     0,     0]])
encodings.attention_mask
# tensor([[1, 1, 1, 1, 1, 1, 1, 1],
#         [1, 1, 1, 1, 1, 0, 0, 0]])
```

토큰화, 정수 인코딩, 패딩이 한 줄에 다 됐다. `input_ids`는 토큰 번호, `token_type_ids`는 문장 쌍에서 어느 문장인지, `attention_mask`는 실제 단어는 1이고 패딩은 0이다. 케라스 `pad_sequences`는 0을 채워 넣기만 하고 "이건 가짜다"라는 표시가 없어서 모델이 0도 단어로 취급할 수 있는데, `attention_mask`가 있으면 모델이 패딩을 아예 무시한다. 101과 102는 BERT가 문장 앞뒤에 자동으로 붙이는 특수 토큰 `[CLS]`(문장 시작, 분류할 때 이 자리의 출력을 쓴다)와 `[SEP]`(문장 끝)이다. `[PAD]`는 패딩, `[UNK]`는 케라스의 OOV에 해당한다.

수업 코드에는 `truncatuin=True`라고 오타가 있었는데 에러가 안 났다. HuggingFace 토크나이저는 모르는 키워드 인자를 조용히 넘긴다. 지금은 문장이 짧아서 결과가 같지만 긴 문장이 들어오면 모델이 받을 수 있는 길이(512)를 넘겨 에러가 난다.

```python
tokenizer = AutoTokenizer.from_pretrained('klue/bert-base')
tokenizer.tokenize("안녕하세요. 오늘 날씨가 정말 좋네요!")
# ['안녕', '##하', '##세요', '.', '오늘', '날씨', '##가', '정말', '좋', '##네', '##요', '!']
```

한국어 사전학습 토크나이저도 서브워드로 쪼갠다. KoNLPy 형태소 분석과 결과가 비슷해 보이지만 원리가 다르다. Okt는 문법 규칙과 사전으로 쪼개고, BERT는 말뭉치에서 자주 붙어 다니는 글자 조각을 학습한 것이라 문법을 모른다. 그래도 잘 된다는 게 요즘 NLP의 특징이다. 수업에서 `kobert-transformers`도 설치해봤는데, 오래된 패키지라 `transformers` 5.x를 지우고 4.x를 깔고도 import가 실패했다. 한국어 BERT가 필요하면 `klue/bert-base`를 `AutoTokenizer` 하나로 쓰면 된다.

## 원-핫 인코딩과 임베딩
문장을 `[2, 5, 1, 0, 0]`처럼 숫자로 만들었지만, 이 번호를 그대로 모델에 넣으면 문제가 있다. 숫자에 순서가 생겨버린다. 1번 '갈래'와 7번 '최고야'는 모델 입장에서 6만큼 차이 나는 값인데, 그 6은 빈도순으로 매긴 번호일 뿐 아무 의미가 없다. 신경망은 곱하고 더하는데 "3번 = 1번 + 2번" 같은 계산도 성립하지 않는다. 그래서 번호를 벡터로 바꾼다.

### 원-핫 인코딩

```python
tokens = okt.morphs("나는 자연어 처리를 배운다")
# ['나', '는', '자연어', '처리', '를', '배운다']
word_to_index = {word: index for index, word in enumerate(tokens)}

def one_hot_encoding(word, word_to_index):
    one_hot_vector = [0] * len(word_to_index)
    one_hot_vector[word_to_index[word]] = 1
    return one_hot_vector

one_hot_encoding('자연어', word_to_index)   # [0, 0, 1, 0, 0, 0]
```

단어 집합(중복 없이 모은 단어)의 크기를 벡터의 차원으로 하고, 표현하려는 단어의 자리에만 1을 준다. 좌석표에서 내 자리에만 표시하는 것이다.

```python
text = "나랑 점심 먹으러 갈래 점심 메뉴는 햄버거 갈래 갈래 햄버거 최고야"
tokenizer = Tokenizer()
tokenizer.fit_on_texts([text])
# {'갈래': 1, '점심': 2, '햄버거': 3, '나랑': 4, '먹으러': 5, '메뉴는': 6, '최고야': 7}

encoded = tokenizer.texts_to_sequences(["점심 먹으러 갈래 메뉴는 햄버거 최고야"])[0]
# [2, 5, 1, 6, 3, 7]
to_categorical(encoded)       # (6, 8)

import torch.nn.functional as F
F.one_hot(torch.tensor([0, 2, 1, 7]), num_classes=8).float()   # (4, 8)
```

케라스 `to_categorical`은 데이터의 최댓값이 7이라 0~7까지 8칸짜리 벡터를 만든다. 0번은 안 쓰는데도 자리를 차지한다. 파이토치 `F.one_hot`은 `num_classes`를 직접 적고 정수를 돌려줘서 모델 입력용으로는 `.float()`로 바꾼다. 크기를 데이터의 최댓값으로 정하게 두면 배치마다 최댓값이 달라져 크기가 들쭉날쭉해질 수 있으니 명시하는 게 안전하다.

원-핫에는 한계가 두 가지 있다. 첫째는 저장 공간이다. 단어가 5,000개면 벡터 하나가 5,000차원이고 그중 4,999개가 0이다. 15단어 문장이면 75,000개 숫자 중 의미 있는 건 15개뿐인 희소 벡터다. 둘째는 유사도를 못 담는다는 것이다. '오사카 숙소'를 검색하면 사람은 '호텔'과 '게스트하우스'가 비슷하다는 걸 아는데, 원-핫으로는 모든 단어 사이의 거리가 똑같아서 숙소로 검색했을 때 호텔을 같이 보여줄 근거가 없다. 이걸 해결하는 방법으로 LSA 같은 카운트 기반, Word2Vec이나 FastText 같은 예측 기반, 둘을 섞은 GloVe가 있다고 한다.

### 임베딩
임베딩은 단어에 좌표를 주는 것이다. 뜻이 비슷한 단어는 가까운 자리에 놓이도록. 원-핫이 5,000차원에 거의 전부 0이라면, 임베딩은 128차원쯤에 전부 의미 있는 실수가 들어 있는 밀집 벡터다.

```python
embedding = nn.Embedding(num_embeddings=10, embedding_dim=4)
embedded = embedding(torch.tensor([2, 5, 7]))
print(embedded.shape)     # torch.Size([3, 4])
print(embedded)
# tensor([[-0.2271, -0.8260, -0.2969,  0.0178],
#         [ 0.2391,  0.3225, -0.9725, -0.6240],
#         [ 1.2212, -0.8302,  0.1404, -1.1139]], grad_fn=<EmbeddingBackward0>)

embedding(torch.tensor([[1, 2, 3], [4, 5, 6]])).shape   # (2, 3) → (2, 3, 4)
```

숫자 하나가 4개짜리 벡터가 됐고, `grad_fn=<EmbeddingBackward0>`이 붙어 있다. 지난주 Autograd에서 배운 대로 이 층이 학습된다는 표시다. 임베딩 벡터는 미리 정해진 값이 아니라 처음엔 랜덤이고, 모델이 문제를 풀면서 비슷한 뜻이면 가까이 두는 게 유리하다는 걸 스스로 배운다. 그러니 "임베딩을 쓰면 유사도가 생긴다"가 아니라 "훈련하면 생긴다"가 정확하다. 배치로 넣으면 `(batch, 문장 길이)`가 `(batch, 문장 길이, embedding_dim)`이 된다.

임베딩은 이름이 층이라 행렬곱을 한다고 오해하기 쉬운데 실제로는 표에서 그 줄을 꺼내오는 조회(lookup)다. 원-핫 벡터에 가중치 행렬을 곱하는 것과 수학적으로 결과가 같은데, 0을 5,000번 곱하지 않고 해당 줄만 꺼내와서 빠르다. 그래서 입력은 인덱스라 정수(LongTensor)여야 하고 출력은 실수다. 그리고 인덱스가 0~9까지만 유효해서 10을 넣으면 `IndexError`가 난다. 케라스 `Tokenizer`는 1번부터 번호를 매기고 0을 패딩으로 비워두니, 임베딩을 만들 때는 `vocab_size = len(word_index) + 1`로 한 칸 더 잡는다.

케라스 `Embedding(input_dim=vocab_size, output_dim=embedding_dim)`도 하는 일은 같고 인자 이름만 다르다. 원-핫은 이제 입력 쪽에서는 거의 안 쓰고, 클래스가 3개쯤인 정답 레이블 쪽에서는 여전히 쓴다. 단어에 쓰면 5,000차원이라 문제고 레이블에 쓰면 3차원이라 괜찮은 것이다.

## Conv1D로 문장 감정 분류
챗봇의 첫 관문으로, 사용자가 입력한 문장이 일상 얘기인지, 이별 얘기인지, 사랑 얘기인지 분류하는 모델을 만들었다. 그런데 CNN은 이미지용이라고 배웠는데 왜 문장에 쓸까. 이웃한 것을 묶어서 본다는 성질이 문장에도 통하기 때문이다. 이미지에서 이웃한 픽셀이 모서리를 이루듯 문장에서 이웃한 단어가 표현을 이룬다. "not good"은 두 단어를 붙여 봐야 부정인 걸 안다.

### 데이터와 전처리

```python
data = pd.read_csv(os.path.join(base_path, 'chatbot_data.csv'))
data.shape                       # (11823, 3)  Q, A, label
data['label'].value_counts()     # 0: 5290 (일상), 1: 3570 (이별/부정), 2: 2963 (사랑/긍정)

features = data['Q'].tolist()
labels = data['label'].tolist()

corpus = [preprocessing.text.text_to_word_sequence(text) for text in features]
tokenizer = preprocessing.text.Tokenizer()
tokenizer.fit_on_texts(corpus)
sequences = tokenizer.texts_to_sequences(corpus)
word_index = tokenizer.word_index
len(word_index)                  # 13398
```

질문(Q)만 입력으로 쓰고 답(A)은 안 쓴다. 단어가 13,398개나 나왔는데, 형태소 분석 없이 띄어쓰기로만 잘라서 '좋아하는', '좋아했으면', '좋아해'가 전부 다른 단어가 됐기 때문이다. 어제 한국어는 형태소로 잘라야 한다고 배웠으니 Okt로 바꾸면 사전이 훨씬 작아질 것이다.

```python
MAX_SEQ_LEN = 15     # 가장 긴 문장의 단어 수
padded_seqs = preprocessing.sequence.pad_sequences(
    sequences, maxlen=MAX_SEQ_LEN, padding='post')
padded_seqs.shape    # (11823, 15)

ds = tf.data.Dataset.from_tensor_slices((padded_seqs, labels))
ds = ds.shuffle(len(features), seed=42)

train_size = int(len(padded_seqs) * 0.7)
val_size = int(len(padded_seqs) * 0.2)
train_ds = ds.take(train_size).batch(20)
val_ds = ds.skip(train_size).take(val_size).batch(20)
test_ds = ds.skip(train_size + val_size).batch(20)
print(len(train_ds), len(val_ds), len(test_ds))     # 414 119 60
```

CNN 입력층은 고정된 개수의 입력 노드라 문장 길이를 맞춰야 한다. `MAX_SEQ_LEN`은 너무 크게 잡으면 빈 공간이 많아 메모리 낭비이고, 너무 작게 잡으면 입력이 잘린다. 데이터는 훈련, 검증, 테스트를 7:2:1로 나눴다. 보통 7:2:1이나 6:2:2로 잡는다고 한다.

### Conv1D와 N-gram
N-gram은 연속된 N개의 토큰을 하나로 묶은 것이다. "나는 밥을 먹는다"에서 Unigram은 [나는], [밥을], [먹는다], Bigram은 [나는 밥을], [밥을 먹는다], Trigram은 [나는 밥을 먹는다]다. 단어 하나만으로는 놓치는 "not good" 같은 표현을 묶어서 잡을 수 있다.

```python
conv1 = Conv1D(filters=128, kernel_size=3, padding='valid', activation='relu')(dropout_emb)
conv2 = Conv1D(filters=128, kernel_size=4, padding='valid', activation='relu')(dropout_emb)
conv3 = Conv1D(filters=128, kernel_size=5, padding='valid', activation='relu')(dropout_emb)
```

`Conv1D`의 커널 크기가 곧 몇 단어씩 볼지다. 창문 세 개를 문장 위에 대고 옆으로 밀며 훑는데, 창문 크기가 3, 4, 5라 세 단어씩, 네 단어씩, 다섯 단어씩 본다. 3, 4, 5-gram과 같은 개념이다. 지난주의 `Conv2D`가 이미지 위를 가로, 세로 두 방향으로 움직였다면 `Conv1D`는 문장 위를 한 방향으로만 움직인다. 그리고 `Conv1D`의 채널은 임베딩 차원이다.

```
입력  (batch, 15, 128)    15단어 × 128차원 임베딩
필터  (3, 128) × 128개    3단어를 한 번에 보고 128가지 특징
출력  (batch, 13, 128)    15 - 3 + 1 = 13
파라미터 (3 × 128 + 1) × 128 = 49,280
```

### GlobalMaxPool1D와 concatenate

```python
pool1 = GlobalMaxPool1D()(conv1)     # (batch, 13, 128) → (batch, 128)
concat = concatenate([pool1, pool2, pool3])     # (batch, 384)
```

`GlobalMaxPool1D`는 13개 위치 중에서 각 특징마다 가장 강하게 반응한 곳 하나만 남겨서 길이 축을 통째로 없앤다. "이 문장 어딘가에 이 표현이 있었나?"만 보고 어디 있었는지는 버린다. 문장 분류에서는 부정 표현이 있었다는 게 중요하지 5번째 단어에 있었다는 건 별로 안 중요하다. 게다가 문장 길이가 달라도 출력이 항상 128이다. `Flatten`이었다면 커널마다 길이가 달라진다.

세 갈래를 `concatenate`로 합쳐서 128 × 3 = 384가 된다. 지난주에 배운 Functional API가 여기서 진짜로 쓰였다. 그때 본 예제는 세 갈래가 전부 같은 설정이라 의미가 적었는데, 여기서는 커널 크기가 3, 4, 5로 달라서 서로 다른 크기의 표현을 동시에 잡는다.

```
                    ┌─ Conv1D(3) → GlobalMaxPool1D ─┐
Input → Embedding ──┼─ Conv1D(4) → GlobalMaxPool1D ─┼─ concat → Dense → Dense(3)
        → Dropout   └─ Conv1D(5) → GlobalMaxPool1D ─┘
```

```python
input_layer = Input(shape=(MAX_SEQ_LEN,))
embedding_layer = Embedding(VOCAB_SIZE, EMB_SIZE)(input_layer)    # VOCAB_SIZE = len(word_index) + 1
dropout_emb = Dropout(rate=0.5)(embedding_layer)
# conv1, conv2, conv3 → pool1, pool2, pool3
concat = concatenate([pool1, pool2, pool3])
hidden = Dense(128, activation='relu')(concat)
dropout_hidden = Dropout(rate=0.5)(hidden)
predictions = Dense(3, activation='softmax')(dropout_hidden)
model = Model(inputs=input_layer, outputs=predictions)
# Total params: 1,961,731
```

파라미터가 어디에 몰려 있는지 보니 놀라웠다. 임베딩이 `13,399 × 128 = 1,715,072`개로 전체의 87%였고, Conv1D 세 개를 합쳐 10%, 밀집층은 2.5%였다. CIFAR-10에서는 밀집층이 94%였는데, 이미지 모델은 뒤가 무겁고 텍스트 모델은 앞이 무겁다. 사전을 형태소 분석으로 5,000개로 줄이면 임베딩만 171만에서 64만으로 줄어든다.

출력층 주석에는 "활성화 함수를 사용하지 않는다, 결과로 나온 값을 logits라 부른다"고 적혀 있었는데 코드에는 `softmax`가 붙어 있었다. 어제 배운 파이토치 관례로 주석이 적힌 것 같다. 케라스에서는 모델에 `softmax`를 붙이는 게 맞고, 로짓으로 두려면 손실 함수에 `from_logits=True`를 줘야 한다.

### 학습과 저장

```python
model.compile(optimizer='adam', loss='sparse_categorical_crossentropy', metrics=['accuracy'])
model.fit(train_ds, validation_data=val_ds, epochs=5)
# Epoch 5/5  accuracy: 0.9561 - loss: 0.1375 - val_accuracy: 0.9818 - val_loss: 0.0590
model.evaluate(test_ds)    # Accuracy: 98.309386

model.save(model_path)
with open(tokenizer_path, "w", encoding="utf-8") as f:
    f.write(tokenizer.to_json())
```

모델뿐 아니라 사전(Tokenizer)도 같이 저장해야 한다. 붓꽃에서 스케일러를 같이 저장해야 했던 것과 정확히 같은 문제다. 서비스에서 사전을 새로 만들면 학습 때 2번이던 '좋아하는'이 47번이 될 수도 있고, 번호가 어긋나면 모델은 완전히 다른 단어를 읽는다. 에러도 안 난다. pickle은 파이썬이나 텐서플로 버전에 따라 호환성 문제가 생길 수 있어서, 배포할 때는 그냥 텍스트인 JSON이 권장된다. 불러올 때는 `tokenizer_from_json()`을 쓴다.

### 실제 문장 예측

```python
classes = ['일상', '부정적', '긍정적']

def pred(text):
    corpus = preprocessing.text.text_to_word_sequence(text)
    sequences = tokenizer.texts_to_sequences([corpus])
    padded_seqs = preprocessing.sequence.pad_sequences(
        sequences, maxlen=MAX_SEQ_LEN, padding='post')
    predict = model.predict(padded_seqs)
    print(f'{text} -> {classes[predict.argmax()]}')
```

예측할 때는 학습에 사용한 정보가 반드시 필요하다. 같은 방식의 토큰화, 같은 사전, 같은 `MAX_SEQ_LEN`. FashionMNIST에서 흑백 → 반전 → 리사이즈 → 정규화를 똑같이 해야 했던 것과 같다.

```
가스불 켜놓고 나온거 같아                    -> 일상
어떻게 해야 여자친구가 제 진심을 알아줄까      -> 부정적
업무 스트레스 넘 심해                       -> 일상
남친이랑 뭐하고 놀지                        -> 긍정적
내가 좋아하는 사람이 날 좋아했으면 좋겠어.     -> 긍정적
원본 데이터가 이상해요                      -> 부정적
내가 최대한 잘해줘도 불만이 많아              -> 긍정적
```

테스트 정확도가 98%인데 7문장 중 두세 개가 어색했다. 이유가 여러 겹이었다.

첫째, 데이터 누수다. 지난주 `tf.data`에서 정리한 문제가 그대로 있었다. `shuffle()`의 `reshuffle_each_iteration`이 기본 `True`라서 `train_ds`를 돌 때와 `test_ds`를 돌 때 섞는 순서가 달라지고, 테스트 세트에 훈련에서 본 문장이 섞여 들어갈 수 있다. `reshuffle_each_iteration=False`로 고정해야 한다. 노트북 뒤쪽에서 `ds.take(2000)`으로 다시 평가한 98.05%는 셔플된 데이터의 앞 2,000개라 아예 전부 훈련 데이터 안에 있는 숫자였다. 새 데이터로 평가하려면 `skip`을 써야 한다.

둘째, 학습 데이터의 편향이다. 챗봇 데이터가 연애 이야기 위주라 "원본 데이터가 이상해요" 같은 문장은 배운 적이 없다.

셋째, 사전에 없는 단어다. `oov_token` 없이 만든 사전이라 '원본', '스트레스' 같은 단어가 사전에 없으면 조용히 사라지고, 아무 정보 없이 판단하게 된다. 아무 뜻 없는 문장을 넣어도 모델은 셋 중 하나로 답한다. 소프트맥스는 항상 어딘가에 확률을 몰아주니 모르겠다고 말할 방법이 없다. 실무에서는 최고 확률이 0.6보다 낮으면 "분류하기 어려운 문장"으로 처리한다고 한다. 챗봇이 "무슨 말인지 잘 모르겠어요"라고 답하는 게 이 처리다.

그리고 `predict.argmax()`에 `axis`가 없는데, 문장 하나만 넣을 때는 (1, 3)을 평평하게 펴도 0~2가 나와서 우연히 맞는다. 두 문장 이상이면 (2, 3)에서 0~5가 나와 `IndexError`가 난다. `(batch, classes)`에서는 `axis=1`이다.

## 헷갈리기 쉬운 부분
- `Tokenizer`의 `num_words`는 `texts_to_sequences()`에서만 적용된다. `word_index`는 전부 남는다.
- `oov_token`이 없으면 사전 밖 단어가 조용히 사라져 문장 길이까지 바뀐다. 있으면 OOV가 1번을 차지해서 `num_words=vocab_size+2`다.
- `pad_sequences`의 `padding`과 `truncating`은 별개이고 둘 다 기본이 `'pre'`다. CNN은 `'post'`, RNN은 `'pre'`.
- HuggingFace 토크나이저는 `attention_mask`로 패딩을 표시하고, 모르는 인자를 조용히 넘긴다.
- 단어 번호를 그대로 넣으면 의미 없는 순서와 크기가 생긴다.
- 원-핫은 희소하고 유사도를 못 담는다. 임베딩은 밀집 벡터이고 훈련으로 의미가 생긴다.
- `nn.Embedding`은 조회 표라 입력이 정수여야 하고, `vocab_size = len(word_index) + 1`로 잡는다.
- `Conv1D`의 `kernel_size`는 몇 단어씩 볼지다. 채널은 임베딩 차원이다.
- `GlobalMaxPool1D`는 길이 축을 없애서 문장 길이와 상관없이 출력 크기가 고정된다.
- 텍스트 모델은 파라미터가 임베딩에 몰린다. 사전 크기가 모델 크기를 정한다.
- 모델과 사전은 한 쌍이다. 사전은 JSON으로 저장한다.
- 셔플 뒤 `take`/`skip`으로 나눌 때는 `reshuffle_each_iteration=False`를 준다.
- 예측 결과가 (batch, classes)면 `argmax(axis=1)`이다.

## 오늘 배운 내용 정리
오늘은 케라스 Tokenizer와 패딩, 원-핫과 임베딩을 배우고 Conv1D로 문장 감정 분류 모델을 만들었다.

```
Tokenizer: fit_on_texts → word_index / word_counts → texts_to_sequences.
           num_words=N+2, oov_token='OOV' (0은 패딩, 1은 OOV).
패딩: pad_sequences(padding='post', maxlen, truncating). HuggingFace는 attention_mask까지.
원-핫: 사전 크기만큼 길고 자리 하나만 1. 희소하고 유사도가 없다. to_categorical / F.one_hot.
임베딩: 정수 → 밀집 실수 벡터. 조회 표이자 학습되는 층. vocab_size = len(word_index) + 1.
문장 CNN: Embedding → Conv1D(3, 4, 5) → GlobalMaxPool1D → concatenate → Dense → Dense(3, softmax).
저장: model.save + tokenizer.to_json(). 예측은 같은 토큰화, 같은 사전, 같은 MAX_SEQ_LEN.
```

이미지를 훑던 합성곱을 문장에 눕혀놓으니 커널 크기가 그대로 N-gram이 된다는 게 가장 기억에 남았다. 다른 데이터인데 "이웃한 것을 묶어서 본다"는 생각 하나로 같은 도구가 통했다. 그리고 98% 정확도 모델이 실제 문장에서 자꾸 틀리는 걸 보면서, 숫자가 높을 때일수록 데이터가 어떻게 나뉘었는지부터 의심해봐야 한다는 걸 다시 느꼈다.

---
