---
layout: single
title: "컴퓨터 비전 정리 4 - YOLO11 탐지·세그·포즈, 전이학습, 추적, 동영상 번호판 인식"
categories: [coding, ComputerVision]
tag: [study-log, ComputerVision, YOLO11, Ultralytics, segmentation, pose, transfer-learning, tracking, OCR]
toc: true
author_profile: false
sidebar:
    nav: "docs"
search: true
---
<hr/>

컴퓨터 비전 단원의 마지막 날이었다. 어제 OpenCV DNN으로 GoogLeNet, YuNet, SSD 세 모델을 쓰면서 모델마다 전처리 값과 출력 모양과 좌표계가 달라서 매번 코드를 새로 썼는데, 오늘은 그걸 한 번에 정리해주는 Ultralytics YOLO11을 배웠다. 파일 이름만 바꾸면 탐지, 세그멘테이션, 포즈를 같은 코드로 하고, 내 데이터로 전이학습을 해서 가위바위보를 찾게 만들고, `predict`를 `track`으로 바꿔 영상 속 물체에 ID를 붙였다. 마지막 실습에서는 어제 만든 번호판 인식을 동영상에 붙이면서 같은 추적 문제를 손으로 풀었다.

## YOLO11 - 한 번만 본다
분류는 "이 사진이 무엇이냐"에 답 하나를 내는 객관식이고, 탐지는 "이 사진에서 찾을 수 있는 걸 다 찾아 동그라미 치고 이름 쓰시오"다. 답이 몇 개일지 모른다는 게 문제를 훨씬 어렵게 만든다. 어제 YuNet은 N×15 가변 행렬로, SSD는 최대 200개 자리를 미리 파놓고 신뢰도로 거르는 식으로 그 문제를 풀었다.

예전 R-CNN 계열은 물체가 있을 법한 자리를 수백 군데 후보로 뽑고 그 자리마다 "여기 뭐 있냐"를 물어보는 2단계라, 후보가 2000개면 분류를 2000번 돌려서 정확하지만 느렸다. YOLO는 이미지를 격자로 나눠놓고 각 칸에서 "여기 물체 중심이 있냐, 상자 크기는, 무슨 클래스냐"를 한꺼번에 뱉는 1단계다. 신경망을 한 번만 통과해서 이름이 You Only Look Once다. v5부터 파이토치로 넘어왔고, v9~v11은 미리 정해둔 상자 크기 후보(앵커) 없이 중심점에서 직접 크기를 예측하는 앵커프리 구조라고 한다.

### 세 줄 API

```python
!pip install ultralytics
from ultralytics import YOLO

model = YOLO('yolo11n.pt')       # 없으면 자동 다운로드 (5.4MB)
print(len(model.names))          # 80
# {0: 'person', 1: 'bicycle', 2: 'car', ..., 79: 'toothbrush'}
```

가중치 이름은 `yolo11` 세대, `n` 크기(n < s < m < l < x), 작업 종류(없으면 탐지, `-seg`, `-pose`), `.pt` 순서다. `n`은 가장 작고 빠른 대신 정확도가 가장 낮은 실습용이고, 코드는 한 글자만 바꾸면 된다. `model.names`는 COCO 데이터셋 80클래스라 이 밖의 물건은 못 찾는다. 번호판도 가위바위보도 없다.

```python
results = model(source='./test_image_dir/*.jpg', save=True)
```

```
image 1/4 test1.jpg: 544x640 1 laptop, 1 mouse, 1 keyboard, 1 cell phone, 8.6ms
image 2/4 test2.jpg: 448x640 4 zebras, 1 giraffe, 54.9ms
image 3/4 test3.jpg: 640x640 2 cups, 1 bowl, 2 sandwichs, 1 dining table, 54.4ms
image 4/4 test4.jpg: 480x640 2 persons, 1 truck, 1 horse, 55.3ms
```

`source`는 파일, 와일드카드, 폴더, 동영상, 웹캠 번호까지 다 받는다. `save=True`면 박스가 그려진 이미지를 `runs/detect/predict/`에 저장하는데, 실행할 때마다 `predict2`, `predict3`으로 폴더가 늘어나서 출력 끝의 `Results saved to`를 보는 게 확실하다. 이미지 크기가 544×640, 448×640처럼 다른 건 긴 변을 640에 맞추고 짧은 변은 32의 배수로 패딩하기 때문이다. 백본이 이미지를 32배까지 줄여서 입력은 항상 32의 배수여야 한다.

### Results 객체

```python
result = results[0]
# boxes: Boxes object     ← 탐지 모델이라 채워져 있다
# masks: None
# keypoints: None
# orig_shape: (516, 640)

for result in results:
    uniq, cnt = np.unique(result.boxes.cls.cpu().numpy().astype(np.int32), return_counts=True)
    print(dict(zip(uniq.tolist(), cnt.tolist())))     # {63: 1, 64: 1, 66: 1, 67: 1}
    for box in result.boxes:
        print(model.names[int(box.cls)], box.xyxy.cpu().numpy())
        # laptop [[147.85  19.12  548.45  336.28]]
```

반환값은 입력 이미지 한 장당 하나인 `List[Results]`라 한 장을 넣어도 `results[0]`으로 꺼내야 한다. `boxes`, `masks`, `keypoints` 세 칸 중 무엇이 채워지느냐가 곧 그 모델이 하는 일이다. 이 한 문장이 오늘 배운 것의 골자였다. `boxes`에는 클래스 번호 `cls`, 신뢰도 `conf`, 좌상단·우하단 픽셀 좌표 `xyxy`, 중심과 크기 `xywh`가 있고, 끝에 `n`이 붙은 `xyxyn`, `xywhn`은 0~1 정규화 버전이다. 어제 SSD에서 손으로 곱해주던 좌표계를 여기서는 이미 만들어준다. 결과가 GPU 위의 파이토치 텐서라 넘파이로 바꾸려면 `.cpu().numpy()`가 필요한데, CPU에서 돌렸으면 `.cpu()`는 그냥 통과해서 습관으로 붙여두면 어디서든 돌아간다.

### 세그멘테이션과 포즈

```python
model = YOLO('yolo11n-seg.pt')
results = model(source='/content/test_image_dir/*.jpg', save=True)   # runs/segment/predict
print(results[0].masks.data.shape)    # torch.Size([4, 544, 640])
```

탐지가 "이 사각형 안에 고양이가 있다"라면 세그멘테이션은 "이 픽셀들이 고양이다"다. 픽셀마다 클래스만 매기는 semantic과 달리 YOLO는 같은 클래스라도 개체별로 따로 마스크를 주는 instance segmentation이다. 마스크는 `[물체 수, 높이, 너비]`인데 높이와 너비가 원본이 아니라 모델 입력 크기라서, 원본에 겹쳐 그리려면 크기를 맞춰야 한다. 그런데 같은 사진에서 탐지 모델은 얼룩말 4마리를 찾았는데 세그멘테이션 모델은 1마리만 찾았다. 나머지 3마리는 폭이 40픽셀 남짓으로 아주 작았다. 세그 모델은 박스와 함께 마스크 계수까지 예측해야 해서 같은 nano 크기 안에서 작은 물체에서 먼저 티가 난다고 한다. 반대로 다른 사진에서는 세그 모델이 버스를 하나 더 찾아서 어느 쪽이 항상 낫다는 건 아니다.

```python
model = YOLO('yolo11n-pose.pt')
results = model(source=os.path.join(target_dir, '*.jpg'), save=True)   # runs/pose/predict
print(results[0].keypoints.data.shape)    # torch.Size([1, 17, 3])  [사람 수, 키포인트, (x, y, conf)]
# [[ 567.65  176.05  0.99536]     # 0 코
#  [ 598.22  151.91  0.98826]     # 1 왼쪽 눈
#  [ 555.05  146.63  0.96244]     # 2 오른쪽 눈
#  [ 650.43  171.26  0.94886]     # 3 왼쪽 귀
#  [ 541.31  156.93  0.42457]     # 4 오른쪽 귀
```

포즈는 COCO 기준 17개 키포인트(얼굴 5, 상체 6, 하체 6)와 골격 연결선을 준다. 다른 관절은 0.9 이상인데 오른쪽 귀만 0.42였다. 사람이 살짝 옆을 봐서 한쪽 귀가 안 보이기 때문이다. 가려진 관절도 모델이 추측한 좌표는 뱉어서, 실무에서는 신뢰도 0.5 미만인 키포인트는 선을 안 그리거나 계산에서 빼야 안 보이는 팔이 엉뚱하게 뻗은 골격이 안 그려진다고 한다.

노트북에 `from PIL import Image` 다음 줄에 `from IPython.display import Image`가 나란히 있었는데, 뒤에 온 게 앞의 것을 덮어써서 실제로 쓰이는 `Image`는 전부 IPython 쪽이었다. 나중에 PIL 기능을 쓰려다 헤매기 딱 좋다.

## 전이학습 - 가위바위보 3클래스로
COCO 80클래스 밖은 못 찾는다. 76번 `scissors`가 있지만 문구용 가위지 손 모양이 아니다. 현장에서 필요한 건 불량 부품, 안전모 착용 여부, 번호판처럼 대부분 COCO에 없다. 사진에서 모서리, 질감, 덩어리를 알아보는 능력은 얼룩말을 찾든 가위바위보를 찾든 똑같이 필요하고 그건 이미 COCO로 배워놨으니, 새로 가르칠 건 "그래서 이 덩어리가 뭐냐"뿐이다. KoBERT 때 한 전이학습과 같은 이야기다.

### 데이터와 yaml

```
RockPaperScissors_Data/
├── train/  images/  labels/
├── valid/  images/  labels/
├── test/   images/  labels/
└── data.yaml
```

Roboflow라는 공개 데이터셋 사이트에서 받은 데이터인데, 이미지 옆에 같은 이름의 `.txt`가 정답이다. YOLO 형식은 한 줄에 한 물체로 `클래스번호 중심x 중심y 너비 높이`이고 전부 0~1 정규화 좌표다. 물체가 없는 사진의 txt는 빈 파일인데, 학습 로그에 6,455장 중 2,516장이 배경 이미지로 나왔다. "여기엔 아무것도 없다"를 안 가르치면 모델이 아무 데나 박스를 그려서 일부러 넣는다. 실무에서 전이학습 시간의 대부분은 학습이 아니라 이 라벨링에 들어간다고 한다.

```python
import yaml
data = {
    'train': '/content/RockPaperScissors_Data/train/images/',
    'val': '/content/RockPaperScissors_Data/valid/images/',
    'test': '/content/RockPaperScissors_Data/test/images',
    'names': ['Paper', 'Rock', 'Scissors'],
    'nc': 3,
}
with open('/content/RockPaperScissors_Data/RockPaperScissors_Data.yaml', 'w') as f:
    yaml.dump(data, f)
```

받은 `data.yaml`은 `../train/images` 같은 상대 경로라 그대로 쓰면 못 찾아서 절대 경로로 새로 만들었다. `nc`는 클래스 개수, `names`는 클래스 이름이고 순서가 곧 번호다. 라벨 폴더 경로는 안 적는데, Ultralytics가 이미지 경로의 `images`를 `labels`로 바꿔서 찾는다. 그래서 폴더 이름이 반드시 `images`와 `labels`여야 하고, 다르면 에러 없이 전부 배경으로 학습된다. `names`를 알파벳순으로 정렬하면 txt 안의 번호와 어긋나서 학습은 잘 되는데 예측만 이상해진다.

### 학습

```python
model = YOLO('yolo11n.pt')      # 깨끗한 사전학습 가중치에서 다시 시작
model.train(data='/content/RockPaperScissors_Data/RockPaperScissors_Data.yaml',
            epochs=30, patience=5, imgsz=416)
```

```
Transferred 451/499 items from pretrained weights
```

이 한 줄이 전이학습의 정의였다. 499개 중 451개만 옮겨졌고, 못 옮겨진 48개가 검출 헤드의 클래스 관련 가중치다. 80칸짜리를 3칸짜리에 부을 수는 없으니 그 부분만 새로 초기화하고, 특징을 뽑는 백본과 넥은 가져다 쓴다. 그래서 데이터가 적어도 된다. `patience=5`는 케라스 `EarlyStopping`과 같은 개념인데, 여기서는 `model.train()`이 알아서 최선 가중치를 `best.pt`로 남겨서 `restore_best_weights`를 챙길 필요가 없다. `imgsz=416`은 기본 640보다 작아서 빠르다.

```
Class   Images  Instances   Box(P      R      mAP50  mAP50-95)
  all      576        400   0.576   0.54     0.554      0.331     ← 1에포크
```

P는 찾았다고 한 것 중 맞은 비율, R은 실제 있는 것 중 찾아낸 비율이다. mAP50은 IoU 0.5 기준으로 "대충 겹치면 맞다고 쳐주는" 평균 정확도이고, mAP50-95는 IoU 0.5~0.95를 다 재서 박스가 얼마나 딱 맞는지까지 본다. mAP50은 1에포크 0.554, 2에포크 0.684, 3에포크 0.467로 떨어졌다가 4에포크 0.709, 15에포크 0.931, 30에포크 0.953까지 올랐다. 3에포크에서 떨어지는 건 정상이다. 학습 초반은 가중치가 크게 흔들리고, YOLO는 기본으로 이미지 4장을 이어 붙이는 모자이크 증강을 걸어서 훈련 이미지가 매번 달라진다. `patience=5`는 5에포크 연속으로 최고 기록이 안 깨져야 멈추는데 계속 조금씩 올라서 30에포크를 다 돌았다. Tesla T4로 약 19분 걸렸다.

```
all   576 images   400 instances    P 0.964   R 0.910   mAP50 0.953   mAP50-95 0.764
```

mAP50 0.953과 mAP50-95 0.764의 차이가 크다는 게 정보다. 손이 여기 있다는 건 거의 다 맞히는데 박스가 손 윤곽에 딱 맞지는 않는다는 뜻이다. 저장할 때 `Optimizer stripped`가 찍히는데, 추론에는 필요 없는 옵티마이저 상태를 떼어내서 `best.pt`가 원본과 같은 5.4MB다.

```python
print(model.names)     # {0: 'Paper', 1: 'Rock', 2: 'Scissors'}
model.save('/content/trained_yolo_rps_model.pt')
loaded_model = YOLO('/content/trained_yolo_rps_model.pt')

results = model(source='/content/RockPaperScissors_Data/test/images/', save=True)
# image 1/304 ...: 416x416 (no detections)
# image 5/304 ...: 416x416 1 Scissors
# image 7/304 ...: 416x416 1 Paper, 1 Rock
```

학습이 끝나니 `model.names`가 80개에서 3개가 됐다. `model.train()`은 새 모델을 돌려주는 게 아니라 그 자리에서 바꿔서, 이제 이 모델에 얼룩말 사진을 넣으면 얼룩말이라고 안 한다. COCO 80클래스가 다시 필요하면 `YOLO('yolo11n.pt')`를 새로 만들어야 한다. 학습 직전에 모델을 다시 만든 것도 학습은 항상 알려진 깨끗한 상태에서 시작한다는 습관 때문이다. 결과는 `runs/detect/train/weights/`에 검증 성적이 가장 좋았던 `best.pt`와 마지막 에포크의 `last.pt`가 남는다. 테스트에 `(no detections)`가 많았는데 성능이 나쁜 게 아니라 손이 아예 안 나오는 배경 이미지가 섞여 있어서, 아무것도 안 찾는 게 정답인 사진들이다.

## 추적 - 프레임을 넘어 ID 붙이기
탐지는 매 프레임 기억상실증이다. 30fps 영상이면 1초에 30번 처음 본다. 사람은 "아까 그 차"라고 자동으로 잇지만 컴퓨터에는 그 이음새를 따로 만들어줘야 한다. ID가 없으면 교차로를 지나간 차가 몇 대인지 셀 때 같은 차를 프레임마다 세고, 같은 물체의 위치 변화를 몰라서 속도나 궤적도 못 구하고, "이건 이미 처리했다"도 못 한다.

```python
model = YOLO("yolo11n.pt")
results = model.track(source, save=True, show=True)
```

바뀐 건 함수 이름 하나다. 안에서는 프레임마다 탐지한 박스 목록을 지난 프레임의 ID들과 짝지어서, 짝을 찾은 건 옛 ID를 유지하고 못 찾은 건 새 ID를 발급하고 오래 안 보인 ID는 폐기한다. 짝짓기의 재료는 보통 위치(다음 위치를 예측해두고 가까운 걸 고른다), 박스 모양, 겉모습(re-ID)이고, 겉모습까지 쓰면 사람이 서로 교차해도 안 헷갈린다. 추적기는 YOLO 모델과 별개로 `tracker='...yaml'`로 갈아끼우는 부품이다.

```python
import argparse
from ultralytics import YOLO

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('arg1')
    args = parser.parse_args()
    model = YOLO("yolo11n.pt")
    results = model.track(args.arg1, save=True, show=True)
```

```bash
python yolo11_tracking.py ski.mp4       # runs/detect/track/ski.avi
python yolo11_tracking.py airport.mp4   # runs/detect/track-2/airport.avi
```

이 부분만 노트북이 아니라 `.py` 스크립트였는데, `show=True`가 별도 창을 띄우는 옵션이라 화면이 없는 Colab에서는 안 되기 때문이다. `cv2.imshow`가 Colab에서 안 되는 것과 같은 이유다. `save=True`만 쓰면 Colab에서도 결과 영상이 남는다. `argparse`로 파일 이름을 코드에 박지 않고 인자로 받고, `if __name__ == '__main__':`으로 다른 데서 import해도 실행되지 않게 막는 게 노트북 실험을 명령행 프로그램으로 옮길 때의 최소 형식이다. 위치 인자라 파일 이름을 안 붙이면 에러가 난다. 테스트 영상은 속도감 있는 스키와 객체가 여럿인 공항이었는데, 빠른 움직임과 가림이 추적이 깨지는 대표적인 두 상황이다. 물체가 오래 가려졌다가 다시 나타나면 새 ID를 받아서, 세면 실제보다 많이 나오기도 한다.

## carplate2 - 사진용 파이프라인을 동영상에 붙이기
어제 만든 "사진 한 장에서 번호판 찾기"를 영상에 붙이는 실습이었다. 차이는 딱 한 글자, "장"이다. 어제는 사진 한 장이라 0.17초가 걸려도 문제가 없었는데, 영상은 초당 30장이 들어와서 한 장에 0.17초면 초당 6장밖에 처리를 못 한다. 영상 처리는 정확도 문제가 아니라 프레임 한 장에 1/30초 = 33밀리초라는 시간 예산 문제다. `delay = int(1000 / fps)`로 `waitKey`에 주는 값이 그 예산이고, 처리가 그보다 오래 걸리면 화면이 뚝뚝 끊긴다.

### 어디가 느린지부터 재기

```
frame    0  검출 3개  인식 ['ME51VSU']                       정답 ['GX15OGJ', 'MW51VSU', 'NA13NRU']
frame   90  검출 1개  인식 ['GX15OGJ']                       정답 ['GX15OGJ']
frame  270  검출 2개  인식 ['EY61NBG', 'WR02FKD']            정답 ['EY61NBG', 'WR02FKD']
frame  448  검출 3개  인식 ['BG65USJ', 'NA54KGJ', 'VK64DMV'] 정답 ['BG65USJ', 'NA54KGJ', 'NK64DMV']
정답률 5/9   (프레임당 0.17초)
```

안 재고 최적화하면 엉뚱한 데를 고친다. 정지 프레임 4장으로 재보니 프레임당 0.17초라 450프레임이면 76초인데, 원본 영상은 15초짜리였다. 그 시간의 대부분은 윤곽선 찾기가 아니라 tesseract 호출이었다. tesseract는 바깥의 별개 프로그램이라 부를 때마다 임시 파일을 넘기고 프로세스를 띄우고 결과를 받아오는 왕복이 통째로 비용이다. 심부름꾼은 적게 부르는 것 말고는 줄일 방법이 없다.

### 검출은 어제 것 그대로

| 단계 | 프레임 0 결과 |
|---|---|
| `findContours` | 714개 |
| 1차 필터 (크기, 비율) | 111개 |
| 배치 필터 (`find_chars`) | 4그룹 |
| 회전 보정 + 잘라내기 | 4장 |
| 겹침 정리 | 3장 |
| 다듬기 (`refine_plate`) | 1장 |
| OCR (`--psm 7`) + 형식 교정 | ME51VSU |

검출 파이프라인은 어제와 같고, 이 영상은 1280×720 안에 차가 여러 대라 번호판이 아주 작아서 `MIN_AREA`를 40으로 크게 낮췄다. 어제 기준값으로는 글자 후보가 아예 안 잡혀서 다음 단계가 통째로 놀았다. 알고리즘이 어려운 게 아니라 영상이 바뀔 때마다 값을 다시 맞춰야 하는 게 고전 영상처리의 진짜 비용이다.

어제 노트를 정리하면서 걸렸던 세 군데도 고쳐서 다시 짰다. `np.take`가 재귀에서 엉뚱한 걸 꺼내던 문제는, `idx`가 원래 `possible_contours` 기준 번호이니 항상 원래 목록에서 꺼내도록 바꿨다. 반 전체 출석번호로 조퇴하고 남은 명단에서 사람을 찾으면 엉뚱한 애가 나오니까 원래 반 명부를 봐야 한다. 이때 `detect_plates` 안에서 `global possible_contours`를 빼면 `possible_contours = []`가 지역 변수가 돼서 `find_chars`가 이전 프레임의 전역 값을 보게 되는데, 에러가 안 나고 조용히 틀려서 더 위험하다. `PLATE_HEIGHT_PADDING`을 정의만 하고 안 쓰던 것도 제 값을 쓰게 했고, 가장 긴 것 대신 마지막 것이 뽑히던 문제는 아예 투표 방식으로 바꿨다.

### 추적 - 이 박스는 아까 그 번호판

```python
def match_tracks(tracks, plate_infos):
    for tr in tracks:
        # 추적 중인 박스 중심과 이번 프레임 박스들의 중심 거리 비교
        limit = max(tr['box']['w'], info['w']) * 0.6     # 박스 폭의 60% 안이면 같은 것
        ...
        if 짝을 찾으면:
            tr['box'] = plate_infos[best]; tr['miss'] = 0; tr['cur'] = best
        else:
            tr['miss'] += 1; tr['cur'] = -1
```

이번 프레임에서 찾은 박스들과 지난 프레임까지 쫓아온 추적들을 중심점 거리로 짝지었다. 기준이 고정 픽셀이 아니라 박스 폭에 비례하는 게 요령인데, 멀리 있는 작은 번호판은 조금만 움직여도 다른 차이고 가까이 있는 큰 번호판은 많이 움직여도 같은 차다. `miss`는 몇 프레임째 안 보이는지이고 `TRACK_MAX_MISS = 8`을 넘으면 버린다. 다른 차가 앞을 지나가거나 이진화가 한 프레임 실패하는 등 잠깐 가려지는 일이 흔해서 바로 안 버린다. 추적 알고리즘의 가장 단순한 형태이고, 정식으로는 칼만 필터로 다음 위치를 예측하고 헝가리안 알고리즘으로 짝짓기를 최적으로 푼다고 한다. 오전의 `model.track()` 한 줄이 안에서 하는 일을 직접 짜본 셈이다.

### 투표와 OCR 아끼기

```python
tr['votes'][text] = tr['votes'].get(text, 0) + 1
tr['text'] = max(tr['votes'], key=tr['votes'].get)
if tr['votes'][tr['text']] >= CONFIRM_VOTES:     # 3표
    tr['confirmed'] = True

# OCR을 부르기 전에 다섯 번 되묻는다
if tr['cur'] < 0:                              continue   # 이번 프레임엔 안 보임
if tr['confirmed']:                            continue   # 이미 3표로 확정
if tr['ocr_count'] >= MAX_OCR_PER_TRACK:       continue   # 한 판당 상한 (12회)
if tr['box']['w'] < MIN_OCR_WIDTH:             continue   # 너무 작아 어차피 못 읽음
if frame_cnt - tr['last_ocr'] < OCR_INTERVAL:  continue   # 4프레임에 1번만
```

흔들리는 글씨를 한 번 보고 맞히는 대신 여러 번 보고 3표를 먼저 받은 답으로 확정한다. 어쩌다 튀는 오독이 걸러지고, 확정된 순간 그 번호판은 더 이상 OCR을 안 부른다. 정확도 장치인 동시에 속도 장치다. 그리고 OCR을 부르기 전에 다섯 가지를 되묻는다. 이 조건들은 전부 번호판 하나에 붙은 기억(`confirmed`, `ocr_count`, `last_ocr`)이라, 추적이 없으면 기억을 적어둘 대상 자체가 없어서 다섯 조건이 통째로 무너진다.

```
[frame   41] 번호판 인식 : GX15OGJ
[frame  133] 번호판 인식 : LW13VCV
[frame  236] 번호판 인식 : WR02FKO
[frame  258] 번호판 인식 : EY61NBG
[frame  281] 번호판 인식 : FJ14ZHY
[frame  396] 번호판 인식 : NA54KGJ
[frame  413] 번호판 인식 : BG65USJ
450프레임 / 21.5초  (20.9 fps)
OCR 호출 131회
인식한 번호판 7개
```

초당 6장에서 20.9장이 됐다. 계산이 빨라진 게 아니라 안 한 것이다. 추적이 없었다면 450프레임 × 검출 3~4개로 1,500회쯤 불렀을 OCR을 131회로 줄였다. 영상 처리 최적화는 빨리 하기가 아니라 안 하기였다.

### 형식 통과는 정답이 아니다
`MESIVSU`가 형식 교정을 거쳐 `ME51VSU`로 정규식을 통과하고 3표로 확정됐는데, 정답은 `MW51VSU`였다. 두 번째 글자 W를 E로 잘못 읽었는데 둘 다 글자 자리라 교정이 아예 안 건드린다. 교정은 숫자 자리에 글자가 왔는지만 봐서 글자끼리의 오독은 손댈 수단이 없다. 투표도 산발적으로 튀는 값은 거르지만, 같은 번호판을 같은 각도와 조명에서 계속 같은 방식으로 잘못 읽으면 그 오답에 표가 쌓인다. `WR02FKO`(정답 WR02FKD)도 3표를 받고 확정됐다. 교정과 투표는 안정성을 올리지만 정확성은 못 올린다.

그 밖에 만나본 것들이다.

- 수업 코드는 레거시 엔진 `--oem 0`을 썼는데, 맥에서 brew로 깐 tesseract에는 레거시 엔진이 없어서 `--oem 1`(LSTM)로 바꿔야 돌아갔다.
- 잘라낸 번호판에는 EU 파란 띠, 테두리, 나사 자국이 같이 들어 있어서 그대로 `--psm 7`로 넘기면 그것까지 글자로 센다. `refine_plate`에서 높이 기준과 중앙값으로 같은 줄만 남기는 처리가 그걸 쳐낸다.
- 여백은 흰색(`value=255`)으로 줬다. 글자가 검정이라 검은 여백을 주면 tesseract가 여백까지 글자 덩어리로 본다.
- 실습 노트북에서 `cv2.threshold(img, thresh=0.0, maxval=255.0, cv2.THRESH_BINARY | cv2.THRESH_OTSU)`처럼 키워드 인자 뒤에 위치 인자를 쓴 셀은 `SyntaxError`라 저장된 상태로는 실행되지 않는다. `.py` 쪽은 전부 위치 인자라 정상이다.

## 헷갈리기 쉬운 부분
- 분류는 "무엇", 탐지는 "무엇이, 어디에, 몇 개"다.
- YOLO 가중치 이름만 `-seg`, `-pose`로 바꾸면 같은 코드로 다른 작업을 한다.
- `results`는 항상 리스트라 `results[0]`으로 꺼낸다. `boxes`, `masks`, `keypoints` 중 무엇이 채워지느냐가 그 모델이 하는 일이다.
- 좌표 속성 끝의 `n`은 0~1 정규화 좌표다. 텐서는 `.cpu().numpy()`로 바꾼다.
- 세그 마스크의 크기는 원본이 아니라 모델 입력 크기다.
- 포즈 키포인트는 가려져도 좌표를 뱉으니 신뢰도로 거른다.
- `save=True` 결과 폴더는 실행할 때마다 늘어난다.
- 전이학습 준비물은 라벨링된 이미지와 yaml(경로, `nc`, `names`)이다. 폴더 이름은 `images`/`labels`, `names` 순서는 클래스 번호다.
- `Transferred 451/499`에서 못 옮겨진 게 검출 헤드다.
- `model.train()`은 그 자리에서 모델을 바꾼다. 학습 후 80클래스는 못 찾는다.
- mAP50은 대충 겹치면 맞게, mAP50-95는 박스가 딱 맞는지까지 본다.
- 추적은 `predict`를 `track`으로 바꾸면 된다. `show=True`는 창이 필요해서 Colab에서는 안 된다.
- 영상 처리는 시간 예산 문제다. 느린 곳을 먼저 재고, OCR처럼 비싼 호출은 추적과 투표로 안 부를 핑계를 만든다.
- 형식 교정과 투표는 반복되는 같은 오독을 못 막는다.

## 오늘 배운 내용 정리
오늘은 YOLO11로 탐지, 세그멘테이션, 포즈를 하고, 전이학습으로 가위바위보를 찾게 만들고, 추적을 배운 다음 동영상 번호판 인식에 추적을 손으로 붙였다.

```
YOLO11: model = YOLO('yolo11n.pt' / '-seg' / '-pose') → results = model(source, save=True) → List[Results].
        boxes(cls, conf, xyxy, xywh, ...n) / masks.data (N, H, W) / keypoints.data (N, 17, 3).
전이학습: yaml(train/val/test 이미지 경로, nc, names) → YOLO('yolo11n.pt').train(data, epochs, patience, imgsz).
         Transferred 451/499. mAP50 0.554 → 0.953. names 80개 → 3개. best.pt / last.pt.
추적: model.track(source, save=True, show=True). 탐지 + ID 짝짓기. 로컬 .py + argparse.
carplate2: 어제 검출 파이프라인 + match_tracks(중심 거리, 박스 폭 비례) + 3표 투표 + OCR 절약 조건 5개.
           6 fps → 20.9 fps, OCR 1,500회 → 131회. 형식 통과 ≠ 정답.
```

어제 모델마다 전처리 값과 출력 모양을 찾아가며 코드를 새로 썼던 걸 Ultralytics가 `YOLO(...)` 한 줄과 `Results` 객체 하나로 묶어버린 게 인상적이었다. 그리고 오전에 `track()` 한 줄로 끝났던 일을 오후에 번호판 영상에서 직접 짜보니, 라이브러리가 안에서 무슨 일을 하는지 알게 됐다. 가장 기억에 남은 건 OCR 호출을 1,500회에서 131회로 줄여서 3배 넘게 빨라진 부분이다. 코드를 빠르게 고친 게 아니라 "이건 아까 읽었잖아"라며 안 부른 것뿐이었다.

---
