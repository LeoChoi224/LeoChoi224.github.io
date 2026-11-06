---
layout: single
title: "Git 기초 정리 1 - 브랜치와 병합, GitHub 협업과 충돌 해결"
categories: [coding, Git]
tag: [study-log, Git, GitHub, branch, merge, conflict, gitignore, SSH]
toc: true
author_profile: false
sidebar:
    nav: "docs"
search: true
---
<hr/>

오늘은 Git과 GitHub를 배웠다. 실습은 `ShopMaster`라는 가짜 쇼핑몰 HTML 프로젝트로 했는데, 파일 곳곳에 `<!-- A#10 -->`, `<!-- B#12 -->` 같은 주석이 붙어 있었다. `A#`는 Alpha 역할이 할 차례, `B#`는 Beta 역할이 할 차례이고 숫자는 순서다. 나중에 파일을 열어보면 누가 언제 넣은 줄인지 한눈에 보이게 만든 장치였다.

그리고 GitHub 계정을 두 개 만들어서, 한 컴퓨터 안에 폴더 두 개를 두고 "두 사람인 척" 협업을 해봤다. 팀원을 기다릴 필요 없이 충돌을 마음대로 만들어볼 수 있어서 배우기에는 오히려 좋은 방법이었다.

## 버전 관리가 필요한 이유
버전 관리를 안 쓰면 이렇게 된다.

```
프로젝트.zip
프로젝트_수정.zip
프로젝트_최종.zip
프로젝트_최종_진짜최종.zip
```

| 문제 | 상황 |
|---|---|
| 뭐가 바뀌었는지 모른다 | 두 zip 을 열어놓고 눈으로 비교해야 한다 |
| 왜 바꿨는지 모른다 | 3주 전의 나에게 물어볼 수 없다 |
| 되돌릴 수 없다 | "어제 것으로만 돌리고 싶은데"가 안 된다 |

Git은 파일을 덮어쓰는 대신 "이 시점"을 통째로 저장(commit)해두고, 커밋 하나에 무엇을 왜 바꿨는지를 같이 묶어서 이 셋을 해결한다.

## 저장은 두 단계 - add와 commit
```bash
git add templates/index.html             # ① 이번에 저장할 것만 고른다
git commit -m "A#10 detail-page 추가"     # ② 고른 것을 한 덩어리로 찍는다
```

`add`는 장바구니에 담기, `commit`은 결제다. 파일 열 개를 고쳤어도 그중 세 개만 담아서 결제할 수 있다.

```
작업 폴더          →   스테이징          →   저장소
내가 고치는 곳         add 로 담아둔 곳        commit 으로 확정된 이력
```

굳이 두 단계인 이유는 커밋을 의미 단위로 자르기 위해서다. "로그인 기능"과 "오타 수정"을 한꺼번에 고쳤다면, 두 번에 나눠 커밋해야 나중에 하나만 되돌릴 수 있다. 실습 커밋도 "줄바꿈", "rename"처럼 사소한 것까지 한 커밋에 한 가지 일만 했다.

```
762a195  Initial commit
68971e6  A#10 detail-page 추가
83719a7  A#11 detail 메뉴 추가
189da0a  B#12 장바구니
b79b726  rename
```

커밋 메시지는 "수정", "asdf" 말고 무엇을 했는지 한 줄로 쓰고, 왜 그렇게 했는지는 본문에 쓰는 게 관행이라고 했다. 나중에 `git log`만 훑어도 프로젝트 역사가 읽히면 성공이다.

## 브랜치는 폴더 복사가 아니라 이름표다
```bash
git checkout -b feature/detail-page    # 만들고 그리로 이동
git checkout main                      # 되돌아오기
```

브랜치는 파일을 복사해두는 게 아니라 **커밋을 가리키는 이름표**다. `main`도 `feature/detail-page`도 각각 커밋 하나를 가리킬 뿐이라, 브랜치를 만드는 비용은 거의 0이다.

커밋을 하면 지금 있는 브랜치의 이름표만 앞으로 움직인다.

```
762a195 ── 68971e6 ── 83719a7 ← feature/detail-page
   ↑
  main   (그대로 남아 있다)
```

그래서 `main`을 건드리지 않은 채로 새 작업을 쌓을 수 있다. 실험이 망하면 브랜치만 지우면 되고, `main`은 처음부터 아무 일도 없었다. `feature/이름`처럼 짓는 건 관행이고, `/`는 폴더처럼 묶어 보이게 하는 표시일 뿐이다.

실습에서 가장 좋았던 부분은 브랜치를 여러 번 오가면서 파일이 실제로 바뀌는 걸 확인한 것이었다. `git checkout main`을 치는 순간 에디터에 열려 있던 파일에서 방금 추가한 줄이 사라지고, 다시 `feature/detail-page`로 가면 돌아온다. 브랜치가 이름표라는 말을 글로 읽는 것과 눈앞에서 파일이 바뀌는 걸 보는 건 달랐다.

`checkout`은 브랜치 이동과 파일 되돌리기(`git checkout -- 파일`)를 겸해서 사고가 나기 쉬워서, Git 2.23부터는 이동은 `git switch`, 되돌리기는 `git restore`로 나눈 명령이 생겼다고 한다.

## 병합과 Fast-forward
작업이 끝나면 `main`으로 돌아와 합친다.

```bash
git checkout main
git merge feature/detail-page
# Fast-forward
```

```
병합 전:   762a195 ── 68971e6 ── 83719a7 ← feature/detail-page
              ↑
            main

병합 후:   762a195 ── 68971e6 ── 83719a7 ← feature/detail-page, main
```

`main`이 그사이 한 발짝도 안 움직였기 때문에 합칠 것도 없이 이름표만 앞으로 밀면 끝이다. 새 커밋이 생기지 않아서 "빨리 감기(Fast-forward)"라고 부른다. 반대로 양쪽에 다 커밋이 쌓였으면 이름표만 밀 수 없어서, 두 갈래를 합치는 **병합 커밋**이 새로 만들어진다.

Fast-forward는 이력이 한 줄로 깔끔해지는 대신 "여기부터 여기까지가 그 기능 작업이었다"는 흔적이 사라져서, 팀에 따라서는 `git merge --no-ff`로 일부러 병합 커밋을 남기기도 한다고 했다.

## .gitignore - 올리면 안 되는 것 막기
실습 프로젝트에는 일부러 `.env` 파일이 들어 있었다.

```
# .env
OPENAI_API_KEY=******
GEMINI_API_KEY=******
```

```
# .gitignore
.env
**/images/
```

API 키나 비밀번호는 한 번 GitHub에 올라가면 끝이다. 공개 저장소면 바로 노출되고, 지운다고 해도 커밋 이력에는 남는다. 그래서 애초에 Git이 쳐다보지도 않게 막는다. `**/images/`는 어느 깊이에 있는 `images` 폴더든 무시한다는 뜻이다.

`.gitignore`의 가장 큰 함정은 **이미 커밋한 파일에는 안 통한다**는 것이다. 실수로 `.env`를 한 번 커밋했다면 `git rm --cached .env`로 추적을 끊어야 하고, 이미 푸시까지 했다면 키를 새로 발급받아야 한다. 실무에서는 실제 값이 든 `.env`는 무시하고, 어떤 값을 채워야 하는지만 적은 `.env.example`을 커밋해둔다고 한다.

## GitHub - 저장소 사본을 하나 더 두기
지금까지는 내 컴퓨터 안의 일이었다. 그것만으로는 노트북이 고장 나면 이력까지 사라지고, 남에게 코드를 넘길 방법도 zip밖에 없다. GitHub는 인터넷 어딘가에 저장소 사본을 하나 더 두는 것이고, 그 사본을 여러 사람이 주고받으면 협업이 된다.

| 역할 | 하는 일 | 원격 연결 방식 |
|---|---|---|
| Alpha | 저장소를 만든 주인 | HTTPS |
| Beta | 초대받아 clone 한 협력자 | SSH |

계정을 굳이 둘로 나누니 두 가지가 더 보였다. 커밋에 다른 사람 이름이 찍혀서 `git log`에서 누가 무엇을 했는지 구분되고, 남의 저장소에 push하려면 협력자(Collaborator)로 초대받아야 한다는 걸 직접 겪게 된다.

### clone과 origin
```bash
git clone git@github.com:사용자/Alphashop.git
git remote -v
# origin  git@github.com:사용자/Alphashop.git (fetch)
# origin  git@github.com:사용자/Alphashop.git (push)
```

`clone`은 단순한 다운로드가 아니라 이력까지 통째로 복제하는 것이다. 그리고 clone하면 원격 저장소에 `origin`이라는 별명이 자동으로 붙는다. `origin`은 예약어가 아니라 관행적인 이름일 뿐이고, `git push origin main`은 "origin이라는 별명이 가리키는 곳의 main에 올려라"라는 뜻이다.

처음에 잘 안 잡힌 건 `main`과 `origin/main`이 다르다는 점이었다. `main`은 내 컴퓨터의 브랜치이고, `origin/main`은 "내가 마지막으로 확인한 시점의 원격 main" 사본이다. 다른 사람이 push해도 내가 `fetch`나 `pull`하기 전까지는 `origin/main`이 움직이지 않는다.

### HTTPS와 SSH
같은 저장소인데 Alpha는 HTTPS, Beta는 SSH로 연결돼 있었다.

| | HTTPS | SSH |
|---|---|---|
| 주소 모양 | `https://github.com/...` | `git@github.com:...` |
| 인증 | 아이디 + 토큰 | 키 쌍 (`~/.ssh/id_ed25519`) |
| 처음 설정 | 없다 (push 할 때 물어본다) | 키를 만들어 GitHub 에 등록한다 |

HTTPS는 2021년 8월부터 GitHub 비밀번호로는 push가 안 되고, 토큰(Personal Access Token)을 발급받아 비밀번호 자리에 넣어야 한다. SSH는 `ssh-keygen -t ed25519`로 키를 만들고 공개키(`.pub`)를 GitHub에 한 번 등록해두면 다시 묻지 않는다. 회사나 학원처럼 방화벽이 SSH 포트를 막은 곳에서는 HTTPS가 통한다고 했다.

## 충돌은 왜 나고 어떻게 푸나
그날 오후의 흐름을 Git 기록으로 따라가보면 이랬다.

| 시각 | Alpha | Beta |
|---|---|---|
| 14:09 | 첫 커밋 → push | |
| 14:13 | | clone |
| 14:15~14:21 | `feature/detail-page` 에서 A#10, A#11 | |
| 14:29~14:38 | | `feature/cart` 에서 B#12, rename |
| 14:48 | `main` 에 병합 (Fast-forward) → push | |
| 15:05 | | `main` 에서 pull ← Alpha 작업 받음 |
| 15:11 | | `feature/cart` 에서 `merge main` ← 충돌 지점 |
| 15:14 | | `main` 에 병합 (Fast-forward) → push |
| 15:18 | pull ← Beta 작업 받음 | |

Beta 입장에서 보면, `feature/cart`를 만들 때의 `main`은 첫 커밋 상태였는데 그사이 Alpha가 `main`에 A#10, A#11을 합치고 push했다. 이제 `feature/cart`와 `main`이 갈라져 있고, 게다가 둘 다 `index.html`의 같은 자리에 줄을 끼워 넣었다. Git은 둘 중 어느 것을 먼저 둘지 판단할 수 없다. 이게 충돌이다.

해결 순서가 오늘의 핵심이었다.

```bash
git pull origin main                  # ① main 을 최신으로
git checkout feature/cart
git merge main                        # ② main 을 "내 브랜치로" 먼저 가져와서 여기서 정리
git add . && git commit               #    충돌을 해결했으면 병합 커밋 완성
git checkout main
git merge feature/cart                # ③ 이제 Fast-forward
git push origin main
```

`main`은 모두가 보는 공용 공간이라 거기서 충돌을 정리하다 실수하면 다 같이 곤란해진다. 그래서 **정리는 내 브랜치에서** 하고 깨끗해진 뒤에 올린다. 이렇게 하면 `feature/cart`가 `main`보다 앞서 있는 상태가 되어서, 마지막 병합은 Fast-forward가 된다. 실제 기록에도 `Merge branch 'main' into feature/cart` 다음에 `merge feature/cart: Fast-forward`가 남아 있었다.

충돌이 나면 파일이 이렇게 바뀐다.

```
<<<<<<< HEAD
    <div>장바구니</div> <!-- b#12 -->
=======
    <div>about</div> <!-- A#8 -->
>>>>>>> main
```

`<<<<<<< HEAD`부터 `=======`까지가 내 브랜치의 내용이고, `=======`부터 `>>>>>>> main`까지가 가져오는 쪽의 내용이다. 이 기호 세 줄을 지우고 원하는 최종 모습으로 직접 고친 다음 `add`하고 `commit`하면 해결이다. `git merge --abort`로 병합 자체를 취소할 수도 있다.

병합이 끝난 `index.html`에는 A와 B의 줄이 나란히 다 남아 있었다.

```html
<header>헤더입니다 <!-- A#2 -->
    <div>회원가입</div> <!-- B#4 -->
    <div>about</div> <!-- A#8 -->
    <div>관리자</div> <!-- B#6 -->
    <div>장바구니</div> <!-- b#12 -->
    <div>detail-page</div> <!-- A#11 -->
</header>
```

병합이 한쪽을 버리는 게 아니라 둘 다 살리는 것이라는 게 `A#`, `B#` 주석 덕분에 눈으로 보였다.

충돌은 실력 문제가 아니라 작업 방식의 문제라고 했다. 작업을 시작하기 전에 자주 pull하고, 브랜치를 오래 두지 않고, 같은 파일을 동시에 고치지 않게 나누면 줄어든다.

### Git은 이름 바꾸기를 알아본다
Beta의 커밋 중에 한글 입력 상태에서 `cart`를 쳐서 `ㅊㅁㄱㅅ.html`이 만들어지고, 다음 커밋에서 `cart.html`로 이름을 바꾼 게 있었다. 그 커밋의 변경 내용은 `0 insertions(+), 0 deletions(-)`였다. Git은 파일을 이름이 아니라 내용으로 추적해서, 내용이 같으면 "지우고 새로 만들었다"가 아니라 "이름을 바꿨다"로 알아본다. `git mv ㅊㅁㄱㅅ.html cart.html`을 쓰면 스테이징까지 한 번에 된다.

## 헷갈리기 쉬운 부분
- `add`를 빼먹고 `commit`하면 "변경 사항이 없다"고 나온다. 고친 것과 담은 것은 다르다.
- `git add .`의 `.`은 현재 폴더 전부라서 의도하지 않은 파일까지 담긴다. 커밋 전에 `git status`로 지금 어느 브랜치인지, 무엇이 담겼는지 확인하는 습관이 초보 때 사고를 가장 많이 막아준다.
- 원격이 앞서 있으면 push가 거부(`rejected`)된다. 이럴 때 `git push -f`를 붙이면 남의 커밋을 지운다. 받아서(`pull`) 정리한 뒤 다시 올려야 한다.
- 충돌 기호를 지우지 않고 커밋하면 `<<<<<<<`가 그대로 파일에 남는다.
- 브랜치를 지워도 커밋은 안 지워진다. 이름표만 뗀 것이라 `git reflog`에서 예전 커밋을 찾아 되돌아갈 수 있다. 반대로 커밋하지 않은 변경은 지켜주지 않아서 자주 커밋하는 게 최선의 보험이다.
- 예전에는 기본 브랜치 이름이 `master`였는데, 2020년 무렵 GitHub를 비롯한 도구들이 `main`으로 바꿨다. 오래된 예제의 `master`는 같은 것이다.
- 실무에서는 로컬에서 `git merge`하지 않고, 브랜치를 push한 뒤 GitHub에서 Pull Request를 만들어 코드 리뷰를 받고 병합한다고 한다.

## 오늘 배운 내용 정리
오늘은 Git의 브랜치와 병합, GitHub로 협업하고 충돌을 푸는 방법을 배웠다.

```
커밋: add(담기) → commit(찍기). 한 커밋에 한 가지 일.
브랜치: 커밋을 가리키는 이름표. 만드는 비용이 없으니 작업은 항상 브랜치에서.
Fast-forward: 갈라진 적이 없으면 이름표만 앞으로. 새 커밋이 안 생긴다.
.gitignore: 이미 커밋한 파일엔 안 통한다 → git rm --cached. 푸시한 키는 재발급.
clone: 이력까지 통째로 복제. origin 은 원격에 붙은 별명.
main vs origin/main: 내 브랜치 vs 마지막으로 확인한 원격의 사본.
HTTPS 는 토큰, SSH 는 키 등록.
충돌 해결: pull → 내 브랜치에서 merge main → 정리 → main 에서 merge (Fast-forward).
충돌 기호: <<<<<<< 내 것 / ======= / >>>>>>> 가져오는 것. 지우고 최종 모습으로.
push 거부: -f 금지. pull 해서 정리한 뒤 다시 push.
```

계정 두 개로 혼자 두 사람 역할을 해보니, 충돌이 왜 나는지와 왜 내 브랜치에서 먼저 정리해야 하는지가 순서대로 보였다. 앞으로 팀 프로젝트를 할 때 가장 먼저 쓰게 될 내용인 것 같다.

---
