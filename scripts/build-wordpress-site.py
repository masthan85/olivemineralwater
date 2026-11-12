"""Builds the static copy of the OLIVE public pages that WordPress.com imports.

Usage: python wp-build.py <repo>/public <output folder>
"""
import io, os, re, shutil, sys

src, out = sys.argv[1], sys.argv[2]
MAIL = "hello@olivemineralwater.co.uk"
NAV = [("index.html", "Home"), ("products.html", "Products"), ("shop.html", "Shop"),
       ("trade-enquiry.html", "Trade Enquiry"), ("about.html", "About"), ("delivery.html", "Delivery & Help")]

if os.path.isdir(out):
    shutil.rmtree(out)
os.makedirs(os.path.join(out, "assets"))
for name in ["site.css", "site.js", "olive-logo.png", "mountain-water.jpg", "classic-olive.jpg",
             "forest-reserve.jpg", "sapphire-blue.jpg", "aqua-spring.jpg"]:
    shutil.copy(os.path.join(src, "assets", name), os.path.join(out, "assets", name))

# WordPress wraps each image in a figure and moves the image's class onto it, so size the image from the wrapper too.
with io.open(os.path.join(out, "assets", "site.css"), "a", encoding="utf-8", newline="\n") as css:
    css.write("\n".join([
        "",
        "/* WordPress import: images inside converted figures */",
        ".brand img { display: block; width: 166px; max-width: 100%; height: auto; }",
        "@media (max-width: 980px) { .brand img { width: 137px; } }",
        ".hero-photo img, .range-photo img, .about-photo img { display: block; width: 100%; height: auto; }",
        "figure.logo, figure.hero-photo, figure.range-photo, figure.about-photo { margin-block: 0; }",
        ".hero-photo img, .range-photo img, .about-photo img { border-radius: 9px; }",
        "",
    ]))

def read(name):
    return io.open(os.path.join(src, name), encoding="utf-8").read()

def once(text, old, new):
    assert text.count(old) == 1, (old[:60], text.count(old))
    return text.replace(old, new)

def shell(page, name):
    links = "".join('<a href="%s"%s>%s</a>' % (href, ' aria-current="page"' if href == name else "", label.replace("&", "&amp;"))
                    for href, label in NAV)
    page = re.sub(r'(<nav id="primary-nav"[^>]*>).*?(</nav>)',
                  lambda m: m.group(1) + "\n        " + links + '<a class="button button--line" href="shop.html">Shop Now</a>\n      ' + m.group(2),
                  page, count=1, flags=re.S)
    page = re.sub(r'(<nav aria-label="Footer navigation"><h2>Explore</h2>).*?(</nav>)',
                  lambda m: m.group(1) + "".join('\n          <a href="%s">%s</a>' % (h, l.replace("&", "&amp;")) for h, l in NAV[1:]) + "\n        " + m.group(2),
                  page, count=1, flags=re.S)
    page = re.sub(r'\s*<a class="staff-link"[^>]*>.*?</a>', "", page)
    page = re.sub(r'\s*<script type="module" src="assets/(intake|tracking)\.js"></script>', "", page)
    page = re.sub(r'order\.html(\?bottle=[a-z-]+)?', "shop.html", page)
    page = page.replace(">Order Now<", ">Shop Now<").replace(">Place an Order<", ">Visit the Shop<")
    page = re.sub(r">Request (Classic Olive|Forest Reserve|Sapphire Blue|Aqua Spring)<", r">Order \1<", page)
    assert "account.html" not in page and "track.html" not in page and "operations.html" not in page, name
    return page

def write(name, page):
    io.open(os.path.join(out, name), "w", encoding="utf-8", newline="\n").write(shell(page, name))
    print("wrote", name)

write("index.html", read("index.html"))
write("products.html", read("products.html"))
write("about.html", read("about.html"))

trade = read("trade-enquiry.html")
trade = once(trade, '<form class="request-form" id="intake" method="post"><input type="hidden" name="kind" value="trade">',
             '<form class="request-form" method="post" data-email="%s" data-subject="OLIVE trade enquiry">' % MAIL)
for field, label in [("name", "Name"), ("email", "Email"), ("business", "Business name"), ("postcode", "Delivery postcode"), ("address", "Delivery address"), ("notes", "Message")]:
    trade = once(trade, 'name="%s"' % field, 'name="%s"' % label)
trade = once(trade, ' <a href="account.html">Sign in</a> to save it to your order history.', "")
trade = once(trade, 'type="submit" disabled>Send request', 'type="submit">Send enquiry')
trade = re.sub(r'\s*<p class="form-note" id="intake-status" role="status"></p>', "", trade)
trade = re.sub(r'\s*<noscript>.*?</noscript>', "", trade, flags=re.S)
write("trade-enquiry.html", trade)

delivery = read("delivery.html")
delivery = re.sub(r'<details open><summary>How do I request an order\?</summary>.*?</details>',
                  '<details open><summary>How do I order?</summary><p>Choose your bottles in the <a href="shop.html">shop</a> and check out online. We’ll confirm your delivery day by email.</p></details>',
                  delivery, flags=re.S)
delivery = re.sub(r'<details><summary>Can I track my delivery\?</summary>.*?</details>',
                  '<details><summary>Can I check on my order?</summary><p>Yes. Sign in to your account from the <a href="shop.html">shop</a> to see your orders and their status, or email us with your order number.</p></details>',
                  delivery, flags=re.S)
write("delivery.html", delivery)

# Shop: a holding page with the range. WooCommerce replaces it with the real shop.
products = read("products.html")
cards = re.search(r'<div class="bottle-grid">.*?</article></div>', products, flags=re.S).group(0)
main = '''<main id="main">
    <section class="collection section inner">
      <div class="wrap">
        <p class="kicker">Shop</p><h1>Order OLIVE online</h1>
        <p class="section-intro">Our online shop is opening soon. Until then, email us the bottles and quantities you’d like and we’ll confirm availability and delivery across Greater London &amp; the Home Counties.</p>
        <p><a class="button button--green" href="mailto:%s?subject=OLIVE%%20order">Email your order</a></p>
        %s
      </div>
    </section>
    <section class="range">
      <div class="wrap">
        <p class="kicker">Also available</p><h2>OLIVE Still Water</h2>
        <p>The same still, naturally pure water in three everyday sizes.</p>
        <ul class="size-list" aria-label="Available sizes"><li>250ml</li><li>500ml</li><li>1 litre</li></ul>
      </div>
    </section>
</main>''' % (MAIL, cards)
shop = re.sub(r'<main id="main">.*?</main>', lambda m: main, products, count=1, flags=re.S)
shop = once(shop, "<title>Products | OLIVE Pure Mineral Water</title>", "<title>Shop | OLIVE Pure Mineral Water</title>")
write("shop.html", shop)
