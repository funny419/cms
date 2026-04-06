import os

from flask import Blueprint, Response, request
from sqlalchemy import select

from database import db
from models.schema import Post, User

feeds_bp = Blueprint("feeds", __name__)


@feeds_bp.route("/blog/<username>/feed.xml", methods=["GET"])
def rss_feed(username: str) -> Response:
    user = db.session.execute(select(User).where(User.username == username)).scalar_one_or_none()
    if not user or user.role == "deactivated":
        return Response("Not found", status=404)

    posts = (
        db.session.execute(
            select(Post)
            .where(Post.author_id == user.id)
            .where(Post.status == "published")
            .where(Post.visibility == "public")
            .order_by(Post.created_at.desc())
            .limit(20)
        )
        .scalars()
        .all()
    )

    base_url = os.environ.get("SITE_URL", request.host_url.rstrip("/"))
    items = ""
    for p in posts:
        pub_date = p.created_at.strftime("%a, %d %b %Y %H:%M:%S +0000") if p.created_at else ""
        desc = (p.excerpt or "")[:200]
        items += f"""
    <item>
      <title><![CDATA[{p.title}]]></title>
      <link>{base_url}/posts/{p.id}</link>
      <description><![CDATA[{desc}]]></description>
      <pubDate>{pub_date}</pubDate>
      <guid>{base_url}/posts/{p.id}</guid>
    </item>"""

    blog_title = user.blog_title or f"{user.username}의 블로그"
    xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title><![CDATA[{blog_title}]]></title>
    <link>{base_url}/blog/{username}</link>
    <description><![CDATA[{user.bio or blog_title}]]></description>
    <language>ko</language>{items}
  </channel>
</rss>"""
    return Response(xml, content_type="application/rss+xml; charset=utf-8")
