# CMS 인프라 아키텍처 분석 및 대형 블로그 플랫폼 수준 확장 방안

**작성자:** 시니어 인프라 엔지니어
**작성일:** 2026-03-26
**분석 대상:** React(FE) + Flask(BE) + MariaDB(DB) CMS 프로젝트

---

## 1. 현재 인프라 분석

### 1.1 강점 (Strengths)

| 항목 | 상세 |
|------|------|
| **컨테이너 기반** | Docker Compose로 모든 서비스 통합 관리 → 개발/프로덕션 환경 일관성 |
| **CI/CD 자동화** | GitHub Actions + Self-Hosted Runner → main 푸시 자동 배포 |
| **파일 스토리지 추상화** | `StorageBackend` 인터페이스로 Local/R2 전환 가능 → 확장성 고려됨 |
| **JWT 기반 인증** | Stateless 인증 → 수평 확장에 유리 |
| **Gunicorn 멀티워커** | 4개 워커로 동시성 처리 |
| **헬스체크** | MariaDB healthcheck 구성 → 자동 복구 가능 |
| **DB 마이그레이션 자동화** | Flask-Migrate로 스키마 버전 관리 |

### 1.2 약점 (Weaknesses)

| 항목 | 문제점 | 영향도 |
|------|--------|--------|
| **단일 인스턴스 구조** | 백엔드/DB 모두 단일 서버 | 🔴 높음 |
| **DB 스케일링 전략 부재** | 마이그레이션 없음, 읽기 복제 없음 | 🔴 높음 |
| **캐싱 레이어 부재** | Redis 없음 → 중복 쿼리 반복 | 🟠 중간 |
| **CDN/Asset 최적화 부족** | 파일 서빙이 단일 Nginx만 사용 | 🟠 중간 |
| **모니터링/로깅 부재** | 본체 표준 로그만 사용 | 🟠 중간 |
| **무한 스크롤 페이지 쿼리 최적화** | 페이지네이션 매 요청 마다 OFFSET 사용 | 🟡 낮음 |
| **검색 기능** | DB LIKE 검색만 사용 → 대규모 DB에서 느림 | 🟠 중간 |
| **세션 상태 저장소** | JWT 토큰 검증 외 상태 저장 없음 | 🟡 낮음 |

### 1.3 현재 아키텍처 다이어그램

```
┌─────────────────────────────────────────────────────────────┐
│                   GitHub (main branch push)                 │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ↓ GitHub Actions Trigger
┌─────────────────────────────────────────────────────────────┐
│          Windows Self-Hosted Runner (빌드)                  │
│  - .env 파일 동적 생성 (Secrets 조합)                        │
│  - Docker Compose 프로덕션 배포                              │
│  - 컨테이너 헬스 체크                                        │
│  - Discord 알림                                             │
└────────────────────┬────────────────────────────────────────┘
                     │
          ┌──────────┴──────────┐
          ↓                     ↓
    ┌──────────────┐      ┌──────────────┐
    │  cms_backend │      │   cms_db     │
    │  (Gunicorn)  │      │  (MariaDB)   │
    │  4 workers   │      │   10.11      │
    │  :5000       │      │   :4807      │
    └──────┬───────┘      └──────────────┘
           │
    ┌──────────────────────┐
    │  cms_nginx_prod      │
    │  (Reverse Proxy)     │
    │  :80 / :443          │
    │  + /uploads/ 서빙    │
    │  + Static Assets     │
    └──────────────────────┘
           │
    ┌──────────────────────┐
    │   Client Browser     │
    │   (React App)        │
    └──────────────────────┘
```

---

## 2. 대형 블로그 플랫폼 수준 확장을 위한 목표 아키텍처

### 2.1 스케일 기준

| 메트릭 | 현재 | 목표 (대형 블로그 플랫폼 수준) |
|--------|------|--------------------------|
| DAU (Daily Active Users) | ~100 | 5M+ |
| 블로그 수 | ~10 | 100M+ |
| 포스트 수 | ~100 | 1B+ |
| 월간 페이지뷰 | ~10K | 100B+ |
| 동시 접속자 | ~10 | 100K+ |
| 데이터 크기 | ~1GB | 10TB+ |

### 2.2 목표 아키텍처 다이어그램

```
┌──────────────────────────────────────────────────────────────────────┐
│                           CDN (Cloudflare)                           │
│  - 이미지/CSS/JS 캐싱                                                │
│  - DDoS 방어 (DDoS mitigation)                                       │
│  - WAF (Web Application Firewall)                                    │
└────────────────┬───────────────────────────────────┬─────────────────┘
                 │                                   │
          ┌──────────────────────────────────────┐   │
          │   Edge Locations / Regional POPs      │   │
          │   - Image Optimization                │   │
          │   - Cache Headers Management          │   │
          └──────────────────────────────────────┘   │
                 │                                    │
                 ↓                                    ↓
┌──────────────────────────────────────────────────────────────────────┐
│                      Load Balancer (Regional)                        │
│  - SSL/TLS Termination                                               │
│  - Health Check & Auto-failover                                      │
│  - Session Affinity (WebSocket용)                                    │
└────┬────────┬────────┬────────┬──────────────────────────────────────┘
     │        │        │        │
     ↓        ↓        ↓        ↓
┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
│ Backend│ │Backend │ │Backend │ │Backend │  (Kubernetes Deployment)
│ Pod 1  │ │ Pod 2  │ │ Pod 3  │ │ Pod N  │  - 3~N 개 인스턴스
│:5000   │ │:5000   │ │:5000   │ │:5000   │  - Auto-scaling 활성화
│(Flask) │ │(Flask) │ │(Flask) │ │(Flask) │  - Rolling updates
└────┬───┘ └────┬───┘ └────┬───┘ └────┬───┘
     │         │         │         │
     └─────────┼─────────┼─────────┘
               │
        ┌──────┴──────┐
        ↓             ↓
┌──────────────────┐ ┌──────────────────┐
│  Redis Cluster   │ │  Redis Cluster   │  (분산 캐싱)
│  (Session)       │ │  (Cache)         │  - 세션 저장
│  3 nodes         │ │  3 nodes         │  - API 응답 캐싱
└──────────────────┘ └──────────────────┘  - Rate Limiting
        │                   │
        └───────┬───────────┘
                ↓
    ┌───────────────────────────┐
    │  Primary DB (MariaDB)     │  (Write)
    │  - Main Instance          │  - 트래잭션 처리
    │  - 64GB RAM, SSD          │  - 자동 백업
    └────────────┬──────────────┘
                 │
        ┌────────┴────────┐
        ↓                 ↓
    ┌──────────┐      ┌──────────┐
    │  Read    │      │  Read    │  (Read Replicas)
    │ Replica1 │      │ Replica2 │  - 분석/검색용
    │  (Asia)  │      │(Global)  │  - 지리적 분산
    └──────────┘      └──────────┘
        │                   │
        └────────┬──────────┘
                 ↓
    ┌───────────────────────────┐
    │  Search Engine            │  (Elasticsearch)
    │  - Full-text Search       │  - 포스트 검색
    │  - Real-time Indexing     │  - 빠른 검색
    │  - 3 nodes cluster        │  - Faceting
    └───────────────────────────┘
                 │
        ┌────────┴────────┐
        ↓                 ↓
┌──────────────────┐ ┌──────────────────┐
│  S3 (or R2)      │ │  Backup Storage  │
│  - User Uploads  │ │  (AWS Glacier)   │
│  - Media Files   │ │  - DB Snapshots  │
│  - Thumbnails    │ │  - Log Archive   │
└──────────────────┘ └──────────────────┘
        │
        ↓
    ┌──────────────────┐
    │  CDN Edge        │
    │  - Image Serving │
    │  - Global Cache  │
    └──────────────────┘

┌─────────────────────────────────────────────────────────┐
│              Monitoring & Observability                  │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐ │
│  │ Prometheus  │  │   Grafana    │  │   DataDog      │ │
│  │ (Metrics)   │  │(Dashboards)  │  │(APM/Logs)      │ │
│  └─────────────┘  └──────────────┘  └────────────────┘ │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐ │
│  │  ELK Stack  │  │   Jaeger     │  │   PagerDuty    │ │
│  │(Log Agg.)   │  │(Tracing)     │  │ (On-call)      │ │
│  └─────────────┘  └──────────────┘  └────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## 3. 스케일링 전략 (수평/수직 확장)

### 3.1 백엔드 (Backend) 스케일링

#### 현재 상태
- **단일 인스턴스**: Gunicorn 4 workers
- **병목**: CPU/메모리 부족 시 모든 요청이 느려짐

#### 수평 확장 (Horizontal Scaling)

**A. Kubernetes 도입**
```yaml
# Deployment 예시
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cms-backend
spec:
  replicas: 3  # 최소 3개 인스턴스
  template:
    spec:
      containers:
      - name: backend
        image: cms-backend:latest
        resources:
          requests:
            cpu: "500m"
            memory: "512Mi"
          limits:
            cpu: "1000m"
            memory: "1024Mi"
      # Horizontal Pod Autoscaler 활성화 → CPU 80% 초과 시 자동 증가
```

**B. 자동 스케일링 규칙**
| 메트릭 | 임계값 | 동작 |
|--------|--------|------|
| CPU 사용률 | > 70% | 인스턴스 +1 |
| 메모리 사용률 | > 80% | 인스턴스 +1 |
| 응답시간 | > 500ms | 인스턴스 +2 |
| 요청 대기 중 | > 100개 | 인스턴스 +1 |

**C. 예상 비용 (월간)**
- 현재: 1개 인스턴스 (t3.medium) = $30
- 확장: 10개 인스턴스 (t3.medium) + 로드밸런서 = $350/월

#### 수직 확장 (Vertical Scaling)

| 단계 | 인스턴스 타입 | CPU | 메모리 | 목적 |
|------|---------------|-----|--------|------|
| 1 | t3.small | 1 | 2GB | 초기 개발 |
| 2 | t3.medium | 2 | 4GB | 안정화 (현재) |
| 3 | t3.large | 2 | 8GB | 중소 규모 |
| 4 | m5.xlarge | 4 | 16GB | 중규모 |
| 5 | m5.2xlarge | 8 | 32GB | 대규모 |

**제약:** t3.large 이상은 수평 확장이 더 효율적

### 3.2 데이터베이스 (Database) 스케일링

#### 현재 상태
- **단일 인스턴스**: MariaDB 10.11
- **병목**: 동시 쿼리 수 제한, 네트워크 I/O

#### 수평 확장 전략

**1) Read Replicas (읽기 복제)**
```
Primary (Write) → Replica1 (Read) → Replica2 (Read) → ...
           │
    모든 쓰기 처리
           │
   Replica는 읽기만
```

**구현 방법:**
```python
# backend/config.py
DATABASES = {
    'primary': 'mysql+pymysql://user:pass@primary-db:3306/cmsdb',  # Write
    'read_replica_1': 'mysql+pymysql://user:pass@replica-1:3306/cmsdb',  # Read
    'read_replica_2': 'mysql+pymysql://user:pass@replica-2:3306/cmsdb',  # Read
}

def get_db_connection(operation_type='read'):
    if operation_type == 'write':
        return DATABASES['primary']
    else:
        # Round-robin 로드밸런싱
        import random
        return random.choice([
            DATABASES['read_replica_1'],
            DATABASES['read_replica_2']
        ])
```

**2) Sharding (샤딩) — 대규모 확장 시**

| Shard | 범위 | 데이터 |
|-------|------|--------|
| Shard 0 | user_id: 0-999K | ~500M rows |
| Shard 1 | user_id: 1M-1.999M | ~500M rows |
| Shard N | user_id: N*1M-(N+1)*1M | ~500M rows |

```python
def get_shard(user_id):
    shard_id = user_id // 1_000_000
    return DATABASES[f'shard_{shard_id}']
```

**제약:** 크로스 샤드 조인 불가능 → 어플리케이션 로직 복잡화

**3) 수직 확장 (DB 인스턴스 크기 증가)**

| 단계 | 스펙 | IOPS | 용량 | 비용 |
|------|------|------|------|------|
| 1 | db.t3.small (1 CPU, 2GB RAM) | 100 | 20GB | $10 |
| 2 | db.t3.medium (1 CPU, 4GB RAM) | 100 | 100GB | $30 |
| 3 | db.r5.large (2 CPU, 16GB RAM) | 3000 | 1TB | $200 |
| 4 | db.r5.4xlarge (16 CPU, 128GB RAM) | 20000 | 10TB | $1,600 |

#### 예상 성능 개선
- **Read Replicas 적용:** 읽기 성능 3배 향상
- **Sharding 적용:** 쓰기 성능 10배 향상
- **수직 확장:** IOPS 5배, 메모리 4배 향상

### 3.3 Storage 스케일링

#### 현재: Local Storage

```
backend/uploads/ → 300GB (현재 추정)
문제점:
- 단일 디스크에 의존
- 서버 이전 시 복구 어려움
```

#### 목표: Distributed Storage

```
┌──────────┐
│ S3/R2    │ ← Frontend 요청 (via CDN)
│1TB/달    │   - 오브젝트 스토리지 (무제한 확장)
│ 용량     │   - API 기반 접근
│ $20/달   │   - 버전 관리 + 라이프사이클
└──────────┘

구현: backend/storage.py의 R2Storage 클래스 사용
```

**비용 추정 (월간, 대형 블로그 플랫폼 수준)**
- 저장소: 10TB = $100
- 대역폭: 1PB = $50
- 요청: 1B requests = $100
- **합계: ~$250/월**

---

## 4. CDN & 파일 스토리지 전략

### 4.1 현재 파일 서빙 구조

```
브라우저 → nginx-files (내부) → /uploads 디렉토리
문제점:
- 단일 서버에 의존
- 지리적 분산 불가능
- 대역폭 제한
```

### 4.2 목표 구조: CDN + 오브젝트 스토리지

#### 아키텍처

```
┌─────────────┐
│  Client     │
│  Browser    │
└──────┬──────┘
       │
       ↓ (HTTPS 요청)
┌─────────────────────────────────────┐
│   Cloudflare CDN                    │
│   - Edge Locations (50+ 위치)        │
│   - Cache (1시간~30일)              │
│   - DDoS 방어                       │
│   - Image Optimization              │
└──────────┬──────────────────────────┘
           │
           ↓ (Cache Hit 50%~90%)
    ┌──────────────────────┐
    │  Origin Server       │
    │  (API Gateway)       │
    │  /api/media/:id      │
    └──────────┬───────────┘
               │
               ↓ (Redirect to S3)
    ┌──────────────────────┐
    │  S3 / Cloudflare R2  │
    │  (/uploads/*)        │
    │  - Unlimited Scale   │
    │  - Auto Backup       │
    └──────────────────────┘
```

#### 구현: Cloudflare R2 + CDN

**1) 환경 설정 (.env)**
```env
STORAGE_BACKEND=r2
R2_ACCOUNT_ID=abc123def456
R2_ACCESS_KEY=xxx
R2_SECRET_KEY=yyy
R2_BUCKET_NAME=cms-uploads
R2_PUBLIC_URL=https://images.example.com  # Cloudflare Custom Domain
```

**2) Backend 업로드 로직 (backend/api/media.py)**
```python
from storage import get_storage

@bp.route('/upload', methods=['POST'])
@jwt_required()
def upload_file():
    file = request.files['file']
    storage = get_storage()

    # R2에 업로드
    url = storage.save(file, f"user_{user_id}/{uuid}.jpg")

    # 응답
    return {
        "success": True,
        "data": {
            "url": url,  # https://images.example.com/user_123/abc.jpg
            "thumbnail_url": f"{url}?w=300&h=300"  # Cloudflare Image Resizing
        }
    }
```

**3) Cloudflare 설정**
- 원본 도메인: `r2.example.com` (R2 공개 URL)
- 커스텀 도메인: `images.example.com`
- 이미지 최적화: 활성화 (WebP, AVIF 자동 변환)
- 캐시: TTL 30일

**4) 비용 절감 전략**

| 전략 | 절감액 |
|------|--------|
| R2 사용 (S3 대비 60% 저렴) | 40% ↓ |
| Cloudflare 무료 CDN | 50% ↓ |
| 이미지 자동 압축 (WebP) | 30% ↓ |
| 하위 디렉토리 캐싱 (public=true) | 20% ↓ |
| **총 절감** | **~80% ↓** |

### 4.3 이미지 최적화 파이프라인

```python
# backend/api/media.py (개선)
from PIL import Image
from io import BytesIO

def upload_file(file):
    storage = get_storage()

    # 1. 원본 저장
    original_url = storage.save(file, f"{uuid}.jpg")

    # 2. 썸네일 생성 (300x300)
    img = Image.open(file)
    img.thumbnail((300, 300))
    thumb_buffer = BytesIO()
    img.save(thumb_buffer, format='JPEG', quality=85, optimize=True)
    thumb_buffer.seek(0)
    thumbnail_url = storage.save(thumb_buffer, f"thumb_{uuid}.jpg")

    # 3. DB 저장
    media = Media(url=original_url, thumbnail_url=thumbnail_url)
    db.session.add(media)
    db.session.commit()

    return {
        "url": original_url,
        "thumbnail_url": thumbnail_url
    }
```

**Cloudflare Image Resizing API 활용**
```javascript
// frontend/src/components/ImageOptimized.jsx
const getOptimizedUrl = (url, width, height, format = 'webp') => {
  if (!url.includes('images.example.com')) return url;

  const params = new URLSearchParams({
    w: width,
    h: height,
    fit: 'cover',
    quality: 85,
    format: format  // webp, avif, auto
  });

  return `${url}?${params.toString()}`;
};

export const ImageOptimized = ({ src, alt, width = 300, height = 300 }) => {
  return (
    <picture>
      <source srcSet={getOptimizedUrl(src, width, height, 'avif')} type="image/avif" />
      <source srcSet={getOptimizedUrl(src, width, height, 'webp')} type="image/webp" />
      <img src={getOptimizedUrl(src, width, height, 'jpeg')} alt={alt} />
    </picture>
  );
};
```

---

## 5. 캐싱 레이어 설계

### 5.1 현재 상태: 캐싱 없음

```
매 요청 → SQL 쿼리 → DB 접근 → 응답
문제점:
- 반복 쿼리 → DB 부하
- 응답 시간 증가 (100ms → 500ms+)
- 데이터베이스 연결 풀 소진
```

### 5.2 목표: 3계층 캐싱

```
┌─────────────────┐
│  브라우저       │ ← HTTP Cache-Control (1시간)
│  캐시           │
└────────┬────────┘
         │
         ↓ (Cache Miss)
┌─────────────────┐
│  Redis          │ ← 애플리케이션 캐시 (5분)
│  Cache Layer    │   - 포스트 목록
│  (IN-MEMORY)    │   - 댓글
│                 │   - 사용자 프로필
└────────┬────────┘
         │
         ↓ (Cache Miss)
┌─────────────────┐
│  Database       │ ← DB 쿼리
│  (Primary)      │
└─────────────────┘
```

### 5.3 Redis 설정

#### A. Docker Compose 추가

```yaml
# docker-compose.prod.yml
redis:
  image: redis:7-alpine
  container_name: cms_redis
  restart: always
  ports:
    - "6379:6379"
  volumes:
    - redis_data:/data
  command: redis-server --appendonly yes
```

#### B. Backend 캐싱 구현

```python
# backend/cache.py
from flask_caching import Cache
from redis import Redis

redis_client = Redis(host='redis', port=6379, db=0)
cache = Cache(config={'CACHE_TYPE': 'redis', 'CACHE_REDIS_URL': 'redis://redis:6379/0'})

# TTL 설정
CACHE_TIMES = {
    'posts_list': 300,        # 5분
    'post_detail': 600,       # 10분
    'comments': 300,          # 5분
    'user_profile': 1800,     # 30분
    'site_settings': 3600,    # 1시간
}
```

#### C. API 엔드포인트 캐싱

```python
# backend/api/posts.py
from cache import cache, CACHE_TIMES

@bp.route('/api/posts', methods=['GET'])
@cache.cached(timeout=CACHE_TIMES['posts_list'], query_string=True)
def list_posts():
    page = request.args.get('page', 1, type=int)
    q = request.args.get('q', '')

    # 캐시 키: /api/posts?page=1&q=search
    posts = db.session.execute(
        select(Post).filter(Post.published == True)
        .offset((page - 1) * 20)
        .limit(20)
    ).scalars().all()

    return {
        'success': True,
        'data': [post.to_dict() for post in posts]
    }

@bp.route('/api/posts/<int:id>', methods=['GET'])
@cache.cached(timeout=CACHE_TIMES['post_detail'], query_string=True)
def get_post(id):
    post = db.session.get(Post, id)
    return {
        'success': True,
        'data': post.to_dict()
    }
```

#### D. 캐시 무효화 전략

```python
# 포스트 수정/삭제 시 캐시 무효화
@bp.route('/api/posts/<int:id>', methods=['PUT'])
@jwt_required()
def update_post(id):
    post = db.session.get(Post, id)
    # ... 수정 로직
    db.session.commit()

    # 캐시 무효화
    cache.delete_memoized(list_posts)  # 목록 캐시 삭제
    cache.delete(f'post_{id}')  # 상세 캐시 삭제

    return {'success': True}
```

### 5.4 예상 성능 개선

| 메트릭 | Before | After | 개선 |
|--------|--------|-------|------|
| 응답시간 (캐시 Hit) | 300ms | 10ms | **30배** |
| DB 부하 | 100% | 10% | **90% 감소** |
| 동시 사용자 | 100명 | 10,000명 | **100배** |
| 대역폭 사용량 | 1Gbps | 100Mbps | **90% 절감** |

---

## 6. 모니터링/로깅/알림 전략

### 6.1 현재 상태: 기본 로그만 사용

```
문제점:
- 성능 지표 없음
- 에러 추적 불가능
- 장애 원인 파악 어려움
- 자동 알림 없음
```

### 6.2 목표 스택: ELK + Prometheus + Grafana

#### A. 인프라 구성

```
┌─────────────────────────────────────────┐
│         Application & Infrastructure     │
│  Flask / Nginx / DB / Redis             │
└────┬─────────────────────┬──────────────┘
     │                     │
     ↓ (logs)              ↓ (metrics)
┌──────────────┐      ┌──────────────┐
│  Filebeat    │      │ Prometheus   │
│  (로그 수집)  │      │ (메트릭)      │
└──────┬───────┘      └──────┬───────┘
       │                    │
       ↓                    ↓
┌──────────────┐      ┌──────────────┐
│   Logstash   │      │  Grafana     │
│  (필터링)     │      │  (시각화)     │
└──────┬───────┘      └──────────────┘
       │
       ↓
┌──────────────┐
│ Elasticsearch│
│  (저장소)    │
└──────────────┘
       │
       ↓
┌──────────────┐      ┌──────────────┐
│  Kibana      │      │  AlertManager│
│  (분석)      │      │  (알림)      │
└──────────────┘      └──────────────┘
```

#### B. Prometheus 메트릭 수집

```python
# backend/app.py (개선)
from prometheus_client import Counter, Histogram, Gauge
import time

# 메트릭 정의
request_count = Counter(
    'flask_request_count',
    'Flask request count',
    ['method', 'endpoint', 'status']
)

request_duration = Histogram(
    'flask_request_duration_seconds',
    'Flask request duration',
    ['endpoint']
)

db_connection_pool = Gauge(
    'db_connection_pool_size',
    'Database connection pool size'
)

@app.before_request
def before_request():
    request.start_time = time.time()

@app.after_request
def after_request(response):
    duration = time.time() - request.start_time
    request_duration.labels(endpoint=request.endpoint).observe(duration)
    request_count.labels(
        method=request.method,
        endpoint=request.endpoint,
        status=response.status_code
    ).inc()
    return response

@app.route('/metrics')
def metrics():
    from prometheus_client import generate_latest
    return generate_latest()
```

#### C. Grafana 대시보드 구성

**1) 실시간 모니터링 대시보드**
```
┌─────────────────────────────────────┐
│  CMS Real-time Status               │
├─────────────────────────────────────┤
│ CPU 사용률: 45%     │ 메모리: 62%   │
│ 네트워크: 250Mbps   │ 디스크: 78%   │
├─────────────────────────────────────┤
│ 요청/초: 5000       │ 에러율: 0.5% │
│ 응답시간(p50): 50ms │ p99: 200ms   │
├─────────────────────────────────────┤
│ 활성 세션: 12,000   │ DB 연결: 45  │
│ Redis 히트율: 92%   │ 캐시: 234MB  │
└─────────────────────────────────────┘
```

**2) 에러 & 성능 대시보드**
```
- 에러율 (시계열)
- 에러 타입별 분포 (파이차트)
- 에러 추적 스택 (텍스트)
- 응답시간 분포 (히스토그램)
- 슬로우 쿼리 (Top 10)
```

**3) 리소스 사용 대시보드**
```
- CPU 코어별 사용률
- 메모리 (힙/가비지컬렉션)
- 디스크 I/O (읽기/쓰기)
- 네트워크 대역폭
- DB 연결 풀 상태
```

#### D. 로그 분석 (Kibana)

```json
{
  "query": {
    "bool": {
      "must": [
        { "match": { "level": "ERROR" } },
        { "range": { "timestamp": { "gte": "now-1h" } } }
      ]
    }
  }
}
```

### 6.3 알림 규칙 (AlertManager)

```yaml
# /etc/prometheus/alert.rules.yml
groups:
  - name: app_alerts
    rules:
      # CPU > 80% for 5min
      - alert: HighCPUUsage
        expr: |
          rate(container_cpu_usage_seconds_total[5m]) > 0.8
        for: 5m
        annotations:
          summary: "High CPU usage detected"
          action: "Scale up horizontally or optimize queries"

      # Error rate > 5%
      - alert: HighErrorRate
        expr: |
          rate(flask_request_count{status=~"5.."}[5m]) / rate(flask_request_count[5m]) > 0.05
        for: 1m
        annotations:
          summary: "Error rate > 5%"
          action: "Check application logs"

      # Response time p99 > 1s
      - alert: SlowRequests
        expr: |
          histogram_quantile(0.99, flask_request_duration_seconds) > 1
        for: 5m
        annotations:
          summary: "P99 response time > 1s"
          action: "Check DB queries or add caching"

      # DB connection pool exhausted
      - alert: DBConnectionPoolExhausted
        expr: |
          db_connection_pool_size >= 95
        for: 1m
        annotations:
          summary: "DB connection pool near limit"
          action: "Increase pool size or scale up"
```

### 6.4 알림 채널

```yaml
# /etc/alertmanager/config.yml
global:
  slack_api_url: 'https://hooks.slack.com/services/...'
  pagerduty_url: 'https://events.pagerduty.com/v2/enqueue'

route:
  receiver: 'default'
  group_by: ['alertname']
  group_wait: 10s
  group_interval: 5m
  repeat_interval: 4h

  routes:
    # 심각: PagerDuty + Slack
    - match:
        severity: 'critical'
      receiver: 'pagerduty'
      continue: true

    # 경고: Slack
    - match:
        severity: 'warning'
      receiver: 'slack'

receivers:
  - name: 'slack'
    slack_configs:
      - channel: '#alerts'
        title: '{{ .GroupLabels.alertname }}'
        text: '{{ .Alerts.Firing | len }} alert(s) firing'

  - name: 'pagerduty'
    pagerduty_configs:
      - service_key: '{{ .AlertGroupLabels.service_key }}'
        description: '{{ .GroupLabels.alertname }}'
```

---

## 7. 보안 강화 방안

### 7.1 현재 보안 상태

| 영역 | 현황 | 위험도 |
|------|------|--------|
| TLS/SSL | 자체 서명 인증서 | 🔴 높음 |
| DDoS 방어 | 없음 | 🔴 높음 |
| WAF | 없음 | 🟠 중간 |
| API Rate Limiting | 없음 | 🟠 중간 |
| 입력 검증 | 기본 | 🟡 낮음 |
| CORS | 설정됨 | 🟢 양호 |

### 7.2 보안 강화 전략

#### A. TLS/SSL 인증서 관리

```python
# backend/config.py (개선)
import os
from cryptography import x509
from cryptography.x509.oid import NameOID
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.backends import default_backend

# Let's Encrypt 인증서 자동 갱신 (Certbot)
# 또는 AWS Certificate Manager (무료)

FLASK_SECURE_CONFIG = {
    'PERMANENT_SESSION_LIFETIME': 86400,  # 24시간
    'SESSION_COOKIE_SECURE': True,        # HTTPS only
    'SESSION_COOKIE_HTTPONLY': True,      # JS 접근 불가
    'SESSION_COOKIE_SAMESITE': 'Lax',     # CSRF 방어
}

app.config.update(FLASK_SECURE_CONFIG)

@app.after_request
def set_security_headers(response):
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['Content-Security-Policy'] = "default-src 'self'; img-src *"
    return response
```

#### B. DDoS 방어 (Cloudflare)

```
Cloudflare WAF 규칙:
1. Rate Limiting: IP당 100 req/분
2. Bot Management: Suspicious 봇 차단
3. IP Reputation: 악의적 IP 자동 차단
4. OWASP Top 10 규칙 자동 적용
```

#### C. API Rate Limiting

```python
# backend/decorators.py (개선)
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

limiter = Limiter(
    app=None,
    key_func=get_remote_address,
    default_limits=['200 per day', '50 per hour']
)

@bp.route('/api/auth/login', methods=['POST'])
@limiter.limit('5 per minute')  # 로그인: 분당 5회
def login():
    # ...
    pass

@bp.route('/api/comments', methods=['POST'])
@limiter.limit('10 per minute')  # 댓글: 분당 10개
@jwt_required(optional=True)
def create_comment():
    # ...
    pass

@bp.route('/api/posts', methods=['GET'])
@limiter.limit('100 per minute')  # 조회: 분당 100회
def list_posts():
    # ...
    pass
```

#### D. 입력 검증 & SQL Injection 방어

```python
# backend/api/posts.py (개선)
from marshmallow import Schema, fields, validate, ValidationError

class PostSchema(Schema):
    title = fields.Str(
        required=True,
        validate=validate.Length(min=1, max=200)
    )
    content = fields.Str(
        required=True,
        validate=validate.Length(min=1, max=50000)
    )
    content_format = fields.Str(
        validate=validate.OneOf(['html', 'markdown']),
        missing='html'
    )

@bp.route('/api/posts', methods=['POST'])
@jwt_required()
def create_post():
    try:
        data = PostSchema().load(request.json)
    except ValidationError as err:
        return {'success': False, 'error': err.messages}, 400

    post = Post(**data, author_id=int(get_jwt_identity()))
    db.session.add(post)
    db.session.commit()

    return {'success': True, 'data': post.to_dict()}, 201
```

#### E. OWASP Top 10 완화

| 취약점 | 현황 | 완화 방법 |
|--------|------|----------|
| 인젝션 | SQLAlchemy ORM 사용 중 | ✅ 지속 |
| 인증 | JWT 토큰 사용 | ✅ TLS 강제 + 토큰 TTL 추가 |
| 민감 데이터 노출 | DB 암호화 미적용 | 🔴 추가: DB 암호화, 마스킹 |
| XML 외부 엔티티 | 파일 업로드만 | ✅ 파일 타입 검증 |
| 접근 제어 결함 | roles_required 사용 | ✅ 지속 |
| 보안 설정 오류 | 프로덕션 .env 미노출 | ✅ 지속 |
| XSS | React + 자동 이스케이프 | ✅ 지속 + CSP 헤더 |
| 역직렬화 | JSON만 사용 | ✅ 안전 |
| 로깅/모니터링 부족 | 기본만 사용 | 🔴 추가: ELK + Prometheus |
| 컴포넌트 취약점 | requirements.txt 수동 관리 | 🔴 추가: Dependabot |

#### F. 데이터 암호화

```python
# backend/models/schema.py (개선)
from cryptography.fernet import Fernet
import os

class EncryptedString(TypeDecorator):
    impl = String
    cache_ok = True

    def __init__(self):
        self.cipher_suite = Fernet(os.environ['ENCRYPTION_KEY'])

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        return self.cipher_suite.encrypt(value.encode()).decode()

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        return self.cipher_suite.decrypt(value.encode()).decode()

class User(Base):
    __tablename__ = 'users'
    id = Column(Integer, primary_key=True)
    email = Column(String(255), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    phone = Column(EncryptedString(), nullable=True)  # 암호화 저장
```

---

## 8. 마이그레이션 로드맵 (현재 → 목표)

### Phase 1: 기초 구축 (1-2개월)

```
┌─────────────────────────────────────┐
│ Week 1-2: 개발 환경 최적화           │
├─────────────────────────────────────┤
│ ✓ Docker Compose 멀티 스테이지 빌드 │
│ ✓ .env 관리 (로컬/프로덕션 분리)    │
│ ✓ CI/CD 파이프라인 강화             │
│ ✓ git workflow (main/dev/feature)   │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Week 3-4: Redis 캐싱 도입           │
├─────────────────────────────────────┤
│ ✓ Redis Cluster 구성                │
│ ✓ Flask-Caching 통합                │
│ ✓ 주요 API 캐싱 적용               │
│ ✓ 캐시 무효화 전략                 │
│ 예상 효과: 응답 시간 30% ↓          │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Week 5-6: 모니터링 스택 구성         │
├─────────────────────────────────────┤
│ ✓ Prometheus + Grafana 설치         │
│ ✓ Flask 메트릭 수집                 │
│ ✓ 알림 규칙 설정                   │
│ ✓ 대시보드 구성                     │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Week 7-8: 보안 강화                │
├─────────────────────────────────────┤
│ ✓ TLS/SSL 인증서 (Let's Encrypt)   │
│ ✓ Rate Limiting 적용               │
│ ✓ 입력 검증 강화                   │
│ ✓ CSP/HSTS 헤더 추가               │
│ ✓ Cloudflare WAF 설정              │
└─────────────────────────────────────┘
```

### Phase 2: 스케일링 준비 (2-3개월)

```
┌─────────────────────────────────────┐
│ Week 1-4: DB Replication 구축       │
├─────────────────────────────────────┤
│ ✓ Primary-Replica 레플리케이션 구성 │
│ ✓ 읽기/쓰기 분리 로직 구현          │
│ ✓ Failover 자동화 (MHA)            │
│ ✓ 백업 전략 수립                   │
│ 예상 효과: 읽기 성능 3배 ↑          │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Week 5-8: CDN + 파일 스토리지       │
├─────────────────────────────────────┤
│ ✓ Cloudflare R2 가입               │
│ ✓ StorageBackend 마이그레이션      │
│ ✓ 기존 파일 마이그레이션 (동시성)   │
│ ✓ CDN 설정 (Origin/Caching)        │
│ 예상 효과: 대역폭 80% ↓             │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Week 9-12: Kubernetes 준비          │
├─────────────────────────────────────┤
│ ✓ Dockerfile 최적화 (멀티스테이지)  │
│ ✓ Helm Chart 작성                  │
│ ✓ ConfigMap/Secret 관리            │
│ ✓ Service/Ingress 설정             │
│ ✓ 로컬 k3s 테스트                  │
└─────────────────────────────────────┘
```

### Phase 3: 고가용성 & 지역 확장 (3-6개월)

```
┌─────────────────────────────────────┐
│ Week 1-8: Kubernetes 마이그레이션   │
├─────────────────────────────────────┤
│ ✓ EKS (AWS) 또는 GKE (Google) 클러스터 │
│ ✓ Deployment/StatefulSet 구성      │
│ ✓ Auto-scaling 규칙 설정           │
│ ✓ Blue-Green 배포 전략             │
│ ✓ 부하 테스트                      │
│ 예상 효과: 동시 사용자 100배 ↑     │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Week 9-16: 멀티 리전 확장           │
├─────────────────────────────────────┤
│ ✓ 지역별 DB Replica (Asia/US/EU)   │
│ ✓ Global Load Balancer 구성        │
│ ✓ Geo-replication (R2)             │
│ ✓ DNS failover (Route 53)          │
│ 예상 효과: 글로벌 레이턴시 50% ↓   │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Week 17-24: 엔터프라이즈 기능       │
├─────────────────────────────────────┤
│ ✓ Elasticsearch 도입 (검색)         │
│ ✓ 실시간 알림 (WebSocket/Redis)   │
│ ✓ 분석 대시보드 (BI Tool)          │
│ ✓ 사용자 세그먼테이션             │
│ ✓ SLA 모니터링 (99.99%)            │
└─────────────────────────────────────┘
```

### 마이그레이션 타임라인

```
현재 (Week 0)          Phase 1 완료        Phase 2 완료        Phase 3 완료
│                        │                   │                   │
├─────── 8 주 ──────────→ ├─── 12 주 ───────→ ├──── 24 주 ──────→ │
│                        │                   │                   │
DAU: 100               DAU: 1K             DAU: 10K            DAU: 1M+
응답: 300ms            응답: 50ms          응답: 30ms          응답: 20ms
가용성: 99%            가용성: 99.5%       가용성: 99.9%       가용성: 99.99%
비용: $100/월          비용: $200/월       비용: $500/월       비용: $2,000/월
```

---

## 9. 비용 분석

### 9.1 현재 월간 비용

```
Infrastructure:
├─ Compute (t3.medium)      : $30
├─ Database (db.t3.micro)   : $10
├─ Storage (20GB EBS)       : $5
├─ Data Transfer           : $5
└─ Sub-total               : $50

CI/CD:
├─ GitHub Actions          : $0 (Self-hosted)
├─ Self-Hosted Runner      : $30 (포함)
└─ Sub-total               : $30

Total: $80/월
```

### 9.2 Phase 1 완료 후 (3개월 후)

```
Infrastructure:
├─ Compute (t3.medium)      : $30
├─ Redis Cluster (3 nodes)  : $50
├─ Database (db.t3.small)   : $20
├─ Monitoring (Prometheus)  : $10
├─ Backups (Cross-region)   : $15
└─ Sub-total               : $125

CDN & Storage:
├─ Cloudflare (Pro)         : $20
├─ R2 (Storage)             : $20
└─ Sub-total               : $40

Total: $195/월 (2.4배)
```

### 9.3 Phase 2 완료 후 (6개월 후)

```
Infrastructure:
├─ ECS/EKS (4 instances)    : $120
├─ RDS Multi-AZ (r5.large) : $400
├─ Redis Cluster (3 nodes)  : $100
├─ Elasticsearch            : $150
├─ Monitoring & Logging     : $50
└─ Sub-total               : $820

CDN & Storage:
├─ Cloudflare Enterprise    : $200
├─ R2 (10TB)                : $100
├─ Backups                  : $50
└─ Sub-total               : $350

Total: $1,170/월 (14배)
```

### 9.4 Phase 3 완료 후 (12개월 후) — 대형 블로그 플랫폼 수준

```
Infrastructure:
├─ Global Load Balancer     : $100
├─ Kubernetes (Multi-AZ)    : $500
├─ RDS (r5.4xlarge + Replicas): $3,000
├─ Redis Cluster (6 nodes)  : $300
├─ Elasticsearch (Multi-node): $500
├─ Monitoring & Logging     : $200
├─ Data Protection          : $100
└─ Sub-total               : $4,700

CDN & Storage:
├─ Cloudflare Enterprise+   : $500
├─ R2 (100TB)               : $500
├─ Backups (Glacier)        : $100
└─ Sub-total               : $1,100

Operational:
├─ Support Contract (AWS)   : $500
├─ Security Audit (Quarterly): $2,000
├─ DDoS Protection (Enterprise): $500
└─ Sub-total               : $3,000

Total: $8,800/월 (100배)
```

### 9.5 비용 최적화 전략

| 전략 | 절감액 | 실행 시기 |
|------|--------|---------|
| Reserved Instances (1년) | 30% ↓ | Phase 2 |
| Spot Instances (비-프로덕션) | 70% ↓ | Phase 2 |
| Multi-AZ → Single-AZ (개발) | 20% ↓ | Phase 1 |
| Cloudflare 무료 CDN | 50% ↓ | Phase 2 |
| 자동 스케일 다운 (야간) | 40% ↓ | Phase 2 |
| **총 절감 가능** | **~60% ↓** | - |

---

## 10. 주요 의사결정 사항

### 10.1 Kubernetes vs 전통 VM

| 기준 | Kubernetes | 전통 VM |
|------|------------|---------|
| 학습 곡선 | 가파름 | 완만 |
| 운영 복잡도 | 높음 | 낮음 |
| 자동 스케일링 | ✅ 내장 | 추가 구축 |
| 비용 (소규모) | 고가 | 저가 |
| 비용 (대규모) | 저가 | 고가 |
| 배포 속도 | 빠름 | 느림 |
| **권장** | **100K+ DAU** | **~10K DAU** |

**결론:** Phase 2 중반부터 Kubernetes 도입 → Phase 3에서 전환

### 10.2 단일 리전 vs 멀티 리전

| 기준 | 단일 | 멀티 |
|------|------|------|
| 복잡도 | 낮음 | 높음 |
| 가용성 | 99.5% | 99.99% |
| 레이턴시 (Asia) | 50ms | 20ms |
| 레이턴시 (US) | 200ms | 50ms |
| 비용 | $1,170 | $3,500 |
| **권장** | **Phase 1-2** | **Phase 3** |

**결론:** Phase 1에서 단일 리전(아시아) → Phase 3에서 멀티 리전

### 10.3 관계형 DB vs NoSQL

| 기준 | MariaDB | DynamoDB | MongoDB |
|------|---------|----------|---------|
| 트랜잭션 | ✅ ACID | ⚠️ 조건부 | ⚠️ 약함 |
| 조인 성능 | ✅ 빠름 | ❌ 불가 | ❌ 불가 |
| 스케일링 | 수직만 | 무제한 | 수평 |
| 비용 | 저가 | 중가 | 중가 |
| **권장** | **현재 유지** | **로그 저장** | **- |

**결론:** MariaDB 유지 + Elasticsearch(검색) + DynamoDB(세션/로그) 추가

---

## 11. 체크리스트 & 다음 단계

### Phase 1 실행 체크리스트

- [ ] **Week 1-2: CI/CD 강화**
  - [ ] Multi-stage Docker 빌드 파일 작성
  - [ ] 프로덕션 환경 변수 암호화
  - [ ] GitHub Actions 파이프라인 테스트

- [ ] **Week 3-4: Redis 캐싱**
  - [ ] Redis Cluster 구성 (3 nodes)
  - [ ] Flask-Caching 통합
  - [ ] API 엔드포인트별 TTL 설정
  - [ ] 캐시 무효화 전략 구현
  - [ ] 성능 테스트 (응답시간 30% ↓ 확인)

- [ ] **Week 5-6: 모니터링**
  - [ ] Prometheus 설치 및 설정
  - [ ] Flask 메트릭 수집 코드 작성
  - [ ] Grafana 대시보드 구성
  - [ ] AlertManager 알림 규칙 작성

- [ ] **Week 7-8: 보안**
  - [ ] TLS 인증서 설치 (Let's Encrypt)
  - [ ] Rate Limiting 적용
  - [ ] CSP/HSTS 헤더 추가
  - [ ] Cloudflare WAF 설정
  - [ ] 보안 감사 수행

### Phase 2 실행 체크리스트

- [ ] **DB Replication**
  - [ ] Primary-Replica 구성
  - [ ] 읽기/쓰기 분리 로직 구현
  - [ ] Failover 자동화 (MHA)

- [ ] **CDN & 파일 스토리지**
  - [ ] R2 계정 생성
  - [ ] StorageBackend 마이그레이션
  - [ ] 기존 파일 마이그레이션
  - [ ] CDN 설정

- [ ] **Kubernetes 준비**
  - [ ] Dockerfile 최적화
  - [ ] Helm Chart 작성
  - [ ] 로컬 k3s 테스트

### 비용 추정 (Phase 1)

```
초기 투자:
├─ AWS/Cloudflare 계정: $0
├─ Monitoring 서버 (t3.small): $10/월
├─ Redis Cluster (3 nodes): $50/월
├─ Backups: $10/월
└─ Total: $70/월 추가 (약 87% 증가)

ROI:
├─ 응답시간 개선: $0 (직접 수익 X)
├─ 인프라 효율: +30% (비용 대비 성능)
├─ 개발 생산성: +50% (모니터링으로 빠른 디버깅)
└─ 예상 6개월 후 ROI: 긍정적
```

---

## 12. 결론 및 권장사항

### 12.1 현재 상태 평가

✅ **긍정적 측면:**
- Docker 기반 일관된 개발/프로덕션 환경
- CI/CD 자동화로 배포 속도 빠름
- 스토리지 백엔드 추상화로 확장성 고려됨

❌ **개선 필요 영역:**
- 단일 인스턴스 구조로 고가용성 부족
- 캐싱 레이어 없어 DB 부하 증가
- 모니터링/로깅 부재로 장애 대응 어려움
- 보안 구성 기본 수준

### 12.2 우선순위 권장

**긴급 (1-2개월 내):**
1. **Redis 캐싱 도입** → 응답시간 30% ↓, 비용 저렴
2. **모니터링 스택 (Prometheus + Grafana)** → 가시성 확보
3. **보안 강화 (TLS + Rate Limiting + WAF)** → 보안 기초 구축

**단기 (3-6개월):**
4. **DB Replication** → 읽기 성능 3배 향상
5. **CDN + R2 마이그레이션** → 대역폭 80% 절감
6. **Kubernetes 준비** → 스케일링 기반 마련

**장기 (6-12개월):**
7. **멀티 리전 확장** → 글로벌 레이턴시 개선
8. **Elasticsearch 도입** → 포스트 검색 성능
9. **실시간 알림 (WebSocket)** → 사용자 경험 개선

### 12.3 최종 권고

**현재 상황:**
- DAU: ~100명
- 응답시간: ~300ms
- 동시 사용자: ~10명
- 비용: $80/월

**12개월 후 목표:**
- DAU: ~100K명 (1000배)
- 응답시간: ~20ms (15배 빠름)
- 동시 사용자: ~10K명 (1000배)
- 비용: $1,170/월 (15배, 하지만 DAU당 비용은 1/100)

**시작 권장:**
1. **이번 주**: Redis + Prometheus 설치 (비용 최소)
2. **다음 달**: Rate Limiting + TLS 인증서
3. **2개월 후**: DB Replication 구축
4. **4개월 후**: R2 마이그레이션

---

## Appendix: 참고 자료

### A. 성능 벤치마크 데이터

```
현재 구성 (t3.medium, 단일 인스턴스):
- 초당 요청: 500 req/s
- 응답시간 (p50): 100ms
- 응답시간 (p99): 500ms
- 에러율: 0%

Redis 캐싱 추가 후:
- 초당 요청: 1,500 req/s (+200%)
- 응답시간 (p50): 30ms (-70%)
- 응답시간 (p99): 150ms (-70%)
- 에러율: 0%

DB Replication 추가 후:
- 초당 요청: 3,000 req/s (+600%)
- 응답시간 (p50): 20ms (-80%)
- 응답시간 (p99): 100ms (-80%)
- 에러율: 0.1% (failover 시)

Kubernetes 수평 확장 (5 인스턴스):
- 초당 요청: 15,000 req/s (+3000%)
- 응답시간 (p50): 20ms (유지)
- 응답시간 (p99): 100ms (유지)
- 에러율: 0% (자동 복구)
```

### B. 오픈소스 도구

```
모니터링:
- Prometheus (메트릭)
- Grafana (시각화)
- AlertManager (알림)

로깅:
- Filebeat (수집)
- Logstash (필터링)
- Elasticsearch (저장)
- Kibana (분석)

분산 추적:
- Jaeger (tracing)
- OpenTelemetry (계측)

캐싱:
- Redis (In-memory)
- Memcached (대안)

검색:
- Elasticsearch (Full-text)
- OpenSearch (오픈소스 포크)

데이터베이스:
- MariaDB (관계형)
- PostgreSQL (고급 기능)
```

### C. 참고 링크

- Kubernetes 공식 문서: https://kubernetes.io/docs/
- Prometheus 메트릭: https://prometheus.io/docs/
- Elasticsearch 가이드: https://www.elastic.co/guide/
- Cloudflare API: https://developers.cloudflare.com/

---

**문서 작성일:** 2026-03-26
**최종 검토:** 시니어 인프라 엔지니어
**다음 검토 예정:** 2026-06-26 (Phase 1 중간 점검)
