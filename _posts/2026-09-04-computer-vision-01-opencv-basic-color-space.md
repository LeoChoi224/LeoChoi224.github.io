---
layout: single
title: "컴퓨터 비전 정리 1 - OpenCV 기초와 동영상, 컬러 공간, 도형 그리기"
categories: [coding, ComputerVision]
tag: [study-log, ComputerVision, OpenCV, BGR, VideoCapture, HSV, YCrCb, PIL, numpy]
toc: true
author_profile: false
sidebar:
    nav: "docs"
search: true
---
<hr/>

오전에 GPT로 딥러닝 단원을 마치고, 오후부터 컴퓨터 비전 수업이 시작됐다. 지금까지 딥러닝에서 이미지는 MNIST나 CIFAR-10처럼 `load_data()` 한 줄이면 배열로 나와서 "이미지를 읽는다"는 고민 자체가 없었다. 그런데 실제 서비스에서는 사용자가 올린 jpg를 읽고, 카메라 화면을 받고, 크기를 맞추고 색을 바꿔서 모델에 넣어야 한다. 모델에 넣기 전 단계를 담당하는 도구가 OpenCV다. 오늘은 이미지를 읽고 보여주는 것부터 동영상 처리, 한글 문제, 컬러 공간, 도형 그리기까지 배웠다.

## 이미지는 숫자 표다

```python
import cv2
img = cv2.imread(os.path.join(base_path, 'cat.bmp'))
img.shape    # (480, 640, 3)
img.dtype    # uint8
```

이 한 줄이 안 잡히면 오늘 수업 전체가 안 잡힌다. 이미지는 그림 파일이 아니라 숫자 표다. `(480, 640, 3)`은 세로 480픽셀(행), 가로 640픽셀(열), 픽셀 하나의 색을 이루는 숫자 3개라는 뜻이고, `uint8`이라 0~255만 담는다. 사진을 스캔해서 480×640칸짜리 모눈종이에 색깔 번호를 적어 넣은 것이다.

shape이 (가로, 세로)가 아니라 (세로, 가로)인 건 numpy 배열이 항상 행 먼저, 열 나중이기 때문이다. 그런데 좌표를 찍는 함수들(`cv2.circle`, `cv2.line` 등)은 반대로 `(x, y)` = (열, 행)을 받는다. shape은 `(y, x)`, 좌표는 `(x, y)`라는 게 OpenCV에서 가장 자주 틀리는 지점이다.

```python
if img is None:
    print('Image load failed!')
```

`imread`는 경로를 틀려도 에러가 안 나고 조용히 `None`을 돌려준다. 그러면 다음 줄에서 `'NoneType' object has no attribute 'shape'` 같은 엉뚱한 에러가 터져서 진짜 원인을 한참 뒤에 찾게 된다. OpenCV가 원래 C++ 라이브러리라 실패하면 빈 행렬을 돌려주도록 설계돼 있기 때문이다. 그래서 `if img is None` 체크가 관용구다.

### imshow와 waitKey

```python
cv2.namedWindow('image')
cv2.imshow('image', img)
cv2.waitKey(0)
cv2.destroyAllWindows()
for _ in range(5):        # macOS에서는 이게 있어야 창이 실제로 사라진다
    cv2.waitKey(1)
```

`imshow`는 주피터 셀 안이 아니라 별도 운영체제 창을 띄운다. `waitKey()`는 이름과 달리 키를 기다리는 함수라기보다 창을 살아 있게 유지하는 함수다. 이게 빠지면 창이 떴다가 즉시 사라지거나 하얗게 멈춘다. `waitKey(0)`은 키를 누를 때까지 무한정, `waitKey(2000)`은 2초, `waitKey(1)`은 1밀리초로 동영상 루프에서 쓴다. `waitKey(0) == 27`로 ESC(아스키 27)를 누르면 닫는 게 관용구다. 마지막의 `for _ in range(5): cv2.waitKey(1)`은 맥 전용 응급처치인데, 창을 실제로 지우는 일이 `waitKey` 안의 이벤트 처리에서 일어나서 몇 번 더 불러줘야 반영된다.

### matplotlib으로 보면 색이 뒤집힌다

```python
plt.imshow(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
plt.imshow(cv2.cvtColor(img, cv2.COLOR_BGR2GRAY), cmap='gray')
```

주피터에서는 `plt.imshow()`로 셀 안에 그리는 게 편한데, 그냥 그리면 파란 하늘이 빨갛게 나온다. OpenCV는 색을 `[Blue, Green, Red]` 순서로 적고 matplotlib, PIL을 포함한 대부분은 `[Red, Green, Blue]` 순서로 적어서, 숫자를 잘못 읽은 게 아니라 순서를 반대로 해석한 것이다. OpenCV가 처음 만들어지던 1999년에 윈도우 비트맵과 당시 카메라 장비들이 바이트를 B → G → R 순서로 저장해서 그렇게 됐고, 바꾸면 세상의 모든 OpenCV 코드가 깨져서 25년째 그대로라고 한다. 흑백은 채널이 하나라 `cmap='gray'`를 같이 줘야 하고, 안 주면 기본 색상표로 칠해져서 초록, 보라색 이미지가 나온다.

## 동영상은 이미지의 반복이다
오늘 가장 중요한 개념 전환이었다. 동영상 처리에 새로운 기술이 있는 게 아니라 이미지 한 장 처리를 초당 30번 반복할 뿐이다.

```python
cap = cv2.VideoCapture(0)                  # 정수 → 카메라 장치 번호
# cap = cv2.VideoCapture('vtest.avi')      # 문자열 → 동영상 파일

if not cap.isOpened():
    print('camera 사용 불가')
    sys.exit()

print(round(cap.get(cv2.CAP_PROP_FRAME_WIDTH)))    # 1920
print(round(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)))   # 1080

while True:
    ret, frame = cap.read()
    if not ret:
        break
    edge = cv2.Canny(frame, 50, 150)
    cv2.imshow('frame', frame)
    cv2.imshow('edge', edge)
    if cv2.waitKey(1) == 27:
        break

cap.release()
cv2.destroyAllWindows()
```

`VideoCapture`는 같은 클래스로 카메라와 파일을 둘 다 다룬다. 생성자에 정수를 주면 카메라, 경로 문자열을 주면 파일이고 그 뒤 코드는 완전히 같다. `read()`가 값을 두 개 돌려주는 것도 `imread`와 같은 사고방식이라 `ret`이 성공 여부, `frame`이 이미지 배열이다. 파일이 끝나거나 카메라 오류가 나면 `ret`이 False가 돼서 루프를 빠져나간다. `release()`를 빼먹으면 카메라를 계속 잡고 있어서 다음 실행 때 "camera 사용 불가"가 뜬다. `waitKey()`의 숫자는 여기서 재생 속도가 되는데, 인자 없이 부르면 `waitKey(0)`과 같아서 매 프레임마다 키 입력을 기다리는 슬라이드가 된다.

한 장씩 꺼낸다는 건 꺼낸 그 한 장에 무슨 짓이든 할 수 있다는 뜻이다. `cv2.Canny`는 밝기가 급격히 변하는 자리를 찾아 흰 선으로 그려주는 윤곽선 검출이고, 뒤의 두 숫자는 약한 변화는 버리고 강한 변화는 확실한 윤곽으로 인정하는 문턱값이다. 학습이 필요 없는 고전 알고리즘인데, 딥러닝에서 CNN이 첫 번째 층에서 스스로 배우는 게 거의 이런 윤곽 검출기라고 한다.

### VideoWriter로 저장하기

```python
w = round(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
h = round(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
fps = cap.get(cv2.CAP_PROP_FPS)
fourcc = cv2.VideoWriter_fourcc(*'DIVX')
out = cv2.VideoWriter('out/output.avi', fourcc, fps, (w, h))

while True:
    ret, frame = cap.read()
    if not ret: break
    edge = cv2.Canny(frame, 50, 150)
    edge = cv2.cvtColor(edge, cv2.COLOR_GRAY2BGR)   # 3채널로 되돌려야 저장된다
    out.write(edge)

cap.release()
out.release()
```

`Canny` 결과는 흑백이라 2차원인데 `VideoWriter`는 3채널 컬러 프레임을 기대한다. `COLOR_GRAY2BGR`은 색이 살아나는 게 아니라 같은 값을 B, G, R에 똑같이 복사해서 모양만 3채널로 부풀린다. 채널 수가 안 맞으면 조용히 깨진 파일이 남는다. `out.release()`도 빼먹으면 안 된다. 동영상 파일은 마지막에 길이와 코덱 정보를 담은 헤더를 마무리해야 재생되는데, release를 안 하면 용량은 있는데 안 열리는 파일이 된다. `fourcc`는 코덱 이름 네 글자이고 `*'DIVX'`의 `*`는 문자열을 'D', 'I', 'V', 'X' 네 개로 풀어 넘기는 언패킹이다. `DIVX`는 윈도우 코덱이라 맥에서는 `'mp4v'`로 `.mp4`를 저장하는 게 보통 더 잘 된다고 한다.

## 한글이라는 복병

### 한글 경로

```python
def imread(filename, flags=cv2.IMREAD_COLOR, dtype=np.uint8):
    try:
        n = np.fromfile(filename, dtype)    # numpy가 파일을 바이트 덩어리로 읽고
        img = cv2.imdecode(n, flags)        # OpenCV는 해석만 한다
        return img
    except Exception as e:
        print(e)
        return None
```

Windows에서는 OpenCV가 경로를 UTF-8로 못 읽어서 경로에 한글이 있으면 `imread`가 조용히 `None`을 돌려준다. 파일을 여는 일은 파이썬 파일 처리를 쓰는 numpy에게 맡기고, OpenCV에게는 바이트를 이미지로 해석하는 일만 시키는 우회법이다. 저장도 `cv2.imencode`로 바이트를 만들어 파이썬 `open(..., 'w+b')`로 쓴다. 수업 중에 `def imwrite(filename, img, params=None)`로 받아놓고 안에서 `parmas`라고 오타를 내서 `name 'parmas' is not defined`가 났는데, 파이썬은 정의할 때가 아니라 그 줄이 실행될 때 이름을 찾아서 함수를 만들 때는 조용하다가 호출하는 순간 터진다.

맥은 경로를 UTF-8로 다뤄서 실제로 `cv2.imwrite`로 한글 이름 파일을 저장했더니 `True`가 나왔다. 그래도 팀에 Windows 사용자가 있으면 필요하고, `imdecode`는 웹에서 받은 이미지 바이트를 파일로 저장하지 않고 바로 읽을 때도 그대로 쓰인다. FastAPI로 이미지 업로드를 받을 때가 정확히 그 상황이다.

### 한글 출력

```python
cv2.putText(img_copy, '1234abcd', org=(10, 40),
            fontFace=cv2.FONT_HERSHEY_SIMPLEX, fontScale=1.5,
            color=(123, 255, 0), thickness=2)       # 영문, 숫자는 잘 나온다

from PIL import ImageFont, ImageDraw, Image
img_data = Image.fromarray(img.copy())               # numpy 배열 → PIL 이미지
draw = ImageDraw.Draw(img_data)
font = ImageFont.truetype('/System/Library/Fonts/AppleSDGothicNeo.ttc', 20)
draw.text((50, 100), "한글 문장", font=font, fill=(0, 0, 0))
img_data = np.array(img_data)                        # 다시 numpy 배열로
```

`cv2.putText`로 한글을 쓰면 `???`로 깨진다. 인코딩 문제가 아니라 OpenCV 내장 글꼴에 한글 글자 모양 자체가 없어서다. 해결은 한글을 아는 PIL에 잠깐 넘겼다가 돌려받는 것이다. `Image.fromarray`와 `np.array` 왕복이 가능한 건 둘 다 결국 같은 numpy 배열을 보고 있기 때문이고, 처음에 "이미지는 배열이다"를 강조한 이유가 여기서 값을 했다. 그리고 `fill=(0, 0, 0)`은 PIL 기준이라 RGB, 위 `putText`의 `color=(123, 255, 0)`은 OpenCV 기준이라 BGR이다. 한 셀 안에서 두 규칙이 섞여서, 색을 지정할 때는 지금 이 함수가 누구 것인지부터 봐야 한다.

## 컬러 공간
"사진에서 빨간 공을 찾아라"를 RGB로 풀면 성가시다. 같은 빨간 공이라도 그늘에서는 (120, 20, 20), 햇빛에서는 (250, 90, 90)이라 세 숫자가 전부 크게 달라져서 빨강의 범위를 숫자로 못 적는다. 밝기와 색을 다른 축으로 분리해서 적으면 이 문제가 사라진다. 색 공간 변환은 멋 부리기가 아니라 문제를 쉬운 좌표계로 옮기는 일이다.

### 이미지를 읽는 여러 통로

| 도구 | 채널 순서 | 언제 |
|---|---|---|
| PIL(pillow) | RGB | 웹에서 받거나 주피터에서 볼 때 |
| matplotlib | RGB | 셀 안에 그릴 때 |
| OpenCV | BGR | 실제 이미지 처리, 동영상 |

```python
import requests
from io import BytesIO
from PIL import Image

response = requests.get(url)
pic = Image.open(BytesIO(response.content))   # 파일로 저장하지 않고 바로 연다
pic_arr = np.array(pic)                       # (640, 960, 3), RGB
```

`BytesIO`는 메모리 안의 가짜 파일이다. `requests`가 받아온 바이트 덩어리를 파일인 척 감싸서 `Image.open`에 넘긴다. 아까 `imdecode(np.fromfile(...))`와 같은 "바이트 → 이미지" 발상이다.

### 채널 떼어 보기

```python
plt.imshow(pic_copy[:, :, 0], cmap='gray')   # PIL로 읽었으니 R 채널

pic_red = pic_arr.copy()
pic_red[:, :, 1] = 0
pic_red[:, :, 2] = 0
plt.imshow(pic_red)                          # 온통 빨간 사진
```

컬러 사진을 "빨강이 얼마나 강한지 적은 흑백 사진" 세 장으로 쪼갠 것이다. 한 채널만 남기고 나머지를 0으로 만들면 그 색조의 이미지가 된다. `.copy()`를 매번 붙이는 건 그냥 대입하면 원본을 가리켜서 `pic_red[:,:,1] = 0` 한 줄에 원본도 망가지기 때문이다. 같은 코드라도 PIL로 읽은 배열이면 `[:, :, 0]`이 Red, `cv2.imread` 결과면 Blue다.

```python
image = cv2.cvtColor(pic_arr, cv2.COLOR_RGB2BGR)   # 방법 1: 함수
temp_arr = pic_arr[:, :, ::-1]                     # 방법 2: 슬라이싱

pic_arr[0, 0]    # array([215, 124, 142])  R, G, B
image[0][0]      # array([142, 124, 215])  B, G, R
```

색이 변환된 게 아니라 적는 순서만 바뀌었다. `[::-1]`은 파이썬 슬라이스에서 간격이 -1, 뒤에서부터 한 칸씩이라 `'abc'[::-1] == 'cba'`와 같은 문법이다. `[..., ::-1]`은 복사가 없어 빠르지만 메모리가 거꾸로 배치돼서 일부 OpenCV 함수가 거부하기도 해서, 표시 목적이면 슬라이싱, OpenCV 함수에 넘길 거면 `cvtColor`가 안전하다. `[..., 1]`의 `...`는 지난주에 배운 "남는 차원 전부"라 `[:, :, 1]`과 같다.

`imread`의 flag는 `IMREAD_COLOR`(기본값, 3채널, 투명도 버림), `IMREAD_GRAYSCALE`(흑백 1채널), `IMREAD_UNCHANGED`(파일 그대로, 알파 채널도 살림) 세 가지다. png를 `UNCHANGED`로 읽었는데 3채널이 나온 건 "있으면 살려라"지 "없으면 만들어라"가 아니라서, 그 파일에 애초에 투명도가 없었던 것이다.

### HSV - 색을 구분하기 좋은 좌표계

```python
img_hsv = cv2.cvtColor(origin_img, cv2.COLOR_BGR2HSV)
np.max(img_hsv[:, 0, 0]), np.min(img_hsv[:, 0, 0])   # (177, 0)
```

물감을 고르는 방식이다. 먼저 무슨 색인지(H, 색상), 얼마나 진한지(S, 채도), 얼마나 밝은지(V, 명도)를 따로 정한다. S와 V는 0~255인데 H는 0~179다. 색상은 원래 0°~360° 각도인데 `uint8`에 360이 안 들어가서 2로 나눠 저장한다. 그래서 OpenCV의 H는 포토샵 같은 다른 프로그램 값의 절반이라, 포토샵에서 H=120(초록)이면 OpenCV에서는 60이다. 색 검출을 할 때 가장 먼저 만나는 함정이라고 한다. RGB에서는 밝기가 바뀌면 세 숫자가 전부 흔들리지만 HSV에서는 밝기가 V 한 축에만 몰리고 H는 거의 그대로라서, "H가 이 범위인 픽셀"이라는 조건 하나로 색을 찾을 수 있다.

### YCrCb - 밝기를 분리하기 좋은 좌표계
`cv2.COLOR_BGR2YCrCb`로 바꾸면 Y는 밝기(휘도), Cr과 Cb는 밝기 정보가 전혀 없는 색차가 된다. 어두운 사진을 밝히고 싶으면 Y만 손보면 되고 색은 안 건드리니 색감이 안 망가진다. RGB에서 같은 일을 하면 세 채널을 다 올려야 해서 색이 바랜다. 사람 눈은 밝기 변화에 예민하고 색 변화에 둔해서, JPEG은 YCrCb로 바꾼 뒤 Cr과 Cb만 해상도를 줄여 저장해 용량을 줄인다고 한다. 디지털 TV가 쓰는 색 공간이기도 하다.

## 도형 그리기

```python
img = np.zeros((512, 512, 3), np.uint8)     # 512×512 검은 도화지

cv2.line(img, (0, 0), (511, 511), (255, 0, 0), 5)            # BGR (255,0,0) = 파랑
cv2.rectangle(img, (384, 0), (510, 128), (0, 255, 0), 3)     # 좌상단, 우하단
cv2.circle(img, (447, 63), 63, (0, 0, 255), -1)              # 중심, 반지름, -1 = 채우기
cv2.ellipse(img, (255, 255), (150, 30), 0, 0, 180, (0, 255, 0), -1)   # 0~180도 반원
```

`np.zeros`로 만든 배열은 전부 0이라 검은 이미지다. 도화지를 코드로 만든 것이다. 좌표는 전부 `(x, y)`이고 색은 BGR이다. `ellipse`는 중심, (장축, 단축), 기울기, 시작각, 끝각 순서라 각도로 부채꼴도 그릴 수 있다.

강사님이 ★로 강조하신 부분이 있었다. 리턴값은 적용된 이미지 데이터지만 원본 `img`도 바뀐다. 이 함수들은 그림이 그려진 새 사진을 주는 게 아니라 들고 있던 사진에 직접 낙서하고, 리턴값은 그 낙서된 원본을 돌려줄 뿐이다(`result is img`가 True). 그래서 도형을 하나씩 그릴 때마다 이전 도형이 누적됐다. 이것도 C++ 출신이라서인데, 동영상에서 초당 30장에 사각형을 그릴 때 매번 복사본을 만들면 느리기 때문이다. 원본을 지키려면 `img.copy()`를 먼저 한다.

### polylines의 3차원 함정

```python
pts = np.array([[10, 5], [20, 30], [70, 20], [50, 10]], np.int32)
pts.shape                  # (4, 2)
pts = pts.reshape(-1, 4, 2)
pts.shape                  # (1, 4, 2)
cv2.polylines(img, pts, True, (0, 155, 255), 2)
```

다각형은 다른 도형과 달리 좌표 배열의 모양을 까다롭게 따진다. (1, 4, 2)는 (다각형 1개, 꼭짓점 4개, 좌표값 2개)라는 뜻이고, 여러 다각형을 한 번에 그릴 수 있게 설계돼서 맨 앞에 몇 개짜리인지 차원이 하나 더 붙는다. 수업 중에 `reshape(-1, 2, 1)`로 (4, 2, 1)을 넣었다가 이런 에러가 났다.

```
error: (-215:Assertion failed) p.checkVector(2, CV_32S) >= 0 in function 'polylines'
```

`checkVector(2, CV_32S)`는 "2개짜리 좌표들의 목록이고 자료형이 32비트 정수인지" 검사한다는 뜻이고, `Assertion failed`는 계산하다 실패한 게 아니라 들어오자마자 조건 검사에서 걸렸다는 뜻이다. 마지막 차원이 1이라 걸렸고, `np.int32`를 지정한 이유도 `CV_32S`를 요구해서다. float로 만들어도 같은 에러가 난다. 이 에러를 보면 shape 아니면 dtype을 의심하면 된다.

## 헷갈리기 쉬운 부분
- 이미지는 `(높이, 너비, 3)` uint8 배열이다. shape은 `(y, x)`, 좌표 함수는 `(x, y)`다.
- OpenCV는 BGR, PIL과 matplotlib은 RGB다. 색이 이상하면 `cvtColor(img, cv2.COLOR_BGR2RGB)`.
- `imread`는 실패해도 에러 없이 `None`을 돌려준다.
- `waitKey`가 없으면 창이 안 뜬다. 맥에서는 `destroyAllWindows()` 뒤에 `waitKey(1)`을 몇 번 더 부른다.
- 동영상 처리는 `ret, frame = cap.read()` 반복이다. `cap.release()`, `out.release()`를 빼먹지 않는다.
- `VideoWriter`에 흑백을 넣으려면 `COLOR_GRAY2BGR`로 3채널을 맞춘다.
- Windows 한글 경로는 `np.fromfile` + `cv2.imdecode`로 우회한다. 한글 글자는 PIL로 그린다.
- 같은 셀에서도 OpenCV 함수의 색은 BGR, PIL 함수의 색은 RGB다.
- OpenCV의 HSV에서 H는 0~179로 다른 프로그램 값의 절반이다.
- 색으로 구분할 때는 HSV, 밝기만 따로 만질 때는 YCrCb.
- 도형 함수는 원본 배열을 직접 고친다. 원본을 지키려면 먼저 `.copy()`.
- `polylines`만 `(다각형 수, 꼭짓점 수, 2)` 모양의 `int32` 배열을 받는다.

## 오늘 배운 내용 정리
오늘은 OpenCV로 이미지와 동영상을 다루고, 컬러 공간과 도형 그리기를 배웠다.

```
이미지: cv2.imread → (H, W, 3) uint8 BGR. if img is None 체크.
보기: cv2.imshow + waitKey / plt.imshow(cvtColor(BGR2RGB)), 흑백은 cmap='gray'.
동영상: VideoCapture(0 또는 경로) → while: ret, frame = cap.read() → 처리 → waitKey(1) → release.
저장: VideoWriter(경로, fourcc, fps, (w, h)). 흑백은 GRAY2BGR. out.release().
한글: 경로는 np.fromfile + imdecode, 글자는 PIL ImageDraw로 그리고 np.array로 되돌린다.
컬러 공간: BGR ↔ RGB(cvtColor 또는 [..., ::-1]), HSV(H 0~179), YCrCb(Y 밝기, CrCb 색차).
도형: line, rectangle, circle(-1 채우기), ellipse, polylines((1, N, 2) int32). 원본이 바뀐다.
```

동영상 처리가 새로운 기술이 아니라 이미지 한 장 처리를 초당 30번 반복하는 거라는 게 가장 기억에 남았다. `while` 안에서 한 장을 꺼내면 그다음은 지금까지 배운 배열 다루기와 같아서, 거기에 Canny든 딥러닝 모델이든 넣으면 된다. 그리고 BGR과 RGB, `(y, x)`와 `(x, y)`, 원본이 바뀌는 도형 함수처럼 OpenCV의 어색한 점들이 대부분 C++에서 왔다는 걸 알고 나니 조금 덜 헷갈렸다.

---
