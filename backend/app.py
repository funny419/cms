from flask import Flask, jsonify
from backend.config import DevelopmentConfig, ProductionConfig
from backend.extensions import db, migrate, jwt
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
    migrate.init_app(app, db)
    jwt.init_app(app)

    # 기본 라우트 (Health Check)
    @app.route('/health')
    def health_check():
        return jsonify({"status": "ok", "service": "cms-backend"})

    # Blueprint 등록
    from backend.api.auth import auth_bp
    app.register_blueprint(auth_bp, url_prefix='/api/auth')

    return app

if __name__ == '__main__':
    app = create_app()
    app.run(host='0.0.0.0', port=5000)