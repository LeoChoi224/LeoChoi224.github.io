---
layout: single
title: "Database 기초 정리 3 - 재고관리 리뷰로 배운 계층 분리와 도서관리 과제"
categories: [coding, Database]
tag: [study-log, Database, PyMySQL, layer, Repository, Pydantic, field_validator, ORDER-BY, whitelist]
toc: true
author_profile: false
sidebar:
    nav: "docs"
search: true
---
<hr/>

오늘 오전에는 어제 제출한 재고관리(inventory) 과제를 강사님 리뷰본과 비교하면서 **계층을 어떻게 나누는지** 배웠고, 오후에는 파이썬 능력단위 평가가 있었다. 그리고 같은 구조를 새 주제에 처음부터 적용해보는 **도서관리(BookManager) 과제**가 나왔다.

어제 과제는 잘 돌아가긴 했는데, 리뷰를 들어보니 "돌아가는 코드"와 "바꾸기 쉬운 코드"는 다르다는 걸 알게 됐다.

## 어제 과제의 문제
어제 낸 과제는 잘 동작한다. 그런데 요구사항이 하나만 추가돼도 곤란해진다.

```
"목록을 가격순으로도 보고 싶다"
  → select_all() 안에 SQL이 박혀 있어서 함수를 하나 더 만들어야 한다.
"웹에서도 쓰게 해 달라"
  → select_one() 이 print() 를 하고 있어서 웹에서는 못 쓴다.
"수정 화면에서 기존 값을 보여 달라"
  → select_one() 이 dict 를 줘서 화면 쪽이 컬럼 이름을 알아야 한다.
```

공통 원인은 **한 함수가 두세 가지 일을 같이 하고 있다**는 것이었다.

```python
# 리뷰 전: 함수 하나가 SQL도 짜고 화면에도 찍는다
def select_one(self, id):
    cursor.execute("SELECT * FROM inventory WHERE id = %s", id)
    print(f"{result['id']} | {result['name']} | ...")   # DB 함수가 왜 화면을?
```

## 세 층으로 나누기
| 파일 | 층 | 하는 일 | 하면 안 되는 일 |
|---|---|---|---|
| `inventory.py` | 도메인 | 데이터의 모양과 규칙 | DB 접근, 화면 출력 |
| `inventorydb.py` | DB | SQL 실행, dict ↔ 객체 변환 | `print()`, `input()` |
| `inventorymain.py` | 앱(화면) | 메뉴, 입력, 출력 형식 | SQL 작성 |

각 층은 **아래쪽만 안다.** 앱층은 DB층을 부르고, DB층은 도메인을 안다. 반대로 도메인은 DB가 있는지도 모르고, DB층은 화면이 있는지도 모른다.

## DB 함수는 SQL을 밖에서 받는다
```python
# 리뷰 후: SQL 과 값을 받는다
def select_one(self, sql, *args) -> dict:
    cursor.execute(sql, args)
    return cursor.fetchone()
```

`*args`는 값이 몇 개 오든 튜플로 받아준다. 값이 하나일 때 튜플 콤마를 빼먹는 실수도 자동으로 피할 수 있다. 이제 `select_one`, `select_all`, `execute` 세 개만으로 모든 쿼리를 처리할 수 있다.

그런데 앱층이 SQL을 직접 쓰면 층을 나눈 의미가 없다. 그래서 DB 클래스 안에 **의미 있는 이름의 함수를 한 겹 더** 둔다.

```python
def save(self, item: Inventory) -> Inventory:
    sql = "INSERT INTO exam_inventory_rev(name, price, stock) VALUES (%s, %s, %s)"
    last_row_id, row_count = self.execute(sql, item.name, item.price, item.stock)
    return self.find_by_id(last_row_id)   # 방금 넣은 걸 다시 읽어서 돌려준다

def find_by_id(self, id: int) -> Inventory:
    sql = "SELECT * FROM exam_inventory_rev WHERE id = %s"
    row = self.select_one(sql, id)
    if not row: return row
    return Inventory(**row)               # dict → 객체

def list(self) -> list[Inventory]:
    sql = "SELECT id, name, price, stock, regDate as reg_date FROM exam_inventory_rev ORDER BY id"
    return [Inventory(**row) for row in self.select_all(sql)]
```

```
save / find_by_id / list / modify / remove   ← 앱층이 부르는 뜻이 있는 함수
        ↓ 안에서 SQL을 만들어 넘긴다
execute / select_one / select_all            ← pymysql 껍데기 담당
```

`save()`가 INSERT 후에 다시 조회하는 이유는, INSERT만으로는 DB가 채워주는 `id`와 `regDate`를 알 수 없기 때문이다. `lastrowid`로 다시 읽으면 DB에 실제로 들어간 모습 그대로를 돌려줄 수 있다. 게시판에서 글을 쓰자마자 그 글 화면으로 넘어가는 동작이 이런 구조라고 한다.

`Inventory(**row)`는 dict를 키워드 인자로 풀어서 객체를 만드는 것이라, **dict의 key와 클래스 필드 이름이 같아야** 한다. 그래서 DB 컬럼 `regDate`에 `reg_date`라는 별명을 붙여서 이름을 맞췄다.

함수 이름이 `insert`에서 `save`로 바뀐 것도 의미가 있었다. `insert`는 SQL의 말이고 `save`는 업무의 말이다. 앱층은 SQL을 몰라야 하니까 부르는 함수 이름도 SQL 냄새가 안 나는 쪽이 맞다고 한다.

이렇게 DB 접근만 담당하는 객체를 실무에서는 **Repository** 또는 **DAO**라고 부른다고 한다.

## 검증은 도메인 안에서, mode='before'
```python
@field_validator("name")
def name_must_not_be_empty(name):
    if not name.strip():          # 공백만 입력한 경우도 잡는다
        raise ValueError("ERR-2]문자열오류 ...")
    return name                   # 실제 세팅될 값을 리턴해야 한다

@field_validator("price", mode='before')
def price_must_be_gte_0(price):
    try:
        price = int(price)        # "25000" → 25000
    except ValueError:
        raise ValueError("올바른 가격값이 아닙니다")
    if price < 0:
        raise ValueError("ERR-3]가격 오류 ...")
    return price
```

`mode`는 내 검사 로직을 어느 시점에 끼워 넣을지 정한다.

| mode | 언제 실행 | 받는 값 |
|---|---|---|
| `'after'` (기본) | Pydantic의 타입 변환이 끝난 뒤 | 이미 int, str 로 바뀐 값 |
| `'before'` | 기본 검증이 시작되기 전 | 사용자가 넣은 날것 그대로 |
| `'plain'` | 기본 검증을 무시 | 날것, 변환도 직접 |
| `'wrap'` | 기본 검증을 감싸서 | 앞뒤로 끼어들 수 있다 |

`input()`이 주는 값은 `'25000'`이라는 문자열이다. `after`였다면 Pydantic이 먼저 int로 바꾸려다 실패했을 때 영어 기본 메시지가 나간다. `before`로 하면 우리가 먼저 받아서 변환을 시도하고, 실패하면 한국어 메시지를 낼 수 있다.

앱층에서는 여러 필드가 동시에 틀려도 전부 보여줄 수 있다.

```python
def input_item(self) -> Inventory:
    name = input().strip()
    price = input().strip()
    stock = input().strip()
    try:
        return Inventory(name=name, price=price, stock=stock)
    except ValueError as e:
        for err in e.errors():
            print(err['msg'])     # 사람이 읽을 메시지
        return None
```

## 자원 해제는 finally에
```python
def main():
    app = InventoryApp()
    try:
        while True:
            match app.choose_menu():
                case 0: print('프로그램을 종료합니다'); break
                case 1: app.create_inventory()
                case 2: app.show_list()
                case 3: app.update_inventory()
                case 4: app.remove_inventory()
    except Exception as e:
        print(e)
    finally:
        app.close()   # 어떤 경로로 끝나든 연결은 닫힌다

if __name__ == "__main__":
    main()
```

내가 낸 과제에서는 `db.close()`가 0번 메뉴를 골랐을 때만 실행됐다. 중간에 예외가 나거나 Ctrl+C로 끄면 연결이 안 닫힌다. `try / finally`로 감싸면 어떻게 끝나든 반드시 닫힌다.

메뉴 입력도 `int(input() or -1)` 대신, 잘못 입력하면 안내하고 다시 물어보도록 바뀌었다.

```python
def choose_menu(self) -> int:
    while True:
        try:
            choice = int(input("선택: "))
            if choice not in [0, 1, 2, 3, 4, 5]:
                print('선택하신 번호의 항목은 존재하지 않습니다. 재입력해주십시오.')
                continue
            return choice
        except ValueError:
            print('잘못 입력했습니다 다시 입력해주세요')
```

## 도서관리 과제
오후 평가가 끝나고, 같은 구조를 새 주제에 처음부터 세워보는 도서관리 과제가 나왔다. 재고관리는 요구사항을 따라가는 실습이었다면, 이번에는 직접 처음부터 설계해야 해서 새로운 문제들을 만났다.

```sql
CREATE TABLE IF NOT EXISTS exam_book (
    id INT PRIMARY KEY AUTO_INCREMENT,
    no VARCHAR(5) UNIQUE,               -- 사람이 정하는 도서번호 (A1153 같은)
    title VARCHAR(100) NOT NULL,
    price INT DEFAULT 0 CHECK(price >= 0),
    publishedAt DATE NOT NULL,          -- 출판일은 날짜만
    createdAt DATETIME DEFAULT now()    -- 등록 시각은 시각까지
);
```

`no`만으로도 행을 구분할 수 있는데 `id`가 또 있는 이유는, `no`는 업무가 정한 번호라서 규칙이 바뀌거나 오타로 고칠 수 있지만 `id`는 DB만 쓰는 내부 번호라 절대 안 바뀌기 때문이다. `no`에는 `UNIQUE`를 걸어서 중복만 막았다.

출판일은 시·분·초가 의미 없으니 `DATETIME`이 아니라 `DATE`로 했다.

## ORDER BY %s가 안 먹는다
목록을 번호, 제목, 가격, 출판일 × 오름차순/내림차순 8가지로 정렬하는 메뉴를 만들어야 했다. 정렬 기준을 사용자가 고르니 자연스럽게 이렇게 쓰고 싶어진다.

```python
# 정렬이 안 된다
sql = "SELECT ... FROM exam_book ORDER BY %s %s"
self.select_all(sql, order_by, sort)
```

`%s`는 **값**을 넣는 자리라서 pymysql이 따옴표를 씌운다. 실제로 DB에 가는 문장은 `ORDER BY 'no' 'ASC'`가 된다. `'no'`는 컬럼이 아니라 문자열이라 모든 행에서 값이 똑같고, 정렬이 일어나지 않는다. 에러도 안 나서 더 찾기 어렵다.

```
%s 로 넣을 수 있는 것: 값 (숫자, 문자열, 날짜)
%s 로 넣을 수 없는 것: 테이블 이름, 컬럼 이름, ASC / DESC 같은 키워드
```

## 허용 목록으로 검사한 뒤 f-string
이름을 넣어야 하니 f-string을 쓸 수밖에 없는데, 그러면 SQL 인젝션이 걱정된다. 그래서 사용자 입력을 그대로 붙이지 않고 **미리 정한 목록에 있는 값인지 검사**한다.

```python
def optional_list(self, order_by: str, sort: str):
    allowed_columns = ["no", "title", "price", "publishedAt"]
    allowed_sorts = ["ASC", "DESC"]

    if order_by not in allowed_columns:
        order_by = "no"      # 목록에 없으면 기본값으로
    if sort not in allowed_sorts:
        sort = "ASC"

    sql = f"""
        SELECT id, no, title, price,
               DATE_FORMAT(publishedAt, '%%Y-%%m-%%d') AS publishedAt,
               createdAt
        FROM exam_book
        ORDER BY {order_by} {sort}
    """
```

이런 방식을 **화이트리스트(허용 목록) 검증**이라고 한다. "DROP이 들어오면 막자" 같은 금지 목록은 빠져나갈 구멍이 생기지만, 허용 목록은 내가 아는 값만 통과시키니 새로운 공격 방법이 나와도 안전하다고 한다.

그리고 `DATE_FORMAT`의 `%Y` 같은 MySQL 포맷 문자는 pymysql이 플레이스홀더로 해석하려고 해서 `%%`로 두 번 써야 한다. 편집기에서 `.sql` 파일로 직접 실행할 때는 한 번만 쓰면 되고, 파이썬을 거쳐서 보낼 때만 `%%`다.

## 번호를 바꾸는 수정
```python
def modify(self, old_no: str, item: Book) -> Book:
    sql = "UPDATE exam_book SET no=%s, title=%s, price=%s, publishedAt=%s WHERE no=%s"
    _, row_count = self.execute_dml(sql, item.no, item.title, item.price,
                                    item.publishedAt.strftime("%Y-%m-%d"), old_no)
```

도서번호 자체를 바꾸는 수정이라면 `WHERE no = 새번호`로 찾으면 아직 없는 행을 찾게 된다. **찾을 때는 옛 번호로, 바꿀 값은 새 번호로** 구분해야 한다.

중복 등록은 저장 전에 먼저 조회해서 막았다. `UNIQUE`가 걸려 있어서 DB가 어차피 막아주지만, 에러가 아니라 안내 메시지로 처리하고 다시 입력받기 위해서다.

```python
if self.db.find_by_no(item.no):
    print('이미 존재하는 책 번호입니다. 다른 번호를 입력해주세요.\n')
    continue
```

## 정리하면서 발견한 것
노트를 정리하면서 과제 폴더를 다시 보니, `book.py`의 `Book` 클래스가 예전에 자습으로 만들었던 버전(`author`, `stock` 등)으로 남아 있어서 지금 표 구조(`no`, `title`, `price`, `publishedAt`)와 맞지 않았다. 이대로 실행하면 `ValidationError`가 난다. 도메인 클래스와 표 구조가 어긋나면 어디서 깨지는지 확인하는 계기가 됐고, `book.py`를 새 구조에 맞춰 다시 써야겠다.

## 오늘 배운 내용 정리
오늘은 재고관리 리뷰로 계층 분리를 배우고, 도서관리 과제를 했다.

```
한 함수는 한 가지 일만: DB 함수가 print() 를 하면 웹에서도, 테스트에서도 못 쓴다.
세 층: 도메인(규칙) / DB(SQL, 객체 변환) / 앱(입력, 출력). 각 층은 아래쪽만 안다.
DB 층: select_one(sql, *args) 처럼 SQL 을 받아 쓰고, 그 위에 save / find_by_id / list 를 둔다.
Inventory(**row): dict key 와 필드 이름이 같아야 한다. 다르면 SQL 별명으로 맞춘다.
mode='before': 타입 변환 전에 내 검증을 끼워 넣어 한국어 메시지를 낸다.
자원 해제: finally 에서 close().
%s 는 값 자리에만: ORDER BY 의 컬럼명은 허용 목록으로 검사한 뒤 f-string.
파이썬을 거치는 SQL 의 % 는 %%.
```

오늘 평가도 "본인이 설명할 수 있는 코드만 인정"되는 방식이었는데, 리뷰에서 배운 "왜 이렇게 나누는가"가 그대로 설명거리가 될 것 같다.

---
