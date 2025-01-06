import os
import json
from PIL import Image, ImageDraw, ImageFont

# Paths
JSON_DIR = "/mnt/c/repos/DarkestDungeon/darkest-companion/server/data/templates/characters"
FONT_PATH = "/mnt/c/repos/DarkestDungeon/darkest-companion/src/assets/fonts/Moria_DF.ttf"
ZODIAC_FONT_PATH = "/mnt/c/repos/DarkestDungeon/darkest-companion/src/assets/fonts/GeZodiac-ow4d.ttf"
IMAGES_DIR = "/mnt/c/repos/DarkestDungeon/darkest-companion/src/assets/characters/card/processing/bordered_cards"
OUTPUT_DIR = "/mnt/c/repos/DarkestDungeon/darkest-companion/src/assets/characters/card/processing/titled_cards"

# Text and formatting settings
TEXT_COLOR = "black"  # Black text for title
ZODIAC_COLOR = "white"  # White text for zodiac
TEXT_POSITION = (116, 832)  # Top-left corner of the text box
TEXT_BOX_SIZE = (382, 54)  # Width and height of the text box
INITIAL_FONT_SIZE = 50  # Default starting font size for title
ZODIAC_FONT_SIZE = 45  # Font size for zodiac symbol
ZODIAC_POSITION = (303, 48)  # Position for zodiac sign, centered horizontally

# Zodiac symbol mapping
ZODIAC_MAP = {
    "Virgo": "a",
    "Taurus": "c",
    "Scorpio": "e",
    "Sagittarius": "g",
    "Pisces": "i",
    "Libra": "k",
    "Leo": "m",
    "Gemini": "o",
    "Capricorn": "q",
    "Cancer": "s",
    "Aries": "u",
    "Aquarius": "w",
}

# Ensure output directory exists
os.makedirs(OUTPUT_DIR, exist_ok=True)

def fetch_data_from_json(json_file):
    """Fetch the 'title' and 'zodiac' fields from a JSON file."""
    with open(json_file, "r") as f:
        data = json.load(f)
    return data.get("title", "Untitled"), data.get("zodiac", "")

def fit_text_to_box(draw, text, font_path, box_size):
    """Adjust the font size dynamically to fit text within the box dimensions."""
    font_size = INITIAL_FONT_SIZE
    font = ImageFont.truetype(font_path, font_size)

    while True:
        # Measure text dimensions
        bbox = draw.textbbox((0, 0), text, font=font)
        text_width, text_height = bbox[2] - bbox[0], bbox[3] - bbox[1]

        # Check if the text fits within the box
        if text_width <= box_size[0] and text_height <= box_size[1]:
            break

        font_size -= 2  # Decrease font size
        if font_size < 10:  # Prevent overly small text
            raise ValueError(f"Text '{text}' is too long to fit in the box!")
        font = ImageFont.truetype(font_path, font_size)

    return font

def add_text_to_image(image_path, text, zodiac, text_font_path, zodiac_font_path, text_color, zodiac_color, text_position, text_box_size, zodiac_position):
    """Add text and zodiac symbol to the image."""
    # Load image
    image = Image.open(image_path).convert("RGBA")
    draw = ImageDraw.Draw(image)

    # Add title text
    font = fit_text_to_box(draw, text, text_font_path, text_box_size)

    # Measure title text dimensions and calculate alignment
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]

    # Center title text in the text box
    x = text_position[0] + (text_box_size[0] - text_width) // 2
    y = text_position[1] + (text_box_size[1] - text_height) // 2
    draw.text((x, y), text, fill=text_color, font=font)

    # Add zodiac symbol
    zodiac_symbol = ZODIAC_MAP.get(zodiac, "")
    
    # Adjust font size and positioning for Cancer specifically
    cancer_offset = 0
    zodiac_font_size = ZODIAC_FONT_SIZE
    if zodiac == "Cancer":
        cancer_offset = 8  # Slightly adjust position for Cancer
        zodiac_font_size -= 10  # Reduce font size slightly for Cancer
    zodiac_font = ImageFont.truetype(zodiac_font_path, zodiac_font_size)

    # Measure zodiac symbol dimensions and align to position
    bbox = draw.textbbox((0, 0), zodiac_symbol, font=zodiac_font)
    zodiac_width = bbox[2] - bbox[0]
    zodiac_x = zodiac_position[0] - zodiac_width // 2
    zodiac_y = zodiac_position[1] + cancer_offset
    draw.text((zodiac_x, zodiac_y), zodiac_symbol, fill=zodiac_color, font=zodiac_font)

    return image

# Process all JSON files and images
for json_file in os.listdir(JSON_DIR):
    if json_file.endswith(".json"):
        # Get the identifier to match image files
        json_path = os.path.join(JSON_DIR, json_file)
        title, zodiac = fetch_data_from_json(json_path)

        # Construct image filename (assumes same name as identifier)
        identifier = os.path.splitext(json_file)[0]
        image_path = os.path.join(IMAGES_DIR, f"{identifier}.png")

        if os.path.exists(image_path):
            # Add text and zodiac symbol to image
            output_path = os.path.join(OUTPUT_DIR, f"{identifier}.png")
            edited_image = add_text_to_image(image_path, title, zodiac, FONT_PATH, ZODIAC_FONT_PATH, TEXT_COLOR, ZODIAC_COLOR, TEXT_POSITION, TEXT_BOX_SIZE, ZODIAC_POSITION)
            edited_image.save(output_path)
            print(f"Processed: {image_path} -> {output_path}")
        else:
            print(f"Image not found for identifier: {identifier}")

print(f"All processed images saved in '{OUTPUT_DIR}'")
