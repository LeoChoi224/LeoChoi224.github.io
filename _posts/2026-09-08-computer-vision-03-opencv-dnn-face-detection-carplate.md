---
layout: single
title: "컴퓨터 비전 정리 3 - OpenCV DNN, 얼굴 검출과 스티커 합성, 자동차 번호판 인식"
categories: [coding, ComputerVision]
tag: [study-log, ComputerVision, OpenCV, cv2.dnn, ONNX, YuNet, NMS, alpha-blending, adaptiveThreshold, OCR]
toc: true
author_profile: false
sidebar:
    nav: "docs"
search: true
---
<hr/>

오늘 오전에는 남이 학습해둔 딥러닝 모델을 OpenCV 혼자서 불러 쓰는 법을 배웠다. 사진 한 장이 1000개 중 무엇인지 맞히는 분류에서 시작해서, 얼굴이 어디 있는지 찾는 검출로 넘어갔고, 찾은 얼굴 위에 고양이 귀 스티커를 투명하게 겹쳐 그렸다. 오후에는 반대로 딥러닝을 하나도 안 쓰고 "글자처럼 생긴 덩어리들이 일렬로 늘어선 곳"이라는 기하 조건만으로 자동차 번호판을 찾아 읽었다.

## OpenCV DNN - 남이 학습한 모델 불러 쓰기
지금까지 딥러닝 수업에서 한 건 대부분 학습이었다. 데이터를 넣고 손실을 재고 역전파로 가중치를 조금씩 고치는 무거운 일이라 GPU와 큰 프레임워크가 필요했다. 추론은 이미 학습된 가중치를 고정해놓고 앞으로 한 번만 통과시키는 일이라 훨씬 가볍고 Autograd나 옵티마이저가 필요 없다. `cv2.dnn`은 학습 기능이 아예 없는 추론 전용 엔진이라, OpenCV 하나만 깔린 임베디드 기기나 CCTV에서도 딥러닝 모델을 돌릴 수 있다. 모델은 남이 며칠씩 GPU를 돌려 학습해 공개한 사전 학습 모델을 받아 쓰고, 그런 모델을 모아둔 저장소를 Model Zoo라고 한다.

지난주까지 OpenCV로 한 일은 전부 규칙을 사람이 짜는 방식이었다. 그런데 "이 사진이 비글인가 스쿠터인가"는 밝기 조건이나 윤곽선 개수로 적을 방법이 없다. 그렇다고 텐서플로를 깔고 ImageNet을 며칠 학습시킬 수는 없으니, 이미 학습된 모델을 지금 쓰는 OpenCV 안에서 불러 쓴다.

### Caffe에서 ONNX로
원래 GoogLeNet은 구조를 적은 `deploy.prototxt`와 가중치 `bvlc_googlenet.caffemodel` 두 파일의 Caffe 형식으로 배포됐다. `deploy.prototxt`를 열어보면 `input_param { shape: { dim: 10 dim: 3 dim: 224 dim: 224 } }`, `num_output: 1000`이 적혀 있어서 뒤에 나올 224×224와 1000개 클래스의 근거가 이 설명서 안에 있다. 그런데 OpenCV 5에서 `readNetFromCaffe()`가 제거돼서, 같은 GoogLeNet을 ONNX로 변환한 `googlenet-12.onnx`를 받아 썼다. ONNX는 딥러닝 모델계의 PDF 같은 것이라, 파이토치로 학습하든 텐서플로로 학습하든 ONNX로 내보내면 어디서나 돌릴 수 있다. 파일 이름의 12는 연산자 목록의 버전인 opset 번호다.

### blobFromImage가 핵심

```python
net = cv2.dnn.readNetFromONNX(os.path.join(base_path, 'googlenet-12.onnx'))
if net.empty():
    print('Network load failed!')

inputBlob = cv2.dnn.blobFromImage(img, 1, (224, 224), (104, 117, 123))
print(img.shape)          # (320, 320, 3)
print(inputBlob.shape)    # (1, 3, 224, 224)
```

모델은 아무 사진이나 못 먹고 학습할 때 넣었던 것과 똑같은 모양으로 다듬어서 넣어야 한다. `blobFromImage`가 그걸 한 줄로 한다. 두 번째 인자는 픽셀값에 곱할 수인데 GoogLeNet은 0~255 그대로 학습해서 1이고, 다른 모델은 1/255인 경우가 많다. 세 번째는 모델 입력 크기, 네 번째는 GoogLeNet 학습 데이터의 B, G, R 평균 밝기를 빼는 값이다. 평균을 빼서 밝기를 0 근처로 모아주면 모델이 조명 차이에 덜 흔들리는데, 학습할 때 빼고 학습했으니 추론할 때도 똑같이 빼야 한다. 그리고 OpenCV의 `(H, W, C)`를 딥러닝 모델의 `(N, C, H, W)`로 축 순서까지 바꿔준다. blob은 Binary Large OBject의 줄임말인데 실제로는 그냥 4차원 넘파이 배열이고, 앞의 1이 배치 차원이다. 평균을 빼서 값에 음수가 보였다.

```python
net.setInput(inputBlob)
pred = net.forward()
print(pred.shape)        # (1, 1000)
print(np.sum(pred))      # 1.0000001

out = pred.flatten()
classId = np.argmax(out)
confidence = out[classId]
print(classId, confidence, classNames[classId])   # 812 0.99993205 space shuttle
```

출력은 1000개짜리 확률 목록이고, 모델 마지막에 softmax가 들어 있어서 합이 1이다. `argmax`는 값이 아니라 자리 번호를 줘서, 별도 텍스트 파일에서 읽은 이름표 목록의 812번째가 space shuttle이었다. 모델은 "812번"까지만 알지 그게 우주왕복선이라는 건 모른다.

평균값 `(104, 117, 123)`은 BGR 순서이고, 빼먹거나 순서를 바꾸면 에러 없이 결과만 엉뚱해진다. 모델마다 전처리가 다르니 그 모델의 문서를 봐야 한다. 그리고 수업 코드의 `classify()` 함수는 호출할 때마다 모델을 다시 읽어서, 웹 서버로 만들 때는 모델 로드를 함수 밖에서 한 번만 해야 한다.

## 얼굴 검출 - 위치까지 찾는 모델

| 구분 | 분류 | 검출 |
|---|---|---|
| 묻는 것 | 이 사진은 무엇인가 | 어디에 무엇이 있는가 |
| 답의 개수 | 사진당 1개 | 0개~여러 개 |
| 출력 모양 | (1, 1000) 클래스별 확률 | (N, 15) 찾은 것마다 한 줄 |

분류는 사진의 제목을 붙이는 것이고 검출은 사진에서 얼굴에 동그라미를 치는 것이다. 그래서 출력을 읽는 코드도 `argmax` 한 번이 아니라 결과 줄 수만큼 반복문을 돈다. 앞의 방식(`readNet` → `blobFromImage` → `forward`)을 얼굴 검출에도 쓸 수 있는데, 검출 모델의 원시 출력은 후보 상자 수백 개라 겹친 상자를 지우고 점수 낮은 걸 버리고 좌표를 되돌리는 일을 손으로 해야 한다. `cv2.FaceDetectorYN`은 OpenCV에 내장된 고수준 API라 전처리부터 그 정리까지 안에서 다 한다.

```python
model_path = os.path.join(base_path, 'face_detection_yunet_2023mar.onnx')
if not os.path.exists(model_path):
    url = 'https://huggingface.co/opencv/face_detection_yunet/resolve/main/face_detection_yunet_2023mar.onnx'
    urllib.request.urlretrieve(url, model_path)

h, w = frame.shape[:2]
face_detector = cv2.FaceDetectorYN.create(
    model_path, "", (w, h),
    score_threshold=0.6, nms_threshold=0.3, top_k=500)
```

YuNet 모델은 230KB밖에 안 된다. OpenCV 5부터 OpenCV Zoo가 Hugging Face로 이전돼서 GitHub 주소를 쓰는 옛 예제는 404가 난다. 이미 받았으면 다시 안 받게 `os.path.exists`로 감쌌다. 입력 크기는 `(w, h)` 순서라 `shape`의 `(h, w)`를 뒤집어 넣는다. `score_threshold=0.6`은 60% 이상 얼굴 같은 것만 남긴다는 뜻이다.

### NMS
`nms_threshold`가 오늘의 새 개념이었다. 검출 모델은 얼굴 하나를 놓고도 조금씩 어긋난 상자를 수십 개 그린다. 그중 가장 자신 있는 것 하나만 남기고 나머지를 지우는 게 NMS(Non-Maximum Suppression, 비최대 억제)다.

```
1. 후보 상자들을 점수 높은 순으로 줄 세운다
2. 1등 상자를 확정하고 목록에서 뺀다
3. 1등과 많이 겹치는(IoU > 0.3) 나머지 상자를 버린다
4. 남은 것 중 1등을 다시 골라 2번으로
```

많이 겹친다는 기준이 IoU(교집합 ÷ 합집합)다. 너무 낮추면 가까이 붙어 앉은 두 사람 중 한 명이 지워지고, 너무 높이면 얼굴 하나에 상자가 여러 개 남는다. `top_k=500`은 NMS가 상자끼리 전부 비교해야 해서 느리니 점수 상위 500개만 남기는 안전장치다.

### 15개 숫자

```python
_, faces = face_detector.detect(frame)
print(faces.shape)    # (1, 15)

for face in faces:
    x1, y1, bw, bh = face[0:4].astype(int)
    confidence = face[-1]
    cv2.rectangle(frame, (x1, y1), (x1 + bw, y1 + bh), (0, 255, 0), 2)
    cv2.putText(frame, 'Face: %4.3f' % confidence, (x1, y1 - 5),
                cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 1, cv2.LINE_AA)
    landmarks = face[4:14].astype(int).reshape(5, 2)
    for (lx, ly) in landmarks:
        cv2.circle(frame, (lx, ly), 2, (255, 0, 0), 2)
```

찾은 얼굴 하나가 한 줄 15개 숫자다. 0~3은 상자의 왼쪽 위 좌표와 폭, 높이, 4~13은 오른쪽 눈, 왼쪽 눈, 코, 오른쪽 입꼬리, 왼쪽 입꼬리의 x, y, 마지막이 confidence다. 이 다섯 점을 얼굴 랜드마크라고 한다. `reshape(5, 2)`로 10개짜리를 5×2 표로 바꾸면 반복문 한 줄로 다섯 점을 찍을 수 있다. 모델 좌표는 실수인데 `cv2.rectangle`은 정수만 받아서 `.astype(int)`가 필요하다. 두 눈의 좌표를 알면 눈이 수평이 되도록 회전시켜서 얼굴을 정렬할 수 있는데, 이 "기울기를 재서 회전시킨다"는 발상이 오후 번호판에서 그대로 나왔다.

`face[0:4]`가 `(x, y, w, h)`라는 게 함정이다. 두 번째 점에 `(bw, bh)`를 그냥 넣으면 상자가 엉뚱한 곳에 그려지는데 에러가 안 난다. 다음에 쓸 SSD 모델은 반대로 `(x1, y1, x2, y2)`를 줘서 헷갈리기 딱 좋다.

### 실시간 웹캠

```python
cap = cv2.VideoCapture(0)
_, frame = cap.read()
h, w = frame.shape[:2]
face_detector = cv2.FaceDetectorYN.create(model_path, "", (w, h), 0.6, 0.3, 5000)

while True:
    _, frame = cap.read()
    if frame is None:
        break
    _, faces = face_detector.detect(frame)
    if faces is not None:
        for face in faces:
            ...
    cv2.imshow('frame', frame)
    if cv2.waitKey(1) == 27:
        break
```

검출기는 루프 밖에서 한 번만 만든다. 안에 넣으면 매 프레임 모델을 다시 읽어서 초당 몇 장도 못 돌린다. 그리고 얼굴이 하나도 없으면 `faces`는 빈 배열이 아니라 `None`이라, `if faces is not None:`이 없으면 사람이 화면 밖으로 나가는 순간 `TypeError`로 죽는다. `create()` 때 준 크기와 다른 크기의 프레임이 들어오면 `setInputSize()`로 다시 알려줘야 한다. OpenCV 5의 새 그래프 엔진이 백엔드 지정을 아직 지원하지 않는다는 경고가 뜨는데 추론은 CPU에서 정상적으로 돌아간다.

## 얼굴 스티커 - 알파 채널로 겹쳐 그리기
얼굴 위치를 찾았으니 그 자리에 뭔가를 그려 넣을 차례다. `cv2.rectangle`처럼 덮어쓰면 사각형 그림이 얼굴을 통째로 가리니, 모양대로만 반투명하게 겹치는 법이 필요하다. 스노우나 인스타 필터의 원리 그대로다.

```python
cat = cv2.imread('cat.png', cv2.IMREAD_UNCHANGED)
cat.shape    # (200, 530, 4)   B, G, R, A
```

PNG는 네 번째 채널인 알파(A)를 가질 수 있다. 알파는 그 픽셀의 불투명도라 255면 완전히 보이고 0이면 완전히 투명하다. 고양이 귀 PNG의 귀 부분은 255, 주변 빈 공간은 0이라 이 정보가 있어야 귀 모양대로만 붙일 수 있다. `imread`의 기본값 `IMREAD_COLOR`는 알파를 버리고 3채널로 만들어서, 에러도 경고도 없이 투명 정보가 사라진다. `IMREAD_UNCHANGED`가 반드시 필요하다.

### SSD 얼굴 검출기와 OpenCV 5 엔진

```python
model = 'opencv_face_detector_uint8.pb'
config = 'opencv_face_detector.pbtxt'
if hasattr(cv2.dnn, 'ENGINE_CLASSIC'):
    net = cv2.dnn.readNet(model, config, engine=cv2.dnn.ENGINE_CLASSIC)
else:
    net = cv2.dnn.readNet(model, config)

blob = cv2.dnn.blobFromImage(frame, 1, (300, 300), (104, 177, 123))
net.setInput(blob)
detect = net.forward()
detect.shape                # (1, 1, 200, 7)
detect = detect[0, 0, ...]  # (200, 7)
```

이번에는 포장된 API가 아니라 텐서플로로 학습된 SSD 얼굴 검출 모델을 날것 그대로 썼다. 가중치와 구조 두 파일인 건 Caffe 때와 같다. OpenCV 5는 추론 엔진이 여러 개인데 기본값은 새 엔진을 먼저 시도하고, 이 모델은 옛날 SSD 전용 레이어를 써서 새 엔진이 제대로 못 읽어서 옛날 엔진(`ENGINE_CLASSIC`)으로 읽으라고 못 박는다. OpenCV 4에는 이 상수가 없어서 `hasattr`로 감싼 버전 호환 방어 코드다.

입력 크기가 300×300이고 평균값이 `(104, 177, 123)`이다. GoogLeNet의 `(104, 117, 123)`과 가운데만 117 대 177로 다른데, 눈으로는 절대 안 잡히는 차이라 그 모델의 예제에서 베껴와야 한다. 출력 (200, 7)의 한 줄은 이미지 번호, 클래스(1 = 얼굴), confidence, 그리고 0~1로 정규화된 xmin, ymin, xmax, ymax다. YuNet은 `(x, y, w, h)` 픽셀값을 줬는데 이 모델은 `(x1, y1, x2, y2)` 비율값을 준다. 새 모델을 쓸 때 가장 먼저 확인할 게 출력 형식이다.

```python
for i in range(detect.shape[0]):
    confidence = detect[i, 2]
    if confidence < 0.5:
        break
    x1 = int(detect[i, 3] * w + 0.5)
    y1 = int(detect[i, 4] * h + 0.5)
    x2 = int(detect[i, 5] * w + 0.5)
    y2 = int(detect[i, 6] * h + 0.5)

    fx = (x2 - x1) / cat.shape[1]
    cat2 = cv2.resize(cat, (0, 0), fx=fx, fy=fx)
    pos = (x1, y1 - (y2 - y1) // 4)
    overlay(frame, cat2, pos)
```

비율 좌표는 모델이 300×300을 봤든 원본이 1920×1080이든 곱하기만 하면 돼서 편하다. `+ 0.5`는 `int()`가 소수점을 버리니 0.5를 먼저 더해서 반올림하는 관용구다. `continue`가 아니라 `break`인 게 중요한데, SSD 출력 200줄이 confidence 내림차순으로 이미 정렬돼 있어서 0.5 미만을 처음 만나면 그 뒤는 전부 더 낮다. 다른 모델에 옮기기 전에 정렬 여부를 확인해야 한다. 스티커는 얼굴 폭 ÷ 고양이 원본 폭으로 배율을 구해 가로세로 비율을 유지한 채 줄이고, 귀는 머리 위에 있어야 하니 얼굴 높이의 1/4만큼 위로 올린다. 얼굴이 크면 많이, 작으면 조금 올라가서 거리가 바뀌어도 자연스럽다.

### 알파 블렌딩

```python
def overlay(frame, cat, pos):
    if pos[0] < 0 or pos[1] < 0:
        return
    if pos[0] + cat.shape[1] > frame.shape[1] or pos[1] + cat.shape[0] > frame.shape[0]:
        return

    sx, ex = pos[0], pos[0] + cat.shape[1]
    sy, ey = pos[1], pos[1] + cat.shape[0]

    img1 = frame[sy:ey, sx:ex]                 # 배경 (합성될 자리)
    img2 = cat[:, :, 0:3]                      # 고양이의 B, G, R
    alpha = 1. - (cat[:, :, 3] / 255.)         # 고양이의 A를 0~1로, 뒤집어서

    img1[:, :, 0] = (img1[:, :, 0] * alpha + img2[:, :, 0] * (1.0 - alpha)).astype(np.uint8)
    img1[:, :, 1] = (img1[:, :, 1] * alpha + img2[:, :, 1] * (1.0 - alpha)).astype(np.uint8)
    img1[:, :, 2] = (img1[:, :, 2] * alpha + img2[:, :, 2] * (1.0 - alpha)).astype(np.uint8)
```

두 색을 비율대로 섞는 것이다. 물감 두 통을 7:3으로 섞는 것처럼, 그 비율을 픽셀마다 알파 채널이 정해준다. 여기서 `alpha`라는 변수가 제일 헷갈렸다. 귀 부분은 A가 255라 `alpha = 1 - 1 = 0`이고 결과는 배경 × 0 + 고양이 × 1 = 고양이가 된다. 투명한 부분은 A가 0이라 `alpha = 1`이고 결과는 배경이 된다. 변수 이름은 alpha인데 알파 채널을 뒤집어놔서 실제 의미는 "배경을 얼마나 보여줄지"다. 이름만 보고 읽으면 계산 방향을 반대로 이해하게 된다. 가장자리는 A가 0과 255 사이라 부드럽게 섞여서 경계가 톱니처럼 안 보인다. 두 계수의 합이 1이어야 밝기가 안 변한다.

그런데 `overlay()`는 `img1`만 고치고 `frame`에는 한 번도 대입하지 않고 `return`도 없는데, 다녀오면 `frame`이 바뀌어 있다. 지난 시간에 배운 대로 넘파이 슬라이싱은 복사가 아니라 뷰라서, `img1`은 `frame`의 그 부분을 들여다보는 창이고 창에 낙서하면 원본에 낙서된다. 이 코드는 그 성질을 일부러 쓴다. 파이썬 리스트 슬라이싱은 복사본을 만들어서, 리스트처럼 생각하고 짜면 원본이 망가지는 사고가 자주 난다. 경계 검사 두 줄은 스티커가 화면 밖으로 나가면 `img1`과 `cat`의 크기가 안 맞아 브로드캐스팅 에러가 나서 있는 것인데, 잘라 붙이지 않고 아예 포기해서 얼굴이 가장자리로 가면 귀가 통째로 사라진다. 4채널 이미지는 `plt_imshow`의 BGR2RGB 변환이 안 먹어서 `COLOR_BGRA2RGBA`를 쓰거나 `cat[:, :, :3]`만 넘겨야 한다.

## 자동차 번호판 인식 - 기하학으로만 찾기
오후 수업에는 딥러닝이 전혀 안 나왔다. 오전이 "AI에게 물어보기"였다면 이번엔 사람이 직접 규칙을 다 적어주기다. 번호판은 글자들의 크기가 비슷하고, 일렬로 배열돼 있고, 간격이 일정하고, 배경과 글자의 대비가 크다. 이런 규칙성이 있으면 "이 조건을 만족하는 걸 찾아라"라고 코드로 적을 수 있다. 밤이거나 더럽거나 각도가 심하게 틀어지면 통째로 실패해서 요즘은 딥러닝을 쓰지만, 딥러닝은 데이터 수천 장을 라벨링해야 하고 이 방식은 사진 한 장으로 당장 돌아간다.

Tesseract에 자동차 사진을 통째로 넣으면 아무것도 못 읽는다. 차체, 도로, 하늘이 다 들어 있으니까. 번호판 영역만 잘라내고, 기울어진 걸 세우고, 흑백으로 또렷하게 만들어줘야 해서 오늘 한 일의 90%가 OCR을 위한 밥상 차리기였다. 핵심 발상은 번호판 자체를 찾지 말고 번호판 안의 글자들을 찾으라는 것이다.

### 적응형 이진화

```python
img_ori = cv2.imread('1.jpg')
height, width, channel = img_ori.shape     # (626, 940, 3)
gray = cv2.cvtColor(img_ori, cv2.COLOR_BGR2GRAY)
img_blurred = cv2.GaussianBlur(gray, ksize=(5, 5), sigmaX=0)
img_blur_thresh = cv2.adaptiveThreshold(
    img_blurred, maxValue=255.0,
    adaptiveMethod=cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
    thresholdType=cv2.THRESH_BINARY_INV,
    blockSize=19, C=9)
```

보통 `threshold()`는 사진 전체에 기준 하나를 써서, 한쪽에 그늘이 지면 그늘진 쪽은 통째로 검게, 밝은 쪽은 통째로 하얗게 뭉개진다. `adaptiveThreshold`는 픽셀마다 주변 19×19 영역(`blockSize`, 홀수)만 보고 그 동네 기준을 따로 정한다. `C=9`는 동네 가중평균에서 9를 뺀 값을 기준으로 삼는다는 뜻이다. 명함 때 Otsu가 실패하는 경우로 이름만 나왔던 게 여기서 쓰였다. `THRESH_BINARY_INV`로 뒤집는 게 중요한데, `findContours`는 검은 배경 위의 흰 물체를 찾고 번호판 글자는 원래 검은색이라 뒤집어야 글자가 흰색이 된다. 빼먹으면 에러 없이 결과만 0개다. 블러를 먼저 하는 건 먼지 같은 노이즈가 전부 흰 덩어리가 돼서 윤곽선 개수가 폭발하는 걸 막으려는 것이다.

### 윤곽선 → 사각형

```python
contours, _ = cv2.findContours(img_blur_thresh, mode=cv2.RETR_LIST,
                               method=cv2.CHAIN_APPROX_SIMPLE)
print(len(contours))    # 225

contours_dict = []
for contour in contours:
    x, y, w, h = cv2.boundingRect(contour)
    contours_dict.append({'contour': contour, 'x': x, 'y': y, 'w': w, 'h': h,
                          'cx': x + (w / 2), 'cy': y + (h / 2)})
```

글자 몇 개를 찾는데 225개가 나왔다. 나머지는 차체 무늬, 그림자, 노이즈라 이제부터 하는 일은 전부 그걸 걸러내는 일이다. 윤곽선은 점의 목록이라 다루기 불편해서 각각을 감싸는 사각형으로 바꾸고, 뒤에서 거리와 각도를 잴 중심 좌표를 미리 계산해서 딕셔너리로 담았다.

### 1차 필터 - 혼자 보고 판단

```python
MIN_AREA = 80
MIN_WIDTH, MIN_HEIGHT = 2, 8
MIN_RATIO, MAX_RATIO = 0.25, 1.0

possible_contours = []
cnt = 0
for d in contours_dict:
    area = d['w'] * d['h']
    ratio = d['w'] / d['h']
    if area > MIN_AREA and d['w'] > MIN_WIDTH and d['h'] > MIN_HEIGHT \
            and MIN_RATIO < ratio < MAX_RATIO:
        d['idx'] = cnt
        cnt += 1
        possible_contours.append(d)
print(len(possible_contours))    # 225 → 23
```

너무 작으면 노이즈라 탈락이고, 글자는 세로가 더 길어서 가로세로 비율이 0.25~1.0이 아니면 탈락이다. 한 번에 90%를 걸렀다.

### 2차 필터 - 여럿을 묶어서 판단
이 수업의 진짜 아이디어였다. 23개 중 진짜 글자와 차체 무늬는 하나만 봐서는 구별이 안 된다. 그런데 여럿을 함께 놓고 보면 다르다. 사람도 글자 하나만 보고 번호판이라고 하지 않는다. 비슷하게 생긴 글자 대여섯 개가 나란히 줄 서 있는 걸 보고 안다.

```python
MAX_DIAG_MULTIPLYER = 5      # 서로 이만큼 이상 떨어지면 남남
MAX_ANGLE_DIFF = 12.0        # 두 중심을 이은 선이 12도 넘게 기울면 탈락
MAX_AREA_DIFF = 0.5
MAX_WIDTH_DIFF = 0.8
MAX_HEIGHT_DIFF = 0.2        # 가장 빡빡하다
MIN_N_MATCHED = 3            # 3개 미만이면 번호판 아님

for d2 in contour_list:
    if d1['idx'] == d2['idx']:
        continue
    dx = abs(d1['cx'] - d2['cx'])
    dy = abs(d1['cy'] - d2['cy'])
    distance = np.linalg.norm(np.array([d1['cx'], d1['cy']]) - np.array([d2['cx'], d2['cy']]))
    diagonal_length1 = np.sqrt(d1['w'] ** 2 + d1['h'] ** 2)
    angle_diff = 90 if dx == 0 else np.degrees(np.arctan(dy / dx))
    area_diff = abs(d1['w'] * d1['h'] - d2['w'] * d2['h']) / (d1['w'] * d1['h'])
    width_diff = abs(d1['w'] - d2['w']) / d1['w']
    height_diff = abs(d1['h'] - d2['h']) / d1['h']

    if distance < diagonal_length1 * MAX_DIAG_MULTIPLYER \
            and angle_diff < MAX_ANGLE_DIFF and area_diff < MAX_AREA_DIFF \
            and width_diff < MAX_WIDTH_DIFF and height_diff < MAX_HEIGHT_DIFF:
        matched_contours_idx.append(d2['idx'])
```

높이 차이가 가장 빡빡한 게 의미심장하다. 같은 번호판 글자는 폭이 1과 8처럼 달라도 높이는 규격이 같다. 관찰이 조건에 그대로 반영된 것이다. 거리 기준을 "100px 이내" 같은 절대값이 아니라 자기 대각선 길이의 5배로 잡은 것도 영리했다. 사진 해상도나 차와의 거리가 바뀌어도 비율이 유지된다. 각도는 두 중심을 이은 직각삼각형에서 `arctan(dy / dx)`로 구하고 라디안을 `np.degrees()`로 바꾼다. `dx == 0`이면 0으로 나누기를 막으려고 90도로 처리한다.

이렇게 모인 그룹을 찾은 뒤, 거기 안 끼인 나머지만 가지고 같은 함수를 재귀로 한 번 더 돌린다. 사진에 번호판이 두 개 있을 수도 있으니까. 결과는 `[[7, 8, 10, 12, 5]]`로 23개 중 5개가 남았다. 다만 나머지를 뽑을 때 쓴 `np.take(contour_list, unmatched_contour_idx)`는 리스트 안의 위치로 뽑는데 넘긴 건 1차 필터에서 붙인 `idx`라, 첫 호출에서는 우연히 같지만 재귀로 들어가 부분집합이 되면 어긋난다. 오늘 사진은 번호판이 하나라 안 드러났는데, 번호판이 두 개인 사진에서 터질 수 있는 잠재 버그다. `[d for d in contour_list if d['idx'] in unmatched_idx]`처럼 값 기준으로 거르는 게 안전하다.

### 회전 보정

```python
sorted_chars = sorted(matched_chars, key=lambda x: x['cx'])
plate_cx = (sorted_chars[0]['cx'] + sorted_chars[-1]['cx']) / 2
plate_cy = (sorted_chars[0]['cy'] + sorted_chars[-1]['cy']) / 2
plate_width = (sorted_chars[-1]['x'] - sorted_chars[0]['x'] + sorted_chars[-1]['w']) * PLATE_WIDTH_PADDING

triangle_height = sorted_chars[-1]['cy'] - sorted_chars[0]['cy']
triangle_hypotenus = np.linalg.norm(
    np.array([sorted_chars[0]['cx'], sorted_chars[0]['cy']]) -
    np.array([sorted_chars[-1]['cx'], sorted_chars[-1]['cy']]))
angle = np.degrees(np.arcsin(triangle_height / triangle_hypotenus))   # 11.9566

rotation_matrix = cv2.getRotationMatrix2D(center=(plate_cx, plate_cy), angle=angle, scale=1.0)
img_rotated = cv2.warpAffine(img_blur_thresh, M=rotation_matrix, dsize=(width, height))
img_cropped = cv2.getRectSubPix(img_rotated,
                                patchSize=(int(plate_width), int(plate_height)),
                                center=(int(plate_cx), int(plate_cy)))
```

찾은 순서가 뒤죽박죽이라 중심 x로 먼저 정렬해야 첫 글자와 마지막 글자가 의미를 갖는다. 번호판 중심은 첫 글자와 마지막 글자 중심의 중간, 폭과 높이는 1.3배 여유를 준다. 첫 글자와 마지막 글자를 선으로 이어서 `sin θ = 높이 / 빗변`으로 기울기를 재면 11.96도였다. 지난 시간에 배운 회전 행렬로 사진 전체를 돌린 다음 `getRectSubPix`로 중심 기준으로 잘라낸다. 잘라놓고 돌리면 모서리가 잘려나가서 전체를 돌린 뒤 잘라야 한다. 명함은 네 꼭짓점을 알아서 원근 변환을 썼지만 여기서는 각도 하나만 알면 되니 회전(어파인)으로 충분하다. 한국 번호판은 가로가 세로의 3~10배라 그 비율이 아니면 버리는 안전장치도 있다.

회전각 11.96도가 2차 필터의 `MAX_ANGLE_DIFF = 12.0`과 아슬아슬한데 우연이 아니다. 12도까지만 허용했으니 살아남은 그룹은 12도를 넘을 수 없다. 이 사진의 번호판이 조금만 더 기울었으면 아예 못 찾았을 것이다. 상수 하나가 성패를 가르는 게 이 방식의 성격이었다. `MIN_AREA=80`, `blockSize=19`, `C=9` 같은 상수 10여 개가 전부 원리에서 나온 게 아니라 이 사진에 맞춰 바꿔가며 정한 값이라, 다른 각도나 조명에는 다시 맞춰야 한다. 그리고 `PLATE_HEIGHT_PADDING`을 1.5로 정의해놓고 높이 계산에도 `PLATE_WIDTH_PADDING`을 곱하고 있었다. 상수를 만들어놓고 다른 걸 쓴 전형적인 실수라 튜닝할 때 헤매기 좋다.

### OCR 밥상 차리기

```python
plate_img = cv2.resize(plate_img, dsize=(0, 0), fx=1.6, fy=1.6)
_, plate_img = cv2.threshold(plate_img, 0.0, 255.0, cv2.THRESH_BINARY | cv2.THRESH_OTSU)

plate_contours, _ = cv2.findContours(plate_img, mode=cv2.RETR_LIST, method=cv2.CHAIN_APPROX_SIMPLE)
plate_min_x, plate_min_y = plate_img.shape[1], plate_img.shape[0]
plate_max_x, plate_max_y = 0, 0
for contour in plate_contours:
    x, y, w, h = cv2.boundingRect(contour)
    area, ratio = w * h, w / h
    if area > MIN_AREA and w > MIN_WIDTH and h > MIN_HEIGHT and MIN_RATIO < ratio < MAX_RATIO:
        if x < plate_min_x: plate_min_x = x
        if y < plate_min_y: plate_min_y = y
        if x + w > plate_max_x: plate_max_x = x + w
        if y + h > plate_max_y: plate_max_y = y + h
img_result = plate_img[plate_min_y:plate_max_y, plate_min_x:plate_max_x]

img_result = cv2.GaussianBlur(img_result, ksize=(3, 3), sigmaX=0)
_, img_result = cv2.threshold(img_result, 0.0, 255.0, cv2.THRESH_BINARY | cv2.THRESH_OTSU)
img_result = cv2.copyMakeBorder(img_result, top=10, bottom=10, left=10, right=10,
                                borderType=cv2.BORDER_CONSTANT, value=(0, 0, 0))
```

잘라낸 조각을 그냥 넣지 않고 한 번 더 다듬는다. 1.6배 확대하면 정보가 늘지는 않지만 획이 두꺼워져서 인식률이 오른다. 잘라낸 조각은 작고 조명이 균일해서 이번에는 Otsu로 충분하다. 윤곽선 찾기를 한 번 더 하는데, 이번 목적은 조각 안에서 글자들이 차지하는 최소 사각형을 구해서 남은 테두리와 여백을 깎아내는 것이다. 최솟값은 아주 큰 값(이미지 폭)에서, 최댓값은 0에서 출발해야 첫 비교가 제대로 먹는다. 수업 코드는 여기서 앞의 `contours` 변수를 덮어써서 노트북 셀을 왔다 갔다 하면 결과가 달라질 수 있었는데, 이름을 따로 두는 게 안전하다. 마지막에 검정 여백을 10픽셀씩 두르는데, Tesseract는 글자가 가장자리에 딱 붙어 있으면 인식률이 떨어진다. 작은 처리인데 효과가 크다고 한다.

```python
chars = pytesseract.image_to_string(img_result, lang='kor', config='--psm 7 --oem 0')
print(chars)            # 19오 '777'7

result_chars = ''
has_digit = False
for c in chars:
    if ord('가') <= ord(c) <= ord('힣') or c.isdigit():
        if c.isdigit():
            has_digit = True
        result_chars += c
print(result_chars)     # 19오7777
```

`--psm 7`은 이미지를 글자 한 줄로 취급하라는 뜻이라 번호판에 딱 맞다. `--oem 0`은 레거시 엔진인데, 한글 번호판처럼 짧고 정형화된 글자에는 옛 엔진이 나을 때가 있다고 한다. 다만 기본으로 깔리는 `kor.traineddata`는 LSTM 전용이라 레거시용 학습 데이터를 따로 받아야 한다. 엔진 모드와 학습 데이터는 짝이 맞아야 한다. 결과에 따옴표 같은 쓰레기가 섞여서 걸렀는데, 유니코드에서 한글 완성형은 '가'(U+AC00)부터 '힣'(U+D7A3)까지 연속으로 배치돼 있어서 범위 비교 하나로 한글인지 판단할 수 있다. 번호판은 한글과 숫자뿐이라 이 둘만 남기면 된다. 원래는 후보 중 가장 긴 결과를 고르려고 `longest_text`를 쓰는데, 갱신하는 줄이 빠져 있어서 조건을 만족한 마지막 후보가 선택되고 있었다. 후보가 하나라 결과는 같았다.

```python
def imwrite(filename, img, params=None):
    try:
        ext = os.path.splitext(filename)[1]
        result, n = cv2.imencode(ext, img, params)
        if result:
            with open(filename, mode='w+b') as f:
                n.tofile(f)
            return True
        return False
    except Exception as e:
        print(e)
        return False
```

`19오7777.jpg` 같은 한글 파일 이름으로 저장하려고 지난 시간의 래퍼를 또 썼다. 인코딩은 OpenCV가 메모리에서, 파일 쓰기는 파이썬이 한다. 전체를 `car_plate(file_path)` 함수로 묶어서 4장을 돌렸더니 4장 다 읽어냈다.

```
35리6110
49허1769
54가0639
19오7777
```

## 헷갈리기 쉬운 부분
- `cv2.dnn`은 추론 전용이다. `readNetFromONNX` → `blobFromImage` → `setInput` → `forward` 네 줄이다.
- `blobFromImage`의 스케일, 크기, 평균값은 모델이 학습할 때와 같아야 한다. 틀려도 에러 없이 답만 틀린다. 평균값은 BGR 순서다.
- `argmax`는 자리 번호를 준다. 이름은 별도 목록에서 찾는다.
- 모델 로드는 함수나 루프 밖에서 한 번만 한다.
- 분류는 답이 하나, 검출은 여러 개라 반복문으로 읽는다.
- `FaceDetectorYN.create()`의 입력 크기는 `(w, h)`이고, 얼굴이 없으면 `faces`는 `None`이다.
- YuNet의 `face[0:4]`는 `(x, y, w, h)`, SSD는 `(x1, y1, x2, y2)` 비율값이다.
- NMS는 겹친 상자 중 1등만 남기는 것이고, 기준은 IoU다.
- 투명 PNG는 `IMREAD_UNCHANGED`로 읽는다. 알파 블렌딩은 `배경 × a + 스티커 × (1 - a)`.
- 수업 코드의 `alpha`는 알파 채널을 뒤집은 값이라 "배경 비중"이다.
- 넘파이 슬라이싱은 뷰라서 잘라낸 조각을 고치면 원본이 바뀐다.
- 번호판은 번호판이 아니라 글자들의 배치(크기, 높이, 간격, 각도)로 찾는다.
- `findContours`는 검은 배경의 흰 물체를 찾아서 `THRESH_BINARY_INV`가 필요하다.
- 조명이 고르지 않으면 `adaptiveThreshold`, 작고 균일한 조각은 Otsu.
- 거리 기준은 절대 픽셀이 아니라 자기 대각선의 배수로 잡는다.
- 회전은 전체를 돌린 뒤 자른다.
- OCR 전에 확대, 이진화, 검정 여백, `--psm 7`로 밥상을 차린다. 한글 범위는 `ord('가')`~`ord('힣')`.

## 오늘 배운 내용 정리
오늘은 OpenCV로 사전 학습 모델을 불러 분류와 얼굴 검출을 하고, 스티커를 합성하고, 딥러닝 없이 번호판을 인식했다.

```
DNN: readNetFromONNX(googlenet-12.onnx) → blobFromImage(img, 1, (224, 224), (104, 117, 123))
     → forward() (1, 1000) → argmax → 812 space shuttle.
얼굴 검출: FaceDetectorYN.create(onnx, "", (w, h), 0.6, 0.3, top_k) → detect → (N, 15).
          x, y, w, h + 랜드마크 5점 + confidence. NMS로 겹친 상자 정리.
스티커: SSD(readNet, ENGINE_CLASSIC) → (200, 7) 비율 좌표 → 크기 맞추기
        → 알파 블렌딩(IMREAD_UNCHANGED, 배경 × a + 스티커 × (1 - a)), 뷰로 원본 갱신.
번호판: gray → blur → adaptiveThreshold(INV) → findContours 225 → 1차 필터 23 → 2차 필터 5
        → arcsin으로 각도 → 회전 + getRectSubPix → 확대, Otsu, 여백 → OCR(--psm 7) → 한글·숫자만.
```

같은 날 오전에는 모델에 물어보고, 오후에는 규칙을 직접 적어서 비슷한 일을 했다는 게 가장 기억에 남았다. 번호판 인식은 "비슷한 높이의 덩어리 세 개 이상이 12도 이내로 일렬로 서 있다"는 관찰 하나를 조건 다섯 개로 옮긴 것뿐인데 4장을 다 읽어냈다. 대신 각도가 조금만 더 기울었으면 아예 못 찾았을 거라는 것도 같이 보여서, 왜 요즘은 이런 일에 딥러닝을 쓰는지도 이해가 됐다.

---
