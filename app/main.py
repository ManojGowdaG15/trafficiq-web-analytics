from functools import lru_cache
from fastapi import FastAPI
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from .db import engine, load_data

app = FastAPI(title="Website Traffic & SEO Analytics")
app.add_middleware(GZipMiddleware, minimum_size=500)
DIMS = {"traffic_source", "keyword", "device", "user_type", "landing_page", "country", "month", "exit_page"}


@app.on_event("startup")
def _seed():
    load_data()  # auto-seeds an empty database on first boot


def _where(f):
    clauses, binds = [], {}
    if f[0]: clauses.append("date >= :d1"); binds["d1"] = f[0]
    if f[1]: clauses.append("date <= :d2"); binds["d2"] = f[1]
    for i, col in enumerate(("traffic_source", "device", "user_type", "country")):
        if f[2 + i]: clauses.append(f"{col} = :{col}"); binds[col] = f[2 + i]
    return clauses, binds


def _agg(f, dims=(), extra=None, order=None, limit=None):
    assert all(d in DIMS for d in dims)
    clauses, binds = _where(f)
    if extra: clauses.append(extra)
    cols = ", ".join(dims)
    sql = f"""SELECT {cols + ',' if cols else ''} COUNT(*) AS sessions, SUM(is_conv) AS conversions,
      SUM(revenue) AS revenue, AVG(duration) AS avg_duration, AVG(pages) AS avg_pages, SUM(is_bounce) AS bounces,
      SUM(impressions) AS impressions, SUM(clicks) AS clicks, AVG(position) AS avg_position,
      SUM(position * impressions) AS weighted_position_sum
      FROM sessions {'WHERE ' + ' AND '.join(clauses) if clauses else ''}
      {'GROUP BY ' + cols if cols else ''} {'ORDER BY ' + order if order else ('ORDER BY ' + cols if cols else '')}
      {f'LIMIT {int(limit)}' if limit else ''}"""
    with engine.connect() as c:
        rows = [dict(r._mapping) for r in c.execute(text(sql), binds)]
    for r in rows:
        for k, v in r.items():
            if v is not None and k not in dims: r[k] = float(v)
        n = r["sessions"] or 1
        r["conv_rate"] = 100 * (r["conversions"] or 0) / n
        r["bounce_rate"] = 100 * (r["bounces"] or 0) / n
        r["rev_per_session"] = (r["revenue"] or 0) / n
        r["ctr"] = 100 * (r["clicks"] or 0) / r["impressions"] if r["impressions"] else 0
        r["weighted_position"] = r["weighted_position_sum"] / r["impressions"] if r["impressions"] else r["avg_position"]
        del r["weighted_position_sum"]
    return rows


@lru_cache(maxsize=256)
def _dashboard(f):
    a = lambda *d, **k: _agg(f, d, **k)
    total = a()
    return {
        "kpis": total[0] if total and total[0]["sessions"] else {},
        "source": a("traffic_source", order="sessions DESC"),
        "keyword": a("keyword", extra="keyword <> 'Not Provided'", order="impressions DESC"),
        "device": a("device", order="sessions DESC"),
        "user": a("user_type", order="sessions DESC"),
        "landing": a("landing_page", order="sessions DESC"),
        "country": a("country", order="sessions DESC"),
        "month": a("month"),
        "exit": a("exit_page", order="sessions DESC", limit=8),
        "heat_device": a("traffic_source", "device"),
        "heat_country": a("traffic_source", "country"),
    }


@app.get("/api/meta")
def meta():
    out = {}
    with engine.connect() as c:
        for col in ("traffic_source", "device", "user_type", "country"):
            out[col] = [r[0] for r in c.execute(text(f"SELECT DISTINCT {col} FROM sessions ORDER BY 1"))]
        out["min_date"], out["max_date"] = c.execute(text("SELECT MIN(date), MAX(date) FROM sessions")).one()
    return out


@app.get("/api/dashboard")
def dashboard(date_from: str = "", date_to: str = "", source: str = "", device: str = "",
              user_type: str = "", country: str = ""):
    return _dashboard((date_from, date_to, source, device, user_type, country))


@app.get("/api/health")
def health():
    return {"status": "ok"}


app.mount("/", StaticFiles(directory="static", html=True), name="static")
