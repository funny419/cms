import os

class Config:
    """
    Application Configuration
    .gemini.md Rule: Type Hints required, No hardcoded secrets.
    """
    
    # Security
    SECRET_KEY: str = os.environ.get('SECRET_KEY', 'dev_key_for_local_only')
    
    # Database
    SQLALCHEMY_TRACK_MODIFICATIONS: bool = False

    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        """
        Constructs the Database URL.
        Priority:
        1. DATABASE_URL env var (Docker environment)
        2. Constructed from individual vars (Local environment, default port 4807)
        """
        env_url: str | None = os.environ.get('DATABASE_URL')
        if env_url:
            return env_url

        # Local Development Defaults
        user: str = os.environ.get('CMS_DB_USER', 'funnycms')
        password: str = os.environ.get('CMS_DB_APP_PASSWORD', 'change_this_to_secure_app_password')
        host: str = os.environ.get('DB_HOST', 'localhost')
        port: str = os.environ.get('DB_PORT', '4807') # Docker mapped port
        db_name: str = os.environ.get('CMS_DB_NAME', 'cmsdb')

        return f"mysql+pymysql://{user}:{password}@{host}:{port}/{db_name}"