"""One-off generator for dashboard/web/public/og-image.png.

Not part of the build pipeline — run manually whenever the placeholder needs
regenerating, via:

    uv run --with pillow python scripts/generate_og_image.py

Produces a 1200x630 branded placeholder using the site's existing dark-green /
gold palette (see dashboard/web/src/pages/Landing.tsx), until a real designed
asset replaces it.
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

WIDTH, HEIGHT = 1200, 630
BG = "#051F20"
GOLD = "#D1A92E"
GOLD_LIGHT = "#ffdca1"
TEXT_LIGHT = "#DAF1DE"
TEXT_MUTED = "#b9d2c0"
LABEL = "#8EB69B"

FONT_DIR = Path("/System/Library/Fonts/Supplemental")
OUT_PATH = Path(__file__).resolve().parent.parent / "dashboard" / "web" / "public" / "og-image.png"


def tracked(text: str, spacing: int = 1) -> str:
    return (" " * spacing).join(text)


def main() -> None:
    img = Image.new("RGB", (WIDTH, HEIGHT), BG)
    draw = ImageDraw.Draw(img)

    headline_font = ImageFont.truetype(str(FONT_DIR / "Georgia.ttf"), 58)
    headline_italic_font = ImageFont.truetype(str(FONT_DIR / "Georgia Italic.ttf"), 58)
    tagline_font = ImageFont.truetype(str(FONT_DIR / "Arial.ttf"), 26)
    label_font = ImageFont.truetype(str(FONT_DIR / "Arial.ttf"), 15)

    margin = 84

    # Label mark: dot + "SHARIAHTRADING.MY"
    dot_r = 5
    dot_y = margin + 8
    draw.ellipse(
        [margin, dot_y - dot_r, margin + dot_r * 2, dot_y + dot_r],
        fill=GOLD,
    )
    draw.text(
        (margin + dot_r * 2 + 14, margin),
        tracked("SHARIAHTRADING.MY", spacing=2),
        font=label_font,
        fill=LABEL,
    )

    # Headline, wrapped across two lines with an italic accent word:
    # "The future of *ethical* investing."
    line1_y = 250
    line2_y = 250 + 70

    x = margin
    for word, font, color in [
        ("The ", headline_font, TEXT_LIGHT),
        ("future ", headline_font, TEXT_LIGHT),
        ("of ", headline_font, TEXT_LIGHT),
    ]:
        draw.text((x, line1_y), word, font=font, fill=color)
        x += draw.textlength(word, font=font)

    draw.text((x, line1_y), "ethical", font=headline_italic_font, fill=GOLD_LIGHT)

    draw.text((margin, line2_y), "investing.", font=headline_font, fill=TEXT_LIGHT)

    # Tagline
    tagline = "Institutional-grade, Shariah-screened trading infrastructure."
    draw.text((margin, line2_y + 96), tagline, font=tagline_font, fill=TEXT_MUTED)

    # Thin bottom rule + domain, echoing the site's footer treatment
    rule_y = HEIGHT - margin
    draw.line([(margin, rule_y), (WIDTH - margin, rule_y)], fill="#235347", width=1)
    draw.text(
        (margin, rule_y + 16),
        tracked("SHARIAHTRADING.MY", spacing=1),
        font=label_font,
        fill=LABEL,
    )

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    img.save(OUT_PATH, "PNG")
    print(f"wrote {OUT_PATH}")


if __name__ == "__main__":
    main()
