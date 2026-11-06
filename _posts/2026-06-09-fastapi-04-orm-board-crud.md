---
layout: single
title: "FastAPI 기초 정리 4 - SQLAlchemy ORM으로 게시판 CRUD API 만들기"
categories: [coding, FastAPI]
tag: [study-log, FastAPI, SQLAlchemy, ORM, Pydantic, CRUD, REST-API, Depends]
toc: true
author_profile: false
sidebar:
    nav: "docs"
search: true
---
<hr/>

오늘 오후에는 그동안 배운 것을 합쳐서 **게시판 CRUD API**를 만들었다. 지금까지 만든 API는 데이터를 만들어내거나 그대로 돌려주기만 해서, 서버를 끄면 다 사라졌다. 진짜 서비스는 저장이 필요하다.

지난주 SQLAlchemy 실습에서 `databases.py`, `models.py`, `main.py`로 파일을 나눴을 때 "이게 FastAPI 프로젝트의 골격이고, 여기에 요청·응답 형식과 라우터가 얹힌다"고 했는데, 오늘 정말로 그 모양이 완성됐다.

## 다섯 파일의 역할
```
Board/
├── main.py          앱을 조립하고 띄운다
├── database.py      DB 에 연결한다 (엔진, 세션, Base)
├── models.py        DB 테이블의 모양 (SQLAlchemy)
├── schemas.py       API 입출력의 모양 (Pydantic)
└── controllers.py   실제 CRUD 로직 (APIRouter)
```

어제 배운 `APIRouter`로 파일을 나누는 게 여기서 본격적으로 쓰였다. 이 다섯 개가 FastAPI 프로젝트의 사실상 표준 구조라서 어느 회사 코드를 봐도 비슷하다고 한다.

## database.py - 연결
```python
import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

load_dotenv()

DB_USER     = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_HOST     = os.getenv("DB_HOST", "localhost")
DB_PORT     = os.getenv("DB_PORT", "3306")
DB_NAME     = os.getenv("DB_NAME")

DATABASE_URL = f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

engine       = create_engine(DATABASE_URL, echo=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base         = declarative_base()
```

| 이름 | 무엇 | 몇 개 |
|---|---|---|
| `engine` | DB 로 가는 연결 통로 (연결 풀) | 앱 전체에 하나 |
| `SessionLocal` | 세션을 찍어내는 공장 | 앱 전체에 하나 |
| `session` | 작업 하나 동안 쓰는 대화창 | 요청마다 하나 |

`echo=True`를 켜두면 ORM이 만드는 SQL이 터미널에 전부 찍혀서, 배우는 동안 파이썬 한 줄이 어떤 SQL이 되는지 눈으로 볼 수 있다. 비밀번호를 코드에 박지 않고 `.env`로 뺀 것도 오늘 오전에 배운 비밀키 이야기와 이어졌다.

## get_db - yield를 쓰는 의존성
```python
def get_db():
    db = SessionLocal()
    try:
        yield db          # 엔드포인트에 넘겨주고
    finally:
        db.close()        # 끝나면 반드시 닫는다
```

어제 배운 `Depends`의 두 번째 형태(재료 공급)인데, `return`이 아니라 `yield`를 쓴다.

```
요청 도착
  → SessionLocal() 로 세션을 만든다
  → yield 로 엔드포인트에 넘긴다
  → 엔드포인트가 실행되고 응답을 보낸다
  → finally 로 돌아와 db.close()
```

`finally` 안에 있어서 엔드포인트에서 예외가 나도 세션이 반드시 닫힌다. 세션을 안 닫으면 연결이 쌓이다가 결국 DB가 접속을 거부한다. `with open(...) as f:`처럼 열었으면 반드시 닫는다는 발상이다.

SQLAlchemy 실습 때 함수들이 전부 `db`를 첫 번째 인자로 받던 게, 여기서 `db: Session = Depends(get_db)`로 FastAPI가 채워주는 모양이 됐다.

## models.py - 테이블의 모양
```python
class Post(Base):
    __tablename__ = "r_post"

    id:      Mapped[int]      = mapped_column(Integer, primary_key=True, index=True)
    user:    Mapped[str]      = mapped_column(String(20),  nullable=False, comment="게시글 작성자")
    subject: Mapped[str]      = mapped_column(String(200), nullable=False, comment="게시글 제목")
    content: Mapped[str]      = mapped_column(Text,        nullable=True,  comment="게시글 내용")
    viewcnt: Mapped[int]      = mapped_column(Integer,     default=0,      comment="게시글 조회수")
    regdate: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), comment="게시글 작성일시")
```

클래스 하나가 테이블 하나, 속성 하나가 칼럼 하나다. 작성일시는 파이썬 쪽 `default`가 아니라 DB가 직접 현재 시각을 넣는 `server_default=func.now()`를 썼다. 서버가 여러 대면 시계가 조금씩 다를 수 있어서 DB 시계를 기준으로 하는 게 안전하다.

## schemas.py - API 입출력의 모양
이 프로젝트에서 가장 중요한 개념이었다.

```python
class PostCreate(BaseModel):        # 글 쓸 때 받을 것
    user: str
    subject: str
    content: Optional[str] = None

class PostResponse(BaseModel):      # 응답으로 보낼 것
    id: int
    user: str
    subject: str
    content: Optional[str]
    viewcnt: int
    regdate: datetime

    @field_serializer("regdate")
    def serialize_datetime(self, dt: datetime, _info):
        return dt.strftime("%Y-%m-%d %H:%M:%S")

class PostUpdate(BaseModel):        # 수정할 때 받을 것
    subject: str
    content: Optional[str] = None
```

| | `models.Post` | `schemas.PostCreate` / `PostResponse` |
|---|---|---|
| 정체 | SQLAlchemy 모델 | Pydantic 모델 |
| 나타내는 것 | DB 테이블의 모양 | API 입출력의 모양 |

모델과 스키마를 나누는 이유는 상황마다 필요한 필드가 다르기 때문이다. 글을 쓸 때는 `id`, `viewcnt`, `regdate`를 받으면 안 되고(DB가 정한다), 응답할 때는 전부 보여주고, 수정할 때는 제목과 내용만 받는다. 어제 배운 "입력 모델과 출력 모델은 보통 나눈다"가 그대로 나왔다.

`@field_serializer`는 날짜를 JSON으로 바꿀 때 모양을 정한다. 기본은 `"2026-06-09T14:30:00"` 같은 ISO 형식인데, 화면에 그대로 뿌릴 수 있게 `"2026-06-09 14:30:00"`으로 바꿔서 보낸다.

## controllers.py - CRUD
```python
router = APIRouter(prefix="/api")

# 목록
@router.get("/board", response_model=list[schemas.PostResponse])
def get_posts(db: Session = Depends(database.get_db)):
    return db.scalars(select(models.Post).order_by(desc(models.Post.regdate))).all()

# 작성
@router.post("/board", response_model=schemas.PostResponse)
def create_post(post: schemas.PostCreate, db: Session = Depends(database.get_db)):
    db_post = models.Post(**post.model_dump())   # Pydantic → SQLAlchemy
    db.add(db_post)
    db.commit()
    db.refresh(db_post)
    return db_post
```

| 호출 | 하는 일 |
|---|---|
| `db.add()` | "이거 저장할 거야"라고 세션에 등록만 한다 |
| `db.commit()` | 실제로 INSERT 를 실행하고 확정한다 |
| `db.refresh()` | DB 가 채워준 값(`id`, `regdate`)을 다시 읽어온다 |

`refresh()`가 없으면 `db_post.id`가 비어 있다. id는 DB가 정하기 때문이다. `models.Post(**post.model_dump())`는 Pydantic 객체를 딕셔너리로 바꿔서 SQLAlchemy 모델 생성자에 풀어 넣는 것으로, 두 세계를 잇는 다리 역할이다.

```python
# 한 건 읽기 + 조회수 증가
@router.get("/board/{id}", response_model=schemas.PostResponse)
def get_post(id: int, db: Session = Depends(database.get_db)):
    post = db.get(models.Post, id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    post.viewcnt += 1          # 속성만 바꿨는데
    db.commit()                # UPDATE 가 나간다
    return post

# 수정
@router.put("/board/{id}")
def update_post(id: int, post_update: schemas.PostUpdate, db: Session = Depends(database.get_db)):
    db_post = db.get(models.Post, id)
    if not db_post:
        raise HTTPException(404, "Post not found")
    db_post.subject = post_update.subject
    db_post.content = post_update.content
    db.commit()
    return {"message": "Updated successfully"}

# 삭제
@router.delete("/board/{id}")
def delete_post(id: int, db: Session = Depends(database.get_db)):
    db_post = db.get(models.Post, id)
    if not db_post:
        raise HTTPException(404, "Post not found")
    db.delete(db_post)
    db.commit()
    return {"message": "Deleted successfully"}
```

`post.viewcnt += 1`은 SQLAlchemy 첫날 배운 변경 추적 그대로다. SQL을 한 줄도 안 썼는데 세션이 바뀐 속성을 기억하고 있다가 commit 때 UPDATE를 만든다.

| 메서드 | 경로 | 하는 일 |
|---|---|---|
| GET | `/api/board` | 목록 |
| POST | `/api/board` | 작성 |
| GET | `/api/board/{id}` | 한 건 읽기 |
| PUT | `/api/board/{id}` | 수정 |
| DELETE | `/api/board/{id}` | 삭제 |

경로는 두 개뿐이고 메서드로 다섯 가지를 구분한다. 첫날 배운 HTTP 메서드가 여기서 제대로 쓰였다.

## main.py - 조립
```python
app = FastAPI(title="게시판CRUD")

models.Base.metadata.create_all(database.engine)   # 테이블이 없으면 만든다
app.include_router(controllers.router)
```

`create_all()`은 `Base`를 상속한 모델을 보고 없는 테이블을 만들어준다. 이미 있는 테이블의 구조는 안 바꿔서, 칼럼을 추가해도 DB에는 반영되지 않는다. 학습 단계에서는 테이블을 지우고 다시 띄우는 게 가장 빠르고, 실무에서는 Alembic 같은 마이그레이션 도구를 쓴다.

## 왜 이렇게 나누나
```
[요청] → controllers  (HTTP 를 아는 층)
            ↓
         schemas      (모양을 검사하는 층)
            ↓
         models       (DB 를 아는 층)
            ↓
        [MySQL]
```

각 층이 자기 일만 하니까, DB를 바꿔도 `database.py`만, 응답 형식을 바꿔도 `schemas.py`만 고치면 된다. 테스트할 때도 `get_db`만 가짜로 바꿔치기하면 DB 없이 돌릴 수 있다고 한다. 규모가 더 커지면 `controllers`에서 비즈니스 로직(`services`)과 DB 접근(`crud`)을 또 나눈다고 하는데, 지금 단계에서는 과하다고 했다.

## 헷갈리기 쉬운 부분
- 실습 코드의 스키마에 `class Config: from_attribute = True`가 있었는데, 올바른 이름은 복수형 `from_attributes`다. 지금 상태로는 아무 의미 없는 변수 하나를 만든 것이라 설정이 안 걸린다. Pydantic v2에서는 `model_config = ConfigDict(from_attributes=True)`로 쓴다. 이 설정은 Pydantic이 딕셔너리뿐 아니라 객체의 속성(`.subject`)에서도 값을 읽게 해준다. `response_model`로 응답할 때는 FastAPI가 알아서 처리해줘서 이게 틀려도 API는 돌아갔다.
- 실습 코드의 작성(`POST`) 엔드포인트에는 `response_model`이 빠져 있었다. 그러면 나중에 모델에 비밀번호 같은 필드가 생겼을 때 그대로 응답에 나가고, 날짜 형식도 목록 응답과 달라진다. 위 코드는 `response_model=schemas.PostResponse`를 붙인 모양이다.
- 실습 코드의 `PostUpdate`에는 `id`도 있었는데, 수정할 글은 경로의 `{id}`로 찾고 있어서 바디의 `id`는 아무 데도 안 쓰였다. 그런데 필수 필드라 안 보내면 422가 나고, `PUT /api/board/5`에 바디로 `{"id": 999, ...}`를 보내면 에러 없이 5번 글이 수정된다. **같은 정보를 두 군데서 받으면 반드시 어긋난다**고 해서, 위 코드처럼 바디에서 `id`를 뺐다.
- `from sqlalchemy.ext.declarative import declarative_base`는 1.x 시절 위치라 경고가 뜬다. 2.0에서는 `from sqlalchemy.orm import declarative_base`다.
- `import models, database, controllers`처럼 가져오기 때문에 `Board` 폴더 안에서 `uvicorn main:app --reload`를 실행해야 한다.
- `.env`는 git에 올리지 않으니, 저장소를 새로 받으면 직접 만들어야 한다. 없으면 접속 주소가 `None:None@...`이 되어 연결부터 실패한다.
- `Session`은 동기 객체라서 엔드포인트도 `def`로 썼다. 오늘 오전에 배운 대로 `async def` 안에서 쓰면 이벤트 루프를 막는다. 비동기로 가려면 `AsyncSession`으로 전부 바꿔야 하고, 섞는 게 가장 나쁘다.

## 오늘 배운 내용 정리
오늘 오후에는 SQLAlchemy ORM과 FastAPI를 합쳐서 게시판 CRUD API를 만들었다.

```
파일 구조: main / database / models / schemas / controllers.
database.py: .env 로 접속 정보. engine 은 하나, 세션은 요청마다 하나.
get_db: yield + finally. 응답이 끝나면 세션을 반드시 닫는다.
models: DB 테이블의 모양 (SQLAlchemy). 작성일시는 server_default=func.now().
schemas: API 입출력의 모양 (Pydantic). 작성 / 응답 / 수정용을 따로 만든다.
작성: add → commit → refresh. refresh 를 빼면 id 가 비어 있다.
조회수: post.viewcnt += 1 + commit. 변경 추적이 UPDATE 를 만든다.
REST: 경로 두 개(/api/board, /api/board/{id}) + 메서드 다섯 개.
response_model: 응답 엔드포인트마다 붙인다. 필드를 거르고 모양을 맞춘다.
같은 정보는 한 곳에서만: 경로의 id 와 바디의 id 를 같이 받지 않는다.
```

며칠 동안 배운 FastAPI(라우팅, Pydantic, response_model, APIRouter, Depends)와 그 전에 배운 SQLAlchemy가 오늘 하나의 프로젝트로 합쳐졌다. 따로 배울 때는 조각 같았는데, 다섯 개 파일로 나눠놓고 보니 각자 어디에 들어가는지가 보였다.

다음 단원은 React이고, 이 API를 화면과 연결하는 데까지 이어진다.

---
