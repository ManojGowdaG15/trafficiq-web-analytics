"""One-time: convert the Excel 'Cleaned_data' sheet into a compact, DB-ready CSV (data/website_traffic.csv.gz)."""
import sys, pandas as pd
src = sys.argv[1] if len(sys.argv) > 1 else "Website_Traffic_SEO_Analytics.xlsx"
df = pd.read_excel(src, sheet_name="Cleaned_data")
bad = (df[["Clicks_Impressions_Check", "CTR_Check", "Conversion_Revenue_Check"]] != "Valid").any(axis=1)
# Keep every row so totals match the Excel dashboards; flagged rows are only reported.
out = pd.DataFrame({
    "date": df.Date.dt.strftime("%Y-%m-%d"), "month": df.Date.dt.strftime("%Y-%m"),
    "session_id": df.Session_ID, "user_type": df.User_Type, "traffic_source": df.Traffic_Source,
    "device": df.Device, "country": df.Country, "landing_page": df.Landing_Page, "keyword": df.Keyword,
    "pages": df.Pages_Per_Session, "duration": df.Session_Duration_Sec,
    "is_bounce": (df.Bounce == "Yes").astype(int), "is_conv": (df.Conversion == "Yes").astype(int),
    "impressions": df.Impressions, "clicks": df.Organic_Clicks, "position": df.Avg_Position,
    "search_volume": df.Search_Volume, "exit_page": df.Exit_Page, "revenue": df.Revenue.round(2)})
out.to_csv("data/website_traffic.csv.gz", index=False)
print(f"{len(out):,} rows written ({bad.sum():,} rows flagged by Excel quality checks, kept for parity)")
