---
layout: single
title: "AWS 배포 정리 3 - Let's Encrypt로 HTTPS 붙이고 S3, CloudFront로 프런트엔드 배포"
categories: [coding, AWS]
tag: [study-log, AWS, HTTPS, TLS, certbot, S3, CloudFront, ACM, Vite]
toc: true
author_profile: false
sidebar:
    nav: "docs"
search: true
---
<hr/>

오늘은 배포 마지막 날이다. 오전에는 어제 HTTP로 띄운 백엔드에 HTTPS를 붙였고, 오후에는 React 프런트엔드를 S3와 CloudFront로 배포했다. 첫날 그렸던 전체 그림이 오늘로 완성됐다.

## HTTP로 끝내면 안 되는 이유
어제까지 만든 백엔드는 `http://api.example.com`으로 동작한다. 이걸로 끝내면 안 되는 이유가 세 가지다.

첫째, 내용이 평문으로 오간다. 엽서를 보내는 것과 같아서 배달 경로에 있는 누구나 읽을 수 있다. 카페 와이파이에서 누가 패킷을 가로채면 아이디, 비밀번호가 그대로 보인다.

둘째, 브라우저가 주소창에 "안전하지 않음" 경고를 띄운다.

셋째가 우리 프로젝트에서 실제로 막히는 지점이다. 오후에 프런트엔드를 CloudFront에 올리면 화면 주소는 `https://`가 된다. **HTTPS 페이지에서 HTTP API를 호출하면 브라우저가 그 요청을 차단한다(Mixed Content).** 안전한 페이지 안에 안전하지 않은 통신을 섞지 말라는 규칙이라, 프런트엔드가 HTTPS면 백엔드도 반드시 HTTPS여야 한다. 선택이 아니라 프런트엔드 배포의 선행 조건이다.

## SSL, TLS, 인증서
세 단어가 섞여 나와서 헷갈렸는데 정리하면 이렇다.

| 이름 | 정체 | 지금 상태 |
|---|---|---|
| SSL (Secure Sockets Layer) | 1990년대에 만든 암호화 프로토콜 | 폐기됐다. 모든 버전에서 취약점이 발견됐다 |
| TLS (Transport Layer Security) | SSL의 후속 | 지금 실제로 쓰는 것. TLS 1.2와 1.3이 표준 |
| SSL 인증서 | 서버 신원을 증명하는 디지털 신분증 | 이름만 SSL이고 실제로는 TLS에서 쓴다 |

SSL은 이름만 남았고 실제로 돌아가는 건 전부 TLS다. 그런데 관행상 계속 "SSL 인증서"라고 부르고, Nginx 설정에도 옛 이름이 남아 있다.

```nginx
ssl_protocols TLSv1.2 TLSv1.3;
```

설정 이름은 `ssl_`인데 값은 TLS 버전이다. 옛 버전(SSL 3.0, TLS 1.0, 1.1)은 알려진 취약점 때문에 끄는 게 권장이고, certbot으로 설정하면 TLS 1.2 이상만 허용하도록 잡아준다.

인증서 안에는 이런 게 들어 있다.

| 구성 요소 | 뜻 |
|---|---|
| 서버의 공개키 | 통신을 시작할 때 쓴다 |
| 도메인 정보 | "이 인증서는 `api.example.com`용이다" |
| CA의 전자 서명 | 인증기관이 "내가 확인했다"고 도장을 찍은 것 |

핵심은 **CA(Certificate Authority, 인증기관)**다. 은행 직원이 신분증을 볼 때 정부 도장이 진짜인지만 확인하고 믿는 것처럼, 브라우저는 믿을 수 있는 CA 목록을 미리 내장하고 있고 서버가 보낸 인증서가 그중 하나의 서명을 받았는지 확인한다. 검증은 한 단계가 아니라 `내 서버 인증서 → 중간 CA → 루트 CA(브라우저에 내장)`로 이어지는데, 이걸 신뢰 체인(Chain of Trust)이라고 한다. 체인을 타고 올라가서 루트에 닿으면 통과다.

## HTTPS가 동작하는 방식
통신을 시작하기 전에 TLS 핸드셰이크라는 절차를 거친다. 단순하게 그리면 이렇다.

```
1. 브라우저 → 서버  : "나는 이런 암호화 방식들을 쓸 수 있어"
2. 서버 → 브라우저  : 자기 인증서(공개키 포함)를 보낸다
3. 브라우저        : 믿을 만한 CA의 서명을 받은 인증서인지 확인한다
4. 브라우저 ↔ 서버  : 이번 통신에서만 쓸 대칭키(세션키)를 안전하게 정한다
5. 이후 통신        : 그 대칭키로 암호화해서 주고받는다
```

4번과 5번을 나누는 이유가 핵심이다. 공개키/개인키 같은 비대칭 방식은 안전하지만 느리고, 대칭키는 빠르지만 키를 어떻게 나눠 갖느냐가 문제다. 그래서 키를 안전하게 정하는 데만 비대칭 방식을 쓰고, 실제 데이터는 빠른 대칭키로 처리한다.

흔히 하는 설명은 "브라우저가 대칭키를 만들어서 서버의 공개키로 잠가 보내면, 그 상자는 서버의 개인키로만 열린다"는 것이다. 자물쇠 달린 금고에 일회용 암호 하나만 넣어 보내고, 그다음부터는 그 암호로 편지를 주고받는 셈이다. 다만 요즘 쓰는 TLS 1.3은 키를 직접 보내지 않고, 양쪽이 주고받은 값으로 같은 키를 각자 계산하는 방식(Diffie-Hellman 키 교환)을 쓴다. 인증서의 키는 서버가 진짜인지 증명하는 서명에 쓴다. 방식은 달라도 "비대칭 방식으로 키를 안전하게 정하고 실제 데이터는 대칭키로"라는 큰 그림은 같다.

CA를 거치지 않고 내가 나에게 발급한 인증서를 자체 서명 인증서(self-signed)라고 한다. 암호화는 되지만 "내가 나라고 주장하는 신분증"이라 브라우저가 경고를 띄운다. 공개 서비스에는 쓸 수 없고, Let's Encrypt가 무료라서 굳이 쓸 이유도 없다.

## Let's Encrypt와 certbot
**Let's Encrypt**는 무료로 인증서를 발급해주는 인증기관이고, 발급과 갱신을 전부 자동화할 수 있게 만들어져 있다. `certbot`은 Let's Encrypt 인증서를 받아오는 도구다.

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.example.com
```

이 한 줄로 certbot이 세 가지를 알아서 한다.

1. 도메인 소유권을 확인한다.
2. 인증서를 발급받는다.
3. Nginx 설정에 443 설정과 인증서 경로를 추가한다.

3번이 특히 편하다. 어제 만든 `myapp` 설정 파일을 certbot이 직접 고쳐서 `listen 443 ssl`과 `ssl_certificate` 경로, 그리고 80 → 443 리다이렉트까지 넣어준다. `python3-certbot-nginx` 플러그인이 그 일을 한다.

```bash
sudo nginx -t && sudo systemctl reload nginx
curl https://api.example.com/api/files      # [] 같은 정상 JSON이면 성공
```

### 순서가 정해져 있다 - DNS가 먼저
실전에서 가장 많이 걸리는 부분이다. Let's Encrypt는 도메인이 정말 이 서버를 가리키는지 80번 포트로 확인한다(HTTP-01 방식).

```
1. certbot이 http://api.example.com/.well-known/acme-challenge/<임의 문자열>
   주소에서 확인용 값이 보이게 해둔다
2. Let's Encrypt 서버가 그 주소로 접속해본다
3. 값이 맞으면 "이 도메인의 주인이 맞다"고 인정한다
```

그래서 선행 조건이 세 가지다.

| 조건 | 없으면 |
|---|---|
| 도메인이 있어야 한다 | 도메인 소유를 확인하는 방식이라 탄력적 IP만으로는 이렇게 받을 수 없다 |
| DNS A 레코드가 이 서버를 가리켜야 한다 | Let's Encrypt의 접속이 다른 곳으로 가거나 실패한다 |
| 80번 포트가 열려 있어야 한다 | 접속 자체가 안 된다 |

어제 DNS를 먼저 연결해두고 오늘 certbot을 돌린 이유가 이것이다. 순서를 바꾸면 실패한다. certbot을 돌리기 전에 `nslookup api.example.com`으로 탄력적 IP가 나오는지 먼저 확인한다.

HTTPS만 쓸 거니까 나중에 80번을 닫아도 되겠다고 생각할 수 있는데, 인증서를 갱신할 때 같은 확인을 다시 하기 때문에 또 필요하다. HTTP로 들어온 사람을 HTTPS로 돌려보내는 데도 쓰인다. 80번은 계속 열어둔다.

### 90일 만료와 자동 갱신
Let's Encrypt 인증서의 유효기간은 90일이다. 1년씩 주는 유료 인증서에 비하면 짧은데 의도된 설계다. 짧게 주면 키가 유출됐을 때 피해 기간이 줄고, 자동 갱신 없이는 감당이 안 되니 자동화를 사실상 강제하는 효과가 있다.

apt로 certbot을 설치하면 갱신용 systemd 타이머가 같이 등록돼서 따로 크론을 설정할 필요가 없다.

```bash
sudo systemctl list-timers | grep certbot     # 타이머가 등록됐는지 확인
sudo certbot renew --dry-run                  # 실제 갱신 없이 절차만 시험
```

자동이라고 방심하면 90일 뒤에 사고가 난다. 80번 포트를 나중에 닫았거나, Nginx 설정을 손으로 고치다가 certbot이 넣은 부분을 깨뜨렸거나, DNS를 다른 서버로 옮기면 갱신이 조용히 실패한다. 배포 직후와 설정을 바꾼 뒤에 `renew --dry-run`이 통과하는지 확인하는 게 가장 확실하다.

발급 횟수 제한도 있다. 같은 도메인 조합으로는 일주일에 5번까지만 새로 받을 수 있고, 확인 실패도 짧은 시간에 여러 번 쌓이면 막힌다. 설정을 고치면서 certbot을 계속 다시 돌리는 게 가장 위험하다. 시험할 때는 `--dry-run`이나 `--test-cert`(테스트용 서버)를 쓰면 제한에 걸리지 않는다.

### 암호는 Nginx에서 풀린다

```
[브라우저] ──https://api.example.com──▶ [Nginx :443]
                                           │  ← Let's Encrypt 인증서로 암호를 푼다
                                           ▼
                                  127.0.0.1:8000  (평문 HTTP)
                                  [Gunicorn] → [FastAPI] → RDS / S3
```

암호를 푸는 일(TLS termination)이 Nginx에서 일어난다는 게 이 구조의 핵심이다. FastAPI는 HTTPS를 전혀 모르고 평문 HTTP만 처리하고, 인증서 관리와 암호화는 전부 Nginx 몫이다. 어제 넣은 `proxy_set_header X-Forwarded-Proto $scheme;`가 여기서 의미가 생긴다. Nginx → Gunicorn 구간이 평문이라 이 헤더가 없으면 FastAPI는 모든 요청이 HTTP로 온 줄 안다.

## 프런트엔드는 왜 S3 + CloudFront인가
프런트엔드도 같은 EC2에 올릴 수 있지만 그럴 필요가 없다. React를 `npm run build`하면 `index.html`, `.js`, `.css` 파일 몇 개가 나온다. 서버가 코드를 실행할 일이 없고, 요청이 오면 파일을 그대로 내려주면 끝이다.

| 비교 | S3 + CloudFront | EC2 |
|---|---|---|
| 맞는 대상 | React, Vue 같은 프런트엔드 | 백엔드 API (FastAPI 등) |
| 비용 | 쓴 만큼만 | 24시간 켜두면 고정 비용 |
| 유지보수 | 관리할 서버가 없다 | OS 패치, Nginx, 보안 설정을 직접 |
| 트래픽이 몰리면 | 알아서 대응한다 | 확장을 직접 구성해야 한다 |
| HTTPS | ACM + CloudFront로 간단 | certbot 설정과 갱신 필요 |

정적 파일을 EC2로 서비스하는 건 택배 하나 보내려고 트럭을 24시간 대기시키는 것과 같다. 그래서 프런트엔드는 S3 + CloudFront, 백엔드 API는 EC2로 역할을 나눈다.

| 서비스 | 하는 일 | 비유 |
|---|---|---|
| S3 | 파일을 보관한다 | 창고 |
| CloudFront | 파일을 전 세계에 빠르게 내보낸다 | 전국 각지의 편의점 |

CloudFront는 CDN(Content Delivery Network)이다. 창고(S3)는 잠가두고, 전국 편의점(엣지 서버)에 물건을 복사해두고, 손님은 가까운 편의점에서 받는다. 하는 일은 세 가지다.

1. 속도: 처음 한 번 이후에는 가까운 엣지 서버에 캐시된 복사본을 내려준다.
2. HTTPS: ACM 인증서를 붙여서 내 도메인에 HTTPS를 쉽게 적용한다.
3. 원본 보호: S3를 공개하지 않고 CloudFront만 읽어가게 한다(OAC).

## 프런트엔드용 S3 버킷

```
S3 → Create bucket
  Bucket name         : myapp-dev-frontend-xxxx   ★ 전 세계에서 유일
  Region              : ap-northeast-2
  Block Public Access : 전체 차단 유지            ★ 그대로 둔다
```

어제 만든 업로드용 버킷처럼 비공개로 둔다. 그리고 S3의 **정적 웹 사이트 호스팅(Static website hosting)** 기능은 켜지 않는다. 그 기능은 버킷을 공개해야 쓸 수 있다. 버킷은 평범한 비공개 저장소로 두고 CloudFront가 읽어가게 하는 게 지금 권장하는 방식이다.

| 방식 | S3 상태 | HTTPS | 지금 |
|---|---|---|---|
| Static website hosting | 공개해야 한다 | S3만으로는 HTTP만 | 옛 방식 |
| 일반 버킷 + OAC | 비공개 유지 | CloudFront가 처리 | 권장 |

인터넷 예제에서 `버킷명.s3-website-리전.amazonaws.com` 같은 주소가 나오면 옛 방식이다.

## CloudFront 배포 만들기
CloudFront 콘솔은 화면이 단계별 마법사로 바뀌어서, 한 화면에서 다 설정하는 인터넷의 옛 예제와 모양이 다르다. 수업에서는 이렇게 진행했다.

| 단계 | 한 일 |
|---|---|
| Distribution name | `myapp-frontend` |
| Choose a plan | `Single website or app` |
| Get started (도메인) | 입력하지 않고 Next로 넘어갔다 |
| Specify origin | Origin type `Amazon S3` → 위 버킷 선택 → `Use recommended origin settings` (OAC 포함) |
| Enable security | `Do not enable security protections` (비용 절감) |
| Review and create | 생성 |

도메인 단계를 건너뛴 건 우리 도메인이 Route 53이 아니라 외부 업체에서 받은 것이라서다. 도메인 연결은 배포를 만든 뒤에 따로 했다.

배포를 만들면 CloudFront가 S3 버킷 정책을 자동으로 넣어준다. 예전에는 정책을 복사해서 손으로 붙여넣어야 했다고 한다. 들어가는 정책은 이렇게 생겼다.

```json
{
  "Effect": "Allow",
  "Principal": {
    "Service": "cloudfront.amazonaws.com"
  },
  "Action": "s3:GetObject",
  "Resource": "arn:aws:s3:::myapp-dev-frontend-xxxx/*",
  "Condition": {
    "StringEquals": {
      "AWS:SourceArn": "arn:aws:cloudfront::<계정ID>:distribution/<배포ID>"
    }
  }
}
```

어제 배운 IAM 정책과 버킷 정책의 차이가 여기서 실제로 갈린다. 업로드용 버킷은 EC2 역할에 IAM 정책을 붙였지만, CloudFront는 IAM 역할이 아니라 AWS 서비스(`cloudfront.amazonaws.com`)라서 버킷 쪽에서 열어줘야 한다. 그래서 `Principal`이 있다.

`Condition`의 `SourceArn`이 "내가 만든 그 배포만"으로 범위를 좁힌다. 다른 CloudFront 배포나 임의의 요청은 거부된다. 그래서 퍼블릭 액세스 차단을 켠 채로도 동작한다. 공개한 게 아니라 특정 서비스에게만 허락한 것이기 때문이다.

### SPA 라우팅용 오류 페이지
이건 반드시 해야 한다.

```
배포 상세 → Error pages → Create custom error response
  HTTP error code          : 403
  Customize error response : Yes
  Response page path       : /index.html
  HTTP Response code       : 200
  → 404도 같은 방식으로 추가
```

React Router로 만든 `/about` 같은 주소는 S3에 실제 파일로 존재하지 않는다. 사용자가 그 주소로 바로 들어오거나 새로고침하면 S3는 "그런 파일 없다"고 답한다. 그래서 "없으면 `index.html`을 200으로 돌려줘"라고 해두면, `index.html`이 열린 뒤 React가 브라우저에서 라우팅을 처리한다.

403을 먼저 넣은 이유가 있다. 버킷을 비공개로 두고 OAC로 읽으면 없는 파일에 대해 S3가 404가 아니라 403(Forbidden)을 준다. CloudFront에 목록 조회 권한(`s3:ListBucket`)이 없어서 "파일이 없다"는 정보조차 알려주지 않는 것이다. 그래서 403과 404를 둘 다 등록한다.

배포 상태가 `Deploying`에서 `Enabled`로 바뀌는 데 5~15분 걸린다. 그 사이에 `dxxxxxxxxxxxxx.cloudfront.net` 같은 **Distribution domain name**을 적어둔다. 내 도메인을 붙이기 전에도 이 주소로 HTTPS가 적용된 상태로 바로 테스트할 수 있다.

## 내 도메인과 ACM 인증서
CloudFront에 내 도메인을 붙이려면 그 도메인용 인증서가 필요하다. 최신 콘솔은 인증서 발급과 도메인 연결이 배포의 **Add a domain** 마법사 하나로 합쳐져 있었다.

```
배포 상세 → Settings → Alternate domain names → Add a domain
  1. Domains: example.com → Next
  2. TLS certificate: 새 인증서 생성
  3. 화면에 DNS 검증용 CNAME 이름과 값이 나온다
     → 도메인 관리 화면에서 그 CNAME 레코드를 추가
  4. 콘솔로 돌아와서 Validate certificate (몇 분~수십 분)
  5. Next → Add domains
```

여기서 꼭 알아둘 게 있다. **CloudFront에 붙이는 ACM 인증서는 반드시 `us-east-1`(버지니아 북부)에 있어야 한다.** CloudFront는 리전이 없는 글로벌 서비스인데 그 설정을 버지니아 리전에서 관리하기 때문이다. 서울 리전에서 인증서를 만들면 CloudFront 목록에 안 나와서, 옛 예제를 따라 하다 보면 여기서 막힌다. 최신 마법사는 알아서 `us-east-1`에 요청해준다.

DNS 검증은 "이 도메인이 정말 당신 것인지" 확인하는 절차다. ACM이 정해준 이름과 값으로 CNAME 레코드를 추가하면, ACM이 그걸 조회해보고 소유를 인정한다. 오전의 Let's Encrypt는 80번 포트로 확인했고 ACM은 DNS 레코드로 확인한다. 방식은 달라도 목적은 같다.

ACM이 보여주는 이름과 값 끝에 마침표(`.`)가 붙어 있는데, 도메인을 끝까지 다 적었다는 표기일 뿐이다. 도메인 관리 화면에서 저장이 안 되면 마침표를 빼고 다시 해본다.

그리고 검증이 끝나도 **이 CNAME 레코드는 지우지 않는다.** ACM 인증서는 AWS가 알아서 갱신하는데, 갱신할 때도 이 레코드로 확인하기 때문에 지우면 갱신이 실패한다.

인증서를 두 번 만든 이유도 정리해뒀다.

| 구분 | Let's Encrypt (certbot) | AWS ACM |
|---|---|---|
| 쓰는 곳 | EC2 위의 Nginx | CloudFront, 로드 밸런서 같은 AWS 서비스 |
| 보관 | 서버에 파일로 저장 | AWS가 보관하고 서비스에 연결만 한다 |
| 갱신 | certbot 타이머 | AWS가 자동으로 |
| 비용 | 무료 | AWS 서비스에 붙여 쓰면 무료 |

ACM의 무료 인증서는 AWS 서비스에 연결해서 쓰는 방식이라 EC2 안의 Nginx에 파일로 넣어 쓸 수 없다. 그래서 EC2에는 Let's Encrypt를, CloudFront에는 ACM을 썼다. 둘 다 도메인 소유만 확인하는 DV(Domain Validation) 인증서다. 조직 실체까지 확인하는 OV, 법적 실사까지 하는 EV도 있지만 암호화 강도는 같고 "누구인지 얼마나 확인했나"만 다르다.

## DNS를 CloudFront로 연결

| 상황 | 방법 |
|---|---|
| Route 53 | `A` 레코드 + Alias → CloudFront 배포 선택 |
| 외부 DNS 업체 | `CNAME`으로 CloudFront 주소(`dxxxxxxxxxxxxx.cloudfront.net`) 연결 |

CloudFront는 엣지 서버가 전 세계에 흩어져 있어서 기본적으로 고정 IP가 없다. 그래서 IP를 적는 A 레코드로는 가리킬 수 없고 원래는 CNAME을 쓴다. 그런데 DNS 규칙상 `example.com` 같은 최상위(apex) 도메인 자체에는 CNAME을 쓸 수 없다. Route 53의 Alias는 이 제약을 우회하는 AWS 전용 기능이다. 수업에서 쓴 도메인은 무료 도메인 서비스에서 받은 서브도메인 형태라 일반 CNAME으로 충분했다.

```bash
nslookup example.com        # CloudFront 주소가 나오면 연결 완료
```

반대로 IP로 접속해야만 하는 요구가 있다면 CloudFront 대신 EC2 + 탄력적 IP를 써야 한다.

## Vite 빌드 - 환경변수는 빌드할 때 박힌다
프런트엔드가 부를 API 주소는 `.env.production`에 적는다.

```
# frontend/.env.production
VITE_API_BASE_URL=https://api.example.com
```

```bash
cd frontend
npm install
npm run build       # frontend/dist 생성
```

빌드 모드는 따로 설정하는 게 아니라 어떤 명령을 실행하느냐로 정해진다.

| 명령 | 모드 | 읽는 파일 |
|---|---|---|
| `npm run dev` (= `vite`) | development | `.env.development` |
| `npm run build` (= `vite build`) | production | `.env.production` |
| `npm run preview` | 이미 빌드된 `dist/`를 띄워서 보여준다 | 값이 이미 박혀 있다 |

`vite build --mode staging`처럼 모드를 직접 지정하면 `.env.staging`을 읽는다.

가장 중요한 함정은 **값이 빌드할 때 코드에 박힌다는 것**이다. `.env.production`을 고쳤으면 반드시 `npm run build`를 다시 해야 반영된다. 이미 만들어진 `dist/`를 그대로 다시 올리면 예전 값이 남아 있다. 프런트엔드의 `.env`는 실행 중에 읽는 설정이 아니라 빌드할 때 찍어 넣는 도장이다. 실제로 `dist/` 안의 `.js` 파일을 열어보면 API 주소가 문자열로 그냥 들어 있다.

그래서 프런트엔드 `.env`에는 비밀값을 넣으면 안 된다. 값이 코드에 박혀서 브라우저로 내려가니 누구나 개발자 도구로 볼 수 있다. `VITE_`로 시작하는 변수만 코드에 들어가게 한 것도, 서버용 비밀값이 실수로 새어 나가지 않게 하려는 장치다. API 키나 비밀번호는 백엔드 `.env`의 몫이다.

## 업로드와 캐시 무효화 - 세 단계를 다 해야 끝난다
업로드는 로컬 PC의 AWS CLI로 한다. `aws configure`에는 루트 계정이 아니라 IAM 사용자의 키를 넣는다.

```bash
# 1) 빌드
npm run build

# 2) S3 업로드
aws s3 sync dist/ s3://myapp-dev-frontend-xxxx --delete

# 3) CloudFront 캐시 무효화
aws cloudfront create-invalidation --distribution-id <배포 ID> --paths "/*"
```

`sync`는 로컬의 `dist/`와 버킷을 비교해서 바뀐 것만 올린다. `--delete`는 예전 빌드에는 있었지만 새 빌드에는 없는 파일을 버킷에서 지운다. Vite는 빌드할 때마다 `assets/index-a1b2c3.js`처럼 파일 이름에 해시를 붙여서, `--delete`를 빼면 옛 파일들이 버킷에 계속 쌓인다.

가장 놓치기 쉬운 건 캐시 무효화다. **CloudFront는 CDN이라 전 세계 엣지에 응답을 캐시해두고 있어서, S3에 새 파일을 올려도 사용자는 캐시된 예전 버전을 계속 받을 수 있다.** `create-invalidation`으로 캐시를 비워야 CloudFront가 S3에서 새 파일을 다시 가져온다. `--paths "/*"`는 전체 무효화이고, 한 달에 1,000개 경로까지는 무료라 이 규모에서는 신경 쓸 정도가 아니다.

확인할 때는 강력 새로고침(`Ctrl + Shift + R`, 맥은 `Cmd + Shift + R`)을 쓴다. 캐시가 두 겹이라서다.

```
[브라우저 캐시]          ← 강력 새로고침으로 우회
[CloudFront 엣지 캐시]   ← create-invalidation으로 비운다
[S3 원본]
```

둘은 별개다. 무효화를 했는데도 안 바뀌면 브라우저 캐시이고, 강력 새로고침을 했는데도 안 바뀌면 CloudFront 캐시다. 시크릿 창으로 열어보면 브라우저 캐시 영향을 빼고 볼 수 있다.

실무에서는 무효화를 최소화한다고 한다. Vite가 파일 이름에 해시를 붙이니까 내용이 바뀌면 파일 이름 자체가 바뀌어서 `assets/` 쪽은 캐시를 비울 필요가 없고, 이름이 그대로인 `index.html`만 무효화하면 된다.

```bash
aws cloudfront create-invalidation --distribution-id <배포 ID> --paths "/index.html"
```

## 문제가 생겼을 때 볼 곳
마지막으로 `https://example.com`에 접속해서 파일 업로드 → 목록 조회 → 다운로드 → 이미지 보기 순서로 전체 흐름을 확인했다. 증상별로 볼 곳은 이렇게 정리됐다.

| 증상 | 확인할 곳 |
|---|---|
| 프런트 페이지가 안 뜬다 (403/404) | CloudFront 상태가 `Enabled`인지, 버킷 정책이 들어갔는지, `nslookup`이 CloudFront를 가리키는지 |
| `api.` 주소 접속 자체가 안 된다 | `nslookup`이 탄력적 IP를 가리키는지, `sec-group-ec2`에 443이 열려 있는지 |
| API가 502 / 504 | `systemctl status myapp-backend`, `systemctl status nginx`, `journalctl -u myapp-backend` |
| 업로드(POST)만 실패한다 | Nginx의 `client_max_body_size`, 앱의 업로드 크기 제한(2MB) |
| CORS 에러 | `.env`의 `ALLOWED_ORIGINS`가 프런트 주소와 정확히 같은지(끝 슬래시 없이), 고친 뒤 백엔드를 재시작했는지 |
| 다운로드나 이미지가 안 열린다 | `AWS_S3_BUCKET`, `AWS_REGION` 값, IAM 역할의 `s3:GetObject` 권한 |
| 프런트 수정이 반영 안 된다 | 다시 빌드했는지, 캐시 무효화를 했는지, 강력 새로고침 |
| 인증서나 HTTPS 오류 | ACM 인증서가 `us-east-1`에 있는지, `journalctl -u certbot` |

"업로드만 실패한다"가 특히 쓸모 있는 항목이다. 조회는 되는데 업로드만 안 되면 크기 제한일 가능성이 높아서 범위가 단번에 좁혀진다.

프런트와 백엔드를 `example.com`과 `api.example.com`으로 나눴기 때문에 CORS 설정이 필요했다. CloudFront 하나에서 `/api/*` 경로만 EC2로 보내면 같은 출처가 돼서 CORS가 필요 없지만 설정이 복잡해진다. 수업은 구조가 명확한 서브도메인 분리 방식을 썼다.

## 실습이 끝나면 정리하는 순서
요금이 계속 나가지 않게 실습 후에는 지워야 하는데, 서로 참조하고 있어서 순서가 있다.

```
1. CloudFront   → Disable → (배포 완료 확인) → Delete   ★ 먼저. 시간이 걸린다
2. EC2          → Terminate
3. 탄력적 IP     → Release                               ★ 안 하면 계속 과금
4. RDS          → Delete (스냅샷을 남길지 선택)
5. S3 버킷 2개   → Empty → Delete
6. ACM 인증서    → us-east-1에서 삭제 (CloudFront 삭제 후)
7. DNS 레코드    → 삭제 (Route 53 호스팅 영역을 새로 만들었다면 그것도)
8. IAM 역할/정책 → 삭제
9. 보안 그룹     → 삭제
```

CloudFront를 먼저 지우는 이유는 비활성화부터 삭제까지 시간이 걸리고, S3 버킷 정책과 ACM 인증서가 CloudFront를 참조하고 있기 때문이다.

## 헷갈리기 쉬운 부분
- DNS를 연결하기 전에 certbot을 돌리면 실패한다. Let's Encrypt가 80번으로 도메인을 확인하기 때문이다. `nslookup`으로 먼저 확인한다.
- 80번 포트는 계속 열어둔다. 닫으면 갱신이 실패한다.
- 실패한다고 certbot을 반복해서 돌리면 발급 제한에 걸린다. 시험은 `--dry-run`이나 `--test-cert`로 한다.
- certbot이 고친 Nginx 설정을 손으로 다시 고칠 때는 certbot이 넣은 부분을 깨뜨리지 않게 조심한다.
- 프런트가 HTTPS인데 API가 HTTP면 브라우저가 막는다(Mixed Content). 백엔드 HTTPS가 먼저다.
- CloudFront용 ACM 인증서는 `us-east-1`에 있어야 한다. 서울에 만들면 목록에 안 나온다.
- ACM의 DNS 검증용 CNAME은 검증이 끝나도 지우지 않는다. 자동 갱신에 쓰인다.
- SPA 오류 페이지는 404만 넣고 403을 빠뜨리기 쉽다. OAC로 읽으면 없는 파일이 403으로 온다.
- S3의 Static website hosting은 켜지 않는다. 버킷은 비공개로 두고 OAC로 읽게 한다.
- `.env.production`만 고치고 빌드를 안 하면 반영되지 않는다. 값은 빌드할 때 박힌다.
- 재배포는 빌드 → `s3 sync --delete` → 캐시 무효화 세 단계를 다 해야 끝난다. 확인은 강력 새로고침이나 시크릿 창으로 한다.
- CloudFront 배포가 `Enabled`가 되기까지 5~15분 걸린다. 바로 안 된다고 당황할 필요 없다.
- 프런트엔드 `.env`에 넣은 값은 누구나 볼 수 있다. 비밀값은 넣지 않는다.

## 오늘 배운 내용 정리
오늘은 백엔드에 HTTPS를 붙이고 프런트엔드를 S3와 CloudFront로 배포해서 3일 동안의 배포를 마무리했다.

```
Mixed Content: HTTPS 페이지에서 HTTP API를 부르면 브라우저가 막는다. 백엔드 HTTPS가 먼저.
TLS: SSL은 이름만 남았다. 인증서로 신원 확인 → 대칭키를 안전하게 정함 → 대칭키로 통신.
certbot: certbot --nginx -d 도메인. 443 설정과 리다이렉트까지 넣어준다.
순서: 도메인 → DNS A 레코드 → 80번 열기 → certbot. 80번은 갱신 때문에 계속 연다.
갱신: 90일 만료, systemd 타이머가 자동 갱신. renew --dry-run 으로 확인.
S3 + CloudFront: 버킷은 비공개, CloudFront만 OAC로 읽는다. 버킷 정책은 콘솔이 자동으로.
SPA: 403, 404 → /index.html (200).
ACM: CloudFront용은 us-east-1. DNS 검증 CNAME은 지우지 않는다.
DNS: 외부 업체면 CNAME → xxxx.cloudfront.net, Route 53이면 A + Alias.
Vite: npm run build 할 때 .env.production 값이 박힌다. 고치면 다시 빌드.
재배포: npm run build → aws s3 sync dist/ s3://버킷 --delete → create-invalidation.
정리: CloudFront부터 지우고, 탄력적 IP는 Release까지.
```

3일 동안 EC2 한 대에서 시작해서 RDS, S3, IAM, Nginx, HTTPS, CloudFront까지 이어 붙였다. 하나씩 배울 때는 복잡했는데 "데이터는 EC2 밖으로, 키는 서버에 두지 않고 역할로, 바깥에서 들어오는 문은 Nginx와 CloudFront로"라는 원칙으로 정리됐다. 프런트엔드를 고친 뒤에는 빌드, 업로드, 캐시 무효화 중 하나만 빠져도 옛 화면이 보인다는 점은 꼭 기억해둬야겠다.

---
