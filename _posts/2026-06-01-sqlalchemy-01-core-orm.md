---
layout: single
title: "SQLAlchemy 기초 정리 1 - Core와 ORM, 그리고 관계 매핑"
categories: [coding, SQLAlchemy]
tag: [study-log, SQLAlchemy, ORM, Python, MySQL, Session, relationship]
toc: true
author_profile: false
sidebar:
    nav: "docs"
search: true
---
<hr/>

오늘부터 SQLAlchemy를 배웠다. Database 시간에는 PyMySQL로 커서를 열고 SQL 문자열을 직접 넘겼는데, SQLAlchemy는 그 SQL을 파이썬 객체로 다룰 수 있게 해주는 라이브러리다.

오늘은 Core 기초, Core로 데이터 다루기, ORM 시작하기, ORM 관계 매핑까지 네 파트를 나갔다. 관계 매핑은 분량이 많아서 다음 날 오전까지 이어서 마무리했다.

## 왜 SQLAlchemy를 쓰나
PyMySQL로 SQL 문자열을 직접 던지면 이런 문제가 계속 생긴다.

```
연결을 닫는 걸 잊는다.
f-string 으로 SQL 을 조립하다가 SQL 인젝션에 뚫린다.
MySQL 문법으로 짠 SQL 이 다른 DB 에서 안 돈다.
테이블 구조가 SQL 파일에만 있어서 파이썬 코드와 따로 논다.
```

SQLAlchemy는 이 네 가지를 각각 Engine과 Connection, 값 바인딩, 방언(dialect) 처리, MetaData로 해결한다.

## Engine과 Connection
Engine은 연결을 빌려주는 창구이고, 실제로 SQL을 실행하는 건 Connection이다. 콜센터와 상담원 관계로 생각하면 된다. 전화를 거는 건 콜센터가 아니라 상담원이다.

```python
from sqlalchemy import create_engine, text

engine = create_engine("mysql+pymysql://user:pw@localhost:3306/mydb?charset=utf8mb4", echo=True)

with engine.connect() as conn:          # with 를 벗어나면 연결이 풀로 반환된다
    result = conn.execute(text("SELECT 1"))
    print(result.scalar())
```

DB 접속은 로그인하고 세션을 만드는 비싼 작업이라, 미리 연결 몇 개를 만들어 두고 돌려 쓴다. 이 보관함이 **연결 풀**이고 Engine이 관리한다. 그래서 Engine은 앱에 하나만 만들고, Connection은 작업마다 새로 빌린다.

- `create_engine()`은 그 자리에서 접속하지 않는다. 실제 접속은 `connect()`를 처음 부를 때 일어난다.
- URL은 `방언+드라이버://아이디:비번@호스트:포트/DB이름` 형식이다. `mysql+pymysql`은 "MySQL 문법 + PyMySQL로 통신"이라는 뜻이다.
- `echo=True`는 실행되는 SQL을 화면에 찍어준다. 공부할 때는 켜두고 실제 서비스에서는 끈다.
- `pool_pre_ping=True`는 연결을 꺼낼 때 살아 있는지 확인하는 옵션이다. MySQL은 오래 쉬는 연결을 끊어버리기 때문에 실무에서는 거의 항상 켠다고 한다.

## 2.0에서는 커밋을 직접 해야 한다
수업에서 가장 강조한 부분이다.

```python
with engine.connect() as conn:
    conn.execute(text("INSERT INTO users (name) VALUES ('Alice')"))
# 끝. 그런데 DB 에는 아무것도 없다.
```

1.x 버전에 있던 자동 커밋이 2.0에서 없어졌다. 그래서 방법이 두 가지다.

```python
# ① 중간중간 내가 커밋
with engine.connect() as conn:
    conn.execute(text("INSERT INTO users (name) VALUES ('Alice')"))
    conn.commit()

# ② 블록 전체를 한 트랜잭션으로 (공식 권장)
with engine.begin() as conn:
    conn.execute(text("INSERT INTO users (name) VALUES ('Alice')"))
    conn.execute(text("INSERT INTO users (name) VALUES ('Bob')"))
    # 정상 종료 → 자동 COMMIT / 예외 발생 → 자동 ROLLBACK
```

`connect()`와 `begin()`, 글자 하나 차이인데 결과가 완전히 다르다. 헷갈리면 그냥 `begin()`을 쓰기로 했다.

## 결과는 한 번만 꺼낼 수 있다
`execute()`가 돌려주는 `Result`는 저장된 리스트가 아니라 한 번 지나가면 끝인 물줄기 같은 것이다.

```python
result = conn.execute(text("SELECT id, name FROM users"))

result.all()             # 모든 행
result.one()             # 정확히 한 행 (0개나 2개면 예외)
result.first()           # 첫 행만
result.scalar()          # 첫 행의 첫 칸 값 하나
```

이걸 연달아 부르면 두 번째부터는 빈 결과가 나온다. 다시 쓸 거면 `rows = result.all()`로 먼저 받아둔다. 각 행은 `row.id`, `row.name`처럼 속성으로 꺼낼 수 있고, 딕셔너리처럼 쓰고 싶으면 `result.mappings()`를 쓴다.

## text()와 값 바인딩
SQLAlchemy는 그냥 문자열을 SQL로 실행해주지 않는다. `text()`로 감싸서 "이건 내가 의도한 SQL이 맞다"고 표시해야 한다. 값은 반드시 `:이름` 자리에 바인딩으로 넘긴다.

```python
# 절대 금지 — SQL 인젝션
user_input = "Alice' OR '1'='1"
text(f"SELECT * FROM users WHERE name = '{user_input}'")

# 올바른 방법
stmt = text("SELECT * FROM users WHERE name = :name")
conn.execute(stmt, {"name": "Alice"})

# 여러 행이면 딕셔너리 리스트
conn.execute(
    text("INSERT INTO users (name, age) VALUES (:name, :age)"),
    [{"name": "Alice", "age": 30}, {"name": "Bob", "age": 25}],
)
```

## MetaData로 테이블 구조를 파이썬에 적기
테이블 설계도를 SQL 파일이 아니라 파이썬 객체로 들고 있는 방법이다.

```python
from sqlalchemy import MetaData, Table, Column, Integer, String, DateTime, func

metadata = MetaData()

users = Table(
    "users", metadata,
    Column("id", Integer, primary_key=True),
    Column("name", String(50), index=True),
    Column("email", String(120), unique=True, nullable=False),
    Column("created_at", DateTime, server_default=func.now()),
)

metadata.create_all(engine)     # 등록된 테이블 전부 생성
metadata.drop_all(engine)       # 외래키 순서를 알아서 지켜서 삭제
```

`create_all()`은 여러 번 호출해도 안전하다. 이미 있는 테이블은 건너뛴다. 대신 이미 있는 테이블은 **절대 고치지 않는다.** 모델에 컬럼을 하나 추가해도 DB에는 반영되지 않아서, 실무에서는 Alembic 같은 마이그레이션 도구로 스키마를 바꾼다고 한다.

## Core로 SQL을 객체처럼 조립하기
이 파트를 이해하는 열쇠는 이 한 줄이었다.

```python
print(users.c.name == "Alice")     # users.name = :name_1
```

`True`나 `False`가 아니라 SQL 조각이 찍힌다. 컬럼 객체가 `==` 연산자를 다시 정의해서, 비교식을 쓰면 SQL 조건 객체가 만들어지는 것이다. `.c`는 `columns`의 줄임말로 테이블이 가진 컬럼 모음이다.

이게 이해되면 나머지는 응용이다.

```python
from sqlalchemy import select, insert, update, delete, func, or_

# INSERT
conn.execute(insert(users), [{"name": "Alice"}, {"name": "Bob"}])

# SELECT — 조건을 여러 개 주면 AND 로 묶인다
stmt = (
    select(users.c.name, users.c.email)
    .where(users.c.email.like("%example.com%"))
    .order_by(users.c.created_at.desc())
    .limit(5)
)
rows = conn.execute(stmt).all()

# OR 는 명시해야 한다
select(users).where(or_(users.c.age < 20, users.c.age > 60))

# UPDATE / DELETE
conn.execute(update(users).where(users.c.id == 1).values(email="new@x.com"))
conn.execute(delete(users).where(users.c.id == 2))
```

| 파이썬 | SQL |
|---|---|
| `users.c.id.in_([1, 2, 3])` | `id IN (1, 2, 3)` |
| `users.c.name.like("A%")` | `name LIKE 'A%'` |
| `users.c.email.is_(None)` | `email IS NULL` |
| `users.c.id.between(1, 10)` | `id BETWEEN 1 AND 10` |

JOIN과 GROUP BY도 Database 시간에 배운 SQL과 그대로 대응된다.

```python
stmt = (
    select(users.c.name, func.count(addresses.c.id).label("cnt"))
    .outerjoin(addresses)              # 외래키가 있으면 조인 조건을 알아서 찾는다
    .group_by(users.c.id)
    .having(func.count(addresses.c.id) > 2)
)
```

주소가 없는 사용자도 0개로 보이게 하려면 `join()`이 아니라 `outerjoin()`을 써야 한다. WHERE는 묶기 전에 행을 거르고, HAVING은 묶은 뒤 그룹을 거른다는 것도 다시 정리했다.

문자열 SQL보다 좋은 점이 가장 크게 느껴진 건 조건을 상황에 따라 붙일 때였다.

```python
stmt = select(users)
if keyword:
    stmt = stmt.where(users.c.name.like(f"%{keyword}%"))
if only_active:
    stmt = stmt.where(users.c.is_active == True)
```

`.where()`는 원본을 고치지 않고 새 객체를 돌려주기 때문에 `stmt = stmt.where(...)`처럼 다시 받아야 한다. 그리고 `.where()` 없는 UPDATE와 DELETE는 모든 행을 바꾸거나 지운다. 실행 전에 `print(stmt)`로 한 번 확인하는 습관을 들이라고 했다.

## ORM 시작하기
ORM은 Core를 대체하는 게 아니라 Core 위에 얹힌 것이다. `select()`, `where()`, `join()`은 그대로 쓰고 바뀌는 건 이 정도다.

| | Core | ORM |
|---|---|---|
| 테이블 | `Table("users", metadata, ...)` | `class User(Base)` |
| 컬럼 참조 | `users.c.name` | `User.name` |
| 실행 | `conn.execute(stmt)` | `session.execute(stmt)` |
| 결과 | `Row` | `User` 객체 |

2.0 스타일 모델은 이렇게 선언한다.

```python
from sqlalchemy import String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

class Base(DeclarativeBase):
    pass

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(50))
    description: Mapped[str | None]      # | None 이 있으면 NULL 허용
```

- `Base`는 앱 전체에 하나만 만든다. 모델들이 같은 MetaData를 공유해야 외래키가 연결된다.
- 타입 힌트만 적으면 SQL 타입과 NULL 여부가 따라온다. `| None`이 있으면 NULL 허용, 없으면 NOT NULL이다.
- MySQL은 길이 없는 VARCHAR를 만들 수 없어서 문자열 컬럼에는 `String(50)`처럼 길이를 붙인다.

검색하다 보면 `Column(Integer, primary_key=True)` 같은 예제가 많이 나오는데, 이건 1.x 방식이다. `Column(`이 보이면 1.x, `Mapped[`가 보이면 2.0이라고 구분하면 된다고 했다.

## Session은 작업대다
Session은 DB에서 꺼낸 객체를 올려두는 작업대다. 무엇이 바뀌었는지 지켜보다가 `commit()` 할 때 필요한 SQL만 골라서 내보낸다.

```python
from sqlalchemy.orm import sessionmaker

SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)

# Create
with SessionLocal.begin() as db:            # 블록이 끝나면 자동 commit
    db.add(User(name="Alice"))

# Read / Update / Delete
with SessionLocal.begin() as db:
    user = db.get(User, 1)                  # 기본키로 하나 찾기
    user.name = "Alice Smith"               # 이것만으로 UPDATE 가 나간다
    users = db.scalars(select(User).where(User.name.like("A%"))).all()
    db.delete(users[0])
```

속성만 바꿨는데 commit 때 UPDATE가 나가는 게 신기했다. Core에서는 읽어온 값과 수정용 SQL이 따로 놀아서 `values()`에 필드를 다시 나열해야 했는데, ORM은 **읽어온 객체를 고치는 것이 곧 UPDATE**다.

`.scalars()`를 붙이는 이유도 정리했다. `db.execute(select(User))`의 결과는 각 행이 `(User,)`라는 한 칸짜리 튜플로 나온다. `.scalars()`가 그 첫 칸을 미리 풀어준다. 반대로 `select(User.id, User.name)`처럼 컬럼을 여러 개 고를 때는 `.scalars()`를 쓰면 첫 컬럼만 남아서 안 된다.

## with 밖으로 객체를 들고 나가면 안 된다
```python
with SessionLocal() as db:
    user = db.get(User, 1)
print(user.name)        # with 를 벗어나면 위험하다
```

Session이 닫히면 객체는 추적이 끊긴 상태(Detached)가 된다. 이때 아직 안 읽은 속성에 접근하면 `DetachedInstanceError`가 난다. 필요한 값은 `with` 안에서 꺼내 쓰거나, `expire_on_commit=False`를 켜둔다. 기본값 `True`면 commit 뒤에 모든 속성이 만료돼서 다시 DB에서 읽어오기 때문이다.

`flush()`와 `commit()`의 차이도 배웠다. `flush()`는 변경을 SQL로 보내기만 하고 아직 확정하지 않는다. 커밋 전에 자동 증가된 id가 필요할 때 쓴다.

## 관계 매핑
외래키와 `relationship()`은 층이 다르다.

| | 있는 곳 | 하는 일 |
|---|---|---|
| `ForeignKey("users.id")` | 데이터베이스 | 실제 컬럼과 제약조건 |
| `relationship()` | 파이썬 | 객체끼리 연결. DB 에 컬럼을 만들지 않는다 |

둘 다 있어야 하고, 외래키는 언제나 "여러 개" 쪽에 있다. Database 시간에 배운 "1:N의 외래키는 N쪽에"와 같은 이야기다.

```python
from typing import List
from sqlalchemy import ForeignKey
from sqlalchemy.orm import relationship

class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(50))

    posts: Mapped[List["Post"]] = relationship(
        back_populates="author",
        cascade="all, delete-orphan",
    )

class Post(Base):
    __tablename__ = "posts"
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))

    author: Mapped["User"] = relationship(back_populates="posts")
```

관계를 걸기 전에는 글을 쓰려면 `flush()`로 사용자 id를 먼저 얻고 `user_id`를 손으로 채워야 했다. 관계를 걸면 이렇게 끝난다.

```python
with SessionLocal.begin() as db:
    alice = User(name="Alice")
    alice.posts.append(Post(title="첫 글"))    # flush 도 user_id 도 필요 없다
    db.add(alice)                              # Post 도 함께 INSERT 된다
```

- `back_populates`에는 **상대편 속성 이름**을 적는다. 양쪽에 걸어두면 `alice.posts.append(post)`만 해도 `post.author`가 자동으로 채워진다.
- `Mapped[List["Post"]]`면 여러 개, `Mapped["User"]`면 하나다. 타입 힌트가 관계의 방향을 정한다.
- `cascade="all, delete-orphan"`을 걸면 사용자를 지울 때 글도 함께 지워진다. 안 걸면 글이 남아 있는 사용자는 삭제가 거부되는 게 기본 동작이다.

### 관계 속성에 접근하면 쿼리가 나간다
```python
user = db.scalar(select(User).where(User.name == "Alice"))
print(user.posts)      # 이 줄에서 SELECT 가 한 번 더 나간다
```

`user.posts`에 접근하는 순간 SELECT가 따로 실행된다. 이걸 **lazy loading**이라고 한다. 사용자 100명을 조회한 뒤 각자의 글 목록을 찍으면 SELECT가 100번 더 나가서 총 101번이 되는데, 이게 유명한 **N+1 문제**다. 해결 방법은 다음 파트에서 배운다고 하고, 지금은 "관계 속성 한 줄이 SELECT 하나"라는 것만 기억해두기로 했다.

### 1:1, N:M, 자기 참조
Database 시간에 배운 세 가지 관계가 ORM에서는 이렇게 표현된다.

- **1:1**: 1:N에서 외래키 컬럼에 `unique=True`를 붙이고, 파이썬 쪽은 리스트가 아닌 단일 타입으로 둔다.
- **N:M**: 중간 표를 Core의 `Table`로 만들고 `relationship(secondary=중간표)`로 연결한다. 중간 표에 가입일 같은 정보가 더 필요하면 중간 표를 클래스로 만드는 Association Object 방식을 쓴다.
- **자기 참조**: 카테고리 트리나 댓글의 답글처럼 같은 테이블 안에서 부모를 가리키는 경우다. 어느 쪽이 상대편인지 알려주려고 `remote_side=[id]`를 붙인다.

```python
user_group = Table(
    "user_group", Base.metadata,
    Column("user_id",  ForeignKey("users.id"),  primary_key=True),
    Column("group_id", ForeignKey("groups.id"), primary_key=True),
)

class User(Base):
    groups: Mapped[List["Group"]] = relationship(secondary=user_group, back_populates="users")
```

중간 표에 나중에 컬럼이 필요해지는 일이 실무에서 정말 흔해서, 애매하면 처음부터 Association Object로 가라고 했다.

## 헷갈리기 쉬운 부분
- `engine.connect()`만 쓰고 커밋을 안 하면 아무 에러 없이 조용히 사라진다.
- 조건에 파이썬의 `and`, `or`를 쓰면 안 된다. `and_()`, `or_()`나 `&`, `|`를 쓰고, `&`와 `|`는 `(a == 1) & (b == 2)`처럼 조건마다 괄호로 감싸야 한다.
- `__table_args__`는 튜플이어야 한다. 요소가 하나여도 `(CheckConstraint(...),)`처럼 콤마를 붙인다.
- `.scalars()`를 빼먹으면 `User` 대신 `Row`가 나온다. `row[0]`을 치고 있다면 빠뜨린 것이다.
- `with` 밖에서 `user.posts`에 접근하면 lazy loading을 할 Session이 없어서 `DetachedInstanceError`가 난다.
- MySQL에서 `groups`는 예약어에 가까워서 `SELECT * FROM groups;`가 실패한다. 백틱을 붙이거나 처음부터 `user_groups`처럼 이름을 짓는 게 편하다.

## 오늘 배운 내용 정리
오늘은 SQLAlchemy의 Core와 ORM, 관계 매핑을 배웠다.

```
Engine: 연결 풀을 관리하는 창구. 앱에 하나. SQL 은 Connection 이 실행한다.
2.0: 자동 커밋이 없다. conn.commit() 을 부르거나 engine.begin() 을 쓴다.
text(): raw SQL. 값은 :이름 + 딕셔너리로 바인딩. f-string 금지.
Core: select / insert / update / delete 로 SQL 을 조립. users.c.name == "A" 는 SQL 조각.
ORM: class User(Base) + Mapped[T] + mapped_column(). Mapped[T | None] 이면 NULL 허용.
Session: 객체를 올려두면 바뀐 속성만 UPDATE. 객체는 .scalars() 로 받는다.
relationship: 외래키 위에 객체 연결. 양방향이면 back_populates, 부모 삭제는 cascade.
lazy loading: 관계 속성에 접근하면 SELECT 가 나간다. 반복문 안이면 N+1.
```

PyMySQL로 할 때는 SQL과 파이썬 코드가 따로 놀았는데, SQLAlchemy는 그 둘을 하나로 이어주는 도구라는 느낌이었다.

하루에 네 파트를 나가서 양이 많았지만, 결국 Database 시간에 배운 SQL과 관계 설계가 파이썬 문법으로 옮겨온 것이라 낯설지는 않았다.

---
