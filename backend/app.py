import os
from flask import Flask, jsonify
from flask_cors import CORS
from database import db
from models import User, Post, Settings

def create_app():
    app = Flask(__name__)

    # 환경 변수 로드
    app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL')
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev_key')

    # CORS 설정 (프론트엔드 포트 허용)
    CORS(app, resources={r"/api/*": {"origins": ["http://localhost:5173"]}})

    # DB 초기화
    db.init_app(app)

    # 애플리케이션 컨텍스트 내에서 테이블 생성 (개발 편의용, 실제 배포 시엔 마이그레이션 도구 권장)
    with app.app_context():
        db.create_all()

    @app.route('/')
    def health_check():
        return jsonify({
            "status": "ok",
            "service": "CMS Backend",
            "database": "connected" # 실제 연결 체크 로직 추가 권장
        })

    @app.route('/api/install-check')
    def check_install():
        # 설치 여부 확인 로직 (예: 관리자 계정 존재 여부)
        is_installed = User.query.first() is not None
        return jsonify({"installed": is_installed})

    return app

if __name__ == '__main__':
    app = create_app()
    app.run(host='0.0.0.0', port=5000)