from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
from .database import db

class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    role = db.Column(db.String(20), default='author', nullable=False)  # admin, editor, author
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # 관계 설정 (User가 삭제되면 작성한 글은 유지하거나 삭제 정책 결정 필요, 여기선 유지)
    posts = db.relationship('Post', backref='author', lazy=True)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'role': self.role,
            'created_at': self.created_at.isoformat()
        }

class Post(db.Model):
    __tablename__ = 'posts'

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    slug = db.Column(db.String(200), unique=True, nullable=False)  # URL 친화적 주소
    content = db.Column(db.Text, nullable=True)  # HTML or Markdown content
    status = db.Column(db.String(20), default='draft', nullable=False)  # draft, published
    author_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'slug': self.slug,
            'content': self.content,
            'status': self.status,
            'author_id': self.author_id,
            'author_name': self.author.username if self.author else None,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }

class Settings(db.Model):
    """
    Key-Value 저장소. 
    블로그 제목, 테마 설정, 페이지당 글 수 등 동적 설정을 저장합니다.
    """
    __tablename__ = 'settings'

    key = db.Column(db.String(100), primary_key=True)
    value = db.Column(db.Text, nullable=True)
    
    @staticmethod
    def get_value(key, default=None):
        setting = Settings.query.get(key)
        return setting.value if setting else default

    @staticmethod
    def set_value(key, value):
        setting = Settings.query.get(key)
        if setting:
            setting.value = value
        else:
            setting = Settings(key=key, value=value)
            db.session.add(setting)
        db.session.commit()

    def to_dict(self):
        return {
            'key': self.key,
            'value': self.value
        }