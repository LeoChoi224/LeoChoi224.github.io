---
layout: single
title: "Database 기초 정리 1 - DDL·DML, SELECT와 PyMySQL"
categories: [coding, Database]
tag: [study-log, Database, MySQL, SQL, DDL, DML, transaction, SELECT, PyMySQL]
toc: true
author_profile: false
sidebar:
    nav: "docs"
search: true
---
<hr/>

오늘부터 데이터베이스 진도를 나가기 시작했다.

MySQL을 설치하고 VSCode에 DB 확장을 연결한 다음, 표를 만들고 채우는 SQL 명령(DDL, DML)과 트랜잭션, 원하는 데이터만 꺼내는 `SELECT`를 배웠다. 마지막에는 파이썬에서 `pymysql`로 DB를 다루는 방법까지 배웠다.

지금까지는 데이터를 파이썬 리스트나 파일에 담았는데, 오늘부터는 진짜 "저장소"를 쓰게 된 셈이다. 오늘 배운 내용을 기준으로 정리해보려고 한다.

## 데이터베이스가 필요한 이유
데이터를 리스트나 JSON 파일에 담으면 한계가 있다.

```
1. 프로그램을 끄면 사라지거나, 파일을 통째로 다시 읽어야 한다.
2. 여러 사람이 동시에 쓰면 서로 덮어쓴다.
3. "가격이 30000원 넘는 상품만" 같은 조건 검색을 직접 짜야 한다.
```

DBMS는 저장, 동시 접근, 검색을 대신 해준다. 대신 **표(table)라는 정해진 모양**으로만 데이터를 넣어야 한다.

DB와 DBMS는 다른 말이다. DB는 데이터를 모아둔 창고 자체이고, MySQL 같은 DBMS는 그 창고를 관리해주는 프로그램이다.

```
MySQL 서버 (프로그램)
└── db2604            ← 데이터베이스 (창고)
    ├── t_student     ← 테이블 (표)
    ├── t_professor
    └── phonebook
```

수업에서는 관리자 계정(root)과 실습용 일반 계정을 따로 만들었다. 애플리케이션이 root로 접속하면 코드 한 줄 실수로 DB 전체가 날아갈 수 있어서 실무에서도 이렇게 나눈다고 한다.

## SQL 명령의 세 종류

| 분류 | 하는 일 | 대표 명령 |
|---|---|---|
| DDL (Definition) | 표의 **틀**을 만들고 없앤다 | `CREATE`, `DROP`, `ALTER` |
| DML (Manipulation) | 표의 **내용물**을 넣고 고친다 | `INSERT`, `UPDATE`, `DELETE`, `SELECT` |
| DCL (Control) | 작업을 확정·취소·허가한다 | `COMMIT`, `ROLLBACK`, `GRANT` |

이 구분이 중요한 이유는 **DDL은 되돌릴 수 없고, DML만 되돌릴 수 있기** 때문이다.

## DDL로 표 만들기
```sql
DROP TABLE IF EXISTS phonebook;

CREATE TABLE phonebook(
    id int PRIMARY KEY AUTO_INCREMENT,
    name varchar(80) NOT NULL,
    phonenum varchar(20) DEFAULT '010-0000-0000',
    email varchar(100),
    regdate datetime DEFAULT now()
);
```

- `int`, `varchar(80)`, `datetime`은 자료형이다. 문자열은 최대 길이를 미리 정해야 한다.
- `PRIMARY KEY`는 이 컬럼 값으로 행 하나를 콕 집어낼 수 있다는 선언이다. 중복과 NULL이 불가능해진다.
- `AUTO_INCREMENT`는 값을 안 넣으면 1, 2, 3... 알아서 번호를 매긴다.
- `NOT NULL`은 비워둘 수 없고, `DEFAULT`는 값을 안 주면 쓸 기본값이다.

`DROP TABLE IF EXISTS`는 실습 파일을 여러 번 돌리려고 붙이는 습관인데, 실무 DB에서 그대로 실행하면 데이터가 전부 사라진다고 해서 조심해야 할 것 같다.

```sql
SHOW DATABASES;   -- 창고 목록
USE db2604;       -- 이 창고를 쓰겠다
SHOW TABLES;      -- 표 목록
DESC phonebook;   -- 표의 컬럼 구조
```

## DML로 데이터 넣기
```sql
INSERT INTO phonebook (name, phonenum, email)
VALUES
    ('아이언맨', '111-1111-1111', 'ironman@mail.com')
    , ('캡틴아메리카', '222-2222-2222', 'captain@mail.com')
    , ('토르', '3333-3333-3333', 'thor@mail.com')
;
```

`VALUES` 뒤에 괄호를 콤마로 이어 붙이면 여러 행을 한 번에 넣을 수 있다. `id`와 `regdate`는 `AUTO_INCREMENT`와 `DEFAULT now()`가 알아서 채운다.

## DELETE와 트랜잭션
```sql
DELETE FROM phonebook;  -- 다 지워진다!
```

`WHERE`를 빼먹으면 **전체 행이 지워진다.** 그리고 MySQL은 기본이 auto-commit이라서 실행하는 순간 디스크에 반영된다. 워드의 자동 저장이 켜져 있어서 Ctrl+Z를 누르고 싶어도 이미 저장된 뒤인 것과 같다.

되돌리려면 먼저 auto-commit을 꺼야 한다.

```sql
SELECT @@autocommit;   -- 1: 켜짐, 0: 꺼짐
SET @@autocommit = 0;  -- 자동 저장 끄기

COMMIT;                -- 여기까지를 확정 지점으로

DELETE FROM phonebook WHERE id = 5;
UPDATE phonebook SET email = 'avengers@center';

ROLLBACK;              -- 마지막 COMMIT 시점으로 되돌린다
```

auto-commit을 끄면 DML 결과가 바로 디스크에 가지 않고 임시 작업 공간에 쌓인다. `COMMIT`은 확정, `ROLLBACK`은 취소다.

이렇게 "전부 되거나 전부 안 되거나"로 묶인 작업 덩어리를 **트랜잭션**이라고 한다. 계좌이체에서 "A에서 만 원 빼기"와 "B에 만 원 넣기"가 반드시 같이 성공하거나 같이 실패해야 하는 것과 같다.

그리고 `DROP TABLE` 같은 DDL은 실행되는 순간 자동으로 COMMIT까지 되기 때문에 `ROLLBACK`으로 되돌릴 수 없다. **표를 날린 건 되돌릴 수 없다**는 점이 DDL과 DML을 구분해서 외워야 하는 실질적인 이유였다.

## SELECT
오후에는 원하는 데이터만 꺼내는 `SELECT`를 배웠다. 20명이면 전부 꺼내서 눈으로 찾아도 되지만, 20만 명이면 불가능하다. 그래서 **필요한 행만, 필요한 컬럼만** 가져와야 한다.

```sql
SELECT name, grade, height          -- 무엇을
FROM t_student                      -- 어디서
WHERE grade = 4 AND height >= 170   -- 어떤 조건으로
ORDER BY grade ASC, height DESC;    -- 어떤 순서로
```

SELECT는 이렇게 네 칸을 채우는 문장이라고 이해했다.

컬럼에 별명(alias)을 붙일 수도 있다.

```sql
SELECT
    studno "학생 학번",   -- 띄어쓰기가 있으면 큰따옴표
    name,
    jumin `use`,          -- 예약어는 백틱으로 감싼다
    deptno1 AS 제1전공
FROM t_student;
```

따옴표가 세 종류라서 헷갈렸는데, **값은 작은따옴표, 이름은 백틱**으로 기억하기로 했다.

문자열을 이어 붙일 때는 `+`가 아니라 `CONCAT()`을 쓴다. MySQL에서 `SELECT 'aaa' + 'bbb';`는 0이 나온다.

```sql
SELECT CONCAT(name, '-', `position`) 교수님목록 FROM t_professor;
```

## WHERE 조건 줄이기
`IN`, `BETWEEN`, `LIKE`는 `OR`를 길게 쓰지 않으려고 있는 축약형이다.

```sql
WHERE grade = 2 OR grade = 3
WHERE grade IN (2, 3)
WHERE grade BETWEEN 2 AND 3   -- 양 끝 포함

WHERE name LIKE '김%'     -- 김으로 시작 (% 는 아무 글자 여러 개)
WHERE ename LIKE '_A%'    -- 두 번째 글자가 A (_ 는 정확히 한 글자)
```

## NULL은 0이 아니라 "모른다"
```sql
SELECT name, pay, bonus, pay + bonus FROM t_professor;
```

보너스가 없는 교수는 `pay + bonus`가 0이 아니라 **NULL**로 나온다.

NULL은 "0"이 아니라 **"모른다"**라는 뜻이다. 300만 원 더하기 모르는 값은 얼마인지 모르니 결과도 NULL이 된다. 비교도 마찬가지라서 `WHERE bonus = NULL`은 아무것도 못 찾고, `IS NULL` / `IS NOT NULL`을 써야 한다.

## AND와 OR를 섞을 때
```sql
-- 의도: 2학년 중에서 키가 크거나 몸무게가 많은 학생
WHERE grade = 2 AND height > 180 OR weight > 70;
```

결과가 의도와 달랐다. `AND`가 `OR`보다 먼저 묶여서 `(grade = 2 AND height > 180) OR (weight > 70)`으로 읽히기 때문이다. 3학년이어도 몸무게만 70을 넘으면 걸린다.

```sql
WHERE grade = 2 AND (height > 180 OR weight > 70);
```

파이썬의 `and`/`or` 우선순위와 같다. AND와 OR를 같이 쓰면 무조건 괄호를 치는 습관을 들여야 할 것 같다.

조건을 이것저것 바꿔가며 테스트할 때는 `WHERE 1 = 1` 관용구가 편했다. 아래 조건들이 전부 `AND`로 시작하니까 한 줄을 통째로 주석 처리해도 문법이 안 깨진다.

```sql
SELECT * FROM t_student
WHERE
    1 = 1
    AND grade = 3
    AND deptno1 = 101
```

## 파이썬에서 DB 다루기 PyMySQL
지금까지는 SQL을 편집기에서 직접 실행했는데, 실제 프로그램은 사용자가 메뉴를 고르면 알아서 `INSERT`를 만들어 DB에 보내야 한다. 그 통로가 드라이버이고, 우리가 쓰는 게 `pymysql`이다.

```bash
pip install pymysql
pip install cryptography   # MySQL 8의 암호 방식 때문에 같이 필요
```

사용 순서는 전화 통화와 비슷하다.

```
connect()  → 전화를 건다
cursor()   → 대화할 창구를 정한다
execute()  → 용건을 말한다
close()    → 전화를 끊는다
```

```python
import pymysql

conn_info = {
    'host': 'localhost', 'user': 'user2604', 'password': '1234',  # 실습용 로컬 계정
    'database': 'db2604', 'charset': 'utf8',
    'cursorclass': pymysql.cursors.DictCursor,   # 결과를 dict 로 받는다
}

conn = None
try:
    conn = pymysql.connect(**conn_info)
    with conn.cursor() as cursor:
        cursor.execute("SELECT * FROM users WHERE id = %s", (1,))
        row = cursor.fetchone()
        print(row['name'])
    conn.commit()               # DML 이었다면 필수
except Exception as e:
    conn and conn.rollback()    # 오류가 나면 되돌린다
    print('Error:', e)
finally:
    conn and conn.close()       # connection 은 with 로 안 닫힌다
```

연결 하나가 MySQL 서버 쪽 자원을 붙잡고 있기 때문에 쓰고 나면 꼭 닫아야 한다. 그런데 pymysql의 Connection은 `with`를 빠져나갈 때 커밋이나 롤백만 하고 연결을 닫지는 않아서, `finally`에서 직접 `close()`를 해야 한다.

## execute()와 fetch()
```python
# DML: execute() 의 리턴값이 영향받은 행 수
result = cursor.execute("INSERT INTO users (name, age) VALUES ('소리', 13)")
conn.commit()                 # 이걸 안 하면 DB에 안 남는다
print(cursor.lastrowid)       # 방금 INSERT 된 행의 id

# SELECT: 실행 후 fetch 로 꺼낸다
cursor.execute('SELECT * FROM users ORDER BY id DESC')
rows = cursor.fetchall()
```

`execute()`는 "찾아놔"이고 `fetch()`는 "이제 줘"라고 이해했다. 기본 커서는 결과를 튜플로 줘서 `row[0]`처럼 번호로 꺼내야 하는데, `DictCursor`를 쓰면 `row['name']`처럼 이름으로 꺼낼 수 있다. SELECT에 별명을 붙이면 dict의 key도 그 별명이 된다.

## 값은 %s로 넘긴다
```python
new_name = '희준'

# f-string: 위험하다
sql = f"UPDATE users SET name = '{new_name}' WHERE id = 2"

# 플레이스홀더: 이걸 쓴다
sql = "UPDATE users SET name = %s WHERE id = %s"
cursor.execute(sql, ('베리베리', 2))
```

f-string으로 SQL을 만들면, 사용자가 이름 칸에 `'; DROP TABLE users; --` 같은 걸 넣었을 때 그게 그대로 SQL 명령이 되어 실행된다. 이걸 **SQL 인젝션**이라고 한다.

플레이스홀더 `%s`를 쓰면 값과 문장을 따로 보내고, pymysql이 위험한 문자를 이스케이프해준다. 무엇을 넣어도 값일 뿐 명령이 되지 않는다. 그리고 숫자든 문자열이든 전부 `%s`를 쓴다.

값이 하나일 때 `('abc')`라고 쓰면 튜플이 아니라 문자열이라서 오류가 난다. Python에서 배운 대로 `('abc',)`처럼 콤마를 붙여야 한다.

여러 건은 `executemany()`로 한 번에 넣을 수 있다.

```python
sql = "INSERT INTO users (name, age) VALUES (%s, %s)"
cursor.executemany(sql, [("두부", 5), ("로켓", 21), ("몬지", 2)])
```

## 헷갈리기 쉬운 부분
- `ROLLBACK`을 쳤는데 안 돌아가면 `SET @@autocommit = 0;`을 먼저 안 한 것이다.
- `WHERE` 없는 `DELETE`나 `UPDATE`는 표 전체가 대상이 된다.
- INSERT가 성공했다는데 DB에 없으면 `conn.commit()`을 안 부른 것이다. pymysql은 `autocommit=False`가 기본이다.
- 노트북에 `Access denied for user 'user2605'` 에러가 남아 있었는데, 계정 이름 오타였다. `(1045, "...")`의 앞 숫자가 MySQL 에러 코드이고 1045는 인증 실패라서, 숫자를 보면 원인 찾기가 빨라진다.

## 오늘 배운 내용 정리
오늘은 데이터베이스의 기본과 SELECT, 그리고 PyMySQL을 배웠다.

```
DDL / DML / DCL: 틀(CREATE, DROP) / 내용물(INSERT, UPDATE, DELETE, SELECT) / 확정·취소(COMMIT, ROLLBACK).
트랜잭션: SET @@autocommit = 0; 후 COMMIT / ROLLBACK. DDL 은 되돌릴 수 없다.
SELECT: 무엇을(SELECT) / 어디서(FROM) / 어떤 조건(WHERE) / 어떤 순서(ORDER BY).
IN, BETWEEN, LIKE: OR 를 줄이는 축약형. % 는 여러 글자, _ 는 한 글자.
NULL: 0 이 아니라 "모른다". 연산에 섞이면 결과도 NULL. 찾을 때는 IS NULL.
PyMySQL: connect → cursor → execute → fetch → close. DML 뒤에는 commit().
SQL 인젝션: 값은 f-string 이 아니라 %s 플레이스홀더로 넘긴다.
```

`DELETE FROM phonebook;` 한 줄로 데이터가 다 지워지는 걸 보면서, 데이터베이스는 실수의 대가가 크다는 걸 느꼈다.

그리고 오늘은 코드에 비밀번호를 그대로 적었는데, 이대로 GitHub에 올리면 비밀번호가 공개된다. 내일 배울 환경변수와 `.env`가 이 문제를 푸는 방법이라고 한다.

---
