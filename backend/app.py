import os

from flask import Flask, jsonify
from flask_cors import CORS
from flask_migrate import upgrade as db_upgrade

from config import DevelopmentConfig, ProductionConfig
from database import db
from extensions import jwt, migrate


def create_app(config_class=None):
    app = Flask(__name__)

    # 환경 설정 로드
    if config_class is None:
        env = os.getenv("FLASK_ENV", "development")
        config_class = ProductionConfig if env == "production" else DevelopmentConfig

    app.config.from_object(config_class)

    # 확장 모듈 초기화
    db.init_app(app)
    CORS(app, origins=["http://localhost:5173"])
    migrate.init_app(app, db)
    jwt.init_app(app)

    # 앱 시작 시 마이그레이션 자동 적용
    # 테이블이 이미 존재하는 경우(alembic_version 미설정) 경고만 출력하고 계속 진행
    with app.app_context():
        if not app.config.get("TESTING"):  # 테스트 환경에서는 migrate 스킵
            try:
                db_upgrade()
            except Exception as e:
                print(f"[WARNING] DB migration skipped: {e}")
                print("[WARNING] Run 'flask db stamp head' on the server to fix this.")

    # 기본 라우트 (Health Check)
    @app.route("/health")
    def health_check():
        return jsonify({"status": "ok", "service": "cms-backend"})

    # Blueprint 등록
    from api.auth import auth_bp

    app.register_blueprint(auth_bp, url_prefix="/api/auth")

    from api.settings import settings_bp

    app.register_blueprint(settings_bp)

    from api.posts import posts_bp

    app.register_blueprint(posts_bp)

    from api.media import media_bp

    app.register_blueprint(media_bp)

    from api.comments import comments_bp

    app.register_blueprint(comments_bp)

    from api.menus import menus_bp

    app.register_blueprint(menus_bp)

    from api.admin import admin_bp

    app.register_blueprint(admin_bp)

    from api.tags import tags_bp

    app.register_blueprint(tags_bp)

    from api.categories import categories_bp

    app.register_blueprint(categories_bp)

    from api.follows import feed_bp, follows_bp

    app.register_blueprint(follows_bp)
    app.register_blueprint(feed_bp)

    from api.feeds import feeds_bp

    app.register_blueprint(feeds_bp)

    from api.series import series_bp

    app.register_blueprint(series_bp)

    return app


if __name__ == "__main__":
    app = create_app()
    app.run(host="0.0.0.0", port=5000)
