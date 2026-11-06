---
layout: single
title: "Database 기초 정리 5 - 서브쿼리, 제약조건과 ERD"
categories: [coding, Database]
tag: [study-log, Database, MySQL, subquery, LIMIT, paging, constraint, foreign-key, ERD]
toc: true
author_profile: false
sidebar:
    nav: "docs"
search: true
---
<hr/>

어제는 JOIN으로 흩어진 표를 이어 붙였고, 오늘은 쿼리 안에 쿼리를 넣는 **서브쿼리**와 페이징에 쓰는 **LIMIT**, 잘못된 데이터가 애초에 못 들어오게 막는 **제약조건**, 그리고 표를 어떻게 나눌지 그림으로 설계하는 **ERD**를 배웠다.

어제 "표가 왜 나뉘어 있나"를 배웠다면, 오늘은 "그럼 어떻게 나눠야 하나"를 배운 날이었다. Database 진도의 마지막 날이라 그동안 배운 내용과 이어서 정리해보려고 한다.

## 서브쿼리가 필요한 이유
"SCOTT보다 급여를 많이 받는 사람"을 찾으려면 두 단계가 필요하다.

```sql
-- 1단계: SCOTT 의 급여를 알아낸다
SELECT sal FROM t_emp WHERE ename = 'SCOTT';   -- 3000

-- 2단계: 그 값으로 검색한다
SELECT ename, sal FROM t_emp WHERE sal > 3000;
```

이렇게 하면 SCOTT의 급여가 바뀔 때마다 쿼리를 고쳐야 한다. 1단계의 결과를 2단계에 자동으로 끼워 넣는 방법이 서브쿼리다.

```sql
SELECT ename, sal FROM t_emp
WHERE sal > (SELECT sal FROM t_emp WHERE ename = 'SCOTT');
```

괄호 안이 먼저 실행되어 `3000`이 되고, 바깥 쿼리는 `WHERE sal > 3000`이 된다. 파이썬으로 치면 `if sal > get_scott_sal():`과 같다고 이해했다.

## 다중행 서브쿼리
서브쿼리 결과가 여러 줄이면 `=`를 쓸 수 없다.

```sql
SELECT empno, name, deptno FROM t_emp2
-- WHERE deptno = (SELECT dcode FROM t_dept2 WHERE area = '서울지사')   -- 에러
WHERE deptno IN (SELECT dcode FROM t_dept2 WHERE area = '서울지사');
```

`=`는 값 하나와만 비교할 수 있어서, 여러 값 중 하나라도 같으면이라는 뜻의 `IN`을 쓴다.

| 연산자 | 뜻 |
|---|---|
| `IN` | 같은 값이 있으면 참 |
| `> ANY` | 결과 중 가장 작은 것보다 크면 참 |
| `> ALL` | 결과 전부보다 크면 참 (= 최댓값보다 크다) |
| `EXISTS` | 결과가 있기만 하면 참 |

`ANY`는 "하나라도 만족하면", `ALL`은 "전부 만족해야"라서, `> ANY`는 최솟값 기준이 되고 `> ALL`은 최댓값 기준이 된다. 처음에 이 부분이 반대로 느껴져서 헷갈렸는데, 집계 함수로 바꿔 쓰면 훨씬 읽기 쉬웠다.

```sql
-- 과장 직급의 최소연봉자보다 연봉이 높은 사람
WHERE pay >ANY (SELECT pay FROM t_emp2 WHERE post = '과장')
WHERE pay > (SELECT min(pay) FROM t_emp2 WHERE post = '과장')   -- 이쪽이 읽기 쉽다
```

## 그룹별 최댓값을 가진 행 찾기
어제 배운 GROUP BY와 만나는 지점이다.

```sql
-- 직급별로 최대 연봉을 받는 직원
SELECT name, post, pay FROM t_emp2
WHERE pay IN (SELECT max(pay) FROM t_emp2 GROUP BY post) AND post IS NOT NULL;

-- 각 부서별 평균 연봉 중 가장 적은 부서의 평균보다 적게 받는 직원
SELECT d.dname, e.name, e.pay
FROM t_emp2 e JOIN t_dept2 d ON e.deptno = d.dcode
WHERE e.pay <ALL (SELECT avg(pay) FROM t_emp2 GROUP BY deptno);
```

"그룹별 최댓값이나 최솟값을 가진 행 찾기"는 실무에서 계속 나오는 패턴이라고 해서 외워두려고 한다.

다만 이 `IN` 방식에는 함정이 있다. A그룹의 최댓값이 우연히 B그룹의 다른 사람 값과 같으면 그 사람도 딸려 나온다. 그룹별로 정확히 하나씩 뽑으려면 (그룹, 값) 쌍으로 비교해야 한다는 걸 기억해둬야겠다.

## 스칼라 서브쿼리
서브쿼리는 `SELECT` 절에도 넣을 수 있다.

```sql
SELECT e.name "사원이름",
       (SELECT d.dname FROM t_dept2 d WHERE e.deptno = d.dcode) "부서이름"
FROM t_emp2 e;
```

결과 표의 **한 칸을 채우기 위해** 조회를 한 번 더 하는 것이다. 한 칸에는 값 하나만 들어가니 서브쿼리 결과가 반드시 한 줄 한 칸이어야 해서 "스칼라" 서브쿼리라고 부른다.

제1전공과 제2전공을 같이 보여주는 문제는 스칼라 서브쿼리가 특히 잘 맞았다.

```sql
SELECT
    s.name, s.grade,
    (SELECT d.dname FROM t_department d WHERE s.deptno1 = d.deptno) "dname",
    IFNULL((SELECT d.dname FROM t_department d WHERE s.deptno2 = d.deptno), '') "dname2"
FROM t_student s;
```

JOIN으로 풀려면 같은 학과 표를 두 번 JOIN하고, 제2전공이 없는 학생이 사라지지 않게 `LEFT OUTER JOIN`까지 써야 한다. 스칼라 서브쿼리는 짝이 없으면 자연스럽게 NULL이 나와서 `IFNULL` 한 번이면 끝난다. 다만 행 수만큼 조회가 반복되니 행이 많으면 JOIN보다 느릴 수 있다고 한다.

## LIMIT과 페이징
```sql
SELECT * FROM t_emp3 LIMIT 5;                        -- 첫 5개
SELECT * FROM t_emp3 ORDER BY id DESC LIMIT 0, 5;    -- 1페이지 (최신순)
SELECT * FROM t_emp3 ORDER BY id DESC LIMIT 5, 5;    -- 2페이지
```

`LIMIT 시작, 개수`에서 시작은 **0부터**다. 게시판의 페이지 번호가 이것이라서, 한 페이지에 n개씩 보여준다면 p페이지는 `LIMIT (p - 1) * n, n`이 된다.

그리고 `ORDER BY` 없는 `LIMIT`은 의미가 없다. 순서가 정해져 있지 않으면 "앞에서 5개"라는 말 자체가 성립하지 않고, 1페이지와 2페이지에 같은 행이 나올 수도 있다.

테스트 데이터를 만드는 요령도 배웠다.

```sql
-- 다른 표의 SELECT 결과를 그대로 INSERT (VALUES 없이)
INSERT INTO t_emp3(empno, name) SELECT empno, name FROM t_emp2;

-- 자기 자신을 넣으면 행 수가 두 배가 된다
INSERT INTO t_emp3(empno, name) SELECT empno, name FROM t_emp3;
```

## 제약조건이 필요한 이유
재고관리와 도서관리 과제에서는 파이썬(Pydantic)이 값을 검사했다. 그런데 그 검사를 거치지 않는 경로가 있다.

```
DB 편집기에서 직접 INSERT 를 친다.
다른 팀이 만든 프로그램이 같은 표에 쓴다.
데이터를 파일에서 한꺼번에 밀어 넣는다.
내 코드에 버그가 있다.
```

표 자체에 규칙을 걸어두면 이 모든 경로가 막힌다. 그때 Pydantic은 안내데스크, DB의 `CHECK`는 금고 자물쇠라는 비유를 들었는데 오늘 그 자물쇠를 제대로 배웠다.

## 다섯 가지 제약조건

| 약자 | 이름 | 막는 것 |
|---|---|---|
| PK | `PRIMARY KEY` | 중복 + 비어 있음. 표당 하나 |
| NN | `NOT NULL` | 비어 있음 |
| UQ | `UNIQUE` | 중복 (NULL은 여러 개 허용) |
| CK | `CHECK` | 정해진 조건을 어긴 값 |
| FK | `FOREIGN KEY` | 다른 표에 없는 값을 가리키는 것 |

`PRIMARY KEY`는 사실 `NOT NULL`과 `UNIQUE`를 합친 것이다. `UNIQUE`에 NULL이 여러 개 들어가는 건 버그가 아니라, NULL은 "모른다"라서 서로 같다고 판단하지 않기 때문이다.

## 제약조건에 이름 붙이기
```sql
CREATE TABLE t_emp4 (
    no INT,
    name VARCHAR(10) NOT NULL,
    jumin VARCHAR(13) NOT NULL,
    area INT,
    deptno VARCHAR(6),
    CONSTRAINT emp4_no_pk     PRIMARY KEY(no),
    CONSTRAINT emp4_jumin_uk  UNIQUE(jumin),
    CONSTRAINT emp4_area_ck   CHECK(area < 5),
    CONSTRAINT emp4_deptno_fk FOREIGN KEY (deptno) REFERENCES t_dept2(dcode)
);
```

이름을 붙이면 에러 메시지에 `t_emp4_chk_1` 같은 DB가 지은 이름 대신 `emp4_area_ck`가 나와서 어느 규칙이 걸렸는지 바로 알 수 있다. 나중에 이름으로 지목해서 지울 수도 있고, 여러 컬럼을 묶는 복합키는 이 방법으로만 만들 수 있다. 이름은 관례적으로 `표이름_컬럼이름_종류`로 짓는다.

수업에서는 규칙을 일부러 하나씩 어겨봤다.

```sql
INSERT INTO t_emp4 VALUES(1, 'MySQL', '1234561234567', 4, 1000);   -- 정상
INSERT INTO t_emp4 VALUES(2, '오라클', '1234561234567', 4, 1000);   -- UK 위배 (주민번호 중복)
INSERT INTO t_emp4 VALUES(2, '오라클', '2222222222222', 10, 1000);  -- CK 위배 (area < 5)
INSERT INTO t_emp4 VALUES(2, '오라클', '2222222222222', 3, 2000);   -- FK 위배 (부서 2000 없음)
```

외래키는 **"없는 번호를 가리키지 마라"**는 규칙이다. 이게 지켜져야 JOIN 결과를 믿을 수 있다.

## 부모를 지울 때 ON DELETE
부서 1000번에 직원이 남아 있으면 그 부서는 지울 수 없다. 지우면 직원들이 없는 부서를 가리키게 되기 때문이다. 어떻게 처리할지는 `ON DELETE`로 정한다.

| 옵션 | 부모를 지우면 |
|---|---|
| `RESTRICT` (기본) | 삭제가 취소된다 |
| `CASCADE` | 자식도 함께 삭제된다 |
| `SET NULL` | 자식이 가리키던 값이 NULL로 바뀐다 |

게시글을 지우면 댓글도 사라져야 하니 `CASCADE`, 부서를 없애도 직원은 남아야 하면 `SET NULL`, 주문 이력이 있는 상품은 아예 못 지우게 하려면 `RESTRICT`를 쓴다. `CASCADE`는 한 줄 지웠는데 수천 줄이 연쇄로 사라질 수 있어서, 기본값이 막아두는 `RESTRICT`인 이유가 그것이라고 한다.

## 관계는 세 가지뿐이다
두 표 A와 B가 있을 때, A 하나에 B가 몇 개 붙는지와 B 하나에 A가 몇 개 붙는지를 각각 물어보면 답이 세 가지로 나온다.

| 관계 | 예 | 어떻게 만드나 |
|---|---|---|
| 1:1 | 사원 ↔ 사원 상세정보 | 한쪽에 외래키 + `UNIQUE` |
| 1:N | 학과 ↔ 학생 | N쪽에 외래키 |
| N:M | 학생 ↔ 강좌 | 연결 표를 하나 더 만든다 |

## 1:N의 외래키는 N쪽에
학과 하나에 학생은 여럿이고, 학생 하나는 학과 하나에 속한다.

```
Department (학과)                Student (학생)
- department_no (PK)  ←──┐      - student_no (PK)
- name                   └───── - department_no   ← 외래키는 여기(N쪽)
                                - name
```

학과 표에 학생 번호를 두면 학생이 30명인 학과는 한 칸에 30개를 적어야 하는데, 칸 하나에 값 하나만 들어가는 게 표의 규칙이라 불가능하다. 학생 명찰에 학과 이름을 적지, 학과 간판에 학생 300명 이름을 적지는 않는 것과 같다.

## N:M은 연결 표로 푼다
학생 한 명이 강좌를 여러 개 듣고, 강좌 하나를 학생 여러 명이 듣는다. 양쪽 다 여러 개를 가리켜야 해서 어느 쪽에 외래키를 둬도 안 된다. 그래서 중간에 표를 하나 더 만든다.

```sql
CREATE TABLE register (
    courses_no INT NOT NULL,
    student_no INT NOT NULL,
    PRIMARY KEY (courses_no, student_no),   -- 두 컬럼을 묶은 복합 기본키
    CONSTRAINT fk_reg_courses FOREIGN KEY (courses_no) REFERENCES Courses(courses_no),
    CONSTRAINT fk_reg_student FOREIGN KEY (student_no) REFERENCES Student(student_no)
);
```

`register`는 "누가 어떤 강좌를 듣는다"는 사실 하나를 한 줄로 적는다. **N:M 하나가 1:N 두 개로 풀린 것**이다.

두 컬럼을 묶어서 기본키로 쓰면 같은 조합이 두 번 들어가는 것도 막힌다. 같은 학생이 같은 강좌를 두 번 신청하는 일이 자동으로 차단된다.

1:1 관계는 사실 한 표로 합쳐도 되기 때문에 흔치 않다. 자주 안 쓰는 큰 컬럼을 떼어놓거나 민감 정보를 분리할 때 쓰고, 1:N에 `UNIQUE`를 더해서 만든다.

## ERD로 그려보기
ERD(Entity-Relationship Diagram)는 표로 만들 대상(개체)과 그 사이의 관계를 그린 설계도다. 표를 만든 뒤에 구조를 고치려면 데이터를 옮겨야 해서 비용이 크기 때문에 먼저 그린다고 한다.

수업에서는 VSCode의 ERD Editor 확장으로 지점-계좌-고객-예금 은행 ERD를 그렸다.

```
Branch (지점)                Account (예금계좌)
- name (PK)   ←──1:N──────── - id (PK)
- city                       - branch_name (FK)
                                    │ 1:N
Member (고객)               Deposit (예금)
- id (PK)     ←──1:N──────── - account_id (PK, FK)
- name                       - member_id  (PK, FK)
                             - amount
```

`Account`와 `Member` 사이가 N:M이고, `Deposit`이 그 연결 표다. 한 계좌를 여러 고객이 공유할 수 있고(공동명의), 한 고객이 계좌를 여러 개 가질 수 있다. 연결 표에 `amount` 같은 관계 자체의 정보도 담을 수 있다는 점이 신기했다.

ERD 도구가 만들어준 SQL을 보면, 표를 먼저 전부 만들고 외래키는 나중에 `ALTER TABLE`로 붙인다. 외래키는 참조할 표가 이미 있어야 만들 수 있어서, 표끼리 서로 참조하면 순서를 정할 수 없기 때문이다.

```sql
ALTER TABLE Account
  ADD CONSTRAINT FK_Branch_TO_Account
    FOREIGN KEY (branch_name) REFERENCES Branch (name)
    ON DELETE CASCADE;
```

## 헷갈리기 쉬운 부분
- `Subquery returns more than 1 row`(1242) 에러는 `=`를 썼는데 서브쿼리가 여러 줄을 돌려준 것이다. `IN`으로 바꾸거나 `MIN`/`MAX`로 한 줄로 만든다.
- 외래키를 못 만들면 참조 대상이 PK나 UNIQUE인지, 자료형이 정확히 같은지 확인한다.
- MySQL은 8.0.16부터 `CHECK`를 실제로 검사한다. 그 이전 버전은 문법만 받아들이고 무시했다고 한다.
- 실습 파일 중간에 `"""실습"""`처럼 파이썬 문자열 문법이 들어가 있었는데, SQL에서는 주석이 아니라 문법 오류다. 한 문장씩 실행할 때는 안 걸려서 눈치채기 어려웠다. `-- 실습`으로 고쳐야 한다.

## 오늘 배운 내용 정리
오늘은 서브쿼리, 제약조건, 관계와 ERD를 배웠다.

```
서브쿼리: 먼저 알아내야 하는 값을 괄호에 넣는다. 한 줄이면 =, 여러 줄이면 IN.
ANY / ALL: > ANY 는 최솟값 기준, > ALL 은 최댓값 기준. MIN / MAX 로 바꾸면 읽기 쉽다.
그룹별 최댓값 행: WHERE pay IN (SELECT max(pay) FROM t_emp2 GROUP BY post)
스칼라 서브쿼리: SELECT 절의 한 칸을 채운다. 반드시 한 줄 한 칸.
LIMIT: LIMIT 시작, 개수. 시작은 0부터. ORDER BY 와 세트. p페이지 = LIMIT (p-1)*n, n.
제약조건: PK / NOT NULL / UNIQUE / CHECK / FK. 어떤 경로로 들어와도 막는 마지막 방어선.
ON DELETE: RESTRICT(기본, 막기) / CASCADE(연쇄 삭제) / SET NULL.
관계: 1:1 / 1:N(외래키는 N쪽) / N:M(연결 표 + 복합 기본키).
ERD: 표를 만들기 전에 그리는 설계도.
```

2주 동안 Database를 배우면서, 처음에는 SELECT로 데이터를 꺼내는 것만 생각했는데 마지막에는 데이터를 어떻게 담을지 설계하는 데까지 왔다.

"한 칸에 값을 여러 개 넣고 싶어지면 표를 쪼갤 때다"라는 말이 설계할 때 가장 쓸모 있는 기준이 될 것 같다.

---
