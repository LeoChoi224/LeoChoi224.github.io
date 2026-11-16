---
layout: single
title: "딥러닝 기초 정리 8 - GPT, 다음 토큰 하나를 뽑는 모델과 KoGPT-2 챗봇"
categories: [coding, DeepLearning]
tag: [study-log, DeepLearning, GPT, KoGPT2, HuggingFace, Causal-LM, logits, top-k, GradientTape, chatbot]
toc: true
author_profile: false
sidebar:
    nav: "docs"
search: true
---
<hr/>

딥러닝 단원의 마지막 수업이었다. 어제 트랜스포머의 인코더만 쌓은 BERT로 문장을 분류했다면, 오늘은 반대로 디코더만 남긴 GPT를 다뤘다. 한국어 GPT-2(KoGPT-2)로 문장을 이어 써보고, 모델이 실제로 내놓는 게 문장이 아니라 다음 토큰의 점수표라는 걸 확인하고, 마지막에 질문과 답변을 한 줄로 이어 붙여 학습시켜 챗봇을 만들었다. 오후부터는 컴퓨터 비전(OpenCV)이 시작됐는데, 그건 따로 정리한다.

## GPT는 왜 디코더만 쓰나
어제 만든 트랜스포머는 번역기였다. 인코더가 원문을 읽어 요약해두면 디코더가 그걸 보면서 번역문을 쓰는, 입력 문장이 반드시 있어야 하는 구조다. 그런데 ChatGPT 같은 건 번역할 원문이 따로 없다. 앞에 쓰다 만 글이 있고 그 뒤를 이어 쓴다. 원문을 읽어줄 인코더가 필요 없어서 인코더를 통째로 들어내고 디코더만 남긴 게 GPT다.

| 구분 | BERT | GPT |
|---|---|---|
| 트랜스포머의 어느 쪽 | 인코더 | 디코더 |
| 하는 일 | 문장 이해 (분류, 개체명 인식) | 문장 생성 (이어쓰기) |
| 볼 수 있는 것 | 앞뒤 전부 | 앞쪽만 |

핵심은 마지막 줄이다. 다음 단어를 맞히는 시험을 치는데 정답이 적힌 뒷부분을 미리 보면 안 된다. 그래서 디코더의 셀프 어텐션에는 어제 배운 룩-어헤드 마스크가 걸려 있어서 t번째 토큰을 계산할 때 t+1 이후를 못 본다. 이 마스크가 없으면 정답을 보고 정답을 맞히는 셈이라 손실이 0으로 떨어지고 아무것도 안 배운다. 그래서 GPT류를 Causal LM(인과적 언어 모델)이라고도 부른다. 디코더에서 실제로 빠진 인코더-디코더 어텐션은 읽을 원문이 없어졌으니 쳐다볼 곳도 없어졌다는 정도의 이야기다.

| 구분 | GPT-1 | GPT-2 | GPT-3 |
|---|---|---|---|
| 파라미터 | 1억 1700만 | 15억 | 1,750억 |
| 디코더 층 | 12 | 48 | 96 |
| 토큰 길이 | 512 | 1024 | 2048 |

GPT-1에서 3까지는 구조가 아니라 크기가 달라졌다. GPT-3는 새 아키텍처를 아예 제안하지 않고 그냥 키웠다. 그런데 키우자 없던 능력이 생겼다. 예시 몇 개만 프롬프트에 적어주면 다시 학습시키지 않아도 새 문제를 푸는 few-shot 능력이 GPT-2에는 사실상 없었다고 한다. 성능이 크기에 따라 매끄럽게 오르는 게 아니라 어느 지점을 넘으면 툭 나타나는 걸 창발이라고 부른다. 연구의 축이 "어떻게 개선할까"에서 "얼마나 키울까"로 넘어간 지점이라는 설명이 인상적이었다.

## KoGPT-2로 이어쓰기

```python
!pip install "transformers>=4.0,<5.0"

model = TFGPT2LMHeadModel.from_pretrained('skt/kogpt2-base-v2', from_pt=True)
tokenizer = AutoTokenizer.from_pretrained('skt/kogpt2-base-v2')
```

`TF`는 텐서플로용이고, 파이토치용은 앞의 TF만 뗀 `GPT2LMHeadModel`이다. `LMHead`는 트랜스포머 본체가 낸 768차원 벡터를 어휘집 크기(5만 개 남짓)의 점수로 펼쳐주는 Linear 층이라, 이게 있어야 다음 토큰을 고를 수 있다. 이 저장소에는 파이토치 가중치만 있어서 `from_pt=True`로 옮겨 담는다. 첫 줄의 버전 상한도 중요하다. transformers v5에서 텐서플로 지원이 통째로 제거돼서, v5를 깔면 `TFGPT2LMHeadModel`이라는 이름 자체가 없어 `ImportError`가 난다고 한다.

로드하면 `Some weights of the PyTorch model were not used...`라는 경고와 함께 `masked_bias`, `lm_head.weight` 같은 이름이 쭉 찍히는데 정상이다. `masked_bias`는 causal mask를 옛 구현이 가중치처럼 저장해둔 상수이고, `lm_head.weight`는 GPT-2가 입력 임베딩과 같은 행렬을 공유해서 따로 안 불러오는 것이다. `h.0`부터 `h.11`까지 12개가 찍히는 건 이 모델의 디코더 층이 12개라는 증거다.

```python
sent = '근육이 커지기 위해서는'
input_ids = tf.convert_to_tensor([tokenizer.encode(sent)])   # [[33245 10114 12748 11357]]

output = model.generate(input_ids, max_length=128,
                        repetition_penalty=2.0, use_cache=True)
print(tokenizer.decode(output[0].numpy().tolist()))
# 근육이 커지기 위해서는 무엇보다 규칙적인 생활습관이 중요하다.
# 특히, 아침식사는 단백질과 비타민이 풍부한 과일과 채소를 많이 섭취하는 것이 좋다. ...
```

`[[...]]`로 한 겹 더 싼 건 배치 차원이다. `generate()`는 "다음 토큰 하나 뽑기"를 128개가 될 때까지 대신 반복해주는 함수이고, 모델 자체는 여전히 한 걸음씩만 간다. `repetition_penalty=2.0`은 이미 나온 토큰의 점수를 깎는다. 안 걸면 GPT-2는 "중요하다. 중요하다. 중요하다."처럼 같은 말을 반복하는 성질이 있다. `use_cache=True`는 5번째 토큰을 만들 때 1~4번째 계산을 다시 하지 않고 재사용해서 속도만 빨라진다. 노트북에 "실행 결과가 항상 동일할 거다"라는 주석이 있었는데, `generate()`의 기본이 매 걸음 점수 1등만 고르는 greedy 디코딩이라 주사위를 안 굴리기 때문이다.

### 모델의 진짜 출력은 점수표

```python
output = model(input_ids)              # generate()가 아니라 그냥 호출
top5 = tf.math.top_k(output.logits[0, -1], k=5)
tokenizer.convert_ids_to_tokens(top5.indices.numpy())
# ['▁무엇보다', '▁우선', '▁반드시', '▁피부', '▁무엇보다도']
```

모델에게 "다음에 뭐가 올 것 같아?"라고 물으면 문장이 아니라 어휘집의 모든 단어에 대한 점수표를 준다. `output.logits`의 모양은 `(배치, 문장 길이, 어휘 크기)`라 여기서는 `(1, 4, 51200)` 정도다. 마지막 토큰만 나오는 게 아니라 1번째 토큰 다음, 2번째 다음... 모든 시점의 예측이 다 들어 있어서, 지금 필요한 마지막 것만 `[0, -1]`(배치 0번, 마지막 토큰 자리)로 잘라 쓴다. 이 값은 소프트맥스를 거치기 전이라 확률이 아닌데, 소프트맥스는 순서를 바꾸지 않아서 상위 5개만 고를 거라면 굳이 확률로 바꿀 필요가 없다. `▁무엇보다` 앞의 `▁`는 KoGPT-2의 SentencePiece 토크나이저가 공백을 표시하는 기호다.

```python
input_ids = tokenizer.encode('근육이 커지기 위해서는')
while len(input_ids) < 50:
    output = model(np.array([input_ids]))
    top5 = tf.math.top_k(output.logits[0, -1], k=5)
    token_id = random.choice(top5.indices.numpy())   # 상위 5개 중 아무거나
    input_ids.append(token_id)
print(tokenizer.decode(input_ids))
```

`generate()`가 안에서 하는 일을 펼쳐 쓴 코드다. 1등을 고르지 않고 상위 5개 중에서 제비뽑기를 해서 돌릴 때마다 문장이 달라진다. top-k 샘플링을 손으로 구현한 셈인데, 진짜 `top_k` 옵션은 상위 k개를 똑같은 확률이 아니라 원래 확률 비율대로 뽑아서 90%짜리와 2%짜리를 같은 대접하지 않는다. 그래서 진짜 쪽이 문장이 덜 망가진다.

## 이어쓰기를 챗봇으로 바꾸기

### 특수 토큰

```python
tokenizer = AutoTokenizer.from_pretrained('skt/kogpt2-base-v2',
                                          bos_token='</s>', eos_token='</s>', pad_token='<pad>')
print(tokenizer.bos_token_id, tokenizer.eos_token_id, tokenizer.pad_token_id)   # 1 1 3
print(tokenizer.decode(2), tokenizer.decode(4))                                  # <usr> <sys>
```

시작 토큰과 끝 토큰이 둘 다 `</s>`(1번)인 건 KoGPT-2를 만든 쪽에서 그렇게 정해둔 것이다. 앞에 붙으면 시작, 뒤에 붙으면 끝으로 위치로 구분한다. `<usr>`, `<sys>`는 `decode(2)`, `decode(4)`가 그대로 나오는 걸 보면 이미 어휘집에 들어 있는, 대화 모델용으로 비워둔 자리다. 어휘집에 없는 기호였다면 `<`, `usr`, `>` 같은 조각으로 쪼개져서 화자 구분 표시가 아니라 이상한 글자가 됐을 것이다. 새로 넣으려면 `add_special_tokens()`로 어휘를 늘리고 `resize_token_embeddings()`로 모델의 임베딩 표도 같이 늘려야 한다.

### 질문과 답변을 한 줄로

```python
def get_chat_data():
    for question, answer in zip(train_data.Q, train_data.A):
        sent = tokenizer.encode('<usr>' + question + '<sys>' + answer)
        yield [tokenizer.bos_token_id] + sent + [tokenizer.eos_token_id]

dataset = tf.data.Dataset.from_generator(get_chat_data, output_types=tf.int32)
dataset = dataset.padded_batch(batch_size=32, padded_shapes=(None,),
                               padding_values=tokenizer.pad_token_id)
```

데이터는 지난주 감정 분류에 썼던 챗봇 데이터 11,823쌍이다. 이걸 풀어보면 이렇게 생겼다.

```
</s><usr> 12시 땡!<sys> 하루가 또 가네요.</s><pad><pad>...
```

이 한 줄이 오늘 수업에서 가장 중요한 아이디어였다. 질문-답변이라는 두 개짜리 문제가 아니라 처음부터 끝까지 이어진 문장 하나가 됐다. 모델은 여전히 이어쓰기만 하는데, 이어쓰기를 배우다 보니 `<sys>` 다음에는 답변이 온다는 걸 알게 된다. `padded_shapes=(None,)`은 길이를 미리 정하지 말고 그 배치 안에서 제일 긴 문장에 맞추라는 뜻이라, 전체 최대 길이로 통일하는 것보다 낭비가 적다. 첫 배치는 (32, 30)이었다.

### labels=batch - 입력과 정답이 같다?

```python
result = model(batch, labels=batch)
loss = result[0]
```

여기서 가장 많이 막혔다. 문제와 답이 같으면 그냥 베끼면 되는 것 아닌가. HuggingFace의 Causal LM은 `labels`를 받으면 내부에서 정답을 한 칸 밀어서 채점한다.

```
입력:  </s>  <usr>  12시   땡!   <sys>  하루가
정답:  <usr>  12시   땡!   <sys>  하루가   또
```

0번째 토큰을 보고 1번째를 맞혀라, 0~1번을 보고 2번째를 맞혀라... 가 한꺼번에 채점된다. 아까 본 "모든 시점의 logits"가 여기서 전부 쓰인다. 그래서 30토큰짜리 문장 하나가 곧 "다음 토큰 맞히기" 문제 29개이고, 사람이 정답 라벨을 따로 붙일 필요가 없다. 인터넷의 아무 글이나 학습 데이터가 될 수 있는 이유이고, 이걸 자기지도학습이라고 부른다. 마스크가 없으면 이 방식이 통하지 않는다는 것도 이제 보였다. 뒤를 볼 수 있으면 정답을 베끼면 되니까.

### GradientTape 학습 루프

```python
adam = tf.keras.optimizers.Adam(learning_rate=3e-5, epsilon=1e-08)
steps = len(train_data) // batch_size + 1    # 370

for epoch in range(EPOCHS):                  # 3
    for batch in tqdm.tqdm_notebook(dataset, total=steps):
        with tf.GradientTape() as tape:              # 이 안의 연산을 전부 기록
            result = model(batch, labels=batch)
            batch_loss = tf.reduce_mean(result[0])
        grads = tape.gradient(batch_loss, model.trainable_variables)    # 역전파
        adam.apply_gradients(zip(grads, model.trainable_variables))     # 가중치 갱신
```

`GradientTape`는 이름 그대로 녹음테이프다. `with` 블록 안의 계산을 순서대로 기록해뒀다가 `tape.gradient()`를 부르면 거꾸로 되감으며 미분한다. 파이토치의 `loss.backward()`와 `optimizer.step()`을 텐서플로에서 직접 쓴 셈이다. 지금까지는 `compile()` + `fit()` 한 줄이면 됐는데, `fit()`은 입력 X와 정답 y가 따로 있다고 전제하는데 여기서는 입력과 정답이 같은 배열이고 손실도 모델이 내부에서 계산해서 돌려주니, 루프를 직접 도는 게 더 짧다. 학습률 3e-5는 어제 BERT처럼 파인튜닝이라 작다. 이미 잘 배운 한국어를 잊지 않게 살짝만 옮긴다.

```
[Epoch: 1] loss = 2.12707829
[Epoch: 2] loss = 1.69819963
[Epoch: 3] loss = 1.37525403
```

이 손실은 크로스 엔트로피라 `exp(loss)`를 하면 perplexity(혼란도)가 된다. 2.127은 약 8.4, 1.375는 약 4.0이다. 다음 토큰을 고를 때 8개쯤 사이에서 헤매던 게 4개쯤으로 줄었다는 뜻이다. Colab GPU에 고용량 RAM으로 12분 30초가 걸렸고, 기본 RAM에서는 세션이 죽는다고 한다.

### 학습된 챗봇

```python
sent = '<usr>' + '오늘도 좋은 하루!' + '<sys>'
input_ids = tf.convert_to_tensor([[tokenizer.bos_token_id] + tokenizer.encode(sent)])
output = model.generate(input_ids, max_length=50,
                        early_stopping=True, eos_token_id=tokenizer.eos_token_id)
print(tokenizer.decode(output[0].numpy().tolist()))
# </s><usr> 오늘도 좋은 하루!<sys> 오늘도 좋은 하루네요.</s>
```

프롬프트를 `<sys>`까지만 주고 끊는다. 학습 데이터가 전부 그 뒤에 답변이 오는 모양이었으니 모델은 이어쓰기를 하다가 자연스럽게 답변을 쓰고, `</s>`를 만나면 멈춘다. 답변만 꺼내려면 `split('<sys> ')[1]`로 자른다. 어제 배운 "프롬프트는 디코더에게 이전에 생성한 것처럼 넣어주는 텍스트"가 정확히 이것이었다. `early_stopping=True`는 원래 여러 후보를 동시에 탐색하는 beam search 전용 옵션이라 여기서는 하는 일이 없고, 실제로 멈추게 하는 건 `eos_token_id`다.

```python
output = model.generate(input_ids, max_length=50, do_sample=True, top_k=10)

return_answer_by_chatbot('안녕! 반가워~')      # '반가워요.'
return_answer_by_chatbot('너는 누구야?')       # '직접 물어보는 건 처음이죠.'
return_answer_by_chatbot('너 딥 러닝 잘해?')   # '잘하면 돼요.'
```

`do_sample=True`, `top_k=10`으로 상위 10개 안에서 확률대로 뽑게 하면 같은 질문에도 매번 다른 답이 나온다. 그런데 답이 묘하게 동문서답이었다. 이 챗봇은 지식을 배운 게 아니라 한국어 대화의 말투와 리듬을 배웠다. 학습 데이터가 대부분 일상 잡담과 위로 문장이고 딥러닝이 뭔지 알려준 적이 없으니, 형태는 대화인데 내용은 빈 답이 나온다. 지금의 ChatGPT가 다른 건 사전학습 데이터가 비교할 수 없이 크고, 사람이 좋은 답을 골라준 데이터로 한 단계 더 학습(RLHF)하기 때문이고, 구조는 오늘 만든 것과 같다고 한다.

### 생략된 것과 경고들
- `labels=batch`는 `<pad>` 자리까지 정답으로 넣어서 "패딩 다음에는 패딩"도 학습한다. 실무에서는 패딩 위치의 라벨을 `-100`으로 바꿔서 손실 계산에서 빼고 `attention_mask`도 같이 넘긴다고 한다.
- `tqdm.tqdm_notebook` 경고는 이름이 `tqdm.notebook.tqdm`으로 바뀌었다는 것뿐이다.
- `tf.function retracing` 경고는 배치마다 문장 길이가 달라서 텐서플로가 계산 그래프를 다시 만드는 것이라, 속도만 조금 손해이고 결과는 정상이다.
- 노트북에 "GPT-2는 OpenAI가 공개한 마지막 오픈소스 모델"이라는 주석이 있었는데, 찾아보니 2025년에 OpenAI가 gpt-oss라는 오픈 웨이트 모델을 다시 공개해서 지금은 맞지 않는 말이다.

## 헷갈리기 쉬운 부분
- GPT는 트랜스포머의 디코더만 쓴다. 생성이 되는 이유는 뒤를 못 보게 가리는 마스크 때문이다.
- GPT-1, 2, 3은 구조가 아니라 크기가 다르고, 크기를 키우자 없던 능력이 생겼다.
- `LMHead`는 은닉 벡터를 어휘 크기의 점수로 펼치는 층이다.
- transformers v5는 텐서플로를 지원하지 않는다. `TF...` 클래스를 쓰려면 버전 상한이 필요하다.
- `generate()`는 다음 토큰 하나 뽑기를 반복해주는 함수이고, 기본은 greedy라 결과가 항상 같다.
- 모델 출력은 `(배치, 문장 길이, 어휘 크기)`의 logits이고, 다음 토큰은 `[0, -1]`에서 본다. logits는 확률이 아니지만 순위를 볼 때는 소프트맥스가 필요 없다.
- `random.choice`로 뽑는 것과 `top_k` 샘플링은 확률을 반영하느냐가 다르다.
- `<usr>`, `<sys>`는 어휘집에 원래 있는 토큰이다. 없는 토큰은 추가하고 임베딩도 늘려야 한다.
- 챗봇은 `</s><usr>질문<sys>답변</s>`을 한 줄로 이어 학습시킨 것이다.
- `labels=batch`는 한 칸 밀어서 채점하는 것이라 베끼기가 아니다. 문장 하나가 문제 수십 개가 된다.
- 손실의 `exp`가 perplexity다.
- 예측할 때는 `<sys>`까지만 주고 이어 쓰게 한다. 멈추는 건 `eos_token_id`가 한다.

## 오늘 배운 내용 정리
오늘은 GPT의 구조를 보고, KoGPT-2로 이어쓰기를 해보고, 질문-답변 데이터로 파인튜닝해서 챗봇을 만들었다.

```
GPT: 트랜스포머 디코더 only. causal mask로 앞만 본다. 크기를 키우자 창발 능력이 생겼다.
KoGPT-2: TFGPT2LMHeadModel.from_pretrained('skt/kogpt2-base-v2', from_pt=True). transformers<5.
생성: generate(max_length, repetition_penalty, use_cache). 기본은 greedy.
출력: logits (배치, 길이, 어휘). [0, -1]의 top_k가 다음 토큰 후보.
챗봇 데이터: </s><usr>질문<sys>답변</s> 한 줄. padded_batch(padded_shapes=(None,)).
학습: model(batch, labels=batch) → 한 칸 밀어 채점. GradientTape 루프, lr 3e-5. loss 2.13 → 1.38.
챗봇: <sys>까지 주고 generate(do_sample=True, top_k=10, eos_token_id).
```

ChatGPT 같은 게 결국 "다음 토큰 하나 뽑기"를 반복하는 것이고, 챗봇은 새로운 구조가 아니라 질문과 답변을 한 줄로 이어 붙인 데이터 형식이 만든다는 게 가장 기억에 남았다. 그리고 `labels=batch`가 베끼기가 아니라 한 칸씩 밀어서 채점하는 거라는 걸 이해하고 나니, 왜 인터넷의 아무 글이나 학습 데이터가 될 수 있는지도 같이 이해됐다. 두 달 가까이 머신러닝과 딥러닝을 배웠는데, KNN에서 시작해서 결국 LLM이 어떻게 동작하는지까지 이어진 게 신기했다.

---
