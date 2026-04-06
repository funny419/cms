---
name: dba-query
description: MariaDB 쿼리 작성, 인덱스 전략, SQLAlchemy → SQL 변환, 개발/프로덕션 DB 직접 접속 시 사용.
---

# DBA Query

## DB 접속

### 개발 환경 (로컬 Mac Docker)
```bash
docker compose exec db mariadb -u funnycms -p cmsdb
# 비밀번호 입력 후 접속
```

### 프로덕션 환경 (Windows 서버)
```powershell
docker exec cms_db_prod mariadb -u funnycms -p<PASSWORD> cmsdb
# 또는 -e로 직접 실행
docker exec cms_db_prod mariadb -u funnycms -p<PASSWORD> cmsdb -e "SELECT ..."
```

---

## 유용한 진단 쿼리

### 테이블/컬럼 확인
```sql
SHOW TABLES;
DESCRIBE posts;
SHOW CREATE TABLE posts;
SHOW INDEX FROM posts;
```

### 마이그레이션 상태 확인
```sql
SELECT * FROM alembic_version;
```

### 슬로우 쿼리 파악
```sql
SHOW FULL PROCESSLIST;
EXPLAIN SELECT * FROM posts WHERE title LIKE '%검색어%';
```

---

## 인덱스 전략

### 현재 프로젝트 주요 쿼리 패턴
- `WHERE status = 'published' ORDER BY created_at DESC` — posts
- `WHERE author_id = ? ORDER BY created_at DESC` — posts (내 글)
- `WHERE post_id = ? AND status = 'approved'` — comments

### 인덱스 추가 (schema.py)
```python
from sqlalchemy import Index

class Post(Base):
    __tablename__ = 'posts'
    __table_args__ = (
        Index('ix_posts_status_created', 'status', 'created_at'),
        Index('ix_posts_author_created', 'author_id', 'created_at'),
    )
```

### 인덱스 직접 추가 (긴급 시)
```sql
ALTER TABLE posts ADD INDEX ix_posts_status_created (status, created_at);
```

---

## SQLAlchemy → SQL 변환

### 목록 + 필터 + 페이지네이션
```python
# SQLAlchemy
stmt = (select(Post)
    .where(Post.status == 'published')
    .order_by(Post.created_at.desc())
    .offset((page-1) * per_page)
    .limit(per_page))
```
```sql
-- 동등한 SQL
SELECT * FROM posts
WHERE status = 'published'
ORDER BY created_at DESC
LIMIT 20 OFFSET 0;
```

### 검색 (LIKE)
```python
stmt = select(Post).where(Post.title.like(f'%{q}%'))
```
```sql
SELECT * FROM posts WHERE title LIKE '%검색어%';
-- ⚠️ LIKE '%...%' 는 인덱스 미사용. 데이터 많으면 FULLTEXT 고려
```

### FULLTEXT 검색 (대용량 시)
```sql
ALTER TABLE posts ADD FULLTEXT INDEX ft_posts_title_content (title, content);
SELECT * FROM posts WHERE MATCH(title, content) AGAINST ('검색어' IN BOOLEAN MODE);
```

### JOIN
```python
stmt = (select(Post, User.username)
    .join(User, Post.author_id == User.id)
    .where(Post.status == 'published'))
```
```sql
SELECT posts.*, users.username
FROM posts JOIN users ON posts.author_id = users.id
WHERE posts.status = 'published';
```

---

## 데이터 수정 (주의: 운영 DB)

```sql
-- role 변경
UPDATE users SET role = 'editor' WHERE username = 'someuser';

-- deactivate
UPDATE users SET role = 'deactivated' WHERE id = 5;

-- 컬럼 추가 (마이그레이션 우선, 긴급 시만 직접)
ALTER TABLE posts ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) DEFAULT 'public';
```

**운영 DB 수정 전 반드시 SELECT로 대상 확인 후 실행.**

---

## 백업/복원 (참고)

```bash
# 개발 DB 덤프
docker compose exec db mariadb-dump -u funnycms -p cmsdb > backup.sql

# 복원
docker compose exec -T db mariadb -u funnycms -p cmsdb < backup.sql
```
