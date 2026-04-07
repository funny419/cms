import os

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    # python-dotenv 패키지가 없는 경우(Docker 등)에도 실행되도록 처리
    pass


class Config:
    """Base Configuration"""

    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key-change-in-prod")
    MAX_CONTENT_LENGTH = 10 * 1024 * 1024  # 10MB

    # Database
    # MariaDB Connector/J 사용 권장 (pymysql)
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DATABASE_URL", "mysql+pymysql://funnycms:funnycms@localhost:3306/cms_db"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # JWT
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "jwt-secret-key-change-in-prod")
    JWT_ACCESS_TOKEN_EXPIRES = 3600  # 1 hour


class DevelopmentConfig(Config):
    DEBUG = True


class ProductionConfig(Config):
    DEBUG = False
    # 환경변수 미설정 시 None → Flask/JWT 시작 시 즉시 에러 발생 (의도적)
    SECRET_KEY = os.getenv("SECRET_KEY")
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
