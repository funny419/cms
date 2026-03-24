from flask_sqlalchemy import SQLAlchemy
from models.schema import Base

# 순환 참조 방지를 위해 db 객체 정의를 별도 파일로 분리
# SQLAlchemy 3.x+ 스타일: model_class=Base 로 ORM 모델과 연결
db = SQLAlchemy(model_class=Base)