from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required, verify_jwt_in_request
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError

from api.decorators import roles_required
from database import db
from models.schema import Comment, Post, PostLike, Tag, User

posts_bp = Blueprint("posts", __name__, url_prefix="/api/posts")


@posts_bp.route("", methods=["GET"])
def list_posts() -> tuple:
    """공개된 포스트 목록 조회 (페이지네이션 + 검색 포함)."""
    try:
        verify_jwt_in_request(optional=True)
        raw_id = get_jwt_identity()
        current_user_id = int(raw_id) if raw_id else None
    except Exception:
        current_user_id = None

    page = max(1, request.args.get("page", 1, type=int) or 1)
    per_page = min(max(1, request.args.get("per_page", 20, type=int) or 20), 100)
    offset = (page - 1) * per_page
    q = request.args.get("q", "").strip()

    # 댓글수 서브쿼리 (approved 댓글만)
    comment_sq = (
        select(func.count(Comment.id))
        .where(Comment.post_id == Post.id)
        .where(Comment.status == "approved")
        .correlate(Post)
        .scalar_subquery()
    )

    # 추천수 서브쿼리
    like_sq = (
        select(func.count(PostLike.id))
        .where(PostLike.post_id == Post.id)
        .correlate(Post)
        .scalar_subquery()
    )

    base_query = (
        select(
            Post,
            User.username.label("author_username"),
            comment_sq.label("comment_count"),
            like_sq.label("like_count"),
        )
        .outerjoin(User, Post.author_id == User.id)
        .where(Post.status == "published")
    )
    total_query = select(func.count(Post.id)).where(Post.status == "published")

    # visibility 필터
    if current_user_id is None:
        base_query = base_query.where(Post.visibility == "public")
        total_query = total_query.where(Post.visibility == "public")
    else:
        _user = db.session.get(User, current_user_id)
        if not (_user and _user.role == "admin"):
            _vis_filter = or_(
                Post.visibility == "public",
                Post.visibility == "members_only",
                (Post.visibility == "private") & (Post.author_id == current_user_id),
            )
            base_query = base_query.where(_vis_filter)
            total_query = total_query.where(_vis_filter)

    if q:
        base_query = base_query.where(Post.title.ilike(f"%{q}%"))
        total_query = total_query.where(Post.title.ilike(f"%{q}%"))

    category_id = request.args.get("category_id", type=int)
    if category_id:
        base_query = base_query.where(Post.category_id == category_id)
        total_query = total_query.where(Post.category_id == category_id)

    author_username = request.args.get("author", "").strip()
    if author_username:
        author_user = db.session.execute(
            select(User).where(User.username == author_username)
        ).scalar_one_or_none()
        if author_user:
            base_query = base_query.where(Post.author_id == author_user.id)
            total_query = total_query.where(Post.author_id == author_user.id)
        else:
            # 없는 사용자 → 빈 결과
            base_query = base_query.where(Post.author_id == -1)
            total_query = total_query.where(Post.author_id == -1)

    total: int = db.session.execute(total_query).scalar() or 0

    rows = db.session.execute(
        base_query.order_by(Post.created_at.desc()).offset(offset).limit(per_page)
    ).all()

    liked_post_ids: set = set()
    if current_user_id:
        liked_post_ids = set(
            db.session.execute(select(PostLike.post_id).where(PostLike.user_id == current_user_id))
            .scalars()
            .all()
        )

    items = []
    for post, author_username, comment_count, like_count in rows:
        d = post.to_dict()
        d["author_username"] = author_username or "알 수 없음"
        d["comment_count"] = comment_count or 0
        d["like_count"] = like_count or 0
        d["user_liked"] = post.id in liked_post_ids
        items.append(d)

    return jsonify(
        {
            "success": True,
            "data": {
                "items": items,
                "page": page,
                "per_page": per_page,
                "total": total,
                "has_more": page * per_page < total,
            },
            "error": "",
        }
    ), 200


@posts_bp.route("/mine", methods=["GET"])
@jwt_required()
def get_my_posts() -> tuple:
    """로그인 유저의 모든 포스트 조회 (draft + published, 페이지네이션)."""
    current_user_id: int = int(get_jwt_identity())
    user: User | None = db.session.get(User, current_user_id)
    if user and user.role == "deactivated":
        return jsonify({"success": False, "data": {}, "error": "비활성화된 계정입니다."}), 403

    page = max(1, request.args.get("page", 1, type=int) or 1)
    per_page = min(max(1, request.args.get("per_page", 20, type=int) or 20), 100)
    offset = (page - 1) * per_page

    total: int = (
        db.session.execute(
            select(func.count(Post.id)).where(Post.author_id == current_user_id)
        ).scalar()
        or 0
    )

    posts = (
        db.session.execute(
            select(Post)
            .where(Post.author_id == current_user_id)
            .order_by(Post.created_at.desc())
            .offset(offset)
            .limit(per_page)
        )
        .scalars()
        .all()
    )

    return jsonify(
        {
            "success": True,
            "data": {
                "items": [p.to_dict() for p in posts],
                "page": page,
                "per_page": per_page,
                "total": total,
                "has_more": page * per_page < total,
            },
            "error": "",
        }
    ), 200


@posts_bp.route("/<int:post_id>", methods=["GET"])
def get_post(post_id: int) -> tuple:
    """포스트 단건 조회 — 상세 페이지 진입 시 view_count +1 (집계 포함).

    ?skip_count=1 파라미터 시 view_count 증가 생략 (편집 페이지 전용).
    """
    skip_count: bool = bool(request.args.get("skip_count"))

    # JWT optional
    try:
        verify_jwt_in_request(optional=True)
        raw_id = get_jwt_identity()
        current_user_id = int(raw_id) if raw_id else None
    except Exception:
        current_user_id = None

    post: Post | None = db.session.get(Post, post_id)
    if not post:
        return jsonify({"success": False, "data": {}, "error": "Not found"}), 404

    # visibility 접근 제어 (URL 직접 접근 보호)
    if post.visibility == "members_only" and current_user_id is None:
        return jsonify({"success": False, "data": {}, "error": "로그인이 필요합니다."}), 403
    elif post.visibility == "private":
        if current_user_id is None:
            return jsonify({"success": False, "data": {}, "error": "접근 권한이 없습니다."}), 403
        _viewer: User | None = db.session.get(User, current_user_id)
        if _viewer and _viewer.role != "admin" and post.author_id != current_user_id:
            return jsonify({"success": False, "data": {}, "error": "접근 권한이 없습니다."}), 403

    # view_count +1 (편집 페이지는 제외)
    if not skip_count:
        post.view_count += 1
        db.session.flush()

    # 집계 (같은 트랜잭션)
    comment_count: int = (
        db.session.execute(
            select(func.count(Comment.id))
            .where(Comment.post_id == post_id)
            .where(Comment.status == "approved")
        ).scalar()
        or 0
    )

    like_count: int = (
        db.session.execute(
            select(func.count(PostLike.id)).where(PostLike.post_id == post_id)
        ).scalar()
        or 0
    )

    user_liked: bool = False
    if current_user_id:
        user_liked = bool(
            db.session.execute(
                select(func.count(PostLike.id))
                .where(PostLike.post_id == post_id)
                .where(PostLike.user_id == current_user_id)
            ).scalar()
        )

    # author_username
    author_username: str = "알 수 없음"
    if post.author_id:
        author: User | None = db.session.get(User, post.author_id)
        if author:
            author_username = author.username

    # skip_count=False일 때만 commit (view_count +1 반영)
    if not skip_count:
        db.session.commit()

    d = post.to_dict()
    d["author_username"] = author_username
    d["comment_count"] = comment_count
    d["like_count"] = like_count
    d["user_liked"] = user_liked
    return jsonify({"success": True, "data": d, "error": ""}), 200


@posts_bp.route("", methods=["POST"])
@roles_required("admin", "editor")
def create_post() -> tuple:
    data: dict = request.get_json() or {}
    if not data.get("title"):
        return jsonify({"success": False, "data": {}, "error": "title is required"}), 400
    author_id: int = int(get_jwt_identity())

    # 유효성 검사
    raw_format = data.get("content_format", "html")
    content_format = raw_format if raw_format in ("html", "markdown") else "html"

    post = Post(
        title=data["title"],
        slug=data.get("slug", ""),
        content=data.get("content", ""),
        excerpt=data.get("excerpt", ""),
        status=data.get("status", "draft"),
        post_type=data.get("post_type", "post"),
        content_format=content_format,
        visibility=data.get("visibility", "public"),
        category_id=data.get("category_id"),
        author_id=author_id,
    )
    db.session.add(post)
    db.session.flush()  # post.id 생성 (commit 전)
    tag_ids: list = data.get("tags", [])
    if tag_ids:
        tags = db.session.execute(select(Tag).where(Tag.id.in_(tag_ids))).scalars().all()
        post.tags.extend(tags)
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"success": False, "data": {}, "error": "An internal error occurred."}), 500
    return jsonify({"success": True, "data": post.to_dict(), "error": ""}), 201


@posts_bp.route("/<int:post_id>", methods=["PUT"])
@roles_required("admin", "editor")
def update_post(post_id: int) -> tuple:
    current_user_id: int = int(get_jwt_identity())
    post: Post | None = db.session.get(Post, post_id)
    if not post:
        return jsonify({"success": False, "data": {}, "error": "Not found"}), 404
    user: User | None = db.session.get(User, current_user_id)
    if user and user.role != "admin" and post.author_id != current_user_id:
        return jsonify(
            {"success": False, "data": {}, "error": "본인 글만 수정할 수 있습니다."}
        ), 403
    data: dict = request.get_json() or {}
    for field in (
        "title",
        "slug",
        "content",
        "excerpt",
        "status",
        "post_type",
        "content_format",
        "visibility",
        "category_id",
    ):
        if field in data:
            if field == "content_format" and data[field] not in ("html", "markdown"):
                continue  # 유효하지 않은 값 무시
            if field == "visibility" and data[field] not in ("public", "members_only", "private"):
                continue  # 유효하지 않은 값 무시
            setattr(post, field, data[field])
    if "tags" in data:
        post.tags.clear()
        if data["tags"]:
            new_tags = (
                db.session.execute(select(Tag).where(Tag.id.in_(data["tags"]))).scalars().all()
            )
            post.tags.extend(new_tags)
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"success": False, "data": {}, "error": "An internal error occurred."}), 500
    return jsonify({"success": True, "data": post.to_dict(), "error": ""}), 200


@posts_bp.route("/<int:post_id>", methods=["DELETE"])
@roles_required("admin", "editor")
def delete_post(post_id: int) -> tuple:
    current_user_id: int = int(get_jwt_identity())
    post: Post | None = db.session.get(Post, post_id)
    if not post:
        return jsonify({"success": False, "data": {}, "error": "Not found"}), 404
    user: User | None = db.session.get(User, current_user_id)
    if user and user.role != "admin" and post.author_id != current_user_id:
        return jsonify(
            {"success": False, "data": {}, "error": "본인 글만 삭제할 수 있습니다."}
        ), 403
    db.session.delete(post)
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"success": False, "data": {}, "error": "An internal error occurred."}), 500
    return jsonify({"success": True, "data": {}, "error": ""}), 200


@posts_bp.route("/<int:post_id>/like", methods=["POST"])
@roles_required("editor", "admin")
def like_post(post_id: int) -> tuple:
    """추천 토글 — 로그인 사용자만, 본인 글 불가."""
    current_user_id: int = int(get_jwt_identity())

    post: Post | None = db.session.get(Post, post_id)
    if not post:
        return jsonify({"success": False, "data": {}, "error": "Not found"}), 404

    # 본인 글 추천 불가
    if post.author_id == current_user_id:
        return jsonify(
            {"success": False, "data": {}, "error": "본인 글은 추천할 수 없습니다."}
        ), 400

    existing: PostLike | None = db.session.execute(
        select(PostLike)
        .where(PostLike.post_id == post_id)
        .where(PostLike.user_id == current_user_id)
    ).scalar_one_or_none()

    if existing:
        db.session.delete(existing)
        liked = False
    else:
        db.session.add(PostLike(post_id=post_id, user_id=current_user_id))
        liked = True

    try:
        db.session.commit()
    except IntegrityError:
        # race condition: UniqueConstraint 위반 → 이미 추천됨
        db.session.rollback()
        liked = True

    like_count: int = (
        db.session.execute(
            select(func.count(PostLike.id)).where(PostLike.post_id == post_id)
        ).scalar()
        or 0
    )

    return jsonify(
        {"success": True, "data": {"liked": liked, "like_count": like_count}, "error": ""}
    ), 200
