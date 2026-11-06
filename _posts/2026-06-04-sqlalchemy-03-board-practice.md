---
layout: single
title: "SQLAlchemy 기초 정리 3 - 게시판 실습으로 좋아요 토글과 집계 만들기"
categories: [coding, SQLAlchemy]
tag: [study-log, SQLAlchemy, ORM, relationship, many-to-many, cascade, outerjoin]
toc: true
author_profile: false
sidebar:
    nav: "docs"
search: true
---
<hr/>

오늘은 SQLAlchemy 두 번째 실습으로 **게시판**을 만들었다. 회원, 게시글, 댓글, 좋아요를 관계로 엮는 실습이다.

지난 대학교 실습이 관계를 설계하고 조회만 하는 연습이었다면, 오늘은 좋아요를 눌렀다 취소하고 조회수를 올리는 것처럼 **상태를 바꾸는 기능**까지 짜보는 연습이었다.

## 같은 두 테이블 사이에 관계가 두 개
이 실습에서 처음 본 모양이다. 회원과 게시글은 두 가지로 이어진다.

```
Member ──1:N── Post    "이 회원이 쓴 글"          → posts / author
Member ──N:M── Post    "이 회원이 좋아요한 글"     → liked_posts / liked_by_members
```

각각 다른 `back_populates` 짝을 가진 완전히 별개의 관계다. 헷갈리기 쉬워서 `posts`(내가 쓴 글)와 `liked_posts`(내가 좋아요한 글)처럼 이름을 분명하게 짓는 게 중요하다고 했다.

## 모델
좋아요는 회원과 게시글의 N:M이라 연관 테이블을 만들었다.

```python
post_likes = Table(
    "post_likes", Base.metadata,
    Column("member_id", ForeignKey("members.id", ondelete="CASCADE"), primary_key=True),
    Column("post_id",   ForeignKey("posts.id",   ondelete="CASCADE"), primary_key=True),
    Column("created_at", DateTime, server_default=func.now(), nullable=False),
)


class Member(Base):
    __tablename__ = "members"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(20), nullable=False)
    name: Mapped[str] = mapped_column(String(20), nullable=False)

    posts:    Mapped[List["Post"]]    = relationship(back_populates="author", cascade="all, delete-orphan")
    comments: Mapped[List["Comment"]] = relationship(back_populates="author", cascade="all, delete-orphan")
    liked_posts: Mapped[List["Post"]] = relationship(secondary=post_likes, back_populates="liked_by_members")
```

| 관계 | 종류 | 캐스케이드 |
|---|---|---|
| 회원 → 자기가 쓴 글 | 1:N | `all, delete-orphan` |
| 회원 → 자기가 쓴 댓글 | 1:N | `all, delete-orphan` |
| 게시글 → 댓글 | 1:N | `all, delete-orphan` |
| 회원 ↔ 좋아요한 글 | N:M | 없음 |

캐스케이드를 어디에 걸었는지가 중요했다. 회원을 지우면 그 사람이 쓴 글과 댓글은 같이 사라져야 하지만, 좋아요는 관계만 사라지면 되지 게시글이 사라지면 안 된다. N:M에 `delete-orphan`을 걸면 좋아요를 취소했을 뿐인데 게시글까지 지워질 수 있어서 위험하다고 했다.

모델에서 눈에 띈 것도 몇 가지 있었다.

- 본문은 `String`이 아니라 `Text`를 썼다. `String(n)`은 `VARCHAR(n)`이라 길이 제한이 있어서, 길이를 모르는 글은 `Text`로 둔다.
- 조회수 `view_cnt`에는 `server_default="0"`과 `default=0`을 둘 다 줬다. `server_default`는 DB의 `DEFAULT 0`이 되고, `default`는 파이썬에서 `Post()`를 만든 순간부터 `0`이 들어 있게 해준다. `default`가 없으면 commit 전까지 `None`이라 `post.view_cnt + 1`에서 에러가 난다.

## ondelete="CASCADE"까지 건 이유
거의 모든 외래키에 `ondelete="CASCADE"`를 달았다. 첫날 배운 ORM 캐스케이드와 DB 캐스케이드를 둘 다 건 것이다.

```
cascade="all, delete-orphan"  → ORM 이 파이썬에서 자식을 지운다
ondelete="CASCADE"            → DB 가 알아서 지운다
```

둘 다 있으면 어느 경로로 삭제해도 남는 행이 없다. 특히 `post_likes`처럼 ORM 클래스가 아닌 연관 테이블은 DB 쪽 캐스케이드가 유일한 방어선이라 반드시 있어야 한다.

## 좋아요 토글
이 실습에서 ORM의 장점이 가장 크게 느껴진 함수였다.

```python
def toggle_like(db, member_id: int, post_id: int):
    """좋아요 토글. 추가되면 True, 제거되면 False"""
    member = db.get(Member, member_id)
    post = db.get(Post, post_id)
    if not member or not post:
        return False

    if post in member.liked_posts:
        member.liked_posts.remove(post)     # 좋아요 취소 → post_likes 에서 DELETE
        db.commit()
        return False
    else:
        member.liked_posts.append(post)     # 좋아요 추가 → post_likes 에 INSERT
        db.commit()
        return True
```

`in`, `append`, `remove`가 파이썬 리스트 문법 그대로인데, SQLAlchemy가 이걸 연관 테이블의 INSERT와 DELETE로 번역해준다. SQL로 짜면 SELECT로 있는지 확인하고, 분기해서, INSERT나 DELETE를 하는 세 갈래가 된다.

다만 `post in member.liked_posts`는 그 회원이 좋아요한 글 목록을 전부 메모리로 읽어온 뒤 파이썬에서 비교한다. 좋아요가 수만 개인 회원이라면 연관 테이블에 직접 물어보는 쿼리가 맞다. 지금 규모에서는 읽기 쉬운 쪽을 택한 것이고, 읽기 쉬움과 성능 사이에서 의식하고 고르는 게 중요하다고 했다.

## 조회수 증가
```python
def increase_viewcnt(db, post_id: int):
    post = db.get(Post, post_id)
    if post:
        post.view_cnt += 1
        db.commit()
    return post
```

첫날 배운 변경 추적 그대로다. 속성을 바꾸면 commit 때 UPDATE가 나간다.

그런데 이 코드는 두 사람이 동시에 글을 열면 둘 다 `view_cnt=10`을 읽고 둘 다 `11`을 써서, 조회 2번에 1만 오른다. 실무에서는 계산을 DB에 맡긴다고 한다.

```python
db.execute(update(Post).where(Post.id == post_id).values(view_cnt=Post.view_cnt + 1))
```

이러면 `SET view_cnt = view_cnt + 1`이 되어 DB가 한 번에 처리한다.

## 중복 제거
```python
def commenters_of_post(db, post_id: int):
    """특정 게시글에 댓글 작성한 회원 목록 (중복 제거)"""
    stmt = (
        select(Member)
        .join(Comment, Member.id == Comment.author_id)
        .where(Comment.post_id == post_id)
        .distinct()
    )
    return db.scalars(stmt).all()
```

JOIN은 짝이 맞는 만큼 행을 만든다. 한 사람이 같은 글에 댓글을 세 개 달았으면 그 회원이 세 번 나온다. `.distinct()`가 그걸 하나로 줄인다. 대학교 실습에서 `.distinct()`가 빠져 있던 것과 같은 함정이다.

## 좋아요 수 집계
```python
def posts_with_like_counts(db):
    stmt = (
        select(
            Post.id,
            Post.title,
            Member.name,
            func.count(post_likes.c.member_id).label("like_cnt"),
        )
        .join(Member, Post.author_id == Member.id)                # 작성자는 반드시 있다 → INNER
        .outerjoin(post_likes, Post.id == post_likes.c.post_id)   # 좋아요는 없을 수 있다 → OUTER
        .group_by(Post.id, Member.name)
        .order_by(desc("like_cnt"), Post.id.asc())
    )
    return db.execute(stmt).all()
```

한 쿼리 안에서 `join`과 `outerjoin`을 섞어 쓴 게 핵심이었다. **반드시 있는 것은 INNER, 없을 수 있는 것은 OUTER**로 판단하는 게 집계 쿼리의 절반이라고 했다. `join`으로 좋아요를 붙이면 좋아요가 0개인 글이 목록에서 사라진다.

- `.label("like_cnt")`로 이름을 붙여두면 `desc("like_cnt")`처럼 문자열로 정렬에 쓸 수 있다.
- `Post.id.asc()`를 두 번째 정렬 기준으로 넣어서 좋아요 수가 같을 때 순서가 매번 바뀌지 않게 했다.
- 컬럼을 여러 개 골랐기 때문에 `.scalars()`가 아니라 `db.execute(stmt).all()`로 받아서 `for p_id, title, author_name, l_cnt in ...`처럼 풀어 쓴다.

## 헷갈리기 쉬운 부분
- 여러 컬럼을 고른 `select()`에 `.scalars()`를 쓰면 첫 컬럼만 남는다. 객체 하나를 받을 때만 `.scalars()`를 쓴다.
- `db.get()`은 못 찾으면 `None`이다. 함수마다 `if not member or not post: return`을 넣은 이유다.
- 연관 테이블 `post_likes`에 `created_at`이 있는데 `secondary` 방식으로 연결했다. 그래서 `member.liked_posts`로는 "언제 좋아요를 눌렀는지"를 읽을 수 없다. 그 값을 화면에 보여줘야 한다면 중간 표를 클래스로 만드는 Association Object로 바꿔야 한다.

## 오늘 배운 내용 정리
오늘은 게시판 실습으로 상태를 바꾸는 기능을 관계 위에서 짜봤다.

```
관계 두 개: 회원-게시글 사이에 1:N(작성)과 N:M(좋아요)이 따로 걸린다. 이름을 분명하게.
캐스케이드: 글·댓글은 all, delete-orphan. N:M 좋아요에는 걸지 않는다.
ondelete="CASCADE": DB 쪽 방어선. 연관 테이블에는 꼭 필요하다.
좋아요 토글: if post in member.liked_posts → remove / append. 리스트 문법이 INSERT, DELETE 가 된다.
조회수: post.view_cnt += 1. 동시 접속까지 생각하면 update(...).values(view_cnt=Post.view_cnt + 1).
중복 제거: JOIN 하면 행이 늘어난다. 목록이면 .distinct().
집계: 반드시 있는 것은 join, 없을 수 있는 것은 outerjoin.
결과 받기: 컬럼 여러 개면 .scalars() 없이 Row 로 받아서 언패킹.
```

좋아요 토글을 파이썬 리스트 다루듯이 짤 수 있다는 게 ORM을 쓰는 이유를 가장 잘 보여줬다.

이 `main.py`의 함수들이 다음 단원에서 FastAPI 라우터의 본문이 되고, `db` 인자는 `Depends(get_db)`가 채워준다고 한다.

---
