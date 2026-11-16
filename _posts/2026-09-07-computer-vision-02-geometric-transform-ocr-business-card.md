---
layout: single
title: "컴퓨터 비전 정리 2 - 기하 변환, 이미지 연산과 합성, Tesseract OCR, 명함 인식"
categories: [coding, ComputerVision]
tag: [study-log, ComputerVision, OpenCV, warpPerspective, bitwise, mask, OCR, Tesseract, Otsu, findContours]
toc: true
author_profile: false
sidebar:
    nav: "docs"
search: true
---
<hr/>

지난 시간에 이미지를 읽고 색을 바꿨다면, 오늘은 픽셀의 위치를 옮기고(기하 변환), 픽셀 값을 계산하고(이미지 연산과 합성), 이미지 속 글자를 문자열로 바꾸는(OCR) 법을 배웠다. 그리고 마지막에 이걸 전부 엮어서 책상 위에 비스듬히 찍힌 명함 사진에서 명함을 찾아 반듯하게 펴고 글자를 읽어내는 프로그램을 만들었다. 따로따로 배운 게 한 줄로 꿰어지는 날이었다.

## 기하 변환
현실에서 들어오는 사진은 늘 삐뚤어져 있다. 영수증은 비스듬히 찍히고 명함은 기울어져 놓여 있다. 사람은 고개를 갸웃하면 읽지만, OCR은 글자가 반듯한 직사각형 안에 가로로 놓여 있다고 가정하고 만들어져 있다. 그래서 찌그러진 사진을 반듯하게 펴는 기술이 인식 작업의 앞단에 반드시 붙는다. 이미지를 늘리고, 옮기고, 돌리고, 기울이는 일은 전부 픽셀 좌표에 곱할 행렬 하나를 구해서 `warp` 계열 함수에 넘기는 같은 모양의 작업이었다.

### Resize와 보간법

```python
shrink = cv2.resize(src=image, dsize=None, fx=0.5, fy=0.5, interpolation=cv2.INTER_AREA)
expand = cv2.resize(src=image, dsize=(width * 2, height * 2), interpolation=cv2.INTER_CUBIC)
```

512×512를 1024×1024로 키우면 픽셀이 26만 개에서 105만 개가 되는데, 새로 생긴 79만 개는 원본에 없다. 그 빈자리를 주변 색을 참고해서 지어내는 규칙이 보간법이다. 줄일 때는 사라질 픽셀들의 평균을 내는 `INTER_AREA`, 키울 때는 느리지만 좋은 `INTER_CUBIC`이나 빠른 `INTER_LINEAR`(기본값)를 쓴다. 키울 때는 눈으로 차이가 별로 안 나는데, 줄일 때는 선형 보간이 가장 가까운 4개 값만 섞어서 대부분의 픽셀을 버리고 계단처럼 깨진다. `dsize=None`이면 `fx`, `fy` 배수를, `dsize`에 튜플을 주면 그 크기를 쓴다.

오늘 가장 많이 틀릴 곳이 여기였다. `image.shape`은 `(height, width, channel)`인데 OpenCV 함수에 크기를 넘길 때는 `dsize=(width, height)`로 반대다. 실제로 `cv2.resize(src1, (640, 480))`의 결과 shape이 `(480, 640, 3)`으로 나왔다. numpy는 행렬처럼 행이 먼저이고 OpenCV의 크기 인자는 화면처럼 가로가 먼저라 두 세계가 한 함수 안에서 만났다. `.shape`은 행렬, `dsize`는 화면이라고 외우면 된다. 화면 크기는 늘 "1920×1080"처럼 가로부터 말하니까.

### 이동과 회전

```python
M = np.float32([
    [1, 0, 10],    # x축으로 10 (오른쪽)
    [0, 1, 20],    # y축으로 20 (아래쪽)
])
dst = cv2.warpAffine(src=image, M=M, dsize=(cols, rows))
```

모든 픽셀 좌표 `(x, y)`를 `(x+10, y+20)`으로 옮기는 걸 for문이 아니라 행렬 곱 한 번으로 처리한다. `x' = 1·x + 0·y + 10`, `y' = 0·x + 1·y + 20`으로 풀어보면, 앞의 2×2 부분이 늘리기와 돌리기, 마지막 열이 옮기기다. 이미지 좌표는 y가 아래로 갈수록 커져서 y로 20 이동은 아래쪽이다.

```python
M = cv2.getRotationMatrix2D(center=(cols / 2, rows / 2), angle=60, scale=0.5)
# [[  0.25 ,   0.433,  81.149],
#  [ -0.433,   0.25 , 302.851]]
dst = cv2.warpAffine(image, M, (cols, rows))
```

회전 행렬은 직접 만들지 않고 "한가운데를 압정으로 고정하고 60도 돌려라"를 행렬로 바꿔주는 함수를 쓴다. `angle`은 양수가 시계 반대 방향이다. 손으로 확인해보니 `0.5 × cos60° = 0.25`, `0.5 × sin60° = 0.433`이 첫 두 열이고, 마지막 열은 원점(좌상단) 기준으로 돌리면 이미지가 화면 밖으로 날아가니까 중심이 제자리에 있게 되밀어주는 이동량이었다. 회전은 순수한 회전에 되밀기를 더한 것이라 `center`를 받는다.

`cv2.flip(image, 1)`은 좌우, `0`은 상하, `-1`은 둘 다 반전한다. 반전은 있는 픽셀의 자리만 바꿔서 지어낼 값이 없으니 보간법이 필요 없고 화질 손실도 없다. 딥러닝 데이터 증강에서 좌우 반전을 제일 먼저 쓰는 이유다. 다만 글자 인식에서는 반전된 b가 d가 되니 쓰면 안 된다.

### 어파인과 원근 변환

```python
pts1 = np.float32([[200, 100], [400, 100], [200, 200]])
pts2 = np.float32([[200, 300], [400, 200], [200, 400]])
M = cv2.getAffineTransform(pts1, pts2)
# [[ 1. ,  0. ,   0. ],
#  [-0.5,  1. , 300. ]]
```

"이 세 점이 저 세 점으로 가야 한다"고 말해주면 나머지 모든 픽셀이 어디로 갈지 정해진다. 2×3 행렬의 미지수가 6개라 점 하나에 식 2개씩, 3점이면 딱 풀린다. 직접 검산해보니 (200, 100)이 `y' = -0.5·200 + 100 + 300 = 300`으로 정확히 (200, 300)이 됐다. `getAffineTransform`은 마법이 아니라 연립방정식 풀이기였다. 어파인은 평행선이 평행하게 유지돼서 직사각형이 평행사변형은 돼도 사다리꼴은 안 되니 원근감은 표현하지 못한다.

```python
pts1 = np.float32([top_left, top_right, bottom_right, bottom_left])
w1 = abs(bottom_right[0] - bottom_left[0])
w2 = abs(top_right[0] - top_left[0])
max_width = max([w1, w2])
max_height = max([h1, h2])
pts2 = np.float32([[0, 0], [max_width - 1, 0],
                   [max_width - 1, max_height - 1], [0, max_height - 1]])

M = cv2.getPerspectiveTransform(src=pts1, dst=pts2)     # (3, 3)
dst = cv2.warpPerspective(train, M, (max_width, max_height))
```

원근 변환은 기찻길 사진에서 멀어질수록 좁아지는 두 레일을 위에서 내려다본 것처럼 평행하게 펴는 것이다. 3×3 행렬이라 미지수가 8개(마지막 칸은 1)여서 4점이 필요하다. 평행성은 유지되지 않고 직선이 직선으로 간다는 것만 보장돼서 사다리꼴을 직사각형으로 펼 수 있다. 3점은 어파인, 4점은 원근이라는 건 외울 게 아니라 미지수 개수를 세면 된다.

펼쳤을 때 크기는 비스듬히 찍혀 가까운 쪽 변이 길고 먼 쪽 변이 짧으니 긴 쪽에 맞춰야 해상도를 최대한 살린다. `pts2`에는 마지막 인덱스라 `-1`이 붙고 `dsize`에는 개수라 안 붙는다. 같은 사각형을 두 가지 방식으로 말한 것이다. 점 좌표는 반드시 `np.float32`여야 하고, 아니면 타입 에러가 난다.

변환 전후로 점이 어디로 갔는지 보려고 `cv2.circle(image, ...)`로 점을 찍었는데, 그 뒤 모든 결과 그림에 점이 따라다녔다. 지난 시간에 배운 대로 그리기 함수는 원본을 고친다.

## 이미지 연산과 합성
기하 변환이 픽셀을 옮겼다면 이번에는 픽셀 값을 계산한다. 사진 앱의 "밝기 +20"은 모든 픽셀에 20을 더하는 것이고, 워터마크는 두 이미지의 가중 평균이고, 배경을 지우고 스티커를 붙이는 건 마스크와 비트 연산이다.

```python
tree[200, 200]       # array([189, 207, 230], dtype=uint8)  [B, G, R]
tree[200, 200, 2]    # 230  Red 채널
```

인덱스가 `[y, x]`이고 색이 B, G, R 순서다. 그리고 `uint8`이라 0~255다. 오늘 나머지 내용이 전부 이 한 줄에서 나온다.

### ROI와 채널

```python
t = tree[190:240, 290:350]       # 나무 부분만 오려내기
tree[130:180, 310:370] = t       # 다른 자리에 붙여넣기 → 나무가 하나 더
tree[200:250, 210:270] = t       # 또 붙여넣기 → 셋
```

사진에서 필요한 네모 구역을 ROI(Region of Interest)라고 하는데 별도 함수 없이 numpy 슬라이싱이 곧 ROI다. 붙여넣으려면 양쪽 크기가 정확히 같아야 해서 높이 50, 폭 60이 맞았다. `t`는 복사가 아니라 뷰라서 `t`를 고치면 원본도 바뀌고, 떼어내려면 `.copy()`를 쓴다.

헷갈리기 딱 좋은 코드도 있었다. `white_box = tree[:110, :110]`로 뷰를 담았다가 `white_box = [255, 255, 255]`로 변수에 새 리스트를 대입하면 원본과의 연결이 끊기고 원본은 그대로다. 그다음 줄 `tree[:100, :100] = white_box`처럼 대괄호를 왼쪽에 두고 대입해야 원본이 바뀐다.

`b, g, r = cv2.split(tree)`, `cv2.merge((b, g, r))`로 채널을 쪼개고 합칠 수 있는데, `split`은 내부에서 메모리 복사가 일어나서 비싸다. 채널 하나만 보거나 고칠 거면 `tree[..., 2]`나 `img[:, :, 2] = 0`처럼 슬라이싱으로 하고, 세 채널을 각각 처리해서 다시 합칠 때만 `split`/`merge`를 쓴다.

### Saturation vs Modulo

```python
x = np.uint8([[250]])
y = np.uint8([[10]])
x + y            # array([[4]], dtype=uint8)     numpy: modulo
cv2.add(x, y)    # array([[255]], dtype=uint8)   OpenCV: saturation
```

오늘의 핵심 개념이었다. 250 + 10 = 260인데 0~255 그릇에 안 들어간다. OpenCV는 넘치면 꽉 찬 걸로 치는 포화(saturation)라 255, numpy는 넘친 만큼 처음으로 돌아가는 나머지(modulo)라 4다. 260을 2진수로 쓰면 `1 0000 0100`인데 8칸 그릇에 앞의 1이 안 들어가서 남은 게 4인 거라, 버그가 아니라 하드웨어의 자연스러운 동작이다. 강아지 사진 두 장을 `cv2.add`로 더하면 밝은 부분이 255에 몰려 하얗게 날아가고, `+`로 더하면 밝은 부분이 256을 넘는 순간 0 근처로 돌아가 뜬금없이 검게 뒤집혔다. 밝은 곳이 갑자기 새까매지는 건 말이 안 되니 이미지에서는 거의 항상 `cv2.add`가 맞다.

### 비트 연산과 마스크 합성

```python
black_img = np.zeros(star.shape, np.uint8)
black_img[:, :2560, :] = (255, 255, 255)     # 왼쪽 절반만 흰색

cv2.bitwise_and(black_img, star)    # 왼쪽 절반의 별만 남는다
cv2.bitwise_or(black_img, star)     # 왼쪽은 흰색, 오른쪽은 별 그대로
cv2.bitwise_not(star)               # 색 반전
```

흰색은 `255 = 1111 1111`, 검정은 `0 = 0000 0000`이다. 어떤 값이든 255와 AND하면 자기 자신이 나오고 0과 AND하면 무조건 0이다. 그래서 흰 곳은 통과, 검은 곳은 차단으로 마스크가 스텐실 역할을 한다. 별 이미지가 5120×5120이라 배열 하나가 75MB였는데, 개념 실습용 이미지는 미리 줄여두는 게 좋겠다.

레나 사진에 OpenCV 로고를 배경 없이 얹는 게 오늘 배운 것 중 가장 자주 쓰이는 기법이었다.

```python
rows, cols, channel = lenna.shape
logo = logo[0:rows, 0:cols]                       # ① 크기 맞추기

logo_gray = cv2.cvtColor(logo, cv2.COLOR_BGR2GRAY)
ret, mask = cv2.threshold(src=logo_gray, thresh=200, maxval=255,
                          type=cv2.THRESH_BINARY_INV)   # ② 마스크
np.unique(mask)                                   # array([0, 255])

mask_inv = cv2.bitwise_not(mask)                  # ③ 마스크 뒤집기
img1_fg = cv2.bitwise_and(logo, logo, mask=mask)        # ④ 로고에서 그림만
img2_bg = cv2.bitwise_and(lenna, lenna, mask=mask_inv)  #    레나에서 로고 자리를 판 것
dst = cv2.add(img1_fg, img2_bg)                   # ⑤ 더하기
```

로고는 배경이 흰색이고 그림이 색깔이라, `THRESH_BINARY_INV`로 200보다 밝은 배경은 0, 어두운 그림은 255로 만들면 로고 모양만 흰 판이 된다. 그걸 뒤집은 `mask_inv`와는 겹치는 부분이 하나도 없다. 각자 오려낸 조각을 더하면 한쪽이 0인 자리에 다른 쪽 값이 들어가서 퍼즐처럼 딱 맞물린다. `bitwise_and(logo, logo, mask=mask)`에서 같은 이미지를 두 번 넣는 게 이상했는데, 실제로 일하는 건 `mask` 인자다. 같은 이미지끼리 AND하면 자기 자신이니 결국 마스크 영역만 남기고 나머지는 0으로 지우는 관용구다. 요즘은 PNG의 알파 채널을 써서 경계가 부드럽게 합성하는 경우가 많지만, 알파가 없거나 실시간 영상에서는 이 방법이 여전히 빠르다고 한다.

### 블렌딩

```python
img1 = cv2.resize(img1, (640, 640))
img2 = cv2.resize(img2, (640, 640))     # 크기가 같아야 한다
blended = cv2.addWeighted(src1=img1, alpha=0.5, src2=img2, beta=0.5, gamma=0)
```

두 사진을 유리에 겹쳐놓고 밝기를 나눠주는 반투명 겹치기다. `alpha=0.9, beta=0.1`이면 워터마크처럼 두 번째가 희미하게 얹힌다. 두 이미지 크기가 반드시 같아야 해서 (640, 640)과 (1142, 1140)을 먼저 맞췄다. `alpha + beta`가 꼭 1일 필요는 없는데, 1을 넘기면 포화로 하얗게 날아간다.

## OCR - Tesseract
지금까지 이미지는 끝까지 숫자 배열이라 사람이 봐야 뜻을 알 수 있었다. 영수증 사진이 있어도 금액 합계를 내거나 "커피"를 검색할 수가 없다. 글자가 그림이라서다. OCR을 거치면 파이썬 문자열이 되고 그게 전부 가능해진다.

### Tesseract는 외부 프로그램이다

```python
import pytesseract
# pytesseract.pytesseract.tesseract_cmd = "C:/Program Files/Tesseract-OCR/tesseract.exe"
pytesseract.get_tesseract_version()    # <Version('5.5.3')>
pytesseract.get_languages()            # [..., 'eng', ..., 'kor', 'kor_vert', ...]
```

처음에 가장 헷갈린 지점이었다. `pytesseract`는 번역기가 아니라 통역 창구다. 이미지를 임시 파일로 저장하고, 터미널에서 `tesseract` 프로그램을 실행하고, 출력 파일을 읽어 문자열로 돌려준다. 그래서 `pip install pytesseract`만으로는 안 되고 Tesseract 본체를 따로 설치해야 한다(맥은 `brew install tesseract tesseract-lang`). 주석 처리된 줄은 Windows에서 설치해도 PATH에 안 잡힐 때 프로그램 위치를 알려주는 줄이다. Tesseract는 1985년 HP에서 시작해 구글이 오래 관리한 C++ 프로그램이라 파이썬으로 다시 짜는 대신 불러다 쓴다. `lang`에는 `get_languages()`에 나오는 이름만 쓸 수 있다.

### 한글은 lang='kor' 없이는 못 읽는다

```python
imgfile = Image.open(os.path.join(base_path, 'image.png'))
print(pytesseract.image_to_string(imgfile))
# Welcome to Mel's
# 2 Beef Burgr (€9,95/ea)
# ...
# TOTAL 30.69
```

영어 영수증은 기본값이 영어라 언어 지정 없이도 꽤 읽었는데, `$9.95`를 `€9,95`로, `Burger`를 `Burgr`로 읽었다. 한글 영수증을 같은 함수에 넣으니 `Haass`, `TREE: . OE` 같은 알파벳이 나왔다. 한 글자도 못 맞혔는데 에러가 안 나고 그럴듯한 알파벳이 나와서 더 위험하다.

```python
print(pytesseract.image_to_string(imgfile2, lang='kor'))
# 현금영수증
# 가명점명:      ㆍ         대표자:
# 거라일시                    2019/11/20 1098.30
# 공급가액:                     17.800원
```

`lang='kor'` 한 단어만 추가하니 읽혔다. 그래도 가맹점명이 가명점명, 거래일시가 거라일시, `10:38:30`이 `1098.30`, `17,800원`이 `17.800원`으로 나왔다. `,`와 `.`, `:`와 `.`처럼 작고 닮은 글자에서 틀린다. 사람은 금액에는 쉼표를 쓴다는 맥락으로 읽지만 OCR은 픽셀 모양만 본다. 그래서 OCR 결과는 항상 틀릴 수 있다는 전제로 받고, 실무에서는 정규식으로 후처리한다고 한다. `pytesseract`는 PIL 이미지도 OpenCV 배열도 받아서 OpenCV로 전처리한 결과를 바로 넘길 수 있다.

### image_to_boxes - 글자마다 좌표

```python
imgbox = pytesseract.image_to_boxes(img2, lang='kor')
# 현 122 376 134 391 0
# 금 142 375 155 390 0
# ...

imgH, imgW, _ = img2.shape
img_temp = img2.copy()
for line in imgbox.splitlines():
    boxes = line.split()
    x, y, w, h = map(int, boxes[1:5])
    cv2.rectangle(img_temp, (x, imgH - y), (w, imgH - h), (0, 0, 255), 1)
```

무슨 글자인지뿐 아니라 어디 있는지까지 받는다. 그런데 이 다섯 숫자가 함정이었다. 수업 주석에는 x, y, w, h라고 적혀 있었는데, 그렇게 읽으면 '현' 한 글자가 134×391픽셀로 이미지 전체(339×406)를 거의 다 덮는다. 실제로는 `left, bottom, right, top, page`로, 폭과 높이가 아니라 반대쪽 모서리의 절대 좌표다. `134 - 122 = 12`, `391 - 376 = 15`로 읽으면 12×15픽셀이라 한글 한 글자에 딱 맞다. 게다가 원점이 이미지의 좌하단이다. 화면 좌표는 위에서 아래로 y가 커지는데 Tesseract는 PDF나 타이포그래피 쪽 관습대로 아래에서 위로 잰다. 그래서 `imgH - y`로 뒤집는다. '현'의 top 391을 뒤집으면 `406 - 391 = 15`로 이미지 맨 위가 되고, '현금영수증'이 영수증 제목이니 정확히 맞는다. 코드는 변수 이름만 `w, h`로 붙였을 뿐 대각선 두 점을 주는 거라 동작은 정확했다. `image_to_data()`를 쓰면 좌상단 기준 `left/top/width/height`로 받을 수 있어서 실무에서는 이쪽을 더 많이 쓴다고 한다.

### --psm과 --oem

```python
pytesseract.image_to_string(img2, lang='kor', config='--psm 3 --oem 3')
```

| `--psm` | 뜻 | 언제 |
|---|---|---|
| 3 | 자동 페이지 분할 (기본값) | 일반 문서, 영수증 |
| 6 | 하나의 균일한 텍스트 블록 | 명함, 표지판 |
| 7 | 이미지 전체가 한 줄 | 자동차 번호판, 제목 |
| 8 | 한 단어 | 잘라낸 단어 하나 |
| 10 | 한 글자 | 낱글자 |
| 11 | 흩어진 텍스트 | 간판, 포스터 |

`--psm`은 이미지가 어떻게 생겼는지 알려주는 힌트다. 기본값 3은 "여기가 단락이고 여기가 열이겠군" 하는 레이아웃 분석을 먼저 하는데, 번호판처럼 한 줄뿐인 이미지에 이걸 시키면 엉뚱하게 여러 블록으로 쪼개서 순서가 뒤엉킨다. `--psm 7`로 한 줄이라고 말해주면 그 단계를 건너뛴다. `--oem`은 엔진 선택인데 1이 LSTM 신경망이고 3이 기본값(알아서)이다. Tesseract 4부터 딥러닝 시간에 배운 그 LSTM이 들어가서 글자를 순서 있는 시퀀스로 읽게 됐고, 한글이 그럭저럭 읽히는 게 LSTM 덕분이라고 한다. 본격 인식 전에 글자 방향과 문자 체계를 자동으로 판단하는 OSD도 있어서 세로로 찍은 사진도 돌려 읽을 수 있다.

## 명함 검출과 인식
OCR에 넣은 건 이미 반듯한 스캔 이미지였는데, 현실에서는 책상 위 명함을 폰으로 비스듬히 찍는다. 그대로 OCR에 넣으면 거의 못 읽는다.

```
사진 → 명함이 어디 있는지 찾고 → 반듯하게 펴서 → OCR
      (오늘의 새 부분)              (기하 변환)     (Tesseract)
```

영수증 스캔 앱, 번호판 인식, 서류 촬영 앱이 전부 같은 구조다. 노트북은 명함이 흰 배경에 검정 글씨이고, 충분히 크게 촬영됐고, 각진 사각형이라는 세 가지를 전제했다. 흰 배경이라 이진화로 분리되고, 충분히 커서 면적 필터가 통하고, 각진 사각형이라 꼭짓점 4개 필터가 통한다. 세 전제가 곧 세 필터의 근거였다. 둥근 모서리나 어두운 배경 명함에서는 실패하니, 오늘 배우는 건 만능 알고리즘이 아니라 조건을 정하고 그에 맞는 필터를 설계하는 사고방식이다.

### 줄이고, 흑백으로

```python
src_resized1 = cv2.resize(src1, (0, 0), fx=0.5, fy=0.5)   # (810, 1080, 3) → (405, 540, 3)
src_gray1 = cv2.cvtColor(src_resized1, cv2.COLOR_BGR2GRAY)
```

외곽선 검출은 픽셀을 전부 훑어서 픽셀이 4배면 시간도 4배라, 위치만 찾는 데는 절반 크기로 충분하다. 반대로 문자 인식할 때는 오히려 글자를 키우는 경우가 많아서, 마지막에는 원본에서 잘라내 720×400으로 만든다. 단계마다 필요한 해상도가 다르다. 흑백은 컬러의 1/3 용량이고, 이진화나 외곽선 검출이 애초에 1채널 입력을 요구한다. 스마트폰의 얼굴 인식도 컬러값을 거의 안 쓴다고 한다.

### Otsu 이진화

```python
_, src_bin1 = cv2.threshold(src_gray1, 130, 255, cv2.THRESH_BINARY)

th, src_after = cv2.threshold(src_gray2, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)
print(th1, th2, th3)    # 132.0  152.0  118.0
```

이 밝기보다 밝으면 흰색, 어두우면 검정으로 두 값만 남기는 게 이진화다. 처음에 130으로 고정했더니 명함1에는 통하는데 명함2에는 안 통했다. 사진마다 조명이 달라서다. `plt.hist(src_gray1.ravel(), bins=256, range=[0, 256])`로 히스토그램을 그려보면 어두운 책상 배경과 밝은 명함이 섞여 봉우리가 두 개 생기는데, 그 사이 골짜기가 우리가 찾는 임계값이고 사진마다 위치가 다르다.

Otsu는 0부터 255까지 모든 임계값을 시험해서 나뉜 두 그룹이 가장 뚜렷하게 갈리는 골짜기를 자동으로 찾는다. `THRESH_OTSU`를 켜면 `thresh` 인자는 무시돼서 "내가 안 정한다"는 뜻으로 0을 쓰고, `|`(비트 OR)로 이진화 방식과 임계값 방식을 합친다. 세 장의 명함에 돌리니 132, 152, 118로 사진마다 다른 값이 나왔다. 130으로 고정했다면 118이 최적인 3번 명함은 실패했을 것이다. 다만 조명이 한쪽만 비춰서 봉우리가 두 개가 아니면 Otsu도 실패하는데, 그럴 때는 구역마다 다른 임계값을 쓰는 `adaptiveThreshold`를 쓴다고 한다.

### findContours

```python
contours, _ = cv2.findContours(src_bin1, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
len(contours)          # 88
contours[0].shape      # (686, 1, 2)
```

흰 덩어리들의 테두리를 따라가며 좌표를 줍는다. 덩어리가 88개였고, 각 외곽선은 `(K, 1, 2)` 모양이다. 덩어리마다 길이가 달라서 배열들의 튜플이고, 가운데 1은 C++ 구현에서 온 의미 없는 더미 차원이다. `RETR_EXTERNAL`은 가장 바깥 외곽선만 가져와서 명함 안의 글자는 무시하고, `CHAIN_APPROX_NONE`은 모든 점을 저장해서 686개나 됐다. `CHAIN_APPROX_SIMPLE`은 직선 구간의 양 끝점만 저장하는데, 실제 사진의 변은 노이즈 때문에 삐뚤빼뚤해서 이걸 써도 점이 수백 개 남는다. "대충 직선으로 봐줘"는 별개 함수가 필요하다.

### 후보 88개를 필터 세 개로

```python
for pts in contours:
    if cv2.contourArea(pts) < 1000:           # ① 면적
        continue
    approx = cv2.approxPolyDP(pts, cv2.arcLength(pts, True) * 0.02, True)   # ② 근사화
    if len(approx) != 4 or not cv2.isContourConvex(approx):                # ②③ 꼭짓점 4개, 볼록
        continue
```

`findContours`는 키보드 무늬, 책상 얼룩, 글자 하나하나까지 88개를 준다. 여기서 명함 하나를 골라내는 게 오늘의 핵심이었다. 첫째, `contourArea`로 넓이가 1000픽셀 미만이면 버린다. 1000은 이 이미지 크기에서 글자보다 크고 명함보다 훨씬 작게 실험으로 정한 값이다. 둘째, `approxPolyDP`로 삐뚤빼뚤한 686개 점을 꼭짓점 몇 개짜리 도형으로 단순화해서 4개가 아니면 버린다. 두 끝점을 직선으로 잇고 가장 멀리 벗어난 점이 `epsilon`보다 멀면 꼭짓점으로 인정하는 걸 반복하는 Douglas-Peucker 알고리즘이다. `epsilon`을 둘레(`arcLength`)의 2%로 주는 건 고정값이면 큰 명함에는 너무 깐깐하고 작은 명함에는 너무 헐거워지기 때문이다. 비율로 주면 크기와 상관없이 같은 정도로 단순화된다. 셋째, `isContourConvex`로 안으로 파인 곳이 있는 오목한 사각형을 버린다. 수업 코드는 볼록 검사를 먼저 했는데, `or`는 앞이 True면 뒤를 건너뛰니 꼭짓점 4개 검사를 앞에 두는 게 의도가 더 잘 드러난다.

### 꼭짓점 순서 - 이 예제 최대의 함정

```python
print(approx)
# [[[549 368]]
#  [[480 263]]
#  [[251 331]]
#  [[295 457]]]
```

필터를 통과하면 네 꼭짓점을 얻는데 순서를 모른다. `findContours`는 테두리를 따라가다 처음 만난 점부터 주는데, 그 시작점이 명함이 놓인 각도에 따라 매번 다르다. `getPerspectiveTransform`은 짝을 순서대로 맞춰서 순서가 어긋나면 명함이 X자로 꼬이거나 뒤집혀 나온다.

```python
def reorderPts(pts):
    idx = np.lexsort((pts[:, 1], pts[:, 0]))    # x 기준 정렬 (동점이면 y)
    pts = pts[idx]
    if pts[0, 1] > pts[1, 1]:                   # 왼쪽 두 점: 위가 먼저
        pts[[0, 1]] = pts[[1, 0]]
    if pts[2, 1] < pts[3, 1]:                   # 오른쪽 두 점: 아래가 먼저
        pts[[2, 3]] = pts[[3, 2]]
    return pts                                  # [좌상, 좌하, 우하, 우상]

dw, dh = 720, 400
srcQuad = reorderPts(approx.reshape(4, 2).astype(np.float32))
dstQuad = np.array([[0, 0], [0, dh], [dw, dh], [dw, 0]], np.float32)
```

x로 정렬하면 앞 두 개가 왼쪽 점, 뒤 두 개가 오른쪽 점이 되고, 각 쌍 안에서 y를 비교해 자리를 바꾸면 [좌상, 좌하, 우하, 우상] 반시계 순서가 된다. 목적지 `dstQuad`도 같은 순서로 맞춘다. `np.lexsort`는 마지막에 준 키가 1순위라 `(pts[:, 1], pts[:, 0])`이면 x가 1순위다. 반환값은 정렬된 배열이 아니라 인덱스라서 `pts[idx]`로 한 번 더 써야 한다. `pts[[0, 1]] = pts[[1, 0]]`은 팬시 인덱싱으로 복사본을 먼저 만들고 써넣어서 `a, b = b, a`처럼 안전하게 교환된다.

원리를 확인하는 중간 실습 셀에서 재미있는 일이 있었다. `pts[idx]`를 출력하니 잘 정렬된 게 보였는데, 다음 셀에서 y를 비교했더니 아무것도 안 바뀌고 정렬 전 원본이 그대로 나왔다. `pts[idx]`는 표현식일 뿐 대입이 아니라서 화면에는 예쁘게 출력됐지만 `pts` 변수 자체는 안 바뀐 것이다. 함수 안에는 `pts = pts[idx]` 재대입이 제대로 들어 있어서 함수는 정상이었다. 화면에 출력된 것과 변수가 바뀐 건 별개라는 걸, 아까 `white_box`와 같은 종류의 실수로 다시 봤다.

### 원근 변환 + OCR

```python
pers = cv2.getPerspectiveTransform(srcQuad, dstQuad)
dst = cv2.warpPerspective(src, pers, (dw, dh), flags=cv2.INTER_CUBIC)
dst_rgb = cv2.cvtColor(dst, cv2.COLOR_BGR2RGB)
print(pytesseract.image_to_string(dst_rgb, lang='script/Hangul+eng'))
```

작은 명함 영역을 720×400으로 키우는 확대라 화질 좋은 `INTER_CUBIC`을 썼다. 글자를 읽어야 하니 화질이 곧 인식률이다. 결과로 명함에 적힌 이름(한글과 영문), 직함, 해시태그, 이메일, 홈페이지 주소가 거의 그대로 나왔다. 비스듬한 사진 한 장에서 텍스트가 나오는 걸 보니 오늘 배운 게 전부 여기서 만났다.

같은 파이프라인인데 `lang='Hangul+eng'`으로 바꾼 셀에서는 영어는 멀쩡하고 한글만 `Ely 4 7` 같은 알파벳으로 깨졌다. Tesseract 언어 데이터는 `kor`, `eng`처럼 그 언어의 단어와 문법까지 학습한 언어 모델과, `script/Hangul`처럼 글자 모양만 학습한 문자 체계 모델 두 종류다. 문자 체계 모델은 반드시 `script/` 접두어가 필요한데, 그게 빠진 `Hangul`은 없는 이름이라 영어만으로 읽은 것으로 보인다. `get_languages()`에 나온 이름을 그대로 쓰는 게 안전하다. 명함에서 `kor` 대신 `script/Hangul`을 쓴 건, 이름이나 직함처럼 사전에 없는 고유명사가 많아서 단어 사전이 오히려 비슷한 단어로 "고쳐" 버리는 걸 피하려는 것 같다.

### 고칠 점들
- `cv2.polylines(img, pts, ...)`에 외곽선 `(K, 1, 2)`를 그대로 넘기면 OpenCV가 "점 1개짜리 다각형 K개"로 해석해서 점만 촘촘히 찍힌다. 다각형 하나를 그릴 때는 `[approx]`처럼 리스트로 감싼다.
- `dst`를 for문 안에서만 만들면 명함을 못 찾았을 때 `NameError`가 난다. 종합 코드에서는 `dst = np.zeros((dh, dw), np.uint8)`로 미리 만들어뒀는데, 엄밀하게는 컬러라 `(dh, dw, 3)`이 맞다.
- 루프에서 `dst`를 덮어써서 명함이 두 장이면 마지막 것만 남는다. 여러 장이면 리스트에 모아야 한다.

## 헷갈리기 쉬운 부분
- `.shape`은 (세로, 가로), `dsize`는 (가로, 세로)다.
- 줄일 땐 `INTER_AREA`, 키울 땐 `INTER_CUBIC`. 반전은 보간이 필요 없다.
- 이동, 회전, 어파인은 2×3 행렬로 `warpAffine`, 원근은 3×3 행렬로 `warpPerspective`. 3점은 어파인, 4점은 원근이다.
- 변환용 점 좌표는 `np.float32`다.
- `cv2.add`는 255에서 멈추고 numpy `+`는 0으로 돌아간다.
- 슬라이싱은 뷰다. 원본을 바꾸려면 `arr[a:b] = 값`처럼 대괄호를 왼쪽에 둔다. 화면 출력과 변수 변경은 별개다.
- 마스크 합성은 `bitwise_not` → `bitwise_and(img, img, mask=...)` 두 번 → `cv2.add`다.
- `addWeighted`는 두 이미지 크기가 같아야 한다.
- Tesseract는 따로 설치하는 외부 프로그램이다. 한글은 `lang='kor'`가 있어야 읽는다.
- `image_to_boxes`는 `left bottom right top`이고 원점이 좌하단이라 `imgH - y`로 뒤집는다.
- `--psm`은 이미지 모양 힌트다. 한 줄이면 7, 덩어리면 6.
- OCR 결과는 항상 틀릴 수 있어서 후처리가 필요하다.
- Otsu는 `thresh=0`, `THRESH_BINARY | THRESH_OTSU`로 사진마다 임계값을 자동으로 고른다.
- 검출은 후보를 필터로 줄이는 일이다. 면적 → `approxPolyDP`(둘레 비율 epsilon) → 꼭짓점 4개 → 볼록.
- 찾은 4점은 순서가 보장되지 않아서 정렬하고 목적지도 같은 순서로 맞춘다.
- 문자 체계 모델은 `script/Hangul`처럼 접두어가 필요하다.

## 오늘 배운 내용 정리
오늘은 기하 변환, 이미지 연산과 합성, OCR을 배우고 명함 검출과 인식으로 엮었다.

```
기하 변환: resize(dsize=(w, h), interpolation), warpAffine(M 2×3), getRotationMatrix2D,
          flip, getAffineTransform(3점), getPerspectiveTransform(4점) + warpPerspective.
연산: ROI = 슬라이싱(뷰). split/merge는 복사. cv2.add(포화) vs +(modulo).
합성: threshold(BINARY_INV)로 마스크 → bitwise_not → bitwise_and(mask=) → add. addWeighted로 반투명.
OCR: pytesseract.image_to_string(img, lang='kor', config='--psm 3 --oem 3').
     image_to_boxes는 left bottom right top, 원점 좌하단.
명함: resize → gray → Otsu → findContours(EXTERNAL) → 면적 / approxPolyDP / 볼록 필터
      → reorderPts → warpPerspective(720×400, INTER_CUBIC) → OCR.
```

명함 인식이 결국 "후보를 줄여나가는 필터"라는 게 가장 기억에 남았다. 88개 덩어리에서 면적으로 거르고, 꼭짓점 4개로 거르고, 볼록한지로 거르니 명함 하나가 남았다. 각 필터가 처음에 세운 전제 하나씩과 짝을 이뤄서, 딥러닝 없이도 조건을 잘 세우면 이 정도까지 된다는 게 신기했다. 그리고 `pts[idx]`가 화면에 잘 출력돼서 정렬된 줄 알았는데 변수는 그대로였던 걸 보면서, 주피터에서 보이는 것과 실제 상태를 구분하는 습관이 필요하다고 느꼈다.

---
