from flask import Flask, jsonify
from flask_cors import CORS
from config import DevelopmentConfig, ProductionConfig
from database import db
from extensions import migrate, jwt
import os

def create_app(config_class=None):
    app = Flask(__name__)

    # 환경 설정 로드
    if config_class is None:
        env = os.getenv('FLASK_ENV', 'development')
        config_class = ProductionConfig if env == 'production' else DevelopmentConfig
    
    app.config.from_object(config_class)

    # 확장 모듈 초기화
    db.init_app(app)
    CORS(app, origins=["http://localhost:5173"])
    migrate.init_app(app, db)
    jwt.init_app(app)

    # 기본 라우트 (Health Check)
    @app.route('/health')
    def health_check():
        return jsonify({"status": "ok", "service": "cms-backend"})

    # Blueprint 등록
    from api.auth import auth_bp
    app.register_blueprint(auth_bp, url_prefix='/api/auth')

    from api.settings import settings_bp
    app.register_blueprint(settings_bp)

    from api.posts import posts_bp
    app.register_blueprint(posts_bp)

    from api.media import media_bp
    app.register_blueprint(media_bp)

    from api.comments import comments_bp
    app.register_blueprint(comments_bp)

    return app

if __name__ == '__main__':
    app = create_app()
    app.run(host='0.0.0.0', port=5000)