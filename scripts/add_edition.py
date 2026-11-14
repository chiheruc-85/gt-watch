#!/usr/bin/env python3
"""Add (or replace) one daily edition and rebuild feed.xml.

Usage:  python3 scripts/add_edition.py path/to/new_edition.json [--site-url URL]

new_edition.json is one edition object:
{ "date": "YYYY-MM-DD", "period": "...", "summary": "...",
  "ideas": [ {"title","angle","draft","tags":[...],"refs":[0,1]} x3 ],
  "news":  [ {"date":"MM/DD","cat":"政策","title","summary","source","url","ctx":true?}, ... ] }
"""
import json, sys, re, pathlib
from datetime import datetime, timezone, timedelta
from xml.sax.saxutils import escape

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "editions.json"
FEED = ROOT / "feed.xml"
MAX_EDITIONS = 365
CATS = {"政策", "受注", "海外", "企業", "技術", "市場"}


def fail(msg):
    sys.exit("ERROR: " + msg)


def validate(e):
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(e.get("date", ""))):
        fail("date must be YYYY-MM-DD")
    ideas, news = e.get("ideas"), e.get("news")
    if not isinstance(ideas, list) or len(ideas) != 3:
        fail("ideas must be a list of exactly 3")
    if not isinstance(news, list) or len(news) < 1:
        fail("news must be a non-empty list")
    for i, n in enumerate(news):
        for k in ("date", "title", "source", "url"):
            if not n.get(k):
                fail(f"news[{i}].{k} is missing")
        if not str(n["url"]).startswith(("http://", "https://")):
            fail(f"news[{i}].url must be http(s)")
        if n.get("cat") and n["cat"] not in CATS:
            fail(f"news[{i}].cat must be one of {sorted(CATS)}")
    for i, it in enumerate(ideas):
        for k in ("title", "angle", "draft"):
            if not it.get(k):
                fail(f"ideas[{i}].{k} is missing")
        for r in it.get("refs", []):
            if not (isinstance(r, int) and 0 <= r < len(news)):
                fail(f"ideas[{i}].refs has an invalid index {r}")


def build_feed(editions, site_url):
    cst = timezone(timedelta(hours=8))
    items = []
    for e in editions[:30]:
        top = next((n for n in e["news"] if not n.get("ctx")), e["news"][0])
        d = datetime.strptime(e["date"], "%Y-%m-%d").replace(hour=7, tzinfo=cst)
        link = f"{site_url}#d-{e['date'].replace('-', '')}"
        desc = (e.get("summary", "") + " ／ 投稿案: " + " / ".join(i["title"] for i in e["ideas"]))
        items.append(
            "<item>"
            f"<title>{escape(e['date'] + '号｜' + top['title'])}</title>"
            f"<link>{escape(link)}</link><guid isPermaLink=\"false\">gt-watch-{e['date']}</guid>"
            f"<pubDate>{d.strftime('%a, %d %b %Y %H:%M:%S %z')}</pubDate>"
            f"<description>{escape(desc)}</description></item>"
        )
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel>'
        "<title>中国ガスタービン・ウォッチ</title>"
        f"<link>{escape(site_url)}</link>"
        "<description>中国ガスタービン業界ニュースと投稿アイデア（毎朝更新）</description>"
        "<language>ja</language>" + "".join(items) + "</channel></rss>\n"
    )


def main():
    args = sys.argv[1:]
    if not args:
        fail(__doc__)
    site_url = "https://chiheruc-85.github.io/gt-watch/"
    if "--site-url" in args:
        site_url = args[args.index("--site-url") + 1]
    new = json.loads(pathlib.Path(args[0]).read_text(encoding="utf-8"))
    validate(new)
    data = json.loads(DATA.read_text(encoding="utf-8")) if DATA.exists() else {"editions": []}
    eds = [e for e in data["editions"] if e.get("date") != new["date"]]
    eds.append(new)
    eds.sort(key=lambda e: e["date"], reverse=True)
    eds = eds[:MAX_EDITIONS]
    DATA.write_text(json.dumps({"editions": eds}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    FEED.write_text(build_feed(eds, site_url), encoding="utf-8")
    print(f"OK: {new['date']} saved; {len(eds)} editions total")


if __name__ == "__main__":
    main()
