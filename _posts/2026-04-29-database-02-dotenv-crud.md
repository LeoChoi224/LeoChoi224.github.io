---
layout: single
title: "Database 기초 정리 2 - 환경변수와 dotenv, Database 모듈과 재고관리 CRUD"
categories: [coding, Database]
tag: [study-log, Database, dotenv, environment-variable, gitignore, PyMySQL, CRUD, Pydantic, logging]
toc: true
author_profile: false
sidebar:
    nav: "docs"
search: true
---
<hr/>

어제 PyMySQL로 DB에 접속하면서 비밀번호를 코드에 그대로 적었는데, 오늘은 그걸 코드 밖으로 빼내는 **환경변수와 `.env`**를 배웠다.

그리고 함수마다 반복되던 접속 코드를 `Database` 클래스 하나로 묶었고, 그걸 이용해서 첫 CRUD 과제인 **재고관리(inventory) 프로그램**을 만들었다.

## 비밀번호를 코드에 쓰면 안 되는 이유
```python
conn = pymysql.connect(host='localhost', user='user2604', password='1234', database='db2604')
```

어제 쓴 코드에는 문제가 세 가지 있다.

```
1. 보안: 파일을 그대로 GitHub에 올리면 비밀번호가 공개된다.
2. 환경마다 다름: 학원 PC, 집 PC, 실제 서버의 주소와 비밀번호가 다 다르다.
3. 협업: 팀원마다 DB 비밀번호가 다른데 코드에 박혀 있으면 계속 충돌한다.
```

셋 다 원인은 **바뀌는 값이 코드 안에 있다**는 것이다. 그래서 밖으로 뺀다.

## 환경변수
환경변수는 운영체제가 들고 있는 `KEY=VALUE` 목록이고, 그 컴퓨터에서 실행되는 프로그램이라면 누구나 읽을 수 있다. 터미널에 `python`을 쳤을 때 파이썬을 찾아내는 것도 `PATH`라는 환경변수 덕분이다.

```python
import os
print(os.getenv('XXX'))      # 없으면 None
# print(os.environ['XXX'])   # 없으면 KeyError
```

두 방법은 값이 없을 때의 동작이 다르다. DB 비밀번호처럼 없으면 프로그램이 돌아갈 수 없는 값은 `os.environ[...]`으로 바로 에러를 내는 게 낫다고 한다. 조용히 `None`으로 넘어가면 나중에 엉뚱한 곳을 뒤지게 되기 때문이다.

## python-dotenv
운영체제에 환경변수를 직접 등록하는 건 번거롭고, 프로젝트마다 값이 다른데 시스템 전체에 등록하는 것도 이상하다. 그래서 프로젝트 폴더에 `.env` 파일을 두고 프로그램이 시작할 때 읽어 들인다.

```bash
pip install python-dotenv
```

```
# .env
db_host=localhost
db_user=user2604
db_password=1234
db_database=db2604
```

```python
from dotenv import load_dotenv
import os

result = load_dotenv()      # 현재 작업 경로의 .env 를 읽는다
print(result)               # 제대로 읽었으면 True

print(os.getenv('db_host'))
print(os.getenv('db_password'))
```

`load_dotenv()`는 `.env` 내용을 읽어서 **이 프로그램이 도는 동안에만** 환경변수로 얹어준다. 시스템 설정은 전혀 건드리지 않는다.

`load_dotenv()`가 `False`를 돌려주면 파일을 못 찾은 것이다. `.env`는 파이썬 파일이 있는 폴더가 아니라 **명령을 실행한 폴더** 기준으로 찾기 때문에, 터미널이 어느 폴더에 있는지부터 확인해야 한다.

그리고 환경변수 값은 항상 문자열이다. 포트 번호처럼 숫자로 써야 하면 `int()`로 바꿔야 한다.

## .gitignore
`.env`를 만들어놓고 Git에 올려버리면 아무 의미가 없다. 그래서 `.env`는 반드시 `.gitignore`에 넣는다.

```gitignore
# Environments
.env
.venv
venv/
```

이미 커밋해버린 파일은 `.gitignore`에 추가해도 계속 추적된다. 추적에서 따로 빼야 하고, Git 히스토리에는 그대로 남기 때문에 그때는 비밀번호를 바꾸는 게 정석이라고 한다.

## Database 클래스로 반복 코드 묶기
어제 배운 pymysql 코드를 그대로 쓰면, 함수 하나를 만들 때마다 이 껍데기가 따라온다.

```python
conn = None
try:
    conn = pymysql.connect(**conn_info)
    with conn.cursor() as cursor:
        ...  # ← 여기 한 줄만 다르다
    conn.commit()
except Exception as e:
    conn and conn.rollback()
finally:
    conn and conn.close()
```

CRUD 네 개를 만들면 이 껍데기를 네 번 복사하게 되고, 한 군데를 고치면 나머지를 잊는다. 그래서 껍데기는 클래스 하나에 모으고, 달라지는 SQL만 밖에서 넘겨받는 구조로 바꿨다.

```python
import pymysql
import logging

class Database:
    def __init__(self):
        self.conn = None

    def connect(self, host, user, password, database, port=3306):
        if self.conn != None:   # 이미 연결돼 있으면 다시 안 만든다
            return
        self.conn = pymysql.connect(
            host=host, port=port, user=user, password=password, database=database,
            charset="utf8",
            cursorclass=pymysql.cursors.DictCursor,
        )

    def close(self):
        if self.conn is None:
            return
        self.conn.close()
        self.conn = None        # 닫았으면 None 으로 되돌려야 다음 connect 가 된다

    def execute(self, sql):     # DDL, DML
        last_row_id = -1
        try:
            cursor = self.conn.cursor()
            cursor.execute(sql)
            self.conn.commit()
            last_row_id = cursor.lastrowid
        except Exception as e:
            logging.error(e)
        finally:
            cursor.close()
            return last_row_id

    def select_one(self, sql):  # → dict
        ...                     # execute + fetchone

    def select_all(self, sql):  # → list[dict]
        ...                     # execute + fetchall
```

연결을 **객체가 들고 있게** 만든 것이다. 매번 전화를 새로 걸지 않고, 한 번 걸어둔 통화를 계속 쓰는 셈이다.

`close()`에서 `self.conn = None`을 빼먹으면, 다시 `connect()`를 불러도 `if self.conn != None: return`에 걸려서 아무 일도 안 일어난다. 에러도 안 나서 원인 찾기가 어려울 것 같다.

함수를 셋으로 나눈 이유는 **결과의 모양이 다르기** 때문이다.

| 함수 | 하는 일 | 돌려주는 것 |
|---|---|---|
| `execute()` | execute + commit | lastrowid (정수) |
| `select_one()` | execute + fetchone | dict 또는 None |
| `select_all()` | execute + fetchall | list[dict] |

`execute()` 안에 `commit()`이 들어 있어서 밖에서 커밋을 잊을 일이 없다. 그리고 `print()` 대신 `logging.error()`로 오류를 기록했는데, logging은 심각도를 붙이고 파일로 남기거나 시간과 줄 번호를 자동으로 붙일 수 있어서 print의 정식 버전이라고 이해했다.

```python
from dotenv import load_dotenv
load_dotenv()

db = Database()
conn_info = {
    'host': os.getenv('db_host'),
    'user': os.getenv('db_user'),
    'password': os.getenv('db_password'),
    'database': os.getenv('db_database'),
}
db.connect(**conn_info)
print(db.select_one("SELECT * FROM users ORDER BY id DESC"))
```

접속 정보가 전부 `.env`에서 온다. 오전에 배운 게 바로 쓰였다. `**conn_info`는 Python에서 배운 dict unpacking이라서 `db.connect(host=..., user=..., ...)`와 같다.

## CRUD
CRUD는 데이터를 다루는 네 가지 기본 동작의 머리글자다.

| 약자 | 뜻 | SQL |
|---|---|---|
| Create | 만들기 | INSERT |
| Read | 읽기 | SELECT |
| Update | 고치기 | UPDATE |
| Delete | 지우기 | DELETE |

데이터를 다루는 프로그램은 결국 이 넷의 조합이다.

## 재고관리 과제
상품을 등록·조회·수정·삭제하는 콘솔 프로그램을 만드는 과제였고, 파일을 넷으로 나눠서 짰다.

```
practice/inventory/
├── inventory.sql      ← 필요한 쿼리를 먼저 손으로 짜보고 테스트
├── inventory.py       ← Inventory 도메인 (데이터의 모양과 규칙)
├── inventorydb.py     ← InventoryDB (DB 접근)
└── inventorymain.py   ← 메뉴 출력, 입력 받기 (사용자 화면)
```

식당으로 비유하면 `inventorymain`은 홀(주문 받기), `inventorydb`는 주방(조리), `inventory`는 메뉴의 규격이다.

```sql
CREATE TABLE inventory(
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(80) NOT NULL,
    price INT NOT NULL CHECK(price >= 0),   -- 음수 가격 금지
    stock INT DEFAULT 0,
    regDate DATETIME DEFAULT now()
);
```

데이터의 모양과 규칙은 Pydantic으로 정의했다.

```python
from pydantic import BaseModel, Field, field_validator

class Inventory(BaseModel):
    id: Optional[int] = None
    name: str = Field(...)
    price: int
    stock: int = 0
    regDate: datetime = datetime.now()

    @field_validator("price")
    def price_must_be_positive(cls, v):
        if v <= 0:
            raise ValueError("ERR-4]가격 오류 ...")
        return v
```

DB에도 `CHECK(price >= 0)`가 있는데 왜 파이썬에서 또 검사하는지 궁금했다. DB의 `CHECK`는 서버까지 다녀온 뒤에 걸리는 **최후의 방어선**이고, Pydantic은 **입력받자마자** 걸러준다. 오류 메시지도 우리가 정한 한국어로 나온다. 하나는 문 앞 안내데스크, 하나는 금고 자물쇠라서 둘 다 있는 게 정상이라고 한다.

메인 화면은 Python 때 배운 `while True`와 `match`로 만들었다.

```python
def main():
    while True:
        show_menu()
        input_num = int(input("선택: ") or -1)
        if input_num == 0:
            db.close()
            break

        match input_num:
            case 1: append_product()
            case 2: show_product_list()
            case 3: update_product()
            case 4: delete_product()
            case _: print("선택하신 번호의 항목은 존재하지 않습니다.")
```

`int(input(...) or -1)`은 그냥 엔터를 쳤을 때 `int('')`가 터지는 것을 막으려고 쓴 것이다. 빈 문자열은 거짓이라 `'' or -1`이 `-1`이 된다. SCE가 여기서도 쓰였다. 다만 `abc` 같은 글자를 넣으면 여전히 에러가 난다.

## 다시 보니 아쉬운 부분
노트를 정리하면서 보니 고칠 부분이 몇 개 보였다.

- `execute()`가 `finally` 안에서 `return`을 하면, `try` 안에서 예외가 나도 값이 조용히 돌아가서 에러가 묻힌다.
- `self.conn`이 `None`인 상태로 함수를 부르면 `self.conn.cursor()`에서 터지고, `finally`의 `cursor.close()`가 다른 에러를 낸다.
- `insert()` 안에서 `Inventory(...)`를 검증용으로만 만들고 결과를 버린다. 동작은 하지만 "이 줄이 왜 있지?" 싶은 코드다.
- `regDate: datetime = datetime.now()`처럼 기본값에 `datetime.now()`를 직접 쓰면, 객체를 만들 때마다가 아니라 클래스를 정의하는 순간의 시각으로 고정된다.

내일 이 과제를 리뷰한다고 하니 이 부분들이 어떻게 바뀌는지 봐야겠다.

## 오늘 배운 내용 정리
오늘은 환경변수와 Database 모듈, 그리고 첫 CRUD 과제를 했다.

```
환경변수: 운영체제가 들고 있는 KEY=VALUE. os.getenv() 는 None, os.environ[] 은 KeyError.
.env + dotenv: 프로젝트 폴더의 .env 를 load_dotenv() 로 읽는다. 실행 폴더 기준.
.gitignore: .env 는 반드시 넣는다.
Database 클래스: connect / close / execute / select_one / select_all 로 반복 코드를 한 곳에.
close() 후에는 self.conn = None.
CRUD: Create(INSERT) / Read(SELECT) / Update(UPDATE) / Delete(DELETE).
계층 분리: 도메인(Inventory) / DB 접근(InventoryDB) / 화면(main).
검증은 두 겹: Pydantic 으로 먼저 거르고, DB 의 CHECK / NOT NULL 이 마지막을 막는다.
```

처음으로 파일을 여러 개로 나눠서 프로그램을 만들어봤다. 한 파일에 다 넣어도 동작은 하지만, 화면 문구를 바꿀 때 SQL을 건드릴 일이 없다는 점이 나누는 이유라고 이해했다.

---
