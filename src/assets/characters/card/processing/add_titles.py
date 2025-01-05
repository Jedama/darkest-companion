import os
import json
from PIL import Image, ImageDraw, ImageFont

# Paths
JSON_DIR = "/mnt/c/repos/DarkestDungeon/darkest-companion/server/data/templates/characters"
FONT_PATH = "/mnt/c/repos/DarkestDungeon/darkest-companion/src/assets/fonts/Moria_DF.ttf"
IMAGES_DIR = "/mnt/c/repos/DarkestDungeon/darkest-companion/src/assets/characters/card/processing/bordered_cards"
OUTPUT_DIR = "/mnt/c/repos/DarkestDungeon/darkest-companion/src/assets/characters/card/processing/titled_cards"

# Text and formatting settings
TEXT_COLOR = "black"  # Black text
TEXT_POSITION = (114, 824)  # Top-left corner of the text box
TEXT_BOX_SIZE = (385, 62)  # Width and height of the text box
INITIAL_FONT_SIZE = 50  # Default starting font size

# Ensure output directory exists
os.makedirs(OUTPUT_DIR, exist_ok=True)

def fetch_title_from_json(json_file):
    """Fetch the 'title' field from a JSON file."""
    with open(json_file, "r") as f:
        data = json.load(f)
    return data.get("title", "Untitled")

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

def add_text_to_image(image_path, text, font_path, text_color, position, box_size, initial_font_size):
    """Add text to the image, centered in the box."""
    # Load image
    image = Image.open(image_path).convert("RGBA")
    draw = ImageDraw.Draw(image)

    # Fit text to the box
    font = fit_text_to_box(draw, text, font_path, box_size)

    # Measure text dimensions and calculate alignment
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]

    # Calculate middle of text (baseline to cap height) and align to vertical centerline
    ascent, descent = font.getmetrics()
    text_middle = ascent / 2 - descent / 2
    box_middle = position[1] + box_size[1] / 2

    # Calculate final positions
    x = position[0] + (box_size[0] - text_width) // 2
    y = box_middle - text_middle

    # Draw text
    draw.text((x, y), text, fill=text_color, font=font)

    return image

# Process all JSON files and images
for json_file in os.listdir(JSON_DIR):
    if json_file.endswith(".json"):
        # Get the identifier to match image files
        json_path = os.path.join(JSON_DIR, json_file)
        title = fetch_title_from_json(json_path)

        # Construct image filename (assumes same name as identifier)
        identifier = os.path.splitext(json_file)[0]
        image_path = os.path.join(IMAGES_DIR, f"{identifier}.png")

        if os.path.exists(image_path):
            # Add text to image
            output_path = os.path.join(OUTPUT_DIR, f"{identifier}.png")
            edited_image = add_text_to_image(image_path, title, FONT_PATH, TEXT_COLOR, TEXT_POSITION, TEXT_BOX_SIZE, INITIAL_FONT_SIZE)
            edited_image.save(output_path)
            print(f"Processed: {image_path} -> {output_path}")
        else:
            print(f"Image not found for identifier: {identifier}")

print(f"All processed images saved in '{OUTPUT_DIR}'")
