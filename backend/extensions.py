from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager
from models.schema import Base

# SQLAlchemy 3.x+ 스타일: 기존에 정의한 DeclarativeBase(Base)를 model_class로 지정
db = SQLAlchemy(model_class=Base)

migrate = Migrate()
jwt = JWTManager()