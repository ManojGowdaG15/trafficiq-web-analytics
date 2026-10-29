import os
import pandas as pd
from sqlalchemy import create_engine, inspect, text

CSV = os.path.join(os.path.dirname(__file__), "..", "data", "website_traffic.csv.gz")
URL = os.getenv("DATABASE_URL", "sqlite:///./data/analytics.db")
# Neon / Supabase / Render hand out postgres:// URLs; SQLAlchemy needs the driver name
for old in ("postgres://", "postgresql://"):
    if URL.startswith(old):
        URL = URL.replace(old, "postgresql+psycopg2://", 1)
engine = create_engine(URL, pool_pre_ping=True)


def load_data(force: bool = False) -> int:
    """Create the `sessions` table from the CSV (idempotent unless force=True)."""
    insp = inspect(engine)
    if insp.has_table("sessions") and not force:
        with engine.connect() as c:
            n = c.execute(text("SELECT COUNT(*) FROM sessions")).scalar()
        if n:
            return n
    df = pd.read_csv(CSV)
    df.to_sql("sessions", engine, if_exists="replace", index=False, chunksize=5000)
    with engine.begin() as c:
        for col in ("date", "month", "traffic_source", "device", "country", "user_type", "landing_page"):
            c.execute(text(f"CREATE INDEX IF NOT EXISTS ix_sessions_{col} ON sessions ({col})"))
    return len(df)


if __name__ == "__main__":
    print(f"Loaded {load_data(force=True):,} rows into {engine.url.render_as_string(hide_password=True)}")
