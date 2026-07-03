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
        "url": a["buy"],
        "acquireLicensePage": a["buy"],
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
def page_shell(*, title, desc, canonical, og_image, breadcrumb, body, extra_graph=None,
               prev_url=None, next_url=None, depth=2):
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
  <title>{esc(title)}</title>
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
  <link rel="stylesheet" href="{rel}gallery/gallery.css">
  <script type="application/ld+json">{ld}</script>
</head>
<body>
<header class="g-top">
  <a class="g-brand" href="{SITE}/">
    <img src="{rel}assets/logo_SF.webp" alt="Stockflow.media logo" onerror="this.style.display='none'">
    <span>Stockflow<b>.media</b></span>
  </a>
  <nav class="g-crumbs">{" <span>›</span> ".join(f'<a href="{esc(u)}">{esc(n)}</a>' for n, u in breadcrumb)}</nav>
  <a class="g-cta" href="{SITE}/">Browse &amp; Buy</a>
</header>
<main class="g-main">
{body}
</main>
<footer class="g-foot">
  <p>All previews &amp; thumbnails {esc(COPYRIGHT)} · <a href="{LICENSE_URL}">Content License</a> ·
  License any asset at <a href="{SITE}/">stockflow.media</a> — instant download, royalty-free.</p>
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
  <a class="g-lic" href="{esc(a['buy'])}" title="License this asset now">License</a>
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
    return f"""<div class="g-hero">
  <div class="g-media">{media}</div>
  <div class="g-info">
    <h1>{esc(a['title'])}</h1>
    <p class="lead">{esc(a['desc'] or a['title'])}</p>
    <a class="g-buy" href="{esc(a['buy'])}">License this {('clip' if a['video'] else 'image')}{price_line}</a>
    <p class="g-note">Royalty-free · pay once, use forever · instant full-resolution download ·
    <a href="{LICENSE_URL}">license terms</a></p>
    <table class="g-meta">{meta_rows}</table>
    <p class="g-note">Browse more: <a href="{esc(sub_url)}">{esc(sub)}</a> · <a href="{esc(cat_url)}">{esc(cat)}</a></p>
  </div>
</div>
<div class="g-chips">{chips}</div>
{rel_block}"""


GALLERY_CSS = """/* Stockflow gallery — static, matches theme.css (dark charcoal + burnt orange) */
:root{--bg:#111;--panel:#1F2933;--card:#2A2F36;--line:#3A3F46;--txt:#F3F4F6;--mut:#9CA3AF;--acc:#F97316;--acch:#FB923C}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--txt);font-family:ui-sans-serif,system-ui,"Segoe UI",sans-serif}
a{color:var(--acc);text-decoration:none}a:hover{color:var(--acch)}
.g-top{display:flex;align-items:center;gap:16px;padding:14px 24px;background:#0b0b0b;border-bottom:1px solid var(--line);position:sticky;top:0;z-index:5;flex-wrap:wrap}
.g-brand{display:flex;align-items:center;gap:10px;color:var(--txt);font-size:18px;font-weight:700}
.g-brand img{height:34px;width:auto}.g-brand b{color:var(--acc)}
.g-crumbs{flex:1;font-size:13px;color:var(--mut);display:flex;gap:6px;flex-wrap:wrap}.g-crumbs span{color:var(--mut)}
.g-cta{background:var(--acc);color:#fff !important;padding:8px 18px;border-radius:8px;font-weight:700;font-size:14px}
.g-cta:hover{background:var(--acch)}
.g-main{max-width:1500px;margin:0 auto;padding:26px 24px 40px}
.g-main h1{font-size:26px;margin:0 0 6px}.g-main .lead{color:var(--mut);font-size:14px;margin:0 0 22px;max-width:900px}
.g-sec{font-size:19px;margin:30px 0 12px;border-left:4px solid var(--acc);padding-left:10px}
.g-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 20px}
.g-tabs a{background:var(--card);border:1px solid var(--line);color:var(--txt);padding:7px 14px;border-radius:20px;font-size:13px}
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
.g-pager{margin:26px 0 4px;font-size:14px;color:var(--mut);display:flex;gap:6px;flex-wrap:wrap}
.g-pager a{background:var(--card);border:1px solid var(--line);color:var(--txt);padding:5px 11px;border-radius:6px}
.g-pager a.on{background:var(--acc);border-color:var(--acc);color:#fff}
.g-foot{border-top:1px solid var(--line);color:var(--mut);font-size:12.5px;padding:18px 24px;text-align:center}
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
                body = (f"<h1>{esc(sub)} — {esc(cat)} Stock Assets{suffix}</h1>"
                        f'<p class="lead">{len(assets):,} royalty-free {esc(sub)} images &amp; clips (up to 8K). '
                        f'Open any preview for details, or hit License to buy it instantly.</p>'
                        f'<div class="g-tabs">{tabs}</div>'
                        f'<div class="g-grid">{"".join(card(a) for a in chunk)}</div>'
                        f'{pager(base, p, pages)}')
                pg = page_shell(
                    title=f"{sub} — {cat} Stock Images & Videos{suffix} | Stockflow.media",
                    desc=f"{len(assets):,} {sub} stock assets in the {cat} category. Up to 8K resolution, "
                         f"royalty-free license, instant download from $1.",
                    canonical=url, og_image=chunk[0]["preview"],
                    breadcrumb=[home_crumb, gal_crumb, (cat, cat_url), (sub, base)],
                    body=body, extra_graph=[media_node(a) for a in chunk],
                    prev_url=prev_u, next_url=next_u, depth=3)
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
        canonical=f"{SITE}/gallery/", og_image=first_cover,
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

    tree = load_assets(fetch_rows(args.csv or None))
    cats = len(tree)
    subs = sum(len(s) for s in tree.values())
    print(f"Hierarchy: {cats} categories, {subs} subcategories", flush=True)

    page_urls, asset_urls, img_entries, total = build(tree)
    n_imgs = write_sitemaps(page_urls, asset_urls, img_entries)
    write_robots()
    print(f"DONE: {len(page_urls)} listing pages · {len(asset_urls):,} asset pages · "
          f"{total:,} assets · {n_imgs:,} images in sitemap", flush=True)
    print(f"Files written: {_written['new']:,} changed, {_written['same']:,} unchanged", flush=True)


if __name__ == "__main__":
    main()
