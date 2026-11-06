---
layout: single
title: "AWS 배포 정리 2 - RDS, S3, IAM 역할과 Gunicorn, systemd, Nginx로 백엔드 배포"
categories: [coding, AWS]
tag: [study-log, AWS, RDS, S3, IAM, boto3, Gunicorn, systemd, Nginx]
toc: true
author_profile: false
sidebar:
    nav: "docs"
search: true
---
<hr/>

오늘은 백엔드 배포를 배웠다. 어제는 EC2 한 대에 "Hello"만 띄웠는데, 실습 프로젝트인 UpDown(파일을 올리고 내려받는 앱)은 그것만으로 돌아가지 않는다. 데이터베이스와 파일 저장소가 필요하고, SSH를 끊어도 계속 돌아야 하고, 도메인으로 접속할 수 있어야 한다.

그래서 오늘은 크게 두 가지를 했다. AWS 리소스(RDS, S3, IAM)를 만들어서 앱에 연결하는 것, 그리고 앱을 systemd, Gunicorn, Nginx 세 겹으로 감싸서 꺼지지 않는 서버로 만드는 것이다.

## 로컬에서 쓰던 것을 AWS로 옮기기

| 필요한 것 | 로컬에서 | AWS에서 |
|---|---|---|
| 데이터베이스 | 내 PC의 MySQL | RDS |
| 업로드된 파일 | `upload/` 폴더 | S3 |
| 권한 | 필요 없음 | IAM |
| 주소 | `127.0.0.1` | 탄력적 IP + 도메인 |

DB와 파일을 EC2 디스크에 그냥 두면 안 되나 싶었는데, EC2는 언제든 지우고 다시 만들 수 있는 것으로 취급한다. 디스크에 데이터를 쌓아두면 인스턴스를 지우거나 서버를 두 대로 늘리는 순간 데이터가 사라지거나 서버마다 갈린다. 그래서 데이터는 밖(RDS, S3)으로 빼고 EC2에는 코드만 둔다.

## 만드는 순서는 의존 관계로 정해진다
콘솔에서 길을 잃지 않으려면 순서를 먼저 잡아야 한다. 뒤 단계가 앞 단계의 이름이나 주소를 물어보기 때문에 앞부터 만든다.

```
1. 보안 그룹          ← RDS와 EC2가 "어느 보안 그룹?"을 물어본다
2. RDS               ← 만드는 데 5~10분 걸리니 일찍 눌러둔다
3. S3 버킷 + IAM 역할  ← EC2가 "어느 역할을 붙일까?"를 물어본다
4. EC2               ← 위 셋을 전부 참조한다
5. 탄력적 IP          ← EC2가 있어야 붙일 수 있다
6. 도메인 A 레코드     ← 탄력적 IP가 있어야 가리킬 수 있다
```

RDS는 만들어지는 데 시간이 걸리니까 먼저 생성 버튼을 눌러두고, 기다리는 동안 S3와 IAM을 만드는 게 효율적이다.

## ARN - 리소스의 주민등록번호
IAM 정책에서 "어느 리소스에 권한을 줄지" 적을 때는 이름이 아니라 ARN을 쓴다. AWS 안의 리소스를 하나로 콕 집어 가리키는 주소다.

```
arn:partition:service:region:account-id:resource-type/resource-id

arn:aws:s3:::myapp-dev-uploads-xxxx                       ← S3는 리전과 계정을 비운다
arn:aws:ec2:ap-northeast-2:123456789012:instance/i-0abc   ← EC2
arn:aws:iam::123456789012:role/myapp-ec2-role             ← IAM은 리전이 없다
```

S3 ARN을 보면 콜론이 세 개 연속으로 붙어 있어서 뭘 빠뜨린 것처럼 보이는데 정상이다. 버킷 이름이 전 세계에서 하나뿐이라 리전과 계정을 안 적어도 특정된다. 반대로 EC2 인스턴스 ID는 계정 안에서만 유일하니까 리전과 계정을 다 적는다.

## RDS - 관리형 MySQL
RDS는 MySQL을 대신 설치하고 관리해주는 서비스다. 백업, 패치, 재시작, 복구를 AWS가 맡는다. EC2에 MySQL을 직접 깔면 그걸 전부 내가 해야 한다.

```
RDS 콘솔 → Databases → Create database
  Standard create / MySQL 8.0 / Templates: Dev/Test
  DB instance identifier : myapp-dev-db
  Master username        : admin
  Master password        : (직접 정하고 따로 적어둔다)
  Instance               : db.t3.micro
  Connectivity
    Public access        : No             ★
    VPC security group   : sec-group-rds만 (default는 체크 해제)
  Additional configuration
    Initial database name: mydb           ★ 비우면 DB가 안 만들어진다
```

꼭 확인할 건 세 가지다.

| 항목 | 값 | 이유 |
|---|---|---|
| Public access | No | 인터넷에서 DB에 직접 접근하지 못하게 |
| 보안 그룹 | `sec-group-rds`만 | 기본 `default`를 같이 두면 의도와 다르게 열릴 수 있다 |
| Initial database name | `mydb` | 비워두면 데이터베이스가 안 생긴다 |

마지막이 함정이다. RDS "인스턴스"가 만들어지는 것과 그 안에 "데이터베이스(스키마)"가 만들어지는 건 다른 일이다. 이름을 비워두면 인스턴스는 생기지만 `mydb`가 없어서 앱이 연결에 실패한다.

템플릿을 Production으로 고르면 다른 AZ에 대기 복제본을 하나 더 두는 다중 AZ 배포가 기본으로 켜져서 요금이 크게 늘어난다. 실습에서는 Dev/Test로 단일 AZ를 쓴다.

다 만들어지면 **엔드포인트**를 복사해둔다. `.env`의 `DB_HOST`에 들어갈 값이다.

```
myapp-dev-db.xxxxxxxxxxxx.ap-northeast-2.rds.amazonaws.com
```

IP가 아니라 도메인이라는 점이 중요하다. AWS가 내부에서 서버를 바꿔도 이 주소는 그대로 유지된다. 테이블은 따로 만들지 않았다. 백엔드가 처음 켜질 때 SQLAlchemy의 `Base.metadata.create_all()`이 만들어준다.

그리고 RDS는 실습 후 정리를 안 하면 요금이 나오는 1순위다. EC2는 중지하면 컴퓨팅 요금이 멈추지만, RDS는 중지해도 7일이 지나면 자동으로 다시 켜지고 스토리지 요금도 계속 나간다. 실습이 끝나면 RDS부터 지우는 게 맞다.

## S3 - 업로드 파일 저장소
S3는 인터넷에 있는 무한 용량의 폴더 같은 것이다. 파일을 던져 넣고 꺼내 쓴다.

```
S3 콘솔 → Create bucket
  Bucket name         : myapp-dev-uploads-xxxx   ★ 전 세계에서 유일해야 한다
  Region              : ap-northeast-2
  Block Public Access : 전체 차단 유지           ★ 그대로 둔다
```

| 용어 | 뜻 |
|---|---|
| 버킷(Bucket) | 최상위 바구니. 이름이 전 세계에서 유일해야 한다 |
| 객체(Object) | 버킷에 담긴 파일 하나 |
| 키(Key) | 버킷 안에서의 파일 이름(경로 포함) |

퍼블릭 액세스 차단을 그대로 두는 게 이 부분의 핵심이다. 버킷을 공개하지 않고도 파일을 내려줄 방법이 있는데, 그게 **presigned URL(미리 서명된 URL)**이다.

```python
# backend/storage.py
def get_presigned_url(unique_filename, expires_in=300, download_name=None):
    ...
    return _s3_client.generate_presigned_url("get_object", Params=params, ExpiresIn=expires_in)
```

"이 파일을 5분(300초) 동안만 받을 수 있는 임시 링크"를 그때그때 만들어주는 것이다. URL 안에 서명과 만료 시각이 들어 있어서, 링크를 남에게 넘겨도 5분이 지나면 못 쓰고 URL을 고치면 서명이 안 맞아서 거부된다. 버킷은 계속 비공개인데 우리 서버가 발급한 링크만 잠깐 통하는 구조다. 버킷을 공개해버리면 주소를 아는 누구나 영원히 받을 수 있다.

## IAM - 정책, 역할, 사용자
오늘 가장 헷갈린 부분이다. 이름이 셋이나 나온다.

| 이름 | 뜻 | 비유 |
|---|---|---|
| 정책(Policy) | "무엇을 할 수 있다"를 적은 문서 | 권한 목록 |
| 역할(Role) | 정책을 담아서 AWS 서비스에 붙이는 신분 | 직책 |
| 사용자(User) | 정책을 담아서 사람이 쓰는 신분. 액세스 키를 발급받는다 | 사원증 |

### 정책 만들기
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject"],
      "Resource": "arn:aws:s3:::myapp-dev-uploads-xxxx/*"
    }
  ]
}
```

읽는 법은 문장 하나다. "이 버킷 안의 모든 객체에 대해 올리기와 가져오기를 허용한다." 이름은 `myapp-dev-s3-policy`로 저장했다.

| 키 | 뜻 |
|---|---|
| `Effect` | `Allow` 또는 `Deny` |
| `Action` | 무슨 작업을 (`s3:PutObject`는 업로드, `s3:GetObject`는 다운로드) |
| `Resource` | 어느 리소스에 (ARN으로) |

`Resource` 끝의 `/*`를 빠뜨리면 안 된다. `arn:aws:s3:::버킷명`은 버킷 자체이고, `arn:aws:s3:::버킷명/*`은 버킷 안의 객체들이다. 파일을 올리고 내리는 건 객체 권한이라 `/*`가 있어야 한다. `AccessDenied`가 나면 여기부터 본다.

함정이 하나 더 있다. 코드의 `file_exists()`가 `head_object()`를 호출해서 정책에 `s3:HeadObject`를 넣고 싶어지는데, **그런 액션은 없다.** 넣으면 존재하지 않는 액션이라고 에러가 난다. `HeadObject` 요청은 `s3:GetObject` 권한으로 이미 허용된다.

### 역할 만들고 EC2에 붙이기
```
IAM → Roles → Create role
  Trusted entity : AWS service → EC2
  권한            : myapp-dev-s3-policy 체크
  Role name      : myapp-ec2-role
```

이 역할을 EC2를 만들 때 Advanced details의 IAM instance profile에 붙인다. 어제 "펼쳐야 보인다"고 했던 그 항목이다.

### 액세스 키를 서버에 두지 않는다
오늘 배운 것 중 가장 중요한 개념이다. `storage.py`를 보면 키가 어디에도 없다.

```python
_s3_client = boto3.client("s3", region_name=AWS_REGION)   # 키를 안 넘긴다
```

boto3는 자격증명을 직접 넘기지 않으면 정해진 순서대로 찾아본다(credential provider chain). 대략 이렇다.

```
1. 환경변수 AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY
2. ~/.aws/credentials  (aws configure 로 설정한 것)
3. EC2에 붙은 IAM 역할  ← 인스턴스 메타데이터에서 임시 자격증명을 받아온다
```

EC2에 역할을 붙여두면 서버가 자기 신분을 스스로 증명할 수 있다. 열쇠를 서버에 둘 필요가 없으니 유출될 일도 없고, 임시 자격증명이라 자동으로 만료되고 갱신된다.

| 방식 | 위험 |
|---|---|
| `.env`에 액세스 키를 적기 | 실수로 git에 올라가면 그대로 유출된다. 키 교체도 번거롭다 |
| IAM 역할 | 키가 파일로 존재하지 않는다. AWS 권장 방식 |

반대로 EC2 밖(로컬)에서 S3 모드를 테스트하면 3번이 없어서 `put_object`를 부르는 순간 `NoCredentialsError`가 난다. 그때는 `aws configure`나 환경변수가 필요하다. 평소 로컬 개발은 `STORAGE_BACKEND=local`이라 `boto3.client()` 자체가 안 만들어져서 자격증명이 필요 없다.

### IAM 정책과 S3 버킷 정책은 다르다
이름이 비슷해서 헷갈리는데 권한을 어디에 붙이느냐가 다르다.

| 구분 | IAM 정책 | 버킷 정책 |
|---|---|---|
| 붙는 곳 | 주체(사용자, 역할, 그룹) | 자원(S3 버킷) |
| 답하는 질문 | "이 역할은 무엇을 할 수 있나" | "이 버킷에 누가 접근할 수 있나" |
| `Principal`(누가) | 없다 (이미 특정 주체에 붙어 있다) | 반드시 있다 |

같은 계정 안에서는 둘 중 한쪽만 Allow해도 통과하고, 어느 한쪽에 명시적인 `Deny`가 있으면 그게 이긴다. 계정이 다르면 양쪽 다 Allow가 필요하다.

이 프로젝트에 대입하면 이렇게 갈린다.

| 버킷 | 방식 | 이유 |
|---|---|---|
| 업로드용 | IAM 정책만 | 같은 계정의 EC2만 쓰면 되고 완전 비공개가 목적 |
| 프런트엔드용 | 버킷 정책 필요 | CloudFront는 IAM 역할이 아니라 AWS 서비스라서 버킷 쪽에서 열어줘야 한다 |

프런트엔드용 버킷은 내일 CloudFront를 붙이면서 다룬다.

## .env 한 장으로 로컬과 운영을 나눈다
EC2에 코드를 가져와서 가상환경을 만든다.

```bash
git clone <저장소 주소> UpDown
cd UpDown/backend

uv venv --python 3.12.5 .venv
source .venv/bin/activate
uv pip install -r requirements.txt
uv pip install gunicorn        # requirements.txt에 없어서 따로 설치
```

그리고 `.env`를 만든다. 사실상 여기가 배포의 핵심이다.

```bash
cp .env.example .env
nano .env
```

```
ENVIRONMENT=production

DB_HOST=myapp-dev-db.xxxxxxxxxxxx.ap-northeast-2.rds.amazonaws.com
DB_PORT=3306
DB_USER=admin
DB_PASSWORD=<RDS 만들 때 정한 비밀번호>
DB_NAME=mydb

ALLOWED_ORIGINS=https://example.com

STORAGE_BACKEND=s3
AWS_S3_BUCKET=myapp-dev-uploads-xxxx
AWS_REGION=ap-northeast-2
```

코드는 한 줄도 안 바꿨는데 로컬과 운영이 갈린다. 코드를 보면 이유가 보인다.

```python
# database.py - DB 주소가 .env로 갈린다
DATABASE_URL = f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
engine = create_engine(DATABASE_URL, echo=(ENVIRONMENT == "development"))
```

```python
# storage.py - 저장 위치가 .env로 갈린다
STORAGE_BACKEND = os.getenv("STORAGE_BACKEND", "local")   # local 또는 s3

if STORAGE_BACKEND == "s3":
    _s3_client = boto3.client("s3", region_name=AWS_REGION)
else:
    os.makedirs(UPLOAD_DIR, exist_ok=True)

def save_file(unique_filename, content):
    if STORAGE_BACKEND == "s3":
        _s3_client.put_object(Bucket=AWS_S3_BUCKET, Key=unique_filename, Body=content)
    else:
        with open(os.path.join(UPLOAD_DIR, unique_filename), "wb") as f:
            f.write(content)
```

`storage.py`가 "파일을 어디에 두는지"를 감춰주는 층이다. `controllers.py`는 `storage.save_file(...)`만 부르고 그게 디스크인지 S3인지 신경 쓰지 않는다. `if STORAGE_BACKEND == "s3"` 판단이 한 파일에만 모여 있어서, 나중에 저장소를 하나 더 늘려도 이 파일만 고치면 된다. 바뀔 것을 한 곳에 모으는 것, 이게 추상화다.

`echo=(ENVIRONMENT == "development")`도 의미가 있다. `echo=True`면 SQLAlchemy가 실행하는 SQL을 전부 로그로 찍는데, 개발할 때는 도움이 되지만 운영에서는 로그가 폭발하고 쿼리에 담긴 값(개인정보 포함)이 로그에 남는다. 그래서 운영에서는 끈다.

설정을 코드가 아니라 환경에 두는 이 방식은 The Twelve-Factor App이라는 지침의 "Config" 항목과 같은 이야기다. 똑같은 코드가 어디서나 돌고, 환경마다 `.env`만 다르다. 그래서 실제 비밀번호와 엔드포인트가 든 `.env`는 git에 올리지 않고, 형식만 담은 `.env.example`만 커밋한다.

`ALLOWED_ORIGINS`는 CORS 설정이다. 화면은 `https://example.com`, API는 `https://api.example.com`이라 출처가 다르고, 브라우저는 다른 출처로 가는 요청을 기본적으로 막는다. 서버가 응답 헤더에 "이 출처는 허용한다"고 적어줘야 브라우저가 통과시킨다. 출처는 프로토콜, 도메인, 포트가 전부 같아야 같은 출처이고 문자열이 정확히 일치해야 해서, `https://example.com/`처럼 끝에 슬래시를 붙이면 안 맞는다. 막는 건 브라우저라서 `curl`로는 잘 되는데 브라우저에서만 실패하면 거의 CORS다.

## 탄력적 IP와 도메인 연결
EC2에 탄력적 IP를 붙인 다음, 도메인 관리 화면에서 **A 레코드**를 만든다.

```
api.example.com    A    <탄력적 IP>
```

| 레코드 종류 | 하는 일 |
|---|---|
| A | 도메인 → IP 주소 |
| CNAME | 도메인 → 다른 도메인 |

DNS는 전화번호부다. 사람은 도메인을 외우고, 컴퓨터는 그걸 IP로 바꿔서 접속한다. 확인은 `nslookup`으로 한다.

```bash
nslookup api.example.com
```

탄력적 IP가 그대로 나오면 반영된 것이다. DNS 정보는 전 세계 서버에 캐시되고 레코드마다 TTL(캐시 유효시간)이 붙어 있어서, 값을 바꿔도 캐시가 만료될 때까지는 옛 값이 나온다. 바로 안 바뀐다고 당황하지 말고 기다리면 된다.

도메인을 어디서 관리하느냐에 따라 레코드를 추가하는 곳이 다르다. Route 53에 호스팅 영역이 있으면 Route 53 콘솔에서, 외부 업체에서 관리하면 그 업체 화면에서 같은 레코드를 추가한다. "Route 53에서 도메인을 산 것"과 "Route 53이 DNS를 관리하는 것"은 다른 이야기라는 점도 짚고 넘어갔다.

## 꺼지지 않는 서버 만들기
어제 `python main.py`로 띄운 방식에는 문제가 네 가지 있었다.

| 문제 | 무슨 일이 일어나나 |
|---|---|
| SSH를 끊으면 | 프로세스가 같이 죽는다. 노트북을 닫으면 서비스가 멈춘다 |
| 서버를 재부팅하면 | 아무도 앱을 다시 켜주지 않는다 |
| 앱이 에러로 죽으면 | 그대로 방치된다. 새벽에 죽으면 아침까지 다운 |
| 8000번 포트 | 웹은 80/443을 쓰는데 우리 앱은 8000이다 |

앞의 세 개는 systemd가, 마지막은 Nginx가 푼다. 그리고 그 사이에 Gunicorn이 들어간다.

| 층 | 담당 | 없으면 |
|---|---|---|
| Nginx (80/443) | 외부 접속 받기, HTTPS 처리, 요청 크기 제한 | 사용자가 `:8000`을 붙여야 하고 HTTPS를 앱이 직접 처리해야 한다 |
| Gunicorn (마스터) | 워커 여러 개 관리, 죽은 워커 교체 | 요청 하나가 막히면 전체가 멈춘다 |
| Uvicorn 워커 | 실제 요청 처리 | - |
| systemd | 위 전체를 서비스로 감독 | 세션이 끊기면 죽고, 재부팅하면 안 뜨고, 죽으면 방치된다 |

비유하면 Nginx는 건물 안내데스크, Gunicorn은 팀원에게 일을 나누고 아픈 팀원을 교체하는 팀장, Uvicorn 워커는 실제로 일하는 팀원, systemd는 팀이 통째로 사라지면 다시 꾸리는 인사팀이다.

## Gunicorn - 워커를 여러 개 관리하는 매니저
FastAPI는 원래 `uvicorn main:app`만으로도 돈다. 그런데 기본 uvicorn은 프로세스 하나로 동작해서, 그 프로세스가 막히거나 죽으면 서비스 전체가 멈춘다. Gunicorn은 프로세스 매니저라서 워커를 여러 개 띄우고, 죽은 워커를 자동으로 다시 만든다.

문제는 Gunicorn이 원래 WSGI(동기) 앱용이라 ASGI 앱인 FastAPI를 직접 못 돌린다는 것이다. 그래서 이 옵션이 붙는다.

```
-k uvicorn.workers.UvicornWorker
```

"프로세스 관리는 Gunicorn이 하고, 각 워커 안에서 요청을 처리하는 건 uvicorn 방식으로 하라"는 지정이다.

WSGI와 ASGI는 파이썬 웹 앱과 웹 서버가 대화하는 규격이다. 규격이 정해져 있어서 서버(Gunicorn)와 앱(FastAPI)을 따로 골라 조립할 수 있다. 콘센트 규격이 같으면 어느 회사 가전이든 꽂히는 것과 같다.

| 규격 | 방식 | 대표 프레임워크 |
|---|---|---|
| WSGI | 동기. 요청 하나를 끝내야 다음 요청 | Flask, Django(전통적인 방식) |
| ASGI | 비동기. 기다리는 동안 다른 요청 처리 | FastAPI, Starlette |

요즘은 uvicorn도 `--workers 2`처럼 워커를 여러 개 띄울 수 있어서 Gunicorn 없이 uvicorn만 쓰는 구성도 흔하다. 인터넷에서 그런 예제를 봐도 틀린 게 아니고, 수업은 오래 검증된 Gunicorn + Uvicorn 조합을 썼다.

## systemd - 앱을 서비스로 등록하기
### .service 파일 위치

```
/etc/systemd/system/myapp-backend.service
```

| 경로 | 용도 |
|---|---|
| `/usr/lib/systemd/system/` | 패키지가 설치한 유닛 (nginx, ssh 등) |
| `/etc/systemd/system/` | 관리자가 직접 만든 유닛. 우선순위가 더 높다 |
| `/run/systemd/system/` | 실행 중에 만들어지는 임시 유닛 |

`/etc/`는 내가 손으로 만든 설정을 두는 곳이라 패키지가 깐 것과 섞이지 않는다.

### 파일 내용

```ini
[Unit]
Description=FastAPI backend
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/UpDown/backend
Environment="PATH=/home/ubuntu/UpDown/backend/.venv/bin"
ExecStart=/home/ubuntu/UpDown/backend/.venv/bin/gunicorn main:app -k uvicorn.workers.UvicornWorker -b 127.0.0.1:8000 --workers 2
Restart=always

[Install]
WantedBy=multi-user.target
```

`[Unit]`은 이 서비스의 설명과 시작 순서다. `Description`은 `systemctl status`에 보일 설명이고, `After=network.target`은 네트워크 관련 서비스가 올라온 다음에 시작하라는 뜻이다. 우리 앱은 시작하면서 RDS에 연결하기 때문에 순서가 중요하다. (네트워크가 완전히 연결될 때까지 확실히 기다리게 하려면 `network-online.target`을 쓴다.)

`[Service]`는 실제로 어떻게 실행할지다.

| 줄 | 뜻 | 빠뜨리거나 틀리면 |
|---|---|---|
| `User=ubuntu` | 이 리눅스 사용자 권한으로 실행 | root로 돌면 뚫렸을 때 피해가 시스템 전체로 커진다 |
| `WorkingDirectory=` | 프로세스가 시작할 폴더 | `main.py`를 못 찾아서 `main:app`을 불러오지 못한다 |
| `Environment="PATH=..."` | venv의 `bin`을 PATH로 지정 | 앱이 실행 중에 부르는 명령이 venv 밖의 것을 찾게 된다 |
| `ExecStart=` | 실행할 명령 (절대경로) | - |
| `Restart=always` | 죽으면 자동 재시작 | 앱이 죽으면 그대로 멈춘다 |

여기서 알아둘 점은 systemd가 내 로그인 셸의 환경을 물려받지 않는다는 것이다. 내가 터미널에서 `source .venv/bin/activate`를 해뒀든 말든 systemd는 맨몸으로 명령을 실행한다. 그래서 `ExecStart`에 venv 안의 gunicorn을 절대경로로 적었다. 절대경로로 적었기 때문에 gunicorn 자체는 `Environment` 줄이 없어도 실행된다. systemd는 `ExecStart`의 프로그램을 찾을 때 이 PATH를 쓰지 않는다. `Environment` 줄은 앱이 실행 중에 다른 명령을 이름만으로 부를 때 venv 안의 것을 쓰게 하는 역할이다.

`WorkingDirectory`도 중요하다. gunicorn은 시작한 폴더에서 `main.py`를 찾아 `main:app`을 불러오기 때문에, 이 값이 틀리면 `No module named 'main'`으로 죽는다. 코드에서 상대 경로로 여는 파일도 전부 이 폴더 기준이 된다.

`ExecStart`를 뜯어 읽으면 이렇다.

| 조각 | 뜻 |
|---|---|
| `.venv/bin/gunicorn` | venv 안의 gunicorn을 절대경로로 |
| `main:app` | `main.py` 안의 `app` 객체 (`from main import app`과 같은 뜻) |
| `-k uvicorn.workers.UvicornWorker` | 워커를 uvicorn 방식으로 |
| `-b 127.0.0.1:8000` | localhost의 8000번에만 묶는다 |
| `--workers 2` | 워커 프로세스 2개 |

`-b 127.0.0.1:8000`이 이 설계의 핵심이다. 외부에서 8000번으로 직접 들어오는 게 아예 불가능해서, 모든 바깥 요청은 Nginx(80/443)를 거쳐야 한다.

워커 수는 `(CPU 코어 수 × 2) + 1`이라는 관례가 있다. `t3.micro`는 vCPU가 2개라 계산상 5인데 2개로 잡았다. 메모리가 1GB뿐이라서다. 워커 하나가 파이썬과 앱을 통째로 메모리에 올리기 때문에 많이 띄우면 메모리가 부족해서 죽는다. 코어 수로 계산한 값과 메모리가 감당하는 값 중 작은 쪽을 쓴다.

`[Install]`의 `WantedBy=multi-user.target`은 "리눅스가 부팅해서 일반 서버 상태(multi-user.target)에 도달할 때 나도 같이 시작하겠다"는 선언이다. `systemctl enable`을 하면 이 연결이 걸리고, 이게 재부팅해도 앱이 다시 뜨는 이유다.

### 등록하고 확인하기

```bash
sudo systemctl daemon-reload                  # 유닛 파일을 다시 읽어라
sudo systemctl enable --now myapp-backend     # 부팅 등록 + 지금 시작
sudo systemctl status myapp-backend           # active (running) 확인
```

| 명령 | 하는 일 |
|---|---|
| `daemon-reload` | systemd가 기억하는 유닛 목록을 갱신. 파일을 만들거나 고쳤으면 반드시 |
| `enable` | 부팅할 때 자동 시작 등록 |
| `--now` | `enable`과 `start`를 한 번에 |
| `status` | 상태 확인 (`q`로 나온다) |
| `restart` | 코드를 바꾼 뒤 다시 시작 |

`daemon-reload`를 빠뜨리는 게 가장 흔한 실수다. `.service` 파일을 고쳤는데 반영이 안 되면 이걸 안 한 것이다.

서비스가 떴으면 서버 안에서 API를 불러본다.

```bash
curl http://127.0.0.1:8000/api/files
# []
```

빈 배열 같은 정상 JSON이 나오면 DB 연결까지 성공한 것이고, 테이블이 자동으로 만들어졌다는 뜻이기도 하다. `failed`로 뜨면 로그를 본다.

```bash
sudo journalctl -u myapp-backend -n 50 --no-pager
```

`failed`의 주된 원인은 `.env` 오타, DB 연결 실패, 포트 충돌, gunicorn 미설치, 경로 오타였다.

## Nginx - 리버스 프록시
### 리버스 프록시가 뭔가

```
[브라우저] ──요청──▶ [Nginx] ──전달──▶ [Gunicorn/FastAPI]
[브라우저] ◀──응답── [Nginx] ◀──응답── [Gunicorn/FastAPI]
```

손님은 안내데스크(Nginx)와만 이야기하고 실제 담당자(Gunicorn)가 뒤에 있는 건 모른다. 클라이언트는 `api.example.com`에 직접 요청한다고 생각하지만, 실제로는 Nginx가 받아서 `127.0.0.1:8000`으로 넘긴다.

포워드 프록시와 헷갈리는데 방향이 반대다.

| 구분 | 포워드 프록시 | 리버스 프록시 |
|---|---|---|
| 누구를 대신하나 | 클라이언트 (사내망에서 밖으로 나갈 때) | 서버 |
| 클라이언트가 아는 것 | 실제 목적지 | 프록시만. 뒤에 뭐가 있는지 모른다 |
| 목적 | 접근 제어, 익명화 | 보안, 부하 분산, SSL 처리 |

Nginx를 앞에 세우는 이유는 네 가지다.

1. 포트 통합과 보안: 바깥에는 80/443만 열고 8000번은 `127.0.0.1`에만 묶어서 외부 접근을 원천 차단한다.
2. HTTPS를 한 곳에서 처리: 암호화와 복호화를 Nginx가 전담해서 앱은 HTTPS를 몰라도 된다. 인증서도 Nginx 한 곳에서만 관리하면 된다.
3. 여러 서비스 구분: `server_name`으로 도메인별로 나눠서 같은 EC2에 서비스를 더 붙일 수 있다.
4. 부가 기능: 요청 크기 제한, 정적 파일 캐싱, 로드 밸런싱, 로깅을 앱 코드 수정 없이 할 수 있다.

### 설정 파일

```nginx
# /etc/nginx/sites-available/myapp
server {
    listen 80;
    server_name api.example.com;

    client_max_body_size 5m;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

| 줄 | 뜻 |
|---|---|
| `server { }` | 가상 호스트 하나. 여러 개 둬서 도메인별로 나눈다 |
| `listen 80` | 80번(HTTP)으로 들어오는 요청을 받는다. 내일 certbot이 443 설정을 추가한다 |
| `server_name` | 요청한 도메인이 이 이름일 때 이 블록이 처리한다 |
| `client_max_body_size 5m` | 요청 본문 최대 크기 |
| `location / { }` | 모든 경로에 대한 처리 규칙 |
| `proxy_pass` | 실제로 넘길 주소 |
| `proxy_set_header` | 백엔드에 같이 넘길 헤더 |

`client_max_body_size`는 실전 함정이다. **Nginx의 기본 요청 본문 제한은 1MB다.** 앱의 업로드 제한(`MAX_FILE_SIZE`)은 2MB인데 Nginx 기본값이 더 작아서, 이 줄이 없으면 2MB 파일을 올릴 때 FastAPI까지 가보지도 못하고 Nginx에서 `413 Request Entity Too Large`로 막힌다. 앱까지 요청이 안 오니 앱 로그에는 아무것도 안 남아서 원인을 찾기도 어렵다. 업로드 형식(multipart)에 붙는 추가 데이터까지 생각해서 앱 제한보다 넉넉하게 5MB로 잡았다.

`proxy_set_header` 네 줄은 프록시를 거치면서 백엔드가 잃어버리는 원래 정보를 헤더로 다시 알려주는 것이다.

| 헤더 | 없으면 백엔드가 착각하는 것 |
|---|---|
| `Host $host` | Host를 `127.0.0.1`로 알아서 리다이렉트 주소나 로그가 엉뚱해진다 |
| `X-Real-IP $remote_addr` | 모든 요청이 `127.0.0.1`에서 온 것처럼 보여서 진짜 클라이언트 IP를 모른다 |
| `X-Forwarded-For` | 프록시를 여러 번 거칠 때 거쳐온 IP를 쉼표로 이어서 기록한다 |
| `X-Forwarded-Proto $scheme` | 모든 요청이 HTTP로 온 줄 알고 주소를 `http://`로 잘못 만든다 |

마지막 줄이 특히 중요하다. 내일 HTTPS를 붙여도 암호화는 Nginx에서 풀리고, Nginx → Gunicorn 구간은 항상 평문 HTTP다. 그래서 "원래는 HTTPS로 왔다"고 따로 알려줘야 한다.

### 활성화하기

```bash
sudo ln -s /etc/nginx/sites-available/myapp /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

우분투의 Nginx는 설정을 두 폴더로 나눠서 관리한다.

| 폴더 | 뜻 |
|---|---|
| `sites-available/` | 보관함. 여기 있다고 적용되지 않는다 |
| `sites-enabled/` | 켜진 목록. Nginx는 여기 있는 것만 읽는다 |

`available`은 서랍, `enabled`는 책상 위다. 복사(`cp`)가 아니라 링크(`ln -s`)를 쓰는 이유는 끄고 싶을 때 링크만 지우면 원본은 남고, 원본을 고치면 링크를 통해 바로 반영돼서 파일을 두 벌 관리할 필요가 없기 때문이다.

`default`를 지우는 이유도 있다. 우분투에 Nginx를 깔면 "Welcome to nginx!" 예제 사이트가 이미 켜져 있는데, 이 설정에 `default_server`가 붙어 있어서 `server_name`이 안 맞는 요청을 전부 가져간다. 그대로 두면 IP로 직접 들어왔을 때 엉뚱한 페이지가 나온다.

`nginx -t && systemctl reload nginx`는 통째로 외워두면 좋다. `nginx -t`는 문법 검사만 하고 아무것도 적용하지 않는다. 검사가 통과했을 때만(`&&`) 설정을 반영하는 것이다. 문법이 틀린 설정으로 그냥 재시작하면 Nginx 전체가 안 떠서 서비스가 완전히 멈춘다.

| 명령 | 하는 일 | 서비스 중단 |
|---|---|---|
| `reload` | 새 설정으로 워커를 띄우고, 기존 워커는 처리 중인 요청을 마친 뒤 종료 | 없다 |
| `restart` | 완전히 멈췄다가 다시 켠다 | 순간 끊긴다 |

## 전체 구조 - 이중 감독

```
[외부 요청] ─443→ [Nginx]  (HTTPS 처리, 크기 제한, 헤더 추가)
                    │
                    └─→ 127.0.0.1:8000  [Gunicorn 마스터]
                                            ├─ Uvicorn 워커 1
                                            └─ Uvicorn 워커 2
                                                  │
                                              [FastAPI] ─→ RDS / S3

           systemd가 Gunicorn 마스터를 감독
```

| 감독자 | 무엇을 감독 | 언제 나서나 |
|---|---|---|
| systemd | Gunicorn 마스터 | 프로세스가 아예 죽었을 때 전체를 다시 띄운다 (최후의 안전망) |
| Gunicorn 마스터 | Uvicorn 워커들 | 워커 하나가 문제일 때 그 워커만 빠르게 교체한다 |

## 코드를 고친 뒤 재배포하기

```bash
ssh -i "myapp-key.pem" ubuntu@<탄력적 IP>
cd ~/UpDown/backend
git pull origin main

# requirements.txt가 바뀐 경우만
source .venv/bin/activate && uv pip install -r requirements.txt

sudo systemctl restart myapp-backend
sudo systemctl status myapp-backend      # active (running) 확인
```

`restart`가 꼭 필요하다. Gunicorn 프로세스는 시작할 때 메모리로 읽어들인 파이썬 코드를 계속 들고 있어서, `git pull`로 디스크의 `.py` 파일이 바뀌어도 이미 돌고 있는 프로세스는 모른다. 개발할 때 파일만 저장하면 반영됐던 건 `reload=True`라는 개발용 옵션 덕분이었다. `.env`만 바꾼 경우도 마찬가지로, `python-dotenv`는 프로세스가 시작할 때 한 번만 읽으니까 재시작해야 한다.

`restart`는 아주 잠깐이지만 완전히 끊긴다. Gunicorn은 마스터에 `HUP` 신호를 보내면 워커를 새 코드로 하나씩 교체하는 그레이스풀 리로드를 지원해서 요청을 끊지 않고 반영할 수도 있다. 이 프로젝트 규모에서는 `restart`로 충분해서 개념만 알아뒀다.

## 에러 코드로 막힌 곳 찾기
Nginx를 앞에 두면 이 에러들을 자주 만난다.

| 에러 | 뜻 | 볼 곳 |
|---|---|---|
| 502 Bad Gateway | 뒤에 아무도 없다. Gunicorn이 죽었거나 포트가 안 맞는다 | `systemctl status myapp-backend` |
| 504 Gateway Timeout | 뒤에 있는데 응답이 너무 늦다 | 앱 로그, DB 쿼리 속도 |
| 413 Too Large | Nginx가 크기로 막았다 | `client_max_body_size` |
| 404 | Nginx는 통과했고 앱이 그런 경로가 없다고 한다 | FastAPI 라우터 경로 |

층이 세 겹이라 로그도 세 곳이다.

```bash
sudo journalctl -u myapp-backend -f      # ① 우리 앱 (Gunicorn/FastAPI)
sudo tail -f /var/log/nginx/error.log    # ② Nginx 에러
sudo tail -f /var/log/nginx/access.log   # ③ 들어온 요청 기록
```

`-f`는 계속 따라 보기다. 요청이 access.log에는 찍혔는데 앱 로그에 없으면 Nginx 단계에서 막힌 것이고, 앱 로그까지 왔으면 앱 문제다.

참고로 `User=ubuntu`로 앱을 root가 아닌 사용자로 돌리는 건 최소 권한 원칙이다. Nginx도 같은 원칙을 따르는데, 80/443처럼 1024보다 작은 포트는 root만 열 수 있어서 마스터는 root로 시작하고 실제 요청을 처리하는 워커는 권한을 낮춰(`www-data`) 돌린다.

## 헷갈리기 쉬운 부분
- RDS의 Initial database name을 비우면 DB가 안 생긴다. 인스턴스는 만들어지는데 `mydb`가 없어서 앱이 연결에 실패한다.
- RDS 보안 그룹에서 `default`를 해제하고 `sec-group-rds`만 남긴다. Public access는 실습이라도 No로 둔다.
- 정책의 `Resource`에 `/*`를 빠뜨리면 `AccessDenied`가 난다. 버킷 자체와 버킷 안 객체는 다른 대상이다.
- `s3:HeadObject`라는 액션은 없다. `s3:GetObject`로 허용된다.
- IAM 역할을 EC2에 안 붙이면 `NoCredentialsError`가 난다.
- `ALLOWED_ORIGINS`는 끝에 슬래시 없이 프런트엔드 주소와 정확히 같게 적는다.
- `gunicorn`은 `requirements.txt`에 없어서 따로 설치해야 한다. 빠뜨리면 서비스가 시작하지 못한다.
- `.service`를 고쳤는데 반영이 안 되면 `daemon-reload`를 빠뜨린 것이다.
- `sites-available`에 파일만 만들면 아무 일도 안 일어난다. `sites-enabled`에 링크를 걸어야 한다.
- 업로드가 413으로 막히면 `client_max_body_size`를 본다. 앱 로그에는 아무것도 안 남는다.
- `git pull`만 하고 `restart`를 안 하면 옛 코드가 계속 돈다. `.env`만 바꿔도 재시작이 필요하다.
- 8000번을 보안 그룹에 열면 Nginx를 거치지 않는 길이 생겨서 HTTPS와 크기 제한이 우회된다.
- DNS를 바꿔도 바로 반영되지 않는다. TTL만큼 옛 값이 남는다.

## 오늘 배운 내용 정리
오늘은 AWS 리소스를 만들어 앱에 연결하고, 앱을 꺼지지 않는 서버로 띄웠다.

```
순서: 보안 그룹 → RDS·S3 → IAM 역할 → EC2 → 탄력적 IP → DNS. 뒤가 앞의 이름을 물어본다.
RDS: Public access No, 보안 그룹 sec-group-rds만, Initial database name 필수.
S3: 퍼블릭 차단 유지. 파일은 presigned URL(만료 시간이 있는 임시 링크)로만 내려준다.
IAM: 정책(권한 목록) → 역할(서비스에 붙이는 신분) → EC2에 부착. Resource 끝에 /*.
boto3: 키를 안 넘기면 환경변수 → ~/.aws/credentials → IAM 역할 순으로 찾는다.
.env: 코드는 그대로 두고 DB_HOST, STORAGE_BACKEND 만 바꿔 로컬과 운영을 나눈다.
DNS: A 레코드는 도메인 → IP. 확인은 nslookup.
systemd: 안 죽게. User, WorkingDirectory, ExecStart(절대경로), Restart=always, daemon-reload.
Gunicorn: 여러 요청을. -k uvicorn.workers.UvicornWorker -b 127.0.0.1:8000 --workers 2.
Nginx: 안전한 포트로. proxy_pass + proxy_set_header, client_max_body_size, nginx -t && reload.
재배포: git pull → systemctl restart. 돌고 있는 프로세스는 새 코드를 모른다.
```

코드는 한 줄도 안 바꾸고 `.env`만 바꿔서 로컬과 운영이 갈리는 구조가 가장 인상 깊었다. systemd, Gunicorn, Nginx가 각각 "안 죽게, 여러 요청을, 안전한 포트로"를 맡는다고 정리하고 나니 세 겹을 쌓는 이유가 이해됐다. 내일은 Nginx에 HTTPS를 붙이고 프런트엔드를 S3와 CloudFront로 배포한다.

---
