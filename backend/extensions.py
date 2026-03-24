from flask_migrate import Migrate
from flask_jwt_extended import JWTManager
from database import db  # 단일 db 인스턴스 (model_class=Base 포함)

migrate = Migrate()
jwt = JWTManager()