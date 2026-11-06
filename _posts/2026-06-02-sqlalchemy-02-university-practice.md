---
layout: single
title: "SQLAlchemy 기초 정리 2 - 대학교 실습으로 요구사항을 모델로 옮기기"
categories: [coding, SQLAlchemy]
tag: [study-log, SQLAlchemy, ORM, relationship, many-to-many, dotenv, outerjoin]
toc: true
author_profile: false
sidebar:
    nav: "docs"
search: true
---
<hr/>

어제 SQLAlchemy의 Core와 ORM, 관계 매핑을 배웠고, 오늘은 그걸 가지고 첫 실습을 했다. 주제는 **대학교**였다.

어제까지는 `User`, `Post`처럼 이미 정해진 예제를 따라 쳤다면, 오늘은 반대로 **말로 된 요구사항을 받아서 모델을 직접 설계**하는 연습이었다. 실무에서 실제로 하는 일이 이쪽이라고 한다.

## 파일을 네 개로 나누기
노트북 한 파일에 다 쓰지 않고 역할별로 파일을 나눴다. 각 파일이 바뀌는 이유가 다르기 때문이다.

| 파일 | 역할 | 언제 바뀌나 |
|---|---|---|
| `databases.py` | 접속 정보, `engine`, `SessionLocal` | 서버나 비밀번호가 바뀔 때 |
| `models.py` | `Base` 와 모델 클래스 | 테이블 구조를 바꿀 때 |
| `samples.py` | 테스트 데이터 넣기 | 실험 데이터가 바뀔 때 |
| `main.py` | 실제 조회 함수 | 기능을 더할 때 |

이 구성이 다음 단원에서 배울 FastAPI 프로젝트의 기본 골격과 같다고 한다. 거기서 요청과 응답 형식(`schemas.py`)과 라우터가 얹힌다.

비밀번호는 Database 시간처럼 `.env` 파일에 따로 적고 `load_dotenv()`로 읽었다.

```python
import os
from dotenv import load_dotenv

load_dotenv()                              # .env 를 읽어 환경변수로 올린다
DB_PASSWORD = os.getenv("DB_PASSWORD")
```

`.env`가 없으면 값이 전부 `None`이 되어 접속 주소가 `mysql+pymysql://None:None@None:None/None`이 된다. 에러 메시지에는 접속 실패로만 나와서 원인을 찾기 어려우니, 접속이 안 되면 `.env`부터 확인하라고 했다.

## 요구사항
```
학과: id, 학과이름
학생: id, 학생이름, 학년(1~4)
교수: id, 교수이름
과목: id, 과목이름, 학점(1~5)

학생은 하나의 학과에 반드시 소속된다.
교수는 하나의 학과에 반드시 소속된다.
교수는 여러 과목을 강의할 수 있다.
한 학생은 여러 과목을 수강할 수 있고, 한 과목은 여러 학생이 수강할 수 있다.
```

## 문장을 관계로 번역하기
이 실습의 핵심은 한글 문장을 관계 종류로 번역하는 것이었다.

| 요구사항 문장 | 관계 | 코드로는 |
|---|---|---|
| 학생은 **하나의** 학과에 **반드시** 소속 | 학과 1 : N 학생 | 학생에 `department_id` 외래키, `nullable=False` |
| 교수는 **하나의** 학과에 **반드시** 소속 | 학과 1 : N 교수 | 교수에 `department_id` 외래키, `nullable=False` |
| 교수는 **여러** 과목을 강의 | 교수 1 : N 과목 | 과목에 `professor_id` 외래키 |
| 학생 **여러** ↔ 과목 **여러** | 학생 N : M 과목 | 연관 테이블 `student_course` |
| 학년은 1~4, 학점은 1~5 | 값 제약 | `CheckConstraint` |

읽는 규칙은 두 개뿐이었다.

```
"하나의 ~에 속한다"  → 그쪽을 가리키는 외래키를 두는 1:N
"여러 ~ ↔ 여러 ~"    → 어느 쪽에도 외래키를 못 두니까 연관 테이블
```

그리고 요구사항의 **"반드시"라는 단어는 거의 항상 `nullable=False`로 번역된다.** 이걸 빠뜨리면 학과 없는 학생이 들어갈 수 있어서 요구사항을 못 지킨 모델이 된다.

## N:M 연관 테이블
연관 테이블은 ORM 클래스가 아니라 Core의 `Table`로 만들었다.

```python
student_course = Table(
    "student_course",
    Base.metadata,
    Column("student_id", ForeignKey("students.id", ondelete="CASCADE"), primary_key=True),
    Column("course_id",  ForeignKey("courses.id",  ondelete="CASCADE"), primary_key=True),
)
```

두 컬럼을 함께 기본키로 지정한 복합 기본키 덕분에, 같은 학생이 같은 과목을 두 번 신청하는 중복이 DB 수준에서 막힌다. Database 시간에 배운 수강신청 연결 표(`register`)와 같은 모양이다.

신청일이나 성적 같은 부가 정보가 없어서 `secondary` 방식으로 충분했다. 성적까지 넣어야 했다면 중간 표를 클래스로 만드는 Association Object로 가야 한다.

## 모델 코드
```python
class Department(Base):
    __tablename__ = "departments"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(20), nullable=False)

    students:   Mapped[List["Student"]]   = relationship(back_populates="department")
    professors: Mapped[List["Professor"]] = relationship(back_populates="department")


class Student(Base):
    __tablename__ = "students"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(20), nullable=False)
    grade: Mapped[int] = mapped_column(Integer)
    department_id: Mapped[int] = mapped_column(ForeignKey("departments.id"), nullable=False)

    __table_args__ = (
        CheckConstraint("grade >= 1 AND grade <= 4", name="ck_student_grade"),
    )

    department: Mapped["Department"] = relationship(back_populates="students")
    courses:    Mapped[List["Course"]] = relationship(
        secondary=student_course, back_populates="students"
    )
```

`Department` 하나가 `students`와 `professors` 두 개의 관계를 갖는 게 이 모델의 특징이었다. 학생 쪽과 교수 쪽 모두 `back_populates="department"`로 짝을 맞춰줘야 한다.

## 샘플 데이터 넣기
```python
def create_sample_data():
    Base.metadata.drop_all(bind=engine)      # 매번 깨끗하게 다시 만든다
    Base.metadata.create_all(engine)

    with SessionLocal() as db:
        cs = Department(name="컴퓨터공학과")
        db.add_all([cs, ee, math])
        db.flush()

        prof_kim = Professor(name="김교수", department=cs)   # 객체를 그대로 넘긴다
        s1 = Student(name="홍길동", grade=1, department=cs)
        s1.courses = [c_python, c_db, c_calc]                # N:M 은 리스트로 대입
        db.commit()
```

- `department_id=cs.id`가 아니라 `department=cs`로 객체를 바로 넘긴다. 관계를 걸어뒀기 때문에 가능한 것이고, 어제 관계 매핑을 배운 이유가 이것이었다.
- `s1.courses = [...]`처럼 N:M은 리스트를 통째로 대입할 수도 있다. "이 학생의 수강 목록은 이것들"이라는 뜻이라 수강신청에 잘 맞는다.
- `flush()`는 관계로만 연결하면 없어도 SQLAlchemy가 순서를 알아서 잡아준다. 그래도 넣어두면 어디까지 DB에 반영됐는지 경계가 분명해서 학습할 때는 넣는 편이 낫다고 했다.

## 조회는 두 갈래
`main.py`의 함수마다 두 가지 방법이 주석으로 나란히 적혀 있었다.

```python
def courses_of_student(db, student_id: int):
    # 방법 1 — select() 로 직접
    # stmt = (select(Course)
    #         .join(student_course, Course.id == student_course.c.course_id)
    #         .where(student_course.c.student_id == student_id))
    # return db.scalars(stmt).all()

    # 방법 2 — 관계 타고 가기
    student = db.get(Student, student_id)
    return student.courses if student else []
```

| | 관계 타고 가기 | `select()` 로 직접 |
|---|---|---|
| 코드 | 짧고 읽기 쉽다 | 길다 |
| 쿼리 수 | 2번 (학생 1 + 과목 1) | 1번 |
| 대상이 없을 때 | `None` 체크가 필요하다 | 빈 리스트가 자연스럽게 나온다 |
| 조건이 복잡해지면 | 파이썬으로 걸러야 한다 | `where` 를 계속 붙이면 된다 |

**단순 조회는 관계로, 집계나 필터가 섞이면 `select()`로** 짜는 감각을 익히는 게 이 실습의 목적이었다.

`db.get()`은 못 찾으면 예외가 아니라 `None`을 준다. 그래서 `if student else []`처럼 없을 때를 처리해야 한다. 웹 API로 만들면 이 자리가 404 응답이 된다고 한다.

집계가 필요한 함수는 `select()`로만 짜여 있었다.

```python
def student_count_per_course(db):
    """과목별 수강 학생 수"""
    stmt = (
        select(Course.name, func.count(student_course.c.student_id))
        .outerjoin(student_course, Course.id == student_course.c.course_id)
        .group_by(Course.id)
    )
    return db.execute(stmt).all()
```

샘플 데이터에 아무도 수강하지 않는 과목(운영체제)이 일부러 들어 있었다. `join`을 쓰면 그 과목이 목록에서 통째로 빠지고, `outerjoin`을 써야 0명으로 나온다. **개수를 세는데 0인 것도 보여야 하면 OUTER JOIN**이다.

함수들이 전부 `db`를 첫 번째 인자로 받는 것도 눈에 띄었다. 함수 안에서 Session을 새로 만들지 않아야 여러 함수를 한 트랜잭션으로 묶을 수 있다. FastAPI에서는 이 `db` 자리를 의존성 주입(`Depends(get_db)`)이 채워준다고 한다.

## 헷갈리기 쉬운 부분
- `join`을 쓰면 수강생이 0명인 과목이 결과에서 사라진다. 샘플에 일부러 심어둔 함정이었다.
- 학년별 학과를 찾는 함수는 설명에 "중복 제거"라고 적혀 있는데 코드에 `.distinct()`가 없었다. 2학년이 같은 학과에 두 명이면 학과가 두 번 나온다.

  ```python
  stmt = (select(Department)
          .join(Student, Student.department_id == Department.id)
          .where(Student.grade == grade)
          .distinct())          # 이 줄이 있어야 요구사항대로다
  ```

- MySQL은 길이 없는 VARCHAR를 못 만들어서 문자열 컬럼에 전부 `String(20)`처럼 길이를 줬다.
- `samples.py`는 실행할 때마다 `drop_all()`로 테이블을 통째로 지운다. 학습용이라 괜찮지만 이 파일을 다른 곳에 그대로 가져다 쓰면 사고가 난다.

## 오늘 배운 내용 정리
오늘은 대학교 요구사항을 SQLAlchemy 모델로 옮기는 실습을 했다.

```
파일 구조: databases.py / models.py / samples.py / main.py. FastAPI 골격과 같다.
.env: 비밀번호는 코드 밖에. 없으면 접속 주소가 None 으로 망가진다.
"하나의 ~에 속한다": 1:N. 외래키는 N 쪽에.
"여러 ↔ 여러": N:M. Core Table 로 연관 테이블 + 복합 기본키.
"반드시": nullable=False.
값 범위: CheckConstraint("grade >= 1 AND grade <= 4").
조회: 단순 조회는 관계(student.courses), 집계·필터는 select().
개수에 0 도 보여야 하면: outerjoin.
db.get(): 못 찾으면 None. 없을 때 처리를 꼭 한다.
```

요구사항 문장의 "하나의", "여러", "반드시" 같은 단어가 코드 한 줄씩에 대응된다는 게 이 실습에서 가장 크게 남았다. Database 시간에 배운 관계 설계를 이번에는 파이썬 코드로 옮겨본 셈이다.

---
