"""
build_gallery.py — Generate the crawlable static /gallery/ for stockflow.media.

Why this exists: the storefront is a JS SPA, so crawlers see zero images.
This reads the SAME Google Sheet the storefront uses and emits fully static,
SEO-complete HTML — a gallery landing page, one page per category, one per
subcategory (paginated), and ONE PAGE PER ASSET — where every asset is a real
<img> and every buy action deep-links to the storefront modal (?v=<File_ID>).

Every page carries: unique <title>/description/canonical/OG, BreadcrumbList,
and ImageObject/VideoObject JSON-LD with license + copyrightNotice +
acquireLicensePage. Asset pages add Product+Offer JSON-LD with the real price.

Outputs (repo root):
  gallery/index.html                     landing (category tiles)
  gallery/<cat>/index.html               category (collection tiles)
  gallery/<cat>/<sub>/index.html…        asset grids (paginated ×PER_PAGE)
  gallery/a/<File_ID>.html               per-asset landing pages
  gallery/gallery.css
  sitemap-gallery.xml                    category/subcategory page URLs
  sitemap-assets.xml                     per-asset page URLs
  sitemap-images-gallery.xml             Google image sitemap
  robots.txt

Usage:  python tools/build_gallery.py             (fetch sheet + build)
        python tools/build_gallery.py --csv x.csv (build from a saved CSV)

Files are only rewritten when content changed, so repeat syncs keep git fast.
"""
from __future__ import annotations

import argparse
import csv
import html
import io
import json
import re
import sys
import urllib.request
from collections import OrderedDict
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

ROOT = Path(__file__).resolve().parent.parent
SITE = "https://stockflow.media"
SHEET_CSV_URL = ("https://docs.google.com/spreadsheets/d/"
                 "12eyXAI9-hT0TFSx2HhVDUWHXo4X9QVT-vSPmGQBx6c8/export?format=csv&gid=65282458")
LICENSE_URL = "https://help.stockflow.media/license/"
COPYRIGHT = "© NMedia Services & Stockflow.media — All rights reserved."
CREDIT = "Stockflow.media"
PER_PAGE = 200          # assets per subcategory page (keeps HTML + JSON-LD lean)
RELATED_N = 8           # related assets shown on each asset page
VIDEO_EXTS = (".mp4", ".mov", ".m4v", ".webm")

_written = {"new": 0, "same": 0}


def wfile(path: Path, content: str):
    """Write only when changed — keeps git status/commits cheap on re-syncs."""
    if path.exists():
        try:
            if path.read_text(encoding="utf-8") == content:
                _written["same"] += 1
                return
        except Exception:
            pass
    path.write_text(content, encoding="utf-8")
    _written["new"] += 1


# ---------------------------------------------------------------- helpers
def slug(text: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", (text or "").lower())
    return s.strip("-") or "misc"


def esc(s: str) -> str:
    return html.escape(str(s or ""), quote=True)


def is_video(url: str) -> bool:
    return (url or "").split("?")[0].lower().endswith(VIDEO_EXTS)


def upload_date(file_id: str) -> str:
    m = re.match(r"(\d{4})(\d{2})(\d{2})", file_id or "")
    return f"{m.group(1)}-{m.group(2)}-{m.group(3)}" if m else "2026-01-01"


def price_fmt(p: str) -> str:
    try:
        return f"${float(p):,.2f}"
    except Exception:
        return p


def fetch_rows(csv_path: str | None):
    if csv_path:
        text = Path(csv_path).read_text(encoding="utf-8-sig")
    else:
        print("Fetching sheet CSV…", flush=True)
        req = urllib.request.Request(SHEET_CSV_URL, headers={"User-Agent": "Mozilla/5.0"})
        text = urllib.request.urlopen(req, timeout=120).read().decode("utf-8-sig")
    rows = list(csv.DictReader(io.StringIO(text)))
    print(f"Sheet rows: {len(rows)}", flush=True)
    return rows


def load_assets(rows):
    """Rows -> asset dicts, grouped Category -> Subcategory -> [assets]."""
    tree: "OrderedDict[str, OrderedDict[str, list]]" = OrderedDict()
    skipped = 0
    seen_ids = set()
    for r in rows:
        fid = (r.get("File_ID") or "").strip()
        thumb = (r.get("Thumbnail_URL") or "").strip()
        preview = (r.get("Preview_URL") or "").strip()
        cat = (r.get("Category") or "").strip()
        sub = (r.get("Catagory_Sub") or "").strip()
        if not (fid and (thumb or preview) and cat and sub) or fid in seen_ids:
            skipped += 1
            continue
        seen_ids.add(fid)
        a = {
            "id": fid,
            "title": (r.get("SEO_Title") or r.get("Title") or fid).strip(),
            "desc": (r.get("Meta_Description") or r.get("Description") or "").strip(),
            "alt": (r.get("Alt_Text") or r.get("Title") or "").strip(),
            "thumb": thumb or preview,
            "preview": preview or thumb,
            "keywords": (r.get("Keywords") or r.get("Tags") or "").strip(),
            "price": (r.get("Price") or "").strip(),
            "res": (r.get("Resolution") or "").strip(),
            "fmt": (r.get("Format") or "").strip(),
            "leaf": (r.get("Sub") or "").strip(),
            "featured": (r.get("Featured") or "").strip().lower() in ("1", "true", "yes", "y"),
            "video": is_video(preview),
            "buy": f"{SITE}/?v={fid}",
            "page": f"{SITE}/gallery/a/{fid}.html",
        }
        m = re.search(r"_([^_]+)_\.[a-z0-9]+$", (r.get("HighRes_Filename") or "").strip(), re.I)
        a["filefmt"] = m.group(1) if m else ""
        tree.setdefault(cat, OrderedDict()).setdefault(sub, []).append(a)
    if skipped:
        print(f"Skipped {skipped} rows (missing id/urls/category or duplicate id)", flush=True)
    return tree


# ---------------------------------------------------------------- json-ld
def media_node(a):
    node = {
        "@type": "VideoObject" if a["video"] else "ImageObject",
        "name": a["title"],
        "description": a["desc"] or a["title"],
        "contentUrl": a["preview"],
        "thumbnailUrl": a["thumb"],
        "url": a["page"],
        "acquireLicensePage": a["page"],
        "license": LICENSE_URL,
        "copyrightNotice": COPYRIGHT,
        "creditText": CREDIT,
        "creator": {"@type": "Organization", "name": CREDIT},
    }
    if a["keywords"]:
        node["keywords"] = a["keywords"]
    if a["video"]:
        node["uploadDate"] = upload_date(a["id"])
    return node


def product_node(a):
    try:
        price = f"{float(a['price']):.2f}"
    except Exception:
        return None
    return {
        "@type": "Product",
        "name": a["title"],
        "image": a["preview"],
        "description": a["desc"] or a["title"],
        "sku": a["id"],
        "brand": {"@type": "Brand", "name": CREDIT},
        "offers": {
            "@type": "Offer",
            "url": a["buy"],
            "price": price,
            "priceCurrency": "USD",
            "availability": "https://schema.org/InStock",
        },
    }


def jsonld_breadcrumb(parts):
    return {"@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": i, "name": n, "item": u}
        for i, (n, u) in enumerate(parts, 1)]}


# ---------------------------------------------------------------- markup
NAV_HTML = ""   # the REAL site header, extracted from index.html by extract_site_nav()


def extract_site_nav():
    """Slice the storefront's <nav> out of index.html so every gallery page
    carries the IDENTICAL header (logo, Gallery link, search, wallet widget) —
    same markup, same ids, so js/wallet.js + auth.js light it up exactly like
    on the homepage. Asset paths are made root-absolute."""
    global NAV_HTML
    src = ROOT / "index.html"
    html_text = src.read_text(encoding="utf-8")
    start = html_text.find('<nav class="bg-white')
    end = html_text.find("</nav>", start)
    if start == -1 or end == -1:
        print("WARN: site <nav> not found in index.html — gallery keeps previous header", flush=True)
        return
    NAV_HTML = html_text[start:end + len("</nav>")].replace('src="./assets/', 'src="/assets/')
    print(f"site nav extracted: {len(NAV_HTML)/1024:.1f} KB (inlined into every gallery page)", flush=True)


def account_bar():
    """Two-row gallery header (approved sample). Row 1 = logo + account chips +
    Browse&Buy; ids match js/wallet.js so the eager-loaded stack lights it up.
    All chips are grey (wallet-display theme); no bright-orange buttons."""
    search_svg = ('<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="none" '
                  'viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" '
                  'stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>')
    return f"""<div class="g-banner">
  <a class="g-brand" href="{SITE}/gallery/">
    <img src="/assets/logo_SF.webp" alt="Stockflow.media logo" onerror="this.style.display='none'">
    <span>Stockflow<b>.media</b></span>
  </a>
  <a class="g-chip g-navbtn" href="{SITE}/" title="Search all assets">{search_svg} Search</a>
  <div class="g-spacer"></div>
  <div class="g-acct">
    <button id="loginButton" class="g-chip" onclick="shopOpen('login')">Sign In</button>
    <div id="walletDisplay" style="display:none;">
      <div class="g-acct-in">
        <div class="g-chip" onclick="shopOpen('refresh')" title="Click to refresh balance">
          <span class="lbl">Wallet</span><span id="walletAmount" class="amt">$0.00</span>
        </div>
        <button class="g-chip" onclick="shopOpen('history')" title="My Purchases &amp; downloads">My Purchases</button>
        <button class="g-chip accent" onclick="shopOpen('topup')"><span class="plus">＋</span> Add Funds</button>
        <div style="position:relative;">
          <button id="userMenuButton" class="g-chip" onclick="toggleUserMenu()">
            <span id="userEmailDisplay" class="email"></span> ▾
          </button>
          <div id="userMenu" style="display:none;position:absolute;right:0;top:100%;margin-top:5px;background:#1F2933;border:1px solid #3A3F46;border-radius:6px;box-shadow:0 6px 14px rgba(0,0,0,0.4);min-width:170px;z-index:100;">
            <a href="#" onclick="logout();return false;" style="display:block;padding:10px 15px;color:#EF4444;text-decoration:none;font-size:13px;">Logout</a>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>"""


def page_shell(*, title, desc, canonical, og_image, breadcrumb, body, extra_graph=None,
               prev_url=None, next_url=None, depth=2, head_extra="", pager_html=""):
    rel = "../" * depth
    graph = [jsonld_breadcrumb(breadcrumb)]
    if extra_graph:
        graph.extend(extra_graph)
    ld = json.dumps({"@context": "https://schema.org", "@graph": graph}, ensure_ascii=False)
    links = ""
    if prev_url:
        links += f'<link rel="prev" href="{esc(prev_url)}">\n  '
    if next_url:
        links += f'<link rel="next" href="{esc(next_url)}">\n  '
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  {head_extra}<title>{esc(title)}</title>
  <meta name="description" content="{esc(desc)}">
  <link rel="canonical" href="{esc(canonical)}">
  {links}<meta property="og:type" content="website">
  <meta property="og:title" content="{esc(title)}">
  <meta property="og:description" content="{esc(desc)}">
  <meta property="og:url" content="{esc(canonical)}">
  <meta property="og:image" content="{esc(og_image)}">
  <meta property="og:site_name" content="Stockflow.media">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="icon" href="{rel}assets/SF_Favicon.webp">
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="/css/styles.css?v=4">
  <link rel="stylesheet" href="/css/theme.css?v=4">
  <link rel="stylesheet" href="{rel}gallery/gallery.css?v=4">
  <link rel="stylesheet" href="{rel}gallery/shop.css?v=2">
  <script src="/gallery/shop.js?v=5" defer></script>
  <script type="application/ld+json">{ld}</script>
</head>
<body>
{account_bar()}
<div class="g-subbar">
  <nav class="g-crumbs">{" <span>›</span> ".join(f'<a href="{esc(u)}">{esc(n)}</a>' for n, u in breadcrumb)}</nav>
  {pager_html}
</div>
<main class="g-main">
{body}
</main>
<footer class="g-foot">
  <p>
    <a href="https://help.stockflow.media/mission/" onclick="shopOpen('about');return false;">About</a> ·
    <a href="{LICENSE_URL}" onclick="shopOpen('license');return false;">License Terms</a> ·
    <a href="https://help.stockflow.media/">Help</a> ·
    <a href="{SITE}/">Search &amp; Buy</a>
  </p>
  <p>All previews &amp; thumbnails {esc(COPYRIGHT)} — instant download, royalty-free.</p>
</footer>
</body>
</html>
"""


def card(a):
    """Grid card: image+caption -> asset page (SEO), License pill -> buy modal."""
    badge = '<span class="g-badge">▶ video</span>' if a["video"] else ""
    meta_bits = " · ".join(b for b in (a["res"], a["fmt"].upper() if a["fmt"] else "") if b)
    price = f'<span class="g-price">{esc(price_fmt(a["price"]))}</span>' if a["price"] else ""
    return f"""<div class="g-card">
  <a class="g-img" href="{esc(a['page'])}"><img src="{esc(a['thumb'])}" alt="{esc(a['alt'] or a['title'])}" loading="lazy" decoding="async">{badge}</a>
  <a class="g-lic" href="{esc(a['page'])}" title="View &amp; license this asset">License</a>
  <a class="g-cap" href="{esc(a['page'])}"><span class="g-t">{esc(a['title'])}</span><span class="g-m">{esc(meta_bits)}{price}</span></a>
</div>"""


def tile(name, url, cover, count, kind):
    return f"""<a class="g-tile" href="{esc(url)}">
  <img src="{esc(cover)}" alt="{esc(name)} — {kind} preview" loading="lazy" decoding="async">
  <span class="g-cap"><span class="g-t">{esc(name)}</span><span class="g-m">{count} assets</span></span>
</a>"""


def pager(base_url, page, pages):
    if pages <= 1:
        return ""
    links = []
    for p in range(1, pages + 1):
        u = base_url if p == 1 else f"{base_url}page-{p}.html"
        cls = ' class="on"' if p == page else ""
        links.append(f'<a{cls} href="{esc(u)}">{p}</a>')
    return f'<nav class="g-pager">Page: {" ".join(links)}</nav>'


def asset_body(a, cat, cat_url, sub, sub_url, related):
    kind = "4K Stock Video" if a["video"] else "Stock Image"
    chips = "".join(f"<span>{esc(k.strip())}</span>"
                    for k in (a["keywords"] or "").split(",") if k.strip())
    meta_rows = "".join(
        f"<tr><td>{esc(k)}</td><td>{esc(v)}</td></tr>"
        for k, v in (("Asset ID", a["id"]), ("Resolution", a["res"]),
                     ("Format", a["fmt"].upper()), ("Type", "Video" if a["video"] else "Image"),
                     ("Collection", a["leaf"] or sub)) if v)
    price_line = f' — <b>{esc(price_fmt(a["price"]))}</b>' if a["price"] else ""
    media = (f'<video controls preload="metadata" poster="{esc(a["thumb"])}" src="{esc(a["preview"])}"></video>'
             if a["video"] else
             f'<img src="{esc(a["preview"])}" alt="{esc(a["alt"] or a["title"])}" fetchpriority="high">')
    rel_cards = "".join(card(r) for r in related)
    rel_block = (f'<h2 class="g-sec">Related assets in {esc(sub)}</h2>'
                 f'<div class="g-grid">{rel_cards}</div>') if related else ""
    # Full SPA-shaped video object so js/modals.js openModal() renders the SAME
    # purchase modal as the storefront (wallet.js handlePurchase reads it too)
    asset_json = json.dumps({
        "id": a["id"], "title": a["title"], "price": a["price"] or "1",
        "category": cat, "subcategory": sub, "sub": a["leaf"],
        "description": a["desc"], "thumbnail": a["thumb"], "preview": a["preview"],
        "format": a["fmt"], "resolution": a["res"], "tags": a["keywords"],
        "fileFormat": a.get("filefmt", ""),
    }, ensure_ascii=False).replace("</", "<\\/")
    return f"""<div class="g-hero">
  <div class="g-media">{media}</div>
  <div class="g-info">
    <h1>{esc(a['title'])}</h1>
    <p class="lead">{esc(a['desc'] or a['title'])}</p>
    <a class="g-buy" id="buyBtn" href="{esc(a['buy'])}">License this {('clip' if a['video'] else 'image')}{price_line}</a>
    <p class="g-note">Royalty-free · pay once, use forever · instant full-resolution download ·
    <a href="{LICENSE_URL}" onclick="shopOpen('license');return false;">license terms</a></p>
    <table class="g-meta">{meta_rows}</table>
    <p class="g-note">Browse more: <a href="{esc(sub_url)}">{esc(sub)}</a> · <a href="{esc(cat_url)}">{esc(cat)}</a></p>
  </div>
</div>
<div class="g-chips">{chips}</div>
{rel_block}
<script type="application/json" id="assetData">{asset_json}</script>"""


GALLERY_CSS = """/* Stockflow gallery — static, matches theme.css (dark charcoal + burnt orange) */
:root{--bg:#111;--panel:#1F2933;--card:#2A2F36;--line:#3A3F46;--txt:#F3F4F6;--mut:#9CA3AF;--acc:#F97316;--acch:#FB923C}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--txt);font-family:ui-sans-serif,system-ui,"Segoe UI",sans-serif}
/* styles.css adds body padding-top for the home's fixed nav — gallery has no fixed nav, kill the blank gap */
body{padding-top:0 !important}
a{color:var(--acc);text-decoration:none}a:hover{color:var(--acch)}
/* styles.css pins every <nav> fixed+white (site header) — our navs must stay in flow */
nav.g-crumbs,nav.g-pager{position:static !important;top:auto !important;width:auto !important;height:auto !important;background:transparent !important;box-shadow:none !important;z-index:auto !important;border:0 !important}
/* ROW 1 — brand banner (above all) */
.g-banner{display:flex;align-items:center;gap:10px 14px;padding:11px 24px;background:#0b0b0b;border-bottom:1px solid var(--line);position:sticky;top:0;z-index:20;flex-wrap:wrap}
.g-brand{display:flex;align-items:center;gap:9px;color:var(--txt);font-size:18px;font-weight:700;white-space:nowrap}
.g-brand img{height:32px;width:auto}.g-brand b{color:var(--acc)}
.g-spacer{flex:1}
.g-acct{display:flex;align-items:center;gap:8px;flex-wrap:nowrap}
.g-acct-in{display:flex;align-items:center;gap:8px;flex-wrap:nowrap}
/* every account control = grey chip (wallet-display theme); no bright-orange buttons */
.g-chip{display:inline-flex;align-items:center;gap:6px;background:var(--card);border:1px solid var(--line);color:var(--txt);padding:7px 13px;font-size:12.5px;font-weight:600;border-radius:7px;cursor:pointer;white-space:nowrap;line-height:1}
.g-chip:hover{border-color:var(--acc)}
.g-chip .lbl{font-size:11px;color:var(--mut);text-transform:uppercase;letter-spacing:.4px}
.g-chip .amt{color:var(--acc);font-size:14px;font-weight:700}
/* actionable chips (Add Funds) = grey WALLET theme with orange text */
.g-chip.accent{color:var(--acc)}
.g-chip.accent .plus{font-size:15px;font-weight:800;line-height:1}
.g-acct .email{max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
/* Search nav-button — grey chip, white text + lens line icon (matches My Purchases / home Gallery button) */
.g-navbtn{color:var(--txt) !important;text-decoration:none}
.g-navbtn svg{display:block}
/* ROW 2 — breadcrumb (left) + pager (right) */
.g-subbar{display:flex;align-items:center;gap:14px;padding:8px 24px;background:var(--panel);border-bottom:1px solid var(--line);flex-wrap:wrap}
.g-crumbs{flex:1;font-size:13px;color:var(--mut);display:flex;gap:6px;flex-wrap:wrap;align-items:center}.g-crumbs span{color:var(--mut)}
.g-main{max-width:1500px;margin:0 auto;padding:26px 24px 40px}
.g-main h1{font-size:26px;margin:0 0 6px}.g-main .lead{color:var(--mut);font-size:14px;margin:0 0 22px;max-width:900px}
.g-sec{font-size:19px;margin:30px 0 12px;border-left:4px solid var(--acc);padding-left:10px}
.g-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 20px}
.g-tabs a{background:var(--card);border:1px solid var(--line);color:var(--txt);padding:5px 20px;border-radius:16px;font-size:13px}
.g-tabs a.on,.g-tabs a:hover{background:var(--acc);border-color:var(--acc);color:#fff}
.g-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:14px}
.g-card,.g-tile{position:relative;display:block;background:var(--card);border:1px solid var(--line);border-radius:10px;overflow:hidden;transition:transform .15s,border-color .15s}
.g-card:hover,.g-tile:hover{transform:translateY(-3px);border-color:var(--acc)}
.g-img{display:block;position:relative}
.g-card img,.g-tile img{width:100%;aspect-ratio:4/3;object-fit:cover;display:block;background:#0b0b0b}
.g-lic{position:absolute;top:8px;right:8px;background:var(--acc);color:#fff !important;font-size:11px;font-weight:700;padding:4px 10px;border-radius:6px;z-index:2;opacity:.92}
.g-lic:hover{background:var(--acch)}
.g-cap{display:block;padding:9px 11px}
.g-t{display:block;color:var(--txt);font-size:13px;font-weight:600;line-height:1.35;max-height:2.7em;overflow:hidden}
.g-m{display:block;color:var(--mut);font-size:11.5px;margin-top:3px}
.g-price{color:var(--acc);font-weight:700;margin-left:8px}
.g-badge{position:absolute;top:8px;left:8px;background:rgba(0,0,0,.72);color:#fff;font-size:11px;padding:3px 8px;border-radius:6px}
.g-pager{font-size:13px;color:var(--mut);display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.g-pager a{background:var(--card);border:1px solid var(--line);color:var(--txt);padding:4px 12px;border-radius:6px}
.g-pager a.on{background:var(--acc);border-color:var(--acc);color:#fff}
.g-main .g-pager{margin:24px 0 4px}   /* the copy at the bottom of long grids */
.g-foot{border-top:1px solid var(--line);color:var(--mut);font-size:12.5px;padding:18px 24px;text-align:center}.g-foot a{color:#E8834A}.g-foot a:hover{color:#F97316}
/* asset landing page */
.g-hero{display:grid;grid-template-columns:minmax(0,7fr) minmax(300px,4fr);gap:26px;align-items:start}
@media(max-width:900px){.g-hero{grid-template-columns:1fr}}
.g-media img,.g-media video{width:100%;border:1px solid var(--line);border-radius:12px;background:#0b0b0b;display:block}
.g-info h1{font-size:24px;line-height:1.3}
.g-buy{display:inline-block;background:var(--acc);color:#fff !important;font-size:17px;font-weight:800;padding:14px 26px;border-radius:10px;margin:10px 0 4px}
.g-buy:hover{background:var(--acch)}
.g-buy b{font-weight:800}
.g-note{color:var(--mut);font-size:12.5px;margin:8px 0}
.g-meta{border-collapse:collapse;margin:14px 0;font-size:13px;width:100%}
.g-meta td{border:1px solid var(--line);padding:7px 10px}.g-meta td:first-child{color:var(--mut);width:38%}
.g-chips{display:flex;gap:7px;flex-wrap:wrap;margin:22px 0 4px}
.g-chips span{background:var(--card);border:1px solid var(--line);color:var(--mut);font-size:12px;padding:4px 11px;border-radius:14px}
"""


# ---------------------------------------------------------------- build
def build(tree):
    out = ROOT / "gallery"
    out.mkdir(exist_ok=True)
    wfile(out / "gallery.css", GALLERY_CSS)
    adir = out / "a"
    adir.mkdir(exist_ok=True)

    page_urls = []
    asset_urls = []
    img_entries = []
    total_assets = 0

    home_crumb = ("Home", f"{SITE}/")
    gal_crumb = ("Gallery", f"{SITE}/gallery/")

    cat_tiles = []
    for cat, subs in tree.items():
        cslug = slug(cat)
        cat_url = f"{SITE}/gallery/{cslug}/"
        cat_assets = [a for lst in subs.values() for a in lst]
        total_assets += len(cat_assets)
        cover = next((a["thumb"] for a in cat_assets if a["featured"]), cat_assets[0]["thumb"])
        cat_tiles.append(tile(cat, cat_url, cover, len(cat_assets), "category"))

        # ---- category page: subcategory tiles
        sub_tiles = []
        for sub, assets in subs.items():
            sub_url = f"{SITE}/gallery/{cslug}/{slug(sub)}/"
            scover = next((a["thumb"] for a in assets if a["featured"]), assets[0]["thumb"])
            sub_tiles.append(tile(sub, sub_url, scover, len(assets), "collection"))
        body = (f"<h1>{esc(cat)} — Stock Images &amp; Footage</h1>"
                f'<p class="lead">Browse {len(cat_assets):,} royalty-free {esc(cat)} assets across '
                f'{len(subs)} collections. Every asset is licensed once, used forever — instant download at Stockflow.media.</p>'
                f'<div class="g-grid">{"".join(sub_tiles)}</div>')
        pg = page_shell(
            title=f"{cat} Stock Images & Footage — Royalty-Free | Stockflow.media",
            desc=f"{len(cat_assets):,} premium {cat} stock images and videos in up to 8K. "
                 f"{len(subs)} collections, royalty-free, instant download from $1.",
            canonical=cat_url, og_image=cover,
            breadcrumb=[home_crumb, gal_crumb, (cat, cat_url)],
            body=body, depth=2)
        d = out / cslug
        d.mkdir(exist_ok=True)
        wfile(d / "index.html", pg)
        page_urls.append(cat_url)

        # ---- subcategory pages + per-asset pages
        sub_names = list(subs.keys())
        for sub, assets in subs.items():
            sslug = slug(sub)
            base = f"{SITE}/gallery/{cslug}/{sslug}/"
            sd = d / sslug
            sd.mkdir(exist_ok=True)
            pages = max(1, -(-len(assets) // PER_PAGE))
            on_attr = ' class="on"'
            tabs = "".join(
                f'<a{on_attr if s == sub else ""} href="{SITE}/gallery/{cslug}/{slug(s)}/">{esc(s)}</a>'
                for s in sub_names)
            for p in range(1, pages + 1):
                chunk = assets[(p - 1) * PER_PAGE: p * PER_PAGE]
                url = base if p == 1 else f"{base}page-{p}.html"
                prev_u = None if p == 1 else (base if p == 2 else f"{base}page-{p-1}.html")
                next_u = f"{base}page-{p+1}.html" if p < pages else None
                suffix = f" — Page {p}" if p > 1 else ""
                pgr = pager(base, p, pages)   # goes in the header subbar (top-right)
                body = (f"<h1>{esc(sub)} — {esc(cat)} Stock Assets{suffix}</h1>"
                        f'<p class="lead">{len(assets):,} royalty-free {esc(sub)} images &amp; clips (up to 8K). '
                        f'Open any preview for details, or hit License to buy it instantly.</p>'
                        f'<div class="g-tabs">{tabs}</div>'
                        f'<div class="g-grid">{"".join(card(a) for a in chunk)}</div>'
                        f'{pgr}')
                pg = page_shell(
                    title=f"{sub} — {cat} Stock Images & Videos{suffix} | Stockflow.media",
                    desc=f"{len(assets):,} {sub} stock assets in the {cat} category. Up to 8K resolution, "
                         f"royalty-free license, instant download from $1.",
                    canonical=url, og_image=chunk[0]["preview"],
                    breadcrumb=[home_crumb, gal_crumb, (cat, cat_url), (sub, base)],
                    body=body, extra_graph=[media_node(a) for a in chunk],
                    prev_url=prev_u, next_url=next_u, depth=3, pager_html=pgr)
                wfile(sd / ("index.html" if p == 1 else f"page-{p}.html"), pg)
                page_urls.append(url)
                img_entries.append((url, [(a["thumb"], a["title"], a["desc"] or a["alt"]) for a in chunk if not a["video"]]))

            # ---- per-asset landing pages
            by_leaf = {}
            for a in assets:
                by_leaf.setdefault(a["leaf"], []).append(a)
            for i, a in enumerate(assets):
                rel = [r for r in by_leaf.get(a["leaf"], []) if r["id"] != a["id"]]
                if len(rel) < RELATED_N:
                    rel += [r for r in assets if r["id"] != a["id"] and r not in rel]
                related = rel[:RELATED_N]
                kind = "4K Stock Video" if a["video"] else "8K Stock Image"
                graph = [media_node(a)]
                pn = product_node(a)
                if pn:
                    graph.append(pn)
                pg = page_shell(
                    title=f"{a['title']} — Royalty-Free {kind} | Stockflow.media",
                    desc=(a["desc"] or a["title"])[:150] + f" Royalty-free {sub} stock, instant download.",
                    canonical=a["page"], og_image=a["preview"],
                    breadcrumb=[home_crumb, gal_crumb, (cat, cat_url), (sub, base), (a["title"], a["page"])],
                    body=asset_body(a, cat, cat_url, sub, base, related),
                    extra_graph=graph, depth=2)
                wfile(adir / f"{a['id']}.html", pg)
                asset_urls.append(a["page"])

    # ---- gallery landing page
    body = ("<h1>Stock Image &amp; Footage Gallery</h1>"
            f'<p class="lead">Explore {total_assets:,} premium royalty-free assets — 8K images, 4K footage, backgrounds, '
            f'food &amp; beverage, microscopy, retail and more. Pick a category; every preview links straight to its '
            f'licensing page.</p>'
            f'<div class="g-grid">{"".join(cat_tiles)}</div>')
    first_cover = next(iter(tree.values()))
    first_cover = next(iter(first_cover.values()))[0]["thumb"]
    pg = page_shell(
        title=f"Stock Gallery — {total_assets:,} Royalty-Free 8K Images & 4K Videos | Stockflow.media",
        desc=f"Browse {total_assets:,} premium stock images and footage by category. Royalty-free, "
             "up to 8K, instant download from $1 at Stockflow.media.",
        canonical=f"{SITE}/gallery/",
        og_image=first_cover,
        breadcrumb=[home_crumb, gal_crumb], body=body, depth=1)
    wfile(out / "index.html", pg)
    page_urls.insert(0, f"{SITE}/gallery/")

    # prune asset pages for ids no longer in the sheet
    live = {u.rsplit("/", 1)[1] for u in asset_urls}
    pruned = 0
    for f in adir.glob("*.html"):
        if f.name not in live:
            f.unlink()
            pruned += 1
    if pruned:
        print(f"Pruned {pruned} stale asset pages", flush=True)

    return page_urls, asset_urls, img_entries, total_assets


def write_assets_json(rows):
    """Slim static snapshot of the Sheet for the storefront SPA (data/assets.json).

    The SPA used to download the ENTIRE sheet CSV (26+ MB, slow on-demand
    export from docs.google.com) on every visit. This snapshot keeps only the
    fields js/videos.js actually uses, in the exact object shape it builds,
    and is served same-origin from the GitHub Pages CDN (gzipped, cacheable).
    """
    out = []
    for r in rows:
        fid = (r.get("File_ID") or "").strip()
        title = (r.get("Title") or "").strip()
        thumb = (r.get("Thumbnail_URL") or "").strip()
        preview = (r.get("Preview_URL") or "").strip()
        if not (fid and title and thumb and preview):
            continue
        hr_name = (r.get("HighRes_Filename") or "").strip()
        m = re.search(r"_([^_]+)_\.[a-z0-9]+$", hr_name, re.I)
        try:
            price = float((r.get("Price") or "").strip())
        except Exception:
            price = 1
        out.append({
            "id": fid,
            "title": title,
            "category": (r.get("Category") or "").strip(),
            "subcategory": (r.get("Catagory_Sub") or "").strip(),
            "sub": (r.get("Sub") or "").strip(),
            "description": (r.get("Description") or "").strip(),
            "thumbnail": thumb,
            "preview": preview,
            "price": price,
            "format": (r.get("Format") or "16:9").strip(),
            "resolution": (r.get("Resolution") or "").strip(),
            "tags": (r.get("Tags") or "").strip(),
            "highResUrl": (r.get("HighRes_DriveURL") or "").strip(),
            "featured": (r.get("Featured") or "").strip().lower() in ("true", "1"),
            "fileFormat": m.group(1) if m else "",
            "assetFormat": (r.get("Assets Format") or "").strip(),
        })
    ddir = ROOT / "data"
    ddir.mkdir(exist_ok=True)
    payload = json.dumps(out, ensure_ascii=False, separators=(",", ":"))
    wfile(ddir / "assets.json", payload)
    print(f"data/assets.json: {len(out):,} assets · {len(payload.encode('utf-8'))/1e6:.1f} MB raw", flush=True)


def extract_shop_ui():
    """Pull the modal stack (login/top-up/download/history/help/about/license…)
    out of browse.html into gallery/shop-ui.html, so the gallery's purchase
    layer always uses the SAME markup as the browse app — single source, no
    drift. Inline <script> blocks are stripped (shop.js re-implements them)."""
    src = ROOT / "index.html"
    if not src.exists():
        print("WARN: index.html not found — shop-ui.html not regenerated", flush=True)
        return
    html_text = src.read_text(encoding="utf-8")
    start = html_text.find('<div id="previewModal"')
    n_anchor = html_text.find('id="notificationMessage"')
    if start == -1 or n_anchor == -1:
        print("WARN: modal markers not found in index.html — shop-ui.html not regenerated", flush=True)
        return
    end = html_text.find("</div>", html_text.find("</p>", n_anchor)) + len("</div>")
    chunk = html_text[start:end]
    chunk = re.sub(r"<script\b.*?</script>", "", chunk, flags=re.S)
    wfile(ROOT / "gallery" / "shop-ui.html",
          "<!-- AUTO-GENERATED from browse.html by tools/build_gallery.py — do not edit -->\n" + chunk)
    print(f"gallery/shop-ui.html: {len(chunk)/1024:.0f} KB extracted from index.html", flush=True)


def write_catalog_json(tree):
    """Tiny category index (name/cover/count) — the storefront paints these
    tiles instantly on load while the full assets.json arrives in background."""
    cats = []
    for cat, subs in tree.items():
        assets = [a for lst in subs.values() for a in lst]
        cover = next((a["thumb"] for a in assets if a["featured"]), assets[0]["thumb"])
        cats.append({"name": cat, "cover": cover, "count": len(assets)})
    ddir = ROOT / "data"
    ddir.mkdir(exist_ok=True)
    wfile(ddir / "catalog.json", json.dumps(cats, ensure_ascii=False, separators=(",", ":")))
    print(f"data/catalog.json: {len(cats)} categories", flush=True)


def xml_esc(s):
    return (str(s or "").replace("&", "&amp;").replace("<", "&lt;")
            .replace(">", "&gt;").replace('"', "&quot;"))


def write_sitemaps(page_urls, asset_urls, img_entries):
    def urlset(urls, freq):
        lines = ['<?xml version="1.0" encoding="UTF-8"?>',
                 '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
        for u in urls:
            lines.append(f"  <url><loc>{xml_esc(u)}</loc><changefreq>{freq}</changefreq></url>")
        lines.append("</urlset>")
        return "\n".join(lines)

    wfile(ROOT / "sitemap-gallery.xml", urlset(page_urls, "weekly"))
    wfile(ROOT / "sitemap-assets.xml", urlset(asset_urls, "monthly"))

    lines = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
             '        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">']
    n = 0
    for page_url, imgs in img_entries:
        if not imgs:
            continue
        lines.append(f"  <url>\n    <loc>{xml_esc(page_url)}</loc>")
        for img, title, caption in imgs:
            lines.append("    <image:image>")
            lines.append(f"      <image:loc>{xml_esc(img)}</image:loc>")
            if title:
                lines.append(f"      <image:title>{xml_esc(title)}</image:title>")
            if caption:
                lines.append(f"      <image:caption>{xml_esc(caption)}</image:caption>")
            lines.append("    </image:image>")
            n += 1
        lines.append("  </url>")
    lines.append("</urlset>")
    wfile(ROOT / "sitemap-images-gallery.xml", "\n".join(lines))
    return n


def write_search_index(tree):
    """Compact search index for AI agents / the stockflow-mcp server.
    Short keys keep it ~4x smaller than assets.json:
      i=id t=title k=keywords c=category s=subcategory f=aspect r=resolution
      v=is_video pr=price th=thumbnail p=preview u=asset(purchase) page"""
    out = []
    for cat, subs in tree.items():
        for sub, assets in subs.items():
            for a in assets:
                out.append({
                    "i": a["id"], "t": a["title"], "k": a["keywords"][:400],
                    "c": cat, "s": sub, "f": a.get("fmt", ""), "r": a["res"],
                    "v": 1 if a["video"] else 0, "pr": a["price"] or "1",
                    "th": a["thumb"], "p": a["preview"], "u": a["page"],
                })
    payload = json.dumps(out, ensure_ascii=False, separators=(",", ":"))
    wfile(ROOT / "data" / "search-index.json", payload)
    print(f"data/search-index.json: {len(out):,} assets · {len(payload.encode('utf-8'))/1e6:.1f} MB raw", flush=True)


def write_llms_txt(total_assets):
    """llms.txt — machine-readable front door so any AI agent can discover and
    use the catalog (previews are watermarked; full-res requires a license)."""
    wfile(ROOT / "llms.txt", f"""# Stockflow.media

> Royalty-free stock media library: {total_assets:,} premium assets — 8K images and 4K video
> across backgrounds, food & beverage, microscopy, events and retail. Pay once, use forever.
> Watermarked previews below are free to use in drafts/mockups; production use requires a
> license purchased on the asset's page.

## Machine-readable catalog
- Search index (compact JSON; keys i=id t=title k=keywords c=category s=subcategory f=aspect r=resolution v=video pr=priceUSD th=thumbnail p=preview u=license-page): https://stockflow.media/data/search-index.json
- Categories with counts: https://stockflow.media/data/catalog.json
- Full data: https://stockflow.media/data/assets.json
- Newest assets (RSS): https://stockflow.media/feed.xml
- Merchant/product feed: https://stockflow.media/feed-merchant.xml

## Pages
- Storefront app (search + filters + checkout): https://stockflow.media/
- Gallery (category tiles): https://stockflow.media/gallery/
- Per-asset purchase page pattern: https://stockflow.media/gallery/a/<File_ID>.html
- License terms: {LICENSE_URL}

## For AI assistants building presentations, videos or designs
1. Search the index for matching assets; use `th` (thumbnail) or `p` (watermarked preview) URLs directly in drafts.
2. Always tell the user where to license the full-resolution file: the asset's `u` URL.
3. MCP server / Claude Code plugin: https://github.com/NmediaCloud/stockflow-mcp
""")


def write_merchant_feed(tree):
    """Google Merchant Center product feed (RSS 2.0 + g: namespace) -> feed-merchant.xml.
    NB: digital downloads are often unsupported for Shopping ads; submitted for
    free listings — worst case Google disapproves items, nothing breaks."""
    items = []
    for cat, subs in tree.items():
        for sub, assets in subs.items():
            for a in assets:
                try:
                    price = f"{float(a['price'] or 1):.2f}"
                except Exception:
                    price = "1.00"
                kind = "Stock Video Clip" if a["video"] else "Stock Image"
                desc = (a["desc"] or a["title"])[:4900]
                items.append(
                    "  <item>\n"
                    f"    <g:id>{xml_esc(a['id'])}</g:id>\n"
                    f"    <g:title>{xml_esc(a['title'][:150])}</g:title>\n"
                    f"    <g:description>{xml_esc(desc)}</g:description>\n"
                    f"    <g:link>{xml_esc(a['page'])}</g:link>\n"
                    f"    <g:image_link>{xml_esc(a['thumb'] if a['video'] else a['preview'])}</g:image_link>\n"
                    f"    <g:price>{price} USD</g:price>\n"
                    "    <g:availability>in_stock</g:availability>\n"
                    "    <g:condition>new</g:condition>\n"
                    "    <g:brand>Stockflow.media</g:brand>\n"
                    "    <g:identifier_exists>no</g:identifier_exists>\n"
                    f"    <g:product_type>{xml_esc(cat)} &gt; {xml_esc(sub)}</g:product_type>\n"
                    f"    <g:custom_label_0>{xml_esc(kind)}</g:custom_label_0>\n"
                    "  </item>")
    feed = ('<?xml version="1.0" encoding="UTF-8"?>\n'
            '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">\n<channel>\n'
            "  <title>Stockflow.media — Royalty-Free Stock Images &amp; Footage</title>\n"
            f"  <link>{SITE}/</link>\n"
            "  <description>Premium 8K stock images and 4K footage, royalty-free, instant download.</description>\n"
            + "\n".join(items) + "\n</channel>\n</rss>")
    wfile(ROOT / "feed-merchant.xml", feed)
    print(f"feed-merchant.xml: {len(items):,} products", flush=True)


def write_rss(tree, newest_n=100):
    """Plain RSS of the newest assets -> feed.xml (Pinterest auto-publish,
    FeedHive, Zapier, readers). Sorted by File_ID (date-prefixed) descending."""
    flat = [a for subs in tree.values() for assets in subs.values() for a in assets]
    flat.sort(key=lambda a: a["id"], reverse=True)
    items = []
    for a in flat[:newest_n]:
        d = upload_date(a["id"])
        items.append(
            "  <item>\n"
            f"    <title>{xml_esc(a['title'])}</title>\n"
            f"    <link>{xml_esc(a['page'])}</link>\n"
            f"    <guid isPermaLink=\"true\">{xml_esc(a['page'])}</guid>\n"
            f"    <description>{xml_esc((a['desc'] or a['title'])[:500])}</description>\n"
            f"    <pubDate>{d}T00:00:00Z</pubDate>\n"
            f"    <enclosure url=\"{xml_esc(a['thumb'])}\" type=\"image/webp\" length=\"0\"/>\n"
            "  </item>")
    feed = ('<?xml version="1.0" encoding="UTF-8"?>\n'
            '<rss version="2.0">\n<channel>\n'
            "  <title>Stockflow.media — New Stock Assets</title>\n"
            f"  <link>{SITE}/</link>\n"
            "  <description>Newest royalty-free 8K images and 4K footage on Stockflow.media.</description>\n"
            + "\n".join(items) + "\n</channel>\n</rss>")
    wfile(ROOT / "feed.xml", feed)
    print(f"feed.xml: newest {min(newest_n, len(flat))} assets", flush=True)


def write_robots():
    wfile(ROOT / "robots.txt",
          "User-agent: *\n"
          "Allow: /\n\n"
          f"Sitemap: {SITE}/sitemap.xml\n"
          f"Sitemap: {SITE}/sitemap-gallery.xml\n"
          f"Sitemap: {SITE}/sitemap-assets.xml\n"
          f"Sitemap: {SITE}/sitemap-images-gallery.xml\n")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", default="", help="build from a saved CSV instead of fetching")
    args = ap.parse_args()

    rows = fetch_rows(args.csv or None)
    write_assets_json(rows)
    tree = load_assets(rows)
    write_catalog_json(tree)
    cats = len(tree)
    subs = sum(len(s) for s in tree.values())
    print(f"Hierarchy: {cats} categories, {subs} subcategories", flush=True)

    page_urls, asset_urls, img_entries, total = build(tree)
    extract_shop_ui()
    n_imgs = write_sitemaps(page_urls, asset_urls, img_entries)
    write_merchant_feed(tree)
    write_rss(tree)
    write_search_index(tree)
    write_llms_txt(total)
    write_robots()
    print(f"DONE: {len(page_urls)} listing pages · {len(asset_urls):,} asset pages · "
          f"{total:,} assets · {n_imgs:,} images in sitemap", flush=True)
    print(f"Files written: {_written['new']:,} changed, {_written['same']:,} unchanged", flush=True)


if __name__ == "__main__":
    main()
