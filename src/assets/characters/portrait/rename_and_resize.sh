#!/bin/bash

mkdir -p large small

# Loop through all PNG files in the current directory
for file in *.png; do
    # Skip directories and non-files
    if [ -d "$file" ] || [ ! -f "$file" ]; then
        continue
    fi

    # Extract the base name without extension
    basename="${file%.png}"

    # Remove trailing digits from the base name
    base="${basename%%[0-9]*}"

    # Define new filenames for 'large' and 'small' directories
    large_filename="${base}_1024x1536.png"
    small_filename="${base}_190x278.png"

    # Move and rename the file to the 'large' directory
    mv "$file" "large/$large_filename"

    # Resize and save the image to the 'small' directory
    convert "large/$large_filename" -resize 190x278 "small/$small_filename"

done
