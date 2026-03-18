from flask_sqlalchemy import SQLAlchemy

# 순환 참조 방지를 위해 db 객체 정의를 별도 파일로 분리
db = SQLAlchemy()